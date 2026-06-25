/**
 * World — the hermetic substrate authority for one lab run.
 *
 * "Hermetic" = a UNIQUE tenant per run against the REAL PostgresEventStore (not
 * a fake in-memory store). Arm B therefore exercises the real admission path:
 * ordered append, hash-chain, seq. This is the Raft "one leader, one log" model
 * realized on the single Postgres authority (see docs/state-validation/
 * reality-qualities.md → Raft mapping).
 *
 * Causal position (the staleness yardstick) is read PURELY through the public
 * EventReader API: events come back `ORDER BY seq ASC`, so the index of the
 * latest admitted observation for a key IS its causal position. We deliberately
 * do NOT edit any core substrate package to expose `seq` — anti-fixation
 * discipline: the lab onboards via the existing boundary or it is a finding.
 */

import pg from "pg";
import { randomUUID } from "node:crypto";
import type { EntityId, PMEvent, TenantId } from "@pm/types";
import { PostgresEventStore } from "@pm/events";

export interface AdmitInput {
  readonly type: string;
  readonly entityId: EntityId;
  readonly emittedBy: string;
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly authority?: string | null;
}

/**
 * An observation the agent made: the value it read AND the causal position
 * (how many admitted observations for that key existed at read time). The basis
 * position is what the oracle later compares against the current head.
 */
export interface KeyView {
  readonly key: string;
  readonly value: unknown;
  /** 1-based count of admitted observations for this key at read time. */
  readonly basisPosition: number;
  readonly sourceEventId: string;
}

export class World {
  readonly tenantId: TenantId;
  readonly #pool: pg.Pool;
  readonly #store: PostgresEventStore;
  /** Stable entity id per logical key, so all observations of a key chain. */
  readonly #keyEntities = new Map<string, EntityId>();

  private constructor(pool: pg.Pool, store: PostgresEventStore) {
    this.#pool = pool;
    this.#store = store;
    this.tenantId = `tnt_lab_${randomUUID().slice(0, 8)}` as TenantId;
  }

  static async create(databaseUrl: string): Promise<World> {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const store = new PostgresEventStore(pool);
    return new World(pool, store);
  }

  #entityForKey(key: string): EntityId {
    let id = this.#keyEntities.get(key);
    if (!id) {
      id = randomUUID() as EntityId;
      this.#keyEntities.set(key, id);
    }
    return id;
  }

  /**
   * Admit a transition. This is the substrate "commit" (Raft: append+commit).
   * Returns the admitted event. Used both to SEED the world and as the Arm-B
   * action path. Nothing becomes operational state except through here
   * (reality quality #6 — No Unadmitted Mutation).
   */
  async admit(input: AdmitInput): Promise<PMEvent> {
    return this.#store.publish({
      tenantId: this.tenantId,
      type: input.type,
      entityId: input.entityId,
      emittedBy: input.emittedBy,
      payloadSchema: input.payloadSchema,
      payload: input.payload,
      authority: input.authority ?? input.emittedBy,
    });
  }

  /** Admit an observation for a logical key (chains on the key's entity). */
  async observeIntoWorld(
    key: string,
    value: unknown,
    emittedBy = "lab.source",
  ): Promise<PMEvent> {
    return this.admit({
      type: "lab.observation.recorded",
      entityId: this.#entityForKey(key),
      emittedBy,
      payloadSchema: "lab.observation/v1",
      payload: { key, value },
    });
  }

  /** All admitted observations for a key, oldest→newest (ORDER BY seq ASC). */
  async observationsFor(key: string): Promise<readonly PMEvent[]> {
    const all = await this.#store.read({
      tenantId: this.tenantId,
      typePattern: "lab.observation.recorded",
      entityId: this.#entityForKey(key),
      limit: 1000,
    });
    return all.filter((e) => (e.payload as { key?: string }).key === key);
  }

  /** Current authoritative head for a key (what the substrate would serve). */
  async currentHead(key: string): Promise<KeyView | null> {
    const obs = await this.observationsFor(key);
    if (obs.length === 0) return null;
    const head = obs[obs.length - 1]!;
    return {
      key,
      value: (head.payload as { value?: unknown }).value,
      basisPosition: obs.length,
      sourceEventId: head.id,
    };
  }

  /**
   * The causal position of a specific value for a key = the 1-based index of
   * the LAST admitted observation whose value matches. This lets the oracle
   * answer "what seq-position was the agent's action built from?" purely via
   * the public read API.
   */
  async positionOfValue(key: string, value: unknown): Promise<number | null> {
    const obs = await this.observationsFor(key);
    let pos: number | null = null;
    obs.forEach((e, i) => {
      if (String((e.payload as { value?: unknown }).value) === String(value)) {
        pos = i + 1;
      }
    });
    return pos;
  }

  async verifyChain() {
    return this.#store.verifyChain(this.tenantId);
  }

  /** Close the run connection while preserving tenant rows for eval replay. */
  async close(): Promise<void> {
    await this.#pool.end();
  }

  /** Drop this run's tenant data; close the pool. */
  async destroy(): Promise<void> {
    try {
      await this.#pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [
        this.tenantId,
      ]);
      await this.#pool.query(
        `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
        [this.tenantId],
      );
    } finally {
      await this.close();
    }
  }
}
