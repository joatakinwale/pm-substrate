"""Booking model — provider-neutral scheduled-call record.

Today every new booking flows through Aurinko (``provider='aurinko'``).
Pre-cutover rows from Cal.com keep their data intact under
``provider='calcom'`` and are surfaced read-only in the admin
dashboard — the reschedule and cancel CTAs branch on ``provider`` and
hide for legacy rows since the Cal.com client is gone.

The downstream pipeline (reminder cron, attendee email templates,
realtime broadcast) is provider-agnostic and reads the renamed
``external_event_id`` / ``external_payload`` columns.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class BookingStatus(str, enum.Enum):
    """Booking lifecycle states."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"


class BookingProvider(str, enum.Enum):
    """Which scheduling provider produced this booking."""

    AURINKO = "aurinko"
    CALCOM = "calcom"


class Booking(TimestampMixin, OrgMixin, Base):
    """Stores a scheduled call sourced from a webhook (Aurinko or Cal.com legacy)."""

    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Link to lead (nullable — booking might come before lead form)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id"),
        nullable=True,
        index=True,
    )

    # ── Provider identifiers ──────────────────────────────────
    # ``provider`` is what the dashboard branches on. Default is
    # 'aurinko' for new rows; the migration backfilled existing rows
    # with 'calcom' before the column became NOT NULL.
    provider: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default=BookingProvider.AURINKO.value,
    )
    external_event_id: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True,
        comment="Aurinko event id (or Cal.com event UID for legacy rows) — dedup key",
    )
    external_booking_uid: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    # Aurinko-specific links. Both nullable for backwards compatibility
    # with legacy Cal.com rows.
    aurinko_profile_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
    )
    integration_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    reschedule_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Aurinko {{rescheduleToken}} — lets the attendee reschedule unauthenticated",
    )

    # ── Schedule details ──────────────────────────────────────
    event_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="e.g. discovery_call, strategy_session",
    )
    scheduled_at: Mapped[datetime] = mapped_column(nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=30, nullable=False,
    )
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Attendee info (denormalized from the provider payload)
    attendee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attendee_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default=BookingStatus.PENDING.value, nullable=False,
    )

    # Meeting link
    meeting_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Full webhook payload for debugging — provider-agnostic name.
    external_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Reminder dedupe — flipped to now() just before the booking-reminder
    # cron fires its email so re-runs inside the 24h window do not re-mail
    # the same attendee. See migration 013.
    reminder_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="bookings")

    @property
    def is_aurinko(self) -> bool:
        return self.provider == BookingProvider.AURINKO.value

    def __repr__(self) -> str:
        return f"<Booking {self.provider}:{self.external_event_id} ({self.status})>"
