"""Neutral external integration API for PluggedInSocial agency state."""
from __future__ import annotations

import uuid
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.agency import (
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.models.virtual_agency import VirtualAgencyEvent, VirtualAgencyTask
from app.schemas.agency import AgencyArtifactCreate
from app.schemas.integration import (
    IntegrationAcceptedResponse,
    IntegrationApprovalDecision,
    IntegrationApprovalEnvelope,
    IntegrationArtifactEnvelope,
    IntegrationCapability,
    IntegrationCapabilityResponse,
    IntegrationEngagementEnvelope,
    IntegrationEvidenceSummaryEnvelope,
    IntegrationEventIngest,
    IntegrationLink,
    IntegrationMarketingRunEnvelope,
    IntegrationRunEventEnvelope,
    IntegrationTaskEnvelope,
    IntegrationWebhookIngest,
)
from app.services.agency_domain import (
    compute_payload_hash,
    create_agency_artifact,
    decide_approval_request,
)

router = APIRouter(prefix="/integration/v1", tags=["integration"])

_CLOSED_LOOP_STAGES = [
    "intake",
    "strategy",
    "content",
    "approval",
    "scheduling",
    "publishing",
    "metrics",
    "report",
    "next_action",
]


def _org_id_from_user(current_user: dict) -> uuid.UUID:
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="Organization context required")
    return uuid.UUID(str(org_id))


def _user_id_from_user(current_user: dict) -> uuid.UUID | None:
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        return None
    return uuid.UUID(str(user_id))


def _link(rel: str, href: str) -> IntegrationLink:
    return IntegrationLink(rel=rel, href=href)


def _engagement_links(engagement_id: uuid.UUID) -> list[IntegrationLink]:
    return [
        _link("self", f"/api/integration/v1/engagements/{engagement_id}"),
    ]


def _run_links(run_id: uuid.UUID) -> list[IntegrationLink]:
    return [
        _link("self", f"/api/integration/v1/marketing-runs/{run_id}"),
        _link("artifacts", f"/api/integration/v1/marketing-runs/{run_id}/artifacts"),
        _link("tasks", f"/api/integration/v1/marketing-runs/{run_id}/tasks"),
        _link("approvals", f"/api/integration/v1/marketing-runs/{run_id}/approvals"),
    ]


def _approval_links(approval_id: uuid.UUID) -> list[IntegrationLink]:
    return [
        _link(
            "decision",
            f"/api/integration/v1/approvals/{approval_id}/decision",
        ),
    ]


def _to_engagement(item: ClientEngagement) -> IntegrationEngagementEnvelope:
    return IntegrationEngagementEnvelope(
        id=item.id,
        org_id=item.org_id,
        lead_id=item.lead_id,
        project_id=item.project_id,
        name=item.name,
        client_url=item.client_url,
        repo_url=item.repo_url,
        status=item.status,
        goals=list(item.goals or []),
        constraints=list(item.constraints or []),
        intake_payload=dict(item.intake_payload or {}),
        integration_state=dict(item.integration_state or {}),
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=_engagement_links(item.id),
    )


def _to_run(item: MarketingRun) -> IntegrationMarketingRunEnvelope:
    return IntegrationMarketingRunEnvelope(
        id=item.id,
        org_id=item.org_id,
        engagement_id=item.engagement_id,
        project_id=item.project_id,
        status=item.status,
        stage=item.stage,
        objective=item.objective,
        strategy_summary=dict(item.strategy_summary or {}),
        current_blocker=item.current_blocker,
        started_at=item.started_at,
        completed_at=item.completed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=_run_links(item.id),
    )


def _to_artifact(item: AgencyArtifact) -> IntegrationArtifactEnvelope:
    return IntegrationArtifactEnvelope(
        id=item.id,
        org_id=item.org_id,
        engagement_id=item.engagement_id,
        marketing_run_id=item.marketing_run_id,
        virtual_agency_task_id=item.virtual_agency_task_id,
        artifact_type=item.artifact_type,
        title=item.title,
        body=item.body,
        payload=dict(item.payload or {}),
        payload_hash=item.payload_hash,
        version=item.version,
        evidence_refs=list(item.evidence_refs or []),
        lineage=dict(item.lineage or {}),
        author_role=item.author_role,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=[
            _link("engagement", f"/api/integration/v1/engagements/{item.engagement_id}"),
        ],
    )


def _to_task(item: VirtualAgencyTask) -> IntegrationTaskEnvelope:
    return IntegrationTaskEnvelope(
        id=item.id,
        org_id=item.org_id,
        project_id=item.project_id,
        source_task_id=item.source_task_id,
        parent_task_id=item.parent_task_id,
        title=item.title,
        description=item.description,
        reason=item.reason,
        agent_role=item.agent_role,
        task_type=item.task_type,
        status=item.status,
        task_version=item.task_version,
        approved_version=item.approved_version,
        approval_active=item.approval_active,
        approval_payload_hash=item.approval_payload_hash,
        latest_event_hash=item.latest_event_hash,
        context=dict(item.context or {}),
        lineage=dict(item.lineage or {}),
        claimed_at=item.claimed_at,
        completed_at=item.completed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=[],
    )


def _to_event(
    item: VirtualAgencyEvent,
    *,
    run: MarketingRun,
    task: VirtualAgencyTask,
) -> IntegrationRunEventEnvelope:
    return IntegrationRunEventEnvelope(
        id=item.id,
        org_id=item.org_id,
        marketing_run_id=run.id,
        task_id=item.task_id,
        project_id=task.project_id,
        event_type=item.event_type,
        actor_role=item.actor_role,
        actor_id=item.actor_id,
        idempotency_key=item.idempotency_key,
        task_version=item.task_version,
        approval_version=item.approval_version,
        previous_event_hash=item.previous_event_hash,
        payload_hash=item.payload_hash,
        event_hash=item.event_hash,
        payload=dict(item.payload or {}),
        lineage=dict(item.lineage or {}),
        occurred_at=item.occurred_at,
        links=[
            _link("run", f"/api/integration/v1/marketing-runs/{run.id}"),
            _link("task", f"/api/integration/v1/marketing-runs/{run.id}/tasks"),
        ],
    )


def _to_approval(item: AgencyApprovalRequest) -> IntegrationApprovalEnvelope:
    return IntegrationApprovalEnvelope(
        id=item.id,
        org_id=item.org_id,
        engagement_id=item.engagement_id,
        marketing_run_id=item.marketing_run_id,
        approval_type=item.approval_type,
        status=item.status,
        subject_type=item.subject_type,
        subject_id=item.subject_id,
        reason=item.reason,
        approval_version=item.approval_version,
        approval_payload_hash=item.approval_payload_hash,
        decided_at=item.decided_at,
        decided_by_user_id=item.decided_by_user_id,
        decision_note=item.decision_note,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=_approval_links(item.id),
    )


async def _get_engagement(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement_id: uuid.UUID,
) -> ClientEngagement:
    result = await db.execute(
        select(ClientEngagement).where(
            ClientEngagement.id == engagement_id,
            ClientEngagement.org_id == org_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Client engagement not found")
    return item


async def _get_run(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run_id: uuid.UUID,
) -> MarketingRun:
    result = await db.execute(
        select(MarketingRun).where(
            MarketingRun.id == run_id,
            MarketingRun.org_id == org_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Marketing run not found")
    return item


async def _get_approval(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    approval_id: uuid.UUID,
) -> AgencyApprovalRequest:
    result = await db.execute(
        select(AgencyApprovalRequest).where(
            AgencyApprovalRequest.id == approval_id,
            AgencyApprovalRequest.org_id == org_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    return item


def _lineage_run_id(lineage: dict[str, Any] | None) -> str:
    return str(dict(lineage or {}).get("marketing_run_id") or "")


def _task_belongs_to_run(task: VirtualAgencyTask, run: MarketingRun) -> bool:
    lineage_run_id = _lineage_run_id(task.lineage)
    return lineage_run_id == str(run.id) or (
        run.project_id is not None
        and task.project_id == run.project_id
        and not lineage_run_id
    )


def _event_belongs_to_run(
    event: VirtualAgencyEvent,
    *,
    task: VirtualAgencyTask,
    run: MarketingRun,
) -> bool:
    lineage_run_id = _lineage_run_id(event.lineage)
    if lineage_run_id:
        return lineage_run_id == str(run.id)
    return _task_belongs_to_run(task, run)


async def _list_run_tasks(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run: MarketingRun,
) -> list[VirtualAgencyTask]:
    query = select(VirtualAgencyTask).where(VirtualAgencyTask.org_id == org_id)
    if run.project_id is not None:
        query = query.where(VirtualAgencyTask.project_id == run.project_id)
    result = await db.execute(query.order_by(VirtualAgencyTask.created_at.desc()))
    return [
        item
        for item in result.scalars().all()
        if _task_belongs_to_run(item, run)
    ]


async def _list_run_events(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run: MarketingRun,
    limit: int | None = None,
) -> list[tuple[VirtualAgencyEvent, VirtualAgencyTask]]:
    query = (
        select(VirtualAgencyEvent, VirtualAgencyTask)
        .join(VirtualAgencyTask, VirtualAgencyEvent.task_id == VirtualAgencyTask.id)
        .where(
            VirtualAgencyEvent.org_id == org_id,
            VirtualAgencyTask.org_id == org_id,
        )
    )
    if run.project_id is not None:
        query = query.where(VirtualAgencyTask.project_id == run.project_id)
    query = query.order_by(VirtualAgencyEvent.occurred_at.asc())

    result = await db.execute(query)
    items = [
        (event, task)
        for event, task in result.all()
        if _event_belongs_to_run(event, task=task, run=run)
    ]
    return items[:limit] if limit is not None else items


def _count_by(items: list[Any], attr: str) -> dict[str, int]:
    return dict(Counter(str(getattr(item, attr)) for item in items))


def _capabilities() -> list[IntegrationCapability]:
    return [
        IntegrationCapability(
            id="engagement.read",
            name="Read client engagements",
            description="Inspect tenant-scoped client engagement state.",
            methods=["GET"],
            resources=["client_engagement"],
        ),
        IntegrationCapability(
            id="marketing_run.read",
            name="Read marketing runs",
            description="Inspect autonomous agency run lifecycle and blockers.",
            methods=["GET"],
            resources=["marketing_run"],
        ),
        IntegrationCapability(
            id="artifact.read",
            name="Read agency artifacts",
            description="Inspect durable agent evidence, hashes, and lineage.",
            methods=["GET"],
            resources=["agency_artifact"],
        ),
        IntegrationCapability(
            id="task.read",
            name="Read virtual-agency tasks",
            description="Inspect agent tasks, approvals, hashes, and handoff lineage.",
            methods=["GET"],
            resources=["virtual_agency_task"],
        ),
        IntegrationCapability(
            id="event_timeline.read",
            name="Read marketing run event timeline",
            description="Inspect ordered virtual-agency events for a marketing run.",
            methods=["GET"],
            resources=["virtual_agency_event"],
        ),
        IntegrationCapability(
            id="evidence_summary.read",
            name="Read marketing run evidence summary",
            description="Inspect run-level artifact, task, event, approval, and hash counts.",
            methods=["GET"],
            resources=["marketing_run"],
        ),
        IntegrationCapability(
            id="approval.decide",
            name="Decide approvals",
            description="Approve, reject, or revoke pending agency approval gates.",
            methods=["POST"],
            resources=["agency_approval_request"],
            events=["approval.decided"],
            requires_approval=True,
        ),
        IntegrationCapability(
            id="event.ingest",
            name="Ingest external evidence events",
            description="Persist external integration events as agency artifacts.",
            methods=["POST"],
            resources=["agency_artifact"],
            events=["integration.event_ingested", "integration.webhook_ingested"],
        ),
    ]


@router.get("/capabilities", response_model=IntegrationCapabilityResponse)
async def get_capabilities(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    _ = db
    _org_id_from_user(current_user)
    return IntegrationCapabilityResponse(
        capabilities=_capabilities(),
        closed_loop_stages=_CLOSED_LOOP_STAGES,
    )


@router.get("/engagements", response_model=list[IntegrationEngagementEnvelope])
async def list_engagements(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    result = await db.execute(
        select(ClientEngagement)
        .where(ClientEngagement.org_id == org_id)
        .order_by(ClientEngagement.created_at.desc())
        .limit(limit)
    )
    return [_to_engagement(item) for item in result.scalars().all()]


@router.get(
    "/engagements/{engagement_id}",
    response_model=IntegrationEngagementEnvelope,
)
async def get_engagement(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    return _to_engagement(
        await _get_engagement(db, org_id=org_id, engagement_id=engagement_id)
    )


@router.get(
    "/marketing-runs/{run_id}",
    response_model=IntegrationMarketingRunEnvelope,
)
async def get_marketing_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    return _to_run(await _get_run(db, org_id=org_id, run_id=run_id))


@router.get(
    "/marketing-runs/{run_id}/artifacts",
    response_model=list[IntegrationArtifactEnvelope],
)
async def list_run_artifacts(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    await _get_run(db, org_id=org_id, run_id=run_id)
    result = await db.execute(
        select(AgencyArtifact)
        .where(
            AgencyArtifact.org_id == org_id,
            AgencyArtifact.marketing_run_id == run_id,
        )
        .order_by(AgencyArtifact.created_at.desc())
    )
    return [_to_artifact(item) for item in result.scalars().all()]


@router.get(
    "/marketing-runs/{run_id}/tasks",
    response_model=list[IntegrationTaskEnvelope],
)
async def list_run_tasks(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    tasks = await _list_run_tasks(db, org_id=org_id, run=run)
    return [_to_task(item) for item in tasks]


@router.get(
    "/marketing-runs/{run_id}/events",
    response_model=list[IntegrationRunEventEnvelope],
)
async def list_run_events(
    run_id: uuid.UUID,
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    events = await _list_run_events(db, org_id=org_id, run=run, limit=limit)
    return [_to_event(event, run=run, task=task) for event, task in events]


@router.get(
    "/marketing-runs/{run_id}/approvals",
    response_model=list[IntegrationApprovalEnvelope],
)
async def list_run_approvals(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    await _get_run(db, org_id=org_id, run_id=run_id)
    result = await db.execute(
        select(AgencyApprovalRequest)
        .where(
            AgencyApprovalRequest.org_id == org_id,
            AgencyApprovalRequest.marketing_run_id == run_id,
        )
        .order_by(AgencyApprovalRequest.created_at.desc())
    )
    return [_to_approval(item) for item in result.scalars().all()]


@router.get(
    "/marketing-runs/{run_id}/evidence-summary",
    response_model=IntegrationEvidenceSummaryEnvelope,
)
async def get_run_evidence_summary(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)

    artifact_result = await db.execute(
        select(AgencyArtifact).where(
            AgencyArtifact.org_id == org_id,
            AgencyArtifact.marketing_run_id == run_id,
        )
    )
    artifacts = list(artifact_result.scalars().all())

    approval_result = await db.execute(
        select(AgencyApprovalRequest).where(
            AgencyApprovalRequest.org_id == org_id,
            AgencyApprovalRequest.marketing_run_id == run_id,
        )
    )
    approvals = list(approval_result.scalars().all())

    tasks = await _list_run_tasks(db, org_id=org_id, run=run)
    events = await _list_run_events(db, org_id=org_id, run=run)
    event_items = [event for event, _task in events]

    return IntegrationEvidenceSummaryEnvelope(
        run_id=run.id,
        org_id=run.org_id,
        status=run.status,
        stage=run.stage,
        artifact_count=len(artifacts),
        artifact_type_counts=_count_by(artifacts, "artifact_type"),
        task_count=len(tasks),
        task_status_counts=_count_by(tasks, "status"),
        event_count=len(event_items),
        event_type_counts=_count_by(event_items, "event_type"),
        approval_count=len(approvals),
        pending_approval_count=sum(1 for item in approvals if item.status == "pending"),
        evidence_hashes={
            "artifact_payload_hashes": sorted(
                {item.payload_hash for item in artifacts if item.payload_hash}
            ),
            "approval_payload_hashes": sorted(
                {
                    item.approval_payload_hash
                    for item in approvals
                    if item.approval_payload_hash
                }
            ),
            "event_hashes": sorted(
                {item.event_hash for item in event_items if item.event_hash}
            ),
            "task_latest_event_hashes": sorted(
                {item.latest_event_hash for item in tasks if item.latest_event_hash}
            ),
        },
        links=_run_links(run.id),
    )


@router.post(
    "/approvals/{approval_id}/decision",
    response_model=IntegrationApprovalEnvelope,
)
async def decide_approval(
    approval_id: uuid.UUID,
    body: IntegrationApprovalDecision,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    approval = await _get_approval(db, org_id=org_id, approval_id=approval_id)
    decided = await decide_approval_request(
        db,
        approval=approval,
        decision=body.decision,
        decided_by_user_id=_user_id_from_user(current_user),
        decision_note=body.decision_note,
    )
    await db.commit()
    await db.refresh(decided)
    return _to_approval(decided)


async def _persist_integration_artifact(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement_id: uuid.UUID,
    marketing_run_id: uuid.UUID | None,
    artifact_type: str,
    title: str,
    payload: dict[str, Any],
    evidence_refs: list[Any],
    lineage: dict[str, Any],
) -> IntegrationAcceptedResponse:
    engagement = await _get_engagement(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=marketing_run_id,
            artifact_type=artifact_type,
            title=title,
            payload=payload,
            evidence_refs=evidence_refs,
            lineage=lineage,
            author_role="external_integration",
        ),
    )
    await db.commit()
    await db.refresh(artifact)
    return IntegrationAcceptedResponse(
        ok=True,
        status="accepted",
        payload_hash=artifact.payload_hash,
        artifact_id=artifact.id,
        links=[
            _link(
                "engagement",
                f"/api/integration/v1/engagements/{engagement.id}",
            ),
        ],
    )


@router.post(
    "/events",
    response_model=IntegrationAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_event(
    body: IntegrationEventIngest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    payload = {
        "event_type": body.event_type,
        "source": body.source,
        "payload": body.payload,
        "idempotency_key": body.idempotency_key,
    }
    return await _persist_integration_artifact(
        db,
        org_id=org_id,
        engagement_id=body.engagement_id,
        marketing_run_id=body.marketing_run_id,
        artifact_type="integration_event",
        title=body.event_type,
        payload=payload,
        evidence_refs=list(body.evidence_refs),
        lineage={
            "source": body.source,
            "event_type": body.event_type,
            "payload_hash": compute_payload_hash(payload),
        },
    )


@router.post(
    "/webhooks",
    response_model=IntegrationAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_webhook(
    body: IntegrationWebhookIngest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    payload = {
        "provider": body.provider,
        "event_type": body.event_type,
        "payload": body.payload,
        "headers": body.headers,
    }
    return await _persist_integration_artifact(
        db,
        org_id=org_id,
        engagement_id=body.engagement_id,
        marketing_run_id=body.marketing_run_id,
        artifact_type="integration_webhook",
        title=f"{body.provider}:{body.event_type}",
        payload=payload,
        evidence_refs=[],
        lineage={
            "provider": body.provider,
            "event_type": body.event_type,
            "payload_hash": compute_payload_hash(payload),
        },
    )
