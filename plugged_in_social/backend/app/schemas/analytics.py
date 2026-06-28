"""Analytics schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AnalyticsResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    date: date
    metric_type: str
    value: float
    dimensions: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsSummary(BaseModel):
    """Aggregated analytics for a date range."""
    metric_type: str
    total: float
    avg: float
    min_val: float
    max_val: float
    data_points: int


class AnalyticsQuery(BaseModel):
    start_date: date
    end_date: date
    metric_type: str | None = None
    dimensions: dict | None = None
