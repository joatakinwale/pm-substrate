/**
 * Equivalence + behavior tests for defineCapability.
 *
 * Strategy: build a synthetic capability with the kit and run it through
 * the same Postgres dev DB the domain capabilities use. Asserts:
 *
 *   1. Idempotency: same key applied twice → only one rollup happens,
 *      only one event emitted.
 *   2. Walk-returns-null: no rollup target → idempotency row is committed,
 *      no FOR UPDATE, no UPDATE, no event. Re-delivery is still a no-op.
 *   3. Apply mutates locked row + emit publishes inside the same tx.
 *      On commit, both effects are observable; on throw, neither is.
 *   4. Sentinel `NoopOnConflict` from extractIdempotencyKey skips the
 *      whole transaction.
 *   5. SQL identifier sanitation: defining a capability with a bad
 *      table name throws at compile time, not at run time.
 *
 * The synthetic capability is a "score-bumper" that walks
 * `kit_test/source_target` from a payload's source id to a target node
 * and increments `targetScore` on the target. Substrate-private — uses
 * a temporary idempotency table created in beforeAll.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { EntityId, TenantId } from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import {
  defineCapability,
  NoopOnConflict,
  type CapabilitySpec,
} from "./define.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

interface BumpPayload {
  readonly sourceId: EntityId;
  readonly delta: number;
  readonly bumpId: string;
}

describeIfDb("defineCapability — substrate-side authoring kit (G10)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_kit_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool);

    // Capability-private idempotency table for the synthetic capability.
    // We create a transient one in `public` to avoid colliding with
    // existing per-capability schemas (budget, lead_scoring). Test owns
    // its lifecycle — drops at end via afterAll cleanup.
    await pool.query(`DROP TABLE IF EXISTS public.kit_applied_bumps`);
    await pool.query(
      `CREATE TABLE public.kit_applied_bumps (
         tenant_id TEXT NOT NULL,
         bump_id   TEXT NOT NULL,
         PRIMARY KEY (tenant_id, bump_id)
       )`,
    );
  });

  afterAll(async () => {
    await events.close();
    await pool.query(`DROP TABLE IF EXISTS public.kit_applied_bumps`);
    for (const t of tenants) {
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(
        `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  // Build a fresh capability for each test so spec/deps don't leak state
  // between tests (they don't — handlers are stateless — but defense in
  // depth on shared setup).
  const makeBumper = (
    overrides: Partial<CapabilitySpec<BumpPayload, { newScore: number }>> = {},
  ) => {
    const baseSpec: CapabilitySpec<BumpPayload, { newScore: number }> = {
      name: "kit-test.bumper",
      idempotency: { table: "public.kit_applied_bumps", keyColumn: "bump_id" },
      extractIdempotencyKey: (p) => p.bumpId,
      walk: async ({ tenantId, payload, graph }) => {
        const e = await graph.outgoingEdges(
          tenantId,
          payload.sourceId,
          "kit_test/source_target",
        );
        return e.length === 0 ? null : (e[0]!.toId as EntityId);
      },
      apply: async ({ payload, currentIdentity }) => {
        const cur = (currentIdentity["targetScore"] as number | undefined) ?? 0;
        const newScore = cur + payload.delta;
        return {
          nextIdentity: { ...currentIdentity, targetScore: newScore },
          applyResult: { newScore },
        };
      },
      emit: ({ tenantId: _t, payload, targetId, applyResult }) => ({
        tenantId: _t,
        type: "kit_test.target.bumped",
        entityId: targetId,
        emittedBy: "kit-test.bumper",
        payloadSchema: "kit_test.target.bumped/v1",
        payload: {
          targetId,
          delta: payload.delta,
          newScore: applyResult.newScore,
          sourceBumpId: payload.bumpId,
        },
      }),
      ...overrides,
    };
    return defineCapability(baseSpec, { pool, graph, events });
  };

  // Helper to set up a source/target pair under a tenant. Profile-binding
  // is raw Tier-1 (no profile installed) — the kit doesn't care about
  // profile shape, only about graph topology. Counterparty is the
  // arbitrary Tier-1 type we pick for both nodes.
  const RAW_TIER1 = {
    tier1: "Counterparty" as const,
    profile: null,
    concrete: "Counterparty",
  };
  const seedPair = async (
    tenantId: TenantId,
  ): Promise<{ sourceId: EntityId; targetId: EntityId }> => {
    const src = await graph.createNode({
      tenantId,
      profile: RAW_TIER1,
      identity: { kind: "source" },
      schemaVersion: 1,
    });
    const tgt = await graph.createNode({
      tenantId,
      profile: RAW_TIER1,
      identity: { kind: "target", targetScore: 0 },
      schemaVersion: 1,
    });
    await graph.createEdge({
      tenantId,
      type: "kit_test/source_target",
      fromId: src.node.id,
      toId: tgt.node.id,
      attrs: {},
    });
    return {
      sourceId: src.node.id as EntityId,
      targetId: tgt.node.id as EntityId,
    };
  };

  it("idempotency: same key applied twice → one rollup, one event", async () => {
    const tenantId = await makeTenant();
    const { sourceId, targetId } = await seedPair(tenantId);
    const bumper = makeBumper();

    const payload: BumpPayload = {
      sourceId,
      delta: 5,
      bumpId: `bump_${randomUUID()}`,
    };
    await bumper.handle(tenantId, payload);
    await bumper.handle(tenantId, payload); // duplicate

    const row = await pool.query<{ identity: Record<string, number> }>(
      `SELECT identity FROM graph.nodes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetId],
    );
    expect(row.rows[0]!.identity["targetScore"]).toBe(5);

    const evs = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'kit_test.target.bumped'`,
      [tenantId],
    );
    expect(Number(evs.rows[0]!.c)).toBe(1);

    const idemRows = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.kit_applied_bumps
        WHERE tenant_id = $1 AND bump_id = $2`,
      [tenantId, payload.bumpId],
    );
    expect(Number(idemRows.rows[0]!.c)).toBe(1);
  });

  it("walk-returns-null: no rollup target → idempotency committed, no UPDATE, no event", async () => {
    const tenantId = await makeTenant();
    // Seed a source with NO outgoing edge — walk will return null.
    const orphan = await graph.createNode({
      tenantId,
      profile: RAW_TIER1,
      identity: { kind: "orphan" },
      schemaVersion: 1,
    });

    const bumper = makeBumper();
    const payload: BumpPayload = {
      sourceId: orphan.node.id as EntityId,
      delta: 99,
      bumpId: `bump_${randomUUID()}`,
    };
    await bumper.handle(tenantId, payload);

    // Idempotency row was written (event is "seen and intentionally skipped").
    const idem = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.kit_applied_bumps
        WHERE tenant_id = $1 AND bump_id = $2`,
      [tenantId, payload.bumpId],
    );
    expect(Number(idem.rows[0]!.c)).toBe(1);

    // No event was emitted (nothing to update).
    const evs = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'kit_test.target.bumped'`,
      [tenantId],
    );
    expect(Number(evs.rows[0]!.c)).toBe(0);

    // Re-delivery: still a no-op (idempotency hit).
    await bumper.handle(tenantId, payload);
    const idem2 = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.kit_applied_bumps
        WHERE tenant_id = $1 AND bump_id = $2`,
      [tenantId, payload.bumpId],
    );
    expect(Number(idem2.rows[0]!.c)).toBe(1);
  });

  it("apply + emit happen atomically inside the same transaction", async () => {
    const tenantId = await makeTenant();
    const { sourceId, targetId } = await seedPair(tenantId);
    const bumper = makeBumper();

    await bumper.handle(tenantId, {
      sourceId,
      delta: 3,
      bumpId: `bump_${randomUUID()}`,
    });
    await bumper.handle(tenantId, {
      sourceId,
      delta: 7,
      bumpId: `bump_${randomUUID()}`,
    });

    // Score = 0 + 3 + 7 = 10.
    const row = await pool.query<{ identity: Record<string, number> }>(
      `SELECT identity FROM graph.nodes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetId],
    );
    expect(row.rows[0]!.identity["targetScore"]).toBe(10);

    // Two events, with deltas matching.
    const evs = await pool.query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM events.events
        WHERE tenant_id = $1 AND type = 'kit_test.target.bumped'
        ORDER BY recorded_at ASC`,
      [tenantId],
    );
    expect(evs.rows.length).toBe(2);
    expect(evs.rows[0]!.payload["delta"]).toBe(3);
    expect(evs.rows[0]!.payload["newScore"]).toBe(3);
    expect(evs.rows[1]!.payload["delta"]).toBe(7);
    expect(evs.rows[1]!.payload["newScore"]).toBe(10);
  });

  it("throw inside apply rolls back the transaction — no idempotency row, no event, no node update", async () => {
    const tenantId = await makeTenant();
    const { sourceId, targetId } = await seedPair(tenantId);

    const bumper = makeBumper({
      apply: async () => {
        throw new Error("simulated failure inside apply");
      },
    });
    const bumpId = `bump_${randomUUID()}`;

    await expect(
      bumper.handle(tenantId, { sourceId, delta: 100, bumpId }),
    ).rejects.toThrow(/simulated failure/);

    // Idempotency row rolled back: a future re-delivery should run.
    const idem = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.kit_applied_bumps
        WHERE tenant_id = $1 AND bump_id = $2`,
      [tenantId, bumpId],
    );
    expect(Number(idem.rows[0]!.c)).toBe(0);

    // No event emitted.
    const evs = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'kit_test.target.bumped'`,
      [tenantId],
    );
    expect(Number(evs.rows[0]!.c)).toBe(0);

    // Target unchanged.
    const row = await pool.query<{ identity: Record<string, number> }>(
      `SELECT identity FROM graph.nodes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetId],
    );
    expect(row.rows[0]!.identity["targetScore"]).toBe(0);
  });

  it("NoopOnConflict from extractIdempotencyKey skips the entire handler", async () => {
    const tenantId = await makeTenant();
    const { sourceId } = await seedPair(tenantId);

    const bumper = makeBumper({
      extractIdempotencyKey: () => NoopOnConflict,
    });
    await bumper.handle(tenantId, {
      sourceId,
      delta: 50,
      bumpId: "should-be-ignored",
    });

    const idem = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.kit_applied_bumps
        WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(Number(idem.rows[0]!.c)).toBe(0);

    const evs = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(Number(evs.rows[0]!.c)).toBe(0);
  });

  it("rejects bad SQL identifiers at define time, not at handle time", async () => {
    expect(() =>
      defineCapability(
        {
          name: "evil",
          idempotency: {
            table: "public.x; DROP TABLE substrate.tenants",
            keyColumn: "bump_id",
          },
          extractIdempotencyKey: (p: BumpPayload) => p.bumpId,
        },
        { pool, graph, events },
      ),
    ).toThrow(/idempotency.table/);

    expect(() =>
      defineCapability(
        {
          name: "evil",
          idempotency: {
            table: "public.kit_applied_bumps",
            keyColumn: "bump_id; DROP TABLE x",
          },
          extractIdempotencyKey: (p: BumpPayload) => p.bumpId,
        },
        { pool, graph, events },
      ),
    ).toThrow(/idempotency.keyColumn/);
  });
});
