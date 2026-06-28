"""Media assets table for Cloudflare R2, Images, and Stream.

Revision ID: 004_media_assets
Revises: 003_rls_policies
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),

        # Asset classification
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("storage_backend", sa.String(20), nullable=False),

        # Original file info
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.BigInteger, nullable=True),

        # R2 fields
        sa.Column("r2_key", sa.String(1000), nullable=True),
        sa.Column("r2_url", sa.Text, nullable=True),

        # Cloudflare Images
        sa.Column("cf_image_id", sa.String(255), nullable=True, unique=True),

        # Cloudflare Stream
        sa.Column("cf_stream_uid", sa.String(255), nullable=True, unique=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("thumbnail_url", sa.Text, nullable=True),

        # Common fields
        sa.Column("alt_text", sa.String(500), nullable=True),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),

        # Ownership
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),

        # Usage tracking
        sa.Column("usage_context", sa.String(50), nullable=True),
        sa.Column("usage_entity_id", sa.String(255), nullable=True),

        # Metadata
        sa.Column("metadata", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),

        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Indexes
    op.create_index("ix_media_assets_org_id", "media_assets", ["org_id"])
    op.create_index("ix_media_assets_asset_type", "media_assets", ["asset_type"])
    op.create_index("ix_media_assets_r2_key", "media_assets", ["r2_key"])
    op.create_index("ix_media_assets_cf_image_id", "media_assets", ["cf_image_id"])
    op.create_index("ix_media_assets_cf_stream_uid", "media_assets", ["cf_stream_uid"])
    op.create_index("ix_media_assets_usage", "media_assets", ["usage_context", "usage_entity_id"])
    op.execute("CREATE INDEX ix_media_assets_metadata ON media_assets USING GIN (metadata)")

    # Updated_at trigger
    op.execute("""
        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON media_assets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """)

    # RLS
    op.execute("ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE media_assets FORCE ROW LEVEL SECURITY")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets TO stevie_app")

    # Bypass when no context (migrations, seed, cron)
    op.execute("""
        CREATE POLICY bypass_when_no_context ON media_assets
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

    # Org isolation
    op.execute("""
        CREATE POLICY org_isolation ON media_assets
        FOR ALL
        USING (org_id = current_user_org_id())
        WITH CHECK (org_id = current_user_org_id());
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS org_isolation ON media_assets")
    op.execute("DROP POLICY IF EXISTS bypass_when_no_context ON media_assets")
    op.execute("ALTER TABLE media_assets DISABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON media_assets FROM stevie_app")
    op.execute("DROP TRIGGER IF EXISTS set_updated_at ON media_assets")
    op.drop_table("media_assets")
