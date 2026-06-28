"""Lead scoring schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LeadScoreResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    total_score: float
    confidence: str
    demographic_score: float
    engagement_score: float
    behavioral_score: float
    historical_score: float
    weights: dict
    breakdown: dict
    recommended_actions: list
    algorithm_version: str
    trigger: str | None
    scored_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ScoreRecalcRequest(BaseModel):
    """Request to recalculate a lead's score."""
    trigger: str = "manual"


class ScoringConfigCreate(BaseModel):
    name: str = "default"
    weights: dict = Field(
        default_factory=lambda: {
            "demographic": 0.25,
            "engagement": 0.35,
            "behavioral": 0.25,
            "historical": 0.15,
        }
    )
    demographic_brackets: dict = {}
    engagement_rules: dict = {}
    behavioral_rules: dict = {}
    thresholds: dict = Field(
        default_factory=lambda: {"hot": 80, "warm": 50, "cold": 20}
    )


class ScoringConfigResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    is_active: bool
    weights: dict
    demographic_brackets: dict
    engagement_rules: dict
    behavioral_rules: dict
    thresholds: dict
    algorithm_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ScoringConfigUpdate(BaseModel):
    name: str | None = None
    weights: dict | None = None
    demographic_brackets: dict | None = None
    engagement_rules: dict | None = None
    behavioral_rules: dict | None = None
    thresholds: dict | None = None
    is_active: bool | None = None
