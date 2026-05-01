/**
 * @pm/projections — Read-model projection workers.
 *
 * Phase 0: interface only. Single worker process implementation follows.
 *
 * Architecture rule (architecture.md, Layer 2 + Performance #4 — cross-tenant query):
 *   CQRS. Graph = source of truth (writes). Analytics, dashboards, and tools
 *   needing fast reads consume *materialized views* projected from the event
 *   stream. Tools needing consistency query the graph directly.
 *
 * A projection is a deterministic, replayable function from the event stream
 * to a read-model. Rebuilds are cheap and idempotent — the only state a
 * projection holds is its position in the event log.
 */

import type {
  PMEvent,
  TenantId,
} from "@pm/types";

export interface Projection<TState = unknown> {
  /** Stable name of the projection. Used as the read-model identifier. */
  readonly name: string;

  /** Schema version of the projection's read-model. Bump on breaking changes; triggers a rebuild. */
  readonly version: number;

  /**
   * Event-type patterns this projection consumes. Used to register the
   * underlying subscription with the SubscriptionRouter.
   */
  readonly consumes: readonly string[];

  /**
   * Apply an event to the projection's state. Pure function: same (state, event)
   * MUST yield the same next state.
   */
  apply(state: TState, event: PMEvent): TState | Promise<TState>;

  /**
   * Initial state for a new tenant. Called once when a projection is first
   * installed, and on rebuild.
   */
  initial(tenantId: TenantId): TState;
}

export interface ProjectionRunner {
  /**
   * Register a projection with the runtime. Idempotent on (name, version).
   * If the version changes, the runtime will rebuild from event-log start.
   */
  register<TState>(projection: Projection<TState>): Promise<void>;

  /**
   * Run a single projection until it has consumed all currently available
   * events. For tests + manual catch-up.
   */
  catchUp(tenantId: TenantId, name: string): Promise<void>;

  /**
   * Rebuild a projection from event-log start. Used after schema-version bumps
   * or on operator demand.
   */
  rebuild(tenantId: TenantId, name: string): Promise<void>;
}

// TODO(phase-0):
//   - Single worker process that subscribes via @pm/events SubscriptionRouter
//   - Per-projection cursor stored in `projections.cursors` table
//   - Read-model storage convention: `projections.{projection_name}_v{N}` table per tenant or shared with tenant_id PK
//   - Graceful handling of replay during version bump (write to v(N+1), cut over, drop v(N))
