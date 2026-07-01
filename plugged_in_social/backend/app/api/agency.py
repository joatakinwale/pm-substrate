"""Autonomous agency domain endpoints."""
from __future__ import annotations

import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.agency import ClientEngagement
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyAccessRequestResponse,
    AgencyApprovalCreate,
    AgencyApprovalResponse,
    AgencyArtifactCreate,
    AgencyArtifactResponse,
    ClientEngagementCreate,
    ClientEngagementResponse,
    MarketingRunCreate,
    MarketingRunResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.agency_domain import (
    create_access_request,
    create_agency_artifact,
    create_approval_request,
    create_client_engagement,
    start_marketing_run,
)

router = APIRouter(prefix="/agency", tags=["agency"])


def _org_id_from_user(current_user: dict) -> uuid.UUID:
    if not current_user.get("org_id"):
        raise HTTPException(status_code=403, detail="Organization context required")
    return uuid.UUID(current_user["org_id"])


async def _get_engagement_or_404(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    engagement_id: uuid.UUID,
) -> ClientEngagement:
    result = await db.execute(
        select(ClientEngagement).where(
            ClientEngagement.id == engagement_id,
            ClientEngagement.org_id == org_id,
        )
    )
    engagement = result.scalar_one_or_none()
    if engagement is None:
        raise HTTPException(status_code=404, detail="Client engagement not found")
    return engagement


@router.get("/engagements", response_model=PaginatedResponse)
async def list_engagements(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    query = select(ClientEngagement).where(ClientEngagement.org_id == org_id)
    if status_filter:
        query = query.where(ClientEngagement.status == status_filter)

    count_result = await db.execute(query)
    all_items = list(count_result.scalars().all())
    total = len(all_items)

    result = await db.execute(
        query.order_by(ClientEngagement.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    engagements = result.scalars().all()

    return PaginatedResponse(
        items=[ClientEngagementResponse.model_validate(item) for item in engagements],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/engagements", response_model=ClientEngagementResponse, status_code=201)
async def create_engagement(
    body: ClientEngagementCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=body,
        created_by_agent="chief_of_staff",
    )
    await db.commit()
    await db.refresh(engagement)
    return ClientEngagementResponse.model_validate(engagement)


@router.get("/engagements/{engagement_id}", response_model=ClientEngagementResponse)
async def get_engagement(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    return ClientEngagementResponse.model_validate(engagement)


@router.post(
    "/engagements/{engagement_id}/runs",
    response_model=MarketingRunResponse,
    status_code=201,
)
async def create_marketing_run(
    engagement_id: uuid.UUID,
    body: MarketingRunCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective=body.objective,
        project_id=body.project_id,
    )
    await db.commit()
    await db.refresh(run)
    return MarketingRunResponse.model_validate(run)


@router.post(
    "/engagements/{engagement_id}/artifacts",
    response_model=AgencyArtifactResponse,
    status_code=201,
)
async def create_artifact(
    engagement_id: uuid.UUID,
    body: AgencyArtifactCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(artifact)
    return AgencyArtifactResponse.model_validate(artifact)


@router.post(
    "/engagements/{engagement_id}/approvals",
    response_model=AgencyApprovalResponse,
    status_code=201,
)
async def create_approval(
    engagement_id: uuid.UUID,
    body: AgencyApprovalCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(approval)
    return AgencyApprovalResponse.model_validate(approval)


@router.post(
    "/engagements/{engagement_id}/access-requests",
    response_model=AgencyAccessRequestResponse,
    status_code=201,
)
async def create_access(
    engagement_id: uuid.UUID,
    body: AgencyAccessRequestCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = _org_id_from_user(current_user)
    engagement = await _get_engagement_or_404(
        db,
        org_id=org_id,
        engagement_id=engagement_id,
    )
    access_request = await create_access_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=body,
    )
    await db.commit()
    await db.refresh(access_request)
    return AgencyAccessRequestResponse.model_validate(access_request)
