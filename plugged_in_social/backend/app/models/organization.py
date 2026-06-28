"""Organization model — multi-tenant root entity."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PlanTier(str, enum.Enum):
    """Subscription plan tiers."""
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Organization(TimestampMixin, Base):
    """
    Top-level tenant. Every other table references org_id back to this.

    The compound_method_defaults JSONB stores Stevie's proprietary
    Compound Method configuration (Protect → Deepen → Amplify phases).
    """

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True,
    )
    plan: Mapped[str] = mapped_column(
        String(20), default=PlanTier.STARTER.value, nullable=False,
    )
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Flexible settings bucket — branding colors, feature flags, etc.
    settings: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    # Stevie's Compound Method defaults for this org
    compound_method_defaults: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    users = relationship("User", back_populates="organization", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Organization {self.slug}>"
