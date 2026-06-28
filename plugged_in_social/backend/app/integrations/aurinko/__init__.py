"""Aurinko unified-email/calendar/scheduling SDK.

One typed wrapper around the Aurinko REST API used by the booking,
calendar, contacts, and webhook code paths. App-level (Basic) auth is
used for OAuth + booking-profile management; per-account bearer auth
is used for calendar/contacts ops on a connected mailbox.

Reference: https://docs.aurinko.io/
"""
from .auth import build_authorize_url, exchange_code, revoke_account
from .booking import (
    book_meeting,
    cancel_meeting,
    create_booking_profile,
    delete_booking_profile,
    get_meeting_slots,
    reschedule_meeting,
    update_booking_profile,
)
from .calendar import list_calendar_events, list_calendars
from .client import AurinkoError, AurinkoNotConfiguredError
from .contacts import list_contacts
from .group_booking import (
    attach_accounts_to_group_profile,
    create_group_booking_profile,
    get_group_meeting_slots,
)
from .signatures import verify_webhook_signature
from .subscriptions import create_subscription, delete_subscription

__all__ = [
    "AurinkoError",
    "AurinkoNotConfiguredError",
    "attach_accounts_to_group_profile",
    "book_meeting",
    "build_authorize_url",
    "cancel_meeting",
    "create_booking_profile",
    "create_group_booking_profile",
    "create_subscription",
    "delete_booking_profile",
    "delete_subscription",
    "exchange_code",
    "get_group_meeting_slots",
    "get_meeting_slots",
    "list_calendar_events",
    "list_calendars",
    "list_contacts",
    "reschedule_meeting",
    "revoke_account",
    "update_booking_profile",
    "verify_webhook_signature",
]
