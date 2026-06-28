"""021 — Agent role cascade tracking.

Revision ID: 021
Revises: 020
"""
from alembic import op
import sqlalchemy as sa


revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposals", sa.Column("agent_role", sa.String(length=50), nullable=True))
    op.add_column("proposal_versions", sa.Column("agent_role", sa.String(length=50), nullable=True))
    op.add_column("client_onboardings", sa.Column("agent_role", sa.String(length=50), nullable=True))
    op.add_column("invoices", sa.Column("agent_role", sa.String(length=50), nullable=True))
    op.add_column("activities", sa.Column("agent_role", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "agent_role")
    op.drop_column("invoices", "agent_role")
    op.drop_column("client_onboardings", "agent_role")
    op.drop_column("proposal_versions", "agent_role")
    op.drop_column("proposals", "agent_role")
