"""Lead schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LeadCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    company: str | None = None
    phone: str | None = None
    website: str | None = None
    revenue_range: str | None = None
    source: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    form_responses: dict = {}
    notes: str | None = None


class LeadUpdate(BaseModel):
    full_name: str | None = None
    company: str | None = None
    phone: str | None = None
    website: str | None = None
    revenue_range: str | None = None
    qualification_status: str | None = None
    score: int | None = None
    notes: str | None = None
    form_responses: dict | None = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str
    company: str | None
    phone: str | None
    website: str | None
    revenue_range: str | None
    qualification_status: str
    score: int | None
    source: str | None
    form_responses: dict
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
