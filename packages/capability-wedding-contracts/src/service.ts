/**
 * The wedding/contracts service. The implementation behind the capability.
 *
 * Every state transition runs in a single Postgres transaction:
 *   1. Re-read the Contract under FOR UPDATE.
 *   2. Validate the transition via the profile-registry validator.
 *   3. UPDATE the Contract's state.
 *   4. Publish the corresponding event via events.publishWith(tx).
 *
 * If anything in steps 2–4 throws, the tx rolls back and neither the state
 * change nor the event are visible. ADR-0004 + the graph atomicity test
 * are what make this safe.
 */

import type { EventPublisher } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { ProfileValidator } from "@pm/profile-registry";
import type { ProfileBinding, EntityId, TenantId } from "@pm/types";
import pg from "pg";

const CONTRACT_BINDING: ProfileBinding = {
  tier1: "Transaction",
  profile: "wedding",
  concrete: "Contract",
};

export interface DraftContractInput {
  readonly tenantId: TenantId;
  readonly amountMinor: number;
  readonly currency: string;
  readonly effectiveDate: string;
}

export interface RuntimeDeps {
  readonly pool: pg.Pool;
  readonly graph: Graph;
  readonly events: EventPublisher;
  readonly validator: ProfileValidator;
  readonly emittedBy?: string;
}

interface ContractRow {
  id: string;
  identity: { state: string; amountMinor: number; currency: string; effectiveDate: string };
  schema_version: number;
  tenant_id: string;
}

const TRANSITIONS: Readonly<Record<string, { to: string; eventType: string }>> = {
  send: { to: "sent", eventType: "wedding.contract.sent" },
  sign: { to: "signed", eventType: "wedding.contract.signed" },
  startWork: { to: "in_progress", eventType: "wedding.contract.work_started" },
  complete: { to: "completed", eventType: "wedding.contract.completed" },
  cancel: { to: "cancelled", eventType: "wedding.contract.cancelled" },
};

export class WeddingContracts {
  readonly #pool: pg.Pool;
  readonly #graph: Graph;
  readonly #events: EventPublisher & {
    publishWith: (
      client: pg.ClientBase,
      input: Parameters<EventPublisher["publish"]>[0],
    ) => ReturnType<EventPublisher["publish"]>;
  };
  readonly #validator: ProfileValidator;
  readonly #emittedBy: string;

  constructor(deps: RuntimeDeps) {
    this.#pool = deps.pool;
    this.#graph = deps.graph;
    this.#events = deps.events as RuntimeDeps["events"] & {
      publishWith: typeof deps.events extends { publishWith: infer F } ? F : never;
    };
    this.#validator = deps.validator;
    this.#emittedBy = deps.emittedBy ?? "wedding/contracts";
  }

  async draft(input: DraftContractInput): Promise<EntityId> {
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");
      const node = await (this.#graph as Graph & {
        createNode: (
          input: Parameters<Graph["createNode"]>[0],
          tx?: pg.ClientBase,
        ) => ReturnType<Graph["createNode"]>;
      }).createNode(
        {
          tenantId: input.tenantId,
          profile: CONTRACT_BINDING,
          identity: {
            state: "draft",
            amountMinor: input.amountMinor,
            currency: input.currency,
            effectiveDate: input.effectiveDate,
          },
          schemaVersion: 1,
        },
        c,
      );
      await this.#events.publishWith(c, {
        tenantId: input.tenantId,
        type: "wedding.contract.drafted",
        entityId: node.id,
        emittedBy: this.#emittedBy,
        payloadSchema: "wedding.contract.drafted/v1",
        payload: {
          amountMinor: input.amountMinor,
          currency: input.currency,
          effectiveDate: input.effectiveDate,
        },
      });
      await c.query("COMMIT");
      return node.id;
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  async send(tenantId: TenantId, id: EntityId): Promise<void> {
    return this.#transition(tenantId, id, TRANSITIONS.send!);
  }
  async sign(tenantId: TenantId, id: EntityId): Promise<void> {
    return this.#transition(tenantId, id, TRANSITIONS.sign!);
  }
  async startWork(tenantId: TenantId, id: EntityId): Promise<void> {
    return this.#transition(tenantId, id, TRANSITIONS.startWork!);
  }
  async complete(tenantId: TenantId, id: EntityId): Promise<void> {
    return this.#transition(tenantId, id, TRANSITIONS.complete!);
  }
  async cancel(tenantId: TenantId, id: EntityId): Promise<void> {
    return this.#transition(tenantId, id, TRANSITIONS.cancel!);
  }

  async #transition(
    tenantId: TenantId,
    id: EntityId,
    t: { to: string; eventType: string },
  ): Promise<void> {
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");
      // Lock the row so concurrent transitions serialize cleanly.
      const sel = await c.query<ContractRow>(
        `SELECT id, identity, schema_version, tenant_id
           FROM graph.nodes
          WHERE tenant_id = $1 AND id = $2 AND concrete = 'Contract'
          FOR UPDATE`,
        [tenantId, id],
      );
      const row = sel.rows[0];
      if (!row) {
        throw new Error(`contract not found: ${id}`);
      }
      const currentState = row.identity.state;
      this.#validator.validateLifecycleTransition({
        tenantId,
        profile: CONTRACT_BINDING,
        currentState,
        proposedState: t.to,
      });

      const newIdentity = { ...row.identity, state: t.to };
      await c.query(
        `UPDATE graph.nodes
            SET identity = $3::jsonb,
                schema_version = schema_version + 1,
                updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, JSON.stringify(newIdentity)],
      );
      await this.#events.publishWith(c, {
        tenantId,
        type: t.eventType,
        entityId: id,
        emittedBy: this.#emittedBy,
        payloadSchema: `${t.eventType}/v1`,
        payload: { from: currentState, to: t.to },
      });
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }
}
