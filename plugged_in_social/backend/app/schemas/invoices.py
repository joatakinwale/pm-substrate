"""Invoice schemas — create, update, response, and revenue aggregation."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Line item (embedded in invoice) ──────────────────────────
class LineItem(BaseModel):
    description: str
    amount_cents: int = Field(ge=0)
    quantity: int = Field(default=1, ge=1)


# ── Create / Update ─────────────────────────────────────────
class InvoiceCreate(BaseModel):
    """Create a new invoice (draft by default)."""
    client_name: str = Field(max_length=255)
    client_email: str = Field(max_length=255)
    line_items: list[LineItem] = Field(min_length=1)
    description: str | None = None
    due_days: int = Field(default=30, ge=1, le=365)
    currency: str = Field(default="usd", max_length=3)
    compound_phase: str | None = Field(
        default=None,
        description="Compound Method phase: protect, deepen, amplify",
    )
    lead_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    internal_notes: str | None = None
    # If True, also create in Stripe and sync IDs back
    sync_to_stripe: bool = False


class InvoiceUpdate(BaseModel):
    status: str | None = None
    description: str | None = None
    internal_notes: str | None = None
    compound_phase: str | None = None
    due_date: datetime | None = None


# ── Response ─────────────────────────────────────────────────
class InvoiceResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    stripe_invoice_id: str | None
    stripe_customer_id: str | None
    stripe_hosted_invoice_url: str | None
    stripe_invoice_pdf: str | None
    lead_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    status: str
    currency: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    amount_paid_cents: int
    amount_due_cents: int
    client_name: str | None
    client_email: str | None
    due_date: datetime | None
    paid_at: datetime | None
    period_start: datetime | None
    period_end: datetime | None
    compound_phase: str | None
    line_items: list | dict | None
    description: str | None
    internal_notes: str | None
    reminder_count: int
    last_reminder_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Revenue aggregation ──────────────────────────────────────
class RevenueByPhase(BaseModel):
    """Revenue broken down by Compound Method phase."""
    phase: str
    total_cents: int
    invoice_count: int


class RevenueSummary(BaseModel):
    """Top-level revenue dashboard response."""
    total_revenue_cents: int
    total_outstanding_cents: int
    total_invoices: int
    paid_invoices: int
    overdue_invoices: int
    mrr_cents: int  # Monthly recurring revenue from subscriptions
    active_subscriptions: int
    by_phase: list[RevenueByPhase]
