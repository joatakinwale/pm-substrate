"""Social media OAuth connect flow.

Two endpoints per platform-family:

    GET  /social/oauth/{platform}/authorize  → 302 to platform consent URL
    GET  /social/oauth/{platform}/callback   → exchange code, upsert SocialAccount

The authorize endpoint signs a short-lived state token (``itsdangerous``
``URLSafeTimedSerializer`` using ``settings.secret_key``) that carries the
authenticated org_id + user_id + nonce. The callback verifies that state,
exchanges the ``code`` query parameter for an access token, fetches the
account profile, and upserts a ``SocialAccount`` row keyed on
``(org_id, platform, account_id)``.

Why a signed state instead of a session cookie:

    1. Most platforms require the callback URL to be a single registered
       value — it must work identically across users, orgs, and browsers.
    2. FastAPI doesn't have session middleware configured (we're stateless
       JWT everywhere else), and bolting on server-side session storage
       for one flow is worse than signing the tiny bit of data we need.
    3. State doubles as CSRF protection — an attacker who triggers a
       callback with their own code can't forge a state that we signed.

Phase 1 storage: ``access_token_ref`` holds the raw bearer token. Phase 2
will flip these to ``vault:<id>`` references once a secrets manager is
wired up (the ``resolve_token`` code already accounts for this).

Covered platforms (code split into per-platform config below):

    - meta        (Instagram + Facebook share this OAuth app)
    - linkedin
    - tiktok
    - google      (YouTube's OAuth scope lives under Google)
    - x           (Twitter OAuth 2.0 + PKCE)
    - pinterest

Each platform config specifies:

    - authorize_url / token_url
    - scopes required by the publisher
    - a ``fetch_profile`` callable that returns
      ``(account_id, account_name, profile_url, avatar_url, extra_meta)``
    - an optional ``pkce`` flag (X requires PKCE)

New platforms are added by appending to ``_PLATFORM_CONFIGS`` — no
per-platform route.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.core.config import get_settings
from app.db.database import get_db
from app.models.social_media import SocialAccount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/oauth", tags=["social-oauth"])


# ─── State signing ──────────────────────────────────────────────────

_STATE_SALT = "social-oauth-state-v1"
# Consent → callback hop can easily take 5+ minutes on platforms that
# show a long scope confirmation (Meta, LinkedIn). 15 minutes is a
# reasonable ceiling — any longer and something is wrong.
_STATE_MAX_AGE_SECONDS = 15 * 60


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt=_STATE_SALT)


def _make_state(org_id: str, user_id: str, platform: str, extra: dict | None = None) -> str:
    """Sign {org_id, user_id, platform, nonce} so the callback trusts it."""
    payload: dict[str, Any] = {
        "org_id": org_id,
        "user_id": user_id,
        "platform": platform,
        "nonce": secrets.token_urlsafe(16),
    }
    if extra:
        payload["extra"] = extra
    return _signer().dumps(payload)


def _verify_state(state: str, expected_platform: str) -> dict:
    try:
        payload = _signer().loads(state, max_age=_STATE_MAX_AGE_SECONDS)
    except SignatureExpired:
        raise HTTPException(status_code=400, detail="OAuth state expired — restart the connect flow")
    except BadSignature:
        raise HTTPException(status_code=400, detail="OAuth state signature invalid")
    if payload.get("platform") != expected_platform:
        # Prevents cross-platform replay: an attacker who intercepts a
        # valid Meta state cannot use it on the LinkedIn callback.
        raise HTTPException(status_code=400, detail="OAuth state platform mismatch")
    return payload


# ─── PKCE helpers (X requires; others ignore) ───────────────────────

def _new_pkce_pair() -> tuple[str, str]:
    """Return (verifier, challenge) for an OAuth 2.0 PKCE flow.

    The verifier is random 64-char URL-safe; the challenge is its SHA-256
    hash, base64-url-encoded without padding (per RFC 7636 §4.2).
    """
    verifier = secrets.token_urlsafe(48)[:64]  # 43..128 allowed by RFC 7636
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ─── Per-platform profile fetchers ──────────────────────────────────
#
# Each returns the canonical 5-tuple the SocialAccount upsert needs:
#   (account_id, account_name, profile_url, avatar_url, extra_meta)
# "extra_meta" ends up on SocialAccount.metadata_json — useful bits like
# page_id for Facebook or the LinkedIn URN.
#
# Network calls are sync (httpx.Client). We call these from within
# async FastAPI handlers using ``fastapi.concurrency.run_in_threadpool``
# to avoid blocking the event loop on the platform's network latency.


_ProfileFetcher = Callable[[str], tuple[str, str, str | None, str | None, dict]]


def _fetch_meta_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """Meta (Instagram/Facebook) — /me?fields=id,name,picture.

    For IG Graph, we also list pages the user manages; the first one with
    an ``instagram_business_account`` becomes the SocialAccount. If none
    exist, this is a plain Facebook user account (Page posting only).
    """
    settings = get_settings()
    v = settings.meta_graph_api_version
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            f"https://graph.facebook.com/{v}/me",
            params={"fields": "id,name,picture", "access_token": access_token},
        )
        r.raise_for_status()
        me = r.json()

        # Try to find a Page → IG business account
        pages_r = client.get(
            f"https://graph.facebook.com/{v}/me/accounts",
            params={
                "fields": "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
                "access_token": access_token,
            },
        )
        pages = pages_r.json().get("data", []) if pages_r.is_success else []

    avatar = (me.get("picture") or {}).get("data", {}).get("url")
    meta = {"facebook_user_id": me.get("id"), "pages": []}
    for p in pages:
        ig = p.get("instagram_business_account")
        meta["pages"].append({
            "page_id": p.get("id"),
            "page_name": p.get("name"),
            # Page-scoped tokens are the right ones for publishing from a
            # Page; store them so the publisher can pick the right token.
            "page_access_token": p.get("access_token"),
            "ig_business_account_id": (ig or {}).get("id"),
            "ig_username": (ig or {}).get("username"),
        })
    return (
        str(me.get("id")),
        me.get("name") or "Facebook account",
        f"https://facebook.com/{me.get('id')}",
        avatar,
        meta,
    )


def _fetch_linkedin_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """LinkedIn — /v2/userinfo (OpenID) gives a compact profile."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        data = r.json()
    sub = data.get("sub") or ""  # LinkedIn member URN sub
    name = data.get("name") or f"{data.get('given_name','')} {data.get('family_name','')}".strip() or "LinkedIn"
    return (
        sub,
        name,
        None,  # LinkedIn doesn't expose a canonical public URL from userinfo
        data.get("picture"),
        {"email": data.get("email"), "email_verified": data.get("email_verified")},
    )


def _fetch_tiktok_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """TikTok — /v2/user/info/ with fields list."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            "https://open.tiktokapis.com/v2/user/info/",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"fields": "open_id,union_id,avatar_url,display_name,username"},
        )
        r.raise_for_status()
        user = (r.json().get("data") or {}).get("user") or {}
    return (
        user.get("open_id") or user.get("union_id") or "",
        user.get("display_name") or user.get("username") or "TikTok",
        f"https://www.tiktok.com/@{user.get('username')}" if user.get("username") else None,
        user.get("avatar_url"),
        {"union_id": user.get("union_id"), "username": user.get("username")},
    )


def _fetch_google_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """YouTube — we intentionally hit the YouTube channels endpoint, not
    Google userinfo. A Google account can manage multiple channels; we
    want the channel ID (which becomes SocialAccount.account_id) and the
    channel title as the account_name."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "snippet,id", "mine": "true"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        items = r.json().get("items") or []
    if not items:
        raise HTTPException(status_code=400, detail="No YouTube channel found for this Google account")
    ch = items[0]
    snippet = ch.get("snippet") or {}
    return (
        ch.get("id") or "",
        snippet.get("title") or "YouTube channel",
        f"https://www.youtube.com/channel/{ch.get('id')}" if ch.get("id") else None,
        (snippet.get("thumbnails") or {}).get("default", {}).get("url"),
        {"custom_url": snippet.get("customUrl")},
    )


def _fetch_x_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """X — /2/users/me with profile_image_url expansion."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            "https://api.twitter.com/2/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"user.fields": "profile_image_url,name,username"},
        )
        r.raise_for_status()
        data = (r.json() or {}).get("data") or {}
    return (
        data.get("id") or "",
        data.get("name") or data.get("username") or "X",
        f"https://x.com/{data.get('username')}" if data.get("username") else None,
        data.get("profile_image_url"),
        {"username": data.get("username")},
    )


def _fetch_pinterest_profile(access_token: str) -> tuple[str, str, str | None, str | None, dict]:
    """Pinterest — /v5/user_account."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            "https://api.pinterest.com/v5/user_account",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        data = r.json() or {}
    return (
        str(data.get("id") or data.get("username") or ""),
        data.get("username") or "Pinterest",
        f"https://pinterest.com/{data.get('username')}" if data.get("username") else None,
        data.get("profile_image"),
        {"account_type": data.get("account_type")},
    )


# ─── Platform configs ───────────────────────────────────────────────

@dataclass(frozen=True)
class PlatformConfig:
    """Everything the flow needs for one platform."""

    key: str                        # URL slug: "meta", "linkedin", ...
    client_id_attr: str             # settings attr for client_id
    client_secret_attr: str         # settings attr for client_secret
    authorize_url: str
    token_url: str
    scopes: list[str]
    scope_sep: str                  # " " for most; "," for some Meta scopes in legacy paths
    fetch_profile: _ProfileFetcher
    platform_value: str             # value stored in SocialAccount.platform
    pkce: bool = False
    # Some platforms need extra params at the authorize step
    extra_authorize_params: dict[str, str] | None = None


def _platform_configs(settings) -> dict[str, PlatformConfig]:
    """Build the platform dict.

    Must be called lazily — at import time, settings.meta_graph_api_version
    would be bound before a test monkeypatches get_settings().
    """
    meta_v = settings.meta_graph_api_version
    return {
        "meta": PlatformConfig(
            key="meta",
            client_id_attr="meta_app_id",
            client_secret_attr="meta_app_secret",
            authorize_url=f"https://www.facebook.com/{meta_v}/dialog/oauth",
            token_url=f"https://graph.facebook.com/{meta_v}/oauth/access_token",
            scopes=[
                "pages_show_list",
                "pages_read_engagement",
                "pages_manage_posts",
                "pages_manage_metadata",
                "instagram_basic",
                "instagram_content_publish",
                "business_management",
            ],
            scope_sep=",",
            fetch_profile=_fetch_meta_profile,
            platform_value="facebook",  # refined at upsert time if IG present
        ),
        "linkedin": PlatformConfig(
            key="linkedin",
            client_id_attr="linkedin_client_id",
            client_secret_attr="linkedin_client_secret",
            authorize_url="https://www.linkedin.com/oauth/v2/authorization",
            token_url="https://www.linkedin.com/oauth/v2/accessToken",
            scopes=["openid", "profile", "email", "w_member_social"],
            scope_sep=" ",
            fetch_profile=_fetch_linkedin_profile,
            platform_value="linkedin",
        ),
        "tiktok": PlatformConfig(
            key="tiktok",
            client_id_attr="tiktok_client_key",  # TikTok calls it "client_key"
            client_secret_attr="tiktok_client_secret",
            authorize_url="https://www.tiktok.com/v2/auth/authorize/",
            token_url="https://open.tiktokapis.com/v2/oauth/token/",
            scopes=["user.info.basic", "video.publish", "video.upload"],
            scope_sep=",",
            fetch_profile=_fetch_tiktok_profile,
            platform_value="tiktok",
        ),
        "google": PlatformConfig(
            key="google",
            client_id_attr="google_client_id",
            client_secret_attr="google_client_secret",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            # youtube.upload is required to post; youtube.readonly lets us
            # pull metrics without also requesting full-manage scope.
            scopes=[
                "https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.readonly",
            ],
            scope_sep=" ",
            fetch_profile=_fetch_google_profile,
            platform_value="youtube",
            # Required for Google to actually issue a refresh_token:
            extra_authorize_params={"access_type": "offline", "prompt": "consent"},
        ),
        "x": PlatformConfig(
            key="x",
            client_id_attr="x_api_key",  # X OAuth 2 calls this "client_id"
            client_secret_attr="x_api_secret",
            authorize_url="https://twitter.com/i/oauth2/authorize",
            token_url="https://api.twitter.com/2/oauth2/token",
            scopes=["tweet.read", "tweet.write", "users.read", "offline.access"],
            scope_sep=" ",
            fetch_profile=_fetch_x_profile,
            platform_value="x",
            pkce=True,
        ),
        "pinterest": PlatformConfig(
            key="pinterest",
            client_id_attr="pinterest_app_id",
            client_secret_attr="pinterest_app_secret",
            authorize_url="https://www.pinterest.com/oauth/",
            token_url="https://api.pinterest.com/v5/oauth/token",
            scopes=["boards:read", "pins:read", "pins:write", "user_accounts:read"],
            scope_sep=",",
            fetch_profile=_fetch_pinterest_profile,
            platform_value="pinterest",
        ),
    }


def _get_config(platform_key: str) -> PlatformConfig:
    settings = get_settings()
    configs = _platform_configs(settings)
    cfg = configs.get(platform_key)
    if not cfg:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown OAuth platform '{platform_key}'. Supported: {sorted(configs)}",
        )
    # Credentials check — we can't start a flow without them.
    client_id = getattr(settings, cfg.client_id_attr, "") or ""
    client_secret = getattr(settings, cfg.client_secret_attr, "") or ""
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail=f"OAuth not configured for {platform_key}: set "
                   f"{cfg.client_id_attr.upper()} and {cfg.client_secret_attr.upper()}.",
        )
    return cfg


def _redirect_uri(request: Request, platform_key: str) -> str:
    """Build the callback URL using the current request host.

    We deliberately don't configure this as a setting — dev, staging, and
    prod all have different hosts, but the path is always the same, and
    the platforms require that redirect_uri at token exchange time match
    the one sent at authorize time byte-for-byte. Building from
    ``request.url_for`` keeps them in lockstep.
    """
    # ``request.url_for`` returns a ``URL`` in newer Starlette — coerce.
    return str(request.url_for("social_oauth_callback", platform=platform_key))


# ─── PKCE verifier storage ──────────────────────────────────────────
#
# For PKCE (X), we need to persist ``code_verifier`` between the authorize
# redirect and the callback. We put it in an HTTP-only signed cookie
# scoped to the callback path. The verifier is not a secret token (it's
# rotated per-flow and single-use), so cookie storage is fine.

_PKCE_COOKIE = "social_oauth_pkce"
_PKCE_COOKIE_MAX_AGE = _STATE_MAX_AGE_SECONDS


# ─── Endpoints ──────────────────────────────────────────────────────


@router.get("/{platform}/authorize")
async def social_oauth_authorize(
    platform: str,
    request: Request,
    as_json: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    """Redirect the user to the platform's OAuth consent screen."""
    cfg = _get_config(platform)
    settings = get_settings()
    if not current_user.get("org_id"):
        raise HTTPException(
            status_code=403,
            detail="User organization is not resolved; sign out and back in before connecting social accounts",
        )

    client_id = getattr(settings, cfg.client_id_attr)
    client_secret = getattr(settings, cfg.client_secret_attr)
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail=f"{platform} OAuth is not configured on this deployment",
        )

    redirect_uri = _redirect_uri(request, platform)
    state = _make_state(
        org_id=current_user["org_id"],
        user_id=current_user.get("sub", ""),
        platform=platform,
    )

    params: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": cfg.scope_sep.join(cfg.scopes),
        "state": state,
    }
    if cfg.extra_authorize_params:
        params.update(cfg.extra_authorize_params)

    response_cookie: dict[str, Any] | None = None
    if cfg.pkce:
        verifier, challenge = _new_pkce_pair()
        params["code_challenge"] = challenge
        params["code_challenge_method"] = "S256"
        # Sign the verifier with the same serializer so the callback can
        # recover it without trusting the cookie blindly.
        response_cookie = {
            "key": _PKCE_COOKIE,
            "value": _signer().dumps({"v": verifier, "p": platform}),
            "max_age": _PKCE_COOKIE_MAX_AGE,
            "httponly": True,
            "secure": settings.is_production,
            "samesite": "lax",
            "path": f"/api/social/oauth/{platform}/callback",
        }

    auth_url = f"{cfg.authorize_url}?{urlencode(params)}"
    resp = (
        JSONResponse({"authorization_url": auth_url})
        if as_json
        else RedirectResponse(auth_url, status_code=307)
    )
    if response_cookie is not None:
        resp.set_cookie(**response_cookie)
    return resp


@router.get("/{platform}/callback", name="social_oauth_callback")
async def social_oauth_callback(
    platform: str,
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Exchange ``code`` for an access token and upsert the SocialAccount.

    Notes on auth: we DON'T use ``get_current_user`` here. The platform
    redirects the browser to us with no Authorization header — our trust
    anchor is the signed ``state``, which carries the original org_id
    and user_id from the authorize step.
    """
    if error:
        # Normalized error handler — every provider has slightly different
        # shape here, but the common cases (user_denied, access_denied,
        # invalid_request) all arrive as ``?error=...&error_description=...``.
        logger.info(
            "OAuth callback error from %s: %s — %s", platform, error, error_description,
        )
        raise HTTPException(
            status_code=400,
            detail=f"OAuth failed on {platform}: {error} ({error_description or 'no description'})",
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    cfg = _get_config(platform)
    state_payload = _verify_state(state, platform)
    settings = get_settings()
    redirect_uri = _redirect_uri(request, platform)

    client_id = getattr(settings, cfg.client_id_attr)
    client_secret = getattr(settings, cfg.client_secret_attr)

    token_form: dict[str, str] = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
    }
    # PKCE flows use client_id + code_verifier in body and NO client_secret
    # header. Non-PKCE flows send client_secret in the body (most) or Basic
    # auth (X for confidential clients). We match each platform's docs:
    token_headers: dict[str, str] = {"Accept": "application/json"}

    if cfg.pkce:
        # Recover the verifier from the signed cookie
        raw = request.cookies.get(_PKCE_COOKIE)
        if not raw:
            raise HTTPException(status_code=400, detail="Missing PKCE verifier cookie")
        try:
            cookie_payload = _signer().loads(raw, max_age=_PKCE_COOKIE_MAX_AGE)
        except (BadSignature, SignatureExpired):
            raise HTTPException(status_code=400, detail="Invalid PKCE verifier cookie")
        if cookie_payload.get("p") != platform:
            raise HTTPException(status_code=400, detail="PKCE cookie platform mismatch")
        token_form["code_verifier"] = cookie_payload["v"]
        # X OAuth 2 also requires Basic auth even with PKCE (confidential client)
        if platform == "x":
            basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
            token_headers["Authorization"] = f"Basic {basic}"
    else:
        token_form["client_secret"] = client_secret

    # Exchange the code for a token
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(cfg.token_url, data=token_form, headers=token_headers)
    except httpx.HTTPError as e:
        logger.exception("OAuth token request failed for %s: %s", platform, e)
        raise HTTPException(status_code=502, detail=f"Upstream OAuth failure: {platform}")

    if r.status_code != 200:
        logger.error(
            "OAuth token exchange for %s returned %s: %s",
            platform, r.status_code, r.text[:400],
        )
        raise HTTPException(
            status_code=400,
            detail=f"{platform} token exchange failed: HTTP {r.status_code}",
        )

    token_data = r.json()
    access_token = token_data.get("access_token")
    if not access_token:
        logger.error("No access_token in %s response: %s", platform, token_data)
        raise HTTPException(status_code=400, detail=f"No access_token from {platform}")

    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    token_expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
        if isinstance(expires_in, (int, float, str)) and str(expires_in).isdigit()
        else None
    )

    # Fetch the profile for the upsert. Each fetcher is sync httpx;
    # offload to threadpool so we don't block the event loop.
    from fastapi.concurrency import run_in_threadpool
    try:
        account_id, account_name, profile_url, avatar_url, extra_meta = (
            await run_in_threadpool(cfg.fetch_profile, access_token)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Profile fetch failed for %s: %s", platform, e)
        raise HTTPException(
            status_code=502,
            detail=f"{platform} profile fetch failed after token exchange",
        )

    if not account_id:
        raise HTTPException(status_code=400, detail=f"{platform} returned no account id")

    # For Meta, prefer the first page that has IG wired up; platform_value
    # becomes "instagram" if we found one, else "facebook".
    platform_value = cfg.platform_value
    if cfg.key == "meta":
        pages = extra_meta.get("pages") or []
        ig_page = next((p for p in pages if p.get("ig_business_account_id")), None)
        if ig_page:
            platform_value = "instagram"
            account_id = ig_page["ig_business_account_id"]
            account_name = ig_page.get("ig_username") or account_name
            # Store the PAGE access token; IG Graph publishing uses it
            access_token = ig_page.get("page_access_token") or access_token

    # Upsert on (org_id, platform, account_id)
    org_id = uuid.UUID(state_payload["org_id"])
    existing = await db.execute(
        select(SocialAccount).where(
            SocialAccount.org_id == org_id,
            SocialAccount.platform == platform_value,
            SocialAccount.account_id == str(account_id),
        )
    )
    account = existing.scalar_one_or_none()
    if account is None:
        account = SocialAccount(
            org_id=org_id,
            platform=platform_value,
            account_name=account_name or "",
            account_id=str(account_id),
        )
        db.add(account)

    account.account_name = account_name or account.account_name or ""
    account.profile_url = profile_url or account.profile_url
    account.avatar_url = avatar_url or account.avatar_url
    account.access_token_ref = access_token
    account.refresh_token_ref = refresh_token or account.refresh_token_ref
    account.token_expires_at = token_expires_at or account.token_expires_at
    account.is_active = True
    # Merge extra metadata — don't clobber anything already set.
    existing_meta = dict(account.metadata_json or {})
    existing_meta.update(extra_meta or {})
    existing_meta["last_connected_at"] = datetime.now(timezone.utc).isoformat()
    account.metadata_json = existing_meta

    await db.commit()
    await db.refresh(account)

    # Redirect back to the frontend's connected-accounts page. The frontend
    # origin lives in allowed_origins[0]; worst case, the user lands on a
    # plain success JSON if the origin isn't set (dev).
    frontend_origin = settings.cors_origins[0] if settings.cors_origins else None
    if frontend_origin:
        success_url = (
            f"{frontend_origin}/admin/social"
            f"?connected={platform_value}&account_id={account.id}"
        )
        return RedirectResponse(success_url, status_code=303)

    return {
        "ok": True,
        "platform": platform_value,
        "account_id": str(account.id),
        "account_name": account.account_name,
    }


# ─── Disconnect helper ──────────────────────────────────────────────

@router.post("/{platform}/disconnect/{account_id}", status_code=204)
async def social_oauth_disconnect(
    platform: str,
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Soft-disconnect: clear tokens, mark inactive, keep the row so we
    preserve post history and the account can be reconnected without
    losing its UUID (foreign keys from SocialPost point at it)."""
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != platform and not (platform == "meta" and account.platform in ("facebook", "instagram")):
        raise HTTPException(status_code=400, detail=f"Account is not a {platform} account")

    account.access_token_ref = None
    account.refresh_token_ref = None
    account.token_expires_at = None
    account.is_active = False
    await db.commit()
