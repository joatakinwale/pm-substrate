# ADR-0005: events table range partitioning + missing-partition failure mode

**Status:** Accepted (2026-05-03, P0 audit)
**Mechanism:** Declarative range partitioning on `events.events` keyed by `recorded_at`
**Doc reference:** PostgreSQL 17 — [Table Partitioning](https://www.postgresql.org/docs/17/ddl-partitioning.html)

## Context

`events.events` is `PARTITION BY RANGE (recorded_at)`, with monthly partitions bootstrapped manually in migration `0003_events_layer.sql` for 2026-05, 2026-06, 2026-07. The architecture treats this as enabling cheap detach + cold-storage archival of old months.

## The failure mode the audit caught

PG range partitioning has no implicit catch-all. If a row's partition key falls outside any declared partition, INSERT raises:

```
ERROR:  no partition of relation "events" found for row
DETAIL:  Partition key of the failing row contains (recorded_at) = (2027-01-15 00:00:00+00).
```

Verified live during the audit (2026-05-03). **Without intervention, every `events.publish()` breaks at 2026-08-01 00:00 UTC** — three months from now.

## Decision

Two-layer defense:

1. **`events_default` DEFAULT partition** as a catch-all safety net. From PG17 docs: a default partition stores rows that don't match any other partition. **Trade-off:** when we `ATTACH` a new partition, PG must scan the default to verify no row belongs in the new partition. Expensive at scale; cheap at day-1 sizes.
2. **Application-level `ensureMonthPartition()` hook** in `@pm/events`. Before each `publish()`, the publisher checks (cached) whether the current month's partition exists; if not, it issues `CREATE TABLE IF NOT EXISTS ... PARTITION OF events.events FOR VALUES FROM ... TO ...` once. Idempotent, no lock contention after first call.

Combined: even if the application hook fails or a backdated insert lands, the row still finds a home in `events_default`, and the system stays writable.

## What we rely on, with citation

> "Range Partitioning … Each range's bounds are understood as being inclusive at the lower end and exclusive at the upper end."
> — PG17 § 5.12.1

**Implication:** `FROM ('2026-05-01') TO ('2026-06-01')` includes 2026-05-01 00:00:00 and excludes 2026-06-01 00:00:00. Our auto-provisioner uses the same convention.

> "Updating the partition key of a row will cause it to be moved into a different partition…"
> — PG17 § 5.12.2

**What we rely on:** we never UPDATE `recorded_at`. Append-only by design. Confirmed in code review: no UPDATE statement in `@pm/events` touches `recorded_at`.

## Pinning tests

- `packages/events/src/partitions.test.ts` (new): writes an event with `recorded_at` in a future month not yet partitioned, asserts that auto-provisioning creates the partition and the row lands in it (not the default).
- Same test inserts with a far-future `recorded_at` past the auto-provisioner's lookahead, asserts the row lands in `events_default` (safety net) — not an error.

## Migration triggers

- Move to `pg_partman` or a periodic substrate job for partition management when one of: (a) we have > 12 months of partitions, (b) cold-storage detach becomes a cost concern, (c) the auto-provisioner is firing > 1 partition CREATE per month.
