import type { ActionOutcomeEnvelope } from "@pm/agent-state-core";
import type { Timestamp } from "@pm/types";

import { analyzeEvalEvents, type EvalEventMetrics } from "./metrics.js";
import {
  EVAL_REF_KINDS,
  FAILURE_CLASSES,
  evalEvent,
  evalEvidenceRef,
  type CoordinationClass,
  type EvalEvent,
  type EvalEvidenceRef,
  type EvalExpectedAdmission,
  type EvalRefKind,
  type EvalResult,
  type FailureClass,
  type MastCategory,
  type MemoryBenchmarkBridge,
  type RunArm,
  type StateBenchCategory,
} from "./schema.js";

export type DynamicLocalAgentLabArm = "no_substrate" | "substrate";

export interface DynamicLocalAgentLabArmRunForEval {
  readonly arm: DynamicLocalAgentLabArm;
  readonly result: EvalResult;
  readonly actedValue: unknown;
  readonly admitted: boolean;
  readonly refusedReason?: string;
  readonly tokens: number;
  readonly admittedTransitions: number;
  readonly chainValid: boolean;
  readonly actionOutcomeEnvelope?: ActionOutcomeEnvelope;
}

export interface DynamicLocalAgentLabScenarioRunForEval {
  readonly suiteRunId: string;
  readonly attemptId: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly expectedAdmission: EvalExpectedAdmission;
  readonly controlGroup: string;
  readonly realityQualities: readonly number[];
  readonly model: string;
  readonly arms: Readonly<Record<DynamicLocalAgentLabArm, DynamicLocalAgentLabArmRunForEval>>;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  readonly behaviorDiverged: boolean;
}

export interface DynamicLocalAgentLabSuiteForEval {
  readonly runs: readonly DynamicLocalAgentLabScenarioRunForEval[];
  readonly model: string;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
}

export interface DynamicLocalAgentLabTaxonomy {
  readonly stateBenchCategory?: StateBenchCategory;
  readonly memoryBenchmarkBridge?: MemoryBenchmarkBridge;
  readonly mastCategory?: MastCategory;
  readonly coordinationClass?: CoordinationClass;
}

export interface DynamicLocalAgentLabEvalOptions {
  readonly agentId?: string;
  readonly runIdPrefix?: string;
  readonly source?: string;
  readonly taxonomy?: DynamicLocalAgentLabTaxonomy;
  readonly taxonomyByFailureClass?: Partial<Record<FailureClass, DynamicLocalAgentLabTaxonomy>>;
}

export interface DynamicLocalAgentLabEvalSuite {
  /** Internal authored mechanism/conformance evidence, never efficacy proof. */
  readonly evidenceClaim: "mechanism_conformance_only";
  readonly events: readonly EvalEvent[];
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  readonly metrics: EvalEventMetrics;
  readonly liveCoverage: DynamicLocalAgentLabLiveCoverageReport;
  readonly mechanismEvidence: LocalAgentLabMechanismEvidenceSummary;
  /** Mechanism diagnostic only; null unless exact pairing and both mutants pass. */
  readonly mechanismFailureReduction: number | null;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly allStageFailureReduction: number;
}

export interface DynamicLocalAgentLabEvalStore {
  recordActionOutcomeEnvelopes(envelopes: readonly ActionOutcomeEnvelope[]): Promise<void>;
  recordMany(events: readonly EvalEvent[]): Promise<void>;
}

export interface DynamicLocalAgentLabFailureClassCoverage {
  readonly failureClass: FailureClass;
  readonly liveEvents: number;
  readonly livePairedGroups: number;
  readonly completePacketBackedPairs: number;
  readonly protectivePacketBackedPairs: number;
  readonly expectedBlockPacketBackedPairs: number;
  readonly expectedAllowPacketBackedPairs: number;
  readonly passingExpectedAllowPairs: number;
  readonly invalidPairedGroups: number;
  readonly packetBackedEvents: number;
  readonly missingPacketEvents: number;
  readonly scaffoldedEvents: number;
  readonly covered: boolean;
}

export interface DynamicLocalAgentLabLiveCoverageReport {
  readonly evidenceClaim: "mechanism_conformance_only";
  readonly requiredFailureClasses: readonly FailureClass[];
  readonly coveredFailureClasses: readonly FailureClass[];
  readonly missingFailureClasses: readonly FailureClass[];
  readonly coverageRate: number;
  readonly complete: boolean;
  /** True only when both allow-all and deny-all mutants are detected. */
  readonly mutantControlGatePassed: boolean;
  readonly byFailureClass: Readonly<Record<FailureClass, DynamicLocalAgentLabFailureClassCoverage>>;
}

export interface LocalAgentLabMechanismEvidenceSummary {
  readonly evidenceClaim: "mechanism_conformance_only";
  readonly suiteRunIds: readonly string[];
  readonly events: number;
  readonly scenarios: number;
  readonly exactPairs: number;
  readonly invalidPairedGroups: number;
  readonly expectedBlockPairs: number;
  readonly protectivePairs: number;
  readonly expectedAllowPairs: number;
  readonly passingExpectedAllowPairs: number;
  readonly baselineFailures: number;
  readonly baselinePasses: number;
  readonly substrateFailures: number;
  readonly substrateBlocked: number;
  readonly substrateAccepted: number;
  readonly allowAllMutantRejected: boolean;
  readonly blockAllMutantRejected: boolean;
  readonly mutantControlGatePassed: boolean;
  readonly exactPairIntegrityPassed: boolean;
}

const ARM_TO_RUN_ARM = {
  no_substrate: "baseline",
  substrate: "substrate",
} as const satisfies Readonly<Record<DynamicLocalAgentLabArm, RunArm>>;

const FAILURE_CLASS_SET = new Set<string>(FAILURE_CLASSES);
const EVAL_REF_KIND_SET = new Set<string>(EVAL_REF_KINDS);

const DEFAULT_TAXONOMY_BY_FAILURE_CLASS = {
  partial_observation: {
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "abstention",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
  },
  stale_observation: {
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "system_design",
    coordinationClass: "authority_gated_transition",
  },
  representation_loss: {
    stateBenchCategory: "user_experience",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "system_design",
    coordinationClass: "derived_projection",
  },
  memory_drift: {
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "system_design",
    coordinationClass: "derived_projection",
  },
  source_authority_conflict: {
    stateBenchCategory: "user_experience",
    memoryBenchmarkBridge: "abstention",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
  },
  workflow_invalidation: {
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "system_design",
    coordinationClass: "authority_gated_transition",
  },
  capability_contract_violation: {
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "abstention",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
  },
  parallel_write_conflict: {
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "inter_agent_misalignment",
    coordinationClass: "convergent_update",
  },
  feedback_disconnection: {
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "append_only_observation",
  },
  continuity_break: {
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "system_design",
    coordinationClass: "derived_projection",
  },
} as const satisfies Record<FailureClass, DynamicLocalAgentLabTaxonomy>;

export function buildDynamicLocalAgentLabEvalEvents(
  run: DynamicLocalAgentLabScenarioRunForEval,
  options: DynamicLocalAgentLabEvalOptions = {},
): readonly [EvalEvent, EvalEvent] {
  const failureClass = asFailureClass(run.failureClass);
  const suiteRunId = run.suiteRunId;
  const attemptId = run.attemptId;
  const expectedAdmission = run.expectedAdmission;
  const controlGroup = run.controlGroup;
  const pairedRunGroup =
    `pair_local_agent_lab_${controlGroup}_${expectedAdmission}_${attemptId}`;
  const taxonomy = {
    ...DEFAULT_TAXONOMY_BY_FAILURE_CLASS[failureClass],
    ...options.taxonomyByFailureClass?.[failureClass],
    ...options.taxonomy,
  };

  return [
    buildDynamicLocalAgentLabEvalEvent({
      run,
      armRun: run.arms.no_substrate,
      runArm: ARM_TO_RUN_ARM.no_substrate,
      failureClass,
      pairedRunGroup,
      suiteRunId,
      attemptId,
      expectedAdmission,
      controlGroup,
      taxonomy,
      options,
    }),
    buildDynamicLocalAgentLabEvalEvent({
      run,
      armRun: run.arms.substrate,
      runArm: ARM_TO_RUN_ARM.substrate,
      failureClass,
      pairedRunGroup,
      suiteRunId,
      attemptId,
      expectedAdmission,
      controlGroup,
      taxonomy,
      options,
    }),
  ];
}

export function buildDynamicLocalAgentLabEvalSuite(
  suite: DynamicLocalAgentLabSuiteForEval,
  options: DynamicLocalAgentLabEvalOptions = {},
): DynamicLocalAgentLabEvalSuite {
  const events = suite.runs.flatMap((run) =>
    buildDynamicLocalAgentLabEvalEvents(run, options),
  );
  const actionOutcomeEnvelopes = suite.runs.flatMap((run) =>
    requiredRunActionOutcomeEnvelopes(run),
  );
  assertEventsHaveGeneratedActionOutcomePackets(events, actionOutcomeEnvelopes);
  const metrics = analyzeEvalEvents(events);
  const liveCoverage = analyzeDynamicLocalAgentLabLiveCoverage(
    events,
    actionOutcomeEnvelopes,
  );
  const mechanismEvidence = summarizeLocalAgentLabMechanismEvidence(events);

  return {
    evidenceClaim: "mechanism_conformance_only",
    events,
    actionOutcomeEnvelopes,
    metrics,
    liveCoverage,
    mechanismEvidence,
    mechanismFailureReduction: mechanismEvidence.mutantControlGatePassed
      ? mechanismEvidence.baselineFailures - mechanismEvidence.substrateFailures
      : null,
    baselineFailures: metrics.baselineFailures,
    substrateFailures: metrics.substrateFailures,
    failureReduction: metrics.failureReduction,
    allStageFailureReduction: metrics.allStageFailureReduction,
  };
}

export async function recordDynamicLocalAgentLabEvalSuite(
  store: DynamicLocalAgentLabEvalStore,
  suite: DynamicLocalAgentLabEvalSuite,
): Promise<void> {
  await store.recordActionOutcomeEnvelopes(suite.actionOutcomeEnvelopes);
  await store.recordMany(suite.events);
}

export function assertEventsHaveGeneratedActionOutcomePackets(
  events: readonly EvalEvent[],
  packets: readonly ActionOutcomeEnvelope[],
): void {
  const packetRefs = new Set(
    packets.flatMap((packet) =>
      packet.substrateRefs
        .filter((ref) => ref.kind === "action_outcome_envelope")
        .map((ref) => `${packet.tenantId}:${ref.id}`),
    ),
  );

  for (const event of events) {
    for (const ref of event.substrateRefs) {
      if (ref.kind !== "action_outcome_envelope") continue;
      const key = `${event.tenantId}:${ref.id}`;
      if (!packetRefs.has(key)) {
        throw new Error(
          `dynamic local-agent-lab EvalEvent ${event.runId} cites ${ref.id} without a generated ActionOutcomeEnvelope packet`,
        );
      }
    }
  }
}

export function analyzeDynamicLocalAgentLabLiveCoverage(
  events: readonly EvalEvent[],
  packets: readonly ActionOutcomeEnvelope[],
): DynamicLocalAgentLabLiveCoverageReport {
  const packetRefs = new Set(
    packets.flatMap((packet) =>
      packet.substrateRefs
        .filter((ref) => ref.kind === "action_outcome_envelope")
        .map((ref) => `${packet.tenantId}:${ref.id}`),
    ),
  );
  const localEvents = events.filter((event) => event.axis === "local_lab");
  const byFailureClass = Object.fromEntries(
    FAILURE_CLASSES.map((failureClass) => {
      const classEvents = localEvents.filter(
        (event) => event.failureClass === failureClass,
      );
      const liveEvents = classEvents.filter(
        (event) => event.evidenceStage === "live_run",
      );
      const scaffoldedEvents = classEvents.filter(
        (event) => event.evidenceStage === "scaffolded_scenario",
      );
      const packetBackedEvents = liveEvents.filter((event) =>
        eventActionOutcomeRefs(event).length > 0 &&
        eventActionOutcomeRefs(event).every((ref) =>
          packetRefs.has(`${event.tenantId}:${ref.id}`),
        ),
      );
      const missingPacketEvents = liveEvents.length - packetBackedEvents.length;
      const liveGroups = groupByPairedRun(liveEvents);
      const exact = exactLocalMechanismPairs(liveGroups);
      const packetBackedPairs = exact.pairs.filter((pair) =>
        pair.events.every((event) => hasEventPacketRefs(event, packetRefs)),
      );
      const expectedBlockPacketBackedPairs = packetBackedPairs.filter(
        (pair) => pair.expectedAdmission === "block",
      ).length;
      const expectedAllowPacketBackedPairs = packetBackedPairs.filter(
        (pair) => pair.expectedAdmission === "allow",
      ).length;
      const protectivePacketBackedPairs = packetBackedPairs.filter(
        hasProtectiveMechanismPair,
      ).length;
      const passingExpectedAllowPairs = packetBackedPairs.filter(
        hasPassingExpectedAllowPair,
      ).length;
      const covered =
        expectedBlockPacketBackedPairs > 0 &&
        protectivePacketBackedPairs === expectedBlockPacketBackedPairs &&
        expectedAllowPacketBackedPairs > 0 &&
        passingExpectedAllowPairs === expectedAllowPacketBackedPairs &&
        exact.invalidPairedGroups === 0 &&
        missingPacketEvents === 0;

      return [
        failureClass,
        {
          failureClass,
          liveEvents: liveEvents.length,
          livePairedGroups: liveGroups.size,
          completePacketBackedPairs: packetBackedPairs.length,
          protectivePacketBackedPairs,
          expectedBlockPacketBackedPairs,
          expectedAllowPacketBackedPairs,
          passingExpectedAllowPairs,
          invalidPairedGroups: exact.invalidPairedGroups,
          packetBackedEvents: packetBackedEvents.length,
          missingPacketEvents,
          scaffoldedEvents: scaffoldedEvents.length,
          covered,
        },
      ];
    }),
  ) as Record<FailureClass, DynamicLocalAgentLabFailureClassCoverage>;
  const coveredFailureClasses = FAILURE_CLASSES.filter(
    (failureClass) => byFailureClass[failureClass].covered,
  );
  const missingFailureClasses = FAILURE_CLASSES.filter(
    (failureClass) => !byFailureClass[failureClass].covered,
  );

  return {
    evidenceClaim: "mechanism_conformance_only",
    requiredFailureClasses: [...FAILURE_CLASSES],
    coveredFailureClasses,
    missingFailureClasses,
    coverageRate: coveredFailureClasses.length / FAILURE_CLASSES.length,
    complete: missingFailureClasses.length === 0,
    mutantControlGatePassed: missingFailureClasses.length === 0,
    byFailureClass,
  };
}

function buildDynamicLocalAgentLabEvalEvent(input: {
  readonly run: DynamicLocalAgentLabScenarioRunForEval;
  readonly armRun: DynamicLocalAgentLabArmRunForEval;
  readonly runArm: RunArm;
  readonly failureClass: FailureClass;
  readonly pairedRunGroup: string;
  readonly suiteRunId: string;
  readonly attemptId: string;
  readonly expectedAdmission: EvalExpectedAdmission;
  readonly controlGroup: string;
  readonly taxonomy: DynamicLocalAgentLabTaxonomy;
  readonly options: DynamicLocalAgentLabEvalOptions;
}): EvalEvent {
  const envelope = input.armRun.actionOutcomeEnvelope;
  if (envelope === undefined) {
    throw new Error(
      `dynamic local-agent-lab ${input.run.scenarioId}/${input.armRun.arm} missing ActionOutcomeEnvelope`,
    );
  }

  const actionOutcomeRefs = envelope.substrateRefs.filter(
    (ref) => ref.kind === "action_outcome_envelope",
  );
  if (actionOutcomeRefs.length === 0) {
    throw new Error(
      `dynamic local-agent-lab ${input.run.scenarioId}/${input.armRun.arm} envelope has no action_outcome_envelope ref`,
    );
  }

  const runIdPrefix = input.options.runIdPrefix ?? "run_local_agent_lab_live";
  return evalEvent({
    tenantId: envelope.tenantId,
    axis: "local_lab",
    runId:
      `${runIdPrefix}_${input.run.scenarioId}_${input.attemptId}_${input.runArm}`,
    agentId: input.options.agentId ?? `local-agent-lab:${input.run.model}`,
    scenarioId: input.run.scenarioId,
    failureClass: input.failureClass,
    observedAt: envelope.decidedAt as Timestamp,
    source:
      input.options.source ??
      `local-agent-lab/${input.run.model}/${input.run.scenarioId}`,
    evidenceRefs: toEvalRefs(envelope.evidenceRefs),
    substrateRefs: toEvalRefs(envelope.substrateRefs),
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    suiteRunId: input.suiteRunId,
    attemptId: input.attemptId,
    expectedAdmission: input.expectedAdmission,
    controlGroup: input.controlGroup,
    ...input.taxonomy,
    evidenceStage: "live_run",
    scenarioResult: scenarioResultFor(
      input.armRun.result,
      envelope.terminalOutcome,
      input.expectedAdmission,
    ),
    operationalTerminalOutcome: envelope.terminalOutcome,
    result: input.armRun.result,
    notes: liveRunNotes(input.run, input.armRun, envelope),
  });
}

function requiredRunActionOutcomeEnvelopes(
  run: DynamicLocalAgentLabScenarioRunForEval,
): readonly ActionOutcomeEnvelope[] {
  return [
    requiredArmEnvelope(run, "no_substrate"),
    requiredArmEnvelope(run, "substrate"),
  ];
}

function requiredArmEnvelope(
  run: DynamicLocalAgentLabScenarioRunForEval,
  arm: DynamicLocalAgentLabArm,
): ActionOutcomeEnvelope {
  const envelope = run.arms[arm].actionOutcomeEnvelope;
  if (envelope === undefined) {
    throw new Error(
      `dynamic local-agent-lab ${run.scenarioId}/${arm} missing ActionOutcomeEnvelope`,
    );
  }
  return envelope;
}

function toEvalRefs(
  refs: readonly { readonly kind: string; readonly id: string; readonly label?: string }[],
): readonly EvalEvidenceRef[] {
  return refs.map((ref) => {
    if (!EVAL_REF_KIND_SET.has(ref.kind)) {
      throw new Error(`unsupported dynamic local-agent-lab ref kind ${ref.kind}`);
    }
    return evalEvidenceRef(
      ref.kind as EvalRefKind,
      ref.id,
      ref.label,
    );
  });
}

function eventActionOutcomeRefs(event: EvalEvent): readonly EvalEvidenceRef[] {
  return event.substrateRefs.filter((ref) => ref.kind === "action_outcome_envelope");
}

function groupByPairedRun(events: readonly EvalEvent[]): Map<string, readonly EvalEvent[]> {
  const groups = new Map<string, EvalEvent[]>();
  for (const event of events) {
    const groupId =
      event.pairedRunGroup ?? `__missing_pair__:${event.runId}`;
    const group = groups.get(groupId) ?? [];
    group.push(event);
    groups.set(groupId, group);
  }
  return groups;
}

interface ExactLocalMechanismPair {
  readonly events: readonly [EvalEvent, EvalEvent];
  readonly baseline: EvalEvent;
  readonly substrate: EvalEvent;
  readonly suiteRunId: string;
  readonly attemptId: string;
  readonly expectedAdmission: EvalExpectedAdmission;
  readonly controlGroup: string;
}

function exactLocalMechanismPairs(
  groups: ReadonlyMap<string, readonly EvalEvent[]>,
): {
  readonly pairs: readonly ExactLocalMechanismPair[];
  readonly invalidPairedGroups: number;
} {
  const candidates: ExactLocalMechanismPair[] = [];
  for (const group of groups.values()) {
    if (group.length !== 2) continue;
    const baselineEvents = group.filter((event) => event.runArm === "baseline");
    const substrateEvents = group.filter((event) => event.runArm === "substrate");
    if (baselineEvents.length !== 1 || substrateEvents.length !== 1) continue;
    const baseline = baselineEvents[0]!;
    const substrate = substrateEvents[0]!;
    if (baseline.runId === substrate.runId) continue;

    const suiteRunId = commonNonEmptyString(baseline.suiteRunId, substrate.suiteRunId);
    const attemptId = commonNonEmptyString(baseline.attemptId, substrate.attemptId);
    const controlGroup = commonNonEmptyString(
      baseline.controlGroup,
      substrate.controlGroup,
    );
    if (
      suiteRunId === undefined ||
      attemptId === undefined ||
      controlGroup === undefined ||
      baseline.expectedAdmission === undefined ||
      baseline.expectedAdmission !== substrate.expectedAdmission ||
      baseline.scenarioId !== substrate.scenarioId ||
      baseline.failureClass !== substrate.failureClass
    ) {
      continue;
    }

    candidates.push({
      events: [baseline, substrate],
      baseline,
      substrate,
      suiteRunId,
      attemptId,
      expectedAdmission: baseline.expectedAdmission,
      controlGroup,
    });
  }

  const occurrenceByAttempt = new Map<string, number>();
  for (const pair of candidates) {
    const key = `${pair.suiteRunId}:${pair.attemptId}`;
    occurrenceByAttempt.set(key, (occurrenceByAttempt.get(key) ?? 0) + 1);
  }
  const pairs = candidates.filter(
    (pair) =>
      occurrenceByAttempt.get(`${pair.suiteRunId}:${pair.attemptId}`) === 1,
  );
  return {
    pairs,
    invalidPairedGroups: groups.size - pairs.length,
  };
}

function commonNonEmptyString(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (left === undefined || left.length === 0 || left !== right) return undefined;
  return left;
}

function hasProtectiveMechanismPair(pair: ExactLocalMechanismPair): boolean {
  return pair.expectedAdmission === "block" &&
    eventScenarioResultFor(pair.baseline) === "fail" &&
    pair.baseline.operationalTerminalOutcome === "accepted" &&
    eventScenarioResultFor(pair.substrate) === "pass" &&
    pair.substrate.operationalTerminalOutcome === "blocked";
}

function hasPassingExpectedAllowPair(pair: ExactLocalMechanismPair): boolean {
  return pair.expectedAdmission === "allow" &&
    eventScenarioResultFor(pair.baseline) === "pass" &&
    pair.baseline.operationalTerminalOutcome === "accepted" &&
    eventScenarioResultFor(pair.substrate) === "pass" &&
    pair.substrate.operationalTerminalOutcome === "accepted";
}

function hasEventPacketRefs(
  event: EvalEvent,
  packetRefs: ReadonlySet<string>,
): boolean {
  const refs = eventActionOutcomeRefs(event);
  return refs.length > 0 &&
    refs.every((ref) => packetRefs.has(`${event.tenantId}:${ref.id}`));
}

/**
 * Fold one persisted live suite without using aggregate event counts as if
 * they were paired attempts. Only exact, uniquely identified two-arm pairs
 * with terminal-packet references contribute to the result.
 */
export function summarizeLocalAgentLabMechanismEvidence(
  events: readonly EvalEvent[],
): LocalAgentLabMechanismEvidenceSummary {
  const liveEvents = events.filter(
    (event) =>
      event.axis === "local_lab" && event.evidenceStage === "live_run",
  );
  const exact = exactLocalMechanismPairs(groupByPairedRun(liveEvents));
  const packetReferencedPairs = exact.pairs.filter((pair) =>
    pair.events.every((event) => eventActionOutcomeRefs(event).length > 0),
  );
  const expectedBlockPairs = packetReferencedPairs.filter(
    (pair) => pair.expectedAdmission === "block",
  );
  const expectedAllowPairs = packetReferencedPairs.filter(
    (pair) => pair.expectedAdmission === "allow",
  );
  const protectivePairs = expectedBlockPairs.filter(
    hasProtectiveMechanismPair,
  );
  const passingExpectedAllowPairs = expectedAllowPairs.filter(
    hasPassingExpectedAllowPair,
  );
  const suiteRunIds = [...new Set(
    liveEvents
      .map((event) => event.suiteRunId)
      .filter((value): value is string => value !== undefined),
  )].sort();
  const exactPairIntegrityPassed =
    liveEvents.length > 0 &&
    suiteRunIds.length === 1 &&
    exact.invalidPairedGroups === 0 &&
    packetReferencedPairs.length === exact.pairs.length;
  const allowAllMutantRejected =
    expectedBlockPairs.length > 0 &&
    protectivePairs.length === expectedBlockPairs.length;
  const blockAllMutantRejected =
    expectedAllowPairs.length > 0 &&
    passingExpectedAllowPairs.length === expectedAllowPairs.length;

  return {
    evidenceClaim: "mechanism_conformance_only",
    suiteRunIds,
    events: liveEvents.length,
    scenarios: new Set(packetReferencedPairs.map((pair) => pair.baseline.scenarioId))
      .size,
    exactPairs: packetReferencedPairs.length,
    invalidPairedGroups: exact.invalidPairedGroups,
    expectedBlockPairs: expectedBlockPairs.length,
    protectivePairs: protectivePairs.length,
    expectedAllowPairs: expectedAllowPairs.length,
    passingExpectedAllowPairs: passingExpectedAllowPairs.length,
    baselineFailures: packetReferencedPairs.filter(
      (pair) => eventScenarioResultFor(pair.baseline) === "fail",
    ).length,
    baselinePasses: packetReferencedPairs.filter(
      (pair) => eventScenarioResultFor(pair.baseline) === "pass",
    ).length,
    substrateFailures: packetReferencedPairs.filter(
      (pair) => eventScenarioResultFor(pair.substrate) === "fail",
    ).length,
    substrateBlocked: packetReferencedPairs.filter(
      (pair) => pair.substrate.operationalTerminalOutcome === "blocked",
    ).length,
    substrateAccepted: packetReferencedPairs.filter(
      (pair) => pair.substrate.operationalTerminalOutcome === "accepted",
    ).length,
    allowAllMutantRejected,
    blockAllMutantRejected,
    mutantControlGatePassed:
      exactPairIntegrityPassed &&
      allowAllMutantRejected &&
      blockAllMutantRejected,
    exactPairIntegrityPassed,
  };
}

function asFailureClass(value: string): FailureClass {
  if (!FAILURE_CLASS_SET.has(value)) {
    throw new Error(`unsupported dynamic local-agent-lab failure class ${value}`);
  }
  return value as FailureClass;
}

function scenarioResultFor(
  result: EvalResult,
  terminalOutcome: ActionOutcomeEnvelope["terminalOutcome"],
  expectedAdmission: EvalExpectedAdmission,
): EvalResult {
  if (result === "blocked" && terminalOutcome === "blocked") {
    return expectedAdmission === "block" ? "pass" : "fail";
  }
  return result;
}

function eventScenarioResultFor(event: EvalEvent): EvalResult {
  return event.scenarioResult ?? event.result;
}

function liveRunNotes(
  run: DynamicLocalAgentLabScenarioRunForEval,
  armRun: DynamicLocalAgentLabArmRunForEval,
  envelope: ActionOutcomeEnvelope,
): string {
  const refused = armRun.refusedReason === undefined
    ? ""
    : ` refusedReason=${armRun.refusedReason}`;
  return [
    `Dynamic local-agent-lab ${armRun.arm} run produced result=${armRun.result}`,
    `terminalOutcome=${envelope.terminalOutcome}`,
    `admitted=${armRun.admitted}`,
    `chainValid=${armRun.chainValid}`,
    `behaviorDiverged=${run.behaviorDiverged}`,
    `evidenceClaim=mechanism_conformance_only`,
    `suiteRunId=${run.suiteRunId}`,
    `attemptId=${run.attemptId}`,
    `expectedAdmission=${run.expectedAdmission}`,
    `controlGroup=${run.controlGroup}`,
    `tokens=${armRun.tokens}`,
    `admittedTransitions=${armRun.admittedTransitions}`,
    `realityQualities=${run.realityQualities.join(",")}`,
    `actedValue=${JSON.stringify(armRun.actedValue)}`,
    refused,
  ].join("; ");
}
