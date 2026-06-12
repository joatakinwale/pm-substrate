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
  readonly stateReviewArtifactHash?: string;
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

export type EvidenceBindingValidationDecision =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason:
        | "evidence_binding_missing"
        | "evidence_binding_incomplete"
        | "evidence_policy_blocked";
      readonly issues: readonly EvidenceBindingIssue[];
    };

export type EvidenceBindingVerificationDecision =
  | EvidenceBindingValidationDecision
  | {
      readonly valid: false;
      readonly reason: "evidence_binding_unverified";
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

export interface EvidenceBindingReferenceCatalog {
  readonly stateReviewArtifacts: readonly EvidenceBindingStateReviewArtifactRef[];
  readonly evidenceAdmissionReviews: readonly EvidenceBindingAdmissionReviewRef[];
}

export interface EvidenceBindingRuntimeVerificationRequest {
  readonly request: EvidenceBindingRequest;
  readonly evidenceBinding: InvocationEvidenceBinding;
}

export interface EvidenceBindingVerificationRequest
  extends EvidenceBindingRuntimeVerificationRequest {
  readonly catalog: EvidenceBindingReferenceCatalog;
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

  if (issues.length > 0) {
    return {
      valid: false,
      reason: "evidence_binding_unverified",
      issues,
    };
  }

  return { valid: true };
}
