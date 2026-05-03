# ADR-0006: node-postgres driver assumptions + Querier abstraction

**Status:** Accepted (2026-05-03, P0 audit)
**Mechanism:** `pg` (node-postgres) Pool / Client / ClientBase / parameter coercion
**Doc reference:** [node-postgres queries docs](https://node-postgres.com/features/queries), PG17 [JSON types](https://www.postgresql.org/docs/17/datatype-json.html)

## Context

Every Postgres adapter (`@pm/graph`, `@pm/events`, `@pm/registry`, `@pm/projections`, `@pm/workflow`) accepts an optional caller-supplied `pg.ClientBase` for transactional writes. We unify pool and client behind a `Querier = Pick<pg.ClientBase, "query"> | pg.Pool` shape and route every statement through `q.query(...)`.

## What we rely on, with citation

### A1. Pool and Client share the `.query()` API surface

`pg.Pool.query(text, params)` and `pg.ClientBase.query(text, params)` accept identical inputs and return compatible result shapes. Both are documented as the canonical entry points; `Pool.query` "delegates directly" to a Client behind a checked-out connection.

**What we rely on:** the `Querier` union compiles and runs identically against either. Verified by tx-aware test paths in every adapter (e.g., `graph.createNode(input, tx)` in `@pm/graph` atomicity test).

### A2. Parameterized queries with `$N::jsonb` cast accept a JSON-encoded string

> "If a parameterized value has the toPostgres method then it will be called and its return value will be used in the query. … Otherwise if no toPostgres method is defined then JSON.stringify is called on the parameterized value."
> — node-postgres queries docs

**What we rely on:** we explicitly call `JSON.stringify(value ?? {})` for all JSONB parameters and use `$N::jsonb` in the SQL to coerce. This is belt-and-suspenders: if a future `pg` version changes default coercion, our code still produces a valid JSON literal. Used uniformly across all adapters.

### A3. Identifiers cannot be parameterized; channel names must be literal

> "PostgreSQL does not support parameters for identifiers."
> — node-postgres queries docs

**What we rely on:** `LISTEN "<channel>"` and `UNLISTEN "<channel>"` use string interpolation after sanitization in `channelFor()` (lowercase, `[a-z0-9_]` only, length-clamped to 63 chars — PG identifier limit). The sanitizer is the security-bearing line; documented in `packages/events/src/postgres.ts`.

### A4. Branded types vs DB string round-trip

JS `Date.toISOString()` rounds to **millisecond** precision. Postgres `TIMESTAMPTZ` stores **microsecond** precision. Round-tripping `recorded_at` through `Date` truncates and breaks `recorded_at > watermark` boundary semantics — caught and fixed in projections (commit `e4e77a5`).

**What we rely on now:** when a timestamp is used as a watermark for a `>` boundary filter, the cursor row stores `recorded_at` natively in Postgres and queries select it `::text` for verbatim round-trip. No JS Date in the path.

**Pinning test:** `packages/projections/src/postgres.test.ts` → "catchUp is idempotent: re-running with no new events is a no-op" (this was the test that surfaced the bug; would re-fail if the fix regresses).

## Failure modes we accept

- **Connection eviction during LISTEN.** `PostgresEventStore` keeps one long-lived connection from the pool for LISTEN. If the pool evicts it (e.g., max connection age), live events stop arriving until a subscriber re-`consume()`s. Day-1 mitigation: catch-up read on every `consume()` call backstops the LISTEN. Production-grade mitigation lands when we add `client.on('end')` reconnection — logged as TODO in `postgres.ts`.
- **Custom type parsers.** We do not register custom `pg-types` parsers; Postgres `TIMESTAMPTZ` arrives as `Date`. Anywhere we need microsecond fidelity we explicitly cast to text in SQL.
