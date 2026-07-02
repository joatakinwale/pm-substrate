"""Neutral external integration API for PluggedInSocial agency state."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.agency import (
    AgencyAccessRequest,
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.models.report import ClientReport
from app.models.social_media import SocialPost
from app.models.virtual_agency import VirtualAgencyEvent, VirtualAgencyTask
from app.schemas.agency import AgencyArtifactCreate
from app.schemas.integration import (
    IntegrationAcceptedResponse,
    IntegrationAccessDecision,
    IntegrationAccessRequestEnvelope,
    IntegrationApprovalDecision,
    IntegrationApprovalEnvelope,
    IntegrationArtifactEnvelope,
    IntegrationCapability,
    IntegrationCapabilityResponse,
    IntegrationClientReportEnvelope,
    IntegrationAgentManifest,
    IntegrationConfigurationRequirement,
    IntegrationDataResourceManifest,
    IntegrationEndpointManifest,
    IntegrationEngagementEnvelope,
    IntegrationEvidenceSummaryEnvelope,
    IntegrationEventIngest,
    IntegrationExternalAdapterManifest,
    IntegrationLink,
    IntegrationMarketingRunEnvelope,
    IntegrationPlatformManifestEnvelope,
    IntegrationQueueManifest,
    IntegrationRunDispatchEnvelope,
    IntegrationRunEventEnvelope,
    IntegrationRunEvidenceSnapshotEnvelope,
    IntegrationSocialPostEnvelope,
    IntegrationTaskEnvelope,
    IntegrationWebhookIngest,
)
from app.services.agency_domain import (
    approve_and_dispatch_marketing_run,
    compute_payload_hash,
    create_agency_artifact,
    decide_access_request,
    decide_approval_request,
    MarketingRunAccessGateError,
)
from app.services.virtual_agency_orchestration import (
    AGENT_CAPABILITIES,
    social_post_content_hash,
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
        _link(
            "social_posts",
            f"/api/integration/v1/marketing-runs/{run_id}/social-posts",
        ),
        _link("reports", f"/api/integration/v1/marketing-runs/{run_id}/reports"),
        _link("tasks", f"/api/integration/v1/marketing-runs/{run_id}/tasks"),
        _link(
            "evidence_snapshot",
            f"/api/integration/v1/marketing-runs/{run_id}/evidence-snapshot",
        ),
        _link(
            "evidence_summary",
            f"/api/integration/v1/marketing-runs/{run_id}/evidence-summary",
        ),
        _link("events", f"/api/integration/v1/marketing-runs/{run_id}/events"),
        _link("approvals", f"/api/integration/v1/marketing-runs/{run_id}/approvals"),
        _link(
            "access_requests",
            f"/api/integration/v1/marketing-runs/{run_id}/access-requests",
        ),
    ]


def _approval_links(approval_id: uuid.UUID) -> list[IntegrationLink]:
    return [
        _link(
            "decision",
            f"/api/integration/v1/approvals/{approval_id}/decision",
        ),
    ]


def _access_request_links(access_request_id: uuid.UUID) -> list[IntegrationLink]:
    return [
        _link(
            "decision",
            f"/api/integration/v1/access-requests/{access_request_id}/decision",
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


def _social_post_lineage(item: SocialPost) -> dict[str, Any]:
    notes = item.internal_notes or ""
    prefix = "Lineage: "
    if not notes.startswith(prefix):
        return {}
    try:
        parsed = json.loads(notes[len(prefix):])
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _to_social_post(item: SocialPost) -> IntegrationSocialPostEnvelope:
    return IntegrationSocialPostEnvelope(
        id=item.id,
        org_id=item.org_id,
        project_id=item.project_id,
        social_account_id=item.social_account_id,
        platform=item.platform,
        status=item.status,
        caption=item.caption,
        hashtags=list(item.hashtags or []) if item.hashtags is not None else None,
        media_urls=list(item.media_urls or []) if item.media_urls is not None else None,
        media_type=item.media_type,
        scheduled_at=item.scheduled_at,
        published_at=item.published_at,
        platform_post_id=item.platform_post_id,
        platform_url=item.platform_url,
        compound_phase=item.compound_phase,
        created_by_agent=item.created_by_agent,
        version=item.version,
        current_content_hash=social_post_content_hash(item),
        scheduled_content_hash=item.scheduled_content_hash,
        published_content_hash=item.published_content_hash,
        likes=item.likes,
        comments=item.comments,
        shares=item.shares,
        impressions=item.impressions,
        reach=item.reach,
        engagement_rate=item.engagement_rate,
        lineage=_social_post_lineage(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=[],
    )


def _report_metrics_snapshot_hash(item: ClientReport) -> str:
    return compute_payload_hash(dict(item.metrics_snapshot or {}))


def _client_report_hash(item: ClientReport) -> str:
    metrics_snapshot_hash = _report_metrics_snapshot_hash(item)
    return compute_payload_hash(
        {
            "client_report_id": str(item.id),
            "org_id": str(item.org_id),
            "project_id": str(item.project_id) if item.project_id else None,
            "period_start": item.period_start,
            "period_end": item.period_end,
            "metrics_snapshot_hash": metrics_snapshot_hash,
            "pdf_url": item.pdf_url,
            "pdf_generated_at": item.pdf_generated_at,
        }
    )


def _to_report(item: ClientReport) -> IntegrationClientReportEnvelope:
    return IntegrationClientReportEnvelope(
        id=item.id,
        org_id=item.org_id,
        project_id=item.project_id,
        lead_id=item.lead_id,
        title=item.title,
        status=item.status,
        cadence=item.cadence,
        compound_phase=item.compound_phase,
        created_by_agent=item.created_by_agent,
        client_name=item.client_name,
        client_email=item.client_email,
        period_start=item.period_start,
        period_end=item.period_end,
        sections=list(item.sections or []),
        metrics_snapshot=dict(item.metrics_snapshot or {}),
        metrics_snapshot_hash=_report_metrics_snapshot_hash(item),
        report_hash=_client_report_hash(item),
        pdf_url=item.pdf_url,
        pdf_generated_at=item.pdf_generated_at,
        sent_at=item.sent_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=[
            _link("self", f"/api/integration/v1/reports/{item.id}"),
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


def _to_access_request(item: AgencyAccessRequest) -> IntegrationAccessRequestEnvelope:
    return IntegrationAccessRequestEnvelope(
        id=item.id,
        org_id=item.org_id,
        engagement_id=item.engagement_id,
        marketing_run_id=item.marketing_run_id,
        request_type=item.request_type,
        provider=item.provider,
        status=item.status,
        scope=dict(item.scope or {}),
        reason=item.reason,
        instructions=dict(item.instructions or {}),
        resolved_at=item.resolved_at,
        resolved_by_user_id=item.resolved_by_user_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        links=_access_request_links(item.id),
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


async def _get_report(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    report_id: uuid.UUID,
) -> ClientReport:
    result = await db.execute(
        select(ClientReport).where(
            ClientReport.id == report_id,
            ClientReport.org_id == org_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Client report not found")
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


async def _get_access_request(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    access_request_id: uuid.UUID,
) -> AgencyAccessRequest:
    result = await db.execute(
        select(AgencyAccessRequest).where(
            AgencyAccessRequest.id == access_request_id,
            AgencyAccessRequest.org_id == org_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Access request not found")
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


def _social_post_belongs_to_run(item: SocialPost, run: MarketingRun) -> bool:
    lineage_run_id = str(_social_post_lineage(item).get("marketing_run_id") or "")
    return bool(lineage_run_id) and lineage_run_id == str(run.id)


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


async def _list_run_social_posts(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run: MarketingRun,
) -> list[SocialPost]:
    if run.project_id is None:
        return []
    result = await db.execute(
        select(SocialPost)
        .where(
            SocialPost.org_id == org_id,
            SocialPost.project_id == run.project_id,
        )
        .order_by(SocialPost.created_at.desc())
    )
    return [
        item
        for item in result.scalars().all()
        if _social_post_belongs_to_run(item, run)
    ]


async def _list_run_reports(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run: MarketingRun,
) -> list[ClientReport]:
    if run.project_id is None:
        return []
    result = await db.execute(
        select(ClientReport)
        .where(
            ClientReport.org_id == org_id,
            ClientReport.project_id == run.project_id,
        )
        .order_by(ClientReport.period_end.desc(), ClientReport.created_at.desc())
    )
    return list(result.scalars().all())


async def _build_run_evidence_snapshot_rows(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    run: MarketingRun,
) -> dict[str, Any]:
    artifact_result = await db.execute(
        select(AgencyArtifact).where(
            AgencyArtifact.org_id == org_id,
            AgencyArtifact.marketing_run_id == run.id,
        )
    )
    artifacts = list(artifact_result.scalars().all())

    approval_result = await db.execute(
        select(AgencyApprovalRequest).where(
            AgencyApprovalRequest.org_id == org_id,
            AgencyApprovalRequest.marketing_run_id == run.id,
        )
    )
    approvals = list(approval_result.scalars().all())

    access_result = await db.execute(
        select(AgencyAccessRequest).where(
            AgencyAccessRequest.org_id == org_id,
            AgencyAccessRequest.marketing_run_id == run.id,
        )
    )
    access_requests = list(access_result.scalars().all())

    tasks = await _list_run_tasks(db, org_id=org_id, run=run)
    events = await _list_run_events(db, org_id=org_id, run=run)
    event_items = [event for event, _task in events]
    social_posts = await _list_run_social_posts(db, org_id=org_id, run=run)
    reports = await _list_run_reports(db, org_id=org_id, run=run)

    summary = IntegrationEvidenceSummaryEnvelope(
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
        access_request_count=len(access_requests),
        open_access_request_count=sum(
            1 for item in access_requests if item.status in {"requested", "blocked"}
        ),
        social_post_count=len(social_posts),
        social_post_status_counts=_count_by(social_posts, "status"),
        report_count=len(reports),
        report_status_counts=_count_by(reports, "status"),
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
            "access_request_hashes": sorted(
                {
                    compute_payload_hash(
                        {
                            "id": str(item.id),
                            "request_type": item.request_type,
                            "provider": item.provider,
                            "status": item.status,
                            "scope": dict(item.scope or {}),
                            "instructions": dict(item.instructions or {}),
                            "resolved_at": item.resolved_at,
                        }
                    )
                    for item in access_requests
                }
            ),
            "event_hashes": sorted(
                {item.event_hash for item in event_items if item.event_hash}
            ),
            "task_latest_event_hashes": sorted(
                {item.latest_event_hash for item in tasks if item.latest_event_hash}
            ),
            "social_post_content_hashes": sorted(
                {
                    social_post_content_hash(item)
                    for item in social_posts
                    if item.scheduled_content_hash or item.published_content_hash
                }
            ),
            "client_report_hashes": sorted(
                {_client_report_hash(item) for item in reports}
            ),
            "client_report_metrics_hashes": sorted(
                {_report_metrics_snapshot_hash(item) for item in reports}
            ),
        },
        links=_run_links(run.id),
    )

    return {
        "summary": summary,
        "tasks": tasks,
        "events": events,
        "artifacts": artifacts,
        "approvals": approvals,
        "access_requests": access_requests,
        "social_posts": social_posts,
        "reports": reports,
    }


def _count_by(items: list[Any], attr: str) -> dict[str, int]:
    return dict(Counter(str(getattr(item, attr)) for item in items))


def _capabilities() -> list[IntegrationCapability]:
    return [
        IntegrationCapability(
            id="platform_manifest.read",
            name="Read platform integration manifest",
            description=(
                "Inspect agent, queue, endpoint, data, configuration, and external "
                "adapter metadata for external orchestration."
            ),
            methods=["GET"],
            resources=["platform_manifest"],
        ),
        IntegrationCapability(
            id="external_adapter_manifest.read",
            name="Read external adapter manifest",
            description=(
                "Inspect neutral adapter contracts for browser QA harnesses and "
                "external agent harnesses without coupling to a specific runtime."
            ),
            methods=["GET"],
            resources=["external_adapter"],
        ),
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
            id="marketing_run.dispatch",
            name="Dispatch marketing run agents",
            description="Approve and enqueue dependency-ready virtual-agency tasks for a marketing run after access gates clear.",
            methods=["POST"],
            resources=["marketing_run", "virtual_agency_task"],
            events=["approved", "handoff_dispatched"],
            requires_approval=True,
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
            id="approval.read",
            name="Read approval gates",
            description="Inspect approval requests and current decision state.",
            methods=["GET"],
            resources=["agency_approval_request"],
        ),
        IntegrationCapability(
            id="access_request.read",
            name="Read access gates",
            description="Inspect requested, blocked, granted, and revoked client access gates.",
            methods=["GET"],
            resources=["agency_access_request"],
        ),
        IntegrationCapability(
            id="evidence_summary.read",
            name="Read marketing run evidence summary",
            description="Inspect run-level artifact, task, event, approval, access-gate, report, and hash counts.",
            methods=["GET"],
            resources=["marketing_run"],
        ),
        IntegrationCapability(
            id="run_evidence_snapshot.read",
            name="Read marketing run evidence snapshot",
            description="Inspect the complete run monitor packet: run, summary, tasks, events, artifacts, approvals, access gates, social posts, and reports.",
            methods=["GET"],
            resources=[
                "marketing_run",
                "virtual_agency_task",
                "virtual_agency_event",
                "agency_artifact",
                "agency_approval_request",
                "agency_access_request",
                "social_post",
                "client_report",
            ],
        ),
        IntegrationCapability(
            id="social_post.read",
            name="Read social post state",
            description="Inspect social post lifecycle, content hashes, and platform publication state.",
            methods=["GET"],
            resources=["social_post"],
        ),
        IntegrationCapability(
            id="report.read",
            name="Read client reports",
            description="Inspect report metrics, generated artifacts, and next-action source state.",
            methods=["GET"],
            resources=["client_report"],
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
            id="access_request.decide",
            name="Resolve access gates",
            description="Grant, block, or revoke client access requests for a marketing run.",
            methods=["POST"],
            resources=["agency_access_request"],
            events=["access_request.decided"],
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
        IntegrationCapability(
            id="task.execute",
            name="Execute virtual-agency task",
            description="Internal worker execution callback for approved virtual-agency tasks.",
            methods=["POST"],
            resources=["virtual_agency_task"],
            events=["execution_claimed", "execution_completed"],
        ),
        IntegrationCapability(
            id="social_post.publish",
            name="Publish social post",
            description="Internal publisher callback guarded by scheduled content hash.",
            methods=["POST"],
            resources=["social_post"],
            events=["social_post.published"],
            writes_external_systems=True,
        ),
    ]


def _agent_manifest() -> list[IntegrationAgentManifest]:
    agent_info = {
        "chief_of_staff": {
            "name": "Chief of Staff",
            "description": "Turns client intake into strategy, project scope, dependencies, and department handoffs.",
            "task_types": [
                "campaign_planning",
                "strategy_research",
                "department_handoff",
            ],
            "writes": ["project.create", "legacy_task.create", "virtual_agency_task.create"],
            "emits": ["task_created", "handoff_dispatched"],
        },
        "content_creative": {
            "name": "Content Creative",
            "description": "Produces draft content artifacts under campaign and approval lineage.",
            "task_types": ["content_generation"],
        },
        "scheduling_distribution": {
            "name": "Scheduling Distribution",
            "description": "Schedules approved content and binds scheduled content hashes for publish-time verification.",
            "task_types": ["content_scheduling"],
        },
        "community_engagement": {
            "name": "Community Engagement",
            "description": "Handles follow-up engagement tasks without publishing mutations.",
            "task_types": ["community_engagement"],
        },
        "analytics_reporting": {
            "name": "Analytics Reporting",
            "description": "Builds reports and governed next-action proposals from metrics evidence.",
            "task_types": ["analytics_reporting", "next_action_proposal"],
        },
    }
    roles = [
        "chief_of_staff",
        "content_creative",
        "scheduling_distribution",
        "community_engagement",
        "analytics_reporting",
    ]

    agents: list[IntegrationAgentManifest] = []
    for role in roles:
        info = agent_info[role]
        capabilities = AGENT_CAPABILITIES.get(role, {})
        agents.append(
            IntegrationAgentManifest(
                role=role,
                name=str(info["name"]),
                description=str(info["description"]),
                writes=sorted(
                    set(info.get("writes", [])) | set(capabilities.get("writes", set()))
                ),
                emits=sorted(
                    set(info.get("emits", [])) | set(capabilities.get("emits", set()))
                ),
                queue="stevie-virtual-agency",
                task_types=list(info["task_types"]),
            )
        )
    return agents


def _queue_manifest() -> list[IntegrationQueueManifest]:
    return [
        IntegrationQueueManifest(
            queue="stevie-virtual-agency",
            worker="virtual-agency",
            dead_letter_queue="stevie-virtual-agency-dlq",
            producer_binding="QUEUE_VIRTUAL_AGENCY",
        ),
        IntegrationQueueManifest(
            queue="stevie-social-publisher",
            worker="social-publisher",
            dead_letter_queue="stevie-social-publisher-dlq",
            producer_binding="QUEUE_SOCIAL_PUBLISHER",
        ),
        IntegrationQueueManifest(
            queue="stevie-ai-content",
            worker="ai-content",
            dead_letter_queue="stevie-ai-content-dlq",
            producer_binding="QUEUE_AI_CONTENT",
        ),
        IntegrationQueueManifest(
            queue="stevie-report-builder",
            worker="report-builder",
            dead_letter_queue="stevie-report-builder-dlq",
            producer_binding="QUEUE_REPORT_BUILDER",
        ),
    ]


def _endpoint_manifest() -> list[IntegrationEndpointManifest]:
    return [
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/capabilities",
            boundary="public_rls",
            capability_ids=["marketing_run.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/platform-manifest",
            boundary="public_rls",
            capability_ids=["platform_manifest.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/external-adapters",
            boundary="public_rls",
            capability_ids=["external_adapter_manifest.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/engagements",
            boundary="public_rls",
            capability_ids=["engagement.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}",
            boundary="public_rls",
            capability_ids=["marketing_run.read"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/integration/v1/marketing-runs/{run_id}/dispatch",
            boundary="public_rls",
            capability_ids=["marketing_run.dispatch"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/events",
            boundary="public_rls",
            capability_ids=["event_timeline.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/evidence-summary",
            boundary="public_rls",
            capability_ids=["evidence_summary.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/evidence-snapshot",
            boundary="public_rls",
            capability_ids=["run_evidence_snapshot.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/access-requests",
            boundary="public_rls",
            capability_ids=["access_request.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/social-posts",
            boundary="public_rls",
            capability_ids=["social_post.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/marketing-runs/{run_id}/reports",
            boundary="public_rls",
            capability_ids=["report.read"],
        ),
        IntegrationEndpointManifest(
            method="GET",
            path="/api/integration/v1/reports/{report_id}",
            boundary="public_rls",
            capability_ids=["report.read"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/internal/virtual-agency/task",
            boundary="internal_system_rls",
            capability_ids=["task.execute"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/internal/social/posts/{post_id}/publish",
            boundary="internal_system_rls",
            capability_ids=["social_post.publish"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/integration/v1/approvals/{approval_id}/decision",
            boundary="public_rls",
            capability_ids=["approval.decide"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/integration/v1/access-requests/{access_request_id}/decision",
            boundary="public_rls",
            capability_ids=["access_request.decide"],
        ),
        IntegrationEndpointManifest(
            method="POST",
            path="/api/integration/v1/events",
            boundary="public_rls",
            capability_ids=["event.ingest"],
        ),
    ]


def _data_resource_manifest() -> list[IntegrationDataResourceManifest]:
    return [
        IntegrationDataResourceManifest(
            id="client_engagement",
            table="client_engagements",
            resource_type="client_engagement",
            durable_evidence_fields=["intake_payload", "integration_state"],
            read_capability_ids=["engagement.read"],
        ),
        IntegrationDataResourceManifest(
            id="marketing_run",
            table="marketing_runs",
            resource_type="marketing_run",
            durable_evidence_fields=["strategy_summary", "current_blocker", "stage"],
            read_capability_ids=["marketing_run.read", "evidence_summary.read"],
            write_capability_ids=["marketing_run.dispatch"],
        ),
        IntegrationDataResourceManifest(
            id="virtual_agency_task",
            table="virtual_agency_tasks",
            resource_type="virtual_agency_task",
            durable_evidence_fields=[
                "task_version",
                "approval_payload_hash",
                "latest_event_hash",
                "context",
                "lineage",
            ],
            read_capability_ids=["task.read"],
            write_capability_ids=["task.execute"],
        ),
        IntegrationDataResourceManifest(
            id="virtual_agency_event",
            table="virtual_agency_events",
            resource_type="virtual_agency_event",
            durable_evidence_fields=[
                "previous_event_hash",
                "payload_hash",
                "event_hash",
                "lineage",
            ],
            read_capability_ids=["event_timeline.read"],
        ),
        IntegrationDataResourceManifest(
            id="agency_artifact",
            table="agency_artifacts",
            resource_type="agency_artifact",
            durable_evidence_fields=[
                "payload_hash",
                "version",
                "evidence_refs",
                "lineage",
            ],
            read_capability_ids=["artifact.read"],
            write_capability_ids=["event.ingest"],
        ),
        IntegrationDataResourceManifest(
            id="agency_approval_request",
            table="agency_approval_requests",
            resource_type="agency_approval_request",
            durable_evidence_fields=[
                "approval_version",
                "approval_payload_hash",
                "decision_note",
                "decided_at",
            ],
            read_capability_ids=["approval.read"],
            write_capability_ids=["approval.decide"],
        ),
        IntegrationDataResourceManifest(
            id="agency_access_request",
            table="agency_access_requests",
            resource_type="agency_access_request",
            durable_evidence_fields=[
                "scope",
                "instructions",
                "resolved_at",
                "resolved_by_user_id",
            ],
            read_capability_ids=["access_request.read"],
            write_capability_ids=["access_request.decide"],
        ),
        IntegrationDataResourceManifest(
            id="social_post",
            table="social_posts",
            resource_type="social_post",
            durable_evidence_fields=[
                "current_content_hash",
                "scheduled_content_hash",
                "published_content_hash",
                "platform_post_id",
                "platform_url",
                "lineage",
            ],
            read_capability_ids=["social_post.read"],
            write_capability_ids=["social_post.publish"],
        ),
        IntegrationDataResourceManifest(
            id="client_report",
            table="client_reports",
            resource_type="client_report",
            durable_evidence_fields=[
                "metrics_snapshot",
                "pdf_url",
                "pdf_generated_at",
                "sent_at",
            ],
            read_capability_ids=["report.read"],
        ),
    ]


def _configuration_manifest() -> list[IntegrationConfigurationRequirement]:
    return [
        IntegrationConfigurationRequirement(
            key="WEBHOOK_SECRET",
            kind="secret",
            required_for=["internal webhooks", "worker callbacks"],
        ),
        IntegrationConfigurationRequirement(
            key="BACKEND_BASE_URL",
            kind="secret",
            required_for=["virtual-agency worker", "social publisher", "cron workers"],
        ),
        IntegrationConfigurationRequirement(
            key="QUEUE_PRODUCER_URL",
            kind="environment",
            required_for=["FastAPI queue publisher", "cron workers"],
        ),
        IntegrationConfigurationRequirement(
            key="QUEUE_VIRTUAL_AGENCY",
            kind="queue_binding",
            required_for=["queue-producer"],
        ),
        IntegrationConfigurationRequirement(
            key="DATABASE_URL",
            kind="secret",
            required_for=["FastAPI backend"],
        ),
    ]


def _external_adapter_manifest() -> list[IntegrationExternalAdapterManifest]:
    return [
        IntegrationExternalAdapterManifest(
            id="browser_qa_harness",
            name="Browser QA harness",
            adapter_type="browser_qa_harness",
            boundary="sandboxed_process",
            description=(
                "Runs external browser verification flows and returns reproducible "
                "evidence artifacts without direct PluggedInSocial state mutation."
            ),
            capabilities=[
                "affected_flow_detection",
                "browser_replay",
                "playwright_script_capture",
                "trace_capture",
                "network_har_capture",
                "console_log_capture",
                "self_contained_report",
            ],
            input_contracts=[
                "git_diff",
                "operator_flow_prompt",
                "target_url",
                "auth_context_ref",
            ],
            output_artifacts=[
                "report_html",
                "playwright_script",
                "trace_zip",
                "network_har",
                "console_log",
                "screen_recording",
                "step_screenshots",
            ],
            required_gates=[
                "tenant_rls",
                "approval_payload_hash",
                "evidence_hash_gate",
                "no_secret_exfiltration",
            ],
            evidence_fields=[
                "artifact_payload_hash",
                "report_uri",
                "trace_uri",
                "har_uri",
                "script_hash",
                "console_error_count",
            ],
            notes={
                "inspired_by": "canary",
                "coupling": "adapter_contract_only",
                "source": "https://github.com/LopeWale/canary",
            },
        ),
        IntegrationExternalAdapterManifest(
            id="agent_harness",
            name="External agent harness",
            adapter_type="agent_harness",
            boundary="containerized_process",
            description=(
                "Executes external agent loops against approved task contracts while "
                "PluggedInSocial retains tenant, capability, approval, and evidence gates."
            ),
            capabilities=[
                "multi_provider_llm",
                "tool_calling",
                "agent_loop_state",
                "session_tree",
                "json_mode",
                "rpc_mode",
                "sdk_embedding",
                "extension_packages",
            ],
            input_contracts=[
                "virtual_agency_task",
                "approval_payload_hash",
                "capability_grant",
                "tenant_context",
                "evidence_snapshot",
            ],
            output_artifacts=[
                "agent_session_tree",
                "tool_call_log",
                "proposed_mutations",
                "artifact_payload",
                "next_action_proposal",
            ],
            required_gates=[
                "tenant_rls",
                "capability_gate",
                "approval_payload_hash",
                "content_hash_gate",
                "sandbox_boundary",
                "durable_event_hash",
            ],
            evidence_fields=[
                "session_id",
                "tool_call_hash",
                "state_ref",
                "approval_payload_hash",
                "output_payload_hash",
            ],
            notes={
                "inspired_by": "pi",
                "coupling": "adapter_contract_only",
                "source": "https://github.com/earendil-works/pi",
                "security": (
                    "External harnesses without built-in permission systems must run "
                    "behind PluggedInSocial gates and a containerized boundary."
                ),
            },
        ),
    ]


def _platform_manifest() -> IntegrationPlatformManifestEnvelope:
    return IntegrationPlatformManifestEnvelope(
        closed_loop_stages=_CLOSED_LOOP_STAGES,
        governance_gates=[
            "tenant_rls",
            "internal_system_rls",
            "handoff_scope_guard",
            "approval_payload_hash",
            "content_hash_gate",
            "publish_content_hash_gate",
            "capability_gate",
            "idempotency_key",
            "durable_event_hash",
            "next_action_approval",
            "external_adapter_boundary",
            "sandbox_boundary",
            "evidence_hash_gate",
            "no_secret_exfiltration",
        ],
        agents=_agent_manifest(),
        queues=_queue_manifest(),
        api_endpoints=_endpoint_manifest(),
        data_resources=_data_resource_manifest(),
        configuration_requirements=_configuration_manifest(),
        external_adapters=_external_adapter_manifest(),
        links=[
            _link("capabilities", "/api/integration/v1/capabilities"),
            _link("external_adapters", "/api/integration/v1/external-adapters"),
            _link("engagements", "/api/integration/v1/engagements"),
        ],
    )


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


@router.get("/platform-manifest", response_model=IntegrationPlatformManifestEnvelope)
async def get_platform_manifest(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    _ = db
    _org_id_from_user(current_user)
    return _platform_manifest()


@router.get(
    "/external-adapters",
    response_model=list[IntegrationExternalAdapterManifest],
)
async def get_external_adapters(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    _ = db
    _org_id_from_user(current_user)
    return _external_adapter_manifest()


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


@router.post(
    "/marketing-runs/{run_id}/dispatch",
    response_model=IntegrationRunDispatchEnvelope,
)
async def dispatch_marketing_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    engagement = await _get_engagement(
        db,
        org_id=org_id,
        engagement_id=run.engagement_id,
    )
    actor_id = _user_id_from_user(current_user)
    try:
        dispatch = await approve_and_dispatch_marketing_run(
            db,
            engagement=engagement,
            run=run,
            actor_id=str(actor_id) if actor_id else None,
        )
    except MarketingRunAccessGateError as exc:
        await db.commit()
        raise HTTPException(
            status_code=409,
            detail={
                "code": "access_requests_open",
                "message": "Resolve access requests before dispatching agents.",
                "access_request_ids": [
                    str(request.id) for request in exc.open_access_requests
                ],
            },
        ) from exc

    await db.commit()
    await db.refresh(run)
    return IntegrationRunDispatchEnvelope(
        run_id=run.id,
        org_id=run.org_id,
        status=run.status,
        stage=run.stage,
        approved_count=len(dispatch.approved_tasks),
        dispatched_count=len(dispatch.dispatched_messages),
        dispatched_task_ids=[
            uuid.UUID(str(message["orchestration_task_id"]))
            for message in dispatch.dispatched_messages
        ],
        links=_run_links(run.id),
    )


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
    "/marketing-runs/{run_id}/social-posts",
    response_model=list[IntegrationSocialPostEnvelope],
)
async def list_run_social_posts(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    posts = await _list_run_social_posts(db, org_id=org_id, run=run)
    return [_to_social_post(item) for item in posts]


@router.get(
    "/marketing-runs/{run_id}/reports",
    response_model=list[IntegrationClientReportEnvelope],
)
async def list_run_reports(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    reports = await _list_run_reports(db, org_id=org_id, run=run)
    return [_to_report(item) for item in reports]


@router.get(
    "/reports/{report_id}",
    response_model=IntegrationClientReportEnvelope,
)
async def get_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    report = await _get_report(db, org_id=org_id, report_id=report_id)
    return _to_report(report)


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
    "/marketing-runs/{run_id}/access-requests",
    response_model=list[IntegrationAccessRequestEnvelope],
)
async def list_run_access_requests(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    await _get_run(db, org_id=org_id, run_id=run_id)
    result = await db.execute(
        select(AgencyAccessRequest)
        .where(
            AgencyAccessRequest.org_id == org_id,
            AgencyAccessRequest.marketing_run_id == run_id,
        )
        .order_by(AgencyAccessRequest.created_at.desc())
    )
    return [_to_access_request(item) for item in result.scalars().all()]


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
    snapshot_rows = await _build_run_evidence_snapshot_rows(
        db,
        org_id=org_id,
        run=run,
    )
    return snapshot_rows["summary"]


@router.get(
    "/marketing-runs/{run_id}/evidence-snapshot",
    response_model=IntegrationRunEvidenceSnapshotEnvelope,
)
async def get_run_evidence_snapshot(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    run = await _get_run(db, org_id=org_id, run_id=run_id)
    snapshot_rows = await _build_run_evidence_snapshot_rows(
        db,
        org_id=org_id,
        run=run,
    )

    return IntegrationRunEvidenceSnapshotEnvelope(
        run=_to_run(run),
        summary=snapshot_rows["summary"],
        tasks=[_to_task(item) for item in snapshot_rows["tasks"]],
        events=[
            _to_event(event, run=run, task=task)
            for event, task in snapshot_rows["events"]
        ],
        artifacts=[_to_artifact(item) for item in snapshot_rows["artifacts"]],
        approvals=[_to_approval(item) for item in snapshot_rows["approvals"]],
        access_requests=[
            _to_access_request(item) for item in snapshot_rows["access_requests"]
        ],
        social_posts=[
            _to_social_post(item) for item in snapshot_rows["social_posts"]
        ],
        reports=[_to_report(item) for item in snapshot_rows["reports"]],
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


@router.post(
    "/access-requests/{access_request_id}/decision",
    response_model=IntegrationAccessRequestEnvelope,
)
async def decide_access(
    access_request_id: uuid.UUID,
    body: IntegrationAccessDecision,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    access_request = await _get_access_request(
        db,
        org_id=org_id,
        access_request_id=access_request_id,
    )
    decided = await decide_access_request(
        db,
        access_request=access_request,
        decision=body.decision,
        resolved_by_user_id=_user_id_from_user(current_user),
        decision_note=body.decision_note,
        resolution_payload=body.resolution_payload,
    )
    await db.commit()
    await db.refresh(decided)
    return _to_access_request(decided)


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
