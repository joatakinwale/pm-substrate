"""015 — Sprint planning, task dependencies, and workload tracking (PM-2).

Layered on top of the existing Task + Project models to support
internal-team project management beyond the Kanban board:

- ``sprints`` table         — time-boxed planning windows; a project can
  have zero or many sprints. ``status`` progresses draft → active →
  completed. Only one sprint per project may be ``active`` at a time;
  the backend enforces this via a partial unique index (see
  ``ix_sprints_one_active_per_project``).

- ``tasks.story_points``    — integer estimate in "points" (nullable).
  Teams that prefer hour estimates set ``estimate_hours`` instead; both
  may be null for un-estimated backlog items.

- ``tasks.estimate_hours``  — float estimate in hours (nullable).

- ``tasks.sprint_id``       — FK to sprints. Null means "backlog / not
  assigned to any sprint yet". ON DELETE SET NULL so archiving a sprint
  doesn't cascade-delete work that was in it.

- ``task_dependencies``     — join table modelling "task A blocked by
  task B". Primary key is the pair (task_id, depends_on_task_id). A DB
  CHECK prevents self-dependencies; cycle prevention is handled at the
  application layer (cheaper than a recursive CTE trigger and adequate
  for the sizes we expect).

None of these columns are required, so the migration is backwards-
compatible — existing code keeps working with ``sprint_id=None`` and
``story_points=None``. All three new columns are indexed where query
patterns warrant.

RLS is unchanged: org_id isolation already covers sprints via the
project FK chain.

Revision ID: 015
Revises: 014
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── sprints ─────────────────────────────────────────────────
    op.create_table(
        "sprints",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "org_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "project_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("goal", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column(
            "start_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "end_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    # Partial unique index: only one sprint per project may be "active".
    # Draft and completed sprints are unconstrained.
    op.execute(
        "CREATE UNIQUE INDEX ix_sprints_one_active_per_project "
        "ON sprints (project_id) WHERE status = 'active'"
    )

    # ── task extensions ─────────────────────────────────────────
    op.add_column(
        "tasks",
        sa.Column("story_points", sa.Integer, nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("estimate_hours", sa.Float, nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "sprint_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sprints.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_sprint_id", "tasks", ["sprint_id"])

    # ── task_dependencies ──────────────────────────────────────
    op.create_table(
        "task_dependencies",
        sa.Column(
            "task_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "depends_on_task_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # Prevent self-dependency at DB level. Cycle detection across
        # multiple hops is done application-side.
        sa.CheckConstraint(
            "task_id != depends_on_task_id",
            name="ck_task_dependencies_no_self_ref",
        ),
    )
    op.create_index(
        "ix_task_dependencies_depends_on",
        "task_dependencies",
        ["depends_on_task_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_task_dependencies_depends_on",
        table_name="task_dependencies",
    )
    op.drop_table("task_dependencies")
    op.drop_index("ix_tasks_sprint_id", table_name="tasks")
    op.drop_column("tasks", "sprint_id")
    op.drop_column("tasks", "estimate_hours")
    op.drop_column("tasks", "story_points")
    op.execute("DROP INDEX IF EXISTS ix_sprints_one_active_per_project")
    op.drop_table("sprints")
