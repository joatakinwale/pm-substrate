"""Proposal management endpoints — CRUD, sharing, signing cascade."""
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep, require_role
from app.core.config import get_settings
from app.db.database import get_db
from app.models import (
    Proposal,
    ProposalVersion,
    ClientOnboarding,
    COMPOUND_METHOD_BLOCKS,
)
from app.schemas.common import PaginatedResponse
from app.schemas.proposals import (
    ProposalCreate,
    ProposalResponse,
    ProposalUpdate,
    ProposalBlockUpdate,
    ProposalPublicResponse,
    OnboardingResponse,
    IntakeFormSubmission,
)

router = APIRouter(prefix="/proposals", tags=["proposals"])


# ── Helper: default 12 Compound Method blocks ────────────────
def _default_blocks() -> list[dict]:
    return [
        {"type": b["type"], "title": b["title"], "content": "", "order": b["order"]}
        for b in COMPOUND_METHOD_BLOCKS
    ]


# ═══ AUTHENTICATED ENDPOINTS ═══════════════════════════════

@router.get("", response_model=PaginatedResponse)
async def list_proposals(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(Proposal)

    if status_filter:
        query = query.where(Proposal.status == status_filter)
    if search:
        query = query.where(
            Proposal.client_name.ilike(f"%{search}%")
            | Proposal.client_email.ilike(f"%{search}%")
            | Proposal.title.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Proposal.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    proposals = result.scalars().all()

    return PaginatedResponse(
        items=[ProposalResponse.model_validate(p) for p in proposals],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(
    proposal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return ProposalResponse.model_validate(proposal)


@router.post("", response_model=ProposalResponse, status_code=201)
async def create_proposal(
    body: ProposalCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Create a new proposal with 12 Compound Method blocks."""
    org_id = uuid.UUID(current_user["org_id"])

    # Use provided blocks or default 12-block structure
    blocks = (
        [b.model_dump() for b in body.blocks]
        if body.blocks
        else _default_blocks()
    )

    proposal = Proposal(
        org_id=org_id,
        client_name=body.client_name,
        client_email=body.client_email,
        client_company=body.client_company,
        title=body.title,
        compound_phase=body.compound_phase,
        total_cents=body.total_cents,
        currency=body.currency,
        billing_interval=body.billing_interval,
        blocks=blocks,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        internal_notes=body.internal_notes,
        agent_role=body.agent_role,
        status="draft",
    )
    db.add(proposal)
    await db.flush()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.patch("/{proposal_id}", response_model=ProposalResponse)
async def update_proposal(
    proposal_id: uuid.UUID,
    body: ProposalUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.status == "signed":
        raise HTTPException(status_code=400, detail="Cannot edit a signed proposal")

    # Save version snapshot before updating blocks
    if body.blocks:
        version = ProposalVersion(
            proposal_id=proposal.id,
            version=proposal.version,
            blocks=proposal.blocks,
            total_cents=proposal.total_cents,
            agent_role=proposal.agent_role,
            changed_by=uuid.UUID(current_user["sub"]) if current_user.get("sub") else None,
        )
        db.add(version)
        proposal.version += 1

    update_data = body.model_dump(exclude_unset=True)
    if "blocks" in update_data and update_data["blocks"]:
        update_data["blocks"] = [b.model_dump() if hasattr(b, "model_dump") else b for b in update_data["blocks"]]

    for field, value in update_data.items():
        setattr(proposal, field, value)

    await db.flush()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.patch("/{proposal_id}/block", response_model=ProposalResponse)
async def update_block(
    proposal_id: uuid.UUID,
    body: ProposalBlockUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Update a single block's content by type."""
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status == "signed":
        raise HTTPException(status_code=400, detail="Cannot edit a signed proposal")

    blocks = list(proposal.blocks) if proposal.blocks else _default_blocks()
    found = False
    for block in blocks:
        if block["type"] == body.block_type:
            block["content"] = body.content
            found = True
            break

    if not found:
        raise HTTPException(status_code=400, detail=f"Block type '{body.block_type}' not found")

    proposal.blocks = blocks
    await db.flush()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.post("/{proposal_id}/send", response_model=ProposalResponse)
async def send_proposal(
    proposal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Mark proposal as sent and generate share link.

    In production, this would also send an email via Resend.
    """
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status not in ("draft",):
        raise HTTPException(status_code=400, detail=f"Cannot send a {proposal.status} proposal")

    proposal.status = "sent"
    proposal.sent_at = datetime.now(timezone.utc)
    proposal.expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    # ── Send the proposal email via Resend ────────────────────────
    # Voice: warm, confident, no hype. We present the proposal as the
    # thing the client asked for, not a sales pitch. CTA in Stevie
    # Green per brand guidelines. Imports are local so the billing/
    # proposal hot path doesn't pay the email module's import cost
    # on every request that doesn't send.
    from html import escape as html_escape
    from app.services.email_sender import send_transactional_email

    _STEVIE_GREEN = "#089140"
    _EMAIL_FONT = (
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "'Helvetica Neue', Arial, sans-serif"
    )
    # URL-1: was `f"https://app.steviesocial.com/proposal/{...}"` — now
    # pulled from settings.frontend_url so dev/staging/prod each send
    # clients to the right signer host, and we stop baking the legacy
    # `steviesocial.com` domain into outbound notification emails.
    share_url = (
        f"{get_settings().frontend_url.rstrip('/')}"
        f"/proposal/{proposal.share_token}"
    )
    client_name = html_escape(proposal.client_name or "there")
    proposal_title = html_escape(proposal.title or "your proposal")

    html_body = (
        f'<div style="font-family:{_EMAIL_FONT};color:#000000;'
        f'font-size:16px;line-height:1.55;max-width:560px;">'
        f"<p>Hi {client_name},</p>"
        f"<p>Here's the proposal we put together for <strong>"
        f"{proposal_title}</strong> — built around your goals and the "
        "Compound Method framework.</p>"
        "<p>Take your time with it. When you're ready, you can sign "
        "directly from the link below.</p>"
        f'<p style="margin:28px 0;">'
        f'<a href="{html_escape(share_url)}" '
        f'style="background:{_STEVIE_GREEN};color:#ffffff;'
        f'padding:14px 24px;text-decoration:none;border-radius:6px;'
        f'display:inline-block;font-weight:600;font-family:{_EMAIL_FONT};'
        f'font-size:15px;">Review proposal</a></p>'
        "<p>Questions or thoughts? Just reply.</p>"
        "<p>— The Stevie Social Team</p>"
        "</div>"
    )

    send_result = await send_transactional_email(
        to_email=proposal.client_email,
        subject=f"Your Stevie Social proposal — {proposal.title}",
        html_body=html_body,
        org_id=proposal.org_id,
    )
    if not send_result.success:
        # Don't fail the status transition. Agency can resend from the
        # admin UI; leaving proposal in ``draft`` on a transient Resend
        # error would be worse UX than a retry button.
        import logging
        logging.getLogger(__name__).warning(
            "Proposal %s: send email failed — %s",
            proposal.id, send_result.error,
        )

    await db.flush()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.post("/{proposal_id}/sign", response_model=ProposalResponse)
async def sign_proposal(
    proposal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    """Manually mark a proposal as signed and trigger the cascade.

    In production, the HelloSign webhook would trigger this automatically.
    The cascade is implemented in ``app.services.proposal_cascade``:
    Invoice → Onboarding → Project → Lead=won → Activity log → Welcome email.
    """
    from app.services.proposal_cascade import (
        run_sign_cascade,
        send_onboarding_welcome,
    )

    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status == "signed":
        raise HTTPException(status_code=400, detail="Proposal already signed")

    org_id = uuid.UUID(current_user["org_id"])
    artifacts = await run_sign_cascade(
        db,
        proposal,
        org_id=org_id,
        signature_provider="internal",
    )

    # Send welcome email after cascade persists so a mail-provider hiccup
    # can't roll back the signed state.
    await send_onboarding_welcome(db, artifacts["onboarding_id"])

    await db.flush()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.delete("/{proposal_id}", status_code=204)
async def delete_proposal(
    proposal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_role(["admin", "owner"])),
):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status == "signed":
        raise HTTPException(status_code=400, detail="Cannot delete a signed proposal")
    await db.delete(proposal)


# ═══ ONBOARDING ENDPOINTS ═══════════════════════════════════

@router.get("/{proposal_id}/onboarding", response_model=OnboardingResponse)
async def get_onboarding(
    proposal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.proposal_id == proposal_id)
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")
    return OnboardingResponse.model_validate(onboarding)


# ═══ PUBLIC ENDPOINTS (no auth) ══════════════════════════════

@router.get("/public/{share_token}", response_model=ProposalPublicResponse)
async def view_proposal_public(
    share_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for clients to view their proposal."""
    result = await db.execute(
        select(Proposal).where(Proposal.share_token == share_token)
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Check expiry
    if proposal.expires_at and proposal.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This proposal has expired")

    # Track view
    proposal.view_count += 1
    if not proposal.viewed_at:
        proposal.viewed_at = datetime.now(timezone.utc)
        if proposal.status == "sent":
            proposal.status = "viewed"

    return ProposalPublicResponse.model_validate(proposal)


@router.post("/public/{share_token}/sign", response_model=ProposalPublicResponse)
async def sign_proposal_public(
    share_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for clients to sign their proposal.

    In production, HelloSign would handle signatures and POST
    to a webhook. This endpoint supports internal/simple signing.
    """
    result = await db.execute(
        select(Proposal).where(Proposal.share_token == share_token)
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status == "signed":
        raise HTTPException(status_code=400, detail="Already signed")
    if proposal.expires_at and proposal.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This proposal has expired")

    from app.services.proposal_cascade import (
        run_sign_cascade,
        send_onboarding_welcome,
    )

    signer_ip = request.client.host if request.client else None
    artifacts = await run_sign_cascade(
        db,
        proposal,
        org_id=proposal.org_id,
        signer_name=proposal.client_name,
        signer_ip=signer_ip,
        signature_provider="internal",
    )
    await send_onboarding_welcome(db, artifacts["onboarding_id"])

    await db.flush()
    await db.refresh(proposal)
    return ProposalPublicResponse.model_validate(proposal)


@router.post("/public/{share_token}/intake", status_code=200)
async def submit_intake_form(
    share_token: str,
    body: IntakeFormSubmission,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for clients to submit their onboarding intake form."""
    result = await db.execute(
        select(Proposal).where(Proposal.share_token == share_token)
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    onboarding_result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.proposal_id == proposal.id)
    )
    onboarding = onboarding_result.scalar_one_or_none()
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not started")

    onboarding.intake_form_data = body.data
    onboarding.intake_form_completed_at = datetime.now(timezone.utc)
    onboarding.status = "intake_completed"

    await db.flush()

    # Trigger next email in sequence (brand voice profile form). Best-effort
    # — if Resend hiccups we still return 200 so the client's form submission
    # isn't lost; the status transition persists and agency can retry.
    try:
        from app.services.onboarding import advance_to_brand_voice
        await advance_to_brand_voice(str(onboarding.id), db)
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "Brand-voice advance failed for onboarding %s", onboarding.id,
        )

    return {"ok": True, "message": "Intake form submitted successfully"}
