"""Lead management endpoints."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.db.database import get_db
from app.models import Lead
from app.schemas.common import PaginatedResponse
from app.schemas.leads import LeadCreate, LeadResponse, LeadUpdate

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=PaginatedResponse)
async def list_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List leads with pagination, filtering, and search."""
    query = select(Lead)

    if status_filter:
        query = query.where(Lead.qualification_status == status_filter)
    if search:
        query = query.where(
            Lead.full_name.ilike(f"%{search}%")
            | Lead.email.ilike(f"%{search}%")
            | Lead.company.ilike(f"%{search}%")
        )

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(Lead.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    leads = result.scalars().all()

    return PaginatedResponse(
        items=[LeadResponse.model_validate(l) for l in leads],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get a single lead by ID."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadResponse.model_validate(lead)


def _lead_broadcast_payload(lead: Lead) -> dict:
    """Compact payload for SSE broadcasts — no large text blobs."""
    return {
        "full_name": lead.full_name,
        "email": lead.email,
        "company": lead.company,
        "source": lead.source,
        "qualification_status": lead.qualification_status,
        "revenue_range": lead.revenue_range,
        "score": lead.score,
    }


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    body: LeadCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a new lead (also used by public intake form via webhook)."""
    org_id = uuid.UUID(current_user["org_id"])
    lead = Lead(
        org_id=org_id,
        **body.model_dump(),
    )
    db.add(lead)
    await db.flush()
    await db.refresh(lead)

    from app.services.realtime import broadcast_lead_event
    await broadcast_lead_event(
        org_id=org_id,
        lead_id=lead.id,
        action="created",
        lead_data=_lead_broadcast_payload(lead),
    )

    return LeadResponse.model_validate(lead)


@router.post("/public", response_model=LeadResponse, status_code=201)
async def create_lead_public(
    body: LeadCreate,
    org_slug: str = Query(..., description="Organization slug for the intake form"),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for intake forms — no auth required.

    The org is identified by slug in the query param.
    """
    from app.models import Organization
    result = await db.execute(
        select(Organization).where(
            Organization.slug == org_slug,
            Organization.is_active == True,
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    lead = Lead(org_id=org.id, **body.model_dump())
    db.add(lead)
    await db.flush()
    await db.refresh(lead)

    # Public intake is the HOT path for notifications — the owner sees a
    # new-lead toast instantly instead of waiting on email/polling.
    from app.services.realtime import broadcast_lead_event
    await broadcast_lead_event(
        org_id=org.id,
        lead_id=lead.id,
        action="created",
        lead_data={**_lead_broadcast_payload(lead), "intake_source": "public_form"},
    )

    return LeadResponse.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Update a lead's details or qualification status."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Capture before mutation so we can pick the right broadcast action.
    previous_status = lead.qualification_status

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)

    await db.flush()
    await db.refresh(lead)

    # Pick a granular action name when the status flipped so UI can show
    # the right toast (green for qualified, gray for disqualified, etc.).
    from app.services.realtime import broadcast_lead_event
    new_status = lead.qualification_status
    if new_status != previous_status and new_status in {
        "qualified", "converted", "disqualified",
    }:
        action = new_status
    else:
        action = "updated"

    await broadcast_lead_event(
        org_id=lead.org_id,
        lead_id=lead.id,
        action=action,
        lead_data={
            **_lead_broadcast_payload(lead),
            "previous_status": previous_status if action != "updated" else None,
        },
    )

    return LeadResponse.model_validate(lead)


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Hard-delete a lead. Admin/owner only."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
