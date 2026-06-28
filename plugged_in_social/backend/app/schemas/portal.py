"""Client portal schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Auth ────────────────────────────────────────────────────
class PortalAuthRequest(BaseModel):
    """Validate a magic-link token and start a session."""
    token: str


class PortalAuthResponse(BaseModel):
    session_token: str
    client_email: str
    client_name: str | None
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    expires_at: datetime


class PortalInviteRequest(BaseModel):
    """Agency sends a portal invite to a client."""
    client_email: str
    client_name: str | None = None
    project_id: uuid.UUID | None = None


class PortalInviteResponse(BaseModel):
    id: uuid.UUID
    token: str
    client_email: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Portal views (client-facing) ───────────────────────────
class PortalProjectSummary(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    compound_phase: str | None
    start_date: datetime | None
    target_date: datetime | None
    pending_approvals: int = 0


class PortalTaskView(BaseModel):
    """Task visible in client portal (Step 9 only)."""
    id: uuid.UUID
    title: str
    description: str | None
    priority: str
    due_date: datetime | None
    attachments: list
    client_approved: bool
    client_feedback: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortalApprovalRequest(BaseModel):
    """Client approves or requests revisions on a task."""
    approved: bool
    feedback: str | None = None


class PortalCommentCreate(BaseModel):
    content: str


class PortalInvoiceView(BaseModel):
    id: uuid.UUID
    status: str
    total_cents: int
    amount_due_cents: int
    due_date: datetime | None
    paid_at: datetime | None
    line_items: list | dict
    stripe_hosted_invoice_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortalProposalView(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    blocks: list | dict
    total_monthly_cents: int
    total_setup_cents: int
    sent_at: datetime | None
    signed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
