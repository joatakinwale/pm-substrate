"""Phase 6 — Email Marketing models.

Covers email campaigns, templates, audiences (lists/segments),
form definitions, and automation workflows.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


# ═══ Enums ═══════════════════════════════════════════════════

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    sent = "sent"
    paused = "paused"
    cancelled = "cancelled"


class TemplateCategory(str, enum.Enum):
    marketing = "marketing"
    transactional = "transactional"
    onboarding = "onboarding"
    newsletter = "newsletter"
    nurture = "nurture"


class FormStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class AutomationStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    archived = "archived"


class AutomationTrigger(str, enum.Enum):
    form_submission = "form_submission"
    tag_added = "tag_added"
    contact_created = "contact_created"
    email_opened = "email_opened"
    email_clicked = "email_clicked"
    invoice_paid = "invoice_paid"
    proposal_signed = "proposal_signed"
    manual = "manual"


# ═══ Email Template ══════════════════════════════════════════

class EmailTemplate(Base, OrgMixin, TimestampMixin):
    """Reusable email template built with React Email / MJML."""

    __tablename__ = "email_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(
        String(50), default="marketing", server_default="marketing"
    )
    # React Email JSX source or MJML markup
    html_body: Mapped[str | None] = mapped_column(Text)
    # Compiled HTML for sending
    compiled_html: Mapped[str | None] = mapped_column(Text)
    # Design JSON for the visual editor
    design_json: Mapped[dict | None] = mapped_column(JSONB)
    # Template variables like {{first_name}}
    variables: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


# ═══ Email Campaign ══════════════════════════════════════════

class EmailCampaign(Base, OrgMixin, TimestampMixin):
    """Email campaign targeting a list/segment of contacts."""

    __tablename__ = "email_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500))
    preview_text: Mapped[str | None] = mapped_column(String(300))
    from_name: Mapped[str | None] = mapped_column(String(200))
    from_email: Mapped[str | None] = mapped_column(String(300))
    reply_to: Mapped[str | None] = mapped_column(String(300))

    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_templates.id", ondelete="SET NULL")
    )
    # Inline HTML override (if not using template)
    html_body: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(
        String(50), default="draft", server_default="draft"
    )

    # Targeting: list of tag filters + segment rules
    audience_filter: Mapped[dict | None] = mapped_column(JSONB)
    # e.g. {"tags": ["newsletter"], "min_engagement_score": 30}
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    compound_phase: Mapped[str | None] = mapped_column(String(50))

    # Scheduling
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # A/B test
    ab_test: Mapped[dict | None] = mapped_column(JSONB)
    # {"variant_b_subject": "...", "split_pct": 20, "winner_metric": "open_rate"}

    # Stats (updated by webhook processor)
    total_sent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_delivered: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_opened: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_clicked: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_bounced: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_unsubscribed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    internal_notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_email_campaigns_status", "org_id", "status"),
    )


# ═══ Email Send (per-recipient tracking) ═════════════════════

class EmailSend(Base, OrgMixin, TimestampMixin):
    """Individual email send record for tracking opens/clicks."""

    __tablename__ = "email_sends"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="queued", server_default="queued"
    )
    # queued → sent → delivered → opened / bounced / complained
    ses_message_id: Mapped[str | None] = mapped_column(String(500))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_email_sends_campaign", "campaign_id", "contact_id"),
        Index("ix_email_sends_ses", "ses_message_id"),
    )


# ═══ Form Builder ════════════════════════════════════════════

class FormDefinition(Base, OrgMixin, TimestampMixin):
    """SurveyJS-compatible form definition."""

    __tablename__ = "form_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(50), default="draft", server_default="draft"
    )
    # SurveyJS JSON schema
    schema_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    # Theme/styling overrides
    theme_json: Mapped[dict | None] = mapped_column(JSONB)
    # Notification settings
    notify_emails: Mapped[list | None] = mapped_column(JSONB)
    # Success message or redirect URL
    success_message: Mapped[str | None] = mapped_column(Text)
    redirect_url: Mapped[str | None] = mapped_column(String(2048))
    # Automation trigger on submit
    automation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("automations.id", ondelete="SET NULL")
    )
    submission_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    __table_args__ = (
        Index("ix_form_definitions_slug", "org_id", "slug", unique=True),
    )


class FormSubmission(Base, OrgMixin, TimestampMixin):
    """Individual form submission with response data."""

    __tablename__ = "form_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("form_definitions.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )
    # Raw response data from SurveyJS
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))

    __table_args__ = (
        Index("ix_form_submissions_form", "form_id"),
    )


# ═══ Automation Workflows ════════════════════════════════════

class Automation(Base, OrgMixin, TimestampMixin):
    """Visual workflow automation (n8n-style)."""

    __tablename__ = "automations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(50), default="draft", server_default="draft"
    )
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="manual", server_default="manual"
    )
    # Trigger config: form_id, tag name, etc.
    trigger_config: Mapped[dict | None] = mapped_column(JSONB)
    # Steps array: [{type: "send_email", config: {...}}, {type: "add_tag", config: {...}}]
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    # Stats
    total_runs: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    internal_notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_automations_status", "org_id", "status"),
    )


class AutomationRun(Base, OrgMixin, TimestampMixin):
    """Log of individual automation execution."""

    __tablename__ = "automation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    automation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("automations.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )
    trigger_event: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(
        String(50), default="running", server_default="running"
    )
    # running → completed / failed
    steps_completed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text)
    execution_log: Mapped[list | None] = mapped_column(JSONB)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_automation_runs_automation", "automation_id"),
    )
