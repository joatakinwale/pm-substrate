# stevie-social-cron

Cloudflare Worker that owns two scheduled jobs:

- `publish_scheduled_posts` — sweep due `SocialPost` rows and fan out to
  `social-publisher`
- `refresh_engagement_metrics` — pull recent platform metrics for posted content

## What it does

Two cron triggers in one Worker. The handler dispatches on
`controller.cron` to pick which schedule fired:

### Hourly (`0 * * * *`) — scheduled-post sweep + fanout

1. POSTs `/internal/social/scheduled/sweep` on FastAPI. The backend scans
   `SocialPost` rows where `status=scheduled AND scheduled_at <= now`, flips
   each to `publishing` in one transaction, and returns
   `{posts: [{post_id, org_id}, ...]}`.
2. For each entry, POSTs a `social.post.publish` message to the
   queue-producer Worker's `/enqueue/stevie-social-publisher` route. The
   `social-publisher` Worker does the actual platform call.

### Every 30 minutes (`*/30 * * * *`) — metrics refresh

1. POSTs `/internal/social/metrics/refresh` on FastAPI. Backend does the
   cross-org sweep in-process — no fanout. Returns `{checked, updated, errored}`.

This is a scheduled handler — there's no queue consumer binding.

## Why no fanout for metrics

Metrics refresh is already an aggregate operation: one platform API call per
recently-published post against the same Meta/LinkedIn/X rate-limit bucket.
Concurrent Worker fetches would just serialize behind the rate limiter
anyway, so in-process eliminates one queue + one DLQ from the infra surface.

## Why hourly (not per-minute) for the scheduled sweep

1. Operators schedule posts in 15-minute increments at the finest. A
   per-minute cron is overkill.
2. Cloudflare caps cron triggers per Worker; consolidating to hourly leaves
   headroom for adding more triggers later without splitting the Worker.

If sub-hour scheduling becomes a hard requirement, bump to `*/15 * * * *`
(still within limits).

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
wrangler secret put QUEUE_PRODUCER_URL       # base URL of stevie-queue-producer
```

`QUEUE_PRODUCER_URL` is the deployed URL of the `stevie-queue-producer` Worker
— this Worker calls it via fetch, the same way FastAPI does.

## Cron schedule

Defined in `wrangler.toml` under `[triggers]`. To run them manually for
testing:

```bash
wrangler dev --test-scheduled
# scheduled sweep:
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
# metrics refresh:
curl "http://localhost:8787/__scheduled?cron=*%2F30+*+*+*+*"
```

## Local dev

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

Tests cover both cron paths separately:

- Scheduled sweep: empty sweep → zero fanout, populated sweep → one fanout
  per row with the right `idempotency_key` shape, sweep failure propagates,
  one bad enqueue does not abort the rest.
- Metrics refresh: delegates to `backend.refreshSocialMetrics` with NO
  producer fetches, refresh failure propagates.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

## Related migrations

- `agents/workers/billing-cron` — closest sibling (Cron Trigger pattern,
  sweep on backend / fanout on Worker).
- `agents/workers/reports-cron` — same pattern for report-build sweep.
- `agents/workers/social-publisher` — queue consumer this Worker fans out to.

## Backend follow-up

The internal router `app/api/internal/social.py` is created but NOT yet
registered in `backend/app/main.py`. The consolidation pass (same one that
adds the queue-producer binding) will wire it up:

```python
from app.api.internal.social import router as internal_social_router
...
app.include_router(internal_social_router)
```
