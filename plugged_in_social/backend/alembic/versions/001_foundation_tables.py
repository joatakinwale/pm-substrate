"""Foundation tables: organizations, users, audit_log

Revision ID: 001_foundation
Revises: None
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enable pgcrypto for gen_random_uuid() ──
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ══════════════════════════════════════════════
    # ORGANIZATIONS
    # ══════════════════════════════════════════════
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("plan", sa.String(20), server_default="starter", nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("settings", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("compound_method_defaults", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    # ══════════════════════════════════════════════
    # USERS
    # ══════════════════════════════════════════════
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("auth_id", sa.String(255), unique=True, nullable=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("role", sa.String(20), server_default="viewer", nullable=False),
        sa.Column("permissions", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("version", sa.Integer, server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_org_id", "users", ["org_id"])
    op.create_index("ix_users_auth_id", "users", ["auth_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # ══════════════════════════════════════════════
    # AUDIT LOG
    # ══════════════════════════════════════════════
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=False),
        sa.Column("diff", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_log_org_id", "audit_log", ["org_id"])
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])

    # ── Auto-update updated_at trigger ──
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in ["organizations", "users"]:
        op.execute(f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        """)


def downgrade() -> None:
    # Drop triggers first
    for table in ["users", "organizations"]:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {table}")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    op.drop_table("audit_log")
    op.drop_table("users")
    op.drop_table("organizations")
