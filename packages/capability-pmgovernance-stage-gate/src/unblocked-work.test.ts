import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PM_GOVERNANCE_PROFILE } from "@pm/profile-pmgovernance";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import type { EntityId, TenantId } from "@pm/types";

import {
  WORK_DISPATCHED_EVENT_TYPE,
  computeUnblockedWork,
  dispatchUnblockedWork,
} from "./unblocked-work.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describe("computeUnblockedWork (pure projection)", () => {
  const base = {
    workItems: [
      { id: "A", title: "Ship page", state: "todo" },
      { id: "B", title: "Design page", state: "todo" },
      { id: "C", title: "Done thing", state: "accepted" },
    ],
    dependencies: [
      { fromId: "A", toId: "B" }, // A waits on B
      { fromId: "B", toId: "C" }, // B waits on C (satisfied)
    ],
    gates: [],
    accountability: [
      { workItemId: "A", roleId: "role-a", roleName: "alpha" },
      { workItemId: "B", roleId: "role-b", roleName: "beta" },
    ],
  };

  it("unblocks only items whose dependencies are terminal-complete", () => {
    const out = computeUnblockedWork(base);
    expect(out.map((o) => o.workItemId)).toEqual(["B"]);
    expect(out[0]!.dispatchable).toBe(true);
    expect(out[0]!.accountableRoleId).toBe("role-b");
  });

  it("opens downstream work when a dependency completes, with a NEW basis", () => {
    const before = computeUnblockedWork(base);
    const after = computeUnblockedWork({
      ...base,
      workItems: base.workItems.map((w) =>
        w.id === "B" ? { ...w, state: "done" } : w,
      ),
    });
    expect(after.map((o) => o.workItemId)).toEqual(["A"]);
    expect(after[0]!.basisHash).not.toBe(before[0]!.basisHash);
  });

  it("holds gated items until the milestone passes", () => {
    const gated = {
      ...base,
      dependencies: [],
      gates: [{ milestoneId: "M1", workItemId: "B", gateState: "pending" }],
    };
    expect(computeUnblockedWork(gated).map((o) => o.workItemId)).toEqual(["A"]);
    const passed = {
      ...gated,
      gates: [{ milestoneId: "M1", workItemId: "B", gateState: "passed" }],
    };
    expect(computeUnblockedWork(passed).map((o) => o.workItemId).sort()).toEqual(
      ["A", "B"],
    );
  });

  it("surfaces unassigned-but-ready items as non-dispatchable", () => {
    const out = computeUnblockedWork({
      ...base,
      dependencies: [],
      accountability: [{ workItemId: "A", roleId: "role-a" }],
    });
    const b = out.find((o) => o.workItemId === "B")!;
    expect(b.dispatchable).toBe(false);
    expect(b.holds).toContain("no_accountable_role");
  });
});

describeIfDb("dispatchUnblockedWork (real graph → admitted events)", () => {
  let pool: pg.Pool;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let tenantId: TenantId;
  let designId: EntityId;
  let shipId: EntityId;
  let roleId: EntityId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    const profiles = new PostgresProfileRegistry(pool);
    tenantId = `tnt_disp_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profiles.install(tenantId, PM_GOVERNANCE_PROFILE);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profiles.validator(t),
    });

    const mk = async (concrete: string, tier1: string, identity: object) =>
      (
        await graph.createNode({
          tenantId,
          profile: { tier1: tier1 as never, profile: "pmgovernance", concrete },
          identity: identity as never,
          schemaVersion: 1,
        })
      ).node.id;

    roleId = await mk("AgentRole", "Resource", { name: "builder", kind: "agent" });
    designId = await mk("WorkItem", "Engagement", {
      title: "Design the page",
      scopeStart: null,
      scopeEnd: null,
      state: "todo",
      priority: "p1",
    });
    shipId = await mk("WorkItem", "Engagement", {
      title: "Ship the page",
      scopeStart: null,
      scopeEnd: null,
      state: "todo",
      priority: "p1",
    });
    await graph.createEdge({
      tenantId,
      type: "pmgovernance/depends_on",
      fromId: shipId,
      toId: designId,
      attrs: {},
    });
    for (const w of [designId, shipId]) {
      await graph.createEdge({
        tenantId,
        type: "pmgovernance/accountable_to",
        fromId: w,
        toId: roleId,
        attrs: {},
      });
    }
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await events.close();
    await pool.end();
  });

  it("dispatches exactly the unblocked item to its accountable role, idempotently", async () => {
    const first = await dispatchUnblockedWork(pool, events, tenantId);
    expect(first.dispatched.map((d) => d.workItemId)).toEqual([designId]);
    expect(first.deduped).toEqual([]);

    // Same world → same basis → deduped, no double-dispatch.
    const again = await dispatchUnblockedWork(pool, events, tenantId);
    expect(again.dispatched).toEqual([]);
    expect(again.deduped).toEqual([designId]);

    const evs = await pool.query(
      `SELECT payload FROM events.events WHERE tenant_id = $1 AND type = $2`,
      [tenantId, WORK_DISPATCHED_EVENT_TYPE],
    );
    expect(evs.rowCount).toBe(1);
    expect(evs.rows[0].payload.accountableRoleId).toBe(roleId);
  });

  it("opens downstream work when the dependency completes (new basis → new dispatch)", async () => {
    const node = await graph.getNode(tenantId, designId);
    await graph.updateNode({
      tenantId,
      id: designId,
      identity: { ...node!.identity, state: "done" },
      expectedRevision: (node as { revision?: number }).revision ?? 1,
    } as never);

    const run = await dispatchUnblockedWork(pool, events, tenantId);
    expect(run.dispatched.map((d) => d.workItemId)).toEqual([shipId]);

    const evs = await pool.query(
      `SELECT count(*)::int AS c FROM events.events WHERE tenant_id = $1 AND type = $2`,
      [tenantId, WORK_DISPATCHED_EVENT_TYPE],
    );
    expect(evs.rows[0].c).toBe(2);
  });
});
