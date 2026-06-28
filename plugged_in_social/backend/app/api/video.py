"""Video assets API — R2 upload metadata + Cloudflare Stream playback."""
import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.core.config import get_settings
from app.models.social_media import VideoAsset
from app.schemas.common import PaginatedResponse
from app.schemas.social_media import (
    VideoAssetCreate,
    VideoAssetResponse,
    VideoAssetUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["video"])


@router.get("/assets", response_model=PaginatedResponse)
async def list_video_assets(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    asset_type: str | None = None,
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(VideoAsset)
    if status_filter:
        query = query.where(VideoAsset.status == status_filter)
    if asset_type:
        query = query.where(VideoAsset.asset_type == asset_type)
    if project_id:
        query = query.where(VideoAsset.project_id == project_id)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(VideoAsset.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    assets = result.scalars().all()

    return PaginatedResponse(
        items=[VideoAssetResponse.model_validate(a) for a in assets],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/assets/{asset_id}", response_model=VideoAssetResponse)
async def get_video_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(VideoAsset).where(VideoAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Video asset not found")
    return VideoAssetResponse.model_validate(asset)


@router.post("/assets", response_model=VideoAssetResponse, status_code=201)
async def create_video_asset(
    body: VideoAssetCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Register a video asset after R2 upload completes.

    The frontend handles chunked upload directly to R2 (presigned URLs),
    then calls this endpoint to create the metadata record.
    """
    org_id = uuid.UUID(current_user["org_id"])
    asset = VideoAsset(
        org_id=org_id,
        filename=body.filename,
        file_size_bytes=body.file_size_bytes,
        mime_type=body.mime_type,
        r2_key=body.r2_key,
        project_id=body.project_id,
        task_id=body.task_id,
        client_name=body.client_name,
        campaign=body.campaign,
        asset_type=body.asset_type,
        tags=body.tags,
        status="uploaded",
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)

    # Kick off Cloudflare Stream ingest. Stream pulls the file directly
    # from R2 via a presigned URL — one Cloudflare API call, no second
    # vendor, no queue hop.
    #
    # Why inline (not queued) for now: Stream's /copy API returns within
    # a second; the heavy work (transcoding, packaging) happens on Stream
    # asynchronously and reports back via webhook. Queueing the call
    # itself only helps if Stream's API is consistently slow, which it
    # isn't.
    settings = get_settings()
    if settings.cf_stream_configured:
        try:
            from app.services.cloudflare import (
                get_r2_client,
                get_stream_client,
            )

            r2 = get_r2_client()
            stream = get_stream_client()
            presigned = await r2.presign_get(
                key=asset.r2_key,
                expires_in_seconds=600,
            )
            cf_uid = await stream.copy_from_url(
                source_url=presigned,
                meta={"asset_id": str(asset.id), "org_id": str(asset.org_id)},
            )
            asset.cf_stream_uid = cf_uid
            asset.status = "processing"
            await db.flush()
            logger.info(
                "Stream ingest started: asset=%s cf_uid=%s", asset.id, cf_uid
            )
        except Exception:
            # Stream API hiccup must not fail the upload — the row is
            # persisted, an operator can re-trigger ingest from the row.
            logger.exception(
                "Failed to start Stream ingest for asset %s", asset.id,
            )
    else:
        logger.info(
            "Cloudflare Stream not configured — asset %s staying at "
            "status='uploaded' with no playback URL",
            asset.id,
        )

    return VideoAssetResponse.model_validate(asset)


@router.patch("/assets/{asset_id}", response_model=VideoAssetResponse)
async def update_video_asset(
    asset_id: uuid.UUID,
    body: VideoAssetUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(VideoAsset).where(VideoAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Video asset not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await db.flush()
    await db.refresh(asset)
    return VideoAssetResponse.model_validate(asset)


@router.delete("/assets/{asset_id}", status_code=204)
async def delete_video_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Delete a video asset: R2 object → Cloudflare Stream video → DB row.

    Storage-side failures (R2 404, Stream 404, network blips) are logged
    and swallowed so the DB row still gets deleted. The inverse — leaving
    a DB row pointing at missing files — is worse than an orphaned object
    that a future GC job can reap, because it surfaces to users as a
    broken thumbnail or a 500 from the player.
    """
    result = await db.execute(select(VideoAsset).where(VideoAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Video asset not found")

    settings = get_settings()

    # 1) R2 object delete — only if we have both a key and credentials.
    #    Dev environments without R2 configured skip this branch entirely
    #    (upload never happened through R2 either).
    if asset.r2_key and settings.r2_configured:
        try:
            from app.services.cloudflare import get_r2_client
            get_r2_client().delete_object(asset.r2_key)
        except Exception:
            logger.exception(
                "Failed to delete R2 object %s for asset %s — continuing with DB delete",
                asset.r2_key, asset.id,
            )

    # 2) Cloudflare Stream delete — only if the upload reached Stream
    #    and credentials are present. ``cf_stream_uid`` is set by the
    #    Stream ingest call in ``create_video_asset``; if it's empty the
    #    ingest never happened (dev, network outage, or still pending),
    #    so there is nothing to clean up on Stream's side.
    cf_stream_uid = getattr(asset, "cf_stream_uid", None)
    if cf_stream_uid and settings.cf_stream_configured:
        try:
            from app.services.cloudflare import get_stream_client
            await get_stream_client().delete_video(cf_stream_uid)
        except Exception:
            logger.exception(
                "Failed to delete Cloudflare Stream video %s for asset %s — "
                "continuing with DB delete",
                cf_stream_uid, asset.id,
            )

    await db.delete(asset)


@router.post("/assets/{asset_id}/archive", response_model=VideoAssetResponse)
async def archive_video_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Archive a video — flip ``status='archived'`` so it drops out of the
    default active-asset lists.

    .. note::
       Cold-storage file migration (R2 → Backblaze B2 or similar) is NOT
       implemented. There is currently no Backblaze client, no bucket, and
       no lifecycle job wired up. Row-level archival is the correct
       user-facing behavior today: archived assets stop appearing in the
       default UI, Cloudflare Stream playback still works (we don't delete
       the Stream video here — use ``DELETE /video/assets/{id}`` for full
       cleanup), and the R2 object remains on hot storage until explicit
       deletion. When a Backblaze B2 infra project lands, wire the
       migration through a Cloudflare Queues job triggered from here,
       following the Stream ingest pattern in ``create_video_asset``.
    """
    result = await db.execute(select(VideoAsset).where(VideoAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Video asset not found")
    asset.status = "archived"
    await db.flush()
    await db.refresh(asset)
    return VideoAssetResponse.model_validate(asset)
