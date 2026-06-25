import { describe, expect, it } from "vitest";
import {
  graphWriteAuthorityResolutionFromWorkflowEnvelope,
  GraphWriteAuthorityResolutionError,
  type WorkflowGraphWriteAuthorityEnvelope,
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
