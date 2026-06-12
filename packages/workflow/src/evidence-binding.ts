export type EvidenceBindingMode = "off" | "require_for_writes";

export type InvocationEvidenceConsequence = "low" | "medium" | "high";

export interface InvocationEvidencePolicyDisposition {
  readonly evaluatedAt: string;
  readonly consequence: InvocationEvidenceConsequence;
  readonly wouldBlock: boolean;
  readonly mode: "advisory" | "blocking";
}

export interface InvocationEvidenceBinding {
  readonly stateReviewArtifactId: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly policyDisposition: InvocationEvidencePolicyDisposition;
}

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

export interface EvidenceBindingProvider {
  bind(
    ctx: EvidenceBindingRequest,
  ): Promise<InvocationEvidenceBinding | null | undefined>;
}

export interface EvidenceBindingValidationCheck {
  readonly capabilityWrites: boolean;
  readonly evidenceBindingRequired: boolean;
  readonly evidenceBinding?: Partial<InvocationEvidenceBinding> | null;
}

export type EvidenceBindingValidationDecision =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason:
        | "evidence_binding_missing"
        | "evidence_binding_incomplete"
        | "evidence_policy_blocked";
      readonly issues: ReadonlyArray<{
        readonly path: string;
        readonly message: string;
      }>;
    };

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
