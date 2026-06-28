"""Aurinko per-account Booking API.

Reference: https://docs.aurinko.io/scheduling/booking-api

Profile lifecycle:
  POST   /v1/book/account/profiles                  → create_booking_profile
  PATCH  /v1/book/account/profiles/{id}             → update_booking_profile
  DELETE /v1/book/account/profiles/{id}             → delete_booking_profile

Slot + booking flow:
  GET    /v1/book/account/profiles/{id}/meeting     → get_meeting_slots
  POST   /v1/book/account/profiles/{id}/meeting     → book_meeting
  PATCH  /v1/book/account/profiles/{id}/meeting/... → reschedule_meeting
  DELETE /v1/book/account/profiles/{id}/meeting/... → cancel_meeting
"""
from __future__ import annotations

from typing import Any

from .client import account_request, app_request


async def create_booking_profile(
    *,
    access_token: str,
    profile: dict[str, Any],
) -> dict:
    """Create a booking profile on the connected account.

    ``profile`` follows Aurinko's schema; key fields:
      - name (str)
      - duration (minutes, int)
      - workHours (list of {dayOfWeek, startMinute, endMinute})
      - subject (templated, supports {{name}}, {{comments}})
      - description (templated, supports {{rescheduleToken}})
      - location (str — Zoom/Meet/Teams/phone/address)
      - teleconference (provider-specific block)
      - bufferBefore / bufferAfter (minutes)
    """
    return await account_request(
        "POST",
        "/book/account/profiles",
        access_token=access_token,
        json=profile,
    )


async def update_booking_profile(
    *,
    access_token: str,
    profile_id: int,
    patch: dict[str, Any],
) -> dict:
    return await account_request(
        "PATCH",
        f"/book/account/profiles/{profile_id}",
        access_token=access_token,
        json=patch,
    )


async def delete_booking_profile(*, access_token: str, profile_id: int) -> None:
    await account_request(
        "DELETE",
        f"/book/account/profiles/{profile_id}",
        access_token=access_token,
    )


async def get_meeting_slots(
    *,
    profile_id: int,
    from_iso: str,
    to_iso: str,
    timezone: str | None = None,
) -> dict:
    """Fetch available time slots between ``from_iso`` and ``to_iso``.

    Aurinko docs note this endpoint is callable with app-level (Basic)
    auth, since the profile id alone is enough to identify which
    calendar to consult.
    """
    params: dict[str, Any] = {"from": from_iso, "to": to_iso}
    if timezone:
        params["timezone"] = timezone
    return await app_request(
        "GET",
        f"/book/account/profiles/{profile_id}/meeting",
        params=params,
    )


async def book_meeting(
    *,
    profile_id: int,
    when_start_iso: str,
    when_end_iso: str,
    name: str,
    email: str,
    comments: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict:
    """Book a meeting in an available slot.

    Returns the booking record including ``rescheduleToken`` and
    ``meetingUrl`` (when the profile defines a teleconference link).
    """
    payload: dict[str, Any] = {
        "time": {"start": when_start_iso, "end": when_end_iso},
        "name": name,
        "email": email,
    }
    if comments is not None:
        payload["substitutionData"] = {"comments": comments}
    if extra:
        payload.update(extra)
    return await app_request(
        "POST",
        f"/book/account/profiles/{profile_id}/meeting",
        json=payload,
    )


async def reschedule_meeting(
    *,
    profile_id: int,
    reschedule_token: str,
    when_start_iso: str,
    when_end_iso: str,
) -> dict:
    """Reschedule a previously booked meeting using its reschedule token.

    The token is what Aurinko surfaces via ``{{rescheduleToken}}`` in
    the confirmation email and is the key that lets unauthenticated
    clients reschedule themselves.
    """
    return await app_request(
        "PATCH",
        f"/book/account/profiles/{profile_id}/meeting/{reschedule_token}",
        json={"time": {"start": when_start_iso, "end": when_end_iso}},
    )


async def cancel_meeting(
    *,
    profile_id: int,
    reschedule_token: str,
    reason: str | None = None,
) -> None:
    params: dict[str, Any] = {}
    if reason:
        params["reason"] = reason
    await app_request(
        "DELETE",
        f"/book/account/profiles/{profile_id}/meeting/{reschedule_token}",
        params=params or None,
    )
