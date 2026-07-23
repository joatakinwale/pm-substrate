# ADR-0007: ON CONFLICT semantics + Read Committed assumptions

**Status:** Accepted (2026-05-03, P0 audit)
**Mechanism:** `INSERT ... ON CONFLICT` + Read Committed isolation level
**Doc reference:** PG17 — [INSERT](https://www.postgresql.org/docs/17/sql-insert.html), [Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html)

## Context

Three substrate primitives lean on `ON CONFLICT` plus the default isolation level (Read Committed):

1. `@pm/registry`: `register()` uses `ON CONFLICT (tenant_id, name, version) DO UPDATE` for idempotent re-registration.
2. `@pm/workflow`: `runs` table uses `ON CONFLICT DO NOTHING` against a UNIQUE `(workflow_id, triggered_by)` for idempotent run starts (added in migration 0006).
3. `@pm/graph`: `updateNode` uses `WHERE schema_version = $expected` for optimistic concurrency.

## What we rely on, with citation

### A1. ON CONFLICT with multi-column conflict target works on UNIQUE constraints

> "ON CONFLICT can be used to specify an alternative action to raising a unique constraint or exclusion constraint violation error."
> — PG17 INSERT § Description

**What we rely on:** the conflict target `(tenant_id, name, version)` matches a declared UNIQUE constraint on the registry table; the workflow `(workflow_id, triggered_by)` UNIQUE was added in migration 0006 after the audit caught its absence.
**Pinning test:** `packages/workflow/src/postgres.test.ts` → "is idempotent: same trigger event re-delivered does not re-run" (3x re-fire → 1 run).

### A2. Read Committed handles concurrent ON CONFLICT cleanly

> "INSERT with an ON CONFLICT DO UPDATE clause behaves similarly. In Read Committed mode, each row proposed for insertion will either insert or update. Unless there are unrelated errors, one of those two outcomes is guaranteed."
> — PG17 § 13.2.1

**What we rely on:** under our default Read Committed isolation, two concurrent `register()` calls for the same `(tenant, name, version)` always result in exactly one row, with the second seeing the first's effects via DO UPDATE. We do NOT need Repeatable Read or Serializable.

> "INSERT with an ON CONFLICT DO NOTHING clause may have insertion not proceed for a row due to the outcome of another transaction whose effects are not visible to the INSERT snapshot."
> — PG17 § 13.2.1

**What we rely on:** workflow run-start under concurrent NOTIFY-driven dispatch — two consumers both calling `onEvent(eventId)` for the same trigger end up with exactly one `workflow.runs` row. The "loser" sees `rowCount = 0` and silently skips.

### A3. UPDATE ... WHERE col = val is safe optimistic concurrency under Read Committed

> "In Read Committed mode, … such a target row might have already been updated (or deleted or locked) by another concurrent transaction by the time it is found. In this case, the would-be updater will wait for the first updating transaction to commit or roll back. … If the first updater commits, … the search condition of the command (the WHERE clause) is re-evaluated to see if the updated version of the row still matches the search condition."
> — PG17 § 13.2.1

**What we rely on:** in `graph.updateNode(expectedSchemaVersion: N)`, when two concurrent updates target the same row both expecting version `N`, exactly one will succeed (its UPDATE finds version `N` after waiting for the first to commit, gets re-evaluated against version `N+1`, and the WHERE no longer matches → 0 rows updated). The losing update's caller sees `rowCount === 0`, falls through to a `getNode()` re-read, and throws `OptimisticConcurrencyError`.
**Pinning test:** `packages/graph/src/postgres.test.ts` → "optimistic concurrency: rejects stale schemaVersion".

## Failure modes we accept

- **Phantom reads under our default isolation are possible** but irrelevant: every read we care about is keyed on a unique row or already protected by `FOR UPDATE` (projection state catch-up).
- **Lost updates** are not possible because we always condition writes on `WHERE schema_version = $expected` rather than blind UPDATE; this is the optimistic-concurrency contract.
