import {
  evaluateStateReviewInvariantPolicy,
  importStateReviewArtifactsJsonl,
  type EvidenceAdmissionReview,
  type StateRef,
  type StateReviewActionConsequence,
  type StateReviewInvariantClass,
  type StateReviewTemporalMisalignmentPhase,
} from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";
import {
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingReferenceCatalog,
  type EvidenceBindingStateReviewArtifactRef,
  type EvidenceBindingMode,
  type EvidenceBindingVerificationDecision,
  type InvocationEvidenceBinding,
} from "@pm/workflow";

import {
  buildEvidenceAdmissionReviewCorpus,
  importEvidenceAdmissionReviewsJsonl,
} from "./evidence-admission.js";

export type WriteBindingReplayDecision =
  | "allowed"
  | "blocked_missing_binding"
  | "blocked_incomplete_binding"
  | "blocked_policy"
  | "blocked_unverified_binding";

export interface WriteBindingReplayArtifactRef {
  readonly artifactId: string;
  readonly artifactHash: string;
}

export interface WriteBindingReplayAdmissionRef {
  readonly reviewId: string;
  readonly evidenceId: string;
  readonly decision: EvidenceAdmissionReview["decision"];
  readonly authorityStatus: EvidenceAdmissionReview["authorityStatus"];
  readonly invariantClasses: readonly StateReviewInvariantClass[];
}

export interface WriteBindingReplayCurrentStateViewRef {
  readonly viewId: string;
  readonly subject: StateRef;
}

export interface WriteBindingReplayRecord {
  readonly recordId: string;
  readonly schemaVersion: "pm.write_binding_replay.v1";
  readonly generatedAt: Timestamp;
  readonly tenantId: TenantId;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly capabilityWrites: boolean;
  readonly triggerEventId: string;
  readonly actionType: string;
  readonly actionConsequence: StateReviewActionConsequence;
  readonly bindingMode: EvidenceBindingMode;
  readonly currentStateView: WriteBindingReplayCurrentStateViewRef;
  readonly stateReviewArtifact: WriteBindingReplayArtifactRef;
  readonly evidenceAdmissionReviews: readonly WriteBindingReplayAdmissionRef[];
  readonly invocationEvidenceBinding: InvocationEvidenceBinding | null;
  readonly validation: EvidenceBindingVerificationDecision;
  readonly decision: WriteBindingReplayDecision;
  readonly warningCodes: readonly string[];
  readonly invariantClasses: readonly StateReviewInvariantClass[];
  readonly temporalMisalignmentPhase: StateReviewTemporalMisalignmentPhase;
}

export interface WriteBindingReplayCorpus {
  readonly records: readonly WriteBindingReplayRecord[];
  readonly jsonl: string;
  readonly metrics: WriteBindingReplayMetrics;
}

export interface WriteBindingReplayMetrics {
  readonly totalRecords: number;
  readonly allowed: number;
  readonly blocked: number;
  readonly completeBindings: number;
  readonly missingBindings: number;
  readonly incompleteBindings: number;
  readonly policyBlocked: number;
  readonly unverifiedBindings: number;
  readonly rejectedEvidenceReferences: number;
  readonly replayHashCoverage: number;
  readonly highConsequenceRecords: number;
  readonly byDecision: Readonly<Record<WriteBindingReplayDecision, number>>;
}

export interface EvidenceBindingReferenceCatalogMetrics {
  readonly stateReviewArtifactCount: number;
  readonly stateReviewArtifactsBackedByCorpus: number;
  readonly evidenceAdmissionReviewCount: number;
  readonly rejectedEvidenceAdmissionReviews: number;
  readonly writeBindingRecordCount: number;
  readonly bindingsWithCatalogCandidates: number;
}

export interface EvidenceBindingReferenceCatalogBuildResult {
  readonly catalog: EvidenceBindingReferenceCatalog;
  readonly metrics: EvidenceBindingReferenceCatalogMetrics;
}

export type WriteTransportBindingCoverageDisposition =
  | "required_verified"
  | "advisory_only"
  | "missing_provider";

export interface WriteTransportBindingCoverageSample {
  readonly transportId: string;
  readonly profile: string;
  readonly workflowName: string;
  readonly capability: string;
  readonly capabilityWrites: boolean;
  readonly bindingMode: EvidenceBindingMode;
  readonly hasBindingProvider: boolean;
  readonly hasBindingVerifier: boolean;
}

export interface WriteTransportBindingCoverageMetrics {
  readonly totalWriteCapableTransports: number;
  readonly verifiedRequiredTransports: number;
  readonly advisoryOnlyTransports: number;
  readonly missingProviderTransports: number;
  readonly coverageRate: number;
  readonly byDisposition: Readonly<
    Record<WriteTransportBindingCoverageDisposition, number>
  >;
  readonly samples: readonly (WriteTransportBindingCoverageSample & {
    readonly disposition: WriteTransportBindingCoverageDisposition;
  })[];
}

interface ArrowHedgeArtifactSeed {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly generatedAt: Timestamp;
  readonly workflowRunId: string;
  readonly actionType: string;
  readonly currentStateViewId: string;
  readonly subject: StateRef;
  readonly warningCodes: readonly string[];
  readonly invariantClasses: readonly StateReviewInvariantClass[];
  readonly temporalMisalignmentPhase: StateReviewTemporalMisalignmentPhase;
}

const SCHEMA_VERSION = "pm.write_binding_replay.v1";
const ARROWHEDGE_TENANT = "tnt_arrowhedge_state_review_corpus" as TenantId;
const ARROWHEDGE_SUBJECT: StateRef = {
  kind: "projection",
  id: "arrowhedge_cop_corpus:AAPL",
  label: "ArrowHedge COP AAPL",
};

const ARROWHEDGE_ARTIFACTS = {
  clean: {
    artifactId: "artifact_arrowhedge_clean_current_accepted_001",
    artifactHash:
      "9528f4f2f17b86db397364b8a48a4d0609b5705092c02f49bd76145ea3d6dc9c",
    generatedAt: "2026-06-03T14:05:00.000Z" as Timestamp,
    workflowRunId: "arrowhedge-clean-current-workflow",
    actionType: "risk.refresh",
    currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
    subject: ARROWHEDGE_SUBJECT,
    warningCodes: [],
    invariantClasses: [],
    temporalMisalignmentPhase: "none",
  },
  staleAccept: {
    artifactId: "artifact_arrowhedge_observation_to_action_stale_risk_001",
    artifactHash:
      "8a897ce7167b9e82f391c7b6d45ba309747ad0e4d22a9394763c794695d0f07b",
    generatedAt: "2026-06-03T14:12:30.000Z" as Timestamp,
    workflowRunId: "arrowhedge-temporal-workflow-observation-action",
    actionType: "portfolio.decision.accept",
    currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
    subject: ARROWHEDGE_SUBJECT,
    warningCodes: [
      "current_view_conflict",
      "stale_read_ref",
      "freshness_window_current",
      "workflow_position_matches",
      "conflicts_declared",
    ],
    invariantClasses: [
      "freshness_window",
      "workflow_position",
      "state_conflict",
    ],
    temporalMisalignmentPhase: "observation_to_action",
  },
  authorityFeedback: {
    artifactId: "artifact_arrowhedge_action_to_feedback_authority_001",
    artifactHash:
      "7de7770bdaf03201c5d87f58a4e08880d0034e38099337336fab6aa9bc7d72da",
    generatedAt: "2026-06-03T14:06:30.000Z" as Timestamp,
    workflowRunId: "arrowhedge-temporal-workflow-action-feedback",
    actionType: "risk.refresh",
    currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
    subject: ARROWHEDGE_SUBJECT,
    warningCodes: ["authority_mismatch", "projection_version_mismatch"],
    invariantClasses: ["source_authority", "projection_version"],
    temporalMisalignmentPhase: "action_to_feedback",
  },
} as const satisfies Readonly<Record<string, ArrowHedgeArtifactSeed>>;

export function serializeWriteBindingReplayRecordsJsonl(
  records: readonly WriteBindingReplayRecord[],
): string {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function importWriteBindingReplayRecordsJsonl(
  jsonl: string,
): readonly WriteBindingReplayRecord[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as WriteBindingReplayRecord);
}

export function buildEvidenceBindingReferenceCatalogFromReplayCorpora(input: {
  readonly stateReviewArtifactsJsonl: string;
  readonly evidenceAdmissionReviewsJsonl: string;
  readonly writeBindingReplayJsonl: string;
}): EvidenceBindingReferenceCatalogBuildResult {
  const stateReviewArtifacts = importStateReviewArtifactsJsonl(
    input.stateReviewArtifactsJsonl,
  ).map((result, index) => {
    if (!result.valid || result.artifact === undefined) {
      throw new Error(
        `invalid state-review artifact replay row ${index}: ${result.issues
          .map((issue) => `${issue.path} ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.artifact;
  });
  const evidenceAdmissionReviews = importEvidenceAdmissionReviewsJsonl(
    input.evidenceAdmissionReviewsJsonl,
  );
  const writeBindingRecords = importWriteBindingReplayRecordsJsonl(
    input.writeBindingReplayJsonl,
  );

  const artifactRefs = new Map<string, MutableArtifactCatalogRef>();
  for (const record of writeBindingRecords) {
    const ref = getOrCreateArtifactRef(
      artifactRefs,
      record.stateReviewArtifact.artifactId,
    );
    mergeArtifactCatalogField(
      ref,
      "artifactHash",
      record.stateReviewArtifact.artifactHash,
      record.recordId,
    );
    mergeArtifactCatalogField(ref, "tenantId", record.tenantId, record.recordId);
    mergeArtifactCatalogField(
      ref,
      "workflowId",
      record.workflowId,
      record.recordId,
    );
    mergeArtifactCatalogField(
      ref,
      "workflowRunId",
      record.workflowRunId,
      record.recordId,
    );
    mergeArtifactCatalogField(
      ref,
      "currentStateViewId",
      record.currentStateView.viewId,
      record.recordId,
    );
    record.evidenceAdmissionReviews.forEach((review) =>
      ref.evidenceAdmissionReviewIds.add(review.reviewId),
    );
  }

  for (const artifact of stateReviewArtifacts) {
    const ref = getOrCreateArtifactRef(artifactRefs, artifact.artifactId);
    mergeArtifactCatalogField(
      ref,
      "artifactHash",
      artifact.artifactHash,
      artifact.artifactId,
    );
    mergeArtifactCatalogField(
      ref,
      "tenantId",
      artifact.review.tenantId,
      artifact.artifactId,
    );
    mergeArtifactCatalogField(
      ref,
      "workflowRunId",
      artifact.metadata.workflowRunId,
      artifact.artifactId,
    );
    mergeArtifactCatalogField(
      ref,
      "currentStateViewId",
      artifact.review.currentStateView.viewId,
      artifact.artifactId,
    );
  }

  return {
    catalog: {
      stateReviewArtifacts: [...artifactRefs.values()].map((ref) =>
        compactArtifactCatalogRef(ref),
      ),
      evidenceAdmissionReviews: evidenceAdmissionReviews.map((review) => ({
        reviewId: review.reviewId,
        tenantId: review.tenantId,
        decision: review.decision,
        authorityStatus: review.authorityStatus,
      })),
    },
    metrics: {
      stateReviewArtifactCount: artifactRefs.size,
      stateReviewArtifactsBackedByCorpus: stateReviewArtifacts.length,
      evidenceAdmissionReviewCount: evidenceAdmissionReviews.length,
      rejectedEvidenceAdmissionReviews: evidenceAdmissionReviews.filter(
        (review) => review.decision === "rejected",
      ).length,
      writeBindingRecordCount: writeBindingRecords.length,
      bindingsWithCatalogCandidates: writeBindingRecords.filter(
        (record) => record.invocationEvidenceBinding !== null,
      ).length,
    },
  };
}

export function buildFixtureWriteTransportBindingCoverageSamples(): readonly WriteTransportBindingCoverageSample[] {
  return [
    {
      transportId: "arrowhedge.portfolio.accept",
      profile: "finance-research",
      workflowName: "arrowhedge-write-binding-replay",
      capability: "portfolio/decision.accept",
      capabilityWrites: true,
      bindingMode: "require_for_writes",
      hasBindingProvider: true,
      hasBindingVerifier: true,
    },
    {
      transportId: "agency.lead.promote",
      profile: "agency",
      workflowName: "agency-lead-promote",
      capability: "agency/lead.promote",
      capabilityWrites: true,
      bindingMode: "require_for_writes",
      hasBindingProvider: true,
      hasBindingVerifier: true,
    },
    {
      transportId: "research.memo.publish",
      profile: "finance-research",
      workflowName: "research-memo-publish",
      capability: "research/memo.publish",
      capabilityWrites: true,
      bindingMode: "off",
      hasBindingProvider: true,
      hasBindingVerifier: false,
    },
    {
      transportId: "crm.note.sync",
      profile: "shared",
      workflowName: "crm-note-sync",
      capability: "crm/note.sync",
      capabilityWrites: true,
      bindingMode: "require_for_writes",
      hasBindingProvider: false,
      hasBindingVerifier: false,
    },
  ];
}

export function analyzeWriteTransportBindingCoverage(
  samples: readonly WriteTransportBindingCoverageSample[],
): WriteTransportBindingCoverageMetrics {
  const byDisposition = {
    required_verified: 0,
    advisory_only: 0,
    missing_provider: 0,
  } satisfies Record<WriteTransportBindingCoverageDisposition, number>;

  const evaluated = samples
    .filter((sample) => sample.capabilityWrites)
    .map((sample) => {
      const disposition = classifyWriteTransportBindingCoverage(sample);
      byDisposition[disposition] += 1;
      return {
        ...sample,
        disposition,
      };
    });

  return {
    totalWriteCapableTransports: evaluated.length,
    verifiedRequiredTransports: byDisposition.required_verified,
    advisoryOnlyTransports: byDisposition.advisory_only,
    missingProviderTransports: byDisposition.missing_provider,
    coverageRate:
      evaluated.length === 0
        ? 1
        : byDisposition.required_verified / evaluated.length,
    byDisposition,
    samples: evaluated,
  };
}

export function buildArrowHedgeWriteBindingReplayCorpus(): WriteBindingReplayCorpus {
  const admissions = buildEvidenceAdmissionReviewCorpus().reviews;
  const admissionById = new Map(
    admissions.map((review) => [review.reviewId, review]),
  );

  const cleanAdmission = requiredAdmission(
    admissionById,
    "ev_clean:admission_review",
  );
  const staleAdmission = requiredAdmission(
    admissionById,
    "ev_mcp_handle:admission_review",
  );
  const rejectedAdmission = requiredAdmission(
    admissionById,
    "ev_xtenant:admission_review",
  );

  const records = [
    buildRecord({
      recordId: "wb_arrowhedge_clean_refresh_allowed_001",
      artifact: ARROWHEDGE_ARTIFACTS.clean,
      admissions: [cleanAdmission],
      capability: "risk/refresh",
      nodeId: "refresh-risk",
      triggerEventId: "evt_arrowhedge_clean_refresh_ready",
      bindingKind: "complete_advisory",
      generatedAt: "2026-06-11T16:00:00.000Z" as Timestamp,
    }),
    buildRecord({
      recordId: "wb_arrowhedge_hash_mismatch_blocked_001",
      artifact: ARROWHEDGE_ARTIFACTS.clean,
      admissions: [cleanAdmission],
      capability: "risk/refresh",
      nodeId: "refresh-risk",
      triggerEventId: "evt_arrowhedge_clean_refresh_bad_hash",
      bindingKind: "unverified_artifact_hash",
      generatedAt: "2026-06-11T16:00:30.000Z" as Timestamp,
    }),
    buildRecord({
      recordId: "wb_arrowhedge_missing_binding_blocked_001",
      artifact: ARROWHEDGE_ARTIFACTS.staleAccept,
      admissions: [cleanAdmission],
      capability: "portfolio/decision.accept",
      nodeId: "accept-decision",
      triggerEventId: "evt_arrowhedge_accept_ready_missing_binding",
      bindingKind: "missing",
      generatedAt: "2026-06-11T16:01:00.000Z" as Timestamp,
    }),
    buildRecord({
      recordId: "wb_arrowhedge_incomplete_binding_blocked_001",
      artifact: ARROWHEDGE_ARTIFACTS.staleAccept,
      admissions: [cleanAdmission],
      capability: "portfolio/decision.accept",
      nodeId: "accept-decision",
      triggerEventId: "evt_arrowhedge_accept_ready_incomplete_binding",
      bindingKind: "incomplete",
      generatedAt: "2026-06-11T16:02:00.000Z" as Timestamp,
    }),
    buildRecord({
      recordId: "wb_arrowhedge_stale_artifact_policy_blocked_001",
      artifact: ARROWHEDGE_ARTIFACTS.staleAccept,
      admissions: [staleAdmission],
      capability: "portfolio/decision.accept",
      nodeId: "accept-decision",
      triggerEventId: "evt_arrowhedge_accept_ready_stale_artifact",
      bindingKind: "complete_blocking",
      generatedAt: "2026-06-11T16:03:00.000Z" as Timestamp,
    }),
    buildRecord({
      recordId: "wb_arrowhedge_rejected_evidence_policy_blocked_001",
      artifact: ARROWHEDGE_ARTIFACTS.authorityFeedback,
      admissions: [rejectedAdmission],
      capability: "risk/refresh",
      nodeId: "refresh-risk",
      triggerEventId: "evt_arrowhedge_refresh_ready_rejected_evidence",
      bindingKind: "complete_blocking",
      generatedAt: "2026-06-11T16:04:00.000Z" as Timestamp,
    }),
  ] as const;

  return {
    records,
    jsonl: serializeWriteBindingReplayRecordsJsonl(records),
    metrics: analyzeWriteBindingReplayRecords(records),
  };
}

export function analyzeWriteBindingReplayRecords(
  records: readonly WriteBindingReplayRecord[],
): WriteBindingReplayMetrics {
  const byDecision = {
    allowed: 0,
    blocked_missing_binding: 0,
    blocked_incomplete_binding: 0,
    blocked_policy: 0,
    blocked_unverified_binding: 0,
  } satisfies Record<WriteBindingReplayDecision, number>;

  let completeBindings = 0;
  let rejectedEvidenceReferences = 0;
  let highConsequenceRecords = 0;
  let hashPresent = 0;

  for (const record of records) {
    byDecision[record.decision] += 1;
    if (record.invocationEvidenceBinding !== null && record.decision !== "blocked_incomplete_binding") {
      completeBindings += 1;
    }
    if (
      record.evidenceAdmissionReviews.some(
        (review) => review.decision === "rejected",
      )
    ) {
      rejectedEvidenceReferences += 1;
    }
    if (record.actionConsequence === "high") highConsequenceRecords += 1;
    if (record.stateReviewArtifact.artifactHash.length === 64) hashPresent += 1;
  }

  return {
    totalRecords: records.length,
    allowed: byDecision.allowed,
    blocked: records.length - byDecision.allowed,
    completeBindings,
    missingBindings: byDecision.blocked_missing_binding,
    incompleteBindings: byDecision.blocked_incomplete_binding,
    policyBlocked: byDecision.blocked_policy,
    unverifiedBindings: byDecision.blocked_unverified_binding,
    rejectedEvidenceReferences,
    replayHashCoverage: records.length === 0 ? 1 : hashPresent / records.length,
    highConsequenceRecords,
    byDecision,
  };
}

function requiredAdmission(
  reviews: ReadonlyMap<string, EvidenceAdmissionReview>,
  reviewId: string,
): EvidenceAdmissionReview {
  const review = reviews.get(reviewId);
  if (!review) {
    throw new Error(`missing evidence admission review ${reviewId}`);
  }
  return review;
}

function buildRecord(input: {
  readonly recordId: string;
  readonly artifact: ArrowHedgeArtifactSeed;
  readonly admissions: readonly EvidenceAdmissionReview[];
  readonly capability: string;
  readonly nodeId: string;
  readonly triggerEventId: string;
  readonly bindingKind:
    | "missing"
    | "incomplete"
    | "complete_advisory"
    | "complete_blocking"
    | "unverified_artifact_hash";
  readonly generatedAt: Timestamp;
}): WriteBindingReplayRecord {
  const workflowId = "wf_arrowhedge_write_binding_replay";
  const actionConsequence: StateReviewActionConsequence = "high";
  const bindingMode: EvidenceBindingMode = "require_for_writes";
  const policy = evaluateStateReviewInvariantPolicy(
    [
      ...input.artifact.invariantClasses,
      ...input.admissions.flatMap((review) => review.invariantClasses),
    ],
    actionConsequence,
  );
  const invocationEvidenceBinding = buildInvocationEvidenceBinding({
    artifact: input.artifact,
    admissions: input.admissions,
    actionConsequence,
    bindingKind: input.bindingKind,
    wouldBlock: policy.wouldBlock,
  });
  const validation =
    invocationEvidenceBinding === null
      ? validateInvocationEvidenceBinding({
          capabilityWrites: true,
          evidenceBindingRequired: true,
          evidenceBinding: invocationEvidenceBinding,
        })
      : verifyInvocationEvidenceBindingAgainstCatalog({
          request: {
            tenantId: ARROWHEDGE_TENANT,
            workflowId,
            workflowName: "arrowhedge-write-binding-replay",
            workflowVersion: 1,
            nodeId: input.nodeId,
            capability: input.capability,
            inputs: {},
            capabilityWrites: true,
            triggerEventId: input.triggerEventId,
          },
          evidenceBinding: invocationEvidenceBinding,
          catalog: {
            stateReviewArtifacts: [
              {
                stateReviewArtifactId: input.artifact.artifactId,
                artifactHash: input.artifact.artifactHash,
                tenantId: ARROWHEDGE_TENANT,
                workflowId,
                workflowRunId: input.artifact.workflowRunId,
                currentStateViewId: input.artifact.currentStateViewId,
                evidenceAdmissionReviewIds: input.admissions.map(
                  (review) => review.reviewId,
                ),
              },
            ],
            evidenceAdmissionReviews: input.admissions.map((review) => ({
              reviewId: review.reviewId,
              tenantId: ARROWHEDGE_TENANT,
              decision: review.decision,
              authorityStatus: review.authorityStatus,
            })),
          },
        });

  return {
    recordId: input.recordId,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    tenantId: ARROWHEDGE_TENANT,
    workflowRunId: input.artifact.workflowRunId,
    workflowId,
    workflowName: "arrowhedge-write-binding-replay",
    workflowVersion: 1,
    nodeId: input.nodeId,
    capability: input.capability,
    capabilityWrites: true,
    triggerEventId: input.triggerEventId,
    actionType: input.artifact.actionType,
    actionConsequence,
    bindingMode,
    currentStateView: {
      viewId: input.artifact.currentStateViewId,
      subject: input.artifact.subject,
    },
    stateReviewArtifact: {
      artifactId: input.artifact.artifactId,
      artifactHash: input.artifact.artifactHash,
    },
    evidenceAdmissionReviews: input.admissions.map((review) => ({
      reviewId: review.reviewId,
      evidenceId: review.evidence.evidenceId,
      decision: review.decision,
      authorityStatus: review.authorityStatus,
      invariantClasses: review.invariantClasses,
    })),
    invocationEvidenceBinding,
    validation,
    decision: decisionFromValidation(validation),
    warningCodes: input.artifact.warningCodes,
    invariantClasses: uniqueInvariantClasses([
      ...input.artifact.invariantClasses,
      ...input.admissions.flatMap((review) => review.invariantClasses),
    ]),
    temporalMisalignmentPhase: input.artifact.temporalMisalignmentPhase,
  };
}

function buildInvocationEvidenceBinding(input: {
  readonly artifact: ArrowHedgeArtifactSeed;
  readonly admissions: readonly EvidenceAdmissionReview[];
  readonly actionConsequence: StateReviewActionConsequence;
  readonly bindingKind:
    | "missing"
    | "incomplete"
    | "complete_advisory"
    | "complete_blocking"
    | "unverified_artifact_hash";
  readonly wouldBlock: boolean;
}): InvocationEvidenceBinding | null {
  if (input.bindingKind === "missing") return null;

  const mode =
    input.bindingKind === "complete_blocking" ? "blocking" : "advisory";
  const evidenceAdmissionReviewIds =
    input.bindingKind === "incomplete"
      ? []
      : input.admissions.map((review) => review.reviewId);

  return {
    stateReviewArtifactId: input.artifact.artifactId,
    stateReviewArtifactHash:
      input.bindingKind === "unverified_artifact_hash"
        ? "0".repeat(64)
        : input.artifact.artifactHash,
    evidenceAdmissionReviewIds,
    policyDisposition: {
      evaluatedAt: "2026-06-11T16:00:00.000Z" as Timestamp,
      consequence: input.actionConsequence,
      wouldBlock: input.wouldBlock,
      mode,
    },
  };
}

function decisionFromValidation(
  validation: EvidenceBindingVerificationDecision,
): WriteBindingReplayDecision {
  if (validation.valid) return "allowed";
  switch (validation.reason) {
    case "evidence_binding_missing":
      return "blocked_missing_binding";
    case "evidence_binding_incomplete":
      return "blocked_incomplete_binding";
    case "evidence_policy_blocked":
      return "blocked_policy";
    case "evidence_binding_unverified":
      return "blocked_unverified_binding";
  }
}

function uniqueInvariantClasses(
  values: readonly StateReviewInvariantClass[],
): readonly StateReviewInvariantClass[] {
  return [...new Set(values)];
}

interface MutableArtifactCatalogRef
  extends Omit<EvidenceBindingStateReviewArtifactRef, "evidenceAdmissionReviewIds"> {
  readonly evidenceAdmissionReviewIds: Set<string>;
}

function getOrCreateArtifactRef(
  refs: Map<string, MutableArtifactCatalogRef>,
  artifactId: string,
): MutableArtifactCatalogRef {
  let ref = refs.get(artifactId);
  if (ref === undefined) {
    ref = {
      stateReviewArtifactId: artifactId,
      evidenceAdmissionReviewIds: new Set<string>(),
    };
    refs.set(artifactId, ref);
  }
  return ref;
}

function mergeArtifactCatalogField<
  K extends keyof Omit<MutableArtifactCatalogRef, "stateReviewArtifactId" | "evidenceAdmissionReviewIds">,
>(
  ref: MutableArtifactCatalogRef,
  key: K,
  value: MutableArtifactCatalogRef[K] | undefined,
  sourceId: string,
): void {
  if (value === undefined) return;
  const prior = ref[key];
  if (prior !== undefined && prior !== value) {
    throw new Error(
      `conflicting ${String(key)} for state review artifact ${ref.stateReviewArtifactId}: ${prior} !== ${value} (${sourceId})`,
    );
  }
  ref[key] = value;
}

function classifyWriteTransportBindingCoverage(
  sample: WriteTransportBindingCoverageSample,
): WriteTransportBindingCoverageDisposition {
  if (!sample.hasBindingProvider) return "missing_provider";
  if (
    sample.bindingMode === "require_for_writes" &&
    sample.hasBindingVerifier
  ) {
    return "required_verified";
  }
  return "advisory_only";
}

function compactArtifactCatalogRef(
  ref: MutableArtifactCatalogRef,
): EvidenceBindingStateReviewArtifactRef {
  const compact: {
    stateReviewArtifactId: string;
    evidenceAdmissionReviewIds: readonly string[];
    artifactHash?: string;
    tenantId?: string;
    workflowId?: string;
    workflowRunId?: string;
    currentStateViewId?: string;
  } = {
    stateReviewArtifactId: ref.stateReviewArtifactId,
    evidenceAdmissionReviewIds: [...ref.evidenceAdmissionReviewIds],
  };
  if (ref.artifactHash !== undefined) compact.artifactHash = ref.artifactHash;
  if (ref.tenantId !== undefined) compact.tenantId = ref.tenantId;
  if (ref.workflowId !== undefined) compact.workflowId = ref.workflowId;
  if (ref.workflowRunId !== undefined) compact.workflowRunId = ref.workflowRunId;
  if (ref.currentStateViewId !== undefined) {
    compact.currentStateViewId = ref.currentStateViewId;
  }
  return compact;
}
