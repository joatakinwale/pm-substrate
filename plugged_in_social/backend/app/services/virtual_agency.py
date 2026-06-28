"""Virtual Agency orchestration."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, Task
from app.models.virtual_agency import (
    VirtualAgencyEventType,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
)
from app.services.queue_publisher import _emit_base, _publish
from app.services.virtual_agency_orchestration import (
    approve_task,
    build_event,
    build_handoff_payload,
    build_lineage,
    list_virtual_tasks_for_project,
    revoke_task,
)

# Agent roles
AGENT_COS = "chief_of_staff"
AGENT_CONTENT = "content_creative"
AGENT_SCHEDULING = "scheduling_distribution"
AGENT_COMMUNITY = "community_engagement"
AGENT_ANALYTICS = "analytics_reporting"


async def publish_agent_task(
    *,
    queue: str,
    task: VirtualAgencyTask,
    actor_id: str | None = None,
) -> dict[str, Any]:
    """Dispatch work to a virtual-agency department agent."""
    message = {
        **_emit_base(),
        "type": "virtual_agency.task",
        **build_handoff_payload(task),
    }
    dispatch_event = build_event(
        task=task,
        event_type=VirtualAgencyEventType.handoff_dispatched.value,
        idempotency_key=f"handoff:{message['idempotency_key']}",
        actor_role=AGENT_COS,
        actor_id=actor_id,
        payload=message,
        approval_version=task.approved_version,
    )
    await _publish(queue=queue, message=message)
    return {"message": message, "event": dispatch_event}


async def start_campaign_planning(
    db: AsyncSession,
    org_id: uuid.UUID | str,
    client_request: str,
    client_name: str,
    client_email: str,
) -> Project:
    """Entry point for the Chief of Staff agent to begin planning a campaign."""
    project = Project(
        org_id=org_id,
        name=f"Campaign: {client_request[:50]}...",
        description=f"Client request: {client_request}",
        status="active",
        project_type="client",
        client_name=client_name,
        client_email=client_email,
        created_by_agent=AGENT_COS,
        metadata_={"client_request": client_request},
    )
    db.add(project)
    await db.flush()

    legacy_tasks = [
        Task(
            org_id=org_id,
            project_id=project.id,
            title="Generate Campaign Content",
            description="Write LinkedIn posts, Blog post, Email drafts.",
            assigned_agent=AGENT_CONTENT,
            created_by_agent=AGENT_COS,
            workflow_step=2,
        ),
        Task(
            org_id=org_id,
            project_id=project.id,
            title="Schedule Content Distribution",
            description="Schedule the posts for optimal times.",
            assigned_agent=AGENT_SCHEDULING,
            created_by_agent=AGENT_COS,
            workflow_step=10,
        ),
        Task(
            org_id=org_id,
            project_id=project.id,
            title="Track Campaign Performance",
            description="Track registration conversions.",
            assigned_agent=AGENT_ANALYTICS,
            created_by_agent=AGENT_COS,
            workflow_step=13,
        ),
    ]
    db.add_all(legacy_tasks)
    await db.flush()

    orchestration_tasks = [
        VirtualAgencyTask(
            org_id=org_id,
            project_id=project.id,
            source_task_id=legacy_tasks[0].id,
            title=legacy_tasks[0].title,
            description=legacy_tasks[0].description,
            reason=legacy_tasks[0].description or legacy_tasks[0].title,
            agent_role=AGENT_CONTENT,
            task_type="content_generation",
            creation_idempotency_key=f"va-task:{legacy_tasks[0].id}",
            context={"client_name": client_name},
            lineage=build_lineage(
                client_request=client_request,
                project_id=project.id,
                legacy_task_id=legacy_tasks[0].id,
            ),
        ),
        VirtualAgencyTask(
            org_id=org_id,
            project_id=project.id,
            source_task_id=legacy_tasks[1].id,
            title=legacy_tasks[1].title,
            description=legacy_tasks[1].description,
            reason=legacy_tasks[1].description or legacy_tasks[1].title,
            agent_role=AGENT_SCHEDULING,
            task_type="content_scheduling",
            creation_idempotency_key=f"va-task:{legacy_tasks[1].id}",
            context={"client_name": client_name},
            lineage=build_lineage(
                client_request=client_request,
                project_id=project.id,
                legacy_task_id=legacy_tasks[1].id,
            ),
        ),
        VirtualAgencyTask(
            org_id=org_id,
            project_id=project.id,
            source_task_id=legacy_tasks[2].id,
            title=legacy_tasks[2].title,
            description=legacy_tasks[2].description,
            reason=legacy_tasks[2].description or legacy_tasks[2].title,
            agent_role=AGENT_ANALYTICS,
            task_type="analytics_reporting",
            creation_idempotency_key=f"va-task:{legacy_tasks[2].id}",
            context={"client_name": client_name},
            lineage=build_lineage(
                client_request=client_request,
                project_id=project.id,
                legacy_task_id=legacy_tasks[2].id,
            ),
        ),
    ]
    orchestration_tasks[1].dependencies.append(orchestration_tasks[0])
    db.add_all(orchestration_tasks)
    await db.flush()

    for task in orchestration_tasks:
        task.lineage["orchestration_task_id"] = str(task.id)
        db.add(
            build_event(
                task=task,
                event_type=VirtualAgencyEventType.task_created.value,
                idempotency_key=f"va-event:create:{task.id}",
                actor_role=AGENT_COS,
                actor_id=None,
                payload=build_handoff_payload(task),
                approval_version=None,
            )
        )
    return project


async def trigger_department_agents_for_project(
    db: AsyncSession,
    org_id: uuid.UUID | str,
    project_id: uuid.UUID | str,
    *,
    actor_id: str | None = None,
) -> list[dict[str, Any]]:
    """Called after client approves the CoS strategy."""
    del org_id  # task rows are already tenant-scoped
    tasks = await list_virtual_tasks_for_project(db, project_id)
    dispatched: list[dict[str, Any]] = []
    for task in tasks:
        if task.status == VirtualAgencyTaskStatus.superseded.value:
            continue
        approval_event = approve_task(
            task,
            actor_id=actor_id,
            idempotency_key=f"va-event:approve:{task.id}:{task.task_version}",
        )
        db.add(approval_event)
        if task.source_task_id:
            legacy_task = await db.get(Task, task.source_task_id)
            if legacy_task:
                legacy_task.client_approved = True
                db.add(legacy_task)
        dispatch = await publish_agent_task(
            queue="stevie-virtual-agency",
            task=task,
            actor_id=actor_id,
        )
        db.add(dispatch["event"])
        dispatched.append(dispatch["message"])
    return dispatched


async def revoke_department_agents_for_project(
    db: AsyncSession,
    org_id: uuid.UUID | str,
    project_id: uuid.UUID | str,
    *,
    actor_id: str | None = None,
    reason: str = "Client revoked approval",
) -> int:
    """Revoke previously approved orchestration tasks for a project."""
    del org_id
    tasks = await list_virtual_tasks_for_project(db, project_id)
    revoked = 0
    for task in tasks:
        if not task.approval_active and task.status == VirtualAgencyTaskStatus.superseded.value:
            continue
        db.add(
            revoke_task(
                task,
                actor_id=actor_id,
                idempotency_key=f"va-event:revoke:{task.id}:{task.task_version}",
                reason=reason,
            )
        )
        if task.source_task_id:
            legacy_task = await db.get(Task, task.source_task_id)
            if legacy_task:
                legacy_task.client_approved = False
                db.add(legacy_task)
        revoked += 1
    return revoked
