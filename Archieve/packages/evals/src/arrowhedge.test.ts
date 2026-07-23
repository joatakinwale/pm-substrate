import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";
import {
  analyzeAdapterOperationalMetrics,
  analyzeEvalEvents,
} from "./metrics.js";

describe("ArrowHedge state eval suite", () => {
  it("emits paired evals for the ArrowHedge adapter and agent-state scenarios", () => {
    const suite = buildArrowHedgeStateEvalSuite({
      tenantId: tenantId("tnt_arrowhedge_eval"),
      observedAt: timestamp("2026-06-03T16:30:00.000Z"),
      runIdPrefix: "run_arrowhedge_axis_a",
      source: "packages/capability-finance-research-ingest/src/arrowhedge.test.ts",
      sourceRecordIds: [
        "ticker:AAPL",
        "risk:risk_aapl_1400",
        "decision:dec_aapl_buy_120",
      ],
      substrateRefs: {
        graphNodeIds: [
          "00000000-0000-4000-8000-00000000f001",
          "00000000-0000-4000-8000-00000000f002",
        ],
        eventIds: ["evt_signal", "evt_risk", "evt_decision"],
        projectionIds: ["arrowhedge_cop"],
      },
      readSetValidation: {
        currentStateViewId: "arrowhedge_cop:AAPL:current_state_view",
        mode: "warn",
        issueCodes: ["stale_read_ref", "workflow_position_mismatch"],
      },
      stateReviewArtifacts: [
        {
          scenarioId: "arrowhedge-distribution-currentness-mismatch",
          artifactId: "artifact_arrowhedge_stale_read_001",
        },
      ],
      actionOutcomeEnvelopes: [
        {
          scenarioId: "arrowhedge-terminal-outcome-partition",
          envelopeId: "outcome_arrowhedge_terminal_partition_001",
        },
      ],
      operationalSamples: [
        {
          adapterStartedAt: timestamp("2026-06-03T16:29:58.000Z"),
          firstValidEventAt: timestamp("2026-06-03T16:30:00.000Z"),
          mappingAttempts: 9,
          mappingRejections: 1,
          stateComparisons: 3,
          stateDisagreements: 1,
        },
      ],
    });

    expect(suite.summaries.map((summary) => summary.failureClass)).toEqual([
      "representation_loss",
      "source_authority_conflict",
      "stale_observation",
      "stale_observation",
      "workflow_invalidation",
      "capability_contract_violation",
      "parallel_write_conflict",
    ]);
    expect(suite.summaries.map((summary) => summary.scenarioId)).toContain(
      "arrowhedge-distribution-currentness-mismatch",
    );
    expect(suite.events).toHaveLength(14);
    const artifactLinkedEvents = suite.events
      .filter((event) =>
        event.substrateRefs.some((ref) => ref.kind === "state_review_artifact"),
      )
      .map((event) => ({
        scenarioId: event.scenarioId,
        refs: event.substrateRefs.filter(
          (ref) => ref.kind === "state_review_artifact",
        ),
      }));
    expect(artifactLinkedEvents).toEqual([
      {
        scenarioId: "arrowhedge-distribution-currentness-mismatch",
        refs: [
          {
            kind: "state_review_artifact",
            id: "artifact_arrowhedge_stale_read_001",
            label: "ArrowHedge StateReviewArtifact",
          },
        ],
      },
    ]);
    const outcomeLinkedEvents = suite.events
      .filter((event) =>
        event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope"),
      )
      .map((event) => ({
        scenarioId: event.scenarioId,
        refs: event.substrateRefs.filter(
          (ref) => ref.kind === "action_outcome_envelope",
        ),
      }));
    expect(outcomeLinkedEvents).toEqual([
      {
        scenarioId: "arrowhedge-terminal-outcome-partition",
        refs: [
          {
            kind: "action_outcome_envelope",
            id: "outcome_arrowhedge_terminal_partition_001",
            label: "ArrowHedge ActionOutcomeEnvelope",
          },
        ],
      },
    ]);

    const metrics = analyzeEvalEvents(suite.events);
    expect(metrics).toMatchObject({
      pairedGroups: 7,
      completePairedGroups: 7,
      baselineFailures: 7,
      substrateFailures: 0,
      failureReduction: 1,
      allStageFailureReduction: 7,
      authorityGatePassRate: 1,
    });
    expect(metrics.evidenceStages).toEqual([
      "scaffolded_scenario",
      "detected_warning",
      "blocked_mutation",
    ]);
    expect(metrics.byEvidenceStage.blocked_mutation).toMatchObject({
      events: 2,
      pairedGroups: 1,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byEvidenceStage.detected_warning).toMatchObject({
      events: 2,
      pairedGroups: 1,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass["stale_observation"]).toMatchObject({
      baselineFailures: 2,
      substrateFailures: 0,
      failureReduction: 0,
      allStageFailureReduction: 2,
      substratePasses: 2,
    });
    expect(metrics.byFailureClass["capability_contract_violation"]).toMatchObject({
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 0,
      allStageFailureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass["representation_loss"]).toMatchObject({
      failureReduction: 0,
      allStageFailureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byFailureClass["parallel_write_conflict"]).toMatchObject({
      failureReduction: 1,
      allStageFailureReduction: 1,
      substratePasses: 1,
    });

    const operational = analyzeAdapterOperationalMetrics(
      suite.events,
      suite.operationalSamples,
    );
    expect(operational).toEqual({
      adapterTimeToFirstValidEventMs: 2000,
      mappingRejectionRate: 1 / 9,
      stateDisagreementRate: 1 / 3,
      authorityGatePassRate: 1,
      authorityGatePasses: 6,
      authorityGateFailures: 0,
    });
  });

  it("fails the distribution-currentness substrate arm when no read-set warning was emitted", () => {
    const suite = buildArrowHedgeStateEvalSuite({
      tenantId: tenantId("tnt_arrowhedge_eval_no_warning"),
      observedAt: timestamp("2026-06-03T16:30:00.000Z"),
      source: "packages/capability-finance-research-ingest/src/arrowhedge.test.ts",
      sourceRecordIds: ["ticker:AAPL"],
      substrateRefs: {
        graphNodeIds: [],
        eventIds: ["evt_signal", "evt_risk", "evt_decision"],
        projectionIds: ["arrowhedge_cop"],
      },
      operationalSamples: [],
    });

    expect(
      suite.summaries.find(
        (summary) =>
          summary.scenarioId === "arrowhedge-distribution-currentness-mismatch",
      ),
    ).toMatchObject({
      baselineResult: "fail",
      substrateResult: "fail",
      improvement: 0,
    });
  });
});
