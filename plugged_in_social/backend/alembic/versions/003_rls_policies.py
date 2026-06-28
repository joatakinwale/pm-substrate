"""Row-Level Security policies for all tables (plain Postgres — no Supabase).

Uses PostgreSQL session variables set by FastAPI on each request:
  - app.current_org_id   (UUID string)
  - app.current_user_id  (UUID string)
  - app.current_user_role (owner|admin|editor|viewer|client)

FastAPI calls set_config('app.current_org_id', '<uuid>', true) per-transaction,
and these policies read via current_setting('app.current_org_id', true).

Revision ID: 003_rls_policies
Revises: 002_phase1
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All tables that need org_id RLS
ORG_SCOPED_TABLES = [
    "organizations",
    "users",
    "audit_log",
    "leads",
    "bookings",
    "contacts",
    "pages",
    "blog_posts",
    "analytics_daily",
]


def upgrade() -> None:
    # ══════════════════════════════════════════════
    # HELPER FUNCTIONS
    # Read org_id, user_id, role from Postgres session variables
    # set by FastAPI middleware via set_config()
    # ══════════════════════════════════════════════
    op.execute("""
        CREATE OR REPLACE FUNCTION current_user_org_id()
        RETURNS UUID AS $$
        BEGIN
            RETURN current_setting('app.current_org_id', true)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION current_user_id()
        RETURNS UUID AS $$
        BEGIN
            RETURN current_setting('app.current_user_id', true)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION current_user_role()
        RETURNS TEXT AS $$
        BEGIN
            RETURN current_setting('app.current_user_role', true);
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)

    # ══════════════════════════════════════════════
    # APP ROLE FOR RLS
    # Create a 'stevie_app' role that FastAPI connects as.
    # RLS applies to this role. The superuser/owner role
    # bypasses RLS for migrations and admin tasks.
    # ══════════════════════════════════════════════
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stevie_app') THEN
                CREATE ROLE stevie_app LOGIN;
            END IF;
        END $$;
    """)

    # Grant table access to the app role
    for table in ORG_SCOPED_TABLES:
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO stevie_app")

    # Grant sequence access (for audit_log BIGSERIAL)
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stevie_app")

    # ══════════════════════════════════════════════
    # ENABLE RLS ON ALL TABLES
    # ══════════════════════════════════════════════
    for table in ORG_SCOPED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # FORCE ensures RLS applies even to table owners
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # ══════════════════════════════════════════════
    # SUPERUSER / MIGRATION BYPASS
    # When no session context is set (Alembic, seed script, cron jobs),
    # allow full access. This is safe because only the app role
    # connects with session variables set.
    # ══════════════════════════════════════════════
    for table in ORG_SCOPED_TABLES:
        op.execute(f"""
            CREATE POLICY bypass_when_no_context ON {table}
            FOR ALL
            USING (
                current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            )
            WITH CHECK (
                current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            );
        """)

    # ══════════════════════════════════════════════
    # ORG ISOLATION POLICIES
    # Standard pattern: users can only see/modify rows in their org
    # ══════════════════════════════════════════════

    # Organizations — users see only their own org
    op.execute("""
        CREATE POLICY org_isolation ON organizations
        FOR ALL
        USING (id = current_user_org_id())
        WITH CHECK (id = current_user_org_id());
    """)

    # Users — see only users in same org
    op.execute("""
        CREATE POLICY org_isolation ON users
        FOR ALL
        USING (org_id = current_user_org_id())
        WITH CHECK (org_id = current_user_org_id());
    """)

    # Standard org isolation for Phase 1 tables
    for table in ["leads", "bookings", "contacts", "analytics_daily"]:
        op.execute(f"""
            CREATE POLICY org_isolation ON {table}
            FOR ALL
            USING (org_id = current_user_org_id())
            WITH CHECK (org_id = current_user_org_id());
        """)

    # ══════════════════════════════════════════════
    # AUDIT LOG — special rules
    # Regular users see only their own actions
    # Admins/owners see all org actions
    # No UPDATE or DELETE ever
    # ══════════════════════════════════════════════
    op.execute("""
        CREATE POLICY audit_log_select ON audit_log
        FOR SELECT
        USING (
            org_id = current_user_org_id()
            AND (
                current_user_role() IN ('owner', 'admin')
                OR user_id = current_user_id()
            )
        );
    """)

    op.execute("""
        CREATE POLICY audit_log_insert ON audit_log
        FOR INSERT
        WITH CHECK (org_id = current_user_org_id());
    """)

    # No update/delete policies — audit log is immutable

    # ══════════════════════════════════════════════
    # CONTENT WRITE RESTRICTIONS
    # Pages + blog posts: only admin/owner/editor can write
    # All org members can read
    # ══════════════════════════════════════════════
    for table in ["pages", "blog_posts"]:
        # Anyone in the org can read
        op.execute(f"""
            CREATE POLICY {table}_select ON {table}
            FOR SELECT
            USING (org_id = current_user_org_id());
        """)

        # Only admin/owner/editor can insert
        op.execute(f"""
            CREATE POLICY {table}_insert ON {table}
            FOR INSERT
            WITH CHECK (
                org_id = current_user_org_id()
                AND current_user_role() IN ('owner', 'admin', 'editor')
            );
        """)

        # Only admin/owner/editor can update
        op.execute(f"""
            CREATE POLICY {table}_update ON {table}
            FOR UPDATE
            USING (
                org_id = current_user_org_id()
                AND current_user_role() IN ('owner', 'admin', 'editor')
            )
            WITH CHECK (
                org_id = current_user_org_id()
                AND current_user_role() IN ('owner', 'admin', 'editor')
            );
        """)

        # Only admin/owner can delete (soft delete)
        op.execute(f"""
            CREATE POLICY {table}_delete ON {table}
            FOR DELETE
            USING (
                org_id = current_user_org_id()
                AND current_user_role() IN ('owner', 'admin')
            );
        """)


def downgrade() -> None:
    # Drop all policies
    for table in ORG_SCOPED_TABLES:
        op.execute(f"DROP POLICY IF EXISTS bypass_when_no_context ON {table}")
        op.execute(f"DROP POLICY IF EXISTS org_isolation ON {table}")

    for table in ["pages", "blog_posts"]:
        op.execute(f"DROP POLICY IF EXISTS {table}_select ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_update ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_delete ON {table}")

    op.execute("DROP POLICY IF EXISTS audit_log_select ON audit_log")
    op.execute("DROP POLICY IF EXISTS audit_log_insert ON audit_log")

    # Disable RLS
    for table in ORG_SCOPED_TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Revoke app role permissions
    for table in ORG_SCOPED_TABLES:
        op.execute(f"REVOKE ALL ON {table} FROM stevie_app")
    op.execute("REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM stevie_app")

    # Drop helper functions
    op.execute("DROP FUNCTION IF EXISTS current_user_role()")
    op.execute("DROP FUNCTION IF EXISTS current_user_id()")
    op.execute("DROP FUNCTION IF EXISTS current_user_org_id()")
