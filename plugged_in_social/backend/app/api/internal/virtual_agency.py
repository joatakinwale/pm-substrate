"""Internal webhook for virtual agency tasks from Cloudflare worker."""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Literal

from app.db.database import RequestContext, get_db_with_rls
from app.api.internal.webhooks import verify_webhook_secret
from app.services.virtual_agency_agents import route_virtual_agency_task
from app.services.virtual_agency_orchestration import (
    DependencyNotSatisfiedError,
    ExecutionScopeError,
    VirtualAgencyInvariantError,
)

router = APIRouter(prefix="/internal/virtual-agency", tags=["internal_virtual_agency"])


SHA256_RE = r"^[0-9a-fA-F]{64}$"
REQUIRED_LINEAGE_FIELDS = (
    "client_request",
    "project_id",
    "legacy_task_id",
    "orchestration_task_id",
)
OPTIONAL_LINEAGE_UUID_FIELDS = (
    "artifact_id",
    "engagement_id",
    "marketing_run_id",
)


class VirtualAgencyTaskRequest(BaseModel):
    type: Literal["virtual_agency.task"]
    org_id: uuid.UUID
    idempotency_key: str = Field(min_length=1, max_length=120)
    emitted_at: datetime
    agent_role: Literal[
        "chief_of_staff",
        "content_creative",
        "scheduling_distribution",
        "community_engagement",
        "analytics_reporting",
    ]
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    orchestration_task_id: uuid.UUID
    task_version: int = Field(ge=1)
    approval_version: int | None = Field(default=None, ge=1)
    approval_payload_hash: str | None = Field(default=None, pattern=SHA256_RE)
    lineage: dict[str, Any]
    dependency_ids: list[uuid.UUID]
    context: dict[str, Any]

    @field_validator("lineage")
    @classmethod
    def validate_lineage(cls, value: dict[str, Any]) -> dict[str, Any]:
        for field in REQUIRED_LINEAGE_FIELDS:
            item = value.get(field)
            if not isinstance(item, str) or not item.strip():
                raise ValueError(f"missing lineage.{field}")
        for field in ("project_id", "legacy_task_id", *OPTIONAL_LINEAGE_UUID_FIELDS):
            item = value.get(field)
            if item is None:
                continue
            try:
                uuid.UUID(str(item))
            except ValueError as exc:
                raise ValueError(f"lineage.{field} must be a UUID") from exc
        return value

    @model_validator(mode="after")
    def validate_scope_consistency(self):
        lineage_project_id = uuid.UUID(str(self.lineage["project_id"]))
        if lineage_project_id != self.project_id:
            raise ValueError("lineage.project_id must match project_id")

        if self.task_id is not None:
            lineage_legacy_task_id = uuid.UUID(str(self.lineage["legacy_task_id"]))
            if lineage_legacy_task_id != self.task_id:
                raise ValueError("lineage.legacy_task_id must match task_id")

        lineage_orchestration_task_id = self.lineage.get("orchestration_task_id")
        if lineage_orchestration_task_id is not None and (
            uuid.UUID(str(lineage_orchestration_task_id)) != self.orchestration_task_id
        ):
            raise ValueError(
                "lineage.orchestration_task_id must match orchestration_task_id"
            )
        return self


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
            routed = await route_virtual_agency_task(
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
                emitted_at=req.emitted_at.isoformat(),
                type=req.type,
                dependency_ids=[str(item) for item in req.dependency_ids],
            )
            response = {
                **routed,
                "agent_role": req.agent_role,
                "source_task_id": str(req.task_id) if req.task_id else None,
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
