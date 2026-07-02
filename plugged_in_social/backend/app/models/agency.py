"""Autonomous agency domain models.

These tables form the durable spine for PluggedInSocial's agent-run
marketing agency loop. They are PluggedInSocial-native and do not depend
on pm-substrate.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class ClientEngagementStatus(str, enum.Enum):
    intake = "intake"
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"


class MarketingRunStatus(str, enum.Enum):
    active = "active"
    blocked = "blocked"
    completed = "completed"
    cancelled = "cancelled"


class MarketingRunStage(str, enum.Enum):
    intake = "intake"
    research = "research"
    strategy = "strategy"
    planning = "planning"
    production = "production"
    approval = "approval"
    execution = "execution"
    monitoring = "monitoring"
    reporting = "reporting"
    next_action = "next_action"


class AgencyArtifactType(str, enum.Enum):
    research_brief = "research_brief"
    strategy_plan = "strategy_plan"
    content_brief = "content_brief"
    social_draft = "social_draft"
    email_draft = "email_draft"
    calendar_plan = "calendar_plan"
    approval_packet = "approval_packet"
    published_evidence = "published_evidence"
    metrics_snapshot = "metrics_snapshot"
    report = "report"
    implementation_brief = "implementation_brief"
    next_action_proposal = "next_action_proposal"


class AgencyApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    revoked = "revoked"


class AgencyAccessRequestStatus(str, enum.Enum):
    requested = "requested"
    granted = "granted"
    blocked = "blocked"
    revoked = "revoked"


class ClientEngagement(Base, OrgMixin, TimestampMixin):
    __tablename__ = "client_engagements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    client_url: Mapped[str | None] = mapped_column(Text)
    repo_url: Mapped[str | None] = mapped_column(Text)
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(30),
        default=ClientEngagementStatus.intake.value,
        server_default=ClientEngagementStatus.intake.value,
        index=True,
    )
    goals: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    constraints: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    intake_payload: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    integration_state: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    created_by_agent: Mapped[str | None] = mapped_column(String(50))

    marketing_runs: Mapped[list["MarketingRun"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_client_engagements_org_status", "org_id", "status"),
    )


class MarketingRun(Base, OrgMixin, TimestampMixin):
    __tablename__ = "marketing_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_engagements.id", ondelete="CASCADE"),
        index=True,
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default=MarketingRunStatus.active.value,
        server_default=MarketingRunStatus.active.value,
        index=True,
    )
    stage: Mapped[str] = mapped_column(
        String(30),
        default=MarketingRunStage.intake.value,
        server_default=MarketingRunStage.intake.value,
        index=True,
    )
    objective: Mapped[str] = mapped_column(Text)
    strategy_summary: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    current_blocker: Mapped[dict | None] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    engagement: Mapped[ClientEngagement] = relationship(back_populates="marketing_runs")
    artifacts: Mapped[list["AgencyArtifact"]] = relationship(
        back_populates="marketing_run", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_marketing_runs_org_stage", "org_id", "stage"),
        Index("ix_marketing_runs_engagement_status", "engagement_id", "status"),
    )


class AgencyArtifact(Base, OrgMixin, TimestampMixin):
    __tablename__ = "agency_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_engagements.id", ondelete="CASCADE"),
        index=True,
    )
    marketing_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketing_runs.id", ondelete="CASCADE"),
        index=True,
    )
    virtual_agency_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("virtual_agency_tasks.id", ondelete="SET NULL"),
        index=True,
    )
    artifact_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    payload_hash: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    evidence_refs: Mapped[list] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    lineage: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    author_role: Mapped[str] = mapped_column(String(50))

    marketing_run: Mapped[MarketingRun | None] = relationship(
        back_populates="artifacts"
    )

    __table_args__ = (
        Index("ix_agency_artifacts_run_type", "marketing_run_id", "artifact_type"),
        Index("ix_agency_artifacts_engagement_type", "engagement_id", "artifact_type"),
    )


class AgencyApprovalRequest(Base, OrgMixin, TimestampMixin):
    __tablename__ = "agency_approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_engagements.id", ondelete="CASCADE"),
        index=True,
    )
    marketing_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketing_runs.id", ondelete="CASCADE"),
        index=True,
    )
    approval_type: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(
        String(30),
        default=AgencyApprovalStatus.pending.value,
        server_default=AgencyApprovalStatus.pending.value,
        index=True,
    )
    subject_type: Mapped[str] = mapped_column(String(50), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    reason: Mapped[str] = mapped_column(Text)
    approval_version: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    approval_payload_hash: Mapped[str] = mapped_column(String(64), index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    decision_note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_agency_approvals_engagement_status", "engagement_id", "status"),
        Index("ix_agency_approvals_subject", "subject_type", "subject_id"),
    )


class AgencyAccessRequest(Base, OrgMixin, TimestampMixin):
    __tablename__ = "agency_access_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_engagements.id", ondelete="CASCADE"),
        index=True,
    )
    marketing_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketing_runs.id", ondelete="CASCADE"),
        index=True,
    )
    request_type: Mapped[str] = mapped_column(String(50), index=True)
    provider: Mapped[str | None] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(
        String(30),
        default=AgencyAccessRequestStatus.requested.value,
        server_default=AgencyAccessRequestStatus.requested.value,
        index=True,
    )
    scope: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    reason: Mapped[str] = mapped_column(Text)
    instructions: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    __table_args__ = (
        Index("ix_agency_access_engagement_status", "engagement_id", "status"),
        Index("ix_agency_access_provider_status", "provider", "status"),
    )
