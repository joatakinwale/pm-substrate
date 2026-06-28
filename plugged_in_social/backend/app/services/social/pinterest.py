"""Pinterest publisher — v5 API.

Endpoint: POST https://api.pinterest.com/v5/pins

Requires the account.account_id to be the board_id to pin to (stored on
SocialAccount when the account is connected). Pins require an image or
video source — we use the ``source_type: image_url`` flow.

Docs: https://developers.pinterest.com/docs/api/v5/pins-create
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

API_ROOT = "https://api.pinterest.com"


class PinterestPublisher(Publisher):
    platform = "pinterest"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)

        media_urls = post.media_urls or []
        if not media_urls:
            return PublishResult(
                success=False,
                error="Pinterest pins require an image or video URL",
            )

        # The board to pin to — sits in metadata_json.default_board_id
        # if the app supports multiple boards per account, else account_id
        board_id = None
        if account.metadata_json:
            board_id = account.metadata_json.get("default_board_id")
        board_id = board_id or account.account_id
        if not board_id:
            raise PublisherError("Pinterest: no board_id on account")

        title = ((post.caption or "").split("\n")[0] or "").strip()[:100]
        description = (post.caption or "").strip()[:800]

        body = {
            "board_id": board_id,
            "title": title,
            "description": description,
            "media_source": {
                "source_type": "image_url",
                "url": media_urls[0],
            },
        }
        if post.hashtags:
            body["note"] = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )[:500]

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.post(
                "/v5/pins",
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            if not r.is_success:
                logger.error("Pinterest publish failed: %s %s", r.status_code, r.text[:300])
                raise PublisherError(f"Pinterest pins: HTTP {r.status_code}: {r.text[:200]}")
            data = r.json()

        pin_id = data.get("id")
        if not pin_id:
            raise PublisherError(f"Pinterest: no pin id: {data}")

        return PublishResult(
            success=True,
            platform_post_id=pin_id,
            platform_url=build_platform_url("pinterest", account, pin_id),
            raw_response=data,
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.get(
                f"/v5/pins/{post.platform_post_id}/analytics",
                params={
                    "start_date": "",  # defaults to last 30 days if omitted
                    "metric_types": "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            if not r.is_success:
                logger.warning("Pinterest analytics failed: %s", r.text[:200])
                return MetricsResult()
            data = r.json()

        # Pinterest returns a map of metric → daily values; sum where present.
        def _sum(metric: str) -> int:
            block = data.get(metric, {}) or {}
            summary = block.get("summary_metrics") or {}
            return int(summary.get(metric) or 0)

        impressions = _sum("IMPRESSION")
        saves = _sum("SAVE")

        return MetricsResult(
            likes=saves,  # Pinterest uses saves as the engagement primitive
            comments=0,
            shares=saves,
            impressions=impressions,
            reach=impressions,
            raw_response=data,
        )
