"""Real-time event broadcasting via the sse-pubsub Cloudflare Worker.

Used to be Redis pub/sub; now we POST to a Cloudflare Worker that owns
a per-org Durable Object holding the active SSE/WebSocket connections.
The browser connects directly to the Worker — FastAPI is no longer on
the read path for realtime events.

Architecture:
  1. Route mutates a Lead/Booking/Task/Project and calls
     ``broadcast_event()``.
  2. ``broadcast_event()`` HTTP-POSTs the event JSON to
     ``${SSE_PUBSUB_URL}/publish/{org_id}`` with a shared
     ``X-Webhook-Secret`` header.
  3. The Worker forwards to the org's Durable Object, which fans out to
     every connected SSE / WebSocket client.

Public surface (``broadcast_event`` + the four convenience broadcasters)
is unchanged so existing callers don't move. The Redis client and
``subscribe_org_events`` are gone — the SSE endpoint moved to the
Worker.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Module-level client so we reuse the connection pool across broadcasts
# rather than reopening TCP every event. Lazy-init on first use because
# ``get_settings()`` reads the env file lazily too.
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Return a shared httpx.AsyncClient with sensible timeouts.

    A 5s total timeout is intentionally short — broadcasting is fire-and-
    forget. If the Worker is slow we'd rather drop the toast than slow
    down the user's mutation request.
    """
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
    return _http_client


async def broadcast_event(
    org_id: str | uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
    entity_type: str | None = None,
    entity_id: str | uuid.UUID | None = None,
) -> None:
    """Publish a real-time event to all clients connected to this org.

    Sends an HTTP POST to the sse-pubsub Worker, which forwards the
    payload to the org's Durable Object. The DO fans out to every
    connected SSE or WebSocket client.

    Args:
        org_id: Organization UUID
        event_type: Event name, e.g. "task.moved", "lead.created"
        payload: Event data (must be JSON-serializable)
        entity_type: Optional entity type for client-side filtering
        entity_id: Optional entity UUID for client-side filtering
    """
    settings = get_settings()

    # Local dev / un-configured env: no-op with a warning. We don't want
    # to fail a Lead creation just because the realtime channel is
    # unavailable.
    if not settings.sse_pubsub_url:
        logger.debug(
            "sse_pubsub_url not set — skipping broadcast %s for org %s",
            event_type,
            org_id,
        )
        return

    message = {
        "event": event_type,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    url = f"{settings.sse_pubsub_url.rstrip('/')}/publish/{str(org_id)}"
    headers = {
        "X-Webhook-Secret": settings.webhook_secret,
        "content-type": "application/json",
    }

    try:
        client = _get_http_client()
        resp = await client.post(url, json=message, headers=headers)
        if resp.status_code >= 400:
            # Log and swallow — same posture as the old Redis path:
            # broadcasts must never break the request that triggered them.
            logger.warning(
                "sse-pubsub publish %s for org %s returned %s: %s",
                event_type,
                org_id,
                resp.status_code,
                resp.text[:200],
            )
    except Exception:
        logger.warning(
            "Failed to broadcast event %s for org %s", event_type, org_id
        )


# ── Convenience broadcasters ─────────────────────────────
# These wrap broadcast_event with the right entity_type / payload shape
# for each domain object. Public signatures are unchanged from the
# Redis-era implementation; the underlying transport is the only diff.

async def broadcast_task_update(
    org_id: str | uuid.UUID,
    project_id: str | uuid.UUID,
    task_id: str | uuid.UUID,
    action: str,
    task_data: dict,
) -> None:
    """Broadcast a task change event."""
    await broadcast_event(
        org_id=org_id,
        event_type=f"task.{action}",
        entity_type="task",
        entity_id=task_id,
        payload={
            "project_id": str(project_id),
            "task_id": str(task_id),
            "action": action,
            **task_data,
        },
    )


async def broadcast_project_update(
    org_id: str | uuid.UUID,
    project_id: str | uuid.UUID,
    action: str,
    project_data: dict,
) -> None:
    """Broadcast a project change event."""
    await broadcast_event(
        org_id=org_id,
        event_type=f"project.{action}",
        entity_type="project",
        entity_id=project_id,
        payload={
            "project_id": str(project_id),
            "action": action,
            **project_data,
        },
    )


async def broadcast_lead_event(
    org_id: str | uuid.UUID,
    lead_id: str | uuid.UUID,
    action: str,
    lead_data: dict,
) -> None:
    """Broadcast a lead change event.

    Feeds the "Lead inbox" badge on the dashboard and the intake notification
    toast. ``action`` is one of ``created`` / ``updated`` / ``qualified`` /
    ``converted`` / ``disqualified``. Action-specific subscribers can filter
    on ``event`` name; generic subscribers key off ``entity_type="lead"``.
    """
    await broadcast_event(
        org_id=org_id,
        event_type=f"lead.{action}",
        entity_type="lead",
        entity_id=lead_id,
        payload={
            "lead_id": str(lead_id),
            "action": action,
            **lead_data,
        },
    )


async def broadcast_booking_event(
    org_id: str | uuid.UUID,
    booking_id: str | uuid.UUID,
    action: str,
    booking_data: dict,
) -> None:
    """Broadcast a booking change event.

    Drives the Bookings page live refresh + new-call toast. ``action`` is one
    of ``created`` / ``updated`` / ``rescheduled`` / ``cancelled`` /
    ``completed`` / ``no_show`` / ``reminder_sent``. Payload should be kept
    compact — the client refetches for full row state.
    """
    await broadcast_event(
        org_id=org_id,
        event_type=f"booking.{action}",
        entity_type="booking",
        entity_id=booking_id,
        payload={
            "booking_id": str(booking_id),
            "action": action,
            **booking_data,
        },
    )


# ── Collaboration: presence + concurrent-edit indicators ─────────────
#
# These fan out exactly the same way as the entity broadcasters above —
# the only thing the Worker / Durable Object cares about is the JSON
# envelope. The frontend listens for ``presence.*`` and ``entity.editing``
# events on the existing org-scoped SSE stream.
#
# Presence is intentionally a soft signal: users tick their session every
# 30s via ``POST /api/presence/heartbeat``. Anyone who hasn't ticked in
# 60s falls off the online list. No DB writes — the state lives in
# memory inside the org's Durable Object.


async def broadcast_user_online(
    org_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    user_data: dict,
) -> None:
    """User just connected (or sent a heartbeat after >60s offline).

    ``user_data`` should be small — ``{full_name, email, avatar_url, role}``.
    The frontend uses it to render the avatar stack without a second
    round-trip to fetch user details.
    """
    await broadcast_event(
        org_id=org_id,
        event_type="presence.online",
        entity_type="user",
        entity_id=user_id,
        payload={"user_id": str(user_id), **user_data},
    )


async def broadcast_user_offline(
    org_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
) -> None:
    """User disconnected (explicit sign-out OR heartbeat timeout)."""
    await broadcast_event(
        org_id=org_id,
        event_type="presence.offline",
        entity_type="user",
        entity_id=user_id,
        payload={"user_id": str(user_id)},
    )


async def broadcast_entity_editing(
    org_id: str | uuid.UUID,
    entity_type: str,
    entity_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    user_data: dict,
    action: str = "started",
) -> None:
    """Someone opened (or stopped editing) an entity for edit.

    ``entity_type`` is e.g. ``"page"`` / ``"proposal"`` / ``"blog_post"``.
    ``action`` is ``"started"`` (entered edit mode) or ``"stopped"``
    (left edit mode / saved / navigated away).

    Frontend listens for ``entity.editing`` and renders the
    "{name} is editing this — saved {N} min ago" banner on whatever
    entity matches.

    NOTE: this is a UX signal, not a database lock. Two users can still
    save concurrently — the soft-conflict toast on the editor handles
    that case. Real OT/CRDT is a Phase 2 conversation.
    """
    await broadcast_event(
        org_id=org_id,
        event_type="entity.editing",
        entity_type=entity_type,
        entity_id=entity_id,
        payload={
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "user_id": str(user_id),
            "action": action,  # "started" | "stopped"
            **user_data,
        },
    )
