import type { TenantId, Timestamp } from "@pm/types";
import {
  evalEvent,
  evalEvidenceRef,
  type CoordinationClass,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
} from "./schema.js";
import type { AdapterOperationalSample } from "./metrics.js";

export interface ArrowHedgeStateEvalInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly source: string;
  readonly sourceRecordIds: readonly string[];
  readonly substrateRefs: {
    readonly graphNodeIds: readonly string[];
    readonly eventIds: readonly string[];
    readonly projectionIds: readonly string[];
  };
  readonly readSetValidation?: {
    readonly currentStateViewId: string;
    readonly mode: "warn";
    readonly issueCodes: readonly string[];
  };
  readonly operationalSamples: readonly AdapterOperationalSample[];
  readonly runIdPrefix?: string;
  readonly agentId?: string;
}

export interface ArrowHedgeScenarioSummary {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly coordinationClass: CoordinationClass;
  readonly baselineResult: EvalResult;
  readonly substrateResult: EvalResult;
  readonly improvement: number;
}

export interface ArrowHedgeStateEvalSuite {
  readonly events: readonly EvalEvent[];
  readonly summaries: readonly ArrowHedgeScenarioSummary[];
  readonly operationalSamples: readonly AdapterOperationalSample[];
}

interface ScenarioSpec {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly coordinationClass: CoordinationClass;
  readonly substrateResult: EvalResult;
  readonly requiredReadSetWarningCodes?: readonly string[];
  readonly baselineNotes: string;
  readonly substrateNotes: string;
}

const SCENARIOS: readonly ScenarioSpec[] = [
  {
    scenarioId: "arrowhedge-representation-loss",
    failureClass: "representation_loss",
    coordinationClass: "derived_projection",
    substrateResult: "pass",
    baselineNotes:
      "Source-only finance rows lose the graph/event/projection links needed to reconstruct risk-gated state.",
    substrateNotes:
      "Adapter emits graph nodes, typed events, and COP projection state for the same source records.",
  },
  {
    scenarioId: "arrowhedge-source-authority-conflict",
    failureClass: "source_authority_conflict",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    baselineNotes:
      "Baseline agent can choose a newer non-binding quote over the backtest-authoritative risk snapshot.",
    substrateNotes:
      "Substrate event authority preserves the binding ArrowHedge snapshot for risk-gated decisions.",
  },
  {
    scenarioId: "arrowhedge-stale-observation",
    failureClass: "stale_observation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    baselineNotes:
      "Baseline decision proceeds even though the risk observation freshness window expired.",
    substrateNotes:
      "Substrate arm blocks stale-state workflow progress until a current risk event exists.",
  },
  {
    scenarioId: "arrowhedge-distribution-currentness-mismatch",
    failureClass: "stale_observation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    requiredReadSetWarningCodes: ["stale_read_ref"],
    baselineNotes:
      "Baseline prompt/RAG action proceeds from stale or incomplete distribution-currentness context.",
    substrateNotes:
      "Substrate arm supplies current_state_view and emits warn-first read-set validation before action; v1 does not claim mutation blocking.",
  },
  {
    scenarioId: "arrowhedge-workflow-invalidation",
    failureClass: "workflow_invalidation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    baselineNotes:
      "Baseline executor continues from an obsolete research workflow position after the risk gate changed.",
    substrateNotes:
      "Substrate arm checks current workflow/risk state before accepting the portfolio decision.",
  },
  {
    scenarioId: "arrowhedge-capability-contract-violation",
    failureClass: "capability_contract_violation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    baselineNotes:
      "Baseline payload can omit required finance capability fields without a typed rejection surface.",
    substrateNotes:
      "Substrate runtime payload validation rejects malformed typed finance events before publication.",
  },
];

export function buildArrowHedgeStateEvalSuite(
  input: ArrowHedgeStateEvalInput,
): ArrowHedgeStateEvalSuite {
  const runIdPrefix = input.runIdPrefix ?? "run_arrowhedge_axis_a";
  const agentId = input.agentId ?? "arrowhedge_axis_a_agent";
  const substrateRefs = [
    ...input.substrateRefs.graphNodeIds.map((id) => evalEvidenceRef("graph_node", id)),
    ...input.substrateRefs.eventIds.map((id) => evalEvidenceRef("event", id)),
    ...input.substrateRefs.projectionIds.map((id) =>
      evalEvidenceRef("projection", id, "ArrowHedge Common Operating Picture"),
    ),
    ...(input.readSetValidation
      ? [
          evalEvidenceRef(
            "projection",
            input.readSetValidation.currentStateViewId,
            "ArrowHedge CurrentStateView",
          ),
        ]
      : []),
  ];
  const evidenceRefs = input.sourceRecordIds.map((id) =>
    evalEvidenceRef("source_record", id),
  );

  const pairs = SCENARIOS.map((scenario) => {
    const pairedRunGroup = `pair_${scenario.scenarioId}`;
    const baseline = evalEvent({
      tenantId: input.tenantId,
      axis: "finance",
      runId: `${runIdPrefix}_${scenario.scenarioId}_baseline`,
      agentId,
      scenarioId: scenario.scenarioId,
      failureClass: scenario.failureClass,
      observedAt: input.observedAt,
      source: input.source,
      evidenceRefs,
      substrateRefs: [evalEvidenceRef("document", `${scenario.scenarioId}:baseline`)],
      runArm: "baseline",
      pairedRunGroup,
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge:
        scenario.failureClass === "workflow_invalidation"
          ? "workflow_rebase"
          : "knowledge_update",
      mastCategory:
        scenario.failureClass === "capability_contract_violation"
          ? "task_verification"
          : "system_design",
      coordinationClass: scenario.coordinationClass,
      result: "fail",
      notes: scenario.baselineNotes,
    });
    const substrateResult = substrateResultForScenario(scenario, input);
    const substrate = evalEvent({
      tenantId: input.tenantId,
      axis: "finance",
      runId: `${runIdPrefix}_${scenario.scenarioId}_substrate`,
      agentId,
      scenarioId: scenario.scenarioId,
      failureClass: scenario.failureClass,
      observedAt: input.observedAt,
      source: input.source,
      evidenceRefs,
      substrateRefs,
      runArm: "substrate",
      pairedRunGroup,
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge:
        scenario.failureClass === "workflow_invalidation"
          ? "workflow_rebase"
          : "knowledge_update",
      mastCategory:
        scenario.failureClass === "capability_contract_violation"
          ? "task_verification"
          : "system_design",
      coordinationClass: scenario.coordinationClass,
      result: substrateResult,
      notes: substrateNotesForScenario(scenario, input),
    });
    return {
      events: [baseline, substrate] as const,
      summary: {
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        coordinationClass: scenario.coordinationClass,
        baselineResult: baseline.result,
        substrateResult,
        improvement: score(baseline.result) - score(substrate.result),
      } satisfies ArrowHedgeScenarioSummary,
    };
  });

  return {
    events: pairs.flatMap((pair) => pair.events),
    summaries: pairs.map((pair) => pair.summary),
    operationalSamples: input.operationalSamples,
  };
}

function score(result: EvalResult): number {
  return result === "fail" ? 1 : 0;
}

function substrateResultForScenario(
  scenario: ScenarioSpec,
  input: ArrowHedgeStateEvalInput,
): EvalResult {
  if (!scenario.requiredReadSetWarningCodes) return scenario.substrateResult;
  const validation = input.readSetValidation;
  if (!validation || validation.mode !== "warn") return "fail";
  const issueCodes = new Set(validation.issueCodes);
  return scenario.requiredReadSetWarningCodes.every((code) => issueCodes.has(code))
    ? scenario.substrateResult
    : "fail";
}

function substrateNotesForScenario(
  scenario: ScenarioSpec,
  input: ArrowHedgeStateEvalInput,
): string {
  if (!scenario.requiredReadSetWarningCodes || !input.readSetValidation) {
    return scenario.substrateNotes;
  }

  return `${scenario.substrateNotes} Warning codes: ${input.readSetValidation.issueCodes.join(", ")}.`;
}
