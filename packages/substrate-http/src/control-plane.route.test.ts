import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Hono } from "hono";

import { PostgresContinuityLedger } from "@pm/continuity";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresRegistry } from "@pm/registry";
import { PostgresTenantDirectory } from "@pm/tenants";
import type { EntityId, TenantId } from "@pm/types";

import { createSubstrateApp } from "./app.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

/**
 * D4 integration coverage: the control-plane route answers the five questions
 * from the admitted log alone. Seeds real ledger + event state (including a
 * BLOCKED pm.mcp.action and a pm.work.dispatched) and asserts every section.
 */
describeIfDb("GET /tenants/:tenantId/control-plane (five questions)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let app: Hono;
  let tenantId: TenantId;
  const scope = `cp-test-${randomUUID().slice(0, 8)}`;
  const agentId = "cp-test-agent";

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    tenantId = `tnt_cp_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );

    // Question 1 + 5 seeds: open work, closed work, decision, claim, handoff.
    const ledger = new PostgresContinuityLedger(pool);
    const rec = (
      kind: "work" | "decision" | "lesson" | "claim" | "handoff",
      title: string,
      status?: "open" | "closed",
    ) =>
      ledger.record({
        tenantId,
        agentId,
        scope,
        kind,
        title,
        summary: `${title} (seeded)`,
        ...(status ? { status } : {}),
      });
    await rec("work", "Open item under way", "open");
    await rec("work", "Finished item", "closed");
    await rec("decision", "Standing decision A");
    await rec("claim", "Claim under test B");
    await rec("lesson", "Lesson C");
    await rec("handoff", "Last handoff D");

    // Question 2 + 3 + 4 seeds: cost, blocked MCP action, dispatched work.
    const publish = (
      type: string,
      payload: Record<string, unknown>,
    ) =>
      events.publish({
        tenantId,
        type,
        entityId: `cp:${type}` as unknown as EntityId,
        emittedBy: agentId,
        payloadSchema: `${type}.v1`,
        payload,
      });
    await publish("dev.session.cost", {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      model: "test",
      source: "measured",
      scope,
    });
    await publish("pm.mcp.action", {
      proposalId: "prop_blocked",
      terminalOutcome: "blocked",
      blockingCauseCodes: ["stale_read_ref"],
      executed: false,
    });
    await publish("pm.mcp.action", {
      proposalId: "prop_ok",
      terminalOutcome: "accepted",
      executed: true,
    });
    await publish("pm.work.dispatched", {
      workItemId: "wi_1",
      accountableRole: "agent-alpha",
      basisHash: "abc",
    });

    app = createSubstrateApp({
      tenants: new PostgresTenantDirectory(pool),
      profileRegistry: new PostgresProfileRegistry(pool),
      capabilityRegistry: new PostgresRegistry(pool),
      graph: new PostgresGraph(pool),
      events,
      projections: new PostgresProjectionRunner(pool, events),
      controlPlanePool: pool,
    });
  });

  afterAll(async () => {
    await events.close();
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("answers all five questions from the admitted log", async () => {
    const res = await app.request(
      `/tenants/${tenantId}/control-plane?scope=${scope}&agentId=${agentId}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      beingDone: {
        openWork: { title: string }[];
        lastHandoff: { title: string } | null;
      };
      governance: {
        eventsByType: { type: string; count: number }[];
        mcpActionsBlocked: number;
        workDispatched: number;
      };
      costs: { totalTokens: number; labeledSessions: number };
      results: {
        decisions: { title: string }[];
        claimsUnderTest: { title: string }[];
      };
      optimized: {
        closedWork: { title: string }[];
        lessons: { title: string }[];
      };
      integrity: { checkpointCount: number; chainValid: boolean };
    };

    // 1. What is being done?
    expect(body.beingDone.openWork.map((w) => w.title)).toContain(
      "Open item under way",
    );
    expect(body.beingDone.lastHandoff?.title).toBe("Last handoff D");

    // 2. What did governance do?
    const types = body.governance.eventsByType.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(["pm.mcp.action", "pm.work.dispatched"]),
    );
    expect(body.governance.mcpActionsBlocked).toBe(1);
    expect(body.governance.workDispatched).toBe(1);

    // 3. What did it cost?
    expect(body.costs.totalTokens).toBe(1500);
    expect(body.costs.labeledSessions).toBeGreaterThanOrEqual(1);

    // 4. What are the results?
    expect(body.results.decisions.map((d) => d.title)).toContain(
      "Standing decision A",
    );
    expect(body.results.claimsUnderTest.map((c) => c.title)).toContain(
      "Claim under test B",
    );

    // 5. What got optimized?
    expect(body.optimized.closedWork.map((w) => w.title)).toContain(
      "Finished item",
    );
    expect(body.optimized.lessons.map((l) => l.title)).toContain("Lesson C");

    // Integrity: derived from the hash chain, not self-report.
    expect(body.integrity.checkpointCount).toBe(6);
    expect(body.integrity.chainValid).toBe(true);
  });

  it("is absent when no controlPlanePool is wired (surface stays opt-in)", async () => {
    const bare = createSubstrateApp({
      tenants: new PostgresTenantDirectory(pool),
      profileRegistry: new PostgresProfileRegistry(pool),
      capabilityRegistry: new PostgresRegistry(pool),
      graph: new PostgresGraph(pool),
      events,
      projections: new PostgresProjectionRunner(pool, events),
    });
    const res = await bare.request(`/tenants/${tenantId}/control-plane`);
    expect(res.status).toBe(404);
  });
});
