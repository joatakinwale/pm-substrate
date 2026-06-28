"""Client Portal models — token-based auth for client access.

Clients don't use Supabase Auth. Instead, they receive a magic-link
token via email that grants scoped access to their project deliverables,
invoices, and proposals. Each token is tied to a specific org + client email
and has an expiration window.

Security model:
  - PortalToken is a one-time-use or session-based token
  - PortalSession stores the active session with expiry
  - All portal queries are scoped by org_id + client_email (not user_id)
  - Clients can only see Step 9 tasks, their own invoices, and their proposals
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class PortalToken(Base, OrgMixin, TimestampMixin):
    """Magic-link token sent to clients for portal access.

    Flow:
    1. Agency clicks "Send portal invite" on a project
    2. System generates a PortalToken with a unique token string
    3. Client receives email with link: /portal/auth?token=xxx
    4. Client clicks link → token is validated → PortalSession created
    5. Token is marked as used (one-time use)
    """
    __tablename__ = "portal_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # The actual token string (sent in magic link URL)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Who this token is for
    client_email: Mapped[str] = mapped_column(String(255), index=True)
    client_name: Mapped[str | None] = mapped_column(String(255))

    # Optional project scope — if set, token only grants access to this project
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )

    # Token lifecycle
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)

    # Who created it (agency team member)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class PortalSession(Base, OrgMixin, TimestampMixin):
    """Active client portal session.

    Created when a client successfully validates a magic-link token.
    The session_token is stored in an httpOnly cookie on the client side.
    Sessions expire after 7 days or on explicit logout.
    """
    __tablename__ = "portal_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Session token (stored in cookie)
    session_token: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Client identity
    client_email: Mapped[str] = mapped_column(String(255), index=True)
    client_name: Mapped[str | None] = mapped_column(String(255))

    # Scope
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )

    # Lifecycle
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Reference to the token that created this session
    token_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portal_tokens.id", ondelete="SET NULL")
    )
