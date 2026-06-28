"""ContactSync — read-side cache of contacts pulled from Aurinko.

One row per (integration_account, aurinko_contact_id). Webhook fan-out
keeps it fresh; an initial bulk sync runs from the OAuth callback.
``lead_id`` is a soft link populated when the contact's email matches
an existing Lead, letting the dashboard show "we already know this
person" without polluting the leads table itself.

This is intentionally distinct from the existing ``contacts`` table
(``app.models.contact``) which is the manually-curated marketing list.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class ContactSync(TimestampMixin, OrgMixin, Base):
    __tablename__ = "contact_syncs"

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
    aurinko_contact_id: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Denormalized search-helpers; the canonical record is in ``data``.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    updated_at_provider: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return (
            f"<ContactSync aurinko_contact_id={self.aurinko_contact_id!r} "
            f"email={self.email!r}>"
        )
