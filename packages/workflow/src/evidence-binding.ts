import { createHash } from "node:crypto";
import type {
  TerminalAdmissionProviderCertificate,
  TerminalAdmissionProviderCertificateStatus,
  Timestamp,
} from "@pm/types";

export type EvidenceBindingMode = "off" | "require_for_writes";

export type InvocationEvidenceConsequence = "low" | "medium" | "high";
export type InvocationActionTerminalOutcome = "accepted" | "blocked";
export type EvidenceBindingFailureReason =
  | "evidence_binding_missing"
  | "evidence_binding_incomplete"
  | "evidence_policy_blocked"
  | "evidence_binding_unverified"
  | "provider_certificate_missing"
  | "provider_certificate_invalid";

export interface InvocationEvidencePolicyDisposition {
  readonly evaluatedAt: string;
  readonly consequence: InvocationEvidenceConsequence;
  readonly wouldBlock: boolean;
  readonly mode: "advisory" | "blocking";
}

export interface InvocationEvidenceBinding {
  readonly stateReviewArtifactId: string;
  readonly stateReviewArtifactHash?: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly admissionCertificateId?: string;
  readonly admissionCertificateDigest?: string;
  readonly policyDisposition: InvocationEvidencePolicyDisposition;
}

export interface InvocationActionOutcomeProviderCertificateStatusRef {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly status: TerminalAdmissionProviderCertificateStatus;
  readonly statusSequence: number;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: string;
  readonly checkedAt: string;
}

export interface InvocationActionOutcomeProviderCertificateLookupResult {
  readonly certificate: TerminalAdmissionProviderCertificate;
  readonly statusRef?: InvocationActionOutcomeProviderCertificateStatusRef;
}

export type InvocationActionOutcomeProviderCertificateLookup =
  | TerminalAdmissionProviderCertificate
  | InvocationActionOutcomeProviderCertificateLookupResult;

export interface EvidenceBindingRequest {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly capabilityWrites: boolean;
  readonly triggerEventId: string;
}

export interface InvocationActionOutcomeEnvelope {
  readonly schemaVersion: "pm.workflow.action_outcome_envelope.v1";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: InvocationActionTerminalOutcome;
  readonly generatedAt: string;
  readonly tenantId: string;
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
  readonly providerCertificateStatusRef?: InvocationActionOutcomeProviderCertificateStatusRef;
  readonly evidenceDecision: {
    readonly valid: boolean;
    readonly reason?: EvidenceBindingFailureReason;
  };
}

export type InvocationActionOutcomeAdmissionRejectionReason =
  | "terminal_outcome_conflict"
  | "invalid_action_outcome_envelope"
  | "admission_unavailable";

export type InvocationActionOutcomeAdmissionDecision =
  | {
      readonly admitted: true;
      readonly reason: "admitted" | "idempotent_replay";
      readonly message?: string;
    }
  | {
      readonly admitted: false;
      readonly reason: InvocationActionOutcomeAdmissionRejectionReason;
      readonly message: string;
      readonly incumbentEnvelopeId?: string;
      readonly incumbentTerminalOutcome?: InvocationActionTerminalOutcome;
    };

export interface InvocationActionOutcomeAdmissionRequest {
  readonly request: EvidenceBindingRequest;
  readonly envelope: InvocationActionOutcomeEnvelope;
  readonly providerCertificate?: TerminalAdmissionProviderCertificate;
  readonly providerCertificateStatusRef?: InvocationActionOutcomeProviderCertificateStatusRef;
}

export interface InvocationActionOutcomeAdmissionPort {
  admit(
    request: InvocationActionOutcomeAdmissionRequest,
  ): Promise<InvocationActionOutcomeAdmissionDecision>;
}

export interface EvidenceBindingProvider {
  bind(
    ctx: EvidenceBindingRequest,
  ): Promise<InvocationEvidenceBinding | null | undefined>;
}

export interface InvocationActionOutcomeProviderCertificateProvider {
  getCertificate(
    request: EvidenceBindingRequest,
    checkedAt?: Timestamp,
  ): Promise<InvocationActionOutcomeProviderCertificateLookup | null | undefined>;
}

export interface EvidenceBindingVerifier {
  verify(
    ctx: EvidenceBindingRuntimeVerificationRequest,
  ): Promise<EvidenceBindingVerificationDecision>;
}

export interface EvidenceBindingValidationCheck {
  readonly capabilityWrites: boolean;
  readonly evidenceBindingRequired: boolean;
  readonly evidenceBinding?: Partial<InvocationEvidenceBinding> | null;
}

export interface EvidenceBindingIssue {
  readonly path: string;
  readonly message: string;
}

export type EvidenceBindingValidationFailureReason =
  | "evidence_binding_missing"
  | "evidence_binding_incomplete"
  | "evidence_policy_blocked";

export type EvidenceBindingValidationDecision =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason: EvidenceBindingValidationFailureReason;
      readonly issues: readonly EvidenceBindingIssue[];
    };

export type EvidenceBindingVerificationDecision =
  | EvidenceBindingValidationDecision
  | {
      readonly valid: false;
      readonly reason: Exclude<
        EvidenceBindingFailureReason,
        EvidenceBindingValidationFailureReason
      >;
      readonly issues: readonly EvidenceBindingIssue[];
    };

export interface EvidenceBindingStateReviewArtifactRef {
  readonly stateReviewArtifactId: string;
  readonly artifactHash?: string;
  readonly tenantId?: string;
  readonly workflowId?: string;
  readonly workflowRunId?: string;
  readonly currentStateViewId?: string;
  readonly evidenceAdmissionReviewIds?: readonly string[];
}

export interface EvidenceBindingAdmissionReviewRef {
  readonly reviewId: string;
  readonly tenantId?: string;
  readonly decision?: "admitted" | "admitted_with_warnings" | "rejected";
  readonly authorityStatus?: "evidence_only";
}

export interface EvidenceBindingAdmissionCertificateRef {
  readonly certificateId: string;
  readonly certificateDigest?: string;
  readonly stateReviewArtifactId: string;
  readonly stateReviewArtifactHash?: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly tenantId?: string;
  readonly workflowId?: string;
  readonly policyVersion: string;
  readonly revocationEpoch: number;
  readonly executionIdentity: string;
  readonly validFrom: string;
  readonly validUntil?: string;
  readonly revokedAt?: string;
}

export interface EvidenceBindingReferenceCatalog {
  readonly stateReviewArtifacts: readonly EvidenceBindingStateReviewArtifactRef[];
  readonly evidenceAdmissionReviews: readonly EvidenceBindingAdmissionReviewRef[];
  readonly admissionCertificates?: readonly EvidenceBindingAdmissionCertificateRef[];
}

export interface EvidenceBindingRuntimeVerificationRequest {
  readonly request: EvidenceBindingRequest;
  readonly evidenceBinding: InvocationEvidenceBinding;
}

export interface EvidenceBindingVerificationRequest
  extends EvidenceBindingRuntimeVerificationRequest {
  readonly catalog: EvidenceBindingReferenceCatalog;
}

export function buildInvocationActionOutcomeEnvelope(input: {
  readonly request: EvidenceBindingRequest;
  readonly evidenceBinding?: InvocationEvidenceBinding | null;
  readonly evidenceDecision: EvidenceBindingVerificationDecision;
  readonly generatedAt: string;
  readonly providerCertificate?: TerminalAdmissionProviderCertificate;
  readonly providerCertificateStatusRef?: InvocationActionOutcomeProviderCertificateStatusRef;
}): InvocationActionOutcomeEnvelope {
  const actionId = [
    input.request.tenantId,
    input.request.workflowId,
    input.request.workflowVersion,
    input.request.nodeId,
    input.request.triggerEventId,
  ].join(":");
  const terminalOutcome = input.evidenceDecision.valid ? "accepted" : "blocked";
  const binding = input.evidenceBinding ?? undefined;
  const evidenceAdmissionReviewIds = [
    ...(binding?.evidenceAdmissionReviewIds ?? []),
  ];
  const envelopeSeed = {
    actionId,
    terminalOutcome,
    stateReviewArtifactId: binding?.stateReviewArtifactId,
    stateReviewArtifactHash: binding?.stateReviewArtifactHash,
    evidenceAdmissionReviewIds,
    providerCertificateId: input.providerCertificate?.certificateId,
    providerCertificateDigest: input.providerCertificate?.certificateDigest,
    providerCertificateStatusRef: input.providerCertificateStatusRef,
    evidenceDecision: input.evidenceDecision,
  };
  const envelopeId = `outcome_${createHash("sha256")
    .update(JSON.stringify(envelopeSeed))
    .digest("hex")
    .slice(0, 32)}`;

  return {
    schemaVersion: "pm.workflow.action_outcome_envelope.v1",
    envelopeId,
    actionId,
    terminalOutcome,
    generatedAt: input.generatedAt,
    tenantId: input.request.tenantId,
    workflowId: input.request.workflowId,
    workflowName: input.request.workflowName,
    workflowVersion: input.request.workflowVersion,
    nodeId: input.request.nodeId,
    capability: input.request.capability,
    triggerEventId: input.request.triggerEventId,
    ...(binding?.stateReviewArtifactId !== undefined
      ? { stateReviewArtifactId: binding.stateReviewArtifactId }
      : {}),
    ...(binding?.stateReviewArtifactHash !== undefined
      ? { stateReviewArtifactHash: binding.stateReviewArtifactHash }
      : {}),
    evidenceAdmissionReviewIds,
    ...(input.providerCertificate !== undefined
      ? {
          providerCertificateId: input.providerCertificate.certificateId,
          providerCertificateDigest: input.providerCertificate.certificateDigest,
        }
      : {}),
    ...(input.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: input.providerCertificateStatusRef }
      : {}),
    evidenceDecision: input.evidenceDecision.valid
      ? { valid: true }
      : {
          valid: false,
          reason: input.evidenceDecision.reason,
        },
  };
}

export function validateInvocationEvidenceBinding(
  check: EvidenceBindingValidationCheck,
): EvidenceBindingValidationDecision {
  if (!check.capabilityWrites || !check.evidenceBindingRequired) {
    return { valid: true };
  }

  const binding = check.evidenceBinding;
  if (binding === null || binding === undefined) {
    return {
      valid: false,
      reason: "evidence_binding_missing",
      issues: [
        {
          path: "/evidenceBinding",
          message:
            "write-capable invocation requires stateReviewArtifactId, evidenceAdmissionReviewIds, and policyDisposition before dispatch",
        },
      ],
    };
  }

  const issues: Array<{ path: string; message: string }> = [];
  if (
    typeof binding.stateReviewArtifactId !== "string" ||
    binding.stateReviewArtifactId.trim() === ""
  ) {
    issues.push({
      path: "/evidenceBinding/stateReviewArtifactId",
      message: "state review artifact id is required",
    });
  }
  if (!Array.isArray(binding.evidenceAdmissionReviewIds)) {
    issues.push({
      path: "/evidenceBinding/evidenceAdmissionReviewIds",
      message: "evidence admission review ids are required",
    });
  } else if (binding.evidenceAdmissionReviewIds.length === 0) {
    issues.push({
      path: "/evidenceBinding/evidenceAdmissionReviewIds",
      message: "at least one evidence admission review id is required",
    });
  } else {
    binding.evidenceAdmissionReviewIds.forEach((id, index) => {
      if (typeof id !== "string" || id.trim() === "") {
        issues.push({
          path: `/evidenceBinding/evidenceAdmissionReviewIds/${index}`,
          message: "evidence admission review id must be a non-empty string",
        });
      }
    });
  }

  if (
    binding.admissionCertificateId !== undefined &&
    (typeof binding.admissionCertificateId !== "string" ||
      binding.admissionCertificateId.trim() === "")
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate id must be a non-empty string",
    });
  }
  if (
    binding.admissionCertificateDigest !== undefined &&
    (typeof binding.admissionCertificateDigest !== "string" ||
      binding.admissionCertificateDigest.trim() === "")
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateDigest",
      message: "admission certificate digest must be a non-empty string",
    });
  }

  const disposition = binding.policyDisposition;
  if (disposition === undefined) {
    issues.push({
      path: "/evidenceBinding/policyDisposition",
      message: "policy disposition is required",
    });
  } else if (
    typeof disposition.evaluatedAt !== "string" ||
    disposition.evaluatedAt.trim() === ""
  ) {
    issues.push({
      path: "/evidenceBinding/policyDisposition/evaluatedAt",
      message: "policy disposition evaluatedAt is required",
    });
  } else if (
    disposition.consequence !== "low" &&
    disposition.consequence !== "medium" &&
    disposition.consequence !== "high"
  ) {
    issues.push({
      path: "/evidenceBinding/policyDisposition/consequence",
      message: "policy disposition consequence must be low, medium, or high",
    });
  } else if (typeof disposition.wouldBlock !== "boolean") {
    issues.push({
      path: "/evidenceBinding/policyDisposition/wouldBlock",
      message: "policy disposition wouldBlock must be boolean",
    });
  } else if (
    disposition.mode !== "advisory" &&
    disposition.mode !== "blocking"
  ) {
    issues.push({
      path: "/evidenceBinding/policyDisposition/mode",
      message: "policy disposition mode must be advisory or blocking",
    });
  }

  if (issues.length > 0) {
    return {
      valid: false,
      reason: "evidence_binding_incomplete",
      issues,
    };
  }

  if (
    binding.policyDisposition?.mode === "blocking" &&
    binding.policyDisposition.wouldBlock === true
  ) {
    return {
      valid: false,
      reason: "evidence_policy_blocked",
      issues: [
        {
          path: "/evidenceBinding/policyDisposition",
          message: "blocking policy disposition denies write-capable dispatch",
        },
      ],
    };
  }

  return { valid: true };
}

export function verifyInvocationEvidenceBindingAgainstCatalog(
  check: EvidenceBindingVerificationRequest,
): EvidenceBindingVerificationDecision {
  const structural = validateInvocationEvidenceBinding({
    capabilityWrites: check.request.capabilityWrites,
    evidenceBindingRequired: true,
    evidenceBinding: check.evidenceBinding,
  });
  if (!structural.valid) return structural;

  const binding = check.evidenceBinding;
  const issues: EvidenceBindingIssue[] = [];
  const artifact = check.catalog.stateReviewArtifacts.find(
    (ref) => ref.stateReviewArtifactId === binding.stateReviewArtifactId,
  );

  if (!artifact) {
    issues.push({
      path: "/evidenceBinding/stateReviewArtifactId",
      message: "state review artifact id was not found in the verification catalog",
    });
  } else {
    if (artifact.tenantId !== undefined && artifact.tenantId !== check.request.tenantId) {
      issues.push({
        path: "/evidenceBinding/stateReviewArtifactId",
        message: "state review artifact tenant does not match invocation tenant",
      });
    }
    if (artifact.workflowId !== undefined && artifact.workflowId !== check.request.workflowId) {
      issues.push({
        path: "/evidenceBinding/stateReviewArtifactId",
        message: "state review artifact workflow does not match invocation workflow",
      });
    }
    if (artifact.artifactHash !== undefined) {
      if (binding.stateReviewArtifactHash === undefined) {
        issues.push({
          path: "/evidenceBinding/stateReviewArtifactHash",
          message: "state review artifact hash is required for verified evidence bindings",
        });
      } else if (binding.stateReviewArtifactHash !== artifact.artifactHash) {
        issues.push({
          path: "/evidenceBinding/stateReviewArtifactHash",
          message: "state review artifact hash does not match the verification catalog",
        });
      }
    }
    if (artifact.evidenceAdmissionReviewIds !== undefined) {
      const artifactReviewIds = new Set(artifact.evidenceAdmissionReviewIds);
      for (const id of binding.evidenceAdmissionReviewIds) {
        if (!artifactReviewIds.has(id)) {
          issues.push({
            path: "/evidenceBinding/evidenceAdmissionReviewIds",
            message:
              "evidence admission review id is not linked to the referenced state review artifact",
          });
        }
      }
    }
  }

  const reviews = new Map(
    check.catalog.evidenceAdmissionReviews.map((review) => [
      review.reviewId,
      review,
    ]),
  );
  for (const [index, id] of binding.evidenceAdmissionReviewIds.entries()) {
    const review = reviews.get(id);
    if (!review) {
      issues.push({
        path: `/evidenceBinding/evidenceAdmissionReviewIds/${index}`,
        message: "evidence admission review id was not found in the verification catalog",
      });
      continue;
    }
    if (review.tenantId !== undefined && review.tenantId !== check.request.tenantId) {
      issues.push({
        path: `/evidenceBinding/evidenceAdmissionReviewIds/${index}`,
        message: "evidence admission review tenant does not match invocation tenant",
      });
    }
    if (
      review.decision === "rejected" &&
      !(
        binding.policyDisposition.mode === "blocking" &&
        binding.policyDisposition.wouldBlock
      )
    ) {
      issues.push({
        path: "/evidenceBinding/policyDisposition",
        message:
          "rejected evidence admission reviews require a blocking policy disposition",
      });
    }
  }

  const certificates = check.catalog.admissionCertificates ?? [];
  const artifactCertificates = certificates.filter(
    (certificate) =>
      certificate.stateReviewArtifactId === binding.stateReviewArtifactId,
  );
  if (artifactCertificates.length > 0) {
    if (
      binding.admissionCertificateId === undefined ||
      binding.admissionCertificateId.trim() === ""
    ) {
      issues.push({
        path: "/evidenceBinding/admissionCertificateId",
        message:
          "admission certificate id is required for certificate-backed catalog verification",
      });
    } else {
      verifyAdmissionCertificateRef({
        certificate: certificates.find(
          (candidate) =>
            candidate.certificateId === binding.admissionCertificateId,
        ),
        request: check.request,
        binding,
        issues,
      });
    }
  } else if (binding.admissionCertificateId !== undefined) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message:
        "admission certificate id was not found in the verification catalog",
    });
  }

  if (issues.length > 0) {
    return {
      valid: false,
      reason: "evidence_binding_unverified",
      issues,
    };
  }

  return { valid: true };
}

function verifyAdmissionCertificateRef(input: {
  readonly certificate: EvidenceBindingAdmissionCertificateRef | undefined;
  readonly request: EvidenceBindingRequest;
  readonly binding: InvocationEvidenceBinding;
  readonly issues: EvidenceBindingIssue[];
}): void {
  const { certificate, request, binding, issues } = input;
  if (!certificate) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate id was not found in the verification catalog",
    });
    return;
  }

  if (
    certificate.certificateDigest !== undefined &&
    binding.admissionCertificateDigest === undefined
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateDigest",
      message: "admission certificate digest is required for this catalog ref",
    });
  } else if (
    certificate.certificateDigest !== undefined &&
    binding.admissionCertificateDigest !== certificate.certificateDigest
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateDigest",
      message:
        "admission certificate digest does not match the verification catalog",
    });
  }

  if (certificate.tenantId !== undefined && certificate.tenantId !== request.tenantId) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate tenant does not match invocation tenant",
    });
  }
  if (certificate.workflowId !== undefined && certificate.workflowId !== request.workflowId) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate workflow does not match invocation workflow",
    });
  }
  if (certificate.stateReviewArtifactId !== binding.stateReviewArtifactId) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message:
        "admission certificate is not bound to the referenced state review artifact",
    });
  }
  if (
    certificate.stateReviewArtifactHash !== undefined &&
    binding.stateReviewArtifactHash !== certificate.stateReviewArtifactHash
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message:
        "admission certificate artifact hash does not match the invocation binding",
    });
  }

  const certifiedReviewIds = new Set(certificate.evidenceAdmissionReviewIds);
  const bindingReviewIds = new Set(binding.evidenceAdmissionReviewIds);
  for (const id of bindingReviewIds) {
    if (!certifiedReviewIds.has(id)) {
      issues.push({
        path: "/evidenceBinding/admissionCertificateId",
        message:
          "admission certificate does not cover every bound evidence admission review",
      });
      break;
    }
  }
  for (const id of certifiedReviewIds) {
    if (!bindingReviewIds.has(id)) {
      issues.push({
        path: "/evidenceBinding/admissionCertificateId",
        message:
          "invocation binding omits an evidence admission review covered by the admission certificate",
      });
      break;
    }
  }

  if (certificate.policyVersion.trim() === "") {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate policy version is required",
    });
  }
  if (
    !Number.isInteger(certificate.revocationEpoch) ||
    certificate.revocationEpoch < 0
  ) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate revocation epoch must be a non-negative integer",
    });
  }
  if (certificate.executionIdentity.trim() === "") {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate execution identity is required",
    });
  }

  const evaluatedAt = parseIsoTimestamp(binding.policyDisposition.evaluatedAt);
  const validFrom = parseIsoTimestamp(certificate.validFrom);
  const validUntil =
    certificate.validUntil === undefined
      ? undefined
      : parseIsoTimestamp(certificate.validUntil);
  const revokedAt =
    certificate.revokedAt === undefined
      ? undefined
      : parseIsoTimestamp(certificate.revokedAt);

  if (evaluatedAt === undefined) {
    issues.push({
      path: "/evidenceBinding/policyDisposition/evaluatedAt",
      message: "policy disposition evaluatedAt is not a valid timestamp",
    });
  }
  if (validFrom === undefined) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate validFrom is not a valid timestamp",
    });
  }
  if (validUntil === undefined && certificate.validUntil !== undefined) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate validUntil is not a valid timestamp",
    });
  }
  if (revokedAt === undefined && certificate.revokedAt !== undefined) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate revokedAt is not a valid timestamp",
    });
  }

  if (evaluatedAt === undefined) return;
  if (validFrom !== undefined && evaluatedAt < validFrom) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate is outside its validity window",
    });
  }
  if (validUntil !== undefined && evaluatedAt > validUntil) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate is outside its validity window",
    });
  }
  if (revokedAt !== undefined && evaluatedAt >= revokedAt) {
    issues.push({
      path: "/evidenceBinding/admissionCertificateId",
      message: "admission certificate was revoked before verification",
    });
  }
}

function parseIsoTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
