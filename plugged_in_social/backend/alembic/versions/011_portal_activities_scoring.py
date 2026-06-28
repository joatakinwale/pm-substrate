"""011 — Client portal, activity tracking, lead scoring, cost tracking.

Adds:
  - portal_tokens: magic-link tokens for client portal access
  - portal_sessions: active client portal sessions
  - activities: unified activity timeline (ported from coldCallAutomated)
  - lead_scores: point-in-time lead score snapshots
  - scoring_configs: per-org scoring configuration
  - cost_entries: per-API-call cost records
  - daily_cost_summaries: daily cost rollups
  - spending_limits: per-org spending caps
  - RLS policies for all new tables

Revision ID: 011
Revises: 010
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Portal Tokens ───────────────────────────────────────────
    op.create_table(
        "portal_tokens",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("token", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("client_email", sa.String(255), nullable=False, index=True),
        sa.Column("client_name", sa.String(255)),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("is_used", sa.Boolean(), default=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── Portal Sessions ─────────────────────────────────────────
    op.create_table(
        "portal_sessions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("session_token", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("client_email", sa.String(255), nullable=False, index=True),
        sa.Column("client_name", sa.String(255)),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("token_id", UUID(as_uuid=True), sa.ForeignKey("portal_tokens.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── Activities (ported from coldCallAutomated) ──────────────
    op.create_table(
        "activities",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("activity_type", sa.String(80), nullable=False, index=True),
        sa.Column("subject_type", sa.String(50), nullable=False, index=True),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("related_type", sa.String(50)),
        sa.Column("related_id", UUID(as_uuid=True)),
        sa.Column("performed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), index=True),
        sa.Column("performed_by_name", sa.String(255)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("metadata", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_system", sa.Boolean(), default=False),
        sa.Column("is_client_visible", sa.Boolean(), default=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Compound indexes for activities (mirrors coldCallAutomated's 12 indexes)
    op.create_index(
        "ix_activities_subject_timeline",
        "activities",
        ["org_id", "subject_type", "subject_id", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_activities_type_timeline",
        "activities",
        ["org_id", "activity_type", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_activities_performer",
        "activities",
        ["org_id", "performed_by", sa.text("occurred_at DESC")],
    )

    # ── Lead Scores ─────────────────────────────────────────────
    op.create_table(
        "lead_scores",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("total_score", sa.Float(), default=0.0),
        sa.Column("confidence", sa.String(20), default="low"),
        sa.Column("demographic_score", sa.Float(), default=0.0),
        sa.Column("engagement_score", sa.Float(), default=0.0),
        sa.Column("behavioral_score", sa.Float(), default=0.0),
        sa.Column("historical_score", sa.Float(), default=0.0),
        sa.Column("weights", JSONB, server_default=sa.text("'{\"demographic\"\\:0.25,\"engagement\"\\:0.35,\"behavioral\"\\:0.25,\"historical\"\\:0.15}'::jsonb")),
        sa.Column("breakdown", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("recommended_actions", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("algorithm_version", sa.String(20), default="1.0"),
        sa.Column("trigger", sa.String(100)),
        sa.Column("scored_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index(
        "ix_lead_scores_lead_latest",
        "lead_scores",
        ["org_id", "lead_id", sa.text("scored_at DESC")],
    )

    # ── Scoring Configs ─────────────────────────────────────────
    op.create_table(
        "scoring_configs",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), default="default"),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("weights", JSONB, server_default=sa.text("'{\"demographic\"\\:0.25,\"engagement\"\\:0.35,\"behavioral\"\\:0.25,\"historical\"\\:0.15}'::jsonb")),
        sa.Column("demographic_brackets", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("engagement_rules", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("behavioral_rules", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("thresholds", JSONB, server_default=sa.text("'{\"hot\"\\:80,\"warm\"\\:50,\"cold\"\\:20}'::jsonb")),
        sa.Column("algorithm_version", sa.String(20), default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── Cost Entries ────────────────────────────────────────────
    op.create_table(
        "cost_entries",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("service", sa.String(50), nullable=False, index=True),
        sa.Column("operation", sa.String(100)),
        sa.Column("cost_cents", sa.Integer(), default=0),
        sa.Column("usage_data", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reference_type", sa.String(50)),
        sa.Column("reference_id", UUID(as_uuid=True)),
        sa.Column("triggered_by", UUID(as_uuid=True)),
        sa.Column("incurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index(
        "ix_cost_entries_org_service_date",
        "cost_entries",
        ["org_id", "service", sa.text("incurred_at DESC")],
    )

    # ── Daily Cost Summaries ────────────────────────────────────
    op.create_table(
        "daily_cost_summaries",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("summary_date", sa.Date(), nullable=False, index=True),
        sa.Column("service", sa.String(50), nullable=False, index=True),
        sa.Column("total_cost_cents", sa.Integer(), default=0),
        sa.Column("entry_count", sa.Integer(), default=0),
        sa.Column("aggregates", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index(
        "ix_daily_cost_org_date_service",
        "daily_cost_summaries",
        ["org_id", "summary_date", "service"],
        unique=True,
    )

    # ── Spending Limits ─────────────────────────────────────────
    op.create_table(
        "spending_limits",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("service", sa.String(50), default="all"),
        sa.Column("monthly_limit_cents", sa.Integer(), default=0),
        sa.Column("alert_threshold_pct", sa.Integer(), default=80),
        sa.Column("enforcement", sa.String(20), default="alert"),
        sa.Column("current_month_cents", sa.Integer(), default=0),
        sa.Column("current_month", sa.String(7)),
        sa.Column("alert_sent", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── RLS Policies ────────────────────────────────────────────
    rls_tables = [
        "portal_tokens",
        "portal_sessions",
        "activities",
        "lead_scores",
        "scoring_configs",
        "cost_entries",
        "daily_cost_summaries",
        "spending_limits",
    ]

    for table in rls_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id')::uuid)
        """)
        op.execute(f"""
            CREATE POLICY {table}_org_insert ON {table}
            FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id')::uuid)
        """)


def downgrade() -> None:
    tables = [
        "spending_limits",
        "daily_cost_summaries",
        "cost_entries",
        "scoring_configs",
        "lead_scores",
        "activities",
        "portal_sessions",
        "portal_tokens",
    ]
    for table in tables:
        op.execute(f"DROP POLICY IF EXISTS {table}_org_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table}")

    op.drop_index("ix_daily_cost_org_date_service", table_name="daily_cost_summaries")
    op.drop_index("ix_cost_entries_org_service_date", table_name="cost_entries")
    op.drop_index("ix_lead_scores_lead_latest", table_name="lead_scores")
    op.drop_index("ix_activities_performer", table_name="activities")
    op.drop_index("ix_activities_type_timeline", table_name="activities")
    op.drop_index("ix_activities_subject_timeline", table_name="activities")

    for table in tables:
        op.drop_table(table)
