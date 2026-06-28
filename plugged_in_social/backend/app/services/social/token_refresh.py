"""Per-platform OAuth token refresh.

Why this module exists
----------------------
Several platforms issue short-lived access tokens. Without a refresh step
the publish path hits a 401/403, retries with the same expired token,
fails all three attempts, and finally marks the post "failed" — even
though the refresh token in ``SocialAccount.refresh_token_ref`` would
have gotten us a fresh access token in one HTTP call.

Critical expiries to keep in mind:

    google (youtube)    ~1 hour     → refresh almost every publish
    x (twitter)         ~2 hours    → refresh once or twice per session
    linkedin            ~60 days    → rarely
    tiktok              ~24 hours   → daily cron-driven
    pinterest           ~30 days    → rarely
    meta (fb/ig)        ~60 days    → exchange, not refresh (different API)

Contract
--------
Callers invoke :func:`refresh_if_needed` right before publishing. It is
a no-op when the stored token is still fresh (``token_expires_at`` is
more than ``REFRESH_MARGIN_SECONDS`` in the future). When it does
refresh, it writes the new ``access_token_ref``, any rotated
``refresh_token_ref``, and the new ``token_expires_at`` back onto the
account row via the provided sync Session, then commits.

Errors raise :class:`RefreshError`. The caller (publish task) catches
this and lets the existing PublisherConfigError branch surface a clean
"reconnect the account" message to the user — refreshing a dead token
is not something we want to retry on exponential backoff.
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.social_media import SocialAccount

logger = logging.getLogger(__name__)

# Refresh when the token has less than this much life left. 120s is
# enough slack for a typical publish (metadata POST + media upload) to
# finish on the currently-issued token. Publishes that take longer —
# e.g. a YouTube resumable upload of a 1 GB video — should be refreshed
# BEFORE they start, which is exactly what this helper does.
REFRESH_MARGIN_SECONDS = 120


class RefreshError(Exception):
    """Raised when a token refresh fails and the account needs reconnect."""


# ─── Public entry point ──────────────────────────────────────────────


def refresh_if_needed(
    account: SocialAccount,
    db: Session,
    settings: Settings | None = None,
) -> bool:
    """Refresh the OAuth token on ``account`` if it's near expiry.

    Returns ``True`` if a refresh was performed, ``False`` if the token
    was still fresh and no network call was made.

    Raises :class:`RefreshError` when the refresh is attempted but fails
    (bad refresh token, platform returned 4xx). Callers should translate
    this into a ``PublisherConfigError`` so the publish task marks the
    post failed and the user can reconnect.
    """
    settings = settings or get_settings()

    if not _near_expiry(account):
        return False

    platform = (account.platform or "").lower()
    if platform in ("facebook", "instagram"):
        # Meta long-lived tokens: no refresh_token grant. Exchange path
        # is different — not implemented here; caller continues with the
        # existing token and hopes it survives. (We already require a
        # ~60-day window at connect time.)
        logger.debug("Skipping Meta token — exchange flow not implemented yet")
        return False

    if not account.refresh_token_ref:
        raise RefreshError(
            f"Account {account.id} ({platform}) has no refresh_token — "
            "user must reconnect via OAuth."
        )

    handler = _REFRESH_HANDLERS.get(platform)
    if handler is None:
        logger.warning("No refresh handler for platform %s", platform)
        return False

    logger.info(
        "Refreshing %s token for account %s (expires_at=%s)",
        platform, account.id, account.token_expires_at,
    )
    token_data = handler(account.refresh_token_ref, settings)

    new_access = token_data.get("access_token")
    if not new_access:
        raise RefreshError(
            f"{platform} refresh returned no access_token: {_trim(token_data)}"
        )

    # Some providers rotate the refresh token; persist the new one when
    # present, keep the old one when absent.
    new_refresh = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")

    account.access_token_ref = new_access
    if new_refresh:
        account.refresh_token_ref = new_refresh
    if isinstance(expires_in, (int, float, str)) and str(expires_in).isdigit():
        account.token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=int(expires_in)
        )
    db.add(account)
    db.commit()
    db.refresh(account)
    return True


def _near_expiry(account: SocialAccount) -> bool:
    """Token is near expiry iff we know when it expires AND that's soon.

    If ``token_expires_at`` is None (older row, or platform didn't
    return ``expires_in``), we assume long-lived and skip the refresh.
    The risk: a refresh-capable platform whose first connect didn't set
    expiry. We accept that trade-off because refreshing blindly on
    every publish would eat rate limits.
    """
    expires_at = account.token_expires_at
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        # Defensive: model defines tz-aware column but older rows may be
        # naive. Treat naive as UTC.
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc) + timedelta(
        seconds=REFRESH_MARGIN_SECONDS
    )


# ─── Per-platform handlers ───────────────────────────────────────────


def _refresh_google(refresh_token: str, settings: Settings) -> dict[str, Any]:
    """Google refresh grant. Does NOT return a new refresh_token —
    Google issues refresh_tokens once at first consent and expects you
    to reuse them forever."""
    return _post_token_form(
        url="https://oauth2.googleapis.com/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
        },
    )


def _refresh_x(refresh_token: str, settings: Settings) -> dict[str, Any]:
    """X (Twitter) OAuth2 refresh with Basic auth — X requires the
    client creds in the Authorization header for confidential clients,
    even though PKCE was used at connect. ``x_api_key``/``x_api_secret``
    are X's names for the OAuth2 client_id/client_secret."""
    basic = base64.b64encode(
        f"{settings.x_api_key}:{settings.x_api_secret}".encode()
    ).decode()
    return _post_token_form(
        url="https://api.twitter.com/2/oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.x_api_key,
        },
        extra_headers={"Authorization": f"Basic {basic}"},
    )


def _refresh_linkedin(refresh_token: str, settings: Settings) -> dict[str, Any]:
    return _post_token_form(
        url="https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.linkedin_client_id,
            "client_secret": settings.linkedin_client_secret,
        },
    )


def _refresh_tiktok(refresh_token: str, settings: Settings) -> dict[str, Any]:
    """TikTok v2 open API refresh — form-encoded, client creds in body.
    TikTok's parameter is ``client_key`` not ``client_id``."""
    return _post_token_form(
        url="https://open.tiktokapis.com/v2/oauth/token/",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_key": settings.tiktok_client_key,
            "client_secret": settings.tiktok_client_secret,
        },
    )


def _refresh_pinterest(refresh_token: str, settings: Settings) -> dict[str, Any]:
    """Pinterest v5 — Basic auth for client creds, form body for the grant.
    Pinterest names its client creds ``app_id``/``app_secret``."""
    basic = base64.b64encode(
        f"{settings.pinterest_app_id}:{settings.pinterest_app_secret}".encode()
    ).decode()
    return _post_token_form(
        url="https://api.pinterest.com/v5/oauth/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        extra_headers={"Authorization": f"Basic {basic}"},
    )


_REFRESH_HANDLERS = {
    "google": _refresh_google,
    "youtube": _refresh_google,  # YouTube accounts store platform="youtube"
    "x": _refresh_x,
    "linkedin": _refresh_linkedin,
    "tiktok": _refresh_tiktok,
    "pinterest": _refresh_pinterest,
}


# ─── HTTP helper ─────────────────────────────────────────────────────


def _post_token_form(
    url: str,
    data: dict[str, str],
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """POST a form-encoded token request and return the JSON body.

    Synchronous on purpose — this is called from the sync publish helper
    inside ``asyncio.to_thread``; wrapping it in an event loop would add
    complexity for no benefit.
    """
    headers = {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"}
    if extra_headers:
        headers.update(extra_headers)
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, data=data, headers=headers)
    except httpx.HTTPError as e:
        raise RefreshError(f"Network error refreshing {url}: {e}") from e

    if resp.status_code != 200:
        # 400/401 typically means the refresh token is expired or revoked.
        # Surface as RefreshError so caller prompts reconnect rather than
        # silently retrying.
        raise RefreshError(
            f"Refresh failed at {url}: HTTP {resp.status_code}: {resp.text[:200]}"
        )
    try:
        return resp.json()
    except ValueError as e:
        raise RefreshError(f"Non-JSON response from {url}: {resp.text[:200]}") from e


def _trim(data: dict[str, Any]) -> str:
    """Short repr for error messages — we don't want tokens in logs."""
    safe = {k: ("<redacted>" if "token" in k.lower() else v) for k, v in data.items()}
    return str(safe)[:200]
