"""CalendarEvent — read-cache for two-way calendar sync.

Populated from Aurinko's ``/calendars/primary/events`` webhook
notifications. Used by the slot picker to mask availability the user
has already taken on their real calendar (outside of Aurinko-driven
bookings) and by the admin dashboard's "external events" indicator.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class CalendarEvent(TimestampMixin, OrgMixin, Base):
    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    integration_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    aurinko_event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    calendar_id: Mapped[str] = mapped_column(
        String(255), nullable=False, server_default="primary"
    )
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attendees: Mapped[list[dict]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False
    )
    raw_payload: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<CalendarEvent {self.title!r} start={self.start_at} "
            f"aurinko_event_id={self.aurinko_event_id!r}>"
        )
