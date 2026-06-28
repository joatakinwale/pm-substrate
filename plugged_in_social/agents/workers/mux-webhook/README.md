# stevie-mux-webhook

Cloudflare Worker. Replaces `backend/app/tasks/video_tasks.py::process_mux_webhook` and the inline Mux webhook handler previously hosted at `/internal/webhooks/mux` on FastAPI. Also absorbs the Mux-only path of `generate_thumbnail` — the ffmpeg fallback was dropped per the Path B+ migration.

## What it does

Mux posts HMAC-signed webhook events directly to this Worker. The Worker:

1. Verifies the `Mux-Signature` header (`t=<timestamp>,v1=<sig>`) using `MUX_WEBHOOK_SIGNING_SECRET` (HMAC-SHA256 over `<timestamp>.<raw_body>`).
2. Validates the event type is one of `video.asset.ready`, `video.asset.errored`, `video.asset.deleted` (anything else returns 204 and is dropped — Mux stops retrying on 2xx).
3. For `video.asset.ready` only: synthesizes the Mux thumbnail URL from the playback id and includes it in the forwarded payload, so the backend doesn't have to.
4. POSTs the cleaned payload to FastAPI `POST /api/internal/video/events`, which performs the MediaAsset update under RLS.
5. Returns 204 on success, 401 on bad signature, 400 on malformed body, 502 on backend 5xx.

Unlike `mux-ingest`, this Worker is NOT a queue consumer — Mux already retries non-2xx for ~24h, so an intermediate queue would be redundant.

## Required secrets

```bash
wrangler secret put MUX_WEBHOOK_SIGNING_SECRET   # signing secret from Mux dashboard
wrangler secret put WEBHOOK_SECRET               # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL             # e.g. https://api.stevie.social
```

## Mux webhook setup

In the Mux dashboard (Settings → Webhooks):

1. Add a new endpoint pointing at this Worker's URL (e.g. `https://stevie-mux-webhook-production.<your-account>.workers.dev/`).
2. Copy the signing secret (shown once on creation) into the Worker via `wrangler secret put MUX_WEBHOOK_SIGNING_SECRET`.

When rotating the signing secret in Mux, rotate the Worker secret in the same change — HMAC verification will fail loudly until both sides agree.

## Local dev

```bash
pnpm install
pnpm dev
```

To exercise the handler locally, post a Mux-signed body to `http://localhost:8787/`. The Mux dashboard's "Send test webhook" button works against any reachable URL — a tunnel (e.g. `cloudflared tunnel`) is the easiest way to point Mux at a local Worker.

## Tests

```bash
pnpm test
```

Covers: valid signature → backend call, bad signature → 401, missing signature → 401, unsupported event type → 204 (no backend call), malformed body → 400.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
