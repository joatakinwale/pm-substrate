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
  buildArrowHedgePairedExperimentBundle,
  buildArrowHedgeIngestionPlan,
  executeArrowHedgeIngestionPlan,
  createArrowHedgeCommonOperatingPictureProjection,
  compareArrowHedgeIntegrationRunEnvelopePair,
  expandArrowHedgeRunEnvelope,
  type ArrowHedgeCommonOperatingPictureState,
  type ArrowHedgePairedExperimentArmMetrics,
  type ArrowHedgeIntegrationRunEnvelope,
} from "@pm/capability-finance-research-ingest";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import type { ProfileRegistry } from "@pm/profile-registry";
import type { ProjectionRunner } from "@pm/projections";
import type { PMEvent, TenantId, Timestamp } from "@pm/types";

const errorResponse = (err: unknown): { status: 500; body: { error: string } } => ({
  status: 500,
  body: { error: err instanceof Error ? err.message : String(err) },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pairedMetricNumberFields = [
  "startingEquity",
  "endingEquity",
  "realizedPnl",
  "returnPct",
] as const;

const pairedMetricCountFields = [
  "decisionCount",
  "acceptedDecisionCount",
  "blockedDecisionCount",
  "staleBlockCount",
  "invalidActionBlockCount",
  "falsePositiveBlockCount",
  "falseNegativeBlockCount",
] as const;

const pairedMetricStringArrayFields = [
  "eventIds",
  "blockedEventIds",
] as const;

const pairedMetricFieldNames = new Set<string>([
  ...pairedMetricNumberFields,
  ...pairedMetricCountFields,
  ...pairedMetricStringArrayFields,
  "rawDecisionSha256",
]);

const validatePairedEnvelope = (
  value: unknown,
  path: "baseline" | "substrate",
  issues: string[],
): ArrowHedgeIntegrationRunEnvelope | undefined => {
  const expanded = expandArrowHedgeRunEnvelope(value);
  if (!expanded.valid) {
    issues.push(...expanded.issues.map((issue) => `${path}: ${issue.message}`));
    return undefined;
  }
  return value as ArrowHedgeIntegrationRunEnvelope;
};

const readPairedMetrics = (
  value: unknown,
  path: "baselineMetrics" | "substrateMetrics",
  issues: string[],
): ArrowHedgePairedExperimentArmMetrics | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }

  const metrics: Record<string, unknown> = {};
  for (const [field, metricValue] of Object.entries(value)) {
    if (!pairedMetricFieldNames.has(field)) {
      issues.push(`${path}.${field} is not supported`);
      continue;
    }
    if (
      pairedMetricNumberFields.includes(
        field as (typeof pairedMetricNumberFields)[number],
      )
    ) {
      if (typeof metricValue !== "number" || !Number.isFinite(metricValue)) {
        issues.push(`${path}.${field} must be a finite number`);
        continue;
      }
      metrics[field] = metricValue;
      continue;
    }
    if (
      pairedMetricCountFields.includes(
        field as (typeof pairedMetricCountFields)[number],
      )
    ) {
      if (
        typeof metricValue !== "number" ||
        !Number.isInteger(metricValue) ||
        metricValue < 0
      ) {
        issues.push(`${path}.${field} must be a non-negative integer`);
        continue;
      }
      metrics[field] = metricValue;
      continue;
    }
    if (
      pairedMetricStringArrayFields.includes(
        field as (typeof pairedMetricStringArrayFields)[number],
      )
    ) {
      if (
        !Array.isArray(metricValue) ||
        metricValue.some((item) => typeof item !== "string" || item === "")
      ) {
        issues.push(`${path}.${field} must be an array of non-empty strings`);
        continue;
      }
      metrics[field] = metricValue;
      continue;
    }
    if (typeof metricValue !== "string" || metricValue === "") {
      issues.push(`${path}.${field} must be a non-empty string`);
      continue;
    }
    metrics[field] = metricValue;
  }

  return metrics as ArrowHedgePairedExperimentArmMetrics;
};

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

  const executeSnapshotIngestion = async (
    tenantId: TenantId,
    snapshot: unknown,
  ) => {
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
      return {
        valid: false as const,
        issues: plan.issues,
      };
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

    return {
      valid: true as const,
      result,
    };
  };

  const getCop = async (tenantId: TenantId) => {
    await deps.projections.catchUp(tenantId, projection.name);
    return deps.projections.getState<ArrowHedgeCommonOperatingPictureState>(
      tenantId,
      projection.name,
    );
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

      const ingested = await executeSnapshotIngestion(tenantId, snapshot);
      if (!ingested.valid) {
        return c.json(
          { error: "invalid snapshot", issues: ingested.issues },
          422,
        );
      }

      const cop = await getCop(tenantId);
      const result = ingested.result;

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

  // POST /tenants/:tenantId/arrowhedge/run-envelopes
  // Body: one full ArrowHedge run envelope. The adapter expands it into the
  // same validated per-ticker snapshots used by /snapshots, preserving graph
  // and model configuration as evidence documents on each ticker snapshot.
  app.post("/run-envelopes", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let envelope: unknown;
    try {
      envelope = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    try {
      await ensureProjection();

      const expanded = expandArrowHedgeRunEnvelope(envelope);
      if (!expanded.valid) {
        return c.json(
          { error: "invalid run envelope", issues: expanded.issues },
          422,
        );
      }

      const totals = {
        nodesCreated: 0,
        nodesUpdated: 0,
        edgesCreated: 0,
        eventsPublished: 0,
        eventIds: [] as string[],
      };

      for (const [index, snapshot] of expanded.snapshots.entries()) {
        const ingested = await executeSnapshotIngestion(tenantId, snapshot);
        if (!ingested.valid) {
          return c.json(
            {
              error: "invalid expanded snapshot",
              snapshotIndex: index,
              issues: ingested.issues,
            },
            422,
          );
        }

        totals.nodesCreated += ingested.result.nodesCreated;
        totals.nodesUpdated += ingested.result.nodesUpdated;
        totals.edgesCreated += ingested.result.edgesCreated;
        totals.eventsPublished += ingested.result.eventsPublished.length;
        totals.eventIds.push(
          ...ingested.result.eventsPublished.map((event) => event.id),
        );
      }

      const cop = await getCop(tenantId);

      return c.json({
        expanded: {
          snapshots: expanded.snapshots.length,
          tickers: expanded.snapshots.map((snapshot) => snapshot.ticker.symbol),
        },
        ingested: totals,
        cop,
      });
    } catch (err) {
      const { status, body } = errorResponse(err);
      return c.json(body, status);
    }
  });

  // POST /tenants/:tenantId/arrowhedge/experiments/paired-readiness
  // Body: { baseline, substrate } where both are arrowhedge.run-envelope.v1.
  // This route is an admission gate for market-win experiments: it validates
  // both envelopes and refuses comparison when scope, graph, model config,
  // portfolio, or source-data fingerprints differ.
  app.post("/experiments/paired-readiness", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: "request body must be an object" }, 400);
    }

    const baseline = body["baseline"];
    const substrate = body["substrate"];
    const issues: string[] = [];
    const validBaseline = validatePairedEnvelope(baseline, "baseline", issues);
    const validSubstrate = validatePairedEnvelope(substrate, "substrate", issues);
    if (issues.length > 0) {
      return c.json(
        {
          schemaVersion: "arrowhedge.paired-readiness.v1",
          ready: false,
          error: "invalid paired run envelopes",
          issues,
        },
        422,
      );
    }

    const gate = compareArrowHedgeIntegrationRunEnvelopePair({
      baseline: validBaseline!,
      substrate: validSubstrate!,
    });
    const response = {
      schemaVersion: "arrowhedge.paired-readiness.v1",
      ready: gate.ready,
      issues: gate.issues,
      fingerprints: gate.fingerprints,
      admitted: gate.ready
        ? {
            baselineRunId: validBaseline!.runId,
            substrateRunId: validSubstrate!.runId,
            tickers: validBaseline!.scope.tickers,
            startDate: validBaseline!.scope.startDate,
            endDate: validBaseline!.scope.endDate,
          }
        : null,
    };
    return c.json(response, gate.ready ? 200 : 409);
  });

  // POST /tenants/:tenantId/arrowhedge/experiments/paired-bundles
  // Body: { experimentId, generatedAt?, baseline, substrate, baselineMetrics?,
  // substrateMetrics? }. Returns an immutable paired experiment bundle with
  // envelope hashes plus separated market and governance claim gates.
  app.post("/experiments/paired-bundles", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: "request body must be an object" }, 400);
    }

    const issues: string[] = [];
    const experimentId = body["experimentId"];
    if (typeof experimentId !== "string" || experimentId.trim() === "") {
      issues.push("experimentId must be a non-empty string");
    }
    const generatedAt = body["generatedAt"];
    if (generatedAt !== undefined && typeof generatedAt !== "string") {
      issues.push("generatedAt must be a string when provided");
    }
    const baseline = validatePairedEnvelope(
      body["baseline"],
      "baseline",
      issues,
    );
    const substrate = validatePairedEnvelope(
      body["substrate"],
      "substrate",
      issues,
    );
    const baselineMetrics = readPairedMetrics(
      body["baselineMetrics"],
      "baselineMetrics",
      issues,
    );
    const substrateMetrics = readPairedMetrics(
      body["substrateMetrics"],
      "substrateMetrics",
      issues,
    );

    if (issues.length > 0) {
      return c.json(
        {
          schemaVersion: "arrowhedge.paired-experiment-bundle.v1",
          error: "invalid paired experiment bundle input",
          issues,
        },
        422,
      );
    }

    const bundle = buildArrowHedgePairedExperimentBundle({
      experimentId: experimentId as string,
      ...(typeof generatedAt === "string" ? { generatedAt } : {}),
      baseline: {
        envelope: baseline!,
        ...(baselineMetrics === undefined ? {} : { metrics: baselineMetrics }),
      },
      substrate: {
        envelope: substrate!,
        ...(substrateMetrics === undefined ? {} : { metrics: substrateMetrics }),
      },
    });

    return c.json(bundle);
  });

  // GET /tenants/:tenantId/arrowhedge/cop — read current COP without ingesting.
  app.get("/cop", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      await ensureProjection();
      const cop = await getCop(tenantId);
      return c.json({ cop });
    } catch (err) {
      const { status, body } = errorResponse(err);
      return c.json(body, status);
    }
  });

  return app;
};
