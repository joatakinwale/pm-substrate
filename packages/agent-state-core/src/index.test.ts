import { describe, expect, it } from "vitest";

import * as core from "./index.js";

/**
 * Core surface integrity (refactor plan Phase 0, step 2.1 — physical split).
 *
 * EXPECTED_RUNTIME_EXPORTS pins the number of runtime (value) exports of the
 * physical core: the dependency closure of the empirically-used surface. If
 * you widen the surface on purpose, update the pin AND ship a runtime
 * (non-test, non-eval) consumer in the same change (no orphan primitives).
 */
const EXPECTED_RUNTIME_EXPORTS = 97;

/** The canonical consumer-facing names (P0.1 facade) that must never break. */
const CANONICAL_VALUES = [
  "stateRef",
  "buildObservationContractFromCurrentStateView",
  "buildReadSetFromCurrentStateView",
  "evaluateObservationContract",
  "reviewProposedActionAgainstCurrentState",
  "validateProposedActionReadSet",
  "buildStateReviewArtifact",
  "verifyStateReviewArtifactHash",
  "evaluateStateReviewInvariantPolicy",
  "serializeStateReviewArtifact",
  "serializeStateReviewArtifactsJsonl",
  "importStateReviewArtifact",
  "importStateReviewArtifactsJsonl",
  "buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact",
  "buildActionOutcomeEnvelope",
  "verifyActionOutcomeEnvelopeHash",
  "buildActionOutcomeTerminalIndex",
  "buildActionOutcomeProviderAuthority",
  "promoteWorkflowInvocationOutcomeEnvelope",
  "reviewExternalStateEvidence",
  "toAdmittedStateEvidence",
  "admittedStateEvidenceToObservedReadSetEntry",
  "comparePmHandoffAgreement",
  "invariantClassesForAdmissionIssue",
] as const;

describe("@pm/agent-state-core physical surface", () => {
  it("exposes exactly the pinned runtime surface", () => {
    expect(Object.keys(core)).toHaveLength(EXPECTED_RUNTIME_EXPORTS);
  });

  it("keeps every canonical consumer-facing value export callable", () => {
    for (const name of CANONICAL_VALUES) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe(
        "function",
      );
    }
  });

  it("exports the core schema-version constants", () => {
    expect(core.STATE_REVIEW_ARTIFACT_SCHEMA_VERSION).toBe(
      "state-review-artifact.v1",
    );
    expect(core.ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION).toBe(
      "action-outcome-envelope.v1",
    );
    expect(core.EVIDENCE_ADMISSION_SCHEMA_VERSION).toMatch(/\.v\d+$/);
  });

});
