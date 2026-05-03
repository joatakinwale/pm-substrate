/**
 * Postgres-backed entity graph. Day-1 implementation of Layer 1.
 *
 * Design notes:
 *   - Every mutation accepts an optional `pg.ClientBase` (`tx`). When supplied,
 *     the write runs on the caller's transaction and the caller owns
 *     BEGIN/COMMIT/ROLLBACK. This is what lets the workflow runtime / a
 *     capability provider commit a graph mutation + an event publish in a
 *     single tx, satisfying the architecture's Layer 1↔Layer 2 atomicity rule.
 *
 *   - When no `tx` is passed, the adapter takes a connection from the pool
 *     and runs the statement standalone (no implicit transaction). This is
 *     fine because each individual write is a single statement and Postgres
 *     guarantees row-level atomicity per statement.
 *
 *   - Edges are tombstoned (`deleted_at`) rather than hard-deleted. Audit log
 *     and time-travel queries depend on it. Indexes filter `WHERE deleted_at
 *     IS NULL` so live queries don't pay a tombstone tax.
 */

import { randomUUID } from "node:crypto";
import type {
  Edge,
  EdgeId,
  EntityId,
  NodeBase,
  ProfileBinding,
  TenantId,
  Tier1TypeName,
  Timestamp,
} from "@pm/types";
import pg from "pg";
import { NotFoundError, OptimisticConcurrencyError } from "./errors.js";
import type {
  CreateEdgeInput,
  CreateNodeInput,
  Graph,
  UpdateNodeInput,
} from "./interfaces.js";

interface NodeRow {
  id: string;
  tenant_id: string;
  tier1: string;
  profile: string | null;
  concrete: string;
  schema_version: number;
  identity: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface EdgeRow {
  id: string;
  tenant_id: string;
  type: string;
  from_id: string;
  to_id: string;
  attrs: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const rowToNode = (r: NodeRow): NodeBase => ({
  id: r.id as EntityId,
  tenantId: r.tenant_id as TenantId,
  profile: {
    tier1: r.tier1 as Tier1TypeName,
    profile: r.profile,
    concrete: r.concrete,
  } satisfies ProfileBinding,
  schemaVersion: r.schema_version,
  identity: r.identity ?? {},
  createdAt: r.created_at.toISOString() as Timestamp,
  updatedAt: r.updated_at.toISOString() as Timestamp,
});

const rowToEdge = (r: EdgeRow): Edge => ({
  id: r.id as EdgeId,
  tenantId: r.tenant_id as TenantId,
  type: r.type,
  fromId: r.from_id as EntityId,
  toId: r.to_id as EntityId,
  attrs: r.attrs ?? {},
  createdAt: r.created_at.toISOString() as Timestamp,
  updatedAt: r.updated_at.toISOString() as Timestamp,
});

/**
 * `Querier` is the lowest common shape between `pg.Pool` and `pg.PoolClient` /
 * `pg.ClientBase`. Both have `.query(text, params)`. Using this shape lets
 * the adapter run a statement either standalone (pool) or inside a caller's
 * transaction (client), with no code duplication.
 */
type Querier = Pick<pg.ClientBase, "query"> | pg.Pool;

export class PostgresGraph implements Graph {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  // -------------------------------------------------------------------------
  // Reader
  // -------------------------------------------------------------------------

  async getNode(
    tenantId: TenantId,
    id: EntityId,
    tx?: pg.ClientBase,
  ): Promise<NodeBase | null> {
    const q = this.#q(tx);
    const r = await q.query<NodeRow>(
      `SELECT id, tenant_id, tier1, profile, concrete, schema_version,
              identity, created_at, updated_at
         FROM graph.nodes
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, id],
    );
    return r.rows[0] ? rowToNode(r.rows[0]) : null;
  }

  async outgoingEdges(
    tenantId: TenantId,
    fromId: EntityId,
    edgeType: string,
    tx?: pg.ClientBase,
  ): Promise<readonly Edge[]> {
    const q = this.#q(tx);
    const r = await q.query<EdgeRow>(
      `SELECT id, tenant_id, type, from_id, to_id, attrs,
              created_at, updated_at, deleted_at
         FROM graph.edges
        WHERE tenant_id = $1 AND from_id = $2 AND type = $3
          AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
      [tenantId, fromId, edgeType],
    );
    return r.rows.map(rowToEdge);
  }

  async incomingEdges(
    tenantId: TenantId,
    toId: EntityId,
    edgeType: string,
    tx?: pg.ClientBase,
  ): Promise<readonly Edge[]> {
    const q = this.#q(tx);
    const r = await q.query<EdgeRow>(
      `SELECT id, tenant_id, type, from_id, to_id, attrs,
              created_at, updated_at, deleted_at
         FROM graph.edges
        WHERE tenant_id = $1 AND to_id = $2 AND type = $3
          AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
      [tenantId, toId, edgeType],
    );
    return r.rows.map(rowToEdge);
  }

  // -------------------------------------------------------------------------
  // Writer
  // -------------------------------------------------------------------------

  async createNode(
    input: CreateNodeInput,
    tx?: pg.ClientBase,
  ): Promise<NodeBase> {
    const id = `ent_${randomUUID()}`;
    const q = this.#q(tx);
    const r = await q.query<NodeRow>(
      `INSERT INTO graph.nodes
        (id, tenant_id, tier1, profile, concrete, schema_version, identity)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id, tenant_id, tier1, profile, concrete, schema_version,
                 identity, created_at, updated_at`,
      [
        id,
        input.tenantId,
        input.profile.tier1,
        input.profile.profile,
        input.profile.concrete,
        input.schemaVersion,
        JSON.stringify(input.identity ?? {}),
      ],
    );
    return rowToNode(r.rows[0]!);
  }

  async updateNode(
    input: UpdateNodeInput,
    tx?: pg.ClientBase,
  ): Promise<NodeBase> {
    const q = this.#q(tx);
    const r = await q.query<NodeRow>(
      `UPDATE graph.nodes
          SET identity       = $4::jsonb,
              schema_version = schema_version + 1,
              updated_at     = now()
        WHERE tenant_id = $1 AND id = $2 AND schema_version = $3
        RETURNING id, tenant_id, tier1, profile, concrete, schema_version,
                  identity, created_at, updated_at`,
      [
        input.tenantId,
        input.id,
        input.expectedSchemaVersion,
        JSON.stringify(input.identity ?? {}),
      ],
    );
    if (r.rows[0]) return rowToNode(r.rows[0]);

    // Distinguish "not found" from "stale read".
    const cur = await this.getNode(input.tenantId, input.id, tx);
    if (!cur) throw new NotFoundError("node", input.id);
    throw new OptimisticConcurrencyError(
      input.id,
      input.expectedSchemaVersion,
      cur.schemaVersion,
    );
  }

  async createEdge(
    input: CreateEdgeInput,
    tx?: pg.ClientBase,
  ): Promise<Edge> {
    const id = `edg_${randomUUID()}`;
    const q = this.#q(tx);
    const r = await q.query<EdgeRow>(
      `INSERT INTO graph.edges
        (id, tenant_id, type, from_id, to_id, attrs)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, tenant_id, type, from_id, to_id, attrs,
                 created_at, updated_at, deleted_at`,
      [
        id,
        input.tenantId,
        input.type,
        input.fromId,
        input.toId,
        JSON.stringify(input.attrs ?? {}),
      ],
    );
    return rowToEdge(r.rows[0]!);
  }

  async deleteEdge(
    tenantId: TenantId,
    id: EdgeId,
    tx?: pg.ClientBase,
  ): Promise<void> {
    const q = this.#q(tx);
    const r = await q.query(
      `UPDATE graph.edges
          SET deleted_at = now(),
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [tenantId, id],
    );
    if (r.rowCount === 0) {
      throw new NotFoundError("edge", id);
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Resolve a `Querier`. If a transactional client is passed, use it; else
   * the pool. Both share the `.query()` shape.
   */
  #q(tx?: pg.ClientBase): Querier {
    return (tx as Querier | undefined) ?? this.#pool;
  }
}
