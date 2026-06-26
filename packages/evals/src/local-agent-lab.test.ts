import { describe, expect, it } from "vitest";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  verifyActionOutcomeEnvelopeHash,
  type ActionOutcomeEnvelope,
  type ActionTerminalOutcome,
} from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";

import {
  assertEventsHaveGeneratedActionOutcomePackets,
  buildDynamicLocalAgentLabEvalSuite,
  recordDynamicLocalAgentLabEvalSuite,
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
    expect(suite.events.every((event) => event.pairedRunGroup === "pair_local_agent_lab_stale-observation")).toBe(true);
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
      coverageRate: 1 / FAILURE_CLASSES.length,
      coveredFailureClasses: ["stale_observation"],
    });
    expect(suite.liveCoverage.missingFailureClasses).toContain("partial_observation");
  });

  it("reports complete live coverage only after every failure class has a packet-backed pair", () => {
    const runs = FAILURE_CLASSES.map((failureClass) =>
      scenarioRunFixture({
        failureClass,
        scenarioId: failureClass.replaceAll("_", "-"),
      }),
    );
    const suite = buildDynamicLocalAgentLabEvalSuite({
      runs,
      model: "llama3.2:3b",
      actionOutcomeEnvelopes: runs.flatMap((run) => run.actionOutcomeEnvelopes),
    });

    expect(suite.events).toHaveLength(FAILURE_CLASSES.length * 2);
    expect(suite.liveCoverage.complete).toBe(true);
    expect(suite.liveCoverage.coverageRate).toBe(1);
    expect(suite.liveCoverage.coveredFailureClasses).toEqual(FAILURE_CLASSES);
    expect(suite.liveCoverage.missingFailureClasses).toEqual([]);
    expect(
      FAILURE_CLASSES.every(
        (failureClass) =>
          suite.liveCoverage.byFailureClass[failureClass].completePacketBackedPairs === 1,
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
  } = {},
): DynamicLocalAgentLabScenarioRunForEval {
  const scenarioId = input.scenarioId ?? "stale-observation";
  const failureClass = input.failureClass ?? "stale_observation";
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
    terminalOutcome: "blocked",
    decidedAt: "2026-06-25T19:00:01.000Z" as Timestamp,
  });

  return {
    scenarioId,
    failureClass,
    realityQualities: [5, 6, 7, 9, 10],
    model: "llama3.2:3b",
    arms: {
      no_substrate: {
        arm: "no_substrate",
        result: "fail",
        actedValue: 100,
        admitted: true,
        tokens: 42,
        admittedTransitions: 3,
        chainValid: true,
        actionOutcomeEnvelope: baselineEnvelope,
      },
      substrate: {
        arm: "substrate",
        result: "blocked",
        actedValue: 100,
        admitted: false,
        refusedReason: "stale_basis position=1 < head=2",
        tokens: 44,
        admittedTransitions: 2,
        chainValid: true,
        actionOutcomeEnvelope: substrateEnvelope,
      },
    },
    actionOutcomeEnvelopes: [baselineEnvelope, substrateEnvelope],
    behaviorDiverged: true,
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
