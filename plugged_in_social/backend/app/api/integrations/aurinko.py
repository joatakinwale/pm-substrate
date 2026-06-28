"""Aurinko integration management endpoints.

Authenticated (admin/owner) endpoints for connecting and managing
Aurinko calendar accounts per org.

Routes:
  GET    /api/integrations/aurinko/authorize          → initiate OAuth, redirect to Aurinko
  GET    /api/integrations/aurinko/callback           → exchange code, persist IntegrationAccount
  GET    /api/integrations/aurinko/accounts           → list connected accounts
  DELETE /api/integrations/aurinko/accounts/{id}     → disconnect account
  POST   /api/integrations/aurinko/accounts/{id}/sync → trigger initial sync
  POST   /api/integrations/aurinko/booking-profiles  → create booking profile
  PATCH  /api/integrations/aurinko/booking-profiles/{id} → update booking profile
  DELETE /api/integrations/aurinko/booking-profiles/{id} → delete booking profile
"""
from __future__ import annotations

import json
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.integrations.aurinko.auth import (
    ServiceType,
    build_authorize_url,
    exchange_code,
    revoke_account,
)
from app.integrations.aurinko.booking import (
    create_booking_profile,
    delete_booking_profile,
    update_booking_profile,
)
from app.integrations.aurinko.client import AurinkoNotConfiguredError
from app.integrations.aurinko.contacts import list_contacts
from app.integrations.aurinko.subscriptions import (
    create_subscription,
    delete_subscription,
)
from app.models.booking_profile import BookingProfile
from app.models.integration_account import IntegrationAccount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/aurinko", tags=["aurinko-integrations"])


# ── Helpers ───────────────────────────────────────────────

def _aurinko_503() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Aurinko integration is not configured on this server.",
    )


def _build_callback_url(request: Request) -> str:
    """Return the absolute URL for the OAuth callback endpoint."""
    return str(request.url_for("aurinko_callback"))


# ── Schemas ───────────────────────────────────────────────

class IntegrationAccountResponse(BaseModel):
    id: str
    provider: str
    service_type: str | None
    email: str | None
    scopes: list[str]
    is_active: bool
    is_default_for_booking: bool
    last_calendar_sync_at: str | None
    last_contacts_sync_at: str | None
    connected_at: str

    model_config = {"from_attributes": True}


class BookingProfileCreate(BaseModel):
    name: str
    duration_minutes: int = 30
    working_hours: list[dict] = []
    location: dict = {}
    buffer_before_minutes: int = 0
    buffer_after_minutes: int = 0
    subject: str | None = None
    description: str | None = None


class BookingProfileUpdate(BaseModel):
    name: str | None = None
    duration_minutes: int | None = None
    working_hours: list[dict] | None = None
    location: dict | None = None
    buffer_before_minutes: int | None = None
    buffer_after_minutes: int | None = None
    subject: str | None = None
    description: str | None = None


class BookingProfileResponse(BaseModel):
    id: str
    aurinko_profile_id: int
    kind: str
    name: str
    slug: str
    duration_minutes: int
    working_hours: list[dict]
    location: dict
    buffer_before_minutes: int
    buffer_after_minutes: int
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


# ── OAuth flow ────────────────────────────────────────────

@router.get("/authorize", name="aurinko_authorize")
async def authorize(
    request: Request,
    service_type: ServiceType = Query("Google"),
    current_user: dict = Depends(get_current_user),
):
    """Initiate the Aurinko OAuth flow.

    Builds the Aurinko authorize URL and 302-redirects the browser.
    The ``state`` encodes org_id + user_id + a CSRF nonce — Aurinko
    round-trips it back unchanged to the callback.
    """
    try:
        return_url = _build_callback_url(request)
        state_data = {
            "org_id": current_user["org_id"],
            "user_id": current_user["sub"],
            "nonce": secrets.token_urlsafe(16),
        }
        state = json.dumps(state_data)
        url = build_authorize_url(
            service_type=service_type,
            return_url=return_url,
            state=state,
        )
    except AurinkoNotConfiguredError:
        raise _aurinko_503()

    return RedirectResponse(url=url, status_code=302)


@router.get("/callback", name="aurinko_callback")
async def callback(
    request: Request,
    code: str = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Handle the Aurinko OAuth callback.

    Exchanges the one-time ``code`` for an access token, persists an
    ``IntegrationAccount`` row, and creates webhook subscriptions.
    """
    try:
        token_data = await exchange_code(code)
    except AurinkoNotConfiguredError:
        raise _aurinko_503()
    except Exception as exc:
        logger.error("aurinko_callback_exchange_failed error=%s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange Aurinko authorization code.",
        )

    aurinko_account_id: int = token_data["accountId"]
    access_token: str = token_data["accessToken"]
    service_type: str | None = token_data.get("serviceType")
    email: str | None = token_data.get("email")
    scopes: list[str] = token_data.get("scopes", [])
    if isinstance(scopes, str):
        scopes = scopes.split()

    org_id = uuid.UUID(current_user["org_id"])
    user_id = uuid.UUID(current_user["sub"])

    # Upsert — if the same Aurinko account reconnects, refresh its token.
    result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.aurinko_account_id == aurinko_account_id
        )
    )
    account = result.scalar_one_or_none()

    if account is None:
        account = IntegrationAccount(
            org_id=org_id,
            connected_by_user_id=user_id,
            aurinko_account_id=aurinko_account_id,
            aurinko_access_token=access_token,
            service_type=service_type,
            email=email,
            scopes=scopes,
        )
        db.add(account)
        await db.flush()  # get account.id
    else:
        # Reconnect — update token + clear disconnected_at
        account.aurinko_access_token = access_token
        account.service_type = service_type
        account.email = email
        account.scopes = scopes
        account.disconnected_at = None

    # Create webhook subscriptions for calendar + contacts.
    # Best-effort: if subscription creation fails we still save the account
    # so the user isn't left in a broken state. The subscription can be
    # re-created on the next sync or via a follow-up action.
    notification_url = str(request.base_url).rstrip("/") + "/internal/webhooks/aurinko"
    sub_ids: dict[str, int] = {}
    for resource in ("/calendars/primary/events", "/contacts"):
        try:
            sub = await create_subscription(
                access_token=access_token,
                resource=resource,
                notification_url=notification_url,
            )
            sub_ids[resource] = sub["id"]
        except Exception as exc:
            logger.warning(
                "aurinko_subscription_create_failed resource=%s error=%s",
                resource,
                exc,
            )

    account.webhook_subscription_ids = sub_ids
    await db.commit()
    await db.refresh(account)

    # Kick off initial contacts sync asynchronously.
    # Fire-and-forget — errors are logged but don't fail the callback.
    try:
        contacts_data = await list_contacts(access_token=access_token, page_token=None)
        logger.info(
            "aurinko_initial_contacts_fetched account_id=%s count=%s",
            aurinko_account_id,
            len(contacts_data.get("records", [])),
        )
        account.last_contacts_sync_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as exc:
        logger.warning(
            "aurinko_initial_contacts_sync_failed account_id=%s error=%s",
            aurinko_account_id,
            exc,
        )

    return {
        "connected": True,
        "account_id": str(account.id),
        "aurinko_account_id": aurinko_account_id,
        "email": email,
        "service_type": service_type,
    }


# ── Account management ────────────────────────────────────

@router.get("/accounts", response_model=list[IntegrationAccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List connected Aurinko accounts for the current org."""
    result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.disconnected_at.is_(None)
        )
    )
    accounts = result.scalars().all()
    return [
        IntegrationAccountResponse(
            id=str(a.id),
            provider=a.provider,
            service_type=a.service_type,
            email=a.email,
            scopes=a.scopes or [],
            is_active=a.is_active,
            is_default_for_booking=a.is_default_for_booking,
            last_calendar_sync_at=(
                a.last_calendar_sync_at.isoformat() if a.last_calendar_sync_at else None
            ),
            last_contacts_sync_at=(
                a.last_contacts_sync_at.isoformat() if a.last_contacts_sync_at else None
            ),
            connected_at=a.created_at.isoformat(),
        )
        for a in accounts
    ]


@router.delete(
    "/accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def disconnect_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Disconnect a connected Aurinko account.

    Revokes the token on Aurinko's side, tears down subscriptions, and
    marks the local row as ``disconnected_at = now()``. Best-effort on
    external calls — the local row is always stamped so the account
    disappears from the list.
    """
    result = await db.execute(
        select(IntegrationAccount).where(IntegrationAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Integration account not found")

    # Tear down subscriptions (best-effort).
    for resource, sub_id in (account.webhook_subscription_ids or {}).items():
        try:
            await delete_subscription(
                access_token=account.aurinko_access_token,
                subscription_id=int(sub_id),
            )
        except Exception as exc:
            logger.warning(
                "aurinko_subscription_delete_failed resource=%s sub_id=%s error=%s",
                resource,
                sub_id,
                exc,
            )

    # Revoke token (best-effort).
    try:
        await revoke_account(
            account_id=account.aurinko_account_id,
            access_token=account.aurinko_access_token,
        )
    except Exception as exc:
        logger.warning(
            "aurinko_revoke_failed account_id=%s error=%s",
            account.aurinko_account_id,
            exc,
        )

    account.disconnected_at = datetime.now(timezone.utc)
    account.webhook_subscription_ids = {}
    await db.commit()


@router.post("/accounts/{account_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Trigger initial calendar + contacts sync for a connected account.

    Fetches the first page of contacts from Aurinko and updates
    ``last_contacts_sync_at``. Full calendar sync happens via webhook
    subscriptions; this endpoint serves as the manual trigger.
    """
    result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.id == account_id,
            IntegrationAccount.disconnected_at.is_(None),
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Integration account not found")

    synced: dict[str, Any] = {}
    try:
        contacts_data = await list_contacts(
            access_token=account.aurinko_access_token,
            page_token=None,
        )
        synced["contacts_fetched"] = len(contacts_data.get("records", []))
        account.last_contacts_sync_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as exc:
        logger.error(
            "aurinko_sync_contacts_failed account_id=%s error=%s",
            account_id,
            exc,
        )
        synced["contacts_error"] = str(exc)

    return {"accepted": True, "synced": synced}


# ── Booking profile management ────────────────────────────

@router.post(
    "/booking-profiles",
    response_model=BookingProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_profile(
    body: BookingProfileCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create an Aurinko booking profile for the org.

    Requires a connected ``IntegrationAccount`` marked as default for
    booking. The profile is pushed to Aurinko and mirrored locally.
    """
    org_id = uuid.UUID(current_user["org_id"])

    # Find the default booking account for this org.
    result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.org_id == org_id,
            IntegrationAccount.is_default_for_booking.is_(True),
            IntegrationAccount.disconnected_at.is_(None),
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        # Fall back to any active account.
        result = await db.execute(
            select(IntegrationAccount).where(
                IntegrationAccount.org_id == org_id,
                IntegrationAccount.disconnected_at.is_(None),
            )
        )
        account = result.scalars().first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No connected Aurinko account found. Connect a calendar account first.",
        )

    # Build Aurinko API payload.
    profile_payload: dict[str, Any] = {
        "name": body.name,
        "duration": body.duration_minutes,
        "bufferBefore": body.buffer_before_minutes,
        "bufferAfter": body.buffer_after_minutes,
        "workHours": body.working_hours,
        "location": body.location.get("value", ""),
    }
    if body.subject:
        profile_payload["subject"] = body.subject
    if body.description:
        profile_payload["description"] = body.description

    try:
        aurinko_resp = await create_booking_profile(
            access_token=account.aurinko_access_token,
            profile=profile_payload,
        )
    except AurinkoNotConfiguredError:
        raise _aurinko_503()
    except Exception as exc:
        logger.error("aurinko_create_profile_failed error=%s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Aurinko profile creation failed: {exc}",
        )

    aurinko_profile_id: int = aurinko_resp["id"]
    slug: str = aurinko_resp.get("slug", str(aurinko_profile_id))

    profile = BookingProfile(
        org_id=org_id,
        integration_account_id=account.id,
        aurinko_profile_id=aurinko_profile_id,
        kind="account",
        name=body.name,
        slug=slug,
        duration_minutes=body.duration_minutes,
        working_hours=body.working_hours,
        location=body.location,
        buffer_before_minutes=body.buffer_before_minutes,
        buffer_after_minutes=body.buffer_after_minutes,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return BookingProfileResponse(
        id=str(profile.id),
        aurinko_profile_id=profile.aurinko_profile_id,
        kind=profile.kind,
        name=profile.name,
        slug=profile.slug,
        duration_minutes=profile.duration_minutes,
        working_hours=profile.working_hours or [],
        location=profile.location or {},
        buffer_before_minutes=profile.buffer_before_minutes,
        buffer_after_minutes=profile.buffer_after_minutes,
        is_active=profile.is_active,
        created_at=profile.created_at.isoformat(),
    )


@router.patch(
    "/booking-profiles/{profile_id}",
    response_model=BookingProfileResponse,
)
async def update_profile(
    profile_id: uuid.UUID,
    body: BookingProfileUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Update an existing Aurinko booking profile."""
    result = await db.execute(
        select(BookingProfile).where(BookingProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Booking profile not found")

    # Find the account that owns this profile.
    acc_result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.id == profile.integration_account_id,
            IntegrationAccount.disconnected_at.is_(None),
        )
    )
    account = acc_result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The integration account for this profile is no longer connected.",
        )

    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.duration_minutes is not None:
        patch["duration"] = body.duration_minutes
    if body.buffer_before_minutes is not None:
        patch["bufferBefore"] = body.buffer_before_minutes
    if body.buffer_after_minutes is not None:
        patch["bufferAfter"] = body.buffer_after_minutes
    if body.working_hours is not None:
        patch["workHours"] = body.working_hours
    if body.location is not None:
        patch["location"] = body.location.get("value", "")
    if body.subject is not None:
        patch["subject"] = body.subject
    if body.description is not None:
        patch["description"] = body.description

    try:
        await update_booking_profile(
            access_token=account.aurinko_access_token,
            profile_id=profile.aurinko_profile_id,
            patch=patch,
        )
    except AurinkoNotConfiguredError:
        raise _aurinko_503()
    except Exception as exc:
        logger.error("aurinko_update_profile_failed profile_id=%s error=%s", profile_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Aurinko profile update failed: {exc}",
        )

    # Mirror local fields.
    if body.name is not None:
        profile.name = body.name
    if body.duration_minutes is not None:
        profile.duration_minutes = body.duration_minutes
    if body.buffer_before_minutes is not None:
        profile.buffer_before_minutes = body.buffer_before_minutes
    if body.buffer_after_minutes is not None:
        profile.buffer_after_minutes = body.buffer_after_minutes
    if body.working_hours is not None:
        profile.working_hours = body.working_hours
    if body.location is not None:
        profile.location = body.location

    await db.commit()
    await db.refresh(profile)

    return BookingProfileResponse(
        id=str(profile.id),
        aurinko_profile_id=profile.aurinko_profile_id,
        kind=profile.kind,
        name=profile.name,
        slug=profile.slug,
        duration_minutes=profile.duration_minutes,
        working_hours=profile.working_hours or [],
        location=profile.location or {},
        buffer_before_minutes=profile.buffer_before_minutes,
        buffer_after_minutes=profile.buffer_after_minutes,
        is_active=profile.is_active,
        created_at=profile.created_at.isoformat(),
    )


@router.delete(
    "/booking-profiles/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_profile(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Delete a booking profile locally and from Aurinko."""
    result = await db.execute(
        select(BookingProfile).where(BookingProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Booking profile not found")

    acc_result = await db.execute(
        select(IntegrationAccount).where(
            IntegrationAccount.id == profile.integration_account_id,
        )
    )
    account = acc_result.scalar_one_or_none()

    if account and account.is_active:
        try:
            await delete_booking_profile(
                access_token=account.aurinko_access_token,
                profile_id=profile.aurinko_profile_id,
            )
        except Exception as exc:
            logger.warning(
                "aurinko_delete_profile_aurinko_failed profile_id=%s error=%s",
                profile_id,
                exc,
            )

    profile.is_active = False
    await db.commit()
