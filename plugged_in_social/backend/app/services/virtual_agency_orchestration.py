"""Virtual-agency orchestration invariants and ledger helpers."""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Task
from app.models.report import ClientReport
from app.models.social_media import SocialAccount, SocialPost
from app.models.virtual_agency import (
    VirtualAgencyEvent,
    VirtualAgencyEventType,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
    virtual_agency_task_dependencies,
)


class VirtualAgencyInvariantError(ValueError):
    """Base invariant failure."""


class MissingContextError(VirtualAgencyInvariantError):
    """Raised when required context or lineage is absent."""


class DependencyNotSatisfiedError(VirtualAgencyInvariantError):
    """Raised when a handoff arrives before prerequisites are done."""


class ApprovalStateError(VirtualAgencyInvariantError):
    """Raised when approval is stale, revoked, or version-mismatched."""


class ExecutionScopeError(VirtualAgencyInvariantError):
    """Raised when a handoff claims the wrong tenant, project, or task."""


class CapabilityViolationError(VirtualAgencyInvariantError):
    """Raised when an agent attempts a forbidden mutation."""


class ConcurrentMutationError(VirtualAgencyInvariantError):
    """Raised when a write targets a stale row version."""


AGENT_CAPABILITIES: dict[str, dict[str, set[str]]] = {
    "content_creative": {
        "writes": {"social_post.create"},
        "emits": {"social_post.draft_created"},
    },
    "scheduling_distribution": {
        "writes": {"social_post.schedule"},
        "emits": {"social_post.scheduled"},
    },
    "analytics_reporting": {
        "writes": {"client_report.create"},
        "emits": {
            "client_report.draft_created",
            "marketing.next_action.proposed",
        },
    },
    "community_engagement": {
        "writes": set(),
        "emits": {"community_engagement.completed"},
    },
}

REQUIRED_LINEAGE_KEYS = {"client_request", "project_id", "legacy_task_id"}


@dataclass(slots=True)
class MutationRequest:
    write_kind: str
    payload: dict[str, Any] = field(default_factory=dict)
    target_id: uuid.UUID | None = None
    expected_version: int | None = None


def _canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def social_post_content_hash(post: SocialPost) -> str:
    """Hash the content-bearing fields that approval/scheduling depends on."""
    return compute_hash(
        {
            "platform": post.platform,
            "social_account_id": str(post.social_account_id),
            "caption": post.caption or "",
            "hashtags": post.hashtags or [],
            "media_urls": post.media_urls or [],
            "media_type": post.media_type,
        }
    )


def build_lineage(
    *,
    client_request: str,
    project_id: uuid.UUID,
    legacy_task_id: uuid.UUID,
    orchestration_task_id: uuid.UUID | None = None,
    artifact_id: uuid.UUID | None = None,
    engagement_id: uuid.UUID | None = None,
    marketing_run_id: uuid.UUID | None = None,
) -> dict[str, str]:
    lineage = {
        "client_request": client_request,
        "project_id": str(project_id),
        "legacy_task_id": str(legacy_task_id),
    }
    if orchestration_task_id:
        lineage["orchestration_task_id"] = str(orchestration_task_id)
    if artifact_id:
        lineage["artifact_id"] = str(artifact_id)
    if engagement_id:
        lineage["engagement_id"] = str(engagement_id)
    if marketing_run_id:
        lineage["marketing_run_id"] = str(marketing_run_id)
    return lineage


def validate_required_context(task: VirtualAgencyTask) -> None:
    if not task.reason or not task.reason.strip():
        raise MissingContextError("Task is missing required reason")
    lineage = task.lineage or {}
    missing = sorted(REQUIRED_LINEAGE_KEYS - set(lineage))
    if missing:
        raise MissingContextError(
            f"Task is missing required lineage fields: {', '.join(missing)}"
        )


def serialize_approval_payload(task: VirtualAgencyTask) -> dict[str, Any]:
    return {
        "task_id": str(task.id),
        "agent_role": task.agent_role,
        "task_type": task.task_type,
        "task_version": task.task_version,
        "reason": task.reason,
        "context": task.context or {},
        "lineage": task.lineage or {},
    }


def ensure_approval_is_current(
    task: VirtualAgencyTask,
    *,
    approval_version: int | None,
    approval_payload_hash: str | None,
) -> None:
    if not task.approval_active or task.status == VirtualAgencyTaskStatus.superseded.value:
        raise ApprovalStateError("Task approval is no longer active")
    if task.approved_version != approval_version:
        raise ApprovalStateError("Task approval version is stale")
    if task.approval_payload_hash != approval_payload_hash:
        raise ApprovalStateError("Task approval payload hash is stale")


def ensure_dependencies_completed(tasks: Iterable[VirtualAgencyTask]) -> None:
    unmet = [str(task.id) for task in tasks if task.status != VirtualAgencyTaskStatus.done.value]
    if unmet:
        raise DependencyNotSatisfiedError(
            f"Dependencies not satisfied: {', '.join(unmet)}"
        )


async def ensure_task_evidence_ready(
    db: AsyncSession,
    task: VirtualAgencyTask,
) -> None:
    if task.agent_role != "analytics_reporting" or task.task_type != "analytics_reporting":
        return
    metric_posts = await list_project_metric_posts(db, task.project_id)
    if not metric_posts:
        raise DependencyNotSatisfiedError(
            "Analytics task requires published social metrics evidence"
        )


def ensure_capability(agent_role: str, mutations: Iterable[MutationRequest]) -> None:
    allowed = AGENT_CAPABILITIES.get(agent_role, {}).get("writes", set())
    for mutation in mutations:
        if mutation.write_kind not in allowed:
            raise CapabilityViolationError(
                f"Agent {agent_role} cannot perform {mutation.write_kind}"
            )


def build_event(
    *,
    task: VirtualAgencyTask,
    event_type: str,
    idempotency_key: str,
    actor_role: str | None,
    actor_id: str | None,
    payload: dict[str, Any] | None = None,
    approval_version: int | None = None,
) -> VirtualAgencyEvent:
    event_payload = payload or {}
    payload_hash = compute_hash(event_payload)
    event_hash = compute_hash(
        {
            "task_id": str(task.id),
            "event_type": event_type,
            "idempotency_key": idempotency_key,
            "task_version": task.task_version,
            "approval_version": approval_version,
            "payload_hash": payload_hash,
            "previous_event_hash": task.latest_event_hash,
        }
    )
    event = VirtualAgencyEvent(
        org_id=task.org_id,
        task_id=task.id,
        event_type=event_type,
        actor_role=actor_role,
        actor_id=actor_id,
        idempotency_key=idempotency_key,
        task_version=task.task_version,
        approval_version=approval_version,
        previous_event_hash=task.latest_event_hash,
        payload_hash=payload_hash,
        event_hash=event_hash,
        payload=event_payload,
        lineage=task.lineage or {},
    )
    task.latest_event_hash = event_hash
    return event


def approve_task(
    task: VirtualAgencyTask,
    *,
    actor_id: str | None,
    idempotency_key: str,
) -> VirtualAgencyEvent:
    validate_required_context(task)
    approval_payload = serialize_approval_payload(task)
    approval_hash = compute_hash(approval_payload)
    task.approval_active = True
    task.approved_version = task.task_version
    task.approval_payload_hash = approval_hash
    return build_event(
        task=task,
        event_type=VirtualAgencyEventType.approved.value,
        idempotency_key=idempotency_key,
        actor_role="client",
        actor_id=actor_id,
        payload=approval_payload,
        approval_version=task.task_version,
    )


def revoke_task(
    task: VirtualAgencyTask,
    *,
    actor_id: str | None,
    idempotency_key: str,
    reason: str,
) -> VirtualAgencyEvent:
    task.approval_active = False
    task.status = VirtualAgencyTaskStatus.superseded.value
    return build_event(
        task=task,
        event_type=VirtualAgencyEventType.revoked.value,
        idempotency_key=idempotency_key,
        actor_role="client",
        actor_id=actor_id,
        payload={"reason": reason},
        approval_version=task.approved_version,
    )


def mark_claimed(task: VirtualAgencyTask) -> None:
    task.status = VirtualAgencyTaskStatus.claimed.value
    task.claimed_at = datetime.now(timezone.utc)


def mark_done(task: VirtualAgencyTask) -> None:
    task.status = VirtualAgencyTaskStatus.done.value
    task.completed_at = datetime.now(timezone.utc)


def build_handoff_payload(task: VirtualAgencyTask) -> dict[str, Any]:
    validate_required_context(task)
    return {
        "org_id": str(task.org_id),
        "project_id": str(task.project_id),
        "task_id": str(task.source_task_id) if task.source_task_id else None,
        "orchestration_task_id": str(task.id),
        "agent_role": task.agent_role,
        "task_version": task.task_version,
        "approval_version": task.approved_version,
        "approval_payload_hash": task.approval_payload_hash,
        "context": task.context or {},
        "lineage": task.lineage or {},
        "dependency_ids": [str(dep.id) for dep in task.dependencies],
    }


async def get_by_id(
    db: AsyncSession,
    model: type[Any],
    item_id: uuid.UUID | str | None,
) -> Any | None:
    if item_id is None:
        return None
    if isinstance(item_id, str):
        item_id = uuid.UUID(item_id)
    if hasattr(db, "get_by_id"):
        return db.get_by_id(model, item_id)
    return await db.get(model, item_id)


async def list_virtual_tasks_for_project(
    db: AsyncSession,
    project_id: uuid.UUID | str,
) -> list[VirtualAgencyTask]:
    if isinstance(project_id, str):
        project_id = uuid.UUID(project_id)
    if hasattr(db, "list_virtual_tasks_for_project"):
        return list(db.list_virtual_tasks_for_project(project_id))
    result = await db.execute(
        select(VirtualAgencyTask).where(VirtualAgencyTask.project_id == project_id)
    )
    return list(result.scalars().all())


async def list_virtual_task_dependencies(
    db: AsyncSession,
    task: VirtualAgencyTask,
) -> list[VirtualAgencyTask]:
    if hasattr(db, "list_virtual_task_dependencies"):
        return list(db.list_virtual_task_dependencies(task))
    loaded = await get_by_id(db, VirtualAgencyTask, task.id)
    return list((loaded.dependencies if loaded else task.dependencies) or [])


async def list_virtual_task_dependents(
    db: AsyncSession,
    task: VirtualAgencyTask,
) -> list[VirtualAgencyTask]:
    if hasattr(db, "list_virtual_task_dependents"):
        return list(db.list_virtual_task_dependents(task))
    result = await db.execute(
        select(VirtualAgencyTask)
        .join(
            virtual_agency_task_dependencies,
            VirtualAgencyTask.id == virtual_agency_task_dependencies.c.task_id,
        )
        .where(virtual_agency_task_dependencies.c.depends_on_task_id == task.id)
    )
    return list(result.scalars().all())


async def find_event_by_idempotency_key(
    db: AsyncSession,
    idempotency_key: str,
) -> VirtualAgencyEvent | None:
    if hasattr(db, "find_event_by_idempotency_key"):
        return db.find_event_by_idempotency_key(idempotency_key)
    result = await db.execute(
        select(VirtualAgencyEvent).where(
            VirtualAgencyEvent.idempotency_key == idempotency_key
        )
    )
    return result.scalar_one_or_none()


async def list_project_draft_posts(
    db: AsyncSession,
    project_id: uuid.UUID | str,
) -> list[SocialPost]:
    if isinstance(project_id, str):
        project_id = uuid.UUID(project_id)
    if hasattr(db, "list_project_draft_posts"):
        return list(db.list_project_draft_posts(project_id))
    result = await db.execute(
        select(SocialPost).where(
            SocialPost.project_id == project_id,
            SocialPost.status == "draft",
        )
    )
    return list(result.scalars().all())


async def first_social_account(
    db: AsyncSession,
    org_id: uuid.UUID | str,
) -> SocialAccount | None:
    if isinstance(org_id, str):
        org_id = uuid.UUID(org_id)
    if hasattr(db, "first_social_account"):
        return db.first_social_account(org_id)
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.org_id == org_id).limit(1)
    )
    return result.scalar_one_or_none()


async def list_project_metric_posts(
    db: AsyncSession,
    project_id: uuid.UUID | str,
) -> list[SocialPost]:
    if isinstance(project_id, str):
        project_id = uuid.UUID(project_id)
    if hasattr(db, "list_project_metric_posts"):
        return list(db.list_project_metric_posts(project_id))
    result = await db.execute(
        select(SocialPost).where(
            SocialPost.project_id == project_id,
            SocialPost.status == "published",
            SocialPost.published_at.isnot(None),
        )
    )
    return [post for post in result.scalars().all() if post_has_metric_evidence(post)]


def post_has_metric_evidence(post: SocialPost) -> bool:
    return any([
        bool(post.likes),
        bool(post.comments),
        bool(post.shares),
        bool(post.impressions),
        bool(post.reach),
        post.engagement_rate is not None,
    ])


def create_content_mutations(
    *,
    task: VirtualAgencyTask,
    social_account_id: uuid.UUID | None,
) -> list[MutationRequest]:
    if social_account_id is None:
        return []
    return [
        MutationRequest(
            write_kind="social_post.create",
            payload={
                "social_account_id": social_account_id,
                "platform": "linkedin",
                "status": "draft",
                "caption": "Draft generated by Content & Creative Agent.",
                "created_by_agent": task.agent_role,
            },
        )
    ]


def create_scheduling_mutations(posts: Iterable[SocialPost]) -> list[MutationRequest]:
    base_time = datetime.now(timezone.utc)
    mutations: list[MutationRequest] = []
    for offset, post in enumerate(posts, start=1):
        mutations.append(
            MutationRequest(
                write_kind="social_post.schedule",
                target_id=post.id,
                expected_version=post.version,
                payload={
                    "scheduled_at": base_time + timedelta(days=offset),
                    "expected_content_hash": social_post_content_hash(post),
                },
            )
        )
    return mutations


def create_analytics_mutations(task: VirtualAgencyTask) -> list[MutationRequest]:
    return [
        MutationRequest(
            write_kind="client_report.create",
            payload={
                "title": "Campaign Post-Mortem Report",
                "status": "draft",
                "cadence": "weekly",
                "created_by_agent": task.agent_role,
            },
        )
    ]


def build_next_action_proposal_completion_payload(task: VirtualAgencyTask) -> dict[str, Any]:
    context = task.context or {}
    metrics = context.get("metrics_snapshot") or {}
    source_report = context.get("source_report") or {}
    pm_substrate = context.get("pm_substrate") or {}
    evidence_refs = context.get("evidence_refs") or []
    content_hashes = context.get("content_hashes") or {}

    return {
        "recommended_action": _recommend_next_marketing_action(metrics),
        "source_report_id": source_report.get("client_report_id"),
        "evidence_ref_count": len(evidence_refs) if isinstance(evidence_refs, list) else 0,
        "content_hashes": content_hashes if isinstance(content_hashes, dict) else {},
        "pm_substrate_action_type": pm_substrate.get("action_type"),
    }


def _recommend_next_marketing_action(metrics: dict[str, Any]) -> str:
    qualified_leads = _metric_number(
        metrics,
        "qualified_leads_generated",
        "qualified_leads",
        "leads",
    )
    sample_size = max(
        _metric_number(metrics, "total_reach", "reach"),
        _metric_number(metrics, "total_impressions", "impressions"),
        _metric_number(metrics, "content_pieces_published", "posts_published"),
    )
    conversion_rate = _metric_number(metrics, "conversion_rate", "lead_conversion_rate")
    if conversion_rate > 1:
        conversion_rate = conversion_rate / 100
    if conversion_rate <= 0 and sample_size > 0:
        conversion_rate = qualified_leads / sample_size

    engagement_rate = _metric_number(metrics, "avg_engagement_rate", "engagement_rate")
    if engagement_rate > 1:
        engagement_rate = engagement_rate / 100

    if qualified_leads >= 10 and conversion_rate >= 0.03:
        return "launch_followup_campaign"
    if engagement_rate >= 0.05 and conversion_rate < 0.015:
        return "increase_distribution"
    if engagement_rate < 0.02 or conversion_rate < 0.01:
        return "revise_content_strategy"
    return "pause_and_review"


def _metric_number(metrics: dict[str, Any], *keys: str) -> float:
    for key in keys:
        value = metrics.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str) and value.strip():
            try:
                return float(value)
            except ValueError:
                continue
    return 0.0


async def apply_mutations(
    *,
    db: AsyncSession,
    task: VirtualAgencyTask,
    mutations: Iterable[MutationRequest],
) -> list[Any]:
    mutations = list(mutations)
    ensure_capability(task.agent_role, mutations)
    created: list[Any] = []
    for mutation in mutations:
        if mutation.write_kind == "social_post.create":
            post = SocialPost(
                org_id=task.org_id,
                project_id=task.project_id,
                social_account_id=mutation.payload["social_account_id"],
                platform=mutation.payload["platform"],
                status=mutation.payload["status"],
                caption=mutation.payload["caption"],
                created_by_agent=mutation.payload["created_by_agent"],
                internal_notes=f"Lineage: {_canonical_json(task.lineage or {})}",
                version=1,
            )
            db.add(post)
            created.append(post)
            continue
        if mutation.write_kind == "social_post.schedule":
            post = await get_by_id(db, SocialPost, mutation.target_id)
            if post is None:
                raise ConcurrentMutationError("Target social post was not found")
            if post.version != mutation.expected_version:
                raise ConcurrentMutationError("Social post version conflict detected")
            expected_content_hash = mutation.payload.get("expected_content_hash")
            if not isinstance(expected_content_hash, str) or not expected_content_hash:
                raise ConcurrentMutationError("Social post content hash gate missing")
            if social_post_content_hash(post) != expected_content_hash:
                raise ConcurrentMutationError("Social post content hash conflict detected")
            post.scheduled_at = mutation.payload["scheduled_at"]
            post.status = "scheduled"
            post.scheduled_content_hash = expected_content_hash
            post.version += 1
            db.add(post)
            created.append(post)
            continue
        if mutation.write_kind == "client_report.create":
            report = ClientReport(
                org_id=task.org_id,
                project_id=task.project_id,
                title=mutation.payload["title"],
                status=mutation.payload["status"],
                cadence=mutation.payload["cadence"],
                created_by_agent=mutation.payload["created_by_agent"],
                period_start=datetime.now(timezone.utc).date(),
                period_end=datetime.now(timezone.utc).date(),
                sections=[
                    {
                        "type": "text",
                        "title": "Summary",
                        "data": {"text": "Agent analysis goes here."},
                    }
                ],
            )
            db.add(report)
            created.append(report)
            continue
        raise CapabilityViolationError(f"Unsupported mutation {mutation.write_kind}")
    return created


def link_artifact_lineage(
    *,
    task: VirtualAgencyTask,
    artifacts: Iterable[Any],
) -> None:
    for artifact in artifacts:
        lineage = build_lineage(
            client_request=(task.lineage or {}).get("client_request", ""),
            project_id=task.project_id,
            legacy_task_id=task.source_task_id or task.id,
            orchestration_task_id=task.id,
            artifact_id=getattr(artifact, "id", None),
        )
        if hasattr(artifact, "internal_notes"):
            artifact.internal_notes = f"Lineage: {_canonical_json(lineage)}"


def sync_legacy_task_completion(task: Task | None) -> None:
    if task is None:
        return
    task.completed_at = datetime.now(timezone.utc)
