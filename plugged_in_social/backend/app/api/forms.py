"""Form builder + submissions API."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.core.rate_limit import limiter
from app.db.database import get_db_public
from app.models.email_campaign import FormDefinition, FormSubmission
from app.schemas.common import PaginatedResponse
from app.schemas.email_campaigns import (
    FormCreate,
    PublicFormResponse,
    FormResponse,
    FormSubmissionCreate,
    FormSubmissionResponse,
    FormUpdate,
)

router = APIRouter(prefix="/forms", tags=["forms"])


def _active_form_by_slug_query(form_slug: str):
    return (
        select(FormDefinition)
        .where(
            FormDefinition.slug == form_slug,
            FormDefinition.status == "active",
        )
        .order_by(FormDefinition.created_at.asc())
        .limit(1)
    )


# ═══ FORM DEFINITIONS ═══════════════════════════════════════

@router.get("", response_model=list[FormResponse])
async def list_forms(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(FormDefinition).order_by(FormDefinition.created_at.desc())
    if status_filter:
        query = query.where(FormDefinition.status == status_filter)
    result = await db.execute(query)
    return [FormResponse.model_validate(f) for f in result.scalars().all()]


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(FormDefinition).where(FormDefinition.id == form_id))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return FormResponse.model_validate(form)


@router.post("", response_model=FormResponse, status_code=201)
async def create_form(
    body: FormCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])
    form = FormDefinition(
        org_id=org_id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        schema_json=body.schema_json,
        theme_json=body.theme_json,
        notify_emails=body.notify_emails,
        success_message=body.success_message,
        redirect_url=body.redirect_url,
        automation_id=body.automation_id,
    )
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return FormResponse.model_validate(form)


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: uuid.UUID,
    body: FormUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(FormDefinition).where(FormDefinition.id == form_id))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    await db.flush()
    await db.refresh(form)
    return FormResponse.model_validate(form)


@router.delete("/{form_id}", status_code=204)
async def delete_form(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(FormDefinition).where(FormDefinition.id == form_id))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    await db.delete(form)


# ═══ SUBMISSIONS (authenticated admin view) ══════════════════

@router.get("/{form_id}/submissions", response_model=PaginatedResponse)
async def list_submissions(
    form_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(FormSubmission).where(FormSubmission.form_id == form_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(FormSubmission.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    subs = result.scalars().all()

    return PaginatedResponse(
        items=[FormSubmissionResponse.model_validate(s) for s in subs],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


# ═══ PUBLIC FORM SUBMISSION ═════════════════════════════════


@router.get("/public/{form_slug}", response_model=PublicFormResponse)
async def get_public_form(
    form_slug: str,
    db: AsyncSession = Depends(get_db_public),
):
    """Public endpoint — no auth required. Returns render-safe form config."""
    result = await db.execute(_active_form_by_slug_query(form_slug))
    form = result.scalars().first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return PublicFormResponse.model_validate(form)


# MED-2: public submit endpoint is the classic spam / DoS vector. 20/hour
# per IP is generous for a legit visitor while stopping a scripted spammer
# from flooding a form with thousands of fake submissions and blowing up
# our notify_emails fan-out + automation_id trigger chain.
@router.post("/public/{form_slug}/submit", response_model=FormSubmissionResponse, status_code=201)
@limiter.limit("20/hour")
async def submit_form(
    form_slug: str,
    body: FormSubmissionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_public),
):
    """Public endpoint — no auth required. Accepts form data by slug.

    RLS is explicitly disabled on this session (see ``get_db_public``)
    because anonymous visitors have no auth context. All writes below
    are still scoped to ``form.org_id`` explicitly.
    """
    # Find form by slug. ``form_definitions`` has a UNIQUE (org_id, slug)
    # index, so it is technically possible for two orgs to register the
    # same slug. We accept the first match for an active form; a later
    # hardening pass should switch the public URL shape to include the
    # org identifier to eliminate ambiguity entirely.
    result = await db.execute(_active_form_by_slug_query(form_slug))
    form = result.scalars().first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    submission = FormSubmission(
        org_id=form.org_id,
        form_id=form.id,
        data=body.data,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(submission)

    # Increment submission count
    form.submission_count = (form.submission_count or 0) + 1

    # ── Match or create contact from submission data ──
    email = body.data.get("email") or body.data.get("Email")
    if email:
        from app.models.contact import Contact

        contact_result = await db.execute(
            select(Contact).where(
                Contact.org_id == form.org_id,
                Contact.email == email,
            )
        )
        contact = contact_result.scalar_one_or_none()

        if contact:
            # Update existing contact with any new data
            if body.data.get("full_name") or body.data.get("name"):
                contact.full_name = body.data.get("full_name") or body.data.get("name")
            contact.last_engaged_at = datetime.now(timezone.utc)
            contact.engagement_score = (contact.engagement_score or 0) + 5
            submission.contact_id = contact.id
        else:
            # Create new contact from form data
            contact = Contact(
                org_id=form.org_id,
                email=email,
                full_name=body.data.get("full_name") or body.data.get("name"),
                source=f"form:{form.slug}",
                tags=["form-submission"],
                subscribed=body.data.get("subscribe", True),
                metadata_={"form_id": str(form.id), "form_slug": form.slug},
            )
            db.add(contact)
            await db.flush()
            submission.contact_id = contact.id

    # ── Send notification emails ──
    if form.notify_emails:
        from html import escape as html_escape

        from app.services.queue_publisher import publish_email_notification

        # Build a summary of the submission. Every dynamic field is
        # ``html_escape``d because public form submitters control the keys
        # AND values — without escaping a field labeled ``subject`` with a
        # value of ``<script>...`` would inject markup into staff inboxes.
        # Humanize keys for readability ("full_name" → "Full Name").
        data_summary = "<br>".join(
            f"<b>{html_escape(str(k).replace('_', ' ').title())}:</b> "
            f"{html_escape(str(v))}"
            for k, v in body.data.items()
        )
        client_ip = (
            html_escape(request.client.host) if request.client else "unknown"
        )
        form_name = html_escape(form.name)
        form_slug = html_escape(form.slug)
        notification_html = f"""
        <h2>New {form_name} submission</h2>
        <p>A new submission landed on <b>{form_name}</b> (<code>{form_slug}</code>).</p>
        <hr>
        {data_summary}
        <hr>
        <p style="color:#666;font-size:12px;">
            IP: {client_ip}<br>
            Submitted at: {datetime.now(timezone.utc).strftime('%b %-d, %Y at %H:%M UTC')}
        </p>
        """
        for notify_email in form.notify_emails:
            await publish_email_notification(
                org_id=form.org_id,
                to=notify_email,
                subject=f"New submission: {form.name}",
                html_body=notification_html,
            )

    # ── Trigger automation if configured ──
    if form.automation_id:
        from app.services.queue_publisher import publish_automation_run

        await publish_automation_run(
            org_id=form.org_id,
            automation_id=form.automation_id,
            trigger_event="form_submission",
            trigger_data={
                "form_id": str(form.id),
                "form_slug": form.slug,
                "submission_id": str(submission.id) if submission.id else None,
                "contact_id": str(submission.contact_id) if submission.contact_id else None,
                "data": body.data,
            },
        )

    await db.flush()
    await db.refresh(submission)
    return FormSubmissionResponse.model_validate(submission)
