"""Stripe event log — ensures webhook idempotency."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class StripeEvent(Base, TimestampMixin):
    __tablename__ = "stripe_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Stripe event ID — unique constraint ensures idempotency
    stripe_event_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    api_version: Mapped[str | None] = mapped_column(String(20))

    # Processing status
    status: Mapped[str] = mapped_column(
        String(20), default="processed"
    )  # processed, failed, skipped

    # Full payload for debugging
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)

    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
