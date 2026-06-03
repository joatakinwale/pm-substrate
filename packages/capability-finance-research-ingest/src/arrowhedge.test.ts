import { describe, expect, it } from "vitest";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import { tenantId, timestamp } from "@pm/types";

import {
  buildArrowHedgeIngestionPlan,
  createArrowHedgeCommonOperatingPictureProjection,
  parseArrowHedgeSnapshot,
} from "./arrowhedge.js";

const snapshot = {
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
  ticker: {
    symbol: "AAPL",
    assetClass: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
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

describe("ArrowHedge snapshot adapter", () => {
  it("parses a source snapshot into finance-research source records", () => {
    const parsed = parseArrowHedgeSnapshot(snapshot);

    expect(parsed.valid).toBe(true);
    expect(parsed.issues).toEqual([]);
    expect(parsed.records.map((record) => record.sourceName)).toEqual([
      "BacktestRunSource",
      "ResearchRunSource",
      "TickerSource",
      "EvidenceDocumentSource",
      "EvidenceDocumentSource",
      "PortfolioStateSource",
      "AnalystSignalSource",
      "RiskStateSource",
      "PortfolioDecisionSource",
    ]);
    expect(parsed.records[2]).toMatchObject({
      sourceRecordId: "ticker:AAPL",
      row: {
        name: "AAPL",
        kind: "ticker",
        symbol: "AAPL",
        assetClass: "equity",
        currency: "USD",
      },
    });
  });

  it("builds a validated graph, edge, typed-event, and operational metric plan", () => {
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenantId("tnt_arrowhedge_plan"),
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });

    expect(plan.valid).toBe(true);
    expect(plan.mapping.items).toHaveLength(9);
    expect(plan.edges).toHaveLength(15);
    expect(plan.typedEvents.map((event) => event.type)).toEqual([
      "analyst.signal.created",
      "risk.state.validated",
      "portfolio.decision.proposed",
      "portfolio.decision.accepted",
    ]);
    expect(plan.typedEvents[0]).toMatchObject({
      authority: "arrowhedge:backtest:bt_aapl_breakout",
      payloadSchema: "finance-research/analyst-signal-created.v1",
      payload: {
        sourceSnapshotId: "snap_aapl_2026_06_03_1400",
        tickerSymbol: "AAPL",
        signal: "buy",
        confidence: 0.82,
      },
    });
    expect(plan.operationalSample).toMatchObject({
      mappingAttempts: 9,
      mappingRejections: 0,
      stateComparisons: 1,
      stateDisagreements: 0,
      adapterStartedAt: "2026-06-03T13:59:58.500Z",
      firstValidEventAt: "2026-06-03T14:00:00.000Z",
    });
  });

  it("rejects malformed source snapshots before mapping", () => {
    const invalid = {
      ...snapshot,
      ticker: { ...snapshot.ticker, symbol: "" },
    };

    const plan = buildArrowHedgeIngestionPlan(invalid, {
      tenantId: tenantId("tnt_arrowhedge_bad"),
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });

    expect(plan.valid).toBe(false);
    expect(plan.mapping.items).toEqual([]);
    expect(plan.typedEvents).toEqual([]);
    expect(plan.operationalSample.mappingAttempts).toBe(1);
    expect(plan.operationalSample.mappingRejections).toBeGreaterThan(0);
    expect(plan.issues).toContainEqual({
      path: "/ticker/symbol",
      message: "expected non-empty string",
    });
  });
});

describe("ArrowHedge Common Operating Picture projection", () => {
  it("folds typed finance events into the first COP state", async () => {
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenantId("tnt_arrowhedge_cop"),
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_test");
    let state = projection.initial(tenantId("tnt_arrowhedge_cop"));

    for (const event of plan.typedEvents.map((event, index) => ({
      id: `evt_${index}`,
      tenantId: event.tenantId,
      type: event.type,
      entityId: event.entityId,
      emittedBy: event.emittedBy,
      payloadSchema: event.payloadSchema,
      payload: event.payload,
      schemaVersion: 1,
      authority: event.authority ?? event.emittedBy,
      contentHash: "hash",
      priorEventHash: null,
      occurredAt: event.occurredAt!,
      recordedAt: event.occurredAt!,
      causedBy: null,
    } as const))) {
      state = await projection.apply(state, event);
    }

    expect(state.tickers["AAPL"]).toMatchObject({
      symbol: "AAPL",
      latestSignal: {
        signal: "buy",
        confidence: 0.82,
      },
      latestRiskState: {
        currentPrice: 189.25,
        maxShares: 120,
      },
      latestDecision: {
        action: "buy",
        quantity: 120,
        accepted: true,
      },
      authorityGate: {
        passes: 1,
        failures: 0,
      },
      stateDisagreements: 0,
      staleBlocks: 0,
    });
    expect(state.summary).toMatchObject({
      validEventCount: 4,
      authorityGatePassRate: 1,
      stateDisagreementRate: 0,
    });
  });
});
