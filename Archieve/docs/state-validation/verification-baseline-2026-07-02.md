# Verification Baseline - 2026-07-02

This baseline records the first post-refactor verification run for the lean
agent-state core, provenance quarantine, PM-governance profile, and guardrails.

## Environment

- Branch: `joatakinwale/virtual-agency-substrate-integration`
- Postgres: local Docker service `pm-substrate-postgres` on `127.0.0.1:5432`
- Core verification DB: `pm_substrate_verify_core_20260702`
- Provenance verification DB: `pm_substrate_verify_provenance_20260702`

## Guardrails

```bash
pnpm validate:budgets
pnpm validate:zero-edit
pnpm validate:arrowsmith-primitives
pnpm validate-contracts --strict
pnpm typecheck
pnpm build
```

Result:

- `validate:budgets`: passed, 230 files checked.
- `validate:zero-edit`: passed, 26 packages checked.
- `validate:arrowsmith-primitives`: passed, 230 versioned agent-state research
  files scanned.
- `validate-contracts --strict`: passed, 4 capability descriptors checked.
- `typecheck`: passed across workspace packages.
- `build`: passed across workspace packages.

## Migration Baseline

Core-only:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate_verify_core_20260702 pnpm db:migrate
```

Result: 26 migrations applied from `db/migrations/`; provenance tier disabled.

Provenance-enabled:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate_verify_provenance_20260702 \
PM_ENABLE_AGENT_STATE_PROVENANCE=1 \
pnpm db:migrate
```

Result: 149 migrations applied: 26 core migrations plus 123 provenance
migrations from `db/migrations-provenance/`.

## Test Baseline

Core-only:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate_verify_core_20260702 ./node_modules/.bin/vitest run --no-file-parallelism
```

Result: 85 test files, 882 tests total; 82 files passed, 3 skipped; 875 tests
passed, 7 skipped.

Provenance-enabled:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate_verify_provenance_20260702 \
PM_ENABLE_AGENT_STATE_PROVENANCE=1 \
./node_modules/.bin/vitest run --no-file-parallelism
```

Result: 85 test files, 882 tests total; 82 files passed, 3 skipped; 875 tests
passed, 7 skipped.

Interpretation: the current workspace test suite has identical results with
and without the provenance tier, supporting the quarantine claim that the tower
is opt-in and non-load-bearing for the active runtime.

Fresh provenance verification initially exposed a concurrent bootstrap race in
`PostgresProjectionRunner` when multiple fresh runner instances created
`projections.state` at the same time. The runner now serializes that one DDL
path with a transaction-scoped advisory lock; the provenance-enabled full suite
above is the clean rerun after the fix.

The canonical full-suite command disables file parallelism because the
`projection-lag` DB timing test publishes 200 events under a 5s per-test
timeout; parallel full-suite DB load produced false timeouts while the isolated
test and no-file-parallelism full suite passed. During the provenance rerun,
`time-travel` also exposed a real replay-ordering bug: `EventReader.read` was
filtering by `occurred_at` but ordering by `recorded_at`. The reader now orders
occurrence-window slices by `occurred_at, recorded_at, id`, preserving
recorded-order reads for cursor/catch-up use.

## Amnesiac Resume

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate_verify_core_20260702 pnpm evals:amnesia
```

Result: baseline `0/5` facts recalled (`0%`) vs substrate `5/5` facts recalled
(`100%`), `chainValid=true`.

Scope boundary: this is a deterministic continuity-ledger measurement. It does
not claim a live model/Ollama delete-context run.

## Remaining Skips And Unverified Claims

- The 7 skipped tests are external PluggedInSocial live-tree checks. They are
  expected to skip when `PM_PLUGGED_IN_SOCIAL_DIR` is absent after app eviction.
- Live local-agent-lab/Ollama behavior remains separate from this baseline.
- Procedure admission is implemented as a replay kernel with a Postgres-backed
  admission store, runner-port runtime, workflow invoke-node binding, and
  optional substrate HTTP route.
  Durable admission now refuses unstored or substituted procedure definitions,
  non-current stored heads, stale evidence, hash mismatches, and invalid prior
  replay history, and it is validated against the PM-governance local-agent-lab
  surface through a Pi-Harness-style runtime port. Workflow integration proves
  declared procedure nodes bypass arbitrary dispatcher output and complete only
  with replayed admission. Real external Pi process invocation remains outside
  this baseline.
