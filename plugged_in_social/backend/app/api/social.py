"""Social media accounts + posts API."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.social_media import SocialAccount, SocialPost
from app.schemas.common import PaginatedResponse
from app.schemas.social_media import (
    SocialAccountCreate,
    SocialAccountResponse,
    SocialPostCreate,
    SocialPostResponse,
    SocialPostUpdate,
)
from app.services.virtual_agency_orchestration import social_post_content_hash

router = APIRouter(prefix="/social", tags=["social"])


# ═══ ACCOUNTS ════════════════════════════════════════════════

@router.get("/accounts", response_model=list[SocialAccountResponse])
async def list_accounts(
    platform: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(SocialAccount).order_by(SocialAccount.created_at.desc())
    if platform:
        query = query.where(SocialAccount.platform == platform)
    result = await db.execute(query)
    return [SocialAccountResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/accounts", response_model=SocialAccountResponse, status_code=201)
async def create_account(
    body: SocialAccountCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    account = SocialAccount(
        org_id=org_id,
        platform=body.platform,
        account_name=body.account_name,
        account_id=body.account_id,
        profile_url=body.profile_url,
        avatar_url=body.avatar_url,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return SocialAccountResponse.model_validate(account)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SocialAccount).where(SocialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)


# ═══ POSTS ═══════════════════════════════════════════════════

@router.get("/posts", response_model=PaginatedResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    platform: str | None = None,
    compound_phase: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(SocialPost)
    if status_filter:
        query = query.where(SocialPost.status == status_filter)
    if platform:
        query = query.where(SocialPost.platform == platform)
    if compound_phase:
        query = query.where(SocialPost.compound_phase == compound_phase)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(SocialPost.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    posts = result.scalars().all()

    return PaginatedResponse(
        items=[SocialPostResponse.model_validate(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/posts/{post_id}", response_model=SocialPostResponse)
async def get_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return SocialPostResponse.model_validate(post)


@router.post("/posts", response_model=SocialPostResponse, status_code=201)
async def create_post(
    body: SocialPostCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    post = SocialPost(
        org_id=org_id,
        social_account_id=body.social_account_id,
        platform=body.platform,
        caption=body.caption,
        hashtags=body.hashtags,
        media_urls=body.media_urls,
        media_type=body.media_type,
        scheduled_at=body.scheduled_at,
        compound_phase=body.compound_phase,
        project_id=body.project_id,
        internal_notes=body.internal_notes,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    return SocialPostResponse.model_validate(post)


@router.patch("/posts/{post_id}", response_model=SocialPostResponse)
async def update_post(
    post_id: uuid.UUID,
    body: SocialPostUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    await db.flush()
    await db.refresh(post)
    return SocialPostResponse.model_validate(post)


@router.post("/posts/{post_id}/schedule", response_model=SocialPostResponse)
async def schedule_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft posts can be scheduled")
    if not post.scheduled_at:
        raise HTTPException(status_code=400, detail="Set scheduled_at before scheduling")
    post.status = "scheduled"
    post.scheduled_content_hash = social_post_content_hash(post)
    await db.flush()
    await db.refresh(post)
    return SocialPostResponse.model_validate(post)


@router.post("/posts/{post_id}/publish", response_model=SocialPostResponse)
async def publish_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Publish immediately via platform API."""
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Post cannot be published in current status")

    expected_content_hash = social_post_content_hash(post)
    post.scheduled_content_hash = expected_content_hash
    post.status = "publishing"
    await db.flush()
    await db.refresh(post)

    # Dispatch to social-publisher Cloudflare Worker via the queue producer.
    from app.services.queue_publisher import publish_social_post_publish
    await publish_social_post_publish(
        org_id=post.org_id,
        post_id=post.id,
        expected_content_hash=expected_content_hash,
    )

    return SocialPostResponse.model_validate(post)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == "published":
        raise HTTPException(status_code=400, detail="Cannot delete published posts")
    await db.delete(post)
