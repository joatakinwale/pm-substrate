# PluggedInSocial Autonomous Agency Domain Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first PluggedInSocial-native autonomous agency domain spine: client engagements, marketing runs, agency artifacts, approval requests, access requests, and the backend contracts needed to create and inspect them.

**Architecture:** This is Slice 1 from the approved design. It adds durable domain objects and thin service/API boundaries without changing the existing social publishing, report generation, or virtual-agency execution behavior. The new objects are tenant-scoped, hashable, versioned where approvals require it, and designed to link into `VirtualAgencyTask` lineage without making pm-substrate a dependency.

**Tech Stack:** FastAPI, SQLAlchemy 2 models, PostgreSQL JSONB via Alembic, Pydantic v2 schemas, existing pytest fake-session tests, existing RLS-scoped auth dependencies.

---

## Scope Boundary

This plan implements only the domain spine required by the approved autonomous-agency spec.

Included:

- `ClientEngagement`
- `MarketingRun`
- `AgencyArtifact`
- `AgencyApprovalRequest`
- `AgencyAccessRequest`
- service helpers for intake/run/artifact/approval/access creation
- `/api/agency/*` backend endpoints for the new spine
- optional lineage helper updates so future virtual-agency tasks can reference engagement/run/artifact IDs

Not included in this plan:

- frontend command center
- research/strategy generation prompts
- expanded Worker message contracts
- social/email publishing behavior changes
- `/api/integration/v1/*`
- pm-substrate adapter
- Canary-based browser recording
- Pi runtime integration

Those are separate plans after this spine exists.

## File Structure

Create:

- `plugged_in_social/backend/app/models/agency.py`
  - SQLAlchemy models and enums for the autonomous-agency spine.
- `plugged_in_social/backend/alembic/versions/024_autonomous_agency_domain_spine.py`
  - Hand-written migration for the new tables and indexes.
- `plugged_in_social/backend/app/schemas/agency.py`
  - Pydantic request/response schemas.
- `plugged_in_social/backend/app/services/agency_domain.py`
  - Deterministic service functions for domain creation and hashing.
- `plugged_in_social/backend/app/api/agency.py`
  - RLS-scoped API endpoints for admin/UI use.
- `plugged_in_social/backend/tests/test_agency_domain_models.py`
  - Model and migration-contract tests.
- `plugged_in_social/backend/tests/test_agency_domain_service.py`
  - Service tests using a focused fake session.
- `plugged_in_social/backend/tests/test_agency_api_contract.py`
  - Router/import/source contract tests.

Modify:

- `plugged_in_social/backend/app/models/__init__.py`
  - Export new models/enums for Alembic metadata discovery.
- `plugged_in_social/backend/app/main.py`
  - Register `/api/agency` router.
- `plugged_in_social/backend/app/services/virtual_agency_orchestration.py`
  - Extend lineage helper to accept optional agency IDs while preserving old callers.

## Task 1: Add Agency Domain Models and Migration

**Files:**

- Create: `plugged_in_social/backend/app/models/agency.py`
- Create: `plugged_in_social/backend/alembic/versions/024_autonomous_agency_domain_spine.py`
- Modify: `plugged_in_social/backend/app/models/__init__.py`
- Test: `plugged_in_social/backend/tests/test_agency_domain_models.py`

- [ ] **Step 1: Write the failing model contract tests**

Create `plugged_in_social/backend/tests/test_agency_domain_models.py`:

```python
from __future__ import annotations

from sqlalchemy import inspect


def test_agency_models_export_expected_table_names():
    from app.models import (
        AgencyAccessRequest,
        AgencyApprovalRequest,
        AgencyArtifact,
        ClientEngagement,
        MarketingRun,
    )

    assert ClientEngagement.__tablename__ == "client_engagements"
    assert MarketingRun.__tablename__ == "marketing_runs"
    assert AgencyArtifact.__tablename__ == "agency_artifacts"
    assert AgencyApprovalRequest.__tablename__ == "agency_approval_requests"
    assert AgencyAccessRequest.__tablename__ == "agency_access_requests"


def test_client_engagement_columns_support_intake_and_integrations():
    from app.models.agency import ClientEngagement

    columns = {column.name for column in inspect(ClientEngagement).columns}

    assert {
        "id",
        "org_id",
        "lead_id",
        "project_id",
        "name",
        "client_url",
        "repo_url",
        "client_name",
        "client_email",
        "status",
        "goals",
        "constraints",
        "intake_payload",
        "integration_state",
        "created_by_agent",
        "created_at",
        "updated_at",
    }.issubset(columns)


def test_marketing_run_columns_track_lifecycle_and_blockers():
    from app.models.agency import MarketingRun

    columns = {column.name for column in inspect(MarketingRun).columns}

    assert {
        "id",
        "org_id",
        "engagement_id",
        "project_id",
        "status",
        "stage",
        "objective",
        "strategy_summary",
        "current_blocker",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
    }.issubset(columns)


def test_artifact_approval_and_access_tables_are_hashable_and_traceable():
    from app.models.agency import (
        AgencyAccessRequest,
        AgencyApprovalRequest,
        AgencyArtifact,
    )

    artifact_columns = {column.name for column in inspect(AgencyArtifact).columns}
    approval_columns = {column.name for column in inspect(AgencyApprovalRequest).columns}
    access_columns = {column.name for column in inspect(AgencyAccessRequest).columns}

    assert {
        "artifact_type",
        "title",
        "body",
        "payload",
        "payload_hash",
        "version",
        "evidence_refs",
        "lineage",
        "author_role",
    }.issubset(artifact_columns)

    assert {
        "approval_type",
        "status",
        "subject_type",
        "subject_id",
        "approval_version",
        "approval_payload_hash",
        "decided_at",
        "decided_by_user_id",
    }.issubset(approval_columns)

    assert {
        "request_type",
        "provider",
        "status",
        "scope",
        "reason",
        "instructions",
        "resolved_at",
    }.issubset(access_columns)
```

- [ ] **Step 2: Run the model tests to verify they fail**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_models.py
```

Expected: FAIL with an import error for `app.models.agency` or missing exported model names.

- [ ] **Step 3: Create the SQLAlchemy models**

Create `plugged_in_social/backend/app/models/agency.py`:

```python
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
    intake_payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    integration_state: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
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
    strategy_summary: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
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
        UUID(as_uuid=True), ForeignKey("marketing_runs.id", ondelete="CASCADE"), index=True
    )
    virtual_agency_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("virtual_agency_tasks.id", ondelete="SET NULL"), index=True
    )
    artifact_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    payload_hash: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    evidence_refs: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    lineage: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    author_role: Mapped[str] = mapped_column(String(50))

    marketing_run: Mapped[MarketingRun | None] = relationship(back_populates="artifacts")

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
        UUID(as_uuid=True), ForeignKey("client_engagements.id", ondelete="CASCADE"), index=True
    )
    marketing_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marketing_runs.id", ondelete="CASCADE"), index=True
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
    approval_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
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
        UUID(as_uuid=True), ForeignKey("client_engagements.id", ondelete="CASCADE"), index=True
    )
    marketing_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marketing_runs.id", ondelete="CASCADE"), index=True
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
    instructions: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    __table_args__ = (
        Index("ix_agency_access_engagement_status", "engagement_id", "status"),
        Index("ix_agency_access_provider_status", "provider", "status"),
    )
```

- [ ] **Step 4: Export the new models**

Modify `plugged_in_social/backend/app/models/__init__.py`.

Add after the virtual-agency imports:

```python
from app.models.agency import (
    AgencyAccessRequest,
    AgencyAccessRequestStatus,
    AgencyApprovalRequest,
    AgencyApprovalStatus,
    AgencyArtifact,
    AgencyArtifactType,
    ClientEngagement,
    ClientEngagementStatus,
    MarketingRun,
    MarketingRunStage,
    MarketingRunStatus,
)
```

Add to `__all__` near the existing virtual-agency exports:

```python
    "AgencyAccessRequest",
    "AgencyAccessRequestStatus",
    "AgencyApprovalRequest",
    "AgencyApprovalStatus",
    "AgencyArtifact",
    "AgencyArtifactType",
    "ClientEngagement",
    "ClientEngagementStatus",
    "MarketingRun",
    "MarketingRunStage",
    "MarketingRunStatus",
```

- [ ] **Step 5: Create the Alembic migration**

Create `plugged_in_social/backend/alembic/versions/024_autonomous_agency_domain_spine.py`:

```python
"""024 — Autonomous agency domain spine.

Revision ID: 024
Revises: 023
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_engagements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("client_url", sa.Text(), nullable=True),
        sa.Column("repo_url", sa.Text(), nullable=True),
        sa.Column("client_name", sa.String(length=255), nullable=True),
        sa.Column("client_email", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="intake"),
        sa.Column("goals", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("constraints", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("intake_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("integration_state", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by_agent", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_client_engagements_org_id", "client_engagements", ["org_id"], unique=False)
    op.create_index("ix_client_engagements_lead_id", "client_engagements", ["lead_id"], unique=False)
    op.create_index("ix_client_engagements_project_id", "client_engagements", ["project_id"], unique=False)
    op.create_index("ix_client_engagements_status", "client_engagements", ["status"], unique=False)
    op.create_index("ix_client_engagements_org_status", "client_engagements", ["org_id", "status"], unique=False)

    op.create_table(
        "marketing_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("stage", sa.String(length=30), nullable=False, server_default="intake"),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("strategy_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("current_blocker", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_marketing_runs_org_id", "marketing_runs", ["org_id"], unique=False)
    op.create_index("ix_marketing_runs_engagement_id", "marketing_runs", ["engagement_id"], unique=False)
    op.create_index("ix_marketing_runs_project_id", "marketing_runs", ["project_id"], unique=False)
    op.create_index("ix_marketing_runs_status", "marketing_runs", ["status"], unique=False)
    op.create_index("ix_marketing_runs_stage", "marketing_runs", ["stage"], unique=False)
    op.create_index("ix_marketing_runs_org_stage", "marketing_runs", ["org_id", "stage"], unique=False)
    op.create_index("ix_marketing_runs_engagement_status", "marketing_runs", ["engagement_id", "status"], unique=False)

    op.create_table(
        "agency_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketing_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("virtual_agency_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("artifact_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("evidence_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("lineage", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("author_role", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["virtual_agency_task_id"], ["virtual_agency_tasks.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_agency_artifacts_org_id", "agency_artifacts", ["org_id"], unique=False)
    op.create_index("ix_agency_artifacts_engagement_id", "agency_artifacts", ["engagement_id"], unique=False)
    op.create_index("ix_agency_artifacts_marketing_run_id", "agency_artifacts", ["marketing_run_id"], unique=False)
    op.create_index("ix_agency_artifacts_virtual_agency_task_id", "agency_artifacts", ["virtual_agency_task_id"], unique=False)
    op.create_index("ix_agency_artifacts_artifact_type", "agency_artifacts", ["artifact_type"], unique=False)
    op.create_index("ix_agency_artifacts_payload_hash", "agency_artifacts", ["payload_hash"], unique=False)
    op.create_index("ix_agency_artifacts_run_type", "agency_artifacts", ["marketing_run_id", "artifact_type"], unique=False)
    op.create_index("ix_agency_artifacts_engagement_type", "agency_artifacts", ["engagement_id", "artifact_type"], unique=False)

    op.create_table(
        "agency_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketing_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approval_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("subject_type", sa.String(length=50), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("approval_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("approval_payload_hash", sa.String(length=64), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agency_approval_requests_org_id", "agency_approval_requests", ["org_id"], unique=False)
    op.create_index("ix_agency_approval_requests_engagement_id", "agency_approval_requests", ["engagement_id"], unique=False)
    op.create_index("ix_agency_approval_requests_marketing_run_id", "agency_approval_requests", ["marketing_run_id"], unique=False)
    op.create_index("ix_agency_approval_requests_approval_type", "agency_approval_requests", ["approval_type"], unique=False)
    op.create_index("ix_agency_approval_requests_status", "agency_approval_requests", ["status"], unique=False)
    op.create_index("ix_agency_approval_requests_subject_type", "agency_approval_requests", ["subject_type"], unique=False)
    op.create_index("ix_agency_approval_requests_subject_id", "agency_approval_requests", ["subject_id"], unique=False)
    op.create_index("ix_agency_approval_requests_approval_payload_hash", "agency_approval_requests", ["approval_payload_hash"], unique=False)
    op.create_index("ix_agency_approvals_engagement_status", "agency_approval_requests", ["engagement_id", "status"], unique=False)
    op.create_index("ix_agency_approvals_subject", "agency_approval_requests", ["subject_type", "subject_id"], unique=False)

    op.create_table(
        "agency_access_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketing_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="requested"),
        sa.Column("scope", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("instructions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agency_access_requests_org_id", "agency_access_requests", ["org_id"], unique=False)
    op.create_index("ix_agency_access_requests_engagement_id", "agency_access_requests", ["engagement_id"], unique=False)
    op.create_index("ix_agency_access_requests_marketing_run_id", "agency_access_requests", ["marketing_run_id"], unique=False)
    op.create_index("ix_agency_access_requests_request_type", "agency_access_requests", ["request_type"], unique=False)
    op.create_index("ix_agency_access_requests_provider", "agency_access_requests", ["provider"], unique=False)
    op.create_index("ix_agency_access_requests_status", "agency_access_requests", ["status"], unique=False)
    op.create_index("ix_agency_access_engagement_status", "agency_access_requests", ["engagement_id", "status"], unique=False)
    op.create_index("ix_agency_access_provider_status", "agency_access_requests", ["provider", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_agency_access_provider_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_engagement_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_provider", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_request_type", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_marketing_run_id", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_engagement_id", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_org_id", table_name="agency_access_requests")
    op.drop_table("agency_access_requests")

    op.drop_index("ix_agency_approvals_subject", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approvals_engagement_status", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_approval_payload_hash", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_subject_id", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_subject_type", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_status", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_approval_type", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_marketing_run_id", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_engagement_id", table_name="agency_approval_requests")
    op.drop_index("ix_agency_approval_requests_org_id", table_name="agency_approval_requests")
    op.drop_table("agency_approval_requests")

    op.drop_index("ix_agency_artifacts_engagement_type", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_run_type", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_payload_hash", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_artifact_type", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_virtual_agency_task_id", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_marketing_run_id", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_engagement_id", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_org_id", table_name="agency_artifacts")
    op.drop_table("agency_artifacts")

    op.drop_index("ix_marketing_runs_engagement_status", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_org_stage", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_stage", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_status", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_project_id", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_engagement_id", table_name="marketing_runs")
    op.drop_index("ix_marketing_runs_org_id", table_name="marketing_runs")
    op.drop_table("marketing_runs")

    op.drop_index("ix_client_engagements_org_status", table_name="client_engagements")
    op.drop_index("ix_client_engagements_status", table_name="client_engagements")
    op.drop_index("ix_client_engagements_project_id", table_name="client_engagements")
    op.drop_index("ix_client_engagements_lead_id", table_name="client_engagements")
    op.drop_index("ix_client_engagements_org_id", table_name="client_engagements")
    op.drop_table("client_engagements")
```

- [ ] **Step 6: Run model tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_models.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plugged_in_social/backend/app/models/agency.py plugged_in_social/backend/app/models/__init__.py plugged_in_social/backend/alembic/versions/024_autonomous_agency_domain_spine.py plugged_in_social/backend/tests/test_agency_domain_models.py
git commit -m "feat: add autonomous agency domain models"
```

## Task 2: Add Agency Pydantic Schemas

**Files:**

- Create: `plugged_in_social/backend/app/schemas/agency.py`
- Test: `plugged_in_social/backend/tests/test_agency_domain_models.py`

- [ ] **Step 1: Add failing schema tests to `test_agency_domain_models.py`**

Append:

```python
import pytest
from pydantic import ValidationError


def test_client_engagement_create_schema_requires_name_or_url():
    from app.schemas.agency import ClientEngagementCreate

    with pytest.raises(ValidationError):
        ClientEngagementCreate()

    body = ClientEngagementCreate(
        name="Acme",
        client_url="https://example.com",
        goals=["increase qualified leads"],
    )

    assert body.name == "Acme"
    assert str(body.client_url) == "https://example.com/"
    assert body.goals == ["increase qualified leads"]


def test_agency_artifact_create_schema_accepts_evidence_refs():
    from app.schemas.agency import AgencyArtifactCreate

    body = AgencyArtifactCreate(
        artifact_type="research_brief",
        title="Research brief",
        body="Initial findings",
        payload={"positioning": "trust-first"},
        evidence_refs=[
            {
                "kind": "url",
                "id": "https://example.com",
                "label": "Client homepage",
            }
        ],
        author_role="research_strategist",
    )

    assert body.artifact_type == "research_brief"
    assert body.evidence_refs[0]["kind"] == "url"


def test_approval_decision_schema_validates_supported_decisions():
    from app.schemas.agency import AgencyApprovalDecision

    assert AgencyApprovalDecision(decision="approved").decision == "approved"

    with pytest.raises(ValidationError):
        AgencyApprovalDecision(decision="maybe")
```

- [ ] **Step 2: Run schema tests to verify they fail**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_models.py::test_client_engagement_create_schema_requires_name_or_url plugged_in_social/backend/tests/test_agency_domain_models.py::test_agency_artifact_create_schema_accepts_evidence_refs plugged_in_social/backend/tests/test_agency_domain_models.py::test_approval_decision_schema_validates_supported_decisions
```

Expected: FAIL because `app.schemas.agency` does not exist.

- [ ] **Step 3: Create schemas**

Create `plugged_in_social/backend/app/schemas/agency.py`:

```python
"""Schemas for the autonomous agency domain spine."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import AnyUrl, BaseModel, Field, model_validator


class ClientEngagementCreate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    client_url: AnyUrl | None = None
    repo_url: AnyUrl | None = None
    client_name: str | None = Field(default=None, max_length=255)
    client_email: str | None = Field(default=None, max_length=255)
    lead_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    goals: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    intake_payload: dict = Field(default_factory=dict)
    integration_state: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def _require_name_or_url(self) -> "ClientEngagementCreate":
        if not self.name and not self.client_url:
            raise ValueError("name or client_url is required")
        return self


class ClientEngagementResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_id: uuid.UUID | None
    project_id: uuid.UUID | None
    name: str
    client_url: str | None
    repo_url: str | None
    client_name: str | None
    client_email: str | None
    status: str
    goals: list
    constraints: list
    intake_payload: dict
    integration_state: dict
    created_by_agent: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MarketingRunCreate(BaseModel):
    objective: str = Field(min_length=1)
    project_id: uuid.UUID | None = None


class MarketingRunResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    project_id: uuid.UUID | None
    status: str
    stage: str
    objective: str
    strategy_summary: dict
    current_blocker: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EvidenceRef(BaseModel):
    kind: str = Field(min_length=1, max_length=50)
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)


class AgencyArtifactCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    virtual_agency_task_id: uuid.UUID | None = None
    artifact_type: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    body: str | None = None
    payload: dict = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    lineage: dict = Field(default_factory=dict)
    author_role: str = Field(min_length=1, max_length=50)


class AgencyArtifactResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    virtual_agency_task_id: uuid.UUID | None
    artifact_type: str
    title: str
    body: str | None
    payload: dict
    payload_hash: str
    version: int
    evidence_refs: list
    lineage: dict
    author_role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgencyApprovalCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    approval_type: str = Field(min_length=1, max_length=50)
    subject_type: str = Field(min_length=1, max_length=50)
    subject_id: uuid.UUID
    reason: str = Field(min_length=1)
    approval_version: int = Field(default=1, ge=1)
    approval_payload: dict = Field(default_factory=dict)


class AgencyApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected", "revoked"]
    decision_note: str | None = None


class AgencyApprovalResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    approval_type: str
    status: str
    subject_type: str
    subject_id: uuid.UUID
    reason: str
    approval_version: int
    approval_payload_hash: str
    decided_at: datetime | None
    decided_by_user_id: uuid.UUID | None
    decision_note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgencyAccessRequestCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    request_type: str = Field(min_length=1, max_length=50)
    provider: str | None = Field(default=None, max_length=50)
    scope: dict = Field(default_factory=dict)
    reason: str = Field(min_length=1)
    instructions: dict = Field(default_factory=dict)


class AgencyAccessRequestResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    request_type: str
    provider: str | None
    status: str
    scope: dict
    reason: str
    instructions: dict
    resolved_at: datetime | None
    resolved_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_models.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugged_in_social/backend/app/schemas/agency.py plugged_in_social/backend/tests/test_agency_domain_models.py
git commit -m "feat: add autonomous agency schemas"
```

## Task 3: Add Domain Service Helpers

**Files:**

- Create: `plugged_in_social/backend/app/services/agency_domain.py`
- Test: `plugged_in_social/backend/tests/test_agency_domain_service.py`

- [ ] **Step 1: Write failing service tests**

Create `plugged_in_social/backend/tests/test_agency_domain_service.py`:

```python
from __future__ import annotations

import uuid
from collections import defaultdict

import pytest

from app.models.agency import (
    AgencyAccessRequest,
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)


class _FakeAgencySession:
    def __init__(self):
        self._store: dict[type[object], dict[uuid.UUID, object]] = defaultdict(dict)
        self.flush_count = 0

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self._store[type(obj)][obj.id] = obj

    async def flush(self):
        self.flush_count += 1

    async def get(self, model, item_id):
        return self._store.get(model, {}).get(item_id)


@pytest.mark.asyncio
async def test_create_engagement_and_marketing_run():
    from app.services.agency_domain import create_client_engagement, start_marketing_run

    db = _FakeAgencySession()
    org_id = uuid.uuid4()

    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(
            name="Acme",
            client_url="https://example.com",
            goals=["increase qualified leads"],
            constraints=["approval required before publishing"],
        ),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build a 30-day launch strategy",
    )

    assert engagement.org_id == org_id
    assert engagement.status == "intake"
    assert engagement.name == "Acme"
    assert engagement.goals == ["increase qualified leads"]
    assert run.org_id == org_id
    assert run.engagement_id == engagement.id
    assert run.stage == "intake"
    assert run.objective == "Build a 30-day launch strategy"
    assert db.flush_count == 2


@pytest.mark.asyncio
async def test_create_artifact_hashes_payload_and_lineage():
    from app.services.agency_domain import (
        create_agency_artifact,
        create_client_engagement,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build a launch strategy",
    )

    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            artifact_type="research_brief",
            title="Research brief",
            payload={"positioning": "trust-first"},
            evidence_refs=[
                {"kind": "url", "id": "https://example.com", "label": "Homepage"}
            ],
            author_role="research_strategist",
        ),
    )

    assert artifact.payload_hash
    assert len(artifact.payload_hash) == 64
    assert artifact.lineage["engagement_id"] == str(engagement.id)
    assert artifact.lineage["marketing_run_id"] == str(run.id)
    assert artifact.evidence_refs[0]["label"] == "Homepage"


@pytest.mark.asyncio
async def test_create_approval_request_hashes_subject_payload():
    from app.services.agency_domain import (
        create_agency_artifact,
        create_approval_request,
        create_client_engagement,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(db, engagement=engagement, objective="Strategy")
    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            artifact_type="strategy_plan",
            title="Strategy",
            payload={"pillars": ["trust"]},
            author_role="strategy_director",
        ),
    )

    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyApprovalCreate(
            marketing_run_id=run.id,
            approval_type="strategy",
            subject_type="agency_artifact",
            subject_id=artifact.id,
            reason="Approve strategy before production begins",
            approval_payload=artifact.payload,
        ),
    )

    assert approval.status == "pending"
    assert approval.approval_payload_hash
    assert len(approval.approval_payload_hash) == 64
    assert approval.subject_id == artifact.id


@pytest.mark.asyncio
async def test_create_access_request_records_visible_blocker():
    from app.services.agency_domain import create_access_request, create_client_engagement

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )

    request = await create_access_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyAccessRequestCreate(
            request_type="analytics",
            provider="umami",
            scope={"website_id": "required"},
            reason="Metrics reporting needs analytics access",
            instructions={"action": "connect_umami"},
        ),
    )

    assert request.status == "requested"
    assert request.provider == "umami"
    assert request.scope == {"website_id": "required"}
    assert request.reason == "Metrics reporting needs analytics access"
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_service.py
```

Expected: FAIL because `app.services.agency_domain` does not exist.

- [ ] **Step 3: Create service implementation**

Create `plugged_in_social/backend/app/services/agency_domain.py`:

```python
"""Deterministic services for the autonomous agency domain spine."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import (
    AgencyAccessRequest,
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_payload_hash(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def _url_to_string(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


async def create_client_engagement(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    body: ClientEngagementCreate,
    created_by_agent: str | None,
) -> ClientEngagement:
    name = body.name or (str(body.client_url.host) if body.client_url else "Client engagement")
    engagement = ClientEngagement(
        org_id=org_id,
        lead_id=body.lead_id,
        project_id=body.project_id,
        name=name,
        client_url=_url_to_string(body.client_url),
        repo_url=_url_to_string(body.repo_url),
        client_name=body.client_name,
        client_email=body.client_email,
        goals=list(body.goals),
        constraints=list(body.constraints),
        intake_payload=dict(body.intake_payload),
        integration_state=dict(body.integration_state),
        created_by_agent=created_by_agent,
    )
    db.add(engagement)
    await db.flush()
    return engagement


async def start_marketing_run(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    objective: str,
    project_id: uuid.UUID | None = None,
) -> MarketingRun:
    run = MarketingRun(
        org_id=engagement.org_id,
        engagement_id=engagement.id,
        project_id=project_id or engagement.project_id,
        objective=objective,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()
    return run


async def create_agency_artifact(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyArtifactCreate,
) -> AgencyArtifact:
    evidence_refs = [
        ref.model_dump() if hasattr(ref, "model_dump") else dict(ref)
        for ref in body.evidence_refs
    ]
    lineage = {
        **dict(body.lineage),
        "engagement_id": str(engagement.id),
    }
    if body.marketing_run_id is not None:
        lineage["marketing_run_id"] = str(body.marketing_run_id)
    if body.virtual_agency_task_id is not None:
        lineage["virtual_agency_task_id"] = str(body.virtual_agency_task_id)
    payload = dict(body.payload)
    payload_hash = compute_payload_hash(
        {
            "artifact_type": body.artifact_type,
            "title": body.title,
            "body": body.body,
            "payload": payload,
            "evidence_refs": evidence_refs,
            "lineage": lineage,
            "author_role": body.author_role,
        }
    )
    artifact = AgencyArtifact(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        virtual_agency_task_id=body.virtual_agency_task_id,
        artifact_type=body.artifact_type,
        title=body.title,
        body=body.body,
        payload=payload,
        payload_hash=payload_hash,
        evidence_refs=evidence_refs,
        lineage=lineage,
        author_role=body.author_role,
    )
    db.add(artifact)
    await db.flush()
    return artifact


async def create_approval_request(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyApprovalCreate,
) -> AgencyApprovalRequest:
    approval_payload_hash = compute_payload_hash(
        {
            "approval_type": body.approval_type,
            "subject_type": body.subject_type,
            "subject_id": str(body.subject_id),
            "reason": body.reason,
            "approval_version": body.approval_version,
            "approval_payload": body.approval_payload,
        }
    )
    approval = AgencyApprovalRequest(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        approval_type=body.approval_type,
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        reason=body.reason,
        approval_version=body.approval_version,
        approval_payload_hash=approval_payload_hash,
    )
    db.add(approval)
    await db.flush()
    return approval


async def create_access_request(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyAccessRequestCreate,
) -> AgencyAccessRequest:
    access_request = AgencyAccessRequest(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        request_type=body.request_type,
        provider=body.provider,
        scope=dict(body.scope),
        reason=body.reason,
        instructions=dict(body.instructions),
    )
    db.add(access_request)
    await db.flush()
    return access_request
```

- [ ] **Step 4: Run service tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_service.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugged_in_social/backend/app/services/agency_domain.py plugged_in_social/backend/tests/test_agency_domain_service.py
git commit -m "feat: add autonomous agency domain services"
```

## Task 4: Extend Virtual-Agency Lineage for Agency IDs

**Files:**

- Modify: `plugged_in_social/backend/app/services/virtual_agency_orchestration.py`
- Test: `plugged_in_social/backend/tests/test_virtual_agency_orchestration.py`

- [ ] **Step 1: Add failing lineage test**

Append to `plugged_in_social/backend/tests/test_virtual_agency_orchestration.py`:

```python
def test_build_lineage_accepts_agency_context_ids_without_breaking_legacy_keys():
    from app.services.virtual_agency_orchestration import build_lineage

    project_id = uuid.uuid4()
    legacy_task_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    marketing_run_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    lineage = build_lineage(
        client_request="Launch campaign",
        project_id=project_id,
        legacy_task_id=legacy_task_id,
        engagement_id=engagement_id,
        marketing_run_id=marketing_run_id,
        artifact_id=artifact_id,
    )

    assert lineage["client_request"] == "Launch campaign"
    assert lineage["project_id"] == str(project_id)
    assert lineage["legacy_task_id"] == str(legacy_task_id)
    assert lineage["engagement_id"] == str(engagement_id)
    assert lineage["marketing_run_id"] == str(marketing_run_id)
    assert lineage["artifact_id"] == str(artifact_id)
```

- [ ] **Step 2: Run the specific test to verify it fails**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_virtual_agency_orchestration.py::test_build_lineage_accepts_agency_context_ids_without_breaking_legacy_keys
```

Expected: FAIL with `TypeError: build_lineage() got an unexpected keyword argument 'engagement_id'`.

- [ ] **Step 3: Extend `build_lineage` signature and body**

Modify `plugged_in_social/backend/app/services/virtual_agency_orchestration.py`.

Replace the existing `build_lineage` function with:

```python
def build_lineage(
    *,
    client_request: str,
    project_id: uuid.UUID,
    legacy_task_id: uuid.UUID,
    orchestration_task_id: uuid.UUID | None = None,
    artifact_id: uuid.UUID | None = None,
    engagement_id: uuid.UUID | None = None,
    marketing_run_id: uuid.UUID | None = None,
) -> dict[str, str]:
    lineage = {
        "client_request": client_request,
        "project_id": str(project_id),
        "legacy_task_id": str(legacy_task_id),
    }
    if orchestration_task_id:
        lineage["orchestration_task_id"] = str(orchestration_task_id)
    if artifact_id:
        lineage["artifact_id"] = str(artifact_id)
    if engagement_id:
        lineage["engagement_id"] = str(engagement_id)
    if marketing_run_id:
        lineage["marketing_run_id"] = str(marketing_run_id)
    return lineage
```

- [ ] **Step 4: Run virtual-agency tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_virtual_agency_orchestration.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugged_in_social/backend/app/services/virtual_agency_orchestration.py plugged_in_social/backend/tests/test_virtual_agency_orchestration.py
git commit -m "feat: link virtual agency lineage to agency runs"
```

## Task 5: Add Agency API Router

**Files:**

- Create: `plugged_in_social/backend/app/api/agency.py`
- Modify: `plugged_in_social/backend/app/main.py`
- Test: `plugged_in_social/backend/tests/test_agency_api_contract.py`

- [ ] **Step 1: Write failing API contract tests**

Create `plugged_in_social/backend/tests/test_agency_api_contract.py`:

```python
from __future__ import annotations

import inspect


def test_agency_router_imports_with_expected_prefix():
    import app.api.agency as module

    assert module.router.prefix == "/agency"
    route_paths = {route.path for route in module.router.routes}
    assert "/engagements" in route_paths
    assert "/engagements/{engagement_id}" in route_paths
    assert "/engagements/{engagement_id}/runs" in route_paths
    assert "/engagements/{engagement_id}/artifacts" in route_paths
    assert "/engagements/{engagement_id}/approvals" in route_paths
    assert "/engagements/{engagement_id}/access-requests" in route_paths


def test_agency_router_uses_rls_and_current_user_dependencies():
    import app.api.agency as module

    src = inspect.getsource(module)

    assert "get_db_with_rls_dep" in src
    assert "get_current_user" in src
    assert "uuid.UUID(current_user[\"org_id\"])" in src


def test_main_registers_agency_router():
    import app.main as module

    src = inspect.getsource(module)

    assert "from app.api.agency import router as agency_router" in src
    assert "app.include_router(agency_router, prefix=\"/api\")" in src
```

- [ ] **Step 2: Run API contract tests to verify they fail**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_api_contract.py
```

Expected: FAIL because `app.api.agency` does not exist and `app.main` has no agency router registration.

- [ ] **Step 3: Create API router**

Create `plugged_in_social/backend/app/api/agency.py`:

```python
"""Autonomous agency domain endpoints."""
from __future__ import annotations

import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.agency import (
    AgencyAccessRequest,
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyAccessRequestResponse,
    AgencyApprovalCreate,
    AgencyApprovalResponse,
    AgencyArtifactCreate,
    AgencyArtifactResponse,
    ClientEngagementCreate,
    ClientEngagementResponse,
    MarketingRunCreate,
    MarketingRunResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.agency_domain import (
    create_access_request,
    create_agency_artifact,
    create_approval_request,
    create_client_engagement,
    start_marketing_run,
)

router = APIRouter(prefix="/agency", tags=["agency"])


def _org_id_from_user(current_user: dict) -> uuid.UUID:
    if not current_user.get("org_id"):
        raise HTTPException(status_code=403, detail="Organization context required")
    return uuid.UUID(current_user["org_id"])


async def _get_engagement_or_404(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement_id: uuid.UUID,
) -> ClientEngagement:
    result = await db.execute(
        select(ClientEngagement).where(
            ClientEngagement.id == engagement_id,
            ClientEngagement.org_id == org_id,
        )
    )
    engagement = result.scalar_one_or_none()
    if engagement is None:
        raise HTTPException(status_code=404, detail="Client engagement not found")
    return engagement


@router.get("/engagements", response_model=PaginatedResponse)
async def list_engagements(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    query = select(ClientEngagement).where(ClientEngagement.org_id == org_id)
    if status_filter:
        query = query.where(ClientEngagement.status == status_filter)

    count_result = await db.execute(query)
    all_items = list(count_result.scalars().all())
    total = len(all_items)

    result = await db.execute(
        query.order_by(ClientEngagement.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    engagements = result.scalars().all()

    return PaginatedResponse(
        items=[ClientEngagementResponse.model_validate(item) for item in engagements],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/engagements", response_model=ClientEngagementResponse, status_code=201)
async def create_engagement(
    body: ClientEngagementCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=body,
        created_by_agent="chief_of_staff",
    )
    await db.commit()
    await db.refresh(engagement)
    return ClientEngagementResponse.model_validate(engagement)


@router.get("/engagements/{engagement_id}", response_model=ClientEngagementResponse)
async def get_engagement(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    return ClientEngagementResponse.model_validate(engagement)


@router.post(
    "/engagements/{engagement_id}/runs",
    response_model=MarketingRunResponse,
    status_code=201,
)
async def create_marketing_run(
    engagement_id: uuid.UUID,
    body: MarketingRunCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective=body.objective,
        project_id=body.project_id,
    )
    await db.commit()
    await db.refresh(run)
    return MarketingRunResponse.model_validate(run)


@router.post(
    "/engagements/{engagement_id}/artifacts",
    response_model=AgencyArtifactResponse,
    status_code=201,
)
async def create_artifact(
    engagement_id: uuid.UUID,
    body: AgencyArtifactCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(artifact)
    return AgencyArtifactResponse.model_validate(artifact)


@router.post(
    "/engagements/{engagement_id}/approvals",
    response_model=AgencyApprovalResponse,
    status_code=201,
)
async def create_approval(
    engagement_id: uuid.UUID,
    body: AgencyApprovalCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(approval)
    return AgencyApprovalResponse.model_validate(approval)


@router.post(
    "/engagements/{engagement_id}/access-requests",
    response_model=AgencyAccessRequestResponse,
    status_code=201,
)
async def create_access(
    engagement_id: uuid.UUID,
    body: AgencyAccessRequestCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    access_request = await create_access_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(access_request)
    return AgencyAccessRequestResponse.model_validate(access_request)
```

- [ ] **Step 4: Register router in main**

Modify `plugged_in_social/backend/app/main.py`.

Add near the Phase 7 imports:

```python
from app.api.agency import router as agency_router
```

Add near the Phase 7 router registrations after `virtual_agency_router`:

```python
app.include_router(agency_router, prefix="/api")
```

- [ ] **Step 5: Run API contract tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_api_contract.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugged_in_social/backend/app/api/agency.py plugged_in_social/backend/app/main.py plugged_in_social/backend/tests/test_agency_api_contract.py
git commit -m "feat: add autonomous agency API"
```

## Task 6: Add Approval Decision Service and Endpoint

**Files:**

- Modify: `plugged_in_social/backend/app/services/agency_domain.py`
- Modify: `plugged_in_social/backend/app/api/agency.py`
- Modify: `plugged_in_social/backend/tests/test_agency_domain_service.py`
- Modify: `plugged_in_social/backend/tests/test_agency_api_contract.py`

- [ ] **Step 1: Add failing service test for approval decisions**

Append to `plugged_in_social/backend/tests/test_agency_domain_service.py`:

```python
@pytest.mark.asyncio
async def test_decide_approval_request_records_decision_actor_and_note():
    from app.services.agency_domain import (
        create_approval_request,
        create_client_engagement,
        decide_approval_request,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyApprovalCreate(
            approval_type="strategy",
            subject_type="agency_artifact",
            subject_id=subject_id,
            reason="Approve strategy",
            approval_payload={"subject_id": str(subject_id)},
        ),
    )

    decided = await decide_approval_request(
        db,
        approval=approval,
        decision="approved",
        decided_by_user_id=user_id,
        decision_note="Approved for production",
    )

    assert decided is approval
    assert approval.status == "approved"
    assert approval.decided_by_user_id == user_id
    assert approval.decision_note == "Approved for production"
    assert approval.decided_at is not None
```

- [ ] **Step 2: Add failing API contract test for decision endpoint**

Append to `plugged_in_social/backend/tests/test_agency_api_contract.py`:

```python
def test_agency_router_exposes_approval_decision_endpoint():
    import app.api.agency as module

    src = inspect.getsource(module)

    assert '"/approvals/{approval_id}/decision"' in src
    assert "AgencyApprovalDecision" in src
    assert "decide_approval_request(" in src
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_service.py::test_decide_approval_request_records_decision_actor_and_note plugged_in_social/backend/tests/test_agency_api_contract.py::test_agency_router_exposes_approval_decision_endpoint
```

Expected: FAIL because `decide_approval_request` and the endpoint do not exist.

- [ ] **Step 4: Add decision service**

Modify `plugged_in_social/backend/app/services/agency_domain.py`.

Add:

```python
async def decide_approval_request(
    db: AsyncSession,
    *,
    approval: AgencyApprovalRequest,
    decision: str,
    decided_by_user_id: uuid.UUID | None,
    decision_note: str | None = None,
) -> AgencyApprovalRequest:
    if decision not in {"approved", "rejected", "revoked"}:
        raise ValueError("decision must be approved, rejected, or revoked")
    approval.status = decision
    approval.decided_by_user_id = decided_by_user_id
    approval.decision_note = decision_note
    approval.decided_at = datetime.now(timezone.utc)
    db.add(approval)
    await db.flush()
    return approval
```

- [ ] **Step 5: Add decision endpoint**

Modify imports in `plugged_in_social/backend/app/api/agency.py`.

Add `AgencyApprovalDecision` to the schema import list:

```python
    AgencyApprovalDecision,
```

Add `decide_approval_request` to the service import list:

```python
    decide_approval_request,
```

Add endpoint:

```python
@router.post(
    "/approvals/{approval_id}/decision",
    response_model=AgencyApprovalResponse,
)
async def decide_approval(
    approval_id: uuid.UUID,
    body: AgencyApprovalDecision,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    result = await db.execute(
        select(AgencyApprovalRequest).where(
            AgencyApprovalRequest.id == approval_id,
            AgencyApprovalRequest.org_id == org_id,
        )
    )
    approval = result.scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval request not found")
    decided = await decide_approval_request(
        db,
        approval=approval,
        decision=body.decision,
        decided_by_user_id=(
            uuid.UUID(str(current_user["id"])) if current_user.get("id") else None
        ),
        decision_note=body.decision_note,
    )
    await db.commit()
    await db.refresh(decided)
    return AgencyApprovalResponse.model_validate(decided)
```

- [ ] **Step 6: Run approval tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_service.py plugged_in_social/backend/tests/test_agency_api_contract.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plugged_in_social/backend/app/services/agency_domain.py plugged_in_social/backend/app/api/agency.py plugged_in_social/backend/tests/test_agency_domain_service.py plugged_in_social/backend/tests/test_agency_api_contract.py
git commit -m "feat: add autonomous agency approval decisions"
```

## Task 7: Full Backend Verification

**Files:**

- No planned file changes.

- [ ] **Step 1: Run focused agency tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_agency_domain_models.py plugged_in_social/backend/tests/test_agency_domain_service.py plugged_in_social/backend/tests/test_agency_api_contract.py
```

Expected: PASS.

- [ ] **Step 2: Run virtual-agency regression tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests/test_virtual_agency_orchestration.py plugged_in_social/backend/tests/test_virtual_agency_api_contract.py
```

Expected: PASS.

- [ ] **Step 3: Run full backend tests**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m pytest -q plugged_in_social/backend/tests
```

Expected: PASS.

- [ ] **Step 4: Run migration syntax check**

Run:

```bash
/tmp/pluggedinsocial-backend-test-venv/bin/python -m py_compile plugged_in_social/backend/alembic/versions/024_autonomous_agency_domain_spine.py
```

Expected: command exits 0.

- [ ] **Step 5: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit 0.

## Completion Criteria

This plan is complete when:

- New agency domain models import through `app.models`.
- Migration `024_autonomous_agency_domain_spine.py` exists and compiles.
- Domain service tests prove engagement/run/artifact/approval/access creation.
- `build_lineage` accepts `engagement_id` and `marketing_run_id` without breaking existing virtual-agency callers.
- `/api/agency/*` router imports and is registered in `app.main`.
- Approval decisions can be recorded through service and API.
- Focused agency tests, virtual-agency regression tests, and full backend tests pass.

## Follow-On Plans

After this plan lands, create separate implementation plans for:

- Client Engagement Command Center frontend.
- Intake-to-research-to-strategy agent workflow.
- Strategy-to-work-plan virtual-agency task expansion.
- Production-to-scheduling approval flow.
- Metrics/reporting/next-action loop.
- Neutral `/api/integration/v1/*` API and substrate adapter.
- Canary-backed browser verification harness.

