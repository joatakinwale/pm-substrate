import type {
  Edge,
  EdgeId,
  EntityId,
  NodeBase,
  ProfileBinding,
  TenantId,
} from "@pm/types";
import type {
  GraphWriteAuthorityRef,
  GraphWriteAuthoritySubstrateRecord,
} from "./write-authority.js";

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

/**
 * Result returned by createNode.
 * - `created: true`  — a new node was inserted (HTTP 201).
 * - `created: false` — the supplied id already existed for this tenant and
 *   the profile/type matches. The existing node is returned unchanged (HTTP 200).
 */
export interface CreateNodeResult {
  readonly node: NodeBase;
  readonly created: boolean;
}

export interface GraphWriter {
  /**
   * Create a node, optionally with a caller-supplied UUID.
   *
   * When `input.id` is provided:
   *   - Must be a valid UUID. Rejects with `InvalidIdError` otherwise.
   *   - If a node with that id already exists **in this tenant** and its
   *     profile/type matches, returns `{ node, created: false }` (idempotent).
   *   - If a node with that id already exists but its profile/type differs,
   *     throws `NodeConflictError` (HTTP 409).
   *
   * When `input.id` is omitted:
   *   - Server generates a unique id. Behaviour is identical to the pre-P2.3a
   *     contract: always returns `{ node, created: true }`.
   */
  createNode(input: CreateNodeInput): Promise<CreateNodeResult>;

  /**
   * Optimistic concurrency: caller passes the schemaVersion they read.
   * Throws OptimisticConcurrencyError if it doesn't match the current row.
   */
  updateNode(input: UpdateNodeInput): Promise<NodeBase>;

  createEdge(input: CreateEdgeInput): Promise<Edge>;

  /** Tombstone (not hard-delete). Audit + time-travel depend on it. */
  deleteEdge(
    tenantId: TenantId,
    id: EdgeId,
    writeAuthorityRef?: GraphWriteAuthorityRef,
    writeAuthoritySubstrateRecord?: GraphWriteAuthoritySubstrateRecord,
  ): Promise<void>;
}

export interface CreateNodeInput {
  readonly tenantId: TenantId;
  /**
   * Optional caller-supplied node ID. Must be a valid UUID (v1–v5 or nil).
   * When omitted the substrate generates one. See `GraphWriter.createNode`
   * for the full idempotency semantics.
   */
  readonly id?: string;
  readonly profile: ProfileBinding;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
  readonly writeAuthorityRef?: GraphWriteAuthorityRef;
  readonly writeAuthoritySubstrateRecord?: GraphWriteAuthoritySubstrateRecord;
}

export interface UpdateNodeInput {
  readonly tenantId: TenantId;
  readonly id: EntityId;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly expectedSchemaVersion: number;
  readonly writeAuthorityRef?: GraphWriteAuthorityRef;
  readonly writeAuthoritySubstrateRecord?: GraphWriteAuthoritySubstrateRecord;
}

export interface CreateEdgeInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly writeAuthorityRef?: GraphWriteAuthorityRef;
  readonly writeAuthoritySubstrateRecord?: GraphWriteAuthoritySubstrateRecord;
}

export interface Graph extends GraphReader, GraphWriter {}
