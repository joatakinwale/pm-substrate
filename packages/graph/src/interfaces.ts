import type {
  Edge,
  EdgeId,
  EntityId,
  NodeBase,
  ProfileBinding,
  TenantId,
} from "@pm/types";

export interface GraphReader {
  /** Read a node, scoped to its tenant. Null if not found. */
  getNode(tenantId: TenantId, id: EntityId): Promise<NodeBase | null>;

  /** Outgoing edges of a given type from a node. */
  outgoingEdges(
    tenantId: TenantId,
    fromId: EntityId,
    edgeType: string,
  ): Promise<readonly Edge[]>;

  /** Incoming edges of a given type into a node. */
  incomingEdges(
    tenantId: TenantId,
    toId: EntityId,
    edgeType: string,
  ): Promise<readonly Edge[]>;
}

export interface GraphWriter {
  createNode(input: CreateNodeInput): Promise<NodeBase>;

  /**
   * Optimistic concurrency: caller passes the schemaVersion they read.
   * Throws OptimisticConcurrencyError if it doesn't match the current row.
   */
  updateNode(input: UpdateNodeInput): Promise<NodeBase>;

  createEdge(input: CreateEdgeInput): Promise<Edge>;

  /** Tombstone (not hard-delete). Audit + time-travel depend on it. */
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
  readonly expectedSchemaVersion: number;
}

export interface CreateEdgeInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly attrs: Readonly<Record<string, unknown>>;
}

export interface Graph extends GraphReader, GraphWriter {}
