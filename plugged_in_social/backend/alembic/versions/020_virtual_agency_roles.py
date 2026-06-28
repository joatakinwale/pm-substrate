"""020 — Virtual agency agent roles.

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa


revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("created_by_agent", sa.String(length=50), nullable=True))
    op.add_column("tasks", sa.Column("assigned_agent", sa.String(length=50), nullable=True))
    op.add_column("tasks", sa.Column("created_by_agent", sa.String(length=50), nullable=True))
    op.add_column("social_posts", sa.Column("created_by_agent", sa.String(length=50), nullable=True))
    op.add_column("client_reports", sa.Column("created_by_agent", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("client_reports", "created_by_agent")
    op.drop_column("social_posts", "created_by_agent")
    op.drop_column("tasks", "created_by_agent")
    op.drop_column("tasks", "assigned_agent")
    op.drop_column("projects", "created_by_agent")