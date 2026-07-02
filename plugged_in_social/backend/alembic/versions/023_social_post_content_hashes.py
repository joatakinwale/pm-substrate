"""023 — Social post content hash gates.

Revision ID: 023
Revises: 022
"""
from alembic import op
import sqlalchemy as sa


revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "social_posts",
        sa.Column("scheduled_content_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "social_posts",
        sa.Column("published_content_hash", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("social_posts", "published_content_hash")
    op.drop_column("social_posts", "scheduled_content_hash")
