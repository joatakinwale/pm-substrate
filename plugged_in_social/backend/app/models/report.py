"""Report models — branded client reports and analytics materialized views.

Phase-specific KPIs per the Compound Method:
- Protect: saves, shares, alignment signals, misaligned inquiry rate
- Deepen: inbound conversation quality, brand recognition, content library depth
- Amplify: cost per qualified lead, paid vs organic comparison
"""
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class ReportStatus(str, enum.Enum):
    draft = "draft"
    generated = "generated"
    sent = "sent"


class ReportCadence(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"


class ClientReport(Base, OrgMixin, TimestampMixin):
    """Generated client-facing report with branded styling."""
    __tablename__ = "client_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # References
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL")
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )

    # Report metadata
    title: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(30), default=ReportStatus.draft.value, index=True
    )
    cadence: Mapped[str] = mapped_column(
        String(20), default=ReportCadence.monthly.value
    )
    compound_phase: Mapped[str | None] = mapped_column(String(30))
    created_by_agent: Mapped[str | None] = mapped_column(String(50))

    # Client info
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))

    # Date range
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)

    # Report content — JSONB structure with sections and metrics
    sections: Mapped[list] = mapped_column(JSONB, default=list)
    # Each section: { "type": "kpi_grid|chart|text|comparison",
    #                 "title": "...", "data": {...} }

    # Summary metrics snapshot
    metrics_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)

    # PDF export
    pdf_url: Mapped[str | None] = mapped_column(Text)
    pdf_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Sharing
    share_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True,
        server_default=text("encode(gen_random_bytes(32), 'hex')")
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    internal_notes: Mapped[str | None] = mapped_column(Text)


class ReportSchedule(Base, OrgMixin, TimestampMixin):
    """Auto-schedule report generation and delivery."""
    __tablename__ = "report_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )
    client_name: Mapped[str] = mapped_column(String(255))
    client_email: Mapped[str] = mapped_column(String(255))
    cadence: Mapped[str] = mapped_column(String(20), default="monthly")
    compound_phase: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Phase KPI definitions ────────────────────────────────────
PHASE_KPIS = {
    "protect": {
        "title": "Protect Phase KPIs",
        "description": "Building brand foundation and organic alignment",
        "metrics": [
            {"key": "saves", "label": "Saves", "unit": "count"},
            {"key": "shares", "label": "Shares", "unit": "count"},
            {"key": "alignment_signals", "label": "Alignment Signals", "unit": "count"},
            {"key": "misaligned_inquiry_rate", "label": "Misaligned Inquiry Rate", "unit": "percent"},
            {"key": "content_pieces_published", "label": "Content Published", "unit": "count"},
            {"key": "avg_engagement_rate", "label": "Avg Engagement Rate", "unit": "percent"},
        ],
    },
    "deepen": {
        "title": "Deepen Phase KPIs",
        "description": "Deepening relationships beyond algorithm reach",
        "metrics": [
            {"key": "inbound_conversations", "label": "Inbound Conversations", "unit": "count"},
            {"key": "conversation_quality_score", "label": "Conversation Quality", "unit": "score"},
            {"key": "brand_recognition_mentions", "label": "Brand Mentions", "unit": "count"},
            {"key": "content_library_depth", "label": "Content Library Depth", "unit": "count"},
            {"key": "email_open_rate", "label": "Email Open Rate", "unit": "percent"},
            {"key": "email_click_rate", "label": "Email Click Rate", "unit": "percent"},
        ],
    },
    "amplify": {
        "title": "Amplify Phase KPIs",
        "description": "Amplifying proven organic content with paid strategy",
        "metrics": [
            {"key": "cost_per_qualified_lead", "label": "Cost per Qualified Lead", "unit": "currency"},
            {"key": "paid_vs_organic_ratio", "label": "Paid vs Organic", "unit": "ratio"},
            {"key": "roas", "label": "Return on Ad Spend", "unit": "multiplier"},
            {"key": "qualified_leads_generated", "label": "Qualified Leads", "unit": "count"},
            {"key": "organic_amplified_posts", "label": "Amplified Posts", "unit": "count"},
            {"key": "total_ad_spend_cents", "label": "Total Ad Spend", "unit": "currency"},
        ],
    },
}
