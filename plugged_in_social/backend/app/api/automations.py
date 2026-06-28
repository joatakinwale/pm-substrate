"""Automation workflows API."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.email_campaign import Automation, AutomationRun
from app.schemas.common import PaginatedResponse
from app.schemas.email_campaigns import (
    AutomationCreate,
    AutomationResponse,
    AutomationRunResponse,
    AutomationUpdate,
)

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("", response_model=list[AutomationResponse])
async def list_automations(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(Automation).order_by(Automation.created_at.desc())
    if status_filter:
        query = query.where(Automation.status == status_filter)
    result = await db.execute(query)
    return [AutomationResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/{automation_id}", response_model=AutomationResponse)
async def get_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return AutomationResponse.model_validate(automation)


@router.post("", response_model=AutomationResponse, status_code=201)
async def create_automation(
    body: AutomationCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    automation = Automation(
        org_id=org_id,
        name=body.name,
        description=body.description,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config,
        steps=[s.model_dump() for s in body.steps],
        internal_notes=body.internal_notes,
    )
    db.add(automation)
    await db.flush()
    await db.refresh(automation)
    return AutomationResponse.model_validate(automation)


@router.patch("/{automation_id}", response_model=AutomationResponse)
async def update_automation(
    automation_id: uuid.UUID,
    body: AutomationUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")

    update_data = body.model_dump(exclude_unset=True)
    if "steps" in update_data and update_data["steps"]:
        update_data["steps"] = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in update_data["steps"]
        ]
    for field, value in update_data.items():
        setattr(automation, field, value)

    await db.flush()
    await db.refresh(automation)
    return AutomationResponse.model_validate(automation)


@router.post("/{automation_id}/activate", response_model=AutomationResponse)
async def activate_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if not automation.steps:
        raise HTTPException(status_code=400, detail="Automation has no steps")
    automation.status = "active"
    await db.flush()
    await db.refresh(automation)
    return AutomationResponse.model_validate(automation)


@router.post("/{automation_id}/pause", response_model=AutomationResponse)
async def pause_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    automation.status = "paused"
    await db.flush()
    await db.refresh(automation)
    return AutomationResponse.model_validate(automation)


@router.delete("/{automation_id}", status_code=204)
async def delete_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if automation.status == "active":
        raise HTTPException(status_code=400, detail="Pause automation before deleting")
    await db.delete(automation)


# ═══ RUNS ════════════════════════════════════════════════════

@router.get("/{automation_id}/runs", response_model=PaginatedResponse)
async def list_runs(
    automation_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(AutomationRun).where(AutomationRun.automation_id == automation_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(AutomationRun.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    runs = result.scalars().all()

    return PaginatedResponse(
        items=[AutomationRunResponse.model_validate(r) for r in runs],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


# ═══ MANUAL TRIGGER ═════════════════════════════════════════

@router.post("/{automation_id}/trigger")
async def trigger_automation(
    automation_id: uuid.UUID,
    contact_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Manually trigger an automation for testing or one-off execution."""
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if automation.status != "active":
        raise HTTPException(status_code=400, detail="Automation must be active to trigger")

    from app.services.queue_publisher import publish_automation_run

    # contact_id used to be a separate task kwarg; under the queue contract
    # it rides inside trigger_data so the message envelope stays generic.
    trigger_data: dict[str, object] = {
        "triggered_by": current_user.get("sub"),
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }
    if contact_id is not None:
        trigger_data["contact_id"] = str(contact_id)

    await publish_automation_run(
        org_id=automation.org_id,
        automation_id=automation_id,
        trigger_event="manual",
        trigger_data=trigger_data,
    )

    return {"status": "triggered", "automation_id": str(automation_id)}
