"""X (Twitter) publisher — API v2.

Posting requires user-context OAuth 2.0 PKCE token with tweet.write scope.
Reading public metrics can use OAuth 2.0 user context OR app-only bearer.

Posting endpoint:  POST https://api.twitter.com/2/tweets
Reading metrics:   GET  https://api.twitter.com/2/tweets/:id?tweet.fields=public_metrics

Media uploads use the v1.1 media/upload endpoint (chunked for video) and
the resulting media_id is attached to the v2 tweet payload. Phase 1
implementation supports text-only tweets reliably and surfaces a warning
for media — full media upload is a follow-up.
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

API_ROOT = "https://api.twitter.com"


class XPublisher(Publisher):
    platform = "x"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)

        text = (post.caption or "").strip()
        if post.hashtags:
            tags = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )
            # Tweets cap at 280 chars; truncate aggressively if needed
            text = f"{text} {tags}".strip() if text else tags

        # Tweet character limit — safe-truncate
        if len(text) > 280:
            text = text[:277] + "..."

        if (post.media_urls or []) and not post.platform_post_id:
            logger.warning(
                "X: media upload not yet wired (post %s) — publishing text only",
                post.id,
            )

        body: dict[str, object] = {"text": text}

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.post(
                "/2/tweets",
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code == 401:
                raise PublisherError("X: 401 unauthorized — OAuth token expired or invalid")
            if not r.is_success:
                logger.error("X publish failed: %s %s", r.status_code, r.text[:300])
                raise PublisherError(f"X tweets: HTTP {r.status_code}: {r.text[:200]}")
            data = r.json().get("data", {})

        tweet_id = data.get("id")
        if not tweet_id:
            raise PublisherError(f"X publish: no id in response: {data}")

        return PublishResult(
            success=True,
            platform_post_id=tweet_id,
            platform_url=build_platform_url("x", account, tweet_id),
            raw_response=data,
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.get(
                f"/2/tweets/{post.platform_post_id}",
                params={"tweet.fields": "public_metrics,non_public_metrics,organic_metrics"},
                headers={"Authorization": f"Bearer {token}"},
            )
            if not r.is_success:
                logger.warning("X metrics failed: %s", r.text[:200])
                return MetricsResult()
            data = r.json().get("data", {})

        pm = data.get("public_metrics", {}) or {}
        npm = data.get("non_public_metrics", {}) or {}
        # impressions live in non_public_metrics or organic_metrics depending on auth scope
        impressions = int(npm.get("impression_count") or
                          (data.get("organic_metrics") or {}).get("impression_count") or 0)

        return MetricsResult(
            likes=int(pm.get("like_count") or 0),
            comments=int(pm.get("reply_count") or 0),
            shares=int(pm.get("retweet_count") or 0) + int(pm.get("quote_count") or 0),
            impressions=impressions,
            reach=impressions,  # X doesn't report reach distinct from impressions
            raw_response=data,
        )
