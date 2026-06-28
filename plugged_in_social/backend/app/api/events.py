"""Deprecated SSE router — kept as an empty stub.

The realtime SSE / WebSocket path moved to a Cloudflare Durable Object
(``agents/workers/sse-pubsub``) as part of the Path B+ migration. The
frontend now connects directly to ``${SSE_PUBSUB_URL}/subscribe/{org_id}``
and FastAPI is no longer on the read path for realtime events.

Why this file still exists:
  ``app/main.py`` imports and registers ``events_router`` with the
  prefix ``/api``. That registration is intentionally left untouched
  during the migration (per the do-NOT-touch list for this work) so we
  avoid touching ``main.py``. Removing the file would break the import.

Why it has no routes:
  The two endpoints that used to live here (``/events/stream`` for admin
  EventSource and ``/events/stream/portal`` for portal-scoped SSE) are
  fan-out from the Worker now. The publish side
  (``app/services/realtime.py``) is the only thing FastAPI still does.

If you're tracking down where the SSE endpoint went:
  - Worker:    ``agents/workers/sse-pubsub/src/index.ts``
  - DO:        ``agents/workers/sse-pubsub/src/org_channel.ts``
  - Frontend connects to: ``${NEXT_PUBLIC_SSE_PUBSUB_URL}/subscribe/{org_id}``

Once ``main.py`` is opened for a follow-up edit, this file can be
deleted along with the registration line.
"""
from fastapi import APIRouter

# Empty router — preserved only so ``app.main`` can still
# ``from app.api.events import router as events_router`` and register it
# without 404-handling fallout.
router = APIRouter(prefix="/events", tags=["events", "deprecated"])
