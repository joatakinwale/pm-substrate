import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { Hono } from "hono";

import { PostgresContinuityLedger } from "@pm/continuity";
import { PostgresEventStore } from "@pm/events";
import type { EntityId, TenantId } from "@pm/types";

import { controlPlaneRoutes } from "./routes/control-plane.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("control-plane route (D4): five questions from the admitted log", () => {
  let pool: pg.Pool;
  let app: Hono;
  let tenantId: TenantId;
  const scope = `cp-test-${randomUUID().slice(0, 8)}`;
  const agentId = "cp-test-agent";

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_cp_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    const ledger = new PostgresContinuityLedger(pool);
    await ledger.record({
      tenantId,
      agentId,
      scope,
      kind: "work",
      title: "Open thing",
      summary: "Being done right now.",
    });
    await ledger.record({
      tenantId,
      agentId,
      scope,
      kind: "work",
      title: "Finished thing",
      summary: "Was done.",
      status: "closed",
    });
    await ledger.record({
      tenantId,
      agentId,
      scope,
      kind: "handoff",
      title: "handoff test",
      summary: "Next session starts here.",
    });
    const events = new PostgresEventStore(pool);
    await events.publish({
      tenantId,
      type: "dev.session.cost",
      entityId: "dev_session:test" as unknown as EntityId,
      emittedBy: agentId,
      payloadSchema: "dev.session.cost.v1",
      payload: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    await events.close();

    app = new Hono();
    app.route("/tenants/:tenantId/control-plane", controlPlaneRoutes(pool));
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("answers all five questions plus integrity in one call", async () => {
    const res = await app.request(
      `/tenants/${tenantId}/control-plane?scope=${scope}&agentId=${agentId}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      beingDone: {
        openWork: { title: string }[];
        lastHandoff: { title: string } | null;
      };
      governance: { eventsByType: { type: string; count: number }[] };
      costs: { totalTokens: number; labeledSessions: number };
      optimized: { closedWork: { title: string }[] };
      integrity: { chainValid: boolean; checkpointCount: number };
    };
    expect(body.beingDone.openWork.map((w) => w.title)).toContain("Open thing");
    expect(body.beingDone.lastHandoff?.title).toBe("handoff test");
    expect(
      body.governance.eventsByType.find((e) => e.type === "dev.session.cost")
        ?.count,
    ).toBe(1);
    expect(body.costs.totalTokens).toBe(150);
    expect(body.costs.labeledSessions).toBe(1);
    expect(body.optimized.closedWork.map((w) => w.title)).toContain(
      "Finished thing",
    );
    expect(body.integrity.chainValid).toBe(true);
    expect(body.integrity.checkpointCount).toBe(3);
  });
});
