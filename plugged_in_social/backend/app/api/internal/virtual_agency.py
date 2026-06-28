"""Internal webhook for virtual agency tasks from Cloudflare worker."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.api.internal.webhooks import verify_webhook_secret
from app.services.virtual_agency_agents import route_virtual_agency_task

router = APIRouter(prefix="/internal/virtual-agency", tags=["internal_virtual_agency"])

class VirtualAgencyTaskRequest(BaseModel):
    org_id: str
    agent_role: str
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    orchestration_task_id: str
    task_version: int
    approval_version: Optional[int] = None
    approval_payload_hash: Optional[str] = None
    idempotency_key: str
    lineage: dict[str, Any]
    context: dict[str, Any]

@router.post("/task")
async def execute_task(
    req: VirtualAgencyTaskRequest,
    request: Request,
    _: None = Depends(verify_webhook_secret),
    db: AsyncSession = Depends(get_db),
):
    """Executes a virtual agency task. Invoked by Cloudflare worker."""
    await route_virtual_agency_task(
        db=db,
        org_id=req.org_id,
        agent_role=req.agent_role,
        project_id=req.project_id,
        task_id=req.task_id,
        orchestration_task_id=req.orchestration_task_id,
        task_version=req.task_version,
        approval_version=req.approval_version,
        approval_payload_hash=req.approval_payload_hash,
        idempotency_key=req.idempotency_key,
        lineage=req.lineage,
        context=req.context,
    )
    await db.commit()
    
    return {
        "ok": True,
        "agent_role": req.agent_role,
        "task_id": req.task_id,
        "orchestration_task_id": req.orchestration_task_id,
    }
