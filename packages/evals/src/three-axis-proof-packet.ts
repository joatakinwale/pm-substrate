import { createHash } from "node:crypto";
import type { Timestamp } from "@pm/types";

import {
  EVAL_AXES,
  FAILURE_CLASSES,
  type EvalAxis,
  type EvalEvent,
  type FailureClass,
} from "./schema.js";
import type {
  EvalGraphWriteAuthorityRecovery,
  EvalGraphWriteAuthorityRecoverySuite,
  EvalGraphWriteAuthorityRecoveryStatus,
} from "./authority-recovery.js";
import {
  analyzeThreeAxisCoverage,
  type ThreeAxisCoverageOptions,
  type ThreeAxisCoverageReport,
} from "./three-axis-coverage.js";

export type ThreeAxisProofPacketStatus = "verified" | "blocked" | "unverified";

export interface ThreeAxisProofPacketSource {
  readonly sourceId: string;
  readonly axis?: EvalAxis;
  readonly label?: string;
  readonly eventCount: number;
}

export interface ThreeAxisProofPacketCellRef {
  readonly axis: EvalAxis;
  readonly failureClass: FailureClass;
  readonly reasons: readonly string[];
}

export interface ThreeAxisProofPacketInput {
  readonly packetId?: string;
  readonly generatedAt: Timestamp;
  readonly events: readonly EvalEvent[];
  readonly sources: readonly ThreeAxisProofPacketSource[];
  readonly coverageOptions?: ThreeAxisCoverageOptions;
  readonly authorityRecoveries?: readonly EvalGraphWriteAuthorityRecovery[];
  readonly requireAuthorityRecovery?: boolean;
}

export interface StrictThreeAxisProofPacketInput
  extends Omit<
    ThreeAxisProofPacketInput,
    "authorityRecoveries" | "requireAuthorityRecovery"
  > {
  readonly authorityRecoverySuite: EvalGraphWriteAuthorityRecoverySuite;
}

export interface ThreeAxisAuthorityRecoveryObligation {
  readonly runId: string;
  readonly axis: EvalAxis;
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly expectedStatus: EvalGraphWriteAuthorityRecoveryStatus;
  readonly recoveryStatus?: EvalGraphWriteAuthorityRecoveryStatus;
  readonly reason?: string;
}

export interface ThreeAxisAuthorityRecoveryGate {
  readonly required: boolean;
  readonly passed: boolean;
  readonly obligationCount: number;
  readonly validObligations: number;
  readonly invalidObligations: readonly ThreeAxisAuthorityRecoveryObligation[];
}

export interface ThreeAxisProofPacket {
  readonly packetId: string;
  readonly generatedAt: Timestamp;
  readonly status: ThreeAxisProofPacketStatus;
  readonly eventCount: number;
  readonly sources: readonly ThreeAxisProofPacketSource[];
  readonly report: ThreeAxisCoverageReport;
  readonly verifiedAxes: readonly EvalAxis[];
  readonly blockedAxes: readonly EvalAxis[];
  readonly unverifiedAxes: readonly EvalAxis[];
  readonly verifiedCells: readonly ThreeAxisProofPacketCellRef[];
  readonly terminalProofBackedScenarioPassCells: readonly ThreeAxisProofPacketCellRef[];
  readonly authorityRecoveryGate: ThreeAxisAuthorityRecoveryGate;
  readonly blockedCells: readonly ThreeAxisProofPacketCellRef[];
  readonly missingCells: readonly ThreeAxisProofPacketCellRef[];
  readonly unverifiedCells: readonly ThreeAxisProofPacketCellRef[];
}

export function buildThreeAxisProofPacket(
  input: ThreeAxisProofPacketInput,
): ThreeAxisProofPacket {
  const report = analyzeThreeAxisCoverage(input.events, input.coverageOptions);
  const cells = allCells(report);
  const blockedCells = cells.filter((cell) => cell.blocked);
  const missingCells = cells.filter((cell) => !cell.covered);
  const unverifiedCells = cells.filter((cell) => !cell.verified);
  const verifiedCells = cells.filter((cell) => cell.verified);
  const terminalProofBackedScenarioPassCells = cells.filter(
    (cell) =>
      cell.scenarioPassPairs > 0 && cell.terminalProofBackedPairs > 0,
  );
  const authorityRecoveryGate = analyzeAuthorityRecoveryGate(input);
  const verifiedAxes = EVAL_AXES.filter((axis) => report.byAxis[axis].verified);
  const blockedAxes = EVAL_AXES.filter(
    (axis) => report.byAxis[axis].blockedFailureClasses.length > 0,
  );
  const unverifiedAxes = EVAL_AXES.filter((axis) => !report.byAxis[axis].verified);
  const status = report.verified && authorityRecoveryGate.passed
    ? "verified"
    : blockedCells.length > 0
      ? "blocked"
      : "unverified";

  const packet: ThreeAxisProofPacket = {
    packetId:
      input.packetId ??
      stablePacketId({
        generatedAt: input.generatedAt,
        eventRunIds: input.events.map((event) => event.runId).sort(),
        sources: input.sources,
        reportSummary: {
          coveredScenarioFamilies: report.coveredScenarioFamilies,
          verifiedScenarioFamilies: report.verifiedScenarioFamilies,
          blockedScenarioFamilies: report.blockedScenarioFamilies,
          missingScenarioFamilies: report.missingScenarioFamilies,
          unverifiedScenarioFamilies: report.unverifiedScenarioFamilies,
        },
      }),
    generatedAt: input.generatedAt,
    status,
    eventCount: input.events.length,
    sources: input.sources,
    report,
    verifiedAxes,
    blockedAxes,
    unverifiedAxes,
    verifiedCells: cellRefs(verifiedCells),
    terminalProofBackedScenarioPassCells: cellRefs(
      terminalProofBackedScenarioPassCells,
    ),
    authorityRecoveryGate,
    blockedCells: cellRefs(blockedCells),
    missingCells: cellRefs(missingCells),
    unverifiedCells: cellRefs(unverifiedCells),
  };

  return packet;
}

export function buildStrictThreeAxisProofPacket(
  input: StrictThreeAxisProofPacketInput,
): ThreeAxisProofPacket {
  const { authorityRecoverySuite, ...proofInput } = input;
  return buildThreeAxisProofPacket({
    ...proofInput,
    authorityRecoveries: authorityRecoverySuite.recoveries,
    requireAuthorityRecovery: true,
  });
}

function allCells(report: ThreeAxisCoverageReport) {
  return EVAL_AXES.flatMap((axis) =>
    FAILURE_CLASSES.map((failureClass) => report.byCell[axis][failureClass]),
  );
}

function cellRefs(
  cells: ReturnType<typeof allCells>,
): readonly ThreeAxisProofPacketCellRef[] {
  return cells.map((cell) => ({
    axis: cell.axis,
    failureClass: cell.failureClass,
    reasons: cell.reasons,
  }));
}

function stablePacketId(payload: unknown): string {
  return `three_axis_proof_${createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16)}`;
}

function analyzeAuthorityRecoveryGate(
  input: ThreeAxisProofPacketInput,
): ThreeAxisAuthorityRecoveryGate {
  const required = input.requireAuthorityRecovery === true;
  const obligations = authorityRecoveryObligations(input.events);
  const recoveries = new Map(
    (input.authorityRecoveries ?? []).map((recovery) => [
      recovery.runId,
      recovery,
    ]),
  );
  const invalidObligations = obligations.flatMap((obligation) => {
    const recovery = recoveries.get(obligation.runId);
    if (recovery === undefined) {
      return [
        {
          ...obligation,
          reason: "missing_authority_recovery",
        },
      ];
    }
    if (!recovery.valid) {
      return [
        {
          ...obligation,
          recoveryStatus: recovery.status,
          reason: "invalid_authority_recovery",
        },
      ];
    }
    if (recovery.status !== obligation.expectedStatus) {
      return [
        {
          ...obligation,
          recoveryStatus: recovery.status,
          reason: "unexpected_authority_recovery_status",
        },
      ];
    }
    return [];
  });

  return {
    required,
    passed: !required || invalidObligations.length === 0,
    obligationCount: obligations.length,
    validObligations: obligations.length - invalidObligations.length,
    invalidObligations,
  };
}

function authorityRecoveryObligations(
  events: readonly EvalEvent[],
): readonly ThreeAxisAuthorityRecoveryObligation[] {
  return events.flatMap((event) => {
    if (event.operationalTerminalOutcome === undefined) return [];
    if (
      !event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope")
    ) {
      return [];
    }
    const scenarioResult = event.scenarioResult ?? event.result;
    if (scenarioResult === "blocked") return [];

    return [
      {
        runId: event.runId,
        axis: event.axis,
        scenarioId: event.scenarioId,
        failureClass: event.failureClass,
        expectedStatus:
          event.operationalTerminalOutcome === "accepted"
            ? "accepted_authority_recovered"
            : "terminal_outcome_refused_authority",
      },
    ];
  });
}
