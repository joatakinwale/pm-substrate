"""Cost tracking schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel


class CostEntryResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    service: str
    operation: str | None
    cost_cents: int
    usage_data: dict
    reference_type: str | None
    reference_id: uuid.UUID | None
    triggered_by: uuid.UUID | None
    incurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class CostSummaryResponse(BaseModel):
    """Aggregated cost data for dashboard display."""
    total_cost_cents: int
    by_service: list[dict]  # [{service, total_cents, count}]
    period_start: date
    period_end: date


class DailyCostResponse(BaseModel):
    summary_date: date
    service: str
    total_cost_cents: int
    entry_count: int
    aggregates: dict

    model_config = {"from_attributes": True}


class SpendingLimitCreate(BaseModel):
    service: str = "all"
    monthly_limit_cents: int
    alert_threshold_pct: int = 80
    enforcement: str = "alert"


class SpendingLimitResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    service: str
    monthly_limit_cents: int
    alert_threshold_pct: int
    enforcement: str
    current_month_cents: int
    current_month: str | None
    alert_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SpendingLimitUpdate(BaseModel):
    monthly_limit_cents: int | None = None
    alert_threshold_pct: int | None = None
    enforcement: str | None = None
