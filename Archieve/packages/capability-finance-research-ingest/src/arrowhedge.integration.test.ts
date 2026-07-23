import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  buildActionOutcomeEnvelope,
  buildObservationContractFromCurrentStateView,
  buildReadSetFromCurrentStateView,
  stateRef,
  validateProposedActionReadSet,
} from "@pm/agent-state-core";
import {
  analyzeAdapterOperationalMetrics,
  analyzeEvalEvents,
  buildArrowHedgeStateEvalSuite,
} from "@pm/evals";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { timestamp, type PMEvent, type TenantId } from "@pm/types";

import {
  buildArrowHedgeCurrentStateView,
  buildArrowHedgeIngestionPlan,
  compareArrowHedgeStateReviewArtifactCorpusEquivalence,
  createArrowHedgeCommonOperatingPictureProjection,
  executeArrowHedgeIngestionPlan,
  type ArrowHedgeCommonOperatingPictureState,
} from "./arrowhedge.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

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

describeIfDb("ArrowHedge finance adapter DB proof", () => {
  let pool: pg.Pool;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let projections: PostgresProjectionRunner;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_arrowhedge_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    await profileRegistry.install(id, FINANCE_RESEARCH_PROFILE);
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (tenant) => profileRegistry.validator(tenant),
    });
    events = new PostgresEventStore(pool);
    projections = new PostgresProjectionRunner(pool, events);
  });

  afterAll(async () => {
    await events.close();
    for (const tenantId of tenants) {
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    }
    await pool.end();
  });

  it("ingests source rows into graph/events, produces COP state, and measures ArrowHedge eval metrics", async () => {
    const tenantId = await makeTenant();
    const projection = createArrowHedgeCommonOperatingPictureProjection(
      `arrowhedge_cop_${randomUUID().slice(0, 6)}`,
    );
    await projections.register(projection);

    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId,
      profile: FINANCE_RESEARCH_PROFILE,
      adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
    });
    expect(plan.valid).toBe(true);

    const result = await executeArrowHedgeIngestionPlan(plan, {
      withTransaction: async (fn) => {
        const client = await pool.connect();
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
        createNode: (input, tx) => graph.createNode(input, tx),
        updateNode: (input, tx) => graph.updateNode(input, tx),
        createEdge: (input, tx) => graph.createEdge(input, tx),
      },
      events: {
        publishWith: (tx, input) => events.publishWith(tx, input),
      },
    });

    expect(result).toMatchObject({
      nodesCreated: 9,
      nodesUpdated: 0,
      edgesCreated: 15,
    });
    expect(result.eventsPublished).toHaveLength(13);
    expect(await events.verifyChain(tenantId)).toMatchObject({
      valid: true,
      checked: 13,
    });

    await projections.catchUp(tenantId, projection.name);
    const cop =
      await projections.getState<ArrowHedgeCommonOperatingPictureState>(
        tenantId,
        projection.name,
      );
    expect(cop?.tickers["AAPL"]).toMatchObject({
      latestSignal: { signal: "buy", confidence: 0.82 },
      latestRiskState: { currentPrice: 189.25, maxShares: 120 },
      latestDecision: { action: "buy", quantity: 120, accepted: true },
      authorityGate: { passes: 1, failures: 0 },
      stateDisagreements: 0,
      staleBlocks: 0,
    });
    expect(cop?.summary).toMatchObject({
      validEventCount: 4,
      authorityGatePassRate: 1,
      stateDisagreementRate: 0,
    });
    const fixtureCop = await foldEventsIntoCop(projection, result.eventsPublished);
    const originalFixtureView = buildArrowHedgeCurrentStateView({
      tenantId,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state: fixtureCop,
      evaluatedAt: timestamp("2026-06-03T14:05:00.000Z"),
    })!;
    const artifactInput = {
      tenantId,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      scenarioId: "arrowhedge-db-fixture-state-review-equivalence",
      actionType: "portfolio.decision.accept",
      payload: { decisionId: "dec_aapl_buy_120" },
      proposedBy: "agent:portfolio-manager",
      proposedAt: timestamp("2026-06-03T16:30:00.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        originalFixtureView,
        originalFixtureView.authorityRule,
      ),
      observationContract:
        buildObservationContractFromCurrentStateView(originalFixtureView),
      artifact: {
        artifactId: "artifact_arrowhedge_db_equivalence_stale_001",
        metadata: {
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/aapl-db-equivalence.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-session-db-equivalence-001",
        },
      },
    } as const;
    const equivalence = compareArrowHedgeStateReviewArtifactCorpusEquivalence({
      fixture: {
        label: "fixture-cop",
        inputs: [{ ...artifactInput, state: fixtureCop }],
      },
      projected: {
        label: "db-projected-cop",
        inputs: [{ ...artifactInput, state: cop! }],
      },
    });

    expect(equivalence.valid).toBe(true);
    expect(equivalence.mismatches).toEqual([]);
    expect(equivalence.fixture).toMatchObject({
      canonicalArtifactJsonl: equivalence.projected.canonicalArtifactJsonl,
      replayHashValid: [true],
      artifactHashes: equivalence.projected.artifactHashes,
      continuityArtifactIds: ["artifact_arrowhedge_db_equivalence_stale_001"],
      continuityArtifactHashes: equivalence.projected.continuityArtifactHashes,
      continuityWarningCodes: [
        expect.arrayContaining([
          "stale_read_ref",
          "freshness_window_current",
          "workflow_position_mismatch",
        ]),
      ],
      temporalPhases: ["observation_to_action"],
      invariantClasses: [
        expect.arrayContaining([
          "freshness_window",
          "workflow_position",
          "state_conflict",
        ]),
      ],
    });
    const currentStateView = buildArrowHedgeCurrentStateView({
      tenantId,
      projectionName: projection.name,
      projectionVersion: projection.version,
      symbol: "AAPL",
      state: cop!,
    })!;
    const readSetValidation = validateProposedActionReadSet(
      {
        tenantId,
        actionType: "portfolio.decision.accept",
        subject: currentStateView.subject,
        payload: { decisionId: "dec_aapl_buy_120" },
        readSet: buildReadSetFromCurrentStateView(
          currentStateView,
          currentStateView.authorityRule,
        ),
        proposedBy: "agent:portfolio-manager",
        proposedAt: timestamp("2026-06-03T16:30:00.000Z"),
      },
      currentStateView,
    );
    expect(readSetValidation.mode).toBe("warn");
    expect(readSetValidation.issues.map((issue) => issue.code)).toContain(
      "stale_read_ref",
    );

    const canonicalAuthorityEnvelope = buildActionOutcomeEnvelope({
      tenantId,
      actionId: "act_arrowhedge_terminal_outcome_partition",
      subject: stateRef("event", result.eventsPublished[0]!.id),
      proposalReviewId: "prop_arrowhedge_terminal_outcome_partition",
      stateReviewArtifactHash: equivalence.projected.artifactHashes[0]!,
      requestedTerminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "proposal_review",
          code: "terminal_outcome_partition",
          message:
            "Conflicting accepted/blocked terminal claims reduced to one blocked ActionOutcomeEnvelope normal form.",
          refs: [stateRef("event", result.eventsPublished[0]!.id)],
        },
      ],
      decidedAt: timestamp("2026-06-03T16:29:00.000Z"),
      decidedBy: "arrowhedge_axis_a_agent",
      substrateRefs: [stateRef("event", result.eventsPublished[0]!.id)],
    });
    const emittedEventIds = result.eventsPublished.map((event) => event.id);
    const evalSuite = buildArrowHedgeStateEvalSuite({
      tenantId,
      observedAt: timestamp("2026-06-03T16:30:00.000Z"),
      source: "packages/capability-finance-research-ingest/src/arrowhedge.integration.test.ts",
      sourceRecordIds: plan.mapping.items.map((item) => item.sourceRecordId!),
      substrateRefs: {
        graphNodeIds: plan.mapping.items.map((item) => item.event.entityId),
        eventIds: emittedEventIds,
        projectionIds: [projection.name],
      },
      readSetValidation: {
        currentStateViewId: currentStateView.viewId,
        mode: readSetValidation.mode,
        issueCodes: readSetValidation.issues.map((issue) => issue.code),
      },
      operationalSamples: [plan.operationalSample],
      actionOutcomeEnvelopes: [
        {
          scenarioId: "arrowhedge-terminal-outcome-partition",
          envelopeId: canonicalAuthorityEnvelope.outcomeHash,
          terminalOutcome: "blocked",
          label: "ArrowHedge canonical authority packet (integration proof)",
        },
      ],
    });
    const metrics = analyzeEvalEvents(evalSuite.events);
    expect(metrics.byFailureClass["representation_loss"]).toMatchObject({
      failureReduction: 0,
      allStageFailureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass["capability_contract_violation"]).toMatchObject({
      substrateFailures: 0,
      failureReduction: 0,
      allStageFailureReduction: 1,
    });

    const operational = analyzeAdapterOperationalMetrics(
      evalSuite.events,
      evalSuite.operationalSamples,
    );
    expect(operational).toMatchObject({
      adapterTimeToFirstValidEventMs: 1500,
      mappingRejectionRate: 0,
      stateDisagreementRate: 0,
      authorityGatePassRate: 1,
      authorityGatePasses: 6,
      authorityGateFailures: 0,
    });
  });
});

async function foldEventsIntoCop(
  projection: ReturnType<typeof createArrowHedgeCommonOperatingPictureProjection>,
  events: readonly PMEvent[],
): Promise<ArrowHedgeCommonOperatingPictureState> {
  let state = projection.initial();

  for (const event of events) {
    state = await projection.apply(state, event);
  }

  return state;
}
