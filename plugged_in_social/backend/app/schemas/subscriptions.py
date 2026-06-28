"""Subscription schemas — create, update, response."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubscriptionCreate(BaseModel):
    """Create a subscription via Stripe."""
    client_name: str = Field(max_length=255)
    client_email: str = Field(max_length=255)
    price_id: str = Field(
        max_length=255,
        description="Stripe Price ID (price_xxx)",
    )
    plan_name: str | None = None
    compound_phase: str | None = Field(
        default=None,
        description="Compound Method phase: protect, deepen, amplify",
    )
    lead_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    trial_days: int | None = Field(default=None, ge=1, le=90)
    internal_notes: str | None = None


class SubscriptionUpdate(BaseModel):
    price_id: str | None = None
    plan_name: str | None = None
    compound_phase: str | None = None
    internal_notes: str | None = None


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    stripe_subscription_id: str
    stripe_customer_id: str
    stripe_price_id: str | None
    stripe_product_id: str | None
    lead_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    status: str
    plan_name: str | None
    amount_cents: int
    currency: str
    interval: str
    interval_count: int
    client_name: str | None
    client_email: str | None
    compound_phase: str | None
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at: datetime | None
    canceled_at: datetime | None
    trial_start: datetime | None
    trial_end: datetime | None
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
