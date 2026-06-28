"""Phase 7 — Video, Social Media & AI tables.

Revision ID: 010
Revises: 009
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Social Accounts ──────────────────────────────────────
    op.create_table(
        "social_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("account_name", sa.String(300), nullable=False),
        sa.Column("account_id", sa.String(300), nullable=False),
        sa.Column("profile_url", sa.String(2048)),
        sa.Column("avatar_url", sa.String(2048)),
        sa.Column("access_token_ref", sa.String(500)),
        sa.Column("refresh_token_ref", sa.String(500)),
        sa.Column("token_expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("metadata_json", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_social_accounts_platform", "social_accounts", ["org_id", "platform"])

    # ── Social Posts ─────────────────────────────────────────
    op.create_table(
        "social_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("social_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("caption", sa.Text),
        sa.Column("hashtags", postgresql.JSONB),
        sa.Column("media_urls", postgresql.JSONB, server_default="[]"),
        sa.Column("media_type", sa.String(50)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("platform_post_id", sa.String(500)),
        sa.Column("platform_url", sa.String(2048)),
        sa.Column("compound_phase", sa.String(50)),
        sa.Column("is_amplified", sa.Boolean, server_default="false"),
        sa.Column("likes", sa.Integer, server_default="0"),
        sa.Column("comments", sa.Integer, server_default="0"),
        sa.Column("shares", sa.Integer, server_default="0"),
        sa.Column("impressions", sa.Integer, server_default="0"),
        sa.Column("reach", sa.Integer, server_default="0"),
        sa.Column("engagement_rate", sa.Float),
        sa.Column("error_message", sa.Text),
        sa.Column("internal_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_social_posts_schedule", "social_posts", ["org_id", "status", "scheduled_at"])
    op.create_index("ix_social_posts_platform", "social_posts", ["social_account_id", "platform"])

    # ── Brand Voice Profiles ─────────────────────────────────
    op.create_table(
        "brand_voice_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("client_name", sa.String(300)),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("tone_descriptors", postgresql.JSONB, server_default="[]"),
        sa.Column("vocabulary_preferences", postgresql.JSONB),
        sa.Column("example_pieces", postgresql.JSONB, server_default="[]"),
        sa.Column("guardrails", postgresql.JSONB, server_default="[]"),
        sa.Column("system_prompt", sa.Text),
        sa.Column("is_default", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_brand_voice_profiles_org", "brand_voice_profiles", ["org_id"])

    # ── AI Content Requests ──────────────────────────────────
    op.create_table(
        "ai_content_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("brand_voice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("brand_voice_profiles.id", ondelete="SET NULL")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("platform", sa.String(50)),
        sa.Column("context", postgresql.JSONB),
        sa.Column("model", sa.String(100), server_default="claude-sonnet-4-20250514"),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("generated_content", sa.Text),
        sa.Column("alternatives", postgresql.JSONB),
        sa.Column("input_tokens", sa.Integer, server_default="0"),
        sa.Column("output_tokens", sa.Integer, server_default="0"),
        sa.Column("cost_cents", sa.Integer, server_default="0"),
        sa.Column("latency_ms", sa.Integer, server_default="0"),
        sa.Column("rating", sa.Integer),
        sa.Column("feedback_note", sa.Text),
        sa.Column("used_in_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("social_posts.id", ondelete="SET NULL")),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ai_content_requests_status", "ai_content_requests", ["org_id", "status"])

    # ── Video Assets ─────────────────────────────────────────
    op.create_table(
        "video_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="SET NULL")),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("duration_seconds", sa.Float),
        sa.Column("resolution", sa.String(20)),
        sa.Column("r2_key", sa.String(1000), nullable=False),
        sa.Column("r2_url", sa.String(2048)),
        sa.Column("thumbnail_url", sa.String(2048)),
        sa.Column("mux_asset_id", sa.String(500)),
        sa.Column("mux_playback_id", sa.String(500)),
        sa.Column("mux_status", sa.String(50)),
        sa.Column("client_name", sa.String(300)),
        sa.Column("campaign", sa.String(300)),
        sa.Column("asset_type", sa.String(50)),
        sa.Column("tags", postgresql.JSONB, server_default="[]"),
        sa.Column("status", sa.String(50), server_default="uploaded"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_video_assets_project", "video_assets", ["project_id"])
    op.create_index("ix_video_assets_status", "video_assets", ["org_id", "status"])

    # ── RLS ──────────────────────────────────────────────────
    for table in [
        "social_accounts", "social_posts",
        "brand_voice_profiles", "ai_content_requests",
        "video_assets",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id')::uuid)
        """)


def downgrade() -> None:
    for table in [
        "video_assets", "ai_content_requests",
        "brand_voice_profiles", "social_posts", "social_accounts",
    ]:
        op.drop_table(table)
