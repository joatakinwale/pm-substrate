"""Public (unauthenticated) booking endpoints.

These routes are called by the public-facing booking page.  No auth
required — anyone who knows the org + profile slug can query
availability and create a booking.

Routes:
  GET  /api/public/booking/{org_slug}/{profile_slug}
       → booking page info (org name, profile metadata)
  GET  /api/public/booking/{org_slug}/{profile_slug}/slots
       → available meeting slots (requires ?from= and ?to=)
  POST /api/public/booking/{org_slug}/{profile_slug}/book
       → create a booking
  PATCH /api/public/booking/{org_slug}/{profile_slug}/reschedule/{token}
       → reschedule a booking by reschedule token
  DELETE /api/public/booking/{org_slug}/{profile_slug}/cancel/{token}
       → cancel a booking by reschedule token
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_public
from app.integrations.aurinko.booking import (
    book_meeting,
    cancel_meeting,
    get_meeting_slots,
    reschedule_meeting,
)
from app.integrations.aurinko.client import AurinkoError, AurinkoNotConfiguredError
from app.models.booking_profile import BookingProfile
from app.models.integration_account import IntegrationAccount
from app.models.organization import Organization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public/booking", tags=["public-booking"])


# ── Helpers ───────────────────────────────────────────────

async def _get_profile_or_404(
    org_slug: str,
    profile_slug: str,
    db: AsyncSession,
) -> tuple[Organization, BookingProfile, IntegrationAccount]:
    """Resolve org + profile + connected account or raise 404."""
    org_result = await db.execute(
        select(Organization).where(
            Organization.slug == org_slug,
            Organization.is_active.is_(True),
        )
    )
    org = org_result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    profile_result = await db.execute(
        select(BookingProfile).where(
            BookingProfile.org_id == org.id,
            BookingProfile.slug == profile_slug,
            BookingProfile.is_active.is_(True),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Booking profile not found")

    if profile.integration_account_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This booking profile has no connected calendar account.",
        )

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
            detail="The calendar account for this booking profile is disconnected.",
        )

    return org, profile, account


# ── Schemas ───────────────────────────────────────────────

class BookingPageResponse(BaseModel):
    org_name: str
    org_slug: str
    profile_name: str
    profile_slug: str
    duration_minutes: int
    location: dict
    working_hours: list[dict]
    buffer_before_minutes: int
    buffer_after_minutes: int


class BookingRequest(BaseModel):
    when_start: str  # ISO 8601
    when_end: str    # ISO 8601
    name: str
    email: EmailStr
    comments: str | None = None


class RescheduleRequest(BaseModel):
    when_start: str  # ISO 8601
    when_end: str    # ISO 8601


# ── Routes ────────────────────────────────────────────────

@router.get("/{org_slug}/{profile_slug}", response_model=BookingPageResponse)
async def get_booking_page(
    org_slug: str,
    profile_slug: str,
    db: AsyncSession = Depends(get_db_public),
):
    """Return metadata for the booking page (org name, profile config).

    No auth required. Clients use this to render the booking UI before
    fetching availability slots.
    """
    org, profile, _account = await _get_profile_or_404(org_slug, profile_slug, db)
    return BookingPageResponse(
        org_name=org.name,
        org_slug=org.slug,
        profile_name=profile.name,
        profile_slug=profile.slug,
        duration_minutes=profile.duration_minutes,
        location=profile.location or {},
        working_hours=profile.working_hours or [],
        buffer_before_minutes=profile.buffer_before_minutes,
        buffer_after_minutes=profile.buffer_after_minutes,
    )


@router.get("/{org_slug}/{profile_slug}/slots")
async def get_slots(
    org_slug: str,
    profile_slug: str,
    start: str = Query(..., description="ISO 8601 start date/time (inclusive)"),
    end: str = Query(..., description="ISO 8601 end date/time (exclusive)"),
    timezone: str | None = Query(None, description="IANA timezone name for slot display"),
    db: AsyncSession = Depends(get_db_public),
):
    """Return available meeting slots between ``start`` and ``end``.

    Delegates to Aurinko's availability API using app-level (Basic) auth.
    No calendar-account token required for slot queries.
    """
    _org, profile, _account = await _get_profile_or_404(org_slug, profile_slug, db)

    try:
        slots = await get_meeting_slots(
            profile_id=profile.aurinko_profile_id,
            from_iso=start,
            to_iso=end,
            timezone=timezone,
        )
    except AurinkoNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Booking service is not configured.",
        )
    except AurinkoError as exc:
        logger.error(
            "aurinko_get_slots_failed profile_id=%s status=%s",
            profile.aurinko_profile_id,
            exc.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch availability from scheduling service.",
        )

    return slots


@router.post("/{org_slug}/{profile_slug}/book", status_code=status.HTTP_201_CREATED)
async def book(
    org_slug: str,
    profile_slug: str,
    body: BookingRequest,
    db: AsyncSession = Depends(get_db_public),
):
    """Book a meeting in the given slot.

    Returns the Aurinko booking record which includes ``rescheduleToken``
    (for the confirmation / reschedule link) and ``meetingUrl`` (when
    the profile defines a teleconference provider).
    """
    _org, profile, _account = await _get_profile_or_404(org_slug, profile_slug, db)

    try:
        result = await book_meeting(
            profile_id=profile.aurinko_profile_id,
            when_start_iso=body.when_start,
            when_end_iso=body.when_end,
            name=body.name,
            email=str(body.email),
            comments=body.comments,
        )
    except AurinkoNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Booking service is not configured.",
        )
    except AurinkoError as exc:
        logger.error(
            "aurinko_book_failed profile_id=%s status=%s",
            profile.aurinko_profile_id,
            exc.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create booking.",
        )

    return result


@router.patch("/{org_slug}/{profile_slug}/reschedule/{reschedule_token}")
async def reschedule(
    org_slug: str,
    profile_slug: str,
    reschedule_token: str,
    body: RescheduleRequest,
    db: AsyncSession = Depends(get_db_public),
):
    """Reschedule a previously booked meeting by its reschedule token.

    The reschedule token is included in Aurinko booking confirmation
    emails (``{{rescheduleToken}}``) and allows the attendee to
    self-serve a reschedule without authentication.
    """
    _org, profile, _account = await _get_profile_or_404(org_slug, profile_slug, db)

    try:
        result = await reschedule_meeting(
            profile_id=profile.aurinko_profile_id,
            reschedule_token=reschedule_token,
            when_start_iso=body.when_start,
            when_end_iso=body.when_end,
        )
    except AurinkoNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Booking service is not configured.",
        )
    except AurinkoError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Booking not found or token expired.")
        logger.error(
            "aurinko_reschedule_failed profile_id=%s status=%s",
            profile.aurinko_profile_id,
            exc.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reschedule booking.",
        )

    return result


@router.delete("/{org_slug}/{profile_slug}/cancel/{reschedule_token}")
async def cancel(
    org_slug: str,
    profile_slug: str,
    reschedule_token: str,
    reason: str | None = Query(None),
    db: AsyncSession = Depends(get_db_public),
):
    """Cancel a booking by its reschedule token.

    The reschedule token uniquely identifies the booking and authorises
    the cancellation without requiring user authentication.
    """
    _org, profile, _account = await _get_profile_or_404(org_slug, profile_slug, db)

    try:
        await cancel_meeting(
            profile_id=profile.aurinko_profile_id,
            reschedule_token=reschedule_token,
            reason=reason,
        )
    except AurinkoNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Booking service is not configured.",
        )
    except AurinkoError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Booking not found or token expired.")
        logger.error(
            "aurinko_cancel_failed profile_id=%s status=%s",
            profile.aurinko_profile_id,
            exc.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to cancel booking.",
        )

    return {"cancelled": True}
