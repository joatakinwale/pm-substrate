import type { TenantId, Timestamp } from "@pm/types";
import {
  evalEvidenceRef,
  evalEvent,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
  type RunArm,
} from "./schema.js";

export const STATE_BENCH_CATEGORIES = [
  "stateful",
  "procedural_execution",
  "user_experience",
] as const;

export type StateBenchCategory = (typeof STATE_BENCH_CATEGORIES)[number];

export const MEMORY_BENCHMARK_BRIDGES = [
  "knowledge_update",
  "abstention",
  "workflow_rebase",
] as const;

export type MemoryBenchmarkBridge = (typeof MEMORY_BENCHMARK_BRIDGES)[number];

export type MastCategory =
  | "system_design"
  | "inter_agent_misalignment"
  | "task_verification";

export interface LocalLabScenario {
  readonly scenarioId: string;
  readonly agentId: string;
  readonly failureClass: FailureClass;
  readonly stateBenchCategory: StateBenchCategory;
  readonly memoryBenchmarkBridge: MemoryBenchmarkBridge;
  readonly mastCategory: MastCategory;
  readonly source: string;
  readonly evidenceId: string;
  readonly substrateId: string;
  readonly baselineObservation: string;
  readonly substrateObservation: string;
}

export interface LocalLabPairSummary {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly stateBenchCategory: StateBenchCategory;
  readonly memoryBenchmarkBridge: MemoryBenchmarkBridge;
  readonly baselineResult: EvalResult;
  readonly substrateResult: EvalResult;
  readonly improvement: number;
}

export interface LocalLabPairedResult {
  readonly pairedRunGroup: string;
  readonly events: readonly [EvalEvent, EvalEvent];
  readonly summary: LocalLabPairSummary;
}

export interface LocalLabSuiteResult {
  readonly events: readonly EvalEvent[];
  readonly summaries: readonly LocalLabPairSummary[];
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
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
    source: "local-lab/fixtures/stale-memory",
    evidenceId: "fixture_stale_memory_after_update",
    substrateId: "chk_authoritative_update_v2",
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
    source: "local-lab/fixtures/source-authority",
    evidenceId: "fixture_conflicting_sources",
    substrateId: "event_authority_rule_binding",
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
    source: "local-lab/fixtures/workflow-invalidation",
    evidenceId: "fixture_invalidated_plan",
    substrateId: "workflow_run_rebased_current_step",
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

  return {
    pairedRunGroup,
    events: [baseline, substrate],
    summary: {
      scenarioId: scenario.scenarioId,
      failureClass: scenario.failureClass,
      stateBenchCategory: scenario.stateBenchCategory,
      memoryBenchmarkBridge: scenario.memoryBenchmarkBridge,
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
  const baselineFailures = events.filter(
    (event) => event.runArm === "baseline" && event.result === "fail",
  ).length;
  const substrateFailures = events.filter(
    (event) => event.runArm === "substrate" && event.result === "fail",
  ).length;

  return {
    events,
    summaries,
    baselineFailures,
    substrateFailures,
    failureReduction: baselineFailures - substrateFailures,
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
    substrateRefs: [evalEvidenceRef("continuity_checkpoint", scenario.substrateId)],
    runArm: input.runArm,
    pairedRunGroup: input.pairedRunGroup,
    result: input.result,
    notes: [
      `state_bench_category=${scenario.stateBenchCategory}`,
      `memory_benchmark_bridge=${scenario.memoryBenchmarkBridge}`,
      `mast_category=${scenario.mastCategory}`,
      input.observation,
    ].join("; "),
  });
}

function score(result: EvalResult): number {
  return result === "fail" ? 1 : 0;
}
