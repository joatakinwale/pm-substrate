"""Media asset schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class PresignedUploadRequest(BaseModel):
    """Request a presigned URL for direct upload."""
    filename: str
    content_type: str
    asset_type: str = "image"  # image, video, document
    context: str = "general"  # blog, page, avatar, etc.


class PresignedUploadResponse(BaseModel):
    upload_url: str
    asset_id: uuid.UUID
    r2_key: str | None = None
    cf_image_id: str | None = None
    cf_stream_uid: str | None = None


class MediaAssetResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    asset_type: str
    storage_backend: str
    filename: str
    mime_type: str
    file_size: int | None
    alt_text: str | None
    caption: str | None
    width: int | None
    height: int | None
    delivery_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaAssetUpdate(BaseModel):
    alt_text: str | None = None
    caption: str | None = None
