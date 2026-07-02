from pathlib import Path
import re


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "025_supabase_public_rls_advisory.py"
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


def test_rls_advisory_migration_runs_after_current_agency_head() -> None:
    sql = MIGRATION.read_text()

    assert 'revision = "025"' in sql
    assert 'down_revision = "024"' in sql


def test_migration_directory_has_no_duplicate_revision_ids_or_resource_forks() -> None:
    migration_root = MIGRATION.parent
    migration_files = sorted(migration_root.glob("*.py"))

    assert not list(migration_root.glob("._*.py"))

    revision_ids: list[str] = []
    for path in migration_files:
        match = re.search(r'^revision = "([^"]+)"', path.read_text(), re.MULTILINE)
        if match:
            revision_ids.append(match.group(1))

    duplicates = {
        revision_id
        for revision_id in revision_ids
        if revision_ids.count(revision_id) > 1
    }
    assert duplicates == set()
