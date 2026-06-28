"""Internal cron endpoints — called by Cloudflare Workers cron scheduler.

These endpoints are NOT for public use. They're protected by
a shared CRON_SECRET header and do the actual work that the
lightweight Cloudflare Worker triggers on schedule.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db

router = APIRouter(prefix="/internal/cron", tags=["internal"])


async def verify_cron_secret(request: Request) -> None:
    """Verify the cron secret header matches our config.

    Uses the dedicated ``CRON_SECRET`` — NOT the general app
    ``SECRET_KEY`` — so a leak of either secret does not compromise the
    other. Rotate independently.
    """
    settings = get_settings()
    secret = request.headers.get("X-Cron-Secret")
    if not secret or secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Invalid cron secret")


# ── Publish Scheduled Posts (every 15 min) ────────────────

@router.post("/publish-scheduled-posts")
async def publish_scheduled_posts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Publish blog posts whose scheduled_for timestamp has passed."""
    from app.models import BlogPost

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.status == "scheduled",
            BlogPost.scheduled_for <= now,
            BlogPost.is_deleted == False,
        )
    )
    posts = result.scalars().all()

    published_count = 0
    for post in posts:
        post.status = "published"
        post.published_at = now
        published_count += 1

    return {
        "ok": True,
        "published": published_count,
        "timestamp": now.isoformat(),
    }


# ── Sync Analytics (every hour) ──────────────────────────

@router.post("/sync-analytics")
async def sync_analytics(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Pull latest metrics from Umami into ``analytics_daily``.

    Driver lives in ``app.services.umami.sync_all_orgs`` — pulls
    yesterday (UTC) for every active org that has ``settings.umami``
    wired up, skips orgs that don't, and upserts aggregate + top-N
    metrics keyed on the natural unique key so hourly re-runs overwrite
    rather than duplicate.

    Accepts an optional ``?date=YYYY-MM-DD`` query to backfill a
    specific day. Omit for the normal "yesterday" behaviour.
    """
    from app.services.umami import sync_all_orgs

    override = request.query_params.get("date")
    snapshot_date = None
    if override:
        try:
            snapshot_date = datetime.strptime(override, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid ?date — expected YYYY-MM-DD",
            )

    summary = await sync_all_orgs(db, snapshot_date=snapshot_date)
    summary["timestamp"] = datetime.now(timezone.utc).isoformat()
    return summary


# ── Recompute Engagement Scores (daily 2am) ──────────────

@router.post("/recompute-engagement")
async def recompute_engagement(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Recalculate Contact.engagement_score from email events (opens,
    clicks, bounces, unsubs in the last 60 days) and Lead.score from
    pipeline stage + form completeness + revenue range.

    Runs across all orgs — workload is sub-second per org and scales
    linearly with contact/lead counts. Per-org scoping is available on
    the service-layer functions if we ever need to shard.
    """
    from app.services.scoring import (
        recompute_contact_engagement,
        recompute_lead_scores,
    )

    now = datetime.now(timezone.utc)
    contacts_updated = await recompute_contact_engagement(db, now=now)
    leads_updated = await recompute_lead_scores(db, now=now)
    await db.flush()

    return {
        "ok": True,
        "contacts_updated": contacts_updated,
        "leads_updated": leads_updated,
        "timestamp": now.isoformat(),
    }


# ── Cleanup Media (daily 3am) ────────────────────────────

@router.post("/cleanup-media")
async def cleanup_media(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Hard-delete media assets that were soft-deleted >30 days ago.

    Also deletes the actual files from R2/Images/Stream.
    """
    from app.models import MediaAsset
    from app.services.cloudflare import get_images_client, get_r2_client, get_stream_client

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    settings = get_settings()

    result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.is_deleted == True,
            MediaAsset.updated_at <= cutoff,
        )
    )
    assets = result.scalars().all()

    deleted_count = 0
    errors = []

    for asset in assets:
        try:
            # Delete from storage backend
            if asset.storage_backend == "r2" and asset.r2_key and settings.r2_configured:
                get_r2_client().delete_object(asset.r2_key)
            elif asset.storage_backend == "cf_images" and asset.cf_image_id and settings.cf_images_configured:
                await get_images_client().delete_image(asset.cf_image_id)
            elif asset.storage_backend == "cf_stream" and asset.cf_stream_uid and settings.cf_stream_configured:
                await get_stream_client().delete_video(asset.cf_stream_uid)

            # Hard delete from DB
            await db.delete(asset)
            deleted_count += 1
        except Exception as e:
            errors.append({"asset_id": str(asset.id), "error": str(e)})

    return {
        "ok": True,
        "deleted": deleted_count,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Booking Reminders (hourly) ───────────────────────────

@router.post("/booking-reminders")
async def booking_reminders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Send reminder emails for bookings starting inside the next 24h.

    Cloudflare cron hits this hourly. The WHERE clause picks confirmed
    bookings scheduled between ``now`` and ``now + 24h`` that have never
    been reminded (``reminder_sent_at IS NULL``). We flip the flag BEFORE
    the send so a retry/overlap can't double-fire, and swallow any per-row
    failure so one bad booking doesn't stop the batch.

    Dedupe is per-booking lifetime, not per-window: a reschedule zeros
    ``reminder_sent_at`` (see the Aurinko webhook handler) so the new time
    gets its own reminder on the first tick after the reschedule lands.
    """
    from app.models import Booking
    from app.services.booking_notifications import send_booking_reminder

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=24)

    result = await db.execute(
        select(Booking).where(
            Booking.status == "confirmed",
            Booking.scheduled_at > now,
            Booking.scheduled_at <= window_end,
            Booking.reminder_sent_at.is_(None),
        )
    )
    bookings = result.scalars().all()

    sent_count = 0
    errors: list[dict] = []

    from app.services.realtime import broadcast_booking_event

    for booking in bookings:
        # Flip BEFORE the send so a concurrent retry sees the flag set
        # and skips. Flush per-booking so that a Resend timeout on a
        # later booking can't rollback an earlier one's flag flip.
        booking.reminder_sent_at = now
        try:
            await db.flush()
            await send_booking_reminder(db, booking)
            sent_count += 1
            # Tell admin dashboards the reminder indicator should light up.
            await broadcast_booking_event(
                booking.org_id,
                booking.id,
                "reminder_sent",
                {
                    "status": booking.status,
                    "scheduled_at": booking.scheduled_at.isoformat()
                    if booking.scheduled_at
                    else None,
                    "attendee_name": booking.attendee_name,
                    "attendee_email": booking.attendee_email,
                },
            )
        except Exception as e:  # noqa: BLE001
            # ``send_booking_reminder`` already has its own catch-all, so
            # this only fires on a flush/DB error. Reset the flag so the
            # next cron tick can retry.
            booking.reminder_sent_at = None
            errors.append({"booking_id": str(booking.id), "error": str(e)[:300]})

    return {
        "ok": True,
        "reminders_sent": sent_count,
        "errors": errors,
        "window_start": now.isoformat(),
        "window_end": window_end.isoformat(),
        "timestamp": now.isoformat(),
    }


# ── Proactive Agents (daily) ─────────────────────────────

@router.post("/proactive-agents")
async def proactive_agents(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Proactively generate campaign drafts and reports requiring client approval."""
    from app.services.agent_assisted import generate_proactive_campaign_drafts, generate_proactive_reports

    now = datetime.now(timezone.utc)
    
    drafts_created = await generate_proactive_campaign_drafts(db, now)
    reports_created = await generate_proactive_reports(db, now)

    await db.commit()

    return {
        "ok": True,
        "drafts_created": drafts_created,
        "reports_created": reports_created,
        "timestamp": now.isoformat(),
    }


# ── Weekly Digest (Monday 9am) ───────────────────────────

@router.post("/weekly-digest")
async def weekly_digest(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_cron_secret),
):
    """Run the weekly digest for every active org.

    Per-org driver lives in ``app.services.weekly_digest.send_weekly_digest``
    — aggregates last week's social/pipeline/revenue metrics, snapshots
    them into ``analytics_daily``, and emails each org's owners/admins.

    One failed org must not kill the cohort: wrap each org in a savepoint
    so a bad data row in org A still lets org B's digest go out.
    """
    from app.models import Organization
    from app.services.weekly_digest import send_weekly_digest

    now = datetime.now(timezone.utc)
    org_rows = await db.execute(
        select(Organization).where(Organization.is_active == True)  # noqa: E712
    )
    orgs = org_rows.scalars().all()

    results: list[dict] = []
    total_sent = 0
    total_errors = 0

    for org in orgs:
        # Per-org savepoint — rollback only this org's partial writes on
        # failure, keep the others.
        try:
            async with db.begin_nested():
                result = await send_weekly_digest(
                    db, org_id=org.id, now=now,
                )
                results.append(result)
                total_sent += result.get("emails_sent", 0)
                total_errors += len(result.get("email_errors", []))
        except Exception as e:
            # Log the per-org failure but continue; the outer request
            # still returns 200 so Cloudflare doesn't retry the whole run.
            results.append({
                "ok": False,
                "org_id": str(org.id),
                "org_name": org.name,
                "error": str(e)[:300],
            })
            total_errors += 1

    return {
        "ok": True,
        "orgs_processed": len(orgs),
        "emails_sent": total_sent,
        "errors": total_errors,
        "results": results,
        "timestamp": now.isoformat(),
    }
