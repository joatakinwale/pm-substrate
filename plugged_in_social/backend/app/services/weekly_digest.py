"""Weekly digest — per-org aggregate of activity over the last 7 days.

Two entry points:

1. ``build_weekly_digest(db, *, org_id, week_start, week_end)`` — pure
   aggregation. Returns a structured dict of metrics (posts published,
   social engagement totals, new/qualified leads, revenue, projects,
   top-performing posts). Unit-testable without the email layer.

2. ``send_weekly_digest(db, org_id)`` — wraps ``build_weekly_digest`` and
   routes a rendered HTML summary to every OWNER/ADMIN in the org via
   Resend. Snapshots the headline numbers into ``analytics_daily`` keyed
   on the Monday of the week so the dashboard can time-series them without
   recomputing.

Called from the Monday-9am ``/internal/cron/weekly-digest`` endpoint.
Per-org so one org blowing up doesn't kill the cohort. Idempotent: the
snapshot rows use ``ON CONFLICT DO UPDATE`` semantics on the uq_analytics
unique constraint and the email itself is safe to double-send (each send
costs cents and owners would rather see two than zero).
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AnalyticsDaily,
    Invoice,
    Lead,
    Organization,
    Project,
    User,
)
from app.models.lead import QualificationStatus
from app.models.social_media import SocialPost
from app.services.email_sender import send_transactional_email

logger = logging.getLogger(__name__)


# ─── Aggregation ────────────────────────────────────────────

async def build_weekly_digest(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    week_start: datetime,
    week_end: datetime,
) -> dict[str, Any]:
    """Assemble one org's weekly metrics.

    The boundary semantics: ``week_start`` inclusive, ``week_end`` exclusive
    — matches Python range convention and avoids edge double-counting when
    the scheduler runs at exactly 00:00 UTC on the boundary.

    Returns a dict shaped for both the email template and the snapshot
    writer. All counts default to 0 so a quiet week still renders cleanly.
    """
    # ── Social posts published this week ─────────────────
    posts_q = (
        select(
            func.count(SocialPost.id).label("count"),
            func.coalesce(func.sum(SocialPost.impressions), 0).label("impressions"),
            func.coalesce(func.sum(SocialPost.likes), 0).label("likes"),
            func.coalesce(func.sum(SocialPost.comments), 0).label("comments"),
            func.coalesce(func.sum(SocialPost.shares), 0).label("shares"),
            func.coalesce(func.sum(SocialPost.reach), 0).label("reach"),
        )
        .where(
            SocialPost.org_id == org_id,
            SocialPost.status == "published",
            SocialPost.published_at >= week_start,
            SocialPost.published_at < week_end,
        )
    )
    post_row = (await db.execute(posts_q)).one()

    # Top 5 performing posts by impressions (this week only)
    top_posts_q = (
        select(
            SocialPost.id,
            SocialPost.platform,
            SocialPost.caption,
            SocialPost.impressions,
            SocialPost.likes,
            SocialPost.comments,
            SocialPost.shares,
            SocialPost.platform_url,
            SocialPost.engagement_rate,
        )
        .where(
            SocialPost.org_id == org_id,
            SocialPost.status == "published",
            SocialPost.published_at >= week_start,
            SocialPost.published_at < week_end,
        )
        .order_by(SocialPost.impressions.desc().nulls_last())
        .limit(5)
    )
    top_posts_rows = (await db.execute(top_posts_q)).all()
    top_posts = [
        {
            "id": str(r.id),
            "platform": r.platform,
            # Cap caption at 140 chars — anything longer bloats the email
            # without adding info; owner can click through for the full copy.
            "excerpt": (r.caption[:140] + "…") if r.caption and len(r.caption) > 140 else (r.caption or ""),
            "impressions": r.impressions or 0,
            "likes": r.likes or 0,
            "comments": r.comments or 0,
            "shares": r.shares or 0,
            "url": r.platform_url,
            "engagement_rate": float(r.engagement_rate) if r.engagement_rate is not None else None,
        }
        for r in top_posts_rows
    ]

    # ── Leads this week ─────────────────────────────────
    # `new_leads` = created in window. `qualified_leads` = status transitioned
    # to qualified/converted at some point before week_end (cheap proxy via
    # current status + updated_at within window).
    new_leads_q = select(func.count(Lead.id)).where(
        Lead.org_id == org_id,
        Lead.created_at >= week_start,
        Lead.created_at < week_end,
    )
    new_leads = (await db.execute(new_leads_q)).scalar() or 0

    qualified_leads_q = select(func.count(Lead.id)).where(
        Lead.org_id == org_id,
        Lead.qualification_status.in_([
            QualificationStatus.QUALIFIED.value,
            QualificationStatus.CONVERTED.value,
        ]),
        Lead.updated_at >= week_start,
        Lead.updated_at < week_end,
    )
    qualified_leads = (await db.execute(qualified_leads_q)).scalar() or 0

    avg_lead_score_q = select(func.avg(Lead.score)).where(
        Lead.org_id == org_id,
        Lead.created_at >= week_start,
        Lead.created_at < week_end,
        Lead.score.isnot(None),
    )
    avg_lead_score_raw = (await db.execute(avg_lead_score_q)).scalar()
    avg_lead_score = round(float(avg_lead_score_raw), 1) if avg_lead_score_raw is not None else 0.0

    # ── Revenue this week (paid invoices) ────────────────
    revenue_q = select(
        func.count(Invoice.id).label("invoice_count"),
        func.coalesce(func.sum(Invoice.amount_paid_cents), 0).label("paid_cents"),
    ).where(
        Invoice.org_id == org_id,
        Invoice.status == "paid",
        Invoice.paid_at >= week_start,
        Invoice.paid_at < week_end,
    )
    revenue_row = (await db.execute(revenue_q)).one()

    # ── Projects ────────────────────────────────────────
    active_projects_q = select(func.count(Project.id)).where(
        Project.org_id == org_id,
        Project.status == "active",
    )
    active_projects = (await db.execute(active_projects_q)).scalar() or 0

    completed_projects_q = select(func.count(Project.id)).where(
        Project.org_id == org_id,
        Project.status == "completed",
        Project.updated_at >= week_start,
        Project.updated_at < week_end,
    )
    completed_projects = (await db.execute(completed_projects_q)).scalar() or 0

    new_projects_q = select(func.count(Project.id)).where(
        Project.org_id == org_id,
        Project.created_at >= week_start,
        Project.created_at < week_end,
    )
    new_projects = (await db.execute(new_projects_q)).scalar() or 0

    return {
        "org_id": str(org_id),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "posts": {
            "published": post_row.count or 0,
            "impressions": int(post_row.impressions or 0),
            "reach": int(post_row.reach or 0),
            "likes": int(post_row.likes or 0),
            "comments": int(post_row.comments or 0),
            "shares": int(post_row.shares or 0),
            "total_engagement": int(
                (post_row.likes or 0) + (post_row.comments or 0) + (post_row.shares or 0)
            ),
        },
        "top_posts": top_posts,
        "leads": {
            "new": new_leads,
            "qualified": qualified_leads,
            "avg_score": avg_lead_score,
        },
        "revenue": {
            "invoice_count": revenue_row.invoice_count or 0,
            "paid_cents": int(revenue_row.paid_cents or 0),
            "paid_usd": round((revenue_row.paid_cents or 0) / 100, 2),
        },
        "projects": {
            "active": active_projects,
            "completed_this_week": completed_projects,
            "new_this_week": new_projects,
        },
    }


# ─── Snapshot to analytics_daily ─────────────────────────────

# Weekly snapshots live under their own metric_type prefix so they don't
# collide with the daily Umami series. Dimensions carry the week window
# so two overlapping weeks (e.g. manual re-run) don't clobber each other.
_SNAPSHOT_METRICS = {
    "weekly_posts_published": lambda d: d["posts"]["published"],
    "weekly_posts_impressions": lambda d: d["posts"]["impressions"],
    "weekly_posts_engagement": lambda d: d["posts"]["total_engagement"],
    "weekly_leads_new": lambda d: d["leads"]["new"],
    "weekly_leads_qualified": lambda d: d["leads"]["qualified"],
    "weekly_revenue_cents": lambda d: d["revenue"]["paid_cents"],
    "weekly_projects_completed": lambda d: d["projects"]["completed_this_week"],
}


async def snapshot_weekly_digest(
    db: AsyncSession,
    digest: dict[str, Any],
    *,
    org_id: uuid.UUID,
    snapshot_date: date,
) -> int:
    """Upsert each headline metric as an AnalyticsDaily row.

    ``snapshot_date`` is the Monday the week starts on — using a Date
    (not datetime) matches the column type and gives us one row per
    week per metric. Dimensions carry the full window so the dashboard
    can tell "which week".

    Uses Postgres ``INSERT ... ON CONFLICT DO UPDATE`` on the natural
    unique key ``(org_id, date, metric_type, dimensions)`` so re-runs
    overwrite rather than duplicate.
    """
    written = 0
    dims = {
        "period": "weekly",
        "week_start": digest["week_start"],
        "week_end": digest["week_end"],
    }
    for metric_type, getter in _SNAPSHOT_METRICS.items():
        value = float(getter(digest))
        stmt = pg_insert(AnalyticsDaily).values(
            org_id=org_id,
            date=snapshot_date,
            metric_type=metric_type,
            value=value,
            dimensions=dims,
        ).on_conflict_do_update(
            constraint="uq_analytics_daily_org_date_metric_dims",
            set_={"value": value, "updated_at": datetime.now(timezone.utc)},
        )
        await db.execute(stmt)
        written += 1
    return written


# ─── Email rendering ────────────────────────────────────────

def _fmt_int(n: int) -> str:
    return f"{n:,}"


def _fmt_cents(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def render_digest_email_html(digest: dict[str, Any], *, org_name: str) -> str:
    """Render the digest dict into on-brand HTML.

    Kept deliberately self-contained: no Jinja, no template file lookups.
    Weekly digest is a single simple email and pulling in a template
    engine just for it would add a dep we'd have to wire through Resend
    sandboxing tests.
    """
    week_start = datetime.fromisoformat(digest["week_start"])
    week_end = datetime.fromisoformat(digest["week_end"])
    week_label = f"{week_start.strftime('%b %d')} – {(week_end - timedelta(days=1)).strftime('%b %d, %Y')}"

    posts = digest["posts"]
    leads = digest["leads"]
    revenue = digest["revenue"]
    projects = digest["projects"]
    top_posts = digest["top_posts"]

    def card(label: str, value: str, sub: str = "") -> str:
        sub_html = f'<div style="color:#888;font-size:12px;margin-top:4px">{sub}</div>' if sub else ""
        return (
            '<td style="padding:16px;background:#fafaf8;border-radius:8px;'
            'border:1px solid #ececec;width:33%;vertical-align:top">'
            f'<div style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.04em">{label}</div>'
            f'<div style="color:#111;font-size:24px;font-weight:600;margin-top:6px">{value}</div>'
            f"{sub_html}"
            "</td>"
        )

    # Top-post rows
    if top_posts:
        post_rows_html = "".join(
            (
                '<tr><td style="padding:12px 0;border-bottom:1px solid #ececec">'
                f'<div style="color:#111;font-size:14px;font-weight:500">'
                f'{(p["platform"] or "").title()} · {_fmt_int(p["impressions"])} impressions'
                "</div>"
                f'<div style="color:#555;font-size:13px;margin-top:4px">'
                f'{p["excerpt"] or "<em>(no caption)</em>"}'
                "</div>"
                f'<div style="color:#888;font-size:12px;margin-top:4px">'
                f'{p["likes"]} likes · {p["comments"]} comments · {p["shares"]} shares'
                + (f' · <a href="{p["url"]}" style="color:#5A6F51">View post</a>' if p["url"] else "")
                + "</div>"
                "</td></tr>"
            )
            for p in top_posts
        )
        top_section = (
            '<h2 style="color:#111;font-size:18px;margin:32px 0 8px">Top performing posts</h2>'
            f'<table width="100%" style="border-collapse:collapse">{post_rows_html}</table>'
        )
    else:
        top_section = (
            '<h2 style="color:#111;font-size:18px;margin:32px 0 8px">Top performing posts</h2>'
            '<p style="color:#888;font-size:14px">No posts published this week.</p>'
        )

    return f"""<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;margin:0;padding:0;color:#111">
<table width="100%" style="max-width:640px;margin:0 auto;padding:32px 24px;border-collapse:collapse">
<tr><td>
  <div style="color:#5A6F51;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Stevie Social · Weekly Recap</div>
  <h1 style="color:#111;font-size:28px;margin:8px 0 4px;font-weight:600">Your week in numbers</h1>
  <div style="color:#666;font-size:14px;margin-bottom:24px">{org_name} · {week_label}</div>

  <h2 style="color:#111;font-size:18px;margin:24px 0 8px">Content</h2>
  <table width="100%" style="border-collapse:separate;border-spacing:8px 0">
    <tr>
      {card("Posts published", _fmt_int(posts["published"]))}
      {card("Impressions", _fmt_int(posts["impressions"]), f"{_fmt_int(posts['reach'])} reach")}
      {card("Engagement", _fmt_int(posts["total_engagement"]),
            f"{posts['likes']}❤ {posts['comments']}💬 {posts['shares']}↗")}
    </tr>
  </table>

  <h2 style="color:#111;font-size:18px;margin:24px 0 8px">Pipeline</h2>
  <table width="100%" style="border-collapse:separate;border-spacing:8px 0">
    <tr>
      {card("New leads", _fmt_int(leads["new"]))}
      {card("Qualified / converted", _fmt_int(leads["qualified"]))}
      {card("Avg score", str(leads["avg_score"]), "0-100 scale")}
    </tr>
  </table>

  <h2 style="color:#111;font-size:18px;margin:24px 0 8px">Revenue</h2>
  <table width="100%" style="border-collapse:separate;border-spacing:8px 0">
    <tr>
      {card("Invoices paid", _fmt_int(revenue["invoice_count"]))}
      {card("Collected", _fmt_cents(revenue["paid_cents"]))}
      {card("Projects", _fmt_int(projects["active"]),
            f"{projects['new_this_week']} new · {projects['completed_this_week']} completed")}
    </tr>
  </table>

  {top_section}

  <p style="color:#888;font-size:12px;margin-top:40px;border-top:1px solid #ececec;padding-top:16px">
    This is an automated weekly recap. Numbers reflect activity from {week_label}.
    Dashboard has live metrics at any time.
  </p>
</td></tr>
</table>
</body>
</html>"""


# ─── End-to-end per-org driver ──────────────────────────────

async def send_weekly_digest(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    week_start: datetime | None = None,
    week_end: datetime | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Aggregate → snapshot → email owners/admins for one org.

    Default window is the 7 days ending at the most recent Monday 00:00 UTC
    — "last week" in the US-centric agency sense. Callable with explicit
    bounds for back-fill / manual re-run.

    Returns summary stats suitable for the cron response (how many
    recipients received the email, snapshot row count). Email failures
    per-recipient are collected but do NOT rollback the snapshot — the
    numbers are still true even if delivery hiccuped.
    """
    now = now or datetime.now(timezone.utc)
    if week_start is None or week_end is None:
        # Roll back to most recent Monday 00:00 UTC as the END of the window.
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        days_since_monday = today.weekday()  # Mon=0
        this_monday = today - timedelta(days=days_since_monday)
        week_end = this_monday
        week_start = week_end - timedelta(days=7)

    # Org lookup for email header / logging. Skip silently if the org was
    # deleted between scheduler firing and this handler running.
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if org is None:
        logger.warning("send_weekly_digest: org %s not found", org_id)
        return {"ok": False, "reason": "org_not_found", "org_id": str(org_id)}

    digest = await build_weekly_digest(
        db, org_id=org_id, week_start=week_start, week_end=week_end,
    )

    # Snapshot to analytics_daily — uses week_start as the date key
    # (Monday of the window). One row per metric so the dashboard can
    # series them cleanly.
    snapshot_date = week_start.date()
    snapshot_count = await snapshot_weekly_digest(
        db, digest, org_id=org_id, snapshot_date=snapshot_date,
    )

    # Who gets emailed: every OWNER or ADMIN in the org who's active. We
    # deliberately skip EDITOR/VIEWER/CLIENT — this is an internal KPI
    # email, not a client-facing report.
    recipients_q = select(User).where(
        User.org_id == org_id,
        User.is_active == True,  # noqa: E712
        User.role.in_(["owner", "admin"]),
    )
    recipients = (await db.execute(recipients_q)).scalars().all()

    html = render_digest_email_html(digest, org_name=org.name)
    subject = f"Weekly recap · {digest['posts']['published']} posts, {digest['leads']['new']} new leads"

    sent = 0
    errors: list[dict[str, str]] = []
    for user in recipients:
        try:
            result = await send_transactional_email(
                to_email=user.email,
                subject=subject,
                html_body=html,
                org_id=org_id,
            )
            if result.success:
                sent += 1
            else:
                errors.append({"email": user.email, "error": result.error or "unknown"})
        except Exception as e:  # noqa: BLE001 — one bad addr must not kill the batch
            logger.exception(
                "weekly_digest email failed for %s (org=%s)", user.email, org_id,
            )
            errors.append({"email": user.email, "error": str(e)[:200]})

    logger.info(
        "weekly_digest org=%s window=%s→%s posts=%d leads=%d sent=%d errors=%d",
        org_id, week_start.date(), week_end.date(),
        digest["posts"]["published"], digest["leads"]["new"], sent, len(errors),
    )

    return {
        "ok": True,
        "org_id": str(org_id),
        "org_name": org.name,
        "window": {"start": week_start.isoformat(), "end": week_end.isoformat()},
        "recipients": len(recipients),
        "emails_sent": sent,
        "email_errors": errors,
        "snapshot_rows": snapshot_count,
        "metrics": {
            "posts_published": digest["posts"]["published"],
            "total_impressions": digest["posts"]["impressions"],
            "new_leads": digest["leads"]["new"],
            "qualified_leads": digest["leads"]["qualified"],
            "revenue_cents": digest["revenue"]["paid_cents"],
        },
    }
