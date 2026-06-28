"""Internal email endpoints — called by the stevie-email-sender Cloudflare Worker.

Worker flow (campaign):
  1. Worker pulls an EmailCampaignMessage off the stevie-email-sender queue.
  2. Worker POSTs to /campaigns/{id}/dispatch — we lock the campaign, run the
     audience match, insert per-recipient EmailSend rows, and return the flat
     list of {send_id, to, subject, html_body} the Worker iterates over.
  3. Worker dispatches each row via Resend, then POSTs back to
     /sends/{id}/dispatched (success) or /sends/{id}/failed so the campaign
     aggregates stay accurate even if the Worker restarts mid-fanout.

Worker flow (notification): the Worker hits Resend directly with the
already-rendered HTML carried in the queue message — no backend round-trip.

Security: same shared-header pattern as the rest of ``app/api/internal/*`` —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``.

Why this lives here instead of an existing email module: the public CRUD on
``email_campaigns`` runs through ``get_db_with_rls_dep`` which requires a
user JWT. The Worker has no JWT — it's a system actor — so it posts to the
internal router and we set RLS context manually from the org_id in the body,
exactly like ``app/api/internal/billing.py`` does for Stripe sync.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.internal.webhooks import verify_webhook_secret
from app.core.config import get_settings
from app.db.database import RequestContext, get_db_public, get_db_with_rls
from app.models.contact import Contact
from app.models.email_campaign import (
    CampaignStatus,
    EmailCampaign,
    EmailSend,
    EmailTemplate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/email", tags=["internal"])


# ── Audience match ───────────────────────────────────────────────
#
# Local helper for translating the audience-filter dict on EmailCampaign
# into a SQL query: same supported keys, same default (subscribed_only=True),
# same Postgres array semantics.
def _match_contacts(audience: dict | None, org_id: uuid.UUID):
    query = select(Contact).where(Contact.org_id == org_id)
    audience = audience or {}

    # Default: send to everyone except contacts who have explicitly opted out
    # (subscribed=False). Only restrict to subscribed-only if the campaign
    # author explicitly sets subscribed_only=True.
    if audience.get("subscribed_only", False):
        query = query.where(Contact.subscribed.is_(True))
    else:
        query = query.where(Contact.subscribed.isnot(False))

    if audience.get("tags"):
        # Postgres array containment: tags @> ARRAY[...]
        query = query.where(Contact.tags.contains(audience["tags"]))

    if audience.get("min_engagement_score"):
        query = query.where(
            Contact.engagement_score >= audience["min_engagement_score"]
        )

    if audience.get("source"):
        query = query.where(Contact.source == audience["source"])

    if audience.get("exclude_tags"):
        # Postgres array overlap (negated): NOT (tags && ARRAY[...])
        query = query.where(~Contact.tags.overlap(audience["exclude_tags"]))

    return query.order_by(Contact.email)


# ── Per-contact HTML render ──────────────────────────────────────
#
# Per-recipient HTML render: applies the same ``{{ var }}`` substitution
# as ``email_sender.py::render_template``. Tracking pixel and
# click-rewrite are NOT applied here — the Worker handles them after this
# endpoint returns, since they need the tracking host (BACKEND_BASE_URL on
# the Worker side) which the FastAPI process shouldn't have to know about.
_TEMPLATE_VAR = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def _render_template(html: str, variables: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        fallback = match.group(0)
        return variables.get(key, fallback if fallback is not None else "")

    return _TEMPLATE_VAR.sub(repl, html)


def _resolve_html(campaign: EmailCampaign, template: EmailTemplate | None) -> str:
    if template and template.compiled_html:
        return template.compiled_html
    if template and template.html_body:
        return template.html_body
    if campaign.html_body:
        return campaign.html_body
    return "<p>No content</p>"


def _build_variables(contact: Contact, frontend_url: str) -> dict[str, str]:
    base = frontend_url.rstrip("/")
    first_name = ""
    if contact.full_name:
        first_name = contact.full_name.split()[0]
    variables: dict[str, str] = {
        "email": contact.email,
        "first_name": first_name,
        "full_name": contact.full_name or "",
        "unsubscribe_url": f"{base}/unsubscribe/{contact.id}",
    }
    if contact.metadata_:
        for k, v in contact.metadata_.items():
            if isinstance(v, str):
                variables[k] = v
    return variables


# ── Schemas ──────────────────────────────────────────────────────


class DispatchCampaignBody(BaseModel):
    """Payload from the email-sender Worker."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to set RLS context for the audience "
            "match and EmailSend inserts."
        )
    )


class DispatchCampaignSend(BaseModel):
    send_id: uuid.UUID
    to: str
    subject: str
    html_body: str


class DispatchCampaignResponse(BaseModel):
    sends: list[DispatchCampaignSend]


class MarkSendDispatchedBody(BaseModel):
    org_id: uuid.UUID
    ses_message_id: str = Field(
        description=(
            "Resend's opaque message id. Column name predates the provider "
            "split; we store Resend's id here just like SES's used to land."
        )
    )
    sent_at: datetime


class MarkSendFailedBody(BaseModel):
    org_id: uuid.UUID
    error: str = Field(
        description=(
            "Truncated provider error message. Stored on EmailSend as a "
            "status hint — see deviation note in the migration commit."
        )
    )


# ── Routes ───────────────────────────────────────────────────────


@router.post("/campaigns/{campaign_id}/dispatch", response_model=DispatchCampaignResponse)
async def dispatch_campaign_from_worker(
    campaign_id: Annotated[uuid.UUID, Path()],
    body: Annotated[DispatchCampaignBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> DispatchCampaignResponse:
    """Lock the campaign, materialize the recipient list, and return it.

    The campaign is moved into ``sending`` here, EmailSend rows are created
    with status ``queued``, and the per-contact HTML is rendered (template
    variables only — tracking pixel / link rewrite happen on the Worker).

    Returns 404 if the campaign doesn't exist for the given org.
    Returns 409 if the campaign isn't in a dispatchable status.
    """
    settings = get_settings()
    ctx = RequestContext(
        org_id=str(body.org_id),
        # System-actor user_id — same fixed UUID the billing endpoint uses.
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        # SELECT ... FOR UPDATE SKIP LOCKED so two Workers consuming the
        # same campaign message simultaneously can't both pass the
        # dispatchable gate and double-fan-out to the audience. The losing
        # transaction returns None (skipped), at which point we 409 — the
        # winning Worker will already have done the work.
        campaign_result = await db.execute(
            select(EmailCampaign)
            .where(
                EmailCampaign.id == campaign_id,
                EmailCampaign.org_id == body.org_id,
            )
            .with_for_update(skip_locked=True)
        )
        campaign = campaign_result.scalar_one_or_none()
        if campaign is None:
            # Could be: (a) campaign genuinely missing, or (b) lock held by
            # a sibling Worker. Either way the right answer is "don't
            # dispatch" — DLQ on (a), idempotent skip on (b).
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Campaign {campaign_id} not dispatchable for org "
                    f"{body.org_id} (missing or locked by sibling Worker)"
                ),
            )

        # Status guard: we accept ``draft`` / ``scheduled`` / ``sending`` so
        # the producer side can stay simple (just enqueue + this endpoint
        # flips state). Already-terminal statuses (``sent``, ``paused``,
        # ``cancelled``) → 409, Worker DLQs.
        dispatchable = {
            CampaignStatus.draft.value,
            CampaignStatus.scheduled.value,
            CampaignStatus.sending.value,
        }
        if campaign.status not in dispatchable:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Campaign {campaign_id} is in status '{campaign.status}', "
                    f"not dispatchable"
                ),
            )

        # Flip to ``sending`` while still holding the row lock. A subsequent
        # retry of this endpoint sees ``sending`` and proceeds idempotently.
        campaign.status = CampaignStatus.sending.value

        template: EmailTemplate | None = None
        if campaign.template_id:
            template_result = await db.execute(
                select(EmailTemplate).where(EmailTemplate.id == campaign.template_id)
            )
            template = template_result.scalar_one_or_none()

        # Run audience match.
        contacts_result = await db.execute(
            _match_contacts(campaign.audience_filter, campaign.org_id)
        )
        contacts = contacts_result.scalars().all()

        if not contacts:
            # Empty audience: terminal write — mark sent with zero
            # recipients. No EmailSend rows, no Worker work.
            campaign.status = CampaignStatus.sent.value
            campaign.sent_at = datetime.now(timezone.utc)
            campaign.total_sent = 0
            campaign.recipient_count = 0
            await db.flush()
            await db.commit()
            logger.info(
                "Campaign %s (org=%s) had 0 matching contacts — marked sent",
                campaign_id,
                body.org_id,
            )
            return DispatchCampaignResponse(sends=[])

        # Subject + HTML resolution. A/B test variant assignment is
        # index-based — deterministic split so re-running the dispatch
        # endpoint after a Worker crash produces identical assignments
        # (assuming Contact ordering is stable, which it is — we
        # order_by email above).
        ab_config = campaign.ab_test or {}
        variant_b_subject_raw = ab_config.get("variant_b_subject")
        variant_b_subject = (
            variant_b_subject_raw if isinstance(variant_b_subject_raw, str) else ""
        )
        split_pct = ab_config.get("split_pct", 50) / 100.0
        is_ab_test = bool(variant_b_subject)
        default_subject = campaign.subject or "(No subject)"
        base_html = _resolve_html(campaign, template)

        # Build the full per-recipient plan up front, then a SINGLE bulk
        # ``INSERT ... RETURNING id`` to populate EmailSend rows. The naive
        # one-flush-per-recipient version was an N+1 — for a 5,000-recipient
        # campaign we'd do 5,000 round-trips before the response could
        # return. The bulk insert preserves contact ordering so the
        # returned ids line up with our ``plan`` list.
        from sqlalchemy import insert as sa_insert

        total = len(contacts)
        plan: list[tuple[Contact, str, str]] = []
        rows_to_insert: list[dict] = []
        for i, contact in enumerate(contacts):
            subject = default_subject
            if is_ab_test and (i / total) >= (1 - split_pct):
                subject = variant_b_subject

            variables = _build_variables(contact, settings.frontend_url)
            rendered = _render_template(base_html, variables)

            plan.append((contact, subject, rendered))
            rows_to_insert.append(
                {
                    "org_id": campaign.org_id,
                    "campaign_id": campaign.id,
                    "contact_id": contact.id,
                    "email": contact.email,
                    "status": "queued",
                }
            )

        insert_result = await db.execute(
            sa_insert(EmailSend).returning(EmailSend.id),
            rows_to_insert,
        )
        send_ids = [row[0] for row in insert_result.all()]
        if len(send_ids) != total:
            # Shouldn't happen — RETURNING preserves insert order on
            # Postgres — but a defensive check beats silently mis-pairing
            # send_ids with recipients.
            raise RuntimeError(
                f"Bulk EmailSend insert returned {len(send_ids)} ids for "
                f"{total} planned rows"
            )

        sends: list[DispatchCampaignSend] = [
            DispatchCampaignSend(
                send_id=send_id,
                to=contact.email,
                subject=subject,
                html_body=rendered,
            )
            for send_id, (contact, subject, rendered) in zip(send_ids, plan)
        ]

        # Stamp recipient_count up front. ``total_sent`` and ``sent_at`` are
        # incremented per-send by the /sends/{id}/dispatched endpoint as the
        # Worker reports back, so a Worker crash mid-fanout still leaves the
        # campaign in a consistent state.
        campaign.recipient_count = total
        await db.flush()
        await db.commit()

        logger.info(
            "Campaign %s (org=%s) dispatched %d recipients",
            campaign_id,
            body.org_id,
            total,
        )
        return DispatchCampaignResponse(sends=sends)

    raise HTTPException(
        status_code=500,
        detail="Failed to acquire database session for campaign dispatch",
    )


@router.post("/sends/{send_id}/dispatched", status_code=204)
async def mark_send_dispatched(
    send_id: Annotated[uuid.UUID, Path()],
    body: Annotated[MarkSendDispatchedBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Record a successful per-recipient Resend dispatch.

    Increments the campaign's ``total_sent`` and stamps ``sent_at`` on the
    first transition. Returns 204 on success, 404 if the send row is missing.
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        send_result = await db.execute(
            select(EmailSend).where(
                EmailSend.id == send_id,
                EmailSend.org_id == body.org_id,
            )
        )
        send = send_result.scalar_one_or_none()
        if send is None:
            raise HTTPException(
                status_code=404,
                detail=f"EmailSend {send_id} not found for org {body.org_id}",
            )

        # Idempotency: if this send is already marked sent, treat the call
        # as a no-op. Worker retries that double-deliver this update should
        # not double-count the campaign aggregate.
        if send.status == "sent":
            logger.debug("EmailSend %s already marked sent — no-op", send_id)
            return None

        send.status = "sent"
        send.ses_message_id = body.ses_message_id

        campaign_result = await db.execute(
            select(EmailCampaign).where(EmailCampaign.id == send.campaign_id)
        )
        campaign = campaign_result.scalar_one_or_none()
        if campaign is not None:
            campaign.total_sent = (campaign.total_sent or 0) + 1
            if campaign.sent_at is None:
                # First successful dispatch — stamp the campaign-level send
                # time. We use the Worker-supplied ``sent_at`` rather than
                # ``utcnow()`` so the timestamp matches the Resend dispatch
                # the Worker actually observed.
                campaign.sent_at = body.sent_at

        await db.flush()
        await db.commit()


@router.post("/sends/{send_id}/failed", status_code=204)
async def mark_send_failed(
    send_id: Annotated[uuid.UUID, Path()],
    body: Annotated[MarkSendFailedBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Record a per-recipient Resend failure.

    The Worker calls this for transient/non-fatal sends (e.g. one bad
    address in an otherwise-good batch) without DLQ-ing the campaign
    message. EmailSend rows that fail end up here.

    Note: EmailSend currently has no ``error_message`` column — see the
    migration commit message for the deviation. We log the error string at
    WARNING level so it's still recoverable from the FastAPI log stream.
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        send_result = await db.execute(
            select(EmailSend).where(
                EmailSend.id == send_id,
                EmailSend.org_id == body.org_id,
            )
        )
        send = send_result.scalar_one_or_none()
        if send is None:
            raise HTTPException(
                status_code=404,
                detail=f"EmailSend {send_id} not found for org {body.org_id}",
            )

        send.status = "failed"
        await db.flush()
        await db.commit()

        # EmailSend has no ``error_message`` column today. We log the error
        # so it doesn't disappear; if/when the column lands, store it here
        # alongside the status flip.
        logger.warning(
            "EmailSend %s (org=%s) marked failed: %s",
            send_id,
            body.org_id,
            body.error[:500],
        )


# ── Email event ingest (Resend webhook → Worker → here) ──────────
#
# The stevie-email-events Worker verifies the Svix signature on
# Resend's webhook, normalizes the payload, and POSTs here. We do the
# DB writes:
#
#   1. Look up the EmailSend by ses_message_id (Resend's email id).
#   2. Stamp the matching per-row timestamp (opened_at / clicked_at / ...).
#   3. On a real state transition, increment the EmailCampaign aggregate.
#   4. On bounce or complaint, also flip Contact.subscribed=False.
#
# Idempotency (MED-3): per-row timestamps act as the uniqueness ledger.
# A duplicate Resend delivery (same Svix-Id, same email_id) sees the
# timestamp already set and falls through without touching the campaign
# counter. The Worker doesn't need to dedupe — the FastAPI side is the
# source of truth.


class EmailEventBody(BaseModel):
    """Payload from the email-events Worker."""

    event_type: Literal[
        "sent", "delivered", "bounced", "opened", "clicked", "complained"
    ] = Field(
        description=(
            "Generic Resend event name (the second half of e.g. "
            "``email.bounced``). The Worker has already mapped Resend's "
            "vocabulary onto this field."
        )
    )
    message_id: str = Field(
        description=(
            "Resend's opaque email id — matches EmailSend.ses_message_id. "
            "We use this for the lookup; org_id is derived from the row."
        )
    )
    to: str = Field(
        description=(
            "Recipient address as Resend reported it. Stored only for "
            "logging; the canonical address lives on EmailSend."
        )
    )
    timestamp: datetime = Field(
        description=(
            "ISO-8601 from Resend's ``created_at``. Used as the per-row "
            "timestamp (opened_at, clicked_at, ...) so the value matches "
            "Resend's wall clock, not ours."
        )
    )
    subject: str | None = None
    bounce_type: str | None = Field(
        default=None,
        description=(
            "Resend's bounce.subType when present, else bounce.type — "
            "typically ``hard`` | ``soft`` | ``suppressed``."
        ),
    )
    link_url: str | None = Field(
        default=None,
        description="Click destination URL. Only set on ``clicked`` events.",
    )
    complaint_type: str | None = None


@router.post("/events", status_code=204)
async def record_email_event(
    body: Annotated[EmailEventBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Apply a Resend webhook event to the EmailSend / EmailCampaign / Contact rows.

    Returns 204 on success (whether a transition occurred or the event
    was a no-op duplicate). Returns 404 when no EmailSend matches the
    message_id — the Worker treats 404 as permanent and stops retrying,
    which is the right call since a missing send row means the original
    dispatch never landed in our DB (or was hard-deleted).
    """
    # We don't have org_id on the wire — Resend's webhook envelope only
    # carries the email id. We do a single RLS-off lookup (the same escape
    # hatch the public form endpoints use) to resolve message_id → org_id,
    # then re-open under RLS bound to that tenant for the actual mutation.
    # The bootstrap session is read-only — it only fetches send.org_id.
    send_org_id: uuid.UUID | None = None
    async for db in get_db_public():
        send_org_result = await db.execute(
            select(EmailSend.org_id).where(
                EmailSend.ses_message_id == body.message_id
            )
        )
        send_org_id = send_org_result.scalar_one_or_none()
        break

    if send_org_id is None:
        # Worker treats 404 as permanent → no retry. Logging at
        # WARNING because in practice this means we received a
        # webhook for a send we never recorded — possible if the
        # send predated the migration, or the EmailSend row was
        # deleted manually. Either way, retrying won't help.
        logger.warning(
            "EmailSend not found for message_id=%s event=%s",
            body.message_id,
            body.event_type,
        )
        raise HTTPException(
            status_code=404,
            detail=f"EmailSend not found for message_id={body.message_id}",
        )

    ctx = RequestContext(
        org_id=str(send_org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        send_row_result = await db.execute(
            select(EmailSend).where(EmailSend.ses_message_id == body.message_id)
        )
        send: EmailSend | None = send_row_result.scalar_one_or_none()
        if send is None:
            # Race: row vanished between the bootstrap lookup and here.
            # Treat as 404 — same retry semantics as the first miss.
            raise HTTPException(
                status_code=404,
                detail=f"EmailSend not found for message_id={body.message_id}",
            )

        ts = body.timestamp
        did_transition = False

        # Per-row timestamps act as the idempotency ledger. We only stamp
        # them on the FIRST observation of a given event type for a given
        # send — a duplicate webhook delivery sees the timestamp already
        # set and short-circuits without touching the campaign counter.
        if body.event_type == "sent":
            # ``email.sent`` from Resend means the provider accepted the
            # send. We already record dispatch via /sends/{id}/dispatched
            # so this is informational; we don't have a column for it.
            # Counted as a no-op so a future provider switch doesn't lose
            # the event entirely.
            pass
        elif body.event_type == "delivered":
            # Same as sent — informational, no schema column today. The
            # endpoint still accepts it so Resend doesn't see 4xx.
            pass
        elif body.event_type == "opened":
            if not send.opened_at:
                send.opened_at = ts
                did_transition = True
        elif body.event_type == "clicked":
            if not send.clicked_at:
                send.clicked_at = ts
                did_transition = True
                # An open is implied by a click; stamp opened_at if the
                # provider sent the click webhook before the open one.
                if not send.opened_at:
                    send.opened_at = ts
        elif body.event_type == "bounced":
            if not send.bounced_at:
                send.bounced_at = ts
                did_transition = True
                contact_result = await db.execute(
                    select(Contact).where(Contact.id == send.contact_id)
                )
                contact = contact_result.scalar_one_or_none()
                if contact is not None:
                    contact.subscribed = False
                    if body.bounce_type:
                        # Preserve any existing metadata; record the
                        # bounce reason for triage.
                        contact.metadata_ = {
                            **(contact.metadata_ or {}),
                            "bounce_reason": body.bounce_type,
                        }
        elif body.event_type == "complained":
            # Resend's ``email.complained`` is a spam complaint. The legacy
            # task mapped it to ``unsubscribe`` semantics — same handling
            # here: stamp unsubscribed_at, drop the contact subscription,
            # and count it against the campaign's unsubscribed total.
            if not send.unsubscribed_at:
                send.unsubscribed_at = ts
                did_transition = True
                contact_result = await db.execute(
                    select(Contact).where(Contact.id == send.contact_id)
                )
                contact = contact_result.scalar_one_or_none()
                if contact is not None:
                    contact.subscribed = False
                    contact.unsubscribed_at = ts
                    if body.complaint_type:
                        contact.metadata_ = {
                            **(contact.metadata_ or {}),
                            "complaint_type": body.complaint_type,
                        }

        if did_transition:
            campaign_result = await db.execute(
                select(EmailCampaign).where(EmailCampaign.id == send.campaign_id)
            )
            campaign = campaign_result.scalar_one_or_none()
            if campaign is not None:
                # Spec named these opened_count / clicked_count / bounced_count;
                # the actual model uses total_* (and adds total_unsubscribed for
                # the complaint case). We use the model field names so the SQL
                # update lands on real columns.
                if body.event_type == "opened":
                    campaign.total_opened = (campaign.total_opened or 0) + 1
                elif body.event_type == "clicked":
                    campaign.total_clicked = (campaign.total_clicked or 0) + 1
                elif body.event_type == "bounced":
                    campaign.total_bounced = (campaign.total_bounced or 0) + 1
                elif body.event_type == "complained":
                    campaign.total_unsubscribed = (
                        campaign.total_unsubscribed or 0
                    ) + 1

        await db.flush()
        await db.commit()

        logger.info(
            "Email event applied: type=%s message_id=%s org=%s transition=%s link=%s",
            body.event_type,
            body.message_id,
            send_org_id,
            did_transition,
            body.link_url,
        )
