# ADR-0001: Postgres-only day-1 stack

**Status:** Accepted (2026-05-01)

## Context

The architecture spec calls for an entity graph + append-only event log + capability registry + workflow runtime, plus eventual analytics + search projections. At scale, the natural stack is heterogeneous: Postgres + Kafka + ClickHouse + OpenSearch + Redis. At day-1, that's a five-component operational footprint with no users.

## Decision

**Postgres-only at day 1.** Every concern (graph, events, projections, registry, workflow) runs in a separate schema in the same Postgres instance. `LISTEN/NOTIFY` is the event bus. Postgres FTS handles search. Single projection-worker process.

## Consequences

**Positive:**

- One thing to operate locally and in any future deployment.
- Transactional consistency between graph writes and event-log appends — no dual-write problem at day 1.
- `LISTEN/NOTIFY` + `SELECT FOR UPDATE SKIP LOCKED` covers the queue patterns we need without pulling in Kafka.
- Migrations are a single `psql` script; no orchestration tools needed.

**Negative — accepted:**

- `LISTEN/NOTIFY` payload size limited to 8KB; we'll work around with row-id-only notifications and read-back from the events table.
- Postgres FTS lexer is English-only by default; will outgrow it eventually.
- Single instance = single point of failure. Acceptable until we have customers; then we add a streaming replica.

## Migration triggers (when to swap each piece)

- **Event bus → Kafka or Redpanda:** sustained > 10k events/sec, OR > 4 listening services on `LISTEN/NOTIFY`, OR cross-region needs.
- **Search → OpenSearch / Meilisearch:** FTS query p95 > 200ms, OR multilingual tenants, OR fuzzy / typo-tolerant search needed.
- **Analytics → ClickHouse:** dashboard query p95 > 100ms on tables > 10M rows, OR sustained analytical write throughput exceeds Postgres replica capacity.
- **Cache → Redis:** real session/lock/rate-limit needs that don't belong in the source-of-truth DB.

Each is a swap behind a stable interface in the corresponding `@pm/*` package. We do not rewrite consumers when we swap implementations.

## Alternatives considered

- **Kafka day-1.** Rejected: operational complexity (Zookeeper or KRaft, partitions, consumer offset management) without scale to justify it. Discipline is in the *interface*, not the implementation.
- **MongoDB / DynamoDB.** Rejected: graph-of-typed-edges queries, JSONB partial indexes, and `LISTEN/NOTIFY` are all Postgres strengths.
- **Neo4j for the graph.** Rejected: small ops community, operationally heavier; deep multi-hop traversal is not a day-1 need. `ltree` + recursive CTEs cover hierarchy; explicit edge tables cover relationships.
