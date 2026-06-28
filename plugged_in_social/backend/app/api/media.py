"""Media asset endpoints — presigned upload URLs and asset management."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import HTTPError, HTTPStatusError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.core.config import get_settings
from app.models import MediaAsset, Organization
from app.schemas.common import PaginatedResponse
from app.schemas.media import (
    MediaAssetResponse,
    MediaAssetUpdate,
    PresignedUploadRequest,
    PresignedUploadResponse,
)
from app.services.cloudflare import get_images_client, get_r2_client, get_stream_client

router = APIRouter(prefix="/media", tags=["media"])


def _cloudflare_upload_exception(exc: HTTPError) -> HTTPException:
    if isinstance(exc, HTTPStatusError):
        status_code = exc.response.status_code
        if status_code in {401, 403}:
            detail = (
                "Cloudflare media upload is not authorized. Check CF_API_TOKEN "
                "permissions and CF_ACCOUNT_ID."
            )
        else:
            detail = f"Cloudflare media upload failed with HTTP {status_code}."
    else:
        detail = "Cloudflare media upload failed before an upload URL was created."
    return HTTPException(status_code=502, detail=detail)


@router.get("", response_model=PaginatedResponse)
async def list_media(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    asset_type: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """List media assets."""
    query = select(MediaAsset).where(MediaAsset.is_deleted == False)
    if asset_type:
        query = query.where(MediaAsset.asset_type == asset_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(MediaAsset.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    assets = result.scalars().all()

    items = []
    for a in assets:
        resp = MediaAssetResponse.model_validate(a)
        resp.delivery_url = a.delivery_url
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/upload", response_model=PresignedUploadResponse, status_code=201)
async def request_upload(
    body: PresignedUploadRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Request a presigned upload URL.

    Based on file type, routes to:
      - R2 for documents/general files
      - Cloudflare Images for images
      - Cloudflare Stream for videos
    """
    settings = get_settings()
    org_id = uuid.UUID(current_user["org_id"])
    user_id = uuid.UUID(current_user["sub"])

    # Look up org slug for key building
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = org_result.scalar_one()

    upload_url = ""
    r2_key = None
    cf_image_id = None
    cf_stream_uid = None
    storage_backend = "r2"

    if body.asset_type == "video" and settings.cf_stream_configured:
        # Video → Cloudflare Stream
        stream = get_stream_client()
        try:
            upload_url, cf_stream_uid = await stream.generate_direct_upload_url(
                metadata={"org_id": str(org_id), "context": body.context},
            )
        except HTTPError as exc:
            raise _cloudflare_upload_exception(exc) from exc
        storage_backend = "cf_stream"

    elif body.asset_type == "image" and settings.cf_images_configured:
        # Image → Cloudflare Images
        images = get_images_client()
        try:
            upload_url, cf_image_id = await images.generate_direct_upload_url(
                metadata={"org_id": str(org_id), "context": body.context},
            )
        except HTTPError as exc:
            raise _cloudflare_upload_exception(exc) from exc
        storage_backend = "cf_images"

    elif settings.r2_configured:
        # Everything else → R2
        r2 = get_r2_client()
        r2_key = r2.build_key(org.slug, body.context, body.filename)
        upload_url = r2.generate_presigned_upload(r2_key, body.content_type)
        storage_backend = "r2"

    else:
        raise HTTPException(
            status_code=503,
            detail="No storage backend configured",
        )

    # Create asset record (upload pending — browser will upload directly)
    asset = MediaAsset(
        org_id=org_id,
        asset_type=body.asset_type,
        storage_backend=storage_backend,
        filename=body.filename,
        mime_type=body.content_type,
        r2_key=r2_key,
        cf_image_id=cf_image_id,
        cf_stream_uid=cf_stream_uid,
        uploaded_by=user_id,
        usage_context=body.context,
    )
    db.add(asset)
    await db.flush()

    return PresignedUploadResponse(
        upload_url=upload_url,
        asset_id=asset.id,
        r2_key=r2_key,
        cf_image_id=cf_image_id,
        cf_stream_uid=cf_stream_uid,
    )


@router.get("/{asset_id}", response_model=MediaAssetResponse)
async def get_media(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Read a single media asset, including the resolved ``delivery_url``.

    Frontend calls this after a presigned upload completes to fetch the
    final CDN URL for the file (it isn't known until the upload lands —
    the presigned URL is one-time and doesn't include the delivery host).
    """
    result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == asset_id, MediaAsset.is_deleted == False
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    resp = MediaAssetResponse.model_validate(asset)
    resp.delivery_url = asset.delivery_url
    return resp


@router.patch("/{asset_id}", response_model=MediaAssetResponse)
async def update_media(
    asset_id: uuid.UUID,
    body: MediaAssetUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Update alt text or caption on a media asset."""
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.is_deleted == False)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

    await db.flush()
    await db.refresh(asset)
    resp = MediaAssetResponse.model_validate(asset)
    resp.delivery_url = asset.delivery_url
    return resp


@router.delete("/{asset_id}", status_code=204)
async def delete_media(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Soft-delete a media asset. Actual file cleanup runs via cron."""
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.is_deleted == False)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.is_deleted = True
