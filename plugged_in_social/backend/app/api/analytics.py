"""Analytics endpoints — read aggregated metrics."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models import AnalyticsDaily
from app.schemas.analytics import AnalyticsResponse, AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=list[AnalyticsResponse])
async def list_analytics(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    metric_type: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get daily analytics data for a date range."""
    query = select(AnalyticsDaily).where(
        AnalyticsDaily.date >= start_date,
        AnalyticsDaily.date <= end_date,
    )
    if metric_type:
        query = query.where(AnalyticsDaily.metric_type == metric_type)

    query = query.order_by(AnalyticsDaily.date.asc())
    result = await db.execute(query)
    rows = result.scalars().all()
    return [AnalyticsResponse.model_validate(r) for r in rows]


@router.get("/summary", response_model=list[AnalyticsSummary])
async def analytics_summary(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get aggregated summary stats grouped by metric type."""
    query = (
        select(
            AnalyticsDaily.metric_type,
            func.sum(AnalyticsDaily.value).label("total"),
            func.avg(AnalyticsDaily.value).label("avg"),
            func.min(AnalyticsDaily.value).label("min_val"),
            func.max(AnalyticsDaily.value).label("max_val"),
            func.count().label("data_points"),
        )
        .where(
            AnalyticsDaily.date >= start_date,
            AnalyticsDaily.date <= end_date,
        )
        .group_by(AnalyticsDaily.metric_type)
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        AnalyticsSummary(
            metric_type=row.metric_type,
            total=float(row.total or 0),
            avg=float(row.avg or 0),
            min_val=float(row.min_val or 0),
            max_val=float(row.max_val or 0),
            data_points=row.data_points,
        )
        for row in rows
    ]
