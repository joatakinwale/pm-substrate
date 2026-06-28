"""Booking email notifications — confirmation, reschedule, cancellation, reminder.

Called from the Aurinko webhook handler (``app.api.internal.webhooks.aurinko_webhook``)
on state transitions and from the booking-reminder cron
(``app.api.internal.cron.booking_reminders``). Every dispatch is best-effort —
a Resend outage must never rollback the booking write or the cron tick.

Voice + styling matches the rest of the transactional suite (see
``app.services.onboarding``): Stevie-Green CTA on ``#089140``, ``#5A6F51``
for the muted eyebrow row, and the same inline-CSS wrapper so every email
renders identically across clients.

Sender identity is the org default (``settings.resend_from_email``). We
intentionally do NOT pull a per-org override here — bookings are a shared
brand touch (the same address the attendee already saw on the calendar
invite), and we don't want the confirmation to arrive from an unfamiliar
per-tenant address.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from html import escape as html_escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Booking, Organization
from app.services.email_sender import send_transactional_email

logger = logging.getLogger(__name__)

# Brand constants (mirrored from app.services.onboarding so this module
# stays self-contained — a change to the brand palette touches both).
_STEVIE_GREEN = "#089140"
_STEVIE_MUTED = "#5A6F51"
_EMAIL_FONT = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, sans-serif"
)


# ── rendering helpers ─────────────────────────────────────────────

def _wrap(html_inner: str, *, eyebrow: str | None = None) -> str:
    """Standard Stevie Social email container."""
    eyebrow_html = ""
    if eyebrow:
        eyebrow_html = (
            f'<div style="color:{_STEVIE_MUTED};font-size:12px;'
            f'letter-spacing:.12em;text-transform:uppercase;'
            f'margin-bottom:16px;">{html_escape(eyebrow)}</div>'
        )
    return (
        f'<div style="font-family:{_EMAIL_FONT};color:#000000;'
        f'font-size:16px;line-height:1.55;max-width:560px;">'
        f"{eyebrow_html}{html_inner}"
        f"</div>"
    )


def _render_cta(label: str, url: str) -> str:
    return (
        f'<p style="margin:28px 0;">'
        f'<a href="{html_escape(url)}" '
        f'style="background:{_STEVIE_GREEN};color:#ffffff;'
        f'padding:14px 24px;text-decoration:none;border-radius:6px;'
        f'display:inline-block;font-weight:600;font-family:{_EMAIL_FONT};'
        f'font-size:15px;">{html_escape(label)}</a></p>'
    )


def _format_when(scheduled_at: datetime, tz_name: str | None) -> str:
    """Render a human-friendly timestamp line.

    Aurinko payloads include the attendee's timezone; we keep rendering in
    UTC because the MDA's own client will relocalize it, but we mention
    the attendee's tz below the stamp so there's no ambiguity.
    """
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    formatted = scheduled_at.astimezone(timezone.utc).strftime(
        "%A, %B %-d, %Y at %-I:%M %p UTC"
    )
    if tz_name and tz_name.lower() != "utc":
        formatted += f" (your tz: {html_escape(tz_name)})"
    return formatted


def _details_block(booking: Booking, *, org_name: str) -> str:
    """Shared 'the details' block — same rows across all four templates."""
    when_line = _format_when(booking.scheduled_at, booking.timezone)
    duration = f"{booking.duration_minutes or 30} minutes"
    rows = [
        ("With", org_name),
        ("When", when_line),
        ("Duration", duration),
    ]
    if booking.meeting_url:
        rows.append(("Where", booking.meeting_url))
    if booking.event_type:
        rows.append(("Type", booking.event_type.replace("_", " ").title()))

    cells = []
    for label, value in rows:
        cells.append(
            f'<tr>'
            f'<td style="padding:6px 16px 6px 0;color:{_STEVIE_MUTED};'
            f'font-size:14px;white-space:nowrap;vertical-align:top;">'
            f'{html_escape(label)}</td>'
            f'<td style="padding:6px 0;font-size:14px;color:#000000;">'
            f'{html_escape(value)}</td>'
            f'</tr>'
        )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'border="0" style="margin:20px 0;">'
        + "".join(cells)
        + '</table>'
    )


# ── dispatch helper ───────────────────────────────────────────────

async def _safe_send(
    *,
    to_email: str | None,
    subject: str,
    html_body: str,
    org_id,
    kind: str,
    booking_id,
) -> None:
    """Dispatch one booking email best-effort.

    Any exception is swallowed and logged — the caller (webhook handler or
    cron tick) must be able to continue even if Resend is down. The
    EmailSendResult.success=False branch is also logged but not raised.
    """
    if not to_email:
        logger.info(
            "Booking email skipped — no attendee email on booking_id=%s kind=%s",
            booking_id, kind,
        )
        return
    try:
        result = await send_transactional_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            org_id=org_id,
        )
        if not result.success:
            logger.warning(
                "Booking email provider error: kind=%s booking_id=%s err=%s",
                kind, booking_id, result.error,
            )
    except Exception as e:  # noqa: BLE001 — last-resort catch-all
        logger.exception(
            "Booking email unexpected failure: kind=%s booking_id=%s err=%s",
            kind, booking_id, str(e),
        )


async def _load_org_name(db: AsyncSession, org_id) -> str:
    """Best-effort org name lookup. Falls back to 'Stevie Social'."""
    try:
        row = await db.execute(
            select(Organization.name).where(Organization.id == org_id)
        )
        name = row.scalar_one_or_none()
        return name or "Stevie Social"
    except Exception:  # noqa: BLE001
        logger.exception("Booking email: org name lookup failed for %s", org_id)
        return "Stevie Social"


# ── public API ────────────────────────────────────────────────────

async def send_booking_confirmation(db: AsyncSession, booking: Booking) -> None:
    """Attendee sees this after a new Aurinko booking lands."""
    org_name = await _load_org_name(db, booking.org_id)
    name = html_escape(booking.attendee_name or "there")
    subject = f"You're booked with {org_name}"

    body_inner = (
        f"<p>Hi {name},</p>"
        f"<p>You're on the calendar with <b>{html_escape(org_name)}</b>. "
        f"Here are the details:</p>"
        + _details_block(booking, org_name=org_name)
    )
    if booking.meeting_url:
        body_inner += _render_cta("Join the call", booking.meeting_url)
    body_inner += (
        "<p>If anything changes on your end, reply to this email or use the "
        "reschedule link in your calendar invite — we'll see it either way.</p>"
        f"<p>— The {html_escape(org_name)} Team</p>"
    )

    await _safe_send(
        to_email=booking.attendee_email,
        subject=subject,
        html_body=_wrap(body_inner, eyebrow="Booking confirmed"),
        org_id=booking.org_id,
        kind="confirmation",
        booking_id=booking.id,
    )


async def send_booking_rescheduled(db: AsyncSession, booking: Booking) -> None:
    """Attendee sees this after a booking is rescheduled."""
    org_name = await _load_org_name(db, booking.org_id)
    name = html_escape(booking.attendee_name or "there")
    subject = f"Your time with {org_name} has moved"

    body_inner = (
        f"<p>Hi {name},</p>"
        f"<p>Your call with <b>{html_escape(org_name)}</b> was rescheduled. "
        f"Here's the updated time:</p>"
        + _details_block(booking, org_name=org_name)
    )
    if booking.meeting_url:
        body_inner += _render_cta("Join the call", booking.meeting_url)
    body_inner += (
        "<p>This new time is locked in. If it no longer works, reply to this "
        "email and we'll find another.</p>"
        f"<p>— The {html_escape(org_name)} Team</p>"
    )

    await _safe_send(
        to_email=booking.attendee_email,
        subject=subject,
        html_body=_wrap(body_inner, eyebrow="Booking rescheduled"),
        org_id=booking.org_id,
        kind="rescheduled",
        booking_id=booking.id,
    )


async def send_booking_cancelled(db: AsyncSession, booking: Booking) -> None:
    """Attendee sees this after a booking is cancelled."""
    org_name = await _load_org_name(db, booking.org_id)
    name = html_escape(booking.attendee_name or "there")
    subject = f"Your time with {org_name} was cancelled"

    body_inner = (
        f"<p>Hi {name},</p>"
        f"<p>Your call with <b>{html_escape(org_name)}</b> was cancelled. "
        f"The original details:</p>"
        + _details_block(booking, org_name=org_name)
        + "<p>If this was a mistake, reply and we'll get another time on "
        "the calendar. No hard feelings if it wasn't.</p>"
        f"<p>— The {html_escape(org_name)} Team</p>"
    )

    await _safe_send(
        to_email=booking.attendee_email,
        subject=subject,
        html_body=_wrap(body_inner, eyebrow="Booking cancelled"),
        org_id=booking.org_id,
        kind="cancelled",
        booking_id=booking.id,
    )


async def send_booking_reminder(db: AsyncSession, booking: Booking) -> None:
    """Attendee sees this 24h-ish before the scheduled time.

    Dispatched by the hourly ``/internal/cron/booking-reminders`` endpoint.
    Dedupe is the caller's responsibility — this function does not check
    or flip ``reminder_sent_at``.
    """
    org_name = await _load_org_name(db, booking.org_id)
    name = html_escape(booking.attendee_name or "there")
    subject = f"Reminder: you're meeting {org_name} tomorrow"

    body_inner = (
        f"<p>Hi {name},</p>"
        f"<p>Quick nudge — you're booked with "
        f"<b>{html_escape(org_name)}</b> tomorrow:</p>"
        + _details_block(booking, org_name=org_name)
    )
    if booking.meeting_url:
        body_inner += _render_cta("Join the call", booking.meeting_url)
    body_inner += (
        "<p>Looking forward to it. If something has come up, reply and we'll "
        "find a new time.</p>"
        f"<p>— The {html_escape(org_name)} Team</p>"
    )

    await _safe_send(
        to_email=booking.attendee_email,
        subject=subject,
        html_body=_wrap(body_inner, eyebrow="Reminder"),
        org_id=booking.org_id,
        kind="reminder",
        booking_id=booking.id,
    )
