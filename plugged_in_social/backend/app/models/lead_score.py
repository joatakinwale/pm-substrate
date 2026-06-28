"""Lead scoring model — ported from coldCallAutomated.

Implements a 4-component weighted scoring algorithm:
  1. Demographic (25%) — company size, revenue range, industry fit
  2. Engagement (35%) — email opens, calls, meetings, portal visits
  3. Behavioral (25%) — proposal views, content downloads, response speed
  4. Historical (15%) — past conversion patterns, referral source quality

Ported from coldCallAutomated's ML-based lead scoring:
- Original: EnhancedLeadScoringService with insurance-specific brackets
  (AGE_SCORE_BRACKETS, INCOME_SCORE_MAP, OCCUPATION_SCORE_MAP)
- Adapted: Configurable per-org scoring weights and brackets
  stored in JSONB, no insurance-specific hardcoding

Each LeadScore record is a snapshot of a lead's score at a point in time.
The latest score is the authoritative one. Historical scores enable
trend analysis and model improvement.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


# Default scoring weights — configurable per-org via ScoringConfig
DEFAULT_WEIGHTS = {
    "demographic": 0.25,
    "engagement": 0.35,
    "behavioral": 0.25,
    "historical": 0.15,
}


class LeadScore(Base, OrgMixin, TimestampMixin):
    """Point-in-time lead score snapshot.

    Each time a lead's score is recalculated, a new LeadScore record is created.
    This preserves the full scoring history for trend analysis.
    """
    __tablename__ = "lead_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Lead reference
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), index=True
    )

    # Overall composite score (0–100)
    total_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Confidence level based on data completeness
    # low: <30% data fields populated
    # medium: 30-70% populated
    # high: >70% populated
    confidence: Mapped[str] = mapped_column(String(20), default="low")

    # 4-component breakdown (each 0–100)
    demographic_score: Mapped[float] = mapped_column(Float, default=0.0)
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0)
    behavioral_score: Mapped[float] = mapped_column(Float, default=0.0)
    historical_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Weights used for this calculation (snapshot for auditability)
    weights: Mapped[dict] = mapped_column(JSONB, default=lambda: DEFAULT_WEIGHTS.copy())

    # Detailed breakdown — factor-by-factor analysis
    # Example:
    # {
    #   "demographic": {
    #     "company_size": {"value": "50-200", "score": 80, "weight": 0.3},
    #     "revenue_range": {"value": "500k_1m", "score": 90, "weight": 0.4},
    #     "industry_fit": {"value": "technology", "score": 70, "weight": 0.3}
    #   },
    #   "engagement": {
    #     "email_opens_30d": {"value": 5, "score": 60, "weight": 0.25},
    #     "calls_30d": {"value": 2, "score": 40, "weight": 0.25},
    #     ...
    #   }
    # }
    breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)

    # AI-generated recommended actions
    # Example: ["Schedule follow-up call", "Send case study", "Offer demo"]
    recommended_actions: Mapped[list] = mapped_column(JSONB, default=list)

    # Algorithm version (for A/B testing different scoring models)
    algorithm_version: Mapped[str] = mapped_column(String(20), default="1.0")

    # Trigger that caused this recalculation
    trigger: Mapped[str | None] = mapped_column(String(100))

    # Timestamp of score calculation
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class ScoringConfig(Base, OrgMixin, TimestampMixin):
    """Per-organization scoring configuration.

    Allows each org to customize scoring weights, brackets, and thresholds.
    Replaces coldCallAutomated's hardcoded insurance-specific scoring maps.
    """
    __tablename__ = "scoring_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Config name (for A/B testing multiple configs)
    name: Mapped[str] = mapped_column(String(255), default="default")
    is_active: Mapped[bool] = mapped_column(default=True)

    # Component weights (must sum to 1.0)
    weights: Mapped[dict] = mapped_column(JSONB, default=lambda: DEFAULT_WEIGHTS.copy())

    # Demographic scoring brackets
    # Example:
    # {
    #   "revenue_range": {
    #     "under_100k": 20, "100k_500k": 40, "500k_1m": 60,
    #     "1m_5m": 80, "5m_10m": 90, "over_10m": 100
    #   },
    #   "company_size": {
    #     "1-10": 30, "11-50": 50, "51-200": 70, "201-1000": 90, "1000+": 100
    #   }
    # }
    demographic_brackets: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Engagement scoring rules
    # Example:
    # {
    #   "email_opens_30d": {"max_score": 100, "per_unit": 15},
    #   "calls_30d": {"max_score": 100, "per_unit": 25},
    #   "meetings_30d": {"max_score": 100, "per_unit": 50}
    # }
    engagement_rules: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Behavioral scoring rules
    behavioral_rules: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Score thresholds for classification
    # Example: {"hot": 80, "warm": 50, "cold": 20}
    thresholds: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {"hot": 80, "warm": 50, "cold": 20},
    )

    # Algorithm version
    algorithm_version: Mapped[str] = mapped_column(String(20), default="1.0")
