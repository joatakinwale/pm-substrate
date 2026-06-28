"""Media asset model — tracks files across Cloudflare R2, Images, and Stream.

Every uploaded file (image, video, document) gets a record here.
The actual bytes live on Cloudflare; this table tracks metadata,
ownership, and the delivery URLs.
"""
import enum
import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class StorageBackend(str, enum.Enum):
    """Where the file physically lives."""
    R2 = "r2"                    # Cloudflare R2 — general objects
    CF_IMAGES = "cf_images"      # Cloudflare Images — optimized images
    CF_STREAM = "cf_stream"      # Cloudflare Stream — video


class AssetType(str, enum.Enum):
    """Logical type of the asset."""
    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    AUDIO = "audio"
    OTHER = "other"


class MediaAsset(TimestampMixin, OrgMixin, Base):
    """
    Central registry for all uploaded media.

    Flow:
      1. Client requests a presigned upload URL from FastAPI
      2. Client uploads directly to R2/Images/Stream (bypasses origin)
      3. Cloudflare Worker or webhook confirms upload
      4. FastAPI creates this record with the delivery URLs

    For images, cf_image_id enables on-the-fly transforms:
      https://imagedelivery.net/<hash>/<cf_image_id>/public
      https://imagedelivery.net/<hash>/<cf_image_id>/thumbnail
      https://imagedelivery.net/<hash>/<cf_image_id>/w=800

    For videos, cf_stream_uid enables adaptive streaming:
      https://customer-<code>.cloudflarestream.com/<cf_stream_uid>/manifest/video.m3u8
    """

    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # What kind of asset and where it lives
    asset_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True,
    )
    storage_backend: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="r2 | cf_images | cf_stream",
    )

    # Original file info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="e.g. image/jpeg, video/mp4",
    )
    file_size: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
        comment="Size in bytes",
    )

    # ── R2 fields ──
    r2_key: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, index=True,
        comment="R2 object key, e.g. org-slug/blog/2026/03/hero.jpg",
    )
    r2_url: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Public R2 URL via custom domain",
    )

    # ── Cloudflare Images fields ──
    cf_image_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True,
        comment="Cloudflare Images UUID — used for variant URLs",
    )

    # ── Cloudflare Stream fields ──
    cf_stream_uid: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True,
        comment="Cloudflare Stream video UID",
    )
    duration_seconds: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Video duration from Stream API",
    )
    thumbnail_url: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Auto-generated video thumbnail from Stream",
    )

    # ── Common fields ──
    alt_text: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="Accessibility alt text for images",
    )
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Image dimensions (from Images API or metadata)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Who uploaded it
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Usage tracking — which entity is using this asset
    # Allows an asset to be reused across blog posts, pages, etc.
    usage_context: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="blog_post | page | portfolio | profile",
    )
    usage_entity_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="UUID of the entity using this asset",
    )

    # Flexible metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb"), nullable=False,
        comment="EXIF data, color palette, focal point, etc.",
    )

    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<MediaAsset {self.filename} ({self.storage_backend})>"

    @property
    def delivery_url(self) -> str | None:
        """Returns the best public URL for this asset.

        Resolves the storage backend to a real https:// URL the browser
        can render. The previous version returned ``cf-images://<id>``
        placeholder strings that no <img> tag could resolve, which is
        why uploaded logos never appeared on the public portal.

        For R2 assets, ``request_upload`` only stores ``r2_key`` (the
        bucket path) — never the public URL. We derive the URL here
        from ``r2_key + R2_PUBLIC_URL`` so callers don't have to know
        about the upload-flow asymmetry.
        """
        from app.core.config import get_settings

        settings = get_settings()

        if self.cf_image_id:
            base = (settings.cf_images_delivery_url or "").rstrip("/")
            account_hash = settings.cf_images_account_hash
            if base:
                return f"{base}/{self.cf_image_id}/public"
            if account_hash:
                return (
                    f"https://imagedelivery.net/{account_hash}"
                    f"/{self.cf_image_id}/public"
                )
            # Fall through — caller will get None and surface a config error.
            return None

        if self.cf_stream_uid:
            subdomain = settings.cf_stream_customer_subdomain
            if subdomain:
                return (
                    f"https://{subdomain}.cloudflarestream.com"
                    f"/{self.cf_stream_uid}/manifest/video.m3u8"
                )
            return None

        # R2: prefer an explicit r2_url (set by older flows or on backfill),
        # but most rows only have r2_key + R2_PUBLIC_URL — derive the URL
        # so freshly-uploaded blog covers and logos render the moment the
        # presigned PUT completes.
        if self.r2_url:
            return self.r2_url
        if self.r2_key:
            base = (settings.r2_public_url or "").rstrip("/")
            if base:
                return f"{base}/{self.r2_key.lstrip('/')}"
        return None
