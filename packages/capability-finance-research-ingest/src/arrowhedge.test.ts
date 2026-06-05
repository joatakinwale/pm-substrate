import { describe, expect, it } from "vitest";
import {
  buildReadSetFromCurrentStateView,
  validateProposedActionReadSet,
} from "@pm/agent-state";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import { tenantId, timestamp } from "@pm/types";

import {
  buildArrowHedgeIngestionPlan,
  buildArrowHedgeCurrentStateView,
  buildArrowHedgeObservationReport,
  buildArrowHedgeProposalReview,
  createArrowHedgeCommonOperatingPictureProjection,
  executeArrowHedgeIngestionPlan,
  parseArrowHedgeSnapshot,
  validateArrowHedgeTypedEventPayload,
  type ArrowHedgeCommonOperatingPictureState,
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
        researchRunId: expect.any(String),
        tickerId: expect.any(String),
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
    expect(
      plan.typedEvents.map((event) => validateArrowHedgeTypedEventPayload(event)),
    ).toEqual([
      { valid: true, issues: [] },
      { valid: true, issues: [] },
      { valid: true, issues: [] },
      { valid: true, issues: [] },
    ]);
  });

  it("rejects typed finance events that violate their payload schema", () => {
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenantId("tnt_arrowhedge_contract"),
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const malformed = {
      ...plan.typedEvents[0]!,
      payload: {
        ...plan.typedEvents[0]!.payload,
        confidence: "high",
      },
    };

    expect(validateArrowHedgeTypedEventPayload(malformed)).toEqual({
      valid: false,
      issues: [
        {
          path: "/confidence",
          message: "expected type number, got string",
        },
      ],
    });

    const { researchRunId: _researchRunId, ...missingRequiredPayload } =
      plan.typedEvents[0]!.payload;
    expect(
      validateArrowHedgeTypedEventPayload({
        ...plan.typedEvents[0]!,
        payload: missingRequiredPayload,
      }),
    ).toEqual({
      valid: false,
      issues: [
        {
          path: "/researchRunId",
          message: "required field missing or null",
        },
      ],
    });
  });

  it("refuses to execute a plan with invalid typed finance payloads", async () => {
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenantId("tnt_arrowhedge_execute_contract"),
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const invalidPlan = {
      ...plan,
      typedEvents: [
        {
          ...plan.typedEvents[0]!,
          payload: {
            ...plan.typedEvents[0]!.payload,
            confidence: "high",
          },
        },
        ...plan.typedEvents.slice(1),
      ],
    };

    await expect(
      executeArrowHedgeIngestionPlan(invalidPlan, {
        withTransaction: async (fn) => fn({}),
        graph: {
          createNode: async (input) => ({
            created: true,
            node: {
              id: input.id!,
              identity: input.identity,
              schemaVersion: input.schemaVersion,
            },
          }),
          updateNode: async () => undefined,
          createEdge: async () => undefined,
        },
        events: {
          publishWith: async () => {
            throw new Error("publish should not be reached");
          },
        },
      }),
    ).rejects.toThrow("invalid ArrowHedge typed event payload");
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

  it("builds an agent-facing current state view from ticker COP state", async () => {
    const tenant = tenantId("tnt_arrowhedge_current_state");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_test");
    const state = await foldPlanIntoCop(projection, plan);

    const view = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
    });

    expect(view).toMatchObject({
      tenantId: tenant,
      viewId: "arrowhedge_cop_test:AAPL:current_state_view",
      subject: {
        kind: "projection",
        id: "arrowhedge_cop_test:AAPL",
        label: "ArrowHedge COP AAPL",
      },
      observedAt: "2026-06-03T14:00:00.000Z",
      validUntil: "2026-06-03T14:10:00.000Z",
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      projectionVersion: 1,
      workflowPosition: "accepted",
      missingSources: [],
      conflicts: [],
    });
    expect(view?.sourceRefs).toEqual(
      expect.arrayContaining([
        { kind: "event", id: "evt_0", label: "analyst.signal.created" },
        { kind: "event", id: "evt_1", label: "risk.state.validated" },
        { kind: "event", id: "evt_2", label: "portfolio.decision.proposed" },
        expect.objectContaining({ kind: "document" }),
      ]),
    );
    expect(view?.allowedActions.map((action) => action.actionType)).toEqual([
      "portfolio.decision.accept",
      "workflow.block",
      "risk.refresh",
    ]);
  });

  it("warns before action when a proposed ArrowHedge decision relies on stale or conflicted state", async () => {
    const staleSnapshot = {
      ...snapshot,
      snapshotId: "snap_aapl_2026_06_03_1412",
      observedAt: "2026-06-03T14:12:00.000Z",
      risk: {
        ...snapshot.risk,
        id: "risk_aapl_1412",
        freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
      },
      decision: {
        ...snapshot.decision,
        id: "dec_aapl_buy_stale",
        riskSourceSnapshotId: "snap_aapl_2026_06_03_1400",
        signalSourceSnapshotId: "snap_aapl_2026_06_03_1400",
      },
    };
    const tenant = tenantId("tnt_arrowhedge_stale_view");
    const plan = buildArrowHedgeIngestionPlan(staleSnapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T14:11:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_stale");
    const state = await foldPlanIntoCop(projection, plan);
    const view = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
    })!;

    const decision = validateProposedActionReadSet(
      {
        tenantId: tenant,
        actionType: "portfolio.decision.accept",
        subject: view.subject,
        payload: { decisionId: "dec_aapl_buy_stale" },
        readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
        proposedBy: "agent:portfolio-manager",
        proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      },
      view,
    );

    expect(view.workflowPosition).toBe("blocked_stale_state");
    expect(state.tickers["AAPL"]?.stateDisagreements).toBe(1);
    expect(view.conflicts.map((conflict) => conflict.conflictType)).toEqual([
      "state_disagreement",
      "state_disagreement",
      "stale_observation",
    ]);
    expect(decision.mode).toBe("warn");
    expect(decision.valid).toBe(false);
    expect(decision.issues.map((issue) => issue.code)).toContain("stale_read_ref");
    expect(decision.issues.map((issue) => issue.code)).toContain("current_view_conflict");
    expect(decision.issues.map((issue) => issue.code)).toContain(
      "workflow_position_mismatch",
    );
  });

  it("builds an observation report with assertion outcomes from ArrowHedge COP", async () => {
    const tenant = tenantId("tnt_arrowhedge_observation_report");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_report");
    const state = await foldPlanIntoCop(projection, plan);

    const report = buildArrowHedgeObservationReport({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    });

    expect(report).toMatchObject({
      currentStateView: {
        viewId: "arrowhedge_cop_report:AAPL:current_state_view",
      },
      observationContract: {
        contractId: "arrowhedge_cop_report:AAPL:current_state_view:observation_contract",
        authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      },
      evaluation: {
        valid: true,
        currentStateViewId: "arrowhedge_cop_report:AAPL:current_state_view",
      },
    });
    expect(report?.evaluation.assertions.every((assertion) => assertion.passed)).toBe(
      true,
    );
    expect(report?.evaluation.assertions).toHaveLength(7);
  });

  it("builds an ArrowHedge proposal review artifact from ticker COP state", async () => {
    const staleSnapshot = {
      ...snapshot,
      snapshotId: "snap_aapl_2026_06_03_1412",
      observedAt: "2026-06-03T14:12:00.000Z",
      risk: {
        ...snapshot.risk,
        id: "risk_aapl_1412",
        freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
      },
      decision: {
        ...snapshot.decision,
        id: "dec_aapl_buy_stale",
        riskSourceSnapshotId: "snap_aapl_2026_06_03_1400",
        signalSourceSnapshotId: "snap_aapl_2026_06_03_1400",
      },
    };
    const tenant = tenantId("tnt_arrowhedge_proposal_review");
    const plan = buildArrowHedgeIngestionPlan(staleSnapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T14:11:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_review");
    const state = await foldPlanIntoCop(projection, plan);

    const review = buildArrowHedgeProposalReview({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_stale" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
    });

    expect(review).toMatchObject({
      reviewId: "arrowhedge_cop_review:AAPL:current_state_view:portfolio.decision.accept:proposal_review",
      mode: "warn",
      valid: false,
      execution: {
        allowed: true,
        blocking: false,
        reason: "warn_first_v1",
      },
      currentStateView: {
        workflowPosition: "blocked_stale_state",
      },
    });
    expect(review?.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "current_view_conflict",
        "stale_read_ref",
        "freshness_window_current",
        "workflow_position_mismatch",
      ]),
    );
  });
});

async function foldPlanIntoCop(
  projection: ReturnType<typeof createArrowHedgeCommonOperatingPictureProjection>,
  plan: ReturnType<typeof buildArrowHedgeIngestionPlan>,
): Promise<ArrowHedgeCommonOperatingPictureState> {
  let state = projection.initial();

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

  return state;
}
