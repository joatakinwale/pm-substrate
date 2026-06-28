"""Contact model — email subscribers (Flodesk migration target)."""
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class Contact(TimestampMixin, OrgMixin, Base):
    """
    Email subscribers. UNIQUE(org_id, email) enables upsert
    for Flodesk migration and ongoing signups.

    Tags use TEXT[] with GIN index for fast containment queries
    like: WHERE tags @> ARRAY['newsletter', 'lead-magnet']
    """

    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Tagging system
    tags: Mapped[list | None] = mapped_column(
        ARRAY(String(100)), server_default=text("'{}'"), nullable=False,
    )

    # Engagement tracking
    engagement_score: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Computed from opens, clicks, replies",
    )
    last_engaged_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Subscription state
    subscribed: Mapped[bool] = mapped_column(default=True, nullable=False)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Source info
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="e.g. website_signup, lead_magnet, flodesk_import",
    )

    # Extra metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("org_id", "email", name="uq_contacts_org_email"),
    )

    def __repr__(self) -> str:
        return f"<Contact {self.email} (subscribed={self.subscribed})>"
