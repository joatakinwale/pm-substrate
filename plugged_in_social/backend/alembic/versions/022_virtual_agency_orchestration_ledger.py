"""022 — Virtual agency orchestration ledger.

Revision ID: 022
Revises: 021
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "virtual_agency_tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parent_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("agent_role", sa.String(length=50), nullable=False),
        sa.Column("task_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="todo"),
        sa.Column("task_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("approved_version", sa.Integer(), nullable=True),
        sa.Column("approval_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("approval_payload_hash", sa.String(length=64), nullable=True),
        sa.Column("latest_event_hash", sa.String(length=64), nullable=True),
        sa.Column("creation_idempotency_key", sa.String(length=120), nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("lineage", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_task_id"], ["virtual_agency_tasks.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("creation_idempotency_key"),
    )
    op.create_index(
        "ix_virtual_agency_tasks_org_id",
        "virtual_agency_tasks",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_project_id",
        "virtual_agency_tasks",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_source_task_id",
        "virtual_agency_tasks",
        ["source_task_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_parent_task_id",
        "virtual_agency_tasks",
        ["parent_task_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_agent_role",
        "virtual_agency_tasks",
        ["agent_role"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_task_type",
        "virtual_agency_tasks",
        ["task_type"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_status",
        "virtual_agency_tasks",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_approval_active",
        "virtual_agency_tasks",
        ["approval_active"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_tasks_creation_idempotency_key",
        "virtual_agency_tasks",
        ["creation_idempotency_key"],
        unique=True,
    )
    op.create_index(
        "ix_virtual_agency_tasks_project_status",
        "virtual_agency_tasks",
        ["org_id", "project_id", "status"],
        unique=False,
    )

    op.create_table(
        "virtual_agency_task_dependencies",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("depends_on_task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["task_id"], ["virtual_agency_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["depends_on_task_id"], ["virtual_agency_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("task_id", "depends_on_task_id"),
    )

    op.create_table(
        "virtual_agency_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("actor_role", sa.String(length=50), nullable=True),
        sa.Column("actor_id", sa.String(length=255), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=False),
        sa.Column("task_version", sa.Integer(), nullable=True),
        sa.Column("approval_version", sa.Integer(), nullable=True),
        sa.Column("previous_event_hash", sa.String(length=64), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("lineage", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["task_id"], ["virtual_agency_tasks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint("event_hash"),
    )
    op.create_index(
        "ix_virtual_agency_events_org_id",
        "virtual_agency_events",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_events_task_id",
        "virtual_agency_events",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_events_event_type",
        "virtual_agency_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_virtual_agency_events_idempotency_key",
        "virtual_agency_events",
        ["idempotency_key"],
        unique=True,
    )
    op.create_index(
        "ix_virtual_agency_events_event_hash",
        "virtual_agency_events",
        ["event_hash"],
        unique=True,
    )

    op.add_column(
        "social_posts",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("social_posts", "version")

    op.drop_index("ix_virtual_agency_events_event_hash", table_name="virtual_agency_events")
    op.drop_index("ix_virtual_agency_events_idempotency_key", table_name="virtual_agency_events")
    op.drop_index("ix_virtual_agency_events_event_type", table_name="virtual_agency_events")
    op.drop_index("ix_virtual_agency_events_task_id", table_name="virtual_agency_events")
    op.drop_index("ix_virtual_agency_events_org_id", table_name="virtual_agency_events")
    op.drop_table("virtual_agency_events")

    op.drop_table("virtual_agency_task_dependencies")

    op.drop_index("ix_virtual_agency_tasks_project_status", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_creation_idempotency_key", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_approval_active", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_status", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_task_type", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_agent_role", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_parent_task_id", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_source_task_id", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_project_id", table_name="virtual_agency_tasks")
    op.drop_index("ix_virtual_agency_tasks_org_id", table_name="virtual_agency_tasks")
    op.drop_table("virtual_agency_tasks")
