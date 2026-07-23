/**
 * scripts/loop-metrics.ts — the D7 evidence fold, shared by `dev:metrics`
 * and the memo generator (`pm:memo`). One implementation so the numbers in
 * the keep/kill memo can never drift from the numbers the loop watches.
 * Everything derives from the admitted log + hash-chained ledger — never
 * agent self-report.
 */

import pg from "pg";

import {
  PostgresContinuityLedger,
  verifyContinuityCheckpointChain,
} from "../packages/continuity/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";

export interface LoopMetrics {
  readonly generatedAt: string;
  readonly scope: string;
  readonly sessions: number;
  readonly handoffCoverage: boolean;
  readonly chainValid: boolean;
  readonly workOpened: number;
  readonly workClosed: number;
  readonly workStillOpen: number;
  readonly closedPerSession: number;
  readonly mcpAdmitted: number;
  readonly mcpBlocked: number;
  readonly blockRate: number | null;
  readonly workDispatched: number;
  readonly adaptersRegistered: number;
  readonly syncUpserted: number;
  readonly syncRejected: number;
  readonly executorDispatched: number;
  readonly executorRefused: number;
  readonly executorFailed: number;
  readonly decisionsStanding: number;
  readonly decisionsSuperseded: number;
  readonly totalTokens: number;
  readonly costSessions: number;
  readonly tokensPerClosedItem: number | null;
}

export async function computeLoopMetrics(
  pool: pg.Pool,
  ids: {
    readonly tenantId: TenantId;
    readonly agentId: string;
    readonly scope: string;
    readonly costEventType?: string;
  },
): Promise<LoopMetrics> {
  const costEventType = ids.costEventType ?? "dev.session.cost";
  const ledger = new PostgresContinuityLedger(pool);
  const all = await ledger.list({
    tenantId: ids.tenantId,
    agentId: ids.agentId,
    scope: ids.scope,
    limit: 2000,
  });
  const chain = verifyContinuityCheckpointChain({
    tenantId: ids.tenantId,
    agentId: ids.agentId,
    checkpoints: all,
  });
  const handoffs = all.filter((c) => c.kind === "handoff");
  const work = all.filter((c) => c.kind === "work");
  const closedTitles = new Set(
    work.filter((c) => c.status === "closed").map((c) => c.title),
  );
  const openWork = work.filter(
    (c) => c.status === "open" && !closedTitles.has(c.title),
  );
  const decisions = all.filter((c) => c.kind === "decision");
  const superseded = all.filter((c) => c.status === "superseded");

  const mcp = await pool.query<{ outcome: string; c: string }>(
    `SELECT payload->>'terminalOutcome' AS outcome, count(*)::text AS c
       FROM events.events WHERE tenant_id = $1 AND type = 'pm.mcp.action'
      GROUP BY 1`,
    [ids.tenantId],
  );
  const dispatched = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM events.events
      WHERE tenant_id = $1 AND type = 'pm.work.dispatched'`,
    [ids.tenantId],
  );
  const cost = await pool.query<{ total: string | null; sessions: string }>(
    `SELECT sum((payload->>'totalTokens')::bigint)::text AS total,
            count(distinct entity_id)::text AS sessions
       FROM events.events WHERE tenant_id = $1 AND type = $2`,
    [ids.tenantId, costEventType],
  );
  const kit = await pool.query<{ type: string; c: string }>(
    `SELECT type, count(*)::text AS c FROM events.events
      WHERE tenant_id = $1 AND type = ANY($2::text[]) GROUP BY type`,
    [
      ids.tenantId,
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
    Number(kit.rows.find((r) => r.type === type)?.c ?? 0);
  const adapters = await pool.query<{ c: string }>(
    `SELECT count(distinct payload->>'adapterId')::text AS c
       FROM events.events
      WHERE tenant_id = $1 AND type = 'pm.adapter.registered'`,
    [ids.tenantId],
  );

  const blocked = Number(mcp.rows.find((r) => r.outcome === "blocked")?.c ?? 0);
  const accepted = Number(
    mcp.rows.find((r) => r.outcome === "accepted")?.c ?? 0,
  );
  const totalTokens = Number(cost.rows[0]?.total ?? 0);
  const sessions = Math.max(handoffs.length, 1);
  const closed = closedTitles.size;

  return {
    generatedAt: new Date().toISOString(),
    scope: ids.scope,
    sessions: handoffs.length,
    handoffCoverage: handoffs.length > 0,
    chainValid: chain.valid,
    workOpened: work.filter((c) => c.status !== "closed").length + closed,
    workClosed: closed,
    workStillOpen: openWork.length,
    closedPerSession: Number((closed / sessions).toFixed(2)),
    mcpAdmitted: accepted,
    mcpBlocked: blocked,
    blockRate:
      accepted + blocked > 0
        ? Number((blocked / (accepted + blocked)).toFixed(3))
        : null,
    workDispatched: Number(dispatched.rows[0]?.c ?? 0),
    adaptersRegistered: Number(adapters.rows[0]?.c ?? 0),
    syncUpserted: kitLane("pm.sync.upserted"),
    syncRejected: kitLane("pm.sync.rejected"),
    executorDispatched: kitLane("pm.executor.dispatched"),
    executorRefused: kitLane("pm.executor.refused"),
    executorFailed: kitLane("pm.executor.failed"),
    decisionsStanding: decisions.filter((d) => d.status !== "superseded")
      .length,
    decisionsSuperseded: superseded.length,
    totalTokens,
    costSessions: Number(cost.rows[0]?.sessions ?? 0),
    tokensPerClosedItem: closed > 0 ? Math.round(totalTokens / closed) : null,
  };
}
