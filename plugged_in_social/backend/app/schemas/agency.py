"""Schemas for the autonomous agency domain spine."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import AnyUrl, BaseModel, Field, model_validator


class ClientEngagementCreate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    client_url: AnyUrl | None = None
    repo_url: AnyUrl | None = None
    client_name: str | None = Field(default=None, max_length=255)
    client_email: str | None = Field(default=None, max_length=255)
    lead_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    goals: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    intake_payload: dict = Field(default_factory=dict)
    integration_state: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def _require_name_or_url(self) -> "ClientEngagementCreate":
        if not self.name and not self.client_url:
            raise ValueError("name or client_url is required")
        return self


class ClientEngagementResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_id: uuid.UUID | None
    project_id: uuid.UUID | None
    name: str
    client_url: str | None
    repo_url: str | None
    client_name: str | None
    client_email: str | None
    status: str
    goals: list
    constraints: list
    intake_payload: dict
    integration_state: dict
    created_by_agent: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MarketingRunCreate(BaseModel):
    objective: str = Field(min_length=1)
    project_id: uuid.UUID | None = None


class MarketingRunResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    project_id: uuid.UUID | None
    status: str
    stage: str
    objective: str
    strategy_summary: dict
    current_blocker: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EvidenceRef(BaseModel):
    kind: str = Field(min_length=1, max_length=50)
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)


class AgencyArtifactCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    virtual_agency_task_id: uuid.UUID | None = None
    artifact_type: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    body: str | None = None
    payload: dict = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    lineage: dict = Field(default_factory=dict)
    author_role: str = Field(min_length=1, max_length=50)


class AgencyArtifactResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    virtual_agency_task_id: uuid.UUID | None
    artifact_type: str
    title: str
    body: str | None
    payload: dict
    payload_hash: str
    version: int
    evidence_refs: list
    lineage: dict
    author_role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgencyApprovalCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    approval_type: str = Field(min_length=1, max_length=50)
    subject_type: str = Field(min_length=1, max_length=50)
    subject_id: uuid.UUID
    reason: str = Field(min_length=1)
    approval_version: int = Field(default=1, ge=1)
    approval_payload: dict = Field(default_factory=dict)


class AgencyApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected", "revoked"]
    decision_note: str | None = None


class AgencyApprovalResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    approval_type: str
    status: str
    subject_type: str
    subject_id: uuid.UUID
    reason: str
    approval_version: int
    approval_payload_hash: str
    decided_at: datetime | None
    decided_by_user_id: uuid.UUID | None
    decision_note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgencyAccessRequestCreate(BaseModel):
    marketing_run_id: uuid.UUID | None = None
    request_type: str = Field(min_length=1, max_length=50)
    provider: str | None = Field(default=None, max_length=50)
    scope: dict = Field(default_factory=dict)
    reason: str = Field(min_length=1)
    instructions: dict = Field(default_factory=dict)


class AgencyAccessRequestResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    request_type: str
    provider: str | None
    status: str
    scope: dict
    reason: str
    instructions: dict
    resolved_at: datetime | None
    resolved_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
