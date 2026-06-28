"""Email campaign, template, form, and automation schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ═══ Email Templates ═════════════════════════════════════════

class TemplateCreate(BaseModel):
    name: str = Field(max_length=300)
    subject: str | None = None
    category: str = "marketing"
    html_body: str | None = None
    design_json: dict | None = None
    variables: list[str] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    category: str | None = None
    html_body: str | None = None
    compiled_html: str | None = None
    design_json: dict | None = None
    variables: list[str] | None = None


class TemplateResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    subject: str | None
    category: str
    html_body: str | None
    compiled_html: str | None
    design_json: dict | None
    variables: list | None
    thumbnail_url: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══ Email Campaigns ═════════════════════════════════════════

class CampaignCreate(BaseModel):
    name: str = Field(max_length=300)
    subject: str | None = None
    preview_text: str | None = None
    from_name: str | None = None
    from_email: str | None = None
    reply_to: str | None = None
    template_id: uuid.UUID | None = None
    html_body: str | None = None
    audience_filter: dict | None = None
    compound_phase: str | None = None
    scheduled_at: datetime | None = None
    ab_test: dict | None = None
    internal_notes: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    preview_text: str | None = None
    from_name: str | None = None
    from_email: str | None = None
    reply_to: str | None = None
    template_id: uuid.UUID | None = None
    html_body: str | None = None
    status: str | None = None
    audience_filter: dict | None = None
    compound_phase: str | None = None
    scheduled_at: datetime | None = None
    ab_test: dict | None = None
    internal_notes: str | None = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    subject: str | None
    preview_text: str | None
    from_name: str | None
    from_email: str | None
    reply_to: str | None
    template_id: uuid.UUID | None
    html_body: str | None
    status: str
    audience_filter: dict | None
    recipient_count: int
    compound_phase: str | None
    scheduled_at: datetime | None
    sent_at: datetime | None
    ab_test: dict | None
    total_sent: int
    total_delivered: int
    total_opened: int
    total_clicked: int
    total_bounced: int
    total_unsubscribed: int
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CampaignStats(BaseModel):
    total_sent: int
    total_delivered: int
    total_opened: int
    total_clicked: int
    total_bounced: int
    total_unsubscribed: int
    open_rate: float
    click_rate: float
    bounce_rate: float


# ═══ Forms ═══════════════════════════════════════════════════

class FormCreate(BaseModel):
    name: str = Field(max_length=300)
    slug: str = Field(max_length=200)
    description: str | None = None
    schema_json: dict = {}
    theme_json: dict | None = None
    notify_emails: list[str] | None = None
    success_message: str | None = None
    redirect_url: str | None = None
    automation_id: uuid.UUID | None = None


class FormUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    status: str | None = None
    schema_json: dict | None = None
    theme_json: dict | None = None
    notify_emails: list[str] | None = None
    success_message: str | None = None
    redirect_url: str | None = None
    automation_id: uuid.UUID | None = None


class FormResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    status: str
    schema_json: dict
    theme_json: dict | None
    notify_emails: list | None
    success_message: str | None
    redirect_url: str | None
    automation_id: uuid.UUID | None
    submission_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PublicFormResponse(BaseModel):
    name: str
    slug: str
    description: str | None
    schema_json: dict
    theme_json: dict | None
    success_message: str | None
    redirect_url: str | None

    model_config = {"from_attributes": True}


class FormSubmissionCreate(BaseModel):
    data: dict


class FormSubmissionResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    contact_id: uuid.UUID | None
    data: dict
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══ Automations ═════════════════════════════════════════════

class AutomationStep(BaseModel):
    type: str  # send_email, add_tag, remove_tag, create_task, wait, condition
    config: dict = {}


class AutomationCreate(BaseModel):
    name: str = Field(max_length=300)
    description: str | None = None
    trigger_type: str = "manual"
    trigger_config: dict | None = None
    steps: list[AutomationStep] = []
    internal_notes: str | None = None


class AutomationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    steps: list[AutomationStep] | None = None
    internal_notes: str | None = None


class AutomationResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    description: str | None
    status: str
    trigger_type: str
    trigger_config: dict | None
    steps: list
    total_runs: int
    last_run_at: datetime | None
    internal_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutomationRunResponse(BaseModel):
    id: uuid.UUID
    automation_id: uuid.UUID
    contact_id: uuid.UUID | None
    trigger_event: str | None
    status: str
    steps_completed: int
    error_message: str | None
    execution_log: list | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
