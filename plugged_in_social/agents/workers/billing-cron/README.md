# stevie-billing-cron

Cloudflare Worker that owns the daily payment-reminder sweep.

## What it does

Cron Trigger fires daily at 09:00 UTC. The Worker:

1. POSTs `/internal/billing/reminders/sweep` on FastAPI. The backend scans `Invoice` rows where status=open AND due_date is past AND `last_reminder_at` is null or older than 3 days, bumps `reminder_count` / stamps `last_reminder_at` in the same transaction, and returns the list of email payloads.
2. For each entry in the response, POSTs an `email.notification` message to the queue-producer Worker's `/enqueue/stevie-email-sender` route. The email-sender Worker does the actual Resend dispatch.

This is a scheduled handler — there's no queue consumer binding.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
wrangler secret put QUEUE_PRODUCER_URL       # base URL of stevie-queue-producer
```

`QUEUE_PRODUCER_URL` is the deployed URL of the `stevie-queue-producer` Worker — this Worker calls it via fetch, the same way FastAPI does.

## Cron schedule

Defined in `wrangler.toml` under `[triggers]`. Daily at 09:00 UTC for every environment (dev/staging/production) — picked to land in clients' morning and give the office a workday to follow up on bounces. To run it manually for testing:

```bash
wrangler dev --test-scheduled
# then in another shell:
curl "http://localhost:8787/__scheduled?cron=0+9+*+*+*"
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

Tests are unit-level: they mock the backend client and the producer fetch, then assert that an empty sweep produces zero fanout calls and a populated sweep produces one fanout per row with the right `idempotency_key` shape (`reminder:<invoice_id>:<YYYY-MM-DD>` so a re-run on the same day can't double-fire).

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
