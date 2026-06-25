import { describe, expect, it } from "vitest";
import type { TenantId, Timestamp } from "@pm/types";

import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";
import { buildMarketingAxisBBlockedEval } from "./marketing.js";
import {
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
import type { EvalGraphWriteAuthorityRecovery } from "./authority-recovery.js";
import {
  buildStrictThreeAxisProofPacket,
  buildThreeAxisProofPacket,
} from "./three-axis-proof-packet.js";

const tenantId = "tnt_three_axis_packet" as TenantId;
const observedAt = "2026-06-25T23:00:00.000Z" as Timestamp;

describe("three-axis proof packet", () => {
  it("packages current Axis A, blocked Axis B, and verified Axis C without overclaiming completion", () => {
    const axisA = buildArrowHedgeStateEvalSuite({
      tenantId,
      observedAt,
      source: "packages/capability-finance-research-ingest/src/arrowhedge.test.ts",
      sourceRecordIds: [
        "ticker:AAPL",
        "risk:risk_aapl_1400",
        "decision:dec_aapl_buy_120",
      ],
      substrateRefs: {
        graphNodeIds: ["node_portfolio_state"],
        eventIds: ["evt_signal", "evt_risk", "evt_decision"],
        projectionIds: ["arrowhedge_cop"],
      },
      readSetValidation: {
        currentStateViewId: "arrowhedge_cop:AAPL:current_state_view",
        mode: "warn",
        issueCodes: ["stale_read_ref"],
      },
      actionOutcomeEnvelopes: [
        {
          scenarioId: "arrowhedge-terminal-outcome-partition",
          envelopeId: "outcome_arrowhedge_terminal_partition_baseline",
          runArm: "baseline",
          terminalOutcome: "accepted",
        },
        {
          scenarioId: "arrowhedge-terminal-outcome-partition",
          envelopeId: "outcome_arrowhedge_terminal_partition_substrate",
          runArm: "substrate",
          terminalOutcome: "blocked",
        },
      ],
      operationalSamples: [],
    });
    const axisB = buildMarketingAxisBBlockedEval({
      tenantId,
      observedAt,
    });
    const axisC = FAILURE_CLASSES.flatMap((failureClass) =>
      pairedEvents({
        axis: "local_lab",
        failureClass,
        scenarioId: `local-${failureClass}`,
        substrateResult: "blocked",
        substrateScenarioResult: "pass",
        substrateOperationalTerminalOutcome: "blocked",
        evidenceStage: "live_run",
      }),
    );

    const packet = buildThreeAxisProofPacket({
      generatedAt: observedAt,
      events: [...axisA.events, axisB, ...axisC],
      sources: [
        {
          sourceId: "axis-a-arrowhedge-current",
          axis: "finance",
          eventCount: axisA.events.length,
        },
        {
          sourceId: "axis-b-marketing-blocker",
          axis: "marketing",
          eventCount: 1,
        },
        {
          sourceId: "axis-c-local-lab-live",
          axis: "local_lab",
          eventCount: axisC.length,
        },
      ],
    });

    expect(packet.status).toBe("blocked");
    expect(packet.report.verified).toBe(false);
    expect(packet.verifiedAxes).toEqual(["local_lab"]);
    expect(packet.blockedAxes).toEqual(["marketing"]);
    expect(packet.unverifiedAxes).toEqual(["finance", "marketing"]);
    expect(packet.report.byAxis.local_lab.verified).toBe(true);
    expect(packet.report.byAxis.finance.verified).toBe(false);
    expect(packet.report.byAxis.marketing.blockedFailureClasses).toEqual([
      "workflow_invalidation",
    ]);
    expect(
      packet.terminalProofBackedScenarioPassCells,
    ).toEqual(
      expect.arrayContaining([
        {
          axis: "finance",
          failureClass: "parallel_write_conflict",
          reasons: [],
        },
        {
          axis: "local_lab",
          failureClass: "stale_observation",
          reasons: [],
        },
      ]),
    );
    expect(packet.missingCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: "finance",
          failureClass: "partial_observation",
        }),
        expect.objectContaining({
          axis: "marketing",
          failureClass: "stale_observation",
        }),
      ]),
    );
  });

  it("marks a packet verified only when all axis/failure-class cells pass with terminal proof", () => {
    const events = (["finance", "marketing", "local_lab"] as const).flatMap((axis) =>
      FAILURE_CLASSES.flatMap((failureClass) =>
        pairedEvents({
          axis,
          failureClass,
          scenarioId: `${axis}-${failureClass}`,
          substrateResult: "pass",
          evidenceStage:
            axis === "local_lab" ? "live_run" : "paired_behavioral_improvement",
        }),
      ),
    );

    const packet = buildThreeAxisProofPacket({
      packetId: "three_axis_proof_all_verified",
      generatedAt: observedAt,
      events,
      sources: [
        {
          sourceId: "all-axes-fixture",
          eventCount: events.length,
        },
      ],
    });

    expect(packet.status).toBe("verified");
    expect(packet.report.verified).toBe(true);
    expect(packet.verifiedAxes).toEqual(["finance", "marketing", "local_lab"]);
    expect(packet.blockedAxes).toEqual([]);
    expect(packet.missingCells).toEqual([]);
    expect(packet.unverifiedCells).toEqual([]);
    expect(packet.terminalProofBackedScenarioPassCells).toHaveLength(30);
  });

  it("requires authority recovery when the stricter proof-packet gate is enabled", () => {
    const events = (["finance", "marketing", "local_lab"] as const).flatMap((axis) =>
      FAILURE_CLASSES.flatMap((failureClass) =>
        pairedEvents({
          axis,
          failureClass,
          scenarioId: `${axis}-${failureClass}`,
          substrateResult: "pass",
          evidenceStage:
            axis === "local_lab" ? "live_run" : "paired_behavioral_improvement",
        }),
      ),
    );

    const missingRecoveryPacket = buildThreeAxisProofPacket({
      packetId: "three_axis_proof_requires_authority_missing",
      generatedAt: observedAt,
      events,
      sources: [{ sourceId: "all-axes-fixture", eventCount: events.length }],
      requireAuthorityRecovery: true,
    });

    expect(missingRecoveryPacket.report.verified).toBe(true);
    expect(missingRecoveryPacket.status).toBe("unverified");
    expect(missingRecoveryPacket.authorityRecoveryGate).toMatchObject({
      required: true,
      passed: false,
      obligationCount: 60,
      validObligations: 0,
    });
    expect(
      missingRecoveryPacket.authorityRecoveryGate.invalidObligations[0],
    ).toMatchObject({
      reason: "missing_authority_recovery",
      expectedStatus: "accepted_authority_recovered",
    });

    const recoveredPacket = buildThreeAxisProofPacket({
      packetId: "three_axis_proof_requires_authority_recovered",
      generatedAt: observedAt,
      events,
      sources: [{ sourceId: "all-axes-fixture", eventCount: events.length }],
      authorityRecoveries: events.map(authorityRecoveryForEvent),
      requireAuthorityRecovery: true,
    });

    expect(recoveredPacket.status).toBe("verified");
    expect(recoveredPacket.authorityRecoveryGate).toMatchObject({
      required: true,
      passed: true,
      obligationCount: 60,
      validObligations: 60,
      invalidObligations: [],
    });
  });

  it("does not let blocked terminal outcomes masquerade as accepted authority", () => {
    const events = pairedEvents({
      axis: "local_lab",
      failureClass: "stale_observation",
      scenarioId: "local-blocked-refusal",
      substrateResult: "blocked",
      substrateScenarioResult: "pass",
      substrateOperationalTerminalOutcome: "blocked",
      evidenceStage: "live_run",
    });
    const recoveries = events.map(authorityRecoveryForEvent);
    const wrongSubstrateRecovery = {
      ...recoveries[1]!,
      status: "accepted_authority_recovered" as const,
    };

    const packet = buildThreeAxisProofPacket({
      packetId: "three_axis_proof_blocked_wrong_authority",
      generatedAt: observedAt,
      events,
      sources: [{ sourceId: "axis-c-blocked-fixture", eventCount: events.length }],
      authorityRecoveries: [recoveries[0]!, wrongSubstrateRecovery],
      requireAuthorityRecovery: true,
    });

    expect(packet.authorityRecoveryGate).toMatchObject({
      required: true,
      passed: false,
      obligationCount: 2,
      validObligations: 1,
    });
    expect(packet.authorityRecoveryGate.invalidObligations).toEqual([
      expect.objectContaining({
        runId: "run_local-blocked-refusal_substrate",
        expectedStatus: "terminal_outcome_refused_authority",
        recoveryStatus: "accepted_authority_recovered",
        reason: "unexpected_authority_recovery_status",
      }),
    ]);
  });

  it("builds strict proof packets from a runner authority recovery suite", () => {
    const events = (["finance", "marketing", "local_lab"] as const).flatMap((axis) =>
      FAILURE_CLASSES.flatMap((failureClass) =>
        pairedEvents({
          axis,
          failureClass,
          scenarioId: `${axis}-${failureClass}`,
          substrateResult: "pass",
          evidenceStage:
            axis === "local_lab" ? "live_run" : "paired_behavioral_improvement",
        }),
      ),
    );
    const recoveries = events.map(authorityRecoveryForEvent);

    const packet = buildStrictThreeAxisProofPacket({
      packetId: "three_axis_proof_strict_runner_suite",
      generatedAt: observedAt,
      events,
      sources: [{ sourceId: "strict-runner-suite", eventCount: events.length }],
      authorityRecoverySuite: {
        recoveries,
        summary: {
          totalEvents: events.length,
          auditedEvents: recoveries.length,
          validRecoveries: recoveries.length,
          invalidRecoveries: 0,
          byStatus: {
            accepted_authority_recovered: recoveries.length,
            terminal_outcome_refused_authority: 0,
            missing_action_outcome_ref: 0,
            ambiguous_action_outcome_ref: 0,
            missing_authority_packet: 0,
            unexpected_terminal_authority: 0,
            authority_resolution_failed: 0,
            authority_policy_rejected: 0,
          },
        },
      },
    });

    expect(packet.status).toBe("verified");
    expect(packet.authorityRecoveryGate).toMatchObject({
      required: true,
      passed: true,
      obligationCount: recoveries.length,
      validObligations: recoveries.length,
      invalidObligations: [],
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
}): readonly [EvalEvent, EvalEvent] {
  const pairedRunGroup = `pair_${input.scenarioId}`;
  return [
    event({
      ...input,
      runArm: "baseline",
      result: "fail",
      scenarioResult: "fail",
      operationalTerminalOutcome: "accepted",
      pairedRunGroup,
    }),
    event({
      ...input,
      runArm: "substrate",
      result: input.substrateResult,
      scenarioResult: input.substrateScenarioResult ?? input.substrateResult,
      operationalTerminalOutcome:
        input.substrateOperationalTerminalOutcome ?? "accepted",
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
  readonly scenarioResult: EvalResult;
  readonly operationalTerminalOutcome: "accepted" | "blocked";
  readonly evidenceStage: EvalEvidenceStage;
}): EvalEvent {
  return evalEvent({
    tenantId,
    axis: input.axis,
    runId: `run_${input.scenarioId}_${input.runArm}`,
    agentId: `${input.axis}_agent`,
    scenarioId: input.scenarioId,
    failureClass: input.failureClass,
    observedAt,
    source: "three-axis-proof-packet-test",
    evidenceRefs: [
      evalEvidenceRef("external_fixture", `fixtures/${input.scenarioId}.json`),
    ],
    substrateRefs: [
      evalEvidenceRef("event", `evt_${input.scenarioId}_${input.runArm}`),
      evalEvidenceRef(
        "action_outcome_envelope",
        `outcome_${input.scenarioId}_${input.runArm}`,
      ),
    ],
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    evidenceStage: input.evidenceStage,
    scenarioResult: input.scenarioResult,
    operationalTerminalOutcome: input.operationalTerminalOutcome,
    result: input.result,
    notes: "three-axis proof-packet fixture",
  });
}

function authorityRecoveryForEvent(
  event: EvalEvent,
): EvalGraphWriteAuthorityRecovery {
  const terminalOutcome = event.operationalTerminalOutcome!;
  return {
    runId: event.runId,
    scenarioId: event.scenarioId,
    axis: event.axis,
    tenantId: event.tenantId,
    envelopeId: event.substrateRefs.find(
      (ref) => ref.kind === "action_outcome_envelope",
    )!.id,
    actionId: `action_${event.runId}`,
    terminalOutcome:
      terminalOutcome === "accepted" ? "accepted" : "blocked",
    valid: true,
    status:
      terminalOutcome === "accepted"
        ? "accepted_authority_recovered"
        : "terminal_outcome_refused_authority",
    evidenceRefs: event.evidenceRefs,
    substrateRefs: event.substrateRefs,
    issueCodes: [],
    issues: [],
  };
}
