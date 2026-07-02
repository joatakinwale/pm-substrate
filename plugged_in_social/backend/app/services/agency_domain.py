"""Deterministic services for the autonomous agency domain spine."""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
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
from app.models.project import Project, ProjectType, Task
from app.models.virtual_agency import (
    VirtualAgencyEventType,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)
from app.services.virtual_agency import (
    AGENT_ANALYTICS,
    AGENT_COMMUNITY,
    AGENT_CONTENT,
    AGENT_COS,
    AGENT_SCHEDULING,
    agent_task_handoff_idempotency_key,
    publish_agent_task,
)
from app.services.external_adapter_contracts import (
    external_adapter_strategy_requirement,
)
from app.services.virtual_agency_orchestration import (
    approve_task,
    build_event,
    build_handoff_payload,
    build_lineage,
    DependencyNotSatisfiedError,
    ensure_dependencies_completed,
    ensure_task_evidence_ready,
    find_event_by_idempotency_key,
    list_virtual_task_dependencies,
    list_virtual_tasks_for_project,
)


@dataclass(slots=True)
class MarketingRunKickoff:
    project: Project
    artifact: AgencyArtifact
    access_requests: list[AgencyAccessRequest]
    tasks: list[VirtualAgencyTask]


@dataclass(slots=True)
class MarketingRunDispatch:
    approved_tasks: list[VirtualAgencyTask]
    dispatched_messages: list[dict[str, Any]]
    open_access_requests: list[AgencyAccessRequest]


class MarketingRunAccessGateError(ValueError):
    def __init__(self, open_access_requests: list[AgencyAccessRequest]):
        self.open_access_requests = open_access_requests
        super().__init__("Marketing run has unresolved access requests")


KICKOFF_REQUIRED_GATES = [
    "tenant_rls",
    "approval_payload_hash",
    "handoff_scope_guard",
    "capability_gate",
    "durable_event_hash",
]

KICKOFF_TASK_SPECS = [
    {
        "task_type": "strategy_research",
        "agent_role": AGENT_COS,
        "title": "Research client platform and draft campaign strategy",
        "description": (
            "Review client URL, repo context, goals, constraints, and copy inputs "
            "before department work starts."
        ),
        "workflow_step": 1,
        "closed_loop_stage": "strategy",
    },
    {
        "task_type": "content_generation",
        "agent_role": AGENT_CONTENT,
        "title": "Create campaign content drafts",
        "description": "Produce social and campaign copy from the approved strategy.",
        "workflow_step": 2,
        "closed_loop_stage": "content",
    },
    {
        "task_type": "content_scheduling",
        "agent_role": AGENT_SCHEDULING,
        "title": "Schedule approved campaign distribution",
        "description": "Schedule approved content with durable content-hash gates.",
        "workflow_step": 10,
        "closed_loop_stage": "scheduling",
    },
    {
        "task_type": "community_engagement",
        "agent_role": AGENT_COMMUNITY,
        "title": "Monitor and respond to campaign engagement",
        "description": "Track audience responses and coordinate follow-up.",
        "workflow_step": 11,
        "closed_loop_stage": "publishing",
    },
    {
        "task_type": "analytics_reporting",
        "agent_role": AGENT_ANALYTICS,
        "title": "Report metrics and propose the next action",
        "description": "Build the report and next-action proposal from metrics evidence.",
        "workflow_step": 13,
        "closed_loop_stage": "next_action",
    },
]


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


async def kickoff_marketing_run(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
    actor_id: str | None = None,
) -> MarketingRunKickoff:
    """Create the initial autonomous-agency work graph for a marketing run."""
    project = await _ensure_marketing_project(db, engagement=engagement, run=run)
    client_context = _client_context(engagement)
    artifact = await create_agency_artifact(
        db,
        org_id=engagement.org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            artifact_type="implementation_brief",
            title=f"Autonomous marketing kickoff: {engagement.name}",
            body=_implementation_brief_body(engagement=engagement, run=run),
            payload={
                "objective": run.objective,
                "client_context": client_context,
                "intake_payload": dict(engagement.intake_payload or {}),
                "integration_state": dict(engagement.integration_state or {}),
                "closed_loop": [
                    "intake",
                    "strategy",
                    "content",
                    "approval",
                    "scheduling",
                    "publishing",
                    "metrics",
                    "report",
                    "next_action",
                ],
            },
            evidence_refs=_engagement_evidence_refs(engagement),
            lineage={
                "marketing_run_id": str(run.id),
                "project_id": str(project.id),
            },
            author_role=AGENT_COS,
        ),
    )
    access_requests = await _create_kickoff_access_requests(
        db,
        engagement=engagement,
        run=run,
    )
    tasks = await _create_kickoff_virtual_tasks(
        db,
        engagement=engagement,
        run=run,
        project=project,
        artifact=artifact,
        access_requests=access_requests,
        actor_id=actor_id,
    )

    engagement.status = ClientEngagementStatus.active.value
    run.stage = MarketingRunStage.strategy.value
    run.strategy_summary = {
        **dict(run.strategy_summary or {}),
        "kickoff": {
            "artifact_id": str(artifact.id),
            "access_request_count": len(access_requests),
            "task_count": len(tasks),
            "agent_roles": [task.agent_role for task in tasks],
        },
        "client_context": client_context,
    }
    db.add(engagement)
    db.add(run)
    await db.flush()
    return MarketingRunKickoff(
        project=project,
        artifact=artifact,
        access_requests=access_requests,
        tasks=tasks,
    )


async def _ensure_marketing_project(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
) -> Project:
    project_id = run.project_id or engagement.project_id
    if project_id is not None:
        project = await db.get(Project, project_id)
        if project is not None:
            engagement.project_id = project.id
            run.project_id = project.id
            return project

    project = Project(
        id=project_id,
        org_id=engagement.org_id,
        name=f"Marketing Engine: {engagement.name}",
        description=_implementation_brief_body(engagement=engagement, run=run),
        status="active",
        project_type=ProjectType.client.value,
        client_name=engagement.client_name,
        client_email=engagement.client_email,
        created_by_agent=AGENT_COS,
        metadata_={
            "engagement_id": str(engagement.id),
            "marketing_run_id": str(run.id),
            "client_url": engagement.client_url,
            "repo_url": engagement.repo_url,
            "goals": list(engagement.goals or []),
            "constraints": list(engagement.constraints or []),
        },
    )
    db.add(project)
    await db.flush()
    engagement.project_id = project.id
    run.project_id = project.id
    return project


async def _create_kickoff_access_requests(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
) -> list[AgencyAccessRequest]:
    requests: list[AgencyAccessRequest] = []
    if engagement.client_url:
        requests.append(
            await create_access_request(
                db,
                org_id=engagement.org_id,
                engagement=engagement,
                body=AgencyAccessRequestCreate(
                    marketing_run_id=run.id,
                    request_type="client_platform",
                    provider="website",
                    scope={
                        "url": engagement.client_url,
                        "needs": ["page_inventory", "conversion_paths", "copy_context"],
                    },
                    reason="Strategy research needs client platform context.",
                    instructions={
                        "action": "review_client_site",
                        "client_url": engagement.client_url,
                    },
                ),
            )
        )
    if engagement.repo_url:
        requests.append(
            await create_access_request(
                db,
                org_id=engagement.org_id,
                engagement=engagement,
                body=AgencyAccessRequestCreate(
                    marketing_run_id=run.id,
                    request_type="repository",
                    provider="github",
                    scope={
                        "repo_url": engagement.repo_url,
                        "permissions": ["contents:read", "pull_requests:write"],
                    },
                    reason="Implementation planning needs repository access.",
                    instructions={
                        "action": "connect_repository",
                        "repo_url": engagement.repo_url,
                    },
                ),
            )
        )

    integration_state = dict(engagement.integration_state or {})
    analytics_provider = str(integration_state.get("analytics_provider") or "analytics")
    requests.append(
        await create_access_request(
            db,
            org_id=engagement.org_id,
            engagement=engagement,
            body=AgencyAccessRequestCreate(
                marketing_run_id=run.id,
                request_type="analytics",
                provider=analytics_provider,
                scope={
                    "client_url": engagement.client_url,
                    "needs": ["traffic", "conversions", "campaign_metrics"],
                },
                reason="Reporting and next-action decisions need metrics access.",
                instructions={"action": "connect_analytics"},
            ),
        )
    )

    channels = integration_state.get("preferred_social_channels") or ["linkedin"]
    if not isinstance(channels, list):
        channels = ["linkedin"]
    for channel in channels:
        provider = str(channel)
        requests.append(
            await create_access_request(
                db,
                org_id=engagement.org_id,
                engagement=engagement,
                body=AgencyAccessRequestCreate(
                    marketing_run_id=run.id,
                    request_type="social_account",
                    provider=provider,
                    scope={"channel": provider, "permissions": ["draft", "schedule"]},
                    reason="Content scheduling needs authorized social account access.",
                    instructions={
                        "action": "connect_social_account",
                        "channel": provider,
                    },
                ),
            )
        )
    return requests


async def _create_kickoff_virtual_tasks(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
    project: Project,
    artifact: AgencyArtifact,
    access_requests: list[AgencyAccessRequest],
    actor_id: str | None,
) -> list[VirtualAgencyTask]:
    legacy_tasks: list[Task] = []
    for spec in KICKOFF_TASK_SPECS:
        legacy_task = Task(
            org_id=engagement.org_id,
            project_id=project.id,
            title=str(spec["title"]),
            description=str(spec["description"]),
            assigned_agent=str(spec["agent_role"]),
            created_by_agent=AGENT_COS,
            workflow_step=int(spec["workflow_step"]),
        )
        db.add(legacy_task)
        legacy_tasks.append(legacy_task)
    await db.flush()

    tasks: list[VirtualAgencyTask] = []
    for spec, legacy_task in zip(KICKOFF_TASK_SPECS, legacy_tasks, strict=True):
        context = {
            "closed_loop_stage": spec["closed_loop_stage"],
            "client_url": engagement.client_url,
            "repo_url": engagement.repo_url,
            "goals": list(engagement.goals or []),
            "constraints": list(engagement.constraints or []),
            "intake_payload": dict(engagement.intake_payload or {}),
            "integration_state": dict(engagement.integration_state or {}),
            "marketing_run_id": str(run.id),
            "engagement_id": str(engagement.id),
            "intake_artifact_id": str(artifact.id),
            "access_request_ids": [str(item.id) for item in access_requests],
            "required_gates": KICKOFF_REQUIRED_GATES,
        }
        if spec["task_type"] == "strategy_research":
            context["research_requirements"] = _strategy_research_requirements(
                engagement=engagement,
                access_requests=access_requests,
            )
            context["external_adapter_requirements"] = (
                _strategy_external_adapter_requirements(engagement)
            )
            context["evidence_refs"] = _engagement_evidence_refs(engagement)
        task = VirtualAgencyTask(
            org_id=engagement.org_id,
            project_id=project.id,
            source_task_id=legacy_task.id,
            title=legacy_task.title,
            description=legacy_task.description,
            reason=legacy_task.description or legacy_task.title,
            agent_role=str(spec["agent_role"]),
            task_type=str(spec["task_type"]),
            status=VirtualAgencyTaskStatus.todo.value,
            task_version=1,
            approval_active=False,
            creation_idempotency_key=f"agency-run:{run.id}:{spec['task_type']}",
            context=context,
            lineage=build_lineage(
                client_request=run.objective,
                project_id=project.id,
                legacy_task_id=legacy_task.id,
                engagement_id=engagement.id,
                marketing_run_id=run.id,
            ),
        )
        task.dependencies = []
        db.add(task)
        tasks.append(task)
    for index, task in enumerate(tasks):
        if index > 0:
            task.dependencies.append(tasks[index - 1])
    await db.flush()

    for task in tasks:
        task.lineage["orchestration_task_id"] = str(task.id)
        db.add(
            build_event(
                task=task,
                event_type=VirtualAgencyEventType.task_created.value,
                idempotency_key=f"agency-run:event:create:{task.id}",
                actor_role=AGENT_COS,
                actor_id=actor_id,
                payload=build_handoff_payload(task),
                approval_version=None,
            )
        )
    return tasks


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _strategy_research_requirements(
    *,
    engagement: ClientEngagement,
    access_requests: list[AgencyAccessRequest],
) -> dict[str, Any]:
    intake_payload = dict(engagement.intake_payload or {})
    source_urls = _string_list(intake_payload.get("source_urls"))
    if engagement.client_url and engagement.client_url not in source_urls:
        source_urls.insert(0, engagement.client_url)

    return {
        "source_urls": source_urls,
        "competitor_urls": _string_list(intake_payload.get("competitor_urls")),
        "copy_inputs": _string_list(intake_payload.get("copy_inputs")),
        "offer": intake_payload.get("offer"),
        "required_access_request_ids": [str(item.id) for item in access_requests],
        "research_questions": [
            "What is the client's product, offer, audience, and conversion path?",
            "What market/category claims are competitors using?",
            "What website, repository, analytics, and social access is still missing?",
            "What strategy should content and distribution agents execute first?",
        ],
    }


def _strategy_external_adapter_requirements(
    engagement: ClientEngagement,
) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    intake_payload = dict(engagement.intake_payload or {})
    source_urls = _string_list(intake_payload.get("source_urls"))
    competitor_urls = _string_list(intake_payload.get("competitor_urls"))
    if engagement.client_url or source_urls or competitor_urls:
        requirement = external_adapter_strategy_requirement("browser_qa_harness")
        if requirement is not None:
            requirements.append(requirement)
    if engagement.repo_url:
        requirement = external_adapter_strategy_requirement("agent_harness")
        if requirement is not None:
            requirements.append(requirement)
    return requirements


def _client_context(engagement: ClientEngagement) -> dict[str, Any]:
    return {
        "client_url": engagement.client_url,
        "repo_url": engagement.repo_url,
        "goals": list(engagement.goals or []),
        "constraints": list(engagement.constraints or []),
    }


def _engagement_evidence_refs(engagement: ClientEngagement) -> list[dict[str, str]]:
    refs = [
        {
            "kind": "source_record",
            "id": f"plugged_in_social:client_engagements:{engagement.id}",
            "label": "PluggedInSocial ClientEngagement row",
        }
    ]
    if engagement.client_url:
        refs.append(
            {
                "kind": "url",
                "id": engagement.client_url,
                "label": "Client platform URL",
            }
        )
    if engagement.repo_url:
        refs.append(
            {
                "kind": "url",
                "id": engagement.repo_url,
                "label": "Client repository URL",
            }
        )
    return refs


def _implementation_brief_body(
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
) -> str:
    parts = [
        f"Objective: {run.objective}",
        f"Client: {engagement.name}",
    ]
    if engagement.client_url:
        parts.append(f"Client URL: {engagement.client_url}")
    if engagement.repo_url:
        parts.append(f"Repository: {engagement.repo_url}")
    if engagement.goals:
        parts.append(f"Goals: {', '.join(engagement.goals)}")
    if engagement.constraints:
        parts.append(f"Constraints: {', '.join(engagement.constraints)}")
    return "\n".join(parts)


async def create_agency_artifact(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement: ClientEngagement,
    body: AgencyArtifactCreate,
) -> AgencyArtifact:
    evidence_refs = normalize_agency_artifact_evidence_refs(body.evidence_refs)
    lineage = build_agency_artifact_lineage(engagement=engagement, body=body)
    payload = dict(body.payload)
    payload_hash = compute_agency_artifact_payload_hash(
        body=body,
        evidence_refs=evidence_refs,
        lineage=lineage,
        payload=payload,
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


def normalize_agency_artifact_evidence_refs(evidence_refs: list[Any]) -> list[dict]:
    evidence_refs = [
        ref.model_dump() if hasattr(ref, "model_dump") else dict(ref)
        for ref in evidence_refs
    ]
    return evidence_refs


def build_agency_artifact_lineage(
    *,
    engagement: ClientEngagement,
    body: AgencyArtifactCreate,
) -> dict:
    lineage = {
        **dict(body.lineage),
        "engagement_id": str(engagement.id),
    }
    if body.marketing_run_id is not None:
        lineage["marketing_run_id"] = str(body.marketing_run_id)
    if body.virtual_agency_task_id is not None:
        lineage["virtual_agency_task_id"] = str(body.virtual_agency_task_id)
    return lineage


def compute_agency_artifact_payload_hash(
    *,
    body: AgencyArtifactCreate,
    evidence_refs: list[dict],
    lineage: dict,
    payload: dict,
) -> str:
    return compute_payload_hash(
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


async def approve_and_dispatch_marketing_run(
    db: AsyncSession,
    *,
    engagement: ClientEngagement,
    run: MarketingRun,
    actor_id: str | None = None,
    approve_tasks: bool = True,
) -> MarketingRunDispatch:
    if run.org_id != engagement.org_id or run.engagement_id != engagement.id:
        raise ValueError("Marketing run does not belong to engagement")

    open_access_requests = await _list_open_run_access_requests(db, run)
    if open_access_requests:
        _mark_run_blocked_by_access_requests(run, open_access_requests)
        db.add(run)
        await db.flush()
        raise MarketingRunAccessGateError(open_access_requests)

    if _current_blocker_type(run) in {"access_request", "access_requests"}:
        run.current_blocker = None
    if run.status == MarketingRunStatus.blocked.value:
        run.status = MarketingRunStatus.active.value
    db.add(run)

    tasks = await _list_marketing_run_tasks(db, run)
    approved_tasks: list[VirtualAgencyTask] = []
    dispatched_messages: list[dict[str, Any]] = []
    for task in tasks:
        if task.status == VirtualAgencyTaskStatus.superseded.value:
            continue
        if not task.approval_active and task.status == VirtualAgencyTaskStatus.todo.value:
            if not approve_tasks:
                continue
            approval_key = f"agency-run:approve:{run.id}:{task.id}:{task.task_version}"
            if await find_event_by_idempotency_key(db, approval_key) is None:
                db.add(
                    approve_task(
                        task,
                        actor_id=actor_id,
                        idempotency_key=approval_key,
                    )
                )
            approved_tasks.append(task)
            legacy_task = await db.get(Task, task.source_task_id)
            if legacy_task is not None:
                legacy_task.client_approved = True
                db.add(legacy_task)

        if task.status != VirtualAgencyTaskStatus.todo.value or not task.approval_active:
            continue
        dependencies = await list_virtual_task_dependencies(db, task)
        try:
            ensure_dependencies_completed(dependencies)
            await ensure_task_evidence_ready(db, task)
        except DependencyNotSatisfiedError:
            continue

        handoff_key = agent_task_handoff_idempotency_key(task)
        if await find_event_by_idempotency_key(db, f"handoff:{handoff_key}") is not None:
            continue
        dispatch = await publish_agent_task(
            queue="stevie-virtual-agency",
            task=task,
            actor_id=actor_id,
            idempotency_key=handoff_key,
        )
        db.add(dispatch["event"])
        dispatched_messages.append(dispatch["message"])

    await db.flush()
    return MarketingRunDispatch(
        approved_tasks=approved_tasks,
        dispatched_messages=dispatched_messages,
        open_access_requests=[],
    )


async def decide_access_request(
    db: AsyncSession,
    *,
    access_request: AgencyAccessRequest,
    decision: str,
    resolved_by_user_id: uuid.UUID | None,
    decision_note: str | None = None,
    resolution_payload: dict[str, Any] | None = None,
) -> AgencyAccessRequest:
    if decision not in {
        AgencyAccessRequestStatus.granted.value,
        AgencyAccessRequestStatus.blocked.value,
        AgencyAccessRequestStatus.revoked.value,
    }:
        raise ValueError("decision must be granted, blocked, or revoked")

    resolved_at = datetime.now(timezone.utc)
    access_request.status = decision
    access_request.resolved_by_user_id = resolved_by_user_id
    access_request.resolved_at = resolved_at
    access_request.instructions = {
        **dict(access_request.instructions or {}),
        "resolution": {
            "decision": decision,
            "decision_note": decision_note,
            "resolution_payload": dict(resolution_payload or {}),
            "resolved_at": resolved_at.isoformat(),
        },
    }

    run = await _get_access_request_run(db, access_request)
    if run is not None:
        if decision == AgencyAccessRequestStatus.blocked.value:
            run.status = MarketingRunStatus.blocked.value
            run.current_blocker = {
                "type": "access_request",
                "access_request_id": str(access_request.id),
                "request_type": access_request.request_type,
                "provider": access_request.provider,
                "status": decision,
                "reason": access_request.reason,
                "decision_note": decision_note,
                "resolved_at": resolved_at.isoformat(),
            }
            db.add(run)
        elif _current_blocker_access_request_id(run) == str(access_request.id):
            run.current_blocker = None
            if run.status == MarketingRunStatus.blocked.value:
                run.status = MarketingRunStatus.active.value
            db.add(run)
        elif _current_blocker_type(run) == "access_requests":
            open_requests = await _list_open_run_access_requests(db, run)
            if not open_requests:
                run.current_blocker = None
                if run.status == MarketingRunStatus.blocked.value:
                    run.status = MarketingRunStatus.active.value
                db.add(run)

    db.add(access_request)
    await db.flush()
    return access_request


async def _get_access_request_run(
    db: AsyncSession,
    access_request: AgencyAccessRequest,
) -> MarketingRun | None:
    if access_request.marketing_run_id is None:
        return None
    run = await db.get(MarketingRun, access_request.marketing_run_id)
    if run is None or run.org_id != access_request.org_id:
        return None
    return run


def _current_blocker_access_request_id(run: MarketingRun) -> str | None:
    blocker = run.current_blocker
    if not isinstance(blocker, dict):
        return None
    if blocker.get("type") != "access_request":
        return None
    request_id = blocker.get("access_request_id")
    return str(request_id) if request_id is not None else None


def _current_blocker_type(run: MarketingRun) -> str | None:
    blocker = run.current_blocker
    if not isinstance(blocker, dict):
        return None
    blocker_type = blocker.get("type")
    return str(blocker_type) if blocker_type is not None else None


async def _list_open_run_access_requests(
    db: AsyncSession,
    run: MarketingRun,
) -> list[AgencyAccessRequest]:
    if hasattr(db, "list_agency_access_requests_for_run"):
        requests = list(db.list_agency_access_requests_for_run(run.id))
    else:
        result = await db.execute(
            select(AgencyAccessRequest).where(
                AgencyAccessRequest.org_id == run.org_id,
                AgencyAccessRequest.marketing_run_id == run.id,
            )
        )
        requests = list(result.scalars().all())
    return [
        request
        for request in requests
        if request.status
        in {
            AgencyAccessRequestStatus.requested.value,
            AgencyAccessRequestStatus.blocked.value,
        }
    ]


def _mark_run_blocked_by_access_requests(
    run: MarketingRun,
    access_requests: list[AgencyAccessRequest],
) -> None:
    run.status = MarketingRunStatus.blocked.value
    run.current_blocker = {
        "type": "access_requests",
        "status": "blocked",
        "access_request_ids": sorted(str(request.id) for request in access_requests),
        "providers": sorted(
            {
                str(request.provider)
                for request in access_requests
                if request.provider is not None
            }
        ),
        "request_types": sorted({request.request_type for request in access_requests}),
        "reason": "Marketing run cannot dispatch until access requests are resolved.",
    }


async def _list_marketing_run_tasks(
    db: AsyncSession,
    run: MarketingRun,
) -> list[VirtualAgencyTask]:
    if run.project_id is None:
        return []
    if hasattr(db, "list_virtual_tasks_for_marketing_run"):
        tasks = list(db.list_virtual_tasks_for_marketing_run(run.id))
    else:
        tasks = await list_virtual_tasks_for_project(db, run.project_id)
    return [
        task
        for task in tasks
        if str((task.lineage or {}).get("marketing_run_id") or "") == str(run.id)
    ]


async def decide_approval_request(
    db: AsyncSession,
    *,
    approval: AgencyApprovalRequest,
    decision: str,
    decided_by_user_id: uuid.UUID | None,
    decision_note: str | None = None,
) -> AgencyApprovalRequest:
    if decision not in {"approved", "rejected", "revoked"}:
        raise ValueError("decision must be approved, rejected, or revoked")
    approval.status = decision
    approval.decided_by_user_id = decided_by_user_id
    approval.decision_note = decision_note
    approval.decided_at = datetime.now(timezone.utc)
    db.add(approval)
    await db.flush()
    return approval
