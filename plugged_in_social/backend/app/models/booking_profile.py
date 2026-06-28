"""BookingProfile — per-org Aurinko booking profile.

A profile bundles an Aurinko booking page's configuration: duration,
working hours, location/teleconference settings, buffer time, and
whether it's a 1:1 ``account`` profile or a group profile (round-robin
or collective availability).

The ``aurinko_profile_id`` column stores Aurinko's integer profile id
returned by ``POST /v1/book/account/profiles`` (or
``/v1/book/group/profiles``). The local UUID id is what every other
table FK's against so the Aurinko id can rotate without breaking
references.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class BookingProfileKind(str, enum.Enum):
    ACCOUNT = "account"
    GROUP = "group"


class BookingProfile(TimestampMixin, OrgMixin, Base):
    __tablename__ = "booking_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    integration_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    aurinko_profile_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, unique=True
    )
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=BookingProfileKind.ACCOUNT.value
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("30")
    )
    # Aurinko's working_hours shape: list of
    #   {"dayOfWeek": int, "startMinute": int, "endMinute": int}
    working_hours: Mapped[list[dict]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False
    )
    # {"type": "zoom"|"meet"|"teams"|"phone"|"inperson", "value": "<addr or null>"}
    location: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    buffer_before_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    buffer_after_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    def __repr__(self) -> str:
        return (
            f"<BookingProfile {self.slug!r} kind={self.kind} "
            f"aurinko_profile_id={self.aurinko_profile_id}>"
        )
