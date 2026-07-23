import { Hono } from "hono";
import pg from "pg";

import {
  PostgresContinuityLedger,
  buildContinuityContext,
  verifyContinuityCheckpointChain,
} from "@pm/continuity";
import type { TenantId } from "@pm/types";

/**
 * Control-plane routes (ROADMAP D4): the five questions, answered from the
 * admitted log alone — never from agent self-report.
 *
 *   1. What is being done?        open work + last handoff (continuity)
 *   2. What did governance do?    admitted events by type, stage-gate
 *                                 applications, procedure admissions
 *   3. What did it cost?          dev.session.cost events
 *   4. What are the results?      metric-bearing event lanes (eval/dispatch)
 *   5. What got optimized?        closed work + superseding decisions
 *
 * GET /tenants/:tenantId/control-plane?scope=…&agentId=…
 */
export const controlPlaneRoutes = (pool: pg.Pool): Hono => {
  const app = new Hono();
  const ledger = new PostgresContinuityLedger(pool);

  app.get("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const scope = c.req.query("scope") ?? "pm-substrate-dev";
    const agentId = c.req.query("agentId") ?? "joat-dev";

    const all = await ledger.list({ tenantId, agentId, scope, limit: 1000 });
    const ctx = await buildContinuityContext(ledger, {
      tenantId,
      agentId,
      scope,
    });
    const chain = verifyContinuityCheckpointChain({
      tenantId,
      agentId,
      checkpoints: all,
    });
    const lastHandoff = all
      .filter((k) => k.kind === "handoff")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    const eventsByType = await pool.query<{ type: string; c: string }>(
      `SELECT type, count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 GROUP BY type ORDER BY count(*) DESC LIMIT 25`,
      [tenantId],
    );
    const gates = await pool
      .query<{ c: string }>(
        `SELECT count(*)::text AS c FROM pm_governance.applied_gate_events
          WHERE tenant_id = $1`,
        [tenantId],
      )
      .catch(() => ({ rows: [{ c: "0" }] }));
    const procedures = await pool
      .query<{ c: string }>(
        `SELECT count(*)::text AS c FROM procedure_admission.admission_records
          WHERE tenant_id = $1`,
        [tenantId],
      )
      .catch(() => ({ rows: [{ c: "0" }] }));
    const costs = await pool.query<{
      total: string | null;
      sessions: string;
    }>(
      `SELECT sum((payload->>'totalTokens')::bigint)::text AS total,
              count(distinct entity_id)::text AS sessions
         FROM events.events
        WHERE tenant_id = $1 AND type = 'dev.session.cost'`,
      [tenantId],
    );
    const blocked = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.mcp.action'
          AND payload->>'terminalOutcome' = 'blocked'`,
      [tenantId],
    );
    const dispatched = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.work.dispatched'`,
      [tenantId],
    );
    // Integration-kit lanes (D5): adapter registry + sync + executor bridge.
    // String literals by this file's precedent — counts come from the log,
    // never from the kit's own code path.
    const kitLanes = await pool.query<{ type: string; c: string }>(
      `SELECT type, count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type = ANY($2::text[]) GROUP BY type`,
      [
        tenantId,
        [
          "pm.sync.upserted",
          "pm.sync.rejected",
          "pm.executor.dispatched",
          "pm.executor.refused",
          "pm.executor.failed",
        ],
      ],
    );
    const kitLane = (type: string): number =>
      Number(kitLanes.rows.find((r) => r.type === type)?.c ?? 0);
    const adapters = await pool.query<{ c: string }>(
      `SELECT count(distinct payload->>'adapterId')::text AS c
         FROM events.events
        WHERE tenant_id = $1 AND type = 'pm.adapter.registered'`,
      [tenantId],
    );
    const closedWork = all
      .filter((k) => k.kind === "work" && k.status === "closed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 15)
      .map((k) => ({ title: k.title, closedAt: k.createdAt }));

    const brief = (rows: readonly { title: string; summary: string }[], n: number) =>
      rows.slice(0, n).map((k) => ({ title: k.title, summary: k.summary }));

    return c.json({
      tenantId,
      scope,
      generatedAt: new Date().toISOString(),
      beingDone: {
        openWork: brief(ctx.openWork, 15),
        lastHandoff: lastHandoff
          ? { title: lastHandoff.title, summary: lastHandoff.summary }
          : null,
      },
      governance: {
        eventsByType: eventsByType.rows.map((r) => ({
          type: r.type,
          count: Number(r.c),
        })),
        stageGateApplications: Number(gates.rows[0]?.c ?? 0),
        procedureAdmissions: Number(procedures.rows[0]?.c ?? 0),
        mcpActionsBlocked: Number(blocked.rows[0]?.c ?? 0),
        workDispatched: Number(dispatched.rows[0]?.c ?? 0),
      },
      costs: {
        totalTokens: Number(costs.rows[0]?.total ?? 0),
        labeledSessions: Number(costs.rows[0]?.sessions ?? 0),
      },
      integration: {
        adaptersRegistered: Number(adapters.rows[0]?.c ?? 0),
        syncUpserted: kitLane("pm.sync.upserted"),
        syncRejected: kitLane("pm.sync.rejected"),
        executorDispatched: kitLane("pm.executor.dispatched"),
        executorRefused: kitLane("pm.executor.refused"),
        executorFailed: kitLane("pm.executor.failed"),
      },
      results: {
        decisions: brief(ctx.decisions, 10),
        claimsUnderTest: brief(ctx.claims, 10),
      },
      optimized: {
        closedWork,
        lessons: brief(ctx.lessons, 10),
      },
      integrity: {
        checkpointCount: all.length,
        chainValid: chain.valid,
        chainErrors: chain.errors.slice(0, 5),
      },
    });
  });

  return app;
};
