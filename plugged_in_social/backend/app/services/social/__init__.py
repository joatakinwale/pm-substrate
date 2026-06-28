"""Social publishers registry + dispatcher.

Usage from the internal social endpoint (called by the social-publisher
Cloudflare Worker):

    from app.services.social import get_publisher

    publisher = get_publisher(post.platform)
    result = publisher.publish(post, account)

A single module-level registry maps platform name → Publisher instance.
Instances are shared (publishers are stateless) so we don't pay
construction cost per post.
"""

from __future__ import annotations

from .base import (
    MetricsResult,
    Publisher,
    PublisherConfigError,
    PublisherError,
    PublishResult,
)
from .linkedin import LinkedInPublisher
from .meta import FacebookPublisher, InstagramPublisher
from .pinterest import PinterestPublisher
from .tiktok import TikTokPublisher
from .x_twitter import XPublisher
from .youtube import YouTubePublisher

_REGISTRY: dict[str, Publisher] = {
    "instagram": InstagramPublisher(),
    "facebook": FacebookPublisher(),
    "linkedin": LinkedInPublisher(),
    "tiktok": TikTokPublisher(),
    "youtube": YouTubePublisher(),
    "x": XPublisher(),
    "pinterest": PinterestPublisher(),
}


class UnknownPlatformError(Exception):
    """Raised when a platform has no publisher registered."""


def get_publisher(platform: str) -> Publisher:
    """Look up a publisher by platform name — raises UnknownPlatformError if missing."""
    key = (platform or "").lower().strip()
    if key not in _REGISTRY:
        raise UnknownPlatformError(
            f"No publisher registered for platform '{platform}'. "
            f"Available: {sorted(_REGISTRY.keys())}"
        )
    return _REGISTRY[key]


def available_platforms() -> list[str]:
    """List all platforms with a registered publisher."""
    return sorted(_REGISTRY.keys())


__all__ = [
    "MetricsResult",
    "Publisher",
    "PublisherConfigError",
    "PublisherError",
    "PublishResult",
    "UnknownPlatformError",
    "available_platforms",
    "get_publisher",
]
