import type { TenantId, Timestamp } from "@pm/types";

import type {
  ObservedReadSetEntry,
  StateRef,
  StateReviewInvariantClass,
} from "./index.js";

/**
 * External evidence admission (pure).
 *
 * Implements the research frontier item: external protocol task state, tool
 * annotations, memory retrieval, world-model predictions, audit logs, lineage
 * events, attestations, runtime traces, custom stores, subagent outputs, and
 * PM handoff notes are EVIDENCE, not authority (ledger C020, C022, C023,
 * C025, C026, C028, C031-C035). Evidence must be admitted - validated for
 * source, subject, tenant, freshness, integrity, policy and workflow
 * alignment - before it may influence action review. Admission never grants
 * authority: `authorityStatus` is always `evidence_only`.
 */

export const EVIDENCE_ADMISSION_SCHEMA_VERSION =
  "evidence-admission-review.v1" as const;

export type ExternalStateEvidenceKind =
  | "mcp_tool_handle"
  | "mcp_task"
  | "tool_annotation"
  | "memory_retrieval"
  | "monitoring_event"
  | "lineage_record"
  | "audit_event"
  | "attestation"
  | "workflow_trace"
  | "world_model_prediction"
  | "pm_handoff"
  | "external_validation"
  | "approval_record"
  | "provider_policy"
  | "custom_store_record"
  | "subagent_output"
  | "runtime_trace"
  | "registry_record"
  | "identity_on_behalf_of"
  | "eval_result"
  | "filesystem_shell"
  | "gateway_request";

export type EvidenceRiskLevel = "none" | "low" | "medium" | "high";

/** Approval-currentness facet (competitive v04 / ledger C032). */
export interface ApprovalEvidenceFacet {
  readonly approvedRevision?: string;
  readonly approvedContentHash?: string;
  readonly approvedScope?: string;
  readonly approvedBy?: string;
  readonly approvedAt?: Timestamp;
}

/** Observability-safe memory retention facet (Arrowsmith v07 / ledger C026). */
export interface MemoryEvidenceFacet {
  readonly sourceModality?: string;
  readonly retentionPolicy?: string;
  readonly deletionResidueRisk?: EvidenceRiskLevel;
  readonly observableFeatureBoundary?: string;
  readonly staleInformationRisk?: EvidenceRiskLevel;
}

/** Model/provider policy facet (competitive v03 / ledger C023). */
export interface ProviderPolicyEvidenceFacet {
  readonly retentionPolicy?: string;
  readonly zeroDataRetention?: boolean;
  readonly adminEnabled?: boolean;
  readonly providerSurface?: string;
  readonly allowedDataClasses?: readonly string[];
  readonly policyVersion?: string;
}

/** External validation facet (competitive v03/v04 / ledger C022, C031). */
export interface ValidationEvidenceFacet {
  readonly validationType: string;
  readonly outcome: "passed" | "failed" | "inconclusive";
  readonly findingCount?: number;
}

/** Long-horizon workflow trace facet (Arrowsmith v07 / ledger C027). */
export interface WorkflowTraceEvidenceFacet {
  readonly workflowRunId?: string;
  readonly stages: readonly string[];
  readonly gateOutcomes?: Readonly<Record<string, "passed" | "failed">>;
}

/** PM handoff facet (Arrowsmith v06/v07 / ledger C030). */
export interface PmHandoffEvidenceFacet {
  readonly expertiseOwner?: string;
  readonly sourceSteward?: string;
  readonly escalationOwner?: string;
  readonly unresolvedRisks?: readonly string[];
  readonly dependencyRefs?: readonly StateRef[];
  readonly validNextActions?: readonly string[];
}

/**
 * Identity / on-behalf-of facet with provenance-vs-authorization alignment
 * (research frontier item 6: actual source/parameter path vs authorized
 * intent).
 */
export interface IdentityEvidenceFacet {
  readonly actorId?: string;
  readonly onBehalfOf?: string;
  readonly authorizedIntent?: string;
  readonly actualSourcePath?: string;
  readonly actualParameterPath?: string;
}

export interface ExternalStateEvidence {
  readonly tenantId: TenantId;
  readonly evidenceId: string;
  readonly kind: ExternalStateEvidenceKind;
  /** Where the evidence came from, e.g. `mcp://server/tool` or `aws.agentcore.memory`. */
  readonly source: string;
  /** Authority the producer claims for this evidence. Never trusted as-is. */
  readonly claimedAuthority?: string;
  /** True when the producer asserts the evidence is authoritative state (e.g. an MCP annotation). Always downgraded (C028). */
  readonly claimsAuthority?: boolean;
  readonly subject?: StateRef;
  readonly refs: readonly StateRef[];
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly collectedBy: string;
  readonly collectedAt: Timestamp;
  /** Client surface origin (competitive v03 / ledger C024), recorded separately from authority. */
  readonly clientSurface?: string;
  readonly provider?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadHash?: string;
  readonly approval?: ApprovalEvidenceFacet;
  readonly memory?: MemoryEvidenceFacet;
  readonly providerPolicy?: ProviderPolicyEvidenceFacet;
  readonly validation?: ValidationEvidenceFacet;
  readonly workflowTrace?: WorkflowTraceEvidenceFacet;
  readonly pmHandoff?: PmHandoffEvidenceFacet;
  readonly identity?: IdentityEvidenceFacet;
}

export type EvidenceAdmissionIssueCode =
  | "tenant_mismatch"
  | "subject_mismatch"
  | "source_missing"
  | "future_observed_at"
  | "stale_evidence"
  | "evidence_age_exceeded"
  | "authority_claim_downgraded"
  | "untrusted_authority"
  | "unverifiable_payload_integrity"
  | "approval_revision_mismatch"
  | "approval_content_hash_mismatch"
  | "approval_scope_mismatch"
  | "policy_version_drift"
  | "sensitive_data_class_blocked"
  | "memory_retention_metadata_missing"
  | "memory_deletion_residue_risk"
  | "memory_stale_information_risk"
  | "workflow_stage_omitted"
  | "workflow_gate_failed"
  | "provenance_authorization_mismatch"
  | "pm_handoff_incomplete";

export type EvidenceAdmissionIssueSeverity = "warn" | "fail";

export interface EvidenceAdmissionIssue {
  readonly code: EvidenceAdmissionIssueCode;
  readonly severity: EvidenceAdmissionIssueSeverity;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
}

export type EvidenceAdmissionDecision =
  | "admitted"
  | "admitted_with_warnings"
  | "rejected";

/** Evidence is never authority; the constant exists so artifacts say so explicitly. */
export type EvidenceAuthorityStatus = "evidence_only";

export interface EvidenceAdmissionContext {
  readonly tenantId: TenantId;
  readonly evaluatedAt: Timestamp;
  readonly expectedSubject?: StateRef;
  /** Authorities the tenant currently trusts. When provided, claimed authorities outside the list warn. */
  readonly trustedAuthorities?: readonly string[];
  /** Current approval target for approval-currentness comparison (C032). */
  readonly currentApproval?: {
    readonly revision?: string;
    readonly contentHash?: string;
    readonly scope?: string;
  };
  /** Current policy version for policy-version drift detection (frontier item 18). */
  readonly currentPolicyVersion?: string;
  /** Data classes the current action touches; checked against provider policy allowedDataClasses (C023). */
  readonly sensitiveDataClasses?: readonly string[];
  /** Expected workflow stages for stage-omission detection (C027). */
  readonly expectedWorkflowStages?: readonly string[];
  /** Maximum tolerated evidence age in milliseconds. */
  readonly maxEvidenceAgeMs?: number;
}

export interface EvidenceAdmissionReview {
  readonly schemaVersion: typeof EVIDENCE_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly reviewId: string;
  readonly evidence: ExternalStateEvidence;
  readonly evaluatedAt: Timestamp;
  readonly decision: EvidenceAdmissionDecision;
  readonly authorityStatus: EvidenceAuthorityStatus;
  readonly issues: readonly EvidenceAdmissionIssue[];
  readonly invariantClasses: readonly StateReviewInvariantClass[];
}

export interface AdmittedStateEvidence {
  readonly evidence: ExternalStateEvidence;
  readonly admissionReviewId: string;
  readonly admittedAt: Timestamp;
  readonly warningCodes: readonly EvidenceAdmissionIssueCode[];
}

const PAYLOAD_INTEGRITY_KINDS: readonly ExternalStateEvidenceKind[] = [
  "memory_retrieval",
  "custom_store_record",
  "subagent_output",
];

export function reviewExternalStateEvidence(
  evidence: ExternalStateEvidence,
  context: EvidenceAdmissionContext,
): EvidenceAdmissionReview {
  const issues: EvidenceAdmissionIssue[] = [];

  if (evidence.tenantId !== context.tenantId) {
    issues.push({
      code: "tenant_mismatch",
      severity: "fail",
      path: "/tenantId",
      message: `Evidence tenant ${evidence.tenantId} does not match admission tenant ${context.tenantId}.`,
    });
  }

  if (
    context.expectedSubject !== undefined &&
    evidence.subject !== undefined &&
    !sameStateRef(evidence.subject, context.expectedSubject)
  ) {
    issues.push({
      code: "subject_mismatch",
      severity: "fail",
      path: "/subject",
      message: `Evidence subject ${formatStateRef(evidence.subject)} does not match expected subject ${formatStateRef(context.expectedSubject)}.`,
      ref: evidence.subject,
    });
  }

  if (evidence.source.trim().length === 0) {
    issues.push({
      code: "source_missing",
      severity: "fail",
      path: "/source",
      message: "Evidence has no source; unsourced external state cannot be admitted.",
    });
  }

  if (isAfter(evidence.observedAt, context.evaluatedAt)) {
    issues.push({
      code: "future_observed_at",
      severity: "fail",
      path: "/observedAt",
      message: `Evidence claims observation at ${evidence.observedAt}, after admission time ${context.evaluatedAt}; future-dated evidence cannot be admitted.`,
    });
  }

  if (
    evidence.validUntil !== undefined &&
    isAfter(context.evaluatedAt, evidence.validUntil)
  ) {
    issues.push({
      code: "stale_evidence",
      severity: "warn",
      path: "/validUntil",
      message: `Evidence expired at ${evidence.validUntil} before admission at ${context.evaluatedAt}.`,
    });
  }

  if (context.maxEvidenceAgeMs !== undefined) {
    const age = Date.parse(context.evaluatedAt) - Date.parse(evidence.observedAt);
    if (age > context.maxEvidenceAgeMs) {
      issues.push({
        code: "evidence_age_exceeded",
        severity: "warn",
        path: "/observedAt",
        message: `Evidence age ${age}ms exceeds the tolerated maximum ${context.maxEvidenceAgeMs}ms.`,
      });
    }
  }

  if (evidence.claimsAuthority === true) {
    issues.push({
      code: "authority_claim_downgraded",
      severity: "warn",
      path: "/claimsAuthority",
      message:
        "Evidence claims to be authoritative state; external claims are admitted as evidence only and never as authority.",
    });
  }

  if (
    evidence.claimedAuthority !== undefined &&
    context.trustedAuthorities !== undefined &&
    !context.trustedAuthorities.includes(evidence.claimedAuthority)
  ) {
    issues.push({
      code: "untrusted_authority",
      severity: "warn",
      path: "/claimedAuthority",
      message: `Claimed authority ${evidence.claimedAuthority} is not in the tenant trusted-authority set.`,
    });
  }

  if (
    PAYLOAD_INTEGRITY_KINDS.includes(evidence.kind) &&
    evidence.payloadHash === undefined
  ) {
    issues.push({
      code: "unverifiable_payload_integrity",
      severity: "warn",
      path: "/payloadHash",
      message: `Evidence kind ${evidence.kind} has no payload hash; integrity cannot be re-verified on replay.`,
    });
  }

  reviewApprovalCurrentness(evidence, context, issues);
  reviewProviderPolicy(evidence, context, issues);
  reviewMemoryFacet(evidence, issues);
  reviewWorkflowTrace(evidence, context, issues);
  reviewIdentityAlignment(evidence, issues);
  reviewPmHandoff(evidence, issues);

  const failed = issues.some((issue) => issue.severity === "fail");
  const decision: EvidenceAdmissionDecision = failed
    ? "rejected"
    : issues.length > 0
      ? "admitted_with_warnings"
      : "admitted";

  return {
    schemaVersion: EVIDENCE_ADMISSION_SCHEMA_VERSION,
    tenantId: context.tenantId,
    reviewId: `${evidence.evidenceId}:admission_review`,
    evidence,
    evaluatedAt: context.evaluatedAt,
    decision,
    authorityStatus: "evidence_only",
    issues,
    invariantClasses: uniqueInvariantClasses(
      issues.flatMap((issue) => invariantClassesForAdmissionIssue(issue.code)),
    ),
  };
}

export function toAdmittedStateEvidence(
  review: EvidenceAdmissionReview,
): AdmittedStateEvidence | undefined {
  if (review.decision === "rejected") return undefined;
  return {
    evidence: review.evidence,
    admissionReviewId: review.reviewId,
    admittedAt: review.evaluatedAt,
    warningCodes: uniqueIssueCodes(review.issues.map((issue) => issue.code)),
  };
}

/**
 * Bridge admitted evidence into the observed read-set lane so it participates
 * in observed-vs-declared comparison (C025: shared/external context becomes a
 * StateRef-bearing input only after admission).
 */
export function admittedStateEvidenceToObservedReadSetEntry(
  admitted: AdmittedStateEvidence,
  authority: string,
): ObservedReadSetEntry | undefined {
  const ref = admitted.evidence.subject ?? admitted.evidence.refs[0];
  if (ref === undefined) return undefined;
  return {
    ref,
    observedAt: admitted.evidence.observedAt,
    ...(admitted.evidence.validUntil !== undefined
      ? { validUntil: admitted.evidence.validUntil }
      : {}),
    authority,
    source: admitted.evidence.source,
    tool: admitted.evidence.kind,
  };
}

export function invariantClassesForAdmissionIssue(
  code: EvidenceAdmissionIssueCode,
): readonly StateReviewInvariantClass[] {
  switch (code) {
    case "tenant_mismatch":
      return ["tenant_boundary"];
    case "subject_mismatch":
      return ["subject_identity"];
    case "source_missing":
    case "unverifiable_payload_integrity":
    case "memory_retention_metadata_missing":
    case "pm_handoff_incomplete":
      return ["required_evidence"];
    case "future_observed_at":
    case "stale_evidence":
    case "evidence_age_exceeded":
    case "memory_stale_information_risk":
    case "policy_version_drift":
      return ["freshness_window"];
    case "authority_claim_downgraded":
    case "untrusted_authority":
    case "provenance_authorization_mismatch":
      return ["source_authority"];
    case "approval_revision_mismatch":
    case "approval_content_hash_mismatch":
      return ["state_conflict"];
    case "approval_scope_mismatch":
    case "sensitive_data_class_blocked":
      return ["capability_contract"];
    case "memory_deletion_residue_risk":
      return ["required_evidence"];
    case "workflow_stage_omitted":
    case "workflow_gate_failed":
      return ["workflow_position"];
    default:
      return [];
  }
}

function reviewApprovalCurrentness(
  evidence: ExternalStateEvidence,
  context: EvidenceAdmissionContext,
  issues: EvidenceAdmissionIssue[],
): void {
  const approval = evidence.approval;
  const current = context.currentApproval;
  if (approval === undefined || current === undefined) return;

  if (
    approval.approvedRevision !== undefined &&
    current.revision !== undefined &&
    approval.approvedRevision !== current.revision
  ) {
    issues.push({
      code: "approval_revision_mismatch",
      severity: "warn",
      path: "/approval/approvedRevision",
      message: `Approval was granted for revision ${approval.approvedRevision}; current revision is ${current.revision}. Approval state has drifted from current content.`,
    });
  }
  if (
    approval.approvedContentHash !== undefined &&
    current.contentHash !== undefined &&
    approval.approvedContentHash !== current.contentHash
  ) {
    issues.push({
      code: "approval_content_hash_mismatch",
      severity: "warn",
      path: "/approval/approvedContentHash",
      message: `Approval content hash ${approval.approvedContentHash} does not match current content hash ${current.contentHash}.`,
    });
  }
  if (
    approval.approvedScope !== undefined &&
    current.scope !== undefined &&
    approval.approvedScope !== current.scope
  ) {
    issues.push({
      code: "approval_scope_mismatch",
      severity: "warn",
      path: "/approval/approvedScope",
      message: `Approval scope ${approval.approvedScope} does not match the current action scope ${current.scope}.`,
    });
  }
}

function reviewProviderPolicy(
  evidence: ExternalStateEvidence,
  context: EvidenceAdmissionContext,
  issues: EvidenceAdmissionIssue[],
): void {
  const policy = evidence.providerPolicy;
  if (policy === undefined) return;

  if (
    policy.policyVersion !== undefined &&
    context.currentPolicyVersion !== undefined &&
    policy.policyVersion !== context.currentPolicyVersion
  ) {
    issues.push({
      code: "policy_version_drift",
      severity: "warn",
      path: "/providerPolicy/policyVersion",
      message: `Evidence was produced under policy version ${policy.policyVersion}; current policy version is ${context.currentPolicyVersion}.`,
    });
  }

  if (
    policy.allowedDataClasses !== undefined &&
    context.sensitiveDataClasses !== undefined
  ) {
    const blocked = context.sensitiveDataClasses.filter(
      (dataClass) => !policy.allowedDataClasses?.includes(dataClass),
    );
    for (const dataClass of blocked) {
      issues.push({
        code: "sensitive_data_class_blocked",
        severity: "warn",
        path: "/providerPolicy/allowedDataClasses",
        message: `Data class ${dataClass} is not allowed by the provider policy for this evidence.`,
      });
    }
  }
}

function reviewMemoryFacet(
  evidence: ExternalStateEvidence,
  issues: EvidenceAdmissionIssue[],
): void {
  if (evidence.kind !== "memory_retrieval") return;
  const memory = evidence.memory;

  if (memory?.retentionPolicy === undefined) {
    issues.push({
      code: "memory_retention_metadata_missing",
      severity: "warn",
      path: "/memory/retentionPolicy",
      message:
        "Memory evidence has no retention policy metadata; observability-safe retention cannot be verified (C026).",
    });
  }
  if (memory?.deletionResidueRisk === "medium" || memory?.deletionResidueRisk === "high") {
    issues.push({
      code: "memory_deletion_residue_risk",
      severity: "warn",
      path: "/memory/deletionResidueRisk",
      message: `Memory evidence carries ${memory.deletionResidueRisk} deletion-residue risk; deleted source content may persist in derived memory.`,
    });
  }
  if (
    memory?.staleInformationRisk === "medium" ||
    memory?.staleInformationRisk === "high"
  ) {
    issues.push({
      code: "memory_stale_information_risk",
      severity: "warn",
      path: "/memory/staleInformationRisk",
      message: `Memory evidence carries ${memory.staleInformationRisk} stale-information risk and requires current-state revalidation before use.`,
    });
  }
}

function reviewWorkflowTrace(
  evidence: ExternalStateEvidence,
  context: EvidenceAdmissionContext,
  issues: EvidenceAdmissionIssue[],
): void {
  const trace = evidence.workflowTrace;
  if (trace === undefined) return;

  if (context.expectedWorkflowStages !== undefined) {
    for (const stage of context.expectedWorkflowStages) {
      if (!trace.stages.includes(stage)) {
        issues.push({
          code: "workflow_stage_omitted",
          severity: "warn",
          path: "/workflowTrace/stages",
          message: `Workflow trace omits expected stage ${stage} (long-horizon stage-omission check, C027).`,
        });
      }
    }
  }

  for (const [gate, outcome] of Object.entries(trace.gateOutcomes ?? {})) {
    if (outcome === "failed") {
      issues.push({
        code: "workflow_gate_failed",
        severity: "warn",
        path: "/workflowTrace/gateOutcomes",
        message: `Workflow gate ${gate} failed in the traced run.`,
      });
    }
  }
}

function reviewIdentityAlignment(
  evidence: ExternalStateEvidence,
  issues: EvidenceAdmissionIssue[],
): void {
  const identity = evidence.identity;
  if (identity === undefined) return;
  if (
    identity.authorizedIntent === undefined ||
    (identity.actualSourcePath === undefined &&
      identity.actualParameterPath === undefined)
  ) {
    return;
  }

  const actualPaths = [
    identity.actualSourcePath,
    identity.actualParameterPath,
  ].filter((path): path is string => path !== undefined);
  const misaligned = actualPaths.filter(
    (path) => !pathWithinIntent(path, identity.authorizedIntent ?? ""),
  );
  for (const path of misaligned) {
    issues.push({
      code: "provenance_authorization_mismatch",
      severity: "warn",
      path: "/identity",
      message: `Actual access path ${path} is not within the authorized intent ${identity.authorizedIntent}; provenance and authorization graphs disagree.`,
    });
  }
}

function reviewPmHandoff(
  evidence: ExternalStateEvidence,
  issues: EvidenceAdmissionIssue[],
): void {
  if (evidence.kind !== "pm_handoff") return;
  const handoff = evidence.pmHandoff;
  const missing: string[] = [];
  if (handoff?.expertiseOwner === undefined) missing.push("expertiseOwner");
  if (handoff?.sourceSteward === undefined) missing.push("sourceSteward");
  if (handoff?.escalationOwner === undefined) missing.push("escalationOwner");
  if (missing.length > 0) {
    issues.push({
      code: "pm_handoff_incomplete",
      severity: "warn",
      path: "/pmHandoff",
      message: `PM handoff evidence is missing typed owners: ${missing.join(", ")} (C030).`,
    });
  }
}

/**
 * PM distributed-state agreement (research frontier item 10): measure
 * structured agreement between two handoff artifacts - dependency-structure
 * agreement, owner convergence, handoff-condition resolution, and valid
 * next-action overlap - instead of judging dashboard richness (C021, C030).
 */
export interface PmHandoffAgreement {
  readonly dependencyAgreementRate: number;
  readonly ownerConvergence: {
    readonly expertiseOwner: boolean;
    readonly sourceSteward: boolean;
    readonly escalationOwner: boolean;
  };
  readonly ownerConvergenceRate: number;
  readonly sharedUnresolvedRisks: readonly string[];
  readonly unresolvedRiskCount: number;
  readonly handoffConditionResolved: boolean;
  readonly agreedNextActions: readonly string[];
  readonly nextActionAgreementRate: number;
}

export function comparePmHandoffAgreement(
  left: PmHandoffEvidenceFacet,
  right: PmHandoffEvidenceFacet,
): PmHandoffAgreement {
  const leftDeps = (left.dependencyRefs ?? []).map(formatStateRef);
  const rightDeps = (right.dependencyRefs ?? []).map(formatStateRef);
  const dependencyAgreementRate = jaccard(leftDeps, rightDeps);

  const ownerConvergence = {
    expertiseOwner: definedAndEqual(left.expertiseOwner, right.expertiseOwner),
    sourceSteward: definedAndEqual(left.sourceSteward, right.sourceSteward),
    escalationOwner: definedAndEqual(left.escalationOwner, right.escalationOwner),
  };
  const ownerMatches = [
    ownerConvergence.expertiseOwner,
    ownerConvergence.sourceSteward,
    ownerConvergence.escalationOwner,
  ].filter(Boolean).length;

  const unresolvedRisks = [
    ...new Set([...(left.unresolvedRisks ?? []), ...(right.unresolvedRisks ?? [])]),
  ];
  const sharedUnresolvedRisks = (left.unresolvedRisks ?? []).filter((risk) =>
    (right.unresolvedRisks ?? []).includes(risk),
  );

  const leftActions = left.validNextActions ?? [];
  const rightActions = right.validNextActions ?? [];
  const agreedNextActions = leftActions.filter((action) =>
    rightActions.includes(action),
  );

  return {
    dependencyAgreementRate,
    ownerConvergence,
    ownerConvergenceRate: ownerMatches / 3,
    sharedUnresolvedRisks,
    unresolvedRiskCount: unresolvedRisks.length,
    handoffConditionResolved: unresolvedRisks.length === 0,
    agreedNextActions,
    nextActionAgreementRate: jaccard(leftActions, rightActions),
  };
}

function jaccard(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 1;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 1 : intersection / union;
}

function definedAndEqual(left?: string, right?: string): boolean {
  return left !== undefined && right !== undefined && left === right;
}

function pathWithinIntent(path: string, intent: string): boolean {
  return path === intent || path.startsWith(`${intent}/`) || path.startsWith(`${intent}:`);
}

function sameStateRef(left: StateRef, right: StateRef): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function formatStateRef(ref: StateRef): string {
  return `${ref.kind}:${ref.id}`;
}

function isAfter(left: Timestamp, right: Timestamp): boolean {
  return Date.parse(left) > Date.parse(right);
}

function uniqueInvariantClasses(
  items: readonly StateReviewInvariantClass[],
): readonly StateReviewInvariantClass[] {
  return [...new Set(items)];
}

function uniqueIssueCodes(
  items: readonly EvidenceAdmissionIssueCode[],
): readonly EvidenceAdmissionIssueCode[] {
  return [...new Set(items)];
}
