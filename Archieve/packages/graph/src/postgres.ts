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
 *
 *   - Caller-supplied IDs (P2.3a, ADR-0011): `createNode` accepts an optional
 *     `id` field. If supplied and valid UUID, the INSERT uses ON CONFLICT DO
 *     NOTHING for idempotent upsert semantics. See ADR-0011.
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
import type { ProfileValidator } from "@pm/profile-registry";
import pg from "pg";
import {
  InvalidIdError,
  NodeConflictError,
  NotFoundError,
  OptimisticConcurrencyError,
} from "./errors.js";
import type {
  CreateEdgeInput,
  CreateNodeInput,
  CreateNodeResult,
  Graph,
  UpdateNodeInput,
} from "./interfaces.js";
import {
  assertGraphWriteAuthority,
  type GraphWriteAuthorityPolicy,
  type GraphWriteAuthorityRef,
  type GraphWriteAuthoritySubstrateRecord,
} from "./write-authority.js";

/**
 * UUID regex: covers v1–v5 and nil UUID (all-zeros). Case-insensitive.
 * Must be exactly 8-4-4-4-12 hex groups.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (s: string): boolean => UUID_RE.test(s);

const isGraphWriteAuthorityRef = (
  value: unknown,
): value is GraphWriteAuthorityRef =>
  typeof value === "object" &&
  value !== null &&
  (value as { readonly authorityKind?: unknown }).authorityKind ===
    "workflow_action_outcome_envelope";

const isGraphWriteAuthoritySubstrateRecord = (
  value: unknown,
): value is GraphWriteAuthoritySubstrateRecord =>
  typeof value === "object" &&
  value !== null &&
  (value as { readonly authorityKind?: unknown }).authorityKind ===
    "workflow_action_outcome_envelope" &&
  typeof (value as { readonly terminalOutcome?: unknown }).terminalOutcome ===
    "string" &&
  typeof (value as { readonly envelopeId?: unknown }).envelopeId === "string";

/**
 * Optional dependency on a profile validator. When supplied, every node
 * create/update + every edge create is checked against the tenant's
 * installed profiles BEFORE the SQL hits the DB.
 *
 * Pattern: caller passes a *factory* rather than a snapshot, so the graph
 * always gets a fresh catalog (profile installs are admin actions; not
 * hot-path). Implementations can cache internally if needed.
 */
export type ValidatorFactory = (tenantId: TenantId) => Promise<ProfileValidator>;

export interface PostgresGraphOptions {
  /**
   * If set, every write is validated against the tenant's installed
   * profiles before SQL execution. If unset, the graph runs in raw mode
   * (substrate-only validation — Tier-1 type CHECK constraint still applies).
   */
  readonly validatorFactory?: ValidatorFactory;

  /**
   * If set, every graph write must carry the configured workflow authority
   * reference before SQL execution.
   */
  readonly writeAuthorityPolicy?: GraphWriteAuthorityPolicy;
}

interface NodeRow {
  id: string;
  tenant_id: string;
  tier1: string;
  profile: string | null;
  concrete: string;
  schema_version: number;
  revision: number;
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
  revision: r.revision,
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
  readonly #validatorFactory: ValidatorFactory | null;
  readonly #writeAuthorityPolicy: GraphWriteAuthorityPolicy | undefined;

  constructor(pool: pg.Pool, options: PostgresGraphOptions = {}) {
    this.#pool = pool;
    this.#validatorFactory = options.validatorFactory ?? null;
    this.#writeAuthorityPolicy = options.writeAuthorityPolicy;
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
      `SELECT id, tenant_id, tier1, profile, concrete, schema_version, revision,
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

  /**
   * Create a node with optional caller-supplied UUID for cross-system
   * idempotency. See ADR-0011 for the full design.
   *
   * Tenant scope: `graph.nodes` has `id TEXT PRIMARY KEY` (globally unique).
   * UUID5 collision risk across tenants is negligible — the uuid5 namespace +
   * name derivation makes same-UUID-different-tenant virtually impossible.
   * ADR-0011 records this explicitly.
   */
  async createNode(
    input: CreateNodeInput,
    tx?: pg.ClientBase,
  ): Promise<CreateNodeResult> {
    this.#assertWriteAuthority(
      input.writeAuthorityRef,
      input.writeAuthoritySubstrateRecord,
    );

    // -----------------------------------------------------------------------
    // 1. Validate caller-supplied ID if present.
    // -----------------------------------------------------------------------
    if (input.id !== undefined) {
      if (!isValidUUID(input.id)) {
        throw new InvalidIdError(input.id);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Profile validation (runs before any SQL, unchanged from pre-P2.3a).
    // -----------------------------------------------------------------------
    if (this.#validatorFactory) {
      const v = await this.#validatorFactory(input.tenantId);
      v.validateNode({
        tenantId: input.tenantId,
        profile: input.profile,
        identity: input.identity,
        schemaVersion: input.schemaVersion,
      });
    }

    // -----------------------------------------------------------------------
    // 3. INSERT with ON CONFLICT DO NOTHING.
    //    - Caller-supplied id: conflict possible → idempotent upsert path.
    //    - Server-generated id: randomUUID prefix `ent_` is not a bare UUID
    //      but is globally unique — conflict is cosmically impossible.
    // -----------------------------------------------------------------------
    const id = input.id ?? `ent_${randomUUID()}`;
    const q = this.#q(tx);
    const r = await q.query<NodeRow>(
      `INSERT INTO graph.nodes
        (id, tenant_id, tier1, profile, concrete, schema_version, identity)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, tenant_id, tier1, profile, concrete, schema_version, revision,
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

    // -----------------------------------------------------------------------
    // 4. Fresh insert: return immediately.
    // -----------------------------------------------------------------------
    if (r.rows[0]) {
      return { node: rowToNode(r.rows[0]), created: true };
    }

    // -----------------------------------------------------------------------
    // 5. Conflict: ID already exists. Fetch the existing node for this tenant.
    //    (If it belongs to a different tenant, getNode returns null — that's a
    //    UUID collision across tenants, negligible in practice with UUID5 but
    //    we surface it as an error rather than silently lying.)
    // -----------------------------------------------------------------------
    const existing = await this.getNode(input.tenantId, id as EntityId, tx);
    if (!existing) {
      // The id row exists in graph.nodes but belongs to a different tenant.
      // Treat as an id collision rather than an idempotency hit.
      throw new InvalidIdError(
        id,
        "UUID already assigned to a different tenant — UUID collision (use a different id)",
      );
    }

    // -----------------------------------------------------------------------
    // 6. Profile / type mismatch → 409.
    // -----------------------------------------------------------------------
    if (
      existing.profile.tier1 !== input.profile.tier1 ||
      existing.profile.profile !== input.profile.profile ||
      existing.profile.concrete !== input.profile.concrete
    ) {
      throw new NodeConflictError(id, existing.profile, input.profile);
    }

    // -----------------------------------------------------------------------
    // 7. Profile matches → idempotent hit, return existing node.
    // -----------------------------------------------------------------------
    return { node: existing, created: false };
  }

  async updateNode(
    input: UpdateNodeInput,
    tx?: pg.ClientBase,
  ): Promise<NodeBase> {
    this.#assertWriteAuthority(
      input.writeAuthorityRef,
      input.writeAuthoritySubstrateRecord,
    );

    // Validate the proposed identity against the tenant's installed
    // profiles. We need the existing node to know the profile binding
    // (caller supplies only the tenantId+id+identity), so we read first.
    const existing = await this.getNode(input.tenantId, input.id, tx);
    if (this.#validatorFactory) {
      if (existing) {
        const v = await this.#validatorFactory(input.tenantId);
        v.validateNode({
          tenantId: input.tenantId,
          profile: existing.profile,
          identity: input.identity,
          schemaVersion: existing.schemaVersion,
        });
      }
      // If existing is null, fall through — the UPDATE will return 0 rows
      // and we'll throw NotFoundError below, which is the right error.
    }
    const expectedRevision = input.expectedRevision ?? input.expectedSchemaVersion;
    const q = this.#q(tx);
    const r = await q.query<NodeRow>(
      `UPDATE graph.nodes
          SET identity       = $4::jsonb,
              revision       = revision + 1,
              updated_at     = now()
        WHERE tenant_id = $1 AND id = $2 AND revision = $3
        RETURNING id, tenant_id, tier1, profile, concrete, schema_version, revision,
                  identity, created_at, updated_at`,
      [
        input.tenantId,
        input.id,
        expectedRevision,
        JSON.stringify(input.identity ?? {}),
      ],
    );
    if (r.rows[0]) return rowToNode(r.rows[0]);

    // Distinguish "not found" from "stale read".
    const cur = await this.getNode(input.tenantId, input.id, tx);
    if (!cur) throw new NotFoundError("node", input.id);
    throw new OptimisticConcurrencyError(
      input.id,
      expectedRevision,
      cur.revision,
    );
  }

  async createEdge(
    input: CreateEdgeInput,
    tx?: pg.ClientBase,
  ): Promise<Edge> {
    this.#assertWriteAuthority(
      input.writeAuthorityRef,
      input.writeAuthoritySubstrateRecord,
    );

    if (this.#validatorFactory) {
      // Look up the concrete types of the from/to nodes + count existing
      // edges of this type from/to each side. The validator does the
      // cardinality math.
      const [fromNode, toNode] = await Promise.all([
        this.getNode(input.tenantId, input.fromId, tx),
        this.getNode(input.tenantId, input.toId, tx),
      ]);
      if (!fromNode) throw new NotFoundError("node", input.fromId);
      if (!toNode) throw new NotFoundError("node", input.toId);

      const q0 = this.#q(tx);
      const [fromCountRes, toCountRes] = await Promise.all([
        q0.query<{ c: string }>(
          `SELECT count(*)::text AS c FROM graph.edges
            WHERE tenant_id = $1 AND from_id = $2 AND type = $3
              AND deleted_at IS NULL`,
          [input.tenantId, input.fromId, input.type],
        ),
        q0.query<{ c: string }>(
          `SELECT count(*)::text AS c FROM graph.edges
            WHERE tenant_id = $1 AND to_id = $2 AND type = $3
              AND deleted_at IS NULL`,
          [input.tenantId, input.toId, input.type],
        ),
      ]);
      const v = await this.#validatorFactory(input.tenantId);
      v.validateEdge({
        tenantId: input.tenantId,
        type: input.type,
        fromConcrete: fromNode.profile.concrete,
        toConcrete: toNode.profile.concrete,
        existingFromCount: Number(fromCountRes.rows[0]!.c),
        existingToCount: Number(toCountRes.rows[0]!.c),
      });
    }
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
    writeAuthorityRefOrTx?: GraphWriteAuthorityRef | pg.ClientBase,
    writeAuthoritySubstrateRecordOrTx?:
      | GraphWriteAuthoritySubstrateRecord
      | pg.ClientBase,
    tx?: pg.ClientBase,
  ): Promise<void> {
    const writeAuthorityRef = isGraphWriteAuthorityRef(writeAuthorityRefOrTx)
      ? writeAuthorityRefOrTx
      : undefined;
    const writeAuthoritySubstrateRecord =
      isGraphWriteAuthoritySubstrateRecord(writeAuthoritySubstrateRecordOrTx)
        ? writeAuthoritySubstrateRecordOrTx
        : undefined;
    const queryClient = !isGraphWriteAuthorityRef(writeAuthorityRefOrTx)
      ? writeAuthorityRefOrTx
      : !isGraphWriteAuthoritySubstrateRecord(writeAuthoritySubstrateRecordOrTx)
        ? writeAuthoritySubstrateRecordOrTx
        : tx;

    this.#assertWriteAuthority(
      writeAuthorityRef,
      writeAuthoritySubstrateRecord,
    );

    const q = this.#q(queryClient);
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

  #assertWriteAuthority(
    authorityRef?: GraphWriteAuthorityRef,
    substrateRecord?: GraphWriteAuthoritySubstrateRecord,
  ): void {
    assertGraphWriteAuthority({
      ...(authorityRef !== undefined ? { authorityRef } : {}),
      ...(substrateRecord !== undefined ? { substrateRecord } : {}),
      ...(this.#writeAuthorityPolicy !== undefined
        ? { policy: this.#writeAuthorityPolicy }
        : {}),
    });
  }

  /**
   * Resolve a `Querier`. If a transactional client is passed, use it; else
   * the pool. Both share the `.query()` shape.
   */
  #q(tx?: pg.ClientBase): Querier {
    return (tx as Querier | undefined) ?? this.#pool;
  }
}
