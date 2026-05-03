import type { PMEvent, TenantId } from "@pm/types";

/**
 * A projection is a deterministic, replayable function from the event stream
 * to a read-model. The runtime keeps a cursor per (tenant, projection,
 * projection_version); bumping the version triggers a rebuild from log start.
 */
export interface Projection<TState = unknown> {
  readonly name: string;
  readonly version: number;
  /** Event-type glob patterns this projection consumes. */
  readonly consumes: readonly string[];

  apply(state: TState, event: PMEvent): TState | Promise<TState>;
  initial(tenantId: TenantId): TState;
}

export interface ProjectionRunner {
  register<TState>(projection: Projection<TState>): Promise<void>;

  /** Run the projection forward until it consumes all currently-available events. */
  catchUp(tenantId: TenantId, name: string): Promise<void>;

  /** Rebuild from log start. Cursor is reset, state re-derived from initial(). */
  rebuild(tenantId: TenantId, name: string): Promise<void>;

  /** Inspect the current materialized state (after catchUp). */
  getState<TState>(
    tenantId: TenantId,
    name: string,
  ): Promise<TState | null>;
}
