# Stevie Social — Agents Migration Plan (Path B+)

**Status:** In progress · **Decided:** 2026-05-01 · **Owner:** Etastic (Emmanuel)

## Why we're doing this

Operational simplicity. The Celery + Redis stack carries three deployable
units (Redis, worker, beat scheduler) that exist *only* to run five task
files. Cloudflare Queues + Workers + Cron Triggers replaces all three with
one managed system that scales to zero.

This migration was specifically chosen because:

- Celery is **not yet in production** for Stevie Social. There are no
  in-flight jobs to drain, no production alerts to rewrite. *Now* is the
  cheapest moment to switch.
- The five existing task files are HTTP-shaped work (Stripe, Resend, Mux,
  Anthropic). The only Python-only blockers are WeasyPrint (PDF rendering)
  and a `subprocess ffmpeg` fallback — both isolated and migrate-last.
- Future agentic features and MCP servers will live on Cloudflare anyway.
  Building them on a Workers-native runtime now avoids a second migration
  later.

## Architecture after migration

```
                                           ┌────────────────────────┐
   Browser ───── HTTPS ────► CF Workers ──►│  Next.js (OpenNext)    │
                                           └────────────────────────┘
                                                       │
                                                       │  /api/* (REST)
                                                       ▼
                                           ┌────────────────────────┐
                                           │  FastAPI (DigitalOcean)│
                                           │  • Auth + RLS          │
                                           │  • Sync CRUD           │
                                           │  • POST internal       │
                                           └────────────────────────┘
                                                       │
                                                       │ POST /enqueue/{q}
                                                       ▼
                                           ┌────────────────────────┐
                                           │  queue-producer Worker │
                                           └────────────────────────┘
                                                       │
                                                       │ queue.send()
                                                       ▼
                                           ┌────────────────────────┐
                                           │  Cloudflare Queues     │
                                           └────────────────────────┘
                                                       │
                                                       │ batch.messages
                                                       ▼
                                           ┌────────────────────────┐
                                           │  Consumer Workers      │
                                           │  • stripe-sync         │
                                           │  • email-sender        │
                                           │  • mux-ingest          │
                                           │  • ai-content          │
                                           │  • report-builder      │
                                           └────────────────────────┘
                                                       │
                                                       │ POST /api/internal/*
                                                       ▼
                                           ┌────────────────────────┐
                                           │  FastAPI internal      │
                                           │  routers (RLS-scoped)  │
                                           └────────────────────────┘
```

Realtime SSE moves to a Durable Object (`workers/sse-pubsub`), eliminating
Redis pub/sub. Cron jobs that today run on Celery beat move to per-Worker
`scheduled` handlers (Cron Triggers). Both are tracked in the ledger
below.

## Per-task migration ledger

| # | Source (Celery)                                           | Destination Worker             | Status     | Notes |
|---|-----------------------------------------------------------|--------------------------------|------------|-------|
| 1 | `billing_tasks.sync_stripe_invoice`                       | `workers/stripe-sync`          | **Done**   | Reference migration. |
| 2 | `email_tasks.send_notification_email`                     | `workers/email-sender`         | **Done**   | High fanout. Tracking pixel + link rewriting ported to TS. |
| 3 | `email_tasks.process_email_event`                         | `workers/email-events`         | **Done**   | Svix signature verification on Resend webhooks. |
| 4 | `video_tasks.process_mux_webhook`                         | `workers/mux-webhook`          | **Done**   | HMAC-SHA256 verification of Mux signature, 5-min replay window. |
| 5 | `video_tasks.ingest_to_mux`                               | `workers/mux-ingest`           | **Done**   | R2 presigning via @aws-sdk. |
| 6 | `billing_tasks.send_payment_reminders`                    | `workers/billing-cron`         | **Done**   | Cron Trigger, daily 09:00 UTC. Idempotent dedupe on `<invoice>:<YYYY-MM-DD>`. |
| 7 | `ai_tasks.generate_content`                               | `workers/ai-content`           | **Done**   | Routed through Cloudflare AI Gateway. Explicit retry classification on 429/5xx. |
| 8 | `email_tasks.publish_scheduled_posts` *(dead code)*       | —                              | Delete next | Shadowed by `social_tasks.publish_scheduled_posts`. Cleanup task. |
| 9 | `email_tasks.send_campaign`                               | `workers/email-sender`         | **Done**   | Audience match stays in FastAPI; per-recipient fanout in Worker. |
| 10| `report_tasks.generate_monthly_reports`                   | `workers/reports-cron`         | **Done**   | Cron Trigger, daily 02:00 UTC. Snapshot computed in FastAPI. |
| 11| `video_tasks.generate_thumbnail` *(Mux happy path)*       | `workers/mux-webhook` (inline) | **Done**   | ffmpeg fallback dropped. Mux thumbnails only. |
| 12| `report_tasks.generate_report_pdf`                        | `workers/report-builder`       | **Done**   | Worker is a thin queue consumer; WeasyPrint stays Python-side at `/api/internal/reports/{id}/render`. 90s backend-client timeout for slow renders. |
| — | `services/realtime.py` Redis pub/sub                      | `workers/sse-pubsub` (Durable Object) | **Done**   | Replaces Redis. Public broadcast helper signatures unchanged. |

## Verification status

- **TypeScript:** all 12 packages typecheck clean (2 shared + 10 Workers)
- **Tests:** 89 vitest tests passing across 9 Worker suites (queue-producer has no tests, only the bridge logic)
- **Bundles:** all 10 Workers build via `wrangler deploy --dry-run`. Largest is email-sender at 1.5 MB / 332 KB gzipped (Resend SDK), well under the 10 MB paid limit.
- **Python:** all 10 modified/new files (`main.py`, `config.py`, `realtime.py`, `queue_publisher.py`, `events.py` stub, 5 internal routers) parse + import the new routers cleanly.

## What's been built so far

### Workspace scaffold

```
agents/
├── package.json              ← pnpm workspace root
├── tsconfig.base.json        ← shared TS config
├── README.md                 ← workspace overview
├── packages/
│   ├── shared/               ← message contracts, env validation, error helpers
│   └── backend-client/       ← typed POST → FastAPI internal endpoints
└── workers/
    ├── queue-producer/       ← HTTP→Queue bridge (FastAPI → Cloudflare)
    └── stripe-sync/          ← reference queue consumer
```

### Backend changes

- `backend/app/services/queue_publisher.py` — replaces `task.delay()` calls. One async helper per queue.
- `backend/app/api/internal/billing.py` — Worker calls back here to UPDATE invoice rows under RLS. Uses existing `verify_webhook_secret` dependency.
- `backend/app/core/config.py` — added `queue_producer_url` setting.
- `backend/app/main.py` — registered `internal_billing_router`.

## Wrangler / Cloudflare setup (run once per environment)

```bash
# From the repo root, log in
wrangler login

# Create the queues (default env)
wrangler queues create stevie-stripe-sync
wrangler queues create stevie-stripe-sync-dlq

# Production
wrangler queues create stevie-stripe-sync-production
wrangler queues create stevie-stripe-sync-production-dlq

# Set secrets per Worker (must match backend WEBHOOK_SECRET)
cd agents/workers/queue-producer
wrangler secret put WEBHOOK_SECRET
wrangler secret put WEBHOOK_SECRET --env=production

cd ../stripe-sync
wrangler secret put WEBHOOK_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put BACKEND_BASE_URL
# ...same three for --env=staging and --env=production
```

## Deploy commands

```bash
# Deploy queue-producer first (FastAPI depends on it)
cd agents/workers/queue-producer
pnpm deploy --env=production

# Then each consumer Worker
cd ../stripe-sync
pnpm deploy --env=production

# Set QUEUE_PRODUCER_URL on the FastAPI side (DO App Platform UI or CLI)
# to the URL of the deployed queue-producer Worker, e.g.:
#   https://stevie-queue-producer-production.<account>.workers.dev
```

## Backend `.env` keys to add

```bash
# Cloudflare Queues
QUEUE_PRODUCER_URL=https://stevie-queue-producer-production.<account>.workers.dev

# Already present, just confirm they're real values not placeholders
WEBHOOK_SECRET=<openssl rand -hex 32>
```

## Rollback plan

Each Worker migration is independent. If `stripe-sync` misbehaves in prod:

1. Revert the call site in FastAPI to `sync_stripe_invoice.delay(...)` (one
   line change). Celery + Redis still exist on the backend until the final
   cleanup task — they pick up the work transparently.
2. Drain the CF queue: `wrangler queues consumer pause stevie-stripe-sync`
3. Investigate Worker logs: `wrangler tail stevie-stripe-sync-production`

The full Celery teardown (`app/tasks/`, the Redis instance, the worker
process) only happens after **all** queue consumers have run for at least
one full week in production with zero DLQ entries. Until then we have a
working fallback.

## What we are NOT doing

- **Replacing FastAPI with Hono.** Path A. Out of scope until Phase 2.
- **Replacing PostgreSQL with D1.** Out of scope. Postgres + Supabase stays.
- **Moving Auth to Cloudflare.** Auth stays on Supabase.
- **Building Hyperdrive into Workers.** Workers go through FastAPI for DB; no direct Postgres connections. Hyperdrive is only worth adding once we have a Worker that genuinely benefits from edge DB reads, which we don't yet.
