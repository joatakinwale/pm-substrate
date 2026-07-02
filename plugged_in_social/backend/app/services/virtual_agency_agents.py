"""Department-agent execution with enforced orchestration invariants."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Task
from app.models.virtual_agency import (
    VirtualAgencyEventType,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
)
from app.services.virtual_agency import (
    agent_task_handoff_idempotency_key,
    publish_agent_task,
)
from app.services.virtual_agency_orchestration import (
    apply_mutations,
    build_next_action_proposal_completion_payload,
    build_event,
    create_analytics_mutations,
    create_content_mutations,
    create_scheduling_mutations,
    create_strategy_research_mutations,
    DependencyNotSatisfiedError,
    ExecutionScopeError,
    ensure_approval_is_current,
    ensure_dependencies_completed,
    ensure_task_evidence_ready,
    find_event_by_idempotency_key,
    first_social_account,
    get_by_id,
    link_artifact_lineage,
    list_project_draft_posts,
    list_virtual_task_dependencies,
    list_virtual_task_dependents,
    mark_claimed,
    mark_done,
    sync_legacy_task_completion,
    validate_required_context,
)

AGENT_COS = "chief_of_staff"


async def _load_task(
    db: AsyncSession,
    orchestration_task_id: str,
) -> VirtualAgencyTask:
    task = await get_by_id(db, VirtualAgencyTask, orchestration_task_id)
    if task is None:
        raise ValueError("Orchestration task not found")
    return task


def _parse_uuid(value: str | uuid.UUID | None, field_name: str) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ExecutionScopeError(f"Invalid {field_name}") from exc


def _ensure_handoff_scope(
    task: VirtualAgencyTask,
    *,
    org_id: str | uuid.UUID,
    project_id: str | uuid.UUID | None,
    task_id: str | uuid.UUID | None,
) -> None:
    claimed_org_id = _parse_uuid(org_id, "org_id")
    claimed_project_id = _parse_uuid(project_id, "project_id")
    claimed_task_id = _parse_uuid(task_id, "task_id")

    if claimed_org_id != task.org_id:
        raise ExecutionScopeError("Handoff org_id does not match orchestration task")
    if claimed_project_id != task.project_id:
        raise ExecutionScopeError("Handoff project_id does not match orchestration task")
    if task.source_task_id is not None and claimed_task_id != task.source_task_id:
        raise ExecutionScopeError("Handoff task_id does not match source task")
    if task.source_task_id is None and claimed_task_id is not None:
        raise ExecutionScopeError("Handoff task_id was provided for task without source")


def _ensure_handoff_lineage_scope(
    task: VirtualAgencyTask,
    *,
    lineage: dict[str, Any],
) -> None:
    task_lineage = task.lineage if isinstance(task.lineage, dict) else {}
    lineage_project_id = _parse_uuid(lineage.get("project_id"), "lineage.project_id")
    lineage_source_task_id = _parse_uuid(
        lineage.get("legacy_task_id"),
        "lineage.legacy_task_id",
    )
    lineage_orchestration_task_id = _parse_uuid(
        lineage.get("orchestration_task_id"),
        "lineage.orchestration_task_id",
    )

    if lineage_project_id != task.project_id:
        raise ExecutionScopeError("Handoff lineage project_id does not match task")
    if (
        task.source_task_id is not None
        and lineage_source_task_id != task.source_task_id
    ):
        raise ExecutionScopeError(
            "Handoff lineage legacy_task_id does not match source task"
        )
    if (
        lineage_orchestration_task_id is not None
        and lineage_orchestration_task_id != task.id
    ):
        raise ExecutionScopeError(
            "Handoff lineage orchestration_task_id does not match task"
        )
    for field_name in ("engagement_id", "marketing_run_id"):
        claimed = _parse_uuid(lineage.get(field_name), f"lineage.{field_name}")
        expected = _parse_uuid(
            task_lineage.get(field_name),
            f"task.lineage.{field_name}",
        )
        if expected is not None and claimed != expected:
            raise ExecutionScopeError(
                f"Handoff lineage {field_name} does not match task"
            )
        if expected is None and claimed is not None:
            raise ExecutionScopeError(
                f"Handoff lineage {field_name} was provided for task without "
                f"{field_name}"
            )


def _ensure_dependency_scope(
    *,
    claimed_dependency_ids: list[str] | None,
    dependencies: list[VirtualAgencyTask],
) -> None:
    if claimed_dependency_ids is None:
        raise ExecutionScopeError("Handoff dependency_ids are required")

    claimed_ids = {
        parsed
        for item in claimed_dependency_ids
        if (parsed := _parse_uuid(item, "dependency_ids")) is not None
    }
    actual_ids = {dependency.id for dependency in dependencies}
    if claimed_ids != actual_ids:
        raise ExecutionScopeError(
            "Handoff dependency_ids do not match orchestration dependencies"
        )


async def _dispatch_ready_dependents(
    db: AsyncSession,
    task: VirtualAgencyTask,
) -> list[dict[str, Any]]:
    dispatched: list[dict[str, Any]] = []
    dependents = await list_virtual_task_dependents(db, task)
    for dependent in dependents:
        if dependent.status != VirtualAgencyTaskStatus.todo.value:
            continue
        if not dependent.approval_active:
            continue
        dependencies = await list_virtual_task_dependencies(db, dependent)
        try:
            ensure_dependencies_completed(dependencies)
            await ensure_task_evidence_ready(db, dependent)
        except DependencyNotSatisfiedError:
            continue
        message_idempotency_key = agent_task_handoff_idempotency_key(dependent)
        if await find_event_by_idempotency_key(
            db,
            f"handoff:{message_idempotency_key}",
        ):
            continue
        dispatch = await publish_agent_task(
            queue="stevie-virtual-agency",
            task=dependent,
            idempotency_key=message_idempotency_key,
        )
        db.add(dispatch["event"])
        dispatched.append(dispatch["message"])
    return dispatched


async def route_virtual_agency_task(
    db: AsyncSession,
    org_id: str,
    agent_role: str,
    project_id: str | None,
    task_id: str | None,
    orchestration_task_id: str,
    task_version: int,
    approval_version: int | None,
    approval_payload_hash: str | None,
    idempotency_key: str,
    lineage: dict[str, Any],
    context: dict[str, Any],
    emitted_at: str | None = None,
    type: str | None = None,
    dependency_ids: list[str] | None = None,
):
    """Route a durable handoff to the correct department executor."""
    del context, emitted_at, type

    task = await _load_task(db, orchestration_task_id)
    _ensure_handoff_scope(
        task,
        org_id=org_id,
        project_id=project_id,
        task_id=task_id,
    )
    _ensure_handoff_lineage_scope(task, lineage=lineage)

    existing = await find_event_by_idempotency_key(db, idempotency_key)
    if existing is not None:
        if existing.task_id != task.id:
            raise ExecutionScopeError("Idempotency key belongs to a different task")
        if existing.event_type == VirtualAgencyEventType.execution_completed.value:
            return {"ok": True, "status": "duplicate", "task_id": str(existing.task_id)}

    validate_required_context(task)
    if task.agent_role != agent_role:
        raise ValueError("Agent role does not match orchestration task")
    if task.task_version != task_version:
        raise ValueError("Task version is stale")
    ensure_approval_is_current(
        task,
        approval_version=approval_version,
        approval_payload_hash=approval_payload_hash,
    )
    task_status = task.status or VirtualAgencyTaskStatus.todo.value
    if task_status != VirtualAgencyTaskStatus.todo.value:
        raise ExecutionScopeError(f"Task is not executable in status {task_status}")
    dependencies = await list_virtual_task_dependencies(db, task)
    _ensure_dependency_scope(
        claimed_dependency_ids=dependency_ids,
        dependencies=dependencies,
    )
    ensure_dependencies_completed(dependencies)
    await ensure_task_evidence_ready(db, task)

    mark_claimed(task)
    db.add(
        build_event(
            task=task,
            event_type=VirtualAgencyEventType.execution_claimed.value,
            idempotency_key=f"{idempotency_key}:claimed",
            actor_role=agent_role,
            actor_id=None,
            payload={"task_version": task.task_version},
            approval_version=task.approved_version,
        )
    )

    if agent_role == AGENT_COS:
        if task.task_type == "strategy_research":
            mutations = create_strategy_research_mutations(task)
        else:
            mutations = []
    elif agent_role == "content_creative":
        account = await first_social_account(db, task.org_id)
        mutations = create_content_mutations(
            task=task,
            social_account_id=account.id if account else None,
        )
    elif agent_role == "scheduling_distribution":
        posts = await list_project_draft_posts(db, task.project_id)
        mutations = create_scheduling_mutations(posts)
    elif agent_role == "analytics_reporting":
        if task.task_type == "next_action_proposal":
            mutations = []
        else:
            mutations = create_analytics_mutations(task)
    elif agent_role == "community_engagement":
        mutations = []
    else:
        raise ValueError(f"Unknown agent role: {agent_role}")

    artifacts = await apply_mutations(db=db, task=task, mutations=mutations)
    link_artifact_lineage(task=task, artifacts=artifacts)
    mark_done(task)
    completion_payload = {"artifacts_created": len(artifacts)}
    if task.task_type == "strategy_research":
        completion_payload["strategy_research"] = {
            "engagement_id": (task.lineage or {}).get("engagement_id"),
            "marketing_run_id": (task.lineage or {}).get("marketing_run_id"),
            "access_request_count": len(
                (task.context or {}).get("access_request_ids", [])
            )
            if isinstance((task.context or {}).get("access_request_ids"), list)
            else 0,
        }
    if task.task_type == "next_action_proposal":
        completion_payload["next_action_proposal"] = (
            build_next_action_proposal_completion_payload(task)
        )

    legacy_task = await get_by_id(db, Task, task.source_task_id)
    sync_legacy_task_completion(legacy_task)
    if legacy_task is not None:
        db.add(legacy_task)

    db.add(
        build_event(
            task=task,
            event_type=VirtualAgencyEventType.execution_completed.value,
            idempotency_key=idempotency_key,
            actor_role=agent_role,
            actor_id=None,
            payload=completion_payload,
            approval_version=task.approved_version,
        )
    )
    dispatched_dependents = await _dispatch_ready_dependents(db, task)
    return {
        "ok": True,
        "status": task.status,
        "task_id": str(task.id),
        "dispatched_dependents": len(dispatched_dependents),
    }
