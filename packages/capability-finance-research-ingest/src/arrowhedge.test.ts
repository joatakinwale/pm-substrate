import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildObservationContractFromCurrentStateView,
  buildReadSetFromCurrentStateView,
  importStateReviewArtifactsJsonl,
  validateProposedActionReadSet,
  verifyActionOutcomeEnvelopeHash,
  verifyStateReviewArtifactHash,
} from "@pm/agent-state";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import { tenantId, timestamp } from "@pm/types";

import {
  buildArrowHedgeIngestionPlan,
  buildArrowHedgeActionOutcomeEnvelope,
  buildArrowHedgeActionOutcomeTerminalIndex,
  buildArrowHedgeCleanCurrentFixtureCase,
  buildArrowHedgeCanonicalStateReviewArtifactCorpus,
  buildArrowHedgeCurrentStateView,
  buildArrowHedgeObservationReport,
  buildArrowHedgeProposalReview,
  compareArrowHedgeStateReviewArtifactCorpusEquivalence,
  buildArrowHedgeStateReviewArtifactCorpus,
  buildArrowHedgeStateReviewArtifact,
  buildArrowHedgeTemporalMisalignmentFixtureCases,
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

    const staleAsOfView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:12:00.000Z"),
    });

    expect(staleAsOfView).toMatchObject({
      observedAt: "2026-06-03T14:00:00.000Z",
      validUntil: "2026-06-03T14:10:00.000Z",
      workflowPosition: "blocked_stale_state",
    });
    expect(staleAsOfView?.conflicts.map((conflict) => conflict.conflictType)).toEqual([
      "stale_observation",
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

  it("builds an ArrowHedge proposal review artifact from the agent's original observation", async () => {
    const tenant = tenantId("tnt_arrowhedge_proposal_review");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_review");
    const state = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const originalObservation =
      buildObservationContractFromCurrentStateView(originalView);

    const review = buildArrowHedgeProposalReview({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_120" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract: originalObservation,
    });

    expect(review).toMatchObject({
      reviewId: "arrowhedge_cop_review:AAPL:current_state_view:portfolio.decision.accept:proposal_review",
      mode: "warn",
      valid: false,
      execution: {
        // Enforced by default (2026-06-19): a failed read-set / observation
        // contract on a stale-blocked view now BLOCKS the proposal instead of
        // merely warning. This is the proposal-review enforcement gate.
        allowed: false,
        blocking: true,
        enforcementMode: "blocking",
        reason: "blocking_policy_failed",
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
    expect(review?.observationContract).toEqual(originalObservation);
    expect(review?.observationEvaluation.currentStateViewId).toBe(
      "arrowhedge_cop_review:AAPL:current_state_view",
    );
  });

  it("allows explicit advisory opt-out on the same failing proposal (shadow mode)", async () => {
    const tenant = tenantId("tnt_arrowhedge_advisory_optout");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_advisory",
    );
    const state = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const originalObservation =
      buildObservationContractFromCurrentStateView(originalView);

    const review = buildArrowHedgeProposalReview({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_120" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract: originalObservation,
      // Explicit opt-out: same failing input, but caller asked for advisory.
      enforcementMode: "advisory",
    });

    // Same view is still invalid, but advisory mode does not block.
    expect(review).toMatchObject({
      valid: false,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
      },
    });
  });

  it("indexes ArrowHedge terminal outcomes at the proposal-review write boundary", async () => {
    const tenant = tenantId("tnt_arrowhedge_terminal_index");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_terminal",
    );
    const state = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const originalObservation =
      buildObservationContractFromCurrentStateView(originalView);
    const actionId = "arrowhedge:AAPL:risk-refresh:dec_aapl_buy_120";

    const acceptedInput = {
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      actionId,
      actionType: "risk.refresh",
      payload: {
        decisionId: "dec_aapl_buy_120",
        refreshId: "refresh:dec_aapl_buy_120:current",
      },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:05:00.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract: originalObservation,
      artifact: {
        artifactId: "artifact_arrowhedge_terminal_index_accepted",
      },
    } as const;
    const blockedInput = {
      ...acceptedInput,
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      artifact: {
        artifactId: "artifact_arrowhedge_terminal_index_blocked",
      },
    } as const;

    const acceptedEnvelope = buildArrowHedgeActionOutcomeEnvelope(acceptedInput)!;
    const blockedEnvelope = buildArrowHedgeActionOutcomeEnvelope(blockedInput)!;
    const index = buildArrowHedgeActionOutcomeTerminalIndex([
      acceptedInput,
      acceptedInput,
      blockedInput,
    ]);

    expect(acceptedEnvelope.terminalOutcome).toBe("accepted");
    expect(blockedEnvelope).toMatchObject({
      terminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "proposal_review",
          code: "proposal_review_blocking_policy",
        },
      ],
    });
    expect(verifyActionOutcomeEnvelopeHash(acceptedEnvelope).valid).toBe(true);
    expect(verifyActionOutcomeEnvelopeHash(blockedEnvelope).valid).toBe(true);
    expect(index.valid).toBe(false);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      actionId,
      replayCount: 2,
      envelope: {
        terminalOutcome: "accepted",
      },
    });
    expect(index.issues).toEqual([
      expect.objectContaining({
        code: "terminal_outcome_conflict",
        actionId,
        candidate: expect.objectContaining({ terminalOutcome: "blocked" }),
        incumbent: expect.objectContaining({ terminalOutcome: "accepted" }),
      }),
    ]);
  });

  it("builds a replayable ArrowHedge state-review artifact with ticker provenance", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_artifact");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_artifact");
    const state = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const originalObservation =
      buildObservationContractFromCurrentStateView(originalView);

    const artifact = buildArrowHedgeStateReviewArtifact({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_120" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract: originalObservation,
      artifact: {
        artifactId: "arrowhedge_artifact_aapl_review_001",
        traceContext: {
          traceparent:
            "00-11111111111111111111111111111111-2222222222222222-01",
        },
      },
    });

    expect(artifact).toMatchObject({
      artifactId: "arrowhedge_artifact_aapl_review_001",
      eventEnvelope: {
        source: "arrowhedge/arrowhedge_cop_artifact",
        subject: "projection:arrowhedge_cop_artifact:AAPL",
      },
      review: {
        valid: false,
        execution: {
          allowed: false,
          blocking: true,
          enforcementMode: "blocking",
        },
      },
    });
    expect(artifact?.relatedObjects).toEqual(
      expect.arrayContaining([
        {
          role: "ticker_symbol",
          ref: {
            kind: "source_record",
            id: "ticker:AAPL",
            label: "ArrowHedge ticker AAPL",
          },
        },
      ]),
    );
    expect(artifact?.artifactHash).toHaveLength(64);
    expect(artifact ? verifyStateReviewArtifactHash(artifact).valid : false).toBe(
      true,
    );
  });

  it("exports deterministic ArrowHedge state-review artifact corpora with continuity links", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_corpus");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_corpus");
    const state = await foldPlanIntoCop(projection, plan);

    const phaseCases = buildArrowHedgeTemporalMisalignmentFixtureCases({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      observationCapturedAt: timestamp("2026-06-03T14:05:00.000Z"),
      observationToActionProposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      actionToFeedbackProposedAt: timestamp("2026-06-03T14:06:30.000Z"),
      feedbackToObservationProposedAt: timestamp("2026-06-03T14:07:30.000Z"),
      proposedBy: "agent:portfolio-manager",
    });
    const corpus = buildArrowHedgeStateReviewArtifactCorpus(phaseCases);

    const imported = importStateReviewArtifactsJsonl(corpus.jsonl);

    expect(corpus.artifacts).toHaveLength(3);
    expect(corpus.artifacts.map((artifact) => artifact.artifactId)).toEqual([
      "artifact_arrowhedge_observation_to_action_stale_risk_001",
      "artifact_arrowhedge_action_to_feedback_authority_001",
      "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
    ]);
    expect(corpus.artifacts.map((artifact) => artifact.metadata)).toEqual([
      expect.objectContaining({
        scenarioId: "arrowhedge-observation-to-action-stale-risk",
        temporalMisalignmentPhase: "observation_to_action",
        invariantClasses: ["freshness_window", "workflow_position", "state_conflict"],
        fixtureId:
          "fixtures/arrowhedge/state-review-artifacts/temporal-observation-to-action-stale-risk.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "arrowhedge-temporal-fixture-observation-action",
        workflowRunId: "arrowhedge-temporal-workflow-observation-action",
        evalEventIds: ["eval_arrowhedge_observation_to_action"],
      }),
      expect.objectContaining({
        scenarioId: "arrowhedge-action-to-feedback-authority-drift",
        temporalMisalignmentPhase: "action_to_feedback",
        invariantClasses: ["source_authority", "projection_version"],
        fixtureId:
          "fixtures/arrowhedge/state-review-artifacts/temporal-action-to-feedback-authority.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "arrowhedge-temporal-fixture-action-feedback",
        workflowRunId: "arrowhedge-temporal-workflow-action-feedback",
        evalEventIds: ["eval_arrowhedge_action_to_feedback"],
      }),
      expect.objectContaining({
        scenarioId: "arrowhedge-feedback-to-observation-missing-risk",
        temporalMisalignmentPhase: "feedback_to_observation",
        invariantClasses: ["required_evidence"],
        fixtureId:
          "fixtures/arrowhedge/state-review-artifacts/temporal-feedback-to-observation-missing-risk.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "arrowhedge-temporal-fixture-feedback-observation",
        workflowRunId: "arrowhedge-temporal-workflow-feedback-observation",
        evalEventIds: ["eval_arrowhedge_feedback_to_observation"],
      }),
    ]);
    expect(
      corpus.artifacts.map((artifact) =>
        Array.from(new Set(artifact.review.warnings.map((warning) => warning.code))),
      ),
    ).toEqual([
      expect.arrayContaining([
        "current_view_conflict",
        "stale_read_ref",
        "freshness_window_current",
        "workflow_position_mismatch",
      ]),
      expect.arrayContaining([
        "authority_mismatch",
        "projection_version_mismatch",
      ]),
      expect.arrayContaining([
        "missing_read_ref",
        "required_source_refs_present",
        "missing_sources_declared",
      ]),
    ]);
    expect(imported).toMatchObject([
      {
        valid: true,
        artifact: {
          artifactId: "artifact_arrowhedge_observation_to_action_stale_risk_001",
        },
      },
      {
        valid: true,
        artifact: {
          artifactId: "artifact_arrowhedge_action_to_feedback_authority_001",
        },
      },
      {
        valid: true,
        artifact: {
          artifactId:
            "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
        },
      },
    ]);
    expect(corpus.continuityPayloads).toEqual([
      expect.objectContaining({
        currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
        stateReviewArtifactId:
          "artifact_arrowhedge_observation_to_action_stale_risk_001",
        reviewId:
          "arrowhedge_cop_corpus:AAPL:current_state_view:portfolio.decision.accept:proposal_review",
        valid: false,
        warningCodes: expect.arrayContaining([
          "current_view_conflict",
          "stale_read_ref",
          "freshness_window_current",
          "workflow_position_mismatch",
        ]),
      }),
      expect.objectContaining({
        currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
        stateReviewArtifactId:
          "artifact_arrowhedge_action_to_feedback_authority_001",
        reviewId:
          "arrowhedge_cop_corpus:AAPL:current_state_view:risk.refresh:proposal_review",
        valid: false,
        warningCodes: expect.arrayContaining([
          "authority_mismatch",
          "projection_version_mismatch",
        ]),
      }),
      expect.objectContaining({
        currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
        stateReviewArtifactId:
          "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
        reviewId:
          "arrowhedge_cop_corpus:AAPL:current_state_view:risk.refresh:proposal_review",
        valid: false,
        warningCodes: expect.arrayContaining([
          "missing_read_ref",
          "required_source_refs_present",
          "missing_sources_declared",
        ]),
      }),
    ]);
    expect(corpus.jsonl).toBe(
      buildArrowHedgeStateReviewArtifactCorpus(phaseCases).jsonl,
    );
  });

  it("matches the committed ArrowHedge state-review artifact corpus JSONL", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_corpus");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_corpus",
    );
    const state = await foldPlanIntoCop(projection, plan);

    const corpus = buildArrowHedgeCanonicalStateReviewArtifactCorpus({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      observationCapturedAt: timestamp("2026-06-03T14:05:00.000Z"),
      observationToActionProposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      actionToFeedbackProposedAt: timestamp("2026-06-03T14:06:30.000Z"),
      feedbackToObservationProposedAt: timestamp("2026-06-03T14:07:30.000Z"),
      proposedBy: "agent:portfolio-manager",
    });
    const fixturePath = new URL(
      "../../evals/fixtures/arrowhedge-state-review-artifacts.v1.jsonl",
      import.meta.url,
    );
    const committed = readFileSync(fixturePath, "utf8");

    expect(committed).toBe(corpus.jsonl);
    expect(committed.trim().split("\n")).toHaveLength(corpus.artifacts.length);
    expect(corpus.artifacts.map((artifact) => artifact.artifactId)).toEqual([
      "artifact_arrowhedge_clean_current_accepted_001",
      "artifact_arrowhedge_observation_to_action_stale_risk_001",
      "artifact_arrowhedge_action_to_feedback_authority_001",
      "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
    ]);
  });

  it("emits a clean accepted/current artifact fixture as a positive metrics baseline", async () => {
    const tenant = tenantId("tnt_arrowhedge_clean_current");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection =
      createArrowHedgeCommonOperatingPictureProjection("arrowhedge_cop_clean");
    const state = await foldPlanIntoCop(projection, plan);

    const cleanCase = buildArrowHedgeCleanCurrentFixtureCase({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      observationCapturedAt: timestamp("2026-06-03T14:05:00.000Z"),
      proposedBy: "agent:portfolio-manager",
    });
    expect(cleanCase).not.toBeNull();

    const corpus = buildArrowHedgeStateReviewArtifactCorpus([cleanCase!]);
    expect(corpus.artifacts).toHaveLength(1);

    const artifact = corpus.artifacts[0]!;
    expect(artifact.artifactId).toBe(
      "artifact_arrowhedge_clean_current_accepted_001",
    );
    expect(artifact.review.valid).toBe(true);
    expect(artifact.review.warnings).toHaveLength(0);
    expect(artifact.metadata.temporalMisalignmentPhase).toBe("none");
    expect(artifact.metadata.invariantClasses).toHaveLength(0);
    expect(artifact.metadata.scenarioId).toBe("arrowhedge-clean-current-accepted");
    expect(verifyStateReviewArtifactHash(artifact).valid).toBe(true);

    const imported = importStateReviewArtifactsJsonl(corpus.jsonl);
    expect(imported[0]?.valid).toBe(true);
    expect(corpus.continuityPayloads[0]).toEqual(
      expect.objectContaining({ valid: true, warningCodes: [] }),
    );
  });

  it("keeps the legacy single-case corpus deterministic", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_corpus_legacy");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_corpus_legacy",
    );
    const state = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const originalObservation =
      buildObservationContractFromCurrentStateView(originalView);

    const corpus = buildArrowHedgeStateReviewArtifactCorpus([
      {
        tenantId: tenant,
        projectionName: projection.name,
        projectionVersion: projection.version,
        symbol: "AAPL",
        state,
        scenarioId: "arrowhedge-distribution-currentness-mismatch",
        actionType: "portfolio.decision.accept",
        payload: { decisionId: "dec_aapl_buy_120" },
        proposedBy: "agent:portfolio-manager",
        proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
        readSet: buildReadSetFromCurrentStateView(
          originalView,
          originalView.authorityRule,
        ),
        observationContract: originalObservation,
        artifact: {
          artifactId: "artifact_arrowhedge_corpus_stale_001",
          metadata: {
            fixtureId:
              "fixtures/arrowhedge/state-review-artifacts/aapl-stale-risk.json",
            clientSurface: "codex",
            provider: "openai",
            sessionId: "arrowhedge-session-001",
          },
        },
      },
    ]);

    const imported = importStateReviewArtifactsJsonl(corpus.jsonl);

    expect(corpus.artifacts).toHaveLength(1);
    expect(corpus.artifacts[0]?.metadata).toMatchObject({
      scenarioId: "arrowhedge-distribution-currentness-mismatch",
      temporalMisalignmentPhase: "observation_to_action",
      invariantClasses: expect.arrayContaining([
        "freshness_window",
        "workflow_position",
        "state_conflict",
      ]),
      fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale-risk.json",
      clientSurface: "codex",
      provider: "openai",
      sessionId: "arrowhedge-session-001",
    });
    expect(imported).toMatchObject([
      {
        valid: true,
        artifact: {
          artifactId: "artifact_arrowhedge_corpus_stale_001",
        },
      },
    ]);
    expect(corpus.continuityPayloads).toEqual([
      expect.objectContaining({
        currentStateViewId:
          "arrowhedge_cop_corpus_legacy:AAPL:current_state_view",
        stateReviewArtifactId: "artifact_arrowhedge_corpus_stale_001",
        reviewId:
          "arrowhedge_cop_corpus_legacy:AAPL:current_state_view:portfolio.decision.accept:proposal_review",
        valid: false,
        warningCodes: expect.arrayContaining([
          "stale_read_ref",
          "freshness_window_current",
          "workflow_position_mismatch",
        ]),
      }),
    ]);
    expect(corpus.jsonl).toBe(
      buildArrowHedgeStateReviewArtifactCorpus([
        {
          tenantId: tenant,
          projectionName: projection.name,
          projectionVersion: projection.version,
          symbol: "AAPL",
          state,
          scenarioId: "arrowhedge-distribution-currentness-mismatch",
          actionType: "portfolio.decision.accept",
          payload: { decisionId: "dec_aapl_buy_120" },
          proposedBy: "agent:portfolio-manager",
          proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
          readSet: buildReadSetFromCurrentStateView(
            originalView,
            originalView.authorityRule,
          ),
          observationContract: originalObservation,
          artifact: {
            artifactId: "artifact_arrowhedge_corpus_stale_001",
            metadata: {
              fixtureId:
                "fixtures/arrowhedge/state-review-artifacts/aapl-stale-risk.json",
              clientSurface: "codex",
              provider: "openai",
              sessionId: "arrowhedge-session-001",
            },
          },
        },
      ]).jsonl,
    );
  });

  it("compares fixture and persisted-shape ArrowHedge state-review artifacts for canonical equivalence", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_equivalence");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_equivalence",
    );
    const fixtureState = await foldPlanIntoCop(projection, plan);
    const projectedShapeState = JSON.parse(
      JSON.stringify(fixtureState),
    ) as ArrowHedgeCommonOperatingPictureState;
    const commonCaseInput = {
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      proposedBy: "agent:portfolio-manager",
      observationCapturedAt: timestamp("2026-06-03T14:05:00.000Z"),
      observationToActionProposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      actionToFeedbackProposedAt: timestamp("2026-06-03T14:06:30.000Z"),
      feedbackToObservationProposedAt: timestamp("2026-06-03T14:07:30.000Z"),
    } as const;
    const fixtureInputs = buildArrowHedgeTemporalMisalignmentFixtureCases({
      ...commonCaseInput,
      state: fixtureState,
    });
    const projectedInputs = buildArrowHedgeTemporalMisalignmentFixtureCases({
      ...commonCaseInput,
      state: projectedShapeState,
    });

    const equivalence = compareArrowHedgeStateReviewArtifactCorpusEquivalence({
      fixture: {
        label: "fixture-cop",
        inputs: fixtureInputs,
      },
      projected: {
        label: "persisted-shape-cop",
        inputs: projectedInputs,
      },
    });

    expect(equivalence.valid).toBe(true);
    expect(equivalence.mismatches).toEqual([]);
    expect(equivalence.fixture).toMatchObject({
      canonicalArtifactJsonl: equivalence.projected.canonicalArtifactJsonl,
      replayHashValid: [true, true, true],
      artifactHashes: equivalence.projected.artifactHashes,
      continuityArtifactIds: [
        "artifact_arrowhedge_observation_to_action_stale_risk_001",
        "artifact_arrowhedge_action_to_feedback_authority_001",
        "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
      ],
      continuityArtifactHashes: equivalence.projected.continuityArtifactHashes,
      continuityWarningCodes: [
        expect.arrayContaining([
          "current_view_conflict",
          "stale_read_ref",
          "freshness_window_current",
          "workflow_position_mismatch",
        ]),
        expect.arrayContaining([
          "authority_mismatch",
          "projection_version_mismatch",
        ]),
        expect.arrayContaining([
          "missing_read_ref",
          "required_source_refs_present",
          "missing_sources_declared",
        ]),
      ],
      warningCodes: [
        expect.arrayContaining([
          "current_view_conflict",
          "stale_read_ref",
          "freshness_window_current",
          "workflow_position_mismatch",
        ]),
        expect.arrayContaining([
          "authority_mismatch",
          "projection_version_mismatch",
        ]),
        expect.arrayContaining([
          "missing_read_ref",
          "required_source_refs_present",
          "missing_sources_declared",
        ]),
      ],
      temporalPhases: [
        "observation_to_action",
        "action_to_feedback",
        "feedback_to_observation",
      ],
      invariantClasses: [
        [
          "freshness_window",
          "state_conflict",
          "workflow_position",
        ],
        ["projection_version", "source_authority"],
        ["required_evidence"],
      ],
    });
  });

  it("flags dropped artifact inputs during ArrowHedge state-review artifact equivalence", async () => {
    const tenant = tenantId("tnt_arrowhedge_state_review_equivalence_drop");
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: tenant,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      "arrowhedge_cop_equivalence_drop",
    );
    const fixtureState = await foldPlanIntoCop(projection, plan);
    const originalView = buildArrowHedgeCurrentStateView({
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state: fixtureState,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const commonInput = {
      tenantId: tenant,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      scenarioId: "arrowhedge-dropped-input-equivalence",
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_120" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T14:12:30.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract:
        buildObservationContractFromCurrentStateView(originalView),
      artifact: {
        artifactId: "artifact_arrowhedge_equivalence_valid_001",
        metadata: {
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/aapl-equivalence-drop.json",
        },
      },
    } as const;
    const inputs = [
      { ...commonInput, state: fixtureState },
      {
        ...commonInput,
        symbol: "MSFT",
        state: fixtureState,
        artifact: {
          artifactId: "artifact_arrowhedge_equivalence_missing_001",
        },
      },
    ] as const;

    const equivalence = compareArrowHedgeStateReviewArtifactCorpusEquivalence({
      fixture: {
        label: "fixture-cop",
        inputs,
      },
      projected: {
        label: "persisted-shape-cop",
        inputs,
      },
    });

    expect(equivalence.valid).toBe(false);
    expect(equivalence.fixture).toMatchObject({
      inputCount: 2,
      artifactCount: 1,
    });
    expect(equivalence.mismatches).toEqual(
      expect.arrayContaining([
        {
          field: "fixture-cop.artifactCount",
          fixture: 2,
          projected: 1,
        },
        {
          field: "persisted-shape-cop.artifactCount",
          fixture: 2,
          projected: 1,
        },
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
