import { describe, expect, it } from "vitest";

import * as core from "./index.js";

/**
 * Facade integrity tests (refactor plan Phase 0, step 2.1).
 *
 * The core surface is EXPLICIT: 27 runtime exports (values) + 51 type-only
 * exports (erased at runtime). Pinning the runtime count makes accidental
 * widening — an `export *`, or a new primitive landing without review — a
 * test failure instead of silent drift. If you widen the surface on purpose,
 * update EXPECTED_RUNTIME_EXPORTS *and* bring a runtime consumer with it
 * (guardrail: no orphan primitives).
 */
const EXPECTED_RUNTIME_EXPORTS = 27;

describe("@pm/agent-state-core facade", () => {
  it("exposes exactly the pinned runtime surface", () => {
    const runtimeExports = Object.keys(core).sort();
    expect(runtimeExports).toHaveLength(EXPECTED_RUNTIME_EXPORTS);
  });

  it("re-exports the core builders/verifiers as functions", () => {
    const fns = [
      core.stateRef,
      core.buildObservationContractFromCurrentStateView,
      core.buildReadSetFromCurrentStateView,
      core.evaluateObservationContract,
      core.reviewProposedActionAgainstCurrentState,
      core.validateProposedActionReadSet,
      core.buildStateReviewArtifact,
      core.verifyStateReviewArtifactHash,
      core.evaluateStateReviewInvariantPolicy,
      core.serializeStateReviewArtifact,
      core.serializeStateReviewArtifactsJsonl,
      core.importStateReviewArtifact,
      core.importStateReviewArtifactsJsonl,
      core.buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
      core.buildActionOutcomeEnvelope,
      core.verifyActionOutcomeEnvelopeHash,
      core.buildActionOutcomeTerminalIndex,
      core.buildActionOutcomeProviderAuthority,
      core.promoteWorkflowInvocationOutcomeEnvelope,
      core.reviewExternalStateEvidence,
      core.toAdmittedStateEvidence,
      core.admittedStateEvidenceToObservedReadSetEntry,
      core.comparePmHandoffAgreement,
      core.invariantClassesForAdmissionIssue,
    ];
    for (const fn of fns) expect(typeof fn).toBe("function");
  });

  it("re-exports the core schema-version constants", () => {
    expect(core.STATE_REVIEW_ARTIFACT_SCHEMA_VERSION).toBe(
      "state-review-artifact.v1",
    );
    expect(core.ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION).toBe(
      "action-outcome-envelope.v1",
    );
    expect(core.EVIDENCE_ADMISSION_SCHEMA_VERSION).toMatch(/\.v\d+$/);
  });

  it("stays behaviorally identical to @pm/agent-state (shim property)", async () => {
    const legacy = await import("@pm/agent-state");
    // Same function identity, not a copy: the shim must not fork behavior.
    expect(core.buildStateReviewArtifact).toBe(legacy.buildStateReviewArtifact);
    expect(core.buildActionOutcomeEnvelope).toBe(
      legacy.buildActionOutcomeEnvelope,
    );
    expect(core.reviewExternalStateEvidence).toBe(
      legacy.reviewExternalStateEvidence,
    );
  });
});
