"""Analytics model — pre-aggregated daily metrics."""
import enum
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class MetricType(str, enum.Enum):
    """Types of metrics tracked daily."""
    PAGE_VIEWS = "page_views"
    UNIQUE_VISITORS = "unique_visitors"
    BOUNCE_RATE = "bounce_rate"
    AVG_SESSION_DURATION = "avg_session_duration"
    FORM_SUBMISSIONS = "form_submissions"
    BOOKING_REQUESTS = "booking_requests"
    EMAIL_SIGNUPS = "email_signups"
    BLOG_VIEWS = "blog_views"
    TOP_PAGES = "top_pages"
    REFERRER_BREAKDOWN = "referrer_breakdown"


class AnalyticsDaily(TimestampMixin, OrgMixin, Base):
    """
    Pre-aggregated daily metrics from Umami Analytics + internal events.

    One row per org/date/metric_type combo. The `dimensions` JSONB
    allows flexible breakdowns:
    - page_views + dimensions: {"page": "/about"} → per-page views
    - referrer_breakdown + dimensions: {"source": "instagram"} → per-source

    This avoids expensive real-time aggregation on the dashboard.
    """

    __tablename__ = "analytics_daily"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )

    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    metric_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )

    value: Mapped[float] = mapped_column(
        Numeric(precision=14, scale=4), nullable=False,
    )

    # Flexible dimensions for breakdowns
    dimensions: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "org_id", "date", "metric_type", "dimensions",
            name="uq_analytics_daily_org_date_metric_dims",
        ),
    )

    def __repr__(self) -> str:
        return f"<AnalyticsDaily {self.date} {self.metric_type}={self.value}>"
