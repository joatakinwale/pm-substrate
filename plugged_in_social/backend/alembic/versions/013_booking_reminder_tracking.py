"""013 — Add reminder_sent_at to bookings for dedupe on reminder emails.

The booking-reminder cron runs hourly and scoops up every booking starting
inside the next 24h window. Without a "we already mailed this one" flag we
would re-mail the same booking every hour. ``reminder_sent_at`` is flipped
to ``now()`` just before the email is dispatched (inside the same flush
so a retry can't double-fire), and the cron's WHERE clause filters it out.

Nullable + no default so existing rows are treated as "never reminded"
and a booking already in the window will get its reminder on the first
cron tick after this migration lands. That is the correct behaviour for
bookings that pre-date this feature.

Revision ID: 013
Revises: 012
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column(
            "reminder_sent_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("bookings", "reminder_sent_at")
