import type { CapabilityId, TenantId } from "@pm/types";

/**
 * A registered capability. Tools register declaratively at install time;
 * the substrate uses these declarations to (a) validate workflows reference
 * existing capabilities and (b) wire SubscriptionRouter automatically.
 */
export interface Capability {
  readonly id: CapabilityId;

  /** Stable name, globally unique. Convention: "<profile>/<role>" or "common/<role>". */
  readonly name: string;
  readonly version: number;

  /** Tier-1 interface shapes the capability reads/writes. */
  readonly readsInterfaces: readonly string[];
  readonly writesInterfaces: readonly string[];

  /** Edge types this capability uses. */
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];

  /** Event types this capability emits. */
  readonly emits: readonly string[];

  /** Event-type patterns the capability subscribes to. */
  readonly subscribesTo: readonly string[];

  /** Permission strings (grammar TBD in Phase 1+). */
  readonly requiredPermissions: readonly string[];

  readonly description: string;
}

export interface Registry {
  /**
   * Register or upgrade a capability. Idempotent on (tenantId, name, version):
   * re-registering the same triple updates the descriptor in place.
   * Registering a new version of an existing name leaves prior versions in
   * place (multiple versions can coexist; the workflow layer pins to one).
   */
  register(tenantId: TenantId, capability: Capability): Promise<void>;

  /** Unregister a capability by name (all versions). */
  unregister(tenantId: TenantId, name: string): Promise<void>;

  /**
   * Look up a capability by name. If multiple versions are registered,
   * returns the highest. (Workflows should pin a specific version explicitly.)
   */
  get(tenantId: TenantId, name: string): Promise<Capability | null>;

  /** Look up a specific (name, version). */
  getVersion(
    tenantId: TenantId,
    name: string,
    version: number,
  ): Promise<Capability | null>;

  /** Enumerate all capabilities for a tenant (latest version of each name). */
  list(tenantId: TenantId): Promise<readonly Capability[]>;

  /**
   * Reverse index: capabilities whose subscribesTo patterns match the given
   * concrete event type. Used by the workflow runtime + SubscriptionRouter
   * to fan out events to interested capabilities at install time.
   */
  subscribersOf(
    tenantId: TenantId,
    eventType: string,
  ): Promise<readonly Capability[]>;
}
