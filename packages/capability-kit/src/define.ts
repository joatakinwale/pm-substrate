/**
 * defineCapability — produce a capability handler from a small declarative
 * spec. The kit owns BEGIN, idempotency-INSERT, optional graph-walk
 * short-circuit, FOR UPDATE locking, transactional event publish, and
 * COMMIT/ROLLBACK. The capability author owns *what* to walk, *what* to
 * compute, and *what* to emit.
 *
 * See packages/capability-kit/src/index.ts for context.
 */

import type { Graph } from "@pm/graph";
import type { EventPublisher, PublishInput } from "@pm/events";
import type { EntityId, TenantId } from "@pm/types";
import pg from "pg";

/** Sentinel returned from `extractIdempotencyKey` callers can use to opt out
 * (e.g., "this payload is structurally inert, skip the whole thing"). */
export const NoopOnConflict = Symbol("capability-kit/noop-on-conflict");

/** Identity (`graph.nodes.identity`) is JSONB; kit stays JSON-shape-agnostic. */
type Identity = Readonly<Record<string, unknown>>;

/**
 * Author-supplied identifiers for the capability-private idempotency table.
 *
 * The convention from ADR-0010 is `<schema>.applied_<events>` with two
 * columns: `tenant_id TEXT` and a stable per-capability key column. Each
 * capability ships its own migration creating this table. The kit just
 * does a parameterized INSERT … ON CONFLICT DO NOTHING into it.
 */
export interface IdempotencyTable {
  /**
   * Fully-qualified table name. Examples:
   *   "budget.applied_payments"
   *   "lead_scoring.applied_scoring_events"
   *
   * IMPORTANT: this is interpolated literally into SQL — pg has no
   * parameterized identifiers. Pin it to a constant in your capability;
   * never accept it from untrusted input.
   */
  readonly table: string;

  /**
   * Column name of the per-capability key inside `table`. Matches the
   * column the migration declared (e.g., `payment_id`, `scoring_event_id`).
   * Same SQL-literal warning as `table` — keep it constant.
   */
  readonly keyColumn: string;
}

/**
 * Reads provided to the graph-walk step. The kit gives you the same `Graph`
 * the registry hands every capability, plus the tenant + payload, plus
 * the connection (in case you want to read inside the transaction — most
 * walks don't need to, but a few do).
 */
export interface GraphWalkContext<TPayload> {
  readonly tenantId: TenantId;
  readonly payload: TPayload;
  readonly graph: Graph;
  readonly client: pg.ClientBase;
}

/**
 * Reads provided to the apply step. After a successful FOR UPDATE the kit
 * passes you the locked row's identity and schemaVersion plus the same
 * tenantId/payload/client for downstream queries.
 */
export interface ApplyContext<TPayload> {
  readonly tenantId: TenantId;
  readonly payload: TPayload;
  readonly targetId: EntityId;
  readonly currentIdentity: Identity;
  readonly currentSchemaVersion: number;
  readonly client: pg.ClientBase;
}

/**
 * Reads provided to the emit step. Receives whatever `apply` returned
 * plus the locked target id so you can build a fully-typed PublishInput.
 */
export interface EmitContext<TPayload, TApplyResult> {
  readonly tenantId: TenantId;
  readonly payload: TPayload;
  readonly targetId: EntityId;
  readonly applyResult: TApplyResult;
}

/**
 * Capability spec. All fields except `idempotency` and `extractIdempotencyKey`
 * are optional, in roughly the order you'd typically need them:
 *
 *   1. extractIdempotencyKey  — required. Maps payload → stable string.
 *   2. walk                   — optional. Returns the rollup target's
 *                               EntityId, or null to short-circuit (commit
 *                               idempotency row + return).
 *   3. apply                  — optional. Computes the next identity for
 *                               the locked target row. If absent, no
 *                               FOR UPDATE / UPDATE happens; the kit only
 *                               records idempotency and emits.
 *   4. emit                   — optional. Returns the event to publish via
 *                               publishWith inside the same tx. If absent,
 *                               no event is emitted.
 */
export interface CapabilitySpec<TPayload, TApplyResult = void> {
  /**
   * Capability identity used in logs and as the default `emittedBy` on
   * the published event. Required for diagnostics.
   */
  readonly name: string;

  /** See `IdempotencyTable`. */
  readonly idempotency: IdempotencyTable;

  /**
   * Stable, deterministic key for this payload's idempotency. Same payload
   * twice → same key. Return `NoopOnConflict` to skip the whole handler
   * for structural reasons (e.g., payload missing required field).
   */
  readonly extractIdempotencyKey: (
    payload: TPayload,
  ) => string | typeof NoopOnConflict;

  /**
   * Optional. Walk the graph to find the entity the rollup applies to.
   * Return `null` if the topology says "skip cleanly" (raw Tier-1
   * tenant, missing edge, etc.). The kit will commit the idempotency row
   * (so the event is recorded as seen) and return without locking
   * anything.
   *
   * Throw to abort the whole handler with a rollback.
   */
  readonly walk?: (
    ctx: GraphWalkContext<TPayload>,
  ) => Promise<EntityId | null>;

  /**
   * Optional. Compute the new identity for the locked target row plus
   * any auxiliary information you'll want during emit.
   *
   * Return `{ nextIdentity }` to update the row, or `null` to skip the
   * update (keep the lock for the duration of the tx, but commit
   * unchanged — useful when emit is the only effect).
   */
  readonly apply?: (
    ctx: ApplyContext<TPayload>,
  ) => Promise<{
    readonly nextIdentity: Identity;
    readonly applyResult: TApplyResult;
  } | null>;

  /**
   * Optional. Build the event to emit inside the same transaction.
   * Returning `null` means "no event for this case" (rare but valid).
   */
  readonly emit?: (
    ctx: EmitContext<TPayload, TApplyResult>,
  ) => PublishInput | null;
}

/** Substrate-provided runtime deps every capability handler needs. */
export interface CapabilityRuntimeDeps {
  readonly pool: pg.Pool;
  readonly graph: Graph;
  readonly events: EventPublisher;
}

/** Compiled capability — call `.handle(tenantId, payload)` to run it. */
export interface CapabilityHandler<TPayload> {
  /** Run the capability for a single inbound event/payload. */
  handle(tenantId: TenantId, payload: TPayload): Promise<void>;

  /** Capability name from the spec; useful for logs and tests. */
  readonly name: string;
}

/**
 * Extended EventPublisher shape that includes the transactional helper.
 * `PostgresEventStore` implements this; the public `EventPublisher`
 * interface deliberately doesn't expose it. The kit narrows here.
 */
type TransactionalEvents = EventPublisher & {
  publishWith(
    client: pg.ClientBase,
    input: PublishInput,
  ): Promise<unknown>;
};

interface NodeRow {
  id: string;
  identity: Identity;
  schema_version: number;
}

/**
 * Compile a {@link CapabilitySpec} + runtime deps into a runnable
 * {@link CapabilityHandler}. The compiled handler implements the same
 * transactional shape every existing capability hand-rolled before G10:
 *
 *     BEGIN
 *     INSERT idempotency row; ROLLBACK + return on conflict
 *     [optional walk → null? COMMIT + return]
 *     [optional FOR UPDATE → apply → UPDATE]
 *     [optional emit → publishWith]
 *     COMMIT
 *     (any throw → ROLLBACK; connection always released)
 */
export function defineCapability<TPayload, TApplyResult = void>(
  spec: CapabilitySpec<TPayload, TApplyResult>,
  deps: CapabilityRuntimeDeps,
): CapabilityHandler<TPayload> {
  const events = deps.events as TransactionalEvents;

  if (typeof events.publishWith !== "function") {
    throw new Error(
      `[capability-kit:${spec.name}] events publisher must implement publishWith(client, input). ` +
        `Pass a PostgresEventStore (or any EventPublisher with the transactional extension).`,
    );
  }

  // Compile-time SQL identifier sanitation. We refuse anything that's
  // not a conservative `[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?`
  // because we interpolate these into SQL. Capability authors set these
  // to constants; this guard exists to keep a future careless change
  // from turning into SQL injection if the constants ever come from
  // config.
  const idTableRe = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
  const idColRe = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!idTableRe.test(spec.idempotency.table)) {
    throw new Error(
      `[capability-kit:${spec.name}] idempotency.table "${spec.idempotency.table}" ` +
        `must match /^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)?$/`,
    );
  }
  if (!idColRe.test(spec.idempotency.keyColumn)) {
    throw new Error(
      `[capability-kit:${spec.name}] idempotency.keyColumn "${spec.idempotency.keyColumn}" ` +
        `must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`,
    );
  }
  const insertSql =
    `INSERT INTO ${spec.idempotency.table} (tenant_id, ${spec.idempotency.keyColumn}) ` +
    `VALUES ($1, $2) ON CONFLICT DO NOTHING`;

  return {
    name: spec.name,

    async handle(tenantId: TenantId, payload: TPayload): Promise<void> {
      const idemKey = spec.extractIdempotencyKey(payload);
      if (idemKey === NoopOnConflict) {
        // Caller said "don't even start the tx for this one." Done.
        return;
      }

      const c = await deps.pool.connect();
      try {
        await c.query("BEGIN");

        // Step 1 — idempotency guard.
        const ins = await c.query(insertSql, [tenantId, idemKey]);
        if ((ins.rowCount ?? 0) === 0) {
          await c.query("ROLLBACK");
          return;
        }

        // Step 2 — optional walk to locate the rollup target.
        let targetId: EntityId | null = null;
        if (spec.walk) {
          targetId = await spec.walk({
            tenantId,
            payload,
            graph: deps.graph,
            client: c,
          });
          if (targetId === null) {
            // Topology says "skip cleanly". Commit idempotency row so the
            // event is recorded as seen and we don't re-fire later.
            await c.query("COMMIT");
            return;
          }
        }

        // If apply is present, target must have been resolved by walk.
        // The kit treats "apply without walk" as a programming error
        // because there's nothing to lock without a target.
        if (spec.apply && targetId === null) {
          throw new Error(
            `[capability-kit:${spec.name}] spec.apply provided but spec.walk did not produce a target id. ` +
              `Either provide spec.walk that returns the target, or remove spec.apply.`,
          );
        }

        // Step 3 — FOR UPDATE + apply (only if both target and apply exist).
        let applyResult: TApplyResult | undefined;
        if (spec.apply && targetId !== null) {
          const sel = await c.query<NodeRow>(
            `SELECT id, identity, schema_version
               FROM graph.nodes
              WHERE tenant_id = $1 AND id = $2
              FOR UPDATE`,
            [tenantId, targetId],
          );
          const row = sel.rows[0];
          if (!row) {
            throw new Error(
              `[capability-kit:${spec.name}] target node not found: ${targetId} (tenant=${tenantId})`,
            );
          }

          const applied = await spec.apply({
            tenantId,
            payload,
            targetId,
            currentIdentity: row.identity,
            currentSchemaVersion: row.schema_version,
            client: c,
          });

          if (applied !== null) {
            applyResult = applied.applyResult;
            await c.query(
              `UPDATE graph.nodes
                  SET identity       = $3::jsonb,
                      schema_version = schema_version + 1,
                      updated_at     = now()
                WHERE tenant_id = $1 AND id = $2`,
              [tenantId, targetId, JSON.stringify(applied.nextIdentity)],
            );
          }
        }

        // Step 4 — optional emit. If walk produced no target but apply
        // wasn't required, emit can still fire (with targetId synthesized
        // by the author from the payload — common for events that name
        // their own subject). When walk did produce a target, emit
        // receives it.
        if (spec.emit && targetId !== null) {
          const ev = spec.emit({
            tenantId,
            payload,
            targetId,
            // applyResult is `TApplyResult | undefined`. If the spec's
            // TApplyResult is `void`, the `as TApplyResult` is a no-op.
            // If the spec set TApplyResult to something concrete, the
            // user wired apply (otherwise `applyResult` would be
            // undefined and they'd see it). Trade-off intentional.
            applyResult: applyResult as TApplyResult,
          });
          if (ev !== null) {
            await events.publishWith(c, {
              ...ev,
              emittedBy: ev.emittedBy ?? spec.name,
            });
          }
        }

        await c.query("COMMIT");
      } catch (err) {
        await c.query("ROLLBACK").catch(() => {
          // Swallow rollback errors — the original error is what matters.
        });
        throw err;
      } finally {
        c.release();
      }
    },
  };
}
