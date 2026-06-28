# stevie-reports-cron

Cloudflare Worker that owns the daily sweep firing due monthly client reports.

## What it does

Cron Trigger fires daily at 02:00 UTC. The Worker:

1. POSTs `/internal/reports/sweep-due` on FastAPI. The backend scans active `ReportSchedule` rows where `next_run_at <= now()`, computes a `SocialPost` metrics snapshot for the cadence-appropriate period, inserts a `ClientReport` row with status='pending', advances `last_run_at` / `next_run_at` on the schedule, and returns the list of `{client_report_id, org_id}` pairs.
2. For each entry in the response, POSTs a `report.build` message to the queue-producer Worker's `/enqueue/stevie-report-builder` route. The actual PDF render Worker (`stevie-report-builder`) is a future migration — until it ships, messages sit on the queue (CF Queues hold messages for up to 4 days) and the build runs as soon as the consumer comes online.

This is a scheduled handler — there's no queue consumer binding.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
wrangler secret put QUEUE_PRODUCER_URL       # base URL of stevie-queue-producer
```

`QUEUE_PRODUCER_URL` is the deployed URL of the `stevie-queue-producer` Worker — this Worker calls it via fetch, the same way FastAPI does.

## Cron schedule

Defined in `wrangler.toml` under `[triggers]`. Daily at 02:00 UTC for every environment (dev/staging/production). The cadence-aware `next_run_at` on each `ReportSchedule` is what gates an actual fanout; the daily tick is just the loop. To run it manually for testing:

```bash
wrangler dev --test-scheduled
# then in another shell:
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
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

Tests are unit-level: they mock the backend client and the producer fetch, then assert that an empty sweep produces zero fanout calls and a populated sweep produces one fanout per row with the right `idempotency_key` shape (`report-build:<client_report_id>` — the backend already gates on `next_run_at`, so we don't need a date suffix).

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
