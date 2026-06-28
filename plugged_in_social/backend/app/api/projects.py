"""Project management endpoints — CRUD, Kanban, tasks, comments, sprints, deps."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.models import (
    Project,
    Sprint,
    Task,
    TaskComment,
    WORKFLOW_STEPS,
    task_dependencies,
)
from app.models.project import ProjectType, ProjectVisibility, SprintStatus
from app.schemas.common import PaginatedResponse, version_conflict
from app.schemas.projects import (
    CommentCreate,
    CommentResponse,
    DependencyAdd,
    DependencyResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    SprintCreate,
    SprintResponse,
    SprintUpdate,
    TaskCreate,
    TaskMoveRequest,
    TaskResponse,
    TaskUpdate,
    WorkflowStepInfo,
    WorkloadEntry,
)

router = APIRouter(prefix="/projects", tags=["projects"])


# ═══ PROJECTS ═══════════════════════════════════════════════

@router.get("", response_model=PaginatedResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    # PM-1: filter by client vs internal workspace. Default None returns
    # both so the existing /admin/projects page keeps working unchanged;
    # /admin/work passes type=internal and /admin/projects can opt-in to
    # type=client to hide internals.
    project_type: str | None = Query(None, alias="type"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(Project)
    if status_filter:
        query = query.where(Project.status == status_filter)
    if project_type in ("client", "internal"):
        query = query.where(Project.project_type == project_type)
        # PM-1: admins_only visibility gate. Non-admin team members never
        # see admins_only internal projects — even in the list — so the
        # row count in the UI matches what they can click into.
        role = (current_user.get("role") or "").lower()
        if project_type == "internal" and role not in ("admin", "owner"):
            query = query.where(
                Project.visibility == ProjectVisibility.team.value
            )
    if search:
        query = query.where(
            Project.name.ilike(f"%{search}%")
            | Project.client_name.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Project.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    projects = result.scalars().all()

    # Attach task counts
    items = []
    for p in projects:
        resp = ProjectResponse.model_validate(p)
        resp.task_count = len(p.tasks) if p.tasks else 0
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # PM-1: enforce visibility on internal projects. The list filter above
    # hides admins_only rows from non-admins, but a direct GET by id would
    # bypass that. Collapse both cases to 404 so visibility can't be used
    # to probe for existence.
    if project.project_type == ProjectType.internal.value:
        role = (current_user.get("role") or "").lower()
        if (
            project.visibility == ProjectVisibility.admins_only.value
            and role not in ("admin", "owner")
        ):
            raise HTTPException(status_code=404, detail="Project not found")
    resp = ProjectResponse.model_validate(project)
    resp.task_count = len(project.tasks) if project.tasks else 0
    return resp


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a project. Auto-generates the 13-step workflow columns.

    PM-1: accepts ``project_type`` (client | internal), ``visibility``
    (team | admins_only, internal-only), and optional ``workflow_steps``
    override for internal projects. Client fields are still allowed on
    an internal project but the portal never surfaces them.
    """
    org_id = uuid.UUID(current_user["org_id"])
    # Dump step definitions back to plain dicts so JSONB stores a portable
    # shape rather than pydantic's model instances.
    workflow_steps_payload = (
        [s.model_dump() for s in body.workflow_steps]
        if body.workflow_steps
        else None
    )
    project = Project(
        org_id=org_id,
        name=body.name,
        description=body.description,
        client_name=body.client_name,
        client_email=body.client_email,
        compound_phase=body.compound_phase,
        lead_id=body.lead_id,
        proposal_id=body.proposal_id,
        start_date=body.start_date or datetime.now(timezone.utc),
        target_date=body.target_date,
        color=body.color,
        status="active",
        project_type=body.project_type,
        visibility=body.visibility,
        workflow_steps=workflow_steps_payload,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    # Broadcast to SSE subscribers so the dashboard renders the new card
    # without a refresh. Non-critical — broadcast errors are swallowed
    # inside realtime.broadcast_*.
    from app.services.realtime import broadcast_project_update
    await broadcast_project_update(
        org_id=org_id,
        project_id=project.id,
        action="created",
        project_data={
            "name": project.name,
            "status": project.status,
            "client_name": project.client_name,
            "compound_phase": project.compound_phase,
        },
    )

    resp = ProjectResponse.model_validate(project)
    resp.task_count = 0
    return resp


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Capture the previous status so we only broadcast a status_changed
    # event when it actually flipped — otherwise every card-detail edit
    # would fire a noisy status event.
    previous_status = project.status

    update_data = body.model_dump(exclude_unset=True)
    # PM-1: changing visibility on an internal project is admin/owner only.
    # We permit it through the normal PATCH endpoint (rather than a sub-
    # resource) but gate the field here so a non-admin editor can still
    # rename/re-color the project without escalating.
    if "visibility" in update_data:
        if project.project_type != ProjectType.internal.value:
            # Silently drop — visibility has no meaning for client
            # projects; treating this as an error would break clients
            # that echo the full form back on save.
            update_data.pop("visibility")
        else:
            role = (current_user.get("role") or "").lower()
            if role not in ("admin", "owner"):
                raise HTTPException(
                    status_code=403,
                    detail="Only admins or owners can change visibility",
                )
    # PM-1: workflow_steps override is admin/owner only and only valid on
    # internal projects. Same rationale as visibility above.
    if "workflow_steps" in update_data:
        if project.project_type != ProjectType.internal.value:
            update_data.pop("workflow_steps")
        else:
            role = (current_user.get("role") or "").lower()
            if role not in ("admin", "owner"):
                raise HTTPException(
                    status_code=403,
                    detail="Only admins or owners can change workflow steps",
                )
            # Pydantic gave us list[WorkflowStepDef]; store dicts.
            steps = update_data["workflow_steps"]
            if steps is not None:
                update_data["workflow_steps"] = [
                    dict(s) if not isinstance(s, dict) else s for s in steps
                ]
    for field, value in update_data.items():
        setattr(project, field, value)

    if body.status == "completed" and not project.completed_at:
        project.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(project)

    from app.services.realtime import broadcast_project_update
    action = "status_changed" if project.status != previous_status else "updated"
    await broadcast_project_update(
        org_id=project.org_id,
        project_id=project.id,
        action=action,
        project_data={
            "name": project.name,
            "status": project.status,
            "previous_status": previous_status if action == "status_changed" else None,
            "client_name": project.client_name,
        },
    )

    resp = ProjectResponse.model_validate(project)
    resp.task_count = len(project.tasks) if project.tasks else 0
    return resp


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Capture ids before delete — after db.delete the object is expired
    # and we can't read fields without a round-trip.
    org_id = project.org_id
    pid = project.id
    pname = project.name
    await db.delete(project)
    await db.flush()

    from app.services.realtime import broadcast_project_update
    await broadcast_project_update(
        org_id=org_id,
        project_id=pid,
        action="deleted",
        project_data={"name": pname},
    )


# ═══ KANBAN BOARD ════════════════════════════════════════════

@router.get("/{project_id}/board", response_model=list[WorkflowStepInfo])
async def get_board(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get the workflow step list with task counts for each column.

    PM-1: if the project is internal and has a ``workflow_steps`` JSONB
    override, the returned steps come from that override instead of the
    canonical 13-step Stevie workflow. Client projects (and internal
    projects without an override) always return WORKFLOW_STEPS so
    client-approval contracts remain pinned to step 9.
    """
    # Verify project exists and capture project_type + workflow_steps for
    # the step-source decision below.
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # PM-1: internal-project visibility gate. Mirrors get_project so that
    # /board can't be used to sidestep admins_only.
    if project.project_type == ProjectType.internal.value:
        role = (current_user.get("role") or "").lower()
        if (
            project.visibility == ProjectVisibility.admins_only.value
            and role not in ("admin", "owner")
        ):
            raise HTTPException(status_code=404, detail="Project not found")

    # Pick the right step source. Custom steps must still be a list of
    # dicts shaped like WORKFLOW_STEPS entries; the migration/schema
    # enforces the shape on write so we can trust the stored JSONB here.
    if (
        project.project_type == ProjectType.internal.value
        and project.workflow_steps
    ):
        steps_source = project.workflow_steps
    else:
        steps_source = WORKFLOW_STEPS

    # Count tasks per step
    step_counts_q = (
        select(Task.workflow_step, func.count(Task.id).label("cnt"))
        .where(Task.project_id == project_id)
        .group_by(Task.workflow_step)
    )
    step_counts = {row.workflow_step: row.cnt for row in (await db.execute(step_counts_q)).all()}

    return [
        WorkflowStepInfo(
            step=ws["step"],
            key=ws["key"],
            title=ws["title"],
            task_count=step_counts.get(ws["step"], 0),
        )
        for ws in steps_source
    ]


# ═══ TASKS ═══════════════════════════════════════════════════

@router.get("/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: uuid.UUID,
    # PM-1: widened from 1–13 to 1–50 to match TaskCreate/TaskMoveRequest.
    # Internal projects may define custom workflow step lists beyond 13.
    workflow_step: int | None = Query(None, ge=1, le=50),
    # PM-2: optional sprint filter. ``sprint_id`` narrows the list to
    # tasks in that sprint; ``sprint_id=backlog`` (string literal) returns
    # tasks not assigned to any sprint. Omitting both returns everything.
    sprint_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List tasks for a project, optionally filtered by workflow step or sprint."""
    query = select(Task).where(Task.project_id == project_id)
    if workflow_step is not None:
        query = query.where(Task.workflow_step == workflow_step)
    if sprint_id is not None:
        if sprint_id == "backlog":
            query = query.where(Task.sprint_id.is_(None))
        else:
            try:
                sprint_uuid = uuid.UUID(sprint_id)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="sprint_id must be a UUID or the string 'backlog'",
                )
            query = query.where(Task.sprint_id == sprint_uuid)
    query = query.order_by(Task.workflow_step, Task.position)

    result = await db.execute(query)
    tasks = result.scalars().all()
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: uuid.UUID,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    # Verify project
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    org_id = uuid.UUID(current_user["org_id"])

    # Calculate position (append to end of step)
    max_pos_q = select(func.max(Task.position)).where(
        Task.project_id == project_id,
        Task.workflow_step == body.workflow_step,
    )
    max_pos = (await db.execute(max_pos_q)).scalar() or 0.0

    # PM-1: "step 9 = client-visible" is a CLIENT-project convention. For
    # internal projects step 9 is just an integer — a custom workflow
    # could use it as "In QA" or any other label, and auto-flagging it
    # as client_visible would be wrong (and meaningless, since internal
    # projects never surface through the portal anyway).
    is_client_project = project.project_type == ProjectType.client.value
    client_visible = body.client_visible or (
        is_client_project and body.workflow_step == 9
    )

    # PM-2: if sprint_id is supplied, verify it belongs to this project so
    # callers can't attach a task to a sprint from a different project.
    # ``None`` means "backlog" and is always allowed.
    if body.sprint_id is not None:
        sprint_check = await db.execute(
            select(Sprint.id).where(
                Sprint.id == body.sprint_id,
                Sprint.project_id == project_id,
            )
        )
        if sprint_check.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400,
                detail="sprint_id does not belong to this project",
            )

    task = Task(
        org_id=org_id,
        project_id=project_id,
        workflow_step=body.workflow_step,
        position=max_pos + 1.0,
        title=body.title,
        description=body.description,
        priority=body.priority,
        assignee_id=body.assignee_id,
        assignee_name=body.assignee_name,
        due_date=body.due_date,
        tags=body.tags,
        client_visible=client_visible,
        # PM-2: estimation + sprint fields.
        story_points=body.story_points,
        estimate_hours=body.estimate_hours,
        sprint_id=body.sprint_id,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.get("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = body.model_dump(exclude_unset=True)

    # PM-2: if sprint_id is being set (not cleared), verify it belongs to
    # this project. Clearing to None is always allowed ("move to backlog").
    if "sprint_id" in update_data and update_data["sprint_id"] is not None:
        sprint_ok = (
            await db.execute(
                select(Sprint.id).where(
                    Sprint.id == update_data["sprint_id"],
                    Sprint.project_id == project_id,
                )
            )
        ).scalar_one_or_none()
        if sprint_ok is None:
            raise HTTPException(
                status_code=400,
                detail="sprint_id does not belong to this project",
            )

    for field, value in update_data.items():
        setattr(task, field, value)

    task.version += 1
    await db.flush()
    await db.refresh(task)

    # Broadcast real-time update
    from app.services.realtime import broadcast_task_update
    await broadcast_task_update(
        org_id=current_user["org_id"],
        project_id=project_id,
        task_id=task_id,
        action="updated",
        task_data={
            "title": task.title,
            "workflow_step": task.workflow_step,
            "version": task.version,
            "updated_by": current_user.get("sub"),
        },
    )

    return TaskResponse.model_validate(task)


@router.post("/{project_id}/tasks/{task_id}/move", response_model=TaskResponse)
async def move_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskMoveRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Move a task to a new workflow step/position. Uses optimistic concurrency."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.version != body.version:
        raise version_conflict(
            resource="task",
            current_version=task.version,
            attempted_version=body.version,
            current=TaskResponse.model_validate(task),
        )

    previous_step = task.workflow_step
    task.workflow_step = body.workflow_step
    task.position = body.position
    task.version += 1

    # PM-1: auto-set client_visible for step 9 only on CLIENT projects.
    # Requires loading the parent project once; cheap compared to the
    # activity-log broadcast that already follows.
    proj_result = await db.execute(
        select(Project.project_type).where(Project.id == project_id)
    )
    project_type_val = proj_result.scalar_one_or_none()
    if project_type_val == ProjectType.client.value:
        task.client_visible = body.workflow_step == 9
    # Internal projects: leave client_visible untouched. It's False by
    # default from task creation and would be a no-op to flip.

    # Activity timeline — only fire on actual step change (no-op if step
    # unchanged and only position shifted)
    from app.services.activity_log import log_task_moved
    await log_task_moved(
        db,
        task,
        from_step=previous_step,
        to_step=body.workflow_step,
        moved_by=current_user.get("sub"),
        org_id=uuid.UUID(current_user["org_id"]),
    )

    await db.flush()
    await db.refresh(task)

    # Broadcast real-time move event
    from app.services.realtime import broadcast_task_update
    await broadcast_task_update(
        org_id=current_user["org_id"],
        project_id=project_id,
        task_id=task_id,
        action="moved",
        task_data={
            "title": task.title,
            "workflow_step": task.workflow_step,
            "position": task.position,
            "version": task.version,
            "client_visible": task.client_visible,
            "moved_by": current_user.get("sub"),
        },
    )

    return TaskResponse.model_validate(task)


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
async def delete_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)


# ═══ COMMENTS ════════════════════════════════════════════════

@router.get("/{project_id}/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskComment)
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
    )
    return [CommentResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/{project_id}/tasks/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    # Verify task exists
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    comment = TaskComment(
        task_id=task_id,
        author_id=uuid.UUID(current_user["sub"]) if current_user.get("sub") else None,
        author_name=current_user.get("email", "Unknown"),
        content=body.content,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return CommentResponse.model_validate(comment)


# ═══ SPRINTS (PM-2) ══════════════════════════════════════════
# Sprints are scoped under a project (path prefix includes project_id so
# RLS + org filtering applies consistently with the rest of the router).


async def _sprint_rollups(
    db: AsyncSession, sprint_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict]:
    """Compute per-sprint aggregates in a single query.

    Returns ``{sprint_id: {task_count, completed_count,
    total_story_points, completed_story_points}}``. Missing sprints
    (no tasks yet) are simply absent from the dict; callers default to
    zero via ``.get``.
    """
    if not sprint_ids:
        return {}
    done_step = len(WORKFLOW_STEPS)  # last step == "Reporting & Optimization"
    # Two aggregates per row: "everything" and "completed only". The
    # completed-step cutoff uses the canonical 13-step count; custom
    # internal workflows may treat a different final step as "done", but
    # the task also flips ``completed_at`` so we could refine later.
    q = (
        select(
            Task.sprint_id,
            func.count(Task.id).label("task_count"),
            func.count(Task.id).filter(Task.completed_at.is_not(None)).label(
                "completed_count"
            ),
            func.coalesce(func.sum(Task.story_points), 0).label("total_points"),
            func.coalesce(
                func.sum(Task.story_points).filter(Task.completed_at.is_not(None)),
                0,
            ).label("completed_points"),
        )
        .where(Task.sprint_id.in_(sprint_ids))
        .group_by(Task.sprint_id)
    )
    rows = (await db.execute(q)).all()
    _ = done_step  # retained for future refinement; silence unused-var tools
    return {
        r.sprint_id: {
            "task_count": int(r.task_count or 0),
            "completed_count": int(r.completed_count or 0),
            "total_story_points": int(r.total_points or 0),
            "completed_story_points": int(r.completed_points or 0),
        }
        for r in rows
    }


@router.get("/{project_id}/sprints", response_model=list[SprintResponse])
async def list_sprints(
    project_id: uuid.UUID,
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List sprints for a project, newest first, with task-count rollups."""
    # Project existence + internal-visibility check mirrors get_project.
    proj = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.project_type == ProjectType.internal.value:
        role = (current_user.get("role") or "").lower()
        if (
            proj.visibility == ProjectVisibility.admins_only.value
            and role not in ("admin", "owner")
        ):
            raise HTTPException(status_code=404, detail="Project not found")

    q = select(Sprint).where(Sprint.project_id == project_id)
    if status_filter:
        q = q.where(Sprint.status == status_filter)
    q = q.order_by(Sprint.created_at.desc())
    sprints = (await db.execute(q)).scalars().all()

    rollups = await _sprint_rollups(db, [s.id for s in sprints])
    out = []
    for s in sprints:
        resp = SprintResponse.model_validate(s)
        agg = rollups.get(s.id, {})
        resp.task_count = agg.get("task_count", 0)
        resp.completed_count = agg.get("completed_count", 0)
        resp.total_story_points = agg.get("total_story_points", 0)
        resp.completed_story_points = agg.get("completed_story_points", 0)
        out.append(resp)
    return out


@router.post("/{project_id}/sprints", response_model=SprintResponse, status_code=201)
async def create_sprint(
    project_id: uuid.UUID,
    body: SprintCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a sprint on a project.

    If ``status="active"`` is passed and another sprint is already active,
    the DB-level partial unique index raises IntegrityError which we map
    to 409 Conflict so the caller can react without parsing text.
    """
    proj = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    org_id = uuid.UUID(current_user["org_id"])
    sprint = Sprint(
        org_id=org_id,
        project_id=project_id,
        name=body.name,
        goal=body.goal,
        status=body.status,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(sprint)
    try:
        await db.flush()
    except IntegrityError:
        # Partial unique index: ix_sprints_one_active_per_project
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Another sprint is already active on this project",
        )
    await db.refresh(sprint)

    resp = SprintResponse.model_validate(sprint)
    return resp


@router.get("/{project_id}/sprints/{sprint_id}", response_model=SprintResponse)
async def get_sprint(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    sprint = (
        await db.execute(
            select(Sprint).where(
                Sprint.id == sprint_id, Sprint.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    rollups = await _sprint_rollups(db, [sprint.id])
    resp = SprintResponse.model_validate(sprint)
    agg = rollups.get(sprint.id, {})
    resp.task_count = agg.get("task_count", 0)
    resp.completed_count = agg.get("completed_count", 0)
    resp.total_story_points = agg.get("total_story_points", 0)
    resp.completed_story_points = agg.get("completed_story_points", 0)
    return resp


@router.patch("/{project_id}/sprints/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID,
    body: SprintUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    sprint = (
        await db.execute(
            select(Sprint).where(
                Sprint.id == sprint_id, Sprint.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    update_data = body.model_dump(exclude_unset=True)
    # When transitioning to completed, stamp completed_at the first time so
    # burndown history lands on the right date even if the record is later
    # edited.
    if (
        update_data.get("status") == SprintStatus.completed.value
        and not sprint.completed_at
    ):
        sprint.completed_at = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(sprint, field, value)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Another sprint is already active on this project",
        )
    await db.refresh(sprint)

    rollups = await _sprint_rollups(db, [sprint.id])
    resp = SprintResponse.model_validate(sprint)
    agg = rollups.get(sprint.id, {})
    resp.task_count = agg.get("task_count", 0)
    resp.completed_count = agg.get("completed_count", 0)
    resp.total_story_points = agg.get("total_story_points", 0)
    resp.completed_story_points = agg.get("completed_story_points", 0)
    return resp


@router.delete("/{project_id}/sprints/{sprint_id}", status_code=204)
async def delete_sprint(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    sprint = (
        await db.execute(
            select(Sprint).where(
                Sprint.id == sprint_id, Sprint.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    # Task.sprint_id is ON DELETE SET NULL — tasks in this sprint fall back
    # to backlog rather than getting cascade-deleted.
    await db.delete(sprint)


# ═══ TASK DEPENDENCIES (PM-2) ════════════════════════════════


async def _would_create_cycle(
    db: AsyncSession, task_id: uuid.UUID, depends_on_task_id: uuid.UUID
) -> bool:
    """Return True if adding task→depends_on would create a dependency cycle.

    Walks the dependency graph forward from ``depends_on_task_id``
    breadth-first; if we ever reach ``task_id``, inserting the new edge
    would close a loop. Small depth cap (50) prevents pathological walks
    on corrupt data — real task graphs shouldn't approach that.
    """
    visited: set[uuid.UUID] = set()
    frontier: set[uuid.UUID] = {depends_on_task_id}
    for _ in range(50):
        if not frontier:
            return False
        if task_id in frontier:
            return True
        q = (
            select(task_dependencies.c.depends_on_task_id)
            .where(task_dependencies.c.task_id.in_(frontier))
        )
        rows = (await db.execute(q)).all()
        next_frontier = {r[0] for r in rows} - visited
        visited.update(frontier)
        frontier = next_frontier
    # Depth cap exceeded — conservative default: treat as cycle-prone
    return True


@router.get(
    "/{project_id}/tasks/{task_id}/dependencies",
    response_model=list[DependencyResponse],
)
async def list_task_dependencies(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List the tasks that block ``task_id``."""
    # Existence check — RLS already scopes to org.
    task = (
        await db.execute(
            select(Task.id).where(
                Task.id == task_id, Task.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    q = (
        select(
            task_dependencies.c.task_id,
            task_dependencies.c.depends_on_task_id,
            task_dependencies.c.created_at,
        )
        .where(task_dependencies.c.task_id == task_id)
        .order_by(task_dependencies.c.created_at.asc())
    )
    rows = (await db.execute(q)).all()
    return [
        DependencyResponse(
            task_id=r.task_id,
            depends_on_task_id=r.depends_on_task_id,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post(
    "/{project_id}/tasks/{task_id}/dependencies",
    response_model=DependencyResponse,
    status_code=201,
)
async def add_task_dependency(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: DependencyAdd,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Record that ``task_id`` is blocked by ``depends_on_task_id``.

    Validates:
    - Both tasks exist under the same project.
    - No self-dependency (DB CHECK would also catch).
    - No cycle — walks the dependency graph forward from the target.
    """
    if task_id == body.depends_on_task_id:
        raise HTTPException(
            status_code=400, detail="A task cannot depend on itself"
        )

    # Both tasks must belong to the same project. Cross-project dependencies
    # would be surprising in the UI and complicate project deletion.
    both = (
        await db.execute(
            select(Task.id).where(
                Task.id.in_([task_id, body.depends_on_task_id]),
                Task.project_id == project_id,
            )
        )
    ).scalars().all()
    if len(set(both)) != 2:
        raise HTTPException(
            status_code=404,
            detail="Both tasks must exist under this project",
        )

    if await _would_create_cycle(db, task_id, body.depends_on_task_id):
        raise HTTPException(
            status_code=400,
            detail="Adding this dependency would create a cycle",
        )

    # Insert; IntegrityError on duplicate PK → 409.
    stmt = task_dependencies.insert().values(
        task_id=task_id,
        depends_on_task_id=body.depends_on_task_id,
    )
    try:
        await db.execute(stmt)
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Dependency already exists"
        )

    # Return the row we just wrote. created_at has server_default=now()
    # so we must read it back rather than echo the request.
    row = (
        await db.execute(
            select(task_dependencies.c.created_at).where(
                task_dependencies.c.task_id == task_id,
                task_dependencies.c.depends_on_task_id == body.depends_on_task_id,
            )
        )
    ).scalar_one()
    return DependencyResponse(
        task_id=task_id,
        depends_on_task_id=body.depends_on_task_id,
        created_at=row,
    )


@router.delete(
    "/{project_id}/tasks/{task_id}/dependencies/{depends_on_task_id}",
    status_code=204,
)
async def remove_task_dependency(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    depends_on_task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Remove a single dependency edge. Idempotent — 404 if missing."""
    # Verify the task belongs to the project (cheap guard, avoids leaking
    # dependency existence across projects).
    owner = (
        await db.execute(
            select(Task.id).where(
                Task.id == task_id, Task.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Task not found")

    result = await db.execute(
        sa_delete(task_dependencies).where(
            task_dependencies.c.task_id == task_id,
            task_dependencies.c.depends_on_task_id == depends_on_task_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Dependency not found")


# ═══ WORKLOAD (PM-2) ═════════════════════════════════════════


@router.get(
    "/{project_id}/workload", response_model=list[WorkloadEntry]
)
async def project_workload(
    project_id: uuid.UUID,
    # Optional sprint scoping — omit for a whole-project view, pass a
    # sprint_id to see only that sprint's capacity, or "backlog" to see
    # unassigned-to-sprint work.
    sprint_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Aggregate open-work counts and estimates by assignee.

    "Open" == not yet completed (``completed_at IS NULL``). An unassigned
    task contributes to a synthetic row with ``assignee_id=None``.
    """
    proj = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.project_type == ProjectType.internal.value:
        role = (current_user.get("role") or "").lower()
        if (
            proj.visibility == ProjectVisibility.admins_only.value
            and role not in ("admin", "owner")
        ):
            raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.now(timezone.utc)

    q = (
        select(
            Task.assignee_id,
            # assignee_name is denormalized on Task; we pick the most recent
            # value via max() since all rows for the same assignee should
            # carry the same label anyway.
            func.max(Task.assignee_name).label("assignee_name"),
            func.count(Task.id).label("open_tasks"),
            func.coalesce(func.sum(Task.story_points), 0).label("total_points"),
            func.coalesce(func.sum(Task.estimate_hours), 0.0).label("total_hours"),
            func.count(Task.id)
            .filter(Task.due_date.is_not(None), Task.due_date < now)
            .label("overdue"),
        )
        .where(
            Task.project_id == project_id,
            Task.completed_at.is_(None),
        )
        .group_by(Task.assignee_id)
    )
    if sprint_id is not None:
        if sprint_id == "backlog":
            q = q.where(Task.sprint_id.is_(None))
        else:
            try:
                sprint_uuid = uuid.UUID(sprint_id)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="sprint_id must be a UUID or the string 'backlog'",
                )
            q = q.where(Task.sprint_id == sprint_uuid)

    rows = (await db.execute(q)).all()
    return [
        WorkloadEntry(
            assignee_id=r.assignee_id,
            assignee_name=r.assignee_name,
            open_tasks=int(r.open_tasks or 0),
            total_story_points=int(r.total_points or 0),
            total_estimate_hours=float(r.total_hours or 0.0),
            overdue_count=int(r.overdue or 0),
        )
        for r in rows
    ]
