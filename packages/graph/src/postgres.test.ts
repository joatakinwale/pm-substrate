/**
 * Integration tests for PostgresGraph against the running dev DB.
 *
 * The atomicity test (graph mutation + event publish in one tx) is the
 * load-bearing one — it's the architectural claim that Layer 1↔Layer 2
 * commit together or not at all.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { EntityId, ProfileBinding, TenantId } from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import { OptimisticConcurrencyError, PostgresGraph } from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresGraph", () => {
  let pool: pg.Pool;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let tenantId: TenantId;

  const RAW_COUNTERPARTY: ProfileBinding = {
    tier1: "Counterparty",
    profile: null,
    concrete: "Counterparty",
  };
  const RAW_ENGAGEMENT: ProfileBinding = {
    tier1: "Engagement",
    profile: null,
    concrete: "Engagement",
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    graph = new PostgresGraph(pool);
    events = new PostgresEventStore(pool);

    // Provision a tenant for this run. graph.nodes.tenant_id has an FK to
    // substrate.tenants(id), so we must register first.
    tenantId = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  });

  afterAll(async () => {
    await events.close();
    // Clean order: edges → nodes → events → subs → tenant.
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("creates and reads a node", async () => {
    const node = await graph.createNode({
      tenantId,
      profile: RAW_ENGAGEMENT,
      identity: { name: "Test engagement" },
      schemaVersion: 1,
    });
    expect(node.id).toMatch(/^ent_/);
    expect(node.profile.tier1).toBe("Engagement");
    expect(node.identity).toEqual({ name: "Test engagement" });

    const back = await graph.getNode(tenantId, node.id);
    expect(back?.id).toBe(node.id);
  });

  it("creates and reads typed edges (outgoing + incoming)", async () => {
    const a = await graph.createNode({
      tenantId,
      profile: RAW_ENGAGEMENT,
      identity: { name: "A" },
      schemaVersion: 1,
    });
    const b = await graph.createNode({
      tenantId,
      profile: RAW_COUNTERPARTY,
      identity: { name: "B" },
      schemaVersion: 1,
    });

    const e = await graph.createEdge({
      tenantId,
      type: "involves",
      fromId: a.id,
      toId: b.id,
      attrs: { role: "primary" },
    });
    expect(e.id).toMatch(/^edg_/);

    const out = await graph.outgoingEdges(tenantId, a.id, "involves");
    expect(out.map((x) => x.id)).toContain(e.id);

    const inc = await graph.incomingEdges(tenantId, b.id, "involves");
    expect(inc.map((x) => x.id)).toContain(e.id);
  });

  it("tombstones edges on delete; live queries hide them", async () => {
    const a = await graph.createNode({
      tenantId, profile: RAW_ENGAGEMENT, identity: {}, schemaVersion: 1,
    });
    const b = await graph.createNode({
      tenantId, profile: RAW_COUNTERPARTY, identity: {}, schemaVersion: 1,
    });
    const e = await graph.createEdge({
      tenantId, type: "tombstone_test", fromId: a.id, toId: b.id, attrs: {},
    });
    await graph.deleteEdge(tenantId, e.id);

    const live = await graph.outgoingEdges(tenantId, a.id, "tombstone_test");
    expect(live.find((x) => x.id === e.id)).toBeUndefined();

    // Tombstone row still present (audit + time-travel rely on it).
    const r = await pool.query(
      `SELECT deleted_at FROM graph.edges WHERE id = $1`,
      [e.id],
    );
    expect(r.rows[0]?.deleted_at).not.toBeNull();
  });

  it("optimistic concurrency: rejects stale schemaVersion", async () => {
    const node = await graph.createNode({
      tenantId, profile: RAW_ENGAGEMENT,
      identity: { name: "v1" }, schemaVersion: 1,
    });
    // Successful update (correct version)
    const updated = await graph.updateNode({
      tenantId,
      id: node.id,
      identity: { name: "v2" },
      expectedSchemaVersion: 1,
    });
    expect(updated.schemaVersion).toBe(2);

    // Stale read → conflict
    await expect(
      graph.updateNode({
        tenantId,
        id: node.id,
        identity: { name: "stale" },
        expectedSchemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });

  it("ATOMICITY: graph mutation + event publish commit together (or not at all)", async () => {
    // Happy path: both writes commit in the same tx.
    const c = await pool.connect();
    let nodeId: EntityId | null = null;
    let evtId: string | null = null;
    try {
      await c.query("BEGIN");
      const node = await graph.createNode(
        {
          tenantId,
          profile: RAW_ENGAGEMENT,
          identity: { name: "atomic-happy" },
          schemaVersion: 1,
        },
        c,
      );
      const ev = await events.publishWith(c, {
        tenantId,
        type: "engagement.created",
        entityId: node.id,
        emittedBy: "cap.test",
        payloadSchema: "engagement.created/v1",
        payload: { name: "atomic-happy" },
      });
      await c.query("COMMIT");
      nodeId = node.id;
      evtId = ev.id;
    } finally {
      c.release();
    }
    expect(await graph.getNode(tenantId, nodeId!)).not.toBeNull();
    expect(await events.getById(tenantId, evtId! as never)).not.toBeNull();

    // Rollback path: the graph mutation AND the event publish must both vanish.
    const c2 = await pool.connect();
    let rolledNodeId: EntityId | null = null;
    let rolledEvtId: string | null = null;
    try {
      await c2.query("BEGIN");
      const node = await graph.createNode(
        {
          tenantId,
          profile: RAW_ENGAGEMENT,
          identity: { name: "atomic-rollback" },
          schemaVersion: 1,
        },
        c2,
      );
      const ev = await events.publishWith(c2, {
        tenantId,
        type: "engagement.created",
        entityId: node.id,
        emittedBy: "cap.test",
        payloadSchema: "engagement.created/v1",
        payload: {},
      });
      rolledNodeId = node.id;
      rolledEvtId = ev.id;
      await c2.query("ROLLBACK");
    } finally {
      c2.release();
    }
    expect(await graph.getNode(tenantId, rolledNodeId!)).toBeNull();
    expect(await events.getById(tenantId, rolledEvtId! as never)).toBeNull();
  });
});
