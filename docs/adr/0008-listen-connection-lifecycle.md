# ADR-0008: LISTEN connection lifecycle + reconnection

**Status:** Accepted (2026-05-03, P0 audit)
**Mechanism:** Long-lived `pg.PoolClient` for LISTEN + reconnection on `error`/`end`
**Doc reference:** PG17 — [LISTEN](https://www.postgresql.org/docs/17/sql-listen.html), [UNLISTEN](https://www.postgresql.org/docs/17/sql-unlisten.html), [node-postgres pooling](https://node-postgres.com/features/pooling)

## Context

`PostgresEventStore` keeps one long-lived `pg.PoolClient` checked out as the LISTEN connection. NOTIFY arrives via that connection's `notification` event; we re-emit on an in-process `EventEmitter` that subscribers iterate.

The audit caught: if that connection drops (TCP reset, server restart, idle timeout from a poolside misconfig), we silently stop receiving NOTIFY. Subscribers continue iterating an EventEmitter that nobody is feeding, and they look healthy. False-negative class.

## Decision

Three layers of defense:

1. **`error` + `end` handler reconnects.** When the LISTEN client errors or ends, the store releases it, acquires a fresh PoolClient, re-issues `LISTEN` for every channel previously registered, and resumes routing. Subscribers don't re-`consume()`; they keep their iterators.
2. **Catch-up read backstops the gap.** Any event committed during the disconnect-window is durable in `events.events` already (NOTIFY is the wake-up, not the source of truth). When subscribers next call `consume()` — or if we add periodic re-catch-up — they pick up missed events from the watermark.
3. **`UNLISTEN` cleanup at close** — fail-safe per docs.

## What we rely on, with citation

### A1. UNLISTEN never errors on unknown channels

> "You can unlisten something you were not listening for; no warning or error will appear."
> — PG17 UNLISTEN § Notes

**What we rely on:** the store's `close()` method calls `UNLISTEN "<channel>"` for every channel it tracked, then `UNLISTEN *` defensively. Even if the channel was already unregistered (e.g. due to reconnection mid-close), no error.

### A2. Session end auto-clears registrations

> "At the end of each session, UNLISTEN * is automatically executed."
> — PG17 UNLISTEN § Notes

**What we rely on:** if the LISTEN client dies before we can `UNLISTEN`, we don't leak listener registrations. Session teardown handles it.

### A3. LISTEN takes effect at commit, even when issued autocommit

> "LISTEN takes effect at transaction commit."
> — PG17 LISTEN § Notes

**What we rely on:** we issue `LISTEN "<channel>"` outside any explicit transaction. node-postgres runs each `client.query()` as an autocommit statement, so the LISTEN registration lands as soon as `query()` resolves.

### A4. Pool clients can be released and re-acquired safely

> "node-postgres ships with built-in connection pooling via the pg-pool module. … The client pool allows you to have a reusable pool of clients you can check out, use, and return."
> — node-postgres pooling docs

**What we rely on:** when the LISTEN client errors, we call `release(err)` to evict it from the pool, then `pool.connect()` for a fresh one. The pool transparently provisions a new TCP connection.

## Failure modes we accept

- **Reconnection can't replay events that arrived during the gap via NOTIFY alone.** The catch-up read in `consume()` is what makes this OK at day 1 — we don't depend on NOTIFY for durability, only for low-latency wake-up. A periodic re-catch-up timer would tighten the gap further; logged as TODO.
- **Reconnect-on-error doesn't retry forever.** If the server is genuinely unreachable, attempts fail and we surface the error to subscribers via the iterator. That's correct: a fully-down database should be a loud failure, not a silent NOTIFY stall.

## Pinning test

`packages/events/src/postgres.test.ts` → "LISTEN client reconnects after the underlying connection is terminated" — terminates the LISTEN backend via `pg_terminate_backend(pid)`, then publishes an event, asserts a subscriber still receives it.
