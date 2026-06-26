import {
  evaluateStateReviewInvariantPolicy,
  verifyStateReviewArtifactHash,
  type StateReviewActionConsequence,
  type StateReviewArtifact,
  type StateReviewInvariantClass,
  type StateReviewInvariantPolicyMatrix,
  type StateReviewTemporalMisalignmentPhase,
} from "@pm/agent-state";
import {
  COORDINATION_CLASSES,
  EVAL_EVIDENCE_STAGES,
  FAILURE_CLASSES,
  MAST_CATEGORIES,
  MEMORY_BENCHMARK_BRIDGES,
  RUN_ARMS,
  STATE_BENCH_CATEGORIES,
  assertEvalEvent,
  type CoordinationClass,
  type EvalEvidenceStage,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
  type MastCategory,
  type MemoryBenchmarkBridge,
  type RunArm,
  type StateBenchCategory,
} from "./schema.js";

export type RequiredStateReviewTemporalMisalignmentPhase = Exclude<
  StateReviewTemporalMisalignmentPhase,
  "none"
>;

export const REQUIRED_STATE_REVIEW_TEMPORAL_MISALIGNMENT_PHASES = [
  "observation_to_action",
  "action_to_feedback",
  "feedback_to_observation",
] as const satisfies readonly RequiredStateReviewTemporalMisalignmentPhase[];

export interface IncompletePairedGroup {
  readonly pairedRunGroup: string;
  readonly missingArms: readonly RunArm[];
}

export interface CoordinationClassMetrics {
  readonly events: number;
  readonly pairedGroups: number;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly allStageFailureReduction: number;
  readonly substratePasses: number;
  readonly substrateBlocked: number;
}

export interface EvidenceStageMetrics {
  readonly events: number;
  readonly pairedGroups: number;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly substratePasses: number;
  readonly substrateBlocked: number;
}

export interface FailureClassMetrics {
  readonly events: number;
  readonly pairedGroups: number;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly allStageFailureReduction: number;
  readonly substratePasses: number;
  readonly substrateBlocked: number;
}

export interface EvalEventMetrics {
  readonly totalEvents: number;
  readonly pairedGroups: number;
  readonly completePairedGroups: number;
  readonly incompletePairedGroups: readonly IncompletePairedGroup[];
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly allStageFailureReduction: number;
  readonly stateBenchCategories: readonly StateBenchCategory[];
  readonly memoryBenchmarkBridges: readonly MemoryBenchmarkBridge[];
  readonly mastCategories: readonly MastCategory[];
  readonly coordinationClasses: readonly CoordinationClass[];
  readonly evidenceStages: readonly EvalEvidenceStage[];
  readonly byCoordinationClass: Readonly<Record<CoordinationClass, CoordinationClassMetrics>>;
  readonly byEvidenceStage: Readonly<Record<EvalEvidenceStage, EvidenceStageMetrics>>;
  readonly byFailureClass: Readonly<Record<FailureClass, FailureClassMetrics>>;
  readonly authorityGatePassRate: number | null;
  readonly convergentUpdateAutoResolutionRate: number | null;
}

export interface AdapterOperationalSample {
  readonly adapterStartedAt: string;
  readonly firstValidEventAt?: string;
  readonly mappingAttempts: number;
  readonly mappingRejections: number;
  readonly stateComparisons: number;
  readonly stateDisagreements: number;
}

export interface AdapterOperationalMetrics {
  readonly adapterTimeToFirstValidEventMs: number | null;
  readonly mappingRejectionRate: number | null;
  readonly stateDisagreementRate: number | null;
  readonly authorityGatePassRate: number | null;
  readonly authorityGatePasses: number;
  readonly authorityGateFailures: number;
}

export interface StateAssertionSample {
  readonly code: string;
  readonly passed: boolean;
  readonly severity: string;
}

export interface StateAssertionMetrics {
  readonly totalAssertions: number;
  readonly passedAssertions: number;
  readonly failedAssertions: number;
  readonly passRate: number | null;
  readonly failedByCode: Readonly<Record<string, number>>;
  readonly failedBySeverity: Readonly<Record<string, number>>;
}

export interface ActionProposalReviewWarningSample {
  readonly source: string;
  readonly code: string;
  readonly severity: string;
}

export interface ActionProposalReviewSample {
  readonly valid: boolean;
  readonly mode: string;
  readonly execution: {
    readonly allowed: boolean;
    readonly blocking: boolean;
    readonly enforcementMode?: string;
  };
  readonly warnings: readonly ActionProposalReviewWarningSample[];
}

export interface ActionProposalReviewMetrics {
  readonly totalReviews: number;
  readonly validReviews: number;
  readonly invalidReviews: number;
  readonly allowedReviews: number;
  readonly blockedReviews: number;
  readonly warnModeReviews: number;
  readonly advisoryReviews: number;
  readonly blockingModeReviews: number;
  readonly totalWarnings: number;
  readonly warningsBySource: Readonly<Record<string, number>>;
  readonly warningsByCode: Readonly<Record<string, number>>;
  readonly warningsBySeverity: Readonly<Record<string, number>>;
}

export interface StateReviewArtifactRelatedObjectSample {
  readonly role: string;
}

export interface StateReviewArtifactSample {
  readonly artifactHash: string;
  readonly hashValid: boolean;
  readonly eventEnvelope: {
    readonly source: string;
    readonly type: string;
  };
  readonly traceContext?: {
    readonly traceparent?: string;
    readonly spanId?: string;
    readonly parentReviewId?: string;
  };
  readonly relatedObjects: readonly StateReviewArtifactRelatedObjectSample[];
  readonly metadata?: {
    readonly temporalMisalignmentPhase?: StateReviewTemporalMisalignmentPhase;
    readonly invariantClasses?: readonly StateReviewInvariantClass[];
  };
  readonly review: ActionProposalReviewSample;
}

export interface StateReviewTemporalMisalignmentPhaseCoverage {
  readonly requiredPhases: readonly RequiredStateReviewTemporalMisalignmentPhase[];
  readonly coveredPhases: readonly RequiredStateReviewTemporalMisalignmentPhase[];
  readonly missingPhases: readonly RequiredStateReviewTemporalMisalignmentPhase[];
  readonly coverageRate: number;
}

export interface StateReviewArtifactPolicyMetricsOptions {
  readonly actionConsequence?: StateReviewActionConsequence;
  readonly policyMatrix?: StateReviewInvariantPolicyMatrix;
}

export interface StateReviewArtifactMetrics {
  readonly totalArtifacts: number;
  readonly hashVerifiedArtifacts: number;
  readonly hashMismatchArtifacts: number;
  readonly hashVerificationRate: number | null;
  readonly traceLinkedArtifacts: number;
  readonly traceJoinCoverage: number | null;
  readonly artifactsWithRelatedObjects: number;
  readonly objectRoleCoverage: number | null;
  readonly relatedObjectCount: number;
  readonly relatedObjectsByRole: Readonly<Record<string, number>>;
  readonly warningCount: number;
  readonly warningsBySource: Readonly<Record<string, number>>;
  readonly warningsByCode: Readonly<Record<string, number>>;
  readonly advisoryArtifacts: number;
  readonly blockingModeArtifacts: number;
  readonly blockedArtifacts: number;
  readonly policyActionConsequence: StateReviewActionConsequence;
  readonly policyWouldBlockArtifacts: number;
  readonly wouldBlockByInvariantClass: Readonly<Record<string, number>>;
  readonly artifactsBySource: Readonly<Record<string, number>>;
  readonly artifactsByType: Readonly<Record<string, number>>;
  readonly artifactsByTemporalMisalignmentPhase: Readonly<Record<string, number>>;
  readonly temporalMisalignmentPhaseCoverage: StateReviewTemporalMisalignmentPhaseCoverage;
  readonly artifactsByInvariantClass: Readonly<Record<string, number>>;
}

export interface StateReviewArtifactEvidenceMetrics {
  readonly stateAssertions: StateAssertionMetrics;
  readonly actionProposalReviews: ActionProposalReviewMetrics;
  readonly stateReviewArtifacts: StateReviewArtifactMetrics;
}

interface MutableCoordinationClassMetrics {
  events: number;
  pairedGroups: Set<string>;
  baselineFailures: number;
  substrateFailures: number;
  matureBaselineFailures: number;
  matureSubstrateFailures: number;
  substratePasses: number;
  substrateBlocked: number;
}

interface MutableEvidenceStageMetrics {
  events: number;
  pairedGroups: Set<string>;
  baselineFailures: number;
  substrateFailures: number;
  substratePasses: number;
  substrateBlocked: number;
}

interface MutableFailureClassMetrics {
  events: number;
  pairedGroups: Set<string>;
  baselineFailures: number;
  substrateFailures: number;
  matureBaselineFailures: number;
  matureSubstrateFailures: number;
  substratePasses: number;
  substrateBlocked: number;
}

export function analyzeEvalEvents(events: readonly EvalEvent[]): EvalEventMetrics {
  const validEvents = events.map((event) => assertEvalEvent(event));
  const pairedGroups = new Map<string, EvalEvent[]>();
  const byCoordinationClass = makeCoordinationMetrics();
  const byEvidenceStage = makeEvidenceStageMetrics();
  const byFailureClass = makeFailureClassMetrics();

  for (const event of validEvents) {
    const evidenceStage = evidenceStageFor(event);
    const countsAsFailureReduction = countsTowardFailureReduction(event);

    if (event.pairedRunGroup) {
      const group = pairedGroups.get(event.pairedRunGroup) ?? [];
      group.push(event);
      pairedGroups.set(event.pairedRunGroup, group);
    }

    const evidenceBucket = byEvidenceStage[evidenceStage];
    evidenceBucket.events += 1;
    if (event.pairedRunGroup) {
      evidenceBucket.pairedGroups.add(event.pairedRunGroup);
    }
    if (event.runArm === "baseline" && event.result === "fail") {
      evidenceBucket.baselineFailures += 1;
    }
    if (event.runArm === "substrate") {
      if (event.result === "fail") evidenceBucket.substrateFailures += 1;
      if (event.result === "pass") evidenceBucket.substratePasses += 1;
      if (event.result === "blocked") evidenceBucket.substrateBlocked += 1;
    }

    const failureBucket = byFailureClass[event.failureClass];
    failureBucket.events += 1;
    if (event.pairedRunGroup) {
      failureBucket.pairedGroups.add(event.pairedRunGroup);
    }
    if (event.runArm === "baseline" && event.result === "fail") {
      failureBucket.baselineFailures += 1;
      if (countsAsFailureReduction) {
        failureBucket.matureBaselineFailures += 1;
      }
    }
    if (event.runArm === "substrate") {
      if (event.result === "fail") failureBucket.substrateFailures += 1;
      if (event.result === "fail" && countsAsFailureReduction) {
        failureBucket.matureSubstrateFailures += 1;
      }
      if (event.result === "pass") failureBucket.substratePasses += 1;
      if (event.result === "blocked") failureBucket.substrateBlocked += 1;
    }

    if (event.coordinationClass) {
      const bucket = byCoordinationClass[event.coordinationClass];
      bucket.events += 1;
      if (event.pairedRunGroup) {
        bucket.pairedGroups.add(event.pairedRunGroup);
      }
      if (event.runArm === "baseline" && event.result === "fail") {
        bucket.baselineFailures += 1;
        if (countsAsFailureReduction) {
          bucket.matureBaselineFailures += 1;
        }
      }
      if (event.runArm === "substrate") {
        if (event.result === "fail") bucket.substrateFailures += 1;
        if (event.result === "fail" && countsAsFailureReduction) {
          bucket.matureSubstrateFailures += 1;
        }
        if (event.result === "pass") bucket.substratePasses += 1;
        if (event.result === "blocked") bucket.substrateBlocked += 1;
      }
    }
  }

  const incompletePairedGroups: IncompletePairedGroup[] = [];
  let completePairedGroups = 0;
  let convergentPairs = 0;
  let convergentResolvedPairs = 0;

  for (const [pairedRunGroup, group] of pairedGroups) {
    const arms = new Set(group.map((event) => event.runArm).filter(isRunArm));
    const missingArms = RUN_ARMS.filter((arm) => !arms.has(arm));
    if (missingArms.length > 0) {
      incompletePairedGroups.push({ pairedRunGroup, missingArms });
      continue;
    }

    completePairedGroups += 1;
    if (group.some((event) => event.coordinationClass === "convergent_update")) {
      convergentPairs += 1;
      if (
        group.some((event) => event.runArm === "baseline" && event.result === "fail") &&
        group.some((event) => event.runArm === "substrate" && event.result === "pass")
      ) {
        convergentResolvedPairs += 1;
      }
    }
  }

  const baselineFailures = countResult(validEvents, "baseline", "fail");
  const substrateFailures = countResult(validEvents, "substrate", "fail");
  const matureEvents = validEvents.filter(countsTowardFailureReduction);
  const matureBaselineFailures = countResult(matureEvents, "baseline", "fail");
  const matureSubstrateFailures = countResult(matureEvents, "substrate", "fail");
  const authorityGate = byCoordinationClass["authority_gated_transition"];
  const authorityGateDecisions =
    authorityGate.substratePasses + authorityGate.substrateFailures;

  return {
    totalEvents: validEvents.length,
    pairedGroups: pairedGroups.size,
    completePairedGroups,
    incompletePairedGroups: incompletePairedGroups.sort((a, b) =>
      a.pairedRunGroup.localeCompare(b.pairedRunGroup),
    ),
    baselineFailures,
    substrateFailures,
    failureReduction: matureBaselineFailures - matureSubstrateFailures,
    allStageFailureReduction: baselineFailures - substrateFailures,
    stateBenchCategories: uniqueByCanonicalOrder(
      validEvents,
      STATE_BENCH_CATEGORIES,
      (event) => event.stateBenchCategory,
    ),
    memoryBenchmarkBridges: uniqueByCanonicalOrder(
      validEvents,
      MEMORY_BENCHMARK_BRIDGES,
      (event) => event.memoryBenchmarkBridge,
    ),
    mastCategories: uniqueByCanonicalOrder(
      validEvents,
      MAST_CATEGORIES,
      (event) => event.mastCategory,
    ),
    coordinationClasses: uniqueByCanonicalOrder(
      validEvents,
      COORDINATION_CLASSES,
      (event) => event.coordinationClass,
    ),
    evidenceStages: uniqueByCanonicalOrder(
      validEvents,
      EVAL_EVIDENCE_STAGES,
      (event) => evidenceStageFor(event),
    ),
    byCoordinationClass: freezeCoordinationMetrics(byCoordinationClass),
    byEvidenceStage: freezeEvidenceStageMetrics(byEvidenceStage),
    byFailureClass: freezeFailureClassMetrics(byFailureClass),
    authorityGatePassRate:
      authorityGateDecisions === 0
        ? null
        : authorityGate.substratePasses / authorityGateDecisions,
    convergentUpdateAutoResolutionRate:
      convergentPairs === 0 ? null : convergentResolvedPairs / convergentPairs,
  };
}

export function analyzeAdapterOperationalMetrics(
  events: readonly EvalEvent[],
  samples: readonly AdapterOperationalSample[],
): AdapterOperationalMetrics {
  const evalMetrics = analyzeEvalEvents(events);
  const attempts = sum(samples, (sample) => sample.mappingAttempts);
  const rejections = sum(samples, (sample) => sample.mappingRejections);
  const comparisons = sum(samples, (sample) => sample.stateComparisons);
  const disagreements = sum(samples, (sample) => sample.stateDisagreements);
  const authority = evalMetrics.byCoordinationClass["authority_gated_transition"];

  return {
    adapterTimeToFirstValidEventMs: firstValidEventLatency(samples),
    mappingRejectionRate: attempts === 0 ? null : rejections / attempts,
    stateDisagreementRate: comparisons === 0 ? null : disagreements / comparisons,
    authorityGatePassRate: evalMetrics.authorityGatePassRate,
    authorityGatePasses: authority.substratePasses,
    authorityGateFailures: authority.substrateFailures,
  };
}

export function analyzeStateAssertions(
  samples: readonly StateAssertionSample[],
): StateAssertionMetrics {
  const failed = samples.filter((sample) => !sample.passed);
  const passed = samples.length - failed.length;

  return {
    totalAssertions: samples.length,
    passedAssertions: passed,
    failedAssertions: failed.length,
    passRate: samples.length === 0 ? null : passed / samples.length,
    failedByCode: countBy(failed, (sample) => sample.code),
    failedBySeverity: countBy(failed, (sample) => sample.severity),
  };
}

export function analyzeActionProposalReviews(
  reviews: readonly ActionProposalReviewSample[],
): ActionProposalReviewMetrics {
  const warnings = reviews.flatMap((review) => review.warnings);

  return {
    totalReviews: reviews.length,
    validReviews: reviews.filter((review) => review.valid).length,
    invalidReviews: reviews.filter((review) => !review.valid).length,
    allowedReviews: reviews.filter((review) => review.execution.allowed).length,
    blockedReviews: reviews.filter((review) => review.execution.blocking).length,
    warnModeReviews: reviews.filter((review) => review.mode === "warn").length,
    advisoryReviews: reviews.filter(
      (review) => review.execution.enforcementMode === "advisory",
    ).length,
    blockingModeReviews: reviews.filter(
      (review) => review.execution.enforcementMode === "blocking",
    ).length,
    totalWarnings: warnings.length,
    warningsBySource: countBy(warnings, (warning) => warning.source),
    warningsByCode: countBy(warnings, (warning) => warning.code),
    warningsBySeverity: countBy(warnings, (warning) => warning.severity),
  };
}

export function stateAssertionsFromStateReviewArtifacts(
  artifacts: readonly StateReviewArtifact[],
): readonly StateAssertionSample[] {
  return artifacts.flatMap((artifact) =>
    artifact.review.observationEvaluation.assertions.map((assertion) => ({
      code: assertion.code,
      passed: assertion.passed,
      severity: assertion.severity,
    })),
  );
}

export function actionProposalReviewsFromStateReviewArtifacts(
  artifacts: readonly StateReviewArtifact[],
): readonly ActionProposalReviewSample[] {
  return artifacts.map((artifact) => ({
    valid: artifact.review.valid,
    mode: artifact.review.mode,
    execution: {
      allowed: artifact.review.execution.allowed,
      blocking: artifact.review.execution.blocking,
      enforcementMode: artifact.review.execution.enforcementMode,
    },
    warnings: artifact.review.warnings.map((warning) => ({
      source: warning.source,
      code: warning.code,
      severity: warning.severity,
    })),
  }));
}

export function stateReviewArtifactSamplesFromArtifacts(
  artifacts: readonly StateReviewArtifact[],
): readonly StateReviewArtifactSample[] {
  return artifacts.map((artifact) => ({
    artifactHash: artifact.artifactHash,
    hashValid: verifyStateReviewArtifactHash(artifact).valid,
    eventEnvelope: {
      source: artifact.eventEnvelope.source,
      type: artifact.eventEnvelope.type,
    },
    ...(artifact.traceContext !== undefined
      ? {
          traceContext: {
            ...(artifact.traceContext.traceparent !== undefined
              ? { traceparent: artifact.traceContext.traceparent }
              : {}),
            ...(artifact.traceContext.spanId !== undefined
              ? { spanId: artifact.traceContext.spanId }
              : {}),
            ...(artifact.traceContext.parentReviewId !== undefined
              ? { parentReviewId: artifact.traceContext.parentReviewId }
              : {}),
          },
        }
      : {}),
    relatedObjects: artifact.relatedObjects.map((object) => ({
      role: object.role,
    })),
    metadata: {
      temporalMisalignmentPhase: artifact.metadata.temporalMisalignmentPhase,
      invariantClasses: artifact.metadata.invariantClasses,
    },
    review: {
      valid: artifact.review.valid,
      mode: artifact.review.mode,
      execution: {
        allowed: artifact.review.execution.allowed,
        blocking: artifact.review.execution.blocking,
        enforcementMode: artifact.review.execution.enforcementMode,
      },
      warnings: artifact.review.warnings.map((warning) => ({
        source: warning.source,
        code: warning.code,
        severity: warning.severity,
      })),
    },
  }));
}

export function analyzeStateReviewArtifactEvidence(
  artifacts: readonly StateReviewArtifact[],
  options: StateReviewArtifactPolicyMetricsOptions = {},
): StateReviewArtifactEvidenceMetrics {
  return {
    stateAssertions: analyzeStateAssertions(
      stateAssertionsFromStateReviewArtifacts(artifacts),
    ),
    actionProposalReviews: analyzeActionProposalReviews(
      actionProposalReviewsFromStateReviewArtifacts(artifacts),
    ),
    stateReviewArtifacts: analyzeStateReviewArtifacts(
      stateReviewArtifactSamplesFromArtifacts(artifacts),
      options,
    ),
  };
}

export function analyzeStateReviewArtifacts(
  artifacts: readonly StateReviewArtifactSample[],
  options: StateReviewArtifactPolicyMetricsOptions = {},
): StateReviewArtifactMetrics {
  const warnings = artifacts.flatMap((artifact) => artifact.review.warnings);
  const relatedObjects = artifacts.flatMap((artifact) => artifact.relatedObjects);
  const invariantClasses = artifacts.flatMap(
    (artifact) => artifact.metadata?.invariantClasses ?? [],
  );
  const temporalMisalignmentPhases = artifacts.flatMap((artifact) =>
    artifact.metadata?.temporalMisalignmentPhase === undefined
      ? []
      : [artifact.metadata.temporalMisalignmentPhase],
  );
  const traceLinkedArtifacts = artifacts.filter(hasTraceContext).length;
  const artifactsWithRelatedObjects = artifacts.filter(
    (artifact) => artifact.relatedObjects.length > 0,
  ).length;
  const hashVerifiedArtifacts = artifacts.filter((artifact) => artifact.hashValid).length;
  const policyActionConsequence = options.actionConsequence ?? "high";
  const policyEvaluations = artifacts.map((artifact) =>
    evaluateStateReviewInvariantPolicy(
      artifact.metadata?.invariantClasses ?? [],
      policyActionConsequence,
      options.policyMatrix,
    ),
  );
  const policyWouldBlockInvariantClasses = policyEvaluations.flatMap(
    (evaluation) => evaluation.wouldBlockInvariantClasses,
  );

  return {
    totalArtifacts: artifacts.length,
    hashVerifiedArtifacts,
    hashMismatchArtifacts: artifacts.length - hashVerifiedArtifacts,
    hashVerificationRate:
      artifacts.length === 0 ? null : hashVerifiedArtifacts / artifacts.length,
    traceLinkedArtifacts,
    traceJoinCoverage:
      artifacts.length === 0 ? null : traceLinkedArtifacts / artifacts.length,
    artifactsWithRelatedObjects,
    objectRoleCoverage:
      artifacts.length === 0
        ? null
        : artifactsWithRelatedObjects / artifacts.length,
    relatedObjectCount: relatedObjects.length,
    relatedObjectsByRole: countBy(relatedObjects, (object) => object.role),
    warningCount: warnings.length,
    warningsBySource: countBy(warnings, (warning) => warning.source),
    warningsByCode: countBy(warnings, (warning) => warning.code),
    advisoryArtifacts: artifacts.filter(
      (artifact) => artifact.review.execution.enforcementMode === "advisory",
    ).length,
    blockingModeArtifacts: artifacts.filter(
      (artifact) => artifact.review.execution.enforcementMode === "blocking",
    ).length,
    blockedArtifacts: artifacts.filter(
      (artifact) => artifact.review.execution.blocking,
    ).length,
    policyActionConsequence,
    policyWouldBlockArtifacts: policyEvaluations.filter(
      (evaluation) => evaluation.wouldBlock,
    ).length,
    wouldBlockByInvariantClass: countBy(
      policyWouldBlockInvariantClasses,
      (invariantClass) => invariantClass,
    ),
    artifactsBySource: countBy(
      artifacts,
      (artifact) => artifact.eventEnvelope.source,
    ),
    artifactsByType: countBy(artifacts, (artifact) => artifact.eventEnvelope.type),
    artifactsByTemporalMisalignmentPhase: countBy(
      temporalMisalignmentPhases,
      (phase) => phase,
    ),
    temporalMisalignmentPhaseCoverage: analyzeTemporalMisalignmentPhaseCoverage(
      temporalMisalignmentPhases,
    ),
    artifactsByInvariantClass: countBy(
      invariantClasses,
      (invariantClass) => invariantClass,
    ),
  };
}

function analyzeTemporalMisalignmentPhaseCoverage(
  phases: readonly StateReviewTemporalMisalignmentPhase[],
): StateReviewTemporalMisalignmentPhaseCoverage {
  const covered = REQUIRED_STATE_REVIEW_TEMPORAL_MISALIGNMENT_PHASES.filter(
    (phase) => phases.includes(phase),
  );
  const missing = REQUIRED_STATE_REVIEW_TEMPORAL_MISALIGNMENT_PHASES.filter(
    (phase) => !phases.includes(phase),
  );

  return {
    requiredPhases: REQUIRED_STATE_REVIEW_TEMPORAL_MISALIGNMENT_PHASES,
    coveredPhases: covered,
    missingPhases: missing,
    coverageRate:
      covered.length / REQUIRED_STATE_REVIEW_TEMPORAL_MISALIGNMENT_PHASES.length,
  };
}

function makeCoordinationMetrics(): Record<CoordinationClass, MutableCoordinationClassMetrics> {
  return Object.fromEntries(
    COORDINATION_CLASSES.map((coordinationClass) => [
      coordinationClass,
      {
        events: 0,
        pairedGroups: new Set<string>(),
        baselineFailures: 0,
        substrateFailures: 0,
        matureBaselineFailures: 0,
        matureSubstrateFailures: 0,
        substratePasses: 0,
        substrateBlocked: 0,
      },
    ]),
  ) as Record<CoordinationClass, MutableCoordinationClassMetrics>;
}

function makeEvidenceStageMetrics(): Record<EvalEvidenceStage, MutableEvidenceStageMetrics> {
  return Object.fromEntries(
    EVAL_EVIDENCE_STAGES.map((evidenceStage) => [
      evidenceStage,
      {
        events: 0,
        pairedGroups: new Set<string>(),
        baselineFailures: 0,
        substrateFailures: 0,
        substratePasses: 0,
        substrateBlocked: 0,
      },
    ]),
  ) as Record<EvalEvidenceStage, MutableEvidenceStageMetrics>;
}

function makeFailureClassMetrics(): Record<FailureClass, MutableFailureClassMetrics> {
  return Object.fromEntries(
    FAILURE_CLASSES.map((failureClass) => [
      failureClass,
      {
        events: 0,
        pairedGroups: new Set<string>(),
        baselineFailures: 0,
        substrateFailures: 0,
        matureBaselineFailures: 0,
        matureSubstrateFailures: 0,
        substratePasses: 0,
        substrateBlocked: 0,
      },
    ]),
  ) as Record<FailureClass, MutableFailureClassMetrics>;
}

function freezeCoordinationMetrics(
  input: Record<CoordinationClass, MutableCoordinationClassMetrics>,
): Record<CoordinationClass, CoordinationClassMetrics> {
  return Object.fromEntries(
    COORDINATION_CLASSES.map((coordinationClass) => {
      const metrics = input[coordinationClass];
      return [
        coordinationClass,
        {
          events: metrics.events,
          pairedGroups: metrics.pairedGroups.size,
          baselineFailures: metrics.baselineFailures,
          substrateFailures: metrics.substrateFailures,
          failureReduction:
            metrics.matureBaselineFailures - metrics.matureSubstrateFailures,
          allStageFailureReduction: metrics.baselineFailures - metrics.substrateFailures,
          substratePasses: metrics.substratePasses,
          substrateBlocked: metrics.substrateBlocked,
        },
      ];
    }),
  ) as Record<CoordinationClass, CoordinationClassMetrics>;
}

function freezeEvidenceStageMetrics(
  input: Record<EvalEvidenceStage, MutableEvidenceStageMetrics>,
): Record<EvalEvidenceStage, EvidenceStageMetrics> {
  return Object.fromEntries(
    EVAL_EVIDENCE_STAGES.map((evidenceStage) => {
      const metrics = input[evidenceStage];
      return [
        evidenceStage,
        {
          events: metrics.events,
          pairedGroups: metrics.pairedGroups.size,
          baselineFailures: metrics.baselineFailures,
          substrateFailures: metrics.substrateFailures,
          failureReduction: metrics.baselineFailures - metrics.substrateFailures,
          substratePasses: metrics.substratePasses,
          substrateBlocked: metrics.substrateBlocked,
        },
      ];
    }),
  ) as Record<EvalEvidenceStage, EvidenceStageMetrics>;
}

function freezeFailureClassMetrics(
  input: Record<FailureClass, MutableFailureClassMetrics>,
): Record<FailureClass, FailureClassMetrics> {
  return Object.fromEntries(
    FAILURE_CLASSES.map((failureClass) => {
      const metrics = input[failureClass];
      return [
        failureClass,
        {
          events: metrics.events,
          pairedGroups: metrics.pairedGroups.size,
          baselineFailures: metrics.baselineFailures,
          substrateFailures: metrics.substrateFailures,
          failureReduction:
            metrics.matureBaselineFailures - metrics.matureSubstrateFailures,
          allStageFailureReduction: metrics.baselineFailures - metrics.substrateFailures,
          substratePasses: metrics.substratePasses,
          substrateBlocked: metrics.substrateBlocked,
        },
      ];
    }),
  ) as Record<FailureClass, FailureClassMetrics>;
}

function countResult(
  events: readonly EvalEvent[],
  runArm: RunArm,
  result: EvalResult,
): number {
  return events.filter((event) => event.runArm === runArm && event.result === result).length;
}

function evidenceStageFor(event: EvalEvent): EvalEvidenceStage {
  return event.evidenceStage ?? "scaffolded_scenario";
}

function countsTowardFailureReduction(event: EvalEvent): boolean {
  const stage = evidenceStageFor(event);
  return (
    stage === "blocked_mutation" ||
    stage === "paired_behavioral_improvement" ||
    stage === "live_run"
  );
}

function firstValidEventLatency(
  samples: readonly AdapterOperationalSample[],
): number | null {
  const durations = samples
    .flatMap((sample) => {
      if (!sample.firstValidEventAt) return [];
      const start = Date.parse(sample.adapterStartedAt);
      const first = Date.parse(sample.firstValidEventAt);
      if (!Number.isFinite(start) || !Number.isFinite(first)) return [];
      return [first - start];
    })
    .filter((duration) => duration >= 0);
  if (durations.length === 0) return null;
  return Math.min(...durations);
}

function sum<T>(
  values: readonly T[],
  getValue: (value: T) => number,
): number {
  return values.reduce((acc, value) => acc + getValue(value), 0);
}

function countBy<T>(
  values: readonly T[],
  getValue: (value: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) {
    const key = getValue(value);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function uniqueByCanonicalOrder<T extends string>(
  events: readonly EvalEvent[],
  canonical: readonly T[],
  getValue: (event: EvalEvent) => T | undefined,
): readonly T[] {
  const seen = new Set(events.map(getValue).filter(isPresent));
  return canonical.filter((value) => seen.has(value));
}

function isRunArm(value: RunArm | undefined): value is RunArm {
  return value !== undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function hasTraceContext(artifact: StateReviewArtifactSample): boolean {
  const traceContext = artifact.traceContext;
  return (
    traceContext !== undefined &&
    (traceContext.traceparent !== undefined ||
      traceContext.spanId !== undefined ||
      traceContext.parentReviewId !== undefined)
  );
}
