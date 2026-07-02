"""API endpoints for the Virtual Agency."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.project import Task
from app.models.report import ClientReport
from app.models.social_media import SocialPost
from app.models.virtual_agency import VirtualAgencyTask
from app.services.report_next_actions import (
    create_next_action_proposal_task_for_report_async,
)
from app.services.virtual_agency import (
    start_campaign_planning,
    trigger_department_agents_for_project,
    publish_agent_task,
    revoke_department_agents_for_project,
)
from app.services.virtual_agency_orchestration import approve_task

router = APIRouter(prefix="/virtual-agency", tags=["virtual-agency"])


def _org_id_from_user(current_user: dict) -> uuid.UUID:
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="Organization context required")
    return uuid.UUID(str(org_id))

class CampaignRequest(BaseModel):
    client_request: str
    client_name: str
    client_email: str


class CampaignRevokeRequest(BaseModel):
    reason: str = "Client revoked approval"

@router.get("/inbox")
async def get_virtual_agency_inbox(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_rls_dep),
):
    """Returns tasks, posts, and reports needing approval from the CoS or client."""
    org_id = _org_id_from_user(current_user)
    # Fetch tasks needing approval
    tasks_result = await db.execute(
        select(Task).where(
            Task.org_id == org_id,
            Task.completed_at.is_(None),
            Task.created_by_agent.isnot(None),
            Task.client_approved == False,  # noqa: E712
        ).limit(10)
    )
    tasks = tasks_result.scalars().all()
    
    # Fetch posts needing approval
    posts_result = await db.execute(
        select(SocialPost).where(
            SocialPost.org_id == org_id,
            SocialPost.status == "draft",
            SocialPost.created_by_agent.isnot(None)
        ).limit(10)
    )
    posts = posts_result.scalars().all()

    # Fetch reports needing approval
    reports_result = await db.execute(
        select(ClientReport).where(
            ClientReport.org_id == org_id,
            ClientReport.status == "draft",
            ClientReport.created_by_agent.isnot(None)
        ).limit(10)
    )
    reports = reports_result.scalars().all()

    # Fetch orchestration-native tasks needing approval. These do not
    # always have a legacy Task row; report -> next-action proposals are
    # born directly in the virtual-agency ledger.
    orchestration_tasks_result = await db.execute(
        select(VirtualAgencyTask).where(
            VirtualAgencyTask.org_id == org_id,
            VirtualAgencyTask.source_task_id.is_(None),
            VirtualAgencyTask.approval_active == False,  # noqa: E712
            VirtualAgencyTask.status == "todo",
        ).limit(10)
    )
    orchestration_tasks = orchestration_tasks_result.scalars().all()

    return {
        "items": [
            *[{
                "id": str(t.id),
                "project_id": str(t.project_id),
                "type": "task",
                "title": t.title,
                "agent": t.created_by_agent,
                "status": "pending_approval",
                "created_at": t.created_at.isoformat(),
            } for t in tasks],
            *[{
                "id": str(p.id),
                "project_id": str(p.project_id) if p.project_id else None,
                "type": "post",
                "title": p.caption[:50] if p.caption else "Social Post",
                "agent": p.created_by_agent,
                "status": "pending_approval",
                "created_at": p.created_at.isoformat(),
            } for p in posts],
            *[{
                "id": str(r.id),
                "project_id": str(r.project_id) if r.project_id else None,
                "type": "report",
                "title": r.title,
                "agent": r.created_by_agent,
                "status": "pending_approval",
                "created_at": r.created_at.isoformat(),
            } for r in reports],
            *[{
                "id": str(t.id),
                "project_id": str(t.project_id),
                "type": "orchestration_task",
                "title": t.title,
                "agent": t.agent_role,
                "task_type": t.task_type,
                "status": "pending_approval",
                "created_at": t.created_at.isoformat(),
            } for t in orchestration_tasks],
        ]
    }

@router.post("/inbox/{item_type}/{item_id}/approve")
async def approve_virtual_agency_item(
    item_type: str,
    item_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_rls_dep),
):
    """1-click approve an agent-generated inbox item."""
    org_id = _org_id_from_user(current_user)
    now = datetime.now(timezone.utc)

    if item_type == "task":
        result = await db.execute(
            select(Task).where(
                Task.id == item_id,
                Task.org_id == org_id,
                Task.created_by_agent.isnot(None),
            )
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.client_approved:
            raise HTTPException(status_code=400, detail="Task already approved")

        task.client_approved = True
        orchestration_result = await db.execute(
            select(VirtualAgencyTask).where(VirtualAgencyTask.source_task_id == task.id)
        )
        orchestration_task = orchestration_result.scalar_one_or_none()
        if orchestration_task:
            db.add(
                approve_task(
                    orchestration_task,
                    actor_id=None,
                    idempotency_key=(
                        f"va-event:approve:{orchestration_task.id}:"
                        f"{orchestration_task.task_version}"
                    ),
                )
            )
            dispatch = await publish_agent_task(
                queue="stevie-virtual-agency",
                task=orchestration_task,
            )
            db.add(dispatch["event"])
        await db.commit()
        return {"ok": True, "id": str(task.id), "type": item_type, "status": "approved"}

    if item_type == "post":
        result = await db.execute(
            select(SocialPost).where(
                SocialPost.id == item_id,
                SocialPost.org_id == org_id,
                SocialPost.created_by_agent.isnot(None),
            )
        )
        post = result.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.status != "draft":
            raise HTTPException(status_code=400, detail="Post is not in draft status")

        post.status = "scheduled"
        if post.scheduled_at is None:
            post.scheduled_at = now
        await db.commit()
        return {"ok": True, "id": str(post.id), "type": item_type, "status": post.status}

    if item_type == "report":
        result = await db.execute(
            select(ClientReport).where(
                ClientReport.id == item_id,
                ClientReport.org_id == org_id,
                ClientReport.created_by_agent.isnot(None),
            )
        )
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if report.status != "draft":
            raise HTTPException(status_code=400, detail="Report is not in draft status")

        report.status = "generated"
        await create_next_action_proposal_task_for_report_async(
            db,
            report=report,
            actor_id=str(current_user.get("id")) if current_user.get("id") else None,
        )
        await db.commit()
        return {"ok": True, "id": str(report.id), "type": item_type, "status": report.status}

    if item_type == "orchestration_task":
        result = await db.execute(
            select(VirtualAgencyTask).where(
                VirtualAgencyTask.id == item_id,
                VirtualAgencyTask.org_id == org_id,
                VirtualAgencyTask.source_task_id.is_(None),
                VirtualAgencyTask.status == "todo",
            )
        )
        orchestration_task = result.scalar_one_or_none()
        if not orchestration_task:
            raise HTTPException(status_code=404, detail="Orchestration task not found")
        if orchestration_task.approval_active:
            raise HTTPException(status_code=400, detail="Task already approved")

        db.add(
            approve_task(
                orchestration_task,
                actor_id=None,
                idempotency_key=(
                    f"va-event:approve:{orchestration_task.id}:"
                    f"{orchestration_task.task_version}"
                ),
            )
        )
        dispatch = await publish_agent_task(
            queue="stevie-virtual-agency",
            task=orchestration_task,
        )
        db.add(dispatch["event"])
        await db.commit()
        return {
            "ok": True,
            "id": str(orchestration_task.id),
            "type": item_type,
            "status": "approved",
        }

    raise HTTPException(status_code=400, detail="Unsupported inbox item type")

@router.post("/campaigns/plan")
async def start_campaign(
    req: CampaignRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_rls_dep),
):
    """Trigger the Chief of Staff agent to plan a campaign."""
    org_id = _org_id_from_user(current_user)
    project = await start_campaign_planning(
        db=db,
        org_id=org_id,
        client_request=req.client_request,
        client_name=req.client_name,
        client_email=req.client_email,
    )
    await db.commit()
    
    return {"ok": True, "project_id": str(project.id)}

@router.post("/campaigns/{project_id}/approve")
async def approve_campaign(
    project_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_rls_dep),
):
    """Client approves the CoS campaign strategy. Dispatches to department agents."""
    org_id = _org_id_from_user(current_user)
    dispatched = await trigger_department_agents_for_project(db, org_id, project_id)
    await db.commit()
    
    return {
        "ok": True,
        "project_id": str(project_id),
        "status": "agents_dispatched",
        "count": len(dispatched),
    }


@router.post("/campaigns/{project_id}/revoke")
async def revoke_campaign(
    project_id: uuid.UUID,
    body: CampaignRevokeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_rls_dep),
):
    """Client revokes previously approved strategy/tasks."""
    org_id = _org_id_from_user(current_user)
    revoked = await revoke_department_agents_for_project(
        db,
        org_id,
        project_id,
        reason=body.reason,
    )
    await db.commit()
    return {
        "ok": True,
        "project_id": str(project_id),
        "status": "revoked",
        "count": revoked,
    }
