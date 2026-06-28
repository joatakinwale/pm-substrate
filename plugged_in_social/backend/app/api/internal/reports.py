"""Internal reports endpoints — called by the stevie-reports-cron Worker.

Worker flow (daily at 02:00 UTC):
  1. Cron Trigger fires the Worker.
  2. Worker POSTs to /reports/sweep-due with body ``{}``.
  3. We scan all active ReportSchedule rows whose next_run_at has passed
     (system actor — no RLS context), compute a metrics snapshot per
     row, insert a ClientReport with status='pending', advance the
     schedule cadence in the same transaction, and return the list of
     {client_report_id, org_id} pairs.
  4. Worker enqueues each pair onto stevie-report-builder via the
     queue-producer Worker. The actual PDF render Worker is a future
     migration (WeasyPrint port) — until it ships, messages sit on
     the queue and the build runs as soon as the consumer comes online.

Security: same shared-header pattern as the other internal endpoints —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``. This matches
the existing convention in ``app/api/internal/billing.py``.

Why this lives here instead of ``api/reports.py``: the public Reports CRUD
runs through ``get_db_with_rls_dep`` which requires a user JWT. The cron
Worker is a system actor with no JWT, so it posts to the internal router
and we sweep across all orgs in one transaction.

The snapshot logic lives inline in this module (rather than importing
from another helper) because this endpoint is the source of truth for
the sweep — the report-builder Worker is the only caller.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, select, text
from sqlalchemy.orm import Session

from app.api.internal.webhooks import verify_webhook_secret
from app.db.database import get_db
from app.db.session import sync_engine
from app.models import ClientReport, ReportSchedule, SocialPost
from app.models.report import ReportCadence, ReportStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/reports", tags=["internal"])

# Fixed system-actor user_id — same constant the billing / ai / video /
# automations internal endpoints use. Real users never share this UUID,
# so audit trails stay readable.
_SYSTEM_USER_ID = "00000000-0000-0000-0000-00000000aaaa"

# ClientReport.status values the render endpoint is allowed to start from.
# 'pending' is the Path B+ status the cron sweep inserts. 'generating' is
# what we flip to mid-render — included so a partially-failed render can
# be retried without external operator intervention. 'failed' is included
# for the same reason. Anything else (e.g. 'generated', 'sent') means the
# report has already reached a terminal state and a duplicate enqueue
# should DLQ rather than overwrite.
_RENDERABLE_STATUSES: frozenset[str] = frozenset({"pending", "generating", "failed"})


# ── Period + cadence math ────────────────────────────────────────────
#
# Kept inline so this endpoint is self-contained.

def _next_run(now: datetime, cadence: str) -> datetime:
    """Advance a schedule's next_run_at according to cadence."""
    if cadence == ReportCadence.weekly.value:
        return now + timedelta(days=7)
    if cadence == ReportCadence.quarterly.value:
        # ~13 weeks
        return now + timedelta(days=91)
    # default monthly — ~30 days; the cron daemon handles month-boundary drift
    return now + timedelta(days=30)


def _period_for_cadence(today: date, cadence: str) -> tuple[date, date]:
    """Return (period_start, period_end) for the most recent closed period."""
    if cadence == ReportCadence.weekly.value:
        end = today - timedelta(days=1)
        start = end - timedelta(days=6)
    elif cadence == ReportCadence.quarterly.value:
        end = today - timedelta(days=1)
        start = end - timedelta(days=89)
    else:
        # monthly — last full calendar month if we're past the 1st,
        # otherwise the trailing 30 days
        if today.day == 1:
            end = today - timedelta(days=1)
            start = date(end.year, end.month, 1)
        else:
            end = today - timedelta(days=1)
            start = end - timedelta(days=29)
    return start, end


async def _compute_metrics_snapshot(
    db,
    *,
    org_id: uuid.UUID,
    project_id: uuid.UUID | None,
    period_start: date,
    period_end: date,
) -> dict:
    """Aggregate social post metrics for the period into a snapshot dict.

    Output keys match the PHASE_KPIS metric keys so the renderer's
    auto-grid finds them. Missing keys render as '—'.
    """
    period_start_dt = datetime.combine(
        period_start, datetime.min.time(), tzinfo=timezone.utc
    )
    period_end_dt = datetime.combine(
        period_end, datetime.max.time(), tzinfo=timezone.utc
    )

    query = select(SocialPost).where(
        and_(
            SocialPost.org_id == org_id,
            SocialPost.published_at.isnot(None),
            SocialPost.published_at >= period_start_dt,
            SocialPost.published_at <= period_end_dt,
        )
    )
    if project_id:
        query = query.where(SocialPost.project_id == project_id)

    result = await db.execute(query)
    posts = list(result.scalars().all())

    total_impressions = sum(int(p.impressions or 0) for p in posts)
    total_likes = sum(int(p.likes or 0) for p in posts)
    total_comments = sum(int(p.comments or 0) for p in posts)
    total_shares = sum(int(p.shares or 0) for p in posts)
    total_reach = sum(int(p.reach or 0) for p in posts)

    eng_rates = [p.engagement_rate for p in posts if p.engagement_rate]
    avg_engagement = (
        round(sum(eng_rates) / len(eng_rates), 2) if eng_rates else 0.0
    )

    amplified_count = sum(1 for p in posts if p.is_amplified)

    return {
        # Generic
        "content_pieces_published": len(posts),
        "total_impressions": total_impressions,
        "total_reach": total_reach,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,

        # Protect-phase keys
        "saves": total_likes,  # treat likes as saves proxy until platform-specific saves wired
        "shares": total_shares,
        "alignment_signals": total_comments,
        "misaligned_inquiry_rate": 0,
        "avg_engagement_rate": avg_engagement,

        # Deepen-phase keys
        "inbound_conversations": total_comments,
        "conversation_quality_score": 0,
        "brand_recognition_mentions": 0,
        "content_library_depth": len(posts),
        "email_open_rate": 0,
        "email_click_rate": 0,

        # Amplify-phase keys
        "organic_amplified_posts": amplified_count,
        "qualified_leads_generated": 0,
        "cost_per_qualified_lead": 0,
        "paid_vs_organic_ratio": 0,
        "roas": 0,
        "total_ad_spend_cents": 0,
    }


# ── Sweep endpoint ───────────────────────────────────────────────────

class SweepDueBody(BaseModel):
    """Empty body — the cron Worker carries no per-call parameters.

    Kept as an explicit model (instead of accepting a raw dict) so a
    future addition (e.g. ``dry_run``) is a typed extension rather than
    a contract surprise.
    """


class DueReportItem(BaseModel):
    """One due report the Worker should fan out to the report-builder queue."""

    client_report_id: uuid.UUID
    org_id: uuid.UUID


class SweepDueResponse(BaseModel):
    reports: list[DueReportItem] = Field(
        default_factory=list,
        description=(
            "One entry per ReportSchedule that just had a ClientReport "
            "row inserted. The Worker enqueues each via the "
            "queue-producer Worker; ordering is not significant."
        ),
    )


@router.post("/sweep-due", response_model=SweepDueResponse)
async def sweep_due_reports(
    body: Annotated[SweepDueBody, Body()] = SweepDueBody(),
    _: None = Depends(verify_webhook_secret),
) -> SweepDueResponse:
    """Find due ReportSchedule rows, snapshot metrics, insert ClientReports.

    System-actor sweep — runs across ALL orgs in a single transaction. We
    use ``get_db`` (no RLS context) here because the cron Worker is not
    acting on behalf of any one tenant; the alternative (a per-org loop)
    would be N round-trips for the same result. RLS-bypass is safe here
    because:
      1. The endpoint is gated by ``verify_webhook_secret`` so only the
         Worker can call it.
      2. We only insert ClientReport rows (each carrying the
         schedule's own ``org_id``) and mutate ``ReportSchedule.last_run_at``
         / ``next_run_at`` — no cross-tenant data leakage on read, no
         cross-tenant write surface beyond the schedule's own columns.

    Inserts and cadence advancement happen in the same transaction: if
    the commit fails, the Worker sees an error and the next cron run
    retries those schedules naturally (next_run_at hasn't moved). If the
    commit succeeds but the Worker crashes before enqueueing, those
    ClientReport rows sit at status='pending' until manually re-driven.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    items: list[DueReportItem] = []

    async for db in get_db():
        result = await db.execute(
            select(ReportSchedule).where(
                and_(
                    ReportSchedule.is_active.is_(True),
                    ReportSchedule.next_run_at <= now,
                )
            )
        )
        due = list(result.scalars().all())

        for sched in due:
            period_start, period_end = _period_for_cadence(today, sched.cadence)
            snapshot = await _compute_metrics_snapshot(
                db,
                org_id=sched.org_id,
                project_id=sched.project_id,
                period_start=period_start,
                period_end=period_end,
            )

            title = (
                f"{sched.client_name} — "
                f"{sched.cadence.capitalize()} Report — "
                f"{period_start.strftime('%b %d')}"
                f"–{period_end.strftime('%b %d, %Y')}"
            )

            report = ClientReport(
                org_id=sched.org_id,
                project_id=sched.project_id,
                title=title,
                # 'pending' is the Path B+ status — the report-builder
                # Worker flips it to 'generated' once the PDF is rendered.
                # Not in ReportStatus enum (which only carries the legacy
                # draft/generated/sent values) because the column is a
                # plain String(30); adding the enum member can wait until
                # the builder Worker ships.
                status="pending",
                cadence=sched.cadence,
                compound_phase=sched.compound_phase,
                client_name=sched.client_name,
                client_email=sched.client_email,
                period_start=period_start,
                period_end=period_end,
                # Let the renderer auto-build sections from the snapshot.
                sections=[],
                metrics_snapshot=snapshot,
            )
            db.add(report)
            await db.flush()  # populate report.id

            # Advance the schedule under the same transaction so a
            # re-fired cron sees an empty due list.
            sched.last_run_at = now
            sched.next_run_at = _next_run(now, sched.cadence)

            items.append(
                DueReportItem(
                    client_report_id=report.id,
                    org_id=report.org_id,
                )
            )

        await db.flush()
        # ``get_db`` commits on successful exit, but we flush explicitly
        # so the cadence + insert writes are visible before we return —
        # a Worker that immediately retries this endpoint must NOT see
        # the same schedules a second time.

    logger.info(
        "Reports sweep: %d schedules due, %d ClientReports created at %s",
        len(items),
        len(items),
        now.isoformat(),
    )
    return SweepDueResponse(reports=items)


# ── Render endpoint ──────────────────────────────────────────────────
#
# Called by the stevie-report-builder Worker for every ClientReport row
# the cron sweep inserted. The Worker's whole job is queue handoff +
# retry orchestration; the actual WeasyPrint render, R2 upload, and
# ClientReport mutation all happen here in one request lifetime. See the
# Worker's README for the design decision (WeasyPrint stays Python-side).
#
# Behaviour:
#   1. Pre-flight status check so a duplicate enqueue 409s instead of
#      redundantly rendering the same PDF.
#   2. Failures bubble as 5xx and the Worker retries — the queue is the
#      retry boundary.


class RenderReportBody(BaseModel):
    """Payload from the report-builder Worker."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to scope the ClientReport lookup and "
            "to set RLS context on writes."
        )
    )


@router.post("/{client_report_id}/render", status_code=204)
async def render_client_report(
    client_report_id: Annotated[uuid.UUID, Path()],
    body: Annotated[RenderReportBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> Response:
    """Render a ClientReport's PDF and persist the result.

    Loads the ClientReport, runs WeasyPrint, uploads to R2, sets
    ``pdf_url`` + ``pdf_generated_at`` + ``status='generated'``, returns
    204 on success.

    Returns 404 if the report/org pairing doesn't exist, 409 if the
    report is already in a terminal status (already generated or sent).
    The Worker treats 204 as ack, 404/409 as PermanentError → ack (DLQ),
    5xx as RetryableError. See the report-builder README for the full
    retry taxonomy.

    Sync-vs-async note:
        ``render_report_pdf`` (WeasyPrint) is a CPU-bound sync call, and
        the R2 upload + DB mutation helpers are sync. We delegate the
        whole pipeline to a worker thread via ``asyncio.to_thread`` so
        the event loop stays responsive while the render runs (5–30s).
        Same pattern as ``app/api/internal/automations.py``.
    """
    result = await asyncio.to_thread(
        _render_report_sync,
        client_report_id=client_report_id,
        org_id=body.org_id,
    )

    error = result.get("error")
    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail=(
                f"ClientReport {client_report_id} not found for org {body.org_id}"
            ),
        )
    if error == "not_renderable":
        # 409 Conflict — the report is already in a terminal status
        # ('generated' or 'sent'). Worker treats this as PermanentError so
        # a duplicate enqueue doesn't overwrite a delivered PDF and the
        # operator sees the message in the DLQ for investigation.
        raise HTTPException(
            status_code=409,
            detail=(
                f"ClientReport {client_report_id} is in status "
                f"'{result.get('status')}', not renderable"
            ),
        )

    # 204 No Content — Worker just needs to know the render landed; the
    # response body would be ignored anyway. Keep the HTTP shape minimal.
    return Response(status_code=204)


# ── Sync render helper ────────────────────────────────────────────────
#
# Imports ``build_report_context`` / ``render_report_pdf`` from
# ``app/services/reports`` for the actual templating + WeasyPrint work;
# this helper handles the orchestration (DB lookup, status flip, R2
# upload, terminal write).


def _set_rls_sync(db: Session, *, org_id: uuid.UUID) -> None:
    """Set Postgres session variables for RLS on a sync session.

    Mirrors ``app.db.database._set_rls_context`` but executes against a
    sync session — needed because the work below runs in a worker thread
    via ``asyncio.to_thread``. Same helper shape as
    ``app/api/internal/automations.py::_set_rls_sync``.
    """
    db.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": str(org_id)},
    )
    db.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": _SYSTEM_USER_ID},
    )
    db.execute(
        text("SELECT set_config('app.current_user_role', :role, true)"),
        {"role": "system"},
    )


def _render_report_sync(
    *,
    client_report_id: uuid.UUID,
    org_id: uuid.UUID,
) -> dict:
    """Render the ClientReport's PDF under a sync DB session.

    Returns ``{}`` on success or ``{"error": "...", ...}`` on lookup /
    state errors. Raises on render / upload failure so the Worker sees a
    5xx and retries.
    """
    from app.core.config import get_settings
    from app.services.reports import build_report_context, render_report_pdf

    settings = get_settings()

    with Session(sync_engine) as db:
        # System-actor RLS context — every read/write below is scoped to
        # ``org_id``. Matches the billing / ai / automations endpoints.
        _set_rls_sync(db, org_id=org_id)

        report = db.get(ClientReport, client_report_id)
        if report is None or report.org_id != org_id:
            logger.error(
                "ClientReport %s not found for org %s",
                client_report_id, org_id,
            )
            return {"error": "not_found"}

        if report.status not in _RENDERABLE_STATUSES:
            logger.warning(
                "ClientReport %s is in status '%s' — not renderable",
                client_report_id, report.status,
            )
            return {"error": "not_renderable", "status": report.status}

        # Flip to 'generating' BEFORE the slow render so a partial failure
        # (network blip mid-upload) doesn't leave the row stuck at
        # 'pending' from a competing perspective and so a retry sees the
        # row in a renderable state. Commit immediately so the status is
        # visible to other readers (e.g. an admin dashboard) during the
        # render window.
        report.status = "generating"
        db.commit()

        # Pull the top-performing posts for the period to enrich the
        # render.
        period_start_dt = datetime.combine(
            report.period_start, datetime.min.time(), tzinfo=timezone.utc
        )
        period_end_dt = datetime.combine(
            report.period_end, datetime.max.time(), tzinfo=timezone.utc
        )
        top_posts = db.execute(
            select(SocialPost)
            .where(
                and_(
                    SocialPost.org_id == report.org_id,
                    SocialPost.published_at >= period_start_dt,
                    SocialPost.published_at <= period_end_dt,
                )
            )
            .order_by(SocialPost.impressions.desc().nullslast())
            .limit(5)
        ).scalars().all()

        # Pull the previous-period snapshot for delta calculations.
        prev_snapshot = _previous_snapshot_sync(db, report)

        # Render the PDF. WeasyPrint raises on template / style errors;
        # we let the exception propagate so FastAPI returns 500 and the
        # Worker retries.
        context = build_report_context(
            report,
            top_posts=list(top_posts),
            previous_snapshot=prev_snapshot,
        )
        pdf_bytes = render_report_pdf(context)

        # Upload to R2 (or the local /tmp fallback if R2 isn't
        # configured — useful in dev).
        pdf_key = f"reports/{report.org_id}/{report.id}.pdf"
        pdf_url = _upload_pdf_to_r2(pdf_bytes, pdf_key, settings)

        # Persist the render result. We move 'generating' → 'generated'
        # explicitly because the renderable-statuses set already gates
        # this code path to states we want to advance.
        report.pdf_url = pdf_url
        report.pdf_generated_at = datetime.now(timezone.utc)
        report.status = ReportStatus.generated.value
        db.commit()

        logger.info(
            "Report PDF generated: %s → %s (size=%d bytes)",
            client_report_id, pdf_url, len(pdf_bytes),
        )

    return {}


def _previous_snapshot_sync(db: Session, report: ClientReport) -> dict:
    """Find the most recent prior report for the same project/cadence.

    Inline so this endpoint is self-contained.
    """
    query = select(ClientReport).where(
        and_(
            ClientReport.org_id == report.org_id,
            ClientReport.cadence == report.cadence,
            ClientReport.id != report.id,
            ClientReport.period_end < report.period_start,
        )
    )
    if report.project_id:
        query = query.where(ClientReport.project_id == report.project_id)
    elif report.client_name:
        query = query.where(ClientReport.client_name == report.client_name)

    query = query.order_by(ClientReport.period_end.desc()).limit(1)
    prior = db.execute(query).scalar_one_or_none()
    return (prior.metrics_snapshot or {}) if prior else {}


def _upload_pdf_to_r2(pdf_bytes: bytes, key: str, settings) -> str:
    """Upload PDF bytes to R2 and return the public URL.

    Falls back to a local file path under /tmp when R2 is not configured
    — useful in dev so the developer can still inspect the PDF without
    standing up R2 credentials.
    """
    if not settings.r2_configured:
        from pathlib import Path
        out = Path("/tmp") / key.replace("/", "_")
        out.write_bytes(pdf_bytes)
        logger.warning(
            "R2 not configured — wrote report PDF to local file: %s "
            "(set R2_ACCESS_KEY_ID etc to upload remotely)",
            out,
        )
        return f"file://{out}"

    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )
    s3.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=pdf_bytes,
        ContentType="application/pdf",
        ContentDisposition="inline",
    )
    return f"{settings.r2_public_url.rstrip('/')}/{key}"
