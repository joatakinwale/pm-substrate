import type {
  EdgeId,
  EntityId,
  TenantId,
  Timestamp,
} from "./common.js";

/**
 * Typed edge in the entity graph.
 *
 * Architecture rule (architecture.md, Layer 1):
 *   Everything contextual rides on typed edges.
 *
 * Edge type names are profile-declared (e.g., "has_invoice", "employs",
 * "scheduled_for"). The substrate does not know the catalog of edge types;
 * it stores them, indexes them, and routes queries against them.
 *
 * Cardinality and constraints (e.g., "Wedding has_principal exactly 2")
 * are enforced at the profile layer, not here.
 */
export interface Edge {
  readonly id: EdgeId;
  readonly tenantId: TenantId;

  /** Direction matters. Edge type is profile-declared. */
  readonly type: string;
  readonly fromId: EntityId;
  readonly toId: EntityId;

  /**
   * Optional small payload travelling with the edge.
   * Discipline: if your edge needs more than identifying attributes
   * (e.g., a role tag, a cardinality position), put it here.
   * If it needs more than that, it probably should be a node.
   */
  readonly attrs: Readonly<Record<string, unknown>>;

  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
