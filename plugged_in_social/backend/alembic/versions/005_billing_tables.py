"""005 — Phase 2 billing tables (invoices, subscriptions, stripe_events).

Revision ID: 005
Revises: 004
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ Invoices ═══
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        # Stripe refs
        sa.Column("stripe_invoice_id", sa.String(255), unique=True, index=True),
        sa.Column("stripe_customer_id", sa.String(255), index=True),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("stripe_payment_intent_id", sa.String(255)),
        sa.Column("stripe_hosted_invoice_url", sa.Text),
        sa.Column("stripe_invoice_pdf", sa.Text),
        # Internal refs
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        # Details
        sa.Column("status", sa.String(30), nullable=False, default="draft", index=True),
        sa.Column("currency", sa.String(3), nullable=False, default="usd"),
        sa.Column("subtotal_cents", sa.Integer, nullable=False, default=0),
        sa.Column("tax_cents", sa.Integer, nullable=False, default=0),
        sa.Column("total_cents", sa.Integer, nullable=False, default=0),
        sa.Column("amount_paid_cents", sa.Integer, nullable=False, default=0),
        sa.Column("amount_due_cents", sa.Integer, nullable=False, default=0),
        # Client info
        sa.Column("client_name", sa.String(255)),
        sa.Column("client_email", sa.String(255)),
        # Dates
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("period_start", sa.DateTime(timezone=True)),
        sa.Column("period_end", sa.DateTime(timezone=True)),
        # Compound Method
        sa.Column("compound_phase", sa.String(30)),
        # Content
        sa.Column("line_items", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("description", sa.Text),
        sa.Column("internal_notes", sa.Text),
        # Reminders
        sa.Column("reminder_count", sa.Integer, nullable=False, default=0),
        sa.Column("last_reminder_at", sa.DateTime(timezone=True)),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Subscriptions ═══
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        # Stripe refs
        sa.Column("stripe_subscription_id", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), index=True, nullable=False),
        sa.Column("stripe_price_id", sa.String(255)),
        sa.Column("stripe_product_id", sa.String(255)),
        # Internal refs
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        # Details
        sa.Column("status", sa.String(30), nullable=False, default="active", index=True),
        sa.Column("plan_name", sa.String(255)),
        sa.Column("amount_cents", sa.Integer, nullable=False, default=0),
        sa.Column("currency", sa.String(3), nullable=False, default="usd"),
        sa.Column("interval", sa.String(10), nullable=False, default="month"),
        sa.Column("interval_count", sa.Integer, nullable=False, default=1),
        # Client info
        sa.Column("client_name", sa.String(255)),
        sa.Column("client_email", sa.String(255)),
        # Compound Method
        sa.Column("compound_phase", sa.String(30)),
        # Dates
        sa.Column("current_period_start", sa.DateTime(timezone=True)),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("cancel_at", sa.DateTime(timezone=True)),
        sa.Column("canceled_at", sa.DateTime(timezone=True)),
        sa.Column("trial_start", sa.DateTime(timezone=True)),
        sa.Column("trial_end", sa.DateTime(timezone=True)),
        # Metadata
        sa.Column("metadata", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("internal_notes", sa.Text),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Stripe Events (idempotency log) ═══
    op.create_table(
        "stripe_events",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("stripe_event_id", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("event_type", sa.String(100), index=True, nullable=False),
        sa.Column("api_version", sa.String(20)),
        sa.Column("status", sa.String(20), nullable=False, default="processed"),
        sa.Column("payload", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ RLS policies for billing tables ═══
    # Invoices
    op.execute("ALTER TABLE invoices ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY invoices_org_isolation ON invoices
        USING (
            CASE WHEN current_setting('app.current_org_id', true) IS NULL
                 OR current_setting('app.current_org_id', true) = ''
            THEN true
            ELSE org_id = current_setting('app.current_org_id')::uuid
            END
        )
    """)
    op.execute("GRANT ALL ON invoices TO stevie_app")

    # Subscriptions
    op.execute("ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY subscriptions_org_isolation ON subscriptions
        USING (
            CASE WHEN current_setting('app.current_org_id', true) IS NULL
                 OR current_setting('app.current_org_id', true) = ''
            THEN true
            ELSE org_id = current_setting('app.current_org_id')::uuid
            END
        )
    """)
    op.execute("GRANT ALL ON subscriptions TO stevie_app")

    # Stripe events — no org isolation needed (global dedup table)
    op.execute("GRANT ALL ON stripe_events TO stevie_app")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS subscriptions_org_isolation ON subscriptions")
    op.execute("DROP POLICY IF EXISTS invoices_org_isolation ON invoices")
    op.drop_table("stripe_events")
    op.drop_table("subscriptions")
    op.drop_table("invoices")
