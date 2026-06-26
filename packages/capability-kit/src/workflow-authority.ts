import type {
  GraphWriteAuthorityContext,
  GraphWriteAuthorityResolution,
  GraphWriteAuthorityResolver,
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

export interface WorkflowGraphWriteAuthorityEnvelopeLookup {
  readonly tenantId: string;
  readonly envelopeId: string;
}

export interface WorkflowGraphWriteAuthorityEnvelopeStore {
  getWorkflowActionOutcomeEnvelope(
    lookup: WorkflowGraphWriteAuthorityEnvelopeLookup,
  ): Promise<WorkflowGraphWriteAuthorityEnvelope | null | undefined>;
}

export interface StoredWorkflowGraphWriteAuthorityResolverOptions<TPayload> {
  readonly store: WorkflowGraphWriteAuthorityEnvelopeStore;
  readonly envelopeId: (
    ctx: GraphWriteAuthorityContext<TPayload>,
  ) => string | null | undefined | Promise<string | null | undefined>;
  readonly expectedActionId?: (
    ctx: GraphWriteAuthorityContext<TPayload>,
  ) => string | null | undefined | Promise<string | null | undefined>;
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

export const graphWriteAuthorityResolverFromWorkflowEnvelopeStore = <TPayload>(
  options: StoredWorkflowGraphWriteAuthorityResolverOptions<TPayload>,
): GraphWriteAuthorityResolver<TPayload> => {
  return async (ctx) => {
    const envelopeId = await options.envelopeId(ctx);
    if (envelopeId === null || envelopeId === undefined || envelopeId.trim() === "") {
      throw new GraphWriteAuthorityResolutionError(
        "workflow action outcome envelope id is required for graph write authority",
      );
    }

    const envelope = await options.store.getWorkflowActionOutcomeEnvelope({
      tenantId: String(ctx.tenantId),
      envelopeId,
    });
    if (envelope === null || envelope === undefined) {
      throw new GraphWriteAuthorityResolutionError(
        `workflow action outcome envelope ${envelopeId} was not found in the authority store`,
      );
    }
    if (envelope.envelopeId !== envelopeId) {
      throw new GraphWriteAuthorityResolutionError(
        `workflow action outcome envelope store returned ${envelope.envelopeId} for requested ${envelopeId}`,
      );
    }

    const expectedActionId = await options.expectedActionId?.(ctx);
    if (
      expectedActionId !== null &&
      expectedActionId !== undefined &&
      expectedActionId !== envelope.actionId
    ) {
      throw new GraphWriteAuthorityResolutionError(
        `workflow action outcome envelope ${envelopeId} action ${envelope.actionId} does not match expected action ${expectedActionId}`,
      );
    }

    return graphWriteAuthorityResolutionFromWorkflowEnvelope(envelope);
  };
};
