# v63 Projection Replay Frontier

Date: 2026-06-26
Status: substrate primitive strengthened; focused tests/typechecks passed; DB integration tests added but skipped locally without `PM_DATABASE_URL`
Parent: `research/daily-arrowsmith-agent-state/v62-state-identity-kernel-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ01 - What event-store or projection-runner API should generate `ProjectionReplayCertificate` from durable log records rather than caller-supplied transition refs?

Answer: pm-substrate needs a projection replay frontier: a substrate-owned cursor and event-ref surface emitted by the projection runner from the durable event log. The frontier must use the event log's admitted sequence, not `recorded_at` display timestamps, because projection identity depends on the same total order used by event-chain provenance.

Implemented slice:

- `@pm/projections` now exports `ProjectionReplayFrontier` and `ProjectionReplayFrontierEvent`.
- `ProjectionRunner` now exposes `getReplayFrontier(tenantId, name)`.
- `PostgresProjectionRunner.catchUp()` now advances by `events.events.seq`.
- `projections.cursors` now has `last_event_seq` via migration `0023_projection_replay_frontier.sql`.
- `@pm/agent-state` now has `buildProjectionReplayCertificateFromFrontier()`, which converts a projection frontier into a `ProjectionReplayCertificate` only when tenant and projection version match the current view.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([IBM](https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Database pages need a log sequence marker to relate materialized state to logged updates and make redo idempotent. | Projection cursors need `last_event_seq`, not only timestamp/id, so replay certificates cite the event log's admitted order. |
| Zhou, Larson, Goldstein, Ding 2007, "Lazy Maintenance of Materialized Views" ([VLDB PDF](https://www.vldb.org/conf/2007/papers/research/p231-zhou.pdf)) | Materialized-view maintenance tracks persistent tasks, commit sequence numbers, and delta streams so deferred views can be brought current before use. | Projection frontiers should expose consumed durable event refs and the replay position before a view can authorize action. |
| Colby, Griffin, Libkin, Mumick, Trickey 1996, "Algorithms for Deferred View Maintenance" ([SIGMOD PDF](https://homepages.inf.ed.ac.uk/libkin/papers/sigmod96b.pdf)) | Deferred view maintenance requires auxiliary history since the last refresh; otherwise a view may be inconsistent with its definition. | A projection state view without a replay frontier is only a cached representation; the frontier is the auxiliary history needed to certify it. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Event log ordering: `events.events.seq` was already present for hash-chain determinism; projection replay now consumes that same order.
2. Projection cursor: `projections.cursors` now records `last_event_seq` in addition to `last_event_id` and `last_recorded_at`.
3. Projection replay API: `ProjectionRunner.getReplayFrontier()` returns consumed durable event refs, content hashes, authorities, consumed count, projection version, and replay position.
4. Agent-state certificate bridge: `buildProjectionReplayCertificateFromFrontier()` mints certificates from frontier events instead of caller-supplied private refs, and rejects tenant/projection-version mismatch.

## 4. Missing Substrate Map Delta

Still missing:

1. Runtime replay admission port: no real write-capable runtime path yet requires `getReplayFrontier()` plus `buildProjectionReplayCertificateFromFrontier()` before mutation.
2. Certificate persistence: replay certificates are still built in memory and not stored/recovered through state-review or packet stores.
3. Authority topology: `authorityScope` remains a string; replay frontiers do not yet prove delegation/override/revocation topology.
4. General obstruction algebra: mismatched replay frontiers currently fail certificate construction or action review; they are not yet first-class obstruction artifacts.
5. Empty-log certification: an initial projection over an empty event stream still cannot prove "no admitted transitions" as a positive store-backed fact.
6. Domain authority compiler: domains still decide which projection frontier and authority scope to require.
7. Run-wide monitor: no proof object yet shows every operational write in a run had replay-frontier enforcement.

## 5. Active 10-Question Backlog

The active unanswered substrate research backlog contains exactly 10 questions:

1. SQ02: What typed authority topology should replace raw `authorityScope` strings so delegation, override, and revocation are replayable?
2. SQ03: What admission calculus composes evidence admission, provider status, terminal outcome, graph authority, and projection replay into one mutation decision?
3. SQ04: What replay rule makes connector cache, tool output, MCP handle state, and local filesystem/worktree state expire unless recertified?
4. SQ05: What obstruction algebra should represent disagreement between replay certificates, local views, authority scopes, and inter-agent consensus?
5. SQ06: What settlement/finality object proves an external target-side side effect was applied and cannot be replaced by a dispatch log?
6. SQ07: What recovery kernel lets an amnesiac agent rebuild all open operational scopes from terminal history, replay-certified projections, and continuity checkpoints?
7. SQ08: What domain authority compiler maps profile/capability contracts into required replay transitions without core substrate edits?
8. SQ09: What substrate primitive turns local worktree diffs and draft files into proposals that cannot outrank admitted transition history?
9. SQ10: What monitor/proof object can show that every operational write in a run passed replay-certificate enforcement, not just terminal-outcome recovery?
10. SQ11: What first real write-capable runtime boundary should require a projection replay certificate, and what obstruction should it emit when the frontier is absent or stale?

## 6. Primitive Proposal Ledger

Name: Projection Replay Frontier.

Problem it solves: v62 certificates could be built from caller-supplied transition refs. That proved certificate semantics, but not substrate-owned generation from durable transition history.

Research source: ARIES log sequence/page state, lazy materialized-view maintenance, deferred view maintenance.

Mechanism borrowed or adapted: materialized state carries a sequence cursor and can expose the durable input history consumed up to that cursor.

Why current substrate lacked it: `@pm/projections` stored `last_event_id` and `last_recorded_at`, and caught up from a timestamp watermark. It did not expose the consumed event history or use the event log's sequence as the replay cursor.

Why existing primitives were insufficient: `ProjectionReplayCertificate` could reject bad refs, but it could not prove refs came from the event store. Event-chain verification proved tenant log integrity, but not which events a projection consumed.

State guarantee it should create: A current projection can derive replay proof from the same durable event order used by the event hash chain.

Admission rule it requires: A write-capable action may require a replay certificate generated from a projection replay frontier whose tenant, projection version, source refs, and replay position match the current view.

Replay rule it requires: Reconstruct the frontier from `projections.cursors.last_event_seq` and the event rows with matching consumed patterns and `seq <= last_event_seq`.

Authority boundary it requires: Frontier events must carry event content hashes and authorities; the certificate builder binds those refs to the view's `authorityRule`.

Failure modes it should prevent:

- caller-supplied transition refs that never existed in the durable event log;
- timestamp cursor ambiguity when multiple events share `recorded_at`;
- stale projection frontiers authorizing action after newer consumed events exist;
- frontier/view tenant mismatch;
- frontier/view projection-version mismatch.

Minimal implementation slice:

- Added migration `0023_projection_replay_frontier.sql`.
- Added `ProjectionReplayFrontier` API and Postgres implementation.
- Changed `PostgresProjectionRunner.catchUp()` to use `seq` as the replay cursor.
- Added `buildProjectionReplayCertificateFromFrontier()` in `@pm/agent-state`.
- Added pure agent-state tests and DB-backed projection tests for the frontier path.

Tests that would falsify it:

- `catchUp()` leaves `last_event_seq` unset after applying events.
- `getReplayFrontier()` returns private or non-consumed events.
- Frontier transition events lack durable content hashes from the event log.
- Certificate construction succeeds when frontier tenant or projection version disagrees with the view.
- Blocking action review passes with a stale frontier position.

Axis surfaces that could later validate it:

- Axis A representation-loss should certify the finance current-state view from a projection frontier.
- Axis B publication/approval views should require lifecycle projection frontiers before publish authority.
- Axis C direct local-agent-state runs should compare memory-derived views against frontier-certified views.

## 7. Falsification Criteria Applied Before Verification

1. A frontier-backed certificate must pass blocking review only when generated from event transition refs with content hashes.
2. A mismatched tenant or projection version must fail before certificate minting.
3. Projection catch-up must expose `last_event_seq` as replay position.
4. Frontier events must exclude event types not consumed by the projection.
5. Projection backlog-drift checks must use `seq`, not only `recorded_at`.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A recorded-at projection cursor is enough replay identity. | Falsified. | `events.events.seq` exists specifically because transaction timestamps can tie; projection replay now uses the same sequence. |
| A certificate builder can remain the only generation primitive. | Falsified. | Without a projection frontier, certificates can be caller-supplied from private refs. |
| Event-chain verification alone proves projection state identity. | Downgraded. | Chain verification proves tenant log integrity, not which events a projection consumed. |

## 9. Implementation Frontier

Implemented now:

- Durable projection replay frontier API and sequence cursor.
- Frontier-to-certificate bridge in agent-state.
- Tests for pure certificate generation and projection-frontier integration.

Remaining frontier:

1. Enforce replay certificates at one real write-capable runtime boundary.
2. Persist/recover certificates through state-review or eval packet stores.
3. Convert stale/missing frontier failures into first-class obstruction artifacts.
4. Prove empty-log projection state without treating private initial state as authority.
5. Compose replay-frontier proof with terminal outcome, provider-status, and graph-write authority gates.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/projections typecheck
pnpm --filter @pm/events typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm exec vitest run packages/projections/src/postgres.test.ts packages/projections/src/projection-lag.test.ts
```

Result:

- `@pm/agent-state`, `@pm/projections`, and `@pm/events` typechecks passed.
- `packages/agent-state/src/index.test.ts`: 33 tests passed.
- Projection Postgres tests were collected but skipped because `PM_DATABASE_URL` was unset; the tests are present for DB-backed verification after migration.

Proof boundary:

This closes durable frontier generation as a substrate primitive, but does not yet prove runtime mutation enforcement. The next substrate step is SQ11: choose one real write-capable boundary and require replay-frontier certificates before mutation.
