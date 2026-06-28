"""Cost tracking API — per-org API usage and spending monitoring.

Ported from coldCallAutomated's cost_tracker service. Provides:
  - Cost dashboard with service-level breakdowns
  - Daily cost summaries
  - Spending limit management
"""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.cost_tracker import CostEntry, DailyCostSummary, SpendingLimit
from app.schemas.cost_tracking import (
    CostEntryResponse,
    CostSummaryResponse,
    DailyCostResponse,
    SpendingLimitCreate,
    SpendingLimitResponse,
    SpendingLimitUpdate,
)

router = APIRouter(prefix="/costs", tags=["costs"])


@router.get("/summary", response_model=CostSummaryResponse)
async def get_cost_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get cost summary with service-level breakdown."""
    period_end = date.today()
    period_start = period_end - timedelta(days=days)

    # Total cost
    total_result = await db.execute(
        select(func.coalesce(func.sum(CostEntry.cost_cents), 0)).where(
            CostEntry.incurred_at >= str(period_start),
        )
    )
    total_cents = total_result.scalar() or 0

    # By service
    service_result = await db.execute(
        select(
            CostEntry.service,
            func.sum(CostEntry.cost_cents),
            func.count(),
        )
        .where(CostEntry.incurred_at >= str(period_start))
        .group_by(CostEntry.service)
        .order_by(func.sum(CostEntry.cost_cents).desc())
    )
    by_service = [
        {"service": row[0], "total_cents": row[1] or 0, "count": row[2]}
        for row in service_result.all()
    ]

    return CostSummaryResponse(
        total_cost_cents=total_cents,
        by_service=by_service,
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/daily", response_model=list[DailyCostResponse])
async def list_daily_costs(
    days: int = Query(30, ge=1, le=90),
    service: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get daily cost summaries."""
    cutoff = date.today() - timedelta(days=days)
    query = select(DailyCostSummary).where(
        DailyCostSummary.summary_date >= cutoff
    )
    if service:
        query = query.where(DailyCostSummary.service == service)

    query = query.order_by(DailyCostSummary.summary_date.desc())
    result = await db.execute(query)
    summaries = result.scalars().all()
    return [DailyCostResponse.model_validate(s) for s in summaries]


@router.get("/entries", response_model=list[CostEntryResponse])
async def list_cost_entries(
    service: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List recent cost entries (newest first)."""
    query = select(CostEntry)
    if service:
        query = query.where(CostEntry.service == service)
    query = query.order_by(CostEntry.incurred_at.desc()).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()
    return [CostEntryResponse.model_validate(e) for e in entries]


# ═══ Spending Limits ════════════════════════════════════════

@router.get("/limits", response_model=list[SpendingLimitResponse])
async def list_spending_limits(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(SpendingLimit).order_by(SpendingLimit.service)
    )
    limits = result.scalars().all()
    return [SpendingLimitResponse.model_validate(l) for l in limits]


@router.post("/limits", response_model=SpendingLimitResponse, status_code=201)
async def create_spending_limit(
    body: SpendingLimitCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    limit = SpendingLimit(
        org_id=org_id,
        service=body.service,
        monthly_limit_cents=body.monthly_limit_cents,
        alert_threshold_pct=body.alert_threshold_pct,
        enforcement=body.enforcement,
    )
    db.add(limit)
    await db.flush()
    await db.refresh(limit)
    return SpendingLimitResponse.model_validate(limit)


@router.patch("/limits/{limit_id}", response_model=SpendingLimitResponse)
async def update_spending_limit(
    limit_id: uuid.UUID,
    body: SpendingLimitUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SpendingLimit).where(SpendingLimit.id == limit_id))
    limit = result.scalar_one_or_none()
    if not limit:
        raise HTTPException(status_code=404, detail="Spending limit not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(limit, field, value)
    await db.flush()
    await db.refresh(limit)
    return SpendingLimitResponse.model_validate(limit)


@router.delete("/limits/{limit_id}", status_code=204)
async def delete_spending_limit(
    limit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SpendingLimit).where(SpendingLimit.id == limit_id))
    limit = result.scalar_one_or_none()
    if not limit:
        raise HTTPException(status_code=404, detail="Spending limit not found")
    await db.delete(limit)
