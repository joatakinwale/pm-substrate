"""Aurinko Group Booking API — multi-account / round-robin scheduling.

Reference: https://docs.aurinko.io/scheduling/group-booking-api

Sketch of the flow:

  1. POST /v1/book/group/profiles                     create_group_booking_profile
  2. POST /v1/book/group/profiles/{id}/attachAccounts attach_accounts_to_group_profile
  3. GET  /v1/book/group/profiles/{id}/meeting        get_group_meeting_slots
  4. POST /v1/book/group/profiles/{id}/meeting        (use book_group_meeting below)

`required` is "one" for round-robin (any free member) and "all" for
collective availability (every listed account must be free).
"""
from __future__ import annotations

from typing import Any, Literal

from .client import app_request

Required = Literal["one", "all"]


async def create_group_booking_profile(*, profile: dict[str, Any]) -> dict:
    return await app_request("POST", "/book/group/profiles", json=profile)


async def attach_accounts_to_group_profile(
    *,
    profile_id: int,
    groups: list[dict[str, Any]],
) -> dict:
    """Associate accounts (and group sub-buckets) with a group profile.

    ``groups`` is a list of ``{extId, accountIds[], required}`` records.
    """
    return await app_request(
        "POST",
        f"/book/group/profiles/{profile_id}/attachAccounts",
        json={"groups": groups},
    )


async def get_group_meeting_slots(
    *,
    profile_id: int,
    from_iso: str,
    to_iso: str,
    required: Required = "one",
) -> dict:
    return await app_request(
        "GET",
        f"/book/group/profiles/{profile_id}/meeting",
        params={"from": from_iso, "to": to_iso, "required": required},
    )


async def book_group_meeting(
    *,
    profile_id: int,
    when_start_iso: str,
    when_end_iso: str,
    name: str,
    email: str,
    required: Required = "one",
    group_xids: list[str] | None = None,
    account_ids: list[int] | None = None,
    comments: str | None = None,
) -> dict:
    payload: dict[str, Any] = {
        "time": {"start": when_start_iso, "end": when_end_iso},
        "name": name,
        "email": email,
    }
    if group_xids:
        payload["groupXids"] = group_xids
    if account_ids:
        payload["accountIds"] = account_ids
    if comments is not None:
        payload["substitutionData"] = {"comments": comments}
    return await app_request(
        "POST",
        f"/book/group/profiles/{profile_id}/meeting",
        params={"required": required},
        json=payload,
    )
