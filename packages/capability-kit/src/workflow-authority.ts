import type {
  GraphWriteAuthorityResolution,
} from "./define.js";

export interface WorkflowGraphWriteAuthorityStatusRef {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly status: "valid" | "revoked" | "superseded";
  readonly statusSequence: number;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: string;
  readonly checkedAt: string;
}

export interface WorkflowGraphWriteAuthorityEnvelope {
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted" | "blocked" | "rejected" | "held";
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: WorkflowGraphWriteAuthorityStatusRef;
}

export class GraphWriteAuthorityResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphWriteAuthorityResolutionError";
  }
}

/**
 * Converts an already admitted workflow action-outcome envelope into the
 * graph/capability authority bundle expected by strict graph write policies.
 *
 * This helper is intentionally structural: callers can pass
 * `InvocationContext.actionOutcomeEnvelope` without making workflow import
 * capability-kit or capability-kit import workflow. The caller remains
 * responsible for using this only after the workflow runtime has admitted the
 * envelope through its substrate action-outcome admission port.
 */
export const graphWriteAuthorityResolutionFromWorkflowEnvelope = (
  envelope: WorkflowGraphWriteAuthorityEnvelope | null | undefined,
): GraphWriteAuthorityResolution => {
  if (envelope === null || envelope === undefined) {
    throw new GraphWriteAuthorityResolutionError(
      "workflow action outcome envelope is required for graph write authority",
    );
  }
  if (envelope.terminalOutcome !== "accepted") {
    throw new GraphWriteAuthorityResolutionError(
      `workflow action outcome envelope ${envelope.envelopeId} is not accepted`,
    );
  }

  const authorityRef = {
    authorityKind: "workflow_action_outcome_envelope" as const,
    envelopeId: envelope.envelopeId,
    actionId: envelope.actionId,
    terminalOutcome: "accepted" as const,
    ...(envelope.providerCertificateId !== undefined
      ? { providerCertificateId: envelope.providerCertificateId }
      : {}),
    ...(envelope.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: envelope.providerCertificateDigest }
      : {}),
    ...(envelope.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: envelope.providerCertificateStatusRef }
      : {}),
  };

  return {
    authorityRef,
    substrateRecord: {
      authorityKind: "workflow_action_outcome_envelope",
      envelopeId: envelope.envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: "accepted",
      ...(envelope.providerCertificateId !== undefined
        ? { providerCertificateId: envelope.providerCertificateId }
        : {}),
      ...(envelope.providerCertificateDigest !== undefined
        ? { providerCertificateDigest: envelope.providerCertificateDigest }
        : {}),
      ...(envelope.providerCertificateStatusRef !== undefined
        ? { providerCertificateStatusRef: envelope.providerCertificateStatusRef }
        : {}),
    },
  };
};
