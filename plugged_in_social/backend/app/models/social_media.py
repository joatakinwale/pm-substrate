"""Phase 7 — Video, Social Media & AI models.

Covers social media accounts, scheduled posts, AI content generation
with brand voice profiles, and video asset metadata.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


# ═══ Enums ═══════════════════════════════════════════════════

class SocialPlatform(str, enum.Enum):
    instagram = "instagram"
    facebook = "facebook"
    tiktok = "tiktok"
    linkedin = "linkedin"
    youtube = "youtube"
    pinterest = "pinterest"
    x = "x"


class PostStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class AIContentStatus(str, enum.Enum):
    pending = "pending"
    generating = "generating"
    completed = "completed"
    approved = "approved"
    rejected = "rejected"
    failed = "failed"


# ═══ Social Media Accounts ═══════════════════════════════════

class SocialAccount(Base, OrgMixin, TimestampMixin):
    """Connected social media account with OAuth tokens."""

    __tablename__ = "social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    account_name: Mapped[str] = mapped_column(String(300), nullable=False)
    account_id: Mapped[str] = mapped_column(String(300), nullable=False)
    profile_url: Mapped[str | None] = mapped_column(String(2048))
    avatar_url: Mapped[str | None] = mapped_column(String(2048))
    # Encrypted OAuth tokens stored in Vault/secrets manager — ref only
    access_token_ref: Mapped[str | None] = mapped_column(String(500))
    refresh_token_ref: Mapped[str | None] = mapped_column(String(500))
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    metadata_json: Mapped[dict | None] = mapped_column(JSONB)
    # follower counts, page_id for Facebook, etc.

    __table_args__ = (
        Index("ix_social_accounts_platform", "org_id", "platform"),
    )


# ═══ Social Posts ════════════════════════════════════════════

class SocialPost(Base, OrgMixin, TimestampMixin):
    """Scheduled or published social media post."""

    __tablename__ = "social_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL")
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="draft", server_default="draft"
    )

    # Content
    caption: Mapped[str | None] = mapped_column(Text)
    hashtags: Mapped[list | None] = mapped_column(JSONB)
    # Media attachments — R2 URLs
    media_urls: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    media_type: Mapped[str | None] = mapped_column(String(50))
    # image, video, carousel, reel, story

    # Scheduling
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    platform_post_id: Mapped[str | None] = mapped_column(String(500))
    platform_url: Mapped[str | None] = mapped_column(String(2048))

    # Compound Method
    compound_phase: Mapped[str | None] = mapped_column(String(50))
    is_amplified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Only organically proven content enters Amplify phase

    # Virtual Agency
    created_by_agent: Mapped[str | None] = mapped_column(String(50))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    scheduled_content_hash: Mapped[str | None] = mapped_column(String(64))
    published_content_hash: Mapped[str | None] = mapped_column(String(64))

    # Engagement (updated by nightly aggregation)
    likes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    comments: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    shares: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    impressions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    reach: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    engagement_rate: Mapped[float | None] = mapped_column(Float)

    error_message: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_social_posts_schedule", "org_id", "status", "scheduled_at"),
        Index("ix_social_posts_platform", "social_account_id", "platform"),
    )


# ═══ Brand Voice Profiles ═══════════════════════════════════

class BrandVoiceProfile(Base, OrgMixin, TimestampMixin):
    """Per-client brand voice profile for AI content generation."""

    __tablename__ = "brand_voice_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(300))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )
    # Voice attributes
    tone_descriptors: Mapped[list] = mapped_column(JSONB, server_default="[]")
    # ["confident", "warm", "authoritative"]
    vocabulary_preferences: Mapped[dict | None] = mapped_column(JSONB)
    # {"use": ["community", "alignment"], "avoid": ["followers", "engagement hack"]}
    example_pieces: Mapped[list] = mapped_column(JSONB, server_default="[]")
    # Array of 3-5 example content pieces for few-shot prompting
    guardrails: Mapped[list] = mapped_column(JSONB, server_default="[]")
    # ["Never use competitor names", "Always include CTA"]
    system_prompt: Mapped[str | None] = mapped_column(Text)
    # Compiled system prompt for Claude
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    __table_args__ = (
        Index("ix_brand_voice_profiles_org", "org_id"),
    )


# ═══ AI Content Generation ═══════════════════════════════════

class AIContentRequest(Base, OrgMixin, TimestampMixin):
    """AI-generated content request and result."""

    __tablename__ = "ai_content_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    brand_voice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brand_voice_profiles.id", ondelete="SET NULL")
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL")
    )
    # Request
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # caption, blog_post, email_copy, hashtags, script
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str | None] = mapped_column(String(50))
    context: Mapped[dict | None] = mapped_column(JSONB)
    # Additional context: campaign info, target audience, etc.

    # Generation
    model: Mapped[str] = mapped_column(
        String(100), default="", server_default=""
    )
    status: Mapped[str] = mapped_column(
        String(50), default="pending", server_default="pending"
    )
    generated_content: Mapped[str | None] = mapped_column(Text)
    alternatives: Mapped[list | None] = mapped_column(JSONB)
    # Alternative versions generated

    # Usage tracking
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cost_cents: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Feedback
    rating: Mapped[int | None] = mapped_column(Integer)
    # 1 (thumbs down) or 5 (thumbs up)
    feedback_note: Mapped[str | None] = mapped_column(Text)
    used_in_post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("social_posts.id", ondelete="SET NULL")
    )

    error_message: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_ai_content_requests_status", "org_id", "status"),
    )


# ═══ Video Assets (R2 + Cloudflare Stream metadata) ════════

class VideoAsset(Base, OrgMixin, TimestampMixin):
    """Video file stored in R2 with Cloudflare Stream playback metadata.

    The legacy ``mux_*`` columns are kept (no migration to rename) and
    repurposed where useful — ``mux_status`` doubles as a free-form
    status hint that the Stream webhook handler stamps with
    ``ready`` / ``errored: <msg>`` / ``deleted``. ``mux_asset_id`` and
    ``mux_playback_id`` are unused for new uploads. The
    ``MediaAsset`` model is the canonical home for the Cloudflare Stream
    UID (``cf_stream_uid``); existing call sites also stamp the UID on
    this row at ingest time when the column is present.
    """

    __tablename__ = "video_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL")
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL")
    )
    # File info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    resolution: Mapped[str | None] = mapped_column(String(20))  # "1920x1080"

    # Storage
    r2_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    r2_url: Mapped[str | None] = mapped_column(String(2048))
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048))

    # Legacy video-streaming columns (column names predate the
    # Cloudflare Stream cutover; kept to avoid a rename migration).
    # ``mux_status`` is repurposed as a free-form status hint by the
    # Stream webhook (ready | errored: <msg> | deleted).
    mux_asset_id: Mapped[str | None] = mapped_column(String(500))
    mux_playback_id: Mapped[str | None] = mapped_column(String(500))
    mux_status: Mapped[str | None] = mapped_column(String(50))

    # Organization
    client_name: Mapped[str | None] = mapped_column(String(300))
    campaign: Mapped[str | None] = mapped_column(String(300))
    asset_type: Mapped[str | None] = mapped_column(String(50))
    # raw, edited, final
    tags: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    status: Mapped[str] = mapped_column(
        String(50), default="uploaded", server_default="uploaded"
    )
    # uploaded → processing → ready → archived

    __table_args__ = (
        Index("ix_video_assets_project", "project_id"),
        Index("ix_video_assets_status", "org_id", "status"),
    )
