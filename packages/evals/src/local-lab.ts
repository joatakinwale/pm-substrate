import { createHash } from "node:crypto";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
  type ActionTerminalOutcome,
} from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";
import {
  evalEvidenceRef,
  evalEvent,
  type CoordinationClass,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
  type MastCategory,
  type MemoryBenchmarkBridge,
  type RunArm,
  type StateBenchCategory,
} from "./schema.js";
import { analyzeEvalEvents, type EvalEventMetrics } from "./metrics.js";

export interface LocalLabScenario {
  readonly scenarioId: string;
  readonly agentId: string;
  readonly failureClass: FailureClass;
  readonly stateBenchCategory: StateBenchCategory;
  readonly memoryBenchmarkBridge: MemoryBenchmarkBridge;
  readonly mastCategory: MastCategory;
  readonly coordinationClass: CoordinationClass;
  readonly source: string;
  readonly evidenceId: string;
  readonly substrateId: string;
  readonly actionOutcomeEnvelopeId?: string;
  readonly actionOutcomeTerminalOutcome?: ActionTerminalOutcome;
  readonly baselineObservation: string;
  readonly substrateObservation: string;
}

export interface LocalLabPairSummary {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly stateBenchCategory: StateBenchCategory;
  readonly memoryBenchmarkBridge: MemoryBenchmarkBridge;
  readonly mastCategory: MastCategory;
  readonly coordinationClass: CoordinationClass;
  readonly baselineResult: EvalResult;
  readonly substrateResult: EvalResult;
  readonly improvement: number;
}

export interface LocalLabPairedResult {
  readonly pairedRunGroup: string;
  readonly events: readonly [EvalEvent, EvalEvent];
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  readonly summary: LocalLabPairSummary;
}

export interface LocalLabSuiteResult {
  readonly events: readonly EvalEvent[];
  readonly summaries: readonly LocalLabPairSummary[];
  readonly metrics: EvalEventMetrics;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly allStageFailureReduction: number;
  readonly stateBenchCategories: readonly StateBenchCategory[];
}

const DEFAULT_TENANT = "tnt_local_lab" as TenantId;
const DEFAULT_OBSERVED_AT = "2026-06-02T18:00:00.000Z" as Timestamp;

export const LOCAL_LAB_SCENARIOS = [
  {
    scenarioId: "stale-memory-after-source-update",
    agentId: "local_lab_agent",
    failureClass: "memory_drift",
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "system_design",
    coordinationClass: "derived_projection",
    source: "local-lab/fixtures/stale-memory",
    evidenceId: "fixture_stale_memory_after_update",
    substrateId: "chk_authoritative_update_v2",
    actionOutcomeEnvelopeId: "outcome_local_lab_stale_memory_rebased",
    actionOutcomeTerminalOutcome: "accepted",
    baselineObservation: "Agent acted from a continuity summary that predated the authoritative source update.",
    substrateObservation: "Substrate arm rebased memory against the newer source-backed checkpoint before action.",
  },
  {
    scenarioId: "wrong-source-authority-conflict",
    agentId: "local_lab_agent",
    failureClass: "source_authority_conflict",
    stateBenchCategory: "user_experience",
    memoryBenchmarkBridge: "abstention",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    source: "local-lab/fixtures/source-authority",
    evidenceId: "fixture_conflicting_sources",
    substrateId: "event_authority_rule_binding",
    actionOutcomeEnvelopeId: "outcome_local_lab_authority_conflict_blocked",
    actionOutcomeTerminalOutcome: "blocked",
    baselineObservation: "Agent chose the newest text even though the source was not authoritative.",
    substrateObservation: "Substrate arm blocked action and abstained until the authority rule selected the binding source.",
  },
  {
    scenarioId: "invalid-workflow-step-after-plan",
    agentId: "local_lab_agent",
    failureClass: "workflow_invalidation",
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "system_design",
    coordinationClass: "authority_gated_transition",
    source: "local-lab/fixtures/workflow-invalidation",
    evidenceId: "fixture_invalidated_plan",
    substrateId: "workflow_run_rebased_current_step",
    actionOutcomeEnvelopeId: "outcome_local_lab_invalid_workflow_blocked",
    actionOutcomeTerminalOutcome: "blocked",
    baselineObservation: "Executor completed a step from an obsolete plan after workflow state changed.",
    substrateObservation: "Substrate arm checked current workflow position and rejected the invalid transition.",
  },
] as const satisfies readonly LocalLabScenario[];

export function runLocalLabPairedScenario(
  scenario: LocalLabScenario,
  input: {
    readonly tenantId?: TenantId;
    readonly observedAt?: Timestamp;
    readonly runIdPrefix?: string;
  } = {},
): LocalLabPairedResult {
  const tenantId = input.tenantId ?? DEFAULT_TENANT;
  const observedAt = input.observedAt ?? DEFAULT_OBSERVED_AT;
  const runIdPrefix = input.runIdPrefix ?? "run_local_lab";
  const pairedRunGroup = `pair_${scenario.scenarioId}`;

  const baseline = buildEvent({
    scenario,
    tenantId,
    observedAt,
    runId: `${runIdPrefix}_${scenario.scenarioId}_baseline`,
    runArm: "baseline",
    pairedRunGroup,
    result: "fail",
    observation: scenario.baselineObservation,
  });
  const substrate = buildEvent({
    scenario,
    tenantId,
    observedAt,
    runId: `${runIdPrefix}_${scenario.scenarioId}_substrate`,
    runArm: "substrate",
    pairedRunGroup,
    result: "pass",
    observation: scenario.substrateObservation,
  });
  const actionOutcomeEnvelope = buildLocalLabActionOutcomeEnvelope({
    scenario,
    tenantId,
    observedAt,
  });

  return {
    pairedRunGroup,
    events: [baseline, substrate],
    actionOutcomeEnvelopes:
      actionOutcomeEnvelope === undefined ? [] : [actionOutcomeEnvelope],
    summary: {
      scenarioId: scenario.scenarioId,
      failureClass: scenario.failureClass,
      stateBenchCategory: scenario.stateBenchCategory,
      memoryBenchmarkBridge: scenario.memoryBenchmarkBridge,
      mastCategory: scenario.mastCategory,
      coordinationClass: scenario.coordinationClass,
      baselineResult: baseline.result,
      substrateResult: substrate.result,
      improvement: score(baseline.result) - score(substrate.result),
    },
  };
}

export function runLocalLabPairedEvals(
  scenarios: readonly LocalLabScenario[] = LOCAL_LAB_SCENARIOS,
): LocalLabSuiteResult {
  const pairs = scenarios.map((scenario) => runLocalLabPairedScenario(scenario));
  const events = pairs.flatMap((pair) => pair.events);
  assertCompleteLocalLabPairs(events);
  const summaries = pairs.map((pair) => pair.summary);
  const actionOutcomeEnvelopes = pairs.flatMap(
    (pair) => pair.actionOutcomeEnvelopes,
  );
  const metrics = analyzeEvalEvents(events);

  return {
    events,
    summaries,
    metrics,
    actionOutcomeEnvelopes,
    baselineFailures: metrics.baselineFailures,
    substrateFailures: metrics.substrateFailures,
    failureReduction: metrics.failureReduction,
    allStageFailureReduction: metrics.allStageFailureReduction,
    stateBenchCategories: [...new Set(summaries.map((s) => s.stateBenchCategory))].sort(),
  };
}

export function assertCompleteLocalLabPairs(
  events: readonly EvalEvent[],
): void {
  const groups = new Map<string, Set<RunArm>>();
  for (const event of events) {
    if (event.axis !== "local_lab") continue;
    if (!event.pairedRunGroup) {
      throw new Error(`local_lab event ${event.scenarioId} missing pairedRunGroup`);
    }
    const arms = groups.get(event.pairedRunGroup) ?? new Set<RunArm>();
    if (!event.runArm) {
      throw new Error(`local_lab event ${event.scenarioId} missing runArm`);
    }
    arms.add(event.runArm);
    groups.set(event.pairedRunGroup, arms);
  }

  for (const [group, arms] of groups) {
    if (!arms.has("baseline")) throw new Error(`${group} missing baseline arm`);
    if (!arms.has("substrate")) throw new Error(`${group} missing substrate arm`);
  }
}

function buildEvent(input: {
  readonly scenario: LocalLabScenario;
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly runId: string;
  readonly runArm: RunArm;
  readonly pairedRunGroup: string;
  readonly result: EvalResult;
  readonly observation: string;
}): EvalEvent {
  const { scenario } = input;
  return evalEvent({
    tenantId: input.tenantId,
    axis: "local_lab",
    runId: input.runId,
    agentId: scenario.agentId,
    scenarioId: scenario.scenarioId,
    failureClass: scenario.failureClass,
    observedAt: input.observedAt,
    source: scenario.source,
    evidenceRefs: [evalEvidenceRef("external_fixture", scenario.evidenceId)],
    substrateRefs: [
      evalEvidenceRef("continuity_checkpoint", scenario.substrateId),
      ...(input.runArm === "substrate" && scenario.actionOutcomeEnvelopeId !== undefined
        ? [
            evalEvidenceRef(
              "action_outcome_envelope",
              scenario.actionOutcomeEnvelopeId,
              "Local lab ActionOutcomeEnvelope",
            ),
          ]
        : []),
    ],
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    stateBenchCategory: scenario.stateBenchCategory,
    memoryBenchmarkBridge: scenario.memoryBenchmarkBridge,
    mastCategory: scenario.mastCategory,
    coordinationClass: scenario.coordinationClass,
    evidenceStage: "scaffolded_scenario",
    scenarioResult: scenarioResultFor(input.result, input.runArm, scenario),
    ...(input.runArm === "substrate" && scenario.actionOutcomeTerminalOutcome !== undefined
      ? { operationalTerminalOutcome: scenario.actionOutcomeTerminalOutcome }
      : {}),
    result: input.result,
    notes: input.observation,
  });
}

function buildLocalLabActionOutcomeEnvelope(input: {
  readonly scenario: LocalLabScenario;
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
}): ActionOutcomeEnvelope | undefined {
  const envelopeId = input.scenario.actionOutcomeEnvelopeId;
  if (envelopeId === undefined) return undefined;

  const terminalOutcome =
    input.scenario.actionOutcomeTerminalOutcome ?? "blocked";
  const blockingCauses =
    terminalOutcome === "blocked"
      ? [
          {
            source: "policy" as const,
            code: input.scenario.failureClass,
            message: input.scenario.substrateObservation,
            refs: [
              stateRef("document", input.scenario.evidenceId),
              stateRef("continuity_checkpoint", input.scenario.substrateId),
            ],
          },
        ]
      : [];

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId,
    actionId: `local_lab:${input.scenario.scenarioId}:substrate`,
    subject: stateRef("document", input.scenario.scenarioId),
    proposalReviewId: `local_lab:${input.scenario.scenarioId}:proposal_review`,
    stateReviewArtifactHash: localLabArtifactHash(input.scenario),
    evidenceAdmissionReviewIds: [
      `local_lab:${input.scenario.scenarioId}:evidence_review`,
    ],
    requestedTerminalOutcome: terminalOutcome,
    decidedAt: input.observedAt,
    decidedBy: "local-lab:substrate-eval",
    evidenceRefs: [stateRef("document", input.scenario.evidenceId)],
    substrateRefs: [
      stateRef("continuity_checkpoint", input.scenario.substrateId),
      stateRef(
        "action_outcome_envelope",
        envelopeId,
        "Local lab ActionOutcomeEnvelope",
      ),
    ],
    blockingCauses,
  });
}

function localLabArtifactHash(scenario: LocalLabScenario): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        evidenceId: scenario.evidenceId,
        substrateId: scenario.substrateId,
        substrateObservation: scenario.substrateObservation,
      }),
    )
    .digest("hex");
}

function score(result: EvalResult): number {
  return result === "fail" ? 1 : 0;
}

function scenarioResultFor(
  result: EvalResult,
  runArm: RunArm,
  scenario: LocalLabScenario,
): EvalResult {
  if (
    runArm === "substrate" &&
    result === "blocked" &&
    scenario.actionOutcomeTerminalOutcome === "blocked"
  ) {
    return "pass";
  }
  return result;
}
