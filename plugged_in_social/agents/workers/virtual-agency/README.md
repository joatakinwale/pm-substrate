# stevie-automation-runner

Cloudflare Worker. Replaces `backend/app/tasks/automation_tasks.py::run_automation`.

## What it does

Consumes `AutomationRunMessage` from the `stevie-automation-runner` queue and
POSTs it to FastAPI's `POST /api/internal/automations/{automation_id}/execute`
with body `{org_id, trigger_event, trigger_data}`. FastAPI runs every step
(send_email, add_tag, remove_tag, wait, create_task, update_field,
send_notification, webhook), evaluates conditional branches, and persists each
step's result to `AutomationRun.execution_log` under RLS.

The Worker is a queue consumer + retry orchestrator only — the multi-step state
machine, the 8 step-type handlers, and the `_evaluate_condition` logic all stay
on the Python side. Same split as `ai-content`.

## Why FastAPI does the actual work

Automations are multi-step state machines with:

- 8 step types, each with its own DB / model / service dependencies
- Conditional branching (`_evaluate_condition`)
- Per-step durable execution (each step persisted before the next)

Porting all of that to TypeScript would be a large rewrite for zero behaviour
change. Keeping the step logic Python-side gives one source of truth for the
step semantics; the Worker's only responsibility is converting a queue message
into a backend call and translating the response into `ack` / `retry`.

## Retry taxonomy

| Backend response       | Disposition                                    |
| ---------------------- | ---------------------------------------------- |
| 200 (`status: "completed"`) | `ack` — run reached terminal state         |
| 202 (`status: "paused"`)    | `ack` — paused at a wait step (see follow-up) |
| 404 / 410              | `PermanentError` → `ack` (DLQ on next trip)   |
| Other 4xx              | `PermanentError` → `ack` (validation/contract bug) |
| 5xx                    | `RetryableError` → CF Queues retries          |
| Network / abort        | `RetryableError` → CF Queues retries          |
| Bad message contract   | `PermanentError` → `ack` (producer bug)       |

`max_retries=3` (lower than `stripe-sync` and `ai-content`'s 5). Re-running an
automation has observable side effects: a duplicate `send_email` step fires a
second email, a duplicate `create_task` creates a duplicate row, etc. Three
attempts is enough for transient blips; anything past that is more likely a
logic bug than a transient failure and belongs in the DLQ for operator review.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET           # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL         # e.g. https://api.stevie.social
```

## Required queue (run once)

```bash
wrangler queues create stevie-automation-runner
wrangler queues create stevie-automation-runner-dlq
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

Tests cover message validation and the retry decision tree (200, 202, 5xx, 404,
410, bad message) with a mocked `BackendClient.executeAutomation`. End-to-end
tests against a real FastAPI dev server live in
`/scripts/test-automation-runner.sh`.

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

## Follow-up: wait-step resume

When an automation hits a `wait` step, FastAPI persists the AutomationRun's
high-water mark (`steps_completed`, `execution_log`, `status='paused'`) and
returns `202 {status: "paused"}`. The Worker ack's the message, but the run is
not yet complete — something has to re-enqueue an `automation.run` message
(with `resume_run_id` / `resume_from_step` plumbing) once the wait elapses.

This re-enqueue mechanism is **out of scope** for this migration. Options for
the follow-up task:

1. **Cron Worker sweep** — a `stevie-automation-resumer` cron Worker that
   wakes every minute, scans `AutomationRun` rows in `paused` state whose
   `resume_at` has passed, and enqueues a fresh `automation.run` message per
   row. Simplest; matches the `billing-cron` / `reports-cron` pattern already
   in this monorepo.
2. **Cloudflare Queue delay** — once Cloudflare Queues exposes per-message
   delivery delay (currently in beta), the Worker re-enqueues the message
   directly with the requested delay. No cron, but tied to a beta API.
3. **Durable Object alarm** — schedule a per-run alarm to re-fire. Most
   precise; highest infra complexity for a low-volume use case.

Pick one of the three options above when this comes up; document the choice
in `/docs/decisions/path-b-migration.md` once it lands.

For now, the Worker logs `[automation-runner] paused at wait step ...` so an
operator can spot stuck runs in `wrangler tail` until the resumer ships.

## Related migrations

- `agents/workers/stripe-sync` — reference template (single backend call).
- `agents/workers/ai-content` — closest sibling (Worker calls FastAPI for a
  work plan, FastAPI does the actual work).
- `agents/workers/email-sender` — multi-shape queue (one queue, two message
  types). Same pattern would apply if we ever fold `trigger_automation_for_event`
  fan-out into this Worker; today that's still done in-process by FastAPI
  before publishing the per-automation message.
