import type {
  GraphWriteAuthorityContext,
  GraphWriteAuthorityResolution,
  GraphWriteAuthorityResolver,
} from "./define.js";
import type {
  GraphWriteProjectionReplayRef,
  GraphWriteProjectionReplayRootSettlementRef,
} from "@pm/graph";

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
  readonly projectionReplayRef?: GraphWriteProjectionReplayRef;
  readonly projectionReplayRootSettlementRef?: GraphWriteProjectionReplayRootSettlementRef;
  readonly projectionReplayRootConsistencyProof?: WorkflowGraphWriteProjectionReplayRootConsistencyProof;
}

export interface WorkflowGraphWriteProjectionReplayStoreRoot {
  readonly tenantId: string;
  readonly sequence: number;
  readonly rootHash: string;
  readonly previousRootHash?: string;
  readonly recordedAt: string;
}

export interface WorkflowGraphWriteProjectionReplayStoreEntry {
  readonly tenantId: string;
  readonly sequence: number;
  readonly certificateId: string;
  readonly certificateHash: string;
  readonly projectionName: string;
  readonly projectionVersion: number;
  readonly replayedToPosition: number;
  readonly transitionHistoryHash: string;
  readonly projectionHash: string;
  readonly previousEntryHash?: string;
  readonly recordedAt: string;
  readonly entryHash: string;
}

export interface WorkflowGraphWriteProjectionReplayRootConsistencyProof {
  readonly tenantId: string;
  readonly fromRoot?: WorkflowGraphWriteProjectionReplayStoreRoot;
  readonly toRoot: WorkflowGraphWriteProjectionReplayStoreRoot;
  readonly entries: readonly WorkflowGraphWriteProjectionReplayStoreEntry[];
}

export interface WorkflowGraphWriteProjectionReplayRootWitnessIssue {
  readonly code: string;
  readonly message: string;
}

export interface WorkflowGraphWriteProjectionReplayRootWitnessDecision {
  readonly accepted: boolean;
  readonly status: string;
  readonly issues: readonly WorkflowGraphWriteProjectionReplayRootWitnessIssue[];
}

export interface WorkflowGraphWriteProjectionReplayRootWitness {
  observeProjectionReplayCertificateStoreRoot(input: {
    readonly tenantId: string;
    readonly observerId: string;
    readonly observedAt: string;
    readonly root: WorkflowGraphWriteProjectionReplayStoreRoot;
    readonly consistencyProof?: WorkflowGraphWriteProjectionReplayRootConsistencyProof;
  }): Promise<WorkflowGraphWriteProjectionReplayRootWitnessDecision>;
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

export interface WorkflowGraphWriteProjectionReplayCertificateStoreIssue {
  readonly code: string;
  readonly message: string;
}

export interface WorkflowGraphWriteProjectionReplayCertificateStoreVerification {
  readonly valid: boolean;
  readonly certificateId: string;
  readonly issues: readonly WorkflowGraphWriteProjectionReplayCertificateStoreIssue[];
}

export interface WorkflowGraphWriteProjectionReplayCertificateStore {
  verifyProjectionReplayCertificateRef(input: {
    readonly tenantId: string;
    readonly ref: GraphWriteProjectionReplayRef;
    readonly requireStoreCommitment?: boolean;
  }): Promise<WorkflowGraphWriteProjectionReplayCertificateStoreVerification>;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreIssue {
  readonly code: string;
  readonly message: string;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreVerification {
  readonly valid: boolean;
  readonly ref: GraphWriteProjectionReplayRootSettlementRef;
  readonly issues: readonly WorkflowGraphWriteProjectionReplayRootSettlementStoreIssue[];
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreHead {
  readonly tenantId: string;
  readonly settlementSequence: number;
  readonly settlementRecordHash: string;
  readonly recordedAt: string;
  readonly headHash: string;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementCurrentnessPolicy {
  readonly requireLatestSettledRoot?: boolean;
  readonly requireLatestSettlementForRoot?: boolean;
  readonly disallowLaterConflictingRoot?: boolean;
  readonly disallowLaterObstruction?: boolean;
  readonly minimumSettlementSequence?: number;
  readonly requiredAuthorityTopologyHash?: string;
  readonly requiredSettlementStoreHead?: WorkflowGraphWriteProjectionReplayRootSettlementStoreHead;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStore {
  getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead?(input: {
    readonly tenantId: string;
  }): Promise<
    WorkflowGraphWriteProjectionReplayRootSettlementStoreHead | null | undefined
  >;

  verifyProjectionReplayCertificateStoreRootWitnessSettlementRef(input: {
    readonly tenantId: string;
    readonly ref: GraphWriteProjectionReplayRootSettlementRef;
    readonly root: WorkflowGraphWriteProjectionReplayStoreRoot;
    readonly currentnessPolicy?: WorkflowGraphWriteProjectionReplayRootSettlementCurrentnessPolicy;
  }): Promise<WorkflowGraphWriteProjectionReplayRootSettlementStoreVerification>;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessDecision {
  readonly accepted: boolean;
  readonly status: string;
  readonly issues: readonly WorkflowGraphWriteProjectionReplayRootSettlementStoreIssue[];
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitness {
  observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(input: {
    readonly tenantId: string;
    readonly observerId: string;
    readonly observedAt: string;
    readonly head: WorkflowGraphWriteProjectionReplayRootSettlementStoreHead;
    readonly consistencyProof?: unknown;
  }): Promise<WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessDecision>;
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessQuorumCertificate {
  readonly certified: boolean;
  readonly status: string;
  readonly issues: readonly WorkflowGraphWriteProjectionReplayRootSettlementStoreIssue[];
}

export interface WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessQuorum {
  certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(input: {
    readonly tenantId: string;
    readonly head: WorkflowGraphWriteProjectionReplayRootSettlementStoreHead;
  }): Promise<WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessQuorumCertificate>;
}

export interface StoredWorkflowGraphWriteAuthorityResolverOptions<TPayload> {
  readonly store: WorkflowGraphWriteAuthorityEnvelopeStore;
  readonly projectionReplayCertificateStore?: WorkflowGraphWriteProjectionReplayCertificateStore;
  readonly requireProjectionReplayStoreCommitment?: boolean;
  readonly projectionReplayRootWitness?: WorkflowGraphWriteProjectionReplayRootWitness;
  readonly projectionReplayRootSettlementStore?: WorkflowGraphWriteProjectionReplayRootSettlementStore;
  readonly projectionReplayRootSettlementCurrentnessPolicy?: WorkflowGraphWriteProjectionReplayRootSettlementCurrentnessPolicy;
  readonly projectionReplayRootSettlementStoreHeadWitness?: WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitness;
  readonly projectionReplayRootSettlementStoreHeadWitnessQuorum?: WorkflowGraphWriteProjectionReplayRootSettlementStoreHeadWitnessQuorum;
  readonly projectionReplayRootSettlementStoreHeadConsistencyProof?: (
    ctx: GraphWriteAuthorityContext<TPayload>,
    envelope: WorkflowGraphWriteAuthorityEnvelope,
    head: WorkflowGraphWriteProjectionReplayRootSettlementStoreHead,
  ) => unknown | Promise<unknown>;
  readonly projectionReplayRootSettlementStoreHeadObserverId?: (
    ctx: GraphWriteAuthorityContext<TPayload>,
    envelope: WorkflowGraphWriteAuthorityEnvelope,
  ) => string | Promise<string>;
  readonly projectionReplayRootObserverId?: (
    ctx: GraphWriteAuthorityContext<TPayload>,
    envelope: WorkflowGraphWriteAuthorityEnvelope,
  ) => string | Promise<string>;
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
    ...(envelope.projectionReplayRef !== undefined
      ? { projectionReplayRef: envelope.projectionReplayRef }
      : {}),
    ...(envelope.projectionReplayRootSettlementRef !== undefined
      ? {
          projectionReplayRootSettlementRef:
            envelope.projectionReplayRootSettlementRef,
        }
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
      ...(envelope.projectionReplayRef !== undefined
        ? { projectionReplayRef: envelope.projectionReplayRef }
        : {}),
      ...(envelope.projectionReplayRootSettlementRef !== undefined
        ? {
            projectionReplayRootSettlementRef:
              envelope.projectionReplayRootSettlementRef,
          }
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

    if (options.projectionReplayCertificateStore !== undefined) {
      if (envelope.projectionReplayRef === undefined) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} has no projection replay ref for certificate-store verification`,
        );
      }
      const verification =
        await options.projectionReplayCertificateStore.verifyProjectionReplayCertificateRef(
          {
            tenantId: String(ctx.tenantId),
            ref: envelope.projectionReplayRef,
            ...(options.requireProjectionReplayStoreCommitment === true
              ? { requireStoreCommitment: true }
              : {}),
          },
        );
      if (!verification.valid) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} projection replay certificate ${verification.certificateId} failed store verification: ${verification.issues
            .map((issue) => issue.code)
            .join(", ")}`,
        );
      }
    }

    if (options.projectionReplayRootWitness !== undefined) {
      if (envelope.projectionReplayRef === undefined) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} has no projection replay ref for root witness verification`,
        );
      }
      const replayRef = envelope.projectionReplayRef;
      if (
        replayRef.certificateStoreSequence === undefined ||
        replayRef.certificateStoreRootHash === undefined
      ) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} projection replay ref has no certificate-store root commitment for witness verification`,
        );
      }
      const observerId =
        (await options.projectionReplayRootObserverId?.(ctx, envelope)) ??
        `workflow-authority:${envelopeId}`;
      const decision =
        await options.projectionReplayRootWitness.observeProjectionReplayCertificateStoreRoot(
          {
            tenantId: String(ctx.tenantId),
            observerId,
            observedAt: String(replayRef.checkedAt),
            root: {
              tenantId: String(ctx.tenantId),
              sequence: replayRef.certificateStoreSequence,
              rootHash: replayRef.certificateStoreRootHash,
              recordedAt: String(replayRef.checkedAt),
            },
            ...(envelope.projectionReplayRootConsistencyProof !== undefined
              ? {
                  consistencyProof:
                    envelope.projectionReplayRootConsistencyProof,
                }
              : {}),
          },
        );
      if (!decision.accepted) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} projection replay root witness obstructed write authority: ${decision.issues
            .map((issue) => issue.code)
            .join(", ")}`,
        );
      }
    }

    if (options.projectionReplayRootSettlementStore !== undefined) {
      if (envelope.projectionReplayRef === undefined) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} has no projection replay ref for settled-root verification`,
        );
      }
      if (envelope.projectionReplayRootSettlementRef === undefined) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} has no settled-root ref for settlement-store verification`,
        );
      }
      const replayRef = envelope.projectionReplayRef;
      if (
        replayRef.certificateStoreSequence === undefined ||
        replayRef.certificateStoreRootHash === undefined
      ) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} projection replay ref has no certificate-store root commitment for settled-root verification`,
        );
      }
      let requiredSettlementStoreHead =
        options.projectionReplayRootSettlementCurrentnessPolicy
          ?.requiredSettlementStoreHead;
      if (
        options.projectionReplayRootSettlementStoreHeadWitness !== undefined
      ) {
        if (
          options.projectionReplayRootSettlementStore
            .getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead ===
          undefined
        ) {
          throw new GraphWriteAuthorityResolutionError(
            `workflow action outcome envelope ${envelopeId} cannot verify settlement-store head without a head-capable settlement store`,
          );
        }
        const settlementStoreHead =
          await options.projectionReplayRootSettlementStore.getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
            {
              tenantId: String(ctx.tenantId),
            },
          );
        if (settlementStoreHead === null || settlementStoreHead === undefined) {
          throw new GraphWriteAuthorityResolutionError(
            `workflow action outcome envelope ${envelopeId} has no settlement-store head for head-witness verification`,
          );
        }
        const settlementHeadObserverId =
          (await options.projectionReplayRootSettlementStoreHeadObserverId?.(
            ctx,
            envelope,
          )) ?? `workflow-authority:settlement-head:${envelopeId}`;
        const settlementHeadConsistencyProof =
          await options.projectionReplayRootSettlementStoreHeadConsistencyProof?.(
            ctx,
            envelope,
            settlementStoreHead,
          );
        const headDecision =
          await options.projectionReplayRootSettlementStoreHeadWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
            {
              tenantId: String(ctx.tenantId),
              observerId: settlementHeadObserverId,
              observedAt: String(settlementStoreHead.recordedAt),
              head: settlementStoreHead,
              ...(settlementHeadConsistencyProof !== undefined
                ? { consistencyProof: settlementHeadConsistencyProof }
                : {}),
            },
          );
        if (!headDecision.accepted) {
          throw new GraphWriteAuthorityResolutionError(
            `workflow action outcome envelope ${envelopeId} settlement-store head witness obstructed write authority: ${headDecision.issues
              .map((issue) => issue.code)
              .join(", ")}`,
          );
        }
        if (
          options.projectionReplayRootSettlementStoreHeadWitnessQuorum !==
          undefined
        ) {
          const headQuorumCertificate =
            await options.projectionReplayRootSettlementStoreHeadWitnessQuorum.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
              {
                tenantId: String(ctx.tenantId),
                head: settlementStoreHead,
              },
            );
          if (!headQuorumCertificate.certified) {
            throw new GraphWriteAuthorityResolutionError(
              `workflow action outcome envelope ${envelopeId} settlement-store head witness quorum did not certify write authority: ${headQuorumCertificate.issues
                .map((issue) => issue.code)
                .join(", ")}`,
            );
          }
        }
        requiredSettlementStoreHead = settlementStoreHead;
      }
      const settlementCurrentnessPolicy =
        options.projectionReplayRootSettlementCurrentnessPolicy !== undefined ||
        requiredSettlementStoreHead !== undefined
          ? {
              ...options.projectionReplayRootSettlementCurrentnessPolicy,
              ...(requiredSettlementStoreHead !== undefined
                ? { requiredSettlementStoreHead }
                : {}),
            }
          : undefined;
      const verification =
        await options.projectionReplayRootSettlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef(
          {
            tenantId: String(ctx.tenantId),
            ref: envelope.projectionReplayRootSettlementRef,
            root: {
              tenantId: String(ctx.tenantId),
              sequence: replayRef.certificateStoreSequence,
              rootHash: replayRef.certificateStoreRootHash,
              recordedAt: String(replayRef.checkedAt),
            },
            ...(settlementCurrentnessPolicy !== undefined
              ? {
                  currentnessPolicy: settlementCurrentnessPolicy,
                }
              : {}),
          },
        );
      if (!verification.valid) {
        throw new GraphWriteAuthorityResolutionError(
          `workflow action outcome envelope ${envelopeId} settled-root certificate failed store verification: ${verification.issues
            .map((issue) => issue.code)
            .join(", ")}`,
        );
      }
    }

    return graphWriteAuthorityResolutionFromWorkflowEnvelope(envelope);
  };
};
