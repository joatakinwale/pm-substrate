# stevie-stripe-sync

Cloudflare Worker. Replaces `backend/app/tasks/billing_tasks.py::sync_stripe_invoice`.

## What it does

Consumes `StripeSyncMessage` from the `stevie-stripe-sync` queue, fetches the matching invoice from Stripe, and POSTs the synced fields to FastAPI's `/api/internal/billing/invoice/{id}/sync` (which does the DB UPDATE under RLS).

## Required secrets

```bash
wrangler secret put STRIPE_SECRET_KEY        # same key currently in backend/.env
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
```

## Required queue (run once)

```bash
wrangler queues create stevie-stripe-sync
wrangler queues create stevie-stripe-sync-dlq
```

For staging/production, suffix the queue names per `wrangler.toml`.

## Local dev

```bash
pnpm install
pnpm dev
```

Then publish a test message via `wrangler queues consumer add` or by hitting the queue producer endpoint from FastAPI dev.

## Tests

```bash
pnpm test
```

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
