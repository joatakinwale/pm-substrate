# stevie-virtual-agency

Cloudflare Queue consumer for PluggedInSocial virtual-agency department tasks.

## What it does

Consumes `virtual_agency.task` messages from the `stevie-virtual-agency`
queue and POSTs each payload to FastAPI:

```text
POST /api/internal/virtual-agency/task
```

FastAPI owns orchestration state, tenant/RLS checks, approval freshness,
dependency gates, content-hash gates, write mutations, event hashes, and
durable task completion. The Worker is intentionally thin: validate the queue
message, call the internal backend endpoint, then translate the response into
Cloudflare Queue `ack` or `retry`.

## Retry taxonomy

| Backend response | Disposition |
| --- | --- |
| 2xx | `ack` |
| 425 / 429 | `RetryableError` -> queue retry |
| 5xx | `RetryableError` -> queue retry |
| Other 4xx | `PermanentError` -> `ack` |
| Bad message contract | `PermanentError` -> `ack` |
| Network / abort | `RetryableError` -> queue retry |

`max_retries=3` in `wrangler.toml`. Anything past that lands in the
environment-specific DLQ for operator review.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL
```

`WEBHOOK_SECRET` must match the FastAPI backend. `BACKEND_BASE_URL` is the
public FastAPI base URL with no trailing slash, for example
`https://api.stevie.social`.

## Required queues

Development:

```bash
wrangler queues create stevie-virtual-agency
wrangler queues create stevie-virtual-agency-dlq
```

Production:

```bash
wrangler queues create stevie-virtual-agency-production
wrangler queues create stevie-virtual-agency-production-dlq
```

Staging:

```bash
wrangler queues create stevie-virtual-agency-staging
wrangler queues create stevie-virtual-agency-staging-dlq
```

The top-level `agents/scripts/deploy.sh` creates these queues idempotently and
deploys the queue producer before this consumer.

## Local dev

```bash
pnpm install
pnpm dev
```

For full local end-to-end testing, run the FastAPI backend and set
`BACKEND_BASE_URL` plus `WEBHOOK_SECRET` in `.dev.vars`.

## Tests

```bash
pnpm test
```

Tests cover message validation and the retry decision tree against
`POST /api/internal/virtual-agency/task`.

## Deploy

```bash
pnpm deploy
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

Preferred full deployment path:

```bash
cd ../../
pnpm validate:deploy
./scripts/deploy.sh staging
```

Run `pnpm validate:deploy` before deployment. It verifies queue-producer
bindings, virtual-agency queue consumers, DLQs, deploy-script membership, and
this README's boot/deploy contract.
