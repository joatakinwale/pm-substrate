"""Internal webhook receiver endpoints.

Called by the stevie-webhooks Cloudflare Worker after
it validates signatures and transforms payloads.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.integrations.aurinko import verify_webhook_signature
from app.integrations.aurinko.signatures import (
    SIGNATURE_HEADER,
    VALIDATION_TOKEN_HEADER,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/webhooks", tags=["internal"])


async def verify_webhook_secret(request: Request) -> None:
    """Verify the webhook was forwarded by our Worker.

    Uses the dedicated ``WEBHOOK_SECRET`` — NOT the general app
    ``SECRET_KEY`` — so a leak of either secret does not compromise the
    other. Rotate independently.
    """
    settings = get_settings()
    secret = request.headers.get("X-Webhook-Secret")
    if not secret or secret != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


# ═══ AURINKO WEBHOOK ═══════════════════════════════════════
#
# Aurinko fans out per-resource subscriptions (booking, calendar,
# contacts) to one notification URL. We hold a signing secret on the
# Aurinko application and verify the HMAC-SHA256 in the
# ``X-Aurinko-Signature`` header on every POST.
#
# When a subscription is first created, Aurinko sends a one-time URL
# verification: a POST carrying ``X-Aurinko-Request-Validation-Token``;
# we must echo the same token back in the response body within 5s. The
# handler does that BEFORE the signature check because there is no
# body to sign on a verification request.
#
# Standard payload shape (messages/calendar/contacts/tasks):
#   {"subscription": int, "resource": str, "accountId": int,
#    "payloads": [{"id": "...", "changeType": "created|updated|deleted"}, ...]}
#
# Booking payload shape:
#   {"subscription": int, "resource": "/booking/{id}",
#    "payloads": [{"bookingId": int, "calendarId": "...", "eventId": "..."}]}


@router.post("/aurinko")
async def aurinko_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Aurinko unified webhook events.

    Routed via the stevie-webhooks Worker (or direct from Aurinko if
    the Worker forwarder isn't deployed). Reads the raw body once for
    signature verification, then dispatches by resource. Always returns
    200 fast so Aurinko doesn't retry; heavier per-resource work runs
    in-line for now and will move to the queue producer when latency
    matters.
    """
    # 1. URL verification handshake. Aurinko sends an empty/short body
    # with a validation-token header on first subscription. Echo the
    # token back as plain text within 5 seconds.
    validation_token = request.headers.get(VALIDATION_TOKEN_HEADER)
    if validation_token:
        return Response(
            content=validation_token,
            media_type="text/plain",
            status_code=200,
        )

    raw_body = await request.body()
    signature = request.headers.get(SIGNATURE_HEADER)
    if not verify_webhook_signature(
        raw_body=raw_body, signature_header=signature
    ):
        logger.warning(
            "aurinko_webhook_signature_invalid signature_header=%s",
            (signature or "")[:24],
        )
        raise HTTPException(status_code=401, detail="Invalid Aurinko signature")

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        logger.warning("aurinko_webhook_invalid_json")
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    resource: str = body.get("resource", "")
    account_id: int | None = body.get("accountId")
    payloads: list[dict] = body.get("payloads") or []

    handler = _resolve_aurinko_handler(resource)
    if handler is None:
        logger.info(
            "aurinko_webhook_unhandled_resource resource=%s",
            resource,
        )
        return {"ok": True, "resource": resource, "processed": False}

    try:
        await handler(db=db, account_id=account_id, resource=resource, payloads=payloads)
    except Exception:  # noqa: BLE001
        # Log loudly but still return 200 so Aurinko doesn't disable the
        # subscription on a transient downstream blip. The handler is
        # responsible for being idempotent.
        logger.exception(
            "aurinko_webhook_handler_failed resource=%s account_id=%s",
            resource,
            account_id,
        )
        return {"ok": False, "resource": resource, "error": "handler_failed"}

    return {"ok": True, "resource": resource, "processed": True}


def _resolve_aurinko_handler(resource: str):
    """Pick the right per-resource handler from the resource path."""
    if resource.startswith("/booking/"):
        return _handle_aurinko_booking
    if resource.startswith("/calendars/") and resource.endswith("/events"):
        return _handle_aurinko_calendar
    if resource == "/contacts":
        return _handle_aurinko_contacts
    return None


async def _handle_aurinko_booking(
    *,
    db: AsyncSession,
    account_id: int | None,
    resource: str,
    payloads: list[dict],
) -> None:
    """Upsert ``bookings`` rows from booking-resource notifications.

    Each payload carries ``bookingId``, ``calendarId``, ``eventId``.
    We need the canonical booking row (start time, attendee, status)
    so we fetch it via the SDK using the connected account's token.
    """
    from app.integrations.aurinko import client as aurinko_client
    from app.models import (
        Booking,
        BookingProvider,
        BookingStatus,
        IntegrationAccount,
        Lead,
    )
    from app.services.booking_notifications import (
        send_booking_cancelled,
        send_booking_confirmation,
        send_booking_rescheduled,
    )
    from app.services.realtime import broadcast_booking_event

    if account_id is None:
        logger.warning("aurinko_booking_missing_account_id resource=%s", resource)
        return

    integration = (
        await db.execute(
            select(IntegrationAccount).where(
                IntegrationAccount.aurinko_account_id == account_id,
                IntegrationAccount.disconnected_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        logger.warning(
            "aurinko_booking_no_integration_account aurinko_account_id=%s",
            account_id,
        )
        return

    for payload in payloads:
        booking_id = payload.get("bookingId")
        if booking_id is None:
            continue
        # Fetch canonical booking detail from Aurinko.
        try:
            detail = await aurinko_client.account_request(
                "GET",
                f"/booking/{booking_id}",
                access_token=integration.aurinko_access_token,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "aurinko_booking_fetch_failed booking_id=%s", booking_id
            )
            continue

        external_event_id = str(detail.get("id") or detail.get("eventId") or booking_id)
        attendee = detail.get("attendee") or {}
        attendee_email = attendee.get("email") or detail.get("email")
        attendee_name = attendee.get("name") or detail.get("name")
        meeting_url = detail.get("meetingUrl") or detail.get("location")
        attendee_tz = attendee.get("timezone") or detail.get("timezone")
        scheduled_at = detail.get("startTime") or detail.get("start")
        duration_minutes = detail.get("durationMinutes") or detail.get("duration")
        status_raw = (detail.get("status") or "confirmed").lower()
        reschedule_token = detail.get("rescheduleToken")

        existing = (
            await db.execute(
                select(Booking).where(
                    Booking.external_event_id == external_event_id
                )
            )
        ).scalar_one_or_none()

        email_kind: str | None = None
        if status_raw in {"cancelled", "canceled"}:
            if existing is not None:
                existing.status = BookingStatus.CANCELLED.value
                email_kind = "cancelled"
                booking = existing
            else:
                # Cancellation for a booking we never saw — log and skip.
                logger.info(
                    "aurinko_booking_cancel_unknown external_event_id=%s",
                    external_event_id,
                )
                continue
        elif existing is not None:
            previous_scheduled_at = existing.scheduled_at
            if scheduled_at:
                existing.scheduled_at = scheduled_at
            existing.status = BookingStatus.CONFIRMED.value
            if attendee_name:
                existing.attendee_name = attendee_name
            if attendee_email:
                existing.attendee_email = attendee_email
            if meeting_url:
                existing.meeting_url = meeting_url
            if attendee_tz:
                existing.timezone = attendee_tz
            if reschedule_token:
                existing.reschedule_token = reschedule_token
            if (
                scheduled_at is not None
                and previous_scheduled_at is not None
                and existing.scheduled_at != previous_scheduled_at
            ):
                # A reschedule resets the reminder window — see cron.py.
                existing.reminder_sent_at = None
                email_kind = "rescheduled"
            else:
                email_kind = "confirmation"
            booking = existing
        else:
            lead = None
            if attendee_email:
                lead = (
                    await db.execute(
                        select(Lead).where(
                            Lead.org_id == integration.org_id,
                            Lead.email == attendee_email,
                        )
                    )
                ).scalar_one_or_none()
            booking = Booking(
                org_id=integration.org_id,
                provider=BookingProvider.AURINKO.value,
                external_event_id=external_event_id,
                external_booking_uid=str(booking_id),
                aurinko_profile_id=detail.get("profileId"),
                integration_account_id=integration.id,
                reschedule_token=reschedule_token,
                event_type=detail.get("subject"),
                scheduled_at=scheduled_at,
                duration_minutes=duration_minutes or 30,
                attendee_name=attendee_name,
                attendee_email=attendee_email,
                meeting_url=meeting_url,
                timezone=attendee_tz,
                status=BookingStatus.CONFIRMED.value,
                lead_id=lead.id if lead else None,
                external_payload=detail,
            )
            db.add(booking)
            email_kind = "confirmation"

        await db.flush()
        if email_kind is not None:
            dispatch = {
                "confirmation": send_booking_confirmation,
                "rescheduled": send_booking_rescheduled,
                "cancelled": send_booking_cancelled,
            }[email_kind]
            await dispatch(db, booking)
            action = {
                "confirmation": "created",
                "rescheduled": "rescheduled",
                "cancelled": "cancelled",
            }[email_kind]
            await broadcast_booking_event(
                booking.org_id,
                booking.id,
                action,
                {
                    "status": booking.status,
                    "scheduled_at": booking.scheduled_at.isoformat()
                    if booking.scheduled_at
                    else None,
                    "attendee_name": booking.attendee_name,
                    "attendee_email": booking.attendee_email,
                    "event_type": booking.event_type,
                    "lead_id": str(booking.lead_id) if booking.lead_id else None,
                },
            )


async def _handle_aurinko_calendar(
    *,
    db: AsyncSession,
    account_id: int | None,
    resource: str,
    payloads: list[dict],
) -> None:
    """Apply calendar-event change notifications to the local cache.

    For now we only fetch + upsert ``created`` and ``updated`` events
    and delete on ``deleted``. The slot picker and admin "external
    events" indicator both consume this table.
    """
    from app.integrations.aurinko import client as aurinko_client
    from app.models import CalendarEvent, IntegrationAccount

    if account_id is None:
        return
    integration = (
        await db.execute(
            select(IntegrationAccount).where(
                IntegrationAccount.aurinko_account_id == account_id,
                IntegrationAccount.disconnected_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        return

    # Resource format: ``/calendars/{calId}/events`` — extract calId.
    parts = resource.strip("/").split("/")
    calendar_id = parts[1] if len(parts) >= 3 else "primary"

    for change in payloads:
        change_type = change.get("changeType")
        event_id = change.get("id")
        if not event_id:
            continue
        if change_type == "deleted":
            await db.execute(
                CalendarEvent.__table__.delete().where(
                    CalendarEvent.integration_account_id == integration.id,
                    CalendarEvent.aurinko_event_id == event_id,
                )
            )
            continue
        try:
            detail = await aurinko_client.account_request(
                "GET",
                f"/calendars/{calendar_id}/events/{event_id}",
                access_token=integration.aurinko_access_token,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "aurinko_calendar_fetch_failed event_id=%s", event_id
            )
            continue
        existing = (
            await db.execute(
                select(CalendarEvent).where(
                    CalendarEvent.integration_account_id == integration.id,
                    CalendarEvent.aurinko_event_id == event_id,
                )
            )
        ).scalar_one_or_none()
        target = existing or CalendarEvent(
            org_id=integration.org_id,
            integration_account_id=integration.id,
            aurinko_event_id=event_id,
            calendar_id=calendar_id,
        )
        target.start_at = detail.get("startTime") or detail.get("start")
        target.end_at = detail.get("endTime") or detail.get("end")
        target.title = detail.get("subject") or detail.get("title")
        target.status = detail.get("status")
        target.attendees = detail.get("attendees") or []
        target.raw_payload = detail
        if existing is None:
            db.add(target)

    integration.last_calendar_sync_at = datetime.now(timezone.utc)


async def _handle_aurinko_contacts(
    *,
    db: AsyncSession,
    account_id: int | None,
    resource: str,
    payloads: list[dict],
) -> None:
    """Apply contact change notifications to the contact_syncs cache."""
    from app.integrations.aurinko import client as aurinko_client
    from app.models import ContactSync, IntegrationAccount, Lead

    if account_id is None:
        return
    integration = (
        await db.execute(
            select(IntegrationAccount).where(
                IntegrationAccount.aurinko_account_id == account_id,
                IntegrationAccount.disconnected_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        return

    for change in payloads:
        change_type = change.get("changeType")
        contact_id = change.get("id")
        if not contact_id:
            continue
        if change_type == "deleted":
            await db.execute(
                ContactSync.__table__.delete().where(
                    ContactSync.integration_account_id == integration.id,
                    ContactSync.aurinko_contact_id == contact_id,
                )
            )
            continue
        try:
            detail = await aurinko_client.account_request(
                "GET",
                f"/contacts/{contact_id}",
                access_token=integration.aurinko_access_token,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "aurinko_contact_fetch_failed contact_id=%s", contact_id
            )
            continue
        emails = detail.get("emailAddresses") or []
        primary_email = (
            emails[0].get("address")
            if emails and isinstance(emails[0], dict)
            else None
        )
        full_name = detail.get("displayName") or detail.get("name")
        # Soft-link to existing Lead by email.
        lead_id = None
        if primary_email:
            lead = (
                await db.execute(
                    select(Lead).where(
                        Lead.org_id == integration.org_id,
                        Lead.email == primary_email,
                    )
                )
            ).scalar_one_or_none()
            lead_id = lead.id if lead else None
        existing = (
            await db.execute(
                select(ContactSync).where(
                    ContactSync.integration_account_id == integration.id,
                    ContactSync.aurinko_contact_id == contact_id,
                )
            )
        ).scalar_one_or_none()
        target = existing or ContactSync(
            org_id=integration.org_id,
            integration_account_id=integration.id,
            aurinko_contact_id=contact_id,
        )
        target.email = primary_email
        target.full_name = full_name
        target.lead_id = lead_id
        target.data = detail
        target.updated_at_provider = detail.get("updatedAt")
        if existing is None:
            db.add(target)

    integration.last_contacts_sync_at = datetime.now(timezone.utc)


@router.post("/stream-ready")
async def stream_ready_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_webhook_secret),
):
    """Handle Cloudflare Stream video ready notification.

    Updates the media asset with duration, thumbnail, etc.
    """
    from app.models import MediaAsset

    body = await request.json()
    stream_uid = body.get("uid")
    if not stream_uid:
        return {"ok": False, "error": "Missing stream UID"}

    result = await db.execute(
        select(MediaAsset).where(MediaAsset.cf_stream_uid == stream_uid)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        return {"ok": False, "error": "Asset not found for stream UID"}

    asset.duration_seconds = body.get("duration")
    asset.width = body.get("input", {}).get("width")
    asset.height = body.get("input", {}).get("height")
    asset.file_size = body.get("size")

    from app.services.cloudflare import get_stream_client
    stream = get_stream_client()
    asset.thumbnail_url = stream.thumbnail_url(stream_uid)

    return {"ok": True, "asset_id": str(asset.id)}


# ═══ RESEND WEBHOOKS ═══════════════════════════════════════
#
# Resend signs webhooks with Svix (HMAC-SHA256 over
# ``svix-id + "." + svix-timestamp + "." + body``). The ``stevie-webhooks``
# Worker validates that signature at the edge against
# ``RESEND_WEBHOOK_SECRET`` and, on success, re-POSTs the JSON payload
# here with our shared ``X-Webhook-Secret`` header. Keeping signature
# verification in the Worker means the origin never sees the Svix
# timing-attack surface and we don't pull a Svix library into the FastAPI
# process. If the architecture ever flips (direct Resend → FastAPI with
# no Worker), add the Svix check inside this handler instead of here.
#
# Resend event catalog (docs.resend.com/dashboard/webhooks):
#
#   email.sent             provider accepted the send (also set at
#                          dispatch time, so we ignore the webhook)
#   email.delivered        recipient MTA accepted — informational, we
#                          don't aggregate it so we also ignore it
#   email.delivery_delayed transient — log-only, don't flip any state
#   email.opened           → generic "open"
#   email.clicked          → generic "click"
#   email.bounced          → generic "bounce"
#   email.complained       → generic "unsubscribe" (reputation-ding, so we
#                          treat it like an explicit unsubscribe: stop
#                          mailing this contact and count it against the
#                          campaign's unsubscribed total)
#
# ``process_email_event`` is intentionally provider-agnostic — if we ever
# swap Resend for a different provider, only this translation map needs
# to change.
_RESEND_EVENT_MAP: dict[str, str] = {
    "email.opened": "open",
    "email.clicked": "click",
    "email.bounced": "bounce",
    "email.complained": "unsubscribe",
}

# Events we acknowledge with 200 but intentionally do not process. They
# still count as "handled" — we just don't translate them to an
# aggregate-mutating event. Any event type not in either set is logged
# and dropped (still 200, so Resend doesn't retry forever).
_RESEND_EVENTS_IGNORED: frozenset[str] = frozenset({
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
})


@router.post("/resend")
async def resend_webhook(
    request: Request,
    _: None = Depends(verify_webhook_secret),
):
    """Handle Resend email webhook events (open, click, bounce, complaint).

    Expected payload shape (Resend docs, 2026):

        {
          "type": "email.opened",
          "created_at": "2026-04-20T12:34:56.000Z",
          "data": {
            "email_id": "4ef9a417-...",   // this is what we stored in
                                           // EmailSend.ses_message_id
            "from": "...",
            "to": ["..."],
            "subject": "...",
            // event-specific fields (click URL, bounce reason, etc.)
          }
        }

    We translate the Resend event type into a generic one and apply the
    DB writes inline by calling ``record_email_event`` in
    ``app/api/internal/email.py``. That handler is idempotent (MED-3), so
    a duplicate delivery from Resend — or a retry from the Worker — will
    not double-count the campaign aggregate.

    Always returns 200 unless the shared secret is wrong (handled by the
    dependency) or the payload is unparseable. Resend retries on non-2xx
    for ~72h; we'd rather log-and-drop a malformed event than let Resend
    hammer us.
    """
    try:
        body = await request.json()
    except Exception as e:  # noqa: BLE001 — any parse failure is fatal for this request
        logger.warning("Resend webhook: could not parse JSON body: %s", e)
        # 400 so the Worker can surface the error in its own logs. A
        # correctly-signed but non-JSON payload is a Resend bug, not a
        # retry-worthy transient failure.
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = body.get("type", "")
    data = body.get("data") or {}
    message_id = data.get("email_id", "")

    if not event_type:
        logger.warning("Resend webhook: missing 'type' field, body keys=%s", list(body.keys()))
        return {"ok": False, "error": "Missing event type"}

    if event_type in _RESEND_EVENTS_IGNORED:
        # Not an error — we just don't care about these. Still log at
        # debug so we can confirm delivery flow end-to-end when tracing.
        logger.debug("Resend webhook: ignoring %s for message_id=%s", event_type, message_id)
        return {"ok": True, "event": event_type, "processed": False}

    generic_type = _RESEND_EVENT_MAP.get(event_type)
    if generic_type is None:
        # Unknown event type — log loudly (so we notice if Resend adds
        # a new one) but 200 so Resend stops retrying.
        logger.warning("Resend webhook: unknown event type=%s message_id=%s", event_type, message_id)
        return {"ok": True, "event": event_type, "processed": False}

    if not message_id:
        logger.warning("Resend webhook: missing data.email_id for %s", event_type)
        return {"ok": False, "error": "Missing email_id"}

    # Metadata we want available downstream for specific event types.
    metadata: dict = {"resend_event": event_type}
    if generic_type == "click":
        click_url = data.get("click", {}).get("link") if isinstance(data.get("click"), dict) else None
        if click_url:
            metadata["url"] = click_url
    elif generic_type == "bounce":
        # Resend nests bounce detail under "bounce"; the specific shape
        # is ``{"type": "hard"|"soft"|"suppressed", "subType": "..."}``.
        bounce_info = data.get("bounce") if isinstance(data.get("bounce"), dict) else None
        if bounce_info:
            metadata["reason"] = bounce_info.get("subType") or bounce_info.get("type") or "unknown"

    # Cutover gate (Path B+): once Resend's dashboard webhook URL has been
    # repointed at agents/workers/email-events, this legacy handler should
    # not double-process. Flip ``cf_workers_handle_webhooks=True`` after
    # the dashboard repoint.
    if get_settings().cf_workers_handle_webhooks:
        logger.info(
            "Resend webhook bypassed legacy dispatch (cf_workers_handle_webhooks=True); "
            "event=%s→%s message_id=%s — the email-events Worker is the canonical receiver.",
            event_type, generic_type, message_id,
        )
        return {
            "ok": True,
            "event": event_type,
            "generic_type": generic_type,
            "message_id": message_id,
            "bypassed": True,
        }

    # Legacy in-process path: this handler used to dispatch to a
    # background task. Background processing has moved to the
    # email-events Cloudflare Worker, which posts to
    # ``/internal/email/events`` to do the DB writes. The Resend
    # dashboard webhook URL should be repointed at that Worker; until
    # then, this endpoint logs the event and returns 200 (we don't
    # duplicate the bootstrap org-id lookup that ``record_email_event``
    # already implements).
    logger.warning(
        "Resend webhook arrived at legacy /internal/webhooks/resend; "
        "background dispatch was removed during the CF Queues migration. "
        "Repoint Resend's dashboard webhook URL at the email-events Worker. "
        "event=%s->%s message_id=%s metadata=%s",
        event_type, generic_type, message_id, metadata,
    )

    return {
        "ok": True,
        "event": event_type,
        "generic_type": generic_type,
        "message_id": message_id,
        "legacy_logged": True,
    }
