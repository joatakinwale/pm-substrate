"""Rate limiting (MED-2) — application-wide Limiter for high-risk endpoints.

We use ``slowapi`` (Flask-Limiter wired for Starlette/FastAPI). The Limiter
instance is created here so any router can import the same singleton.

Defaults are conservative — feel free to tune per endpoint with the
``@limiter.limit(...)`` decorator.

Backing store
-------------
By default ``slowapi`` uses an in-memory store, which is per-worker. That is
*sufficient* against scripted brute-force from a single attacker on a single
process. For multi-worker / multi-pod deployments, set the ``RATE_LIMIT_REDIS``
environment variable (or use the existing ``REDIS_URL``) to share state across
workers, otherwise an attacker can multiply the limit by the worker count.
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Prefer a dedicated redis URL if provided so rate-limit state is shared
# across workers. Fall back to the app's general Redis URL, then to memory.
_storage_uri = (
    os.getenv("RATE_LIMIT_REDIS")
    or os.getenv("REDIS_URL")
    or "memory://"
)


def _client_key(request) -> str:  # type: ignore[no-untyped-def]
    """Identify the client for rate limiting.

    Strategy
    --------
    - Trust ``X-Forwarded-For`` only when the proxy is on the allowlist set
      by ``TRUSTED_PROXIES``. Otherwise use the direct peer address.
    - This avoids letting an unproxied client lie about its IP just by
      sending a forged ``X-Forwarded-For`` header.
    """
    trusted = {p.strip() for p in os.getenv("TRUSTED_PROXIES", "").split(",") if p.strip()}
    peer = get_remote_address(request)
    if trusted and peer in trusted:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # Left-most non-trusted entry is the original client.
            return xff.split(",")[0].strip()
    return peer


limiter = Limiter(
    key_func=_client_key,
    storage_uri=_storage_uri,
    # Sensible global default — endpoints that need stricter caps override.
    default_limits=["120/minute"],
    headers_enabled=True,  # Adds X-RateLimit-* response headers
)
