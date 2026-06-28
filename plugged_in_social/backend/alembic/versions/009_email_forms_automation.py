"""Phase 6 — Email Marketing, Forms & Automation tables.

Revision ID: 009
Revises: 008
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Email Templates ──────────────────────────────────────
    op.create_table(
        "email_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("subject", sa.String(500)),
        sa.Column("category", sa.String(50), server_default="marketing"),
        sa.Column("html_body", sa.Text),
        sa.Column("compiled_html", sa.Text),
        sa.Column("design_json", postgresql.JSONB),
        sa.Column("variables", postgresql.JSONB, server_default="[]"),
        sa.Column("thumbnail_url", sa.String(2048)),
        sa.Column("is_default", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── Automations (created before forms due to FK) ─────────
    op.create_table(
        "automations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("trigger_type", sa.String(50), server_default="manual"),
        sa.Column("trigger_config", postgresql.JSONB),
        sa.Column("steps", postgresql.JSONB, server_default="[]", nullable=False),
        sa.Column("total_runs", sa.Integer, server_default="0"),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("internal_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_automations_status", "automations", ["org_id", "status"])

    # ── Email Campaigns ──────────────────────────────────────
    op.create_table(
        "email_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("subject", sa.String(500)),
        sa.Column("preview_text", sa.String(300)),
        sa.Column("from_name", sa.String(200)),
        sa.Column("from_email", sa.String(300)),
        sa.Column("reply_to", sa.String(300)),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("email_templates.id", ondelete="SET NULL")),
        sa.Column("html_body", sa.Text),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("audience_filter", postgresql.JSONB),
        sa.Column("recipient_count", sa.Integer, server_default="0"),
        sa.Column("compound_phase", sa.String(50)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("ab_test", postgresql.JSONB),
        sa.Column("total_sent", sa.Integer, server_default="0"),
        sa.Column("total_delivered", sa.Integer, server_default="0"),
        sa.Column("total_opened", sa.Integer, server_default="0"),
        sa.Column("total_clicked", sa.Integer, server_default="0"),
        sa.Column("total_bounced", sa.Integer, server_default="0"),
        sa.Column("total_unsubscribed", sa.Integer, server_default="0"),
        sa.Column("internal_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_email_campaigns_status", "email_campaigns", ["org_id", "status"])

    # ── Email Sends (per-recipient) ──────────────────────────
    op.create_table(
        "email_sends",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(300), nullable=False),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("ses_message_id", sa.String(500)),
        sa.Column("opened_at", sa.DateTime(timezone=True)),
        sa.Column("clicked_at", sa.DateTime(timezone=True)),
        sa.Column("bounced_at", sa.DateTime(timezone=True)),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_email_sends_campaign", "email_sends", ["campaign_id", "contact_id"])
    op.create_index("ix_email_sends_ses", "email_sends", ["ses_message_id"])

    # ── Form Definitions ─────────────────────────────────────
    op.create_table(
        "form_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("schema_json", postgresql.JSONB, server_default="{}", nullable=False),
        sa.Column("theme_json", postgresql.JSONB),
        sa.Column("notify_emails", postgresql.JSONB),
        sa.Column("success_message", sa.Text),
        sa.Column("redirect_url", sa.String(2048)),
        sa.Column("automation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("automations.id", ondelete="SET NULL")),
        sa.Column("submission_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_form_definitions_slug", "form_definitions", ["org_id", "slug"], unique=True)

    # ── Form Submissions ─────────────────────────────────────
    op.create_table(
        "form_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("form_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        sa.Column("data", postgresql.JSONB, server_default="{}", nullable=False),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_form_submissions_form", "form_submissions", ["form_id"])

    # ── Automation Runs ──────────────────────────────────────
    op.create_table(
        "automation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("automation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("automations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        sa.Column("trigger_event", sa.String(100)),
        sa.Column("status", sa.String(50), server_default="running"),
        sa.Column("steps_completed", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text),
        sa.Column("execution_log", postgresql.JSONB),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_automation_runs_automation", "automation_runs", ["automation_id"])

    # ── RLS policies ─────────────────────────────────────────
    for table in [
        "email_templates", "email_campaigns", "email_sends",
        "form_definitions", "form_submissions",
        "automations", "automation_runs",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id')::uuid)
        """)


def downgrade() -> None:
    for table in [
        "automation_runs", "automations",
        "form_submissions", "form_definitions",
        "email_sends", "email_campaigns", "email_templates",
    ]:
        op.drop_table(table)
