# stevie-social-publisher

Cloudflare Worker. Replaces `backend/app/tasks/social_tasks.py::publish_post`.

## What it does

Consumes `SocialPublishMessage` from the `stevie-social-publisher` queue and
POSTs it to FastAPI's `POST /api/internal/social/posts/{post_id}/publish` with
body `{org_id, expected_content_hash}`. FastAPI verifies the scheduled content
hash, dispatches to the right platform publisher
(Meta/LinkedIn/X/TikTok/YouTube/Pinterest), refreshes the OAuth token if near
expiry, persists the result on the `SocialPost` row, and logs an `Activity`
entry under RLS.

The Worker is a queue consumer + retry orchestrator only — the platform
publishers, OAuth refresh logic, and `SocialPost` mutation all stay on the
Python side. Same split as `automation-runner`.

## Why FastAPI does the actual work

The publishers in `app/services/social/` are platform-specific Python with
heavy SDK dependencies:

- Meta Graph (Instagram + Facebook)
- LinkedIn UGC API
- X (Twitter v2)
- TikTok Open API
- YouTube Data API v3
- Pinterest API

Plus the `token_refresh.refresh_if_needed` flow which knows the per-platform
OAuth refresh quirks (Google's 1h tokens, X's 2h tokens, Meta's long-lived
exchange).

Porting all of that to TypeScript would be a large rewrite for zero behaviour
change. Keeping the publish logic Python-side gives one source of truth; the
Worker's only responsibility is converting a queue message into a backend call
and translating the response into `ack` / `retry`.

## Retry taxonomy

| Backend response       | Disposition                                    |
| ---------------------- | ---------------------------------------------- |
| 200 (`status: "published"`) | `ack` — terminal: post is live          |
| 200 (`status: "failed"`)    | `ack` — terminal: backend recorded failure |
| 404                    | `PermanentError` → `ack` (post or account deleted) |
| 409                    | `PermanentError` → `ack` (scheduled content hash mismatch) |
| 422                    | `PermanentError` → `ack` (unknown platform / config / auth refresh) |
| Other 4xx              | `PermanentError` → `ack` (validation/contract bug) |
| 5xx                    | `RetryableError` → CF Queues retries          |
| Network / abort        | `RetryableError` → CF Queues retries          |
| Bad message contract   | `PermanentError` → `ack` (producer bug)       |

`max_retries=3` (lower than `stripe-sync`'s 5). Re-running a publish has
observable side effects: a duplicate publish posts the same content twice to
the user's social account. Three attempts is enough for transient platform
blips; anything past that is more likely a logic bug or a hard platform
rejection and belongs in the DLQ for operator review.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
```

## Required queue (run once)

```bash
wrangler queues create stevie-social-publisher
wrangler queues create stevie-social-publisher-dlq
```

For staging/production, suffix the queue names per `wrangler.toml`.

## Local dev

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

Tests cover message validation and the retry decision tree (200 published,
200 failed, 5xx, 404, 422, bad message) with a mocked `BackendClient.publishSocialPost`.
End-to-end tests against a real FastAPI dev server live in
`/scripts/test-social-publisher.sh`.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

## Related migrations

- `agents/workers/stripe-sync` — reference template (single backend call).
- `agents/workers/automation-runner` — closest sibling (Worker → FastAPI →
  ack/retry, FastAPI does the actual work).
- `agents/workers/social-cron` — cron handler that fans out scheduled posts
  onto this queue and triggers cross-org metrics refresh.

## Backend follow-up

The internal router `app/api/internal/social.py` is created but NOT yet
registered in `backend/app/main.py`. The consolidation pass (same one that
adds the queue-producer binding) will wire it up:

```python
from app.api.internal.social import router as internal_social_router
...
app.include_router(internal_social_router)
```
