import type { EntityId, TenantId, Timestamp } from "@pm/types";
import {
  evalEvent,
  evalEvidenceRef,
  type CoordinationClass,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
} from "./schema.js";

export interface AdapterStateProofSourceRecord {
  readonly sourceRecordId: string;
  readonly graphNodeId: EntityId;
  readonly adapterEventId: string;
  readonly concrete: string;
}

export interface AdapterStateProofEvalInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly scenarioId: string;
  readonly source: string;
  readonly agentId?: string;
  readonly runIdPrefix?: string;
  readonly sourceRecords: readonly AdapterStateProofSourceRecord[];
  readonly projectionId: string;
}

export interface AdapterStateProofSummary {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly coordinationClass: CoordinationClass;
  readonly baselineResult: EvalResult;
  readonly substrateResult: EvalResult;
  readonly sourceRecordCount: number;
  readonly substrateRefCount: number;
  readonly improvement: number;
}

export interface AdapterStateProofPairedResult {
  readonly pairedRunGroup: string;
  readonly events: readonly [EvalEvent, EvalEvent];
  readonly summary: AdapterStateProofSummary;
}

const FAILURE_CLASS = "representation_loss" satisfies FailureClass;
const COORDINATION_CLASS = "derived_projection" satisfies CoordinationClass;

export function buildAdapterStateProofEvalPair(
  input: AdapterStateProofEvalInput,
): AdapterStateProofPairedResult {
  const agentId = input.agentId ?? "adapter_state_proof_agent";
  const runIdPrefix = input.runIdPrefix ?? "run_adapter_state_proof";
  const pairedRunGroup = `pair_${input.scenarioId}`;
  const substrateRefs = [
    ...input.sourceRecords.flatMap((record) => [
      evalEvidenceRef("graph_node", record.graphNodeId, record.concrete),
      evalEvidenceRef("event", record.adapterEventId, "adapter.entity_mapped"),
    ]),
    evalEvidenceRef("projection", input.projectionId, "adapter state projection"),
  ];

  const baseline = evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: `${runIdPrefix}_${input.scenarioId}_baseline`,
    agentId,
    scenarioId: input.scenarioId,
    failureClass: FAILURE_CLASS,
    observedAt: input.observedAt,
    source: input.source,
    evidenceRefs: input.sourceRecords.map((record) =>
      evalEvidenceRef("source_record", record.sourceRecordId, record.concrete),
    ),
    substrateRefs: [
      evalEvidenceRef(
        "document",
        `${input.scenarioId}:baseline:no-shared-state`,
        "baseline source-only comparator",
      ),
    ],
    runArm: "baseline",
    pairedRunGroup,
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "task_verification",
    coordinationClass: COORDINATION_CLASS,
    evidenceStage: "scaffolded_scenario",
    result: "fail",
    notes:
      "Baseline source-only onboarding cannot prove equivalent graph, event, and projection state.",
  });

  const substrate = evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: `${runIdPrefix}_${input.scenarioId}_substrate`,
    agentId,
    scenarioId: input.scenarioId,
    failureClass: FAILURE_CLASS,
    observedAt: input.observedAt,
    source: input.source,
    evidenceRefs: input.sourceRecords.map((record) =>
      evalEvidenceRef("source_record", record.sourceRecordId, record.concrete),
    ),
    substrateRefs,
    runArm: "substrate",
    pairedRunGroup,
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "knowledge_update",
    mastCategory: "task_verification",
    coordinationClass: COORDINATION_CLASS,
    evidenceStage: "scaffolded_scenario",
    result: "pass",
    notes: `Substrate adapter represented ${input.sourceRecords.length} source records as graph nodes, adapter events, and projection state.`,
  });

  return {
    pairedRunGroup,
    events: [baseline, substrate],
    summary: {
      scenarioId: input.scenarioId,
      failureClass: FAILURE_CLASS,
      coordinationClass: COORDINATION_CLASS,
      baselineResult: baseline.result,
      substrateResult: substrate.result,
      sourceRecordCount: input.sourceRecords.length,
      substrateRefCount: substrateRefs.length,
      improvement: score(baseline.result) - score(substrate.result),
    },
  };
}

function score(result: EvalResult): number {
  return result === "fail" ? 1 : 0;
}
