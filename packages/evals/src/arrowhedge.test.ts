import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";
import {
  analyzeAdapterOperationalMetrics,
  analyzeEvalEvents,
} from "./metrics.js";

describe("ArrowHedge state eval suite", () => {
  it("emits paired evals for the six ArrowHedge adapter and agent-state scenarios", () => {
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
      stateReviewArtifactIds: ["artifact_arrowhedge_stale_read_001"],
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
    ]);
    expect(suite.summaries.map((summary) => summary.scenarioId)).toContain(
      "arrowhedge-distribution-currentness-mismatch",
    );
    expect(suite.events).toHaveLength(12);
    expect(
      suite.events
        .filter((event) => event.runArm === "substrate")
        .flatMap((event) => event.substrateRefs)
        .filter((ref) => ref.kind === "state_review_artifact"),
    ).toEqual([
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
      {
        kind: "state_review_artifact",
        id: "artifact_arrowhedge_stale_read_001",
        label: "ArrowHedge StateReviewArtifact",
      },
    ]);

    const metrics = analyzeEvalEvents(suite.events);
    expect(metrics).toMatchObject({
      pairedGroups: 6,
      completePairedGroups: 6,
      baselineFailures: 6,
      substrateFailures: 0,
      failureReduction: 0,
      allStageFailureReduction: 6,
      authorityGatePassRate: 1,
    });
    expect(metrics.evidenceStages).toEqual([
      "scaffolded_scenario",
      "detected_warning",
    ]);
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

    const operational = analyzeAdapterOperationalMetrics(
      suite.events,
      suite.operationalSamples,
    );
    expect(operational).toEqual({
      adapterTimeToFirstValidEventMs: 2000,
      mappingRejectionRate: 1 / 9,
      stateDisagreementRate: 1 / 3,
      authorityGatePassRate: 1,
      authorityGatePasses: 5,
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
