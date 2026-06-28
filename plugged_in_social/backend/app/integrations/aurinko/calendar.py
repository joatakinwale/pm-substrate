"""Aurinko Calendar API — read calendars and events on a connected account."""
from __future__ import annotations

from typing import Any

from .client import account_request


async def list_calendars(*, access_token: str) -> dict:
    """GET /v1/calendars — list calendars on the connected mailbox."""
    return await account_request("GET", "/calendars", access_token=access_token)


async def list_calendar_events(
    *,
    access_token: str,
    calendar_id: str = "primary",
    from_iso: str | None = None,
    to_iso: str | None = None,
    page_token: str | None = None,
) -> dict:
    """GET /v1/calendars/{calendarId}/events — paged event list."""
    params: dict[str, Any] = {}
    if from_iso:
        params["start"] = from_iso
    if to_iso:
        params["end"] = to_iso
    if page_token:
        params["pageToken"] = page_token
    return await account_request(
        "GET",
        f"/calendars/{calendar_id}/events",
        access_token=access_token,
        params=params or None,
    )


async def get_calendar_event(
    *,
    access_token: str,
    event_id: str,
    calendar_id: str = "primary",
) -> dict:
    """GET a single event by id — used by the booking webhook handler
    to backfill canonical event data when only an id is delivered."""
    return await account_request(
        "GET",
        f"/calendars/{calendar_id}/events/{event_id}",
        access_token=access_token,
    )
