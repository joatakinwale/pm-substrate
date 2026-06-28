"""Proposal → signed-cascade side-effects.

One place to wire everything that happens when a proposal transitions to
``signed``. Both the authenticated admin ``/sign`` endpoint and the public
``/public/{token}/sign`` endpoint funnel through ``run_sign_cascade`` so
the two paths can't drift out of sync again.

The cascade:
    1. Invoice — draft, 30-day net, line-item from proposal title/total
    2. ClientOnboarding — status=pending, tied to proposal + lead
    3. Project — status=active, tied to proposal + lead; named after client
    4. Lead.qualification_status → ``won`` (if lead linked)
    5. Onboarding welcome email (Resend via ``start_onboarding``) — best-effort
    6. Activity log — ``proposal_signed`` under the ``project`` category

Everything inside a single transaction (the caller commits/flushes). Email
sending is the one side-effect that happens *after* flush so the DB state
reflects the cascade before the provider sees a signed client. Email send
failures are logged but don't raise — agency can retry from the admin UI.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Activity,
    ClientOnboarding,
    Invoice,
    Lead,
    Project,
    ProjectStatus,
    Proposal,
)
from app.models.activity import ActivityCategory, ActivityType

logger = logging.getLogger(__name__)


async def run_sign_cascade(
    db: AsyncSession,
    proposal: Proposal,
    *,
    org_id: uuid.UUID,
    signer_name: str | None = None,
    signer_ip: str | None = None,
    signature_provider: str = "internal",
) -> dict:
    """Apply all post-signature side effects. Idempotent-ish — guards on
    ``generated_invoice_id``/``generated_project_id`` so re-entry after a
    partial failure doesn't duplicate rows.

    Returns a dict of the artifacts created, keyed by
    ``invoice_id`` / ``onboarding_id`` / ``project_id``. Useful for the
    caller to include in the response or to hand off to follow-up tasks
    (e.g. enqueue the welcome email after the transaction commits).
    """
    now = datetime.now(timezone.utc)
    agent_role = proposal.agent_role

    # Mark signed if not already — callers pass us a proposal in either
    # state (public endpoint flips it; admin endpoint does it inline
    # before calling us).
    if proposal.status != "signed":
        proposal.status = "signed"
    proposal.signed_at = proposal.signed_at or now
    proposal.signer_name = signer_name or proposal.signer_name or proposal.client_name
    if signer_ip:
        proposal.signer_ip = signer_ip
    proposal.signature_provider = proposal.signature_provider or signature_provider

    # ── Invoice ───────────────────────────────────────────────
    invoice_id = proposal.generated_invoice_id
    if invoice_id is None:
        invoice = Invoice(
            org_id=org_id,
            client_name=proposal.client_name,
            client_email=proposal.client_email,
            lead_id=proposal.lead_id,
            contact_id=proposal.contact_id,
            compound_phase=proposal.compound_phase,
            status="draft",
            currency=proposal.currency,
            subtotal_cents=proposal.total_cents,
            total_cents=proposal.total_cents,
            amount_due_cents=proposal.total_cents,
            description=f"Invoice for: {proposal.title}",
            agent_role=agent_role,
            due_date=now + timedelta(days=30),
            line_items=[{
                "description": proposal.title,
                "amount_cents": proposal.total_cents,
                "quantity": 1,
            }],
        )
        db.add(invoice)
        await db.flush()
        proposal.generated_invoice_id = invoice.id
        invoice_id = invoice.id

    # ── Onboarding ─────────────────────────────────────────────
    onboarding_existing = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.proposal_id == proposal.id)
    )
    onboarding = onboarding_existing.scalar_one_or_none()
    if onboarding is None:
        onboarding = ClientOnboarding(
            org_id=org_id,
            proposal_id=proposal.id,
            lead_id=proposal.lead_id,
            client_name=proposal.client_name,
            client_email=proposal.client_email,
            status="pending",
            agent_role=agent_role,
        )
        db.add(onboarding)
        await db.flush()

    # ── Project ────────────────────────────────────────────────
    project_id = proposal.generated_project_id
    if project_id is None:
        client_label = proposal.client_name or "New Client"
        project = Project(
            org_id=org_id,
            proposal_id=proposal.id,
            lead_id=proposal.lead_id,
            name=f"{client_label} — Compound Method",
            description=(
                f"Auto-created from signed proposal: {proposal.title}. "
                f"Phase: {proposal.compound_phase or 'protect'}."
            ),
            status=ProjectStatus.active.value,
            client_name=proposal.client_name,
            client_email=proposal.client_email,
            compound_phase=proposal.compound_phase,
            start_date=now,
            created_by_agent=agent_role,
            metadata_={
                "proposal_id": str(proposal.id),
                "onboarding_id": str(onboarding.id),
                "invoice_id": str(invoice_id) if invoice_id else None,
                "auto_created": True,
                "agent_role": agent_role,
                "source": "proposal_sign_cascade",
            },
        )
        db.add(project)
        await db.flush()
        proposal.generated_project_id = project.id
        project_id = project.id

    # ── Lead status → won ─────────────────────────────────────
    if proposal.lead_id:
        lead_res = await db.execute(select(Lead).where(Lead.id == proposal.lead_id))
        lead = lead_res.scalar_one_or_none()
        if lead and lead.qualification_status != "won":
            lead.qualification_status = "won"

    # ── Activity log ──────────────────────────────────────────
    try:
        activity = Activity(
            org_id=org_id,
            category=ActivityCategory.project.value,
            activity_type=ActivityType.proposal_signed.value,
            subject_type="proposal",
            subject_id=proposal.id,
            agent_role=agent_role,
            title=f"Proposal signed: {proposal.title}",
            description=(
                f"{proposal.client_name or 'Client'} signed — "
                f"project, invoice, and onboarding created automatically."
            ),
            is_system=True,
            is_client_visible=False,
            metadata_={
                "proposal_id": str(proposal.id),
                "project_id": str(project_id) if project_id else None,
                "invoice_id": str(invoice_id) if invoice_id else None,
                "onboarding_id": str(onboarding.id),
                "client_name": proposal.client_name,
                "total_cents": proposal.total_cents,
                "compound_phase": proposal.compound_phase,
                "agent_role": agent_role,
            },
        )
        db.add(activity)
    except Exception:
        # Activity log is best-effort; a bad column shouldn't rollback the
        # cascade. Surface loudly in logs so we spot it in dev.
        logger.exception("Failed to log proposal_signed activity for %s", proposal.id)

    await db.flush()

    # ── Realtime broadcasts ──────────────────────────────────
    # Fire after flush so the new rows are visible to other workers that
    # respond to the SSE event. Broadcast errors are swallowed inside the
    # helpers (Redis hiccup can't rollback signed state).
    try:
        from app.services.realtime import (
            broadcast_lead_event,
            broadcast_project_update,
        )
        await broadcast_project_update(
            org_id=org_id,
            project_id=project_id,
            action="created",
            project_data={
                "name": f"{proposal.client_name or 'New Client'} — Compound Method",
                "client_name": proposal.client_name,
                "compound_phase": proposal.compound_phase,
                "agent_role": agent_role,
                "source": "proposal_sign_cascade",
            },
        )
        if proposal.lead_id:
            await broadcast_lead_event(
                org_id=org_id,
                lead_id=proposal.lead_id,
                action="converted",
                lead_data={
                    "qualification_status": "won",
                    "client_name": proposal.client_name,
                    "proposal_id": str(proposal.id),
                },
            )
    except Exception:
        logger.exception(
            "Realtime broadcast failed for proposal_sign cascade %s", proposal.id,
        )

    return {
        "invoice_id": invoice_id,
        "onboarding_id": onboarding.id,
        "project_id": project_id,
    }


async def send_onboarding_welcome(
    db: AsyncSession,
    onboarding_id: uuid.UUID,
) -> None:
    """Fire the onboarding welcome email. Separated so callers can run
    this after the signing transaction commits — a failed email must not
    roll back the cascade.

    ``start_onboarding`` in ``app.services.onboarding`` already handles
    the actual Resend send and updates the onboarding record's status to
    ``intake_sent`` on success. We just wrap it so the router doesn't
    have to know about that module.
    """
    from app.services.onboarding import start_onboarding
    try:
        await start_onboarding(str(onboarding_id), db)
    except Exception:
        # Welcome email is best-effort — don't break the signing endpoint.
        # The agency can re-trigger from the admin UI.
        logger.exception("Welcome email send failed for onboarding %s", onboarding_id)
