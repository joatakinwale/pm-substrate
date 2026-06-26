import type { TenantId, Timestamp } from "@pm/types";
import {
  evalEvent,
  evalEvidenceRef,
  type CoordinationClass,
  type EvalEvidenceStage,
  type EvalEvent,
  type EvalOperationalTerminalOutcome,
  type EvalResult,
  type FailureClass,
  type RunArm,
} from "./schema.js";
import type { AdapterOperationalSample } from "./metrics.js";
import type { EvalGraphWriteAuthorityRecoverySuite } from "./authority-recovery.js";
import type { StrictThreeAxisProofPacketSourceBundle } from "./three-axis-proof-packet.js";

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
  readonly scenarioSpecs?: readonly ArrowHedgeScenarioSpec[];
  readonly stateReviewArtifacts?: readonly ArrowHedgeStateReviewArtifactEvalRef[];
  readonly actionOutcomeEnvelopes?: readonly ArrowHedgeActionOutcomeEnvelopeEvalRef[];
  readonly operationalSamples: readonly AdapterOperationalSample[];
  readonly runIdPrefix?: string;
  readonly agentId?: string;
}

export interface ArrowHedgeStateReviewArtifactEvalRef {
  readonly scenarioId: string;
  readonly artifactId: string;
  readonly label?: string;
}

export interface ArrowHedgeActionOutcomeEnvelopeEvalRef {
  readonly scenarioId: string;
  readonly envelopeId: string;
  readonly runArm?: RunArm;
  readonly terminalOutcome?: EvalOperationalTerminalOutcome;
  readonly label?: string;
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

export interface ArrowHedgeTerminalPacketProofSourceBundleInput
  extends ArrowHedgeStateEvalInput {
  readonly sourceId: string;
  readonly authorityRecoverySuite?: EvalGraphWriteAuthorityRecoverySuite;
}

export interface ArrowHedgeScenarioSpec {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly coordinationClass: CoordinationClass;
  readonly substrateResult: EvalResult;
  readonly evidenceStage: EvalEvidenceStage;
  readonly requiredReadSetWarningCodes?: readonly string[];
  readonly requiresActionOutcomeEnvelope?: boolean;
  readonly baselineNotes: string;
  readonly substrateNotes: string;
}

const SCENARIOS: readonly ArrowHedgeScenarioSpec[] = [
  {
    scenarioId: "arrowhedge-representation-loss",
    failureClass: "representation_loss",
    coordinationClass: "derived_projection",
    substrateResult: "pass",
    evidenceStage: "scaffolded_scenario",
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
    evidenceStage: "scaffolded_scenario",
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
    evidenceStage: "scaffolded_scenario",
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
    evidenceStage: "detected_warning",
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
    evidenceStage: "scaffolded_scenario",
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
    evidenceStage: "scaffolded_scenario",
    baselineNotes:
      "Baseline payload can omit required finance capability fields without a typed rejection surface.",
    substrateNotes:
      "Substrate runtime payload validation rejects malformed typed finance events before publication.",
  },
  {
    scenarioId: "arrowhedge-terminal-outcome-partition",
    failureClass: "parallel_write_conflict",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline decision accounting can observe both accepted and blocked terminal claims for the same stable action id.",
    substrateNotes:
      "Substrate arm reduces the decision to one ActionOutcomeEnvelope normal form and rejects conflicting terminal outcomes.",
  },
];

export const ARROWHEDGE_CANONICAL_TERMINAL_PACKET_SCENARIOS = [
  {
    scenarioId: "arrowhedge-observation-to-action-stale-risk",
    failureClass: "stale_observation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline portfolio decision accepts from an observation captured before the risk freshness window expired.",
    substrateNotes:
      "Substrate terminal packet blocks the stale observation-to-action transition.",
  },
  {
    scenarioId: "arrowhedge-action-to-feedback-authority-drift",
    failureClass: "feedback_disconnection",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline feedback loop treats post-action authority drift as if it were current risk state.",
    substrateNotes:
      "Substrate terminal packet blocks feedback that cannot be reconciled to the authoritative risk view.",
  },
  {
    scenarioId: "arrowhedge-feedback-to-observation-missing-risk",
    failureClass: "partial_observation",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline refresh proceeds from a local view that is missing the current risk state.",
    substrateNotes:
      "Substrate terminal packet blocks because required risk evidence/read refs are missing.",
  },
] as const satisfies readonly ArrowHedgeScenarioSpec[];

export const ARROWHEDGE_CANONICAL_CONTINUITY_PACKET_SCENARIOS = [
  {
    scenarioId: "arrowhedge-memory-drift-conflicting-position",
    failureClass: "memory_drift",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline amnesiac resume accepts a portfolio decision from private memory even though substrate continuity checkpoints disagree.",
    substrateNotes:
      "Substrate terminal packet blocks because conflicting continuity checkpoints create a local-view obstruction.",
  },
  {
    scenarioId: "arrowhedge-continuity-break-missing-terminal-history",
    failureClass: "continuity_break",
    coordinationClass: "authority_gated_transition",
    substrateResult: "pass",
    evidenceStage: "blocked_mutation",
    requiresActionOutcomeEnvelope: true,
    baselineNotes:
      "Baseline resume continues with source evidence while losing the prior terminal outcome history.",
    substrateNotes:
      "Substrate terminal packet blocks because required terminal decision refs are absent from continuity checkpoints.",
  },
] as const satisfies readonly ArrowHedgeScenarioSpec[];

export const ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS = [
  ...ARROWHEDGE_CANONICAL_TERMINAL_PACKET_SCENARIOS,
  ...ARROWHEDGE_CANONICAL_CONTINUITY_PACKET_SCENARIOS,
] as const satisfies readonly ArrowHedgeScenarioSpec[];

export function buildArrowHedgeStateEvalSuite(
  input: ArrowHedgeStateEvalInput,
): ArrowHedgeStateEvalSuite {
  const runIdPrefix = input.runIdPrefix ?? "run_arrowhedge_axis_a";
  const agentId = input.agentId ?? "arrowhedge_axis_a_agent";
  const commonSubstrateRefs = [
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

  const scenarioSpecs = [...SCENARIOS, ...(input.scenarioSpecs ?? [])];
  const pairs = scenarioSpecs.map((scenario) => {
    const pairedRunGroup = `pair_${scenario.scenarioId}`;
    const baselineOutcomeRefs = actionOutcomeEnvelopeRefsForScenario(
      scenario.scenarioId,
      input,
      "baseline",
    );
    const substrateOutcomeRefs = actionOutcomeEnvelopeRefsForScenario(
      scenario.scenarioId,
      input,
      "substrate",
    );
    const baselineTerminalOutcome = operationalTerminalOutcomeForScenario(
      scenario.scenarioId,
      input,
      "baseline",
    );
    const substrateRefs = [
      ...commonSubstrateRefs,
      ...stateReviewArtifactRefsForScenario(scenario.scenarioId, input),
      ...substrateOutcomeRefs,
    ];
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
      substrateRefs: [
        evalEvidenceRef("document", `${scenario.scenarioId}:baseline`),
        ...baselineOutcomeRefs,
      ],
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
      evidenceStage: scenario.evidenceStage,
      scenarioResult: "fail",
      ...(baselineTerminalOutcome === undefined
        ? {}
        : { operationalTerminalOutcome: baselineTerminalOutcome }),
      result: "fail",
      notes: scenario.baselineNotes,
    });
    const substrateResult = substrateResultForScenario(scenario, input);
    const substrateTerminalOutcome = operationalTerminalOutcomeForScenario(
      scenario.scenarioId,
      input,
      "substrate",
    );
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
      evidenceStage: scenario.evidenceStage,
      scenarioResult: substrateResult,
      ...(substrateTerminalOutcome === undefined
        ? {}
        : { operationalTerminalOutcome: substrateTerminalOutcome }),
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

export function buildArrowHedgeTerminalPacketProofSourceBundle(
  input: ArrowHedgeTerminalPacketProofSourceBundleInput,
): StrictThreeAxisProofPacketSourceBundle {
  const {
    sourceId,
    authorityRecoverySuite,
    ...suiteInput
  } = input;
  const suite = buildArrowHedgeStateEvalSuite(suiteInput);

  return {
    source: {
      sourceId,
      axis: "finance",
      eventCount: suite.events.length,
    },
    events: suite.events,
    ...(authorityRecoverySuite !== undefined
      ? { authorityRecoverySuite }
      : {}),
  };
}

function stateReviewArtifactRefsForScenario(
  scenarioId: string,
  input: ArrowHedgeStateEvalInput,
) {
  return (input.stateReviewArtifacts ?? [])
    .filter((artifact) => artifact.scenarioId === scenarioId)
    .map((artifact) =>
      evalEvidenceRef(
        "state_review_artifact",
        artifact.artifactId,
        artifact.label ?? "ArrowHedge StateReviewArtifact",
      ),
    );
}

function actionOutcomeEnvelopeRefsForScenario(
  scenarioId: string,
  input: ArrowHedgeStateEvalInput,
  runArm: RunArm = "substrate",
) {
  return (input.actionOutcomeEnvelopes ?? [])
    .filter(
      (envelope) =>
        envelope.scenarioId === scenarioId &&
        (envelope.runArm ?? "substrate") === runArm,
    )
    .map((envelope) =>
      evalEvidenceRef(
        "action_outcome_envelope",
        envelope.envelopeId,
        envelope.label ?? "ArrowHedge ActionOutcomeEnvelope",
      ),
    );
}

function operationalTerminalOutcomeForScenario(
  scenarioId: string,
  input: ArrowHedgeStateEvalInput,
  runArm: RunArm,
): EvalOperationalTerminalOutcome | undefined {
  const outcomes = (input.actionOutcomeEnvelopes ?? [])
    .filter(
      (envelope) =>
        envelope.scenarioId === scenarioId &&
        (envelope.runArm ?? "substrate") === runArm &&
        envelope.terminalOutcome !== undefined,
    )
    .map((envelope) => envelope.terminalOutcome!);

  if (outcomes.length > 1) {
    throw new Error(
      `ArrowHedge scenario ${scenarioId}/${runArm} has multiple terminal outcomes`,
    );
  }
  return outcomes[0];
}

function score(result: EvalResult): number {
  return result === "fail" ? 1 : 0;
}

function substrateResultForScenario(
  scenario: ArrowHedgeScenarioSpec,
  input: ArrowHedgeStateEvalInput,
): EvalResult {
  if (
    scenario.requiresActionOutcomeEnvelope === true &&
    actionOutcomeEnvelopeRefsForScenario(scenario.scenarioId, input).length === 0
  ) {
    return "fail";
  }
  if (!scenario.requiredReadSetWarningCodes) return scenario.substrateResult;
  const validation = input.readSetValidation;
  if (!validation || validation.mode !== "warn") return "fail";
  const issueCodes = new Set(validation.issueCodes);
  return scenario.requiredReadSetWarningCodes.every((code) => issueCodes.has(code))
    ? scenario.substrateResult
    : "fail";
}

function substrateNotesForScenario(
  scenario: ArrowHedgeScenarioSpec,
  input: ArrowHedgeStateEvalInput,
): string {
  if (!scenario.requiredReadSetWarningCodes || !input.readSetValidation) {
    return scenario.substrateNotes;
  }

  return `${scenario.substrateNotes} Warning codes: ${input.readSetValidation.issueCodes.join(", ")}.`;
}
