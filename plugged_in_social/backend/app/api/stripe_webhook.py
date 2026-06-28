"""Stripe webhook handler — processes billing events with idempotency.

This endpoint receives webhooks directly from Stripe (not via the CF Worker).
Stripe signs each request; we verify with ``construct_webhook_event``. The
``stripe_events`` table ensures each event is processed exactly once.

Response-code contract (STRIPE-4)
---------------------------------
Stripe retries non-2xx responses with exponential backoff for up to 3 days.
The pre-fix code wrapped everything in ``try/except`` and returned 200 even
on handler failure, which silently buried real errors — Stripe would never
retry and the event would be lost forever.

Post-fix policy:

  - **Bad signature** → 400. Retrying won't fix a bad signature.
  - **Already processed (idempotent)** → 200.
  - **Unknown/unhandled event type** → 200. Stripe should stop retrying
    something we intentionally ignore.
  - **Permanent error** (missing metadata, non-existent local record) →
    200 + row marked ``status='skipped'``. No amount of Stripe retries
    will recover this; log it and move on.
  - **Transient error** (DB down, external service hiccup) → 500 so Stripe
    retries. Row stays as ``status='processing'`` or flips to ``'failed'``
    so the next delivery can re-process.

Idempotency race-fix (STRIPE-5)
-------------------------------
The previous ``SELECT → INSERT`` pattern had a window where two concurrent
deliveries of the same event both saw no row and both inserted. We now
INSERT first and catch ``IntegrityError`` on the unique ``stripe_event_id``
constraint — letting Postgres serialize the decision for us.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.models import Invoice, Subscription, StripeEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# Event types we intentionally ignore. Returning 200 for these stops Stripe
# from retrying them into eternity.
_IGNORED_EVENT_TYPES: set[str] = set()


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events.

    Events are verified via Stripe signature, then de-duplicated using the
    ``stripe_events`` table before processing. See module docstring for the
    response-code contract.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature header")

    # ── Verify signature ─────────────────────────────────────
    try:
        from app.services.stripe_billing import construct_webhook_event
        event = construct_webhook_event(payload, sig_header)
    except Exception as e:
        logger.warning("Stripe webhook signature verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    # ── Idempotency: INSERT first, catch uniqueness violation (STRIPE-5) ──
    #
    # The pre-fix SELECT-then-INSERT had a race: under concurrent Stripe
    # deliveries (which DO happen — Stripe retries aggressively on any 5xx),
    # two coroutines could both see no row and both insert. The unique index
    # on ``stripe_event_id`` always protected against a double-INSERT at the
    # storage layer, but the application could still dispatch handlers
    # twice — once per racer — before the INSERT flush failed.
    #
    # Now we INSERT first and let Postgres be the arbiter. If the INSERT
    # raises IntegrityError, someone else won the race and is processing (or
    # has processed) the event; we return 200 to stop Stripe retrying.
    stripe_event = StripeEvent(
        stripe_event_id=event.id,
        event_type=event.type,
        api_version=event.get("api_version"),
        payload=event.to_dict(),
        status="processing",
    )
    db.add(stripe_event)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # Someone else already inserted this event. Their processing may or
        # may not be complete — either way, we defer to them and Stripe
        # should stop retrying.
        logger.info(
            "Stripe event %s already recorded (concurrent or duplicate delivery)",
            event.id,
        )
        return {"ok": True, "message": "Event already processed", "event_id": event.id}

    # ── Route to handler ─────────────────────────────────────
    #
    # Handler-level errors are now split into two classes:
    #  * ``PermanentEventError`` → we mark the row "skipped" and return 200
    #    so Stripe stops retrying. These are errors no retry can fix.
    #  * Anything else → we mark the row "failed", re-raise as HTTP 500 so
    #    Stripe retries. DB transaction is rolled back so the "failed" mark
    #    must be committed separately (done via a nested scope below).
    try:
        await _handle_event(event, db)
        stripe_event.status = "processed"
        stripe_event.processed_at = datetime.now(timezone.utc)
        await db.commit()
    except PermanentEventError as e:
        # Non-retryable: bad metadata, missing local record we can't create,
        # etc. Record the reason and return 200.
        logger.warning(
            "Stripe webhook %s permanently failed (%s): %s",
            event.type, event.id, e,
        )
        stripe_event.status = "skipped"
        stripe_event.error_message = str(e)[:500]
        await db.commit()
        return {"ok": True, "event_id": event.id, "type": event.type, "skipped": True}
    except Exception as e:
        logger.exception(
            "Stripe webhook handler error for %s (%s): %s",
            event.type, event.id, e,
        )
        # Flip to failed + commit so the next retry sees the failure state
        # and we don't lose the forensic trail. The handler's DB changes
        # (if any) are rolled back by the nested rollback below; we keep
        # only the event-row bookkeeping.
        await db.rollback()
        stripe_event.status = "failed"
        stripe_event.error_message = str(e)[:500]
        db.add(stripe_event)  # re-attach after rollback detached it
        # Best-effort persist; if this itself fails, Stripe will retry
        # anyway and the duplicate-insert path will no-op.
        try:
            await db.commit()
        except Exception:
            logger.exception("Failed to persist failure state for event %s", event.id)
        # Tell Stripe to retry.
        raise HTTPException(status_code=500, detail="Handler error — will retry")

    return {"ok": True, "event_id": event.id, "type": event.type}


class PermanentEventError(Exception):
    """Handler encountered a condition no retry can fix.

    Examples: event metadata is missing required ``org_id``; we reference
    a local Invoice by ``stripe_invoice_id`` but it doesn't exist and the
    event doesn't carry enough data to create it.
    """


async def _handle_event(event, db: AsyncSession) -> None:
    """Dispatch event to the appropriate handler."""
    event_type = event.type
    data = event.data.object

    handlers = {
        # Invoice lifecycle
        "invoice.created": _handle_invoice_created,
        "invoice.finalized": _handle_invoice_updated,
        "invoice.paid": _handle_invoice_paid,
        "invoice.payment_failed": _handle_invoice_updated,
        "invoice.voided": _handle_invoice_updated,
        "invoice.marked_uncollectible": _handle_invoice_updated,

        # Payment Intent failures (STRIPE-1)
        # These fire for one-off PIs (not tied to an Invoice) — e.g. a
        # direct charge. The Invoice-level ``invoice.payment_failed`` does
        # NOT cover this case.
        "payment_intent.payment_failed": _handle_payment_intent_failed,

        # Chargebacks / disputes (STRIPE-1)
        "charge.dispute.created": _handle_charge_dispute,
        "charge.dispute.updated": _handle_charge_dispute,
        "charge.dispute.closed":  _handle_charge_dispute,

        # Subscription lifecycle
        "customer.subscription.created": _handle_subscription_event,
        "customer.subscription.updated": _handle_subscription_event,
        "customer.subscription.deleted": _handle_subscription_deleted,

        # Trial warning (STRIPE-3)
        # Stripe fires this 3 days before a trialing subscription's card
        # gets charged. We use it to email the customer and (optionally)
        # set an internal flag so dunning doesn't double up.
        "customer.subscription.trial_will_end": _handle_trial_will_end,
    }

    handler = handlers.get(event_type)
    if handler:
        await handler(data, db)
    elif event_type in _IGNORED_EVENT_TYPES:
        logger.info("Intentionally ignoring Stripe event: %s", event_type)
    else:
        # Unknown event types are not a failure — just log. Stripe sends
        # many event types we don't care about; we return 200 so it stops
        # retrying.
        logger.info("Unhandled Stripe event type: %s (%s)", event_type, event.id)


# ── Invoice handlers ─────────────────────────────────────────

async def _handle_invoice_created(data: dict, db: AsyncSession) -> None:
    """Sync a newly created Stripe invoice to local DB."""
    stripe_inv_id = data.get("id")
    existing = await db.execute(
        select(Invoice).where(Invoice.stripe_invoice_id == stripe_inv_id)
    )
    if existing.scalar_one_or_none():
        return  # Already exists locally

    metadata = data.get("metadata", {})
    org_id = metadata.get("org_id")
    if not org_id:
        # Invoice wasn't created through our system — Stripe Dashboard, a
        # different product, etc. Not a retryable condition; drop with a 200.
        raise PermanentEventError(
            f"invoice.created {stripe_inv_id} has no org_id metadata"
        )

    import uuid
    invoice = Invoice(
        org_id=uuid.UUID(org_id),
        stripe_invoice_id=stripe_inv_id,
        stripe_customer_id=data.get("customer"),
        stripe_subscription_id=data.get("subscription"),
        stripe_payment_intent_id=data.get("payment_intent"),
        stripe_hosted_invoice_url=data.get("hosted_invoice_url"),
        stripe_invoice_pdf=data.get("invoice_pdf"),
        status=data.get("status", "draft"),
        currency=data.get("currency", "usd"),
        subtotal_cents=data.get("subtotal", 0),
        tax_cents=data.get("tax", 0) or 0,
        total_cents=data.get("total", 0),
        amount_paid_cents=data.get("amount_paid", 0),
        amount_due_cents=data.get("amount_due", 0),
        client_name=data.get("customer_name"),
        client_email=data.get("customer_email"),
        compound_phase=metadata.get("compound_phase"),
    )
    db.add(invoice)


async def _handle_invoice_paid(data: dict, db: AsyncSession) -> None:
    """Mark local invoice as paid and record payment timestamp."""
    stripe_inv_id = data.get("id")
    result = await db.execute(
        select(Invoice).where(Invoice.stripe_invoice_id == stripe_inv_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        return

    invoice.status = "paid"
    invoice.amount_paid_cents = data.get("amount_paid", invoice.total_cents)
    invoice.amount_due_cents = 0
    invoice.paid_at = datetime.now(timezone.utc)
    invoice.stripe_hosted_invoice_url = data.get("hosted_invoice_url")
    invoice.stripe_invoice_pdf = data.get("invoice_pdf")
    invoice.stripe_payment_intent_id = data.get("payment_intent")

    # Activity timeline event — best-effort, swallowed on error
    from app.services.activity_log import log_invoice_paid
    await log_invoice_paid(db, invoice, source="stripe_webhook")


async def _handle_invoice_updated(data: dict, db: AsyncSession) -> None:
    """Sync invoice status and amounts from Stripe."""
    stripe_inv_id = data.get("id")
    result = await db.execute(
        select(Invoice).where(Invoice.stripe_invoice_id == stripe_inv_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        return

    invoice.status = data.get("status", invoice.status)
    invoice.subtotal_cents = data.get("subtotal", invoice.subtotal_cents)
    invoice.tax_cents = data.get("tax", 0) or invoice.tax_cents
    invoice.total_cents = data.get("total", invoice.total_cents)
    invoice.amount_paid_cents = data.get("amount_paid", invoice.amount_paid_cents)
    invoice.amount_due_cents = data.get("amount_due", invoice.amount_due_cents)
    invoice.stripe_hosted_invoice_url = data.get("hosted_invoice_url")
    invoice.stripe_invoice_pdf = data.get("invoice_pdf")


# ── Payment Intent handler (STRIPE-1) ────────────────────────

async def _handle_payment_intent_failed(data: dict, db: AsyncSession) -> None:
    """Handle payment_intent.payment_failed.

    Fires for direct PI failures that are NOT wrapped in an Invoice (e.g.,
    one-off charges). We record the failure on the linked Invoice if one
    exists; otherwise log and move on — the event itself is the record.
    """
    pi_id = data.get("id")
    invoice_id = data.get("invoice")  # Stripe invoice id if any

    last_error = data.get("last_payment_error") or {}
    error_msg = last_error.get("message") or last_error.get("code") or "payment_failed"

    # If the PI is attached to one of our local invoices, reflect it there.
    if invoice_id:
        result = await db.execute(
            select(Invoice).where(Invoice.stripe_invoice_id == invoice_id)
        )
        invoice = result.scalar_one_or_none()
        if invoice:
            # Don't overwrite "paid" if a later-received paid event landed
            # first (webhooks aren't ordered).
            if invoice.status not in ("paid", "void"):
                invoice.status = "past_due"
                # Track the failure reason in internal_notes so ops can grep
                existing = invoice.internal_notes or ""
                stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
                invoice.internal_notes = (
                    f"{existing}\n[{stamp}] PI {pi_id} failed: {error_msg[:200]}"
                ).strip()
            return

    # No linked local invoice — nothing more to sync.
    logger.warning(
        "payment_intent.payment_failed for PI %s (invoice=%s): %s",
        pi_id, invoice_id, error_msg,
    )


# ── Dispute handler (STRIPE-1) ───────────────────────────────

async def _handle_charge_dispute(data: dict, db: AsyncSession) -> None:
    """Handle charge.dispute.{created,updated,closed}.

    A dispute (chargeback) is serious — we flag the linked invoice so ops
    can respond within Stripe's evidence window. The dispute amount may
    differ from the original charge (partial chargebacks happen).
    """
    dispute_id = data.get("id")
    charge_id = data.get("charge")
    reason = data.get("reason", "unknown")
    status = data.get("status", "unknown")
    amount_cents = data.get("amount", 0)

    # Stripe gives us the charge id. We track invoices by
    # stripe_payment_intent_id; the charge's PI lives on the dispute via
    # ``data.get('payment_intent')``.
    pi_id = data.get("payment_intent")
    if not pi_id:
        logger.warning(
            "Dispute %s has no payment_intent — cannot link to local invoice",
            dispute_id,
        )
        return

    result = await db.execute(
        select(Invoice).where(Invoice.stripe_payment_intent_id == pi_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        # Dispute may be for a charge that wasn't created through our app
        # (customer paid through Stripe Dashboard). Log only.
        logger.warning(
            "Dispute %s for PI %s has no matching local invoice",
            dispute_id, pi_id,
        )
        return

    # Flag status as "disputed" (added to status lexicon; column is String).
    # Don't unwind "paid" — Stripe will reverse the payment via a separate
    # event chain if the dispute is lost.
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    prior = invoice.internal_notes or ""
    invoice.internal_notes = (
        f"{prior}\n[{stamp}] Dispute {dispute_id} "
        f"({status}, reason={reason}, amount={amount_cents}c) on charge {charge_id}"
    ).strip()

    if status in ("warning_needs_response", "needs_response", "under_review"):
        invoice.status = "disputed"
    # "won" / "lost" / "warning_closed" — leave current status; the paid/
    # voided transitions come from separate Stripe events.


# ── Subscription handlers ────────────────────────────────────

async def _handle_subscription_event(data: dict, db: AsyncSession) -> None:
    """Create or update local subscription record from Stripe event."""
    stripe_sub_id = data.get("id")
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub_id
        )
    )
    sub = result.scalar_one_or_none()

    if not sub:
        metadata = data.get("metadata", {})
        org_id = metadata.get("org_id")
        if not org_id:
            return

        import uuid
        items = data.get("items", {}).get("data", [])
        price = items[0].get("price", {}) if items else {}

        sub = Subscription(
            org_id=uuid.UUID(org_id),
            stripe_subscription_id=stripe_sub_id,
            stripe_customer_id=data.get("customer"),
            stripe_price_id=price.get("id"),
            stripe_product_id=price.get("product"),
            status=data.get("status", "active"),
            amount_cents=price.get("unit_amount", 0),
            currency=price.get("currency", "usd"),
            interval=price.get("recurring", {}).get("interval", "month"),
            interval_count=price.get("recurring", {}).get("interval_count", 1),
            compound_phase=metadata.get("compound_phase"),
        )
        db.add(sub)
    else:
        sub.status = data.get("status", sub.status)
        if data.get("cancel_at"):
            sub.cancel_at = datetime.fromtimestamp(
                data["cancel_at"], tz=timezone.utc
            )
        if data.get("canceled_at"):
            sub.canceled_at = datetime.fromtimestamp(
                data["canceled_at"], tz=timezone.utc
            )
        if data.get("current_period_start"):
            sub.current_period_start = datetime.fromtimestamp(
                data["current_period_start"], tz=timezone.utc
            )
        if data.get("current_period_end"):
            sub.current_period_end = datetime.fromtimestamp(
                data["current_period_end"], tz=timezone.utc
            )


async def _handle_subscription_deleted(data: dict, db: AsyncSession) -> None:
    """Mark subscription as canceled when Stripe deletes it."""
    stripe_sub_id = data.get("id")
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub_id
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = "canceled"
        sub.canceled_at = datetime.now(timezone.utc)


# ── Trial warning handler (STRIPE-3) ─────────────────────────

async def _handle_trial_will_end(data: dict, db: AsyncSession) -> None:
    """Handle customer.subscription.trial_will_end.

    Stripe fires this 3 days before a trialing subscription's card is
    charged. We queue a heads-up email to the customer so they have time
    to cancel or update the payment method.

    Email dispatch is queued via Cloudflare Queues
    (``queue_publisher.publish_email_notification``) so the webhook
    response path stays fast — a failure in the email pipeline must NOT
    cause Stripe to retry the webhook.
    """
    stripe_sub_id = data.get("id")
    customer_email = data.get("customer_email")
    trial_end_ts = data.get("trial_end")

    # Pull email + org from our local sub record if Stripe didn't include them
    org_id: uuid.UUID | None = None
    if stripe_sub_id:
        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            org_id = sub.org_id
            # Resolve via the customer id → Stripe API (kept async-safe;
            # we avoid that side-trip here and rely on the caller having
            # denormalized email. If not available, log and skip.)

    if not customer_email or org_id is None:
        logger.info(
            "trial_will_end for sub %s had no resolvable customer email/org",
            stripe_sub_id,
        )
        return

    # Format the date for humans rather than dropping ISO 8601 into the
    # body — `2026-05-15T00:00:00+00:00` in an inbox is the easiest way to
    # tell a customer that nobody read this email. When Stripe omits the
    # timestamp we drop the date sentence entirely instead of inlining a
    # "soon" fallback that breaks the surrounding grammar.
    if trial_end_ts:
        trial_end_human = datetime.fromtimestamp(
            trial_end_ts, tz=timezone.utc
        ).strftime("%A, %B %-d")
        date_line = (
            f"<p>Your Stevie Social trial wraps up on "
            f"<strong>{trial_end_human}</strong>. After that, the card on "
            f"file will be charged for your first billing cycle.</p>"
        )
        subject = f"Your Stevie trial wraps up {trial_end_human}"
    else:
        date_line = (
            "<p>Your Stevie Social trial is wrapping up. After that, the "
            "card on file will be charged for your first billing cycle.</p>"
        )
        subject = "Heads up — your Stevie trial is wrapping up"

    settings = get_settings()
    portal_link = f"{settings.frontend_url.rstrip('/')}/admin/billing"
    cta_block = (
        f'<p style="margin:28px 0;">'
        f'<a href="{portal_link}" '
        f'style="background:#089140;color:#ffffff;padding:14px 24px;'
        f"text-decoration:none;border-radius:6px;display:inline-block;"
        f'font-weight:600;font-size:15px;">'
        f"Manage billing</a></p>"
    )

    html = (
        "<p>Hi there,</p>"
        f"{date_line}"
        "<p>If you'd like to cancel or change your plan, you can do so "
        "from your billing portal before then.</p>"
        f"{cta_block}"
        "<p>Thanks for trying Stevie Social.</p>"
        "<p>— The Stevie Social Team</p>"
    )

    # Dispatch to email-sender Cloudflare Worker — fire-and-forget so
    # the webhook response stays fast. We swallow exceptions because a
    # failure here must NOT cause Stripe to retry the webhook.
    try:
        from app.services.queue_publisher import publish_email_notification
        await publish_email_notification(
            org_id=org_id,
            to=customer_email,
            subject=subject,
            html_body=html,
        )
    except Exception:
        logger.exception(
            "Failed to enqueue trial_will_end email for %s", customer_email
        )
