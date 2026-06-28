"""API cost tracking model — ported from coldCallAutomated.

Tracks per-org costs for external API calls: AI generation (Claude/GPT),
Twilio (VoIP/SMS), email delivery (SES/Mailgun), and any other
metered services. Enables usage-based billing and cost monitoring.

Ported from coldCallAutomated's cost_tracker service:
- Original: Per-user cost tracking for Gemini API + Twilio calls
- Adapted: Per-org cost tracking for all external APIs, with daily
  rollups and configurable spending limits per service.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class CostEntry(Base, OrgMixin, TimestampMixin):
    """Individual API cost event.

    Each external API call that incurs a cost creates one CostEntry.
    These are rolled up into DailyCostSummary for dashboard display.
    """
    __tablename__ = "cost_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Which service incurred the cost
    # Values: "ai_generation", "twilio_voice", "twilio_sms", "email_ses",
    #         "email_mailgun", "storage_r2", "cloudflare_stream", "other"
    service: Mapped[str] = mapped_column(String(50), index=True)

    # Specific operation within the service
    # e.g., "content_generation", "outbound_call", "campaign_send"
    operation: Mapped[str | None] = mapped_column(String(100))

    # Cost in cents (USD)
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)

    # Usage metrics (service-specific)
    # AI: {input_tokens, output_tokens, model}
    # Twilio: {duration_seconds, call_sid, direction}
    # Email: {recipient_count, campaign_id}
    usage_data: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Reference to the entity that triggered this cost
    reference_type: Mapped[str | None] = mapped_column(String(50))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Who triggered it
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # When the cost was incurred
    incurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )


class DailyCostSummary(Base, OrgMixin, TimestampMixin):
    """Daily rollup of costs per org per service.

    Aggregated from CostEntry records. Used for dashboard display,
    spending limit checks, and billing calculations.
    """
    __tablename__ = "daily_cost_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Date of the summary
    summary_date: Mapped[date] = mapped_column(Date, index=True)

    # Service breakdown
    service: Mapped[str] = mapped_column(String(50), index=True)

    # Totals
    total_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    entry_count: Mapped[int] = mapped_column(Integer, default=0)

    # Service-specific aggregates
    # AI: {total_input_tokens, total_output_tokens, request_count}
    # Twilio: {total_minutes, call_count, sms_count}
    aggregates: Mapped[dict] = mapped_column(JSONB, default=dict)


class SpendingLimit(Base, OrgMixin, TimestampMixin):
    """Per-org spending limits and alerts.

    Configurable per-service monthly spending caps.
    When a limit is reached, the system can either:
    - alert (send notification, continue allowing usage)
    - soft_block (require admin override to continue)
    - hard_block (reject API calls)
    """
    __tablename__ = "spending_limits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Which service this limit applies to ("all" for org-wide)
    service: Mapped[str] = mapped_column(String(50), default="all")

    # Monthly limit in cents
    monthly_limit_cents: Mapped[int] = mapped_column(Integer, default=0)

    # Alert threshold (percentage of limit, e.g., 80 = alert at 80%)
    alert_threshold_pct: Mapped[int] = mapped_column(Integer, default=80)

    # What happens when limit is reached
    enforcement: Mapped[str] = mapped_column(String(20), default="alert")

    # Current month's usage (updated by cost tracking)
    current_month_cents: Mapped[int] = mapped_column(Integer, default=0)
    current_month: Mapped[str | None] = mapped_column(String(7))  # "2026-04"

    # Whether alert has been sent for current period
    alert_sent: Mapped[bool] = mapped_column(default=False)
