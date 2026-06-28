"""CMS page endpoints with optimistic locking and soft deletes."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.db.database import get_db
from app.models import Page
from app.schemas.common import PaginatedResponse, version_conflict
from app.schemas.pages import PageCreate, PageResponse, PageUpdate

router = APIRouter(prefix="/pages", tags=["pages"])
PUBLIC_CONTENT_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"


@router.get("", response_model=PaginatedResponse)
async def list_pages(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(
        None,
        description="Matches title or slug (ILIKE)",
        max_length=200,
    ),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List all non-deleted pages."""
    query = select(Page).where(Page.is_deleted == False)  # noqa: E712
    if status_filter:
        query = query.where(Page.status == status_filter)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(Page.title.ilike(like), Page.slug.ilike(like))
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Page.updated_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    pages = result.scalars().all()

    return PaginatedResponse(
        items=[PageResponse.model_validate(p) for p in pages],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/by-slug/{slug}", response_model=PageResponse)
async def get_page_by_slug_public(
    slug: str,
    response: Response,
    org_slug: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — get a published page by slug.

    Used by the frontend SSR/cache worker to render pages.
    """
    response.headers["Cache-Control"] = PUBLIC_CONTENT_CACHE_CONTROL
    from app.models import Organization
    org_result = await db.execute(
        select(Organization).where(Organization.slug == org_slug)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await db.execute(
        select(Page).where(
            Page.org_id == org.id,
            Page.slug == slug,
            Page.status == "published",
            Page.is_deleted == False,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return PageResponse.model_validate(page)


@router.get("/{page_id}", response_model=PageResponse)
async def get_page(
    page_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Page).where(Page.id == page_id, Page.is_deleted == False)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return PageResponse.model_validate(page)


@router.post("", response_model=PageResponse, status_code=201)
async def create_page(
    body: PageCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner", "editor"])),
):
    """Create a new CMS page.

    Slug is unique per org (``uq_pages_org_slug``). If the caller posts a
    collision we translate the IntegrityError into a 409 so the UI can
    surface a specific "slug taken" message instead of a generic 500.
    """
    # Pre-check so we return 409 without consuming the SAVEPOINT — an
    # IntegrityError would poison the session. RLS scopes this to the org.
    dupe = await db.execute(
        select(Page.id).where(Page.slug == body.slug, Page.is_deleted == False)  # noqa: E712
    )
    if dupe.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A page with slug '{body.slug}' already exists",
        )

    page = Page(
        org_id=uuid.UUID(current_user["org_id"]),
        last_edited_by=uuid.UUID(current_user["sub"]),
        **body.model_dump(),
    )
    db.add(page)
    try:
        await db.flush()
    except IntegrityError:
        # Race with a concurrent create — same message, same code.
        raise HTTPException(
            status_code=409,
            detail=f"A page with slug '{body.slug}' already exists",
        )
    await db.refresh(page)
    return PageResponse.model_validate(page)


@router.patch("/{page_id}", response_model=PageResponse)
async def update_page(
    page_id: uuid.UUID,
    body: PageUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner", "editor"])),
):
    """Update a page with optimistic locking.

    Client must send the current `version` they have.
    If it doesn't match the DB, someone else edited it → 409 Conflict.
    """
    result = await db.execute(
        select(Page).where(Page.id == page_id, Page.is_deleted == False)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Optimistic lock check — return the live server page so the client
    # can show a conflict dialog with both sides of the collision.
    if page.version != body.version:
        raise version_conflict(
            resource="page",
            current_version=page.version,
            attempted_version=body.version,
            current=PageResponse.model_validate(page),
        )

    update_data = body.model_dump(exclude_unset=True, exclude={"version"})
    for field, value in update_data.items():
        setattr(page, field, value)
    page.version += 1
    page.last_edited_by = uuid.UUID(current_user["sub"])

    await db.flush()
    await db.refresh(page)
    return PageResponse.model_validate(page)


@router.delete("/{page_id}", status_code=204)
async def delete_page(
    page_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Soft-delete a page."""
    result = await db.execute(
        select(Page).where(Page.id == page_id, Page.is_deleted == False)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.is_deleted = True
    page.status = "archived"
