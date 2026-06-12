import { describe, expect, it } from "vitest";
import {
  validateInvocationEvidenceBinding,
  type InvocationEvidenceBinding,
} from "./evidence-binding.js";

const binding = (
  overrides: Partial<InvocationEvidenceBinding> = {},
): InvocationEvidenceBinding => ({
  stateReviewArtifactId: "artifact_nvda_001",
  evidenceAdmissionReviewIds: ["ev_security:admission_review"],
  policyDisposition: {
    evaluatedAt: "2026-06-11T16:00:00.000Z",
    consequence: "high",
    wouldBlock: false,
    mode: "advisory",
  },
  ...overrides,
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
});
