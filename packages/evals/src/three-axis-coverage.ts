import {
  EVAL_AXES,
  FAILURE_CLASSES,
  type EvalAxis,
  type EvalEvent,
  type EvalEvidenceStage,
  type EvalResult,
  type FailureClass,
  type RunArm,
} from "./schema.js";

export type ThreeAxisCoverageReason =
  | "no_events"
  | "only_scaffolded_events"
  | "blocked_without_refs"
  | "missing_complete_pair"
  | "missing_evidence_or_substrate_refs"
  | "missing_terminal_proof_refs"
  | "no_protective_pair"
  | "no_scenario_pass_pair";

export interface ThreeAxisCoverageOptions {
  readonly eligibleEvidenceStages?: readonly EvalEvidenceStage[];
  readonly requireActionOutcomeEnvelopeRefsForVerified?: boolean;
}

export interface ThreeAxisCoverageCell {
  readonly axis: EvalAxis;
  readonly failureClass: FailureClass;
  readonly events: number;
  readonly eligibleEvents: number;
  readonly scaffoldedEvents: number;
  readonly pairedGroups: number;
  readonly completePairedGroups: number;
  readonly protectivePairs: number;
  readonly scenarioPassPairs: number;
  readonly terminalProofBackedPairs: number;
  readonly verifiedPairs: number;
  readonly blockedEvents: number;
  readonly blockedWithoutRefs: number;
  readonly eventsMissingRefs: number;
  readonly covered: boolean;
  readonly verified: boolean;
  readonly blocked: boolean;
  readonly reasons: readonly ThreeAxisCoverageReason[];
}

export interface ThreeAxisAxisCoverage {
  readonly axis: EvalAxis;
  readonly coveredFailureClasses: readonly FailureClass[];
  readonly verifiedFailureClasses: readonly FailureClass[];
  readonly missingFailureClasses: readonly FailureClass[];
  readonly unverifiedFailureClasses: readonly FailureClass[];
  readonly blockedFailureClasses: readonly FailureClass[];
  readonly coverageRate: number;
  readonly verifiedRate: number;
  readonly complete: boolean;
  readonly verified: boolean;
}

export interface ThreeAxisCoverageReport {
  readonly requiredAxes: readonly EvalAxis[];
  readonly requiredFailureClasses: readonly FailureClass[];
  readonly requiredScenarioFamilies: number;
  readonly coveredScenarioFamilies: number;
  readonly verifiedScenarioFamilies: number;
  readonly blockedScenarioFamilies: number;
  readonly missingScenarioFamilies: number;
  readonly unverifiedScenarioFamilies: number;
  readonly coverageRate: number;
  readonly verifiedRate: number;
  readonly complete: boolean;
  readonly verified: boolean;
  readonly byAxis: Readonly<Record<EvalAxis, ThreeAxisAxisCoverage>>;
  readonly byCell: Readonly<Record<EvalAxis, Readonly<Record<FailureClass, ThreeAxisCoverageCell>>>>;
}

const DEFAULT_ELIGIBLE_EVIDENCE_STAGES = [
  "detected_warning",
  "blocked_mutation",
  "paired_behavioral_improvement",
  "live_run",
] as const satisfies readonly EvalEvidenceStage[];

export function analyzeThreeAxisCoverage(
  events: readonly EvalEvent[],
  options: ThreeAxisCoverageOptions = {},
): ThreeAxisCoverageReport {
  const eligibleStages = new Set(
    options.eligibleEvidenceStages ?? DEFAULT_ELIGIBLE_EVIDENCE_STAGES,
  );
  const requireTerminalProof =
    options.requireActionOutcomeEnvelopeRefsForVerified ?? true;

  const byCell = Object.fromEntries(
    EVAL_AXES.map((axis) => [
      axis,
      Object.fromEntries(
        FAILURE_CLASSES.map((failureClass) => [
          failureClass,
          analyzeCoverageCell({
            events,
            axis,
            failureClass,
            eligibleStages,
            requireTerminalProof,
          }),
        ]),
      ),
    ]),
  ) as Record<EvalAxis, Record<FailureClass, ThreeAxisCoverageCell>>;

  const byAxis = Object.fromEntries(
    EVAL_AXES.map((axis) => {
      const cells = FAILURE_CLASSES.map((failureClass) => byCell[axis][failureClass]);
      const coveredFailureClasses = cells
        .filter((cell) => cell.covered)
        .map((cell) => cell.failureClass);
      const verifiedFailureClasses = cells
        .filter((cell) => cell.verified)
        .map((cell) => cell.failureClass);
      const missingFailureClasses = cells
        .filter((cell) => !cell.covered)
        .map((cell) => cell.failureClass);
      const unverifiedFailureClasses = cells
        .filter((cell) => !cell.verified)
        .map((cell) => cell.failureClass);
      const blockedFailureClasses = cells
        .filter((cell) => cell.blocked)
        .map((cell) => cell.failureClass);
      const summary: ThreeAxisAxisCoverage = {
        axis,
        coveredFailureClasses,
        verifiedFailureClasses,
        missingFailureClasses,
        unverifiedFailureClasses,
        blockedFailureClasses,
        coverageRate: coveredFailureClasses.length / FAILURE_CLASSES.length,
        verifiedRate: verifiedFailureClasses.length / FAILURE_CLASSES.length,
        complete:
          coveredFailureClasses.length === FAILURE_CLASSES.length &&
          blockedFailureClasses.length === 0,
        verified:
          verifiedFailureClasses.length === FAILURE_CLASSES.length &&
          blockedFailureClasses.length === 0,
      };
      return [axis, summary];
    }),
  ) as Record<EvalAxis, ThreeAxisAxisCoverage>;

  const requiredScenarioFamilies = EVAL_AXES.length * FAILURE_CLASSES.length;
  const cells = EVAL_AXES.flatMap((axis) =>
    FAILURE_CLASSES.map((failureClass) => byCell[axis][failureClass]),
  );
  const coveredScenarioFamilies = cells.filter((cell) => cell.covered).length;
  const verifiedScenarioFamilies = cells.filter((cell) => cell.verified).length;
  const blockedScenarioFamilies = cells.filter((cell) => cell.blocked).length;
  const missingScenarioFamilies = cells.filter((cell) => !cell.covered).length;
  const unverifiedScenarioFamilies = cells.filter((cell) => !cell.verified).length;

  return {
    requiredAxes: [...EVAL_AXES],
    requiredFailureClasses: [...FAILURE_CLASSES],
    requiredScenarioFamilies,
    coveredScenarioFamilies,
    verifiedScenarioFamilies,
    blockedScenarioFamilies,
    missingScenarioFamilies,
    unverifiedScenarioFamilies,
    coverageRate: coveredScenarioFamilies / requiredScenarioFamilies,
    verifiedRate: verifiedScenarioFamilies / requiredScenarioFamilies,
    complete:
      coveredScenarioFamilies === requiredScenarioFamilies &&
      blockedScenarioFamilies === 0,
    verified:
      verifiedScenarioFamilies === requiredScenarioFamilies &&
      blockedScenarioFamilies === 0,
    byAxis,
    byCell,
  };
}

function analyzeCoverageCell(input: {
  readonly events: readonly EvalEvent[];
  readonly axis: EvalAxis;
  readonly failureClass: FailureClass;
  readonly eligibleStages: ReadonlySet<EvalEvidenceStage>;
  readonly requireTerminalProof: boolean;
}): ThreeAxisCoverageCell {
  const classEvents = input.events.filter(
    (event) =>
      event.axis === input.axis && event.failureClass === input.failureClass,
  );
  const eligibleEvents = classEvents.filter((event) =>
    event.evidenceStage === undefined ||
    input.eligibleStages.has(event.evidenceStage),
  );
  const scaffoldedEvents = classEvents.filter(
    (event) => event.evidenceStage === "scaffolded_scenario",
  );
  const groups = groupByPairedRun(eligibleEvents);
  const completeGroups = [...groups.values()].filter(hasBothArms);
  const protectivePairs = completeGroups.filter(hasProtectivePair).length;
  const scenarioPassPairs = completeGroups.filter(hasScenarioPassPair).length;
  const terminalProofBackedPairs = completeGroups.filter(hasTerminalProofPair).length;
  const verifiedPairs = completeGroups.filter((group) =>
    hasScenarioPassPair(group) &&
    (!input.requireTerminalProof || hasTerminalProofPair(group)),
  ).length;
  const blockedEvents = classEvents.filter(
    (event) => scenarioResultFor(event) === "blocked",
  );
  const blockedWithoutRefs = blockedEvents.filter((event) => !hasRefs(event));
  const eventsMissingRefs = eligibleEvents.filter((event) => !hasRefs(event));
  const covered = protectivePairs > 0;
  const verified = verifiedPairs > 0;
  const blocked = blockedWithoutRefs.length > 0;

  return {
    axis: input.axis,
    failureClass: input.failureClass,
    events: classEvents.length,
    eligibleEvents: eligibleEvents.length,
    scaffoldedEvents: scaffoldedEvents.length,
    pairedGroups: groups.size,
    completePairedGroups: completeGroups.length,
    protectivePairs,
    scenarioPassPairs,
    terminalProofBackedPairs,
    verifiedPairs,
    blockedEvents: blockedEvents.length,
    blockedWithoutRefs: blockedWithoutRefs.length,
    eventsMissingRefs: eventsMissingRefs.length,
    covered,
    verified,
    blocked,
    reasons: coverageReasons({
      classEvents,
      eligibleEvents,
      scaffoldedEvents,
      completeGroups,
      protectivePairs,
      scenarioPassPairs,
      terminalProofBackedPairs,
      verifiedPairs,
      blockedWithoutRefs,
      eventsMissingRefs,
      requireTerminalProof: input.requireTerminalProof,
    }),
  };
}

function coverageReasons(input: {
  readonly classEvents: readonly EvalEvent[];
  readonly eligibleEvents: readonly EvalEvent[];
  readonly scaffoldedEvents: readonly EvalEvent[];
  readonly completeGroups: readonly (readonly EvalEvent[])[];
  readonly protectivePairs: number;
  readonly scenarioPassPairs: number;
  readonly terminalProofBackedPairs: number;
  readonly verifiedPairs: number;
  readonly blockedWithoutRefs: readonly EvalEvent[];
  readonly eventsMissingRefs: readonly EvalEvent[];
  readonly requireTerminalProof: boolean;
}): readonly ThreeAxisCoverageReason[] {
  const reasons = new Set<ThreeAxisCoverageReason>();
  if (input.classEvents.length === 0) reasons.add("no_events");
  if (
    input.classEvents.length > 0 &&
    input.eligibleEvents.length === 0 &&
    input.scaffoldedEvents.length > 0
  ) {
    reasons.add("only_scaffolded_events");
  }
  if (input.blockedWithoutRefs.length > 0) reasons.add("blocked_without_refs");
  if (input.eligibleEvents.length > 0 && input.completeGroups.length === 0) {
    reasons.add("missing_complete_pair");
  }
  if (input.eventsMissingRefs.length > 0) {
    reasons.add("missing_evidence_or_substrate_refs");
  }
  if (input.protectivePairs === 0) reasons.add("no_protective_pair");
  if (input.scenarioPassPairs === 0) reasons.add("no_scenario_pass_pair");
  if (
    input.requireTerminalProof &&
    input.scenarioPassPairs > 0 &&
    input.terminalProofBackedPairs === 0
  ) {
    reasons.add("missing_terminal_proof_refs");
  }
  if (
    input.requireTerminalProof &&
    input.scenarioPassPairs > 0 &&
    input.verifiedPairs === 0
  ) {
    reasons.add("missing_terminal_proof_refs");
  }
  return [...reasons];
}

function groupByPairedRun(events: readonly EvalEvent[]): Map<string, readonly EvalEvent[]> {
  const groups = new Map<string, EvalEvent[]>();
  for (const event of events) {
    if (event.pairedRunGroup === undefined) continue;
    const group = groups.get(event.pairedRunGroup) ?? [];
    group.push(event);
    groups.set(event.pairedRunGroup, group);
  }
  return groups;
}

function hasBothArms(events: readonly EvalEvent[]): boolean {
  return hasArm(events, "baseline") && hasArm(events, "substrate");
}

function hasArm(events: readonly EvalEvent[], arm: RunArm): boolean {
  return events.some((event) => event.runArm === arm);
}

function hasProtectivePair(events: readonly EvalEvent[]): boolean {
  return events.some(
    (event) =>
      event.runArm === "baseline" &&
      scenarioResultFor(event) === "fail" &&
      hasRefs(event),
  ) && events.some(
    (event) =>
      event.runArm === "substrate" &&
      scenarioResultFor(event) !== "fail" &&
      hasRefs(event),
  );
}

function hasScenarioPassPair(events: readonly EvalEvent[]): boolean {
  return events.some(
    (event) =>
      event.runArm === "baseline" &&
      scenarioResultFor(event) === "fail" &&
      hasRefs(event),
  ) && events.some(
    (event) =>
      event.runArm === "substrate" &&
      scenarioResultFor(event) === "pass" &&
      hasRefs(event),
  );
}

function hasTerminalProofPair(events: readonly EvalEvent[]): boolean {
  return hasTerminalProofArm(events, "baseline") &&
    hasTerminalProofArm(events, "substrate");
}

function hasTerminalProofArm(
  events: readonly EvalEvent[],
  arm: RunArm,
): boolean {
  return events.some(
    (event) =>
      event.runArm === arm &&
      hasRefs(event) &&
      event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope"),
  );
}

function hasRefs(event: EvalEvent): boolean {
  return event.evidenceRefs.length > 0 && event.substrateRefs.length > 0;
}

function scenarioResultFor(event: EvalEvent): EvalResult {
  return event.scenarioResult ?? event.result;
}
