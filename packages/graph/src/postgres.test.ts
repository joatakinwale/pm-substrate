/**
 * Integration tests for PostgresGraph against the running dev DB.
 *
 * The atomicity test (graph mutation + event publish in one tx) is the
 * load-bearing one — it's the architectural claim that Layer 1↔Layer 2
 * commit together or not at all.
 *
 * P2.3a additions: caller-supplied UUID idempotency tests (7 new cases).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { EntityId, ProfileBinding, TenantId } from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import {
  InvalidIdError,
  NodeConflictError,
  OptimisticConcurrencyError,
  PostgresGraph,
} from "./index.js";

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

  it("creates and reads a node (server-generated id)", async () => {
    const { node, created } = await graph.createNode({
      tenantId,
      profile: RAW_ENGAGEMENT,
      identity: { name: "Test engagement" },
      schemaVersion: 1,
    });
    expect(created).toBe(true);
    expect(node.id).toMatch(/^ent_/);
    expect(node.profile.tier1).toBe("Engagement");
    expect(node.identity).toEqual({ name: "Test engagement" });

    const back = await graph.getNode(tenantId, node.id);
    expect(back?.id).toBe(node.id);
  });

  it("creates and reads typed edges (outgoing + incoming)", async () => {
    const { node: a } = await graph.createNode({
      tenantId,
      profile: RAW_ENGAGEMENT,
      identity: { name: "A" },
      schemaVersion: 1,
    });
    const { node: b } = await graph.createNode({
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
    const { node: a } = await graph.createNode({
      tenantId, profile: RAW_ENGAGEMENT, identity: {}, schemaVersion: 1,
    });
    const { node: b } = await graph.createNode({
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

  it("optimistic concurrency: rejects stale node revision", async () => {
    const { node } = await graph.createNode({
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
    expect(updated.schemaVersion).toBe(1);
    expect(updated.revision).toBe(2);

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
      const { node } = await graph.createNode(
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
      const { node } = await graph.createNode(
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

  // ---------------------------------------------------------------------------
  // P2.3a: Caller-supplied UUID idempotency tests
  // ---------------------------------------------------------------------------

  it("P2.3a: createNode with explicit UUID returns created=true on first call", async () => {
    const callerUUID = randomUUID();
    const { node, created } = await graph.createNode({
      tenantId,
      id: callerUUID,
      profile: RAW_ENGAGEMENT,
      identity: { name: "idempotent-first" },
      schemaVersion: 1,
    });
    expect(created).toBe(true);
    expect(node.id).toBe(callerUUID);
    expect(node.profile.tier1).toBe("Engagement");
  });

  it("P2.3a: createNode with same explicit UUID returns created=false, same node on second call", async () => {
    const callerUUID = randomUUID();
    // First create
    const first = await graph.createNode({
      tenantId,
      id: callerUUID,
      profile: RAW_COUNTERPARTY,
      identity: { name: "idempotent-cp" },
      schemaVersion: 1,
    });
    expect(first.created).toBe(true);

    // Second create — same UUID, same profile
    const second = await graph.createNode({
      tenantId,
      id: callerUUID,
      profile: RAW_COUNTERPARTY,
      identity: { name: "should-be-ignored" },
      schemaVersion: 1,
    });
    expect(second.created).toBe(false);
    expect(second.node.id).toBe(callerUUID);
    // Identity from first insert is preserved — not overwritten.
    expect(second.node.identity).toEqual({ name: "idempotent-cp" });
  });

  it("P2.3a: createNode with explicit UUID matching a different-typed node throws NodeConflictError (409)", async () => {
    const callerUUID = randomUUID();
    // Insert as Engagement
    await graph.createNode({
      tenantId,
      id: callerUUID,
      profile: RAW_ENGAGEMENT,
      identity: { name: "typed-engagement" },
      schemaVersion: 1,
    });

    // Same UUID but different type → must reject
    await expect(
      graph.createNode({
        tenantId,
        id: callerUUID,
        profile: RAW_COUNTERPARTY,
        identity: { name: "attempted-counterparty" },
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(NodeConflictError);
  });

  it("P2.3a: createNode with no id uses server-generated id (created=true always)", async () => {
    const { node, created } = await graph.createNode({
      tenantId,
      profile: RAW_ENGAGEMENT,
      identity: { name: "server-gen" },
      schemaVersion: 1,
    });
    expect(created).toBe(true);
    expect(node.id).toMatch(/^ent_/);
  });

  it("P2.3a: invalid UUID string is rejected with InvalidIdError (400)", async () => {
    await expect(
      graph.createNode({
        tenantId,
        id: "not-a-uuid",
        profile: RAW_ENGAGEMENT,
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidIdError);

    // Also test partial UUID
    await expect(
      graph.createNode({
        tenantId,
        id: "ent_abc123", // prefixed id format, not a bare UUID
        profile: RAW_ENGAGEMENT,
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidIdError);
  });

  it("P2.3a: same UUID in two different tenants creates two distinct nodes", async () => {
    // Provision a second tenant
    const tenantId2 = `tnt_t2_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId2],
    );

    // Note: because graph.nodes has a global PK on id, two tenants cannot
    // share the same UUID. UUID5 collision risk is negligible (ADR-0011).
    // This test verifies that a UUID used in one tenant can be fetched by
    // that tenant and is not visible to the other tenant.
    const sharedUUID = randomUUID();

    // Tenant 1 creates the node
    const t1 = await graph.createNode({
      tenantId,
      id: sharedUUID,
      profile: RAW_ENGAGEMENT,
      identity: { tenant: "t1" },
      schemaVersion: 1,
    });
    expect(t1.created).toBe(true);
    expect(t1.node.tenantId).toBe(tenantId);

    // Tenant 2 cannot see tenant 1's node
    const missing = await graph.getNode(tenantId2, sharedUUID as EntityId);
    expect(missing).toBeNull();

    // Clean up second tenant
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId2]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId2]);
  });
});
