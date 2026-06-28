"""Client onboarding service — orchestrates the post-signature sequence.

Onboarding flow:
1. Proposal signed → ClientOnboarding record created
2. Welcome email sent (via Resend) with intake form link
3. Client completes intake form → brand voice profile form sent
4. Client completes brand voice → strategy call scheduling link sent (Aurinko)
5. Strategy call completed → onboarding marked complete

Each step is triggered by the previous step's completion webhook/API call.
Dispatch is synchronous inside the FastAPI request lifecycle for now —
``send_transactional_email`` short-circuits to a log line in dev. When we
need to move outbound mail off the request path, route through
``app/services/queue_publisher.py::publish_email_notification`` so the
email-sender Cloudflare Worker handles delivery.
"""
import logging
from datetime import datetime, timezone
from html import escape as html_escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import ClientOnboarding
from app.services.email_sender import send_transactional_email

logger = logging.getLogger(__name__)

# URL-1: was `_APP_BASE_URL = "https://app.steviesocial.com"` — now pulled
# from settings so dev/staging/prod each send users at the right host, and
# so the codebase no longer references the legacy `steviesocial.com`
# domain (the current canonical is set by the FRONTEND_URL env var).
def _app_base_url() -> str:
    return get_settings().frontend_url.rstrip("/")

# Brand-aligned minimal inline-CSS block used by every onboarding email.
# Kept local (not shared with the dunning template) because onboarding
# copy is warmer/more conversational and has its own rhythm.
_STEVIE_GREEN = "#089140"
_EMAIL_FONT = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, sans-serif"
)


def _render_cta(label: str, url: str) -> str:
    """Stevie-Green CTA button. Safe for every major mail client."""
    return (
        f'<p style="margin:28px 0;">'
        f'<a href="{html_escape(url)}" '
        f'style="background:{_STEVIE_GREEN};color:#ffffff;'
        f'padding:14px 24px;text-decoration:none;border-radius:6px;'
        f'display:inline-block;font-weight:600;font-family:{_EMAIL_FONT};'
        f'font-size:15px;">{html_escape(label)}</a></p>'
    )


def _wrap(html_inner: str) -> str:
    """Wrap body HTML in the standard Stevie Social email container."""
    return (
        f'<div style="font-family:{_EMAIL_FONT};color:#000000;'
        f'font-size:16px;line-height:1.55;max-width:560px;">'
        f"{html_inner}"
        f"</div>"
    )


async def start_onboarding(
    onboarding_id: str,
    db: AsyncSession,
) -> None:
    """Send the welcome email and intake form link.

    Called after proposal signing cascade creates the onboarding record.
    """
    from uuid import UUID

    result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.id == UUID(onboarding_id))
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        logger.error("Onboarding %s not found", onboarding_id)
        return

    # ── Welcome email (Resend) ───────────────────────────────────
    # Voice: Confident, calm, inviting. We name the Compound Method by
    # name (the client just signed a proposal that talks about it), and
    # keep the ask to exactly one step — the intake form. Zero scolding,
    # zero "make sure you..." — this is a "glad you're here" note.
    name = html_escape(onboarding.client_name or "there")
    intake_url = (
        f"{_app_base_url()}/onboarding/{onboarding.share_token}/intake"
        if getattr(onboarding, "share_token", None)
        else f"{_app_base_url()}/onboarding/{onboarding.id}/intake"
    )
    subject = "Welcome to Stevie Social — let's get your intake started"
    html_body = _wrap(
        f"<p>Hi {name},</p>"
        "<p>Thanks for signing on with us. We're glad to be in this with you.</p>"
        "<p>First step of the Compound Method is getting clear on who you "
        "are and who you're for. The intake form below takes about 15 "
        "minutes and sets the foundation for everything that follows.</p>"
        + _render_cta("Start intake", intake_url)
        + "<p>Questions in the meantime? Just reply — we read every one.</p>"
        "<p>— The Stevie Social Team</p>"
    )
    result_send = await send_transactional_email(
        to_email=onboarding.client_email,
        subject=subject,
        html_body=html_body,
        org_id=onboarding.org_id,
    )
    if not result_send.success:
        # Log and continue — the status transition still happens because the
        # agency can re-trigger the email from the admin UI. Better UX than
        # leaving onboarding stuck at "signed" if the provider hiccups.
        logger.warning(
            "Welcome email send failed for onboarding %s: %s",
            onboarding_id, result_send.error,
        )
    else:
        logger.info(
            "[Onboarding] Welcome email queued for %s (%s) message_id=%s",
            onboarding.client_name, onboarding.client_email,
            result_send.message_id,
        )

    onboarding.status = "intake_sent"
    onboarding.intake_form_sent_at = datetime.now(timezone.utc)


async def advance_to_brand_voice(
    onboarding_id: str,
    db: AsyncSession,
) -> None:
    """After intake form is completed, send the brand voice profile form.

    Called by the intake form submission endpoint.
    """
    from uuid import UUID

    result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.id == UUID(onboarding_id))
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        return

    name = html_escape(onboarding.client_name or "there")
    brand_voice_url = (
        f"{_app_base_url()}/onboarding/{onboarding.share_token}/brand-voice"
        if getattr(onboarding, "share_token", None)
        else f"{_app_base_url()}/onboarding/{onboarding.id}/brand-voice"
    )
    subject = "Next up — let's capture your brand voice"
    html_body = _wrap(
        f"<p>Hi {name},</p>"
        "<p>Intake's in — thanks for the thoughtful answers.</p>"
        "<p>The next piece is your brand voice profile. This is how we "
        "make sure every post, caption, and comment sounds like you "
        "and not like a generic agency. Quick form, mostly picks and "
        "short answers.</p>"
        + _render_cta("Define brand voice", brand_voice_url)
        + "<p>— The Stevie Social Team</p>"
    )
    result_send = await send_transactional_email(
        to_email=onboarding.client_email,
        subject=subject,
        html_body=html_body,
        org_id=onboarding.org_id,
    )
    if not result_send.success:
        logger.warning(
            "Brand-voice email send failed for onboarding %s: %s",
            onboarding_id, result_send.error,
        )
    else:
        logger.info(
            "[Onboarding] Brand-voice email queued for %s (%s) message_id=%s",
            onboarding.client_name, onboarding.client_email,
            result_send.message_id,
        )

    onboarding.status = "brand_voice_sent"
    onboarding.brand_voice_sent_at = datetime.now(timezone.utc)


async def advance_to_strategy_call(
    onboarding_id: str,
    db: AsyncSession,
) -> None:
    """After brand voice profile is completed, send the strategy call link.

    Called by the brand voice form submission endpoint. The booking
    page is the org's Aurinko-backed ``/book/{org_slug}/{profile_slug}``;
    the per-tenant slug resolves at request time via
    ``GET /api/public/branding/{slug}``.
    """
    from uuid import UUID

    result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.id == UUID(onboarding_id))
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        return

    name = html_escape(onboarding.client_name or "there")
    # Until per-tenant profile selection lands in Phase 7 we route
    # through the marketing-side strategy-call slug. The frontend page
    # picks the org's default profile slug from the branding endpoint.
    booking_url = f"{_app_base_url()}/book/strategy-call?ref={onboarding.id}"
    subject = "Last step — book your Compound Method strategy call"
    html_body = _wrap(
        f"<p>Hi {name},</p>"
        "<p>Brand voice is locked in. The last step before we kick off "
        "is a 45-minute strategy call to walk you through your Protect "
        "phase plan and answer anything still on your mind.</p>"
        + _render_cta("Book strategy call", booking_url)
        + "<p>Pick whatever slot works — we keep these calls in our "
        "calendar specifically for new partners, so there's room.</p>"
        "<p>— The Stevie Social Team</p>"
    )
    result_send = await send_transactional_email(
        to_email=onboarding.client_email,
        subject=subject,
        html_body=html_body,
        org_id=onboarding.org_id,
    )
    if not result_send.success:
        logger.warning(
            "Strategy-call email send failed for onboarding %s: %s",
            onboarding_id, result_send.error,
        )
    else:
        logger.info(
            "[Onboarding] Strategy-call email queued for %s (%s) message_id=%s",
            onboarding.client_name, onboarding.client_email,
            result_send.message_id,
        )

    onboarding.status = "strategy_call_scheduled"
    onboarding.strategy_call_scheduled_at = datetime.now(timezone.utc)


async def complete_onboarding(
    onboarding_id: str,
    db: AsyncSession,
) -> None:
    """Mark onboarding as complete after strategy call is done.

    Called by the Aurinko booking webhook when the strategy call
    booking is completed.
    """
    from uuid import UUID

    result = await db.execute(
        select(ClientOnboarding).where(ClientOnboarding.id == UUID(onboarding_id))
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        return

    onboarding.status = "completed"
    onboarding.completed_at = datetime.now(timezone.utc)

    logger.info(
        "[Onboarding] Completed for %s (%s)",
        onboarding.client_name,
        onboarding.client_email,
    )


# ── Email templates (to be replaced with Resend integration) ──

ONBOARDING_EMAILS = {
    "welcome": {
        "subject": "Welcome to Stevie Social — Let's Get Started!",
        "preview": "Your Compound Method journey starts now.",
        "template": "onboarding_welcome",
    },
    "intake_form": {
        "subject": "Next Step: Tell Us About Your Brand",
        "preview": "Complete your intake form so we can build your strategy.",
        "template": "onboarding_intake",
    },
    "brand_voice": {
        "subject": "Almost There: Define Your Brand Voice",
        "preview": "Help us capture your unique tone and style.",
        "template": "onboarding_brand_voice",
    },
    "strategy_call": {
        "subject": "Final Step: Book Your Strategy Call",
        "preview": "Let's discuss your Compound Method plan.",
        "template": "onboarding_strategy_call",
    },
    "complete": {
        "subject": "You're All Set! Your Stevie Social Journey Begins",
        "preview": "Everything is ready. Here's what to expect.",
        "template": "onboarding_complete",
    },
}
