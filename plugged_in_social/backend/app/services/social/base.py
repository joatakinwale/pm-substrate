"""Base classes + data types for social publishers.

Every platform publisher implements the same Publisher contract:

    publish(post, account)         -> PublishResult
    fetch_metrics(post, account)   -> MetricsResult
    refresh_token(account)         -> str | None    (optional)

Publishers are stateless — they receive the SocialPost and SocialAccount
they need to act on and return a structured result. Persistence is the
caller's job (see ``app.tasks.social_tasks``).

Tokens live behind ``SocialAccount.access_token_ref`` which is a string
pointer. The resolver ``resolve_token()`` turns that pointer into the
actual bearer value — in Phase 1 that pointer IS the raw token (we are
not running a secrets vault yet), so the resolver just returns it
directly. When we graduate to Vault / Doppler / AWS Secrets Manager the
resolver grows new branches without any publisher needing to change.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.models.social_media import SocialAccount, SocialPost

logger = logging.getLogger(__name__)


# ─── Result types ────────────────────────────────────────────────────

@dataclass
class PublishResult:
    """What a publisher returns after attempting to publish."""

    success: bool
    platform_post_id: str | None = None
    platform_url: str | None = None
    error: str | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricsResult:
    """Engagement metrics fetched from the platform."""

    likes: int = 0
    comments: int = 0
    shares: int = 0
    impressions: int = 0
    reach: int = 0
    raw_response: dict[str, Any] = field(default_factory=dict)

    @property
    def engagement_rate(self) -> float | None:
        """(likes + comments + shares) / reach — percent, None if no reach."""
        if not self.reach:
            return None
        return round(
            100 * (self.likes + self.comments + self.shares) / self.reach,
            4,
        )


# ─── Publisher contract ──────────────────────────────────────────────

class PublisherError(Exception):
    """Raised by publishers for platform-level failures worth retrying."""


class PublisherConfigError(Exception):
    """Raised when a platform isn't configured — NOT retryable."""


class Publisher(ABC):
    """Abstract publisher — one concrete subclass per platform."""

    # Set by subclasses so the dispatcher can key on it.
    platform: str = ""

    def __init__(self) -> None:
        if not self.platform:
            raise ValueError(
                f"{type(self).__name__} must set `platform` class attribute"
            )

    # ─── required ──────────────────────────────────────────────────

    @abstractmethod
    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        """Publish ``post`` via ``account``. Raises PublisherError on retryable fail."""

    @abstractmethod
    def fetch_metrics(
        self, post: SocialPost, account: SocialAccount
    ) -> MetricsResult:
        """Fetch current engagement metrics for an already-published post."""

    # ─── optional ──────────────────────────────────────────────────

    def refresh_token(self, account: SocialAccount) -> str | None:
        """Refresh OAuth token if the platform supports it. Returns new token or None.

        Default implementation returns None — platforms that support refresh
        override this. Callers should persist the returned token via the
        vault resolver.
        """
        return None


# ─── Token resolution ────────────────────────────────────────────────

def resolve_token(account: SocialAccount) -> str:
    """Turn ``account.access_token_ref`` into an actual bearer token.

    Phase 1: the ref IS the token (we're not running a vault yet). If it
    starts with ``vault:`` we treat it as a pointer and raise — that
    backend isn't wired yet. A cleanly-raised error here is much better
    than shipping a fake success to a downstream platform call.
    """
    ref = account.access_token_ref or ""
    if not ref:
        raise PublisherConfigError(
            f"SocialAccount {account.id} ({account.platform}) has no access_token_ref — "
            "reconnect the account via the OAuth flow."
        )
    if ref.startswith("vault:"):
        # Future: look up via app.core.config.vault_backend
        raise PublisherConfigError(
            f"Vault-backed tokens not yet supported for account {account.id}. "
            "Store the raw token in access_token_ref for Phase 1."
        )
    return ref


def build_platform_url(platform: str, account: SocialAccount, platform_post_id: str) -> str | None:
    """Best-effort deep link to the post on the platform.

    Each platform has its own URL shape. We return None if we can't
    construct one — the UI falls back to the account profile URL.
    """
    acc = account.account_name or account.account_id or ""
    match platform:
        case "instagram":
            # IG media IDs are exposed via a permalink field on the API response;
            # callers who have it should pass platform_url directly. This is a
            # fallback that works for the account feed only.
            return f"https://www.instagram.com/{acc}/" if acc else None
        case "facebook":
            # For Page posts the ID looks like "{page_id}_{post_id}"; permalink:
            if "_" in platform_post_id:
                return f"https://www.facebook.com/{platform_post_id}"
            return f"https://www.facebook.com/{acc}/posts/{platform_post_id}" if acc else None
        case "linkedin":
            # URN looks like "urn:li:share:1234..." or "urn:li:ugcPost:1234..."
            slug = platform_post_id.rsplit(":", 1)[-1]
            return f"https://www.linkedin.com/feed/update/urn:li:activity:{slug}/"
        case "x":
            return f"https://x.com/{acc}/status/{platform_post_id}" if acc else None
        case "youtube":
            return f"https://www.youtube.com/watch?v={platform_post_id}"
        case "tiktok":
            return f"https://www.tiktok.com/@{acc}/video/{platform_post_id}" if acc else None
        case "pinterest":
            return f"https://www.pinterest.com/pin/{platform_post_id}/"
    return None
