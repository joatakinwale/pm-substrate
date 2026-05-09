# ADR-0017: Workflow retry policy + dead-letter handling

**Status:** Accepted
**Date:** 2026-05-09
**Tracks:** G8 — Workflow runtime hardening (phase 3 of 3, closing G8)

## Context

Pre-G8.3, the workflow runtime had no retry behavior and no
quarantine for failed steps. A failing dispatcher invocation
caused:

- The step row to be marked `failed`.
- The run to be marked `failed`.
- The DAG walk to halt at that step.
- No durable, queryable record of the failure beyond the run/step
  rows.

For real workloads this is too brittle. Real capabilities fail
for transient reasons all the time: rate limits, network blips,
downstream provider 5xx, brief DNS failures, dispatcher timeouts.
The runtime needs to:

1. Retry transient failures with backoff.
2. Quarantine the persistently-failed steps somewhere an operator
   can inspect / replay them, without losing the original run
   history.

G6, G7, G8.1, G8.2 closed correctness gaps. G8.3 closes the
operational durability gap. After this, the substrate runtime is
ready to host real tenants.

## Decision

Two parts:

### 1. Doc-declared retry policy on invoke nodes.

`InvokeNode` gains an optional `retry` field:

```ts
interface RetryPolicy {
  readonly maxAttempts: number;          // total attempts including the first
  readonly backoffMs: number;            // base delay between attempts
  readonly mode?: "fixed" | "exponential"; // default "fixed"
}
```

Runtime semantics:

- No `retry` field present → single attempt, legacy behavior.
- `maxAttempts <= 1` → single attempt, same as no policy.
- On dispatcher failure (`success === false`), the runtime sleeps
  according to backoff mode and retries up to `maxAttempts` total.
- `"fixed"` sleeps `backoffMs` between every attempt.
- `"exponential"` sleeps `backoffMs * 2^(attempt-1)`, capped at
  5 minutes per delay.
- The final step row records `attempts = N` (where N is the actual
  number of dispatcher calls made).
- After all retries exhaust, the step is dead-lettered (see below).

**Authorization denials and "capability not found" errors are
NOT retried.** They aren't transient; retrying re-incurs the cost
without any expectation that the answer will change. Both go
straight to the dead-letter with `attempts=1` and reason
`permission_denied` or `capability_not_found`.

### 2. `workflow.dead_letter` table.

Migration `0012` adds:

- `workflow.run_steps.attempts INTEGER NOT NULL DEFAULT 1`.
- `workflow.dead_letter` — append-only table holding terminal step
  failures with full context: tenant, run, workflow + version,
  node, capability, the trigger event id, the resolved inputs at
  time of failure, attempts count, error JSONB, reason tag, and a
  `redriven_at` timestamp for operator replay tracking.
- Indexes: `(tenant_id, failed_at DESC)` for the dashboard query;
  `run_id` for run-scoped lookup; partial index on `redriven_at IS
  NULL` for "open dead-letter queue" queries.

Reason tags (closed enum, expand later as needed):
- `retry_exhausted` — dispatcher kept failing; max attempts hit.
- `permission_denied` — authorization rejected; non-retryable.
- `capability_not_found` — registry lookup failed at runtime.

The append-only convention matters. Re-driving a dead-letter row
later (via an operator action; not implemented in this ADR) sets
`redriven_at` rather than deleting/updating, preserving the
forensic trail.

## Consequences

### Positive

- Real workloads can land. Transient failures are absorbed; persistent
  ones are surfaced for explicit review instead of silently halting
  runs with no operational handle.
- Same mental model operators already have from Kafka / SQS / Rabbit:
  the DLQ is a first-class entity with explicit semantics.
- Doc-declared policy keeps the runtime substrate-only — no per-tenant
  retry config tables, no live policy editing. Authors set retry once
  in the workflow doc; immutability (G8.2) makes that durable.
- Non-retryable errors fail fast. No wasted authorization roundtrips.

### Negative

- Retries that sleep block the inner DAG walk. For long backoffs this
  could hold a runtime worker for minutes. Acceptable for now (the
  walker is per-event and concurrent runs are independent), but worth
  revisiting if a tenant declares aggressive backoff on a hot trigger.
- One additional INSERT per terminal failure (dead-letter row).
  Negligible.

### Neutral / future

- Dead-letter re-drive is not implemented. The data model supports
  it (`redriven_at` column, partial index on open rows). When a
  tenant needs it, the implementation is a separate
  `redriveDeadLetter(tenantId, deadLetterId)` API on the runtime
  that re-resolves inputs against the snapshot, re-invokes, and
  marks the original row redriven. Out of scope here.
- Jitter is not yet randomized; backoff is deterministic. Easy to
  add when retry contention becomes a real issue (multiple tenants
  retrying the same downstream provider in lockstep).
- This closes G8. Substrate is ready for real tenants.

## Alternatives considered

- **No dead-letter; only run-level failure.** Rejected. Failing the
  run silently leaves no queue an operator can drain. Production
  workloads need an explicit failure surface.
- **Per-tenant retry config table.** Rejected. Couples retry policy
  to tenant config rather than the workflow doc. Authors should be
  the ones declaring "this step is flaky; retry it." Tenant config
  is the wrong layer.
- **Retry permission_denied / capability_not_found.** Rejected.
  These are configuration errors, not transient. Retrying just
  burns capacity.
- **Use BullMQ / Sidekiq / similar queue lib.** Rejected for now.
  Adding a runtime dependency for a feature we can implement in
  ~80 lines of TS + one migration would be over-engineering. If
  the substrate ever needs distributed retry across machines, that
  refactor is its own conversation; for the single-process
  PostgresWorkflowRuntime, in-process retry is correct.

## Verification

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test -- --run` — 25 files / **195 tests** (was 192). Three new tests:
  - retry succeeds on attempt 2 → step `completed`, `attempts=2`, no dead-letter
  - retry exhausted (3/3) → step `failed`, `attempts=3`, dead-letter row with `reason='retry_exhausted'`, run `failed`
  - permission_denied is non-retryable: `maxAttempts: 99` doesn't matter, dispatcher never called, dead-letter has `reason='permission_denied'` and `attempts=1`
- `pnpm validate-contracts --strict` ✅
- Migration `0012` applied to dev DB; `\d workflow.dead_letter` confirms schema + indexes; `\d workflow.run_steps` shows `attempts` column.
