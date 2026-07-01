"""Deterministic services for the autonomous agency domain spine."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import (
    AgencyAccessRequest,
    AgencyAccessRequestStatus,
    AgencyApprovalRequest,
    AgencyApprovalStatus,
    AgencyArtifact,
    ClientEngagement,
    ClientEngagementStatus,
    MarketingRun,
    MarketingRunStage,
    MarketingRunStatus,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_payload_hash(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def _url_to_string(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


async def create_client_engagement(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    body: ClientEngagementCreate,
    created_by_agent: str | None,
) -> ClientEngagement:
    name = body.name or (
        str(body.client_url.host) if body.client_url else "Client engagement"
    )
    engagement = ClientEngagement(
        org_id=org_id,
        lead_id=body.lead_id,
        project_id=body.project_id,
        name=name,
        client_url=_url_to_string(body.client_url),
        repo_url=_url_to_string(body.repo_url),
        client_name=body.client_name,
        client_email=body.client_email,
        status=ClientEngagementStatus.intake.value,
        goals=list(body.goals),
        constraints=list(body.constraints),
        intake_payload=dict(body.intake_payload),
        integration_state=dict(body.integration_state),
        created_by_agent=created_by_agent,
    )
    db.add(engagement)
    await db.flush()
    return engagement


async def start_marketing_run(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    objective: str,
    project_id: uuid.UUID | None = None,
) -> MarketingRun:
    run = MarketingRun(
        org_id=engagement.org_id,
        engagement_id=engagement.id,
        project_id=project_id or engagement.project_id,
        status=MarketingRunStatus.active.value,
        stage=MarketingRunStage.intake.value,
        objective=objective,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()
    return run


async def create_agency_artifact(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyArtifactCreate,
) -> AgencyArtifact:
    evidence_refs = [
        ref.model_dump() if hasattr(ref, "model_dump") else dict(ref)
        for ref in body.evidence_refs
    ]
    lineage = {
        **dict(body.lineage),
        "engagement_id": str(engagement.id),
    }
    if body.marketing_run_id is not None:
        lineage["marketing_run_id"] = str(body.marketing_run_id)
    if body.virtual_agency_task_id is not None:
        lineage["virtual_agency_task_id"] = str(body.virtual_agency_task_id)
    payload = dict(body.payload)
    payload_hash = compute_payload_hash(
        {
            "artifact_type": body.artifact_type,
            "title": body.title,
            "body": body.body,
            "payload": payload,
            "evidence_refs": evidence_refs,
            "lineage": lineage,
            "author_role": body.author_role,
        }
    )
    artifact = AgencyArtifact(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        virtual_agency_task_id=body.virtual_agency_task_id,
        artifact_type=body.artifact_type,
        title=body.title,
        body=body.body,
        payload=payload,
        payload_hash=payload_hash,
        evidence_refs=evidence_refs,
        lineage=lineage,
        author_role=body.author_role,
    )
    db.add(artifact)
    await db.flush()
    return artifact


async def create_approval_request(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyApprovalCreate,
) -> AgencyApprovalRequest:
    approval_payload_hash = compute_payload_hash(
        {
            "approval_type": body.approval_type,
            "subject_type": body.subject_type,
            "subject_id": str(body.subject_id),
            "reason": body.reason,
            "approval_version": body.approval_version,
            "approval_payload": body.approval_payload,
        }
    )
    approval = AgencyApprovalRequest(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        approval_type=body.approval_type,
        status=AgencyApprovalStatus.pending.value,
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        reason=body.reason,
        approval_version=body.approval_version,
        approval_payload_hash=approval_payload_hash,
    )
    db.add(approval)
    await db.flush()
    return approval


async def create_access_request(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyAccessRequestCreate,
) -> AgencyAccessRequest:
    access_request = AgencyAccessRequest(
        org_id=org_id,
        engagement_id=engagement.id,
        marketing_run_id=body.marketing_run_id,
        request_type=body.request_type,
        provider=body.provider,
        status=AgencyAccessRequestStatus.requested.value,
        scope=dict(body.scope),
        reason=body.reason,
        instructions=dict(body.instructions),
    )
    db.add(access_request)
    await db.flush()
    return access_request
