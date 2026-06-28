"""IntegrationAccount — one row per (org, Aurinko account) pairing.

Holds the OAuth access token, scopes the user granted, the
Aurinko-side accountId, and the webhook subscription ids we created on
the user's behalf so disconnect can tear them down.

Per migration 018 only Aurinko ever shows up here; the ``provider``
column is forward-looking so future integrations (Nylas, Zoom, etc.)
can land in the same table without a second migration.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class IntegrationAccount(TimestampMixin, OrgMixin, Base):
    __tablename__ = "integration_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    # OrgMixin already declares org_id; no FK on it there, so wire one
    # explicitly via the migration. The mixin keeps the column shape
    # consistent across tenant-scoped tables.

    connected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="aurinko"
    )
    aurinko_account_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    aurinko_access_token: Mapped[str] = mapped_column(Text, nullable=False)
    service_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    scopes: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), server_default=text("'{}'"), nullable=False
    )
    is_default_for_booking: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    webhook_subscription_ids: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    last_calendar_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_contacts_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    disconnected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    @property
    def is_active(self) -> bool:
        return self.disconnected_at is None

    def __repr__(self) -> str:
        return (
            f"<IntegrationAccount provider={self.provider} "
            f"aurinko_account_id={self.aurinko_account_id} "
            f"org_id={self.org_id}>"
        )
