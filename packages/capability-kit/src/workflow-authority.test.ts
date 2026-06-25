import { describe, expect, it } from "vitest";
import {
  graphWriteAuthorityResolutionFromWorkflowEnvelope,
  graphWriteAuthorityResolverFromWorkflowEnvelopeStore,
  GraphWriteAuthorityResolutionError,
  type WorkflowGraphWriteAuthorityEnvelope,
  type WorkflowGraphWriteAuthorityEnvelopeLookup,
} from "./workflow-authority.js";

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
    });
    expect(resolution.substrateRecord).toMatchObject({
      authorityKind: "workflow_action_outcome_envelope",
      envelopeId: envelope.envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: "accepted",
      providerCertificateId: envelope.providerCertificateId,
      providerCertificateDigest: envelope.providerCertificateDigest,
      providerCertificateStatusRef: envelope.providerCertificateStatusRef,
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
