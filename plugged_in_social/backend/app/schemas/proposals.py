"""Proposal and onboarding schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Block schema ─────────────────────────────────────────────
class ProposalBlock(BaseModel):
    """A single block in the 12-part Compound Method proposal."""
    type: str = Field(description="Block type key, e.g. 'executive_summary'")
    title: str
    content: str = ""
    order: int = Field(ge=1, le=12)


# ── Create / Update ─────────────────────────────────────────
class ProposalCreate(BaseModel):
    """Create a new proposal from lead/contact data."""
    client_name: str = Field(max_length=255)
    client_email: str = Field(max_length=255)
    client_company: str | None = None
    title: str = Field(
        default="Compound Method Strategy Proposal",
        max_length=500,
    )
    compound_phase: str | None = Field(
        default=None,
        description="Initial Compound Method phase: protect, deepen, amplify",
    )
    total_cents: int = Field(default=0, ge=0)
    currency: str = Field(default="usd", max_length=3)
    billing_interval: str = Field(default="month")
    blocks: list[ProposalBlock] | None = Field(
        default=None,
        description="Custom blocks. If None, the 12 default Compound Method blocks are used.",
    )
    lead_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    internal_notes: str | None = None
    agent_role: str | None = None


class ProposalUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    compound_phase: str | None = None
    total_cents: int | None = None
    billing_interval: str | None = None
    blocks: list[ProposalBlock] | None = None
    internal_notes: str | None = None


class ProposalBlockUpdate(BaseModel):
    """Update a single block's content."""
    block_type: str
    content: str


# ── Response ─────────────────────────────────────────────────
class ProposalResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    title: str
    status: str
    version: int
    client_name: str
    client_email: str
    client_company: str | None
    compound_phase: str | None
    total_cents: int
    currency: str
    billing_interval: str
    blocks: list
    share_token: str
    expires_at: datetime | None
    viewed_at: datetime | None
    view_count: int
    sent_at: datetime | None
    signed_at: datetime | None
    signer_name: str | None
    generated_invoice_id: uuid.UUID | None
    generated_project_id: uuid.UUID | None
    internal_notes: str | None
    agent_role: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProposalPublicResponse(BaseModel):
    """Public view for clients — no internal notes or org_id."""
    id: uuid.UUID
    title: str
    status: str
    client_name: str
    client_company: str | None
    compound_phase: str | None
    total_cents: int
    currency: str
    billing_interval: str
    blocks: list
    signed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Onboarding ───────────────────────────────────────────────
class OnboardingResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    proposal_id: uuid.UUID
    lead_id: uuid.UUID | None
    client_name: str
    client_email: str
    status: str
    intake_form_sent_at: datetime | None
    intake_form_completed_at: datetime | None
    brand_voice_sent_at: datetime | None
    brand_voice_completed_at: datetime | None
    strategy_call_scheduled_at: datetime | None
    completed_at: datetime | None
    internal_notes: str | None
    agent_role: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OnboardingUpdate(BaseModel):
    status: str | None = None
    internal_notes: str | None = None


class IntakeFormSubmission(BaseModel):
    """Public endpoint for clients to submit their intake form."""
    data: dict = Field(description="Form response data from SurveyJS")
