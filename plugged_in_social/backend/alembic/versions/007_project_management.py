"""007 — Phase 4 project management tables (projects, tasks, task_comments).

Revision ID: 007
Revises: 006
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ Projects ═══
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("proposal_id", UUID(as_uuid=True), sa.ForeignKey("proposals.id", ondelete="SET NULL")),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(30), server_default="active", index=True),
        sa.Column("client_name", sa.String(255)),
        sa.Column("client_email", sa.String(255)),
        sa.Column("compound_phase", sa.String(30)),
        sa.Column("start_date", sa.DateTime(timezone=True)),
        sa.Column("target_date", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("color", sa.String(7)),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Tasks ═══
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("project_id", UUID(as_uuid=True),
                  sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workflow_step", sa.Integer, server_default="1", index=True),
        sa.Column("position", sa.Float, server_default="0.0"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("assignee_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("assignee_name", sa.String(255)),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("tags", JSONB, server_default="[]"),
        sa.Column("attachments", JSONB, server_default="[]"),
        sa.Column("client_visible", sa.Boolean, server_default="false"),
        sa.Column("client_approved", sa.Boolean, server_default="false"),
        sa.Column("client_feedback", sa.Text),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Composite index for Kanban queries: tasks in a project, ordered within each step
    op.create_index("ix_tasks_kanban", "tasks", ["project_id", "workflow_step", "position"])

    # ═══ Task Comments ═══
    op.create_table(
        "task_comments",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("task_id", UUID(as_uuid=True),
                  sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("author_name", sa.String(255)),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_client_comment", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ RLS ═══
    for table in ("projects", "tasks"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id')::uuid)
        """)
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO stevie_app")

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON task_comments TO stevie_app")


def downgrade() -> None:
    for table in ("tasks", "projects"):
        op.execute(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table}")
    op.drop_table("task_comments")
    op.drop_table("tasks")
    op.drop_table("projects")
