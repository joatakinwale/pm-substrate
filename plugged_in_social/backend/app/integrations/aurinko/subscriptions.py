"""Aurinko webhook subscriptions.

Each connected account opts into change notifications for one or more
resources. We always subscribe to:

  * ``/calendars/primary/events`` — feeds the two-way calendar sync.
  * ``/contacts``                 — feeds the contacts sync.

Booking-resource subscriptions (``/booking/{bookingId}``) are created
on demand by the booking flow; they're per-booking and short-lived.
"""
from __future__ import annotations

from .client import account_request


async def create_subscription(
    *,
    access_token: str,
    resource: str,
    notification_url: str,
) -> dict:
    """POST /v1/subscriptions for the given account.

    Returns the subscription record (notably ``id`` which the caller
    must persist so it can be torn down on disconnect).
    """
    return await account_request(
        "POST",
        "/subscriptions",
        access_token=access_token,
        json={"resource": resource, "notificationUrl": notification_url},
    )


async def delete_subscription(*, access_token: str, subscription_id: int) -> None:
    """DELETE a subscription by id. Best-effort during disconnect."""
    await account_request(
        "DELETE",
        f"/subscriptions/{subscription_id}",
        access_token=access_token,
    )
