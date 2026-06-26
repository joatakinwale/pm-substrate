import { describe, expect, it } from "vitest";
import {
  graphWriteAuthorityResolutionFromWorkflowEnvelope,
  graphWriteAuthorityResolverFromWorkflowEnvelopeStore,
  GraphWriteAuthorityResolutionError,
  type WorkflowGraphWriteAuthorityEnvelope,
  type WorkflowGraphWriteAuthorityEnvelopeLookup,
} from "./workflow-authority.js";

const projectionReplayRef = {
  certificateId: "projection_replay_workflow_authority",
  certificateHash: "sha256:projection_replay_certificate",
  projectionName: "workflow/current-state",
  projectionVersion: 2,
  authorityScope: "workflow.graph-write",
  replayedToPosition: 17,
  transitionHistoryHash: "sha256:projection_transition_history",
  projectionHash: "sha256:projection_hash",
  checkedAt: "2026-06-25T00:00:01.000Z",
};

const projectionReplayRootRef = {
  ...projectionReplayRef,
  certificateStoreSequence: 1,
  certificateStoreEntryHash: "sha256:certificate_store_entry_1",
  certificateStoreRootHash: "sha256:certificate_store_root_1",
};

const projectionReplayRootSettlementRef = {
  rootSequence: projectionReplayRootRef.certificateStoreSequence,
  rootHash: projectionReplayRootRef.certificateStoreRootHash,
  settlementSequence: 1,
  settlementStatus: "settled" as const,
  settlementHash: "sha256:projection_replay_root_settlement",
  settlementRecordHash: "sha256:projection_replay_root_settlement_record",
  authorityTopologyHash: "sha256:projection_replay_authority_topology",
  checkedAt: projectionReplayRootRef.checkedAt,
};

const acceptedEnvelope = (): WorkflowGraphWriteAuthorityEnvelope => ({
  envelopeId: "env_workflow_authority",
  actionId: "act_workflow_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_workflow_authority",
  providerCertificateDigest: "sha256:workflow_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_workflow_authority",
    certificateDigest: "sha256:workflow_authority",
    status: "valid",
    statusSequence: 7,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: "2026-06-25T00:00:00.000Z",
    checkedAt: "2026-06-25T00:00:01.000Z",
  },
  projectionReplayRef,
});

describe("graphWriteAuthorityResolutionFromWorkflowEnvelope", () => {
  it("builds a matched authority ref and substrate record from an accepted envelope", () => {
    const envelope = acceptedEnvelope();
    const resolution = graphWriteAuthorityResolutionFromWorkflowEnvelope(envelope);

    expect(resolution.authorityRef).toMatchObject({
      authorityKind: "workflow_action_outcome_envelope",
      envelopeId: envelope.envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: "accepted",
      providerCertificateId: envelope.providerCertificateId,
      providerCertificateDigest: envelope.providerCertificateDigest,
      providerCertificateStatusRef: envelope.providerCertificateStatusRef,
      projectionReplayRef,
    });
    expect(resolution.substrateRecord).toMatchObject({
      authorityKind: "workflow_action_outcome_envelope",
      envelopeId: envelope.envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: "accepted",
      providerCertificateId: envelope.providerCertificateId,
      providerCertificateDigest: envelope.providerCertificateDigest,
      providerCertificateStatusRef: envelope.providerCertificateStatusRef,
      projectionReplayRef,
    });
  });

  it("rejects a blocked envelope instead of converting it into write authority", () => {
    expect(() =>
      graphWriteAuthorityResolutionFromWorkflowEnvelope({
        ...acceptedEnvelope(),
        terminalOutcome: "blocked",
      }),
    ).toThrow(GraphWriteAuthorityResolutionError);
  });

  it("rejects a missing envelope", () => {
    expect(() => graphWriteAuthorityResolutionFromWorkflowEnvelope(undefined)).toThrow(
      GraphWriteAuthorityResolutionError,
    );
  });
});

describe("graphWriteAuthorityResolverFromWorkflowEnvelopeStore", () => {
  it("loads an accepted workflow envelope from a store before building authority", async () => {
    const envelope = acceptedEnvelope();
    const lookups: WorkflowGraphWriteAuthorityEnvelopeLookup[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore<{
      readonly envelopeId: string;
      readonly expectedActionId: string;
    }>({
      store: {
        async getWorkflowActionOutcomeEnvelope(lookup) {
          lookups.push(lookup);
          return envelope;
        },
      },
      envelopeId: ({ payload }) => payload.envelopeId,
      expectedActionId: ({ payload }) => payload.expectedActionId,
    });

    const resolution = await resolver({
      tenantId: "tnt_workflow_authority" as never,
      payload: {
        envelopeId: envelope.envelopeId,
        expectedActionId: envelope.actionId,
      },
      targetId: "ent_target" as never,
      currentIdentity: {},
      currentSchemaVersion: 1,
      client: {} as never,
    });

    expect(lookups).toEqual([
      {
        tenantId: "tnt_workflow_authority",
        envelopeId: envelope.envelopeId,
      },
    ]);
    expect(resolution).toMatchObject({
      authorityRef: {
        envelopeId: envelope.envelopeId,
        actionId: envelope.actionId,
        terminalOutcome: "accepted",
      },
      substrateRecord: {
        envelopeId: envelope.envelopeId,
        actionId: envelope.actionId,
        terminalOutcome: "accepted",
      },
    });
  });

  it("verifies stored projection replay refs against the certificate store", async () => {
    const envelope = acceptedEnvelope();
    const verifiedRefs: typeof projectionReplayRef[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayCertificateStore: {
        async verifyProjectionReplayCertificateRef(input) {
          verifiedRefs.push(input.ref);
          return {
            valid: true,
            certificateId: input.ref.certificateId,
            issues: [],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).resolves.toMatchObject({
      authorityRef: {
        projectionReplayRef,
      },
    });
    expect(verifiedRefs).toEqual([projectionReplayRef]);
  });

  it("can require projection replay refs to include a certificate-store commitment", async () => {
    const envelope = acceptedEnvelope();
    const requireFlags: (boolean | undefined)[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayCertificateStore: {
        async verifyProjectionReplayCertificateRef(input) {
          requireFlags.push(input.requireStoreCommitment);
          return {
            valid: true,
            certificateId: input.ref.certificateId,
            issues: [],
          };
        },
      },
      requireProjectionReplayStoreCommitment: true,
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await resolver({
      tenantId: "tnt_workflow_authority" as never,
      payload: {},
      targetId: "ent_target" as never,
      currentIdentity: {},
      currentSchemaVersion: 1,
      client: {} as never,
    });

    expect(requireFlags).toEqual([true]);
  });

  it("requires root witness acceptance before building graph write authority", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
    };
    const observations: unknown[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootWitness: {
        async observeProjectionReplayCertificateStoreRoot(input) {
          observations.push(input);
          return {
            accepted: true,
            status: "accepted_initial",
            issues: [],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).resolves.toMatchObject({
      authorityRef: {
        projectionReplayRef: projectionReplayRootRef,
      },
    });

    expect(observations).toEqual([
      {
        tenantId: "tnt_workflow_authority",
        observerId: `workflow-authority:${envelope.envelopeId}`,
        observedAt: projectionReplayRootRef.checkedAt,
        root: {
          tenantId: "tnt_workflow_authority",
          sequence: projectionReplayRootRef.certificateStoreSequence,
          rootHash: projectionReplayRootRef.certificateStoreRootHash,
          recordedAt: projectionReplayRootRef.checkedAt,
        },
      },
    ]);
  });

  it("passes replay root consistency proofs to the root witness", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootConsistencyProof: {
        tenantId: "tnt_workflow_authority",
        toRoot: {
          tenantId: "tnt_workflow_authority",
          sequence: projectionReplayRootRef.certificateStoreSequence,
          rootHash: projectionReplayRootRef.certificateStoreRootHash,
          recordedAt: projectionReplayRootRef.checkedAt,
        },
        entries: [],
      },
    };
    const observations: unknown[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootWitness: {
        async observeProjectionReplayCertificateStoreRoot(input) {
          observations.push(input);
          return {
            accepted: true,
            status: "accepted_initial",
            issues: [],
          };
        },
      },
      projectionReplayRootObserverId: () => "agent:resume-root-check",
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await resolver({
      tenantId: "tnt_workflow_authority" as never,
      payload: {},
      targetId: "ent_target" as never,
      currentIdentity: {},
      currentSchemaVersion: 1,
      client: {} as never,
    });

    expect(observations).toEqual([
      expect.objectContaining({
        observerId: "agent:resume-root-check",
        consistencyProof: envelope.projectionReplayRootConsistencyProof,
      }),
    ]);
  });

  it("verifies durable settled-root refs before building graph write authority", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootSettlementRef,
    };
    const currentnessPolicy = {
      requireLatestSettledRoot: true,
      requireLatestSettlementForRoot: true,
      disallowLaterConflictingRoot: true,
      disallowLaterObstruction: true,
      minimumSettlementSequence: 2,
      requiredAuthorityTopologyHash: "sha256:topology-current",
    };
    const verifications: unknown[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef(input) {
          verifications.push(input);
          return {
            valid: true,
            ref: input.ref,
            issues: [],
          };
        },
      },
      projectionReplayRootSettlementCurrentnessPolicy: currentnessPolicy,
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).resolves.toMatchObject({
      authorityRef: {
        projectionReplayRootSettlementRef,
      },
      substrateRecord: {
        projectionReplayRootSettlementRef,
      },
    });

    expect(verifications).toEqual([
      {
        tenantId: "tnt_workflow_authority",
        ref: projectionReplayRootSettlementRef,
        root: {
          tenantId: "tnt_workflow_authority",
          sequence: projectionReplayRootRef.certificateStoreSequence,
          rootHash: projectionReplayRootRef.certificateStoreRootHash,
          recordedAt: projectionReplayRootRef.checkedAt,
        },
        currentnessPolicy,
      },
    ]);
  });

  it("witnesses settlement-store heads before settled-root verification", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootSettlementRef,
    };
    const settlementStoreHead = {
      tenantId: "tnt_workflow_authority",
      settlementSequence: 2,
      settlementRecordHash: "sha256:projection_replay_root_settlement_record_2",
      recordedAt: "2026-06-25T00:00:02.000Z",
      headHash: "sha256:projection_replay_root_settlement_head_2",
    };
    const consistencyProof = {
      kind: "settlement_store_head_consistency_proof",
    };
    const headObservations: unknown[] = [];
    const headQuorumCertifications: unknown[] = [];
    const verifications: unknown[] = [];
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return settlementStoreHead;
        },
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef(input) {
          verifications.push(input);
          return {
            valid: true,
            ref: input.ref,
            issues: [],
          };
        },
      },
      projectionReplayRootSettlementStoreHeadWitness: {
        async observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(input) {
          headObservations.push(input);
          return {
            accepted: true,
            status: "accepted_advance",
            issues: [],
          };
        },
      },
      projectionReplayRootSettlementStoreHeadWitnessQuorum: {
        async certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(input) {
          headQuorumCertifications.push(input);
          return {
            certified: true,
            status: "certified",
            issues: [],
          };
        },
      },
      projectionReplayRootSettlementStoreHeadObserverId: () =>
        "agent:settlement-head-check",
      projectionReplayRootSettlementStoreHeadConsistencyProof: () =>
        consistencyProof,
      projectionReplayRootSettlementCurrentnessPolicy: {
        requireLatestSettledRoot: true,
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).resolves.toMatchObject({
      authorityRef: {
        projectionReplayRootSettlementRef,
      },
    });

    expect(headObservations).toEqual([
      {
        tenantId: "tnt_workflow_authority",
        observerId: "agent:settlement-head-check",
        observedAt: settlementStoreHead.recordedAt,
        head: settlementStoreHead,
        consistencyProof,
      },
    ]);
    expect(headQuorumCertifications).toEqual([
      {
        tenantId: "tnt_workflow_authority",
        head: settlementStoreHead,
      },
    ]);
    expect(verifications).toEqual([
      expect.objectContaining({
        currentnessPolicy: {
          requireLatestSettledRoot: true,
          requiredSettlementStoreHead: settlementStoreHead,
        },
      }),
    ]);
  });

  it("rejects write authority when settlement-store head witness obstructs", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootSettlementRef,
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return {
            tenantId: "tnt_workflow_authority",
            settlementSequence: 1,
            settlementRecordHash:
              "sha256:projection_replay_root_settlement_record",
            recordedAt: "2026-06-25T00:00:02.000Z",
            headHash: "sha256:projection_replay_root_settlement_head",
          };
        },
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef() {
          throw new Error("should not verify after head obstruction");
        },
      },
      projectionReplayRootSettlementStoreHeadWitness: {
        async observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return {
            accepted: false,
            status: "obstructed",
            issues: [
              {
                code: "projection_replay_certificate_store_root_witness_settlement_store_head_regression",
                message: "head regressed",
              },
            ],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/settlement-store head witness obstructed/);
  });

  it("rejects write authority when settlement-store head quorum is not certified", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootSettlementRef,
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return {
            tenantId: "tnt_workflow_authority",
            settlementSequence: 1,
            settlementRecordHash:
              "sha256:projection_replay_root_settlement_record",
            recordedAt: "2026-06-25T00:00:02.000Z",
            headHash: "sha256:projection_replay_root_settlement_head",
          };
        },
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef() {
          throw new Error("should not verify after quorum failure");
        },
      },
      projectionReplayRootSettlementStoreHeadWitness: {
        async observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return {
            accepted: true,
            status: "accepted_duplicate",
            issues: [],
          };
        },
      },
      projectionReplayRootSettlementStoreHeadWitnessQuorum: {
        async certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead() {
          return {
            certified: false,
            status: "witnessed",
            issues: [
              {
                code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_not_met",
                message: "head quorum not met",
              },
            ],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(
      /settlement-store head witness quorum did not certify write authority/,
    );
  });

  it("rejects write authority when the settled-root store rejects the ref", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
      projectionReplayRootSettlementRef,
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef(input) {
          return {
            valid: false,
            ref: input.ref,
            issues: [
              {
                code: "projection_replay_certificate_store_root_witness_settlement_ref_ledger_invalid",
                message: "ledger invalid",
              },
            ],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/settled-root certificate failed store verification/);
  });

  it("rejects settled-root verification when the envelope has no settlement ref", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootSettlementStore: {
        async verifyProjectionReplayCertificateStoreRootWitnessSettlementRef() {
          throw new Error("should not be called");
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/has no settled-root ref/);
  });

  it("rejects write authority when the root witness reports an obstruction", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      projectionReplayRef: projectionReplayRootRef,
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootWitness: {
        async observeProjectionReplayCertificateStoreRoot() {
          return {
            accepted: false,
            status: "obstructed",
            issues: [
              {
                code: "projection_replay_certificate_store_root_fork",
                message: "fork",
              },
            ],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/root witness obstructed.*projection_replay_certificate_store_root_fork/);
  });

  it("rejects root witness verification when the replay ref has no store root", async () => {
    const envelope = acceptedEnvelope();
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayRootWitness: {
        async observeProjectionReplayCertificateStoreRoot() {
          throw new Error("should not be called");
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/no certificate-store root commitment/);
  });

  it("rejects when the certificate store cannot verify the projection replay ref", async () => {
    const envelope = acceptedEnvelope();
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayCertificateStore: {
        async verifyProjectionReplayCertificateRef(input) {
          return {
            valid: false,
            certificateId: input.ref.certificateId,
            issues: [
              {
                code: "projection_replay_certificate_record_missing",
                message: "missing",
              },
            ],
          };
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/failed store verification/);
  });

  it("rejects when certificate-store verification is enabled but the envelope has no replay ref", async () => {
    const {
      projectionReplayRef: _projectionReplayRef,
      ...envelope
    } = acceptedEnvelope();
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      projectionReplayCertificateStore: {
        async verifyProjectionReplayCertificateRef() {
          throw new Error("should not be called");
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => envelope.actionId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(/has no projection replay ref/);
  });

  it("rejects a missing stored workflow envelope", async () => {
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return undefined;
        },
      },
      envelopeId: () => "env_missing",
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(GraphWriteAuthorityResolutionError);
  });

  it("rejects a stored envelope for the wrong action id", async () => {
    const envelope = acceptedEnvelope();
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      envelopeId: () => envelope.envelopeId,
      expectedActionId: () => "act_different",
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(GraphWriteAuthorityResolutionError);
  });

  it("rejects a stored blocked envelope", async () => {
    const envelope: WorkflowGraphWriteAuthorityEnvelope = {
      ...acceptedEnvelope(),
      terminalOutcome: "blocked",
    };
    const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
      store: {
        async getWorkflowActionOutcomeEnvelope() {
          return envelope;
        },
      },
      envelopeId: () => envelope.envelopeId,
    });

    await expect(
      resolver({
        tenantId: "tnt_workflow_authority" as never,
        payload: {},
        targetId: "ent_target" as never,
        currentIdentity: {},
        currentSchemaVersion: 1,
        client: {} as never,
      }),
    ).rejects.toThrow(GraphWriteAuthorityResolutionError);
  });
});
