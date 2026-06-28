"""Blog post endpoints with scheduling, optimistic locking, and soft deletes."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.core.rate_limit import limiter
from app.db.database import get_db, get_db_public
from app.models import BlogPost, Contact, Organization
from app.schemas.blog import BlogPostCreate, BlogPostResponse, BlogPostUpdate
from app.schemas.common import PaginatedResponse, version_conflict
from app.schemas.contacts import BlogSubscriberCreate, BlogSubscriberResponse

router = APIRouter(prefix="/blog", tags=["blog"])
PUBLIC_CONTENT_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"
BLOG_SUBSCRIBER_TAG = "blog-subscriber"
BLOG_LAUNCH_TAG = "blog-launch"
BLOG_SIGNUP_SOURCE = "blog_launch"


def _estimate_reading_time(body: str | None) -> int | None:
    """Estimate reading time in minutes (~200 wpm)."""
    if not body:
        return None
    words = len(body.split())
    return max(1, round(words / 200))


def _merge_unique_tags(existing: list[str] | None, additions: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for tag in [*(existing or []), *additions]:
        clean = tag.strip()
        if clean and clean not in seen:
            merged.append(clean)
            seen.add(clean)
    return merged


def _blog_subscription_metadata(
    existing: dict | None, *, org_slug: str, now: datetime
) -> dict:
    metadata = dict(existing or {})
    current = metadata.get("blog_subscription")
    blog_subscription = dict(current) if isinstance(current, dict) else {}
    blog_subscription.setdefault("first_opt_in_at", now.isoformat())
    blog_subscription.update(
        {
            "last_opt_in_at": now.isoformat(),
            "org_slug": org_slug,
            "source": "blog_page",
        }
    )
    metadata["blog_subscription"] = blog_subscription
    return metadata


@router.get("", response_model=PaginatedResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = None,
    tag: str | None = None,
    search: str | None = Query(
        None,
        description="Matches title, slug, or excerpt (ILIKE)",
        max_length=200,
    ),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List blog posts (dashboard view — includes drafts)."""
    query = select(BlogPost).where(BlogPost.is_deleted == False)  # noqa: E712
    if status_filter:
        query = query.where(BlogPost.status == status_filter)
    if category:
        query = query.where(BlogPost.category == category)
    if tag:
        query = query.where(BlogPost.tags.any(tag))
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                BlogPost.title.ilike(like),
                BlogPost.slug.ilike(like),
                BlogPost.excerpt.ilike(like),
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(BlogPost.updated_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    posts = result.scalars().all()

    return PaginatedResponse(
        items=[BlogPostResponse.model_validate(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/public", response_model=PaginatedResponse)
async def list_posts_public(
    response: Response,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    org_slug: str = Query(...),
    category: str | None = None,
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — published posts only, for the blog frontend."""
    response.headers["Cache-Control"] = PUBLIC_CONTENT_CACHE_CONTROL
    from app.models import Organization
    org_result = await db.execute(
        select(Organization).where(Organization.slug == org_slug)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    query = select(BlogPost).where(
        BlogPost.org_id == org.id,
        BlogPost.status == "published",
        BlogPost.is_deleted == False,
    )
    if category:
        query = query.where(BlogPost.category == category)
    if tag:
        query = query.where(BlogPost.tags.any(tag))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(BlogPost.published_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    posts = result.scalars().all()

    return PaginatedResponse(
        items=[BlogPostResponse.model_validate(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post(
    "/public/subscribe",
    response_model=BlogSubscriberResponse,
    status_code=201,
)
@limiter.limit("10/hour")
async def subscribe_to_blog(
    request: Request,
    body: BlogSubscriberCreate,
    db: AsyncSession = Depends(get_db_public),
):
    """Capture launch/blog subscribers as reusable contacts.

    Anonymous visitors can opt in from /blog. The response is intentionally
    generic so it does not disclose whether an address already existed.
    """
    org_result = await db.execute(
        select(Organization).where(
            Organization.slug == body.org_slug,
            Organization.is_active == True,  # noqa: E712
        )
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    now = datetime.now(timezone.utc)
    email = str(body.email).strip().lower()
    full_name = body.full_name.strip() if body.full_name else None

    existing = await db.execute(
        select(Contact).where(Contact.org_id == org.id, Contact.email == email)
    )
    contact = existing.scalar_one_or_none()

    if contact:
        contact.subscribed = True
        contact.unsubscribed_at = None
        if full_name:
            contact.full_name = full_name
        contact.tags = _merge_unique_tags(
            contact.tags,
            [BLOG_SUBSCRIBER_TAG, BLOG_LAUNCH_TAG],
        )
        if not contact.source:
            contact.source = BLOG_SIGNUP_SOURCE
        contact.last_engaged_at = now
        contact.metadata_ = _blog_subscription_metadata(
            contact.metadata_,
            org_slug=org.slug,
            now=now,
        )
    else:
        contact = Contact(
            org_id=org.id,
            email=email,
            full_name=full_name,
            subscribed=True,
            source=BLOG_SIGNUP_SOURCE,
            tags=[BLOG_SUBSCRIBER_TAG, BLOG_LAUNCH_TAG],
            metadata_=_blog_subscription_metadata(
                None,
                org_slug=org.slug,
                now=now,
            ),
        )
        db.add(contact)

    await db.flush()
    return BlogSubscriberResponse(message="You're on the list.")


@router.get("/public/{slug}", response_model=BlogPostResponse)
async def get_post_by_slug_public(
    slug: str,
    response: Response,
    org_slug: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — get a published post by slug."""
    response.headers["Cache-Control"] = PUBLIC_CONTENT_CACHE_CONTROL
    from app.models import Organization
    org_result = await db.execute(
        select(Organization).where(Organization.slug == org_slug)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await db.execute(
        select(BlogPost).where(
            BlogPost.org_id == org.id,
            BlogPost.slug == slug,
            BlogPost.status == "published",
            BlogPost.is_deleted == False,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return BlogPostResponse.model_validate(post)


@router.get("/{post_id}", response_model=BlogPostResponse)
async def get_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.is_deleted == False)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return BlogPostResponse.model_validate(post)


@router.post("", response_model=BlogPostResponse, status_code=201)
async def create_post(
    body: BlogPostCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner", "editor"])),
):
    """Create a new blog post.

    Slug is unique per org. Pre-check so we return a specific 409 instead
    of letting the DB raise a bare IntegrityError that poisons the session.
    """
    data = body.model_dump()

    dupe = await db.execute(
        select(BlogPost.id).where(
            BlogPost.slug == data["slug"],
            BlogPost.is_deleted == False,  # noqa: E712
        )
    )
    if dupe.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A blog post with slug '{data['slug']}' already exists",
        )

    # Auto-set published_at when status is published
    if data["status"] == "published" and not data.get("scheduled_for"):
        data["published_at"] = datetime.now(timezone.utc)

    post = BlogPost(
        org_id=uuid.UUID(current_user["org_id"]),
        author_id=uuid.UUID(current_user["sub"]),
        reading_time_minutes=_estimate_reading_time(data.get("body")),
        **data,
    )
    db.add(post)
    try:
        await db.flush()
    except IntegrityError:
        # Race with a concurrent create (or unrelated unique conflict).
        raise HTTPException(
            status_code=409,
            detail=f"A blog post with slug '{data['slug']}' already exists",
        )
    await db.refresh(post)
    return BlogPostResponse.model_validate(post)


@router.patch("/{post_id}", response_model=BlogPostResponse)
async def update_post(
    post_id: uuid.UUID,
    body: BlogPostUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner", "editor"])),
):
    """Update a blog post with optimistic locking."""
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.is_deleted == False)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.version != body.version:
        raise version_conflict(
            resource="post",
            current_version=post.version,
            attempted_version=body.version,
            current=BlogPostResponse.model_validate(post),
        )

    update_data = body.model_dump(exclude_unset=True, exclude={"version"})

    # Handle status transitions
    if "status" in update_data:
        if update_data["status"] == "published" and post.status != "published":
            post.published_at = datetime.now(timezone.utc)

    # Recalculate reading time if body changed
    if "body" in update_data:
        post.reading_time_minutes = _estimate_reading_time(update_data["body"])

    for field, value in update_data.items():
        setattr(post, field, value)
    post.version += 1

    await db.flush()
    await db.refresh(post)
    return BlogPostResponse.model_validate(post)


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Soft-delete a blog post."""
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.is_deleted == False)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = True
    post.status = "archived"
