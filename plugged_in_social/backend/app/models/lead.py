"""Lead model — intake form submissions from prospective clients."""
import enum
import uuid

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class RevenueRange(str, enum.Enum):
    """Annual revenue brackets for lead qualification."""
    UNDER_100K = "under_100k"
    R100K_500K = "100k_500k"
    R500K_1M = "500k_1m"
    R1M_5M = "1m_5m"
    R5M_PLUS = "5m_plus"


class QualificationStatus(str, enum.Enum):
    """Lead qualification pipeline stages."""
    NEW = "new"
    REVIEWING = "reviewing"
    QUALIFIED = "qualified"
    DISQUALIFIED = "disqualified"
    CONVERTED = "converted"


class Lead(TimestampMixin, OrgMixin, Base):
    """
    Captures intake form submissions. form_responses JSONB stores
    all SurveyJS answers for flexible qualification criteria.
    """

    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    # Contact info
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Qualification
    revenue_range: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    qualification_status: Mapped[str] = mapped_column(
        String(20), default=QualificationStatus.NEW.value, nullable=False,
    )
    score: Mapped[int | None] = mapped_column(
        nullable=True, comment="Auto-calculated qualification score",
    )

    # Flexible form data — full SurveyJS response payload
    form_responses: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False,
    )

    # Source tracking
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="e.g. website, referral, instagram, linkedin",
    )
    utm_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(255), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    bookings = relationship("Booking", back_populates="lead", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Lead {self.email} ({self.qualification_status})>"
