/**
 * @pm/events — Append-only event log + LISTEN/NOTIFY router.
 *
 * Phase 0: interface only. Postgres LISTEN/NOTIFY implementation follows.
 *
 * Architecture rule (architecture.md, Layer 2):
 *   Append-only. Topic-scoped streams (tenant + entity type).
 *   Declarative subscriptions. Time-travel queries free.
 */

import type {
  EventId,
  PMEvent,
  Subscription,
  TenantId,
  Timestamp,
} from "@pm/types";

export interface EventPublisher {
  /**
   * Append an event to the log. The substrate fills id, recordedAt, and the
   * causation chain if `causedBy` was set on the input.
   *
   * MUST be transactional with the corresponding graph mutation that triggered it.
   * Day-1 implementation: same Postgres connection, both writes in one BEGIN/COMMIT.
   */
  publish(input: PublishInput): Promise<PMEvent>;
}

export interface EventReader {
  /**
   * Read events for a tenant matching a type pattern (glob: "task.*", "*.created").
   * Used for time-travel queries and projection rebuild.
   */
  read(query: ReadQuery): Promise<readonly PMEvent[]>;

  /**
   * Read a single event by ID, for causation-chain following.
   */
  getById(tenantId: TenantId, id: EventId): Promise<PMEvent | null>;
}

export interface SubscriptionRouter {
  /**
   * Register a declarative subscription. Tools call this at startup; the router
   * persists it and routes matching events to the subscriber.
   */
  subscribe(sub: Subscription): Promise<void>;

  /**
   * Cancel a subscription.
   */
  unsubscribe(tenantId: TenantId, subscriberId: string): Promise<void>;

  /**
   * The subscriber's main loop. Returns an async iterable of events matching
   * its registered subscriptions. Day-1 backed by Postgres LISTEN/NOTIFY +
   * read-back from the events table.
   */
  consume(
    tenantId: TenantId,
    subscriberId: string,
  ): AsyncIterable<PMEvent>;
}

export interface PublishInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly entityId: import("@pm/types").EntityId;
  readonly emittedBy: string;
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt?: Timestamp;
  readonly causedBy?: EventId | null;
}

export interface ReadQuery {
  readonly tenantId: TenantId;
  readonly typePattern: string;
  readonly entityId?: import("@pm/types").EntityId;
  /** ISO-8601 inclusive lower bound on `occurredAt`. */
  readonly since?: Timestamp;
  /** ISO-8601 exclusive upper bound on `occurredAt`. */
  readonly until?: Timestamp;
  /** Cap. Day-1 default 1000. */
  readonly limit?: number;
}

// TODO(phase-0):
//   - Postgres adapter using LISTEN/NOTIFY for low-latency fan-out
//   - Read-back from events table when NOTIFY payload exceeds 8KB
//   - Subscription persistence in `events.subscriptions` table
//   - Backpressure: subscribers that fall behind don't lose events; they catch up
//     by reading from the events table from their last-acknowledged event
