"""Department-agent execution with enforced orchestration invariants."""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Task
from app.models.virtual_agency import (
    VirtualAgencyEventType,
    VirtualAgencyTask,
)
from app.services.virtual_agency_orchestration import (
    apply_mutations,
    build_event,
    create_analytics_mutations,
    create_content_mutations,
    create_scheduling_mutations,
    ensure_approval_is_current,
    ensure_dependencies_completed,
    find_event_by_idempotency_key,
    first_social_account,
    get_by_id,
    link_artifact_lineage,
    list_project_draft_posts,
    list_virtual_task_dependencies,
    mark_claimed,
    mark_done,
    sync_legacy_task_completion,
    validate_required_context,
)


async def _load_task(
    db: AsyncSession,
    orchestration_task_id: str,
) -> VirtualAgencyTask:
    task = await get_by_id(db, VirtualAgencyTask, orchestration_task_id)
    if task is None:
        raise ValueError("Orchestration task not found")
    return task


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
    del org_id, project_id, task_id, lineage, context, emitted_at, type, dependency_ids

    existing = await find_event_by_idempotency_key(db, idempotency_key)
    if (
        existing is not None
        and existing.event_type == VirtualAgencyEventType.execution_completed.value
    ):
        return {"ok": True, "status": "duplicate", "task_id": str(existing.task_id)}

    task = await _load_task(db, orchestration_task_id)
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
    dependencies = await list_virtual_task_dependencies(db, task)
    ensure_dependencies_completed(dependencies)

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

    if agent_role == "content_creative":
        account = await first_social_account(db, task.org_id)
        mutations = create_content_mutations(
            task=task,
            social_account_id=account.id if account else None,
        )
    elif agent_role == "scheduling_distribution":
        posts = await list_project_draft_posts(db, task.project_id)
        mutations = create_scheduling_mutations(posts)
    elif agent_role == "analytics_reporting":
        mutations = create_analytics_mutations(task)
    elif agent_role == "community_engagement":
        mutations = []
    else:
        raise ValueError(f"Unknown agent role: {agent_role}")

    artifacts = await apply_mutations(db=db, task=task, mutations=mutations)
    link_artifact_lineage(task=task, artifacts=artifacts)
    mark_done(task)

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
            payload={"artifacts_created": len(artifacts)},
            approval_version=task.approved_version,
        )
    )
    return {"ok": True, "status": task.status, "task_id": str(task.id)}
