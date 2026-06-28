"""014 — Internal vs client project distinction (PM-1).

Adds three columns to ``projects`` to support internal-team workspaces
alongside the existing client-facing projects:

- ``project_type``  enum-ish string: 'client' (default) | 'internal'.
  Existing rows are client projects — no backfill needed.
- ``visibility``    'team' (any team member) | 'admins_only' (admin/owner).
  Only meaningful for internal projects. Client projects ignore it and
  derive access from client_email + portal sessions as before.
- ``workflow_steps`` JSONB override. Null means "use the canonical 13-step
  Stevie workflow". Internal projects can substitute a custom list:
    [{"step": 1, "key": "backlog", "title": "Backlog"}, ...]
  Keys must be unique within the array; the admin UI guards this.

The portal API layer filters ``project_type == 'client'`` defensively on
top of its existing ``client_email`` match — a belt-and-braces guarantee
that internal tasks can never leak through the public magic-link surface.

RLS is unchanged: org_id isolation already covers both types.

Revision ID: 014
Revises: 013
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "project_type",
            sa.String(20),
            server_default="client",
            nullable=False,
        ),
    )
    op.create_index(
        "ix_projects_project_type",
        "projects",
        ["project_type"],
    )
    op.add_column(
        "projects",
        sa.Column(
            "visibility",
            sa.String(20),
            server_default="team",
            nullable=False,
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "workflow_steps",
            JSONB,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_projects_project_type", table_name="projects")
    op.drop_column("projects", "workflow_steps")
    op.drop_column("projects", "visibility")
    op.drop_column("projects", "project_type")
