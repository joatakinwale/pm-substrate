"""Phase 1 tables: leads, bookings, contacts, pages, blog_posts, analytics_daily

Revision ID: 002_phase1
Revises: 001_foundation
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ══════════════════════════════════════════════
    # LEADS
    # ══════════════════════════════════════════════
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.Text, nullable=True),
        sa.Column("revenue_range", sa.String(20), nullable=True),
        sa.Column("qualification_status", sa.String(20), server_default="new", nullable=False),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("form_responses", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("utm_source", sa.String(255), nullable=True),
        sa.Column("utm_medium", sa.String(255), nullable=True),
        sa.Column("utm_campaign", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_leads_org_id", "leads", ["org_id"])
    op.create_index("ix_leads_email", "leads", ["email"])
    op.create_index("ix_leads_qualification_status", "leads", ["qualification_status"])
    # GIN index on form_responses for JSONB containment queries
    op.execute("CREATE INDEX ix_leads_form_responses ON leads USING GIN (form_responses)")

    # ══════════════════════════════════════════════
    # BOOKINGS
    # ══════════════════════════════════════════════
    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cal_event_id", sa.String(255), unique=True, nullable=False),
        sa.Column("cal_booking_uid", sa.String(255), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer, server_default=sa.text("30"), nullable=False),
        sa.Column("timezone", sa.String(50), nullable=True),
        sa.Column("attendee_name", sa.String(255), nullable=True),
        sa.Column("attendee_email", sa.String(320), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("meeting_url", sa.Text, nullable=True),
        sa.Column("cal_payload", postgresql.JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bookings_org_id", "bookings", ["org_id"])
    op.create_index("ix_bookings_lead_id", "bookings", ["lead_id"])
    op.create_index("ix_bookings_cal_event_id", "bookings", ["cal_event_id"])
    op.create_index("ix_bookings_scheduled_at", "bookings", ["scheduled_at"])

    # ══════════════════════════════════════════════
    # CONTACTS
    # ══════════════════════════════════════════════
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String(100)), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("engagement_score", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("last_engaged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscribed", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("metadata", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_contacts_org_id", "contacts", ["org_id"])
    op.create_index("ix_contacts_email", "contacts", ["email"])
    op.execute("CREATE UNIQUE INDEX uq_contacts_org_email ON contacts (org_id, email)")
    # GIN index on tags for array containment queries
    op.execute("CREATE INDEX ix_contacts_tags ON contacts USING GIN (tags)")

    # ══════════════════════════════════════════════
    # PAGES
    # ══════════════════════════════════════════════
    op.create_table(
        "pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", postgresql.JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("meta_title", sa.String(255), nullable=True),
        sa.Column("meta_description", sa.Text, nullable=True),
        sa.Column("og_image_url", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("version", sa.Integer, server_default=sa.text("1"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("last_edited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_pages_org_id", "pages", ["org_id"])
    op.create_index("ix_pages_slug", "pages", ["slug"])
    op.execute("CREATE UNIQUE INDEX uq_pages_org_slug ON pages (org_id, slug) WHERE is_deleted = false")
    # GIN index on content for JSONB queries
    op.execute("CREATE INDEX ix_pages_content ON pages USING GIN (content)")

    # ══════════════════════════════════════════════
    # BLOG POSTS
    # ══════════════════════════════════════════════
    op.create_table(
        "blog_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("excerpt", sa.String(500), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String(100)), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("cover_image_url", sa.Text, nullable=True),
        sa.Column("meta_title", sa.String(255), nullable=True),
        sa.Column("meta_description", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer, server_default=sa.text("1"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("reading_time_minutes", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_blog_posts_org_id", "blog_posts", ["org_id"])
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"])
    op.create_index("ix_blog_posts_category", "blog_posts", ["category"])
    op.create_index("ix_blog_posts_published_at", "blog_posts", ["published_at"])
    op.create_index("ix_blog_posts_author_id", "blog_posts", ["author_id"])
    op.execute("CREATE UNIQUE INDEX uq_blog_posts_org_slug ON blog_posts (org_id, slug) WHERE is_deleted = false")
    # GIN index on tags
    op.execute("CREATE INDEX ix_blog_posts_tags ON blog_posts USING GIN (tags)")

    # ══════════════════════════════════════════════
    # ANALYTICS DAILY
    # ══════════════════════════════════════════════
    op.create_table(
        "analytics_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("metric_type", sa.String(50), nullable=False),
        sa.Column("value", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("dimensions", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_analytics_daily_org_id", "analytics_daily", ["org_id"])
    op.create_index("ix_analytics_daily_date", "analytics_daily", ["date"])
    op.create_index("ix_analytics_daily_metric_type", "analytics_daily", ["metric_type"])
    op.execute("""
        CREATE UNIQUE INDEX uq_analytics_daily_org_date_metric_dims
        ON analytics_daily (org_id, date, metric_type, dimensions)
    """)
    # GIN index on dimensions
    op.execute("CREATE INDEX ix_analytics_daily_dimensions ON analytics_daily USING GIN (dimensions)")

    # ── Add updated_at triggers for Phase 1 tables ──
    for table in ["leads", "bookings", "contacts", "pages", "blog_posts", "analytics_daily"]:
        op.execute(f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        """)


def downgrade() -> None:
    # Drop triggers
    for table in ["analytics_daily", "blog_posts", "pages", "contacts", "bookings", "leads"]:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {table}")

    # Drop tables in reverse dependency order
    op.drop_table("analytics_daily")
    op.drop_table("blog_posts")
    op.drop_table("pages")
    op.drop_table("contacts")
    op.drop_table("bookings")
    op.drop_table("leads")
