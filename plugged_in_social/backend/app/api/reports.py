"""Reporting & analytics endpoints — reports CRUD, phase dashboards, schedules."""
import math
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models import ClientReport, ReportSchedule, PHASE_KPIS
from app.schemas.common import PaginatedResponse
from app.schemas.reports import (
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    PhaseDashboard,
    PhaseMetric,
    ReportScheduleResponse,
)

router = APIRouter(prefix="/reports", tags=["reports"])


# ═══ REPORTS CRUD ════════════════════════════════════════════

@router.get("", response_model=PaginatedResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    compound_phase: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(ClientReport)
    if status_filter:
        query = query.where(ClientReport.status == status_filter)
    if compound_phase:
        query = query.where(ClientReport.compound_phase == compound_phase)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(ClientReport.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    reports = result.scalars().all()

    return PaginatedResponse(
        items=[ReportResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(ClientReport).where(ClientReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a report. Auto-populates metrics from Phase 2 billing data."""
    org_id = uuid.UUID(current_user["org_id"])

    # Auto-generate metrics snapshot from billing data
    metrics = await _generate_metrics_snapshot(
        db, org_id, body.compound_phase, body.period_start, body.period_end
    )

    report = ClientReport(
        org_id=org_id,
        title=body.title,
        project_id=body.project_id,
        lead_id=body.lead_id,
        client_name=body.client_name,
        client_email=body.client_email,
        cadence=body.cadence,
        compound_phase=body.compound_phase,
        period_start=body.period_start,
        period_end=body.period_end,
        sections=[s.model_dump() for s in body.sections] if body.sections else _default_sections(body.compound_phase),
        metrics_snapshot=metrics,
        internal_notes=body.internal_notes,
        status="generated",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return ReportResponse.model_validate(report)


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(ClientReport).where(ClientReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = body.model_dump(exclude_unset=True)
    if "sections" in update_data and update_data["sections"]:
        update_data["sections"] = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in update_data["sections"]
        ]
    for field, value in update_data.items():
        setattr(report, field, value)

    await db.flush()
    await db.refresh(report)
    return ReportResponse.model_validate(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(ClientReport).where(ClientReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)


# ═══ PHASE DASHBOARDS ═══════════════════════════════════════

@router.get("/dashboards/phases", response_model=list[PhaseDashboard])
async def phase_dashboards(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get Compound Method phase dashboards with monthly metrics.

    Uses the mv_phase_metrics materialized view for fast queries.
    """
    org_id = current_user["org_id"]

    dashboards = []
    for phase_key, phase_def in PHASE_KPIS.items():
        # Query materialized view
        result = await db.execute(
            text("""
                SELECT month, invoice_count, revenue_cents, paid_count, outstanding_cents
                FROM mv_phase_metrics
                WHERE org_id = :org_id AND compound_phase = :phase
                ORDER BY month DESC
                LIMIT 12
            """),
            {"org_id": org_id, "phase": phase_key},
        )
        rows = result.all()

        monthly_data = [
            PhaseMetric(
                month=row.month,
                invoice_count=row.invoice_count,
                revenue_cents=row.revenue_cents or 0,
                paid_count=row.paid_count,
                outstanding_cents=row.outstanding_cents or 0,
            )
            for row in rows
        ]

        dashboards.append(PhaseDashboard(
            phase=phase_key,
            title=phase_def["title"],
            description=phase_def["description"],
            metrics_definition=phase_def["metrics"],
            monthly_data=monthly_data,
        ))

    return dashboards


# ═══ SCHEDULES ═══════════════════════════════════════════════

@router.get("/schedules", response_model=list[ReportScheduleResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(ReportSchedule).order_by(ReportSchedule.created_at.desc())
    )
    return [ReportScheduleResponse.model_validate(s) for s in result.scalars().all()]


# ═══ HELPERS ═════════════════════════════════════════════════

async def _generate_metrics_snapshot(
    db: AsyncSession,
    org_id: uuid.UUID,
    compound_phase: str | None,
    period_start: date,
    period_end: date,
) -> dict:
    """Pull metrics from billing + analytics tables for the report period."""
    from app.models import Invoice, Subscription

    # Invoice metrics for the period
    inv_q = select(
        func.count(Invoice.id).label("total_invoices"),
        func.coalesce(func.sum(Invoice.amount_paid_cents), 0).label("revenue_cents"),
        func.count(func.nullif(Invoice.status != "paid", True)).label("paid_count"),
    ).where(
        Invoice.org_id == org_id,
        Invoice.created_at >= str(period_start),
        Invoice.created_at <= str(period_end),
    )
    if compound_phase:
        inv_q = inv_q.where(Invoice.compound_phase == compound_phase)

    inv_result = (await db.execute(inv_q)).one()

    # Active subscriptions
    sub_q = select(
        func.count(Subscription.id).label("active_subs"),
        func.coalesce(func.sum(Subscription.amount_cents), 0).label("mrr_cents"),
    ).where(
        Subscription.org_id == org_id,
        Subscription.status == "active",
    )
    if compound_phase:
        sub_q = sub_q.where(Subscription.compound_phase == compound_phase)
    sub_result = (await db.execute(sub_q)).one()

    return {
        "total_invoices": inv_result.total_invoices,
        "revenue_cents": inv_result.revenue_cents,
        "paid_count": inv_result.paid_count,
        "active_subscriptions": sub_result.active_subs,
        "mrr_cents": sub_result.mrr_cents,
        "compound_phase": compound_phase,
        "period": {"start": str(period_start), "end": str(period_end)},
    }


def _default_sections(compound_phase: str | None) -> list[dict]:
    """Generate default report sections based on Compound Method phase."""
    sections = [
        {"type": "text", "title": "Executive Summary", "data": {"content": ""}},
        {"type": "kpi_grid", "title": "Key Metrics", "data": {"metrics": []}},
    ]

    if compound_phase and compound_phase in PHASE_KPIS:
        phase_def = PHASE_KPIS[compound_phase]
        sections.append({
            "type": "kpi_grid",
            "title": phase_def["title"],
            "data": {"metrics": phase_def["metrics"]},
        })

    sections.extend([
        {"type": "chart", "title": "Revenue Trend", "data": {"chart_type": "line"}},
        {"type": "comparison", "title": "Period Comparison", "data": {}},
        {"type": "text", "title": "Recommendations", "data": {"content": ""}},
    ])

    return sections
