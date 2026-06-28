"""User model — team members and clients within an organization."""
import enum
import uuid

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class UserRole(str, enum.Enum):
    """User roles within an organization."""
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    CLIENT = "client"


class User(TimestampMixin, OrgMixin, Base):
    """
    Users belong to an organization. auth_id links to external auth if needed.

    Roles:
      - owner: Full access, billing, can delete org
      - admin: Manage team, content, settings
      - editor: Create/edit content, view analytics
      - viewer: Read-only dashboard access
      - client: External client portal access (future phases)
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    auth_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True,
        comment="External auth provider user ID (e.g. Supabase auth.users.id). NEVER a password hash.",
    )
    # bcrypt hash for custom-JWT (dev/fallback) auth. Null when the user
    # authenticates exclusively via Supabase (auth_id is set instead).
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="bcrypt hash for custom-JWT auth. Null for Supabase-only users.",
    )
    email: Mapped[str] = mapped_column(
        String(320), nullable=False, index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    role: Mapped[str] = mapped_column(
        String(20), default=UserRole.VIEWER.value, nullable=False,
    )

    # Granular permissions beyond role — feature flags, overrides
    permissions: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Optimistic locking
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    # Override org_id from OrgMixin to add ForeignKey
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    organization = relationship("Organization", back_populates="users")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
