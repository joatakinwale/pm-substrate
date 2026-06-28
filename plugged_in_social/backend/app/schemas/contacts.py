"""Contact schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ContactCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    tags: list[str] = []
    source: str | None = None
    metadata_: dict = Field(default={}, alias="metadata")


class ContactUpdate(BaseModel):
    full_name: str | None = None
    tags: list[str] | None = None
    engagement_score: float | None = None
    subscribed: bool | None = None
    metadata_: dict | None = Field(default=None, alias="metadata")


class BlogSubscriberCreate(BaseModel):
    org_slug: str = Field(min_length=1, max_length=100)
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=255)


class BlogSubscriberResponse(BaseModel):
    message: str


class ContactResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str | None
    tags: list[str]
    engagement_score: float | None
    subscribed: bool
    source: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
