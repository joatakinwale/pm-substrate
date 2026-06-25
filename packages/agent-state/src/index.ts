import type {
  TenantId,
  TerminalAdmissionProviderCertificateStatus,
  Timestamp,
} from "@pm/types";

import type { EvidenceAdmissionReview } from "./external-evidence.js";

export * from "./external-evidence.js";

export const STATE_REVIEW_ARTIFACT_SCHEMA_VERSION =
  "state-review-artifact.v1" as const;
export const ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION =
  "action-outcome-envelope.v1" as const;
export const STATE_REVIEW_EVENT_TYPE =
  "pm.agent_state.action_proposal_reviewed.v1" as const;
export const STATE_REVIEW_EVENT_SPEC_VERSION = "1.0" as const;

export type StateRefKind =
  | "event"
  | "graph_node"
  | "graph_edge"
  | "projection"
  | "workflow_run"
  | "continuity_checkpoint"
  | "capability_invocation"
  | "state_review_artifact"
  | "action_outcome_envelope"
  | "source_record"
  | "document";

export interface StateRef {
  readonly kind: StateRefKind;
  readonly id: string;
  readonly label?: string;
}

export interface StateConflict {
  readonly conflictType:
    | "source_authority_conflict"
    | "state_disagreement"
    | "stale_observation"
    | "workflow_position_conflict";
  readonly refs: readonly StateRef[];
  readonly message: string;
}

export interface RequiredRelatedRole {
  readonly role: string;
  readonly refKind?: StateRefKind;
}

export interface RelatedSubject {
  readonly role: string;
  readonly ref: StateRef;
}

export interface AllowedAction {
  readonly actionType: string;
  readonly label: string;
  readonly requiredRefs: readonly StateRef[];
  readonly requiredWorkflowPosition?: string;
  /** Multi-object preconditions: roles that must be bound on the proposal (OCEL-style qualified roles). */
  readonly requiredRelatedRoles?: readonly RequiredRelatedRole[];
}

export interface CurrentStateView {
  readonly tenantId: TenantId;
  readonly viewId: string;
  readonly subject: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authorityRule: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly sourceRefs: readonly StateRef[];
  readonly missingSources: readonly string[];
  readonly conflicts: readonly StateConflict[];
  readonly allowedActions: readonly AllowedAction[];
}

export interface ReadSetEntry {
  readonly ref: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authority: string;
  readonly projectionVersion?: number;
}

export interface ObservedReadSetEntry {
  readonly ref: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authority: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly source?: string;
  readonly tool?: string;
}

export interface ProposedAction {
  readonly tenantId: TenantId;
  readonly actionType: string;
  readonly subject: StateRef;
  /** Role-qualified secondary objects this action touches (multi-object preconditions). */
  readonly relatedSubjects?: readonly RelatedSubject[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readSet: readonly ReadSetEntry[];
  readonly observationContract?: ObservationContract;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
}

export type ReadSetValidationIssueCode =
  | "tenant_mismatch"
  | "subject_mismatch"
  | "action_not_allowed"
  | "missing_read_ref"
  | "stale_read_ref"
  | "current_view_conflict"
  | "authority_mismatch"
  | "projection_version_mismatch"
  | "workflow_position_mismatch"
  | "missing_related_object_role"
  | "related_object_role_mismatch";

export interface ReadSetValidationIssue {
  readonly code: ReadSetValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
}

export interface ReadSetValidationDecision {
  readonly valid: boolean;
  readonly mode: "warn";
  readonly issues: readonly ReadSetValidationIssue[];
}

export type ObservedReadSetValidationIssueCode =
  | "observed_but_undeclared"
  | "declared_but_unobserved"
  | "stale_observed_read"
  | "authority_mismatch"
  | "projection_version_drift"
  | "workflow_position_drift";

export interface ObservedReadSetValidationIssue {
  readonly code: ObservedReadSetValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
  readonly declaredIndex?: number;
  readonly observedIndex?: number;
}

export interface ObservedReadSetComparison {
  readonly valid: boolean;
  readonly mode: "warn";
  readonly declaredReadSet: readonly ReadSetEntry[];
  readonly observedReadSet: readonly ObservedReadSetEntry[];
  readonly issues: readonly ObservedReadSetValidationIssue[];
}

export interface ObservationContract {
  readonly tenantId: TenantId;
  readonly contractId: string;
  readonly subject: StateRef;
  readonly issuedAt: Timestamp;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authorityRule: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly requiredSourceRefs: readonly StateRef[];
  readonly declaredMissingSources: readonly string[];
  readonly declaredConflictCount: number;
  /** v2 fields (Arrowsmith v04): issuer, integrity, holder binding, and allowed use. All optional and backward compatible. */
  readonly issuer?: string;
  readonly integrityHash?: string;
  readonly holderBinding?: string;
  readonly allowedUse?: readonly string[];
  readonly redactionPolicy?: string;
  readonly revocationRef?: StateRef;
}

export type StateAssertionCode =
  | "required_source_refs_present"
  | "authority_rule_matches"
  | "freshness_window_current"
  | "projection_version_matches"
  | "workflow_position_matches"
  | "conflicts_declared"
  | "missing_sources_declared";

export type StateAssertionSeverity = "info" | "warn" | "fail";

export interface StateAssertion {
  readonly code: StateAssertionCode;
  readonly passed: boolean;
  readonly severity: StateAssertionSeverity;
  readonly message: string;
  readonly refs: readonly StateRef[];
}

export interface ObservationContractEvaluation {
  readonly valid: boolean;
  readonly contractId: string;
  readonly currentStateViewId: string;
  readonly evaluatedAt: Timestamp;
  readonly assertions: readonly StateAssertion[];
}

export type ActionProposalReviewMode = "warn";
export type ActionProposalReviewEnforcementMode = "advisory" | "blocking";
export type ActionProposalExecutionReason =
  | "advisory_warn_first_v1"
  | "blocking_policy_passed"
  | "blocking_policy_failed";
export type ActionProposalWarningSource =
  | "read_set"
  | "observation_contract"
  | "contract_binding";

export interface ActionProposalWarning {
  readonly source: ActionProposalWarningSource;
  readonly code: string;
  readonly severity: StateAssertionSeverity;
  readonly message: string;
  readonly refs: readonly StateRef[];
}

export interface ActionProposalExecutionDisposition {
  readonly allowed: boolean;
  readonly blocking: boolean;
  readonly enforcementMode: ActionProposalReviewEnforcementMode;
  readonly reason: ActionProposalExecutionReason;
  readonly warningCount: number;
}

export interface ActionProposalReviewOptions {
  readonly evaluatedAt?: Timestamp;
  readonly observationContract?: ObservationContract;
  readonly enforcementMode?: ActionProposalReviewEnforcementMode;
}

export interface ActionProposalReview {
  readonly tenantId: TenantId;
  readonly reviewId: string;
  readonly mode: ActionProposalReviewMode;
  readonly valid: boolean;
  readonly proposedAction: ProposedAction;
  readonly currentStateView: CurrentStateView;
  readonly observationContract: ObservationContract;
  readonly observationEvaluation: ObservationContractEvaluation;
  readonly readSetValidation: ReadSetValidationDecision;
  readonly warnings: readonly ActionProposalWarning[];
  readonly execution: ActionProposalExecutionDisposition;
}

export interface StateReviewTraceContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly spanId?: string;
  readonly parentReviewId?: string;
}

export interface StateReviewEventEnvelope {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly specversion: typeof STATE_REVIEW_EVENT_SPEC_VERSION;
  readonly time: Timestamp;
  readonly subject: string;
}

export interface StateReviewRelatedObject {
  readonly role: string;
  readonly ref: StateRef;
}

export type StateReviewProvenanceRelation =
  | "used"
  | "wasDerivedFrom"
  | "wasGeneratedBy"
  | "wasAssociatedWith"
  | "actedOnBehalfOf"
  | "hadPlan";

export interface StateReviewProvenanceLink {
  readonly relation: StateReviewProvenanceRelation;
  readonly id: string;
  readonly role?: string;
  readonly ref?: StateRef;
}

export interface StateReviewProvenance {
  readonly generatedBy: string;
  readonly used: readonly StateRef[];
  readonly derivedFrom: readonly StateRef[];
  readonly associatedAgent: string;
  readonly actedOnBehalfOf?: string;
  readonly planId?: string;
  readonly links: readonly StateReviewProvenanceLink[];
}

export type StateReviewTemporalMisalignmentPhase =
  | "none"
  | "observation_to_action"
  | "action_to_feedback"
  | "feedback_to_observation";

export type StateReviewInvariantClass =
  | "subject_identity"
  | "tenant_boundary"
  | "required_evidence"
  | "freshness_window"
  | "source_authority"
  | "projection_version"
  | "workflow_position"
  | "state_conflict"
  | "capability_contract";

export type StateReviewActionConsequence = "low" | "medium" | "high";
export type InvariantClassPolicyDecision = "advisory" | "blocking";

type CompleteStateReviewInvariantPolicyMatrix = Readonly<
  Record<
    StateReviewInvariantClass,
    Readonly<Record<StateReviewActionConsequence, InvariantClassPolicyDecision>>
  >
>;

export type StateReviewInvariantPolicyMatrix = Readonly<
  Partial<
    Record<
      StateReviewInvariantClass,
      Readonly<Partial<Record<StateReviewActionConsequence, InvariantClassPolicyDecision>>>
    >
  >
>;

export interface StateReviewInvariantPolicyDecisionEntry {
  readonly invariantClass: StateReviewInvariantClass;
  readonly consequence: StateReviewActionConsequence;
  readonly decision: InvariantClassPolicyDecision;
}

export interface StateReviewInvariantPolicyEvaluation {
  readonly consequence: StateReviewActionConsequence;
  readonly wouldBlock: boolean;
  readonly wouldBlockInvariantClasses: readonly StateReviewInvariantClass[];
  readonly advisoryInvariantClasses: readonly StateReviewInvariantClass[];
  readonly decisions: readonly StateReviewInvariantPolicyDecisionEntry[];
}

export const DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX = {
  subject_identity: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  tenant_boundary: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  required_evidence: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  freshness_window: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  source_authority: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  projection_version: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  workflow_position: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  state_conflict: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  capability_contract: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
} as const satisfies CompleteStateReviewInvariantPolicyMatrix;

export type ActionTerminalOutcome =
  | "accepted"
  | "blocked"
  | "rejected"
  | "held"
  | "superseded"
  | "escalated";

export type ActionOutcomeBlockingCauseSource =
  | "proposal_review"
  | "evidence_admission"
  | "policy"
  | "status_check"
  | "local_view";

export interface ActionOutcomeBlockingCause {
  readonly source: ActionOutcomeBlockingCauseSource;
  readonly code: string;
  readonly message: string;
  readonly refs: readonly StateRef[];
  readonly invariantClasses?: readonly StateReviewInvariantClass[];
}

export interface ActionOutcomeProviderCertificateStatusRef {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly status: TerminalAdmissionProviderCertificateStatus;
  readonly statusSequence: number;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: Timestamp | string;
  readonly checkedAt: Timestamp | string;
}

export interface ActionOutcomeEnvelope {
  readonly schemaVersion: typeof ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly statusCheckRefs: readonly StateRef[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly policyTransitionRef?: StateRef;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly decidedBy: string;
  readonly blockingCauses: readonly ActionOutcomeBlockingCause[];
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
  readonly outcomeHash: string;
}

export type ActionOutcomeEnvelopeHashPayload = Omit<
  ActionOutcomeEnvelope,
  "outcomeHash"
>;

export interface ActionOutcomeEnvelopeInput {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly evidenceAdmissionReviewIds?: readonly string[];
  readonly statusCheckRefs?: readonly StateRef[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly policyTransitionRef?: StateRef;
  readonly requestedTerminalOutcome: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly decidedBy: string;
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
  readonly blockingCauses?: readonly ActionOutcomeBlockingCause[];
  readonly proposalReview?: ActionProposalReview;
  readonly evidenceAdmissions?: readonly EvidenceAdmissionReview[];
  readonly actionConsequence?: StateReviewActionConsequence;
}

export interface WorkflowInvocationActionOutcomeEnvelopeSource {
  readonly schemaVersion: "pm.workflow.action_outcome_envelope.v1";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted" | "blocked";
  readonly generatedAt: Timestamp | string;
  readonly tenantId: TenantId | string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly triggerEventId: string;
  readonly stateReviewArtifactId?: string;
  readonly stateReviewArtifactHash?: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly evidenceDecision: {
    readonly valid: boolean;
    readonly reason?: string;
  };
}

export interface WorkflowActionOutcomePromotionInput {
  readonly workflowEnvelope: WorkflowInvocationActionOutcomeEnvelopeSource;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash?: string;
  readonly decidedBy?: string;
  readonly statusCheckRefs?: readonly StateRef[];
  readonly policyTransitionRef?: StateRef;
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
  readonly blockingCauses?: readonly ActionOutcomeBlockingCause[];
}

export type ActionOutcomePartitionReason =
  | "first_terminal_outcome"
  | "idempotent_duplicate"
  | "candidate_hash_invalid"
  | "incumbent_hash_invalid"
  | "terminal_outcome_conflict";

export interface ActionOutcomePartitionDecision {
  readonly accepted: boolean;
  readonly reason: ActionOutcomePartitionReason;
  readonly candidate: ActionOutcomeEnvelope;
  readonly incumbent?: ActionOutcomeEnvelope;
  readonly candidateHashValidation: StateReviewArtifactHashValidation;
  readonly incumbentHashValidation?: StateReviewArtifactHashValidation;
  readonly message: string;
}

export type ActionOutcomeTerminalIndexIssueCode = Exclude<
  ActionOutcomePartitionReason,
  "first_terminal_outcome" | "idempotent_duplicate"
>;

export interface ActionOutcomeTerminalIndexIssue {
  readonly code: ActionOutcomeTerminalIndexIssueCode;
  readonly key: string;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly candidate: ActionOutcomeEnvelope;
  readonly incumbent?: ActionOutcomeEnvelope;
  readonly candidateHashValidation: StateReviewArtifactHashValidation;
  readonly incumbentHashValidation?: StateReviewArtifactHashValidation;
  readonly message: string;
}

export interface ActionOutcomeTerminalIndexEntry {
  readonly key: string;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly envelope: ActionOutcomeEnvelope;
  readonly replayCount: number;
  readonly substrateRefs: readonly StateRef[];
}

export interface ActionOutcomeTerminalIndex {
  readonly valid: boolean;
  readonly entries: readonly ActionOutcomeTerminalIndexEntry[];
  readonly issues: readonly ActionOutcomeTerminalIndexIssue[];
}

export interface LocalStateField {
  readonly value: unknown;
  readonly refs: readonly StateRef[];
  readonly authority?: string;
  readonly observedAt?: Timestamp;
  readonly validUntil?: Timestamp;
}

export interface LocalStateSection {
  readonly tenantId: TenantId;
  readonly sectionId: string;
  readonly role: string;
  readonly subject: StateRef;
  readonly fields: Readonly<Record<string, LocalStateField>>;
}

export interface LocalViewOverlapConflict {
  readonly field: string;
  readonly sectionIds: readonly string[];
  readonly refs: readonly StateRef[];
  readonly values: readonly unknown[];
  readonly message: string;
}

export interface LocalViewObstructionArtifact {
  readonly artifactId: string;
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly generatedAt: Timestamp;
  readonly sectionIds: readonly string[];
  readonly conflicts: readonly LocalViewOverlapConflict[];
  readonly allowedAction: "request_resolution";
}

export interface LocalViewGlobalProjection {
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly generatedAt: Timestamp;
  readonly sectionIds: readonly string[];
  readonly fields: Readonly<Record<string, LocalStateField>>;
}

export type LocalViewEvaluation =
  | {
      readonly kind: "global_projection";
      readonly projection: LocalViewGlobalProjection;
    }
  | {
      readonly kind: "obstruction";
      readonly obstruction: LocalViewObstructionArtifact;
    };

export interface LocalViewEvaluationOptions {
  readonly artifactId?: string;
  readonly generatedAt: Timestamp;
  readonly requiredFields?: readonly string[];
}

export type ActionOutcomeProjectionRole =
  | "risk_officer"
  | "project_manager"
  | "auditor"
  | "operator";

export interface ActionOutcomeInvariantCore {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly statusCheckRefs: readonly StateRef[];
  readonly blockingCauseCodes: readonly string[];
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
  readonly outcomeHash: string;
}

export interface ActionOutcomeRoleProjection {
  readonly role: ActionOutcomeProjectionRole;
  readonly core: ActionOutcomeInvariantCore;
  readonly visibleBlockingCauses: readonly ActionOutcomeBlockingCause[];
}

export interface ActionOutcomeProjectionValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface StateReviewArtifactMetadataInput {
  readonly temporalMisalignmentPhase?: StateReviewTemporalMisalignmentPhase;
  readonly invariantClasses?: readonly StateReviewInvariantClass[];
  readonly scenarioId?: string;
  readonly fixtureId?: string;
  readonly clientSurface?: string;
  readonly provider?: string;
  readonly sessionId?: string;
  readonly workflowRunId?: string;
  /** Trajectory-level run grouping: artifacts sharing a runGroupId form one long-horizon run (frontier item 8). */
  readonly runGroupId?: string;
  readonly evalEventIds?: readonly string[];
  readonly observedReadSet?: readonly ObservedReadSetEntry[];
  readonly observedReadSetComparison?: ObservedReadSetComparison;
  /** External evidence admission reviews consumed by this action review (frontier item 1). */
  readonly evidenceAdmissions?: readonly EvidenceAdmissionReview[];
}

export interface StateReviewArtifactMetadata
  extends StateReviewArtifactMetadataInput {
  readonly temporalMisalignmentPhase: StateReviewTemporalMisalignmentPhase;
  readonly invariantClasses: readonly StateReviewInvariantClass[];
}

export interface StateReviewArtifact {
  readonly schemaVersion: typeof STATE_REVIEW_ARTIFACT_SCHEMA_VERSION;
  readonly artifactId: string;
  readonly generatedAt: Timestamp;
  readonly eventEnvelope: StateReviewEventEnvelope;
  readonly traceContext?: StateReviewTraceContext;
  readonly relatedObjects: readonly StateReviewRelatedObject[];
  readonly provenance: StateReviewProvenance;
  readonly metadata: StateReviewArtifactMetadata;
  readonly review: ActionProposalReview;
  readonly artifactHash: string;
}

export type StateReviewArtifactHashPayload = Omit<
  StateReviewArtifact,
  "artifactHash"
>;

export interface StateReviewArtifactOptions {
  readonly artifactId?: string;
  readonly generatedAt?: Timestamp;
  readonly source?: string;
  readonly eventType?: string;
  readonly traceContext?: StateReviewTraceContext;
  readonly relatedObjects?: readonly StateReviewRelatedObject[];
  readonly provenanceLinks?: readonly StateReviewProvenanceLink[];
  readonly actedOnBehalfOf?: string;
  readonly planId?: string;
  readonly metadata?: StateReviewArtifactMetadataInput;
}

export interface StateReviewArtifactHashValidation {
  readonly valid: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export interface StateReviewArtifactImportIssue {
  readonly path: string;
  readonly message: string;
}

export interface StateReviewArtifactImportResult {
  readonly valid: boolean;
  readonly artifact?: StateReviewArtifact;
  readonly hashValidation?: StateReviewArtifactHashValidation;
  readonly issues: readonly StateReviewArtifactImportIssue[];
}

export interface StateReviewArtifactContinuityPayloadOptions {
  readonly supersedes?: readonly string[];
  readonly contradictedBy?: readonly string[];
}

export interface EvidenceLinkedContinuityPayload
  extends Readonly<Record<string, unknown>> {
  readonly sourceRefs: readonly StateRef[];
  readonly validUntil?: Timestamp;
  readonly supersedes: readonly string[];
  readonly contradictedBy: readonly string[];
  readonly authorityRule: string;
  readonly currentStateViewId: string;
}

export interface StateReviewArtifactContinuityPayload
  extends EvidenceLinkedContinuityPayload {
  readonly stateReviewArtifactId: string;
  readonly stateReviewArtifactHash: string;
  readonly reviewId: string;
  readonly observationContractId: string;
  readonly valid: boolean;
  readonly warningCodes: readonly string[];
}

export function stateRef(kind: StateRefKind, id: string, label?: string): StateRef {
  return label === undefined ? { kind, id } : { kind, id, label };
}

export function evaluateStateReviewInvariantPolicy(
  invariantClasses: readonly StateReviewInvariantClass[],
  consequence: StateReviewActionConsequence,
  matrix: StateReviewInvariantPolicyMatrix =
    DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX,
): StateReviewInvariantPolicyEvaluation {
  const decisions = uniqueStrings(invariantClasses).map(
    (invariantClass): StateReviewInvariantPolicyDecisionEntry => ({
      invariantClass,
      consequence,
      decision:
        matrix[invariantClass]?.[consequence] ??
        DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX[invariantClass][consequence],
    }),
  );
  const wouldBlockInvariantClasses = decisions
    .filter((decision) => decision.decision === "blocking")
    .map((decision) => decision.invariantClass);
  const advisoryInvariantClasses = decisions
    .filter((decision) => decision.decision === "advisory")
    .map((decision) => decision.invariantClass);

  return {
    consequence,
    wouldBlock: wouldBlockInvariantClasses.length > 0,
    wouldBlockInvariantClasses,
    advisoryInvariantClasses,
    decisions,
  };
}

export function buildActionOutcomeEnvelope(
  input: ActionOutcomeEnvelopeInput,
): ActionOutcomeEnvelope {
  const actionConsequence = input.actionConsequence ?? "high";
  const evidenceAdmissions = input.evidenceAdmissions ?? [];
  const evidenceAdmissionReviewIds = uniqueStrings([
    ...(input.evidenceAdmissionReviewIds ?? []),
    ...evidenceAdmissions.map((review) => review.reviewId),
  ]);
  const blockingCauses = dedupeBlockingCauses([
    ...(input.blockingCauses ?? []),
    ...blockingCausesFromProposalReview(input.proposalReview),
    ...blockingCausesFromEvidenceAdmissions(evidenceAdmissions, actionConsequence),
  ]);
  const terminalOutcome =
    input.requestedTerminalOutcome === "accepted" && blockingCauses.length > 0
      ? "blocked"
      : input.requestedTerminalOutcome;
  const payload: ActionOutcomeEnvelopeHashPayload = {
    schemaVersion: ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION,
    tenantId: input.tenantId,
    actionId: input.actionId,
    subject: input.subject,
    proposalReviewId: input.proposalReviewId,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    evidenceAdmissionReviewIds,
    statusCheckRefs: uniqueStateRefs(input.statusCheckRefs ?? []),
    ...(input.providerCertificateId !== undefined
      ? { providerCertificateId: input.providerCertificateId }
      : {}),
    ...(input.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: input.providerCertificateDigest }
      : {}),
    ...(input.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: input.providerCertificateStatusRef }
      : {}),
    ...(input.policyTransitionRef !== undefined
      ? { policyTransitionRef: input.policyTransitionRef }
      : {}),
    terminalOutcome,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    blockingCauses,
    evidenceRefs: uniqueStateRefs([
      ...(input.evidenceRefs ?? []),
      ...evidenceAdmissions.flatMap((review) => [
        ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
        ...review.evidence.refs,
      ]),
    ]),
    substrateRefs: uniqueStateRefs(input.substrateRefs ?? []),
  };

  return {
    ...payload,
    outcomeHash: computeActionOutcomeEnvelopeHash(payload),
  };
}

export function promoteWorkflowInvocationOutcomeEnvelope(
  input: WorkflowActionOutcomePromotionInput,
): ActionOutcomeEnvelope {
  const workflowEnvelope = input.workflowEnvelope;
  const stateReviewArtifactHash =
    input.stateReviewArtifactHash ?? workflowEnvelope.stateReviewArtifactHash;

  if (stateReviewArtifactHash === undefined || stateReviewArtifactHash.trim() === "") {
    throw new Error(
      "workflow outcome promotion requires a stateReviewArtifactHash from the workflow envelope or promotion context",
    );
  }
  if (input.proposalReviewId.trim() === "") {
    throw new Error("workflow outcome promotion requires a proposalReviewId");
  }
  if (
    workflowEnvelope.terminalOutcome === "accepted" &&
    workflowEnvelope.evidenceDecision.valid === false
  ) {
    throw new Error(
      "workflow outcome promotion cannot turn an invalid evidence decision into an accepted terminal outcome",
    );
  }
  if (
    workflowEnvelope.terminalOutcome === "accepted" &&
    (input.blockingCauses ?? []).length > 0
  ) {
    throw new Error(
      "workflow outcome promotion cannot attach blocking causes to an accepted terminal outcome",
    );
  }
  if (
    workflowEnvelope.terminalOutcome === "blocked" &&
    workflowEnvelope.evidenceDecision.valid === true &&
    (input.blockingCauses ?? []).length === 0
  ) {
    throw new Error(
      "workflow outcome promotion requires a blocking cause for a blocked terminal outcome with a valid evidence decision",
    );
  }

  const blockingCauses = dedupeBlockingCauses([
    ...(input.blockingCauses ?? []),
    ...workflowBlockingCauses(workflowEnvelope),
  ]);
  const workflowEnvelopeRef = stateRef(
    "action_outcome_envelope",
    workflowEnvelope.envelopeId,
    "Workflow action outcome envelope",
  );
  const workflowRunRef = stateRef(
    "workflow_run",
    workflowEnvelope.workflowId,
    workflowEnvelope.workflowName,
  );
  const capabilityInvocationRef = stateRef(
    "capability_invocation",
    `${workflowEnvelope.workflowId}:${workflowEnvelope.workflowVersion}:${workflowEnvelope.nodeId}:${workflowEnvelope.triggerEventId}`,
    workflowEnvelope.capability,
  );
  const stateReviewArtifactRef =
    workflowEnvelope.stateReviewArtifactId === undefined
      ? undefined
      : stateRef("state_review_artifact", workflowEnvelope.stateReviewArtifactId);

  return buildActionOutcomeEnvelope({
    tenantId: workflowEnvelope.tenantId as TenantId,
    actionId: workflowEnvelope.actionId,
    subject: input.subject,
    proposalReviewId: input.proposalReviewId,
    stateReviewArtifactHash,
    evidenceAdmissionReviewIds: workflowEnvelope.evidenceAdmissionReviewIds,
    ...(input.statusCheckRefs !== undefined
      ? { statusCheckRefs: input.statusCheckRefs }
      : {}),
    ...(workflowEnvelope.providerCertificateId !== undefined
      ? { providerCertificateId: workflowEnvelope.providerCertificateId }
      : {}),
    ...(workflowEnvelope.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: workflowEnvelope.providerCertificateDigest }
      : {}),
    ...(workflowEnvelope.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: workflowEnvelope.providerCertificateStatusRef }
      : {}),
    ...(input.policyTransitionRef !== undefined
      ? { policyTransitionRef: input.policyTransitionRef }
      : {}),
    requestedTerminalOutcome: workflowEnvelope.terminalOutcome,
    decidedAt: workflowEnvelope.generatedAt as Timestamp,
    decidedBy: input.decidedBy ?? "workflow:evidence-binding-gate",
    ...(input.evidenceRefs !== undefined
      ? { evidenceRefs: input.evidenceRefs }
      : {}),
    substrateRefs: uniqueStateRefs([
      ...(input.substrateRefs ?? []),
      workflowEnvelopeRef,
      workflowRunRef,
      capabilityInvocationRef,
      ...(stateReviewArtifactRef === undefined ? [] : [stateReviewArtifactRef]),
    ]),
    blockingCauses,
  });
}

export function computeActionOutcomeEnvelopeHash(
  envelope: ActionOutcomeEnvelopeHashPayload,
): string {
  return fingerprint64(canonicalStringify(envelope));
}

export function verifyActionOutcomeEnvelopeHash(
  envelope: ActionOutcomeEnvelope,
): StateReviewArtifactHashValidation {
  const { outcomeHash, ...payload } = envelope;
  const expectedHash = computeActionOutcomeEnvelopeHash(payload);

  return {
    valid: outcomeHash === expectedHash,
    expectedHash,
    actualHash: outcomeHash,
  };
}

export function actionOutcomeTerminalKey(
  tenantId: TenantId,
  actionId: string,
): string {
  return `${tenantId}:${actionId}`;
}

export function admitActionOutcomeEnvelope(
  existing: readonly ActionOutcomeEnvelope[],
  candidate: ActionOutcomeEnvelope,
): ActionOutcomePartitionDecision {
  const candidateHashValidation = verifyActionOutcomeEnvelopeHash(candidate);
  if (!candidateHashValidation.valid) {
    return {
      accepted: false,
      reason: "candidate_hash_invalid",
      candidate,
      candidateHashValidation,
      message: `Action ${candidate.actionId} terminal outcome envelope hash ${candidateHashValidation.actualHash} does not match recomputed hash ${candidateHashValidation.expectedHash}.`,
    };
  }

  const incumbent = existing.find(
    (item) =>
      item.tenantId === candidate.tenantId && item.actionId === candidate.actionId,
  );

  if (incumbent === undefined) {
    return {
      accepted: true,
      reason: "first_terminal_outcome",
      candidate,
      candidateHashValidation,
      message: `Action ${candidate.actionId} has no prior terminal outcome.`,
    };
  }

  const incumbentHashValidation = verifyActionOutcomeEnvelopeHash(incumbent);
  if (!incumbentHashValidation.valid) {
    return {
      accepted: false,
      reason: "incumbent_hash_invalid",
      candidate,
      incumbent,
      candidateHashValidation,
      incumbentHashValidation,
      message: `Action ${candidate.actionId} already has an invalid incumbent terminal outcome envelope hash ${incumbentHashValidation.actualHash}.`,
    };
  }

  if (incumbent.outcomeHash === candidate.outcomeHash) {
    return {
      accepted: true,
      reason: "idempotent_duplicate",
      candidate,
      incumbent,
      candidateHashValidation,
      incumbentHashValidation,
      message: `Action ${candidate.actionId} already has the same terminal outcome envelope.`,
    };
  }

  return {
    accepted: false,
    reason: "terminal_outcome_conflict",
    candidate,
    incumbent,
    candidateHashValidation,
    incumbentHashValidation,
    message: `Action ${candidate.actionId} already ended as ${incumbent.terminalOutcome}; cannot also end as ${candidate.terminalOutcome}.`,
  };
}

export function buildActionOutcomeTerminalIndex(
  envelopes: readonly ActionOutcomeEnvelope[],
): ActionOutcomeTerminalIndex {
  const admitted: ActionOutcomeEnvelope[] = [];
  const replayCounts = new Map<string, number>();
  const issues: ActionOutcomeTerminalIndexIssue[] = [];

  for (const candidate of envelopes) {
    const decision = admitActionOutcomeEnvelope(admitted, candidate);
    const key = actionOutcomeTerminalKey(candidate.tenantId, candidate.actionId);

    if (decision.accepted) {
      if (decision.reason === "first_terminal_outcome") {
        admitted.push(candidate);
        replayCounts.set(key, 1);
      } else {
        replayCounts.set(key, (replayCounts.get(key) ?? 1) + 1);
      }
      continue;
    }
    if (
      decision.reason === "first_terminal_outcome" ||
      decision.reason === "idempotent_duplicate"
    ) {
      continue;
    }

    issues.push({
      code: decision.reason,
      key,
      tenantId: candidate.tenantId,
      actionId: candidate.actionId,
      candidate,
      ...(decision.incumbent !== undefined ? { incumbent: decision.incumbent } : {}),
      candidateHashValidation: decision.candidateHashValidation,
      ...(decision.incumbentHashValidation !== undefined
        ? { incumbentHashValidation: decision.incumbentHashValidation }
        : {}),
      message: decision.message,
    });
  }

  return {
    valid: issues.length === 0,
    entries: admitted.map((envelope) => {
      const key = actionOutcomeTerminalKey(envelope.tenantId, envelope.actionId);
      return {
        key,
        tenantId: envelope.tenantId,
        actionId: envelope.actionId,
        envelope,
        replayCount: replayCounts.get(key) ?? 1,
        substrateRefs: envelope.substrateRefs,
      };
    }),
    issues,
  };
}

export function recoverActionOutcomeBySubstrateRef(
  envelopes: readonly ActionOutcomeEnvelope[],
  ref: StateRef,
): ActionOutcomeEnvelope | undefined {
  return envelopes.find((envelope) =>
    envelope.substrateRefs.some((candidate) => sameStateRef(candidate, ref)),
  );
}

export function evaluateLocalStateSections(
  sections: readonly LocalStateSection[],
  options: LocalViewEvaluationOptions,
): LocalViewEvaluation {
  const first = sections[0];
  if (first === undefined) {
    const tenantId = "" as TenantId;
    return {
      kind: "obstruction",
      obstruction: {
        artifactId: options.artifactId ?? "local_view_obstruction:empty",
        tenantId,
        subject: stateRef("document", "unknown"),
        generatedAt: options.generatedAt,
        sectionIds: [],
        conflicts: [
          {
            field: "$sections",
            sectionIds: [],
            refs: [],
            values: [],
            message: "No local sections were supplied; a global projection cannot be formed.",
          },
        ],
        allowedAction: "request_resolution",
      },
    };
  }

  const conflicts: LocalViewOverlapConflict[] = [];
  for (const section of sections) {
    if (section.tenantId !== first.tenantId) {
      conflicts.push({
        field: "$tenantId",
        sectionIds: [first.sectionId, section.sectionId],
        refs: [first.subject, section.subject],
        values: [first.tenantId, section.tenantId],
        message: `Local section ${section.sectionId} has tenant ${section.tenantId}; expected ${first.tenantId}.`,
      });
    }
    if (!sameStateRef(section.subject, first.subject)) {
      conflicts.push({
        field: "$subject",
        sectionIds: [first.sectionId, section.sectionId],
        refs: [first.subject, section.subject],
        values: [formatStateRef(first.subject), formatStateRef(section.subject)],
        message: `Local section ${section.sectionId} describes ${formatStateRef(section.subject)}; expected ${formatStateRef(first.subject)}.`,
      });
    }
  }

  const fields = uniqueStrings([
    ...(options.requiredFields ?? []),
    ...sections.flatMap((section) => Object.keys(section.fields)),
  ]);
  const projectionFields: Record<string, LocalStateField> = {};

  for (const field of fields) {
    const present = sections
      .map((section) => ({ section, value: section.fields[field] }))
      .filter(
        (entry): entry is { section: LocalStateSection; value: LocalStateField } =>
          entry.value !== undefined,
      );
    if (present.length === 0) continue;

    const valuesByKey = new Map<string, typeof present>();
    for (const entry of present) {
      const key = canonicalStringify(entry.value.value);
      const bucket = valuesByKey.get(key) ?? [];
      bucket.push(entry);
      valuesByKey.set(key, bucket);
    }

    if (valuesByKey.size > 1) {
      conflicts.push({
        field,
        sectionIds: present.map((entry) => entry.section.sectionId),
        refs: uniqueStateRefs(present.flatMap((entry) => entry.value.refs)),
        values: present.map((entry) => entry.value.value),
        message: `Local sections disagree on ${field}; no global projection is admissible until the overlap is resolved.`,
      });
      continue;
    }

    projectionFields[field] = present[0]!.value;
  }

  if (conflicts.length > 0) {
    return {
      kind: "obstruction",
      obstruction: {
        artifactId:
          options.artifactId ??
          `local_view_obstruction:${first.subject.kind}:${first.subject.id}`,
        tenantId: first.tenantId,
        subject: first.subject,
        generatedAt: options.generatedAt,
        sectionIds: sections.map((section) => section.sectionId),
        conflicts,
        allowedAction: "request_resolution",
      },
    };
  }

  return {
    kind: "global_projection",
    projection: {
      tenantId: first.tenantId,
      subject: first.subject,
      generatedAt: options.generatedAt,
      sectionIds: sections.map((section) => section.sectionId),
      fields: projectionFields,
    },
  };
}

export function projectActionOutcomeEnvelopeForRole(
  envelope: ActionOutcomeEnvelope,
  role: ActionOutcomeProjectionRole,
): ActionOutcomeRoleProjection {
  return {
    role,
    core: {
      tenantId: envelope.tenantId,
      actionId: envelope.actionId,
      subject: envelope.subject,
      terminalOutcome: envelope.terminalOutcome,
      proposalReviewId: envelope.proposalReviewId,
      stateReviewArtifactHash: envelope.stateReviewArtifactHash,
      ...(envelope.providerCertificateId !== undefined
        ? { providerCertificateId: envelope.providerCertificateId }
        : {}),
      ...(envelope.providerCertificateDigest !== undefined
        ? { providerCertificateDigest: envelope.providerCertificateDigest }
        : {}),
      ...(envelope.providerCertificateStatusRef !== undefined
        ? { providerCertificateStatusRef: envelope.providerCertificateStatusRef }
        : {}),
      evidenceAdmissionReviewIds: envelope.evidenceAdmissionReviewIds,
      statusCheckRefs: envelope.statusCheckRefs,
      blockingCauseCodes: envelope.blockingCauses.map((cause) => cause.code),
      evidenceRefs: envelope.evidenceRefs,
      substrateRefs: envelope.substrateRefs,
      outcomeHash: envelope.outcomeHash,
    },
    visibleBlockingCauses: envelope.blockingCauses,
  };
}

export function validateActionOutcomeRoleProjection(
  envelope: ActionOutcomeEnvelope,
  projection: ActionOutcomeRoleProjection,
): ActionOutcomeProjectionValidation {
  const issues: string[] = [];
  const core = projection.core;

  if (core.tenantId !== envelope.tenantId) issues.push("tenantId changed");
  if (core.actionId !== envelope.actionId) issues.push("actionId changed");
  if (!sameStateRef(core.subject, envelope.subject)) issues.push("subject changed");
  if (core.terminalOutcome !== envelope.terminalOutcome) {
    issues.push("terminalOutcome changed");
  }
  if (core.proposalReviewId !== envelope.proposalReviewId) {
    issues.push("proposalReviewId changed");
  }
  if (core.stateReviewArtifactHash !== envelope.stateReviewArtifactHash) {
    issues.push("stateReviewArtifactHash changed");
  }
  if (core.providerCertificateId !== envelope.providerCertificateId) {
    issues.push("providerCertificateId changed");
  }
  if (core.providerCertificateDigest !== envelope.providerCertificateDigest) {
    issues.push("providerCertificateDigest changed");
  }
  if (
    canonicalStringify(core.providerCertificateStatusRef) !==
    canonicalStringify(envelope.providerCertificateStatusRef)
  ) {
    issues.push("providerCertificateStatusRef changed");
  }
  if (!sameStringSet(core.evidenceAdmissionReviewIds, envelope.evidenceAdmissionReviewIds)) {
    issues.push("evidenceAdmissionReviewIds changed");
  }
  if (!sameStateRefSet(core.statusCheckRefs, envelope.statusCheckRefs)) {
    issues.push("statusCheckRefs changed");
  }
  if (!sameStringSet(core.blockingCauseCodes, envelope.blockingCauses.map((cause) => cause.code))) {
    issues.push("blockingCauseCodes changed");
  }
  if (!sameStateRefSet(core.evidenceRefs, envelope.evidenceRefs)) {
    issues.push("evidenceRefs changed");
  }
  if (!sameStateRefSet(core.substrateRefs, envelope.substrateRefs)) {
    issues.push("substrateRefs changed");
  }
  if (core.outcomeHash !== envelope.outcomeHash) issues.push("outcomeHash changed");
  if (
    envelope.terminalOutcome === "blocked" &&
    projection.visibleBlockingCauses.length === 0
  ) {
    issues.push("blocked projection hides blocking causes");
  }

  return { valid: issues.length === 0, issues };
}

export function buildReadSetFromCurrentStateView(
  view: CurrentStateView,
  authority: string,
): readonly ReadSetEntry[] {
  return view.sourceRefs.map((ref) => {
    const entry: ReadSetEntry = {
      ref,
      observedAt: view.observedAt,
      authority,
      ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
      ...(view.projectionVersion !== undefined
        ? { projectionVersion: view.projectionVersion }
        : {}),
    };
    return entry;
  });
}

export function compareObservedReadSetToDeclared(
  declaredReadSet: readonly ReadSetEntry[],
  observedReadSet: readonly ObservedReadSetEntry[],
  view: Pick<CurrentStateView, "authorityRule" | "projectionVersion" | "workflowPosition">,
  proposedAt: Timestamp,
): ObservedReadSetComparison {
  const issues: ObservedReadSetValidationIssue[] = [];

  for (const [index, observedEntry] of observedReadSet.entries()) {
    const declaredIndex = declaredReadSet.findIndex((entry) =>
      sameStateRef(entry.ref, observedEntry.ref),
    );
    const declaredEntry =
      declaredIndex === -1 ? undefined : declaredReadSet[declaredIndex];
    if (declaredEntry === undefined) {
      issues.push({
        code: "observed_but_undeclared",
        path: `/observedReadSet/${index}/ref`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} was not declared in the proposal read set.`,
        ref: observedEntry.ref,
        observedIndex: index,
      });
    }
  }

  for (const [index, declaredEntry] of declaredReadSet.entries()) {
    if (!observedReadSet.some((entry) => sameStateRef(entry.ref, declaredEntry.ref))) {
      issues.push({
        code: "declared_but_unobserved",
        path: `/declaredReadSet/${index}/ref`,
        message: `Declared state ref ${formatStateRef(declaredEntry.ref)} was not observed by the tool/source read set.`,
        ref: declaredEntry.ref,
        declaredIndex: index,
      });
    }
  }

  for (const [index, observedEntry] of observedReadSet.entries()) {
    const declaredIndex = declaredReadSet.findIndex((entry) =>
      sameStateRef(entry.ref, observedEntry.ref),
    );
    const declaredEntry =
      declaredIndex === -1 ? undefined : declaredReadSet[declaredIndex];

    if (
      observedEntry.validUntil !== undefined &&
      isAfter(proposedAt, observedEntry.validUntil)
    ) {
      issues.push({
        code: "stale_observed_read",
        path: `/observedReadSet/${index}/validUntil`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} expired at ${observedEntry.validUntil} before action proposal at ${proposedAt}.`,
        ref: observedEntry.ref,
        ...(declaredIndex !== -1 ? { declaredIndex } : {}),
        observedIndex: index,
      });
    }

    if (declaredEntry === undefined) continue;

    const expectedAuthority = declaredEntry.authority;
    if (observedEntry.authority !== expectedAuthority) {
      issues.push({
        code: "authority_mismatch",
        path: `/observedReadSet/${index}/authority`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used authority ${observedEntry.authority}; expected ${expectedAuthority}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }

    const expectedProjectionVersion =
      declaredEntry.projectionVersion ?? view.projectionVersion;
    if (
      observedEntry.projectionVersion !== undefined &&
      expectedProjectionVersion !== undefined &&
      observedEntry.projectionVersion !== expectedProjectionVersion
    ) {
      issues.push({
        code: "projection_version_drift",
        path: `/observedReadSet/${index}/projectionVersion`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used projection version ${observedEntry.projectionVersion}; expected ${expectedProjectionVersion}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }

    if (
      observedEntry.workflowPosition !== undefined &&
      view.workflowPosition !== undefined &&
      observedEntry.workflowPosition !== view.workflowPosition
    ) {
      issues.push({
        code: "workflow_position_drift",
        path: `/observedReadSet/${index}/workflowPosition`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used workflow position ${observedEntry.workflowPosition}; current position is ${view.workflowPosition}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }
  }

  return {
    valid: issues.length === 0,
    mode: "warn",
    declaredReadSet,
    observedReadSet,
    issues,
  };
}

export function buildObservationContractFromCurrentStateView(
  view: CurrentStateView,
  issuedAt: Timestamp = view.observedAt,
): ObservationContract {
  return {
    tenantId: view.tenantId,
    contractId: `${view.viewId}:observation_contract`,
    subject: view.subject,
    issuedAt,
    observedAt: view.observedAt,
    ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
    authorityRule: view.authorityRule,
    ...(view.projectionVersion !== undefined
      ? { projectionVersion: view.projectionVersion }
      : {}),
    ...(view.workflowPosition !== undefined
      ? { workflowPosition: view.workflowPosition }
      : {}),
    requiredSourceRefs: view.sourceRefs,
    declaredMissingSources: view.missingSources,
    declaredConflictCount: view.conflicts.length,
  };
}

export function evaluateObservationContract(
  contract: ObservationContract,
  view: CurrentStateView,
  evaluatedAt: Timestamp,
): ObservationContractEvaluation {
  const missingRefs = contract.requiredSourceRefs.filter(
    (ref) => !view.sourceRefs.some((candidate) => sameStateRef(candidate, ref)),
  );
  const missingSourcesChanged = !sameStringSet(
    contract.declaredMissingSources,
    view.missingSources,
  );
  const conflictCountMatches =
    contract.declaredConflictCount === view.conflicts.length;
  const assertions: StateAssertion[] = [
    assertion({
      code: "required_source_refs_present",
      passed: missingRefs.length === 0 && view.missingSources.length === 0,
      severity: "fail",
      refs: missingRefs,
      message:
        missingRefs.length === 0 && view.missingSources.length === 0
          ? "All required observation source refs are present."
          : `Observation is missing ${missingRefs.length} required refs and ${view.missingSources.length} source declarations.`,
    }),
    assertion({
      code: "authority_rule_matches",
      passed: contract.authorityRule === view.authorityRule,
      severity: "fail",
      refs: [view.subject],
      message:
        contract.authorityRule === view.authorityRule
          ? "Observation authority still matches the current state view."
          : `Observation authority ${contract.authorityRule} differs from current authority ${view.authorityRule}.`,
    }),
    assertion({
      code: "freshness_window_current",
      passed:
        contract.validUntil === undefined || !isAfter(evaluatedAt, contract.validUntil),
      severity: "warn",
      refs: contract.requiredSourceRefs,
      message:
        contract.validUntil === undefined || !isAfter(evaluatedAt, contract.validUntil)
          ? "Observation freshness window is still current."
          : `Observation freshness expired at ${contract.validUntil}.`,
    }),
    assertion({
      code: "projection_version_matches",
      passed:
        contract.projectionVersion === undefined ||
        view.projectionVersion === undefined ||
        contract.projectionVersion === view.projectionVersion,
      severity: "warn",
      refs: [view.subject],
      message:
        contract.projectionVersion === undefined ||
        view.projectionVersion === undefined ||
        contract.projectionVersion === view.projectionVersion
          ? "Projection version still matches the observation contract."
          : `Observation projection version ${contract.projectionVersion} differs from current version ${view.projectionVersion}.`,
    }),
    assertion({
      code: "workflow_position_matches",
      passed:
        contract.workflowPosition === undefined ||
        view.workflowPosition === undefined ||
        contract.workflowPosition === view.workflowPosition,
      severity: "warn",
      refs: [view.subject],
      message:
        contract.workflowPosition === undefined ||
        view.workflowPosition === undefined ||
        contract.workflowPosition === view.workflowPosition
          ? "Workflow position still matches the observation contract."
          : `Observation workflow position ${contract.workflowPosition} differs from current position ${view.workflowPosition}.`,
    }),
    assertion({
      code: "conflicts_declared",
      passed: conflictCountMatches,
      severity: "warn",
      refs: view.conflicts.flatMap((conflict) => conflict.refs),
      message: conflictCountMatches
        ? "Current conflicts match the observation contract declaration."
        : `Observation declared ${contract.declaredConflictCount} conflicts; current view has ${view.conflicts.length}.`,
    }),
    assertion({
      code: "missing_sources_declared",
      passed: !missingSourcesChanged,
      severity: "warn",
      refs: [],
      message: !missingSourcesChanged
        ? "Missing-source declarations still match the observation contract."
        : "Current missing-source declarations differ from the observation contract.",
    }),
  ];

  return {
    valid: assertions.every((item) => item.passed),
    contractId: contract.contractId,
    currentStateViewId: view.viewId,
    evaluatedAt,
    assertions,
  };
}

export function reviewProposedActionAgainstCurrentState(
  action: ProposedAction,
  view: CurrentStateView,
  optionsOrEvaluatedAt: ActionProposalReviewOptions | Timestamp = {},
): ActionProposalReview {
  const options =
    typeof optionsOrEvaluatedAt === "string"
      ? { evaluatedAt: optionsOrEvaluatedAt }
      : optionsOrEvaluatedAt;
  const evaluatedAt = options.evaluatedAt ?? action.proposedAt;
  const enforcementMode = options.enforcementMode ?? "advisory";
  const observationContract =
    options.observationContract ??
    action.observationContract ??
    buildObservationContractFromCurrentStateView(view);
  const observationEvaluation = evaluateObservationContract(
    observationContract,
    view,
    evaluatedAt,
  );
  const readSetValidation = validateProposedActionReadSet(action, view);
  const contractBindingWarnings = validateObservationContractBinding(
    observationContract,
    action,
  );
  const warnings = [
    ...readSetValidation.issues.map((issue): ActionProposalWarning => ({
      source: "read_set",
      code: issue.code,
      severity: "warn",
      message: issue.message,
      refs: issue.ref ? [issue.ref] : [],
    })),
    ...observationEvaluation.assertions
      .filter((assertion) => !assertion.passed)
      .map((assertion): ActionProposalWarning => ({
        source: "observation_contract",
        code: assertion.code,
        severity: assertion.severity,
        message: assertion.message,
        refs: assertion.refs,
    })),
    ...contractBindingWarnings,
  ] as const;
  const blocking =
    enforcementMode === "blocking" &&
    (!readSetValidation.valid ||
      !observationEvaluation.valid ||
      contractBindingWarnings.length > 0);

  return {
    tenantId: action.tenantId,
    reviewId: `${view.viewId}:${action.actionType}:proposal_review`,
    mode: "warn",
    valid:
      readSetValidation.valid &&
      observationEvaluation.valid &&
      contractBindingWarnings.length === 0,
    proposedAction: action,
    currentStateView: view,
    observationContract,
    observationEvaluation,
    readSetValidation,
    warnings,
    execution: {
      allowed: enforcementMode === "advisory" || !blocking,
      blocking,
      enforcementMode,
      reason:
        enforcementMode === "advisory"
          ? "advisory_warn_first_v1"
          : blocking
            ? "blocking_policy_failed"
            : "blocking_policy_passed",
      warningCount: warnings.length,
    },
  };
}

/**
 * Compute the canonical integrity hash for an observation contract (v2
 * field). The hash covers every contract field except `integrityHash` itself.
 */
export function computeObservationContractIntegrityHash(
  contract: ObservationContract,
): string {
  const { integrityHash: _ignored, ...payload } = contract;
  return fingerprint64(canonicalStringify(payload));
}

export interface ObservationContractIntegrityValidation {
  readonly valid: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export function verifyObservationContractIntegrity(
  contract: ObservationContract,
): ObservationContractIntegrityValidation | undefined {
  if (contract.integrityHash === undefined) return undefined;
  const expectedHash = computeObservationContractIntegrityHash(contract);
  return {
    valid: contract.integrityHash === expectedHash,
    expectedHash,
    actualHash: contract.integrityHash,
  };
}

/**
 * Validate v2 observation-contract bindings against the proposed action:
 * holder binding (DPoP-style), allowed use, and integrity hash (Arrowsmith
 * v04). Contracts without v2 fields produce no warnings.
 */
export function validateObservationContractBinding(
  contract: ObservationContract,
  action: ProposedAction,
): readonly ActionProposalWarning[] {
  const warnings: ActionProposalWarning[] = [];

  if (
    contract.holderBinding !== undefined &&
    contract.holderBinding !== action.proposedBy
  ) {
    warnings.push({
      source: "contract_binding",
      code: "holder_binding_mismatch",
      severity: "warn",
      message: `Observation contract is bound to holder ${contract.holderBinding}; action was proposed by ${action.proposedBy}.`,
      refs: [contract.subject],
    });
  }

  if (
    contract.allowedUse !== undefined &&
    !contract.allowedUse.includes(action.actionType)
  ) {
    warnings.push({
      source: "contract_binding",
      code: "allowed_use_mismatch",
      severity: "warn",
      message: `Observation contract allows use for [${contract.allowedUse.join(", ")}]; action type ${action.actionType} is outside the allowed use.`,
      refs: [contract.subject],
    });
  }

  const integrity = verifyObservationContractIntegrity(contract);
  if (integrity !== undefined && !integrity.valid) {
    warnings.push({
      source: "contract_binding",
      code: "integrity_hash_mismatch",
      severity: "warn",
      message: `Observation contract integrity hash ${integrity.actualHash} does not match recomputed hash ${integrity.expectedHash}; the contract content changed after issuance.`,
      refs: [contract.subject],
    });
  }

  return warnings;
}

export function buildStateReviewArtifact(
  review: ActionProposalReview,
  options: StateReviewArtifactOptions = {},
): StateReviewArtifact {
  const artifactId = options.artifactId ?? `${review.reviewId}:artifact`;
  const generatedAt = options.generatedAt ?? review.observationEvaluation.evaluatedAt;
  const source = options.source ?? "pm-substrate/agent-state";
  const eventType = options.eventType ?? STATE_REVIEW_EVENT_TYPE;
  const provenanceLinks: StateReviewProvenanceLink[] = [
    {
      relation: "wasGeneratedBy",
      id: review.reviewId,
      role: "action_proposal_review",
    },
    {
      relation: "wasAssociatedWith",
      id: review.proposedAction.proposedBy,
      role: "proposed_by",
    },
  ];
  if (options.planId !== undefined) {
    provenanceLinks.push({
      relation: "hadPlan",
      id: options.planId,
      role: "review_plan",
    });
  }
  if (options.actedOnBehalfOf !== undefined) {
    provenanceLinks.push({
      relation: "actedOnBehalfOf",
      id: options.actedOnBehalfOf,
      role: "delegated_authority",
    });
  }
  provenanceLinks.push(...(options.provenanceLinks ?? []));

  const payload: StateReviewArtifactHashPayload = {
    schemaVersion: STATE_REVIEW_ARTIFACT_SCHEMA_VERSION,
    artifactId,
    generatedAt,
    eventEnvelope: {
      id: artifactId,
      source,
      type: eventType,
      specversion: STATE_REVIEW_EVENT_SPEC_VERSION,
      time: generatedAt,
      subject: formatStateRef(review.currentStateView.subject),
    },
    ...(options.traceContext !== undefined
      ? { traceContext: options.traceContext }
      : {}),
    relatedObjects: dedupeRelatedObjects([
      { role: "primary_subject", ref: review.currentStateView.subject },
      { role: "action_subject", ref: review.proposedAction.subject },
      ...review.currentStateView.sourceRefs.map((ref) => ({
        role: "source_ref",
        ref,
      })),
      ...review.proposedAction.readSet.map((entry) => ({
        role: "read_set_ref",
        ref: entry.ref,
      })),
      ...review.warnings.flatMap((warning) =>
        warning.refs.map((ref) => ({
          role: `warning:${warning.code}`,
          ref,
        })),
      ),
      ...(options.relatedObjects ?? []),
    ]),
    provenance: {
      generatedBy: review.reviewId,
      used: uniqueStateRefs([
        review.currentStateView.subject,
        review.proposedAction.subject,
        ...review.currentStateView.sourceRefs,
        ...review.proposedAction.readSet.map((entry) => entry.ref),
      ]),
      derivedFrom: uniqueStateRefs([
        ...review.observationContract.requiredSourceRefs,
      ]),
      associatedAgent: review.proposedAction.proposedBy,
      ...(options.actedOnBehalfOf !== undefined
        ? { actedOnBehalfOf: options.actedOnBehalfOf }
        : {}),
      ...(options.planId !== undefined ? { planId: options.planId } : {}),
      links: provenanceLinks,
    },
    metadata: buildStateReviewArtifactMetadata(review, options.metadata),
    review,
  };

  return {
    ...payload,
    artifactHash: computeStateReviewArtifactHash(payload),
  };
}

export function serializeStateReviewArtifact(
  artifact: StateReviewArtifact,
): string {
  return canonicalStringify(artifact);
}

export function serializeStateReviewArtifactsJsonl(
  artifacts: readonly StateReviewArtifact[],
): string {
  if (artifacts.length === 0) return "";
  return `${artifacts.map(serializeStateReviewArtifact).join("\n")}\n`;
}

export function importStateReviewArtifact(
  input: string | unknown,
): StateReviewArtifactImportResult {
  let parsed: unknown;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      return {
        valid: false,
        issues: [
          {
            path: "",
            message: `invalid state-review artifact JSON: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  } else {
    parsed = input;
  }

  const issues: StateReviewArtifactImportIssue[] = [];
  validateStateReviewArtifactShape(parsed, issues);
  const artifact = isRecord(parsed) ? (parsed as unknown as StateReviewArtifact) : undefined;
  const hashValidation =
    artifact !== undefined && typeof artifact.artifactHash === "string"
      ? verifyStateReviewArtifactHash(artifact)
      : undefined;

  if (hashValidation !== undefined && !hashValidation.valid) {
    issues.push({
      path: "/artifactHash",
      message: "artifact hash mismatch during replay verification",
    });
  }

  return {
    valid: issues.length === 0,
    ...(artifact !== undefined ? { artifact } : {}),
    ...(hashValidation !== undefined ? { hashValidation } : {}),
    issues,
  };
}

export function importStateReviewArtifactsJsonl(
  input: string,
): readonly StateReviewArtifactImportResult[] {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => importStateReviewArtifact(line));
}

export function computeStateReviewArtifactHash(
  artifact: StateReviewArtifactHashPayload,
): string {
  return fingerprint64(canonicalStringify(artifact));
}

export function verifyStateReviewArtifactHash(
  artifact: StateReviewArtifact,
): StateReviewArtifactHashValidation {
  const { artifactHash, ...payload } = artifact;
  const expectedHash = computeStateReviewArtifactHash(payload);

  return {
    valid: artifactHash === expectedHash,
    expectedHash,
    actualHash: artifactHash,
  };
}

export function buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact(
  artifact: StateReviewArtifact,
  options: StateReviewArtifactContinuityPayloadOptions = {},
): StateReviewArtifactContinuityPayload {
  const view = artifact.review.currentStateView;
  const payload: StateReviewArtifactContinuityPayload = {
    sourceRefs: view.sourceRefs,
    ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
    supersedes: options.supersedes ?? [],
    contradictedBy: options.contradictedBy ?? [],
    authorityRule: view.authorityRule,
    currentStateViewId: view.viewId,
    stateReviewArtifactId: artifact.artifactId,
    stateReviewArtifactHash: artifact.artifactHash,
    reviewId: artifact.review.reviewId,
    observationContractId: artifact.review.observationContract.contractId,
    valid: artifact.review.valid,
    warningCodes: uniqueStrings(artifact.review.warnings.map((warning) => warning.code)),
  };
  return payload;
}

export function validateProposedActionReadSet(
  action: ProposedAction,
  view: CurrentStateView,
): ReadSetValidationDecision {
  const issues: ReadSetValidationIssue[] = [];
  const allowedAction = view.allowedActions.find(
    (candidate) => candidate.actionType === action.actionType,
  );

  if (action.tenantId !== view.tenantId) {
    issues.push({
      code: "tenant_mismatch",
      path: "/tenantId",
      message: `Proposed action tenant ${action.tenantId} does not match current state view tenant ${view.tenantId}.`,
    });
  }

  if (!sameStateRef(action.subject, view.subject)) {
    issues.push({
      code: "subject_mismatch",
      path: "/subject",
      message: `Proposed action subject ${formatStateRef(action.subject)} does not match current state view subject ${formatStateRef(view.subject)}.`,
      ref: action.subject,
    });
  }

  if (!allowedAction) {
    issues.push({
      code: "action_not_allowed",
      path: "/actionType",
      message: `Action type ${action.actionType} is not listed in the current state view allowed actions.`,
    });
  }

  for (const [index, conflict] of view.conflicts.entries()) {
    issues.push({
      code: "current_view_conflict",
      path: `/conflicts/${index}`,
      message: conflict.message,
      ...(conflict.refs[0] ? { ref: conflict.refs[0] } : {}),
    });
  }

  if (allowedAction) {
    for (const ref of allowedAction.requiredRefs) {
      if (!action.readSet.some((entry) => sameStateRef(entry.ref, ref))) {
        issues.push({
          code: "missing_read_ref",
          path: "/readSet",
          message: `Proposed action did not cite required state ref ${formatStateRef(ref)}.`,
          ref,
        });
      }
    }

    for (const required of allowedAction.requiredRelatedRoles ?? []) {
      const bound = (action.relatedSubjects ?? []).find(
        (subject) => subject.role === required.role,
      );
      if (bound === undefined) {
        issues.push({
          code: "missing_related_object_role",
          path: "/relatedSubjects",
          message: `Action ${action.actionType} requires a related object bound to role ${required.role}; none was provided.`,
        });
        continue;
      }
      if (required.refKind !== undefined && bound.ref.kind !== required.refKind) {
        issues.push({
          code: "related_object_role_mismatch",
          path: "/relatedSubjects",
          message: `Related object for role ${required.role} must be of kind ${required.refKind}; got ${bound.ref.kind} (${formatStateRef(bound.ref)}).`,
          ref: bound.ref,
        });
      }
    }
  }

  for (const [index, missingSource] of view.missingSources.entries()) {
    issues.push({
      code: "missing_read_ref",
      path: `/missingSources/${index}`,
      message: `Current state view is missing required source ${missingSource}.`,
    });
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.validUntil !== undefined && isAfter(action.proposedAt, entry.validUntil)) {
      issues.push({
        code: "stale_read_ref",
        path: `/readSet/${index}/validUntil`,
        message: `Read-set ref ${formatStateRef(entry.ref)} expired at ${entry.validUntil} before action proposal at ${action.proposedAt}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.authority !== view.authorityRule) {
      issues.push({
        code: "authority_mismatch",
        path: `/readSet/${index}/authority`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used authority ${entry.authority}; current view requires ${view.authorityRule}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (
      entry.projectionVersion !== undefined &&
      view.projectionVersion !== undefined &&
      entry.projectionVersion !== view.projectionVersion
    ) {
      issues.push({
        code: "projection_version_mismatch",
        path: `/readSet/${index}/projectionVersion`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used projection version ${entry.projectionVersion}; current view is ${view.projectionVersion}.`,
        ref: entry.ref,
      });
    }
  }

  if (
    allowedAction?.requiredWorkflowPosition !== undefined &&
    view.workflowPosition !== undefined &&
    allowedAction.requiredWorkflowPosition !== view.workflowPosition
  ) {
    issues.push({
      code: "workflow_position_mismatch",
      path: "/workflowPosition",
      message: `Action ${action.actionType} requires workflow position ${allowedAction.requiredWorkflowPosition}; current position is ${view.workflowPosition}.`,
    });
  }

  return { valid: issues.length === 0, mode: "warn", issues };
}

function sameStateRef(left: StateRef, right: StateRef): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function uniqueStateRefs(refs: readonly StateRef[]): readonly StateRef[] {
  const seen = new Set<string>();
  const out: StateRef[] = [];

  for (const ref of refs) {
    const key = formatStateRef(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }

  return out;
}

function dedupeRelatedObjects(
  objects: readonly StateReviewRelatedObject[],
): readonly StateReviewRelatedObject[] {
  const seen = new Set<string>();
  const out: StateReviewRelatedObject[] = [];

  for (const object of objects) {
    const key = `${object.role}:${formatStateRef(object.ref)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(object);
  }

  return out;
}

function blockingCausesFromProposalReview(
  review: ActionProposalReview | undefined,
): readonly ActionOutcomeBlockingCause[] {
  if (review === undefined || !review.execution.blocking) return [];
  return [
    {
      source: "proposal_review",
      code: "proposal_review_blocking_policy",
      message: `Action proposal review ${review.reviewId} was evaluated in blocking mode and did not pass.`,
      refs: uniqueStateRefs([
        review.currentStateView.subject,
        ...review.warnings.flatMap((warning) => warning.refs),
      ]),
      invariantClasses: inferStateReviewInvariantClasses(review),
    },
  ];
}

function blockingCausesFromEvidenceAdmissions(
  reviews: readonly EvidenceAdmissionReview[],
  consequence: StateReviewActionConsequence,
): readonly ActionOutcomeBlockingCause[] {
  const causes: ActionOutcomeBlockingCause[] = [];
  for (const review of reviews) {
    if (review.decision === "rejected") {
      causes.push({
        source: "evidence_admission",
        code: "evidence_admission_rejected",
        message: `Evidence admission review ${review.reviewId} rejected evidence ${review.evidence.evidenceId}.`,
        refs: uniqueStateRefs([
          ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
          ...review.evidence.refs,
        ]),
        invariantClasses: review.invariantClasses,
      });
      continue;
    }

    const policy = evaluateStateReviewInvariantPolicy(
      review.invariantClasses,
      consequence,
    );
    if (!policy.wouldBlock) continue;

    const blockingClasses = new Set(policy.wouldBlockInvariantClasses);
    for (const issue of review.issues) {
      const issueClasses = review.invariantClasses.filter((item) =>
        blockingClasses.has(item),
      );
      causes.push({
        source: "evidence_admission",
        code: issue.code,
        message: issue.message,
        refs: uniqueStateRefs([
          ...(issue.ref !== undefined ? [issue.ref] : []),
          ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
          ...review.evidence.refs,
        ]),
        invariantClasses: issueClasses,
      });
    }
  }
  return causes;
}

function workflowBlockingCauses(
  workflowEnvelope: WorkflowInvocationActionOutcomeEnvelopeSource,
): readonly ActionOutcomeBlockingCause[] {
  if (workflowEnvelope.evidenceDecision.valid) return [];
  const reason =
    workflowEnvelope.evidenceDecision.reason ?? "workflow_evidence_gate_blocked";
  return [
    {
      source: "policy",
      code: reason,
      message: `Workflow evidence-binding gate produced blocked terminal outcome ${workflowEnvelope.envelopeId} for ${workflowEnvelope.capability}.`,
      refs: uniqueStateRefs([
        stateRef(
          "action_outcome_envelope",
          workflowEnvelope.envelopeId,
          "Workflow action outcome envelope",
        ),
        stateRef(
          "workflow_run",
          workflowEnvelope.workflowId,
          workflowEnvelope.workflowName,
        ),
        stateRef(
          "capability_invocation",
          `${workflowEnvelope.workflowId}:${workflowEnvelope.workflowVersion}:${workflowEnvelope.nodeId}:${workflowEnvelope.triggerEventId}`,
          workflowEnvelope.capability,
        ),
      ]),
    },
  ];
}

function dedupeBlockingCauses(
  causes: readonly ActionOutcomeBlockingCause[],
): readonly ActionOutcomeBlockingCause[] {
  const seen = new Set<string>();
  const out: ActionOutcomeBlockingCause[] = [];
  for (const cause of causes) {
    const key = `${cause.source}:${cause.code}:${cause.message}:${cause.refs.map(formatStateRef).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...cause,
      refs: uniqueStateRefs(cause.refs),
      ...(cause.invariantClasses !== undefined
        ? { invariantClasses: uniqueStrings(cause.invariantClasses) }
        : {}),
    });
  }
  return out;
}

function buildStateReviewArtifactMetadata(
  review: ActionProposalReview,
  input: StateReviewArtifactMetadataInput | undefined,
): StateReviewArtifactMetadata {
  const observedReadSetComparison =
    input?.observedReadSet !== undefined
      ? compareObservedReadSetToDeclared(
          review.proposedAction.readSet,
          input.observedReadSet,
          review.currentStateView,
          review.proposedAction.proposedAt,
        )
      : input?.observedReadSetComparison;

  return {
    temporalMisalignmentPhase:
      input?.temporalMisalignmentPhase ??
      inferTemporalMisalignmentPhase(review),
    invariantClasses:
      input?.invariantClasses ?? inferStateReviewInvariantClasses(review),
    ...(input?.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    ...(input?.fixtureId !== undefined ? { fixtureId: input.fixtureId } : {}),
    ...(input?.clientSurface !== undefined
      ? { clientSurface: input.clientSurface }
      : {}),
    ...(input?.provider !== undefined ? { provider: input.provider } : {}),
    ...(input?.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input?.workflowRunId !== undefined
      ? { workflowRunId: input.workflowRunId }
      : {}),
    ...(input?.runGroupId !== undefined
      ? { runGroupId: input.runGroupId }
      : {}),
    ...(input?.evalEventIds !== undefined
      ? { evalEventIds: input.evalEventIds }
      : {}),
    ...(input?.evidenceAdmissions !== undefined
      ? { evidenceAdmissions: input.evidenceAdmissions }
      : {}),
    ...(input?.observedReadSet !== undefined
      ? { observedReadSet: input.observedReadSet }
      : {}),
    ...(observedReadSetComparison !== undefined
      ? { observedReadSetComparison }
      : {}),
  };
}

function inferTemporalMisalignmentPhase(
  review: ActionProposalReview,
): StateReviewTemporalMisalignmentPhase {
  return review.warnings.length === 0 ? "none" : "observation_to_action";
}

function inferStateReviewInvariantClasses(
  review: ActionProposalReview,
): readonly StateReviewInvariantClass[] {
  return uniqueStrings(
    review.warnings.flatMap((warning) => invariantClassesForWarningCode(warning.code)),
  ) as readonly StateReviewInvariantClass[];
}

function invariantClassesForWarningCode(
  code: string,
): readonly StateReviewInvariantClass[] {
  switch (code) {
    case "subject_mismatch":
      return ["subject_identity"];
    case "tenant_mismatch":
      return ["tenant_boundary"];
    case "missing_read_ref":
    case "required_source_refs_present":
    case "missing_sources_declared":
      return ["required_evidence"];
    case "stale_read_ref":
    case "freshness_window_current":
      return ["freshness_window"];
    case "authority_mismatch":
    case "authority_rule_matches":
      return ["source_authority"];
    case "projection_version_mismatch":
    case "projection_version_matches":
      return ["projection_version"];
    case "workflow_position_mismatch":
    case "workflow_position_matches":
      return ["workflow_position"];
    case "current_view_conflict":
    case "conflicts_declared":
      return ["state_conflict"];
    case "action_not_allowed":
    case "allowed_use_mismatch":
      return ["capability_contract"];
    case "missing_related_object_role":
    case "related_object_role_mismatch":
    case "holder_binding_mismatch":
      return ["subject_identity"];
    case "integrity_hash_mismatch":
      return ["required_evidence"];
    default:
      return [];
  }
}

function validateStateReviewArtifactShape(
  input: unknown,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isRecord(input)) {
    issues.push({ path: "", message: "expected state-review artifact object" });
    return;
  }

  if (input["schemaVersion"] !== STATE_REVIEW_ARTIFACT_SCHEMA_VERSION) {
    issues.push({
      path: "/schemaVersion",
      message: `expected ${STATE_REVIEW_ARTIFACT_SCHEMA_VERSION}`,
    });
  }
  if (!isNonEmptyString(input["artifactId"])) {
    issues.push({ path: "/artifactId", message: "expected non-empty string" });
  }
  if (!isNonEmptyString(input["generatedAt"])) {
    issues.push({ path: "/generatedAt", message: "expected non-empty timestamp" });
  }
  if (!isRecord(input["eventEnvelope"])) {
    issues.push({ path: "/eventEnvelope", message: "expected object" });
  } else {
    validateStateReviewEventEnvelopeShape(input["eventEnvelope"], issues);
  }
  if (!isRecord(input["provenance"])) {
    issues.push({ path: "/provenance", message: "expected object" });
  } else {
    validateStateReviewProvenanceShape(input["provenance"], issues);
  }
  if (!isRecord(input["metadata"])) {
    issues.push({ path: "/metadata", message: "expected object" });
  } else {
    validateStateReviewMetadataShape(input["metadata"], issues);
  }
  if (!isRecord(input["review"])) {
    issues.push({ path: "/review", message: "expected object" });
  } else {
    validateActionProposalReviewShape(input["review"], issues);
  }
  if (!isNonEmptyString(input["artifactHash"])) {
    issues.push({ path: "/artifactHash", message: "expected non-empty string" });
  }
}

function validateStateReviewEventEnvelopeShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "id", "/eventEnvelope/id", issues);
  validateNonEmptyStringField(input, "source", "/eventEnvelope/source", issues);
  validateNonEmptyStringField(input, "type", "/eventEnvelope/type", issues);
  validateNonEmptyStringField(input, "time", "/eventEnvelope/time", issues);
  validateNonEmptyStringField(input, "subject", "/eventEnvelope/subject", issues);
  if (input["specversion"] !== STATE_REVIEW_EVENT_SPEC_VERSION) {
    issues.push({
      path: "/eventEnvelope/specversion",
      message: `expected ${STATE_REVIEW_EVENT_SPEC_VERSION}`,
    });
  }
}

function validateStateReviewProvenanceShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "generatedBy", "/provenance/generatedBy", issues);
  validateNonEmptyStringField(
    input,
    "associatedAgent",
    "/provenance/associatedAgent",
    issues,
  );
  validateArrayField(input, "used", "/provenance/used", issues);
  validateArrayField(input, "derivedFrom", "/provenance/derivedFrom", issues);
  validateArrayField(input, "links", "/provenance/links", issues);
}

function validateStateReviewMetadataShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isStateReviewTemporalMisalignmentPhase(input["temporalMisalignmentPhase"])) {
    issues.push({
      path: "/metadata/temporalMisalignmentPhase",
      message: "expected supported temporal misalignment phase",
    });
  }

  const invariantClasses = input["invariantClasses"];
  if (!Array.isArray(invariantClasses)) {
    issues.push({
      path: "/metadata/invariantClasses",
      message: "expected array",
    });
    return;
  }

  for (const [index, invariantClass] of invariantClasses.entries()) {
    if (!isStateReviewInvariantClass(invariantClass)) {
      issues.push({
        path: `/metadata/invariantClasses/${index}`,
        message: "expected supported invariant class",
      });
    }
  }

  if (input["observedReadSet"] !== undefined) {
    if (validateArrayField(input, "observedReadSet", "/metadata/observedReadSet", issues)) {
      validateObservedReadSetArray(
        input["observedReadSet"] as readonly unknown[],
        "/metadata/observedReadSet",
        issues,
      );
    }
  }

  if (input["observedReadSetComparison"] !== undefined) {
    const comparison = validateRecordField(
      input,
      "observedReadSetComparison",
      "/metadata/observedReadSetComparison",
      issues,
    );
    if (comparison) {
      validateObservedReadSetComparisonShape(
        comparison,
        "/metadata/observedReadSetComparison",
        issues,
      );
    }
  }

  validateOptionalStringField(input, "runGroupId", "/metadata/runGroupId", issues);

  if (input["evidenceAdmissions"] !== undefined) {
    if (
      validateArrayField(
        input,
        "evidenceAdmissions",
        "/metadata/evidenceAdmissions",
        issues,
      )
    ) {
      validateEvidenceAdmissionArray(
        input["evidenceAdmissions"] as readonly unknown[],
        "/metadata/evidenceAdmissions",
        issues,
      );
    }
  }
}

function validateEvidenceAdmissionArray(
  admissions: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, admission] of admissions.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(admission)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateNonEmptyStringField(admission, "reviewId", `${itemPath}/reviewId`, issues);
    validateNonEmptyStringField(admission, "tenantId", `${itemPath}/tenantId`, issues);
    validateNonEmptyStringField(
      admission,
      "evaluatedAt",
      `${itemPath}/evaluatedAt`,
      issues,
    );
    if (
      admission["decision"] !== "admitted" &&
      admission["decision"] !== "admitted_with_warnings" &&
      admission["decision"] !== "rejected"
    ) {
      issues.push({
        path: `${itemPath}/decision`,
        message: "expected admitted|admitted_with_warnings|rejected",
      });
    }
    if (admission["authorityStatus"] !== "evidence_only") {
      issues.push({
        path: `${itemPath}/authorityStatus`,
        message: "expected evidence_only",
      });
    }
    validateRecordField(admission, "evidence", `${itemPath}/evidence`, issues);
    validateArrayField(admission, "issues", `${itemPath}/issues`, issues);
  }
}

function validateObservedReadSetComparisonShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateBooleanField(input, "valid", `${path}/valid`, issues);
  if (input["mode"] !== "warn") {
    issues.push({ path: `${path}/mode`, message: "expected warn" });
  }

  if (validateArrayField(input, "declaredReadSet", `${path}/declaredReadSet`, issues)) {
    validateDeclaredReadSetArray(
      input["declaredReadSet"] as readonly unknown[],
      `${path}/declaredReadSet`,
      issues,
    );
  }
  if (validateArrayField(input, "observedReadSet", `${path}/observedReadSet`, issues)) {
    validateObservedReadSetArray(
      input["observedReadSet"] as readonly unknown[],
      `${path}/observedReadSet`,
      issues,
    );
  }
  if (validateArrayField(input, "issues", `${path}/issues`, issues)) {
    validateObservedReadSetIssueArray(
      input["issues"] as readonly unknown[],
      `${path}/issues`,
      issues,
    );
  }
}

function validateDeclaredReadSetArray(
  readSet: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, entry] of readSet.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(entry)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateReadSetEntryShape(entry, itemPath, issues);
  }
}

function validateObservedReadSetArray(
  readSet: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, entry] of readSet.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(entry)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateReadSetEntryShape(entry, itemPath, issues);
    validateOptionalStringField(entry, "workflowPosition", `${itemPath}/workflowPosition`, issues);
    validateOptionalStringField(entry, "source", `${itemPath}/source`, issues);
    validateOptionalStringField(entry, "tool", `${itemPath}/tool`, issues);
  }
}

function validateReadSetEntryShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  const ref = validateRecordField(input, "ref", `${path}/ref`, issues);
  if (ref) {
    validateStateRefShape(ref, `${path}/ref`, issues);
  }
  validateNonEmptyStringField(input, "observedAt", `${path}/observedAt`, issues);
  validateNonEmptyStringField(input, "authority", `${path}/authority`, issues);
  validateOptionalStringField(input, "validUntil", `${path}/validUntil`, issues);
  validateOptionalNumberField(
    input,
    "projectionVersion",
    `${path}/projectionVersion`,
    issues,
  );
}

function validateStateRefShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "kind", `${path}/kind`, issues);
  validateNonEmptyStringField(input, "id", `${path}/id`, issues);
  validateOptionalStringField(input, "label", `${path}/label`, issues);
}

function validateObservedReadSetIssueArray(
  readSetIssues: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, issue] of readSetIssues.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(issue)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    if (!isObservedReadSetIssueCode(issue["code"])) {
      issues.push({
        path: `${itemPath}/code`,
        message: "expected supported observed read-set issue code",
      });
    }
    validateNonEmptyStringField(issue, "path", `${itemPath}/path`, issues);
    validateNonEmptyStringField(issue, "message", `${itemPath}/message`, issues);
    validateOptionalNonNegativeIntegerField(
      issue,
      "declaredIndex",
      `${itemPath}/declaredIndex`,
      issues,
    );
    validateOptionalNonNegativeIntegerField(
      issue,
      "observedIndex",
      `${itemPath}/observedIndex`,
      issues,
    );
    if (issue["ref"] !== undefined) {
      const ref = validateRecordField(issue, "ref", `${itemPath}/ref`, issues);
      if (ref) {
        validateStateRefShape(ref, `${itemPath}/ref`, issues);
      }
    }
  }
}

function validateActionProposalReviewShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "reviewId", "/review/reviewId", issues);
  validateNonEmptyStringField(input, "tenantId", "/review/tenantId", issues);
  if (input["mode"] !== "warn") {
    issues.push({ path: "/review/mode", message: "expected warn" });
  }
  validateBooleanField(input, "valid", "/review/valid", issues);
  validateRecordField(input, "proposedAction", "/review/proposedAction", issues);
  const currentStateView = validateRecordField(
    input,
    "currentStateView",
    "/review/currentStateView",
    issues,
  );
  if (currentStateView) {
    validateNonEmptyStringField(
      currentStateView,
      "viewId",
      "/review/currentStateView/viewId",
      issues,
    );
    validateNonEmptyStringField(
      currentStateView,
      "authorityRule",
      "/review/currentStateView/authorityRule",
      issues,
    );
    validateArrayField(
      currentStateView,
      "sourceRefs",
      "/review/currentStateView/sourceRefs",
      issues,
    );
  }

  const observationContract = validateRecordField(
    input,
    "observationContract",
    "/review/observationContract",
    issues,
  );
  if (observationContract) {
    validateNonEmptyStringField(
      observationContract,
      "contractId",
      "/review/observationContract/contractId",
      issues,
    );
  }

  const observationEvaluation = validateRecordField(
    input,
    "observationEvaluation",
    "/review/observationEvaluation",
    issues,
  );
  if (observationEvaluation) {
    if (validateArrayField(
      observationEvaluation,
      "assertions",
      "/review/observationEvaluation/assertions",
      issues,
    )) {
      validateStateAssertionArray(
        observationEvaluation["assertions"] as readonly unknown[],
        "/review/observationEvaluation/assertions",
        issues,
      );
    }
  }

  validateRecordField(input, "readSetValidation", "/review/readSetValidation", issues);
  const execution = validateRecordField(input, "execution", "/review/execution", issues);
  if (execution) {
    validateBooleanField(execution, "allowed", "/review/execution/allowed", issues);
    validateBooleanField(execution, "blocking", "/review/execution/blocking", issues);
    validateNonEmptyStringField(
      execution,
      "enforcementMode",
      "/review/execution/enforcementMode",
      issues,
    );
  }
  if (validateArrayField(input, "warnings", "/review/warnings", issues)) {
    validateActionProposalWarningArray(
      input["warnings"] as readonly unknown[],
      "/review/warnings",
      issues,
    );
  }
}

function validateStateAssertionArray(
  assertions: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, assertion] of assertions.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(assertion)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateNonEmptyStringField(assertion, "code", `${itemPath}/code`, issues);
    validateBooleanField(assertion, "passed", `${itemPath}/passed`, issues);
    validateNonEmptyStringField(assertion, "message", `${itemPath}/message`, issues);
    validateArrayField(assertion, "refs", `${itemPath}/refs`, issues);
    if (
      assertion["severity"] !== "info" &&
      assertion["severity"] !== "warn" &&
      assertion["severity"] !== "fail"
    ) {
      issues.push({
        path: `${itemPath}/severity`,
        message: "expected info|warn|fail",
      });
    }
  }
}

function validateActionProposalWarningArray(
  warnings: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, warning] of warnings.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(warning)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    if (
      warning["source"] !== "read_set" &&
      warning["source"] !== "observation_contract" &&
      warning["source"] !== "contract_binding"
    ) {
      issues.push({
        path: `${itemPath}/source`,
        message: "expected read_set|observation_contract|contract_binding",
      });
    }
    validateNonEmptyStringField(warning, "code", `${itemPath}/code`, issues);
    validateNonEmptyStringField(warning, "message", `${itemPath}/message`, issues);
    validateArrayField(warning, "refs", `${itemPath}/refs`, issues);
    if (
      warning["severity"] !== "info" &&
      warning["severity"] !== "warn" &&
      warning["severity"] !== "fail"
    ) {
      issues.push({
        path: `${itemPath}/severity`,
        message: "expected info|warn|fail",
      });
    }
  }
}

function validateNonEmptyStringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isNonEmptyString(input[key])) {
    issues.push({ path, message: "expected non-empty string" });
  }
}

function validateOptionalStringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (input[key] !== undefined && !isNonEmptyString(input[key])) {
    issues.push({ path, message: "expected non-empty string" });
  }
}

function validateOptionalNumberField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (input[key] !== undefined && typeof input[key] !== "number") {
    issues.push({ path, message: "expected number" });
  }
}

function validateOptionalNonNegativeIntegerField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (
    input[key] !== undefined &&
    (!Number.isInteger(input[key]) || (input[key] as number) < 0)
  ) {
    issues.push({ path, message: "expected non-negative integer" });
  }
}

function validateBooleanField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (typeof input[key] !== "boolean") {
    issues.push({ path, message: "expected boolean" });
  }
}

function validateArrayField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): boolean {
  if (!Array.isArray(input[key])) {
    issues.push({ path, message: "expected array" });
    return false;
  }
  return true;
}

function validateRecordField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): Record<string, unknown> | null {
  const value = input[key];
  if (!isRecord(value)) {
    issues.push({ path, message: "expected object" });
    return null;
  }
  return value;
}

function isStateReviewTemporalMisalignmentPhase(
  value: unknown,
): value is StateReviewTemporalMisalignmentPhase {
  return (
    value === "none" ||
    value === "observation_to_action" ||
    value === "action_to_feedback" ||
    value === "feedback_to_observation"
  );
}

function isStateReviewInvariantClass(
  value: unknown,
): value is StateReviewInvariantClass {
  return (
    value === "subject_identity" ||
    value === "tenant_boundary" ||
    value === "required_evidence" ||
    value === "freshness_window" ||
    value === "source_authority" ||
    value === "projection_version" ||
    value === "workflow_position" ||
    value === "state_conflict" ||
    value === "capability_contract"
  );
}

function isObservedReadSetIssueCode(
  value: unknown,
): value is ObservedReadSetValidationIssueCode {
  return (
    value === "observed_but_undeclared" ||
    value === "declared_but_unobserved" ||
    value === "stale_observed_read" ||
    value === "authority_mismatch" ||
    value === "projection_version_drift" ||
    value === "workflow_position_drift"
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function sameStateRefSet(left: readonly StateRef[], right: readonly StateRef[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right.map(formatStateRef));
  return left.every((item) => rightSet.has(formatStateRef(item)));
}

function assertion(input: StateAssertion): StateAssertion {
  return input;
}

function formatStateRef(ref: StateRef): string {
  return `${ref.kind}:${ref.id}`;
}

function isAfter(left: Timestamp, right: Timestamp): boolean {
  return Date.parse(left) > Date.parse(right);
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item !== undefined) {
      out[key] = canonicalize(item);
    }
  }
  return out;
}

function uniqueStrings<T extends string>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function fingerprint64(input: string): string {
  return [
    fnv1a64("state-review-artifact:v1:0", input),
    fnv1a64("state-review-artifact:v1:1", input),
    fnv1a64("state-review-artifact:v1:2", input),
    fnv1a64("state-review-artifact:v1:3", input),
  ].join("");
}

function fnv1a64(seed: string, input: string): string {
  let hash = 0xcbf29ce484222325n;
  const text = `${seed}\u0000${input}`;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
}
