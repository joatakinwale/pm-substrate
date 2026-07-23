import { describe, expect, it } from "vitest";
import type { TenantId, Timestamp } from "@pm/types";

import { buildMarketingAxisBBlockedEval } from "./marketing.js";
import {
  EVAL_AXES,
  FAILURE_CLASSES,
  evalEvent,
  evalEvidenceRef,
  type EvalAxis,
  type EvalEvent,
  type EvalEvidenceStage,
  type EvalResult,
  type FailureClass,
  type RunArm,
} from "./schema.js";
import { analyzeThreeAxisCoverage } from "./three-axis-coverage.js";

const tenantId = "tnt_three_axis" as TenantId;
const observedAt = "2026-06-25T22:00:00.000Z" as Timestamp;

describe("three-axis coverage gate", () => {
  it("does not let complete Axis C coverage hide blocked and missing Axis B cells", () => {
    const localLabEvents = FAILURE_CLASSES.flatMap((failureClass) =>
      pairedEvents({
        axis: "local_lab",
        failureClass,
        scenarioId: `local-${failureClass}`,
        substrateResult: "blocked",
        substrateScenarioResult: "pass",
        substrateOperationalTerminalOutcome: "blocked",
        evidenceStage: "live_run",
        actionOutcomeRefs: true,
      }),
    );
    const report = analyzeThreeAxisCoverage([
      ...localLabEvents,
      buildMarketingAxisBBlockedEval({
        tenantId,
        observedAt,
      }),
    ]);

    expect(report.requiredScenarioFamilies).toBe(30);
    expect(report.complete).toBe(false);
    expect(report.verified).toBe(false);
    expect(report.coveredScenarioFamilies).toBe(10);
    expect(report.verifiedScenarioFamilies).toBe(10);
    expect(report.blockedScenarioFamilies).toBe(1);
    expect(report.byAxis.local_lab.complete).toBe(true);
    expect(report.byAxis.local_lab.verified).toBe(true);
    expect(report.byAxis.local_lab.coverageRate).toBe(1);
    expect(report.byAxis.marketing.complete).toBe(false);
    expect(report.byAxis.marketing.blockedFailureClasses).toEqual([
      "workflow_invalidation",
    ]);
    expect(report.byAxis.marketing.missingFailureClasses).toContain(
      "stale_observation",
    );
    expect(
      report.byCell.marketing.workflow_invalidation.reasons,
    ).toContain("blocked_without_refs");
  });

  it("requires all axis/failure-class cells to have terminal-proof-backed scenario pass pairs for verification", () => {
    const events = EVAL_AXES.flatMap((axis) =>
      FAILURE_CLASSES.flatMap((failureClass) =>
        pairedEvents({
          axis,
          failureClass,
          scenarioId: `${axis}-${failureClass}`,
          substrateResult: "pass",
          evidenceStage:
            axis === "local_lab" ? "live_run" : "paired_behavioral_improvement",
          actionOutcomeRefs: true,
        }),
      ),
    );

    const report = analyzeThreeAxisCoverage(events);

    expect(report.complete).toBe(true);
    expect(report.verified).toBe(true);
    expect(report.coveredScenarioFamilies).toBe(30);
    expect(report.verifiedScenarioFamilies).toBe(30);
    expect(report.blockedScenarioFamilies).toBe(0);
    expect(report.coverageRate).toBe(1);
    expect(report.verifiedRate).toBe(1);
    expect(report.byAxis.finance.verifiedFailureClasses).toEqual(FAILURE_CLASSES);
    expect(report.byAxis.marketing.verifiedFailureClasses).toEqual(FAILURE_CLASSES);
    expect(report.byAxis.local_lab.verifiedFailureClasses).toEqual(FAILURE_CLASSES);
  });

  it("counts protective pairs without terminal proof as covered but not verified", () => {
    const events = pairedEvents({
      axis: "finance",
      failureClass: "stale_observation",
      scenarioId: "finance-stale-observation",
      substrateResult: "pass",
      evidenceStage: "paired_behavioral_improvement",
      actionOutcomeRefs: false,
    });

    const report = analyzeThreeAxisCoverage(events);
    const cell = report.byCell.finance.stale_observation;

    expect(cell.covered).toBe(true);
    expect(cell.scenarioPassPairs).toBe(1);
    expect(cell.terminalProofBackedPairs).toBe(0);
    expect(cell.verified).toBe(false);
    expect(cell.reasons).toContain("missing_terminal_proof_refs");
    expect(report.complete).toBe(false);
    expect(report.verified).toBe(false);
  });

  it("does not treat a duplicated or imbalanced arm group as a complete pair", () => {
    const pair = pairedEvents({
      axis: "local_lab",
      failureClass: "stale_observation",
      scenarioId: "duplicate-stale-observation",
      substrateResult: "pass",
      evidenceStage: "live_run",
      actionOutcomeRefs: true,
    });
    const duplicated = analyzeThreeAxisCoverage([...pair, pair[0]]);
    const duplicatedCell = duplicated.byCell.local_lab.stale_observation;

    expect(duplicatedCell.pairedGroups).toBe(1);
    expect(duplicatedCell.completePairedGroups).toBe(0);
    expect(duplicatedCell.protectivePairs).toBe(0);
    expect(duplicatedCell.covered).toBe(false);
    expect(duplicatedCell.reasons).toContain("missing_complete_pair");

    const imbalanced = analyzeThreeAxisCoverage([pair[0]]);
    expect(imbalanced.byCell.local_lab.stale_observation).toMatchObject({
      completePairedGroups: 0,
      protectivePairs: 0,
      covered: false,
    });
  });
});

function pairedEvents(input: {
  readonly axis: EvalAxis;
  readonly failureClass: FailureClass;
  readonly scenarioId: string;
  readonly substrateResult: EvalResult;
  readonly substrateScenarioResult?: EvalResult;
  readonly substrateOperationalTerminalOutcome?: "accepted" | "blocked";
  readonly evidenceStage: EvalEvidenceStage;
  readonly actionOutcomeRefs: boolean;
}): readonly [EvalEvent, EvalEvent] {
  const pairedRunGroup = `pair_${input.scenarioId}`;
  return [
    event({
      ...input,
      runArm: "baseline",
      result: "fail",
      pairedRunGroup,
    }),
    event({
      ...input,
      runArm: "substrate",
      result: input.substrateResult,
      ...(input.substrateScenarioResult === undefined
        ? {}
        : { scenarioResult: input.substrateScenarioResult }),
      ...(input.substrateOperationalTerminalOutcome === undefined
        ? {}
        : { operationalTerminalOutcome: input.substrateOperationalTerminalOutcome }),
      pairedRunGroup,
    }),
  ];
}

function event(input: {
  readonly axis: EvalAxis;
  readonly failureClass: FailureClass;
  readonly scenarioId: string;
  readonly runArm: RunArm;
  readonly pairedRunGroup: string;
  readonly result: EvalResult;
  readonly scenarioResult?: EvalResult;
  readonly operationalTerminalOutcome?: "accepted" | "blocked";
  readonly evidenceStage: EvalEvidenceStage;
  readonly actionOutcomeRefs: boolean;
}): EvalEvent {
  const actionOutcomeRef = input.actionOutcomeRefs
    ? [
        evalEvidenceRef(
          "action_outcome_envelope",
          `outcome_${input.scenarioId}_${input.runArm}`,
        ),
      ]
    : [];
  return evalEvent({
    tenantId,
    axis: input.axis,
    runId: `run_${input.scenarioId}_${input.runArm}`,
    agentId: `${input.axis}_agent`,
    scenarioId: input.scenarioId,
    failureClass: input.failureClass,
    observedAt,
    source: "three-axis-coverage-test",
    evidenceRefs: [
      evalEvidenceRef("external_fixture", `fixtures/${input.scenarioId}.json`),
    ],
    substrateRefs: [
      evalEvidenceRef("event", `evt_${input.scenarioId}_${input.runArm}`),
      ...actionOutcomeRef,
    ],
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    evidenceStage: input.evidenceStage,
    ...(input.scenarioResult === undefined
      ? {}
      : { scenarioResult: input.scenarioResult }),
    ...(input.operationalTerminalOutcome === undefined
      ? {}
      : { operationalTerminalOutcome: input.operationalTerminalOutcome }),
    result: input.result,
    notes: "three-axis coverage fixture",
  });
}
