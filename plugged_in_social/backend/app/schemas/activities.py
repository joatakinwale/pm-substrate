"""Activity tracking schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ActivityCreate(BaseModel):
    category: str
    activity_type: str
    subject_type: str
    subject_id: uuid.UUID
    related_type: str | None = None
    related_id: uuid.UUID | None = None
    title: str = Field(max_length=500)
    description: str | None = None
    metadata: dict = {}
    is_system: bool = False
    is_client_visible: bool = False
    occurred_at: datetime | None = None


class ActivityResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    category: str
    activity_type: str
    subject_type: str
    subject_id: uuid.UUID
    related_type: str | None
    related_id: uuid.UUID | None
    performed_by: uuid.UUID | None
    performed_by_name: str | None
    title: str
    description: str | None
    metadata_: dict = Field(alias="metadata_")
    is_system: bool
    is_client_visible: bool
    occurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ActivityFilter(BaseModel):
    subject_type: str | None = None
    subject_id: uuid.UUID | None = None
    activity_type: str | None = None
    category: str | None = None
    performed_by: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
