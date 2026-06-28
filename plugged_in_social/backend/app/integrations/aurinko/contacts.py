"""Aurinko Contacts API — read contacts on a connected account."""
from __future__ import annotations

from typing import Any

from .client import account_request


async def list_contacts(
    *,
    access_token: str,
    page_token: str | None = None,
    updated_after_iso: str | None = None,
) -> dict:
    """GET /v1/contacts — paged contact list.

    For incremental sync after the initial dump, pass
    ``updated_after_iso`` so Aurinko only returns rows changed since
    the last sync. The webhook fan-out covers the realtime path.
    """
    params: dict[str, Any] = {}
    if page_token:
        params["pageToken"] = page_token
    if updated_after_iso:
        params["updatedAfter"] = updated_after_iso
    return await account_request(
        "GET",
        "/contacts",
        access_token=access_token,
        params=params or None,
    )


async def get_contact(*, access_token: str, contact_id: str) -> dict:
    return await account_request(
        "GET",
        f"/contacts/{contact_id}",
        access_token=access_token,
    )
