"""012 — Split password_hash from auth_id on users.

Prior to this migration, bcrypt hashes for the custom-JWT auth path were
stashed in the ``auth_id`` column, which was semantically reserved for
external auth provider user IDs (Supabase ``auth.users.id``). This
migration:

  1. Adds a dedicated ``password_hash`` column.
  2. Moves any existing bcrypt-looking values from ``auth_id`` into
     ``password_hash`` and clears ``auth_id`` on those rows (so the
     column is once again a safe place for Supabase UIDs).
  3. Leaves the unique index on ``auth_id`` in place — Supabase UIDs
     are globally unique.

bcrypt hashes are detected by the ``$2b$``/``$2a$``/``$2y$`` prefix
produced by passlib's bcrypt scheme. This is a dev-data migration only;
no production data is expected to exist yet (Phase 1 is pre-launch as of
2026-04-16), but the step is idempotent and safe to re-run.

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add the new column.
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )

    # 2. Migrate any bcrypt-looking values from auth_id → password_hash and
    #    clear auth_id so the column is free for Supabase UIDs.
    op.execute(
        """
        UPDATE users
           SET password_hash = auth_id,
               auth_id       = NULL
         WHERE auth_id IS NOT NULL
           AND (
                 auth_id LIKE '$2b$%'
              OR auth_id LIKE '$2a$%'
              OR auth_id LIKE '$2y$%'
           )
        """
    )


def downgrade() -> None:
    # Reverse the data migration: fold password_hash back into auth_id
    # for any row whose auth_id is currently empty. This is only safe if
    # auth_id is not in use for a Supabase UID on that row.
    op.execute(
        """
        UPDATE users
           SET auth_id       = password_hash,
               password_hash = NULL
         WHERE password_hash IS NOT NULL
           AND auth_id IS NULL
        """
    )
    op.drop_column("users", "password_hash")
