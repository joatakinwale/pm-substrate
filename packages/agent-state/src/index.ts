import type { TenantId, Timestamp } from "@pm/types";

export const STATE_REVIEW_ARTIFACT_SCHEMA_VERSION =
  "state-review-artifact.v1" as const;
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

export interface AllowedAction {
  readonly actionType: string;
  readonly label: string;
  readonly requiredRefs: readonly StateRef[];
  readonly requiredWorkflowPosition?: string;
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

export interface ProposedAction {
  readonly tenantId: TenantId;
  readonly actionType: string;
  readonly subject: StateRef;
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
  | "workflow_position_mismatch";

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
export type ActionProposalWarningSource = "read_set" | "observation_contract";

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

export interface StateReviewArtifactMetadataInput {
  readonly temporalMisalignmentPhase?: StateReviewTemporalMisalignmentPhase;
  readonly invariantClasses?: readonly StateReviewInvariantClass[];
  readonly scenarioId?: string;
  readonly fixtureId?: string;
  readonly clientSurface?: string;
  readonly provider?: string;
  readonly sessionId?: string;
  readonly workflowRunId?: string;
  readonly evalEventIds?: readonly string[];
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
  ] as const;
  const blocking =
    enforcementMode === "blocking" &&
    (!readSetValidation.valid || !observationEvaluation.valid);

  return {
    tenantId: action.tenantId,
    reviewId: `${view.viewId}:${action.actionType}:proposal_review`,
    mode: "warn",
    valid: readSetValidation.valid && observationEvaluation.valid,
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

function buildStateReviewArtifactMetadata(
  review: ActionProposalReview,
  input: StateReviewArtifactMetadataInput | undefined,
): StateReviewArtifactMetadata {
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
    ...(input?.evalEventIds !== undefined
      ? { evalEventIds: input.evalEventIds }
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
      return ["capability_contract"];
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
  }
  if (!isRecord(input["provenance"])) {
    issues.push({ path: "/provenance", message: "expected object" });
  }
  if (!isRecord(input["metadata"])) {
    issues.push({ path: "/metadata", message: "expected object" });
  }
  if (!isRecord(input["review"])) {
    issues.push({ path: "/review", message: "expected object" });
  }
  if (!isNonEmptyString(input["artifactHash"])) {
    issues.push({ path: "/artifactHash", message: "expected non-empty string" });
  }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
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
