"""Invoice model — tracks Stripe invoices for client billing."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    paid = "paid"
    void = "void"
    uncollectible = "uncollectible"
    past_due = "past_due"


class Invoice(Base, OrgMixin, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Stripe references
    stripe_invoice_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255))
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255))
    stripe_hosted_invoice_url: Mapped[str | None] = mapped_column(Text)
    stripe_invoice_pdf: Mapped[str | None] = mapped_column(Text)

    # Internal references
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )

    # Invoice details
    status: Mapped[str] = mapped_column(
        String(30), default=InvoiceStatus.draft.value, index=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    subtotal_cents: Mapped[int] = mapped_column(Integer, default=0)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, default=0)
    amount_paid_cents: Mapped[int] = mapped_column(Integer, default=0)
    amount_due_cents: Mapped[int] = mapped_column(Integer, default=0)

    # Client info (denormalized for quick display)
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))

    # Dates
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Compound Method phase for revenue segmentation
    compound_phase: Mapped[str | None] = mapped_column(String(30))

    # Line items stored as JSONB for flexibility
    line_items: Mapped[dict] = mapped_column(JSONB, default=list)

    # Notes
    description: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    # Originating agent role for handoff-chain tracing.
    agent_role: Mapped[str | None] = mapped_column(String(50))

    # Reminder tracking
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
