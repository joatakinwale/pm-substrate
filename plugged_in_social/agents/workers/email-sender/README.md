# stevie-email-sender

Cloudflare Worker that owns Resend dispatch for both transactional and bulk paths:

- `email.notification` — one-shot transactional email (payment reminders, magic-links, onboarding, proposals).
- `email.campaign.send` — bulk campaign send with audience match and per-recipient fan-out.

## What it does

Consumes from the `stevie-email-sender` queue. The `type` field on each message selects the branch:

- `email.notification` — calls Resend directly with the producer-rendered HTML.
- `email.campaign.send` — POSTs to FastAPI `/api/internal/email/campaigns/{id}/dispatch`, which runs the audience match and returns a flat list of `{send_id, to, subject, html_body}`. The Worker then loops, sends each via Resend, and reports back to FastAPI per send so campaign aggregates stay accurate.

Tracking pixel insertion and click-tracking link rewriting happen in the Worker (see `src/email_helpers.ts`) — same behaviour as the legacy `app/services/email_sender.py` helpers.

## Required secrets

```bash
wrangler secret put RESEND_API_KEY        # same key currently in backend/.env
wrangler secret put WEBHOOK_SECRET        # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL      # e.g. https://api.stevie.social
wrangler secret put RESEND_FROM_EMAIL     # e.g. "Stevie <hello@stevie.social>"
wrangler secret put RESEND_REPLY_TO       # optional default reply-to
```

## Required queues (run once)

```bash
wrangler queues create stevie-email-sender
wrangler queues create stevie-email-sender-dlq
```

For staging/production, suffix the queue names per `wrangler.toml`.

## Local dev

```bash
pnpm install
pnpm dev
```

Publish a test message via the FastAPI queue producer (`app.services.queue_publisher.publish_email_notification` or `publish_email_campaign_send`).

## Tests

```bash
pnpm test
```

Covers message contract validation for both `email.notification` and `email.campaign.send`, plus unit tests for the template render / tracking-pixel / link-rewrite helpers.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
