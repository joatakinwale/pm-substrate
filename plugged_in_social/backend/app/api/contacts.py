"""Contact (email subscriber) management endpoints."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.models import Contact
from app.schemas.common import PaginatedResponse
from app.schemas.contacts import ContactCreate, ContactResponse, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=PaginatedResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    subscribed: bool | None = None,
    tag: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List contacts with filtering by subscription status, tag, or search."""
    query = select(Contact)

    if subscribed is not None:
        query = query.where(Contact.subscribed == subscribed)
    if tag:
        query = query.where(Contact.tags.any(tag))
    if search:
        query = query.where(
            Contact.email.ilike(f"%{search}%")
            | Contact.full_name.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Contact.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    contacts = result.scalars().all()

    return PaginatedResponse(
        items=[ContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactResponse.model_validate(contact)


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create or upsert a contact by email (org-scoped unique)."""
    org_id = uuid.UUID(current_user["org_id"])

    # Check for existing
    existing = await db.execute(
        select(Contact).where(
            Contact.org_id == org_id,
            Contact.email == body.email,
        )
    )
    contact = existing.scalar_one_or_none()

    if contact:
        # Upsert — update existing contact
        data = body.model_dump(exclude_unset=True, by_alias=False)
        for field, value in data.items():
            if field == "metadata_":
                setattr(contact, "metadata_", value)
            else:
                setattr(contact, field, value)
    else:
        contact = Contact(
            org_id=org_id,
            email=body.email,
            full_name=body.full_name,
            tags=body.tags,
            source=body.source,
            metadata_=body.metadata_,
        )
        db.add(contact)

    await db.flush()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    body: ContactUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for field, value in body.model_dump(exclude_unset=True, by_alias=False).items():
        if field == "metadata_":
            setattr(contact, "metadata_", value)
        else:
            setattr(contact, field, value)

    await db.flush()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
