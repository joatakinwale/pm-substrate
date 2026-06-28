"""016 — Supabase integrations prep (pg_cron, Wrappers/Stripe FDW, docs table).

Preps the Postgres side for three platform integrations:

1. **pg_cron** — in-DB maintenance jobs (hard-purge soft-deleted rows,
   cleanup of old audit log entries). Does NOT replace the Cloudflare
   Worker cron — see MED-6 resolution; Worker remains authoritative for
   anything that calls application logic. pg_cron here is limited to
   pure-SQL maintenance that can safely run in-database without needing
   app state.

2. **wrappers + stripe_fdw scaffolding** — enables the Supabase Wrappers
   extension (foreign data wrappers framework). The actual Stripe FDW
   server + foreign tables are NOT created in this migration because
   they require a Stripe API key, which lives in Supabase Vault. Admin
   must run the commented SQL block in ``backend/docs/SUPABASE-
   INTEGRATIONS.md`` after inserting the key into Vault via Studio.

3. **integrations_config table** — lightweight registry of which
   external integrations this deployment has wired (Cal.com, Stripe,
   Resend, Mux, Umami, social platforms). Read by ``/api/admin/health``
   so the admin UI can show a real "connected / not connected" state
   instead of probing each service on every page load.

Cal.com is documented here because it's part of the "Supabase
integrations" bucket from a PM perspective, but technically it's a
one-way webhook consumer (Cal.com → Cloudflare Worker → FastAPI) — no
Supabase-specific setup is needed beyond the ``bookings`` table
introduced in migration 001. The row in ``integrations_config`` serves
as the single source of truth for whether the webhook is live.

IMPORTANT: Extension creation uses ``IF NOT EXISTS`` so this migration
is idempotent and safe to re-run. On local dev databases without the
Supabase extension set (plain postgres:16 in docker-compose), the
pg_cron and wrappers CREATE EXTENSION lines will error — wrapped in a
DO block that degrades gracefully when the extension is unavailable so
local dev isn't blocked. Supabase Cloud ships both by default.

Revision ID: 016
Revises: 015
Create Date: 2026-04-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ════════════════════════════════════════════════════════════════
    # 1. Extensions — idempotent, graceful degradation on plain Postgres
    # ════════════════════════════════════════════════════════════════
    # Both pg_cron and wrappers are available on Supabase Cloud but not
    # on plain postgres:16 used in docker-compose for local dev. The DO
    # block catches the "extension not available" error and logs a
    # NOTICE so alembic output stays clean on dev.
    op.execute(
        """
        DO $$
        BEGIN
          CREATE EXTENSION IF NOT EXISTS pg_cron;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'pg_cron unavailable (likely local dev) — skipping.';
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;
        EXCEPTION WHEN OTHERS THEN
          BEGIN
            -- Retry without schema override for non-Supabase installs
            CREATE EXTENSION IF NOT EXISTS wrappers;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'wrappers extension unavailable (likely local dev) — skipping.';
          END;
        END $$;
        """
    )

    # ════════════════════════════════════════════════════════════════
    # 2. integrations_config — registry of enabled external services
    # ════════════════════════════════════════════════════════════════
    # One row per integration per organization. ``enabled`` is the flip
    # the admin toggles in Studio or via /api/admin/settings; ``config``
    # holds non-secret settings (webhook URLs, event type slugs). All
    # actual secrets (API keys, webhook signing secrets) live in
    # Supabase Vault — NEVER in this table.
    op.create_table(
        "integrations_config",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kind",
            sa.String(length=50),
            nullable=False,
            comment=(
                "Integration identifier: calcom, stripe, resend, mux, umami, "
                "social_instagram, social_tiktok, social_youtube, social_linkedin, "
                "social_facebook, social_x"
            ),
        ),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "config",
            sa.dialects.postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
            comment="Non-secret configuration (webhook URLs, feature flags).",
        ),
        sa.Column(
            "last_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When /api/admin/health last successfully pinged this integration.",
        ),
        sa.Column(
            "last_error",
            sa.Text,
            nullable=True,
            comment="Last error from health check, if any. Cleared on next success.",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("org_id", "kind", name="uq_integrations_config_org_kind"),
    )
    op.create_index(
        "ix_integrations_config_org_id",
        "integrations_config",
        ["org_id"],
    )
    op.create_index(
        "ix_integrations_config_kind",
        "integrations_config",
        ["kind"],
    )

    # RLS — org-scoped, same pattern as other tables (see migration 003).
    op.execute("ALTER TABLE integrations_config ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY integrations_config_org_isolation
          ON integrations_config
          USING (org_id::text = current_setting('app.current_org_id', true));
        """
    )

    # ════════════════════════════════════════════════════════════════
    # 3. pg_cron maintenance jobs — IN-DB ONLY, no app logic
    # ════════════════════════════════════════════════════════════════
    # Wrapped in a DO block so local dev (no pg_cron) doesn't fail.
    # These jobs do pure SQL maintenance that's expensive or redundant
    # to run from the app. They do NOT duplicate anything the Cloudflare
    # Worker cron calls (MED-6 resolution).
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            -- Purge soft-deleted rows older than 90 days across all
            -- tables with is_deleted columns. Runs nightly at 03:15 UTC
            -- (off-peak). Unschedule any previous version first so
            -- reruns don't stack.
            PERFORM cron.unschedule(jobid) FROM cron.job
              WHERE jobname = 'purge_soft_deleted_90d';
            PERFORM cron.schedule(
              'purge_soft_deleted_90d',
              '15 3 * * *',
              $job$
              DO $inner$
              DECLARE
                t text;
              BEGIN
                FOR t IN
                  SELECT table_name
                  FROM information_schema.columns
                  WHERE column_name = 'is_deleted'
                    AND table_schema = 'public'
                LOOP
                  EXECUTE format(
                    'DELETE FROM public.%I WHERE is_deleted = true AND updated_at < now() - interval ''90 days''',
                    t
                  );
                END LOOP;
              END $inner$;
              $job$
            );

            -- Purge audit_log entries older than 1 year. We keep a
            -- rolling window since SOX-style retention isn't a
            -- requirement for Stevie Social; if that changes, export
            -- to cold storage BEFORE lowering this threshold.
            PERFORM cron.unschedule(jobid) FROM cron.job
              WHERE jobname = 'purge_audit_log_1y';
            PERFORM cron.schedule(
              'purge_audit_log_1y',
              '30 3 * * 0',  -- Sunday 03:30 UTC
              'DELETE FROM public.audit_log WHERE created_at < now() - interval ''1 year'';'
            );
          ELSE
            RAISE NOTICE 'pg_cron not installed — skipping maintenance job schedule.';
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Unschedule pg_cron jobs first (safe if extension absent).
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            PERFORM cron.unschedule(jobid) FROM cron.job
              WHERE jobname IN ('purge_soft_deleted_90d', 'purge_audit_log_1y');
          END IF;
        END $$;
        """
    )

    # Drop table (cascades indexes, RLS policy).
    op.drop_index("ix_integrations_config_kind", table_name="integrations_config")
    op.drop_index("ix_integrations_config_org_id", table_name="integrations_config")
    op.drop_table("integrations_config")

    # NOTE: we deliberately do NOT drop pg_cron or wrappers extensions
    # on downgrade. Other migrations or external features may depend on
    # them, and they're harmless to leave enabled.
