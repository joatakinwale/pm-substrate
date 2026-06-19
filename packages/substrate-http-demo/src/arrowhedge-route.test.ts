/**
 * ArrowHedgeLab live-ingest route DB proof.
 *
 * Proves the bridge end-to-end through HTTP: an ArrowHedge snapshot POSTed to
 * /tenants/:id/arrowhedge/snapshots runs the real finance pipeline (graph +
 * events in one tx) and returns the materialized Common Operating Picture with
 * the authority gate and stale-block metrics. This is the same proof as the
 * in-process integration test, but exercised over the HTTP seam the Python
 * agents actually call.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Hono } from "hono";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresRegistry } from "@pm/registry";
import { PostgresTenantDirectory } from "@pm/tenants";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import type { TenantId } from "@pm/types";
import { createSubstrateApp } from "@pm/substrate-http";
import { arrowhedgeRoutes } from "./arrowhedge-route.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

// A clean, current snapshot: risk read and decision share the observed tick,
// evidence is fresh. Expect authority gate pass, zero stale blocks.
const cleanSnapshot = {
  snapshotId: "snap_aapl_2026_06_03_1400",
  observedAt: "2026-06-03T14:00:00.000Z",
  authority: "arrowhedge:backtest:bt_aapl_breakout",
  backtestRun: {
    id: "bt_aapl_breakout",
    title: "AAPL breakout backtest",
    scopeStart: "2026-05-01",
    scopeEnd: "2026-06-03",
    state: "completed",
    datasetRef: "s3://arrowhedge/backtests/aapl-breakout.csv",
    seed: "seed-42",
  },
  researchRun: {
    id: "rr_aapl_breakout",
    title: "AAPL breakout research",
    scopeStart: "2026-05-01",
    scopeEnd: "2026-06-03",
    state: "deciding",
    strategy: "breakout",
    modelLock: "gpt-research-2026-06-01",
    seed: "seed-42",
  },
  ticker: { symbol: "AAPL", assetClass: "equity", exchange: "NASDAQ", currency: "USD" },
  evidence: [
    {
      id: "ev_price_window",
      sha256: "a".repeat(64),
      mimeType: "application/json",
      filename: "aapl-price-window.json",
      sourceUri: "s3://arrowhedge/evidence/aapl-price-window.json",
      retrievedAt: "2026-06-03T13:58:00.000Z",
      freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
    },
    {
      id: "ev_news_window",
      sha256: "b".repeat(64),
      mimeType: "text/markdown",
      filename: "aapl-news-window.md",
      sourceUri: "s3://arrowhedge/evidence/aapl-news-window.md",
      retrievedAt: "2026-06-03T13:57:00.000Z",
      freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
    },
  ],
  signal: {
    id: "sig_aapl_breakout",
    agentId: "analyst_momentum",
    signal: "buy",
    confidence: 0.82,
    evidenceWindowStart: "2026-06-03T13:30:00.000Z",
    evidenceWindowEnd: "2026-06-03T13:59:00.000Z",
  },
  risk: {
    id: "risk_aapl_1400",
    currentPrice: 189.25,
    remainingPositionLimit: 50000,
    maxShares: 120,
    volatility: 0.21,
    bindingConstraint: "position_limit",
    freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
  },
  portfolio: {
    id: "portfolio_main_1400",
    cash: 250000,
    equity: 1000000,
    marginRequirement: 0.25,
    marginUsed: 0.11,
  },
  decision: {
    id: "dec_aapl_buy_120",
    action: "buy",
    quantity: 120,
    confidence: 0.76,
    reasoning: "Breakout signal passed risk gate.",
    accepted: true,
    riskSourceSnapshotId: "snap_aapl_2026_06_03_1400",
    signalSourceSnapshotId: "snap_aapl_2026_06_03_1400",
  },
};

describeIfDb("ArrowHedge live-ingest HTTP route", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let tenantsDirectory: PostgresTenantDirectory;
  let profileRegistry: PostgresProfileRegistry;
  let capRegistry: PostgresRegistry;
  let projections: PostgresProjectionRunner;
  let app: Hono;
  const tenants: TenantId[] = [];

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    tenantsDirectory = new PostgresTenantDirectory(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    capRegistry = new PostgresRegistry(pool);
    projections = new PostgresProjectionRunner(pool, events);

    app = createSubstrateApp({
      tenants: tenantsDirectory,
      profileRegistry,
      capabilityRegistry: capRegistry,
      graph,
      events,
      projections,
      extraRoutes: [
        {
          basePath: "arrowhedge",
          router: arrowhedgeRoutes({
            pool,
            graph,
            events,
            projections,
            copProjectionName: `arrowhedge_cop_http_${randomUUID().slice(0, 6)}`,
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  const call = async (method: string, path: string, body?: unknown): Promise<Response> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { "content-type": "application/json" };
    }
    return app.fetch(new Request(`http://test${path}`, init));
  };

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_ah_http_${randomUUID().slice(0, 8)}` as TenantId;
    await tenantsDirectory.create({ id, displayName: id });
    await profileRegistry.install(id, FINANCE_RESEARCH_PROFILE);
    tenants.push(id);
    return id;
  };

  // Each live tick carries unique source-record identities. Re-deriving a
  // fresh snapshot per test avoids cross-test identity collisions on the
  // shared in-process COP projection (same way real runs never reuse ids).
  const freshSnapshot = (): typeof cleanSnapshot => {
    const tag = randomUUID().slice(0, 8);
    return {
      ...cleanSnapshot,
      snapshotId: `snap_aapl_${tag}`,
      backtestRun: { ...cleanSnapshot.backtestRun, id: `bt_${tag}` },
      researchRun: { ...cleanSnapshot.researchRun, id: `rr_${tag}` },
      evidence: cleanSnapshot.evidence.map((e) => ({ ...e, id: `${e.id}_${tag}` })),
      signal: { ...cleanSnapshot.signal, id: `sig_${tag}` },
      risk: { ...cleanSnapshot.risk, id: `risk_${tag}` },
      portfolio: { ...cleanSnapshot.portfolio, id: `portfolio_${tag}` },
      decision: {
        ...cleanSnapshot.decision,
        id: `dec_${tag}`,
        riskSourceSnapshotId: `snap_aapl_${tag}`,
        signalSourceSnapshotId: `snap_aapl_${tag}`,
      },
    };
  };

  it("POST /snapshots ingests a live tick and returns COP with passing authority gate", async () => {
    const tenantId = await makeTenant();

    const r = await call("POST", `/tenants/${tenantId}/arrowhedge/snapshots`, freshSnapshot());
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      ingested: { nodesCreated: number; edgesCreated: number; eventsPublished: number };
      cop: {
        tickers: Record<string, { authorityGate: { passes: number; failures: number }; staleBlocks: number }>;
        summary: { authorityGatePassRate: number };
      };
    };

    expect(body.ingested.nodesCreated).toBe(9);
    expect(body.ingested.edgesCreated).toBe(15);
    expect(body.ingested.eventsPublished).toBe(13);

    expect(body.cop.tickers["AAPL"]).toMatchObject({
      authorityGate: { passes: 1, failures: 0 },
      staleBlocks: 0,
    });
    expect(body.cop.summary.authorityGatePassRate).toBe(1);
  });

  it("rejects an invalid snapshot with 422 and issues", async () => {
    const tenantId = await makeTenant();
    const r = await call("POST", `/tenants/${tenantId}/arrowhedge/snapshots`, {
      snapshotId: "broken",
    });
    expect(r.status).toBe(422);
    const body = (await r.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe("invalid snapshot");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("GET /cop reads current COP without ingesting", async () => {
    const tenantId = await makeTenant();
    await call("POST", `/tenants/${tenantId}/arrowhedge/snapshots`, freshSnapshot());
    const r = await call("GET", `/tenants/${tenantId}/arrowhedge/cop`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      cop: { tickers: Record<string, unknown> };
    };
    expect(body.cop.tickers["AAPL"]).toBeTruthy();
  });
});
