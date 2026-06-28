"""Internal video endpoints — called by the stevie-cf-stream-webhook
forwarder (or by Cloudflare Stream directly when the webhook is wired
straight to FastAPI).

Worker flow (Cloudflare Stream webhook):
  1. Stream POSTs the raw video object to
     ``/internal/video/cf-stream-event`` whenever a state change occurs.
  2. We bootstrap-lookup the org via a public DB session (Stream's
     ``meta`` carries our asset_id; org_id is on the row itself) and
     then re-open under RLS bound to that tenant for the mutation.

Security: same shared-header pattern as the rest of ``app/api/internal/*`` —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``.

Why this lives here instead of ``app/api/video.py``: the public Video CRUD
runs through ``get_db_with_rls_dep`` which requires a user JWT. The
webhook source has no JWT, so it posts to the internal router and we set
RLS context manually via a public-DB bootstrap lookup, exactly like
``app/api/internal/email.py``.

Cloudflare Stream's webhook envelope delivers the raw Stream video
object on every state change. We accept the native shape rather than
forcing the configurer (or a Worker) to reshape it. Set this up in the
Cloudflare dashboard:

  Stream → Webhooks → Add → URL: https://api.<demodomain>/api/internal/video/cf-stream-event
                                 → Custom header: X-Webhook-Secret: <WEBHOOK_SECRET>

Stream's ``meta`` field is set by us at ingest time
(``cloudflare.CloudflareStreamClient.copy_from_url``), so the webhook
round-trips our ``asset_id`` and ``org_id`` reliably.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.internal.webhooks import verify_webhook_secret
from app.db.database import RequestContext, get_db_public, get_db_with_rls
from app.models.social_media import VideoAsset

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/video", tags=["internal"])


# ── Cloudflare Stream webhook ────────────────────────────────────────


class CFStreamEventBody(BaseModel):
    """Shape of a Cloudflare Stream webhook payload (subset we care about)."""

    uid: str = Field(description="Stream's video UID — we persist this on VideoAsset.")
    readyToStream: bool = False
    status: dict = Field(
        default_factory=dict,
        description=(
            "{'state': 'queued' | 'inprogress' | 'ready' | 'error', "
            "'errorReasonText': str | None}"
        ),
    )
    duration: float | None = None
    thumbnail: str | None = None
    meta: dict = Field(
        default_factory=dict,
        description=(
            "Pass-through dict we set at ingest. Required keys: "
            "``asset_id`` (our VideoAsset.id), ``org_id``."
        ),
    )


@router.post("/cf-stream-event", status_code=204)
async def record_cf_stream_event(
    body: Annotated[CFStreamEventBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Apply a Cloudflare Stream webhook event to the VideoAsset row.

    Stream's state machine: queued → inprogress → (ready | error).
    We map ready → 'ready', error → 'errored', anything else → 'processing'.
    """
    asset_id_raw = body.meta.get("asset_id")
    if not asset_id_raw:
        raise HTTPException(
            status_code=400,
            detail="Stream webhook payload is missing meta.asset_id",
        )
    try:
        asset_id = uuid.UUID(asset_id_raw)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Stream webhook meta.asset_id is not a UUID: {asset_id_raw}",
        )

    # Bootstrap-lookup the org_id, then re-open under RLS for the mutation.
    asset_org_id: uuid.UUID | None = None
    async for db in get_db_public():
        result = await db.execute(
            select(VideoAsset.org_id).where(VideoAsset.id == asset_id)
        )
        asset_org_id = result.scalar_one_or_none()
        break
    if asset_org_id is None:
        logger.warning(
            "VideoAsset not found for cf-stream event: asset_id=%s uid=%s",
            asset_id, body.uid,
        )
        raise HTTPException(
            status_code=404, detail=f"VideoAsset {asset_id} not found"
        )

    ctx = RequestContext(
        org_id=str(asset_org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )
    async for db in get_db_with_rls(ctx):
        result = await db.execute(
            select(VideoAsset).where(VideoAsset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        if asset is None:
            raise HTTPException(
                status_code=404, detail=f"VideoAsset {asset_id} not found"
            )

        state = (body.status or {}).get("state", "")
        if state == "ready":
            asset.status = "ready"
            asset.cf_stream_uid = body.uid
            if body.duration is not None:
                asset.duration_seconds = body.duration
            if body.thumbnail and not asset.thumbnail_url:
                asset.thumbnail_url = body.thumbnail
        elif state == "error":
            asset.status = "errored"
            err = (body.status or {}).get("errorReasonText", "")
            if err:
                # No dedicated error column — stash on mux_status (legacy
                # column name, repurposed as a status hint).
                asset.mux_status = f"errored: {err[:200]}"
        else:
            # queued / inprogress / unknown — keep us in 'processing' so
            # the UI shows the spinner.
            asset.status = "processing"
            asset.cf_stream_uid = body.uid

        await db.flush()
        await db.commit()

        logger.info(
            "Stream event applied: state=%s asset_id=%s org=%s uid=%s",
            state, asset_id, asset_org_id, body.uid,
        )
