"""Social media, brand voice, AI content, and video schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ═══ Social Accounts ═════════════════════════════════════════

class SocialAccountCreate(BaseModel):
    platform: str
    account_name: str = Field(max_length=300)
    account_id: str = Field(max_length=300)
    profile_url: str | None = None
    avatar_url: str | None = None


class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    platform: str
    account_name: str
    account_id: str
    profile_url: str | None
    avatar_url: str | None
    is_active: bool
    token_expires_at: datetime | None
    metadata_json: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══ Social Posts ════════════════════════════════════════════

class SocialPostCreate(BaseModel):
    social_account_id: uuid.UUID
    platform: str
    caption: str | None = None
    hashtags: list[str] | None = None
    media_urls: list[str] = []
    media_type: str | None = None
    scheduled_at: datetime | None = None
    compound_phase: str | None = None
    project_id: uuid.UUID | None = None
    internal_notes: str | None = None


class SocialPostUpdate(BaseModel):
    caption: str | None = None
    hashtags: list[str] | None = None
    media_urls: list[str] | None = None
    media_type: str | None = None
    status: str | None = None
    scheduled_at: datetime | None = None
    compound_phase: str | None = None
    is_amplified: bool | None = None
    internal_notes: str | None = None


class SocialPostResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    social_account_id: uuid.UUID
    project_id: uuid.UUID | None
    platform: str
    status: str
    caption: str | None
    hashtags: list | None
    media_urls: list | None
    media_type: str | None
    scheduled_at: datetime | None
    published_at: datetime | None
    platform_post_id: str | None
    platform_url: str | None
    compound_phase: str | None
    is_amplified: bool
    likes: int
    comments: int
    shares: int
    impressions: int
    reach: int
    engagement_rate: float | None
    error_message: str | None
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══ Brand Voice ═════════════════════════════════════════════

class BrandVoiceCreate(BaseModel):
    name: str = Field(max_length=300)
    client_name: str | None = None
    lead_id: uuid.UUID | None = None
    tone_descriptors: list[str] = []
    vocabulary_preferences: dict | None = None
    example_pieces: list[str] = []
    guardrails: list[str] = []


class BrandVoiceUpdate(BaseModel):
    name: str | None = None
    client_name: str | None = None
    tone_descriptors: list[str] | None = None
    vocabulary_preferences: dict | None = None
    example_pieces: list[str] | None = None
    guardrails: list[str] | None = None
    system_prompt: str | None = None
    is_default: bool | None = None


class BrandVoiceResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    client_name: str | None
    lead_id: uuid.UUID | None
    tone_descriptors: list
    vocabulary_preferences: dict | None
    example_pieces: list
    guardrails: list
    system_prompt: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══ AI Content ══════════════════════════════════════════════

class AIContentCreate(BaseModel):
    content_type: str  # caption, blog_post, email_copy, hashtags, script
    prompt: str
    brand_voice_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    platform: str | None = None
    context: dict | None = None
    model: str = "auto"


class AIContentResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    brand_voice_id: uuid.UUID | None
    project_id: uuid.UUID | None
    content_type: str
    prompt: str
    platform: str | None
    context: dict | None
    model: str
    status: str
    generated_content: str | None
    alternatives: list | None
    input_tokens: int
    output_tokens: int
    cost_cents: int
    latency_ms: int
    rating: int | None
    feedback_note: str | None
    used_in_post_id: uuid.UUID | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIContentFeedback(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback_note: str | None = None


# ═══ Video Assets ════════════════════════════════════════════

class VideoAssetCreate(BaseModel):
    filename: str = Field(max_length=500)
    file_size_bytes: int
    mime_type: str = Field(max_length=100)
    r2_key: str = Field(max_length=1000)
    project_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    client_name: str | None = None
    campaign: str | None = None
    asset_type: str | None = None
    tags: list[str] = []


class VideoAssetUpdate(BaseModel):
    client_name: str | None = None
    campaign: str | None = None
    asset_type: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class VideoAssetResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    task_id: uuid.UUID | None
    filename: str
    file_size_bytes: int
    mime_type: str
    duration_seconds: float | None
    resolution: str | None
    r2_key: str
    r2_url: str | None
    thumbnail_url: str | None
    mux_asset_id: str | None
    mux_playback_id: str | None
    mux_status: str | None
    client_name: str | None
    campaign: str | None
    asset_type: str | None
    tags: list | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
