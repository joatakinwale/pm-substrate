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
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("client_url", sa.Text(), nullable=True),
        sa.Column("repo_url", sa.Text(), nullable=True),
        sa.Column("client_name", sa.String(length=255), nullable=True),
        sa.Column("client_email", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="intake"),
        sa.Column(
            "goals",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "constraints",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "intake_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "integration_state",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_by_agent", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_client_engagements_org_id",
        "client_engagements",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_client_engagements_lead_id",
        "client_engagements",
        ["lead_id"],
        unique=False,
    )
    op.create_index(
        "ix_client_engagements_project_id",
        "client_engagements",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_client_engagements_status",
        "client_engagements",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_client_engagements_org_status",
        "client_engagements",
        ["org_id", "status"],
        unique=False,
    )

    op.create_table(
        "marketing_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("stage", sa.String(length=30), nullable=False, server_default="intake"),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column(
            "strategy_summary",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("current_blocker", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_marketing_runs_org_id", "marketing_runs", ["org_id"], unique=False)
    op.create_index(
        "ix_marketing_runs_engagement_id",
        "marketing_runs",
        ["engagement_id"],
        unique=False,
    )
    op.create_index(
        "ix_marketing_runs_project_id",
        "marketing_runs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_marketing_runs_status", "marketing_runs", ["status"], unique=False
    )
    op.create_index("ix_marketing_runs_stage", "marketing_runs", ["stage"], unique=False)
    op.create_index(
        "ix_marketing_runs_org_stage",
        "marketing_runs",
        ["org_id", "stage"],
        unique=False,
    )
    op.create_index(
        "ix_marketing_runs_engagement_status",
        "marketing_runs",
        ["engagement_id", "status"],
        unique=False,
    )

    op.create_table(
        "agency_artifacts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketing_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("virtual_agency_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("artifact_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "evidence_refs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "lineage",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("author_role", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["virtual_agency_task_id"],
            ["virtual_agency_tasks.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_agency_artifacts_org_id", "agency_artifacts", ["org_id"], unique=False
    )
    op.create_index(
        "ix_agency_artifacts_engagement_id",
        "agency_artifacts",
        ["engagement_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_marketing_run_id",
        "agency_artifacts",
        ["marketing_run_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_virtual_agency_task_id",
        "agency_artifacts",
        ["virtual_agency_task_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_artifact_type",
        "agency_artifacts",
        ["artifact_type"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_payload_hash",
        "agency_artifacts",
        ["payload_hash"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_run_type",
        "agency_artifacts",
        ["marketing_run_id", "artifact_type"],
        unique=False,
    )
    op.create_index(
        "ix_agency_artifacts_engagement_type",
        "agency_artifacts",
        ["engagement_id", "artifact_type"],
        unique=False,
    )

    op.create_table(
        "agency_approval_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_agency_approval_requests_org_id",
        "agency_approval_requests",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_engagement_id",
        "agency_approval_requests",
        ["engagement_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_marketing_run_id",
        "agency_approval_requests",
        ["marketing_run_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_approval_type",
        "agency_approval_requests",
        ["approval_type"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_status",
        "agency_approval_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_subject_type",
        "agency_approval_requests",
        ["subject_type"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_subject_id",
        "agency_approval_requests",
        ["subject_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approval_requests_approval_payload_hash",
        "agency_approval_requests",
        ["approval_payload_hash"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approvals_engagement_status",
        "agency_approval_requests",
        ["engagement_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_agency_approvals_subject",
        "agency_approval_requests",
        ["subject_type", "subject_id"],
        unique=False,
    )

    op.create_table(
        "agency_access_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("engagement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketing_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="requested"),
        sa.Column(
            "scope",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "instructions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["client_engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["marketing_run_id"], ["marketing_runs.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_agency_access_requests_org_id",
        "agency_access_requests",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_requests_engagement_id",
        "agency_access_requests",
        ["engagement_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_requests_marketing_run_id",
        "agency_access_requests",
        ["marketing_run_id"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_requests_request_type",
        "agency_access_requests",
        ["request_type"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_requests_provider",
        "agency_access_requests",
        ["provider"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_requests_status",
        "agency_access_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_engagement_status",
        "agency_access_requests",
        ["engagement_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_agency_access_provider_status",
        "agency_access_requests",
        ["provider", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_agency_access_provider_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_engagement_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_status", table_name="agency_access_requests")
    op.drop_index("ix_agency_access_requests_provider", table_name="agency_access_requests")
    op.drop_index(
        "ix_agency_access_requests_request_type", table_name="agency_access_requests"
    )
    op.drop_index(
        "ix_agency_access_requests_marketing_run_id",
        table_name="agency_access_requests",
    )
    op.drop_index(
        "ix_agency_access_requests_engagement_id",
        table_name="agency_access_requests",
    )
    op.drop_index("ix_agency_access_requests_org_id", table_name="agency_access_requests")
    op.drop_table("agency_access_requests")

    op.drop_index("ix_agency_approvals_subject", table_name="agency_approval_requests")
    op.drop_index(
        "ix_agency_approvals_engagement_status",
        table_name="agency_approval_requests",
    )
    op.drop_index(
        "ix_agency_approval_requests_approval_payload_hash",
        table_name="agency_approval_requests",
    )
    op.drop_index(
        "ix_agency_approval_requests_subject_id",
        table_name="agency_approval_requests",
    )
    op.drop_index(
        "ix_agency_approval_requests_subject_type",
        table_name="agency_approval_requests",
    )
    op.drop_index("ix_agency_approval_requests_status", table_name="agency_approval_requests")
    op.drop_index(
        "ix_agency_approval_requests_approval_type",
        table_name="agency_approval_requests",
    )
    op.drop_index(
        "ix_agency_approval_requests_marketing_run_id",
        table_name="agency_approval_requests",
    )
    op.drop_index(
        "ix_agency_approval_requests_engagement_id",
        table_name="agency_approval_requests",
    )
    op.drop_index("ix_agency_approval_requests_org_id", table_name="agency_approval_requests")
    op.drop_table("agency_approval_requests")

    op.drop_index("ix_agency_artifacts_engagement_type", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_run_type", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_payload_hash", table_name="agency_artifacts")
    op.drop_index("ix_agency_artifacts_artifact_type", table_name="agency_artifacts")
    op.drop_index(
        "ix_agency_artifacts_virtual_agency_task_id",
        table_name="agency_artifacts",
    )
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
