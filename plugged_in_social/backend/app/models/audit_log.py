"""Audit log model — immutable, append-only event log."""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """
    Append-only audit trail. Never updated or deleted.

    Records who did what, to which entity, and the before/after diff.
    Partitioned by month in production for query performance.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        comment="Null for system-generated events",
    )

    # What happened
    action: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="e.g. create, update, delete, login, export",
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="e.g. lead, booking, page, blog_post",
    )
    entity_id: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="UUID or other ID of the affected entity",
    )

    # Change details
    diff: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
        comment="Before/after snapshot of changed fields",
    )

    # Optional metadata
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.entity_type}:{self.entity_id}>"
