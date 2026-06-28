"""008 — Phase 5 reporting tables + materialized view for daily analytics.

Revision ID: 008
Revises: 007
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ Client Reports ═══
    op.create_table(
        "client_reports",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), server_default="draft", index=True),
        sa.Column("cadence", sa.String(20), server_default="monthly"),
        sa.Column("compound_phase", sa.String(30)),
        sa.Column("client_name", sa.String(255)),
        sa.Column("client_email", sa.String(255)),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("sections", JSONB, server_default="[]"),
        sa.Column("metrics_snapshot", JSONB, server_default="{}"),
        sa.Column("pdf_url", sa.Text),
        sa.Column("pdf_generated_at", sa.DateTime(timezone=True)),
        sa.Column("share_token", sa.String(64), unique=True, index=True,
                  server_default=sa.text("encode(gen_random_bytes(32), 'hex')")),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("internal_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Report Schedules ═══
    op.create_table(
        "report_schedules",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_email", sa.String(255), nullable=False),
        sa.Column("cadence", sa.String(20), server_default="monthly"),
        sa.Column("compound_phase", sa.String(30)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Materialized view for phase-specific dashboard queries ═══
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_phase_metrics AS
        SELECT
            i.org_id,
            i.compound_phase,
            date_trunc('month', i.created_at)::date AS month,
            COUNT(i.id) AS invoice_count,
            SUM(i.amount_paid_cents) AS revenue_cents,
            SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
            SUM(CASE WHEN i.status IN ('open', 'past_due') THEN i.amount_due_cents ELSE 0 END) AS outstanding_cents
        FROM invoices i
        WHERE i.compound_phase IS NOT NULL
        GROUP BY i.org_id, i.compound_phase, date_trunc('month', i.created_at)::date
    """)
    op.execute("CREATE UNIQUE INDEX ON mv_phase_metrics (org_id, compound_phase, month)")

    # ═══ RLS ═══
    for table in ("client_reports", "report_schedules"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id')::uuid)
        """)
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO stevie_app")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_phase_metrics")
    for table in ("report_schedules", "client_reports"):
        op.execute(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table}")
    op.drop_table("report_schedules")
    op.drop_table("client_reports")
