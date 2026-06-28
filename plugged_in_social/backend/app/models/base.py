"""SQLAlchemy base class and shared mixins for Stevie Social."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """Timezone-aware UTC now.

    Replaces deprecated ``datetime.utcnow()`` (removed in Python 3.13) with a
    naive-free equivalent. Used anywhere a Python-side default/onupdate is
    needed; ``server_default=text('now()')`` remains the primary default.
    """
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class TimestampMixin:
    """Adds created_at and updated_at to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        onupdate=utcnow,
        nullable=False,
    )


class OrgMixin:
    """Adds org_id foreign key — every tenant-scoped table uses this."""

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
