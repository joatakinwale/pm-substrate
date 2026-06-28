"""Proposal model — 12-block Compound Method strategy proposals with e-signature.

Each proposal contains ordered blocks matching the Compound Method structure:
1. Executive Summary
2. Brand Positioning
3. Audience Segments
4. Content Pillars
5. Platform Strategy
6. Phased Framework (Protect → Deepen → Amplify)
7. Guardrails
8. Email Strategy
9. KPIs & Success Metrics
10. Sample Content Calendar
11. Summary & Pricing
12. E-Signature
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class ProposalStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    viewed = "viewed"
    signed = "signed"
    declined = "declined"
    expired = "expired"


class Proposal(Base, OrgMixin, TimestampMixin):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Client references
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )

    # Proposal metadata
    title: Mapped[str] = mapped_column(String(500), default="Compound Method Strategy Proposal")
    status: Mapped[str] = mapped_column(
        String(30), default=ProposalStatus.draft.value, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Client info (denormalized for display + sharing)
    client_name: Mapped[str] = mapped_column(String(255))
    client_email: Mapped[str] = mapped_column(String(255))
    client_company: Mapped[str | None] = mapped_column(String(255))

    # Pricing (from Phase 2 billing module)
    compound_phase: Mapped[str | None] = mapped_column(String(30))
    total_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    billing_interval: Mapped[str] = mapped_column(String(10), default="month")

    # 12 Compound Method blocks stored as ordered JSONB array
    # Each block: { "type": "executive_summary", "title": "...", "content": "...", "order": 1 }
    blocks: Mapped[list] = mapped_column(JSONB, default=list)

    # E-signature tracking
    signature_provider: Mapped[str | None] = mapped_column(String(50))  # "hellosign" or "internal"
    signature_request_id: Mapped[str | None] = mapped_column(String(255))
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signer_name: Mapped[str | None] = mapped_column(String(255))
    signer_ip: Mapped[str | None] = mapped_column(String(50))

    # Sharing
    share_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True,
        server_default=text("encode(gen_random_bytes(32), 'hex')")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Tracking
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Auto-cascade references (filled after signing)
    generated_invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    generated_project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Notes
    internal_notes: Mapped[str | None] = mapped_column(Text)
    # Originating agent role for handoff-chain tracing.
    agent_role: Mapped[str | None] = mapped_column(String(50))

    # Relationships
    versions: Mapped[list["ProposalVersion"]] = relationship(
        back_populates="proposal", cascade="all, delete-orphan", lazy="selectin"
    )


class ProposalVersion(Base, TimestampMixin):
    """Tracks proposal change history."""
    __tablename__ = "proposal_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    blocks: Mapped[list] = mapped_column(JSONB, default=list)
    total_cents: Mapped[int] = mapped_column(Integer, default=0)
    change_summary: Mapped[str | None] = mapped_column(Text)
    # Originating agent role for handoff-chain tracing.
    agent_role: Mapped[str | None] = mapped_column(String(50))
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Relationship
    proposal: Mapped["Proposal"] = relationship(back_populates="versions")


# ── 12 Compound Method block types ──────────────────────────
COMPOUND_METHOD_BLOCKS = [
    {"type": "executive_summary", "title": "Executive Summary", "order": 1},
    {"type": "brand_positioning", "title": "Brand Positioning", "order": 2},
    {"type": "audience_segments", "title": "Audience Segments", "order": 3},
    {"type": "content_pillars", "title": "Content Pillars", "order": 4},
    {"type": "platform_strategy", "title": "Platform Strategy", "order": 5},
    {"type": "phased_framework", "title": "Phased Framework", "order": 6},
    {"type": "guardrails", "title": "Guardrails", "order": 7},
    {"type": "email_strategy", "title": "Email Strategy", "order": 8},
    {"type": "kpis", "title": "KPIs & Success Metrics", "order": 9},
    {"type": "sample_calendar", "title": "Sample Content Calendar", "order": 10},
    {"type": "summary_pricing", "title": "Summary & Pricing", "order": 11},
    {"type": "signature", "title": "E-Signature", "order": 12},
]


class OnboardingStatus(str, enum.Enum):
    pending = "pending"
    intake_sent = "intake_sent"
    intake_completed = "intake_completed"
    brand_voice_sent = "brand_voice_sent"
    brand_voice_completed = "brand_voice_completed"
    strategy_call_scheduled = "strategy_call_scheduled"
    completed = "completed"


class ClientOnboarding(Base, OrgMixin, TimestampMixin):
    """Tracks client onboarding progress after proposal signing."""
    __tablename__ = "client_onboardings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )

    client_name: Mapped[str] = mapped_column(String(255))
    client_email: Mapped[str] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(
        String(50), default=OnboardingStatus.pending.value, index=True
    )

    # Step completion tracking
    intake_form_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    intake_form_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    intake_form_data: Mapped[dict | None] = mapped_column(JSONB)

    brand_voice_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    brand_voice_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    brand_voice_data: Mapped[dict | None] = mapped_column(JSONB)

    strategy_call_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    strategy_call_booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="SET NULL")
    )

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    internal_notes: Mapped[str | None] = mapped_column(Text)
    # Originating agent role for handoff-chain tracing.
    agent_role: Mapped[str | None] = mapped_column(String(50))
