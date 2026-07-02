"""Neutral integration API schemas.

These envelopes are for pm-substrate and other external systems. They are
stable API contracts over PluggedInSocial state, not ORM/table mirrors.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.agency import (
    AgencyAccessRequestDecision,
    AgencyApprovalDecision,
    ClientEngagementCreate,
    EvidenceRef,
    MarketingRunCreate,
)


class IntegrationLink(BaseModel):
    rel: str = Field(min_length=1)
    href: str = Field(min_length=1)


class IntegrationCapability(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str
    methods: list[str]
    resources: list[str]
    events: list[str] = Field(default_factory=list)
    requires_approval: bool = False
    writes_external_systems: bool = False


class IntegrationCapabilityResponse(BaseModel):
    version: Literal["v1"] = "v1"
    service: Literal["plugged_in_social"] = "plugged_in_social"
    capabilities: list[IntegrationCapability]
    closed_loop_stages: list[str]


class IntegrationAgentManifest(BaseModel):
    role: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str
    writes: list[str]
    emits: list[str]
    queue: str | None = None
    task_types: list[str] = Field(default_factory=list)


class IntegrationQueueManifest(BaseModel):
    queue: str = Field(min_length=1)
    worker: str = Field(min_length=1)
    dead_letter_queue: str | None = None
    producer_binding: str | None = None


class IntegrationEndpointManifest(BaseModel):
    method: str = Field(min_length=1)
    path: str = Field(min_length=1)
    boundary: Literal["public_rls", "internal_system_rls", "internal_secret"]
    capability_ids: list[str] = Field(default_factory=list)


class IntegrationDataResourceManifest(BaseModel):
    id: str = Field(min_length=1)
    table: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    org_scoped: bool = True
    durable_evidence_fields: list[str] = Field(default_factory=list)
    read_capability_ids: list[str] = Field(default_factory=list)
    write_capability_ids: list[str] = Field(default_factory=list)


class IntegrationConfigurationRequirement(BaseModel):
    key: str = Field(min_length=1)
    kind: Literal["environment", "secret", "queue_binding"]
    required_for: list[str] = Field(default_factory=list)


class IntegrationExternalAdapterManifest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    adapter_type: Literal["browser_qa_harness", "agent_harness"]
    boundary: Literal[
        "external_process",
        "sandboxed_process",
        "containerized_process",
        "hosted_service",
    ]
    description: str
    capabilities: list[str] = Field(default_factory=list)
    input_contracts: list[str] = Field(default_factory=list)
    output_artifacts: list[str] = Field(default_factory=list)
    required_gates: list[str] = Field(default_factory=list)
    evidence_fields: list[str] = Field(default_factory=list)
    notes: dict[str, Any] = Field(default_factory=dict)


class IntegrationPlatformManifestEnvelope(BaseModel):
    resource_type: Literal["plugged_in_social_platform_manifest"] = (
        "plugged_in_social_platform_manifest"
    )
    version: Literal["v1"] = "v1"
    service: Literal["plugged_in_social"] = "plugged_in_social"
    closed_loop_stages: list[str]
    governance_gates: list[str]
    agents: list[IntegrationAgentManifest]
    queues: list[IntegrationQueueManifest]
    api_endpoints: list[IntegrationEndpointManifest]
    data_resources: list[IntegrationDataResourceManifest]
    configuration_requirements: list[IntegrationConfigurationRequirement]
    external_adapters: list[IntegrationExternalAdapterManifest]
    links: list[IntegrationLink]


class IntegrationEngagementEnvelope(BaseModel):
    resource_type: Literal["client_engagement"] = "client_engagement"
    id: uuid.UUID
    org_id: uuid.UUID
    lead_id: uuid.UUID | None
    project_id: uuid.UUID | None
    name: str
    client_url: str | None
    repo_url: str | None
    status: str
    goals: list[Any]
    constraints: list[Any]
    intake_payload: dict[str, Any]
    integration_state: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationMarketingRunEnvelope(BaseModel):
    resource_type: Literal["marketing_run"] = "marketing_run"
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    project_id: uuid.UUID | None
    status: str
    stage: str
    objective: str
    strategy_summary: dict[str, Any]
    current_blocker: dict[str, Any] | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationRunDispatchEnvelope(BaseModel):
    resource_type: Literal["marketing_run_dispatch"] = "marketing_run_dispatch"
    run_id: uuid.UUID
    org_id: uuid.UUID
    status: str
    stage: str
    approved_count: int
    dispatched_count: int
    dispatched_task_ids: list[uuid.UUID]
    links: list[IntegrationLink]


class IntegrationArtifactEnvelope(BaseModel):
    resource_type: Literal["agency_artifact"] = "agency_artifact"
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    virtual_agency_task_id: uuid.UUID | None
    artifact_type: str
    title: str
    body: str | None
    payload: dict[str, Any]
    payload_hash: str
    version: int
    evidence_refs: list[Any]
    lineage: dict[str, Any]
    author_role: str
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationSocialPostEnvelope(BaseModel):
    resource_type: Literal["social_post"] = "social_post"
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    social_account_id: uuid.UUID
    platform: str
    status: str
    caption: str | None
    hashtags: list[Any] | None
    media_urls: list[Any] | None
    media_type: str | None
    scheduled_at: datetime | None
    published_at: datetime | None
    platform_post_id: str | None
    platform_url: str | None
    compound_phase: str | None
    created_by_agent: str | None
    version: int
    current_content_hash: str
    scheduled_content_hash: str | None
    published_content_hash: str | None
    likes: int
    comments: int
    shares: int
    impressions: int
    reach: int
    engagement_rate: float | None
    lineage: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationClientReportEnvelope(BaseModel):
    resource_type: Literal["client_report"] = "client_report"
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    title: str
    status: str
    cadence: str
    compound_phase: str | None
    created_by_agent: str | None
    client_name: str | None
    client_email: str | None
    period_start: date
    period_end: date
    sections: list[Any]
    metrics_snapshot: dict[str, Any]
    metrics_snapshot_hash: str
    report_hash: str
    pdf_url: str | None
    pdf_generated_at: datetime | None
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationTaskEnvelope(BaseModel):
    resource_type: Literal["virtual_agency_task"] = "virtual_agency_task"
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    source_task_id: uuid.UUID | None
    parent_task_id: uuid.UUID | None
    title: str
    description: str | None
    reason: str
    agent_role: str
    task_type: str
    status: str
    task_version: int
    approved_version: int | None
    approval_active: bool
    approval_payload_hash: str | None
    latest_event_hash: str | None
    context: dict[str, Any]
    lineage: dict[str, Any]
    claimed_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationRunEventEnvelope(BaseModel):
    resource_type: Literal["virtual_agency_event"] = "virtual_agency_event"
    id: uuid.UUID
    org_id: uuid.UUID
    marketing_run_id: uuid.UUID
    task_id: uuid.UUID
    project_id: uuid.UUID | None
    event_type: str
    actor_role: str | None
    actor_id: str | None
    idempotency_key: str
    task_version: int | None
    approval_version: int | None
    previous_event_hash: str | None
    payload_hash: str
    event_hash: str
    payload: dict[str, Any]
    lineage: dict[str, Any]
    occurred_at: datetime
    links: list[IntegrationLink]


class IntegrationApprovalEnvelope(BaseModel):
    resource_type: Literal["agency_approval_request"] = "agency_approval_request"
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
    links: list[IntegrationLink]


class IntegrationAccessRequestEnvelope(BaseModel):
    resource_type: Literal["agency_access_request"] = "agency_access_request"
    id: uuid.UUID
    org_id: uuid.UUID
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None
    request_type: str
    provider: str | None
    status: str
    scope: dict[str, Any]
    reason: str
    instructions: dict[str, Any]
    resolved_at: datetime | None
    resolved_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    links: list[IntegrationLink]


class IntegrationAdapterReadinessItem(BaseModel):
    adapter_id: str = Field(min_length=1)
    status: Literal["ready", "missing", "incomplete", "failed"]
    run_status: str | None = None
    artifact_id: uuid.UUID | None = None
    artifact_payload_hash: str | None = None
    adapter_run_id: str | None = None
    required_gates: list[str] = Field(default_factory=list)
    missing_or_failed_gates: list[str] = Field(default_factory=list)
    required_evidence_fields: list[str] = Field(default_factory=list)
    present_evidence_fields: list[str] = Field(default_factory=list)
    missing_evidence_fields: list[str] = Field(default_factory=list)


class IntegrationStrategyAdapterReadinessEnvelope(BaseModel):
    strategy_artifact_present: bool = False
    strategy_artifact_id: uuid.UUID | None = None
    strategy_artifact_payload_hash: str | None = None
    ready: bool = False
    required_adapter_ids: list[str] = Field(default_factory=list)
    succeeded_adapter_ids: list[str] = Field(default_factory=list)
    missing_adapter_ids: list[str] = Field(default_factory=list)
    blocked_adapter_ids: list[str] = Field(default_factory=list)
    adapters: list[IntegrationAdapterReadinessItem] = Field(default_factory=list)


class IntegrationEvidenceSummaryEnvelope(BaseModel):
    resource_type: Literal["marketing_run_evidence_summary"] = (
        "marketing_run_evidence_summary"
    )
    run_id: uuid.UUID
    org_id: uuid.UUID
    status: str
    stage: str
    artifact_count: int
    artifact_type_counts: dict[str, int]
    task_count: int
    task_status_counts: dict[str, int]
    event_count: int
    event_type_counts: dict[str, int]
    approval_count: int
    pending_approval_count: int
    access_request_count: int
    open_access_request_count: int
    social_post_count: int = 0
    social_post_status_counts: dict[str, int] = Field(default_factory=dict)
    report_count: int = 0
    report_status_counts: dict[str, int] = Field(default_factory=dict)
    adapter_readiness: IntegrationStrategyAdapterReadinessEnvelope
    evidence_hashes: dict[str, list[str]]
    links: list[IntegrationLink]


class IntegrationRunEvidenceSnapshotEnvelope(BaseModel):
    resource_type: Literal["marketing_run_evidence_snapshot"] = (
        "marketing_run_evidence_snapshot"
    )
    run: IntegrationMarketingRunEnvelope
    summary: IntegrationEvidenceSummaryEnvelope
    tasks: list[IntegrationTaskEnvelope]
    events: list[IntegrationRunEventEnvelope]
    artifacts: list[IntegrationArtifactEnvelope]
    approvals: list[IntegrationApprovalEnvelope]
    access_requests: list[IntegrationAccessRequestEnvelope]
    social_posts: list[IntegrationSocialPostEnvelope]
    reports: list[IntegrationClientReportEnvelope]
    links: list[IntegrationLink]


class IntegrationEventIngest(BaseModel):
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None = None
    event_type: str = Field(min_length=1, max_length=120)
    source: str = Field(min_length=1, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    idempotency_key: str | None = Field(default=None, max_length=160)


class IntegrationWebhookIngest(BaseModel):
    engagement_id: uuid.UUID
    marketing_run_id: uuid.UUID | None = None
    provider: str = Field(min_length=1, max_length=80)
    event_type: str = Field(min_length=1, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)


class IntegrationExternalAdapterRunIngest(BaseModel):
    adapter_id: str = Field(min_length=1, max_length=120)
    adapter_run_id: str | None = Field(default=None, max_length=160)
    status: Literal["succeeded", "failed", "blocked", "partial"]
    gate_results: dict[str, bool] = Field(default_factory=dict)
    input_refs: list[EvidenceRef] = Field(default_factory=list)
    output_artifacts: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def _require_retry_identity(self) -> "IntegrationExternalAdapterRunIngest":
        if not self.idempotency_key and not self.adapter_run_id:
            raise ValueError("idempotency_key or adapter_run_id is required")
        return self


class IntegrationAcceptedResponse(BaseModel):
    ok: bool
    status: Literal["accepted"]
    payload_hash: str
    artifact_id: uuid.UUID | None = None
    links: list[IntegrationLink] = Field(default_factory=list)


IntegrationAccessDecision = AgencyAccessRequestDecision
IntegrationApprovalDecision = AgencyApprovalDecision
IntegrationEngagementCreate = ClientEngagementCreate
IntegrationMarketingRunCreate = MarketingRunCreate
