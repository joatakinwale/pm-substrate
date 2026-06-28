"""018 — Aurinko replaces Cal.com as the booking provider.

Three new tables back the Aurinko surface:

  integration_accounts  — one row per (org, Aurinko account). Holds the
                          OAuth access token, scopes, default-for-booking
                          flag, and the webhook subscription ids we
                          created on the user's behalf so disconnect can
                          tear them down.
  booking_profiles      — per-org booking profiles. One row per Aurinko
                          profile id (1:1 ``account`` profiles or
                          n-attendee ``group`` profiles for round-robin /
                          collective availability).
  contact_syncs         — read-side cache of contacts pulled from a
                          connected mailbox. Soft-linked to leads by
                          email so reps see existing relationships.

The ``bookings`` table is reworked in place rather than replaced — the
admin dashboard, reminder cron, and email pipeline all keep working
unchanged once the column rename + new fields land:

  cal_event_id     → external_event_id
  cal_booking_uid  → external_booking_uid
  cal_payload      → external_payload
  + provider             ('calcom' for legacy rows, 'aurinko' going forward)
  + aurinko_profile_id   (FK to which booking profile produced this)
  + integration_account_id (FK to which calendar this lives on)
  + reschedule_token     (Aurinko's self-service reschedule key)

Existing Cal.com booking rows stay readable — they are just stamped
``provider='calcom'`` and lose the reschedule/cancel CTAs in the UI.

Revision ID: 018
Revises: 017
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. integration_accounts ─────────────────────────────────
    op.create_table(
        "integration_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "connected_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("provider", sa.String(32), nullable=False, server_default="aurinko"),
        # Aurinko-specific identifiers + token. We store the access token
        # as plain text to match the existing convention used by
        # SocialAccount.access_token_ref. Upgrading the entire token
        # storage layer to vault/Fernet is tracked separately and will
        # cover all token columns at once.
        sa.Column("aurinko_account_id", sa.BigInteger, nullable=False),
        sa.Column("aurinko_access_token", sa.Text, nullable=False),
        sa.Column("service_type", sa.String(32), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column(
            "scopes",
            postgresql.ARRAY(sa.String(64)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column(
            "is_default_for_booking",
            sa.Boolean,
            server_default=sa.text("false"),
            nullable=False,
        ),
        # Map of resource → Aurinko subscription id, populated when the
        # callback subscribes to /calendars/primary/events and /contacts.
        sa.Column(
            "webhook_subscription_ids",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("last_calendar_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_contacts_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disconnected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_integration_accounts_org_id", "integration_accounts", ["org_id"]
    )
    op.create_index(
        "ix_integration_accounts_aurinko_account_id",
        "integration_accounts",
        ["aurinko_account_id"],
        unique=True,
    )
    # Exactly one default-for-booking account per org. Partial unique
    # index ignores the false rows so a second account can connect
    # without lifting the flag on the first.
    op.execute(
        "CREATE UNIQUE INDEX uq_integration_accounts_default_per_org "
        "ON integration_accounts (org_id) "
        "WHERE is_default_for_booking = true AND disconnected_at IS NULL"
    )

    # ── 2. booking_profiles ─────────────────────────────────────
    op.create_table(
        "booking_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "integration_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integration_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("aurinko_profile_id", sa.BigInteger, nullable=False, unique=True),
        sa.Column("kind", sa.String(16), nullable=False, server_default="account"),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False, server_default=sa.text("30")),
        sa.Column(
            "working_hours",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "location",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("buffer_before_minutes", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("buffer_after_minutes", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_booking_profiles_org_id", "booking_profiles", ["org_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_booking_profiles_org_slug "
        "ON booking_profiles (org_id, slug) "
        "WHERE is_active = true"
    )

    # ── 3. contact_syncs ────────────────────────────────────────
    op.create_table(
        "contact_syncs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "integration_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integration_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("aurinko_contact_id", sa.String(255), nullable=False),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "data",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("updated_at_provider", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_contact_syncs_org_id", "contact_syncs", ["org_id"])
    op.create_index("ix_contact_syncs_email", "contact_syncs", ["email"])
    op.execute(
        "CREATE UNIQUE INDEX uq_contact_syncs_account_extid "
        "ON contact_syncs (integration_account_id, aurinko_contact_id)"
    )

    # ── 4. bookings — provider-neutral rename + new fields ──────
    # Rename the cal_* columns. The existing unique index on
    # cal_event_id rides along with the column rename automatically.
    op.alter_column("bookings", "cal_event_id", new_column_name="external_event_id")
    op.alter_column(
        "bookings", "cal_booking_uid", new_column_name="external_booking_uid"
    )
    op.alter_column("bookings", "cal_payload", new_column_name="external_payload")

    # Provider stamp. Existing rows are Cal.com — backfill before
    # making non-null so the cutover doesn't fail on legacy data.
    op.add_column(
        "bookings",
        sa.Column("provider", sa.String(16), nullable=True),
    )
    op.execute("UPDATE bookings SET provider = 'calcom' WHERE provider IS NULL")
    op.alter_column(
        "bookings",
        "provider",
        nullable=False,
        server_default="aurinko",
    )

    op.add_column(
        "bookings",
        sa.Column("aurinko_profile_id", sa.BigInteger, nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "integration_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integration_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "bookings",
        sa.Column("reschedule_token", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_bookings_reschedule_token",
        "bookings",
        ["reschedule_token"],
        unique=True,
        postgresql_where=sa.text("reschedule_token IS NOT NULL"),
    )

    # ── 5. calendar_events — read-cache for two-way sync ────────
    op.create_table(
        "calendar_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "integration_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("integration_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("aurinko_event_id", sa.String(255), nullable=False),
        sa.Column("calendar_id", sa.String(255), nullable=False, server_default="primary"),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("status", sa.String(32), nullable=True),
        sa.Column(
            "attendees",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "raw_payload",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_calendar_events_org_id", "calendar_events", ["org_id"])
    op.create_index("ix_calendar_events_start_at", "calendar_events", ["start_at"])
    op.execute(
        "CREATE UNIQUE INDEX uq_calendar_events_account_extid "
        "ON calendar_events (integration_account_id, aurinko_event_id)"
    )


def downgrade() -> None:
    # Reverse in opposite order to satisfy FK dependencies.
    op.drop_index("uq_calendar_events_account_extid", table_name="calendar_events")
    op.drop_index("ix_calendar_events_start_at", table_name="calendar_events")
    op.drop_index("ix_calendar_events_org_id", table_name="calendar_events")
    op.drop_table("calendar_events")

    op.drop_index("ix_bookings_reschedule_token", table_name="bookings")
    op.drop_column("bookings", "reschedule_token")
    op.drop_column("bookings", "integration_account_id")
    op.drop_column("bookings", "aurinko_profile_id")
    op.drop_column("bookings", "provider")
    op.alter_column("bookings", "external_payload", new_column_name="cal_payload")
    op.alter_column(
        "bookings", "external_booking_uid", new_column_name="cal_booking_uid"
    )
    op.alter_column("bookings", "external_event_id", new_column_name="cal_event_id")

    op.drop_index("uq_contact_syncs_account_extid", table_name="contact_syncs")
    op.drop_index("ix_contact_syncs_email", table_name="contact_syncs")
    op.drop_index("ix_contact_syncs_org_id", table_name="contact_syncs")
    op.drop_table("contact_syncs")

    op.drop_index("uq_booking_profiles_org_slug", table_name="booking_profiles")
    op.drop_index("ix_booking_profiles_org_id", table_name="booking_profiles")
    op.drop_table("booking_profiles")

    op.drop_index(
        "uq_integration_accounts_default_per_org", table_name="integration_accounts"
    )
    op.drop_index(
        "ix_integration_accounts_aurinko_account_id",
        table_name="integration_accounts",
    )
    op.drop_index(
        "ix_integration_accounts_org_id", table_name="integration_accounts"
    )
    op.drop_table("integration_accounts")
