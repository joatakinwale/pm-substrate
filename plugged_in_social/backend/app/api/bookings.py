"""Booking management endpoints."""
import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models import Booking
from app.models.booking import BookingStatus
from app.schemas.bookings import BookingCreate, BookingResponse, BookingUpdate
from app.schemas.common import PaginatedResponse
from app.services.realtime import broadcast_booking_event


def _booking_broadcast_payload(booking: Booking) -> dict:
    """Compact payload for booking SSE events; clients refetch for full state."""
    return {
        "status": booking.status,
        "scheduled_at": booking.scheduled_at.isoformat() if booking.scheduled_at else None,
        "attendee_name": booking.attendee_name,
        "attendee_email": booking.attendee_email,
        "event_type": booking.event_type,
        "lead_id": str(booking.lead_id) if booking.lead_id else None,
    }

router = APIRouter(prefix="/bookings", tags=["bookings"])


# Statuses an admin may transition a booking to via the dashboard. Keep
# this tight — the Aurinko webhook owns ``confirmed`` /
# ``cancelled`` / ``rescheduled`` via the booking-resource subscription,
# we expose operational post-call outcomes and a manual cancel hatch
# here.
ADMIN_WRITABLE_STATUSES = {
    BookingStatus.COMPLETED.value,
    BookingStatus.NO_SHOW.value,
    BookingStatus.CANCELLED.value,
    BookingStatus.CONFIRMED.value,  # undo accidental complete/no_show
    BookingStatus.PENDING.value,
}


@router.get("", response_model=PaginatedResponse)
async def list_bookings(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(
        None,
        description="Matches attendee_name or attendee_email (ILIKE)",
        max_length=200,
    ),
    from_date: datetime | None = Query(
        None, description="Inclusive lower bound on scheduled_at"
    ),
    to_date: datetime | None = Query(
        None, description="Inclusive upper bound on scheduled_at"
    ),
    has_lead: bool | None = Query(
        None, description="Filter to bookings linked / not linked to a lead"
    ),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List bookings with filters for status, attendee search, date range, lead linkage."""
    query = select(Booking).options(selectinload(Booking.lead))
    if status_filter:
        query = query.where(Booking.status == status_filter)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                Booking.attendee_name.ilike(like),
                Booking.attendee_email.ilike(like),
            )
        )
    if from_date is not None:
        query = query.where(Booking.scheduled_at >= from_date)
    if to_date is not None:
        query = query.where(Booking.scheduled_at <= to_date)
    if has_lead is True:
        query = query.where(Booking.lead_id.is_not(None))
    elif has_lead is False:
        query = query.where(Booking.lead_id.is_(None))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Booking.scheduled_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    bookings = result.scalars().all()

    return PaginatedResponse(
        items=[BookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.lead))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BookingResponse.model_validate(booking)


@router.post("", response_model=BookingResponse, status_code=201)
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a booking (typically via the Aurinko webhook, but manual is fine)."""
    payload = body.model_dump()
    # BookingCreate allows the client to hint a status; otherwise we start
    # confirmed because an admin is creating the row directly.
    payload.setdefault("status", BookingStatus.CONFIRMED.value)

    booking = Booking(
        org_id=uuid.UUID(current_user["org_id"]),
        **payload,
    )
    db.add(booking)
    await db.flush()
    # Reload with lead eager-loaded so the response has the embedded summary.
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.lead))
        .where(Booking.id == booking.id)
    )
    booking = result.scalar_one()
    await broadcast_booking_event(
        booking.org_id, booking.id, "created",
        _booking_broadcast_payload(booking),
    )
    return BookingResponse.model_validate(booking)


@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: uuid.UUID,
    body: BookingUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.lead))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    updates = body.model_dump(exclude_unset=True)
    old_status = booking.status
    if "status" in updates and updates["status"] not in ADMIN_WRITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Status '{updates['status']}' is not admin-writable. "
                f"Allowed: {sorted(ADMIN_WRITABLE_STATUSES)}"
            ),
        )

    for field, value in updates.items():
        setattr(booking, field, value)

    await db.flush()
    await db.refresh(booking)

    # Pick the most specific SSE action so dashboards can filter finely.
    if "status" in updates and updates["status"] != old_status:
        action_map = {
            BookingStatus.COMPLETED.value: "completed",
            BookingStatus.NO_SHOW.value: "no_show",
            BookingStatus.CANCELLED.value: "cancelled",
            BookingStatus.CONFIRMED.value: "confirmed",
            BookingStatus.PENDING.value: "updated",
            BookingStatus.RESCHEDULED.value: "rescheduled",
        }
        action = action_map.get(booking.status, "updated")
    else:
        action = "updated"

    await broadcast_booking_event(
        booking.org_id, booking.id, action,
        _booking_broadcast_payload(booking),
    )
    return BookingResponse.model_validate(booking)
