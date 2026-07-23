# ADR-0009: P0 documentation audit — summary + outcomes

**Status:** Accepted (2026-05-03)
**Trigger:** Emmanuel asked mid-build, "How are you making sure you are not providing false negatives and validating your assumption using official documentation?" The honest answer was: I wasn't.

## What the audit covered

Eight Postgres mechanisms my code leaned on without explicit doc validation. Each got an ADR pinning the assumption to a verbatim PG17 quote and to a test that would re-fail if the assumption regresses.

| ADR | Mechanism | Status |
|-----|-----------|--------|
| 0004 | pg_notify / LISTEN transactionality, payload limit, ordering | Documented + tested |
| 0005 | events table range partitioning + missing-partition failure | **Bug fixed** — auto-provision + DEFAULT |
| 0006 | node-postgres driver, JSONB casting, identifier sanitization, microsecond precision | Documented + tested |
| 0007 | ON CONFLICT semantics + Read Committed isolation | Documented + tested |
| 0008 | LISTEN client lifecycle + reconnect-on-error | **Bug fixed** — release(err) + reconnect handler |

## Bugs caught and fixed during the audit

These were false-negatives that local + CI tests had been silently accepting:

1. **Missing-partition timebomb** — every `events.publish()` would have failed at 2026-08-01 00:00 UTC because the bootstrap migration only created May/June/July partitions. **Fix:** migration 0007 adds DEFAULT partition; `ensureMonthPartition()` auto-provisions current + next month per process. **Pinning:** `partitions.test.ts` (6 tests).

2. **LISTEN connection drop = silent NOTIFY loss** — `PostgresEventStore` held a long-lived PoolClient with no error handler. A network blip or backend termination would leave the store with a dead client and zero subscribers receiving anything; reads would still work, hiding the failure. **Fix:** error/end handlers reconnect with bounded backoff + re-LISTEN; close() awaits in-flight reconnect. **Pinning:** "LISTEN client reconnects after the underlying connection is terminated" (uses `pg_terminate_backend` to force a real drop).

3. **Stale LISTEN client never released to pool** — caught by the reconnect test's `afterAll` hook hanging because `pool.end()` was waiting for a checked-out client that had already errored. The `onLost` handler set `#listenClient = null` but never called `client.release(err)`. **Fix:** explicit `release(err)` in the lost-connection handler.

4. **"8KB" payload limit** in code comments was wrong — PG17 docs specify **8000 bytes**. Cosmetic but the kind of thing that misleads a reader. **Fix:** comment corrected.

## Process changes

- **CI now actually runs the integration tests.** Prior to the audit, every `describeIfDb` block was silently skipped because the CI workflow had no Postgres service. CI workflow now provisions postgres:17-alpine, runs migrate + seed, then tests. (Caught earlier in the same session: every CI run since the scaffold had been failing.)
- **Mechanism ADRs going forward.** Any new dependency on a Postgres feature beyond plain CRUD requires an ADR with: doc URL, quoted paragraph, the assumption stated explicitly, and a test that pins it.
- **Boundary-condition test pattern.** Whenever the code says "after watermark" or "exclusive lower bound" or "future month", there's now a pinning test that exercises the boundary directly. The microsecond watermark off-by-one and the missing-partition timebomb are both caught by this pattern.

## What's still owed

- **`gh actions` versions are Node 20** — deprecation warning visible on every CI run. Bump to Node 24-compatible versions. (Tracked, not yet done; non-blocking.)
- **Periodic re-catch-up timer for projections + workflow consumers** — would tighten the gap between NOTIFY drop and recovery from "until next consume()" to "every N seconds". Logged as TODO in `postgres.ts` for `@pm/events`.
- **Backpressure on the in-process bus.** `EventEmitter.setMaxListeners(0)` removes the warning but doesn't actually bound queue size in the consumer's local queue (`queue: NotifyMsg[]`). At scale this is a memory growth risk. Not a P0 concern; logged for P2.
- **GH PAT in plaintext in remote URL** — Emmanuel asked me to leave it for now. Standing item.

## Bottom line

The audit caught two real production-impact bugs (missing partitions, silent NOTIFY drop) and one pool leak. Both production bugs were "tests pass locally and on CI" failures — exactly the false-negative class the audit was designed to surface. The code that ships out of P0 is materially more honest than the code that went in.
