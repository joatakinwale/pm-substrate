"""Cloudflare media services — R2, Images, and Stream.

This module provides a unified interface for uploading, managing,
and generating delivery URLs for all media assets on Cloudflare.

Architecture:
  Browser → Cloudflare Worker (presigned URL) → R2/Images/Stream
  Browser does NOT upload through FastAPI — direct to Cloudflare.
  FastAPI only creates the presigned URL and tracks the asset in Postgres.
"""
import mimetypes
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import boto3
import httpx
from botocore.config import Config as BotoConfig

from app.core.config import Settings, get_settings


# ════════════════════════════════════════════════════════════
# R2 — S3-compatible object storage
# ════════════════════════════════════════════════════════════

class R2Client:
    """Cloudflare R2 client using boto3 S3 compatibility."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.bucket = settings.r2_bucket_name
        self.public_url = settings.r2_public_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=BotoConfig(
                signature_version="s3v4",
                region_name="auto",
            ),
        )

    def generate_presigned_upload(
        self,
        key: str,
        content_type: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned PUT URL for direct browser upload.

        Args:
            key: Object key, e.g. "stevie-social/blog/2026/03/hero.jpg"
            content_type: MIME type, e.g. "image/jpeg"
            expires_in: URL validity in seconds (default 1 hour)

        Returns:
            Presigned URL string — browser PUTs directly to this URL.
        """
        return self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def generate_presigned_download(
        self,
        key: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned GET URL for private downloads."""
        return self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )

    def delete_object(self, key: str) -> None:
        """Delete an object from R2."""
        self._client.delete_object(Bucket=self.bucket, Key=key)

    def public_url_for(self, key: str) -> str:
        """Return the public CDN URL for an R2 object.

        Requires a custom domain configured on the R2 bucket
        (e.g. media.stevie.social → R2 bucket).
        """
        return f"{self.public_url}/{key}"

    async def presign_get(self, key: str, expires_in_seconds: int = 600) -> str:
        """Async wrapper around ``generate_presigned_download``.

        boto3 is sync — we delegate to a thread so we don't block the
        FastAPI event loop on the (cheap, but still I/O) signing call.
        """
        import asyncio

        return await asyncio.to_thread(
            self.generate_presigned_download, key, expires_in_seconds
        )

    @staticmethod
    def build_key(org_slug: str, context: str, filename: str) -> str:
        """Build a structured R2 key.

        Example: stevie-social/blog/2026/03/a1b2c3d4-hero.jpg
        """
        now = datetime.now(timezone.utc)
        unique = uuid.uuid4().hex[:8]
        return f"{org_slug}/{context}/{now.year}/{now.month:02d}/{unique}-{filename}"


# ════════════════════════════════════════════════════════════
# CLOUDFLARE IMAGES — on-the-fly transforms
# ════════════════════════════════════════════════════════════

@dataclass
class ImageUploadResult:
    """Result from Cloudflare Images upload."""
    cf_image_id: str
    variants: dict[str, str]  # {"public": "url", "thumbnail": "url", ...}


class CloudflareImagesClient:
    """Cloudflare Images API client for optimized image delivery."""

    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.account_id = settings.cf_account_id
        self.delivery_url = settings.cf_images_delivery_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {settings.cf_api_token}",
        }

    async def generate_direct_upload_url(
        self,
        metadata: dict | None = None,
        require_signed_urls: bool = False,
    ) -> tuple[str, str]:
        """Get a one-time upload URL — browser uploads directly to Cloudflare.

        Returns:
            (upload_url, cf_image_id) — upload URL for the browser,
            and the image ID for building delivery URLs later.
        """
        async with httpx.AsyncClient() as client:
            payload = {
                "requireSignedURLs": require_signed_urls,
            }
            if metadata:
                payload["metadata"] = metadata

            resp = await client.post(
                f"{self.BASE_URL}/accounts/{self.account_id}/images/v2/direct_upload",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()["result"]
            return data["uploadURL"], data["id"]

    async def delete_image(self, cf_image_id: str) -> None:
        """Delete an image from Cloudflare Images."""
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.BASE_URL}/accounts/{self.account_id}/images/v1/{cf_image_id}",
                headers=self._headers,
            )
            resp.raise_for_status()

    def delivery_url_for(
        self,
        cf_image_id: str,
        variant: str = "public",
    ) -> str:
        """Build a delivery URL for an image variant.

        Named variants (configured in CF dashboard):
          - public: full size, optimized
          - thumbnail: 400x300, cropped
          - hero: 1600x900, fit
          - avatar: 200x200, cropped circle

        Flexible variants (no pre-config needed):
          - w=800: scale to 800px wide
          - w=400,h=300,fit=crop: custom transform
        """
        return f"{self.delivery_url}/{cf_image_id}/{variant}"


# ════════════════════════════════════════════════════════════
# CLOUDFLARE STREAM — video hosting & transcoding
# ════════════════════════════════════════════════════════════

@dataclass
class VideoUploadResult:
    """Result from Cloudflare Stream upload."""
    cf_stream_uid: str
    playback_url: str
    thumbnail_url: str
    duration: float | None


class CloudflareStreamClient:
    """Cloudflare Stream API client for video uploads and playback."""

    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.account_id = settings.cf_account_id
        self.subdomain = settings.cf_stream_customer_subdomain
        self._headers = {
            "Authorization": f"Bearer {settings.cf_stream_api_token or settings.cf_api_token}",
        }

    async def copy_from_url(
        self,
        source_url: str,
        meta: dict | None = None,
    ) -> str:
        """Pull a file from ``source_url`` into Stream and return its UID.

        Stream fetches the URL on its own infrastructure and runs the
        full transcode pipeline. The ``meta`` dict comes back to us in
        the webhook payload — we put ``asset_id`` and ``org_id`` here so
        the webhook handler can route the ready/errored event back to
        the right MediaAsset row.

        Same idea as a "pull from URL" video ingest — POST a presigned
        R2 URL, Cloudflare Stream pulls and transcodes asynchronously.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload: dict = {"url": source_url}
            if meta:
                payload["meta"] = meta
            resp = await client.post(
                f"{self.BASE_URL}/accounts/{self.account_id}/stream/copy",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["result"]["uid"]

    async def generate_direct_upload_url(
        self,
        max_duration_seconds: int = 3600,
        metadata: dict | None = None,
    ) -> tuple[str, str]:
        """Get a one-time TUS upload URL — browser uploads directly.

        Returns:
            (upload_url, cf_stream_uid) — TUS upload endpoint,
            and the stream UID for playback URLs.
        """
        async with httpx.AsyncClient() as client:
            payload = {
                "maxDurationSeconds": max_duration_seconds,
            }
            if metadata:
                payload["meta"] = metadata

            resp = await client.post(
                f"{self.BASE_URL}/accounts/{self.account_id}/stream/direct_upload",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()["result"]
            return data["uploadURL"], data["uid"]

    async def get_video(self, cf_stream_uid: str) -> dict:
        """Get video details (duration, status, thumbnail, etc.)."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/accounts/{self.account_id}/stream/{cf_stream_uid}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()["result"]

    async def delete_video(self, cf_stream_uid: str) -> None:
        """Delete a video from Stream."""
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.BASE_URL}/accounts/{self.account_id}/stream/{cf_stream_uid}",
                headers=self._headers,
            )
            resp.raise_for_status()

    def playback_url(self, cf_stream_uid: str) -> str:
        """HLS playback URL for adaptive streaming."""
        return f"https://{self.subdomain}/{cf_stream_uid}/manifest/video.m3u8"

    def embed_url(self, cf_stream_uid: str) -> str:
        """Iframe embed URL with built-in player."""
        return f"https://{self.subdomain}/{cf_stream_uid}/iframe"

    def thumbnail_url(self, cf_stream_uid: str, time: str = "1s") -> str:
        """Thumbnail at a specific timestamp."""
        return f"https://{self.subdomain}/{cf_stream_uid}/thumbnails/thumbnail.jpg?time={time}"


# ════════════════════════════════════════════════════════════
# FACTORY — get configured clients
# ════════════════════════════════════════════════════════════

@lru_cache
def get_r2_client() -> R2Client:
    return R2Client(get_settings())


@lru_cache
def get_images_client() -> CloudflareImagesClient:
    return CloudflareImagesClient(get_settings())


@lru_cache
def get_stream_client() -> CloudflareStreamClient:
    return CloudflareStreamClient(get_settings())
