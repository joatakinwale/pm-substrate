"""API endpoints for agent-assisted marketing features.

Exposes "1-click approve" endpoints for clients to approve proactive drafts
and reports.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.social_media import SocialPost
from app.models.report import ClientReport
from app.services.queue_publisher import publish_social_post_publish, publish_report_build

# Typically you would have an `auth_current_user` dependency to check permissions.
# Assuming standard backend setup, we will define the routes.
router = APIRouter(prefix="/agent-assisted", tags=["agent-assisted"])

@router.post("/campaign-drafts/{post_id}/approve")
async def approve_campaign_draft(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # user = Depends(get_current_user)
):
    """1-click approve a campaign draft. Changes status from draft to scheduled/published."""
    result = await db.execute(
        select(SocialPost).where(
            SocialPost.id == post_id,
            SocialPost.is_deleted == False
        )
    )
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Draft not found")

    if post.status != "draft":
        raise HTTPException(status_code=400, detail="Post is not in draft status")

    post.status = "scheduled" # Or publish immediately
    if not post.scheduled_for:
        post.scheduled_for = datetime.now(timezone.utc)
    
    await db.commit()

    # Trigger publisher worker if scheduled for now (simplified)
    # The cron job `/internal/cron/publish-scheduled-posts` will pick it up otherwise
    
    return {"ok": True, "post_id": post.id, "status": post.status}

@router.post("/reports/{report_id}/approve")
async def approve_proactive_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # user = Depends(get_current_user)
):
    """1-click approve a proactive report draft. Initiates report build."""
    result = await db.execute(
        select(ClientReport).where(
            ClientReport.id == report_id,
            ClientReport.is_deleted == False
        )
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "draft":
        raise HTTPException(status_code=400, detail="Report is not in draft status")

    report.status = "building"
    await db.commit()

    # Dispatch to report builder worker
    await publish_report_build(
        org_id=report.org_id,
        client_report_id=report.id,
    )
    
    return {"ok": True, "report_id": report.id, "status": report.status}
