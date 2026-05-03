import type {
  EntityId,
  EventId,
  PMEvent,
  Subscription,
  TenantId,
  Timestamp,
} from "@pm/types";

/**
 * Append a single event. The substrate fills `id`, `recordedAt`, and the
 * causation chain. MUST be transactional with the originating graph mutation.
 */
export interface EventPublisher {
  publish(input: PublishInput): Promise<PMEvent>;
}

/**
 * Read events for time-travel queries and projection rebuild.
 */
export interface EventReader {
  read(query: ReadQuery): Promise<readonly PMEvent[]>;
  getById(tenantId: TenantId, id: EventId): Promise<PMEvent | null>;
}

/**
 * Declarative subscription registry + routing. Subscribers register what they
 * care about; the router fans out only matching events. Day-1 backed by
 * LISTEN/NOTIFY for low-latency, with read-back from the events table for
 * catch-up and for payloads larger than NOTIFY's 8KB limit.
 */
export interface SubscriptionRouter {
  subscribe(sub: Subscription): Promise<void>;
  unsubscribe(tenantId: TenantId, subscriberId: string): Promise<void>;
  consume(tenantId: TenantId, subscriberId: string): AsyncIterable<PMEvent>;
}

export interface PublishInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly entityId: EntityId;
  readonly emittedBy: string;
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt?: Timestamp;
  readonly causedBy?: EventId | null;
}

export interface ReadQuery {
  readonly tenantId: TenantId;
  /** Glob pattern: "task.*", "*.created", "task.completed". */
  readonly typePattern: string;
  readonly entityId?: EntityId;
  /** ISO-8601 inclusive lower bound on `occurredAt`. */
  readonly since?: Timestamp;
  /** ISO-8601 exclusive upper bound on `occurredAt`. */
  readonly until?: Timestamp;
  /**
   * Exclusive lower bound on `recordedAt`. Used by projection cursors and
   * other replay machinery that need monotonic, server-assigned ordering.
   * Distinct from `since`/`until` which filter by `occurredAt` (which can
   * be caller-supplied and out-of-order).
   *
   * Accepts a raw string (not a `Timestamp` brand) because callers typically
   * pass `recorded_at::text` straight from the DB to preserve microsecond
   * precision — round-tripping through JS `Date` truncates to milliseconds
   * and breaks boundary semantics.
   */
  readonly afterRecordedAt?: string;
  /** Default 1000. */
  readonly limit?: number;
}
