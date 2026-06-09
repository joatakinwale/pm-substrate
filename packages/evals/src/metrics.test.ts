import { describe, expect, it } from "vitest";
import {
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  reviewProposedActionAgainstCurrentState,
  stateRef,
  type CurrentStateView,
} from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";

import { evalEvidenceRef, type EvalEvent } from "./schema.js";
import {
  analyzeAdapterOperationalMetrics,
  analyzeEvalEvents,
  analyzeActionProposalReviews,
  analyzeStateAssertions,
  analyzeStateReviewArtifacts,
  analyzeStateReviewArtifactEvidence,
  actionProposalReviewsFromStateReviewArtifacts,
  stateAssertionsFromStateReviewArtifacts,
  stateReviewArtifactSamplesFromArtifacts,
} from "./metrics.js";

const tenantId = "tnt_metrics" as TenantId;
const observedAt = "2026-06-03T15:00:00.000Z" as Timestamp;
const signalRef = stateRef("event", "evt_signal", "analyst.signal.created");
const riskRef = stateRef("event", "evt_risk", "risk.state.validated");
const decisionRef = stateRef("event", "evt_decision", "portfolio.decision.proposed");

function event(input: {
  readonly scenarioId: string;
  readonly runArm?: "baseline" | "substrate";
  readonly pairedRunGroup?: string;
  readonly result: "pass" | "fail" | "blocked";
  readonly stateBenchCategory?: EvalEvent["stateBenchCategory"];
  readonly memoryBenchmarkBridge?: EvalEvent["memoryBenchmarkBridge"];
  readonly mastCategory?: EvalEvent["mastCategory"];
  readonly coordinationClass?: EvalEvent["coordinationClass"];
  readonly evidenceStage?: EvalEvent["evidenceStage"];
}): EvalEvent {
  return {
    tenantId,
    axis: "local_lab",
    runId: `run_${input.scenarioId}_${input.runArm ?? "unpaired"}`,
    agentId: "metrics_agent",
    scenarioId: input.scenarioId,
    failureClass: "parallel_write_conflict",
    observedAt,
    source: "metrics-fixture",
    evidenceRefs: [evalEvidenceRef("external_fixture", `${input.scenarioId}.json`)],
    substrateRefs: [evalEvidenceRef("event", `evt_${input.scenarioId}`)],
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    stateBenchCategory: input.stateBenchCategory,
    memoryBenchmarkBridge: input.memoryBenchmarkBridge,
    mastCategory: input.mastCategory,
    coordinationClass: input.coordinationClass,
    evidenceStage: input.evidenceStage ?? "paired_behavioral_improvement",
    result: input.result,
    notes: "metrics fixture",
  };
}

function currentStateView(): CurrentStateView {
  return {
    tenantId,
    viewId: "arrowhedge_cop:AAPL:current_state_view",
    subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
    observedAt: "2026-06-03T14:00:00.000Z" as Timestamp,
    validUntil: "2026-06-03T14:10:00.000Z" as Timestamp,
    authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
    projectionVersion: 1,
    workflowPosition: "decision_pending",
    sourceRefs: [signalRef, riskRef, decisionRef],
    missingSources: [],
    conflicts: [],
    allowedActions: [
      {
        actionType: "portfolio.decision.accept",
        label: "Accept portfolio decision",
        requiredRefs: [signalRef, riskRef, decisionRef],
        requiredWorkflowPosition: "decision_pending",
      },
    ],
  };
}

function persistedArtifactFixture() {
  const view = currentStateView();
  const review = reviewProposedActionAgainstCurrentState(
    {
      tenantId,
      actionType: "portfolio.decision.accept",
      subject: view.subject,
      payload: { decisionId: "dec_aapl_buy_120" },
      readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
      proposedBy: "agent:portfolio-manager",
      proposedAt: "2026-06-03T14:11:00.000Z" as Timestamp,
    },
    view,
  );

  return buildStateReviewArtifact(review, {
    artifactId: "artifact_arrowhedge_metrics_001",
    source: "arrowhedge/arrowhedge_cop",
    traceContext: {
      traceparent:
        "00-11111111111111111111111111111111-2222222222222222-01",
    },
    metadata: {
      scenarioId: "arrowhedge-distribution-currentness-mismatch",
      fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale.json",
    },
  });
}

describe("eval event metrics", () => {
  it("summarizes paired outcomes by taxonomy and coordination class", () => {
    const events = [
      event({
        scenarioId: "authority-gate",
        runArm: "baseline",
        pairedRunGroup: "pair_authority",
        result: "fail",
        stateBenchCategory: "user_experience",
        memoryBenchmarkBridge: "abstention",
        mastCategory: "task_verification",
        coordinationClass: "authority_gated_transition",
      }),
      event({
        scenarioId: "authority-gate",
        runArm: "substrate",
        pairedRunGroup: "pair_authority",
        result: "pass",
        stateBenchCategory: "user_experience",
        memoryBenchmarkBridge: "abstention",
        mastCategory: "task_verification",
        coordinationClass: "authority_gated_transition",
      }),
      event({
        scenarioId: "convergent-update",
        runArm: "baseline",
        pairedRunGroup: "pair_convergent",
        result: "fail",
        stateBenchCategory: "stateful",
        memoryBenchmarkBridge: "knowledge_update",
        mastCategory: "system_design",
        coordinationClass: "convergent_update",
      }),
      event({
        scenarioId: "convergent-update",
        runArm: "substrate",
        pairedRunGroup: "pair_convergent",
        result: "pass",
        stateBenchCategory: "stateful",
        memoryBenchmarkBridge: "knowledge_update",
        mastCategory: "system_design",
        coordinationClass: "convergent_update",
      }),
      event({
        scenarioId: "derived-projection",
        runArm: "baseline",
        pairedRunGroup: "pair_projection",
        result: "fail",
        stateBenchCategory: "procedural_execution",
        memoryBenchmarkBridge: "workflow_rebase",
        mastCategory: "system_design",
        coordinationClass: "derived_projection",
      }),
      event({
        scenarioId: "derived-projection",
        runArm: "substrate",
        pairedRunGroup: "pair_projection",
        result: "pass",
        stateBenchCategory: "procedural_execution",
        memoryBenchmarkBridge: "workflow_rebase",
        mastCategory: "system_design",
        coordinationClass: "derived_projection",
      }),
    ];

    const metrics = analyzeEvalEvents(events);

    expect(metrics).toMatchObject({
      totalEvents: 6,
      pairedGroups: 3,
      completePairedGroups: 3,
      baselineFailures: 3,
      substrateFailures: 0,
      failureReduction: 3,
      allStageFailureReduction: 3,
      authorityGatePassRate: 1,
      convergentUpdateAutoResolutionRate: 1,
    });
    expect(metrics.incompletePairedGroups).toEqual([]);
    expect(metrics.stateBenchCategories).toEqual([
      "stateful",
      "procedural_execution",
      "user_experience",
    ]);
    expect(metrics.memoryBenchmarkBridges).toEqual([
      "knowledge_update",
      "abstention",
      "workflow_rebase",
    ]);
    expect(metrics.mastCategories).toEqual(["system_design", "task_verification"]);
    expect(metrics.coordinationClasses).toEqual([
      "convergent_update",
      "authority_gated_transition",
      "derived_projection",
    ]);
    expect(metrics.evidenceStages).toEqual(["paired_behavioral_improvement"]);
    expect(metrics.byCoordinationClass["authority_gated_transition"]).toMatchObject({
      events: 2,
      pairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byCoordinationClass["convergent_update"]).toMatchObject({
      events: 2,
      pairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass["parallel_write_conflict"]).toMatchObject({
      events: 6,
      pairedGroups: 3,
      baselineFailures: 3,
      substrateFailures: 0,
      failureReduction: 3,
      substratePasses: 3,
    });
    expect(metrics.byFailureClass["representation_loss"]).toMatchObject({
      events: 0,
      pairedGroups: 0,
      baselineFailures: 0,
      substrateFailures: 0,
      failureReduction: 0,
      substratePasses: 0,
    });
  });

  it("keeps scaffolded pairs out of the evidence-adjusted failure-reduction metric", () => {
    const metrics = analyzeEvalEvents([
      event({
        scenarioId: "scaffolded",
        runArm: "baseline",
        pairedRunGroup: "pair_scaffolded",
        result: "fail",
        evidenceStage: "scaffolded_scenario",
      }),
      event({
        scenarioId: "scaffolded",
        runArm: "substrate",
        pairedRunGroup: "pair_scaffolded",
        result: "pass",
        evidenceStage: "scaffolded_scenario",
      }),
    ]);

    expect(metrics).toMatchObject({
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 0,
      allStageFailureReduction: 1,
      evidenceStages: ["scaffolded_scenario"],
    });
    expect(metrics.byEvidenceStage.scaffolded_scenario).toMatchObject({
      events: 2,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass.parallel_write_conflict).toMatchObject({
      failureReduction: 0,
      allStageFailureReduction: 1,
    });
  });

  it("reports incomplete paired groups without counting them as complete", () => {
    const metrics = analyzeEvalEvents([
      event({
        scenarioId: "missing-substrate",
        runArm: "baseline",
        pairedRunGroup: "pair_missing",
        result: "fail",
        coordinationClass: "authority_gated_transition",
      }),
    ]);

    expect(metrics.pairedGroups).toBe(1);
    expect(metrics.completePairedGroups).toBe(0);
    expect(metrics.incompletePairedGroups).toEqual([
      {
        pairedRunGroup: "pair_missing",
        missingArms: ["substrate"],
      },
    ]);
    expect(metrics.authorityGatePassRate).toBeNull();
  });

  it("measures adapter operational rates from samples plus eval outcomes", () => {
    const events = [
      event({
        scenarioId: "authority-pass",
        runArm: "baseline",
        pairedRunGroup: "pair_authority_pass",
        result: "fail",
        coordinationClass: "authority_gated_transition",
      }),
      event({
        scenarioId: "authority-pass",
        runArm: "substrate",
        pairedRunGroup: "pair_authority_pass",
        result: "pass",
        coordinationClass: "authority_gated_transition",
      }),
      event({
        scenarioId: "authority-fail",
        runArm: "baseline",
        pairedRunGroup: "pair_authority_fail",
        result: "fail",
        coordinationClass: "authority_gated_transition",
      }),
      event({
        scenarioId: "authority-fail",
        runArm: "substrate",
        pairedRunGroup: "pair_authority_fail",
        result: "fail",
        coordinationClass: "authority_gated_transition",
      }),
    ];

    const metrics = analyzeAdapterOperationalMetrics(events, [
      {
        adapterStartedAt: "2026-06-03T13:59:58.500Z" as Timestamp,
        firstValidEventAt: "2026-06-03T14:00:00.000Z" as Timestamp,
        mappingAttempts: 10,
        mappingRejections: 2,
        stateComparisons: 4,
        stateDisagreements: 1,
      },
    ]);

    expect(metrics).toEqual({
      adapterTimeToFirstValidEventMs: 1500,
      mappingRejectionRate: 0.2,
      stateDisagreementRate: 0.25,
      authorityGatePassRate: 0.5,
      authorityGatePasses: 1,
      authorityGateFailures: 1,
    });
  });

  it("summarizes state assertion pass/fail metrics by code and severity", () => {
    expect(
      analyzeStateAssertions([
        {
          code: "required_source_refs_present",
          passed: true,
          severity: "fail",
        },
        {
          code: "freshness_window_current",
          passed: false,
          severity: "warn",
        },
        {
          code: "workflow_position_matches",
          passed: false,
          severity: "warn",
        },
        {
          code: "authority_rule_matches",
          passed: true,
          severity: "fail",
        },
      ]),
    ).toEqual({
      totalAssertions: 4,
      passedAssertions: 2,
      failedAssertions: 2,
      passRate: 0.5,
      failedByCode: {
        freshness_window_current: 1,
        workflow_position_matches: 1,
      },
      failedBySeverity: {
        warn: 2,
      },
    });
  });

  it("summarizes action proposal review warnings and warn-first disposition", () => {
    expect(
      analyzeActionProposalReviews([
        {
          valid: true,
          mode: "warn",
          execution: { allowed: true, blocking: false, enforcementMode: "advisory" },
          warnings: [],
        },
        {
          valid: false,
          mode: "warn",
          execution: { allowed: true, blocking: false, enforcementMode: "advisory" },
          warnings: [
            { source: "read_set", code: "stale_read_ref", severity: "warn" },
            {
              source: "observation_contract",
              code: "freshness_window_current",
              severity: "warn",
            },
            { source: "read_set", code: "workflow_position_mismatch", severity: "warn" },
          ],
        },
      ]),
    ).toEqual({
      totalReviews: 2,
      validReviews: 1,
      invalidReviews: 1,
      allowedReviews: 2,
      blockedReviews: 0,
      warnModeReviews: 2,
      advisoryReviews: 2,
      blockingModeReviews: 0,
      totalWarnings: 3,
      warningsBySource: {
        observation_contract: 1,
        read_set: 2,
      },
      warningsByCode: {
        freshness_window_current: 1,
        stale_read_ref: 1,
        workflow_position_mismatch: 1,
      },
      warningsBySeverity: {
        warn: 3,
      },
    });
  });

  it("summarizes replayable state-review artifact coverage", () => {
    expect(
      analyzeStateReviewArtifacts([
        {
          artifactHash: "a".repeat(64),
          hashValid: true,
          eventEnvelope: {
            source: "arrowhedge/arrowhedge_cop",
            type: "pm.agent_state.action_proposal_reviewed.v1",
          },
          traceContext: {
            traceparent:
              "00-11111111111111111111111111111111-2222222222222222-01",
          },
          relatedObjects: [
            { role: "primary_subject" },
            { role: "source_ref" },
            { role: "ticker_symbol" },
          ],
          review: {
            valid: false,
            mode: "warn",
            execution: {
              allowed: true,
              blocking: false,
              enforcementMode: "advisory",
            },
            warnings: [
              { source: "read_set", code: "stale_read_ref", severity: "warn" },
            ],
          },
        },
        {
          artifactHash: "b".repeat(64),
          hashValid: false,
          eventEnvelope: {
            source: "arrowhedge/arrowhedge_cop",
            type: "pm.agent_state.action_proposal_reviewed.v1",
          },
          relatedObjects: [],
          review: {
            valid: false,
            mode: "warn",
            execution: {
              allowed: false,
              blocking: true,
              enforcementMode: "blocking",
            },
            warnings: [
              {
                source: "observation_contract",
                code: "freshness_window_current",
                severity: "warn",
              },
            ],
          },
        },
      ]),
    ).toEqual({
      totalArtifacts: 2,
      hashVerifiedArtifacts: 1,
      hashMismatchArtifacts: 1,
      hashVerificationRate: 0.5,
      traceLinkedArtifacts: 1,
      traceJoinCoverage: 0.5,
      artifactsWithRelatedObjects: 1,
      objectRoleCoverage: 0.5,
      relatedObjectCount: 3,
      relatedObjectsByRole: {
        primary_subject: 1,
        source_ref: 1,
        ticker_symbol: 1,
      },
      warningCount: 2,
      warningsBySource: {
        observation_contract: 1,
        read_set: 1,
      },
      warningsByCode: {
        freshness_window_current: 1,
        stale_read_ref: 1,
      },
      advisoryArtifacts: 1,
      blockingModeArtifacts: 1,
      blockedArtifacts: 1,
      artifactsBySource: {
        "arrowhedge/arrowhedge_cop": 2,
      },
      artifactsByType: {
        "pm.agent_state.action_proposal_reviewed.v1": 2,
      },
      artifactsByTemporalMisalignmentPhase: {},
      artifactsByInvariantClass: {},
    });
  });

  it("derives assertion, proposal-review, and artifact metrics from real state-review artifacts", () => {
    const artifact = persistedArtifactFixture();
    const assertionSamples = stateAssertionsFromStateReviewArtifacts([artifact]);
    const reviewSamples = actionProposalReviewsFromStateReviewArtifacts([artifact]);
    const artifactSamples = stateReviewArtifactSamplesFromArtifacts([artifact]);

    expect(assertionSamples.map((sample) => sample.code)).toEqual([
      "required_source_refs_present",
      "authority_rule_matches",
      "freshness_window_current",
      "projection_version_matches",
      "workflow_position_matches",
      "conflicts_declared",
      "missing_sources_declared",
    ]);
    expect(reviewSamples).toEqual([
      {
        valid: false,
        mode: "warn",
        execution: {
          allowed: true,
          blocking: false,
          enforcementMode: "advisory",
        },
        warnings: [
          { source: "read_set", code: "stale_read_ref", severity: "warn" },
          { source: "read_set", code: "stale_read_ref", severity: "warn" },
          { source: "read_set", code: "stale_read_ref", severity: "warn" },
          {
            source: "observation_contract",
            code: "freshness_window_current",
            severity: "warn",
          },
        ],
      },
    ]);
    expect(artifactSamples).toMatchObject([
      {
        artifactHash: artifact.artifactHash,
        hashValid: true,
        metadata: {
          temporalMisalignmentPhase: "observation_to_action",
          invariantClasses: ["freshness_window"],
        },
      },
    ]);

    expect(analyzeStateReviewArtifactEvidence([artifact])).toMatchObject({
      stateAssertions: {
        totalAssertions: 7,
        failedAssertions: 1,
        failedByCode: {
          freshness_window_current: 1,
        },
      },
      actionProposalReviews: {
        totalReviews: 1,
        invalidReviews: 1,
        totalWarnings: 4,
        warningsByCode: {
          stale_read_ref: 3,
          freshness_window_current: 1,
        },
      },
      stateReviewArtifacts: {
        totalArtifacts: 1,
        hashVerifiedArtifacts: 1,
        artifactsByTemporalMisalignmentPhase: {
          observation_to_action: 1,
        },
        artifactsByInvariantClass: {
          freshness_window: 1,
        },
      },
    });
  });
});
