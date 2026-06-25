import { describe, expect, it } from "vitest";
import {
  capabilityId,
  timestamp,
  type TerminalAdmissionProviderCertificate,
} from "@pm/types";
import {
  buildInvocationActionOutcomeEnvelope,
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingRequest,
  type InvocationEvidenceBinding,
} from "./evidence-binding.js";

const binding = (
  overrides: Partial<InvocationEvidenceBinding> = {},
): InvocationEvidenceBinding => ({
  stateReviewArtifactId: "artifact_nvda_001",
  stateReviewArtifactHash: "a".repeat(64),
  evidenceAdmissionReviewIds: ["ev_security:admission_review"],
  policyDisposition: {
    evaluatedAt: "2026-06-11T16:00:00.000Z",
    consequence: "high",
    wouldBlock: false,
    mode: "advisory",
  },
  ...overrides,
});

const request = (
  overrides: Partial<EvidenceBindingRequest> = {},
): EvidenceBindingRequest => ({
  tenantId: "tnt_arrowhedge",
  workflowId: "wf_arrowhedge",
  workflowName: "arrowhedge-terminal-write",
  workflowVersion: 1,
  nodeId: "accept-decision",
  capability: "portfolio/accept",
  inputs: {},
  capabilityWrites: true,
  triggerEventId: "evt_decision_ready",
  ...overrides,
});

const providerCertificate = (): TerminalAdmissionProviderCertificate => ({
  schemaVersion: "pm.terminal_admission_provider_certificate.v1",
  certificateId: "tapc_arrowhedge_accept_001",
  certificateDigest: "c".repeat(64),
  issuer: "registry.install",
  issuedAt: timestamp("2026-06-25T04:00:00.000Z"),
  validUntil: timestamp("2026-06-25T06:00:00.000Z"),
  status: "valid",
  subject: {
    capabilityId: capabilityId("cap_portfolio_accept"),
    capabilityName: "portfolio/accept",
    capabilityVersion: 1,
    writeInterface: "PortfolioDecision",
    writeFields: ["status"],
    writeOwnership: "owner",
    providerId: "finance.action_outcome_provider.v1",
  },
  provider: {
    providerId: "finance.action_outcome_provider.v1",
    kind: "action_outcome_envelope",
    contractVersion: { major: 1, minor: 0, patch: 0 },
    packageName: "@pm/finance",
    exportName: "financeActionOutcomeProvider",
    actionTypes: ["portfolio/accept"],
  },
  manifest: {
    providerId: "finance.action_outcome_provider.v1",
    kind: "action_outcome_envelope",
    contractVersion: { major: 1, minor: 0, patch: 0 },
    packageName: "@pm/finance",
    exportName: "financeActionOutcomeProvider",
    actionTypes: ["portfolio/accept"],
    availability: "available",
  },
  manifestDigest: "d".repeat(64),
});

describe("workflow evidence-action binding", () => {
  it("requires review artifact and evidence admission ids before write-capable dispatch", () => {
    const missing = validateInvocationEvidenceBinding({
      capabilityWrites: true,
      evidenceBindingRequired: true,
    });

    expect(missing).toMatchObject({
      valid: false,
      reason: "evidence_binding_missing",
      issues: [
        {
          path: "/evidenceBinding",
          message:
            "write-capable invocation requires stateReviewArtifactId, evidenceAdmissionReviewIds, and policyDisposition before dispatch",
        },
      ],
    });

    const incomplete = validateInvocationEvidenceBinding({
      capabilityWrites: true,
      evidenceBindingRequired: true,
      evidenceBinding: binding({ evidenceAdmissionReviewIds: [] }),
    });

    expect(incomplete).toMatchObject({
      valid: false,
      reason: "evidence_binding_incomplete",
      issues: [
        {
          path: "/evidenceBinding/evidenceAdmissionReviewIds",
          message: "at least one evidence admission review id is required",
        },
      ],
    });
  });

  it("returns structured issues for malformed runtime-provided bindings", () => {
    const malformed = validateInvocationEvidenceBinding({
      capabilityWrites: true,
      evidenceBindingRequired: true,
      evidenceBinding: {
        stateReviewArtifactId: " ",
        evidenceAdmissionReviewIds: ["ev_ok", ""],
      },
    });

    expect(malformed).toMatchObject({
      valid: false,
      reason: "evidence_binding_incomplete",
      issues: [
        {
          path: "/evidenceBinding/stateReviewArtifactId",
          message: "state review artifact id is required",
        },
        {
          path: "/evidenceBinding/evidenceAdmissionReviewIds/1",
          message: "evidence admission review id must be a non-empty string",
        },
        {
          path: "/evidenceBinding/policyDisposition",
          message: "policy disposition is required",
        },
      ],
    });
  });

  it("accepts complete bindings and does not require them for read-only invocations", () => {
    expect(
      validateInvocationEvidenceBinding({
        capabilityWrites: true,
        evidenceBindingRequired: true,
        evidenceBinding: binding(),
      }),
    ).toEqual({ valid: true });

    expect(
      validateInvocationEvidenceBinding({
        capabilityWrites: false,
        evidenceBindingRequired: true,
      }),
    ).toEqual({ valid: true });
  });

  it("builds an accepted action outcome envelope from a valid write binding", () => {
    const evidenceBinding = binding();
    const envelope = buildInvocationActionOutcomeEnvelope({
      request: request(),
      evidenceBinding,
      evidenceDecision: { valid: true },
      generatedAt: "2026-06-25T05:00:00.000Z",
    });

    expect(envelope).toMatchObject({
      schemaVersion: "pm.workflow.action_outcome_envelope.v1",
      actionId: "tnt_arrowhedge:wf_arrowhedge:1:accept-decision:evt_decision_ready",
      terminalOutcome: "accepted",
      generatedAt: "2026-06-25T05:00:00.000Z",
      stateReviewArtifactId: "artifact_nvda_001",
      stateReviewArtifactHash: "a".repeat(64),
      evidenceAdmissionReviewIds: ["ev_security:admission_review"],
      evidenceDecision: { valid: true },
    });
    expect(envelope.envelopeId).toMatch(/^outcome_[a-f0-9]{32}$/);
  });

  it("carries provider certificate identity in action outcome envelopes", () => {
    const certificate = providerCertificate();
    const envelope = buildInvocationActionOutcomeEnvelope({
      request: request(),
      evidenceBinding: binding(),
      evidenceDecision: { valid: true },
      generatedAt: "2026-06-25T05:00:00.000Z",
      providerCertificate: certificate,
    });

    expect(envelope).toMatchObject({
      terminalOutcome: "accepted",
      providerCertificateId: certificate.certificateId,
      providerCertificateDigest: certificate.certificateDigest,
    });
  });

  it("builds a blocked action outcome envelope for a missing write binding", () => {
    const evidenceDecision = validateInvocationEvidenceBinding({
      capabilityWrites: true,
      evidenceBindingRequired: true,
      evidenceBinding: null,
    });
    expect(evidenceDecision.valid).toBe(false);

    const envelope = buildInvocationActionOutcomeEnvelope({
      request: request(),
      evidenceBinding: null,
      evidenceDecision,
      generatedAt: "2026-06-25T05:01:00.000Z",
    });

    expect(envelope).toMatchObject({
      terminalOutcome: "blocked",
      evidenceAdmissionReviewIds: [],
      evidenceDecision: {
        valid: false,
        reason: "evidence_binding_missing",
      },
    });
  });

  it("blocks write-capable dispatch when the provided policy disposition is explicitly blocking", () => {
    expect(
      validateInvocationEvidenceBinding({
        capabilityWrites: true,
        evidenceBindingRequired: true,
        evidenceBinding: binding({
          policyDisposition: {
            evaluatedAt: "2026-06-11T16:00:00.000Z",
            consequence: "high",
            wouldBlock: true,
            mode: "blocking",
          },
        }),
      }),
    ).toMatchObject({
      valid: false,
      reason: "evidence_policy_blocked",
      issues: [
        {
          path: "/evidenceBinding/policyDisposition",
          message:
            "blocking policy disposition denies write-capable dispatch",
        },
      ],
    });
  });

  it("verifies bindings against a substrate-owned artifact/evidence catalog", () => {
    expect(
      verifyInvocationEvidenceBindingAgainstCatalog({
        request: {
          tenantId: "tenant_a",
          workflowId: "wf_accept",
          workflowName: "accept-decision",
          workflowVersion: 1,
          nodeId: "accept",
          capability: "portfolio/decision.accept",
          inputs: {},
          capabilityWrites: true,
          triggerEventId: "evt_ready",
        },
        evidenceBinding: binding({
          stateReviewArtifactId: "artifact_nvda_001",
          admissionCertificateId: "cert_nvda_001",
          admissionCertificateDigest: "c".repeat(64),
          evidenceAdmissionReviewIds: ["ev_security:admission_review"],
        }),
        catalog: {
          stateReviewArtifacts: [
            {
              stateReviewArtifactId: "artifact_nvda_001",
              artifactHash: "a".repeat(64),
              tenantId: "tenant_a",
              workflowId: "wf_accept",
              evidenceAdmissionReviewIds: ["ev_security:admission_review"],
            },
          ],
          admissionCertificates: [
            {
              certificateId: "cert_nvda_001",
              certificateDigest: "c".repeat(64),
              stateReviewArtifactId: "artifact_nvda_001",
              stateReviewArtifactHash: "a".repeat(64),
              evidenceAdmissionReviewIds: ["ev_security:admission_review"],
              tenantId: "tenant_a",
              workflowId: "wf_accept",
              policyVersion: "policy.write-binding.v1",
              revocationEpoch: 0,
              executionIdentity: "workflow-runtime:arrowhedge",
              validFrom: "2026-06-11T15:59:00.000Z",
              validUntil: "2026-06-11T16:30:00.000Z",
            },
          ],
          evidenceAdmissionReviews: [
            {
              reviewId: "ev_security:admission_review",
              tenantId: "tenant_a",
              decision: "admitted",
              authorityStatus: "evidence_only",
            },
          ],
        },
      }),
    ).toEqual({ valid: true });
  });

  it("requires a matching admission certificate when the catalog has certificate-backed refs", () => {
    const decision = verifyInvocationEvidenceBindingAgainstCatalog({
      request: {
        tenantId: "tenant_a",
        workflowId: "wf_accept",
        workflowName: "accept-decision",
        workflowVersion: 1,
        nodeId: "accept",
        capability: "portfolio/decision.accept",
        inputs: {},
        capabilityWrites: true,
        triggerEventId: "evt_ready",
      },
      evidenceBinding: binding({
        admissionCertificateId: "cert_nvda_001",
        admissionCertificateDigest: "x".repeat(64),
      }),
      catalog: {
        stateReviewArtifacts: [
          {
            stateReviewArtifactId: "artifact_nvda_001",
            artifactHash: "a".repeat(64),
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
          },
        ],
        admissionCertificates: [
          {
            certificateId: "cert_nvda_001",
            certificateDigest: "c".repeat(64),
            stateReviewArtifactId: "artifact_nvda_001",
            stateReviewArtifactHash: "a".repeat(64),
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            policyVersion: "policy.write-binding.v1",
            revocationEpoch: 0,
            executionIdentity: "workflow-runtime:arrowhedge",
            validFrom: "2026-06-11T15:59:00.000Z",
            validUntil: "2026-06-11T16:30:00.000Z",
          },
        ],
        evidenceAdmissionReviews: [
          {
            reviewId: "ev_security:admission_review",
            tenantId: "tenant_a",
            decision: "admitted",
            authorityStatus: "evidence_only",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
      issues: [
        {
          path: "/evidenceBinding/admissionCertificateDigest",
          message: "admission certificate digest does not match the verification catalog",
        },
      ],
    });
  });

  it("rejects expired or revoked admission certificates before treating a binding as verified", () => {
    const decision = verifyInvocationEvidenceBindingAgainstCatalog({
      request: {
        tenantId: "tenant_a",
        workflowId: "wf_accept",
        workflowName: "accept-decision",
        workflowVersion: 1,
        nodeId: "accept",
        capability: "portfolio/decision.accept",
        inputs: {},
        capabilityWrites: true,
        triggerEventId: "evt_ready",
      },
      evidenceBinding: binding({
        admissionCertificateId: "cert_nvda_001",
        admissionCertificateDigest: "c".repeat(64),
        policyDisposition: {
          evaluatedAt: "2026-06-11T17:00:00.000Z",
          consequence: "high",
          wouldBlock: false,
          mode: "advisory",
        },
      }),
      catalog: {
        stateReviewArtifacts: [
          {
            stateReviewArtifactId: "artifact_nvda_001",
            artifactHash: "a".repeat(64),
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
          },
        ],
        admissionCertificates: [
          {
            certificateId: "cert_nvda_001",
            certificateDigest: "c".repeat(64),
            stateReviewArtifactId: "artifact_nvda_001",
            stateReviewArtifactHash: "a".repeat(64),
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            policyVersion: "policy.write-binding.v1",
            revocationEpoch: 1,
            executionIdentity: "workflow-runtime:arrowhedge",
            validFrom: "2026-06-11T15:59:00.000Z",
            validUntil: "2026-06-11T16:30:00.000Z",
            revokedAt: "2026-06-11T16:45:00.000Z",
          },
        ],
        evidenceAdmissionReviews: [
          {
            reviewId: "ev_security:admission_review",
            tenantId: "tenant_a",
            decision: "admitted",
            authorityStatus: "evidence_only",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
      issues: expect.arrayContaining([
        {
          path: "/evidenceBinding/admissionCertificateId",
          message: "admission certificate is outside its validity window",
        },
        {
          path: "/evidenceBinding/admissionCertificateId",
          message: "admission certificate was revoked before verification",
        },
      ]),
    });
  });

  it("rejects certificate-backed bindings with an invalid policy evaluation timestamp", () => {
    const decision = verifyInvocationEvidenceBindingAgainstCatalog({
      request: {
        tenantId: "tenant_a",
        workflowId: "wf_accept",
        workflowName: "accept-decision",
        workflowVersion: 1,
        nodeId: "accept",
        capability: "portfolio/decision.accept",
        inputs: {},
        capabilityWrites: true,
        triggerEventId: "evt_ready",
      },
      evidenceBinding: binding({
        admissionCertificateId: "cert_nvda_001",
        admissionCertificateDigest: "c".repeat(64),
        policyDisposition: {
          evaluatedAt: "not-a-date",
          consequence: "high",
          wouldBlock: false,
          mode: "advisory",
        },
      }),
      catalog: {
        stateReviewArtifacts: [
          {
            stateReviewArtifactId: "artifact_nvda_001",
            artifactHash: "a".repeat(64),
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
          },
        ],
        admissionCertificates: [
          {
            certificateId: "cert_nvda_001",
            certificateDigest: "c".repeat(64),
            stateReviewArtifactId: "artifact_nvda_001",
            stateReviewArtifactHash: "a".repeat(64),
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            policyVersion: "policy.write-binding.v1",
            revocationEpoch: 0,
            executionIdentity: "workflow-runtime:arrowhedge",
            validFrom: "2026-06-11T15:59:00.000Z",
            validUntil: "2026-06-11T16:30:00.000Z",
          },
        ],
        evidenceAdmissionReviews: [
          {
            reviewId: "ev_security:admission_review",
            tenantId: "tenant_a",
            decision: "admitted",
            authorityStatus: "evidence_only",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
      issues: [
        {
          path: "/evidenceBinding/policyDisposition/evaluatedAt",
          message: "policy disposition evaluatedAt is not a valid timestamp",
        },
      ],
    });
  });

  it("rejects catalog-missing and hash-mismatched evidence bindings", () => {
    const decision = verifyInvocationEvidenceBindingAgainstCatalog({
      request: {
        tenantId: "tenant_a",
        workflowId: "wf_accept",
        workflowName: "accept-decision",
        workflowVersion: 1,
        nodeId: "accept",
        capability: "portfolio/decision.accept",
        inputs: {},
        capabilityWrites: true,
        triggerEventId: "evt_ready",
      },
      evidenceBinding: binding({
        stateReviewArtifactId: "artifact_nvda_001",
        stateReviewArtifactHash: "b".repeat(64),
        evidenceAdmissionReviewIds: [
          "ev_security:admission_review",
          "ev_missing:admission_review",
        ],
      }),
      catalog: {
        stateReviewArtifacts: [
          {
            stateReviewArtifactId: "artifact_nvda_001",
            artifactHash: "a".repeat(64),
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
          },
        ],
        evidenceAdmissionReviews: [
          {
            reviewId: "ev_security:admission_review",
            tenantId: "tenant_a",
            decision: "admitted",
            authorityStatus: "evidence_only",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
      issues: expect.arrayContaining([
        {
          path: "/evidenceBinding/stateReviewArtifactHash",
          message:
            "state review artifact hash does not match the verification catalog",
        },
        {
          path: "/evidenceBinding/evidenceAdmissionReviewIds",
          message:
            "evidence admission review id is not linked to the referenced state review artifact",
        },
        {
          path: "/evidenceBinding/evidenceAdmissionReviewIds/1",
          message:
            "evidence admission review id was not found in the verification catalog",
        },
      ]),
    });
  });

  it("requires rejected evidence to produce a blocking policy disposition", () => {
    const decision = verifyInvocationEvidenceBindingAgainstCatalog({
      request: {
        tenantId: "tenant_a",
        workflowId: "wf_accept",
        workflowName: "accept-decision",
        workflowVersion: 1,
        nodeId: "accept",
        capability: "portfolio/decision.accept",
        inputs: {},
        capabilityWrites: true,
        triggerEventId: "evt_ready",
      },
      evidenceBinding: binding({
        stateReviewArtifactHash: "a".repeat(64),
      }),
      catalog: {
        stateReviewArtifacts: [
          {
            stateReviewArtifactId: "artifact_nvda_001",
            artifactHash: "a".repeat(64),
            tenantId: "tenant_a",
            workflowId: "wf_accept",
            evidenceAdmissionReviewIds: ["ev_security:admission_review"],
          },
        ],
        evidenceAdmissionReviews: [
          {
            reviewId: "ev_security:admission_review",
            tenantId: "tenant_a",
            decision: "rejected",
            authorityStatus: "evidence_only",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
      issues: [
        {
          path: "/evidenceBinding/policyDisposition",
          message:
            "rejected evidence admission reviews require a blocking policy disposition",
        },
      ],
    });
  });
});
