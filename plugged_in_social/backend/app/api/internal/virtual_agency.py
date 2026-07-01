"""Internal webhook for virtual agency tasks from Cloudflare worker."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.db.database import RequestContext, get_db_with_rls
from app.api.internal.webhooks import verify_webhook_secret
from app.services.virtual_agency_agents import route_virtual_agency_task
from app.services.virtual_agency_orchestration import (
    DependencyNotSatisfiedError,
    ExecutionScopeError,
    VirtualAgencyInvariantError,
)

router = APIRouter(prefix="/internal/virtual-agency", tags=["internal_virtual_agency"])

class VirtualAgencyTaskRequest(BaseModel):
    org_id: uuid.UUID
    agent_role: str
    project_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    orchestration_task_id: uuid.UUID
    task_version: int
    approval_version: Optional[int] = None
    approval_payload_hash: Optional[str] = None
    idempotency_key: str
    lineage: dict[str, Any]
    context: dict[str, Any]

@router.post("/task")
async def execute_task(
    req: VirtualAgencyTaskRequest,
    _: None = Depends(verify_webhook_secret),
):
    """Executes a virtual agency task. Invoked by Cloudflare worker."""
    ctx = RequestContext(
        org_id=str(req.org_id),
        user_id="00000000-0000-0000-0000-00000000a001",
        role="system",
    )
    response: dict[str, Any] | None = None
    try:
        async for db in get_db_with_rls(ctx):
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
            response = {
                "ok": True,
                "agent_role": req.agent_role,
                "task_id": str(req.task_id) if req.task_id else None,
                "orchestration_task_id": str(req.orchestration_task_id),
            }
    except ExecutionScopeError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DependencyNotSatisfiedError as exc:
        raise HTTPException(status_code=425, detail=str(exc)) from exc
    except VirtualAgencyInvariantError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if response is None:
        raise HTTPException(status_code=500, detail="db session not available")
    return response
