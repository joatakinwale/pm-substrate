"""Cost tracking service — records API costs from any service.

Usage in other modules:

    from app.services.cost_tracker import record_cost

    # In an async context (API endpoint):
    await record_cost(
        db=db,
        org_id=org_id,
        service="ai_generation",
        operation="content_generation",
        cost_cents=15,
        usage_data={"input_tokens": 500, "output_tokens": 200, "model": "claude-sonnet"},
        reference_type="ai_content_request",
        reference_id=request_id,
        triggered_by=user_id,
    )

    # In a sync context (e.g. inside ``asyncio.to_thread``):
    from app.services.cost_tracker import record_cost_sync
    record_cost_sync(
        org_id=org_id,
        service="ai_generation",
        ...
    )
"""
import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost_tracker import CostEntry, DailyCostSummary, SpendingLimit
from app.models.organization import Organization
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Alert email helpers ──────────────────────────────────

def _format_alert_subject(
    org_name: str, service: str, pct_used: int, monthly_limit_usd: float,
) -> str:
    return (
        f"[Stevie Social] Spending alert: {org_name} at {pct_used}% of "
        f"${monthly_limit_usd:,.2f} {service} limit"
    )


def _format_alert_html(
    *,
    org_name: str,
    service: str,
    monthly_limit_cents: int,
    current_cents: int,
    threshold_pct: int,
    enforcement: str,
    current_month: str,
) -> str:
    """Plain, narrow HTML — owners read this on phones, not in Litmus."""
    pct_used = int((current_cents / monthly_limit_cents) * 100) if monthly_limit_cents else 0
    spent_usd = current_cents / 100
    limit_usd = monthly_limit_cents / 100
    enforcement_blurb = {
        "alert": "We're letting usage continue — this is informational only.",
        "soft_block": "Further usage of this service requires admin override.",
        "hard_block": "Further calls to this service will be rejected until next month.",
    }.get(enforcement, "")
    return f"""<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
<h2 style="color: #5A6F51; margin-top: 0;">Spending alert — {org_name}</h2>
<p>You've crossed <strong>{threshold_pct}%</strong> of your monthly
<strong>{service}</strong> spending limit for <strong>{current_month}</strong>.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f6f6f0; padding: 12px; border-radius: 6px;">
  <tr><td style="padding: 6px 12px; color: #555;">Spent so far</td>
      <td style="padding: 6px 12px; text-align: right; font-weight: 600;">${spent_usd:,.2f}</td></tr>
  <tr><td style="padding: 6px 12px; color: #555;">Monthly limit</td>
      <td style="padding: 6px 12px; text-align: right;">${limit_usd:,.2f}</td></tr>
  <tr><td style="padding: 6px 12px; color: #555;">Used</td>
      <td style="padding: 6px 12px; text-align: right;">{pct_used}%</td></tr>
</table>
<p>{enforcement_blurb}</p>
<p style="color: #666; font-size: 13px; margin-top: 24px;">
  Adjust this limit anytime in Settings → Cost controls.
  This alert sends once per month per service — you won't be re-paged
  until the next billing cycle resets the counter.
</p>
</body></html>"""


async def _send_spending_alert(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    limit: SpendingLimit,
) -> None:
    """Email every active OWNER/ADMIN that the limit has crossed its
    alert threshold. Best-effort: any error is logged, never raised, so
    cost recording itself can never fail because the mailer is unhappy.
    """
    try:
        org_row = await db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = org_row.scalar_one_or_none()
        if org is None:
            logger.warning("spending alert: org %s not found, skipping", org_id)
            return

        recipients_q = select(User).where(
            User.org_id == org_id,
            User.is_active == True,  # noqa: E712
            User.role.in_(["owner", "admin"]),
        )
        recipients = (await db.execute(recipients_q)).scalars().all()
        if not recipients:
            logger.info("spending alert: org %s has no owner/admin recipients", org_id)
            return

        pct_used = int(
            (limit.current_month_cents / limit.monthly_limit_cents) * 100
        ) if limit.monthly_limit_cents else 0
        subject = _format_alert_subject(
            org_name=org.name,
            service=limit.service,
            pct_used=pct_used,
            monthly_limit_usd=limit.monthly_limit_cents / 100,
        )
        html = _format_alert_html(
            org_name=org.name,
            service=limit.service,
            monthly_limit_cents=limit.monthly_limit_cents,
            current_cents=limit.current_month_cents,
            threshold_pct=limit.alert_threshold_pct,
            enforcement=limit.enforcement,
            current_month=limit.current_month or "",
        )

        # Late import — email_sender pulls in httpx / config and we don't
        # want to make cost_tracker import-cost any heavier than it is.
        from app.services.email_sender import send_transactional_email
        for user in recipients:
            try:
                await send_transactional_email(
                    to_email=user.email,
                    subject=subject,
                    html_body=html,
                    org_id=org_id,
                )
            except Exception:
                logger.exception(
                    "spending alert email failed: org=%s user=%s",
                    org_id, user.email,
                )
    except Exception:
        # Catch-all so cost recording is never blocked by alerting.
        logger.exception("spending alert pipeline failed for org %s", org_id)


def _send_spending_alert_sync(
    db, *, org_id: uuid.UUID, limit: SpendingLimit,
) -> None:
    """Sync mirror for sync callers. Same best-effort contract.

    Email send is async-only, so we hand off to a one-shot event loop.
    Cheap because sync callers run in a worker thread with no event loop
    of their own; a fresh loop costs microseconds.
    """
    try:
        import asyncio

        org = db.execute(
            select(Organization).where(Organization.id == org_id)
        ).scalar_one_or_none()
        if org is None:
            logger.warning("spending alert (sync): org %s not found", org_id)
            return

        recipients = db.execute(
            select(User).where(
                User.org_id == org_id,
                User.is_active == True,  # noqa: E712
                User.role.in_(["owner", "admin"]),
            )
        ).scalars().all()
        if not recipients:
            return

        pct_used = int(
            (limit.current_month_cents / limit.monthly_limit_cents) * 100
        ) if limit.monthly_limit_cents else 0
        subject = _format_alert_subject(
            org_name=org.name,
            service=limit.service,
            pct_used=pct_used,
            monthly_limit_usd=limit.monthly_limit_cents / 100,
        )
        html = _format_alert_html(
            org_name=org.name,
            service=limit.service,
            monthly_limit_cents=limit.monthly_limit_cents,
            current_cents=limit.current_month_cents,
            threshold_pct=limit.alert_threshold_pct,
            enforcement=limit.enforcement,
            current_month=limit.current_month or "",
        )

        from app.services.email_sender import send_transactional_email

        async def _send_all():
            for user in recipients:
                try:
                    await send_transactional_email(
                        to_email=user.email,
                        subject=subject,
                        html_body=html,
                        org_id=org_id,
                    )
                except Exception:
                    logger.exception(
                        "spending alert email failed (sync): org=%s user=%s",
                        org_id, user.email,
                    )

        asyncio.run(_send_all())
    except Exception:
        logger.exception("spending alert (sync) pipeline failed for org %s", org_id)


async def record_cost(
    db: AsyncSession,
    org_id: uuid.UUID,
    service: str,
    cost_cents: int,
    operation: str | None = None,
    usage_data: dict | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    triggered_by: uuid.UUID | None = None,
) -> CostEntry:
    """Record a cost entry and update daily summary.

    This is the primary entry point for cost tracking.
    Call this from any service that incurs external API costs.
    """
    now = datetime.now(timezone.utc)

    # Create cost entry
    entry = CostEntry(
        org_id=org_id,
        service=service,
        operation=operation,
        cost_cents=cost_cents,
        usage_data=usage_data or {},
        reference_type=reference_type,
        reference_id=reference_id,
        triggered_by=triggered_by,
        incurred_at=now,
    )
    db.add(entry)

    # Upsert daily summary
    today = now.date()
    summary_result = await db.execute(
        select(DailyCostSummary).where(
            DailyCostSummary.org_id == org_id,
            DailyCostSummary.summary_date == today,
            DailyCostSummary.service == service,
        )
    )
    summary = summary_result.scalar_one_or_none()

    if summary:
        summary.total_cost_cents += cost_cents
        summary.entry_count += 1
    else:
        summary = DailyCostSummary(
            org_id=org_id,
            summary_date=today,
            service=service,
            total_cost_cents=cost_cents,
            entry_count=1,
            aggregates=usage_data or {},
        )
        db.add(summary)

    # Check spending limits
    current_month = now.strftime("%Y-%m")
    limit_result = await db.execute(
        select(SpendingLimit).where(
            SpendingLimit.org_id == org_id,
            SpendingLimit.service.in_([service, "all"]),
        )
    )
    limits = limit_result.scalars().all()

    triggered_alerts: list[SpendingLimit] = []
    for limit in limits:
        # Reset if new month — counters and the alert_sent flag are
        # scoped per billing cycle so crossing the threshold in a new
        # month re-triggers an email.
        if limit.current_month != current_month:
            limit.current_month = current_month
            limit.current_month_cents = 0
            limit.alert_sent = False

        limit.current_month_cents += cost_cents

        # Check threshold. We flip ``alert_sent`` BEFORE sending so a
        # race between two concurrent cost records can't double-fire;
        # the second one sees ``alert_sent=True`` and skips. This is
        # deliberate: once-per-month-per-service is the right noise
        # budget for an informational alert.
        if (
            limit.monthly_limit_cents > 0
            and not limit.alert_sent
            and limit.current_month_cents
            >= limit.monthly_limit_cents * limit.alert_threshold_pct / 100
        ):
            limit.alert_sent = True
            triggered_alerts.append(limit)

    # Flush first so the ``alert_sent`` flip is persisted before we send
    # the email — if the email send hangs, the flag still claimed the
    # slot and no duplicate fires on retry.
    await db.flush()

    for limit in triggered_alerts:
        await _send_spending_alert(db, org_id=org_id, limit=limit)

    return entry


def record_cost_sync(
    org_id: uuid.UUID,
    service: str,
    cost_cents: int,
    operation: str | None = None,
    usage_data: dict | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    triggered_by: uuid.UUID | None = None,
) -> None:
    """Record a cost entry synchronously (for sync code paths).

    Uses the sync database session from app.db.session.
    """
    from app.db.session import SyncSessionLocal

    with SyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        entry = CostEntry(
            org_id=org_id,
            service=service,
            operation=operation,
            cost_cents=cost_cents,
            usage_data=usage_data or {},
            reference_type=reference_type,
            reference_id=reference_id,
            triggered_by=triggered_by,
            incurred_at=now,
        )
        db.add(entry)

        # Upsert daily summary
        today = now.date()
        summary = db.execute(
            select(DailyCostSummary).where(
                DailyCostSummary.org_id == org_id,
                DailyCostSummary.summary_date == today,
                DailyCostSummary.service == service,
            )
        ).scalar_one_or_none()

        if summary:
            summary.total_cost_cents += cost_cents
            summary.entry_count += 1
        else:
            summary = DailyCostSummary(
                org_id=org_id,
                summary_date=today,
                service=service,
                total_cost_cents=cost_cents,
                entry_count=1,
            )
            db.add(summary)

        # Check spending limits. The async path in ``record_cost`` does
        # this too; mirrored here so sync code paths don't silently blow
        # past monthly caps.
        current_month = now.strftime("%Y-%m")
        limits = db.execute(
            select(SpendingLimit).where(
                SpendingLimit.org_id == org_id,
                SpendingLimit.service.in_([service, "all"]),
            )
        ).scalars().all()

        triggered_alerts: list[SpendingLimit] = []
        for limit in limits:
            if limit.current_month != current_month:
                limit.current_month = current_month
                limit.current_month_cents = 0
                limit.alert_sent = False

            limit.current_month_cents += cost_cents

            if (
                limit.monthly_limit_cents > 0
                and not limit.alert_sent
                and limit.current_month_cents
                >= limit.monthly_limit_cents * limit.alert_threshold_pct / 100
            ):
                limit.alert_sent = True
                triggered_alerts.append(limit)

        # Commit the counter + alert_sent flip BEFORE emailing so a
        # crash doesn't lose the counter update on retry.
        db.commit()

        for limit in triggered_alerts:
            _send_spending_alert_sync(db, org_id=org_id, limit=limit)
