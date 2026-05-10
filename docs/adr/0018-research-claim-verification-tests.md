# ADR-0018 — Research-claim verification tests (closes G5.5, G5.6, G5.7)

**Status:** Accepted (2026-05-10)

**Closes:** G5.5 (time-travel), G5.6 (projection-lag under load), G5.7 (capability permission enforcement). With this ADR, **all eight G5 audit items are closed.**

---

## Context

The G5 audit items in `research/discovery-engine/pm-substrate-research-gap-audit-2026-05-05.md` were not bug reports — they were *research-claim verifications*. The substrate makes promises about its behavior:

> "Time-travel queries are supported by reading the event log at a given timestamp; projections are rebuilt from the log on demand." — `docs/architecture.md`

> "A projection is a deterministic, replayable function from the event stream to a read-model." — `packages/projections/src/interfaces.ts`

> "Capabilities declare `requiredPermissions`; the runtime enforces them at the workflow invocation boundary." — `docs/adr/0014-runtime-permission-enforcement.md`

A claim with no test guarding it is a hope, not a property. G5 items 5/6/7 added the missing guards.

## Items closed

### G5.5 — Time-travel via event-log replay

**Test:** `packages/projections/src/time-travel.test.ts`

Three assertions, all against live Postgres:

1. **Reconstruct-at-T.** Fold events with `occurredAt <= T` through a deterministic projection at three watermarks (T1, T2, T3). The state at each watermark matches the historical answer the system would have shown at that wall-clock instant. Verifies `EventReader.read({ until })` filters by `occurredAt`, not `recordedAt`.

2. **Determinism.** Replaying the same event log twice yields byte-identical state (`JSON.stringify(a) === JSON.stringify(b)`). Out-of-order publishes (events with later `recordedAt` but earlier `occurredAt`) are sorted by `(occurredAt, id)` for fully deterministic ordering even at millisecond collisions.

3. **Tombstones survive replay.** A delete event leaves a "deleted" row in the projection rather than removing it. Time-travel to before the delete shows the entity as live; after the delete shows it as tombstoned. The historical view is immutable: re-reading the same time window always returns the same answer.

**What this test deliberately does NOT add:** a `Graph.getNodeAsOf(t)` API. The graph adapter is a current-state cache; the event log is the source of truth. Adding a point-in-time graph API would be a feature, not a substrate guarantee — this ADR closes the *invariant* without expanding scope.

### G5.6 — Projection-lag under demo-scale load

**Test:** `packages/projections/src/projection-lag.test.ts`

Three assertions:

1. **Throughput floor.** 200 events publish + catch up under a 5s budget. On the dev box at write time: catch-up of 200 events runs in ~10ms. Budget is intentionally loose — it catches order-of-magnitude regressions (an N+1 query, a missing index) without false-flaking on a busy CI runner.

2. **Incremental catch-up is proportional to the new batch.** A second batch of 200 events catches up in roughly the same wall-clock time as the first. If the cursor were silently broken — replaying from log-start every time — the determinism test would still pass (correct answer, wrong work) but per-iteration cost would scale O(K²). This test guards the cursor invariant directly.

3. **No silent backlog drift.** After `catchUp` returns, the cursor's `last_recorded_at` is past every event in `events.events` for the tenant. The runner cannot return "almost done" — it either consumed everything or it didn't.

Numbers are logged to console (`[G5.6] N=200 publish=…ms catchUp=…ms`) so a maintainer reading test output can see the trend over time.

### G5.7 — Capability permission enforcement (already closed by G7 phase 1)

G5.7 in the audit asked for "capability permission enforcement test." This was implemented and tested by **PR #9 (G7 phase 1)** in 2026-05-08. Verification:

- `packages/workflow/src/postgres.test.ts` line 398-447 — workflow-runtime test where a capability declares `requiredPermissions: ["secure.write"]` and the dispatcher rejects the invocation with `error: "permission_denied"` when the run lacks the permission.
- `packages/workflow/src/postgres.test.ts` line 668 (G8.3) — `permission_denied` is non-retryable and goes straight to `workflow.dead_letter` with `reason = "permission_denied"`. Closes the operational loop: a permission failure isn't a transient retry, it's a terminal quarantine.
- `docs/adr/0014-runtime-permission-enforcement.md` — the design rationale.

No new code or tests required. Tracked here for closure accounting.

## Consequences

- **All G5 items closed.** The substrate's research claims now have guards. From here, "the substrate is production-ready" is a testable assertion, not a slogan.
- **G5 audit can be retired.** No deferred-by-design items remain on substrate runtime.
- **Performance budgets are tripwires, not SLAs.** G5.6's 5s budget will catch a 100x regression. It will not catch a 2x regression. That's the right trade for unit-test-style CI; tighter budgets belong in a future load-test suite running against fixed hardware.
- **No new substrate runtime code.** All three closures are pure tests + ADR. The anti-fixation diff against substrate-owned packages is *expected* to be non-zero here — the rule's intent is "no profile-driven substrate edits"; tests guarding substrate invariants belong with the substrate (precedent: ADR-0009 / PR #5).

## Out of scope (deliberately deferred)

- **Push-based projection runner via LISTEN/NOTIFY.** The interface allows it; the runtime is pull-based today. Latency under push is a separate measurement and a separate runner.
- **Multi-tenant load test.** Fan-out across many tenants is a different failure mode (contention on `events.events`, `projections.cursors`). Logged as a future test if a real tenant ever reports drift.
- **Time-travel as a public substrate API.** Today, time-travel is an *application-level* primitive: read events with `until: T` and fold deterministically. If a future capability needs first-class time-travel reads, that's a feature request, not an audit gap.
