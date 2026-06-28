# stevie-mux-ingest

Cloudflare Worker. Replaces `backend/app/tasks/video_tasks.py::ingest_to_mux`.

## What it does

Consumes `MuxIngestMessage` from the `stevie-mux-ingest` queue, presigns a 5-minute GET URL for the source video on R2, calls `POST https://api.mux.com/video/v1/assets` to create the Mux asset (with `passthrough = asset_id` so the downstream webhook can correlate), then POSTs back to FastAPI `POST /api/internal/video/{asset_id}/mux-created` so the row's `mux_asset_id` and `mux_status` are recorded under RLS.

The downstream `video.asset.ready` / `errored` / `deleted` events are handled by `stevie-mux-webhook` (separate Worker), not here.

## Required secrets

```bash
wrangler secret put MUX_TOKEN_ID
wrangler secret put MUX_TOKEN_SECRET
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ENDPOINT              # https://<account-id>.r2.cloudflarestorage.com
wrangler secret put R2_BUCKET_NAME
```

## Required queue (run once)

```bash
wrangler queues create stevie-mux-ingest
wrangler queues create stevie-mux-ingest-dlq
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

These don't hit real Mux or R2 — they validate the message contract only. Integration tests live in `/scripts/test-mux-ingest.sh` (covered in a later task).

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
