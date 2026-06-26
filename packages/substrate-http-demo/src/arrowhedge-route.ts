/**
 * ArrowHedgeLab live-ingest route.
 *
 * This is the single tool-onboarding surface the ArrowHedgeLab Python agents
 * call. Instead of bespoke per-agent integration, the hedge fund emits one
 * ArrowHedge *snapshot* per (ticker, decision-tick); this route runs the
 * existing in-process finance-research pipeline atomically:
 *
 *   parse → buildPlan → executePlan (graph + events in one tx) → catchUp(COP)
 *
 * and returns the materialized Common Operating Picture so the caller can read
 * back current authoritative state (authority gate, stale blocks) for the tick
 * it just submitted. See research/arrowhedge-live-substrate-bridge_2026-06-18.md.
 */

import { Hono } from "hono";
import type pg from "pg";
import {
  buildArrowHedgeIngestionPlan,
  executeArrowHedgeIngestionPlan,
  createArrowHedgeCommonOperatingPictureProjection,
  type ArrowHedgeCommonOperatingPictureState,
} from "@pm/capability-finance-research-ingest";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import type { ProfileRegistry } from "@pm/profile-registry";
import type { ProjectionRunner } from "@pm/projections";
import type { PMEvent, TenantId, Timestamp } from "@pm/types";

const errorResponse = (err: unknown): { status: 500; body: { error: string } } => ({
  status: 500,
  body: { error: err instanceof Error ? err.message : String(err) },
});

/**
 * Tx-aware graph + events ports (PostgresGraph / PostgresEventStore satisfy
 * these structurally). Kept narrow so tests can pass fakes.
 */
export interface ArrowHedgeIngestGraphPort {
  createNode(input: unknown, tx?: pg.ClientBase): Promise<unknown>;
  updateNode(input: unknown, tx?: pg.ClientBase): Promise<unknown>;
  createEdge(input: unknown, tx?: pg.ClientBase): Promise<unknown>;
}

export interface ArrowHedgeIngestEventsPort {
  publishWith(tx: pg.ClientBase, input: unknown): Promise<PMEvent>;
}

export interface ArrowHedgeIngestDeps {
  readonly pool: pg.Pool;
  readonly graph: ArrowHedgeIngestGraphPort;
  readonly events: ArrowHedgeIngestEventsPort;
  readonly projections: ProjectionRunner;
  /** Optional: only needed if the route should auto-install the profile. */
  readonly profileRegistry?: ProfileRegistry;
  /** Stable COP projection name per process. Defaults to a shared name. */
  readonly copProjectionName?: string;
}

export const arrowhedgeRoutes = (deps: ArrowHedgeIngestDeps): Hono => {
  const app = new Hono();

  const projectionName =
    deps.copProjectionName ?? "arrowhedge_cop_live";
  const projection =
    createArrowHedgeCommonOperatingPictureProjection(projectionName);
  let registered = false;

  const ensureProjection = async (): Promise<void> => {
    if (registered) return;
    await deps.projections.register(projection);
    registered = true;
  };

  // POST /tenants/:tenantId/arrowhedge/snapshots
  // Body: one ArrowHedge snapshot (see design doc for the contract).
  app.post("/snapshots", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let snapshot: unknown;
    try {
      snapshot = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    try {
      await ensureProjection();

      const plan = buildArrowHedgeIngestionPlan(snapshot, {
        tenantId,
        profile: FINANCE_RESEARCH_PROFILE,
        adapterStartedAt: new Date().toISOString() as Timestamp,
        // Live route is multi-tenant in one process: namespace node ids by
        // tenant so shared real-world entities (e.g. ticker:AAPL) don't
        // collide on the globally-unique graph node id space.
        scopeNodeIdsByTenant: true,
      });

      if (!plan.valid) {
        return c.json(
          { error: "invalid snapshot", issues: plan.issues },
          422,
        );
      }

      const result = await executeArrowHedgeIngestionPlan(plan, {
        withTransaction: async (fn) => {
          const client = await deps.pool.connect();
          try {
            await client.query("BEGIN");
            const value = await fn(client);
            await client.query("COMMIT");
            return value;
          } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw err;
          } finally {
            client.release();
          }
        },
        graph: {
          createNode: (input, tx) =>
            deps.graph.createNode(input, tx as pg.ClientBase) as never,
          updateNode: (input, tx) =>
            deps.graph.updateNode(input, tx as pg.ClientBase) as never,
          createEdge: (input, tx) =>
            deps.graph.createEdge(input, tx as pg.ClientBase) as never,
        },
        events: {
          publishWith: (tx, input) =>
            deps.events.publishWith(tx as pg.ClientBase, input),
        },
      });

      await deps.projections.catchUp(tenantId, projection.name);
      const cop =
        await deps.projections.getState<ArrowHedgeCommonOperatingPictureState>(
          tenantId,
          projection.name,
        );

      return c.json({
        ingested: {
          nodesCreated: result.nodesCreated,
          nodesUpdated: result.nodesUpdated,
          edgesCreated: result.edgesCreated,
          eventsPublished: result.eventsPublished.length,
          eventIds: result.eventsPublished.map((e) => e.id),
        },
        cop,
      });
    } catch (err) {
      const { status, body } = errorResponse(err);
      return c.json(body, status);
    }
  });

  // GET /tenants/:tenantId/arrowhedge/cop — read current COP without ingesting.
  app.get("/cop", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      await ensureProjection();
      await deps.projections.catchUp(tenantId, projection.name);
      const cop =
        await deps.projections.getState<ArrowHedgeCommonOperatingPictureState>(
          tenantId,
          projection.name,
        );
      return c.json({ cop });
    } catch (err) {
      const { status, body } = errorResponse(err);
      return c.json(body, status);
    }
  });

  return app;
};
