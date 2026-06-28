"""006 — Phase 3 proposals + client onboarding tables.

Revision ID: 006
Revises: 005
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ Proposals ═══
    op.create_table(
        "proposals",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        # Client refs
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        # Metadata
        sa.Column("title", sa.String(500), server_default="Compound Method Strategy Proposal"),
        sa.Column("status", sa.String(30), server_default="draft", index=True),
        sa.Column("version", sa.Integer, server_default="1"),
        # Client info
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_email", sa.String(255), nullable=False),
        sa.Column("client_company", sa.String(255)),
        # Pricing
        sa.Column("compound_phase", sa.String(30)),
        sa.Column("total_cents", sa.Integer, server_default="0"),
        sa.Column("currency", sa.String(3), server_default="usd"),
        sa.Column("billing_interval", sa.String(10), server_default="month"),
        # 12 Compound Method blocks
        sa.Column("blocks", JSONB, server_default="[]"),
        # E-signature
        sa.Column("signature_provider", sa.String(50)),
        sa.Column("signature_request_id", sa.String(255)),
        sa.Column("signed_at", sa.DateTime(timezone=True)),
        sa.Column("signer_name", sa.String(255)),
        sa.Column("signer_ip", sa.String(50)),
        # Sharing
        sa.Column("share_token", sa.String(64), unique=True, index=True,
                  server_default=sa.text("encode(gen_random_bytes(32), 'hex')")),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        # Tracking
        sa.Column("viewed_at", sa.DateTime(timezone=True)),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        # Auto-cascade refs
        sa.Column("generated_invoice_id", UUID(as_uuid=True)),
        sa.Column("generated_project_id", UUID(as_uuid=True)),
        # Notes
        sa.Column("internal_notes", sa.Text),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Proposal Versions ═══
    op.create_table(
        "proposal_versions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("proposal_id", UUID(as_uuid=True),
                  sa.ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("blocks", JSONB, server_default="[]"),
        sa.Column("total_cents", sa.Integer, server_default="0"),
        sa.Column("change_summary", sa.Text),
        sa.Column("changed_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ Client Onboardings ═══
    op.create_table(
        "client_onboardings",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("proposal_id", UUID(as_uuid=True),
                  sa.ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), server_default="pending", index=True),
        # Step tracking
        sa.Column("intake_form_sent_at", sa.DateTime(timezone=True)),
        sa.Column("intake_form_completed_at", sa.DateTime(timezone=True)),
        sa.Column("intake_form_data", JSONB),
        sa.Column("brand_voice_sent_at", sa.DateTime(timezone=True)),
        sa.Column("brand_voice_completed_at", sa.DateTime(timezone=True)),
        sa.Column("brand_voice_data", JSONB),
        sa.Column("strategy_call_scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("strategy_call_booking_id", UUID(as_uuid=True),
                  sa.ForeignKey("bookings.id", ondelete="SET NULL")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("internal_notes", sa.Text),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ═══ RLS Policies ═══
    # Proposals
    op.execute("ALTER TABLE proposals ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY proposals_org_isolation ON proposals
        USING (org_id = current_setting('app.current_org_id')::uuid)
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON proposals TO stevie_app")

    # Client onboardings
    op.execute("ALTER TABLE client_onboardings ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY onboardings_org_isolation ON client_onboardings
        USING (org_id = current_setting('app.current_org_id')::uuid)
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON client_onboardings TO stevie_app")

    # Proposal versions (no RLS — accessed via proposal join)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_versions TO stevie_app")

    # ═══ Unique constraint: only one active proposal per lead ═══
    op.create_index(
        "ix_proposals_one_active_per_lead",
        "proposals",
        ["org_id", "lead_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('declined', 'expired')"),
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS onboardings_org_isolation ON client_onboardings")
    op.execute("DROP POLICY IF EXISTS proposals_org_isolation ON proposals")
    op.drop_table("client_onboardings")
    op.drop_table("proposal_versions")
    op.drop_table("proposals")
