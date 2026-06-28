"""Page schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PageCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9\-]+$")
    title: str = Field(min_length=1, max_length=255)
    content: dict | list = []
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None
    status: str = "draft"


class PageUpdate(BaseModel):
    title: str | None = None
    content: dict | list | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    og_image_url: str | None = None
    status: str | None = None
    version: int  # Required for optimistic locking


class PageResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    slug: str
    title: str
    content: dict | list
    meta_title: str | None
    meta_description: str | None
    og_image_url: str | None
    status: str
    version: int
    is_deleted: bool
    last_edited_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
