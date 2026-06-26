import { createHash } from "node:crypto";

import {
  evaluateStateReviewInvariantPolicy,
  importStateReviewArtifactsJsonl,
  promoteWorkflowInvocationOutcomeEnvelope,
  stateRef,
  verifyActionOutcomeEnvelopeHash,
  type ActionOutcomeEnvelope,
  type EvidenceAdmissionReview,
  type StateRef,
  type StateReviewActionConsequence,
  type StateReviewInvariantClass,
  type StateReviewTemporalMisalignmentPhase,
} from "@pm/agent-state";
import {
  listTerminalAdmissionProviderBindings,
  normalizeCapability,
  verifyTerminalAdmissionProviderBindings,
  type Capability,
} from "@pm/registry";
import type {
  CapabilityId,
  TenantId,
  TerminalAdmissionProviderCertificate,
  TerminalAdmissionProviderManifest,
  Timestamp,
  WriteContract,
} from "@pm/types";
import {
  buildInvocationActionOutcomeEnvelope,
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingAdmissionCertificateRef,
  type EvidenceBindingReferenceCatalog,
  type EvidenceBindingStateReviewArtifactRef,
  type EvidenceBindingMode,
  type EvidenceBindingVerificationDecision,
  type InvocationActionOutcomeProviderCertificateStatusRef,
  type InvocationEvidenceBinding,
} from "@pm/workflow";

import {
  buildEvidenceAdmissionReviewCorpus,
  importEvidenceAdmissionReviewsJsonl,
} from "./evidence-admission.js";
import type { EvalEvent, EvalEvidenceRef } from "./schema.js";
import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";
import type { EvalGraphWriteAuthorityRecoverySuite } from "./authority-recovery.js";
import type { StrictThreeAxisProofPacketSourceBundle } from "./three-axis-proof-packet.js";

export type WriteBindingReplayDecision =
  | "allowed"
  | "blocked_missing_binding"
  | "blocked_incomplete_binding"
  | "blocked_policy"
  | "blocked_unverified_binding"
  | "blocked_provider_certificate_missing"
  | "blocked_provider_certificate_invalid";

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
  readonly actionOutcomeEnvelope: ActionOutcomeEnvelope;
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

export interface ArrowHedgeWriteBindingProofSourceBundleInput {
  readonly authorityRecoverySuite?: EvalGraphWriteAuthorityRecoverySuite;
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
  readonly providerCertificateMissing: number;
  readonly providerCertificateInvalid: number;
  readonly rejectedEvidenceReferences: number;
  readonly actionOutcomeEnvelopeCount: number;
  readonly acceptedActionOutcomeEnvelopes: number;
  readonly blockedActionOutcomeEnvelopes: number;
  readonly replayHashCoverage: number;
  readonly highConsequenceRecords: number;
  readonly byDecision: Readonly<Record<WriteBindingReplayDecision, number>>;
}

export interface ActionOutcomeEnvelopeReplayIndexedRef {
  readonly ref: EvalEvidenceRef;
  readonly recordId: string;
  readonly envelope: ActionOutcomeEnvelope;
  readonly outcomeHash: string;
  readonly terminalOutcome: ActionOutcomeEnvelope["terminalOutcome"];
  readonly validHash: boolean;
}

export interface ActionOutcomeEnvelopeReplayIndex {
  readonly envelopeCount: number;
  readonly indexedRefCount: number;
  readonly acceptedTerminalOutcomes: number;
  readonly blockedTerminalOutcomes: number;
  readonly invalidEnvelopeHashes: readonly ActionOutcomeEnvelopeReplayIndexedRef[];
  readonly refs: readonly ActionOutcomeEnvelopeReplayIndexedRef[];
}

export interface EvalEventActionOutcomeReplayRecovery {
  readonly runId: string;
  readonly scenarioId: string;
  readonly ref: EvalEvidenceRef;
  readonly resolved: boolean;
  readonly recordId?: string;
  readonly outcomeHash?: string;
  readonly terminalOutcome?: ActionOutcomeEnvelope["terminalOutcome"];
  readonly validHash?: boolean;
  readonly reason?: "missing_replay_packet" | "invalid_outcome_hash";
}

export interface EvalEventActionOutcomeReplayMetrics {
  readonly eventCount: number;
  readonly eventsWithActionOutcomeRefs: number;
  readonly actionOutcomeRefCount: number;
  readonly resolvedActionOutcomeRefs: number;
  readonly unresolvedActionOutcomeRefs: number;
  readonly invalidResolvedActionOutcomeRefs: number;
  readonly acceptedTerminalOutcomes: number;
  readonly blockedTerminalOutcomes: number;
  readonly recoveries: readonly EvalEventActionOutcomeReplayRecovery[];
}

export interface EvidenceBindingReferenceCatalogMetrics {
  readonly stateReviewArtifactCount: number;
  readonly stateReviewArtifactsBackedByCorpus: number;
  readonly evidenceAdmissionReviewCount: number;
  readonly rejectedEvidenceAdmissionReviews: number;
  readonly admissionCertificateCount: number;
  readonly revokedAdmissionCertificateCount: number;
  readonly writeBindingRecordCount: number;
  readonly bindingsWithCatalogCandidates: number;
  readonly bindingsWithAdmissionCertificates: number;
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
  readonly requiresActionOutcomeEnvelope: boolean;
  readonly hasActionOutcomeEnvelopeProvider: boolean;
  readonly terminalAdmissionProviderIds?: readonly string[];
}

export interface CapabilityWriteTransportBindingCoverageInput {
  readonly capability: Capability;
  readonly profile: string;
  readonly workflowName: string;
  readonly bindingMode: EvidenceBindingMode;
  readonly hasBindingProvider: boolean;
  readonly hasBindingVerifier: boolean;
  readonly requiresActionOutcomeEnvelope?: boolean;
}

export interface CapabilityWriteTransportBindingCoverageOptions {
  readonly terminalAdmissionProviderManifests?: readonly TerminalAdmissionProviderManifest[];
  readonly requireVerifiedTerminalAdmissionProviders?: boolean;
}

export interface WriteTransportBindingCoverageMetrics {
  readonly totalWriteCapableTransports: number;
  readonly verifiedRequiredTransports: number;
  readonly advisoryOnlyTransports: number;
  readonly missingProviderTransports: number;
  readonly coverageRate: number;
  readonly outcomeEnvelopeRequiredTransports: number;
  readonly outcomeEnvelopeCoveredTransports: number;
  readonly outcomeEnvelopeMissingTransports: number;
  readonly outcomeEnvelopeCoverageRate: number;
  readonly missingActionOutcomeEnvelopeTransportIds: readonly string[];
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
  readonly proposalReviewId: string;
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

const ARROWHEDGE_TERMINAL_PROVIDER = {
  providerId: "finance-research.arrowhedge.action-outcome-envelope.v1",
  kind: "action_outcome_envelope",
  contractVersion: { major: 1, minor: 0, patch: 0 },
  packageName: "@pm/capability-finance-research-ingest",
  exportName: "buildArrowHedgeActionOutcomeEnvelope",
  actionTypes: ["risk.refresh", "portfolio.decision.accept"],
  profiles: ["finance-research"],
  evidenceRefKinds: ["state_review_artifact"],
  substrateRefKinds: ["action_outcome_envelope", "workflow_run"],
} as const;

const ARROWHEDGE_TERMINAL_PROVIDER_MANIFEST = {
  ...ARROWHEDGE_TERMINAL_PROVIDER,
  availability: "available",
} as const satisfies TerminalAdmissionProviderManifest;

const ARROWHEDGE_TERMINAL_PROVIDER_CERTIFICATE = {
  schemaVersion: "pm.terminal_admission_provider_certificate.v1",
  certificateId: "tapc_arrowhedge_write_binding_replay_001",
  certificateDigest: "sha256:arrowhedge_write_binding_replay_001",
  issuer: "registry.install",
  issuedAt: "2026-06-11T15:59:00.000Z" as Timestamp,
  validUntil: "2026-06-11T17:00:00.000Z" as Timestamp,
  status: "valid",
  subject: {
    capabilityId: "cap_arrowhedge_write_binding_replay" as CapabilityId,
    capabilityName: "risk/refresh",
    capabilityVersion: 1,
    writeInterface: "RiskRefresh",
    writeFields: ["risk.currentPrice", "risk.maxShares"],
    writeOwnership: "owner",
    providerId: ARROWHEDGE_TERMINAL_PROVIDER.providerId,
  },
  provider: ARROWHEDGE_TERMINAL_PROVIDER,
  manifest: ARROWHEDGE_TERMINAL_PROVIDER_MANIFEST,
  manifestDigest: "sha256:arrowhedge_terminal_provider_manifest",
} as const satisfies TerminalAdmissionProviderCertificate;

const ARROWHEDGE_TERMINAL_PROVIDER_STATUS_REF = {
  certificateId: ARROWHEDGE_TERMINAL_PROVIDER_CERTIFICATE.certificateId,
  certificateDigest: ARROWHEDGE_TERMINAL_PROVIDER_CERTIFICATE.certificateDigest,
  status: "valid",
  statusSequence: 1,
  statusEventHash: "sha256:arrowhedge_terminal_provider_status_event_001",
  statusUpdatedAt: "2026-06-11T15:59:30.000Z",
  checkedAt: "2026-06-11T16:00:00.000Z",
} as const satisfies InvocationActionOutcomeProviderCertificateStatusRef;

const ARROWHEDGE_ARTIFACTS = {
  clean: {
    artifactId: "artifact_arrowhedge_clean_current_accepted_001",
    artifactHash:
      "97db735111b612cf5b5267925f6d9e5af0f29c222c0b548d05206e3306dca350",
    generatedAt: "2026-06-03T14:05:00.000Z" as Timestamp,
    workflowRunId: "arrowhedge-clean-current-workflow",
    actionType: "risk.refresh",
    proposalReviewId:
      "arrowhedge_cop_corpus:AAPL:current_state_view:risk.refresh:proposal_review",
    currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
    subject: ARROWHEDGE_SUBJECT,
    warningCodes: [],
    invariantClasses: [],
    temporalMisalignmentPhase: "none",
  },
  staleAccept: {
    artifactId: "artifact_arrowhedge_observation_to_action_stale_risk_001",
    artifactHash:
      "39f9182271244b1f560647823e97615ce8f52306138d677def764acebe68deaa",
    generatedAt: "2026-06-03T14:12:30.000Z" as Timestamp,
    workflowRunId: "arrowhedge-temporal-workflow-observation-action",
    actionType: "portfolio.decision.accept",
    proposalReviewId:
      "arrowhedge_cop_corpus:AAPL:current_state_view:portfolio.decision.accept:proposal_review",
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
      "af7a501bf9f6e55e585824790e1236e347a6e2f16440a28c1424bf65c2e5f2f9",
    generatedAt: "2026-06-03T14:06:30.000Z" as Timestamp,
    workflowRunId: "arrowhedge-temporal-workflow-action-feedback",
    actionType: "risk.refresh",
    proposalReviewId:
      "arrowhedge_cop_corpus:AAPL:current_state_view:risk.refresh:proposal_review",
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

export function buildActionOutcomeEnvelopeReplayIndex(
  records: readonly WriteBindingReplayRecord[],
): ActionOutcomeEnvelopeReplayIndex {
  const refs: ActionOutcomeEnvelopeReplayIndexedRef[] = [];
  let acceptedTerminalOutcomes = 0;
  let blockedTerminalOutcomes = 0;

  for (const record of records) {
    const envelope = record.actionOutcomeEnvelope;
    const hashValid = verifyActionOutcomeEnvelopeHash(envelope).valid;
    if (envelope.terminalOutcome === "accepted") acceptedTerminalOutcomes += 1;
    if (envelope.terminalOutcome === "blocked") blockedTerminalOutcomes += 1;

    for (const ref of envelope.substrateRefs) {
      if (ref.kind !== "action_outcome_envelope") continue;
      refs.push({
        ref: {
          kind: "action_outcome_envelope",
          id: ref.id,
          ...(ref.label === undefined ? {} : { label: ref.label }),
        },
        recordId: record.recordId,
        envelope,
        outcomeHash: envelope.outcomeHash,
        terminalOutcome: envelope.terminalOutcome,
        validHash: hashValid,
      });
    }
  }

  return {
    envelopeCount: records.length,
    indexedRefCount: refs.length,
    acceptedTerminalOutcomes,
    blockedTerminalOutcomes,
    invalidEnvelopeHashes: refs.filter((ref) => !ref.validHash),
    refs,
  };
}

export function recoverActionOutcomeEnvelopeFromReplayIndex(
  index: ActionOutcomeEnvelopeReplayIndex,
  ref: EvalEvidenceRef,
): ActionOutcomeEnvelope | undefined {
  if (ref.kind !== "action_outcome_envelope") return undefined;
  return index.refs.find((indexed) => indexed.ref.id === ref.id)?.envelope;
}

export function analyzeEvalEventActionOutcomeReplay(
  events: readonly EvalEvent[],
  records: readonly WriteBindingReplayRecord[],
): EvalEventActionOutcomeReplayMetrics {
  const recoveries: EvalEventActionOutcomeReplayRecovery[] = [];
  const indexedRefs = new Map(
    buildActionOutcomeEnvelopeReplayIndex(records).refs.map((indexed) => [
      indexed.ref.id,
      indexed,
    ]),
  );
  let eventsWithActionOutcomeRefs = 0;

  for (const event of events) {
    const refs = event.substrateRefs.filter(
      (ref) => ref.kind === "action_outcome_envelope",
    );
    if (refs.length > 0) eventsWithActionOutcomeRefs += 1;

    for (const ref of refs) {
      const indexed = indexedRefs.get(ref.id);
      if (indexed === undefined) {
        recoveries.push({
          runId: event.runId,
          scenarioId: event.scenarioId,
          ref,
          resolved: false,
          reason: "missing_replay_packet",
        });
        continue;
      }

      recoveries.push({
        runId: event.runId,
        scenarioId: event.scenarioId,
        ref,
        resolved: indexed.validHash,
        recordId: indexed.recordId,
        outcomeHash: indexed.outcomeHash,
        terminalOutcome: indexed.terminalOutcome,
        validHash: indexed.validHash,
        ...(indexed.validHash ? {} : { reason: "invalid_outcome_hash" }),
      });
    }
  }

  const resolved = recoveries.filter((recovery) => recovery.resolved);

  return {
    eventCount: events.length,
    eventsWithActionOutcomeRefs,
    actionOutcomeRefCount: recoveries.length,
    resolvedActionOutcomeRefs: resolved.length,
    unresolvedActionOutcomeRefs: recoveries.length - resolved.length,
    invalidResolvedActionOutcomeRefs: recoveries.filter(
      (recovery) => recovery.validHash === false,
    ).length,
    acceptedTerminalOutcomes: resolved.filter(
      (recovery) => recovery.terminalOutcome === "accepted",
    ).length,
    blockedTerminalOutcomes: resolved.filter(
      (recovery) => recovery.terminalOutcome === "blocked",
    ).length,
    recoveries,
  };
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
  const admissionCertificates = writeBindingRecords
    .map((record) => buildAdmissionCertificateRefFromRecord(record))
    .filter(
      (
        certificate,
      ): certificate is EvidenceBindingAdmissionCertificateRef =>
        certificate !== undefined,
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
      admissionCertificates,
    },
    metrics: {
      stateReviewArtifactCount: artifactRefs.size,
      stateReviewArtifactsBackedByCorpus: stateReviewArtifacts.length,
      evidenceAdmissionReviewCount: evidenceAdmissionReviews.length,
      rejectedEvidenceAdmissionReviews: evidenceAdmissionReviews.filter(
        (review) => review.decision === "rejected",
      ).length,
      admissionCertificateCount: admissionCertificates.length,
      revokedAdmissionCertificateCount: admissionCertificates.filter(
        (certificate) => certificate.revokedAt !== undefined,
      ).length,
      writeBindingRecordCount: writeBindingRecords.length,
      bindingsWithCatalogCandidates: writeBindingRecords.filter(
        (record) => record.invocationEvidenceBinding !== null,
      ).length,
      bindingsWithAdmissionCertificates: writeBindingRecords.filter(
        (record) =>
          record.invocationEvidenceBinding?.admissionCertificateId !==
          undefined,
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
      requiresActionOutcomeEnvelope: true,
      hasActionOutcomeEnvelopeProvider: true,
      terminalAdmissionProviderIds: [
        "finance-research.arrowhedge.action-outcome-envelope.v1",
      ],
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
      requiresActionOutcomeEnvelope: true,
      hasActionOutcomeEnvelopeProvider: true,
      terminalAdmissionProviderIds: [
        "agency.publication.action-outcome-envelope.v1",
      ],
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
      requiresActionOutcomeEnvelope: true,
      hasActionOutcomeEnvelopeProvider: true,
      terminalAdmissionProviderIds: [
        "finance-research.arrowhedge.action-outcome-envelope.v1",
      ],
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
      requiresActionOutcomeEnvelope: true,
      hasActionOutcomeEnvelopeProvider: true,
      terminalAdmissionProviderIds: ["shared.crm.action-outcome-envelope.v1"],
    },
  ];
}

export function buildWriteTransportBindingCoverageSamplesFromCapabilities(
  inputs: readonly CapabilityWriteTransportBindingCoverageInput[],
  options: CapabilityWriteTransportBindingCoverageOptions = {},
): readonly WriteTransportBindingCoverageSample[] {
  return inputs.flatMap((input) => {
    const normalized = normalizeCapability(input.capability);
    const providerBindings = listTerminalAdmissionProviderBindings(
      input.capability,
    );
    const verifiedProviderIds = new Set(
      options.requireVerifiedTerminalAdmissionProviders === true
        ? verifyTerminalAdmissionProviderBindings(
            [input.capability],
            options.terminalAdmissionProviderManifests ?? [],
          ).bindings.flatMap((binding) =>
            binding.verified ? [binding.provider.providerId] : []
          )
        : providerBindings.map((binding) => binding.provider.providerId),
    );
    const providerIdsByWrite = new Map<string, string[]>();

    for (const binding of providerBindings) {
      if (!verifiedProviderIds.has(binding.provider.providerId)) continue;
      const key = writeContractKey(binding.writeInterface, binding.writeFields);
      const existing = providerIdsByWrite.get(key) ?? [];
      existing.push(binding.provider.providerId);
      providerIdsByWrite.set(key, existing);
    }

    return normalized.writes.map((write) => {
      const terminalAdmissionProviderIds = providerIdsByWrite.get(
        writeContractKey(write.interface, write.fields),
      ) ?? [];
      return {
        transportId: capabilityWriteTransportId(normalized.name, write),
        profile: input.profile,
        workflowName: input.workflowName,
        capability: normalized.name,
        capabilityWrites: true,
        bindingMode: input.bindingMode,
        hasBindingProvider: input.hasBindingProvider,
        hasBindingVerifier: input.hasBindingVerifier,
        requiresActionOutcomeEnvelope:
          input.requiresActionOutcomeEnvelope ?? true,
        hasActionOutcomeEnvelopeProvider:
          terminalAdmissionProviderIds.length > 0,
        terminalAdmissionProviderIds,
      };
    });
  });
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
  const outcomeEnvelopeRequired = evaluated.filter(
    (sample) => sample.requiresActionOutcomeEnvelope,
  );
  const outcomeEnvelopeCovered = outcomeEnvelopeRequired.filter(
    (sample) => sample.hasActionOutcomeEnvelopeProvider,
  );
  const missingActionOutcomeEnvelopeTransportIds = outcomeEnvelopeRequired
    .filter((sample) => !sample.hasActionOutcomeEnvelopeProvider)
    .map((sample) => sample.transportId);

  return {
    totalWriteCapableTransports: evaluated.length,
    verifiedRequiredTransports: byDisposition.required_verified,
    advisoryOnlyTransports: byDisposition.advisory_only,
    missingProviderTransports: byDisposition.missing_provider,
    coverageRate:
      evaluated.length === 0
        ? 1
        : byDisposition.required_verified / evaluated.length,
    outcomeEnvelopeRequiredTransports: outcomeEnvelopeRequired.length,
    outcomeEnvelopeCoveredTransports: outcomeEnvelopeCovered.length,
    outcomeEnvelopeMissingTransports:
      missingActionOutcomeEnvelopeTransportIds.length,
    outcomeEnvelopeCoverageRate:
      outcomeEnvelopeRequired.length === 0
        ? 1
        : outcomeEnvelopeCovered.length / outcomeEnvelopeRequired.length,
    missingActionOutcomeEnvelopeTransportIds,
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

export function buildArrowHedgeWriteBindingProofSourceBundle(
  input: ArrowHedgeWriteBindingProofSourceBundleInput = {},
): StrictThreeAxisProofPacketSourceBundle {
  const corpus = buildArrowHedgeWriteBindingReplayCorpus();
  const acceptedRef = requiredActionOutcomeRef(
    corpus.records,
    "wb_arrowhedge_clean_refresh_allowed_001",
  );
  const blockedRef = requiredActionOutcomeRef(
    corpus.records,
    "wb_arrowhedge_stale_artifact_policy_blocked_001",
  );
  const suite = buildArrowHedgeStateEvalSuite({
    tenantId: ARROWHEDGE_TENANT,
    observedAt: "2026-06-11T16:05:00.000Z" as Timestamp,
    source: "packages/evals/fixtures/write-binding-replay.v1.jsonl",
    sourceRecordIds: ["ticker:AAPL"],
    substrateRefs: {
      graphNodeIds: [],
      eventIds: ["evt_signal", "evt_risk", "evt_decision"],
      projectionIds: ["arrowhedge_cop"],
    },
    readSetValidation: {
      currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
      mode: "warn",
      issueCodes: ["stale_read_ref"],
    },
    actionOutcomeEnvelopes: [
      {
        scenarioId: "arrowhedge-terminal-outcome-partition",
        envelopeId: acceptedRef.id,
        runArm: "baseline",
        terminalOutcome: "accepted",
      },
      {
        scenarioId: "arrowhedge-terminal-outcome-partition",
        envelopeId: blockedRef.id,
        runArm: "substrate",
        terminalOutcome: "blocked",
      },
    ],
    operationalSamples: [],
  });

  return {
    source: {
      sourceId: "axis-a-arrowhedge-write-binding-replay",
      axis: "finance",
      eventCount: suite.events.length,
    },
    events: suite.events,
    ...(input.authorityRecoverySuite !== undefined
      ? { authorityRecoverySuite: input.authorityRecoverySuite }
      : {}),
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
    blocked_provider_certificate_missing: 0,
    blocked_provider_certificate_invalid: 0,
  } satisfies Record<WriteBindingReplayDecision, number>;

  let completeBindings = 0;
  let rejectedEvidenceReferences = 0;
  let actionOutcomeEnvelopeCount = 0;
  let acceptedActionOutcomeEnvelopes = 0;
  let blockedActionOutcomeEnvelopes = 0;
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
    actionOutcomeEnvelopeCount += 1;
    if (record.actionOutcomeEnvelope.terminalOutcome === "accepted") {
      acceptedActionOutcomeEnvelopes += 1;
    }
    if (record.actionOutcomeEnvelope.terminalOutcome === "blocked") {
      blockedActionOutcomeEnvelopes += 1;
    }
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
    providerCertificateMissing: byDecision.blocked_provider_certificate_missing,
    providerCertificateInvalid: byDecision.blocked_provider_certificate_invalid,
    rejectedEvidenceReferences,
    actionOutcomeEnvelopeCount,
    acceptedActionOutcomeEnvelopes,
    blockedActionOutcomeEnvelopes,
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

function requiredActionOutcomeRef(
  records: readonly WriteBindingReplayRecord[],
  recordId: string,
): StateRef {
  const record = records.find((candidate) => candidate.recordId === recordId);
  const ref = record?.actionOutcomeEnvelope.substrateRefs.find(
    (candidate) => candidate.kind === "action_outcome_envelope",
  );
  if (ref === undefined) {
    throw new Error(`write-binding replay record ${recordId} has no ActionOutcomeEnvelope ref`);
  }
  return ref;
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
  const admissionCertificate = buildAdmissionCertificateRef({
    certificateId: `cert_${input.recordId}`,
    artifact: input.artifact,
    evidenceAdmissionReviewIds: input.admissions.map(
      (review) => review.reviewId,
    ),
    tenantId: ARROWHEDGE_TENANT,
    workflowId,
    workflowName: "arrowhedge-write-binding-replay",
  });
  const invocationEvidenceBinding = buildInvocationEvidenceBinding({
    artifact: input.artifact,
    admissions: input.admissions,
    admissionCertificate:
      input.bindingKind === "missing" || input.bindingKind === "incomplete"
        ? undefined
        : admissionCertificate,
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
            admissionCertificates:
              invocationEvidenceBinding?.admissionCertificateId === undefined
                ? []
                : [admissionCertificate],
            evidenceAdmissionReviews: input.admissions.map((review) => ({
              reviewId: review.reviewId,
              tenantId: ARROWHEDGE_TENANT,
              decision: review.decision,
              authorityStatus: review.authorityStatus,
            })),
          },
        });
  const providerCertificate =
    validation.valid && input.bindingKind === "complete_advisory"
      ? ARROWHEDGE_TERMINAL_PROVIDER_CERTIFICATE
      : undefined;
  const providerCertificateStatusRef =
    providerCertificate === undefined
      ? undefined
      : ARROWHEDGE_TERMINAL_PROVIDER_STATUS_REF;
  const workflowActionOutcomeEnvelope = buildInvocationActionOutcomeEnvelope({
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
    evidenceDecision: validation,
    generatedAt: input.generatedAt,
    ...(providerCertificate !== undefined ? { providerCertificate } : {}),
    ...(providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef }
      : {}),
  });
  const actionOutcomeEnvelope = promoteWorkflowInvocationOutcomeEnvelope({
    workflowEnvelope: workflowActionOutcomeEnvelope,
    subject: input.artifact.subject,
    proposalReviewId: input.artifact.proposalReviewId,
    stateReviewArtifactHash: input.artifact.artifactHash,
    decidedBy: "workflow:write-binding-replay",
    substrateRefs: [
      stateRef("state_review_artifact", input.artifact.artifactId),
    ],
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
    actionOutcomeEnvelope,
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
  readonly admissionCertificate:
    | EvidenceBindingAdmissionCertificateRef
    | undefined;
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
    ...(input.admissionCertificate === undefined
      ? {}
      : {
          admissionCertificateId: input.admissionCertificate.certificateId,
          admissionCertificateDigest:
            input.admissionCertificate.certificateDigest,
        }),
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
    case "provider_certificate_missing":
      return "blocked_provider_certificate_missing";
    case "provider_certificate_invalid":
      return "blocked_provider_certificate_invalid";
  }
}

function uniqueInvariantClasses(
  values: readonly StateReviewInvariantClass[],
): readonly StateReviewInvariantClass[] {
  return [...new Set(values)];
}

function buildAdmissionCertificateRef(input: {
  readonly certificateId: string;
  readonly artifact: {
    readonly artifactId: string;
    readonly artifactHash: string;
  };
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly tenantId: TenantId;
  readonly workflowId: string;
  readonly workflowName: string;
}): EvidenceBindingAdmissionCertificateRef {
  const unsigned = {
    certificateId: input.certificateId,
    stateReviewArtifactId: input.artifact.artifactId,
    stateReviewArtifactHash: input.artifact.artifactHash,
    evidenceAdmissionReviewIds: [...input.evidenceAdmissionReviewIds],
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    policyVersion: "policy.write-binding.v1",
    revocationEpoch: 0,
    executionIdentity: `workflow-runtime:${input.workflowName}`,
    validFrom: "2026-06-11T15:55:00.000Z",
    validUntil: "2026-06-12T16:00:00.000Z",
  } satisfies Omit<
    EvidenceBindingAdmissionCertificateRef,
    "certificateDigest"
  >;

  return {
    ...unsigned,
    certificateDigest: digestAdmissionCertificate(unsigned),
  };
}

function buildAdmissionCertificateRefFromRecord(
  record: WriteBindingReplayRecord,
): EvidenceBindingAdmissionCertificateRef | undefined {
  const binding = record.invocationEvidenceBinding;
  if (binding?.admissionCertificateId === undefined) return undefined;

  const certificate = buildAdmissionCertificateRef({
    certificateId: binding.admissionCertificateId,
    artifact: record.stateReviewArtifact,
    evidenceAdmissionReviewIds: binding.evidenceAdmissionReviewIds,
    tenantId: record.tenantId,
    workflowId: record.workflowId,
    workflowName: record.workflowName,
  });
  if (
    binding.admissionCertificateDigest !== undefined &&
    binding.admissionCertificateDigest !== certificate.certificateDigest
  ) {
    throw new Error(
      `admission certificate digest drift for ${record.recordId}: ${binding.admissionCertificateDigest} !== ${certificate.certificateDigest}`,
    );
  }
  return certificate;
}

function digestAdmissionCertificate(
  certificate: Omit<
    EvidenceBindingAdmissionCertificateRef,
    "certificateDigest"
  >,
): string {
  return createHash("sha256")
    .update(JSON.stringify(certificate))
    .digest("hex");
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

function capabilityWriteTransportId(
  capabilityName: string,
  write: WriteContract,
): string {
  const fields = write.fields.length === 0 ? "*" : write.fields.join(",");
  return `${capabilityName}:${write.interface}:${fields}`;
}

function writeContractKey(
  writeInterface: string,
  writeFields: readonly string[],
): string {
  return `${writeInterface}:${writeFields.join("\u0000")}`;
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
