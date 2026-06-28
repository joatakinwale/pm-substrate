"""Meta (Instagram + Facebook) publisher — Graph API v19+.

Two-step flow for Instagram:
    1. POST /{ig-user-id}/media    → creates a media container
    2. POST /{ig-user-id}/media_publish → publishes the container

Single-step flow for Facebook Pages:
    POST /{page-id}/feed  (text)
    POST /{page-id}/photos (photo)
    POST /{page-id}/videos (video)

Engagement metrics come from the Insights endpoint:
    GET /{media-id}/insights?metric=impressions,reach,engagement
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings
from app.models.social_media import SocialAccount, SocialPost

from .base import (
    MetricsResult,
    Publisher,
    PublisherConfigError,
    PublisherError,
    PublishResult,
    build_platform_url,
    resolve_token,
)

logger = logging.getLogger(__name__)


class _MetaBase(Publisher):
    """Shared HTTP + error-handling logic for both IG and FB publishers."""

    GRAPH_ROOT = "https://graph.facebook.com"

    def _client(self) -> httpx.Client:
        settings = get_settings()
        if not settings.meta_app_id or not settings.meta_app_secret:
            raise PublisherConfigError(
                "Meta app credentials not configured (META_APP_ID/SECRET)"
            )
        return httpx.Client(
            base_url=f"{self.GRAPH_ROOT}/{settings.meta_graph_api_version}",
            timeout=30.0,
        )

    def _raise_for_graph(self, resp: httpx.Response, context: str) -> dict:
        """Raise PublisherError for Graph API failures with useful detail."""
        if resp.is_success:
            return resp.json()
        try:
            err = resp.json().get("error", {})
            msg = err.get("message") or resp.text[:300]
            code = err.get("code")
            subcode = err.get("error_subcode")
        except Exception:
            msg = resp.text[:300]
            code = subcode = None
        logger.error(
            "Graph API %s failed: HTTP %s code=%s sub=%s msg=%s",
            context, resp.status_code, code, subcode, msg,
        )
        raise PublisherError(f"Graph {context}: {msg}")


# ─── Instagram ──────────────────────────────────────────────────────

class InstagramPublisher(_MetaBase):
    """Instagram Business/Creator account publisher."""

    platform = "instagram"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)
        ig_user_id = account.account_id

        media_urls = post.media_urls or []
        if not media_urls:
            return PublishResult(
                success=False,
                error="Instagram posts require at least one media URL",
            )

        # Build caption = caption + hashtags
        caption = (post.caption or "").strip()
        if post.hashtags:
            tags = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )
            caption = f"{caption}\n\n{tags}" if caption else tags

        media_type = (post.media_type or "image").lower()

        with self._client() as client:
            # Step 1 — create container
            container_params: dict[str, object] = {"access_token": token, "caption": caption}

            if media_type in ("video", "reel"):
                container_params["media_type"] = "REELS" if media_type == "reel" else "VIDEO"
                container_params["video_url"] = media_urls[0]
            elif media_type == "carousel" and len(media_urls) > 1:
                # Carousels need child containers first. Keep it simple and
                # supported: create each child as IMAGE, then parent.
                child_ids: list[str] = []
                for url in media_urls[:10]:
                    r = client.post(
                        f"/{ig_user_id}/media",
                        data={
                            "access_token": token,
                            "image_url": url,
                            "is_carousel_item": "true",
                        },
                    )
                    data = self._raise_for_graph(r, "ig.media(carousel child)")
                    child_ids.append(data["id"])
                container_params["media_type"] = "CAROUSEL"
                container_params["children"] = ",".join(child_ids)
            else:
                container_params["image_url"] = media_urls[0]

            r = client.post(f"/{ig_user_id}/media", data=container_params)
            container = self._raise_for_graph(r, "ig.media(create)")
            creation_id = container["id"]

            # Step 2 — publish the container
            r = client.post(
                f"/{ig_user_id}/media_publish",
                data={"access_token": token, "creation_id": creation_id},
            )
            published = self._raise_for_graph(r, "ig.media_publish")
            media_id = published["id"]

            # Fetch permalink so we can store a deep link
            permalink: str | None = None
            try:
                r = client.get(
                    f"/{media_id}",
                    params={"access_token": token, "fields": "permalink"},
                )
                if r.is_success:
                    permalink = r.json().get("permalink")
            except Exception:
                pass

        return PublishResult(
            success=True,
            platform_post_id=media_id,
            platform_url=permalink or build_platform_url("instagram", account, media_id),
            raw_response=published,
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        with self._client() as client:
            # Insights metrics — IG exposes impressions, reach, engagement, saved...
            r = client.get(
                f"/{post.platform_post_id}/insights",
                params={
                    "access_token": token,
                    "metric": "impressions,reach,likes,comments,shares,saved",
                },
            )
            if not r.is_success:
                logger.warning("IG insights failed for %s: %s", post.id, r.text[:200])
                return MetricsResult()
            data = r.json().get("data", [])

        metrics: dict[str, int] = {}
        for entry in data:
            name = entry.get("name")
            vals = entry.get("values", [])
            if vals and isinstance(vals[0], dict):
                metrics[name] = int(vals[0].get("value") or 0)

        return MetricsResult(
            likes=metrics.get("likes", 0),
            comments=metrics.get("comments", 0),
            shares=metrics.get("shares", 0),
            impressions=metrics.get("impressions", 0),
            reach=metrics.get("reach", 0),
            raw_response={"insights": data},
        )


# ─── Facebook ───────────────────────────────────────────────────────

class FacebookPublisher(_MetaBase):
    """Facebook Page publisher."""

    platform = "facebook"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)
        page_id = account.account_id

        message = (post.caption or "").strip()
        if post.hashtags:
            tags = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )
            message = f"{message}\n\n{tags}" if message else tags

        media_urls = post.media_urls or []
        media_type = (post.media_type or "").lower()

        with self._client() as client:
            if media_type == "video" and media_urls:
                # Hosted video upload — Graph accepts file_url for non-resumable
                r = client.post(
                    f"/{page_id}/videos",
                    data={
                        "access_token": token,
                        "file_url": media_urls[0],
                        "description": message,
                    },
                )
                data = self._raise_for_graph(r, "fb.videos")
                platform_id = data.get("id", "")
            elif media_urls and media_type != "text":
                # Photo upload (single image via url)
                r = client.post(
                    f"/{page_id}/photos",
                    data={
                        "access_token": token,
                        "url": media_urls[0],
                        "caption": message,
                    },
                )
                data = self._raise_for_graph(r, "fb.photos")
                platform_id = data.get("post_id") or data.get("id") or ""
            else:
                # Text-only feed post
                r = client.post(
                    f"/{page_id}/feed",
                    data={"access_token": token, "message": message},
                )
                data = self._raise_for_graph(r, "fb.feed")
                platform_id = data.get("id", "")

        if not platform_id:
            return PublishResult(success=False, error="No post id returned", raw_response=data)

        return PublishResult(
            success=True,
            platform_post_id=platform_id,
            platform_url=build_platform_url("facebook", account, platform_id),
            raw_response=data,
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        with self._client() as client:
            # Likes/comments/shares come from edge summary; impressions from insights
            r = client.get(
                f"/{post.platform_post_id}",
                params={
                    "access_token": token,
                    "fields": "likes.summary(true),comments.summary(true),shares",
                },
            )
            base = r.json() if r.is_success else {}

            r = client.get(
                f"/{post.platform_post_id}/insights",
                params={
                    "access_token": token,
                    "metric": "post_impressions,post_impressions_unique",
                },
            )
            insights = r.json().get("data", []) if r.is_success else []

        likes = int(base.get("likes", {}).get("summary", {}).get("total_count") or 0)
        comments = int(base.get("comments", {}).get("summary", {}).get("total_count") or 0)
        shares = int(base.get("shares", {}).get("count") or 0)

        impressions = reach = 0
        for entry in insights:
            vals = entry.get("values", [])
            v = int(vals[0].get("value") or 0) if vals else 0
            if entry.get("name") == "post_impressions":
                impressions = v
            elif entry.get("name") == "post_impressions_unique":
                reach = v

        return MetricsResult(
            likes=likes,
            comments=comments,
            shares=shares,
            impressions=impressions,
            reach=reach,
            raw_response={"base": base, "insights": insights},
        )
