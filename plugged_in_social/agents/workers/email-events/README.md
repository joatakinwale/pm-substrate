# stevie-email-events

Cloudflare Worker. Replaces `backend/app/tasks/email_tasks.py::process_email_event` and the inline Resend webhook receiver previously hosted at `/internal/webhooks/resend` on FastAPI.

## What it does

Resend posts Svix-signed webhook events directly to this Worker. The Worker:

1. Verifies the `svix-id` / `svix-timestamp` / `svix-signature` headers using `RESEND_WEBHOOK_SECRET`.
2. Validates the event type is one of `email.sent`, `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`, `email.complained` (anything else returns 204 and is dropped — Resend stops retrying on 2xx).
3. POSTs the cleaned payload to FastAPI `POST /api/internal/email/events`, which performs the EmailSend / EmailCampaign / Contact updates under RLS.
4. Returns 204 on success, 401 on bad signature, 400 on malformed body, 502 on backend 5xx.

Unlike `stripe-sync`, this Worker is NOT a queue consumer — Resend already retries non-2xx for ~72h, so an intermediate queue would be redundant.

## Required secrets

```bash
wrangler secret put RESEND_WEBHOOK_SECRET    # Svix endpoint secret from Resend dashboard (whsec_...)
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
```

## Resend webhook setup

In the Resend dashboard (Webhooks tab):

1. Add a new endpoint pointing at this Worker's URL (e.g. `https://stevie-email-events-production.<your-account>.workers.dev/`).
2. Subscribe to: `email.sent`, `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`, `email.complained`.
3. Copy the signing secret (`whsec_...`) into the Worker via `wrangler secret put RESEND_WEBHOOK_SECRET`.

When rotating the signing secret in Resend, rotate the Worker secret in the same change — Svix verification will fail loudly until both sides agree.

## Local dev

```bash
pnpm install
pnpm dev
```

To exercise the handler locally, post a Svix-signed body to `http://localhost:8787/`. The Resend dashboard's "Send test event" button works against any reachable URL — a tunnel (e.g. `cloudflared tunnel`) is the easiest way to point Resend at a local Worker.

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
