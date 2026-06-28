"""Report schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ReportSection(BaseModel):
    type: str = Field(description="kpi_grid, chart, text, comparison")
    title: str
    data: dict = {}


class ReportCreate(BaseModel):
    title: str = Field(max_length=500)
    project_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    client_name: str | None = None
    client_email: str | None = None
    cadence: str = Field(default="monthly")
    compound_phase: str | None = None
    period_start: date
    period_end: date
    sections: list[ReportSection] = []
    internal_notes: str | None = None


class ReportUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    sections: list[ReportSection] | None = None
    internal_notes: str | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    title: str
    status: str
    cadence: str
    compound_phase: str | None
    client_name: str | None
    client_email: str | None
    period_start: date
    period_end: date
    sections: list
    metrics_snapshot: dict
    pdf_url: str | None
    pdf_generated_at: datetime | None
    share_token: str
    sent_at: datetime | None
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhaseMetric(BaseModel):
    month: date
    invoice_count: int
    revenue_cents: int
    paid_count: int
    outstanding_cents: int


class PhaseDashboard(BaseModel):
    phase: str
    title: str
    description: str
    metrics_definition: list[dict]
    monthly_data: list[PhaseMetric]


class ReportScheduleResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    client_name: str
    client_email: str
    cadence: str
    compound_phase: str | None
    is_active: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
