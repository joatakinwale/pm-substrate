/**
 * @pm/graph — Entity graph API.
 *
 * Phase 0: interface only. Postgres adapter follows.
 *
 * Architecture rule (architecture.md, Layer 1):
 *   Nodes hold identity + stable attrs only. Everything contextual on typed edges.
 *   Per-tenant declared. Tools query edges they care about, not whole nodes.
 */

import type {
  Edge,
  EdgeId,
  EntityId,
  NodeBase,
  ProfileBinding,
  TenantId,
} from "@pm/types";

/**
 * The contract every graph implementation must satisfy. Postgres adapter
 * is the day-1 implementation; alternative adapters (Neo4j, in-memory for
 * tests) plug behind this interface without changing consumers.
 */
export interface GraphReader {
  /**
   * Read a node by ID, scoped to its tenant.
   * Returns null if the node does not exist OR is not visible to this tenant.
   */
  getNode(tenantId: TenantId, id: EntityId): Promise<NodeBase | null>;

  /**
   * Read all edges of a given type starting at `fromId`.
   * Pagination required at scale; day-1 returns up to 1000.
   */
  outgoingEdges(
    tenantId: TenantId,
    fromId: EntityId,
    edgeType: string,
  ): Promise<readonly Edge[]>;

  /**
   * Read all edges of a given type pointing at `toId`.
   */
  incomingEdges(
    tenantId: TenantId,
    toId: EntityId,
    edgeType: string,
  ): Promise<readonly Edge[]>;
}

export interface GraphWriter {
  /**
   * Create a new node. Substrate generates the ID; profile validates the shape.
   */
  createNode(input: CreateNodeInput): Promise<NodeBase>;

  /**
   * Update a node's identity bag. Caller MUST pass the schemaVersion they read,
   * or the write fails (optimistic concurrency).
   */
  updateNode(input: UpdateNodeInput): Promise<NodeBase>;

  /**
   * Create a typed edge. Substrate stores; profile validates cardinality.
   */
  createEdge(input: CreateEdgeInput): Promise<Edge>;

  /**
   * Delete an edge. Edges are tombstoned, not hard-deleted (audit log
   * + time-travel queries depend on it).
   */
  deleteEdge(tenantId: TenantId, id: EdgeId): Promise<void>;
}

export interface CreateNodeInput {
  readonly tenantId: TenantId;
  readonly profile: ProfileBinding;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
}

export interface UpdateNodeInput {
  readonly tenantId: TenantId;
  readonly id: EntityId;
  readonly identity: Readonly<Record<string, unknown>>;
  /** Must match the current row's schemaVersion. */
  readonly expectedSchemaVersion: number;
}

export interface CreateEdgeInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly attrs: Readonly<Record<string, unknown>>;
}

/**
 * Combined Reader + Writer surface — most consumers want both.
 */
export interface Graph extends GraphReader, GraphWriter {}

// TODO(phase-0):
//   - Postgres adapter implementation in ./postgres.ts
//   - Time-travel reader (asOf?: Timestamp) on the Reader interface
//   - Edge-type catalog accessor (the substrate stores types it has seen,
//     for diagnostics and for `pgweb`-style introspection)
