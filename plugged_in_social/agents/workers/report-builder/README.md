# stevie-report-builder

Cloudflare Worker. Triggers PDF rendering for `ReportBuildMessage`s
inserted by the `stevie-reports-cron` Worker.

## What it does

Consumes `ReportBuildMessage` from the `stevie-report-builder` queue and
POSTs to FastAPI's `POST /api/internal/reports/{client_report_id}/render`
with body `{org_id}`. FastAPI loads the `ClientReport`, calls
`render_report_pdf` (WeasyPrint), uploads to R2, sets `pdf_url` +
`pdf_generated_at` + `status='generated'`, returns 204.

The Worker is a queue consumer + ack/retry orchestrator only — the actual
PDF render stays Python-side because WeasyPrint is the working
implementation and its template + helper code already lives in
`app/services/reports/`.

## Why FastAPI does the render

WeasyPrint's HTML→PDF pipeline is battle-tested in this codebase. Porting
it to TypeScript would mean either:

1. Cloudflare Browser Rendering (Workers Browser API) — pay the design tax
   of rebuilding the whole template stack against headless Chromium.
2. A third-party PDF service (e.g. DocRaptor) — vendor lock-in plus a new
   external failure mode in a hot path.

Both add migration risk for zero behaviour change. Keeping the render on
FastAPI gives one source of truth for the report template and re-uses the
existing R2 upload code path. The Worker exists at all because PDF
rendering is slow (5–30s per report) and queueing isolates that latency
from the producer (the cron sweep's request handler).

## Retry taxonomy

| Backend response       | Disposition                                    |
| ---------------------- | ---------------------------------------------- |
| 204 No Content         | `ack` — render + R2 upload + DB update done   |
| 404                    | `PermanentError` → `ack` (DLQ on next trip)   |
| 409                    | `PermanentError` → `ack` (already generated)  |
| Other 4xx              | `PermanentError` → `ack` (validation/contract bug) |
| 5xx                    | `RetryableError` → CF Queues retries          |
| Network / abort / timeout | `RetryableError` → CF Queues retries       |
| Bad message contract   | `PermanentError` → `ack` (producer bug)       |

`max_retries=3`. Re-rendering a report is idempotent (the same input
produces the same PDF and overwrites the same R2 key), so a transient
backend blip is safe to retry. Beyond three attempts a render failure is
much more likely a logic bug — DLQ for operator review.

`max_batch_size=1` because renders are slow and per-message expensive;
serial processing inside one batch would push the Worker past its 30s
default request timeout. One message per consumer instance keeps the
fetch budget honest.

## Per-call timeout

The Worker overrides `BackendClient`'s default 10s fetch timeout to 90s
for the render call. Renders take 5–30s under load and the default would
flap into RetryableError on slow paths even when the backend is making
progress. The Worker's overall request budget is 30s by default, but
queue consumers run in their own invocation context with a longer
allowance — see Cloudflare's queue consumer docs.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
```

## Required queue (run once)

```bash
wrangler queues create stevie-report-builder
wrangler queues create stevie-report-builder-dlq
```

For staging/production, suffix the queue names per `wrangler.toml`.

## Local dev

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

Tests cover message validation and the retry decision tree (success,
404, 409, 5xx, bad message) with a mocked `BackendClient.renderReport`.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

## Related migrations

- `agents/workers/reports-cron` — the producer that inserts the
  `ClientReport` row and enqueues the `ReportBuildMessage`.
- `agents/workers/automation-runner` — closest sibling (Worker → FastAPI →
  ack, no third-party API leg).
- `agents/workers/stripe-sync` — reference template (single backend call).
