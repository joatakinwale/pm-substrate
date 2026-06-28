"""Subscription model — tracks Stripe recurring billing for clients."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    incomplete = "incomplete"
    trialing = "trialing"
    paused = "paused"


class Subscription(Base, OrgMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Stripe references
    stripe_subscription_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True
    )
    stripe_customer_id: Mapped[str] = mapped_column(String(255), index=True)
    stripe_price_id: Mapped[str | None] = mapped_column(String(255))
    stripe_product_id: Mapped[str | None] = mapped_column(String(255))

    # Internal references
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )

    # Subscription details
    status: Mapped[str] = mapped_column(
        String(30), default=SubscriptionStatus.active.value, index=True
    )
    plan_name: Mapped[str | None] = mapped_column(String(255))
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    interval: Mapped[str] = mapped_column(String(10), default="month")  # month, year
    interval_count: Mapped[int] = mapped_column(Integer, default=1)

    # Client info (denormalized)
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))

    # Compound Method phase for revenue segmentation
    compound_phase: Mapped[str | None] = mapped_column(String(30))

    # Dates
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    internal_notes: Mapped[str | None] = mapped_column(Text)
