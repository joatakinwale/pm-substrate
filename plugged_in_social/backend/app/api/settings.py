"""Organization settings API.

Exposes CRUD over the two JSONB buckets on ``Organization``:

- ``settings`` — open-ended config used by the web app (branding colors,
  ``email_from``, feature flags, dashboard prefs).
- ``compound_method_defaults`` — Stevie's Protect / Deepen / Amplify
  phase defaults: per-phase KPI targets, cadence, and content mix.

Two routers layered on the same prefix:

1. ``/settings`` — read + patch the ``settings`` JSONB (admin/owner).
   Patches are merged, not replaced, so the frontend can save one field
   at a time without clobbering the rest.
2. ``/settings/compound-method`` — read + replace the Compound-Method
   defaults (owner only — these are commercially sensitive).
3. ``/settings/organization`` — top-level Organization fields
   (name, slug, logo_url, domain).

The ``settings`` bucket is deliberately schema-less on the backend — the
frontend enforces the shape via TypeScript types. This keeps us from
having to ship a migration every time a new toggle lands on the settings
page.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.auth.permissions import require_permission
from app.db.database import get_db_public
from app.models import Organization
from app.services.umami import UmamiClient, UmamiConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ─────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    """Full settings view — organization fields + both JSONB buckets."""

    org_id: str
    name: str
    slug: str
    plan: str
    domain: str | None = None
    logo_url: str | None = None
    is_active: bool
    settings: dict[str, Any]
    compound_method_defaults: dict[str, Any]


class SettingsPatchRequest(BaseModel):
    """Partial-update request.

    Top-level keys are merged one level deep into ``Organization.settings``.
    To clear a key, pass it with value ``null``. Nested dicts are replaced
    wholesale (not deep-merged) because deep-merge semantics on a JSONB
    blob the frontend owns get surprising fast.
    """

    settings: dict[str, Any] = Field(default_factory=dict)


class CompoundMethodPatchRequest(BaseModel):
    """Replacement for the Compound-Method defaults.

    We don't merge this — the compound phases are a tightly-coupled set
    of KPI targets and cadences that must move together, so a partial
    update would leave the org in an inconsistent state.
    """

    compound_method_defaults: dict[str, Any]


class OrganizationUpdateRequest(BaseModel):
    name: str | None = None
    domain: str | None = None
    logo_url: str | None = None


# ── Helpers ─────────────────────────────────────────────────

async def _load_org(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    """Fetch the caller's org or 404.

    Uses an explicit query rather than trusting whatever's loaded via RLS
    — the settings endpoints are intentionally single-tenant-scoped and
    we want one crisp failure mode if the JWT/org link is broken.
    """
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _serialize(org: Organization) -> SettingsResponse:
    return SettingsResponse(
        org_id=str(org.id),
        name=org.name,
        slug=org.slug,
        plan=org.plan,
        domain=org.domain,
        logo_url=org.logo_url,
        is_active=org.is_active,
        settings=dict(org.settings or {}),
        compound_method_defaults=dict(org.compound_method_defaults or {}),
    )


# ── Endpoints ───────────────────────────────────────────────

@router.get("", response_model=SettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.view")),
):
    """Return the full settings snapshot for the current org."""
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)
    return _serialize(org)


@router.patch("", response_model=SettingsResponse)
async def patch_settings(
    body: SettingsPatchRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.edit")),
):
    """Shallow-merge the patch into ``Organization.settings``.

    Why shallow-merge: the frontend typically saves one panel at a time
    (branding, notifications, feature flags). A full replace would force
    the frontend to re-send every unchanged field; a deep merge on JSONB
    gives the UX surprises around arrays. Shallow-merge is the pragmatic
    middle ground.

    ``null`` values clear the top-level key. Any other value replaces it.
    """
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)

    # Copy so we can mutate and flag_modified.
    merged = dict(org.settings or {})
    for key, value in body.settings.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    org.settings = merged
    # SQLAlchemy doesn't track in-place JSONB mutation, so we assigned a
    # new dict above — the assignment IS the change detection. The
    # ``flag_modified`` call is defensive for code paths that later decide
    # to do in-place edits.
    flag_modified(org, "settings")

    await db.flush()
    await db.refresh(org)
    return _serialize(org)


@router.get("/compound-method", response_model=dict)
async def get_compound_method(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.view")),
):
    """Return the Compound-Method defaults."""
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)
    return dict(org.compound_method_defaults or {})


@router.put("/compound-method", response_model=dict)
async def replace_compound_method(
    body: CompoundMethodPatchRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.manage")),
):
    """Replace the Compound-Method defaults wholesale.

    Owner-only (``settings.manage``) because these defaults drive
    billing-relevant phase gates — you don't want a junior admin nuking
    the Amplify phase KPI targets by accident.
    """
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)
    org.compound_method_defaults = dict(body.compound_method_defaults)
    flag_modified(org, "compound_method_defaults")
    await db.flush()
    await db.refresh(org)
    return dict(org.compound_method_defaults or {})


@router.patch("/organization", response_model=SettingsResponse)
async def patch_organization(
    body: OrganizationUpdateRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.manage")),
):
    """Update top-level Organization fields.

    ``slug`` is intentionally NOT editable here — it shows up in public
    URLs (intake forms, portal) and a rename would break bookmarked
    links. Slug changes happen via a separate admin flow that also sets
    up redirects.
    """
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)

    update = body.model_dump(exclude_unset=True)
    for field, value in update.items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return _serialize(org)


# ── Umami connectivity test ─────────────────────────────────

class UmamiTestResponse(BaseModel):
    ok: bool
    detail: str
    page_views: int | None = None
    visitors: int | None = None


@router.get("/umami/test", response_model=UmamiTestResponse)
async def test_umami_connection(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("settings.edit")),
):
    """Probe the Umami integration with the org's saved config.

    Pulls a 24-hour stats window. Surfaces the most common failure modes
    (missing config, bad website id, wrong API key) as a friendly
    message so the operator knows what to fix without digging through
    server logs.
    """
    org_id = uuid.UUID(current_user["org_id"])
    org = await _load_org(db, org_id)

    config = UmamiConfig.for_org(org)
    if not config.is_configured:
        return UmamiTestResponse(
            ok=False,
            detail=(
                "Umami is not fully configured. Set Website ID (and either "
                "an API Key or rely on instance-level fallback credentials)."
            ),
        )

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    start_ms = int(start.timestamp() * 1000)
    end_ms = int(end.timestamp() * 1000)

    client = UmamiClient(config)
    # Umami v2/v3 returns the same 404 for "auth user can't see this
    # website" as for "this website doesn't exist". Probe the auth path
    # first when we're using username/password so a login-side failure
    # is reported as such instead of being mis-blamed on the website ID.
    using_login = (not config.api_key) and bool(
        config.username and config.password
    )
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as http:
            if using_login:
                try:
                    await client._login(http)
                except httpx.HTTPStatusError as login_exc:
                    code = login_exc.response.status_code
                    body = login_exc.response.text[:200]
                    logger.warning(
                        "Umami login failed at %s/api/auth/login: HTTP %s body=%r",
                        config.api_url, code, body,
                    )
                    return UmamiTestResponse(
                        ok=False,
                        detail=(
                            f"Login failed against {config.api_url}/api/auth/login "
                            f"(HTTP {code}). Check UMAMI_USERNAME / UMAMI_PASSWORD."
                        ),
                    )
            stats = await client.get_stats(
                start_ms=start_ms, end_ms=end_ms, client=http,
            )
        pageviews = int((stats.get("pageviews") or {}).get("value") or 0)
        visitors = int((stats.get("visitors") or {}).get("value") or 0)
        return UmamiTestResponse(
            ok=True,
            detail=f"Connected. Last 24h: {pageviews} pageviews, {visitors} visitors.",
            page_views=pageviews,
            visitors=visitors,
        )
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        body = exc.response.text[:200]
        logger.warning(
            "Umami test stats call failed at %s: HTTP %s body=%r",
            exc.request.url, code, body,
        )
        if code == 404:
            who = (
                f"user '{config.username}'"
                if using_login else "the configured API key"
            )
            hint = (
                f"Website {config.website_id} not found OR not visible to "
                f"{who}. Confirm the website exists in the Umami admin AND "
                f"that {who} has access (Umami v2/v3 returns 404 for both)."
            )
        elif code == 401:
            hint = (
                "Authentication failed — check the API Key (or, if using "
                "login fallback, UMAMI_USERNAME / UMAMI_PASSWORD)."
            )
        elif code == 403:
            hint = "Forbidden — the credential has no access to this website."
        else:
            hint = f"Umami returned HTTP {code}: {body}"
        return UmamiTestResponse(ok=False, detail=hint)
    except httpx.RequestError as exc:
        return UmamiTestResponse(
            ok=False,
            detail=f"Network error reaching {config.api_url}: {exc}",
        )


# ── Public branding (no auth) ───────────────────────────────

class PublicBrandingResponse(BaseModel):
    """Subset of org config safe to read from the public portal.

    Excludes anything that could leak — no API keys, no internal IDs.
    Served with ``Cache-Control: public, max-age=300, stale-while-revalidate=3600``
    so the portal avoids a round-trip on every navigation while still
    picking up branding changes within ~5 minutes.

    The Cal.com fields (``cal_url``, ``cal_username``, ``cal_event_slug``) have
    been removed in favour of the Aurinko-native booking flow.  The public
    booking page now resolves the org + profile directly from the
    ``/api/public/booking/{org_slug}/{profile_slug}`` endpoints.
    """

    slug: str
    name: str
    logo_url: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    dashboard_intro: str | None = None
    # Aurinko booking: slug of the default active booking profile for this org.
    # The public booking page constructs /book/{org_slug}/{booking_profile_slug}.
    booking_profile_slug: str | None = None
    umami_website_id: str | None = None


# Module-level router for the public surface so it gets mounted under
# /api/public instead of /api/settings — keeps unauthenticated routes
# together and prevents an accidental ``require_permission`` decorator
# leaking onto a public path.
public_router = APIRouter(prefix="/public", tags=["public"])


@public_router.get(
    "/branding/{slug}",
    response_model=PublicBrandingResponse,
)
async def get_public_branding(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db_public),
):
    """Return the public-safe branding bundle for an org by slug.

    Used by the portal layout to inject brand CSS variables on first
    paint and by the booking page to resolve the org's Cal.com config.
    No authentication required — every field returned is intentionally
    public-safe.
    """
    result = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    org = result.scalar_one_or_none()
    if org is None or not org.is_active:
        raise HTTPException(status_code=404, detail="Organization not found")

    settings_blob: dict[str, Any] = dict(org.settings or {})
    umami: dict[str, Any] = settings_blob.get("umami") or {}

    # Resolve the default active booking profile slug for Aurinko-native booking.
    from sqlalchemy import select as _select
    from app.models.booking_profile import BookingProfile as _BookingProfile
    _profile_result = await db.execute(
        _select(_BookingProfile).where(
            _BookingProfile.org_id == org.id,
            _BookingProfile.is_active.is_(True),
        ).order_by(_BookingProfile.created_at.asc()).limit(1)
    )
    _profile = _profile_result.scalar_one_or_none()

    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"

    return PublicBrandingResponse(
        slug=org.slug,
        name=org.name,
        logo_url=org.logo_url,
        primary_color=settings_blob.get("brand_primary_color") or None,
        accent_color=settings_blob.get("brand_accent_color") or None,
        dashboard_intro=settings_blob.get("dashboard_intro") or None,
        booking_profile_slug=_profile.slug if _profile else None,
        umami_website_id=umami.get("website_id") or None,
    )
