/**
 * @pm/registry — Capability registry.
 *
 * Phase 0: interface only.
 *
 * Architecture rule (architecture.md, Layer 3):
 *   Tools register as capability providers. They declare what nodes/edges
 *   they read, what events they emit, what permissions they require.
 *   "Integration" stops existing as a concept.
 */

import type {
  CapabilityId,
  TenantId,
} from "@pm/types";

export interface Capability {
  readonly id: CapabilityId;

  /**
   * Stable name. Globally unique across all tenants.
   * Examples: "wedding/planner-task", "wedding/gcal-projection",
   *           "wedding/vendor-milestone", "common/audit-log".
   */
  readonly name: string;

  /** Capability schema version. Bumped on breaking changes. */
  readonly version: number;

  /**
   * Tier-1 declared interfaces this capability binds to. Profile-agnostic.
   * Example: "Counterparty[email,name,createdAt]" — declares the *shape*
   * required, not the concrete profile type.
   */
  readonly readsInterfaces: readonly string[];
  readonly writesInterfaces: readonly string[];

  /**
   * Edge types this capability uses. Profile-declared names ("has_invoice",
   * "scheduled_for") — but a capability written against Tier-1 SHOULD use
   * declared edge-type interfaces, not concrete profile names. ADR-TBD.
   */
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];

  /**
   * Event types this capability emits.
   * Example: ["task.created", "task.updated", "task.completed"]
   */
  readonly emits: readonly string[];

  /**
   * Event-type patterns this capability subscribes to (used to wire the
   * SubscriptionRouter automatically at install time).
   */
  readonly subscribesTo: readonly string[];

  /**
   * Permissions this capability requires. Format intentionally string-typed
   * for now; will get a proper permission grammar in Phase 1+.
   */
  readonly requiredPermissions: readonly string[];

  /** Free-form description for tooling and operator dashboards. */
  readonly description: string;
}

export interface Registry {
  /**
   * Register or upgrade a capability. Tools call this at install time
   * (per-tenant) or at startup (per-deployment). Idempotent on (name, version).
   */
  register(tenantId: TenantId, capability: Capability): Promise<void>;

  /**
   * Look up a capability by name within a tenant scope.
   */
  get(
    tenantId: TenantId,
    name: string,
  ): Promise<Capability | null>;

  /**
   * Enumerate all capabilities installed for a tenant. Used by the workflow
   * runtime to validate that a workflow's referenced capabilities are present.
   */
  list(tenantId: TenantId): Promise<readonly Capability[]>;

  /**
   * Reverse index: which capabilities subscribe to a given event type?
   * Used by the SubscriptionRouter for declarative auto-wiring.
   */
  subscribersOf(
    tenantId: TenantId,
    eventType: string,
  ): Promise<readonly Capability[]>;
}

// TODO(phase-0):
//   - Postgres adapter; capability rows stored in `registry.capabilities`
//   - Profile-aware validation: a capability declaring it reads `Engagement[title,scopeStart]`
//     must succeed against any profile whose Engagement specialization satisfies that shape
//   - Conflict detection: two capabilities declaring overlapping `writes` on the
//     same node attribute should warn at registration time, not at runtime
