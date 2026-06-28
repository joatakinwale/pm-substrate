"""Activity tracking API — unified timeline for all interactions.

Ported from coldCallAutomated's activity system. Provides:
  - Timeline views (per-subject, per-user, global)
  - Activity creation (manual + system-generated)
  - Filtering by type, category, date range
"""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.activity import Activity
from app.schemas.activities import ActivityCreate, ActivityResponse
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=PaginatedResponse)
async def list_activities(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    subject_type: str | None = None,
    subject_id: uuid.UUID | None = None,
    activity_type: str | None = None,
    category: str | None = None,
    performed_by: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List activities with filtering. Primary use: subject timeline."""
    query = select(Activity)

    if subject_type:
        query = query.where(Activity.subject_type == subject_type)
    if subject_id:
        query = query.where(Activity.subject_id == subject_id)
    if activity_type:
        query = query.where(Activity.activity_type == activity_type)
    if category:
        query = query.where(Activity.category == category)
    if performed_by:
        query = query.where(Activity.performed_by == performed_by)
    if date_from:
        query = query.where(Activity.occurred_at >= date_from)
    if date_to:
        query = query.where(Activity.occurred_at <= date_to)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Activity.occurred_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    activities = result.scalars().all()

    return PaginatedResponse(
        items=[ActivityResponse.model_validate(a) for a in activities],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/timeline/{subject_type}/{subject_id}", response_model=list[ActivityResponse])
async def get_subject_timeline(
    subject_type: str,
    subject_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get activity timeline for a specific entity (lead, project, etc.)."""
    result = await db.execute(
        select(Activity)
        .where(
            Activity.subject_type == subject_type,
            Activity.subject_id == subject_id,
        )
        .order_by(Activity.occurred_at.desc())
        .limit(limit)
    )
    activities = result.scalars().all()
    return [ActivityResponse.model_validate(a) for a in activities]


@router.post("", response_model=ActivityResponse, status_code=201)
async def create_activity(
    body: ActivityCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a new activity record (manual logging)."""
    org_id = uuid.UUID(current_user["org_id"])
    activity = Activity(
        org_id=org_id,
        category=body.category,
        activity_type=body.activity_type,
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        related_type=body.related_type,
        related_id=body.related_id,
        performed_by=uuid.UUID(current_user["sub"]),
        performed_by_name=current_user.get("email", ""),
        title=body.title,
        description=body.description,
        metadata_=body.metadata,
        is_system=body.is_system,
        is_client_visible=body.is_client_visible,
        occurred_at=body.occurred_at or datetime.now(),
    )
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return ActivityResponse.model_validate(activity)


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityResponse.model_validate(activity)


@router.get("/stats/summary")
async def activity_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get activity counts by category for the last N days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Activity.category, func.count())
        .where(Activity.occurred_at >= cutoff)
        .group_by(Activity.category)
    )
    rows = result.all()
    return {
        "period_days": days,
        "by_category": {row[0]: row[1] for row in rows},
        "total": sum(row[1] for row in rows),
    }
