# ADR-0004: pg_notify / LISTEN semantics we rely on

**Status:** Accepted (2026-05-03, P0 audit)
**Mechanism:** `NOTIFY` / `LISTEN` / `pg_notify`
**Doc reference:** PostgreSQL 17 — [NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html), [LISTEN](https://www.postgresql.org/docs/17/sql-listen.html)

## Assumptions we rely on, with citation

### A1. NOTIFY is transactional

> "Firstly, if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed. … Secondly, if a listening session receives a notification signal while it is within a transaction, the notification event will not be delivered to its connected client until just after the transaction is completed."
> — PG17 NOTIFY docs

**What we rely on:** `events.publishWith(tx)` followed by a graph mutation in the same tx commits or rolls back atomically. A rollback after `pg_notify` undoes the notification — no listener sees it.
**Pinning test:** `packages/events/src/postgres.test.ts` → "rolls back NOTIFY when the caller's transaction rolls back".

### A2. Payload limit is 8000 bytes

> "In the default configuration it must be shorter than 8000 bytes."
> — PG17 NOTIFY § Parameters

**What we rely on:** keeping NOTIFY payloads tiny (id + tenant + type, well under 200 bytes). Subscribers fetch the full event row from `events.events` by id. Code comments previously called this "8KB" — corrected to **8000 bytes** in `packages/events/src/postgres.ts`.

### A3. Identical payloads on the same channel within one transaction are coalesced

> "If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered to listeners."
> — PG17 NOTIFY

**What we rely on:** every published event gets a unique `evt_<uuid>` id, so payloads (which include the id) are always distinct. We are NOT relying on coalescing as a feature, but we are also not vulnerable to it.

### A4. Same-transaction NOTIFY ordering preserved

> "NOTIFY guarantees that notifications from the same transaction get delivered in the order they were sent. It is also guaranteed that messages from different transactions are delivered in the order in which the transactions committed."
> — PG17 NOTIFY

**What we rely on:** projection cursor advance + workflow runtime can assume causal ordering of NOTIFY arrivals matches commit order — important for `causedBy` chains.

### A5. LISTEN takes effect at commit; rollback undoes it

> "LISTEN takes effect at transaction commit. If LISTEN or UNLISTEN is executed within a transaction that later rolls back, the set of notification channels being listened to is unchanged."
> — PG17 LISTEN § Notes

**What we rely on:** `PostgresEventStore.#ensureListening` calls `LISTEN` on a pooled connection. If the implicit single-statement transaction succeeds, the listener is registered. We do not LISTEN inside an outer transaction.

### A6. Late-listener race window is bounded

> "There is a race condition when first setting up a listening session: … the session will receive all events committed after an instant during the transaction's commit step."
> — PG17 LISTEN § Notes

**What we rely on:** `consume()` runs a **catch-up read** before yielding live LISTEN events, reading rows past the subscriber's last-acked watermark. This bounds the race: any event committed before `LISTEN` took effect is picked up by catch-up; events committed after are picked up by NOTIFY. The seam is the watermark.
**Pinning test:** `packages/projections/src/postgres.test.ts` → "catchUp resumes from cursor after additional events arrive".

## Failure modes we accept

- **NOTIFY queue overflow** (8GB default, monitored via `pg_notification_queue_usage`). If a long-running listener stalls, all NOTIFY-sending transactions eventually fail at commit. Migration trigger to a real broker is documented in ADR-0001.
- **2PC incompatibility:** "A transaction that has executed NOTIFY cannot be prepared for two-phase commit." We never use 2PC; logged so we don't accidentally introduce it.
