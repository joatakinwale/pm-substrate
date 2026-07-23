import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PM_GOVERNANCE_PROFILE } from "@pm/profile-pmgovernance";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import type { EntityId, TenantId } from "@pm/types";

import { StageGateHandler } from "./handler.js";
import { PM_STATUS_ROLLUP_PROJECTION } from "./status-rollup.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("pm.stage-gate capability (governed advancement)", () => {
  let pool: pg.Pool;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let profileRegistry: PostgresProfileRegistry;
  let handler: StageGateHandler;
  let tenantId: TenantId;
  let workItemId: EntityId;
  let approvalId: EntityId;

  const workItemState = async (): Promise<string> => {
    const r = await pool.query(
      `SELECT identity->>'state' AS state FROM graph.nodes
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, workItemId],
    );
    return r.rows[0].state as string;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    tenantId = `tnt_gate_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, PM_GOVERNANCE_PROFILE);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    handler = new StageGateHandler({
      pool,
      graph,
      events,
      profileRegistry,
      emittedBy: "pm.stage-gate.test",
    });

    workItemId = (
      await graph.createNode({
        tenantId,
        profile: {
          tier1: "Engagement",
          profile: "pmgovernance",
          concrete: "WorkItem",
        },
        identity: {
          title: "Governed work item",
          scopeStart: null,
          scopeEnd: null,
          state: "in_review",
          priority: "p1",
        },
        schemaVersion: 1,
      })
    ).node.id;

    approvalId = (
      await graph.createNode({
        tenantId,
        profile: {
          tier1: "Event",
          profile: "pmgovernance",
          concrete: "ApprovalRequest",
        },
        identity: {
          kind: "stage_gate_approval",
          occurredAt: "2026-07-02T10:00:00.000Z",
          decisionState: "approved",
        },
        schemaVersion: 1,
      })
    ).node.id;

    await graph.createEdge({
      tenantId,
      type: "pmgovernance/requests",
      fromId: approvalId,
      toId: workItemId,
      attrs: {},
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(
      `DELETE FROM pm_governance.applied_gate_events WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await events.close();
    await pool.end();
  });

  it("advances in_review → done on approval, emits pm.workitem.advanced, and is idempotent", async () => {
    const gateEventId = `gate_${randomUUID().slice(0, 8)}`;
    await handler.handle(tenantId, {
      approvalRequestId: approvalId,
      gateEventId,
      decidedBy: "human:pm",
      decidedAt: "2026-07-02T10:01:00.000Z",
    });
    expect(await workItemState()).toBe("done");

    const emitted = await pool.query(
      `SELECT type, payload FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.workitem.advanced'`,
      [tenantId],
    );
    expect(emitted.rowCount).toBe(1);
    expect(emitted.rows[0].payload).toMatchObject({
      workItemId,
      fromState: "in_review",
      toState: "done",
      approvalRequestId: approvalId,
      sourceGateEventId: gateEventId,
    });

    // Idempotent replay: same gateEventId → no double-advance, no new event.
    await handler.handle(tenantId, {
      approvalRequestId: approvalId,
      gateEventId,
      decidedBy: "human:pm",
      decidedAt: "2026-07-02T10:02:00.000Z",
    });
    const again = await pool.query(
      `SELECT count(*)::int AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.workitem.advanced'`,
      [tenantId],
    );
    expect(again.rows[0].c).toBe(1);
  });

  it("is a clean no-op when the WorkItem is not in an advanceable state", async () => {
    // WorkItem is now 'done' — a fresh approval decision must not advance it
    // (done → accepted is milestone-gated, not approval-gated).
    await handler.handle(tenantId, {
      approvalRequestId: approvalId,
      gateEventId: `gate_${randomUUID().slice(0, 8)}`,
      decidedBy: "human:pm",
      decidedAt: "2026-07-02T10:03:00.000Z",
    });
    expect(await workItemState()).toBe("done");
  });

  it("status rollup projection folds the advancement deterministically", async () => {
    const emitted = await pool.query(
      `SELECT id, tenant_id, type, entity_id, emitted_by, payload, occurred_at, recorded_at
         FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.workitem.advanced'
        ORDER BY recorded_at`,
      [tenantId],
    );
    let state = PM_STATUS_ROLLUP_PROJECTION.initial();
    for (const row of emitted.rows) {
      state = PM_STATUS_ROLLUP_PROJECTION.apply(state, {
        id: row.id,
        tenantId: row.tenant_id,
        type: row.type,
        entityId: row.entity_id,
        emittedBy: row.emitted_by,
        payload: row.payload,
      } as never);
    }
    expect(state.advancedCount).toBe(1);
    expect(state.byToState).toEqual({ done: 1 });
    expect(state.byWorkItem[workItemId]).toBe("done");
  });
});
