"""LinkedIn publisher — UGC Posts API (v2).

Uses the /ugcPosts endpoint with the account's person or organization URN.
account.account_id should be set to the full URN (e.g. "urn:li:person:abcd"
or "urn:li:organization:1234").

Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
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

API_ROOT = "https://api.linkedin.com"
REST_VERSION = "202404"  # LinkedIn uses YYYYMM versioning for REST API


class LinkedInPublisher(Publisher):
    platform = "linkedin"

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": REST_VERSION,
            "Content-Type": "application/json",
        }

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)
        author_urn = account.account_id  # "urn:li:person:..." or "urn:li:organization:..."

        text = (post.caption or "").strip()
        if post.hashtags:
            tags = " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )
            text = f"{text}\n\n{tags}" if text else tags

        media_urls = post.media_urls or []
        media_type = (post.media_type or "").lower()

        # Build shareContent based on whether we have media
        share_content: dict[str, object] = {
            "shareCommentary": {"text": text},
            "shareMediaCategory": "NONE",
        }

        if media_urls:
            # NOTE: Real image posts require a 2-step upload (register upload
            # → PUT bytes → reference asset URN). For Phase 1 we support
            # text-only posts reliably; media posts fall back to a text post
            # that includes the first media URL inline so the user still
            # gets a share, and we surface a warning.
            logger.warning(
                "LinkedIn: inline-media not yet supported in UGC publisher — "
                "falling back to text post with URL for account %s",
                account.id,
            )
            if media_urls[0] not in text:
                text = f"{text}\n\n{media_urls[0]}"
                share_content["shareCommentary"]["text"] = text

        body = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.post("/v2/ugcPosts", json=body, headers=self._headers(token))
            if not r.is_success:
                logger.error("LinkedIn publish failed: %s %s", r.status_code, r.text[:300])
                raise PublisherError(f"LinkedIn UGC post: HTTP {r.status_code}: {r.text[:200]}")

            # LinkedIn returns the URN in x-restli-id header
            urn = r.headers.get("x-restli-id") or (r.json().get("id") if r.content else None)
            if not urn:
                raise PublisherError("LinkedIn publish: no URN in response")

        return PublishResult(
            success=True,
            platform_post_id=urn,
            platform_url=build_platform_url("linkedin", account, urn),
            raw_response={"urn": urn, "status": r.status_code},
        )

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        # LinkedIn social actions — likes, comments counts
        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.get(
                f"/v2/socialActions/{post.platform_post_id}",
                headers=self._headers(token),
            )
            if not r.is_success:
                logger.warning("LinkedIn social actions failed: %s", r.text[:200])
                return MetricsResult()
            data = r.json()

        return MetricsResult(
            likes=int(data.get("likesSummary", {}).get("totalLikes") or 0),
            comments=int(data.get("commentsSummary", {}).get("totalFirstLevelComments") or 0),
            shares=0,  # LinkedIn doesn't expose share counts via this endpoint
            impressions=0,  # Requires separate analytics endpoint (org only)
            reach=0,
            raw_response=data,
        )
