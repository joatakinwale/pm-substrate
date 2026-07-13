import { describe, expect, it } from "vitest";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  verifyActionOutcomeEnvelopeHash,
  type ActionOutcomeEnvelope,
  type ActionTerminalOutcome,
} from "@pm/agent-state-core";
import type { TenantId, Timestamp } from "@pm/types";

import {
  assertEventsHaveGeneratedActionOutcomePackets,
  analyzeDynamicLocalAgentLabLiveCoverage,
  buildDynamicLocalAgentLabEvalSuite,
  recordDynamicLocalAgentLabEvalSuite,
  summarizeLocalAgentLabMechanismEvidence,
  type DynamicLocalAgentLabScenarioRunForEval,
} from "./local-agent-lab.js";
import { FAILURE_CLASSES, type FailureClass } from "./schema.js";

describe("dynamic local-agent-lab eval adapter", () => {
  it("converts a dynamic ScenarioRun into packet-backed live EvalEvents", () => {
    const run = scenarioRunFixture();
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [run],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: run.actionOutcomeEnvelopes,
    });

    expect(suite.events).toHaveLength(2);
    expect(suite.actionOutcomeEnvelopes).toHaveLength(2);
    expect(suite.events.map((event) => event.runArm)).toEqual([
      "baseline",
      "substrate",
    ]);
    expect(suite.events.every((event) => event.evidenceStage === "live_run")).toBe(true);
    expect(suite.events.map((event) => event.result)).toEqual(["fail", "blocked"]);
    expect(suite.events.map((event) => event.scenarioResult)).toEqual(["fail", "pass"]);
    expect(suite.events.map((event) => event.operationalTerminalOutcome)).toEqual([
      "accepted",
      "blocked",
    ]);
    expect(new Set(suite.events.map((event) => event.pairedRunGroup)).size).toBe(1);
    expect(suite.events.every((event) => event.attemptId === run.attemptId)).toBe(true);
    expect(suite.events[0]!.tenantId).toBe("tnt_live_baseline");
    expect(suite.events[1]!.tenantId).toBe("tnt_live_substrate");
    expect(
      suite.events.every((event) =>
        event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope"),
      ),
    ).toBe(true);
    expect(
      suite.actionOutcomeEnvelopes.every(
        (envelope) => verifyActionOutcomeEnvelopeHash(envelope).valid,
      ),
    ).toBe(true);
    expect(suite.metrics.evidenceStages).toEqual(["live_run"]);
    expect(suite.evidenceClaim).toBe("mechanism_conformance_only");
    expect(suite.mechanismFailureReduction).toBeNull();
    expect(suite.failureReduction).toBe(1);
    expect(suite.allStageFailureReduction).toBe(1);
    expect(suite.metrics.byEvidenceStage.live_run).toMatchObject({
      events: 2,
      baselineFailures: 1,
      substrateFailures: 0,
      substrateBlocked: 1,
    });
    expect(suite.liveCoverage).toMatchObject({
      complete: false,
      coverageRate: 0,
      coveredFailureClasses: [],
      mutantControlGatePassed: false,
    });
    expect(suite.liveCoverage.missingFailureClasses).toContain("partial_observation");
  });

  it("reports complete live coverage only after every failure class has a packet-backed pair", () => {
    const runs = FAILURE_CLASSES.flatMap((failureClass) => [
      scenarioRunFixture({
        failureClass,
        scenarioId: `${failureClass.replaceAll("_", "-")}-expected-block`,
        expectedAdmission: "block",
      }),
      scenarioRunFixture({
        failureClass,
        scenarioId: `${failureClass.replaceAll("_", "-")}-expected-allow`,
        expectedAdmission: "allow",
      }),
    ]);
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs,
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: runs.flatMap((run) => run.actionOutcomeEnvelopes),
    });

    expect(suite.events).toHaveLength(FAILURE_CLASSES.length * 4);
    expect(suite.liveCoverage.complete).toBe(true);
    expect(suite.liveCoverage.mutantControlGatePassed).toBe(true);
    expect(suite.mechanismFailureReduction).toBe(FAILURE_CLASSES.length);
    expect(suite.liveCoverage.coverageRate).toBe(1);
    expect(suite.liveCoverage.coveredFailureClasses).toEqual(FAILURE_CLASSES);
    expect(suite.liveCoverage.missingFailureClasses).toEqual([]);
    expect(
      FAILURE_CLASSES.every(
        (failureClass) =>
          suite.liveCoverage.byFailureClass[failureClass].completePacketBackedPairs === 2,
      ),
    ).toBe(true);
    expect(
      FAILURE_CLASSES.every(
        (failureClass) =>
          suite.liveCoverage.byFailureClass[failureClass].protectivePacketBackedPairs === 1,
      ),
    ).toBe(true);
  });

  it("does not count packet-backed honest negatives as covered failure classes", () => {
    const run = scenarioRunFixture({
      failureClass: "workflow_invalidation",
      scenarioId: "workflow-invalidation",
    });
    const honestNegative: DynamicLocalAgentLabScenarioRunForEval = {
      ...run,
      arms: {
        ...run.arms,
        no_substrate: {
          ...run.arms.no_substrate,
          result: "pass",
        },
      },
    };
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [honestNegative],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: honestNegative.actionOutcomeEnvelopes,
    });

    expect(suite.liveCoverage.byFailureClass.workflow_invalidation).toMatchObject({
      completePacketBackedPairs: 1,
      protectivePacketBackedPairs: 0,
      covered: false,
    });
    expect(suite.liveCoverage.coveredFailureClasses).toEqual([]);
    expect(suite.liveCoverage.missingFailureClasses).toContain("workflow_invalidation");
  });

  it("rejects a block-all mutant because the matched expected-allow control is denied", () => {
    const expectedBlock = scenarioRunFixture({
      scenarioId: "stale-observation-expected-block",
      expectedAdmission: "block",
    });
    const blockAllControl = scenarioRunFixture({
      scenarioId: "stale-observation-expected-allow",
      expectedAdmission: "allow",
      substrateResult: "blocked",
      substrateTerminalOutcome: "blocked",
    });
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [expectedBlock, blockAllControl],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: [
        ...expectedBlock.actionOutcomeEnvelopes,
        ...blockAllControl.actionOutcomeEnvelopes,
      ],
    });
    const summary = summarizeLocalAgentLabMechanismEvidence(suite.events);

    expect(summary).toMatchObject({
      exactPairs: 2,
      protectivePairs: 1,
      expectedAllowPairs: 1,
      passingExpectedAllowPairs: 0,
      allowAllMutantRejected: true,
      blockAllMutantRejected: false,
      mutantControlGatePassed: false,
    });
    expect(suite.mechanismFailureReduction).toBeNull();
    expect(suite.liveCoverage.byFailureClass.stale_observation.covered).toBe(false);
  });

  it("rejects an allow-all mutant because the expected-block hazard lands", () => {
    const allowAllHazard = scenarioRunFixture({
      scenarioId: "stale-observation-expected-block",
      expectedAdmission: "block",
      substrateResult: "fail",
      substrateTerminalOutcome: "accepted",
    });
    const expectedAllow = scenarioRunFixture({
      scenarioId: "stale-observation-expected-allow",
      expectedAdmission: "allow",
    });
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [allowAllHazard, expectedAllow],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: [
        ...allowAllHazard.actionOutcomeEnvelopes,
        ...expectedAllow.actionOutcomeEnvelopes,
      ],
    });
    const summary = summarizeLocalAgentLabMechanismEvidence(suite.events);

    expect(summary).toMatchObject({
      exactPairs: 2,
      expectedBlockPairs: 1,
      protectivePairs: 0,
      passingExpectedAllowPairs: 1,
      allowAllMutantRejected: false,
      blockAllMutantRejected: true,
      mutantControlGatePassed: false,
    });
    expect(suite.mechanismFailureReduction).toBeNull();
    expect(suite.liveCoverage.byFailureClass.stale_observation.covered).toBe(false);
  });

  it("does not overstate duplicate or imbalanced pair groups", () => {
    const expectedBlock = scenarioRunFixture({
      scenarioId: "stale-observation-expected-block",
      expectedAdmission: "block",
    });
    const expectedAllow = scenarioRunFixture({
      scenarioId: "stale-observation-expected-allow",
      expectedAdmission: "allow",
    });
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [expectedBlock, expectedAllow],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: [
        ...expectedBlock.actionOutcomeEnvelopes,
        ...expectedAllow.actionOutcomeEnvelopes,
      ],
    });

    expect(summarizeLocalAgentLabMechanismEvidence(suite.events)).toMatchObject({
      exactPairs: 2,
      invalidPairedGroups: 0,
      exactPairIntegrityPassed: true,
      mutantControlGatePassed: true,
    });

    const duplicated = [...suite.events, suite.events[0]!];
    expect(summarizeLocalAgentLabMechanismEvidence(duplicated)).toMatchObject({
      exactPairs: 1,
      invalidPairedGroups: 1,
      exactPairIntegrityPassed: false,
      mutantControlGatePassed: false,
    });
    expect(
      analyzeDynamicLocalAgentLabLiveCoverage(
        duplicated,
        suite.actionOutcomeEnvelopes,
      ).byFailureClass.stale_observation.covered,
    ).toBe(false);

    const imbalanced = suite.events.filter(
      (event) =>
        event.expectedAdmission === "allow" || event.runArm === "baseline",
    );
    expect(summarizeLocalAgentLabMechanismEvidence(imbalanced)).toMatchObject({
      exactPairs: 1,
      invalidPairedGroups: 1,
      exactPairIntegrityPassed: false,
      mutantControlGatePassed: false,
    });
  });

  it("persists generated packets before recording live EvalEvents", async () => {
    const run = scenarioRunFixture();
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [run],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: run.actionOutcomeEnvelopes,
    });
    const calls: string[] = [];

    await recordDynamicLocalAgentLabEvalSuite(
      {
        async recordActionOutcomeEnvelopes(envelopes) {
          calls.push(`packets:${envelopes.length}`);
        },
        async recordMany(events) {
          calls.push(`events:${events.length}`);
        },
      },
      suite,
    );

    expect(calls).toEqual(["packets:2", "events:2"]);
  });

  it("rejects live EvalEvents whose action_outcome_envelope refs lack packets", () => {
    const run = scenarioRunFixture();
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs: [run],
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: run.actionOutcomeEnvelopes,
    });

    expect(() =>
      assertEventsHaveGeneratedActionOutcomePackets(suite.events, []),
    ).toThrow(/without a generated ActionOutcomeEnvelope packet/);
  });

  it("rejects dynamic runs that did not produce terminal packets", () => {
    const run = scenarioRunFixture();
    const { actionOutcomeEnvelope: _missing, ...substrateWithoutPacket } =
      run.arms.substrate;
    const missingPacketRun: DynamicLocalAgentLabScenarioRunForEval = {
      ...run,
      arms: {
        ...run.arms,
        substrate: substrateWithoutPacket,
      },
    };

    expect(() =>
      buildDynamicLocalAgentLabEvalSuite({
        runs: [missingPacketRun],
        model: "llama3.2:3b",
        actionOutcomeEnvelopes: [],
      }),
    ).toThrow(/missing ActionOutcomeEnvelope/);
  });
});

function scenarioRunFixture(
  input: {
    readonly scenarioId?: string;
    readonly failureClass?: FailureClass;
    readonly suiteRunId?: string;
    readonly attemptId?: string;
    readonly expectedAdmission?: "allow" | "block";
    readonly baselineResult?: "pass" | "fail" | "blocked";
    readonly substrateResult?: "pass" | "fail" | "blocked";
    readonly substrateTerminalOutcome?: ActionTerminalOutcome;
  } = {},
): DynamicLocalAgentLabScenarioRunForEval {
  const scenarioId = input.scenarioId ?? "stale-observation";
  const failureClass = input.failureClass ?? "stale_observation";
  const expectedAdmission = input.expectedAdmission ?? "block";
  const baselineResult =
    input.baselineResult ?? (expectedAdmission === "block" ? "fail" : "pass");
  const substrateResult =
    input.substrateResult ?? (expectedAdmission === "block" ? "blocked" : "pass");
  const substrateTerminalOutcome =
    input.substrateTerminalOutcome ??
    (expectedAdmission === "block" ? "blocked" : "accepted");
  const baselineEnvelope = envelopeFixture({
    tenantId: "tnt_live_baseline" as TenantId,
    scenarioId,
    arm: "no_substrate",
    terminalOutcome: "accepted",
    decidedAt: "2026-06-25T19:00:00.000Z" as Timestamp,
    eventId: "evt_live_baseline_order",
  });
  const substrateEnvelope = envelopeFixture({
    tenantId: "tnt_live_substrate" as TenantId,
    scenarioId,
    arm: "substrate",
    terminalOutcome: substrateTerminalOutcome,
    decidedAt: "2026-06-25T19:00:01.000Z" as Timestamp,
  });

  return {
    suiteRunId: input.suiteRunId ?? "suite_fixture",
    attemptId: input.attemptId ?? `attempt_${scenarioId}`,
    scenarioId,
    failureClass,
    expectedAdmission,
    controlGroup: failureClass,
    realityQualities: [5, 6, 7, 9, 10],
    model: "llama3.2:3b",
    arms: {
      no_substrate: {
        arm: "no_substrate",
        result: baselineResult,
        actedValue: 100,
        admitted: true,
        tokens: 42,
        admittedTransitions: 3,
        chainValid: true,
        actionOutcomeEnvelope: baselineEnvelope,
      },
      substrate: {
        arm: "substrate",
        result: substrateResult,
        actedValue: 100,
        admitted: substrateTerminalOutcome === "accepted",
        ...(substrateTerminalOutcome === "accepted"
          ? {}
          : { refusedReason: "stale_basis position=1 < head=2" }),
        tokens: 44,
        admittedTransitions: 2,
        chainValid: true,
        actionOutcomeEnvelope: substrateEnvelope,
      },
    },
    actionOutcomeEnvelopes: [baselineEnvelope, substrateEnvelope],
    behaviorDiverged: baselineResult !== substrateResult,
  };
}

function envelopeFixture(input: {
  readonly tenantId: TenantId;
  readonly scenarioId: string;
  readonly arm: string;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly eventId?: string;
}): ActionOutcomeEnvelope {
  const envelopeId = `outcome_local_agent_lab_${input.scenarioId}_${input.arm}`;
  const substrateRefs = [
    stateRef(
      "action_outcome_envelope",
      envelopeId,
      "Local agent lab ActionOutcomeEnvelope",
    ),
    stateRef("continuity_checkpoint", "basis:1"),
    ...(input.eventId === undefined ? [] : [stateRef("event", input.eventId)]),
  ];

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId,
    actionId: `local_agent_lab:${input.scenarioId}:${input.arm}`,
    subject: stateRef("document", input.scenarioId),
    proposalReviewId: `local_agent_lab:${input.scenarioId}:${input.arm}:proposal_review`,
    stateReviewArtifactHash: `${input.scenarioId}:${input.arm}:hash`,
    evidenceAdmissionReviewIds: [
      `local_agent_lab:${input.scenarioId}:${input.arm}:evidence_review`,
    ],
    requestedTerminalOutcome: input.terminalOutcome,
    decidedAt: input.decidedAt,
    decidedBy: `local-agent-lab:${input.arm}`,
    evidenceRefs: [
      stateRef("document", `local-agent-lab:${input.scenarioId}:observation`),
    ],
    substrateRefs,
    blockingCauses:
      input.terminalOutcome === "blocked"
        ? [
            {
              source: "policy",
              code: "stale_basis",
              message: "Substrate refused a stale local-agent-lab action.",
              refs: substrateRefs,
            },
          ]
        : [],
  });
}
