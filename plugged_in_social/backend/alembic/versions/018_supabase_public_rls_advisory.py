"""018 — Enable RLS on public tables flagged by Supabase advisor.

Supabase exposes the ``public`` schema through the Data API by default on
older projects, so every public table needs RLS even when application access
normally flows through FastAPI. These five tables were previously protected
only by app-level parent lookups or internal-only routing:

- stripe_events
- proposal_versions
- task_comments
- sprints
- task_dependencies

Revision ID: 018
Revises: 017
"""
from alembic import op


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


ADVISORY_TABLES = (
    "stripe_events",
    "proposal_versions",
    "task_comments",
    "sprints",
    "task_dependencies",
)


def _revoke_from_public_api_roles(table: str) -> None:
    """Remove direct Supabase Data API access when roles exist locally."""
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regrole('anon') IS NOT NULL THEN
                EXECUTE 'REVOKE ALL ON TABLE public.{table} FROM anon';
            END IF;
            IF to_regrole('authenticated') IS NOT NULL THEN
                EXECUTE 'REVOKE ALL ON TABLE public.{table} FROM authenticated';
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stevie_app') THEN
                CREATE ROLE stevie_app LOGIN;
            END IF;
        END $$;
        """
    )

    for table in ADVISORY_TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        _revoke_from_public_api_roles(table)

    # Internal Stripe webhook idempotency log. No anonymous/authenticated API
    # role gets table grants; FastAPI's DB role can manage the log.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_events TO stevie_app")
    op.execute("DROP POLICY IF EXISTS stripe_events_internal_app_only ON public.stripe_events")
    op.execute(
        """
        CREATE POLICY stripe_events_internal_app_only
        ON public.stripe_events
        FOR ALL
        TO stevie_app
        USING (true)
        WITH CHECK (true)
        """
    )

    # Proposal versions inherit tenant ownership from proposals.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_versions TO stevie_app")
    op.execute("DROP POLICY IF EXISTS proposal_versions_org_via_proposal ON public.proposal_versions")
    op.execute(
        """
        CREATE POLICY proposal_versions_org_via_proposal
        ON public.proposal_versions
        FOR ALL
        TO stevie_app
        USING (
            EXISTS (
                SELECT 1
                FROM proposals p
                WHERE p.id = proposal_versions.proposal_id
                  AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1
                FROM proposals p
                WHERE p.id = proposal_versions.proposal_id
                  AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        """
    )

    # Comments inherit tenant ownership from their parent task.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO stevie_app")
    op.execute("DROP POLICY IF EXISTS task_comments_org_via_task ON public.task_comments")
    op.execute(
        """
        CREATE POLICY task_comments_org_via_task
        ON public.task_comments
        FOR ALL
        TO stevie_app
        USING (
            EXISTS (
                SELECT 1
                FROM tasks t
                WHERE t.id = task_comments.task_id
                  AND t.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1
                FROM tasks t
                WHERE t.id = task_comments.task_id
                  AND t.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        """
    )

    # Sprints have their own org_id and should match the project/task pattern.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprints TO stevie_app")
    op.execute("DROP POLICY IF EXISTS sprints_org_isolation ON public.sprints")
    op.execute(
        """
        CREATE POLICY sprints_org_isolation
        ON public.sprints
        FOR ALL
        TO stevie_app
        USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
        WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
        """
    )

    # Dependency edges inherit tenant ownership from both task endpoints.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_dependencies TO stevie_app")
    op.execute("DROP POLICY IF EXISTS task_dependencies_org_via_tasks ON public.task_dependencies")
    op.execute(
        """
        CREATE POLICY task_dependencies_org_via_tasks
        ON public.task_dependencies
        FOR ALL
        TO stevie_app
        USING (
            EXISTS (
                SELECT 1
                FROM tasks t
                WHERE t.id = task_dependencies.task_id
                  AND t.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
            AND EXISTS (
                SELECT 1
                FROM tasks d
                WHERE d.id = task_dependencies.depends_on_task_id
                  AND d.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1
                FROM tasks t
                WHERE t.id = task_dependencies.task_id
                  AND t.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
            AND EXISTS (
                SELECT 1
                FROM tasks d
                WHERE d.id = task_dependencies.depends_on_task_id
                  AND d.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS task_dependencies_org_via_tasks ON public.task_dependencies")
    op.execute("DROP POLICY IF EXISTS sprints_org_isolation ON public.sprints")
    op.execute("DROP POLICY IF EXISTS task_comments_org_via_task ON public.task_comments")
    op.execute("DROP POLICY IF EXISTS proposal_versions_org_via_proposal ON public.proposal_versions")
    op.execute("DROP POLICY IF EXISTS stripe_events_internal_app_only ON public.stripe_events")

    for table in ADVISORY_TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
