"""Supabase Auth integration — validates Supabase JWTs and syncs users.

Flow:
  1. Frontend uses @supabase/supabase-js for login/signup (Google OAuth, magic link, email+password)
  2. Supabase issues a JWT with sub=auth.users.id
  3. Backend validates the JWT
       - Legacy projects: HS256 signed with the shared JWT secret
       - Current projects: ES256/RS256 signed with an asymmetric key — we
         verify via the project's JWKS endpoint
  4. On first login, backend creates a User record linked to the Supabase auth.users.id via auth_id
  5. RLS context is set from the JWT claims (org_id, user_id, role)

This replaces the custom JWT system for production. The custom system
remains available for local dev / testing.
"""
import logging
import threading
import time

import httpx
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ── JWKS cache ──────────────────────────────────────────────
# Supabase rotates signing keys rarely; we cache the JWKS for TTL seconds
# then refetch. A per-process lock prevents thundering-herd refetches.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict = {"fetched_at": 0.0, "keys": {}}  # keys: {kid: jwk_dict}
_jwks_lock = threading.Lock()


def _fetch_jwks(supabase_url: str) -> dict[str, dict]:
    """Fetch the Supabase project's JWKS and index it by `kid`.

    Returns an empty dict on failure so callers fall through to the
    legacy HS256 path rather than 500ing.
    """
    url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(url)
        if r.status_code != 200:
            logger.warning("JWKS fetch from %s returned %s", url, r.status_code)
            return {}
        data = r.json()
        return {k["kid"]: k for k in data.get("keys", []) if k.get("kid")}
    except Exception as exc:  # noqa: BLE001 — best-effort, fall through
        logger.warning("JWKS fetch failed: %s", exc)
        return {}


def _get_jwk_for_kid(supabase_url: str, kid: str) -> dict | None:
    """Look up a JWK by `kid`, refreshing the cache if needed."""
    now = time.time()
    cache = _jwks_cache
    if kid in cache["keys"] and (now - cache["fetched_at"]) < _JWKS_TTL_SECONDS:
        return cache["keys"][kid]

    with _jwks_lock:
        # Re-check under lock
        if kid in cache["keys"] and (now - cache["fetched_at"]) < _JWKS_TTL_SECONDS:
            return cache["keys"][kid]
        fresh = _fetch_jwks(supabase_url)
        if fresh:
            cache["keys"] = fresh
            cache["fetched_at"] = now
        return cache["keys"].get(kid)


def decode_supabase_token(token: str) -> dict | None:
    """Decode and validate a Supabase-issued JWT.

    Supports both signature algorithms Supabase has used:
      - HS256: legacy symmetric — verified with ``SUPABASE_JWT_SECRET``
      - ES256 / RS256: asymmetric — verified against the project's JWKS
        at ``/auth/v1/.well-known/jwks.json``

    The payload contains:
      - sub: Supabase auth.users.id (UUID)
      - email: user's email
      - role: "authenticated" (Supabase default)
      - aud: "authenticated"
      - app_metadata: may contain org_id, role if set via Supabase hooks
      - user_metadata: name, avatar, etc.

    Returns the decoded payload or None if invalid.
    """
    settings = get_settings()

    # Peek at the header to pick the verification path. Unverified decode
    # is safe here — we only use the header to choose a key/algorithm;
    # the actual signature is checked by jwt.decode below.
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        return None

    alg = header.get("alg", "").upper()

    # ── Asymmetric (current Supabase default) ──────────────
    if alg in ("ES256", "RS256"):
        if not settings.supabase_url:
            logger.debug("supabase_url not configured — cannot verify %s JWT", alg)
            return None
        kid = header.get("kid")
        if not kid:
            return None
        jwk = _get_jwk_for_kid(settings.supabase_url, kid)
        if not jwk:
            logger.warning("No JWK found for kid=%s", kid)
            return None
        try:
            claims = jwt.decode(
                token,
                jwk,
                algorithms=[alg],
                audience="authenticated",
            )
            return claims
        except JWTError as exc:
            logger.debug("Supabase %s JWT decode failed: %s", alg, exc)
            return None
        except Exception:  # noqa: BLE001
            return None

    # ── Legacy symmetric HS256 ─────────────────────────────
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            return None
        try:
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return claims
        except JWTError:
            return None

    # Unknown algorithm — refuse
    logger.debug("Unsupported Supabase JWT alg: %s", alg)
    return None


def extract_user_info(payload: dict) -> dict:
    """Extract user info from a decoded Supabase JWT payload.

    Maps Supabase's JWT structure to our internal user representation.
    """
    user_metadata = payload.get("user_metadata", {})
    app_metadata = payload.get("app_metadata", {})

    return {
        "supabase_user_id": payload.get("sub"),
        "email": payload.get("email", ""),
        "full_name": (
            user_metadata.get("full_name")
            or user_metadata.get("name")
            or payload.get("email", "").split("@")[0]
        ),
        "avatar_url": user_metadata.get("avatar_url"),
        # These are set by our Supabase auth hook or manually via admin API
        "org_id": app_metadata.get("org_id"),
        "role": app_metadata.get("role", "viewer"),
    }


async def get_supabase_user(user_id: str) -> dict | None:
    """Fetch a user from Supabase Admin API (for sync/verification).

    Used during initial user provisioning to get full user metadata.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
            },
        )
        if response.status_code == 200:
            return response.json()
        return None


async def update_supabase_app_metadata(
    user_id: str, metadata: dict
) -> bool:
    """Update a Supabase user's app_metadata (org_id, role).

    Called after creating a user record in our DB to persist
    org_id and role in the Supabase JWT claims.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return False

    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": "application/json",
            },
            json={"app_metadata": metadata},
        )
        return response.status_code == 200


async def generate_supabase_invite_link(
    email: str,
    *,
    redirect_to: str,
    app_metadata: dict | None = None,
    user_metadata: dict | None = None,
) -> dict | None:
    """Generate a secure Supabase invite action link for a new user.

    Uses POST /auth/v1/admin/generate_link with type=invite, which:
      1. Creates (or finds) an auth.users row for the email
      2. Returns a one-time action_link the user clicks to verify
      3. The link points to Supabase's /verify endpoint, which then
         exchanges the token for a session and redirects to
         ``redirect_to`` with a ?code= param our callback handles.

    ``admin/generate_link`` returns the link WITHOUT sending any email
    — we send our own branded invite through Resend using the returned
    ``action_link``. (Unlike ``admin/invite``, which does send.)

    Returns a dict with:
      - ``action_link``: str — the URL to embed in the branded email
      - ``user_id``: str — the Supabase auth.users.id (goes in User.auth_id)
      - ``email``: str
      - ``hashed_token``: str — optional, for server-side verification flows
    or None if Supabase is not configured / the call fails.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    # generate_link ignores the ``options`` wrapper that the JS client
    # uses — GoTrue's REST endpoint takes flat top-level fields.
    payload: dict = {
        "type": "invite",
        "email": email,
        "redirect_to": redirect_to,
    }
    # ``data`` becomes the Supabase user's user_metadata. app_metadata
    # is set via a separate admin PUT (see update_supabase_app_metadata)
    # because generate_link does not accept it on older self-hosted
    # GoTrue builds.
    if user_metadata:
        payload["data"] = user_metadata

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code != 200:
            return None
        body = response.json()
        # Response shape: { "properties": {"action_link": "...", "hashed_token": "...", ...},
        #                   "user": { "id": "...", "email": "...", ... } }
        props = body.get("properties") or {}
        user = body.get("user") or {}
        action_link = props.get("action_link")
        user_id = user.get("id")
        if not action_link or not user_id:
            return None
        return {
            "action_link": action_link,
            "user_id": user_id,
            "email": user.get("email") or email,
            "hashed_token": props.get("hashed_token"),
        }
