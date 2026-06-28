"""Email campaigns + templates API."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.email_campaign import EmailCampaign, EmailTemplate, EmailSend
from app.schemas.common import PaginatedResponse
from app.schemas.email_campaigns import (
    CampaignCreate,
    CampaignResponse,
    CampaignStats,
    CampaignUpdate,
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)

router = APIRouter(prefix="/email", tags=["email"])


# ═══ TEMPLATES ═══════════════════════════════════════════════

@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    category: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(EmailTemplate).order_by(EmailTemplate.created_at.desc())
    if category:
        query = query.where(EmailTemplate.category == category)
    result = await db.execute(query)
    return [TemplateResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateResponse.model_validate(template)


@router.post("/templates", response_model=TemplateResponse, status_code=201)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    template = EmailTemplate(
        org_id=org_id,
        name=body.name,
        subject=body.subject,
        category=body.category,
        html_body=body.html_body,
        design_json=body.design_json,
        variables=body.variables,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    await db.flush()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)


# ═══ CAMPAIGNS ═══════════════════════════════════════════════

@router.get("/campaigns", response_model=PaginatedResponse)
async def list_campaigns(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    compound_phase: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(EmailCampaign)
    if status_filter:
        query = query.where(EmailCampaign.status == status_filter)
    if compound_phase:
        query = query.where(EmailCampaign.compound_phase == compound_phase)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(EmailCampaign.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    campaigns = result.scalars().all()

    return PaginatedResponse(
        items=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    campaign = EmailCampaign(
        org_id=org_id,
        name=body.name,
        subject=body.subject,
        preview_text=body.preview_text,
        from_name=body.from_name,
        from_email=body.from_email,
        reply_to=body.reply_to,
        template_id=body.template_id,
        html_body=body.html_body,
        audience_filter=body.audience_filter,
        compound_phase=body.compound_phase,
        scheduled_at=body.scheduled_at,
        ab_test=body.ab_test,
        internal_notes=body.internal_notes,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.flush()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/schedule", response_model=CampaignResponse)
async def schedule_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Schedule a draft campaign for sending."""
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft campaigns can be scheduled")
    if not campaign.scheduled_at:
        raise HTTPException(status_code=400, detail="Set scheduled_at before scheduling")

    campaign.status = "scheduled"
    await db.flush()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/send", response_model=CampaignResponse)
async def send_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Send a campaign immediately (queues via Cloudflare Queues)."""
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Campaign cannot be sent in current status")

    campaign.status = "sending"
    campaign.sent_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)

    # Dispatch to the email-sender Cloudflare Worker via the queue producer.
    # Worker calls back to /api/internal/email/campaigns/{id}/dispatch to
    # match the audience and create per-recipient EmailSend rows.
    from app.services.queue_publisher import publish_email_campaign_send
    await publish_email_campaign_send(
        org_id=campaign.org_id,
        campaign_id=campaign.id,
    )

    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}/stats", response_model=CampaignStats)
async def campaign_stats(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sent = max(campaign.total_sent, 1)
    delivered = max(campaign.total_delivered, 1)
    return CampaignStats(
        total_sent=campaign.total_sent,
        total_delivered=campaign.total_delivered,
        total_opened=campaign.total_opened,
        total_clicked=campaign.total_clicked,
        total_bounced=campaign.total_bounced,
        total_unsubscribed=campaign.total_unsubscribed,
        open_rate=round(campaign.total_opened / delivered * 100, 1),
        click_rate=round(campaign.total_clicked / delivered * 100, 1),
        bounce_rate=round(campaign.total_bounced / sent * 100, 1),
    )


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft campaigns can be deleted")
    await db.delete(campaign)
