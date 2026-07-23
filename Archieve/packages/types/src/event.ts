import type {
  EntityId,
  EventId,
  TenantId,
  Timestamp,
} from "./common.js";

/**
 * Append-only event in the substrate event log.
 *
 * Architecture rule (architecture.md, Layer 2):
 *   Append-only. Topic-scoped streams (tenant + entity type).
 *   Tools subscribe declaratively; the router only fans out to
 *   interested subscribers.
 *
 * Event types are profile-declared and capability-declared. The substrate
 * stores, partitions, and routes — it does not enumerate.
 *
 * Time-travel queries are supported by reading the event log at a given
 * timestamp; projections are rebuilt from the log on demand.
 */
export interface PMEvent {
  readonly id: EventId;
  readonly tenantId: TenantId;

  /**
   * Dotted, capability-declared event type:
   *   "task.created" | "task.completed" | "milestone.due" | "payment.requested" | ...
   */
  readonly type: string;

  /**
   * The entity this event is about. The router partitions by (tenant, entity-type)
   * — derived from the entity's profile binding — for topic-scoped fan-out.
   */
  readonly entityId: EntityId;

  /**
   * Capability that emitted this event. Used by audit and by the workflow runtime
   * to attribute side effects.
   */
  readonly emittedBy: string;

  /**
   * Schema-versioned payload. The capability-registry entry for `emittedBy`
   * declares the schema; consumers branch on `payloadSchema` if needed.
   */
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;

  /**
   * Event-envelope schema version. Distinct from payloadSchema: this versions
   * the substrate's chain-of-custody metadata, not the capability payload.
   */
  readonly schemaVersion: number;

  /** Capability/permission/external authority under which the event was admitted. */
  readonly authority: string | null;

  /** sha256 over canonical event envelope fields. */
  readonly contentHash: string | null;

  /** contentHash of the immediately prior recorded tenant event, if one exists. */
  readonly priorEventHash: string | null;

  /** Wall-clock time the event was recorded. */
  readonly occurredAt: Timestamp;
  readonly recordedAt: Timestamp;

  /**
   * Causation chain. If this event was emitted in response to another event
   * (workflow runtime side-effect, capability cascade), `causedBy` points
   * at the prior event. Null for events with external triggers.
   */
  readonly causedBy: EventId | null;
}

/**
 * Subscription declaration — a tool or projection registers its interest
 * in a slice of the event stream.
 */
export interface Subscription {
  readonly tenantId: TenantId;
  readonly subscriberId: string;
  readonly eventTypePattern: string;
  readonly entityTypeFilter: string | null;
}
