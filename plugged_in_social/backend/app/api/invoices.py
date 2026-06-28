"""Invoice management endpoints — CRUD + Stripe sync."""
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.core.config import get_settings
from app.models import Invoice
from app.schemas.common import PaginatedResponse
from app.schemas.invoices import InvoiceCreate, InvoiceResponse, InvoiceUpdate

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=PaginatedResponse)
async def list_invoices(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    compound_phase: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List invoices with pagination, filtering, and search."""
    query = select(Invoice)

    if status_filter:
        query = query.where(Invoice.status == status_filter)
    if compound_phase:
        query = query.where(Invoice.compound_phase == compound_phase)
    if search:
        query = query.where(
            Invoice.client_name.ilike(f"%{search}%")
            | Invoice.client_email.ilike(f"%{search}%")
            | Invoice.description.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Invoice.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    invoices = result.scalars().all()

    return PaginatedResponse(
        items=[InvoiceResponse.model_validate(i) for i in invoices],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.post("", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a new invoice. Optionally syncs to Stripe."""
    org_id = uuid.UUID(current_user["org_id"])

    # Calculate totals from line items
    subtotal = sum(
        item.amount_cents * item.quantity for item in body.line_items
    )

    invoice = Invoice(
        org_id=org_id,
        client_name=body.client_name,
        client_email=body.client_email,
        line_items=[item.model_dump() for item in body.line_items],
        description=body.description,
        currency=body.currency,
        subtotal_cents=subtotal,
        total_cents=subtotal,  # tax added later if needed
        amount_due_cents=subtotal,
        compound_phase=body.compound_phase,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        internal_notes=body.internal_notes,
        due_date=datetime.now(timezone.utc) + timedelta(days=body.due_days),
        status="draft",
    )

    # Stripe sync if requested and configured
    if body.sync_to_stripe:
        settings = get_settings()
        if not settings.stripe_configured:
            raise HTTPException(
                status_code=400,
                detail="Stripe is not configured. Set STRIPE_SECRET_KEY.",
            )
        from app.services.stripe_billing import (
            create_invoice as stripe_create_invoice,
            get_or_create_customer,
        )

        customer = get_or_create_customer(
            email=body.client_email,
            name=body.client_name,
            metadata={"org_id": str(org_id)},
        )
        stripe_inv = stripe_create_invoice(
            customer_id=customer.id,
            line_items=[item.model_dump() for item in body.line_items],
            description=body.description,
            due_days=body.due_days,
        )
        invoice.stripe_invoice_id = stripe_inv.id
        invoice.stripe_customer_id = customer.id

    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)

    await db.flush()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Finalize and send invoice via Stripe."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.stripe_invoice_id:
        raise HTTPException(
            status_code=400,
            detail="Invoice is not synced to Stripe. Cannot send.",
        )

    from app.services.stripe_billing import finalize_invoice, send_invoice as stripe_send

    finalize_invoice(invoice.stripe_invoice_id)
    sent = stripe_send(invoice.stripe_invoice_id)

    invoice.status = "open"
    invoice.stripe_hosted_invoice_url = sent.get("hosted_invoice_url")
    invoice.stripe_invoice_pdf = sent.get("invoice_pdf")

    await db.flush()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
async def void_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Void an invoice. Admin/owner only."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.stripe_invoice_id:
        from app.services.stripe_billing import void_invoice as stripe_void
        stripe_void(invoice.stripe_invoice_id)

    invoice.status = "void"
    await db.flush()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Hard-delete a draft invoice. Admin/owner only."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be deleted.",
        )
    await db.delete(invoice)
