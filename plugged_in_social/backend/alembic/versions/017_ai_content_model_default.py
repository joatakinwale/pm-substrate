"""017 — Refresh ai_content_requests.model default to claude-sonnet-4-6.

The original 010 migration baked ``claude-sonnet-4-20250514`` into the
``model`` column's server default. That model id is stale — Anthropic
ships under ``claude-sonnet-4-6`` / ``claude-opus-4-7`` /
``claude-haiku-4-5`` now. New rows still inherit the old id from the DB
default, so generations get queued with a model the AI Gateway rejects.

This migration:
1. Repoints the column server default to ``claude-sonnet-4-6``.
2. Rewrites any rows still carrying the stale id (typically rows queued
   before this deploy that haven't been picked up by the worker yet).

Revision ID: 017
Revises: 016
"""
from alembic import op


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


_OLD = "claude-sonnet-4-20250514"
_NEW = "claude-sonnet-4-6"


def upgrade() -> None:
    op.alter_column(
        "ai_content_requests",
        "model",
        server_default=_NEW,
    )
    op.execute(
        f"UPDATE ai_content_requests SET model = '{_NEW}' "
        f"WHERE model = '{_OLD}'"
    )


def downgrade() -> None:
    op.alter_column(
        "ai_content_requests",
        "model",
        server_default=_OLD,
    )
    op.execute(
        f"UPDATE ai_content_requests SET model = '{_OLD}' "
        f"WHERE model = '{_NEW}'"
    )
