"""Activity tracking model — ported from coldCallAutomated.

Provides a unified activity timeline for all interactions across the
platform: calls, emails, SMS, meetings, status changes, notes, documents,
system events, and more. Each activity has a polymorphic metadata JSONB
column that stores type-specific data.

Ported from coldCallAutomated's MongoDB Activity Document model:
- Original: Beanie Document with 60+ fields, 12 compound indexes
- Adapted: PostgreSQL table with JSONB metadata, RLS-scoped by org_id
- Insurance-specific fields stripped; generalized for agency workflows

The activity model is the backbone of:
  - Client timeline views (what happened with this client?)
  - Internal audit trail (who did what, when?)
  - Analytics aggregation (call counts, email stats, engagement scoring)
  - coldCallAutomated sales module integration
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class ActivityCategory(str, enum.Enum):
    """Top-level activity categories."""
    communication = "communication"
    lead_management = "lead_management"
    engagement = "engagement"
    business_process = "business_process"
    document = "document"
    system = "system"
    note = "note"
    project = "project"


class ActivityType(str, enum.Enum):
    """Specific activity types within each category.

    Ported from coldCallAutomated's 40+ ActivityTypes.
    Insurance-specific types removed; agency types added.
    """
    # Communication
    call_outbound = "call_outbound"
    call_inbound = "call_inbound"
    call_missed = "call_missed"
    voicemail_left = "voicemail_left"
    voicemail_received = "voicemail_received"
    email_sent = "email_sent"
    email_received = "email_received"
    email_opened = "email_opened"
    email_clicked = "email_clicked"
    email_bounced = "email_bounced"
    sms_sent = "sms_sent"
    sms_received = "sms_received"

    # Lead management
    lead_created = "lead_created"
    lead_updated = "lead_updated"
    lead_qualified = "lead_qualified"
    lead_disqualified = "lead_disqualified"
    lead_converted = "lead_converted"
    lead_status_changed = "lead_status_changed"
    lead_assigned = "lead_assigned"
    lead_score_updated = "lead_score_updated"

    # Engagement
    meeting_scheduled = "meeting_scheduled"
    meeting_completed = "meeting_completed"
    meeting_cancelled = "meeting_cancelled"
    meeting_no_show = "meeting_no_show"
    follow_up_scheduled = "follow_up_scheduled"
    follow_up_completed = "follow_up_completed"

    # Business process
    proposal_created = "proposal_created"
    proposal_sent = "proposal_sent"
    proposal_viewed = "proposal_viewed"
    proposal_signed = "proposal_signed"
    proposal_declined = "proposal_declined"
    invoice_created = "invoice_created"
    invoice_sent = "invoice_sent"
    invoice_paid = "invoice_paid"
    invoice_overdue = "invoice_overdue"
    onboarding_started = "onboarding_started"
    onboarding_completed = "onboarding_completed"

    # Documents
    document_uploaded = "document_uploaded"
    document_shared = "document_shared"
    document_signed = "document_signed"

    # Project / content
    task_created = "task_created"
    task_completed = "task_completed"
    task_moved = "task_moved"
    content_approved = "content_approved"
    content_revision_requested = "content_revision_requested"
    content_published = "content_published"

    # System
    system_note = "system_note"
    import_completed = "import_completed"
    export_completed = "export_completed"
    automation_triggered = "automation_triggered"
    webhook_received = "webhook_received"

    # Notes
    note_added = "note_added"
    note_updated = "note_updated"


class Activity(Base, OrgMixin, TimestampMixin):
    """Unified activity record.

    Links to a subject entity (lead, contact, project, etc.) via
    subject_type + subject_id. The metadata JSONB column stores
    type-specific data (call duration, email subject, meeting location, etc.)

    Indexes mirror coldCallAutomated's compound indexes adapted for PostgreSQL:
    - (org_id, subject_type, subject_id, created_at DESC) — timeline queries
    - (org_id, activity_type, created_at DESC) — type filtering
    - (org_id, performed_by, created_at DESC) — user activity
    """
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # What type of activity
    category: Mapped[str] = mapped_column(String(50), index=True)
    activity_type: Mapped[str] = mapped_column(String(80), index=True)

    # Subject entity — polymorphic reference
    # subject_type: "lead", "contact", "project", "task", "invoice", "proposal"
    subject_type: Mapped[str] = mapped_column(String(50), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # Optional secondary subject (e.g., task within a project)
    related_type: Mapped[str | None] = mapped_column(String(50))
    related_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Who performed the action
    performed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    performed_by_name: Mapped[str | None] = mapped_column(String(255))
    # Originating agent role for handoff-chain tracing.
    agent_role: Mapped[str | None] = mapped_column(String(50))

    # Human-readable summary
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)

    # Type-specific metadata (replaces coldCallAutomated's typed metadata models)
    # Examples:
    #   call: {duration_seconds, recording_url, disposition, phone_number}
    #   email: {subject, recipient, message_id, opened_at, clicked_at}
    #   meeting: {location, attendees, outcome, reschedule_count}
    #   status_change: {old_status, new_status, reason}
    #   score_update: {old_score, new_score, breakdown}
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Visibility flags
    is_system: Mapped[bool] = mapped_column(default=False)
    is_client_visible: Mapped[bool] = mapped_column(default=False)

    # Timestamp of the actual activity (may differ from created_at for imports)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
