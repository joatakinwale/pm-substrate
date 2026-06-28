"""Cloudflare Queues producer for FastAPI → Worker handoff.

Each helper emits a typed message that matches the contract in
``agents/packages/shared/src/messages.ts`` so the consuming Worker can
``validateMessage()`` it. This module is the only path the FastAPI
process uses to enqueue background work — every async job lives on
Cloudflare Workers + Queues.

Auth: each call carries ``X-Stevie-Internal-Secret: <WEBHOOK_SECRET>`` so the
queue producer endpoint (a thin Worker, not a CF Queues HTTP API directly)
rejects forged requests. We use the existing ``WEBHOOK_SECRET`` setting; this
keeps the secret count flat — no new variable to rotate.

Why HTTP and not the Queues binding directly: the FastAPI process runs on
DigitalOcean and has no Cloudflare bindings. The producer Worker exposes
``POST /enqueue/<queue>`` and forwards the body to the actual queue. That
producer is one tiny shared Worker, not one per queue.

Failure mode: the publish is best-effort with a short timeout. If Cloudflare
is unreachable we log + raise — the caller's transaction will roll back. We
never silently drop work. (For one-shot fire-and-forget cases like an
analytics ping, callers can wrap this in a try/except themselves.)
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Worker URL pattern — set as env var QUEUE_PRODUCER_URL once the producer
# Worker is deployed. The producer Worker exposes one endpoint per queue:
#   POST {QUEUE_PRODUCER_URL}/{queue_name}
# with body = the typed message (BaseMessage + per-type fields).
_DEFAULT_TIMEOUT_SECONDS = 5.0


def _emit_base() -> dict[str, str]:
    """Common BaseMessage fields. Producers extend with their type + payload."""
    return {
        "idempotency_key": secrets.token_urlsafe(16),
        "emitted_at": datetime.now(timezone.utc).isoformat(),
    }


class QueueNotConfiguredError(RuntimeError):
    """Raised when ``QUEUE_PRODUCER_URL`` is missing and we refuse to silently drop.

    The API path catches this and surfaces a 503 with a clear message so
    the user knows the worker isn't reachable, instead of leaving a row
    stuck in ``queued`` forever.
    """


class QueuePublishError(RuntimeError):
    """Raised when the producer Worker accepts the request but returns a
    non-2xx response (auth failure, validation error, upstream queue
    rejection). API paths catch this and surface a 502 with the upstream
    status + body snippet so regressions don't show up as opaque 500s.
    """


async def _publish(queue: str, message: dict[str, Any]) -> None:
    """Send a single message to the named queue via the producer Worker."""
    settings = get_settings()
    base_url = getattr(settings, "queue_producer_url", "").rstrip("/")
    if not base_url:
        if getattr(settings, "allow_queue_drop", False):
            logger.warning(
                "QUEUE_PRODUCER_URL not configured — dropping message to "
                "queue=%s (allow_queue_drop=True; never set this in prod)",
                queue,
            )
            return
        raise QueueNotConfiguredError(
            f"QUEUE_PRODUCER_URL is not set; refusing to drop message to "
            f"queue={queue}. Set the env var to the queue-producer Worker "
            f"URL, or set ALLOW_QUEUE_DROP=1 in local dev."
        )

    # The queue-producer Worker exposes its routes under /enqueue/{slug}
    # — see agents/workers/queue-producer/src/index.ts. Forgetting the
    # /enqueue/ prefix would silently 404 every publish in prod (the
    # Worker matches /^\/enqueue\/[a-z0-9-]+\/?$/).
    url = f"{base_url}/enqueue/{queue}"
    headers = {
        "content-type": "application/json",
        # Matches the existing X-Webhook-Secret convention in
        # ``app/api/internal/webhooks.py::verify_webhook_secret``.
        "x-webhook-secret": settings.webhook_secret,
    }
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=message, headers=headers)
        if response.status_code >= 400:
            raise QueuePublishError(
                f"queue publish failed: {queue} → {response.status_code} "
                f"{response.text[:200]}"
            )


# ── Per-queue helpers ────────────────────────────────────────────────


async def publish_stripe_invoice_sync(
    *,
    org_id: uuid.UUID | str,
    invoice_id: uuid.UUID | str,
    stripe_invoice_id: str,
) -> None:
    """Reconcile an invoice's state with Stripe.

    Worker: ``agents/workers/stripe-sync``.
    """
    await _publish(
        queue="stevie-stripe-sync",
        message={
            **_emit_base(),
            "type": "stripe.invoice.sync",
            "org_id": str(org_id),
            "invoice_id": str(invoice_id),
            "stripe_invoice_id": stripe_invoice_id,
        },
    )


async def publish_email_notification(
    *,
    org_id: uuid.UUID | str,
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    reply_to: str | None = None,
) -> None:
    """One-off transactional email send.

    Worker: ``agents/workers/email-sender``.
    """
    msg: dict[str, Any] = {
        **_emit_base(),
        "type": "email.notification",
        "org_id": str(org_id),
        "to": to,
        "subject": subject,
        "html_body": html_body,
    }
    if text_body is not None:
        msg["text_body"] = text_body
    if reply_to is not None:
        msg["reply_to"] = reply_to
    await _publish(queue="stevie-email-sender", message=msg)


async def publish_email_campaign_send(
    *,
    org_id: uuid.UUID | str,
    campaign_id: uuid.UUID | str,
) -> None:
    """Bulk campaign send (audience match → per-recipient fanout).

    Worker: ``agents/workers/email-sender``.
    """
    await _publish(
        queue="stevie-email-sender",
        message={
            **_emit_base(),
            "type": "email.campaign.send",
            "org_id": str(org_id),
            "campaign_id": str(campaign_id),
        },
    )


async def publish_ai_content_generate(
    *,
    org_id: uuid.UUID | str,
    request_id: uuid.UUID | str,
) -> None:
    """Run an AI content generation request.

    Worker: ``agents/workers/ai-content``.
    """
    await _publish(
        queue="stevie-ai-content",
        message={
            **_emit_base(),
            "type": "ai.content.generate",
            "org_id": str(org_id),
            "request_id": str(request_id),
        },
    )


async def publish_report_build(
    *,
    org_id: uuid.UUID | str,
    client_report_id: uuid.UUID | str,
) -> None:
    """Build (compute + render PDF) a single client report.

    Worker: ``agents/workers/report-builder``.
    """
    await _publish(
        queue="stevie-report-builder",
        message={
            **_emit_base(),
            "type": "report.build",
            "org_id": str(org_id),
            "client_report_id": str(client_report_id),
        },
    )


async def publish_automation_run(
    *,
    org_id: uuid.UUID | str,
    automation_id: uuid.UUID | str,
    trigger_event: str,
    trigger_data: dict[str, Any],
) -> None:
    """Run an automation workflow (multi-step state machine).

    Worker: ``agents/workers/automation-runner``.
    """
    await _publish(
        queue="stevie-automation-runner",
        message={
            **_emit_base(),
            "type": "automation.run",
            "org_id": str(org_id),
            "automation_id": str(automation_id),
            "trigger_event": trigger_event,
            "trigger_data": trigger_data,
        },
    )


async def publish_social_post_publish(
    *,
    org_id: uuid.UUID | str,
    post_id: uuid.UUID | str,
) -> None:
    """Publish a single social media post to its target platform.

    Worker: ``agents/workers/social-publisher``.
    """
    await _publish(
        queue="stevie-social-publisher",
        message={
            **_emit_base(),
            "type": "social.post.publish",
            "org_id": str(org_id),
            "post_id": str(post_id),
        },
    )
