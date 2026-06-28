"""TikTok publisher — Content Posting API.

Uses the two-step pull-from-URL flow:
    1. POST /v2/post/publish/video/init/   → returns publish_id
    2. Poll   /v2/post/publish/status/fetch/ → returns publicly_available_post_id

The publisher returns as soon as step 1 succeeds and records the publish_id
as ``platform_post_id``. A later metrics fetch resolves the real post id
via the status endpoint.

Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
"""

from __future__ import annotations

import logging

import httpx

from app.models.social_media import SocialAccount, SocialPost

from .base import (
    MetricsResult,
    Publisher,
    PublisherError,
    PublishResult,
    build_platform_url,
    resolve_token,
)

logger = logging.getLogger(__name__)

API_ROOT = "https://open.tiktokapis.com"


class TikTokPublisher(Publisher):
    platform = "tiktok"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)

        media_urls = post.media_urls or []
        if not media_urls:
            return PublishResult(
                success=False,
                error="TikTok posts require a video URL",
            )

        caption = (post.caption or "").strip()
        if post.hashtags:
            tags = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )
            caption = f"{caption} {tags}".strip() if caption else tags
        # TikTok caps captions at 2200 chars
        caption = caption[:2200]

        body = {
            "post_info": {
                "title": caption,
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
                "video_cover_timestamp_ms": 1000,
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": media_urls[0],
            },
        }

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.post(
                "/v2/post/publish/video/init/",
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
            )
            if not r.is_success:
                logger.error("TikTok publish init failed: %s %s", r.status_code, r.text[:300])
                raise PublisherError(f"TikTok init: HTTP {r.status_code}: {r.text[:200]}")
            data = r.json().get("data", {})

        publish_id = data.get("publish_id")
        if not publish_id:
            raise PublisherError(f"TikTok publish: no publish_id: {data}")

        # NOTE: the actual post isn't live yet — TikTok is fetching the
        # video from our URL. The status polling happens on metrics refresh
        # or via a separate resolver. For now we record publish_id as the
        # platform id; fetch_metrics resolves it to the real post id later.
        return PublishResult(
            success=True,
            platform_post_id=publish_id,
            platform_url=None,  # Populated after status resolves
            raw_response=data,
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        """Fetch metrics — resolves publish_id to real post_id if needed first."""
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        post_id = post.platform_post_id

        # If platform_post_id looks like a publish_id (has a v_ prefix),
        # resolve it via the status endpoint first.
        if post_id.startswith("v_") or post_id.startswith("pub_") or len(post_id) > 30:
            with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
                r = client.post(
                    "/v2/post/publish/status/fetch/",
                    json={"publish_id": post_id},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                )
                if not r.is_success:
                    return MetricsResult()
                data = r.json().get("data", {})
                if data.get("status") == "PUBLISH_COMPLETE":
                    resolved = data.get("publicly_available_post_id") or data.get("post_id")
                    if resolved:
                        post_id = resolved

        # Query video info endpoint for engagement stats
        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.post(
                "/v2/video/query/",
                params={
                    "fields": "id,like_count,comment_count,share_count,view_count"
                },
                json={"filters": {"video_ids": [post_id]}},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
            )
            if not r.is_success:
                logger.warning("TikTok metrics failed: %s", r.text[:200])
                return MetricsResult()
            videos = r.json().get("data", {}).get("videos", [])

        if not videos:
            return MetricsResult()
        v = videos[0]

        return MetricsResult(
            likes=int(v.get("like_count") or 0),
            comments=int(v.get("comment_count") or 0),
            shares=int(v.get("share_count") or 0),
            impressions=int(v.get("view_count") or 0),
            reach=int(v.get("view_count") or 0),
            raw_response=v,
        )
