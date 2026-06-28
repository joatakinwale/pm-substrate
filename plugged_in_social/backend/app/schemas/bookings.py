"""Booking schemas — provider-neutral."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class BookingCreate(BaseModel):
    """Created from a webhook handler or by an admin importing manually.

    ``external_event_id`` is the dedup key — Aurinko's booking id for
    new rows, the Cal.com event UID for legacy data preserved by the
    cutover migration.
    """

    lead_id: uuid.UUID | None = None
    provider: str = "aurinko"
    external_event_id: str = Field(max_length=255)
    external_booking_uid: str | None = None
    aurinko_profile_id: int | None = None
    integration_account_id: uuid.UUID | None = None
    reschedule_token: str | None = None
    event_type: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = None
    attendee_name: str | None = None
    attendee_email: EmailStr | None = None
    meeting_url: str | None = None
    timezone: str | None = None
    notes: str | None = None
    status: str | None = None
    external_payload: dict = {}


class BookingUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    scheduled_at: datetime | None = None
    meeting_url: str | None = None


class LeadSummary(BaseModel):
    """Lightweight lead preview embedded on a booking response."""

    id: uuid.UUID
    full_name: str | None = None
    email: EmailStr | None = None
    qualification_status: str | None = None

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_id: uuid.UUID | None
    provider: str
    external_event_id: str
    external_booking_uid: str | None = None
    aurinko_profile_id: int | None = None
    integration_account_id: uuid.UUID | None = None
    reschedule_token: str | None = None
    event_type: str | None
    status: str
    scheduled_at: datetime
    duration_minutes: int | None
    timezone: str | None = None
    attendee_name: str | None
    attendee_email: str | None
    meeting_url: str | None = None
    notes: str | None
    reminder_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Derived lead preview (eager-loaded). Kept optional so manual
    # BookingResponse.model_validate(row) works for rows without .lead set.
    lead: LeadSummary | None = None

    model_config = {"from_attributes": True}
