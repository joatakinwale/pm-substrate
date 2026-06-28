"""Blog post schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BlogPostCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9\-]+$")
    title: str = Field(min_length=1, max_length=255)
    body: str | None = None
    excerpt: str | None = None
    category: str | None = None
    tags: list[str] = []
    cover_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    status: str = "draft"
    scheduled_for: datetime | None = None


class BlogPostUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    excerpt: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    cover_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    status: str | None = None
    scheduled_for: datetime | None = None
    version: int  # Required for optimistic locking


class BlogPostResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    slug: str
    title: str
    body: str | None
    excerpt: str | None
    category: str | None
    tags: list[str]
    cover_image_url: str | None
    meta_title: str | None
    meta_description: str | None
    status: str
    published_at: datetime | None
    scheduled_for: datetime | None
    author_id: uuid.UUID | None
    version: int
    is_deleted: bool
    reading_time_minutes: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
