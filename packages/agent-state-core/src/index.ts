/**
 * @pm/agent-state-core — the lean agent-state surface.
 *
 * Refactor plan Phase 0, step 2.1 (see /refactor-plan.md). This package is the
 * canonical import path for the agent-state primitives the substrate's
 * consumers actually use. The surface below was derived EMPIRICALLY: it is the
 * union of
 *
 *   (a) every symbol imported from "@pm/agent-state" anywhere in the workspace
 *       outside the package itself (50 symbols across 13 consuming files:
 *       evals x6, profile-agency x4, capability-finance-research-ingest x2,
 *       local-agent-lab x1 — the runtime core imports agent-state 0 times),
 *   (b) the full external-evidence admission module (evidence is admitted,
 *       never granted authority), and
 *   (c) the core-family builders/verifiers the plan names explicitly.
 *
 * INTERIM SHIM: for now every export re-exports from @pm/agent-state, so the
 * split lands incrementally behind green tests. The flip (implementations move
 * here; @pm/agent-state re-exports from this package; the witness/authority/
 * quorum/seal tower moves to @pm/agent-state-provenance) is step 2 of 2.1.
 *
 * RULES (guardrails, plan §5):
 *   1. New code imports @pm/agent-state-core, never @pm/agent-state.
 *   2. Additions to this surface require a runtime (non-test, non-eval)
 *      consumer in the same change — no orphan primitives.
 *   3. No `export *`. The surface is explicit; the facade test pins the
 *      runtime-export count so accidental widening fails CI.
 */

/* ------------------------------------------------------------------ */
/* 1. State references                                                 */
/* ------------------------------------------------------------------ */

export { stateRef } from "@pm/agent-state";
export type { StateRef } from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 2. CurrentStateView + ObservationContract                           */
/*    "Review current state before acting."                            */
/* ------------------------------------------------------------------ */

export {
  buildObservationContractFromCurrentStateView,
  buildReadSetFromCurrentStateView,
  evaluateObservationContract,
} from "@pm/agent-state";
export type {
  CurrentStateView,
  ObservationContract,
  ObservationContractEvaluation,
  ReadSetEntry,
} from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 3. ActionProposalReview (warn-first)                                */
/* ------------------------------------------------------------------ */

export {
  reviewProposedActionAgainstCurrentState,
  validateProposedActionReadSet,
} from "@pm/agent-state";
export type {
  ActionProposalReview,
  ActionProposalReviewEnforcementMode,
  AllowedAction,
  ProposedAction,
  StateConflict,
} from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 4. StateReviewArtifact (+ hash replay, JSONL, continuity payloads)  */
/* ------------------------------------------------------------------ */

export {
  STATE_REVIEW_ARTIFACT_SCHEMA_VERSION,
  buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
  buildStateReviewArtifact,
  evaluateStateReviewInvariantPolicy,
  importStateReviewArtifact,
  importStateReviewArtifactsJsonl,
  serializeStateReviewArtifact,
  serializeStateReviewArtifactsJsonl,
  verifyStateReviewArtifactHash,
} from "@pm/agent-state";
export type {
  EvidenceLinkedContinuityPayload,
  StateReviewActionConsequence,
  StateReviewArtifact,
  StateReviewArtifactContinuityPayload,
  StateReviewArtifactContinuityPayloadOptions,
  StateReviewArtifactOptions,
  StateReviewInvariantClass,
  StateReviewInvariantPolicyMatrix,
  StateReviewTemporalMisalignmentPhase,
} from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 5. ActionOutcomeEnvelope (terminal outcomes / write authority)      */
/* ------------------------------------------------------------------ */

export {
  ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION,
  buildActionOutcomeEnvelope,
  buildActionOutcomeProviderAuthority,
  buildActionOutcomeTerminalIndex,
  promoteWorkflowInvocationOutcomeEnvelope,
  verifyActionOutcomeEnvelopeHash,
} from "@pm/agent-state";
export type {
  ActionOutcomeBlockingCause,
  ActionOutcomeEnvelope,
  ActionOutcomeProviderAuthority,
  ActionOutcomeProviderCertificateStatusRef,
  ActionOutcomeTerminalIndex,
  ActionTerminalOutcome,
} from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 6. Thin certificate refs (types only — the replay/witness tower     */
/*    itself is NOT part of this surface; see @pm/agent-state-provenance) */
/* ------------------------------------------------------------------ */

export type {
  ProjectionReplayCertificateRef,
  ProjectionReplayCertificateStoreRootWitnessSettlementRef,
} from "@pm/agent-state";

/* ------------------------------------------------------------------ */
/* 7. External-evidence admission (full module surface)                */
/*    Evidence, never authority: authorityStatus is always             */
/*    "evidence_only".                                                 */
/* ------------------------------------------------------------------ */

export {
  EVIDENCE_ADMISSION_SCHEMA_VERSION,
  admittedStateEvidenceToObservedReadSetEntry,
  comparePmHandoffAgreement,
  invariantClassesForAdmissionIssue,
  reviewExternalStateEvidence,
  toAdmittedStateEvidence,
} from "@pm/agent-state";
export type {
  AdmittedStateEvidence,
  ApprovalEvidenceFacet,
  EvidenceAdmissionContext,
  EvidenceAdmissionDecision,
  EvidenceAdmissionIssue,
  EvidenceAdmissionIssueCode,
  EvidenceAdmissionIssueSeverity,
  EvidenceAdmissionReview,
  EvidenceAuthorityStatus,
  EvidenceRiskLevel,
  ExternalStateEvidence,
  ExternalStateEvidenceKind,
  IdentityEvidenceFacet,
  MemoryEvidenceFacet,
  MemoryInfluenceKind,
  MemoryIntendedUse,
  MemoryOverrideStatus,
  PmHandoffAgreement,
  PmHandoffEvidenceFacet,
  ProviderPolicyEvidenceFacet,
  TargetReceiptEvidenceFacet,
  TargetReceiptStatus,
  ValidationEvidenceFacet,
  WorkflowTraceEvidenceFacet,
} from "@pm/agent-state";
