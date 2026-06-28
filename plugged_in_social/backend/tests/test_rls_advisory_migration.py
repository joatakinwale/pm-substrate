from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "018_supabase_public_rls_advisory.py"
)


def test_supabase_advisory_tables_enable_rls_and_revoke_public_api_roles() -> None:
    sql = MIGRATION.read_text()

    for table in (
        "stripe_events",
        "proposal_versions",
        "task_comments",
        "sprints",
        "task_dependencies",
    ):
        assert f'"{table}"' in sql

    assert "ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY" in sql
    assert "_revoke_from_public_api_roles(table)" in sql
    assert "REVOKE ALL ON TABLE public.{table} FROM anon" in sql
    assert "REVOKE ALL ON TABLE public.{table} FROM authenticated" in sql


def test_join_tables_have_parent_scoped_policies() -> None:
    sql = MIGRATION.read_text()

    assert "proposal_versions_org_via_proposal" in sql
    assert "p.id = proposal_versions.proposal_id" in sql
    assert "task_comments_org_via_task" in sql
    assert "t.id = task_comments.task_id" in sql
    assert "task_dependencies_org_via_tasks" in sql
    assert "d.id = task_dependencies.depends_on_task_id" in sql
    assert "sprints_org_isolation" in sql
    assert "stripe_events_internal_app_only" in sql
