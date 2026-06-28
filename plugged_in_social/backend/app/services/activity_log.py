"""Activity-log helpers — one place to fire Activity rows from business events.

Each event has its own helper so callers don't have to remember the right
enum values or metadata shape. The helpers are **best-effort**: any error
inside them is swallowed and logged, because a bad activity write must
never roll back the real business operation that triggered it
(a paid invoice, a moved task, etc.).

Usage from inside an existing DB transaction:

    from app.services.activity_log import log_invoice_paid
    await log_invoice_paid(db, invoice, org_id=invoice.org_id)

The caller's outer transaction commits this row along with everything
else. We intentionally do not commit here.
"""
from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity
from app.models.activity import ActivityCategory, ActivityType

if TYPE_CHECKING:
    from app.models import Invoice, Task

logger = logging.getLogger(__name__)


async def _safe_add(db: AsyncSession, activity: Activity) -> None:
    """Add to session, swallow + log any error so callers aren't affected."""
    try:
        db.add(activity)
        await db.flush()
    except Exception:
        logger.exception(
            "Failed to write Activity row (category=%s type=%s subject=%s/%s)",
            activity.category, activity.activity_type,
            activity.subject_type, activity.subject_id,
        )


async def log_invoice_paid(
    db: AsyncSession,
    invoice: "Invoice",
    *,
    org_id: uuid.UUID | None = None,
    source: str = "stripe_webhook",
) -> None:
    """Record an ``invoice_paid`` activity.

    Called from the Stripe webhook handler (``invoice.paid``) and any
    manual-mark path. Keyed on the Invoice primary key so dedup is
    handled by the caller (webhook idempotency already prevents double-
    firing the event itself).
    """
    org_id = org_id or invoice.org_id
    amount_paid = invoice.amount_paid_cents or invoice.total_cents or 0

    activity = Activity(
        org_id=org_id,
        category=ActivityCategory.business_process.value,
        activity_type=ActivityType.invoice_paid.value,
        subject_type="invoice",
        subject_id=invoice.id,
        title=f"Invoice paid: {invoice.description or invoice.invoice_number or invoice.id}",
        description=(
            f"{invoice.client_name or 'Client'} paid "
            f"${amount_paid / 100:,.2f} {(invoice.currency or 'usd').upper()}."
        ),
        is_system=True,
        is_client_visible=False,
        metadata_={
            "invoice_id": str(invoice.id),
            "client_name": invoice.client_name,
            "client_email": invoice.client_email,
            "amount_paid_cents": amount_paid,
            "total_cents": invoice.total_cents,
            "currency": invoice.currency,
            "compound_phase": invoice.compound_phase,
            "stripe_invoice_id": getattr(invoice, "stripe_invoice_id", None),
            "source": source,
        },
    )
    await _safe_add(db, activity)

    # SSE nudge for the revenue pulse widget — not load-bearing; swallow
    # all errors so a broken Redis can't ever rollback a paid-invoice
    # activity write (which is the whole point of this helper).
    try:
        from app.services.realtime import broadcast_event
        await broadcast_event(
            org_id=org_id,
            event_type="invoice.paid",
            entity_type="invoice",
            entity_id=invoice.id,
            payload={
                "invoice_id": str(invoice.id),
                "amount_paid_cents": amount_paid,
                "currency": invoice.currency,
                "client_name": invoice.client_name,
                "compound_phase": invoice.compound_phase,
            },
        )
    except Exception:
        logger.warning("invoice.paid realtime broadcast failed for %s", invoice.id)


async def log_task_moved(
    db: AsyncSession,
    task: "Task",
    *,
    from_step: int,
    to_step: int,
    moved_by: str | None = None,
    org_id: uuid.UUID | None = None,
) -> None:
    """Record a ``task_moved`` activity when a task changes workflow step.

    We only log step changes, not position-only reorders within the same
    column — those would flood the timeline. If ``from_step == to_step``
    this is a no-op.
    """
    if from_step == to_step:
        return

    org_id = org_id or getattr(task, "org_id", None)
    if org_id is None:
        logger.warning("log_task_moved: task %s has no org_id, skipping", task.id)
        return

    activity = Activity(
        org_id=org_id,
        category=ActivityCategory.project.value,
        activity_type=ActivityType.task_moved.value,
        subject_type="task",
        subject_id=task.id,
        title=f"Task moved: {task.title}",
        description=f"Workflow step {from_step} → {to_step}",
        is_system=True,
        is_client_visible=(to_step == 9),  # Step 9 = client approval
        metadata_={
            "task_id": str(task.id),
            "project_id": str(task.project_id),
            "from_step": from_step,
            "to_step": to_step,
            "moved_by": moved_by,
            "title": task.title,
        },
    )
    await _safe_add(db, activity)
