"""Email sending service — Resend for both transactional and marketing.

Single provider by design (user decision, 2026-04-20): both the
transactional flows (payment reminders, portal magic-links, onboarding,
proposals, notifications) and the marketing campaign fan-out routed
through the email-sender Cloudflare Worker call ``send_email_resend()``.
``send_transactional_email()`` is a thin wrapper kept for
intention-clarity at call sites.

If we ever need to split transactional and bulk onto different providers
again (e.g. to protect payment-reminder deliverability from a bad
campaign), it's a small surface change — the wrapper is the seam.

In development mode (no provider config), sends log instead of hitting the
Resend HTTP API and return a fake message id, so unit/integration tests
don't need network access.
"""
import logging
import re
import uuid
from datetime import datetime, timezone
from string import Template

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailSendResult:
    """Result of an email send attempt."""

    def __init__(
        self,
        success: bool,
        message_id: str | None = None,
        error: str | None = None,
    ):
        self.success = success
        self.message_id = message_id
        self.error = error


def render_template(html: str, variables: dict[str, str]) -> str:
    """Render template variables like {{first_name}} into HTML.

    Supports both {{variable}} and {{ variable }} syntax.
    Unknown variables are left as-is.
    """
    def replace_var(match: re.Match) -> str:
        key = match.group(1).strip()
        return variables.get(key, match.group(0))

    return re.sub(r"\{\{\s*(\w+)\s*\}\}", replace_var, html)


def add_tracking_pixel(html: str, send_id: str, base_url: str) -> str:
    """Inject an invisible tracking pixel before </body> for open tracking."""
    pixel = (
        f'<img src="{base_url}/api/tracking/open/{send_id}" '
        f'width="1" height="1" style="display:none" alt="" />'
    )
    if "</body>" in html.lower():
        return html.replace("</body>", f"{pixel}</body>")
    return html + pixel


def rewrite_links(html: str, send_id: str, base_url: str) -> str:
    """Rewrite <a href="..."> links to go through click tracker."""
    import urllib.parse

    def replace_link(match: re.Match) -> str:
        original_url = match.group(1)
        # Skip mailto: and tel: links, tracking pixel, unsubscribe links
        if original_url.startswith(("mailto:", "tel:", "#")):
            return match.group(0)
        encoded = urllib.parse.quote(original_url, safe="")
        return f'href="{base_url}/api/tracking/click/{send_id}?url={encoded}"'

    return re.sub(r'href="([^"]+)"', replace_link, html)


async def send_email_resend(
    to_email: str,
    subject: str,
    html_body: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
) -> EmailSendResult:
    """Send a single email via the Resend HTTP API.

    Endpoint: POST https://api.resend.com/emails
    Auth: ``Authorization: Bearer <resend_api_key>``

    Falls back to logging in development mode (or when Resend is not
    configured) so local runs and unit tests don't attempt network I/O.

    The ``EmailSend.ses_message_id`` column stores whatever opaque message
    id the provider hands back — the name predates this consolidation and
    is not load-bearing.
    """
    settings = get_settings()

    # Development / unconfigured short-circuit. We check ``resend_configured``
    # rather than just ``app_env`` so that staging (which IS ``production``
    # but intentionally has no Resend key) doesn't try to hit Resend with an
    # empty Bearer token and get a 401 on every transactional send.
    if settings.app_env == "development" or not settings.resend_configured:
        logger.info(
            "DEV EMAIL (resend) → to=%s subject='%s' from=%s (body: %d chars)",
            to_email, subject, from_email or settings.resend_from_email,
            len(html_body),
        )
        fake_id = f"dev-resend-{uuid.uuid4().hex[:16]}"
        return EmailSendResult(success=True, message_id=fake_id)

    # ``from`` must be a Resend-verified sender (domain or single email).
    # We let callers override per-message, but fall back to the org-wide
    # default. If both ``from_email`` and ``from_name`` are passed we build
    # the standard "Name <addr>" form; otherwise we just use the string
    # settings value (which already has that form baked in).
    if from_email:
        sender = f"{from_name} <{from_email}>" if from_name else from_email
    else:
        sender = settings.resend_from_email

    payload: dict = {
        "from": sender,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }
    # Resend accepts ``reply_to`` as a string or array of strings. We pass
    # a single string when the caller or the org default supplies one.
    effective_reply_to = reply_to or settings.resend_reply_to
    if effective_reply_to:
        payload["reply_to"] = effective_reply_to

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }

    try:
        # Explicit timeout: a hung Resend request should NOT block the
        # caller for minutes. 15s covers normal p99 with room for the
        # occasional TLS handshake stall.
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers=headers,
            )

        if response.status_code == 200:
            data = response.json()
            message_id = data.get("id", "")
            logger.info(
                "Resend email sent: to=%s message_id=%s",
                to_email, message_id,
            )
            return EmailSendResult(success=True, message_id=message_id)

        # Resend error responses are JSON: {"statusCode":..,"name":..,"message":..}
        # We stringify the whole body so validation errors (e.g. "from is
        # not a verified domain") surface in logs without swallowing them.
        try:
            err_body = response.json()
        except ValueError:
            err_body = {"text": response.text[:500]}
        logger.warning(
            "Resend send failed: to=%s status=%d body=%s",
            to_email, response.status_code, err_body,
        )
        err_msg = (
            err_body.get("message") if isinstance(err_body, dict) else None
        ) or f"HTTP {response.status_code}"
        return EmailSendResult(success=False, error=err_msg[:500])

    except httpx.RequestError as e:
        # Network-level failure (timeout, DNS, connection reset). We do
        # NOT retry here — the caller (typically a Cloudflare Worker via
        # the queue) owns retry semantics.
        logger.exception("Resend request error: to=%s error=%s", to_email, str(e))
        return EmailSendResult(success=False, error=str(e)[:500])
    except Exception as e:  # noqa: BLE001 — last-resort catch-all
        logger.exception("Resend unexpected error: to=%s error=%s", to_email, str(e))
        return EmailSendResult(success=False, error=str(e)[:500])


async def _load_org_email_overrides(
    org_id: uuid.UUID,
) -> tuple[str | None, str | None]:
    """Read ``email_from`` / ``email_reply_to`` off the org settings JSONB.

    Returns ``(from_addr, reply_to)`` — either may be None when the org
    hasn't customised it, in which case the caller falls back to the
    instance-wide ``settings.resend_from_email`` /
    ``settings.resend_reply_to`` defaults inside ``send_email_resend``.
    """
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import select, text
    from app.models import Organization

    async with AsyncSessionLocal() as session:
        # Read-only org lookup; bypass RLS since the caller may be a
        # Worker context with no auth header (transactional sends from
        # cron land here).
        await session.execute(text("SET LOCAL row_security = off"))
        result = await session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if org is None:
            return None, None
        settings_blob = dict(org.settings or {})
        from_addr = settings_blob.get("email_from") or None
        reply_to = settings_blob.get("email_reply_to") or None
        return (from_addr if isinstance(from_addr, str) else None,
                reply_to if isinstance(reply_to, str) else None)


async def send_transactional_email(
    to_email: str,
    subject: str,
    html_body: str,
    org_id: uuid.UUID | None = None,
) -> EmailSendResult:
    """Convenience wrapper for transactional (non-campaign) emails.

    Routes through Resend. When ``org_id`` is provided, looks up the
    org's ``email_from`` / ``email_reply_to`` overrides from
    ``Organization.settings`` and passes them to the underlying sender;
    falls back to the instance-wide defaults otherwise.
    """
    from_email: str | None = None
    reply_to: str | None = None
    if org_id is not None:
        try:
            from_email, reply_to = await _load_org_email_overrides(org_id)
        except Exception:  # pragma: no cover — degrade to defaults
            logger.exception("Failed to load per-org email overrides")
    return await send_email_resend(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        from_email=from_email,
        reply_to=reply_to,
    )
