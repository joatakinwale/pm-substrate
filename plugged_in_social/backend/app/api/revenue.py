"""Revenue dashboard endpoints — aggregated billing metrics."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models import Invoice, Subscription
from app.schemas.invoices import RevenueByPhase, RevenueSummary

router = APIRouter(prefix="/revenue", tags=["revenue"])


@router.get("/summary", response_model=RevenueSummary)
async def revenue_summary(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Aggregate revenue metrics for the billing dashboard."""

    # ── Invoice metrics ──────────────────────────────────────
    inv_q = select(
        func.coalesce(func.sum(Invoice.amount_paid_cents), 0).label("total_revenue"),
        func.coalesce(func.sum(Invoice.amount_due_cents), 0).label("total_outstanding"),
        func.count(Invoice.id).label("total_invoices"),
        func.count(case((Invoice.status == "paid", 1))).label("paid_invoices"),
        func.count(
            case((Invoice.status.in_(["open", "past_due"]), 1))
        ).label("overdue_invoices"),
    )
    inv_result = (await db.execute(inv_q)).one()

    # ── Subscription metrics (MRR) ───────────────────────────
    sub_q = select(
        func.coalesce(func.sum(Subscription.amount_cents), 0).label("mrr"),
        func.count(Subscription.id).label("active_count"),
    ).where(Subscription.status == "active")
    sub_result = (await db.execute(sub_q)).one()

    # ── Revenue by Compound Method phase ─────────────────────
    phase_q = (
        select(
            Invoice.compound_phase,
            func.coalesce(func.sum(Invoice.amount_paid_cents), 0).label("phase_total"),
            func.count(Invoice.id).label("phase_count"),
        )
        .where(Invoice.compound_phase.isnot(None))
        .group_by(Invoice.compound_phase)
    )
    phase_result = (await db.execute(phase_q)).all()

    by_phase = [
        RevenueByPhase(
            phase=row.compound_phase,
            total_cents=row.phase_total,
            invoice_count=row.phase_count,
        )
        for row in phase_result
    ]

    return RevenueSummary(
        total_revenue_cents=inv_result.total_revenue,
        total_outstanding_cents=inv_result.total_outstanding,
        total_invoices=inv_result.total_invoices,
        paid_invoices=inv_result.paid_invoices,
        overdue_invoices=inv_result.overdue_invoices,
        mrr_cents=sub_result.mrr,
        active_subscriptions=sub_result.active_count,
        by_phase=by_phase,
    )
