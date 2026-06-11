/**
 * Pinning tests for the @pm/graph validator wiring.
 *
 * Validates that when the graph is constructed with a ProfileValidator
 * factory, profile-illegal writes are rejected at the graph layer — not
 * silently accepted. This closes the bypass identified at the end of P1:
 * before this commit, validator.validateNode() was opt-in, so callers
 * could skip it accidentally.
 *
 * Fixtures use the finance-research profile (the ArrowHedge agent-state
 * validation artifact).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  PostgresProfileRegistry,
  ProfileValidationError,
} from "@pm/profile-registry";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import type { ProfileBinding, TenantId } from "@pm/types";
import { PostgresGraph } from "./postgres.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresGraph validator wiring", () => {
  let pool: pg.Pool;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;
  let tenantId: TenantId;

  const RESEARCH_RUN: ProfileBinding = {
    tier1: "Engagement", profile: "finance-research", concrete: "ResearchRun",
  };
  const TICKER: ProfileBinding = {
    tier1: "Resource", profile: "finance-research", concrete: "Ticker",
  };
  const ANALYST_SIGNAL: ProfileBinding = {
    tier1: "Event", profile: "finance-research", concrete: "AnalystSignal",
  };

  const researchRunIdentity = (title: string) => ({
    title,
    scopeStart: "2026-05-01",
    scopeEnd: "2026-06-03",
    state: "configured",
  });
  const tickerIdentity = (symbol: string) => ({
    name: `${symbol} ticker`,
    kind: "ticker",
    symbol,
    assetClass: "equity",
    currency: "USD",
  });
  const signalIdentity = (agentId: string) => ({
    kind: "analyst_signal",
    occurredAt: "2026-06-03T14:00:00.000Z",
    agentId,
    signal: "bullish",
    confidence: 0.8,
  });

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    tenantId = `tnt_gv_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, FINANCE_RESEARCH_PROFILE);

    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("rejects createNode missing required profile fields", async () => {
    await expect(
      graph.createNode({
        tenantId,
        profile: RESEARCH_RUN,
        identity: { title: "T" }, // missing scopeStart, scopeEnd, state
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects createNode with unknown concrete type", async () => {
    await expect(
      graph.createNode({
        tenantId,
        profile: { tier1: "Engagement", profile: "finance-research", concrete: "ResearchRun3" },
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("accepts a well-formed ResearchRun node", async () => {
    const { node: run } = await graph.createNode({
      tenantId,
      profile: RESEARCH_RUN,
      identity: researchRunIdentity("AAPL breakout research"),
      schemaVersion: 1,
    });
    expect(run.id).toMatch(/^ent_/);
  });

  it("rejects createEdge that would exceed signal_for_ticker exactly:1", async () => {
    const { node: signal } = await graph.createNode({
      tenantId, profile: ANALYST_SIGNAL,
      identity: signalIdentity("agent:analyst_momentum"),
      schemaVersion: 1,
    });
    const { node: t1 } = await graph.createNode({
      tenantId, profile: TICKER, identity: tickerIdentity("AAPL"), schemaVersion: 1,
    });
    const { node: t2 } = await graph.createNode({
      tenantId, profile: TICKER, identity: tickerIdentity("MSFT"), schemaVersion: 1,
    });

    await graph.createEdge({
      tenantId, type: "finance-research/signal_for_ticker",
      fromId: signal.id, toId: t1.id, attrs: {},
    });
    // Second would push from-count to 2 — a signal targets exactly one ticker.
    await expect(
      graph.createEdge({
        tenantId, type: "finance-research/signal_for_ticker",
        fromId: signal.id, toId: t2.id, attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects createEdge with from-type not in the declared from-types", async () => {
    const { node: signal } = await graph.createNode({
      tenantId, profile: ANALYST_SIGNAL,
      identity: signalIdentity("agent:analyst_value"),
      schemaVersion: 1,
    });
    const { node: ticker } = await graph.createNode({
      tenantId, profile: TICKER, identity: tickerIdentity("NVDA"), schemaVersion: 1,
    });
    // signal_for_ticker is declared as AnalystSignal -> Ticker. Reverse it.
    await expect(
      graph.createEdge({
        tenantId, type: "finance-research/signal_for_ticker",
        fromId: ticker.id, toId: signal.id, attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects updateNode that drops a required field", async () => {
    const { node: run } = await graph.createNode({
      tenantId, profile: RESEARCH_RUN,
      identity: researchRunIdentity("Update Test research"),
      schemaVersion: 1,
    });
    await expect(
      graph.updateNode({
        tenantId,
        id: run.id,
        identity: { title: "Only Title" }, // dropped required fields
        expectedSchemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("permits raw Tier-1 writes (no profile binding) regardless of installed profiles", async () => {
    // Layered ontology rule: raw Tier-1 stays usable even when profiles are
    // installed. The validator passes profile=null through with no checks.
    const { node: n } = await graph.createNode({
      tenantId,
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: {},
      schemaVersion: 1,
    });
    expect(n.profile.profile).toBeNull();
  });
});
