import type { ActionOutcomeEnvelope } from "@pm/agent-state";
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
  readonly scenarioId: string;
  readonly failureClass: string;
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
  readonly events: readonly EvalEvent[];
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  readonly metrics: EvalEventMetrics;
  readonly liveCoverage: DynamicLocalAgentLabLiveCoverageReport;
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
  readonly packetBackedEvents: number;
  readonly missingPacketEvents: number;
  readonly scaffoldedEvents: number;
  readonly covered: boolean;
}

export interface DynamicLocalAgentLabLiveCoverageReport {
  readonly requiredFailureClasses: readonly FailureClass[];
  readonly coveredFailureClasses: readonly FailureClass[];
  readonly missingFailureClasses: readonly FailureClass[];
  readonly coverageRate: number;
  readonly complete: boolean;
  readonly byFailureClass: Readonly<Record<FailureClass, DynamicLocalAgentLabFailureClassCoverage>>;
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
  const pairedRunGroup = `pair_local_agent_lab_${run.scenarioId}`;
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
      taxonomy,
      options,
    }),
    buildDynamicLocalAgentLabEvalEvent({
      run,
      armRun: run.arms.substrate,
      runArm: ARM_TO_RUN_ARM.substrate,
      failureClass,
      pairedRunGroup,
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

  return {
    events,
    actionOutcomeEnvelopes,
    metrics,
    liveCoverage,
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
      const completePacketBackedPairs = [...liveGroups.values()].filter((group) =>
        hasPacketBackedArm(group, "baseline", packetRefs) &&
        hasPacketBackedArm(group, "substrate", packetRefs),
      ).length;
      const protectivePacketBackedPairs = [...liveGroups.values()].filter((group) =>
        hasProtectivePacketBackedPair(group, packetRefs),
      ).length;
      const covered = protectivePacketBackedPairs > 0;

      return [
        failureClass,
        {
          failureClass,
          liveEvents: liveEvents.length,
          livePairedGroups: liveGroups.size,
          completePacketBackedPairs,
          protectivePacketBackedPairs,
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
    requiredFailureClasses: [...FAILURE_CLASSES],
    coveredFailureClasses,
    missingFailureClasses,
    coverageRate: coveredFailureClasses.length / FAILURE_CLASSES.length,
    complete: missingFailureClasses.length === 0,
    byFailureClass,
  };
}

function buildDynamicLocalAgentLabEvalEvent(input: {
  readonly run: DynamicLocalAgentLabScenarioRunForEval;
  readonly armRun: DynamicLocalAgentLabArmRunForEval;
  readonly runArm: RunArm;
  readonly failureClass: FailureClass;
  readonly pairedRunGroup: string;
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
    runId: `${runIdPrefix}_${input.run.scenarioId}_${input.runArm}`,
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
    ...input.taxonomy,
    evidenceStage: "live_run",
    scenarioResult: scenarioResultFor(input.armRun.result, envelope.terminalOutcome),
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
    if (event.pairedRunGroup === undefined) continue;
    const group = groups.get(event.pairedRunGroup) ?? [];
    group.push(event);
    groups.set(event.pairedRunGroup, group);
  }
  return groups;
}

function hasPacketBackedArm(
  events: readonly EvalEvent[],
  runArm: RunArm,
  packetRefs: ReadonlySet<string>,
): boolean {
  return events.some((event) => {
    if (event.runArm !== runArm) return false;
    const refs = eventActionOutcomeRefs(event);
    return refs.length > 0 &&
      refs.every((ref) => packetRefs.has(`${event.tenantId}:${ref.id}`));
  });
}

function hasProtectivePacketBackedPair(
  events: readonly EvalEvent[],
  packetRefs: ReadonlySet<string>,
): boolean {
  return events.some(
    (event) =>
      event.runArm === "baseline" &&
      eventScenarioResultFor(event) === "fail" &&
      hasEventPacketRefs(event, packetRefs),
  ) && events.some(
    (event) =>
      event.runArm === "substrate" &&
      eventScenarioResultFor(event) !== "fail" &&
      hasEventPacketRefs(event, packetRefs),
  );
}

function hasEventPacketRefs(
  event: EvalEvent,
  packetRefs: ReadonlySet<string>,
): boolean {
  const refs = eventActionOutcomeRefs(event);
  return refs.length > 0 &&
    refs.every((ref) => packetRefs.has(`${event.tenantId}:${ref.id}`));
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
): EvalResult {
  if (result === "blocked" && terminalOutcome === "blocked") return "pass";
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
    `tokens=${armRun.tokens}`,
    `admittedTransitions=${armRun.admittedTransitions}`,
    `realityQualities=${run.realityQualities.join(",")}`,
    `actedValue=${JSON.stringify(armRun.actedValue)}`,
    refused,
  ].join("; ");
}
