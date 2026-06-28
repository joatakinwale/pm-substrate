"""Subscription management endpoints — CRUD + Stripe lifecycle."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.core.config import get_settings
from app.models import Subscription
from app.schemas.common import PaginatedResponse
from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("", response_model=PaginatedResponse)
async def list_subscriptions(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    compound_phase: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List subscriptions with pagination and filtering."""
    query = select(Subscription)

    if status_filter:
        query = query.where(Subscription.status == status_filter)
    if compound_phase:
        query = query.where(Subscription.compound_phase == compound_phase)
    if search:
        query = query.where(
            Subscription.client_name.ilike(f"%{search}%")
            | Subscription.client_email.ilike(f"%{search}%")
            | Subscription.plan_name.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Subscription.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    subs = result.scalars().all()

    return PaginatedResponse(
        items=[SubscriptionResponse.model_validate(s) for s in subs],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return SubscriptionResponse.model_validate(sub)


@router.post("", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    body: SubscriptionCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a subscription in Stripe and store locally."""
    settings = get_settings()
    if not settings.stripe_configured:
        raise HTTPException(
            status_code=400,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY.",
        )

    org_id = uuid.UUID(current_user["org_id"])

    from app.services.stripe_billing import (
        create_subscription as stripe_create_sub,
        get_or_create_customer,
    )

    # Get or create Stripe customer
    customer = get_or_create_customer(
        email=body.client_email,
        name=body.client_name,
        metadata={"org_id": str(org_id)},
    )

    # Create the subscription in Stripe
    stripe_sub = stripe_create_sub(
        customer_id=customer.id,
        price_id=body.price_id,
        metadata={
            "org_id": str(org_id),
            "compound_phase": body.compound_phase or "",
        },
        trial_days=body.trial_days,
    )

    # Extract price/amount details from the Stripe response
    stripe_item = stripe_sub["items"]["data"][0] if stripe_sub["items"]["data"] else {}
    price_obj = stripe_item.get("price", {})

    sub = Subscription(
        org_id=org_id,
        stripe_subscription_id=stripe_sub.id,
        stripe_customer_id=customer.id,
        stripe_price_id=body.price_id,
        stripe_product_id=price_obj.get("product"),
        status=stripe_sub.status,
        plan_name=body.plan_name,
        amount_cents=price_obj.get("unit_amount", 0),
        currency=price_obj.get("currency", "usd"),
        interval=price_obj.get("recurring", {}).get("interval", "month"),
        interval_count=price_obj.get("recurring", {}).get("interval_count", 1),
        client_name=body.client_name,
        client_email=body.client_email,
        compound_phase=body.compound_phase,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        internal_notes=body.internal_notes,
    )

    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return SubscriptionResponse.model_validate(sub)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: uuid.UUID,
    body: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Update subscription metadata. Price changes go through Stripe."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # If changing price, update in Stripe first
    if body.price_id:
        from app.services.stripe_billing import update_subscription as stripe_update
        stripe_update(sub.stripe_subscription_id, price_id=body.price_id)
        sub.stripe_price_id = body.price_id

    update_data = body.model_dump(exclude_unset=True, exclude={"price_id"})
    for field, value in update_data.items():
        setattr(sub, field, value)

    await db.flush()
    await db.refresh(sub)
    return SubscriptionResponse.model_validate(sub)


@router.post("/{subscription_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(
    subscription_id: uuid.UUID,
    immediate: bool = Query(False, description="Cancel immediately vs at period end"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Cancel a subscription. Defaults to cancel at period end."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    from app.services.stripe_billing import cancel_subscription as stripe_cancel
    stripe_cancel(sub.stripe_subscription_id, at_period_end=not immediate)

    sub.status = "canceled" if immediate else sub.status
    if not immediate:
        # Will be fully canceled by webhook when period ends
        from datetime import datetime, timezone
        sub.canceled_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sub)
    return SubscriptionResponse.model_validate(sub)


@router.post("/portal-session")
async def create_portal_session(
    customer_id: str = Query(..., description="Stripe customer ID"),
    return_url: str = Query(..., description="URL to redirect after portal"),
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for self-service billing."""
    from app.services.stripe_billing import create_portal_session
    session = create_portal_session(customer_id=customer_id, return_url=return_url)
    return {"url": session.url}
