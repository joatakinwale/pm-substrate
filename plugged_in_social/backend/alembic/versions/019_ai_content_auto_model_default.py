"""019 — Make AI content DB default defer to auto routing.

Revision ID: 019
Revises: 018
"""
from alembic import op


revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "ai_content_requests",
        "model",
        server_default="",
    )


def downgrade() -> None:
    op.alter_column(
        "ai_content_requests",
        "model",
        server_default="claude-sonnet-4-6",
    )
