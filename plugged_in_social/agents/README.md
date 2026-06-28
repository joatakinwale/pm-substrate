# Stevie Social — Agents Workspace

Cloudflare Workers monorepo. Owns all background jobs, queue consumers, scheduled handlers, and webhook receivers for Stevie Social.

## What lives here

```
agents/
├── workers/                  # one Worker per domain — separate wrangler.toml + deploy
│   ├── stripe-sync/          # queue consumer: sync_stripe_invoice
│   ├── email-sender/         # queue consumer: send_notification_email + send_campaign
│   ├── email-events/         # webhook handler: Resend events → DB state
│   ├── mux-ingest/           # queue consumer: ingest_to_mux
│   ├── mux-webhook/          # webhook handler: Mux events → DB state
│   ├── ai-content/           # queue consumer: generate_content (Anthropic via AI Gateway)
│   ├── report-builder/       # queue consumer: generate_monthly_reports
│   ├── sse-pubsub/           # Durable Object: SSE/WebSocket pub-sub (replaces Redis)
│   ├── billing-cron/         # Cron Trigger: send_payment_reminders (daily 09:00 UTC)
│   └── reports-cron/         # Cron Trigger: generate_monthly_reports (daily 02:00 UTC)
├── packages/
│   ├── shared/               # types, env validation, cost-tracking helpers shared across Workers
│   └── backend-client/       # typed fetch client → FastAPI internal endpoints
└── scripts/                  # deploy helpers, migration verification scripts
```

## Conventions

- Each Worker is its own pnpm workspace with its own `wrangler.toml`, `package.json`, and `tsconfig.json` extending `../../tsconfig.base.json`.
- Workers never connect to Postgres directly. They call FastAPI internal endpoints with `WEBHOOK_SECRET` shared-header auth. This preserves RLS context, keeps SQLAlchemy as the single ORM, and avoids dual schema sources of truth.
- Secrets live in Cloudflare via `wrangler secret put`. Never commit `.dev.vars`.
- Queue messages must include `org_id` and `idempotency_key`. The shared package's `validateMessage()` enforces this.

## Local dev

```bash
pnpm install
cd workers/stripe-sync
pnpm dev   # spins up wrangler dev on a free port
```

## Deploy (per Worker)

```bash
cd workers/stripe-sync
pnpm deploy
```

Or deploy everything: `pnpm deploy` from the workspace root.

## First-time Cloudflare setup

```bash
wrangler login
wrangler secret put WEBHOOK_SECRET --env=production
wrangler secret put STRIPE_SECRET_KEY --env=production
# ...etc per Worker, see each worker's README.md for its required secrets
```

## Migration status

See `/docs/core/agents-migration.md` for the per-task migration ledger.
