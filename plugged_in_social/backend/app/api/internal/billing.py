"""Internal billing endpoints — called by the stevie-stripe-sync and
stevie-billing-cron Cloudflare Workers.

Worker flows:
  - stripe-sync:
      1. Worker pulls a StripeSyncMessage off the stevie-stripe-sync queue.
      2. Worker fetches the latest invoice state from Stripe.
      3. Worker POSTs the synced fields here. We do the DB UPDATE under RLS.
  - billing-cron (daily 09:00 UTC):
      1. Cron Trigger fires the Worker.
      2. Worker POSTs to /reminders/sweep with body ``{}``.
      3. We scan all overdue invoices (system actor — no RLS context),
         bump reminder counters, and return the list of email payloads.
      4. Worker enqueues each payload onto stevie-email-sender via the
         queue-producer Worker.

Security: same shared-header pattern as the other internal endpoints —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``. This matches
the existing convention in ``app/api/internal/webhooks.py``.

Why this lives here instead of ``api/invoices.py``: the public Invoices CRUD
runs through ``get_db_with_rls_dep`` which requires a user JWT. Workers
don't have one — they're system actors — so they post to the internal
router and we set RLS context manually from the org_id in the body.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.internal.webhooks import verify_webhook_secret
from app.db.database import RequestContext, get_db, get_db_with_rls
from app.models import Invoice

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/billing", tags=["internal"])


class InvoiceSyncBody(BaseModel):
    """Payload from the stripe-sync Worker."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to set RLS context for the UPDATE."
        )
    )
    status: str = Field(
        description="Stripe invoice status: draft, open, paid, void, uncollectible."
    )
    amount_paid_cents: int = Field(
        ge=0, description="Stripe amount_paid (already in cents)."
    )
    amount_due_cents: int = Field(
        ge=0, description="Stripe amount_due (already in cents)."
    )
    paid_at: datetime | None = Field(
        default=None,
        description=(
            "ISO-8601 from Stripe's status_transitions.paid_at. ``None`` if "
            "the invoice has never been paid."
        ),
    )


@router.post("/invoice/{invoice_id}/sync", status_code=204)
async def sync_invoice_from_worker(
    request: Request,
    invoice_id: Annotated[uuid.UUID, Path()],
    body: Annotated[InvoiceSyncBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Apply Stripe-synced fields to an Invoice row.

    Returns 204 on success (no body), 404 if the invoice/org pairing
    doesn't exist. The Worker treats 404 as permanent (DLQ), 5xx as
    retryable (CF Queues backs off and retries up to ``max_retries``).
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        # System-actor user_id — no real user is performing this update.
        # We need *something* non-null because some RLS policies key on it
        # via current_user_id(); a fixed UUID per worker keeps audit logs
        # readable rather than scattering nulls.
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )
    async for db in get_db_with_rls(ctx):
        result = await db.execute(
            select(Invoice).where(
                Invoice.id == invoice_id,
                Invoice.org_id == body.org_id,
            )
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Invoice {invoice_id} not found for org {body.org_id}"
                ),
            )

        invoice.status = body.status
        invoice.amount_paid_cents = body.amount_paid_cents
        invoice.amount_due_cents = body.amount_due_cents
        invoice.paid_at = body.paid_at

        await db.flush()
        await db.commit()

        logger.info(
            "Stripe-synced invoice %s (org=%s) → status=%s paid_at=%s",
            invoice_id,
            body.org_id,
            body.status,
            body.paid_at,
        )


# ── Payment-reminder sweep ──────────────────────────────────────────
#
# Driven by the billing-cron Cloudflare Worker (daily 09:00 UTC). Fields
# are individually ``html_escape``d so a malicious ``client_name`` or
# ``description`` can never inject markup into the outgoing email.
#
# Voice / color guidance: warm authority, Stevie Green CTA, system-font
# stack for cross-client rendering.

_STEVIE_GREEN = "#089140"   # primary CTA, action-positive
_STEVIE_BLACK = "#000000"   # body copy
_STEVIE_MUTED = "#4a5568"   # secondary/meta copy

_EMAIL_FONT = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, sans-serif"
)


def _build_reminder_email(inv: Invoice, *, days_overdue: int) -> tuple[str, str]:
    """Return (subject, html_body) for a payment-reminder email."""
    amount_dollars = (inv.amount_due_cents or 0) / 100.0
    name = html_escape(inv.client_name or "there")
    description = html_escape(inv.description or "your recent invoice")

    subject = f"A friendly nudge on your ${amount_dollars:,.2f} invoice"

    pay_link = inv.stripe_hosted_invoice_url
    if pay_link:
        cta_block = (
            f'<p style="margin:28px 0;">'
            f'<a href="{html_escape(pay_link)}" '
            f'style="background:{_STEVIE_GREEN};color:#ffffff;'
            f"padding:14px 24px;text-decoration:none;border-radius:6px;"
            f"display:inline-block;font-weight:600;font-family:{_EMAIL_FONT};"
            f'font-size:15px;">'
            f"Pay invoice</a></p>"
        )
    else:
        cta_block = (
            f'<p style="margin:28px 0;color:{_STEVIE_MUTED};'
            f'font-family:{_EMAIL_FONT};">'
            "Just reply to this email and we'll get you a payment link."
            "</p>"
        )

    day_word = "day" if days_overdue == 1 else "days"
    overdue_line = (
        f"The ${amount_dollars:,.2f} invoice for <strong>{description}"
        f"</strong> was due {days_overdue} {day_word} ago on our end."
    )

    html_body = (
        f'<div style="font-family:{_EMAIL_FONT};color:{_STEVIE_BLACK};'
        f'font-size:16px;line-height:1.55;max-width:560px;">'
        f"<p>Hi {name},</p>"
        f"<p>{overdue_line}</p>"
        f'<p style="color:{_STEVIE_MUTED};">'
        "If payment is already on its way, please disregard this — these "
        "can cross in the mail. Otherwise, one click below and we're "
        "squared away."
        "</p>"
        f"{cta_block}"
        "<p>Thank you for working with us — we appreciate the partnership."
        "</p>"
        "<p>— The Stevie Social Team</p>"
        "</div>"
    )
    return subject, html_body


class RemindersSweepBody(BaseModel):
    """Empty body — the cron Worker carries no per-call parameters.

    Kept as an explicit model (instead of accepting a raw dict) so a
    future addition (e.g. ``dry_run``) is a typed extension rather than
    a contract surprise.
    """


class ReminderItem(BaseModel):
    """One outbound reminder the Worker should fan out to the email queue."""

    invoice_id: uuid.UUID
    org_id: uuid.UUID
    to_email: str
    subject: str
    html_body: str


class RemindersSweepResponse(BaseModel):
    reminders: list[ReminderItem] = Field(
        default_factory=list,
        description=(
            "One entry per invoice that just had its reminder counter "
            "bumped. The Worker enqueues each via the queue-producer "
            "Worker; ordering is not significant."
        ),
    )


@router.post("/reminders/sweep", response_model=RemindersSweepResponse)
async def sweep_payment_reminders(
    body: Annotated[RemindersSweepBody, Body()] = RemindersSweepBody(),
    _: None = Depends(verify_webhook_secret),
) -> RemindersSweepResponse:
    """Find overdue invoices, bump reminder counters, return email payloads.

    System-actor sweep — runs across ALL orgs in a single transaction. We
    use ``get_db`` (no RLS context) here because the cron Worker is not
    acting on behalf of any one tenant; the alternative (a per-org loop)
    would be 100x the round-trips for the same result. RLS-bypass is
    safe here because:
      1. The endpoint is gated by ``verify_webhook_secret`` so only the
         Worker can call it.
      2. We only mutate ``Invoice.reminder_count`` and
         ``last_reminder_at`` — no cross-tenant data leakage on read,
         no cross-tenant write surface beyond those two columns.

    The 3-day throttle (``last_reminder_at < now - 3 days``) keeps a
    daily cron from spamming clients.

    Counter mutation and the returned payload list happen in the same
    transaction: if the commit fails, the Worker sees an error and the
    next cron run retries those invoices naturally. If the commit
    succeeds but the Worker crashes before enqueueing, those invoices
    are throttled out for 3 days.
    """
    now = datetime.now(timezone.utc)
    reminders: list[ReminderItem] = []

    async for db in get_db():
        result = await db.execute(
            select(Invoice).where(
                and_(
                    Invoice.status == "open",
                    Invoice.due_date < now,
                    (
                        Invoice.last_reminder_at.is_(None)
                        | (Invoice.last_reminder_at < now - timedelta(days=3))
                    ),
                )
            )
        )
        overdue = list(result.scalars().all())

        for inv in overdue:
            # Skip rows we can't actually email — otherwise we'd bump the
            # reminder counter for a no-op, making the "last reminder"
            # stamp lie to anyone reviewing a delinquent client.
            if not inv.client_email:
                logger.warning(
                    "Invoice %s overdue but has no client_email — skipping",
                    inv.id,
                )
                continue

            days_overdue = (
                (now.date() - inv.due_date.date()).days if inv.due_date else 0
            )
            subject, html_body = _build_reminder_email(
                inv, days_overdue=days_overdue
            )

            inv.reminder_count = (inv.reminder_count or 0) + 1
            inv.last_reminder_at = now

            reminders.append(
                ReminderItem(
                    invoice_id=inv.id,
                    org_id=inv.org_id,
                    to_email=inv.client_email,
                    subject=subject,
                    html_body=html_body,
                )
            )

        await db.flush()
        # ``get_db`` commits on successful exit, but we flush explicitly
        # so the counter writes are visible before we return — a Worker
        # that immediately retries this endpoint must NOT see the same
        # invoices a second time.

    logger.info(
        "Payment-reminder sweep: %d reminders queued at %s",
        len(reminders),
        now.isoformat(),
    )
    return RemindersSweepResponse(reminders=reminders)
