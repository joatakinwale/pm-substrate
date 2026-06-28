from pathlib import Path

from app.models.social_media import AIContentRequest
from app.schemas.social_media import AIContentCreate


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "019_ai_content_auto_model_default.py"
)


def test_create_schema_defaults_to_auto_routing() -> None:
    request = AIContentCreate(content_type="caption", prompt="Draft launch copy")

    assert request.model == "auto"


def test_model_column_default_defers_to_backend_auto_chain() -> None:
    column = AIContentRequest.__table__.c.model

    assert column.default is not None
    assert column.default.arg == ""
    assert column.server_default is not None
    assert column.server_default.arg == ""


def test_migration_updates_server_default_to_auto_sentinel() -> None:
    sql = MIGRATION.read_text()

    assert 'server_default=""' in sql
    assert 'server_default="claude-sonnet-4-6"' in sql
