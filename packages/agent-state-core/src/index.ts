/**
 * @pm/agent-state-core — the lean agent-state surface (PHYSICAL, no longer a shim).
 *
 * Refactor plan Phase 0, step 2.1 (/refactor-plan.md). Contents = the exact
 * dependency closure of the empirically-used surface: every symbol imported
 * from the old @pm/agent-state anywhere in the workspace, the plan-named core
 * builders, the agent-facing role-projection/recovery API exercised by
 * external-evidence.test.ts, and the full external-evidence admission module.
 * Extracted mechanically from the old 85k-line index.ts; order preserved.
 *
 * The witness/authority/quorum/seal tower lives in @pm/agent-state-provenance
 * (opt-in; no workspace importers). Guardrails: no export *, additions require
 * a runtime consumer, file budgets enforced by scripts/validate-budgets.ts.
 */
import {
  tenantId,
  type TenantId,
  type TerminalAdmissionProviderCertificateStatus,
  type Timestamp,
} from "@pm/types";

import type { EvidenceAdmissionReview } from "./external-evidence.js";

export * from "./external-evidence.js";

export const STATE_REVIEW_ARTIFACT_SCHEMA_VERSION =
  "state-review-artifact.v1" as const;
export const ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION =
  "action-outcome-envelope.v1" as const;
export const PROJECTION_REPLAY_CERTIFICATE_SCHEMA_VERSION =
  "projection-replay-certificate.v1" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_SCHEMA_VERSION =
  "operational-state-recovery-cut.v1" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_SUBJECT_KIND =
  "operational_state_recovery_cut" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_SCHEMA_VERSION =
  "operational-state-recovery-cut-admission.v1" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_SCHEMA_VERSION =
  "operational-state-recovery-cut-admission-witness.v1" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION =
  "operational-state-recovery-cut-admission-witness-authority-transition-admission.v1" as const;
export const OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION =
  "operational-state-recovery-cut-admission-witness-authority-transition-admission-witness.v1" as const;
export const OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_SCHEMA_VERSION =
  "operational-state-history-root-settlement.v1" as const;
export const OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION =
  "operational-state-history-root-settlement-authority-transition-admission.v1" as const;
export const OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION =
  "operational-state-history-root-settlement-authority-transition-admission-witness.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ARTIFACT_SCHEMA_VERSION =
  "operational-state-pruning-policy-artifact.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_SCHEMA_VERSION =
  "operational-state-pruning-policy-admission.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_SCHEMA_VERSION =
  "operational-state-pruning-policy-admission-witness.v1" as const;
export const OPERATIONAL_STATE_PRIVACY_PRESERVING_POLICY_PROOF_SCHEMA_VERSION =
  "operational-state-privacy-preserving-policy-proof.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION =
  "operational-state-pruning-policy-admission-witness-authority-transition-admission.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION =
  "operational-state-pruning-policy-admission-witness-authority-transition-admission-witness.v1" as const;
export const OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_RECORD_SUBJECT_KIND =
  "operational_state_pruning_policy_admission_record" as const;
export const OPERATIONAL_STATE_QUORUM_CERTIFICATE_PROOF_RECORD_SCHEMA_VERSION =
  "operational-state-quorum-certificate-proof-record.v1" as const;
export const OPERATIONAL_STATE_COMPOSITIONAL_QUORUM_INTERSECTION_PROOF_SCHEMA_VERSION =
  "operational-state-compositional-quorum-intersection-proof.v1" as const;
export const OPERATIONAL_STATE_AUTHORITY_TOPOLOGY_COMPACTION_SCHEMA_VERSION =
  "operational-state-authority-topology-compaction.v1" as const;
export const STATE_REVIEW_EVENT_TYPE =
  "pm.agent_state.action_proposal_reviewed.v1" as const;
export const STATE_REVIEW_EVENT_SPEC_VERSION = "1.0" as const;

export type StateRefKind =
  | "event"
  | "graph_node"
  | "graph_edge"
  | "projection"
  | "workflow_run"
  | "continuity_checkpoint"
  | "capability_invocation"
  | "state_review_artifact"
  | "action_outcome_envelope"
  | "source_record"
  | "document";

export interface StateRef {
  readonly kind: StateRefKind;
  readonly id: string;
  readonly label?: string;
}

export interface StateConflict {
  readonly conflictType:
    | "source_authority_conflict"
    | "state_disagreement"
    | "stale_observation"
    | "workflow_position_conflict";
  readonly refs: readonly StateRef[];
  readonly message: string;
}

export interface RequiredRelatedRole {
  readonly role: string;
  readonly refKind?: StateRefKind;
}

export interface RelatedSubject {
  readonly role: string;
  readonly ref: StateRef;
}

export interface AllowedAction {
  readonly actionType: string;
  readonly label: string;
  readonly requiredRefs: readonly StateRef[];
  readonly requiredWorkflowPosition?: string;
  /** Multi-object preconditions: roles that must be bound on the proposal (OCEL-style qualified roles). */
  readonly requiredRelatedRoles?: readonly RequiredRelatedRole[];
}

export type ProjectionReplayTransitionRefKind = "event" | "action_outcome_envelope";

export interface ProjectionReplayTransitionRef {
  readonly ref: StateRef;
  readonly sequence?: number;
  readonly contentHash?: string;
  readonly admittedAt?: Timestamp;
  readonly authority?: string;
}

export interface ProjectionReplayCertificate {
  readonly schemaVersion: typeof PROJECTION_REPLAY_CERTIFICATE_SCHEMA_VERSION;
  readonly certificateId: string;
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly projectionName?: string;
  readonly authorityScope: string;
  readonly projectionVersion?: number;
  readonly replayedAt: Timestamp;
  readonly replayedBy: string;
  readonly replayedToPosition?: number;
  readonly sourceRefs: readonly StateRef[];
  readonly transitionRefs: readonly ProjectionReplayTransitionRef[];
  readonly transitionHistoryHash: string;
  readonly projectionHash: string;
  readonly certificateHash: string;
}

export interface ProjectionReplayCertificateRef {
  readonly certificateId: string;
  readonly certificateHash: string;
  readonly projectionName: string;
  readonly projectionVersion: number;
  readonly authorityScope: string;
  readonly replayedToPosition: number;
  readonly transitionHistoryHash: string;
  readonly projectionHash: string;
  readonly certificateStoreSequence?: number;
  readonly certificateStoreEntryHash?: string;
  readonly certificateStoreRootHash?: string;
  readonly checkedAt: Timestamp | string;
}

export type OperationalStateRecoveryLaneSource =
  | "admitted_transition_history"
  | "admitted_projection_replay_certificate"
  | "admitted_compaction_checkpoint"
  | "admitted_checkpoint_admission"
  | "admitted_pruning_admission"
  | "admitted_pruning_tombstone"
  | "admitted_required_head"
  | "admitted_witness_ledger"
  | "admitted_authority_history"
  | "admitted_quorum_certificate_record"
  | "current_admissible_projection"
  | "agent_memory"
  | "connector_cache"
  | "conversation_summary"
  | "local_snapshot"
  | "tool_output"
  | "worktree_snapshot";

export type OperationalStateRecoveryLaneKind =
  | "projection"
  | "transition_history"
  | "checkpoint_admission_history"
  | "pruning_admission_history"
  | "pruning_tombstone_history"
  | "required_head"
  | "witness_ledger"
  | "authority_history"
  | "quorum_certificate_record_history"
  | "external_evidence"
  | "private_representation";

export type OperationalStatePruningPolicyStage =
  | "transition_history"
  | "compaction_checkpoint"
  | "checkpoint_admission"
  | "pruning_admission"
  | "pruning_tombstone"
  | "required_head"
  | "witness_ledger"
  | "authority_history"
  | "quorum_certificate"
  | "authority_epoch_seal"
  | "recovery_cut";

export interface OperationalStateRecoveryLaneDependency {
  readonly laneId: string;
  readonly minimumSequence?: number;
  readonly requiredHeadHash?: string;
  readonly requiredHistoryHash?: string;
  readonly requiredAuthorityHash?: string;
}

export interface OperationalStateRecoveryLane {
  readonly laneId: string;
  readonly laneKind: OperationalStateRecoveryLaneKind;
  readonly storeId?: string;
  readonly authorityScope: string;
  readonly source: OperationalStateRecoveryLaneSource;
  readonly required: boolean;
  readonly replayRule: string;
  readonly sequence?: number;
  readonly headHash?: string;
  readonly historyHash?: string;
  readonly projectionHash?: string;
  readonly storeRootHash?: string;
  readonly authorityHash?: string;
  readonly dependencies: readonly OperationalStateRecoveryLaneDependency[];
}

export interface OperationalStateRecoveryCut {
  readonly schemaVersion: typeof OPERATIONAL_STATE_RECOVERY_CUT_SCHEMA_VERSION;
  readonly cutId: string;
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly recoveredAt: Timestamp | string;
  readonly recoveredBy: string;
  readonly authorityScope: string;
  readonly lanes: readonly OperationalStateRecoveryLane[];
  readonly cutHash: string;
}

export type OperationalStateRecoveryCutIssueCode =
  | "operational_state_recovery_cut_missing"
  | "operational_state_recovery_cut_hash_mismatch"
  | "operational_state_recovery_tenant_mismatch"
  | "operational_state_recovery_subject_mismatch"
  | "operational_state_recovery_authority_scope_mismatch"
  | "operational_state_recovery_lane_missing"
  | "operational_state_recovery_lane_duplicate"
  | "operational_state_recovery_lane_private_authority"
  | "operational_state_recovery_lane_not_replayable"
  | "operational_state_recovery_lane_hash_missing"
  | "operational_state_recovery_projection_missing"
  | "operational_state_recovery_projection_unclosed"
  | "operational_state_recovery_dependency_missing"
  | "operational_state_recovery_dependency_sequence_regression"
  | "operational_state_recovery_dependency_head_mismatch"
  | "operational_state_recovery_dependency_history_mismatch"
  | "operational_state_recovery_dependency_authority_mismatch"
  | "operational_state_recovery_quorum_intersection_proof_missing"
  | "operational_state_recovery_quorum_intersection_proof_invalid";

export interface OperationalStateRecoveryCutIssue {
  readonly code: OperationalStateRecoveryCutIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStateRecoveryCutEvaluationOptions {
  readonly expectedAuthorityScope?: string;
  readonly requireCurrentProjection?: boolean;
  readonly requireAllRequiredLanesReplayable?: boolean;
  readonly requireCompositionalQuorumIntersectionProof?: boolean;
  readonly quorumIntersectionProof?: OperationalStateCompositionalQuorumIntersectionProof;
}

export interface OperationalStateRecoveryCutEvaluation {
  readonly valid: boolean;
  readonly cutId?: string;
  readonly cutHash?: string;
  readonly replayableLaneCount: number;
  readonly requiredLaneCount: number;
  readonly projectionLaneCount: number;
  readonly excludedPrivateLaneCount: number;
  readonly quorumIntersectionProofEvaluation?: OperationalStateCompositionalQuorumIntersectionProofEvaluation;
  readonly issues: readonly OperationalStateRecoveryCutIssue[];
}

export interface OperationalStateRecoveryCutAdmissionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly recoveryCutStoreId: string;
  readonly authorityScope: string;
  readonly admissionSequence: number;
  readonly recoveryCutHash: string;
  readonly currentStateViewIdentityHash: string;
  readonly previousAdmissionRecordHash?: string;
  readonly recoveryCut: OperationalStateRecoveryCut;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly admissionReason?: string;
  readonly admissionRecordHash: string;
}

export interface OperationalStateRecoveryCutAdmissionWitnessRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly recoveryCutAdmissionWitnessStoreId: string;
  readonly recoveryCutStoreId: string;
  readonly authorityScope: string;
  readonly witnessSequence: number;
  readonly admissionSequence: number;
  readonly admissionRecordHash: string;
  readonly recoveryCutHash: string;
  readonly currentStateViewIdentityHash: string;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousWitnessRecordHash?: string;
  readonly witnessedAt: Timestamp | string;
  readonly witnessedBy: string;
  readonly witnessReason?: string;
  readonly witnessRecordHash: string;
}

export type OperationalStateRecoveryCutAdmissionIssueCode =
  | "operational_state_recovery_cut_admission_record_tenant_mismatch"
  | "operational_state_recovery_cut_admission_record_scope_mismatch"
  | "operational_state_recovery_cut_admission_record_sequence_gap"
  | "operational_state_recovery_cut_admission_record_previous_hash_mismatch"
  | "operational_state_recovery_cut_admission_record_fork"
  | "operational_state_recovery_cut_admission_record_cut_hash_mismatch"
  | "operational_state_recovery_cut_admission_record_hash_mismatch"
  | "operational_state_recovery_cut_admission_required_cut_missing"
  | "operational_state_recovery_cut_admission_required_cut_hash_mismatch"
  | "operational_state_recovery_cut_admission_view_hash_mismatch"
  | "operational_state_recovery_cut_admission_replay_missing"
  | "operational_state_recovery_cut_admission_replay_invalid"
  | "operational_state_recovery_cut_admission_witness_record_fork"
  | "operational_state_recovery_cut_admission_witness_record_tenant_mismatch"
  | "operational_state_recovery_cut_admission_witness_record_scope_mismatch"
  | "operational_state_recovery_cut_admission_witness_record_store_mismatch"
  | "operational_state_recovery_cut_admission_witness_record_sequence_gap"
  | "operational_state_recovery_cut_admission_witness_record_previous_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_record_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_certificate_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_certificate_not_certified"
  | "operational_state_recovery_cut_admission_witness_certificate_quorum_not_met"
  | "operational_state_recovery_cut_admission_witness_certificate_subject_mismatch"
  | "operational_state_recovery_cut_admission_witness_certificate_authority_boundary_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_topology_missing"
  | "operational_state_recovery_cut_admission_witness_authority_topology_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_topology_tenant_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_topology_scope_mismatch"
  | "operational_state_recovery_cut_admission_witness_certificate_authority_topology_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_quorum_missing"
  | "operational_state_recovery_cut_admission_witness_authority_duplicate_witness"
  | "operational_state_recovery_cut_admission_witness_authority_witness_unknown"
  | "operational_state_recovery_cut_admission_witness_authority_witness_not_active"
  | "operational_state_recovery_cut_admission_witness_authority_quorum_not_met"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_replay_missing"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_replay_invalid"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_topology_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_tenant_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_store_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_scope_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_sequence_gap"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_previous_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_record_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_invalid"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_sequence_gap"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_previous_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_topology_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_transition_previous_topology_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_hash_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_not_certified"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_quorum_not_met"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_subject_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_authority_boundary_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_certificate_authority_topology_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_authority_duplicate_witness"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_authority_witness_unknown"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_authority_witness_not_active"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_authority_quorum_not_met"
  | "operational_state_recovery_cut_admission_witness_authority_transition_not_admitted"
  | "operational_state_recovery_cut_aw_authority_transition_witness_replay_missing"
  | "operational_state_recovery_cut_aw_authority_transition_witness_replay_invalid"
  | "operational_state_recovery_cut_aw_authority_transition_witness_admission_replay_invalid"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_fork"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_tenant_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_store_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_scope_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_sequence_gap"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_previous_hash_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_record_hash_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_hash_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_not_certified"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_quorum_not_met"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_subject_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_authority_boundary_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_topology_missing"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_topology_hash_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_topology_tenant_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_topology_scope_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_certificate_authority_topology_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_quorum_missing"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_duplicate_witness"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_witness_unknown"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_witness_not_active"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_quorum_not_met"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_replay_missing"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_replay_invalid"
  | "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_topology_mismatch"
  | "operational_state_recovery_cut_aw_authority_transition_witness_admission_record_mismatch"
  | "operational_state_recovery_cut_admission_witness_authority_transition_admission_latest_record_not_witnessed"
  | "operational_state_recovery_cut_admission_witness_admission_replay_invalid"
  | "operational_state_recovery_cut_admission_witness_admission_record_mismatch"
  | "operational_state_recovery_cut_admission_witness_replay_missing"
  | "operational_state_recovery_cut_admission_witness_replay_invalid"
  | "operational_state_recovery_cut_admission_latest_record_not_witnessed"
  | "operational_state_recovery_cut_admission_cut_missing"
  | "operational_state_recovery_cut_admission_cut_not_admitted";

export interface OperationalStateRecoveryCutAdmissionIssue {
  readonly code: OperationalStateRecoveryCutAdmissionIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStateRecoveryCutAdmissionReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly recoveryCutStoreId: string;
  readonly authorityScope: string;
  readonly admittedRecordCount: number;
  readonly latestAdmittedRecord?: OperationalStateRecoveryCutAdmissionRecord;
  readonly requiredCut?: OperationalStateRecoveryCut;
  readonly issues: readonly OperationalStateRecoveryCutAdmissionIssue[];
}

export interface OperationalStateRecoveryCutAdmissionWitnessReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly recoveryCutAdmissionWitnessStoreId: string;
  readonly recoveryCutStoreId: string;
  readonly authorityScope: string;
  readonly witnessedRecordCount: number;
  readonly latestWitnessRecord?: OperationalStateRecoveryCutAdmissionWitnessRecord;
  readonly requiredAdmissionRecord?: OperationalStateRecoveryCutAdmissionRecord;
  readonly requiredAdmissionWitnessRecord?: OperationalStateRecoveryCutAdmissionWitnessRecord;
  readonly witnessAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly witnessAuthorityTransitionAdmissionReplay?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStateRecoveryCutAdmissionIssue[];
}

export interface OperationalStateRecoveryCutAdmissionEvaluationInput {
  readonly view: CurrentStateView;
  readonly admissionReplay?: OperationalStateRecoveryCutAdmissionReplay;
  readonly requireAdmissionWitnessQuorum?: boolean;
  readonly requireAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitness?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly admissionWitnessReplay?: OperationalStateRecoveryCutAdmissionWitnessReplay;
}

export interface OperationalStateRecoveryCutAdmissionEvaluation {
  readonly valid: boolean;
  readonly accepted: boolean;
  readonly admissionReplay?: OperationalStateRecoveryCutAdmissionReplay;
  readonly admissionWitnessReplay?: OperationalStateRecoveryCutAdmissionWitnessReplay;
  readonly latestAdmittedRecord?: OperationalStateRecoveryCutAdmissionRecord;
  readonly latestWitnessRecord?: OperationalStateRecoveryCutAdmissionWitnessRecord;
  readonly issues: readonly OperationalStateRecoveryCutAdmissionIssue[];
}

export type OperationalStateHistoryStoreKind =
  | "projection_store"
  | "transition_history_store"
  | "checkpoint_admission_store"
  | "pruning_admission_store"
  | "pruning_tombstone_store"
  | "required_head_store"
  | "witness_ledger"
  | "authority_transition_store"
  | "quorum_certificate_record_store"
  | "recovery_cut_store";

export interface OperationalStateHistoryRoot {
  readonly tenantId: TenantId;
  readonly storeId: string;
  readonly storeKind: OperationalStateHistoryStoreKind;
  readonly authorityScope: string;
  readonly sequence: number;
  readonly rootHash: string;
  readonly recordedAt: Timestamp | string;
  readonly rootCommitmentHash: string;
}

export interface OperationalStateHistoryRootConsistencyProof {
  readonly tenantId: TenantId;
  readonly storeId: string;
  readonly authorityScope: string;
  readonly fromSequence: number;
  readonly fromRootHash: string;
  readonly fromRootCommitmentHash: string;
  readonly toSequence: number;
  readonly toRootHash: string;
  readonly toRootCommitmentHash: string;
  readonly proofHash: string;
}

export interface OperationalStateHistoryRootObservation {
  readonly tenantId: TenantId;
  readonly observerId: string;
  readonly observedAt: Timestamp | string;
  readonly root: OperationalStateHistoryRoot;
  readonly consistencyProof?: OperationalStateHistoryRootConsistencyProof;
  readonly observationHash: string;
}

export interface OperationalStateHistoryRootSettlementRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly rootSettlementStoreId: string;
  readonly authorityScope: string;
  readonly settlementSequence: number;
  readonly storeId: string;
  readonly storeKind: OperationalStateHistoryStoreKind;
  readonly rootSequence: number;
  readonly rootHash: string;
  readonly rootCommitmentHash: string;
  readonly root: OperationalStateHistoryRoot;
  readonly settlementCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousSettlementRecordHash?: string;
  readonly settledAt: Timestamp | string;
  readonly settledBy: string;
  readonly settlementReason?: string;
  readonly settlementRecordHash: string;
}

export interface OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly previousAuthorityRecordHash?: string;
  readonly previousAuthorityTopologyHash?: string;
  readonly nextAuthorityTopologyHash: string;
  readonly authorityTransition: OperationalStateAuthorityTransitionRecord;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousAdmissionRecordHash?: string;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly admissionReason?: string;
  readonly admissionRecordHash: string;
}

export interface OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_HISTORY_ROOT_SETTLEMENT_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessSequence: number;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly admissionRecordHash: string;
  readonly nextAuthorityTopologyHash: string;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousWitnessRecordHash?: string;
  readonly witnessedAt: Timestamp | string;
  readonly witnessedBy: string;
  readonly witnessReason?: string;
  readonly witnessRecordHash: string;
}

export interface OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessedRecordCount: number;
  readonly latestWitnessRecord?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecord;
  readonly requiredAdmissionRecord?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecord;
  readonly requiredAdmissionWitnessRecord?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecord;
  readonly witnessAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly witnessAuthorityTransitionAdmissionReplay?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStateHistoryRootTransparencyIssue[];
}

export interface OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admittedRecordCount: number;
  readonly latestAdmittedRecord?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecord;
  readonly latestAdmittedTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTransition?: OperationalStateAuthorityTransitionRecord;
  readonly requiredAuthorityTransitionAdmissionRecord?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecord;
  readonly admissionWitnessReplay?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplay;
  readonly issues: readonly OperationalStateHistoryRootTransparencyIssue[];
}

export type OperationalStateHistoryRootTransparencyIssueCode =
  | "operational_state_transparency_observation_tenant_mismatch"
  | "operational_state_transparency_observation_hash_mismatch"
  | "operational_state_transparency_root_commitment_mismatch"
  | "operational_state_transparency_root_hash_missing"
  | "operational_state_transparency_root_regression"
  | "operational_state_transparency_split_history"
  | "operational_state_transparency_consistency_proof_missing"
  | "operational_state_transparency_consistency_proof_invalid"
  | "operational_state_transparency_observer_signature_missing"
  | "operational_state_transparency_observer_signature_invalid"
  | "operational_state_transparency_root_settlement_record_fork"
  | "operational_state_transparency_root_settlement_record_tenant_mismatch"
  | "operational_state_transparency_root_settlement_record_scope_mismatch"
  | "operational_state_transparency_root_settlement_record_store_mismatch"
  | "operational_state_transparency_root_settlement_record_sequence_gap"
  | "operational_state_transparency_root_settlement_record_previous_hash_mismatch"
  | "operational_state_transparency_root_settlement_record_root_hash_mismatch"
  | "operational_state_transparency_root_settlement_record_hash_mismatch"
  | "operational_state_transparency_root_settlement_certificate_hash_mismatch"
  | "operational_state_transparency_root_settlement_certificate_not_certified"
  | "operational_state_transparency_root_settlement_certificate_quorum_not_met"
  | "operational_state_transparency_root_settlement_certificate_subject_mismatch"
  | "operational_state_transparency_root_settlement_certificate_authority_boundary_mismatch"
  | "operational_state_transparency_root_settlement_authority_topology_missing"
  | "operational_state_transparency_root_settlement_authority_topology_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_topology_tenant_mismatch"
  | "operational_state_transparency_root_settlement_authority_topology_scope_mismatch"
  | "operational_state_transparency_root_settlement_certificate_authority_topology_mismatch"
  | "operational_state_transparency_root_settlement_authority_quorum_missing"
  | "operational_state_transparency_root_settlement_authority_duplicate_witness"
  | "operational_state_transparency_root_settlement_authority_witness_unknown"
  | "operational_state_transparency_root_settlement_authority_witness_not_active"
  | "operational_state_transparency_root_settlement_authority_quorum_not_met"
  | "operational_state_transparency_root_settlement_authority_transition_admission_replay_missing"
  | "operational_state_transparency_root_settlement_authority_transition_admission_replay_invalid"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_sequence_gap"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_tenant_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_store_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_scope_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_previous_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_record_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_sequence_gap"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_previous_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_invalid"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_topology_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_transition_previous_topology_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_not_certified"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_quorum_not_met"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_subject_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_authority_boundary_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_certificate_authority_topology_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_authority_duplicate_witness"
  | "operational_state_transparency_root_settlement_authority_transition_admission_authority_witness_unknown"
  | "operational_state_transparency_root_settlement_authority_transition_admission_authority_witness_not_active"
  | "operational_state_transparency_root_settlement_authority_transition_admission_authority_quorum_not_met"
  | "operational_state_transparency_root_settlement_authority_transition_admission_topology_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_replay_missing"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_replay_invalid"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_admission_replay_invalid"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_fork"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_tenant_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_store_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_scope_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_sequence_gap"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_previous_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_record_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_not_certified"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_quorum_not_met"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_subject_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_authority_boundary_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_topology_missing"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_topology_hash_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_topology_tenant_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_topology_scope_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_certificate_authority_topology_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_quorum_missing"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_duplicate_witness"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_witness_unknown"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_witness_not_active"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_quorum_not_met"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_missing"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_invalid"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_topology_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_witness_admission_record_mismatch"
  | "operational_state_transparency_root_settlement_authority_transition_admission_latest_record_not_witnessed"
  | "operational_state_transparency_root_settlement_authority_transition_not_admitted"
  | "operational_state_transparency_required_root_not_settled";

export interface OperationalStateHistoryRootTransparencyIssue {
  readonly code: OperationalStateHistoryRootTransparencyIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStateHistoryRootTransparencyReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly observations: readonly OperationalStateHistoryRootObservation[];
  readonly observerSignatureRequired: boolean;
  readonly signedObservationCount: number;
  readonly acceptedRoots: readonly OperationalStateHistoryRoot[];
  readonly latestRoots: readonly OperationalStateHistoryRoot[];
  readonly issues: readonly OperationalStateHistoryRootTransparencyIssue[];
}

export interface OperationalStateHistoryRootSettlementReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly rootSettlementStoreId: string;
  readonly authorityScope: string;
  readonly settledRecordCount: number;
  readonly settledRoots: readonly OperationalStateHistoryRoot[];
  readonly latestSettlementRecord?: OperationalStateHistoryRootSettlementRecord;
  readonly requiredSettlementRecords: readonly OperationalStateHistoryRootSettlementRecord[];
  readonly settlementAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly settlementAuthorityTransitionAdmissionReplay?: OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStateHistoryRootTransparencyIssue[];
}

export type OperationalStateRecoveryCutTransparencyIssueCode =
  | "operational_state_recovery_transparency_replay_missing"
  | "operational_state_recovery_transparency_replay_invalid"
  | "operational_state_recovery_transparency_observer_signature_required"
  | "operational_state_recovery_transparency_root_settlement_replay_missing"
  | "operational_state_recovery_transparency_root_settlement_replay_invalid"
  | "operational_state_recovery_transparency_root_settlement_authority_topology_missing"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_replay_missing"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_replay_missing"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_topology_missing"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_missing"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_invalid"
  | "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_topology_mismatch"
  | "operational_state_recovery_transparency_lane_root_unsettled"
  | "operational_state_recovery_transparency_lane_store_id_missing"
  | "operational_state_recovery_transparency_lane_root_unwitnessed"
  | "operational_state_recovery_transparency_lane_root_stale"
  | "operational_state_recovery_transparency_lane_root_mismatch";

export interface OperationalStateRecoveryCutTransparencyIssue {
  readonly code: OperationalStateRecoveryCutTransparencyIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStateRecoveryCutTransparencyEvaluation {
  readonly valid: boolean;
  readonly checkedLaneCount: number;
  readonly witnessedLaneCount: number;
  readonly settledLaneCount: number;
  readonly issues: readonly OperationalStateRecoveryCutTransparencyIssue[];
}

export interface OperationalStateRecoveryCutTransparencyEvaluationInput {
  readonly cut?: OperationalStateRecoveryCut;
  readonly transparencyReplay?: OperationalStateHistoryRootTransparencyReplay;
  readonly requireWitnessedStoreRoots?: boolean;
  readonly requireObserverSignatures?: boolean;
  readonly requireRootSettlement?: boolean;
  readonly requireRootSettlementAuthorityTopology?: boolean;
  readonly requireRootSettlementAuthorityTransitionAdmission?: boolean;
  readonly requireRootSettlementAuthorityTransitionAdmissionWitness?: boolean;
  readonly requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly rootSettlementReplay?: OperationalStateHistoryRootSettlementReplay;
}

export interface OperationalStatePruningPolicyCompiledObligation {
  readonly obligationId: string;
  readonly stage: OperationalStatePruningPolicyStage;
  readonly laneId: string;
  readonly laneKind: OperationalStateRecoveryLaneKind;
  readonly source: OperationalStateRecoveryLaneSource;
  readonly storeId: string;
  readonly storeKind: OperationalStateHistoryStoreKind;
  readonly required: true;
  readonly replayRule: string;
  readonly requiresHeadHash: boolean;
  readonly requiresHistoryHash: boolean;
  readonly requiresProjectionHash: boolean;
  readonly requiresAuthorityHash: boolean;
  readonly requiresStoreRootHash: boolean;
  readonly dependsOn: readonly string[];
}

export type OperationalStatePruningPolicyIssueCode =
  | "operational_state_pruning_policy_compilation_missing"
  | "operational_state_pruning_policy_compilation_invalid"
  | "operational_state_pruning_policy_stage_duplicate"
  | "operational_state_pruning_policy_stage_missing"
  | "operational_state_pruning_policy_stage_out_of_order"
  | "operational_state_pruning_policy_recovery_cut_missing"
  | "operational_state_pruning_policy_tenant_mismatch"
  | "operational_state_pruning_policy_authority_scope_mismatch"
  | "operational_state_pruning_policy_obligation_missing"
  | "operational_state_pruning_policy_lane_kind_mismatch"
  | "operational_state_pruning_policy_lane_source_mismatch"
  | "operational_state_pruning_policy_lane_store_id_mismatch"
  | "operational_state_pruning_policy_lane_not_required"
  | "operational_state_pruning_policy_lane_head_hash_missing"
  | "operational_state_pruning_policy_lane_history_hash_missing"
  | "operational_state_pruning_policy_lane_projection_hash_missing"
  | "operational_state_pruning_policy_lane_authority_hash_missing"
  | "operational_state_pruning_policy_lane_store_root_missing"
  | "operational_state_pruning_policy_dependency_missing"
  | "operational_state_pruning_policy_transparency_invalid"
  | "operational_state_pruning_policy_admission_replay_missing"
  | "operational_state_pruning_policy_admission_replay_invalid"
  | "operational_state_pruning_policy_admission_record_fork"
  | "operational_state_pruning_policy_admission_record_tenant_mismatch"
  | "operational_state_pruning_policy_admission_record_scope_mismatch"
  | "operational_state_pruning_policy_admission_record_sequence_gap"
  | "operational_state_pruning_policy_admission_record_previous_hash_mismatch"
  | "operational_state_pruning_policy_admission_record_hash_mismatch"
  | "operational_state_pruning_policy_admission_record_artifact_hash_mismatch"
  | "operational_state_pruning_policy_admission_record_policy_hash_mismatch"
  | "operational_state_pruning_policy_admission_record_compilation_invalid"
  | "operational_state_pruning_policy_admission_record_compilation_hash_mismatch"
  | "operational_state_pruning_policy_admission_required_policy_missing"
  | "operational_state_pruning_policy_admission_required_policy_hash_mismatch"
  | "operational_state_pruning_policy_admission_policy_not_admitted"
  | "operational_state_pruning_policy_admission_policy_stale"
  | "operational_state_pruning_policy_admission_witness_record_fork"
  | "operational_state_pruning_policy_admission_witness_record_tenant_mismatch"
  | "operational_state_pruning_policy_admission_witness_record_scope_mismatch"
  | "operational_state_pruning_policy_admission_witness_record_store_mismatch"
  | "operational_state_pruning_policy_admission_witness_record_sequence_gap"
  | "operational_state_pruning_policy_admission_witness_record_previous_hash_mismatch"
  | "operational_state_pruning_policy_admission_witness_record_hash_mismatch"
  | "operational_state_pruning_policy_admission_witness_certificate_hash_mismatch"
  | "operational_state_pruning_policy_admission_witness_certificate_not_certified"
  | "operational_state_pruning_policy_admission_witness_certificate_quorum_not_met"
  | "operational_state_pruning_policy_admission_witness_certificate_subject_mismatch"
  | "operational_state_pruning_policy_admission_witness_certificate_authority_boundary_mismatch"
  | "operational_state_pruning_policy_admission_witness_authority_topology_missing"
  | "operational_state_pruning_policy_admission_witness_authority_topology_hash_mismatch"
  | "operational_state_pruning_policy_admission_witness_authority_topology_tenant_mismatch"
  | "operational_state_pruning_policy_admission_witness_authority_topology_scope_mismatch"
  | "operational_state_pruning_policy_admission_witness_certificate_authority_topology_mismatch"
  | "operational_state_pruning_policy_admission_witness_authority_quorum_missing"
  | "operational_state_pruning_policy_admission_witness_authority_duplicate_witness"
  | "operational_state_pruning_policy_admission_witness_authority_witness_unknown"
  | "operational_state_pruning_policy_admission_witness_authority_witness_not_active"
  | "operational_state_pruning_policy_admission_witness_authority_quorum_not_met"
  | "operational_state_pruning_policy_aw_authority_transition_replay_missing"
  | "operational_state_pruning_policy_aw_authority_transition_replay_invalid"
  | "operational_state_pruning_policy_aw_authority_transition_record_sequence_gap"
  | "operational_state_pruning_policy_aw_authority_transition_record_tenant_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_record_store_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_record_scope_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_record_previous_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_record_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_transition_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_transition_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_transition_sequence_gap"
  | "operational_state_pruning_policy_aw_authority_transition_transition_previous_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_transition_invalid"
  | "operational_state_pruning_policy_aw_authority_transition_transition_topology_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_transition_previous_topology_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_not_certified"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_quorum_not_met"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_subject_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_authority_boundary_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_certificate_authority_topology_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_authority_duplicate_witness"
  | "operational_state_pruning_policy_aw_authority_transition_authority_witness_unknown"
  | "operational_state_pruning_policy_aw_authority_transition_authority_witness_not_active"
  | "operational_state_pruning_policy_aw_authority_transition_authority_quorum_not_met"
  | "operational_state_pruning_policy_aw_authority_transition_topology_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_replay_missing"
  | "operational_state_pruning_policy_aw_authority_transition_witness_replay_invalid"
  | "operational_state_pruning_policy_aw_authority_transition_witness_admission_replay_invalid"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_fork"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_tenant_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_store_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_scope_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_sequence_gap"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_previous_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_record_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_not_certified"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_quorum_not_met"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_subject_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_authority_boundary_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_topology_missing"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_topology_hash_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_topology_tenant_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_topology_scope_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_certificate_authority_topology_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_quorum_missing"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_duplicate_witness"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_witness_unknown"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_witness_not_active"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_quorum_not_met"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_replay_missing"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_replay_invalid"
  | "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_topology_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_witness_admission_record_mismatch"
  | "operational_state_pruning_policy_aw_authority_transition_latest_record_not_witnessed"
  | "operational_state_pruning_policy_admission_witness_authority_transition_not_admitted"
  | "operational_state_pruning_policy_admission_witness_admission_replay_invalid"
  | "operational_state_pruning_policy_admission_witness_admission_record_mismatch"
  | "operational_state_pruning_policy_admission_witness_replay_missing"
  | "operational_state_pruning_policy_admission_witness_replay_invalid"
  | "operational_state_pruning_policy_privacy_proof_missing"
  | "operational_state_pruning_policy_privacy_proof_hash_mismatch"
  | "operational_state_pruning_policy_privacy_proof_invalid"
  | "operational_state_pruning_policy_privacy_proof_tenant_mismatch"
  | "operational_state_pruning_policy_privacy_proof_scope_mismatch"
  | "operational_state_pruning_policy_privacy_proof_subject_mismatch"
  | "operational_state_pruning_policy_privacy_proof_policy_mismatch"
  | "operational_state_pruning_policy_privacy_proof_verifier_not_allowed"
  | "operational_state_pruning_policy_privacy_proof_private_input_disclosed"
  | "operational_state_pruning_policy_privacy_proof_statement_missing"
  | "operational_state_pruning_policy_privacy_proof_claim_overreach"
  | "operational_state_pruning_policy_admission_latest_record_not_witnessed";

export interface OperationalStatePruningPolicyIssue {
  readonly code: OperationalStatePruningPolicyIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStatePruningPolicyCompilation {
  readonly valid: boolean;
  readonly policyId: string;
  readonly policyHash: string;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly subject?: StateRef;
  readonly baseStoreId: string;
  readonly baseLaneId: string;
  readonly stages: readonly OperationalStatePruningPolicyStage[];
  readonly obligations: readonly OperationalStatePruningPolicyCompiledObligation[];
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyEvaluationInput {
  readonly cut?: OperationalStateRecoveryCut;
  readonly compilation?: OperationalStatePruningPolicyCompilation;
  readonly transparencyEvaluation?: OperationalStateRecoveryCutTransparencyEvaluation;
}

export interface OperationalStatePruningPolicyEvaluation {
  readonly valid: boolean;
  readonly policyId?: string;
  readonly policyHash?: string;
  readonly checkedObligationCount: number;
  readonly satisfiedObligationCount: number;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyArtifact {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRUNING_POLICY_ARTIFACT_SCHEMA_VERSION;
  readonly policyId: string;
  readonly policyHash: string;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly compilation: OperationalStatePruningPolicyCompilation;
  readonly compiledAt: Timestamp | string;
  readonly compiledBy: string;
  readonly compilerVersion?: string;
  readonly artifactHash: string;
}

export interface OperationalStatePruningPolicyAdmissionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly policyStoreId: string;
  readonly authorityScope: string;
  readonly policySequence: number;
  readonly policyId: string;
  readonly policyHash: string;
  readonly previousPolicyRecordHash?: string;
  readonly artifact: OperationalStatePruningPolicyArtifact;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly admissionReason?: string;
  readonly policyRecordHash: string;
}

export interface OperationalStatePruningPolicyAdmissionWitnessRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly policyAdmissionWitnessStoreId: string;
  readonly policyStoreId: string;
  readonly authorityScope: string;
  readonly witnessSequence: number;
  readonly policySequence: number;
  readonly policyId: string;
  readonly policyHash: string;
  readonly artifactHash: string;
  readonly policyRecordHash: string;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousWitnessRecordHash?: string;
  readonly witnessedAt: Timestamp | string;
  readonly witnessedBy: string;
  readonly witnessReason?: string;
  readonly witnessRecordHash: string;
}

export type OperationalStatePrivacyPreservingPolicyProofResult =
  | "valid"
  | "invalid";

export type OperationalStatePrivacyPreservingPolicyProofSystem =
  | "anonymous_credential_presentation"
  | "selective_disclosure_credential"
  | "zero_knowledge_policy_proof"
  | string;

export interface OperationalStatePrivacyPreservingPolicyProof {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRIVACY_PRESERVING_POLICY_PROOF_SCHEMA_VERSION;
  readonly proofId: string;
  readonly tenantId: TenantId;
  readonly policyStoreId: string;
  readonly authorityScope: string;
  readonly authorityBoundary: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly subjectSequence: number;
  readonly subjectHash: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly policyRecordHash: string;
  readonly proofSystem: OperationalStatePrivacyPreservingPolicyProofSystem;
  readonly proofSystemVersion?: string;
  readonly verifierId: string;
  readonly verifierVersion?: string;
  readonly verificationKeyHash: string;
  readonly publicStatementHash: string;
  readonly predicateCommitmentHash: string;
  readonly hiddenWitnessCommitmentHash: string;
  readonly proofTranscriptHash: string;
  readonly challengeNonce: string;
  readonly verifiedAt: Timestamp | string;
  readonly result: OperationalStatePrivacyPreservingPolicyProofResult;
  readonly disclosedClaimHashes: readonly string[];
  readonly adapterClaims: readonly string[];
  readonly privateInputRefs: readonly string[];
  readonly policyProofHash: string;
}

export interface OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly previousAuthorityRecordHash?: string;
  readonly previousAuthorityTopologyHash?: string;
  readonly nextAuthorityTopologyHash: string;
  readonly authorityTransition: OperationalStateAuthorityTransitionRecord;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousAdmissionRecordHash?: string;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly admissionReason?: string;
  readonly admissionRecordHash: string;
}

export interface OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessSequence: number;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly admissionRecordHash: string;
  readonly nextAuthorityTopologyHash: string;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousWitnessRecordHash?: string;
  readonly witnessedAt: Timestamp | string;
  readonly witnessedBy: string;
  readonly witnessReason?: string;
  readonly witnessRecordHash: string;
}

export interface OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessedRecordCount: number;
  readonly latestWitnessRecord?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord;
  readonly requiredAdmissionRecord?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly requiredAdmissionWitnessRecord?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord;
  readonly witnessAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly witnessAuthorityTransitionAdmissionReplay?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admittedRecordCount: number;
  readonly latestAdmittedRecord?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly latestAdmittedTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTransition?: OperationalStateAuthorityTransitionRecord;
  readonly requiredAuthorityTransitionAdmissionRecord?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly admissionWitnessReplay?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyAdmissionReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly policyStoreId: string;
  readonly authorityScope: string;
  readonly admittedRecordCount: number;
  readonly latestAdmittedRecord?: OperationalStatePruningPolicyAdmissionRecord;
  readonly requiredCompilation?: OperationalStatePruningPolicyCompilation;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyAdmissionWitnessReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly policyAdmissionWitnessStoreId: string;
  readonly policyStoreId: string;
  readonly authorityScope: string;
  readonly witnessedRecordCount: number;
  readonly latestWitnessRecord?: OperationalStatePruningPolicyAdmissionWitnessRecord;
  readonly requiredAdmissionRecord?: OperationalStatePruningPolicyAdmissionRecord;
  readonly requiredAdmissionWitnessRecord?: OperationalStatePruningPolicyAdmissionWitnessRecord;
  readonly witnessAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly witnessAuthorityTransitionAdmissionReplay?: OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export interface OperationalStatePruningPolicyAdmissionEvaluationInput {
  readonly compilation?: OperationalStatePruningPolicyCompilation;
  readonly admissionReplay?: OperationalStatePruningPolicyAdmissionReplay;
  readonly privacyPreservingPolicyProof?: OperationalStatePrivacyPreservingPolicyProof;
  readonly requirePrivacyPreservingPolicyProof?: boolean;
  readonly allowedPrivacyPreservingPolicyProofVerifierIds?: readonly string[];
  readonly requireAdmissionWitnessQuorum?: boolean;
  readonly requireAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitness?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly admissionWitnessReplay?: OperationalStatePruningPolicyAdmissionWitnessReplay;
}

export interface OperationalStatePruningPolicyAdmissionEvaluation {
  readonly valid: boolean;
  readonly accepted: boolean;
  readonly policyId?: string;
  readonly policyHash?: string;
  readonly admissionReplay?: OperationalStatePruningPolicyAdmissionReplay;
  readonly admissionWitnessReplay?: OperationalStatePruningPolicyAdmissionWitnessReplay;
  readonly privacyPreservingPolicyProof?: OperationalStatePrivacyPreservingPolicyProof;
  readonly latestAdmittedRecord?: OperationalStatePruningPolicyAdmissionRecord;
  readonly latestWitnessRecord?: OperationalStatePruningPolicyAdmissionWitnessRecord;
  readonly issues: readonly OperationalStatePruningPolicyIssue[];
}

export type OperationalStateQuorumCertificateProofStatus =
  | "provisional"
  | "witnessed"
  | "certified"
  | "obstructed";

export interface OperationalStateQuorumCertificateProofCertificate {
  readonly schemaVersion: typeof OPERATIONAL_STATE_QUORUM_CERTIFICATE_PROOF_RECORD_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly authorityBoundary: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly subjectSequence: number;
  readonly subjectHash: string;
  readonly status: OperationalStateQuorumCertificateProofStatus;
  readonly certified: boolean;
  readonly acceptedWitnessIds: readonly string[];
  readonly obstructingWitnessIds: readonly string[];
  readonly invalidWitnessIds: readonly string[];
  readonly authorityTopologyHash?: string;
  readonly requiredWitnesses: number;
  readonly minimumWitnesses: number;
  readonly certifiedAt?: Timestamp | string;
  readonly certifiedBy?: string;
  readonly quorumCertificateHash: string;
}

export type OperationalStateCompositionalQuorumIntersectionMode =
  | "pairwise_active_intersection"
  | "global_active_intersection";

export interface OperationalStateCompositionalQuorumClaim {
  readonly claimId: string;
  readonly laneId?: string;
  readonly authorityScope: string;
  readonly authorityBoundary: string;
  readonly topologyId: string;
  readonly authorityTopology: OperationalStateAuthorityTopology;
  readonly authorityTopologyHash: string;
  readonly quorumCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly quorumCertificateHash: string;
  readonly authorityTransitionAdmissionStoreId?: string;
  readonly authorityTransitionAdmissionRecordHash?: string;
}

export interface OperationalStateCompositionalQuorumPairwiseIntersection {
  readonly leftClaimId: string;
  readonly rightClaimId: string;
  readonly activeIntersectionWitnessIds: readonly string[];
  readonly intersectionSize: number;
}

export interface OperationalStateCompositionalQuorumIntersectionProof {
  readonly schemaVersion: typeof OPERATIONAL_STATE_COMPOSITIONAL_QUORUM_INTERSECTION_PROOF_SCHEMA_VERSION;
  readonly proofId: string;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly subjectSequence: number;
  readonly subjectHash: string;
  readonly intersectionMode: OperationalStateCompositionalQuorumIntersectionMode;
  readonly requiredIntersectionWitnesses: number;
  readonly claims: readonly OperationalStateCompositionalQuorumClaim[];
  readonly pairwiseIntersections: readonly OperationalStateCompositionalQuorumPairwiseIntersection[];
  readonly globalIntersectionWitnessIds: readonly string[];
  readonly evaluatedAt: Timestamp | string;
  readonly evaluatedBy: string;
  readonly proofReason?: string;
  readonly proofHash: string;
}

export type OperationalStateCompositionalQuorumIntersectionIssueCode =
  | "operational_state_compositional_quorum_intersection_proof_missing"
  | "operational_state_compositional_quorum_intersection_proof_hash_mismatch"
  | "operational_state_compositional_quorum_intersection_tenant_mismatch"
  | "operational_state_compositional_quorum_intersection_scope_mismatch"
  | "operational_state_compositional_quorum_intersection_subject_mismatch"
  | "operational_state_compositional_quorum_intersection_required_intersection_invalid"
  | "operational_state_compositional_quorum_intersection_claim_count_insufficient"
  | "operational_state_compositional_quorum_intersection_claim_duplicate"
  | "operational_state_compositional_quorum_intersection_topology_hash_mismatch"
  | "operational_state_compositional_quorum_intersection_topology_tenant_mismatch"
  | "operational_state_compositional_quorum_intersection_topology_scope_mismatch"
  | "operational_state_compositional_quorum_intersection_topology_id_mismatch"
  | "operational_state_compositional_quorum_intersection_certificate_hash_mismatch"
  | "operational_state_compositional_quorum_intersection_certificate_not_certified"
  | "operational_state_compositional_quorum_intersection_certificate_quorum_not_met"
  | "operational_state_compositional_quorum_intersection_certificate_tenant_mismatch"
  | "operational_state_compositional_quorum_intersection_certificate_scope_mismatch"
  | "operational_state_compositional_quorum_intersection_certificate_boundary_mismatch"
  | "operational_state_compositional_quorum_intersection_certificate_topology_mismatch"
  | "operational_state_compositional_quorum_intersection_duplicate_witness"
  | "operational_state_compositional_quorum_intersection_witness_unknown"
  | "operational_state_compositional_quorum_intersection_witness_not_active"
  | "operational_state_compositional_quorum_intersection_pairwise_intersection_mismatch"
  | "operational_state_compositional_quorum_intersection_global_intersection_mismatch"
  | "operational_state_compositional_quorum_intersection_pairwise_missing"
  | "operational_state_compositional_quorum_intersection_global_missing";

export interface OperationalStateCompositionalQuorumIntersectionIssue {
  readonly code: OperationalStateCompositionalQuorumIntersectionIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface OperationalStateCompositionalQuorumIntersectionProofEvaluationInput {
  readonly proof?: OperationalStateCompositionalQuorumIntersectionProof;
  readonly expectedTenantId?: TenantId | string;
  readonly expectedAuthorityScope?: string;
  readonly expectedSubjectKind?: string;
  readonly expectedSubjectId?: string;
  readonly expectedSubjectSequence?: number;
  readonly expectedSubjectHash?: string;
  readonly requiredIntersectionWitnesses?: number;
}

export interface OperationalStateCompositionalQuorumIntersectionProofEvaluation {
  readonly valid: boolean;
  readonly accepted: boolean;
  readonly proofId?: string;
  readonly proofHash?: string;
  readonly claimCount: number;
  readonly pairwiseIntersections: readonly OperationalStateCompositionalQuorumPairwiseIntersection[];
  readonly globalIntersectionWitnessIds: readonly string[];
  readonly issues: readonly OperationalStateCompositionalQuorumIntersectionIssue[];
}

export type OperationalStateAuthorityTransitionKind =
  | "set_quorum"
  | "admit_principal"
  | "suspend_principal"
  | "revoke_principal"
  | "rotate_signature_key"
  | "mark_equivocated"
  | "seal_authority_epoch";

export type OperationalStateAuthorityPrincipalStatus =
  | "active"
  | "suspended"
  | "revoked"
  | "equivocated";

export interface OperationalStateAuthorityPrincipalState {
  readonly principalId: string;
  readonly status: OperationalStateAuthorityPrincipalStatus;
  readonly signatureKeyId?: string;
  readonly updatedAtAuthoritySequence: number;
}

export interface OperationalStateAuthorityTransitionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_AUTHORITY_TOPOLOGY_COMPACTION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly authoritySequence: number;
  readonly previousAuthorityRecordHash?: string;
  readonly transitionKind: OperationalStateAuthorityTransitionKind;
  readonly recordedAt: Timestamp | string;
  readonly recordedBy: string;
  readonly effectiveFromSubjectSequence: number;
  readonly requiredWitnesses?: number;
  readonly minimumWitnesses?: number;
  readonly principalId?: string;
  readonly signatureKeyId?: string;
  readonly sealedThroughSubjectSequence?: number;
  readonly sealedQuorumCertificateHash?: string;
  readonly reason?: string;
  readonly authorityRecordHash: string;
}

export interface OperationalStateAuthorityTopology {
  readonly schemaVersion: typeof OPERATIONAL_STATE_AUTHORITY_TOPOLOGY_COMPACTION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly requiredWitnesses?: number;
  readonly minimumWitnesses?: number;
  readonly principals: readonly OperationalStateAuthorityPrincipalState[];
  readonly sealedThroughSubjectSequence?: number;
  readonly sealedQuorumCertificateHash?: string;
  readonly latestSealHash?: string;
  readonly topologyHash: string;
}

export interface OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly previousAuthorityRecordHash?: string;
  readonly previousAuthorityTopologyHash?: string;
  readonly nextAuthorityTopologyHash: string;
  readonly authorityTransition: OperationalStateAuthorityTransitionRecord;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousAdmissionRecordHash?: string;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly admissionReason?: string;
  readonly admissionRecordHash: string;
}

export interface OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly admittedRecordCount: number;
  readonly latestAdmittedRecord?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly latestAdmittedTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly requiredAuthorityTransition?: OperationalStateAuthorityTransitionRecord;
  readonly requiredAuthorityTransitionAdmissionRecord?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly admissionWitnessReplay?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay;
  readonly issues: readonly OperationalStateRecoveryCutAdmissionIssue[];
}

export interface OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord {
  readonly schemaVersion: typeof OPERATIONAL_STATE_RECOVERY_CUT_ADMISSION_WITNESS_AUTHORITY_TRANSITION_ADMISSION_WITNESS_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessSequence: number;
  readonly admissionSequence: number;
  readonly authoritySequence: number;
  readonly authorityRecordHash: string;
  readonly admissionRecordHash: string;
  readonly nextAuthorityTopologyHash: string;
  readonly admissionCertificate: OperationalStateQuorumCertificateProofCertificate;
  readonly previousWitnessRecordHash?: string;
  readonly witnessedAt: Timestamp | string;
  readonly witnessedBy: string;
  readonly witnessReason?: string;
  readonly witnessRecordHash: string;
}

export interface OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay {
  readonly valid: boolean;
  readonly tenantId: TenantId | string;
  readonly transitionAdmissionWitnessStoreId: string;
  readonly transitionAdmissionStoreId: string;
  readonly topologyId: string;
  readonly authorityScope: string;
  readonly witnessedRecordCount: number;
  readonly latestWitnessRecord?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord;
  readonly requiredAdmissionRecord?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecord;
  readonly requiredAdmissionWitnessRecord?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord;
  readonly witnessAuthorityTopology?: OperationalStateAuthorityTopology;
  readonly witnessAuthorityTransitionAdmissionReplay?: OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionReplay;
  readonly issues: readonly OperationalStateRecoveryCutAdmissionIssue[];
}

export interface CurrentStateView {
  readonly tenantId: TenantId;
  readonly viewId: string;
  readonly subject: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authorityRule: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly sourceRefs: readonly StateRef[];
  readonly missingSources: readonly string[];
  readonly conflicts: readonly StateConflict[];
  readonly allowedActions: readonly AllowedAction[];
  readonly replayCertificate?: ProjectionReplayCertificate;
  readonly recoveryCut?: OperationalStateRecoveryCut;
}

export interface ReadSetEntry {
  readonly ref: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authority: string;
  readonly projectionVersion?: number;
}

export interface ObservedReadSetEntry {
  readonly ref: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authority: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly source?: string;
  readonly tool?: string;
}

export interface ProposedAction {
  readonly tenantId: TenantId;
  readonly actionType: string;
  readonly subject: StateRef;
  /** Role-qualified secondary objects this action touches (multi-object preconditions). */
  readonly relatedSubjects?: readonly RelatedSubject[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readSet: readonly ReadSetEntry[];
  readonly observationContract?: ObservationContract;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
}

export type ReadSetValidationIssueCode =
  | "tenant_mismatch"
  | "subject_mismatch"
  | "action_not_allowed"
  | "missing_read_ref"
  | "stale_read_ref"
  | "current_view_conflict"
  | "authority_mismatch"
  | "projection_version_mismatch"
  | "workflow_position_mismatch"
  | "missing_related_object_role"
  | "related_object_role_mismatch";

export interface ReadSetValidationIssue {
  readonly code: ReadSetValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
}

export interface ReadSetValidationDecision {
  readonly valid: boolean;
  readonly mode: "warn";
  readonly issues: readonly ReadSetValidationIssue[];
}

export type ObservedReadSetValidationIssueCode =
  | "observed_but_undeclared"
  | "declared_but_unobserved"
  | "stale_observed_read"
  | "authority_mismatch"
  | "projection_version_drift"
  | "workflow_position_drift";

export interface ObservedReadSetValidationIssue {
  readonly code: ObservedReadSetValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
  readonly declaredIndex?: number;
  readonly observedIndex?: number;
}

export interface ObservedReadSetComparison {
  readonly valid: boolean;
  readonly mode: "warn";
  readonly declaredReadSet: readonly ReadSetEntry[];
  readonly observedReadSet: readonly ObservedReadSetEntry[];
  readonly issues: readonly ObservedReadSetValidationIssue[];
}

export interface ObservationContract {
  readonly tenantId: TenantId;
  readonly contractId: string;
  readonly subject: StateRef;
  readonly issuedAt: Timestamp;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authorityRule: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly requiredSourceRefs: readonly StateRef[];
  readonly declaredMissingSources: readonly string[];
  readonly declaredConflictCount: number;
  /** v2 fields (Arrowsmith v04): issuer, integrity, holder binding, and allowed use. All optional and backward compatible. */
  readonly issuer?: string;
  readonly integrityHash?: string;
  readonly holderBinding?: string;
  readonly allowedUse?: readonly string[];
  readonly redactionPolicy?: string;
  readonly revocationRef?: StateRef;
}

export type StateAssertionCode =
  | "required_source_refs_present"
  | "authority_rule_matches"
  | "freshness_window_current"
  | "projection_version_matches"
  | "workflow_position_matches"
  | "conflicts_declared"
  | "missing_sources_declared";

export type StateAssertionSeverity = "info" | "warn" | "fail";

export interface StateAssertion {
  readonly code: StateAssertionCode;
  readonly passed: boolean;
  readonly severity: StateAssertionSeverity;
  readonly message: string;
  readonly refs: readonly StateRef[];
}

export interface ObservationContractEvaluation {
  readonly valid: boolean;
  readonly contractId: string;
  readonly currentStateViewId: string;
  readonly evaluatedAt: Timestamp;
  readonly assertions: readonly StateAssertion[];
}

export type ActionProposalReviewMode = "warn";
export type ActionProposalReviewEnforcementMode = "advisory" | "blocking";
export type ActionProposalExecutionReason =
  | "advisory_warn_first_v1"
  | "blocking_policy_passed"
  | "blocking_policy_failed";
export type ActionProposalWarningSource =
  | "read_set"
  | "observation_contract"
  | "contract_binding"
  | "projection_replay"
  | "operational_recovery"
  | "operational_recovery_admission"
  | "operational_transparency"
  | "pruning_policy"
  | "pruning_policy_admission";

export interface ActionProposalWarning {
  readonly source: ActionProposalWarningSource;
  readonly code: string;
  readonly severity: StateAssertionSeverity;
  readonly message: string;
  readonly refs: readonly StateRef[];
}

export interface ActionProposalExecutionDisposition {
  readonly allowed: boolean;
  readonly blocking: boolean;
  readonly enforcementMode: ActionProposalReviewEnforcementMode;
  readonly reason: ActionProposalExecutionReason;
  readonly warningCount: number;
}

export interface ActionProposalReviewOptions {
  readonly evaluatedAt?: Timestamp;
  readonly observationContract?: ObservationContract;
  readonly enforcementMode?: ActionProposalReviewEnforcementMode;
  readonly requireReplayCertificate?: boolean;
  readonly expectedReplayAuthorityScope?: string;
  readonly minimumReplayPosition?: number;
  readonly requireReplayTransitionContentHash?: boolean;
  readonly requireRecoveryCut?: boolean;
  readonly expectedRecoveryAuthorityScope?: string;
  readonly requireRecoveryCutAdmission?: boolean;
  readonly recoveryCutAdmissionReplay?: OperationalStateRecoveryCutAdmissionReplay;
  readonly requireRecoveryCutAdmissionWitnessQuorum?: boolean;
  readonly requireRecoveryCutAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitness?: boolean;
  readonly requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly recoveryCutAdmissionWitnessReplay?: OperationalStateRecoveryCutAdmissionWitnessReplay;
  readonly requireRecoveryTransparency?: boolean;
  readonly recoveryTransparencyReplay?: OperationalStateHistoryRootTransparencyReplay;
  readonly requireRecoveryTransparencyObserverSignatures?: boolean;
  readonly requireRecoveryTransparencyRootSettlement?: boolean;
  readonly requireRecoveryTransparencyRootSettlementAuthorityTopology?: boolean;
  readonly requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmission?: boolean;
  readonly requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitness?: boolean;
  readonly requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly recoveryTransparencyRootSettlementReplay?: OperationalStateHistoryRootSettlementReplay;
  readonly requirePruningPolicyCompliance?: boolean;
  readonly pruningPolicyCompilation?: OperationalStatePruningPolicyCompilation;
  readonly requirePruningPolicyAdmission?: boolean;
  readonly pruningPolicyAdmissionReplay?: OperationalStatePruningPolicyAdmissionReplay;
  readonly pruningPolicyPrivacyPreservingPolicyProof?: OperationalStatePrivacyPreservingPolicyProof;
  readonly requirePruningPolicyPrivacyPreservingPolicyProof?: boolean;
  readonly allowedPruningPolicyPrivacyPreservingPolicyProofVerifierIds?: readonly string[];
  readonly requirePruningPolicyAdmissionWitnessQuorum?: boolean;
  readonly requirePruningPolicyAdmissionWitnessAuthorityTopology?: boolean;
  readonly requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitness?: boolean;
  readonly requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology?: boolean;
  readonly requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission?: boolean;
  readonly pruningPolicyAdmissionWitnessReplay?: OperationalStatePruningPolicyAdmissionWitnessReplay;
}

export interface ActionProposalReview {
  readonly tenantId: TenantId;
  readonly reviewId: string;
  readonly mode: ActionProposalReviewMode;
  readonly valid: boolean;
  readonly proposedAction: ProposedAction;
  readonly currentStateView: CurrentStateView;
  readonly observationContract: ObservationContract;
  readonly observationEvaluation: ObservationContractEvaluation;
  readonly readSetValidation: ReadSetValidationDecision;
  readonly warnings: readonly ActionProposalWarning[];
  readonly execution: ActionProposalExecutionDisposition;
}

export interface StateReviewTraceContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly spanId?: string;
  readonly parentReviewId?: string;
}

export interface StateReviewEventEnvelope {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly specversion: typeof STATE_REVIEW_EVENT_SPEC_VERSION;
  readonly time: Timestamp;
  readonly subject: string;
}

export interface StateReviewRelatedObject {
  readonly role: string;
  readonly ref: StateRef;
}

export type StateReviewProvenanceRelation =
  | "used"
  | "wasDerivedFrom"
  | "wasGeneratedBy"
  | "wasAssociatedWith"
  | "actedOnBehalfOf"
  | "hadPlan";

export interface StateReviewProvenanceLink {
  readonly relation: StateReviewProvenanceRelation;
  readonly id: string;
  readonly role?: string;
  readonly ref?: StateRef;
}

export interface StateReviewProvenance {
  readonly generatedBy: string;
  readonly used: readonly StateRef[];
  readonly derivedFrom: readonly StateRef[];
  readonly associatedAgent: string;
  readonly actedOnBehalfOf?: string;
  readonly planId?: string;
  readonly links: readonly StateReviewProvenanceLink[];
}

export type StateReviewTemporalMisalignmentPhase =
  | "none"
  | "observation_to_action"
  | "action_to_feedback"
  | "feedback_to_observation";

export type StateReviewInvariantClass =
  | "subject_identity"
  | "tenant_boundary"
  | "required_evidence"
  | "freshness_window"
  | "source_authority"
  | "projection_version"
  | "projection_replay"
  | "workflow_position"
  | "state_conflict"
  | "capability_contract";

export type StateReviewActionConsequence = "low" | "medium" | "high";
export type InvariantClassPolicyDecision = "advisory" | "blocking";

type CompleteStateReviewInvariantPolicyMatrix = Readonly<
  Record<
    StateReviewInvariantClass,
    Readonly<Record<StateReviewActionConsequence, InvariantClassPolicyDecision>>
  >
>;

export type StateReviewInvariantPolicyMatrix = Readonly<
  Partial<
    Record<
      StateReviewInvariantClass,
      Readonly<Partial<Record<StateReviewActionConsequence, InvariantClassPolicyDecision>>>
    >
  >
>;

export interface StateReviewInvariantPolicyDecisionEntry {
  readonly invariantClass: StateReviewInvariantClass;
  readonly consequence: StateReviewActionConsequence;
  readonly decision: InvariantClassPolicyDecision;
}

export interface StateReviewInvariantPolicyEvaluation {
  readonly consequence: StateReviewActionConsequence;
  readonly wouldBlock: boolean;
  readonly wouldBlockInvariantClasses: readonly StateReviewInvariantClass[];
  readonly advisoryInvariantClasses: readonly StateReviewInvariantClass[];
  readonly decisions: readonly StateReviewInvariantPolicyDecisionEntry[];
}

export const DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX = {
  subject_identity: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  tenant_boundary: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  required_evidence: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  freshness_window: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  source_authority: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  projection_version: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  projection_replay: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  workflow_position: {
    low: "advisory",
    medium: "advisory",
    high: "blocking",
  },
  state_conflict: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
  capability_contract: {
    low: "advisory",
    medium: "blocking",
    high: "blocking",
  },
} as const satisfies CompleteStateReviewInvariantPolicyMatrix;

export type ActionTerminalOutcome =
  | "accepted"
  | "blocked"
  | "rejected"
  | "held"
  | "superseded"
  | "escalated";

export type ActionOutcomeBlockingCauseSource =
  | "proposal_review"
  | "evidence_admission"
  | "policy"
  | "status_check"
  | "local_view";

export interface ActionOutcomeBlockingCause {
  readonly source: ActionOutcomeBlockingCauseSource;
  readonly code: string;
  readonly message: string;
  readonly refs: readonly StateRef[];
  readonly invariantClasses?: readonly StateReviewInvariantClass[];
}

export interface ActionOutcomeProviderCertificateStatusRef {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly status: TerminalAdmissionProviderCertificateStatus;
  readonly statusSequence: number;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: Timestamp | string;
  readonly checkedAt: Timestamp | string;
}

export interface ActionOutcomeProviderAuthority {
  readonly providerCertificateId: string;
  readonly providerCertificateDigest: string;
  readonly providerCertificateStatusRef: ActionOutcomeProviderCertificateStatusRef;
}

export interface ActionOutcomeProviderAuthorityInput {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: Timestamp | string;
  readonly checkedAt: Timestamp | string;
  readonly status?: TerminalAdmissionProviderCertificateStatus;
  readonly statusSequence?: number;
}

export function buildActionOutcomeProviderAuthority(
  input: ActionOutcomeProviderAuthorityInput,
): ActionOutcomeProviderAuthority {
  return {
    providerCertificateId: input.certificateId,
    providerCertificateDigest: input.certificateDigest,
    providerCertificateStatusRef: {
      certificateId: input.certificateId,
      certificateDigest: input.certificateDigest,
      status: input.status ?? "valid",
      statusSequence: input.statusSequence ?? 1,
      statusEventHash: input.statusEventHash,
      statusUpdatedAt: input.statusUpdatedAt,
      checkedAt: input.checkedAt,
    },
  };
}

export interface ActionOutcomeEnvelope {
  readonly schemaVersion: typeof ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly statusCheckRefs: readonly StateRef[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly projectionReplayRef?: ProjectionReplayCertificateRef;
  readonly projectionReplayRootSettlementRef?: ProjectionReplayCertificateStoreRootWitnessSettlementRef;
  readonly policyTransitionRef?: StateRef;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly decidedBy: string;
  readonly blockingCauses: readonly ActionOutcomeBlockingCause[];
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
  readonly outcomeHash: string;
}

export type ActionOutcomeEnvelopeHashPayload = Omit<
  ActionOutcomeEnvelope,
  "outcomeHash"
>;

export interface ActionOutcomeEnvelopeInput {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly evidenceAdmissionReviewIds?: readonly string[];
  readonly statusCheckRefs?: readonly StateRef[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly projectionReplayRef?: ProjectionReplayCertificateRef;
  readonly projectionReplayRootSettlementRef?: ProjectionReplayCertificateStoreRootWitnessSettlementRef;
  readonly policyTransitionRef?: StateRef;
  readonly requestedTerminalOutcome: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly decidedBy: string;
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
  readonly blockingCauses?: readonly ActionOutcomeBlockingCause[];
  readonly proposalReview?: ActionProposalReview;
  readonly evidenceAdmissions?: readonly EvidenceAdmissionReview[];
  readonly actionConsequence?: StateReviewActionConsequence;
}

export interface WorkflowInvocationActionOutcomeEnvelopeSource {
  readonly schemaVersion: "pm.workflow.action_outcome_envelope.v1";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted" | "blocked";
  readonly generatedAt: Timestamp | string;
  readonly tenantId: TenantId | string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly triggerEventId: string;
  readonly stateReviewArtifactId?: string;
  readonly stateReviewArtifactHash?: string;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly projectionReplayRef?: ProjectionReplayCertificateRef;
  readonly projectionReplayRootSettlementRef?: ProjectionReplayCertificateStoreRootWitnessSettlementRef;
  readonly evidenceDecision: {
    readonly valid: boolean;
    readonly reason?: string;
  };
}

export interface WorkflowActionOutcomePromotionInput {
  readonly workflowEnvelope: WorkflowInvocationActionOutcomeEnvelopeSource;
  readonly subject: StateRef;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash?: string;
  readonly decidedBy?: string;
  readonly statusCheckRefs?: readonly StateRef[];
  readonly policyTransitionRef?: StateRef;
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
  readonly blockingCauses?: readonly ActionOutcomeBlockingCause[];
}

export type ActionOutcomePartitionReason =
  | "first_terminal_outcome"
  | "idempotent_duplicate"
  | "candidate_hash_invalid"
  | "incumbent_hash_invalid"
  | "terminal_outcome_conflict";

export interface ActionOutcomePartitionDecision {
  readonly accepted: boolean;
  readonly reason: ActionOutcomePartitionReason;
  readonly candidate: ActionOutcomeEnvelope;
  readonly incumbent?: ActionOutcomeEnvelope;
  readonly candidateHashValidation: StateReviewArtifactHashValidation;
  readonly incumbentHashValidation?: StateReviewArtifactHashValidation;
  readonly message: string;
}

export type ActionOutcomeTerminalIndexIssueCode = Exclude<
  ActionOutcomePartitionReason,
  "first_terminal_outcome" | "idempotent_duplicate"
>;

export interface ActionOutcomeTerminalIndexIssue {
  readonly code: ActionOutcomeTerminalIndexIssueCode;
  readonly key: string;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly candidate: ActionOutcomeEnvelope;
  readonly incumbent?: ActionOutcomeEnvelope;
  readonly candidateHashValidation: StateReviewArtifactHashValidation;
  readonly incumbentHashValidation?: StateReviewArtifactHashValidation;
  readonly message: string;
}

export interface ActionOutcomeTerminalIndexEntry {
  readonly key: string;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly envelope: ActionOutcomeEnvelope;
  readonly replayCount: number;
  readonly substrateRefs: readonly StateRef[];
}

export interface ActionOutcomeTerminalIndex {
  readonly valid: boolean;
  readonly entries: readonly ActionOutcomeTerminalIndexEntry[];
  readonly issues: readonly ActionOutcomeTerminalIndexIssue[];
}

export type ProjectionReplayCertificateIssueCode =
  | "projection_replay_certificate_missing"
  | "projection_replay_certificate_hash_mismatch"
  | "projection_replay_tenant_mismatch"
  | "projection_replay_subject_mismatch"
  | "projection_replay_version_mismatch"
  | "projection_replay_authority_scope_mismatch"
  | "projection_replay_source_refs_mismatch"
  | "projection_replay_projection_hash_mismatch"
  | "projection_replay_transition_history_hash_mismatch"
  | "projection_replay_transition_history_empty"
  | "projection_replay_transition_kind_invalid"
  | "projection_replay_transition_hash_missing"
  | "projection_replay_position_regression";

export interface ProjectionReplayCertificateIssue {
  readonly code: ProjectionReplayCertificateIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
}

export interface ProjectionReplayCertificateEvaluationOptions {
  readonly expectedAuthorityScope?: string;
  readonly minimumReplayPosition?: number;
  readonly requireTransitionContentHash?: boolean;
}

export interface ProjectionReplayCertificateEvaluation {
  readonly valid: boolean;
  readonly certificateId?: string;
  readonly issues: readonly ProjectionReplayCertificateIssue[];
}

export interface ProjectionReplayCertificateStoreRootWitnessSettlementRef {
  readonly rootSequence: number;
  readonly rootHash: string;
  readonly settlementSequence: number;
  readonly settlementStatus: "settled";
  readonly settlementHash: string;
  readonly settlementRecordHash: string;
  readonly authorityTopologyHash?: string;
  readonly checkedAt: Timestamp | string;
}

export interface LocalStateField {
  readonly value: unknown;
  readonly refs: readonly StateRef[];
  readonly authority?: string;
  readonly observedAt?: Timestamp;
  readonly validUntil?: Timestamp;
}

export interface LocalStateSection {
  readonly tenantId: TenantId;
  readonly sectionId: string;
  readonly role: string;
  readonly subject: StateRef;
  readonly fields: Readonly<Record<string, LocalStateField>>;
}

export interface LocalViewOverlapConflict {
  readonly field: string;
  readonly sectionIds: readonly string[];
  readonly refs: readonly StateRef[];
  readonly values: readonly unknown[];
  readonly message: string;
}

export interface LocalViewObstructionArtifact {
  readonly artifactId: string;
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly generatedAt: Timestamp;
  readonly sectionIds: readonly string[];
  readonly conflicts: readonly LocalViewOverlapConflict[];
  readonly allowedAction: "request_resolution";
}

export interface LocalViewGlobalProjection {
  readonly tenantId: TenantId;
  readonly subject: StateRef;
  readonly generatedAt: Timestamp;
  readonly sectionIds: readonly string[];
  readonly fields: Readonly<Record<string, LocalStateField>>;
}

export type LocalViewEvaluation =
  | {
      readonly kind: "global_projection";
      readonly projection: LocalViewGlobalProjection;
    }
  | {
      readonly kind: "obstruction";
      readonly obstruction: LocalViewObstructionArtifact;
    };

export interface LocalViewEvaluationOptions {
  readonly artifactId?: string;
  readonly generatedAt: Timestamp;
  readonly requiredFields?: readonly string[];
}

export type ActionOutcomeProjectionRole =
  | "risk_officer"
  | "project_manager"
  | "auditor"
  | "operator";

export interface ActionOutcomeInvariantCore {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly subject: StateRef;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly proposalReviewId: string;
  readonly stateReviewArtifactHash: string;
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: ActionOutcomeProviderCertificateStatusRef;
  readonly projectionReplayRef?: ProjectionReplayCertificateRef;
  readonly projectionReplayRootSettlementRef?: ProjectionReplayCertificateStoreRootWitnessSettlementRef;
  readonly evidenceAdmissionReviewIds: readonly string[];
  readonly statusCheckRefs: readonly StateRef[];
  readonly blockingCauseCodes: readonly string[];
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
  readonly outcomeHash: string;
}

export interface ActionOutcomeRoleProjection {
  readonly role: ActionOutcomeProjectionRole;
  readonly core: ActionOutcomeInvariantCore;
  readonly visibleBlockingCauses: readonly ActionOutcomeBlockingCause[];
}

export interface ActionOutcomeProjectionValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface StateReviewArtifactMetadataInput {
  readonly temporalMisalignmentPhase?: StateReviewTemporalMisalignmentPhase;
  readonly invariantClasses?: readonly StateReviewInvariantClass[];
  readonly scenarioId?: string;
  readonly fixtureId?: string;
  readonly clientSurface?: string;
  readonly provider?: string;
  readonly sessionId?: string;
  readonly workflowRunId?: string;
  /** Trajectory-level run grouping: artifacts sharing a runGroupId form one long-horizon run (frontier item 8). */
  readonly runGroupId?: string;
  readonly evalEventIds?: readonly string[];
  readonly observedReadSet?: readonly ObservedReadSetEntry[];
  readonly observedReadSetComparison?: ObservedReadSetComparison;
  /** External evidence admission reviews consumed by this action review (frontier item 1). */
  readonly evidenceAdmissions?: readonly EvidenceAdmissionReview[];
}

export interface StateReviewArtifactMetadata
  extends StateReviewArtifactMetadataInput {
  readonly temporalMisalignmentPhase: StateReviewTemporalMisalignmentPhase;
  readonly invariantClasses: readonly StateReviewInvariantClass[];
}

export interface StateReviewArtifact {
  readonly schemaVersion: typeof STATE_REVIEW_ARTIFACT_SCHEMA_VERSION;
  readonly artifactId: string;
  readonly generatedAt: Timestamp;
  readonly eventEnvelope: StateReviewEventEnvelope;
  readonly traceContext?: StateReviewTraceContext;
  readonly relatedObjects: readonly StateReviewRelatedObject[];
  readonly provenance: StateReviewProvenance;
  readonly metadata: StateReviewArtifactMetadata;
  readonly review: ActionProposalReview;
  readonly artifactHash: string;
}

export type StateReviewArtifactHashPayload = Omit<
  StateReviewArtifact,
  "artifactHash"
>;

export interface StateReviewArtifactOptions {
  readonly artifactId?: string;
  readonly generatedAt?: Timestamp;
  readonly source?: string;
  readonly eventType?: string;
  readonly traceContext?: StateReviewTraceContext;
  readonly relatedObjects?: readonly StateReviewRelatedObject[];
  readonly provenanceLinks?: readonly StateReviewProvenanceLink[];
  readonly actedOnBehalfOf?: string;
  readonly planId?: string;
  readonly metadata?: StateReviewArtifactMetadataInput;
}

export interface StateReviewArtifactHashValidation {
  readonly valid: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export interface StateReviewArtifactImportIssue {
  readonly path: string;
  readonly message: string;
}

export interface StateReviewArtifactImportResult {
  readonly valid: boolean;
  readonly artifact?: StateReviewArtifact;
  readonly hashValidation?: StateReviewArtifactHashValidation;
  readonly issues: readonly StateReviewArtifactImportIssue[];
}

export interface StateReviewArtifactContinuityPayloadOptions {
  readonly supersedes?: readonly string[];
  readonly contradictedBy?: readonly string[];
}

export interface EvidenceLinkedContinuityPayload
  extends Readonly<Record<string, unknown>> {
  readonly sourceRefs: readonly StateRef[];
  readonly validUntil?: Timestamp;
  readonly supersedes: readonly string[];
  readonly contradictedBy: readonly string[];
  readonly authorityRule: string;
  readonly currentStateViewId: string;
}

export interface StateReviewArtifactContinuityPayload
  extends EvidenceLinkedContinuityPayload {
  readonly stateReviewArtifactId: string;
  readonly stateReviewArtifactHash: string;
  readonly reviewId: string;
  readonly observationContractId: string;
  readonly valid: boolean;
  readonly warningCodes: readonly string[];
}

export function stateRef(kind: StateRefKind, id: string, label?: string): StateRef {
  return label === undefined ? { kind, id } : { kind, id, label };
}

export function evaluateStateReviewInvariantPolicy(
  invariantClasses: readonly StateReviewInvariantClass[],
  consequence: StateReviewActionConsequence,
  matrix: StateReviewInvariantPolicyMatrix =
    DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX,
): StateReviewInvariantPolicyEvaluation {
  const decisions = uniqueStrings(invariantClasses).map(
    (invariantClass): StateReviewInvariantPolicyDecisionEntry => ({
      invariantClass,
      consequence,
      decision:
        matrix[invariantClass]?.[consequence] ??
        DEFAULT_STATE_REVIEW_INVARIANT_POLICY_MATRIX[invariantClass][consequence],
    }),
  );
  const wouldBlockInvariantClasses = decisions
    .filter((decision) => decision.decision === "blocking")
    .map((decision) => decision.invariantClass);
  const advisoryInvariantClasses = decisions
    .filter((decision) => decision.decision === "advisory")
    .map((decision) => decision.invariantClass);

  return {
    consequence,
    wouldBlock: wouldBlockInvariantClasses.length > 0,
    wouldBlockInvariantClasses,
    advisoryInvariantClasses,
    decisions,
  };
}

export function buildActionOutcomeEnvelope(
  input: ActionOutcomeEnvelopeInput,
): ActionOutcomeEnvelope {
  const actionConsequence = input.actionConsequence ?? "high";
  const evidenceAdmissions = input.evidenceAdmissions ?? [];
  const evidenceAdmissionReviewIds = uniqueStrings([
    ...(input.evidenceAdmissionReviewIds ?? []),
    ...evidenceAdmissions.map((review) => review.reviewId),
  ]);
  const blockingCauses = dedupeBlockingCauses([
    ...(input.blockingCauses ?? []),
    ...blockingCausesFromProposalReview(input.proposalReview),
    ...blockingCausesFromEvidenceAdmissions(evidenceAdmissions, actionConsequence),
  ]);
  const terminalOutcome =
    input.requestedTerminalOutcome === "accepted" && blockingCauses.length > 0
      ? "blocked"
      : input.requestedTerminalOutcome;
  const payload: ActionOutcomeEnvelopeHashPayload = {
    schemaVersion: ACTION_OUTCOME_ENVELOPE_SCHEMA_VERSION,
    tenantId: input.tenantId,
    actionId: input.actionId,
    subject: input.subject,
    proposalReviewId: input.proposalReviewId,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    evidenceAdmissionReviewIds,
    statusCheckRefs: uniqueStateRefs(input.statusCheckRefs ?? []),
    ...(input.providerCertificateId !== undefined
      ? { providerCertificateId: input.providerCertificateId }
      : {}),
    ...(input.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: input.providerCertificateDigest }
      : {}),
    ...(input.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: input.providerCertificateStatusRef }
      : {}),
    ...(input.projectionReplayRef !== undefined
      ? { projectionReplayRef: input.projectionReplayRef }
      : {}),
    ...(input.projectionReplayRootSettlementRef !== undefined
      ? {
          projectionReplayRootSettlementRef:
            input.projectionReplayRootSettlementRef,
        }
      : {}),
    ...(input.policyTransitionRef !== undefined
      ? { policyTransitionRef: input.policyTransitionRef }
      : {}),
    terminalOutcome,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    blockingCauses,
    evidenceRefs: uniqueStateRefs([
      ...(input.evidenceRefs ?? []),
      ...evidenceAdmissions.flatMap((review) => [
        ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
        ...review.evidence.refs,
      ]),
    ]),
    substrateRefs: uniqueStateRefs(input.substrateRefs ?? []),
  };

  return {
    ...payload,
    outcomeHash: computeActionOutcomeEnvelopeHash(payload),
  };
}

export function promoteWorkflowInvocationOutcomeEnvelope(
  input: WorkflowActionOutcomePromotionInput,
): ActionOutcomeEnvelope {
  const workflowEnvelope = input.workflowEnvelope;
  const stateReviewArtifactHash =
    input.stateReviewArtifactHash ?? workflowEnvelope.stateReviewArtifactHash;

  if (stateReviewArtifactHash === undefined || stateReviewArtifactHash.trim() === "") {
    throw new Error(
      "workflow outcome promotion requires a stateReviewArtifactHash from the workflow envelope or promotion context",
    );
  }
  if (input.proposalReviewId.trim() === "") {
    throw new Error("workflow outcome promotion requires a proposalReviewId");
  }
  if (
    workflowEnvelope.terminalOutcome === "accepted" &&
    workflowEnvelope.evidenceDecision.valid === false
  ) {
    throw new Error(
      "workflow outcome promotion cannot turn an invalid evidence decision into an accepted terminal outcome",
    );
  }
  if (
    workflowEnvelope.terminalOutcome === "accepted" &&
    (input.blockingCauses ?? []).length > 0
  ) {
    throw new Error(
      "workflow outcome promotion cannot attach blocking causes to an accepted terminal outcome",
    );
  }
  if (
    workflowEnvelope.terminalOutcome === "blocked" &&
    workflowEnvelope.evidenceDecision.valid === true &&
    (input.blockingCauses ?? []).length === 0
  ) {
    throw new Error(
      "workflow outcome promotion requires a blocking cause for a blocked terminal outcome with a valid evidence decision",
    );
  }

  const blockingCauses = dedupeBlockingCauses([
    ...(input.blockingCauses ?? []),
    ...workflowBlockingCauses(workflowEnvelope),
  ]);
  const workflowEnvelopeRef = stateRef(
    "action_outcome_envelope",
    workflowEnvelope.envelopeId,
    "Workflow action outcome envelope",
  );
  const workflowRunRef = stateRef(
    "workflow_run",
    workflowEnvelope.workflowId,
    workflowEnvelope.workflowName,
  );
  const capabilityInvocationRef = stateRef(
    "capability_invocation",
    `${workflowEnvelope.workflowId}:${workflowEnvelope.workflowVersion}:${workflowEnvelope.nodeId}:${workflowEnvelope.triggerEventId}`,
    workflowEnvelope.capability,
  );
  const stateReviewArtifactRef =
    workflowEnvelope.stateReviewArtifactId === undefined
      ? undefined
      : stateRef("state_review_artifact", workflowEnvelope.stateReviewArtifactId);

  return buildActionOutcomeEnvelope({
    tenantId: workflowEnvelope.tenantId as TenantId,
    actionId: workflowEnvelope.actionId,
    subject: input.subject,
    proposalReviewId: input.proposalReviewId,
    stateReviewArtifactHash,
    evidenceAdmissionReviewIds: workflowEnvelope.evidenceAdmissionReviewIds,
    ...(input.statusCheckRefs !== undefined
      ? { statusCheckRefs: input.statusCheckRefs }
      : {}),
    ...(workflowEnvelope.providerCertificateId !== undefined
      ? { providerCertificateId: workflowEnvelope.providerCertificateId }
      : {}),
    ...(workflowEnvelope.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: workflowEnvelope.providerCertificateDigest }
      : {}),
    ...(workflowEnvelope.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: workflowEnvelope.providerCertificateStatusRef }
      : {}),
    ...(workflowEnvelope.projectionReplayRef !== undefined
      ? { projectionReplayRef: workflowEnvelope.projectionReplayRef }
      : {}),
    ...(workflowEnvelope.projectionReplayRootSettlementRef !== undefined
      ? {
          projectionReplayRootSettlementRef:
            workflowEnvelope.projectionReplayRootSettlementRef,
        }
      : {}),
    ...(input.policyTransitionRef !== undefined
      ? { policyTransitionRef: input.policyTransitionRef }
      : {}),
    requestedTerminalOutcome: workflowEnvelope.terminalOutcome,
    decidedAt: workflowEnvelope.generatedAt as Timestamp,
    decidedBy: input.decidedBy ?? "workflow:evidence-binding-gate",
    ...(input.evidenceRefs !== undefined
      ? { evidenceRefs: input.evidenceRefs }
      : {}),
    substrateRefs: uniqueStateRefs([
      ...(input.substrateRefs ?? []),
      workflowEnvelopeRef,
      workflowRunRef,
      capabilityInvocationRef,
      ...(stateReviewArtifactRef === undefined ? [] : [stateReviewArtifactRef]),
    ]),
    blockingCauses,
  });
}

export function computeActionOutcomeEnvelopeHash(
  envelope: ActionOutcomeEnvelopeHashPayload,
): string {
  return fingerprint64(canonicalStringify(envelope));
}

export function verifyActionOutcomeEnvelopeHash(
  envelope: ActionOutcomeEnvelope,
): StateReviewArtifactHashValidation {
  const { outcomeHash, ...payload } = envelope;
  const expectedHash = computeActionOutcomeEnvelopeHash(payload);

  return {
    valid: outcomeHash === expectedHash,
    expectedHash,
    actualHash: outcomeHash,
  };
}

export function actionOutcomeTerminalKey(
  tenantId: TenantId,
  actionId: string,
): string {
  return `${tenantId}:${actionId}`;
}

export function admitActionOutcomeEnvelope(
  existing: readonly ActionOutcomeEnvelope[],
  candidate: ActionOutcomeEnvelope,
): ActionOutcomePartitionDecision {
  const candidateHashValidation = verifyActionOutcomeEnvelopeHash(candidate);
  if (!candidateHashValidation.valid) {
    return {
      accepted: false,
      reason: "candidate_hash_invalid",
      candidate,
      candidateHashValidation,
      message: `Action ${candidate.actionId} terminal outcome envelope hash ${candidateHashValidation.actualHash} does not match recomputed hash ${candidateHashValidation.expectedHash}.`,
    };
  }

  const incumbent = existing.find(
    (item) =>
      item.tenantId === candidate.tenantId && item.actionId === candidate.actionId,
  );

  if (incumbent === undefined) {
    return {
      accepted: true,
      reason: "first_terminal_outcome",
      candidate,
      candidateHashValidation,
      message: `Action ${candidate.actionId} has no prior terminal outcome.`,
    };
  }

  const incumbentHashValidation = verifyActionOutcomeEnvelopeHash(incumbent);
  if (!incumbentHashValidation.valid) {
    return {
      accepted: false,
      reason: "incumbent_hash_invalid",
      candidate,
      incumbent,
      candidateHashValidation,
      incumbentHashValidation,
      message: `Action ${candidate.actionId} already has an invalid incumbent terminal outcome envelope hash ${incumbentHashValidation.actualHash}.`,
    };
  }

  if (incumbent.outcomeHash === candidate.outcomeHash) {
    return {
      accepted: true,
      reason: "idempotent_duplicate",
      candidate,
      incumbent,
      candidateHashValidation,
      incumbentHashValidation,
      message: `Action ${candidate.actionId} already has the same terminal outcome envelope.`,
    };
  }

  return {
    accepted: false,
    reason: "terminal_outcome_conflict",
    candidate,
    incumbent,
    candidateHashValidation,
    incumbentHashValidation,
    message: `Action ${candidate.actionId} already ended as ${incumbent.terminalOutcome}; cannot also end as ${candidate.terminalOutcome}.`,
  };
}

export function buildActionOutcomeTerminalIndex(
  envelopes: readonly ActionOutcomeEnvelope[],
): ActionOutcomeTerminalIndex {
  const admitted: ActionOutcomeEnvelope[] = [];
  const replayCounts = new Map<string, number>();
  const issues: ActionOutcomeTerminalIndexIssue[] = [];

  for (const candidate of envelopes) {
    const decision = admitActionOutcomeEnvelope(admitted, candidate);
    const key = actionOutcomeTerminalKey(candidate.tenantId, candidate.actionId);

    if (decision.accepted) {
      if (decision.reason === "first_terminal_outcome") {
        admitted.push(candidate);
        replayCounts.set(key, 1);
      } else {
        replayCounts.set(key, (replayCounts.get(key) ?? 1) + 1);
      }
      continue;
    }
    if (
      decision.reason === "first_terminal_outcome" ||
      decision.reason === "idempotent_duplicate"
    ) {
      continue;
    }

    issues.push({
      code: decision.reason,
      key,
      tenantId: candidate.tenantId,
      actionId: candidate.actionId,
      candidate,
      ...(decision.incumbent !== undefined ? { incumbent: decision.incumbent } : {}),
      candidateHashValidation: decision.candidateHashValidation,
      ...(decision.incumbentHashValidation !== undefined
        ? { incumbentHashValidation: decision.incumbentHashValidation }
        : {}),
      message: decision.message,
    });
  }

  return {
    valid: issues.length === 0,
    entries: admitted.map((envelope) => {
      const key = actionOutcomeTerminalKey(envelope.tenantId, envelope.actionId);
      return {
        key,
        tenantId: envelope.tenantId,
        actionId: envelope.actionId,
        envelope,
        replayCount: replayCounts.get(key) ?? 1,
        substrateRefs: envelope.substrateRefs,
      };
    }),
    issues,
  };
}

export function recoverActionOutcomeBySubstrateRef(
  envelopes: readonly ActionOutcomeEnvelope[],
  ref: StateRef,
): ActionOutcomeEnvelope | undefined {
  return envelopes.find((envelope) =>
    envelope.substrateRefs.some((candidate) => sameStateRef(candidate, ref)),
  );
}

export function computeCurrentStateViewIdentityHash(
  view: CurrentStateView,
): string {
  const {
    replayCertificate: _replayCertificate,
    recoveryCut: _recoveryCut,
    ...viewWithoutReplayCertificate
  } = view;
  return fingerprint64(canonicalStringify(viewWithoutReplayCertificate));
}

export function computeProjectionReplayTransitionHistoryHash(
  transitionRefs: readonly ProjectionReplayTransitionRef[],
): string {
  return fingerprint64(canonicalStringify(transitionRefs));
}

export function computeProjectionReplayCertificateHash(
  certificate: Omit<ProjectionReplayCertificate, "certificateHash">,
): string {
  return fingerprint64(canonicalStringify(certificate));
}

export function verifyProjectionReplayCertificateHash(
  certificate: ProjectionReplayCertificate,
): StateReviewArtifactHashValidation {
  const { certificateHash, ...payload } = certificate;
  const expectedHash = computeProjectionReplayCertificateHash(payload);
  return {
    valid: certificateHash === expectedHash,
    expectedHash,
    actualHash: certificateHash,
  };
}

const replayableOperationalStateRecoverySources = new Set<
  OperationalStateRecoveryLaneSource
>([
  "admitted_transition_history",
  "admitted_projection_replay_certificate",
  "admitted_compaction_checkpoint",
  "admitted_checkpoint_admission",
  "admitted_pruning_admission",
  "admitted_pruning_tombstone",
  "admitted_required_head",
  "admitted_witness_ledger",
  "admitted_authority_history",
  "admitted_quorum_certificate_record",
  "current_admissible_projection",
]);

const privateOperationalStateRecoverySources = new Set<
  OperationalStateRecoveryLaneSource
>([
  "agent_memory",
  "connector_cache",
  "conversation_summary",
  "local_snapshot",
  "tool_output",
  "worktree_snapshot",
]);

function operationalStateRecoveryLaneHasHash(
  lane: OperationalStateRecoveryLane,
): boolean {
  return (
    lane.headHash !== undefined ||
    lane.historyHash !== undefined ||
    lane.projectionHash !== undefined ||
    lane.storeRootHash !== undefined ||
    lane.authorityHash !== undefined
  );
}

export function evaluateOperationalStateRecoveryCutAgainstPruningPolicy(
  input: OperationalStatePruningPolicyEvaluationInput,
): OperationalStatePruningPolicyEvaluation {
  const issues: OperationalStatePruningPolicyIssue[] = [];
  let checkedObligationCount = 0;
  let satisfiedObligationCount = 0;

  if (input.compilation === undefined) {
    return {
      valid: false,
      checkedObligationCount,
      satisfiedObligationCount,
      issues: [
        {
          code: "operational_state_pruning_policy_compilation_missing",
          path: "/pruningPolicy",
          message:
            "Recovered operational state cannot rely on a private pruning ladder when pruning-policy compliance is required.",
        },
      ],
    };
  }

  const { compilation } = input;
  if (!compilation.valid) {
    issues.push({
      code: "operational_state_pruning_policy_compilation_invalid",
      path: "/pruningPolicy",
      message:
        "Recovered operational state has an invalid pruning-policy compilation.",
      actual: compilation.issues.map((issue) => issue.code).join(","),
    });
  }

  if (
    input.transparencyEvaluation !== undefined &&
    !input.transparencyEvaluation.valid
  ) {
    issues.push({
      code: "operational_state_pruning_policy_transparency_invalid",
      path: "/recoveryTransparency",
      message:
        "Compiled pruning-policy obligations cite store roots that failed recovery transparency evaluation.",
      actual: input.transparencyEvaluation.issues
        .map((issue) => issue.code)
        .join(","),
    });
  }

  if (input.cut === undefined) {
    issues.push({
      code: "operational_state_pruning_policy_recovery_cut_missing",
      path: "/recoveryCut",
      message:
        "Compiled pruning-policy obligations cannot be satisfied without a recovery cut.",
    });
    return {
      valid: false,
      policyId: compilation.policyId,
      policyHash: compilation.policyHash,
      checkedObligationCount,
      satisfiedObligationCount,
      issues,
    };
  }

  const { cut } = input;
  if (cut.tenantId !== compilation.tenantId) {
    issues.push({
      code: "operational_state_pruning_policy_tenant_mismatch",
      path: "/recoveryCut/tenantId",
      message: `Operational state recovery cut tenant ${cut.tenantId} does not match pruning policy tenant ${compilation.tenantId}.`,
      expected: compilation.tenantId,
      actual: cut.tenantId,
    });
  }
  if (cut.authorityScope !== compilation.authorityScope) {
    issues.push({
      code: "operational_state_pruning_policy_authority_scope_mismatch",
      path: "/recoveryCut/authorityScope",
      message: `Operational state recovery cut authority scope ${cut.authorityScope} does not match pruning policy scope ${compilation.authorityScope}.`,
      expected: compilation.authorityScope,
      actual: cut.authorityScope,
    });
  }

  const lanesById = new Map<string, OperationalStateRecoveryLane>();
  cut.lanes.forEach((lane) => {
    lanesById.set(lane.laneId, lane);
  });

  compilation.obligations.forEach((obligation, index) => {
    checkedObligationCount += 1;
    const path = `/pruningPolicy/obligations/${index}`;
    const lane = lanesById.get(obligation.laneId);
    let obligationSatisfied = true;

    if (lane === undefined) {
      issues.push({
        code: "operational_state_pruning_policy_obligation_missing",
        path: `${path}/laneId`,
        message: `Recovery cut is missing compiled pruning-policy lane ${obligation.laneId}.`,
        actual: obligation.laneId,
      });
      return;
    }

    if (lane.laneKind !== obligation.laneKind) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_kind_mismatch",
        path: `${path}/laneKind`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires kind ${obligation.laneKind}, not ${lane.laneKind}.`,
        expected: obligation.laneKind,
        actual: lane.laneKind,
      });
    }
    if (lane.source !== obligation.source) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_source_mismatch",
        path: `${path}/source`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires source ${obligation.source}, not ${lane.source}.`,
        expected: obligation.source,
        actual: lane.source,
      });
    }
    if (lane.storeId !== obligation.storeId) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_store_id_mismatch",
        path: `${path}/storeId`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires store ${obligation.storeId}, not ${lane.storeId ?? "none"}.`,
        expected: obligation.storeId,
        actual: lane.storeId ?? "none",
      });
    }
    if (lane.required !== obligation.required) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_not_required",
        path: `${path}/required`,
        message: `Compiled pruning-policy lane ${obligation.laneId} must be required before it can support operational state.`,
        expected: "true",
        actual: String(lane.required),
      });
    }
    if (obligation.requiresHeadHash && lane.headHash === undefined) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_head_hash_missing",
        path: `${path}/headHash`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires a head hash.`,
      });
    }
    if (obligation.requiresHistoryHash && lane.historyHash === undefined) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_history_hash_missing",
        path: `${path}/historyHash`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires a history hash.`,
      });
    }
    if (obligation.requiresProjectionHash && lane.projectionHash === undefined) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_projection_hash_missing",
        path: `${path}/projectionHash`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires a projection hash.`,
      });
    }
    if (obligation.requiresAuthorityHash && lane.authorityHash === undefined) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_authority_hash_missing",
        path: `${path}/authorityHash`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires an authority hash.`,
      });
    }
    if (obligation.requiresStoreRootHash && lane.storeRootHash === undefined) {
      obligationSatisfied = false;
      issues.push({
        code: "operational_state_pruning_policy_lane_store_root_missing",
        path: `${path}/storeRootHash`,
        message: `Compiled pruning-policy lane ${obligation.laneId} requires a store-root hash.`,
      });
    }

    obligation.dependsOn.forEach((dependencyLaneId) => {
      const dependencyPresent = lane.dependencies.some(
        (dependency) => dependency.laneId === dependencyLaneId,
      );
      if (!dependencyPresent || !lanesById.has(dependencyLaneId)) {
        obligationSatisfied = false;
        issues.push({
          code: "operational_state_pruning_policy_dependency_missing",
          path: `${path}/dependsOn`,
          message: dependencyPresent
            ? `Compiled pruning-policy lane ${obligation.laneId} depends on missing required lane ${dependencyLaneId}.`
            : `Compiled pruning-policy lane ${obligation.laneId} does not depend on required lane ${dependencyLaneId}.`,
          expected: dependencyLaneId,
        });
      }
    });

    if (obligationSatisfied) satisfiedObligationCount += 1;
  });

  return {
    valid: issues.length === 0,
    policyId: compilation.policyId,
    policyHash: compilation.policyHash,
    checkedObligationCount,
    satisfiedObligationCount,
    issues,
  };
}

export function computeOperationalStatePrivacyPreservingPolicyProofHash(
  proof: Omit<
    OperationalStatePrivacyPreservingPolicyProof,
    "policyProofHash"
  >,
): string {
  return fingerprint64(canonicalStringify(proof));
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function pushOperationalStatePruningPolicyIssue(
  issues: OperationalStatePruningPolicyIssue[],
  issue: OperationalStatePruningPolicyIssue,
): void {
  issues.push(issue);
}

const operationalStatePrivacyPreservingPolicyProofAdapterClaimAllowlist =
  new Set([
    "policy_predicate_satisfied",
    "credential_commitment_verified",
    "credential_not_revoked",
    "proof_challenge_bound",
  ]);

function operationalStatePolicyProofFieldIsMissing(value: string): boolean {
  return value.trim().length === 0;
}

export function evaluateOperationalStatePruningPolicyAdmission(
  input: OperationalStatePruningPolicyAdmissionEvaluationInput,
): OperationalStatePruningPolicyAdmissionEvaluation {
  const issues: OperationalStatePruningPolicyIssue[] = [];

  if (input.compilation === undefined) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_required_policy_missing",
      path: "/pruningPolicy",
      message:
        "Operational state cannot prove pruning-policy admission without a compiled policy artifact.",
    });
    return {
      valid: false,
      accepted: false,
      ...(input.admissionReplay !== undefined
        ? { admissionReplay: input.admissionReplay }
        : {}),
      ...(input.admissionWitnessReplay !== undefined
        ? { admissionWitnessReplay: input.admissionWitnessReplay }
        : {}),
      issues,
    };
  }

  if (input.admissionReplay === undefined) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_replay_missing",
      path: "/pruningPolicyAdmission",
      message:
        "Compiled pruning policy cannot authorize operational recovery without replay of durable policy-admission records.",
    });
    return {
      valid: false,
      accepted: false,
      policyId: input.compilation.policyId,
      policyHash: input.compilation.policyHash,
      ...(input.admissionWitnessReplay !== undefined
        ? { admissionWitnessReplay: input.admissionWitnessReplay }
        : {}),
      issues,
    };
  }

  if (!input.admissionReplay.valid) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_replay_invalid",
      path: "/pruningPolicyAdmission",
      message:
        "Compiled pruning policy has an invalid policy-admission replay.",
      actual: input.admissionReplay.issues
        .map((issue) => issue.code)
        .join(","),
    });
  }

  const latestAdmittedRecord = input.admissionReplay.latestAdmittedRecord;
  if (latestAdmittedRecord === undefined) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_policy_not_admitted",
      path: "/pruningPolicyAdmission/records",
      message:
        "Compiled pruning policy is not present in the latest replayed policy-admission history.",
    });
  } else if (latestAdmittedRecord.policyHash !== input.compilation.policyHash) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_policy_stale",
      path: "/pruningPolicy/policyHash",
      message:
        "Compiled pruning policy is stale relative to the latest admitted policy artifact.",
      expected: latestAdmittedRecord.policyHash,
      actual: input.compilation.policyHash,
    });
  }

  if (
    latestAdmittedRecord !== undefined &&
    latestAdmittedRecord.policyId !== input.compilation.policyId
  ) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_policy_not_admitted",
      path: "/pruningPolicy/policyId",
      message:
        "Compiled pruning policy id does not match the latest admitted policy artifact.",
      expected: latestAdmittedRecord.policyId,
      actual: input.compilation.policyId,
    });
  }

  const privacyPreservingPolicyProof = input.privacyPreservingPolicyProof;
  if (
    input.requirePrivacyPreservingPolicyProof === true ||
    privacyPreservingPolicyProof !== undefined
  ) {
    if (privacyPreservingPolicyProof === undefined) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_privacy_proof_missing",
        path: "/pruningPolicyAdmission/privacyPreservingPolicyProof",
        message:
          "Compiled pruning policy requires a replayable privacy-preserving policy proof before it can authorize operational state.",
      });
    } else {
      const { policyProofHash, ...privacyProofPayload } =
        privacyPreservingPolicyProof;
      const expectedPolicyProofHash =
        computeOperationalStatePrivacyPreservingPolicyProofHash(
          privacyProofPayload,
        );
      if (policyProofHash !== expectedPolicyProofHash) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_hash_mismatch",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/policyProofHash",
          message:
            "Privacy-preserving policy proof hash does not match its replayable proof payload.",
          expected: expectedPolicyProofHash,
          actual: policyProofHash,
        });
      }
      if (privacyPreservingPolicyProof.result !== "valid") {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_invalid",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/result",
          message:
            "Privacy-preserving policy proof cannot authorize policy admission unless its verifier result is valid.",
          expected: "valid",
          actual: privacyPreservingPolicyProof.result,
        });
      }
      if (
        privacyPreservingPolicyProof.tenantId !== input.compilation.tenantId
      ) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_tenant_mismatch",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/tenantId",
          message:
            "Privacy-preserving policy proof tenant does not match the compiled policy tenant.",
          expected: input.compilation.tenantId,
          actual: privacyPreservingPolicyProof.tenantId,
        });
      }
      if (
        privacyPreservingPolicyProof.authorityScope !==
        input.compilation.authorityScope
      ) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_scope_mismatch",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/authorityScope",
          message:
            "Privacy-preserving policy proof authority scope does not match the compiled policy scope.",
          expected: input.compilation.authorityScope,
          actual: privacyPreservingPolicyProof.authorityScope,
        });
      }
      if (
        privacyPreservingPolicyProof.policyId !== input.compilation.policyId ||
        privacyPreservingPolicyProof.policyHash !==
          input.compilation.policyHash
      ) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_policy_mismatch",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/policyHash",
          message:
            "Privacy-preserving policy proof does not bind to the compiled pruning policy.",
          expected: input.compilation.policyHash,
          actual: privacyPreservingPolicyProof.policyHash,
        });
      }
      if (
        latestAdmittedRecord !== undefined &&
        (privacyPreservingPolicyProof.policyStoreId !==
          latestAdmittedRecord.policyStoreId ||
          privacyPreservingPolicyProof.subjectKind !==
            OPERATIONAL_STATE_PRUNING_POLICY_ADMISSION_RECORD_SUBJECT_KIND ||
          privacyPreservingPolicyProof.subjectId !==
            latestAdmittedRecord.policyStoreId ||
          privacyPreservingPolicyProof.subjectSequence !==
            latestAdmittedRecord.policySequence ||
          privacyPreservingPolicyProof.subjectHash !==
            latestAdmittedRecord.policyRecordHash ||
          privacyPreservingPolicyProof.policyRecordHash !==
            latestAdmittedRecord.policyRecordHash ||
          privacyPreservingPolicyProof.policyId !==
            latestAdmittedRecord.policyId ||
          privacyPreservingPolicyProof.policyHash !==
            latestAdmittedRecord.policyHash)
      ) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_subject_mismatch",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/subjectHash",
          message:
            "Privacy-preserving policy proof does not bind to the latest replayed policy-admission record.",
          expected: latestAdmittedRecord.policyRecordHash,
          actual: privacyPreservingPolicyProof.subjectHash,
        });
      }
      if (
        (input.allowedPrivacyPreservingPolicyProofVerifierIds?.length ?? 0) >
          0 &&
        !input.allowedPrivacyPreservingPolicyProofVerifierIds?.includes(
          privacyPreservingPolicyProof.verifierId,
        )
      ) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_verifier_not_allowed",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/verifierId",
          message:
            "Privacy-preserving policy proof was produced by a verifier outside the allowed policy-authority set.",
          expected:
            input.allowedPrivacyPreservingPolicyProofVerifierIds?.join(",") ??
            "",
          actual: privacyPreservingPolicyProof.verifierId,
        });
      }
      if (privacyPreservingPolicyProof.privateInputRefs.length > 0) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_private_input_disclosed",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/privateInputRefs",
          message:
            "Privacy-preserving policy proof cannot disclose private witness or delegation material into operational state.",
          actual: privacyPreservingPolicyProof.privateInputRefs.join(","),
        });
      }
      const missingProofField = [
        [
          "verificationKeyHash",
          privacyPreservingPolicyProof.verificationKeyHash,
        ],
        [
          "publicStatementHash",
          privacyPreservingPolicyProof.publicStatementHash,
        ],
        [
          "predicateCommitmentHash",
          privacyPreservingPolicyProof.predicateCommitmentHash,
        ],
        [
          "hiddenWitnessCommitmentHash",
          privacyPreservingPolicyProof.hiddenWitnessCommitmentHash,
        ],
        ["proofTranscriptHash", privacyPreservingPolicyProof.proofTranscriptHash],
        ["challengeNonce", privacyPreservingPolicyProof.challengeNonce],
      ].find(([, value]) =>
        operationalStatePolicyProofFieldIsMissing(String(value)),
      );
      if (missingProofField !== undefined) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_statement_missing",
          path: `/pruningPolicyAdmission/privacyPreservingPolicyProof/${missingProofField[0]}`,
          message:
            "Privacy-preserving policy proof must carry replayable verifier material, public statement, hidden-witness commitment, transcript, and challenge.",
        });
      }
      const claimOverreach =
        privacyPreservingPolicyProof.adapterClaims.find(
          (claim) =>
            !operationalStatePrivacyPreservingPolicyProofAdapterClaimAllowlist.has(
              claim,
            ),
        );
      if (claimOverreach !== undefined) {
        pushOperationalStatePruningPolicyIssue(issues, {
          code: "operational_state_pruning_policy_privacy_proof_claim_overreach",
          path: "/pruningPolicyAdmission/privacyPreservingPolicyProof/adapterClaims",
          message:
            "Privacy-preserving policy proof adapter claims may prove only credential predicates, not operational authority, currentness, or admission.",
          actual: claimOverreach,
        });
      }
    }
  }

  const admissionWitnessReplay = input.admissionWitnessReplay;
  const latestWitnessRecord =
    admissionWitnessReplay?.requiredAdmissionWitnessRecord;
  if (
    input.requireAdmissionWitnessQuorum === true ||
    input.requireAdmissionWitnessAuthorityTopology === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
      true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
      true
  ) {
    if (admissionWitnessReplay === undefined) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_admission_witness_replay_missing",
        path: "/pruningPolicyAdmissionWitness",
        message:
          "Compiled pruning policy requires replay of witness-certified policy-admission records.",
      });
    } else if (!admissionWitnessReplay.valid) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_admission_witness_replay_invalid",
        path: "/pruningPolicyAdmissionWitness",
        message:
          "Compiled pruning policy has an invalid policy-admission witness replay.",
        actual: admissionWitnessReplay.issues
          .map((issue) => issue.code)
          .join(","),
      });
    } else if (
      latestAdmittedRecord === undefined ||
      latestWitnessRecord === undefined ||
      latestWitnessRecord.policyRecordHash !==
        latestAdmittedRecord.policyRecordHash
    ) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_admission_latest_record_not_witnessed",
        path: "/pruningPolicyAdmissionWitness",
        message:
          "Latest pruning-policy admission record is not witnessed by the replayed policy-admission witness quorum.",
        expected: latestAdmittedRecord?.policyRecordHash ?? "none",
        actual: latestWitnessRecord?.policyRecordHash ?? "none",
      });
    }
  }
  if (
    (input.requireAdmissionWitnessAuthorityTopology === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTopology === undefined
  ) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_admission_witness_authority_topology_missing",
      path: "/pruningPolicyAdmissionWitness/witnessAuthorityTopology",
      message:
        "Compiled pruning policy requires policy-admission witness replay to bind certificates to replayed witness authority topology.",
    });
  }
  if (
    (input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay ===
      undefined
  ) {
    pushOperationalStatePruningPolicyIssue(issues, {
      code: "operational_state_pruning_policy_aw_authority_transition_replay_missing",
      path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay",
      message:
        "Compiled pruning policy requires policy-admission witness authority topology to come from admitted authority-transition history.",
    });
  }
  if (
    (input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
      undefined
  ) {
    const admissionTransitionWitnessReplay =
      admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .admissionWitnessReplay;
    if (admissionTransitionWitnessReplay === undefined) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_replay_missing",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Compiled pruning policy requires policy-admission witness authority-transition admission records to be witnessed.",
      });
    } else if (!admissionTransitionWitnessReplay.valid) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_replay_invalid",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Compiled pruning policy cannot consume invalid policy-admission witness authority-transition admission witness history.",
        actual: admissionTransitionWitnessReplay.issues
          .map((issue) => issue.code)
          .join(","),
      });
    } else if (
      (input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
        input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
          true) &&
      admissionTransitionWitnessReplay.witnessAuthorityTopology === undefined
    ) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_authority_topology_missing",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTopology",
        message:
          "Compiled pruning policy requires policy-admission witness authority-transition admission witness certificates to bind to replayed witness authority topology.",
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay ===
        undefined
    ) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_replay_missing",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Compiled pruning policy requires policy-admission witness authority-transition admission witness authority topology to replay from admitted authority-transition history.",
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      !admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .valid
    ) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_replay_invalid",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Compiled pruning policy cannot consume invalid nested policy-admission witness authority-transition admission witness authority history.",
        actual:
          admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay.issues
            .map((issue) => issue.code)
            .join(","),
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTopology !== undefined &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      (admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .latestAdmittedTopology === undefined ||
        !operationalStateAuthorityTopologiesMatch(
          admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
            .latestAdmittedTopology,
          admissionTransitionWitnessReplay.witnessAuthorityTopology,
        ))
    ) {
      pushOperationalStatePruningPolicyIssue(issues, {
        code: "operational_state_pruning_policy_aw_authority_transition_witness_authority_transition_admission_topology_mismatch",
        path: "/pruningPolicyAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay/latestAdmittedTopology",
        message:
          "Compiled pruning policy requires policy-admission witness authority-transition admission witness authority topology to be recovered from admitted authority-transition history.",
        expected:
          admissionTransitionWitnessReplay.witnessAuthorityTopology.topologyHash,
        actual:
          admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
            .latestAdmittedTopology?.topologyHash ?? "none",
      });
    }
  }

  return {
    valid: issues.length === 0,
    accepted: issues.length === 0,
    policyId: input.compilation.policyId,
    policyHash: input.compilation.policyHash,
    admissionReplay: input.admissionReplay,
    ...(admissionWitnessReplay !== undefined ? { admissionWitnessReplay } : {}),
    ...(privacyPreservingPolicyProof !== undefined
      ? { privacyPreservingPolicyProof }
      : {}),
    ...(latestAdmittedRecord !== undefined ? { latestAdmittedRecord } : {}),
    ...(latestWitnessRecord !== undefined ? { latestWitnessRecord } : {}),
    issues,
  };
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function operationalStateUniqueSortedStringList(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function operationalStateIntersectStringLists(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  const rightSet = new Set(right);
  return operationalStateUniqueSortedStringList(
    left.filter((value) => rightSet.has(value)),
  );
}

export function computeOperationalStateQuorumCertificateProofCertificateHash(
  certificate: Omit<
    OperationalStateQuorumCertificateProofCertificate,
    "quorumCertificateHash"
  >,
): string {
  return fingerprint64(canonicalStringify(certificate));
}

export function verifyOperationalStateQuorumCertificateProofCertificateHash(
  certificate: OperationalStateQuorumCertificateProofCertificate,
): StateReviewArtifactHashValidation {
  const { quorumCertificateHash, ...payload } = certificate;
  const expectedHash =
    computeOperationalStateQuorumCertificateProofCertificateHash(payload);
  return {
    valid: quorumCertificateHash === expectedHash,
    expectedHash,
    actualHash: quorumCertificateHash,
  };
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function sortOperationalStateCompositionalQuorumClaims(
  claims: readonly OperationalStateCompositionalQuorumClaim[],
): readonly OperationalStateCompositionalQuorumClaim[] {
  return [...claims].sort((left, right) => {
    const byClaimId = left.claimId.localeCompare(right.claimId);
    if (byClaimId !== 0) return byClaimId;
    const byTopologyId = left.topologyId.localeCompare(right.topologyId);
    if (byTopologyId !== 0) return byTopologyId;
    return left.quorumCertificateHash.localeCompare(right.quorumCertificateHash);
  });
}

function activeOperationalStateAuthorityPrincipalIds(
  topology: OperationalStateAuthorityTopology,
): readonly string[] {
  return operationalStateUniqueSortedStringList(
    topology.principals
      .filter((principal) => principal.status === "active")
      .map((principal) => principal.principalId),
  );
}

function activeAcceptedWitnessIdsForCompositionalQuorumClaim(
  claim: OperationalStateCompositionalQuorumClaim,
): readonly string[] {
  const activePrincipalIds = new Set(
    activeOperationalStateAuthorityPrincipalIds(claim.authorityTopology),
  );
  return operationalStateUniqueSortedStringList(
    claim.quorumCertificate.acceptedWitnessIds.filter((witnessId) =>
      activePrincipalIds.has(witnessId),
    ),
  );
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function computeOperationalStateCompositionalQuorumPairwiseIntersections(
  claims: readonly OperationalStateCompositionalQuorumClaim[],
): readonly OperationalStateCompositionalQuorumPairwiseIntersection[] {
  const sortedClaims = sortOperationalStateCompositionalQuorumClaims(claims);
  const intersections: OperationalStateCompositionalQuorumPairwiseIntersection[] =
    [];
  for (let leftIndex = 0; leftIndex < sortedClaims.length; leftIndex += 1) {
    const left = sortedClaims[leftIndex]!;
    const leftAccepted =
      activeAcceptedWitnessIdsForCompositionalQuorumClaim(left);
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedClaims.length;
      rightIndex += 1
    ) {
      const right = sortedClaims[rightIndex]!;
      const rightAccepted =
        activeAcceptedWitnessIdsForCompositionalQuorumClaim(right);
      const activeIntersectionWitnessIds = operationalStateIntersectStringLists(
        leftAccepted,
        rightAccepted,
      );
      intersections.push({
        leftClaimId: left.claimId,
        rightClaimId: right.claimId,
        activeIntersectionWitnessIds,
        intersectionSize: activeIntersectionWitnessIds.length,
      });
    }
  }
  return intersections;
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function computeOperationalStateCompositionalQuorumGlobalIntersectionWitnessIds(
  claims: readonly OperationalStateCompositionalQuorumClaim[],
): readonly string[] {
  const sortedClaims = sortOperationalStateCompositionalQuorumClaims(claims);
  if (sortedClaims.length === 0) return [];
  let intersection =
    activeAcceptedWitnessIdsForCompositionalQuorumClaim(sortedClaims[0]!);
  for (const claim of sortedClaims.slice(1)) {
    intersection = operationalStateIntersectStringLists(
      intersection,
      activeAcceptedWitnessIdsForCompositionalQuorumClaim(claim),
    );
  }
  return operationalStateUniqueSortedStringList(intersection);
}

export function computeOperationalStateCompositionalQuorumIntersectionProofHash(
  proof: Omit<
    OperationalStateCompositionalQuorumIntersectionProof,
    "proofHash"
  >,
): string {
  return fingerprint64(canonicalStringify(proof));
}

export function verifyOperationalStateCompositionalQuorumIntersectionProofHash(
  proof: OperationalStateCompositionalQuorumIntersectionProof,
): StateReviewArtifactHashValidation {
  const { proofHash, ...payload } = proof;
  const expectedHash =
    computeOperationalStateCompositionalQuorumIntersectionProofHash(payload);
  return {
    valid: proofHash === expectedHash,
    expectedHash,
    actualHash: proofHash,
  };
}

function pushOperationalStateCompositionalQuorumIntersectionIssue(
  issues: OperationalStateCompositionalQuorumIntersectionIssue[],
  issue: OperationalStateCompositionalQuorumIntersectionIssue,
): void {
  issues.push(issue);
}

export function evaluateOperationalStateCompositionalQuorumIntersectionProof(
  input: OperationalStateCompositionalQuorumIntersectionProofEvaluationInput,
): OperationalStateCompositionalQuorumIntersectionProofEvaluation {
  const issues: OperationalStateCompositionalQuorumIntersectionIssue[] = [];
  const proof = input.proof;
  if (proof === undefined) {
    return {
      valid: false,
      accepted: false,
      claimCount: 0,
      pairwiseIntersections: [],
      globalIntersectionWitnessIds: [],
      issues: [
        {
          code: "operational_state_compositional_quorum_intersection_proof_missing",
          path: "/proof",
          message:
            "Operational state composition requires an admitted quorum-intersection proof before independently certified authority histories can compose.",
        },
      ],
    };
  }

  const proofHashValidation =
    verifyOperationalStateCompositionalQuorumIntersectionProofHash(proof);
  if (!proofHashValidation.valid) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_proof_hash_mismatch",
      path: "/proof/proofHash",
      message: `Compositional quorum-intersection proof hash ${proofHashValidation.actualHash} does not match recomputed hash ${proofHashValidation.expectedHash}.`,
      expected: proofHashValidation.expectedHash,
      actual: proofHashValidation.actualHash,
    });
  }

  if (
    input.expectedTenantId !== undefined &&
    proof.tenantId !== tenantId(String(input.expectedTenantId))
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_tenant_mismatch",
      path: "/proof/tenantId",
      message:
        "Compositional quorum-intersection proof tenant does not match the expected operational state tenant.",
      expected: String(input.expectedTenantId),
      actual: proof.tenantId,
    });
  }
  if (
    input.expectedAuthorityScope !== undefined &&
    proof.authorityScope !== input.expectedAuthorityScope
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_scope_mismatch",
      path: "/proof/authorityScope",
      message:
        "Compositional quorum-intersection proof authority scope does not match the expected recovery authority scope.",
      expected: input.expectedAuthorityScope,
      actual: proof.authorityScope,
    });
  }
  if (
    (input.expectedSubjectKind !== undefined &&
      proof.subjectKind !== input.expectedSubjectKind) ||
    (input.expectedSubjectId !== undefined &&
      proof.subjectId !== input.expectedSubjectId) ||
    (input.expectedSubjectSequence !== undefined &&
      proof.subjectSequence !== input.expectedSubjectSequence) ||
    (input.expectedSubjectHash !== undefined &&
      proof.subjectHash !== input.expectedSubjectHash)
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_subject_mismatch",
      path: "/proof/subject",
      message:
        "Compositional quorum-intersection proof does not bind to the expected operational state subject.",
      ...(input.expectedSubjectHash !== undefined ||
      input.expectedSubjectId !== undefined
        ? { expected: input.expectedSubjectHash ?? input.expectedSubjectId }
        : {}),
      actual: proof.subjectHash,
    });
  }

  const requiredIntersectionWitnesses =
    input.requiredIntersectionWitnesses ?? proof.requiredIntersectionWitnesses;
  if (
    proof.requiredIntersectionWitnesses < 1 ||
    requiredIntersectionWitnesses < 1
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_required_intersection_invalid",
      path: "/proof/requiredIntersectionWitnesses",
      message:
        "Compositional quorum-intersection proof must require at least one active shared witness.",
      expected: 1,
      actual: proof.requiredIntersectionWitnesses,
    });
  }

  if (proof.claims.length < 2) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_claim_count_insufficient",
      path: "/proof/claims",
      message:
        "Compositional quorum-intersection proof needs at least two authority claims to prove composition.",
      expected: 2,
      actual: proof.claims.length,
    });
  }

  const seenClaimIds = new Set<string>();
  proof.claims.forEach((claim, claimIndex) => {
    const path = `/proof/claims/${claimIndex}`;
    if (seenClaimIds.has(claim.claimId)) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_claim_duplicate",
        path: `${path}/claimId`,
        message: `Compositional quorum claim ${claim.claimId} appears more than once.`,
        actual: claim.claimId,
      });
    }
    seenClaimIds.add(claim.claimId);

    const topologyHashValidation = verifyOperationalStateAuthorityTopologyHash(
      claim.authorityTopology,
    );
    if (
      !topologyHashValidation.valid ||
      claim.authorityTopologyHash !== claim.authorityTopology.topologyHash
    ) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_topology_hash_mismatch",
        path: `${path}/authorityTopologyHash`,
        message:
          "Compositional quorum claim must hash-bind the embedded authority topology.",
        expected: topologyHashValidation.expectedHash,
        actual: claim.authorityTopologyHash,
      });
    }
    if (claim.authorityTopology.tenantId !== proof.tenantId) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_topology_tenant_mismatch",
        path: `${path}/authorityTopology/tenantId`,
        message:
          "Compositional quorum claim topology tenant does not match proof tenant.",
        expected: proof.tenantId,
        actual: claim.authorityTopology.tenantId,
      });
    }
    if (claim.authorityTopology.authorityScope !== proof.authorityScope) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_topology_scope_mismatch",
        path: `${path}/authorityTopology/authorityScope`,
        message:
          "Compositional quorum claim topology scope does not match proof authority scope.",
        expected: proof.authorityScope,
        actual: claim.authorityTopology.authorityScope,
      });
    }
    if (claim.authorityTopology.topologyId !== claim.topologyId) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_topology_id_mismatch",
        path: `${path}/topologyId`,
        message:
          "Compositional quorum claim topology id does not match embedded topology.",
        expected: claim.authorityTopology.topologyId,
        actual: claim.topologyId,
      });
    }

    const certificateHashValidation =
      verifyOperationalStateQuorumCertificateProofCertificateHash(
        claim.quorumCertificate,
      );
    if (
      !certificateHashValidation.valid ||
      claim.quorumCertificateHash !==
        claim.quorumCertificate.quorumCertificateHash
    ) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_hash_mismatch",
        path: `${path}/quorumCertificateHash`,
        message:
          "Compositional quorum claim must hash-bind the embedded quorum certificate.",
        expected: certificateHashValidation.expectedHash,
        actual: claim.quorumCertificateHash,
      });
    }
    if (
      !claim.quorumCertificate.certified ||
      claim.quorumCertificate.status !== "certified"
    ) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_not_certified",
        path: `${path}/quorumCertificate/status`,
        message:
          "Compositional quorum claim cannot compose a non-certified quorum certificate.",
        expected: "certified",
        actual: claim.quorumCertificate.status,
      });
    }

    const acceptedWitnessIds = claim.quorumCertificate.acceptedWitnessIds;
    const uniqueAcceptedWitnessIds =
      operationalStateUniqueSortedStringList(acceptedWitnessIds);
    if (uniqueAcceptedWitnessIds.length !== acceptedWitnessIds.length) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_duplicate_witness",
        path: `${path}/quorumCertificate/acceptedWitnessIds`,
        message:
          "Compositional quorum claim certificate cannot count duplicate witness ids toward authority.",
        expected: uniqueAcceptedWitnessIds.length,
        actual: acceptedWitnessIds.length,
      });
    }
    const minimumRequiredWitnesses = Math.max(
      claim.quorumCertificate.requiredWitnesses,
      claim.quorumCertificate.minimumWitnesses,
    );
    if (uniqueAcceptedWitnessIds.length < minimumRequiredWitnesses) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_quorum_not_met",
        path: `${path}/quorumCertificate/acceptedWitnessIds`,
        message:
          "Compositional quorum claim certificate does not satisfy its witness quorum with unique accepted witnesses.",
        expected: minimumRequiredWitnesses,
        actual: uniqueAcceptedWitnessIds.length,
      });
    }
    if (claim.quorumCertificate.tenantId !== proof.tenantId) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_tenant_mismatch",
        path: `${path}/quorumCertificate/tenantId`,
        message:
          "Compositional quorum claim certificate tenant does not match proof tenant.",
        expected: proof.tenantId,
        actual: claim.quorumCertificate.tenantId,
      });
    }
    if (
      claim.quorumCertificate.authorityScope !== proof.authorityScope ||
      claim.authorityScope !== proof.authorityScope
    ) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_scope_mismatch",
        path: `${path}/quorumCertificate/authorityScope`,
        message:
          "Compositional quorum claim certificate scope does not match proof authority scope.",
        expected: proof.authorityScope,
        actual: claim.quorumCertificate.authorityScope,
      });
    }
    if (claim.quorumCertificate.authorityBoundary !== claim.authorityBoundary) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_boundary_mismatch",
        path: `${path}/quorumCertificate/authorityBoundary`,
        message:
          "Compositional quorum claim certificate boundary does not match the claimed authority boundary.",
        expected: claim.authorityBoundary,
        actual: claim.quorumCertificate.authorityBoundary,
      });
    }
    if (
      claim.quorumCertificate.authorityTopologyHash !==
      claim.authorityTopology.topologyHash
    ) {
      pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
        code: "operational_state_compositional_quorum_intersection_certificate_topology_mismatch",
        path: `${path}/quorumCertificate/authorityTopologyHash`,
        message:
          "Compositional quorum claim certificate must bind to the embedded authority topology hash.",
        expected: claim.authorityTopology.topologyHash,
        actual: claim.quorumCertificate.authorityTopologyHash ?? "none",
      });
    }

    const principalsById = new Map(
      claim.authorityTopology.principals.map((principal) => [
        principal.principalId,
        principal,
      ]),
    );
    uniqueAcceptedWitnessIds.forEach((witnessId, witnessIndex) => {
      const principal = principalsById.get(witnessId);
      if (principal === undefined) {
        pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
          code: "operational_state_compositional_quorum_intersection_witness_unknown",
          path: `${path}/quorumCertificate/acceptedWitnessIds/${witnessIndex}`,
          message:
            "Compositional quorum claim certificate names a witness outside the embedded authority topology.",
          actual: witnessId,
        });
        return;
      }
      if (principal.status !== "active") {
        pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
          code: "operational_state_compositional_quorum_intersection_witness_not_active",
          path: `${path}/quorumCertificate/acceptedWitnessIds/${witnessIndex}`,
          message:
            "Compositional quorum claim certificate names a witness that is not active in the embedded authority topology.",
          expected: "active",
          actual: principal.status,
        });
      }
    });
  });

  const recomputedPairwiseIntersections =
    computeOperationalStateCompositionalQuorumPairwiseIntersections(
      proof.claims,
    );
  const recomputedGlobalIntersectionWitnessIds =
    computeOperationalStateCompositionalQuorumGlobalIntersectionWitnessIds(
      proof.claims,
    );
  if (
    canonicalStringify(proof.pairwiseIntersections) !==
    canonicalStringify(recomputedPairwiseIntersections)
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_pairwise_intersection_mismatch",
      path: "/proof/pairwiseIntersections",
      message:
        "Compositional quorum-intersection proof pairwise intersections do not replay from embedded claims.",
    });
  }
  if (
    canonicalStringify(proof.globalIntersectionWitnessIds) !==
    canonicalStringify(recomputedGlobalIntersectionWitnessIds)
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_global_intersection_mismatch",
      path: "/proof/globalIntersectionWitnessIds",
      message:
        "Compositional quorum-intersection proof global intersection does not replay from embedded claims.",
    });
  }

  if (proof.intersectionMode === "pairwise_active_intersection") {
    recomputedPairwiseIntersections.forEach((intersection, index) => {
      if (intersection.intersectionSize < requiredIntersectionWitnesses) {
        pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
          code: "operational_state_compositional_quorum_intersection_pairwise_missing",
          path: `/proof/pairwiseIntersections/${index}/activeIntersectionWitnessIds`,
          message:
            "Compositional quorum-intersection proof lacks enough active shared witnesses for a pair of authority claims.",
          expected: requiredIntersectionWitnesses,
          actual: intersection.intersectionSize,
        });
      }
    });
  } else if (
    recomputedGlobalIntersectionWitnessIds.length < requiredIntersectionWitnesses
  ) {
    pushOperationalStateCompositionalQuorumIntersectionIssue(issues, {
      code: "operational_state_compositional_quorum_intersection_global_missing",
      path: "/proof/globalIntersectionWitnessIds",
      message:
        "Compositional quorum-intersection proof lacks enough active witnesses shared by all authority claims.",
      expected: requiredIntersectionWitnesses,
      actual: recomputedGlobalIntersectionWitnessIds.length,
    });
  }

  return {
    valid: issues.length === 0,
    accepted: issues.length === 0,
    proofId: proof.proofId,
    proofHash: proof.proofHash,
    claimCount: proof.claims.length,
    pairwiseIntersections: recomputedPairwiseIntersections,
    globalIntersectionWitnessIds: recomputedGlobalIntersectionWitnessIds,
    issues,
  };
}

export function computeOperationalStateAuthorityTopologyHash(
  topology: Omit<OperationalStateAuthorityTopology, "topologyHash">,
): string {
  return fingerprint64(canonicalStringify(topology));
}

export function verifyOperationalStateAuthorityTopologyHash(
  topology: OperationalStateAuthorityTopology,
): StateReviewArtifactHashValidation {
  const { topologyHash, ...payload } = topology;
  const expectedHash = computeOperationalStateAuthorityTopologyHash({
    ...payload,
    principals: [...payload.principals].sort((left, right) =>
      left.principalId.localeCompare(right.principalId),
    ),
  });
  return {
    valid: topologyHash === expectedHash,
    expectedHash,
    actualHash: topologyHash,
  };
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function operationalStateAuthorityTopologiesMatch(
  left: OperationalStateAuthorityTopology,
  right: OperationalStateAuthorityTopology,
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.topologyId === right.topologyId &&
    left.authorityScope === right.authorityScope &&
    left.authoritySequence === right.authoritySequence &&
    left.authorityRecordHash === right.authorityRecordHash &&
    left.topologyHash === right.topologyHash
  );
}

export function computeOperationalStateRecoveryCutHash(
  cut: Omit<OperationalStateRecoveryCut, "cutHash">,
): string {
  return fingerprint64(canonicalStringify(cut));
}

export function verifyOperationalStateRecoveryCutHash(
  cut: OperationalStateRecoveryCut,
): StateReviewArtifactHashValidation {
  const { cutHash, ...payload } = cut;
  const expectedHash = computeOperationalStateRecoveryCutHash(payload);
  return {
    valid: cutHash === expectedHash,
    expectedHash,
    actualHash: cutHash,
  };
}

export function evaluateOperationalStateRecoveryCut(
  view: CurrentStateView,
  options: OperationalStateRecoveryCutEvaluationOptions = {},
): OperationalStateRecoveryCutEvaluation {
  const cut = view.recoveryCut;
  if (cut === undefined) {
    return {
      valid: false,
      replayableLaneCount: 0,
      requiredLaneCount: 0,
      projectionLaneCount: 0,
      excludedPrivateLaneCount: 0,
      issues: [
        {
          code: "operational_state_recovery_cut_missing",
          path: "/recoveryCut",
          message:
            "CurrentStateView cannot authorize recovered operational state without a recovery cut when recovery proof is required.",
        },
      ],
    };
  }
  return evaluateOperationalStateRecoveryCutAgainstView(cut, view, options);
}

export function evaluateOperationalStateRecoveryCutAgainstView(
  cut: OperationalStateRecoveryCut,
  view: CurrentStateView,
  options: OperationalStateRecoveryCutEvaluationOptions = {},
): OperationalStateRecoveryCutEvaluation {
  const issues: OperationalStateRecoveryCutIssue[] = [];
  const hashValidation = verifyOperationalStateRecoveryCutHash(cut);
  const lanesById = new Map<string, OperationalStateRecoveryLane>();
  const seenLaneIds = new Set<string>();
  let replayableLaneCount = 0;
  let requiredLaneCount = 0;
  let projectionLaneCount = 0;
  let excludedPrivateLaneCount = 0;

  if (!hashValidation.valid) {
    issues.push({
      code: "operational_state_recovery_cut_hash_mismatch",
      path: "/recoveryCut/cutHash",
      message: `Operational state recovery cut hash ${hashValidation.actualHash} does not match recomputed hash ${hashValidation.expectedHash}.`,
      expected: hashValidation.expectedHash,
      actual: hashValidation.actualHash,
    });
  }
  if (cut.tenantId !== view.tenantId) {
    issues.push({
      code: "operational_state_recovery_tenant_mismatch",
      path: "/recoveryCut/tenantId",
      message: `Operational state recovery cut tenant ${cut.tenantId} does not match current state view tenant ${view.tenantId}.`,
      expected: view.tenantId,
      actual: cut.tenantId,
    });
  }
  if (canonicalStringify(cut.subject) !== canonicalStringify(view.subject)) {
    issues.push({
      code: "operational_state_recovery_subject_mismatch",
      path: "/recoveryCut/subject",
      message:
        "Operational state recovery cut subject does not match current state view subject.",
    });
  }
  if (
    options.expectedAuthorityScope !== undefined &&
    cut.authorityScope !== options.expectedAuthorityScope
  ) {
    issues.push({
      code: "operational_state_recovery_authority_scope_mismatch",
      path: "/recoveryCut/authorityScope",
      message: `Operational state recovery cut authority scope ${cut.authorityScope} does not match expected scope ${options.expectedAuthorityScope}.`,
      expected: options.expectedAuthorityScope,
      actual: cut.authorityScope,
    });
  }
  if (cut.lanes.length === 0) {
    issues.push({
      code: "operational_state_recovery_lane_missing",
      path: "/recoveryCut/lanes",
      message:
        "Operational state recovery cut has no lanes, so recovered state would rely on unstated representation.",
    });
  }

  cut.lanes.forEach((lane, index) => {
    const path = `/recoveryCut/lanes/${index}`;
    if (seenLaneIds.has(lane.laneId)) {
      issues.push({
        code: "operational_state_recovery_lane_duplicate",
        path: `${path}/laneId`,
        message: `Operational state recovery lane ${lane.laneId} appears more than once.`,
        actual: lane.laneId,
      });
    } else {
      seenLaneIds.add(lane.laneId);
      lanesById.set(lane.laneId, lane);
    }

    if (lane.required) requiredLaneCount += 1;
    if (lane.laneKind === "projection") projectionLaneCount += 1;
    if (privateOperationalStateRecoverySources.has(lane.source)) {
      excludedPrivateLaneCount += 1;
    }
    if (replayableOperationalStateRecoverySources.has(lane.source)) {
      replayableLaneCount += 1;
    }

    if (lane.authorityScope !== cut.authorityScope) {
      issues.push({
        code: "operational_state_recovery_authority_scope_mismatch",
        path: `${path}/authorityScope`,
        message: `Operational state recovery lane ${lane.laneId} authority scope ${lane.authorityScope} does not match cut scope ${cut.authorityScope}.`,
        expected: cut.authorityScope,
        actual: lane.authorityScope,
      });
    }

    if (lane.required && privateOperationalStateRecoverySources.has(lane.source)) {
      issues.push({
        code: "operational_state_recovery_lane_private_authority",
        path: `${path}/source`,
        message: `Operational state recovery lane ${lane.laneId} tries to make ${lane.source} operational authority.`,
        actual: lane.source,
      });
    }

    if (
      lane.required &&
      (options.requireAllRequiredLanesReplayable ?? true) &&
      !replayableOperationalStateRecoverySources.has(lane.source)
    ) {
      issues.push({
        code: "operational_state_recovery_lane_not_replayable",
        path: `${path}/source`,
        message: `Operational state recovery lane ${lane.laneId} source ${lane.source} is not an admitted replay source.`,
        actual: lane.source,
      });
    }

    if (lane.required && !operationalStateRecoveryLaneHasHash(lane)) {
      issues.push({
        code: "operational_state_recovery_lane_hash_missing",
        path,
        message: `Operational state recovery lane ${lane.laneId} is required but has no replay, head, projection, store-root, or authority hash.`,
      });
    }

    if (
      lane.laneKind === "projection" &&
      lane.source !== "current_admissible_projection"
    ) {
      issues.push({
        code: "operational_state_recovery_lane_not_replayable",
        path: `${path}/source`,
        message: `Projection recovery lane ${lane.laneId} must be a current admissible projection, not ${lane.source}.`,
        expected: "current_admissible_projection",
        actual: lane.source,
      });
    }
    if (lane.laneKind === "projection" && lane.dependencies.length === 0) {
      issues.push({
        code: "operational_state_recovery_projection_unclosed",
        path: `${path}/dependencies`,
        message: `Projection recovery lane ${lane.laneId} has no dependencies, so it does not prove replay closure.`,
      });
    }
  });

  if ((options.requireCurrentProjection ?? true) && projectionLaneCount === 0) {
    issues.push({
      code: "operational_state_recovery_projection_missing",
      path: "/recoveryCut/lanes",
      message:
        "Operational state recovery cut has no current admissible projection lane.",
    });
  }

  cut.lanes.forEach((lane, laneIndex) => {
    lane.dependencies.forEach((dependency, dependencyIndex) => {
      const dependencyPath = `/recoveryCut/lanes/${laneIndex}/dependencies/${dependencyIndex}`;
      const target = lanesById.get(dependency.laneId);
      if (target === undefined) {
        issues.push({
          code: "operational_state_recovery_dependency_missing",
          path: `${dependencyPath}/laneId`,
          message: `Operational state recovery lane ${lane.laneId} depends on missing lane ${dependency.laneId}.`,
          actual: dependency.laneId,
        });
        return;
      }
      if (
        dependency.minimumSequence !== undefined &&
        (target.sequence === undefined ||
          target.sequence < dependency.minimumSequence)
      ) {
        issues.push({
          code: "operational_state_recovery_dependency_sequence_regression",
          path: `${dependencyPath}/minimumSequence`,
          message: `Operational state recovery lane ${dependency.laneId} sequence ${target.sequence ?? "none"} is below required sequence ${dependency.minimumSequence}.`,
          expected: dependency.minimumSequence,
          actual: target.sequence ?? "none",
        });
      }
      if (
        dependency.requiredHeadHash !== undefined &&
        target.headHash !== dependency.requiredHeadHash
      ) {
        issues.push({
          code: "operational_state_recovery_dependency_head_mismatch",
          path: `${dependencyPath}/requiredHeadHash`,
          message: `Operational state recovery lane ${dependency.laneId} head hash ${target.headHash ?? "none"} does not match required head hash ${dependency.requiredHeadHash}.`,
          expected: dependency.requiredHeadHash,
          actual: target.headHash ?? "none",
        });
      }
      if (
        dependency.requiredHistoryHash !== undefined &&
        target.historyHash !== dependency.requiredHistoryHash
      ) {
        issues.push({
          code: "operational_state_recovery_dependency_history_mismatch",
          path: `${dependencyPath}/requiredHistoryHash`,
          message: `Operational state recovery lane ${dependency.laneId} history hash ${target.historyHash ?? "none"} does not match required history hash ${dependency.requiredHistoryHash}.`,
          expected: dependency.requiredHistoryHash,
          actual: target.historyHash ?? "none",
        });
      }
      if (
        dependency.requiredAuthorityHash !== undefined &&
        target.authorityHash !== dependency.requiredAuthorityHash
      ) {
        issues.push({
          code: "operational_state_recovery_dependency_authority_mismatch",
          path: `${dependencyPath}/requiredAuthorityHash`,
          message: `Operational state recovery lane ${dependency.laneId} authority hash ${target.authorityHash ?? "none"} does not match required authority hash ${dependency.requiredAuthorityHash}.`,
          expected: dependency.requiredAuthorityHash,
          actual: target.authorityHash ?? "none",
        });
      }
    });
  });

  let quorumIntersectionProofEvaluation:
    | OperationalStateCompositionalQuorumIntersectionProofEvaluation
    | undefined;
  if (options.requireCompositionalQuorumIntersectionProof === true) {
    quorumIntersectionProofEvaluation =
      evaluateOperationalStateCompositionalQuorumIntersectionProof({
        ...(options.quorumIntersectionProof !== undefined
          ? { proof: options.quorumIntersectionProof }
          : {}),
        expectedTenantId: cut.tenantId,
        expectedAuthorityScope: cut.authorityScope,
        expectedSubjectKind: OPERATIONAL_STATE_RECOVERY_CUT_SUBJECT_KIND,
        expectedSubjectId: cut.cutId,
        expectedSubjectHash: cut.cutHash,
      });
    if (options.quorumIntersectionProof === undefined) {
      issues.push({
        code: "operational_state_recovery_quorum_intersection_proof_missing",
        path: "/recoveryCut/quorumIntersectionProof",
        message:
          "Recovery cut cannot compose independently admitted authority histories without a quorum-intersection proof.",
      });
    } else if (!quorumIntersectionProofEvaluation.valid) {
      issues.push({
        code: "operational_state_recovery_quorum_intersection_proof_invalid",
        path: "/recoveryCut/quorumIntersectionProof",
        message:
          "Recovery cut cannot consume an invalid compositional quorum-intersection proof.",
        actual: quorumIntersectionProofEvaluation.issues
          .map((issue) => issue.code)
          .join(","),
      });
    }
  }

  return {
    valid: issues.length === 0,
    cutId: cut.cutId,
    cutHash: cut.cutHash,
    replayableLaneCount,
    requiredLaneCount,
    projectionLaneCount,
    excludedPrivateLaneCount,
    ...(quorumIntersectionProofEvaluation !== undefined
      ? { quorumIntersectionProofEvaluation }
      : {}),
    issues,
  };
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function pushOperationalStateRecoveryCutAdmissionIssue(
  issues: OperationalStateRecoveryCutAdmissionIssue[],
  issue: OperationalStateRecoveryCutAdmissionIssue,
): void {
  issues.push(issue);
}

export function evaluateOperationalStateRecoveryCutAdmission(
  input: OperationalStateRecoveryCutAdmissionEvaluationInput,
): OperationalStateRecoveryCutAdmissionEvaluation {
  const issues: OperationalStateRecoveryCutAdmissionIssue[] = [];
  const { view } = input;
  const { recoveryCut } = view;

  if (recoveryCut === undefined) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_cut_missing",
      path: "/recoveryCut",
      message:
        "Recovered operational state cannot be admitted without a recovery cut.",
    });
    return {
      valid: false,
      accepted: false,
      ...(input.admissionReplay !== undefined
        ? { admissionReplay: input.admissionReplay }
        : {}),
      issues,
    };
  }

  if (input.admissionReplay === undefined) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_replay_missing",
      path: "/recoveryCutAdmission",
      message:
        "Recovered operational state requires replay of durable recovery-cut admission records.",
    });
    return {
      valid: false,
      accepted: false,
      issues,
    };
  }

  if (!input.admissionReplay.valid) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_replay_invalid",
      path: "/recoveryCutAdmission",
      message:
        "Recovered operational state has an invalid recovery-cut admission replay.",
      actual: input.admissionReplay.issues
        .map((issue) => issue.code)
        .join(","),
    });
  }

  const latestAdmittedRecord = input.admissionReplay.latestAdmittedRecord;
  if (
    latestAdmittedRecord === undefined ||
    latestAdmittedRecord.recoveryCutHash !== recoveryCut.cutHash
  ) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_cut_not_admitted",
      path: "/recoveryCut/cutHash",
      message:
        "Current recovery cut is not the latest cut admitted by recovery-cut admission replay.",
      expected: recoveryCut.cutHash,
      actual: latestAdmittedRecord?.recoveryCutHash ?? "none",
    });
  }

  const currentStateViewIdentityHash =
    computeCurrentStateViewIdentityHash(view);
  if (
    latestAdmittedRecord !== undefined &&
    latestAdmittedRecord.currentStateViewIdentityHash !==
      currentStateViewIdentityHash
  ) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_view_hash_mismatch",
      path: "/currentStateViewIdentityHash",
      message:
        "Recovery-cut admission record is bound to a different current-state view identity hash.",
      expected: currentStateViewIdentityHash,
      actual: latestAdmittedRecord.currentStateViewIdentityHash,
    });
  }

  const admissionWitnessReplay = input.admissionWitnessReplay;
  const latestWitnessRecord =
    admissionWitnessReplay?.requiredAdmissionWitnessRecord;
  if (
    input.requireAdmissionWitnessQuorum === true ||
    input.requireAdmissionWitnessAuthorityTopology === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness === true ||
    input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
      true
  ) {
    if (admissionWitnessReplay === undefined) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_admission_witness_replay_missing",
        path: "/recoveryCutAdmissionWitness",
        message:
          "Recovered operational state requires replay of witness-certified recovery-cut admission records.",
      });
    } else if (!admissionWitnessReplay.valid) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_admission_witness_replay_invalid",
        path: "/recoveryCutAdmissionWitness",
        message:
          "Recovered operational state has an invalid recovery-cut admission witness replay.",
        actual: admissionWitnessReplay.issues
          .map((issue) => issue.code)
          .join(","),
      });
    } else if (
      latestAdmittedRecord === undefined ||
      latestWitnessRecord === undefined ||
      latestWitnessRecord.admissionRecordHash !==
        latestAdmittedRecord.admissionRecordHash
    ) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_admission_latest_record_not_witnessed",
        path: "/recoveryCutAdmissionWitness",
        message:
          "Latest recovery-cut admission record is not witnessed by the replayed admission witness quorum.",
        expected: latestAdmittedRecord?.admissionRecordHash ?? "none",
        actual: latestWitnessRecord?.admissionRecordHash ?? "none",
      });
    }
  }
  if (
    (input.requireAdmissionWitnessAuthorityTopology === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTopology === undefined
  ) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_witness_authority_topology_missing",
      path: "/recoveryCutAdmissionWitness/witnessAuthorityTopology",
      message:
        "Recovered operational state requires recovery-cut admission witness replay to bind certificates to replayed witness authority topology.",
    });
  }
  if (
    (input.requireAdmissionWitnessAuthorityTransitionAdmission === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay ===
      undefined
  ) {
    pushOperationalStateRecoveryCutAdmissionIssue(issues, {
      code: "operational_state_recovery_cut_admission_witness_authority_transition_admission_replay_missing",
      path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay",
      message:
        "Recovered operational state requires recovery-cut admission witness authority topology to replay from admitted authority-transition history.",
    });
  }
  if (
    (input.requireAdmissionWitnessAuthorityTransitionAdmissionWitness === true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    admissionWitnessReplay !== undefined &&
    admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
      undefined
  ) {
    const admissionTransitionWitnessReplay =
      admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .admissionWitnessReplay;
    if (admissionTransitionWitnessReplay === undefined) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_replay_missing",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Recovered operational state requires recovery-cut admission witness authority-transition admission records to be witnessed.",
      });
    } else if (!admissionTransitionWitnessReplay.valid) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_replay_invalid",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Recovered operational state cannot consume invalid recovery-cut admission witness authority-transition admission witness history.",
        actual: admissionTransitionWitnessReplay.issues
          .map((issue) => issue.code)
          .join(","),
      });
    } else if (
      (input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
        input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
          true) &&
      admissionTransitionWitnessReplay.witnessAuthorityTopology === undefined
    ) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_authority_topology_missing",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTopology",
        message:
          "Recovered operational state requires recovery-cut admission witness authority-transition admission witness certificates to bind to a replayed witness authority topology.",
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay ===
        undefined
    ) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_replay_missing",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Recovered operational state requires recovery-cut transition-admission witness authority topology to replay from admitted authority-transition history.",
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      !admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .valid
    ) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_replay_invalid",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Recovered operational state cannot consume invalid recovery-cut transition-admission witness authority-transition admission history.",
        actual:
          admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay.issues
            .map((issue) => issue.code)
            .join(","),
      });
    } else if (
      input.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionTransitionWitnessReplay.witnessAuthorityTopology !== undefined &&
      admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      (admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .latestAdmittedTopology === undefined ||
        !operationalStateAuthorityTopologiesMatch(
          admissionTransitionWitnessReplay
            .witnessAuthorityTransitionAdmissionReplay.latestAdmittedTopology,
          admissionTransitionWitnessReplay.witnessAuthorityTopology,
        ))
    ) {
      pushOperationalStateRecoveryCutAdmissionIssue(issues, {
        code: "operational_state_recovery_cut_aw_authority_transition_witness_authority_transition_admission_topology_mismatch",
        path: "/recoveryCutAdmissionWitness/witnessAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay/latestAdmittedTopology",
        message:
          "Recovered operational state requires recovery-cut transition-admission witness authority topology to match admitted authority-transition history.",
        expected:
          admissionTransitionWitnessReplay.witnessAuthorityTopology.topologyHash,
        actual:
          admissionTransitionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
            .latestAdmittedTopology?.topologyHash ?? "none",
      });
    }
  }

  return {
    valid: issues.length === 0,
    accepted: issues.length === 0,
    admissionReplay: input.admissionReplay,
    ...(admissionWitnessReplay !== undefined ? { admissionWitnessReplay } : {}),
    ...(latestAdmittedRecord !== undefined ? { latestAdmittedRecord } : {}),
    ...(latestWitnessRecord !== undefined ? { latestWitnessRecord } : {}),
    issues,
  };
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function operationalStateHistoryRootKey(
  root: Pick<
    OperationalStateHistoryRoot,
    "tenantId" | "storeId" | "authorityScope"
  >,
): string {
  return `${root.tenantId}:${root.authorityScope}:${root.storeId}`;
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function operationalStateHistoryRootSettlementKey(
  root: Pick<
    OperationalStateHistoryRoot,
    | "tenantId"
    | "storeId"
    | "authorityScope"
    | "sequence"
    | "rootCommitmentHash"
  >,
): string {
  return `${root.tenantId}:${root.authorityScope}:${root.storeId}:${root.sequence}:${root.rootCommitmentHash}`;
}

export function evaluateOperationalStateRecoveryCutTransparency(
  input: OperationalStateRecoveryCutTransparencyEvaluationInput,
): OperationalStateRecoveryCutTransparencyEvaluation {
  const issues: OperationalStateRecoveryCutTransparencyIssue[] = [];
  let checkedLaneCount = 0;
  let witnessedLaneCount = 0;
  let settledLaneCount = 0;

  if (input.transparencyReplay === undefined) {
    return {
      valid: false,
      checkedLaneCount: 0,
      witnessedLaneCount: 0,
      settledLaneCount: 0,
      issues: [
        {
          code: "operational_state_recovery_transparency_replay_missing",
          path: "/recoveryTransparency",
          message:
            "Recovered operational state cannot use store-root lanes without a transparency replay when recovery transparency is required.",
        },
      ],
    };
  }

  if (!input.transparencyReplay.valid) {
    issues.push({
      code: "operational_state_recovery_transparency_replay_invalid",
      path: "/recoveryTransparency",
      message:
        "Recovered operational state has an invalid transparency replay for its witnessed store roots.",
      actual: input.transparencyReplay.issues.map((issue) => issue.code).join(","),
    });
  }
  if (
    input.requireObserverSignatures === true &&
    input.transparencyReplay.observerSignatureRequired !== true
  ) {
    issues.push({
      code: "operational_state_recovery_transparency_observer_signature_required",
      path: "/recoveryTransparency/observerSignatureRequired",
      message:
        "Recovered operational state requires transparency replay to admit only signed observer observations.",
      expected: "true",
      actual: String(input.transparencyReplay.observerSignatureRequired),
    });
  }

  if (input.cut === undefined) {
    return {
      valid: issues.length === 0,
      checkedLaneCount,
      witnessedLaneCount,
      settledLaneCount,
      issues,
    };
  }

  const latestRootByKey = new Map<string, OperationalStateHistoryRoot>();
  input.transparencyReplay.latestRoots.forEach((root) => {
    latestRootByKey.set(operationalStateHistoryRootKey(root), root);
  });
  const settledRootByKey = new Map<string, OperationalStateHistoryRoot>();
  input.rootSettlementReplay?.settledRoots.forEach((root) => {
    settledRootByKey.set(operationalStateHistoryRootSettlementKey(root), root);
  });

  if (
    input.requireRootSettlement === true ||
    input.requireRootSettlementAuthorityTopology === true ||
    input.requireRootSettlementAuthorityTransitionAdmission === true ||
    input.requireRootSettlementAuthorityTransitionAdmissionWitness === true ||
    input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
      true ||
    input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
      true
  ) {
    if (input.rootSettlementReplay === undefined) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_replay_missing",
        path: "/recoveryTransparency/rootSettlement",
        message:
          "Recovered operational state requires replay of settled history-root certificates.",
      });
    } else if (!input.rootSettlementReplay.valid) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_replay_invalid",
        path: "/recoveryTransparency/rootSettlement",
        message:
          "Recovered operational state has an invalid history-root settlement replay.",
        actual: input.rootSettlementReplay.issues
          .map((issue) => issue.code)
        .join(","),
      });
    }
  }
  if (
    (input.requireRootSettlementAuthorityTopology === true ||
      input.requireRootSettlementAuthorityTransitionAdmission === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitness === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    input.rootSettlementReplay !== undefined &&
    input.rootSettlementReplay.settlementAuthorityTopology === undefined
  ) {
    issues.push({
      code: "operational_state_recovery_transparency_root_settlement_authority_topology_missing",
      path: "/recoveryTransparency/rootSettlement/settlementAuthorityTopology",
      message:
        "Recovered operational state requires history-root settlement replay to bind certificates to replayed settlement authority topology.",
    });
  }
  if (
    (input.requireRootSettlementAuthorityTransitionAdmission === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitness === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    input.rootSettlementReplay !== undefined &&
    input.rootSettlementReplay.settlementAuthorityTransitionAdmissionReplay ===
      undefined
  ) {
    issues.push({
      code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_replay_missing",
      path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay",
      message:
        "Recovered operational state requires history-root settlement authority topology to come from admitted authority-transition history.",
    });
  }
  if (
    (input.requireRootSettlementAuthorityTransitionAdmissionWitness === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true) &&
    input.rootSettlementReplay !== undefined &&
    input.rootSettlementReplay.settlementAuthorityTransitionAdmissionReplay !==
      undefined
  ) {
    const admissionWitnessReplay =
      input.rootSettlementReplay.settlementAuthorityTransitionAdmissionReplay
        .admissionWitnessReplay;
    if (admissionWitnessReplay === undefined) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_replay_missing",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Recovered operational state requires history-root settlement authority-transition admission records to be witnessed.",
      });
    } else if (!admissionWitnessReplay.valid) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_replay_invalid",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay",
        message:
          "Recovered operational state cannot consume invalid history-root settlement authority-transition admission witness history.",
        actual: admissionWitnessReplay.issues
          .map((issue) => issue.code)
          .join(","),
      });
    } else if (
      (input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
        input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
          true) &&
      admissionWitnessReplay.witnessAuthorityTopology === undefined
    ) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_topology_missing",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTopology",
        message:
          "Recovered operational state requires history-root settlement authority-transition admission witness certificates to bind to replayed witness authority topology.",
      });
    } else if (
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay ===
        undefined
    ) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_missing",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Recovered operational state requires history-root settlement authority-transition admission witness authority topology to replay from admitted authority-transition history.",
      });
    } else if (
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      !admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay.valid
    ) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_replay_invalid",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay",
        message:
          "Recovered operational state cannot consume invalid nested history-root settlement authority-transition admission witness authority history.",
        actual:
          admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay.issues
            .map((issue) => issue.code)
            .join(","),
      });
    } else if (
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true &&
      admissionWitnessReplay.witnessAuthorityTopology !== undefined &&
      admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay !==
        undefined &&
      (admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
        .latestAdmittedTopology === undefined ||
        !operationalStateAuthorityTopologiesMatch(
          admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
            .latestAdmittedTopology,
          admissionWitnessReplay.witnessAuthorityTopology,
        ))
    ) {
      issues.push({
        code: "operational_state_recovery_transparency_root_settlement_authority_transition_admission_witness_authority_transition_admission_topology_mismatch",
        path: "/recoveryTransparency/rootSettlement/settlementAuthorityTransitionAdmissionReplay/admissionWitnessReplay/witnessAuthorityTransitionAdmissionReplay/latestAdmittedTopology",
        message:
          "Recovered operational state requires history-root settlement authority-transition admission witness authority topology to be recovered from admitted authority-transition history.",
        expected: admissionWitnessReplay.witnessAuthorityTopology.topologyHash,
        actual:
          admissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay
            .latestAdmittedTopology?.topologyHash ?? "none",
      });
    }
  }

  input.cut.lanes.forEach((lane, index) => {
    if (
      !lane.required ||
      lane.storeRootHash === undefined ||
      (input.requireWitnessedStoreRoots ?? true) === false
    ) {
      return;
    }
    checkedLaneCount += 1;
    const path = `/recoveryCut/lanes/${index}`;
    if (lane.storeId === undefined || lane.storeId.trim().length === 0) {
      issues.push({
        code: "operational_state_recovery_transparency_lane_store_id_missing",
        path: `${path}/storeId`,
        message: `Recovery lane ${lane.laneId} cites a store root hash but has no store id for transparency lookup.`,
      });
      return;
    }
    const root = latestRootByKey.get(
      `${input.cut!.tenantId}:${lane.authorityScope}:${lane.storeId}`,
    );
    if (root === undefined) {
      issues.push({
        code: "operational_state_recovery_transparency_lane_root_unwitnessed",
        path: `${path}/storeRootHash`,
        message: `Recovery lane ${lane.laneId} store root ${lane.storeRootHash} is not witnessed in transparency replay.`,
        actual: lane.storeRootHash,
      });
      return;
    }
    if (lane.sequence !== undefined && root.sequence < lane.sequence) {
      issues.push({
        code: "operational_state_recovery_transparency_lane_root_stale",
        path: `${path}/sequence`,
        message: `Recovery lane ${lane.laneId} requires store sequence ${lane.sequence}, but witnessed root is only ${root.sequence}.`,
        expected: lane.sequence,
        actual: root.sequence,
      });
      return;
    }
    if (root.rootHash !== lane.storeRootHash) {
      issues.push({
        code: "operational_state_recovery_transparency_lane_root_mismatch",
        path: `${path}/storeRootHash`,
        message: `Recovery lane ${lane.laneId} store root ${lane.storeRootHash} does not match witnessed root ${root.rootHash}.`,
        expected: lane.storeRootHash,
        actual: root.rootHash,
      });
      return;
    }
    witnessedLaneCount += 1;
    if (
      input.requireRootSettlement === true ||
      input.requireRootSettlementAuthorityTopology === true ||
      input.requireRootSettlementAuthorityTransitionAdmission === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitness === true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology ===
        true ||
      input.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
        true
    ) {
      const settledRoot = settledRootByKey.get(
        operationalStateHistoryRootSettlementKey(root),
      );
      if (settledRoot === undefined) {
        issues.push({
          code: "operational_state_recovery_transparency_lane_root_unsettled",
          path: `${path}/storeRootHash`,
          message: `Recovery lane ${lane.laneId} cites root ${root.rootHash}, but that root is not settled by replayed history-root settlement records.`,
          expected: root.rootCommitmentHash,
          actual: lane.storeRootHash,
        });
        return;
      }
      settledLaneCount += 1;
    }
  });

  return {
    valid: issues.length === 0,
    checkedLaneCount,
    witnessedLaneCount,
    settledLaneCount,
    issues,
  };
}

export function evaluateProjectionReplayCertificate(
  view: CurrentStateView,
  options: ProjectionReplayCertificateEvaluationOptions = {},
): ProjectionReplayCertificateEvaluation {
  const certificate = view.replayCertificate;
  if (certificate === undefined) {
    return {
      valid: false,
      issues: [
        {
          code: "projection_replay_certificate_missing",
          path: "/replayCertificate",
          message:
            "CurrentStateView cannot authorize action without a replay certificate when replay proof is required.",
          ref: view.subject,
        },
      ],
    };
  }
  return evaluateProjectionReplayCertificateAgainstView(
    certificate,
    view,
    options,
  );
}

export function evaluateProjectionReplayCertificateAgainstView(
  certificate: ProjectionReplayCertificate,
  view: CurrentStateView,
  options: ProjectionReplayCertificateEvaluationOptions = {},
): ProjectionReplayCertificateEvaluation {
  const issues: ProjectionReplayCertificateIssue[] = [];
  const hashValidation = verifyProjectionReplayCertificateHash(certificate);

  if (!hashValidation.valid) {
    issues.push({
      code: "projection_replay_certificate_hash_mismatch",
      path: "/replayCertificate/certificateHash",
      message: `Projection replay certificate hash ${hashValidation.actualHash} does not match recomputed hash ${hashValidation.expectedHash}.`,
      ref: view.subject,
    });
  }
  if (certificate.tenantId !== view.tenantId) {
    issues.push({
      code: "projection_replay_tenant_mismatch",
      path: "/replayCertificate/tenantId",
      message: `Projection replay certificate tenant ${certificate.tenantId} does not match current state view tenant ${view.tenantId}.`,
      ref: view.subject,
    });
  }
  if (!sameStateRef(certificate.subject, view.subject)) {
    issues.push({
      code: "projection_replay_subject_mismatch",
      path: "/replayCertificate/subject",
      message: `Projection replay certificate subject ${formatStateRef(certificate.subject)} does not match current state view subject ${formatStateRef(view.subject)}.`,
      ref: certificate.subject,
    });
  }
  if (certificate.projectionVersion !== view.projectionVersion) {
    issues.push({
      code: "projection_replay_version_mismatch",
      path: "/replayCertificate/projectionVersion",
      message: `Projection replay certificate version ${certificate.projectionVersion} does not match current state view version ${view.projectionVersion}.`,
      ref: view.subject,
    });
  }

  const expectedAuthorityScope =
    options.expectedAuthorityScope ?? view.authorityRule;
  if (certificate.authorityScope !== expectedAuthorityScope) {
    issues.push({
      code: "projection_replay_authority_scope_mismatch",
      path: "/replayCertificate/authorityScope",
      message: `Projection replay certificate authority scope ${certificate.authorityScope} does not match expected scope ${expectedAuthorityScope}.`,
      ref: view.subject,
    });
  }

  if (!sameStateRefSet(certificate.sourceRefs, view.sourceRefs)) {
    issues.push({
      code: "projection_replay_source_refs_mismatch",
      path: "/replayCertificate/sourceRefs",
      message:
        "Projection replay certificate source refs do not match the current state view source refs.",
      ref: view.subject,
    });
  }

  const projectionHash = computeCurrentStateViewIdentityHash(view);
  if (certificate.projectionHash !== projectionHash) {
    issues.push({
      code: "projection_replay_projection_hash_mismatch",
      path: "/replayCertificate/projectionHash",
      message: `Projection replay certificate projection hash ${certificate.projectionHash} does not match current state view projection hash ${projectionHash}.`,
      ref: view.subject,
    });
  }

  const transitionHistoryHash =
    computeProjectionReplayTransitionHistoryHash(certificate.transitionRefs);
  if (certificate.transitionHistoryHash !== transitionHistoryHash) {
    issues.push({
      code: "projection_replay_transition_history_hash_mismatch",
      path: "/replayCertificate/transitionHistoryHash",
      message: `Projection replay certificate transition history hash ${certificate.transitionHistoryHash} does not match recomputed hash ${transitionHistoryHash}.`,
      ref: view.subject,
    });
  }

  if (certificate.transitionRefs.length === 0) {
    issues.push({
      code: "projection_replay_transition_history_empty",
      path: "/replayCertificate/transitionRefs",
      message:
        "Projection replay certificate must cite at least one admitted transition ref.",
      ref: view.subject,
    });
  }
  for (const [index, transition] of certificate.transitionRefs.entries()) {
    if (!isProjectionReplayTransitionRefKind(transition.ref.kind)) {
      issues.push({
        code: "projection_replay_transition_kind_invalid",
        path: `/replayCertificate/transitionRefs/${index}/ref/kind`,
        message: `Projection replay transition ref kind ${transition.ref.kind} is not an admitted transition kind.`,
        ref: transition.ref,
      });
    }
    if (
      options.requireTransitionContentHash === true &&
      (transition.contentHash === undefined ||
        transition.contentHash.trim() === "")
    ) {
      issues.push({
        code: "projection_replay_transition_hash_missing",
        path: `/replayCertificate/transitionRefs/${index}/contentHash`,
        message:
          "Projection replay transition ref requires a content hash under the configured replay policy.",
        ref: transition.ref,
      });
    }
  }

  if (
    options.minimumReplayPosition !== undefined &&
    (certificate.replayedToPosition === undefined ||
      certificate.replayedToPosition < options.minimumReplayPosition)
  ) {
    issues.push({
      code: "projection_replay_position_regression",
      path: "/replayCertificate/replayedToPosition",
      message: `Projection replay certificate position ${certificate.replayedToPosition ?? "unknown"} is behind required position ${options.minimumReplayPosition}.`,
      ref: view.subject,
    });
  }

  return {
    certificateId: certificate.certificateId,
    valid: issues.length === 0,
    issues,
  };
}

export function evaluateLocalStateSections(
  sections: readonly LocalStateSection[],
  options: LocalViewEvaluationOptions,
): LocalViewEvaluation {
  const first = sections[0];
  if (first === undefined) {
    const tenantId = "" as TenantId;
    return {
      kind: "obstruction",
      obstruction: {
        artifactId: options.artifactId ?? "local_view_obstruction:empty",
        tenantId,
        subject: stateRef("document", "unknown"),
        generatedAt: options.generatedAt,
        sectionIds: [],
        conflicts: [
          {
            field: "$sections",
            sectionIds: [],
            refs: [],
            values: [],
            message: "No local sections were supplied; a global projection cannot be formed.",
          },
        ],
        allowedAction: "request_resolution",
      },
    };
  }

  const conflicts: LocalViewOverlapConflict[] = [];
  for (const section of sections) {
    if (section.tenantId !== first.tenantId) {
      conflicts.push({
        field: "$tenantId",
        sectionIds: [first.sectionId, section.sectionId],
        refs: [first.subject, section.subject],
        values: [first.tenantId, section.tenantId],
        message: `Local section ${section.sectionId} has tenant ${section.tenantId}; expected ${first.tenantId}.`,
      });
    }
    if (!sameStateRef(section.subject, first.subject)) {
      conflicts.push({
        field: "$subject",
        sectionIds: [first.sectionId, section.sectionId],
        refs: [first.subject, section.subject],
        values: [formatStateRef(first.subject), formatStateRef(section.subject)],
        message: `Local section ${section.sectionId} describes ${formatStateRef(section.subject)}; expected ${formatStateRef(first.subject)}.`,
      });
    }
  }

  const fields = uniqueStrings([
    ...(options.requiredFields ?? []),
    ...sections.flatMap((section) => Object.keys(section.fields)),
  ]);
  const projectionFields: Record<string, LocalStateField> = {};

  for (const field of fields) {
    const present = sections
      .map((section) => ({ section, value: section.fields[field] }))
      .filter(
        (entry): entry is { section: LocalStateSection; value: LocalStateField } =>
          entry.value !== undefined,
      );
    if (present.length === 0) continue;

    const valuesByKey = new Map<string, typeof present>();
    for (const entry of present) {
      const key = canonicalStringify(entry.value.value);
      const bucket = valuesByKey.get(key) ?? [];
      bucket.push(entry);
      valuesByKey.set(key, bucket);
    }

    if (valuesByKey.size > 1) {
      conflicts.push({
        field,
        sectionIds: present.map((entry) => entry.section.sectionId),
        refs: uniqueStateRefs(present.flatMap((entry) => entry.value.refs)),
        values: present.map((entry) => entry.value.value),
        message: `Local sections disagree on ${field}; no global projection is admissible until the overlap is resolved.`,
      });
      continue;
    }

    projectionFields[field] = present[0]!.value;
  }

  if (conflicts.length > 0) {
    return {
      kind: "obstruction",
      obstruction: {
        artifactId:
          options.artifactId ??
          `local_view_obstruction:${first.subject.kind}:${first.subject.id}`,
        tenantId: first.tenantId,
        subject: first.subject,
        generatedAt: options.generatedAt,
        sectionIds: sections.map((section) => section.sectionId),
        conflicts,
        allowedAction: "request_resolution",
      },
    };
  }

  return {
    kind: "global_projection",
    projection: {
      tenantId: first.tenantId,
      subject: first.subject,
      generatedAt: options.generatedAt,
      sectionIds: sections.map((section) => section.sectionId),
      fields: projectionFields,
    },
  };
}

export function projectActionOutcomeEnvelopeForRole(
  envelope: ActionOutcomeEnvelope,
  role: ActionOutcomeProjectionRole,
): ActionOutcomeRoleProjection {
  return {
    role,
    core: {
      tenantId: envelope.tenantId,
      actionId: envelope.actionId,
      subject: envelope.subject,
      terminalOutcome: envelope.terminalOutcome,
      proposalReviewId: envelope.proposalReviewId,
      stateReviewArtifactHash: envelope.stateReviewArtifactHash,
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
      evidenceAdmissionReviewIds: envelope.evidenceAdmissionReviewIds,
      statusCheckRefs: envelope.statusCheckRefs,
      blockingCauseCodes: envelope.blockingCauses.map((cause) => cause.code),
      evidenceRefs: envelope.evidenceRefs,
      substrateRefs: envelope.substrateRefs,
      outcomeHash: envelope.outcomeHash,
    },
    visibleBlockingCauses: envelope.blockingCauses,
  };
}

export function validateActionOutcomeRoleProjection(
  envelope: ActionOutcomeEnvelope,
  projection: ActionOutcomeRoleProjection,
): ActionOutcomeProjectionValidation {
  const issues: string[] = [];
  const core = projection.core;

  if (core.tenantId !== envelope.tenantId) issues.push("tenantId changed");
  if (core.actionId !== envelope.actionId) issues.push("actionId changed");
  if (!sameStateRef(core.subject, envelope.subject)) issues.push("subject changed");
  if (core.terminalOutcome !== envelope.terminalOutcome) {
    issues.push("terminalOutcome changed");
  }
  if (core.proposalReviewId !== envelope.proposalReviewId) {
    issues.push("proposalReviewId changed");
  }
  if (core.stateReviewArtifactHash !== envelope.stateReviewArtifactHash) {
    issues.push("stateReviewArtifactHash changed");
  }
  if (core.providerCertificateId !== envelope.providerCertificateId) {
    issues.push("providerCertificateId changed");
  }
  if (core.providerCertificateDigest !== envelope.providerCertificateDigest) {
    issues.push("providerCertificateDigest changed");
  }
  if (
    canonicalStringify(core.providerCertificateStatusRef) !==
    canonicalStringify(envelope.providerCertificateStatusRef)
  ) {
    issues.push("providerCertificateStatusRef changed");
  }
  if (
    canonicalStringify(core.projectionReplayRef) !==
    canonicalStringify(envelope.projectionReplayRef)
  ) {
    issues.push("projectionReplayRef changed");
  }
  if (
    canonicalStringify(core.projectionReplayRootSettlementRef) !==
    canonicalStringify(envelope.projectionReplayRootSettlementRef)
  ) {
    issues.push("projectionReplayRootSettlementRef changed");
  }
  if (!sameStringSet(core.evidenceAdmissionReviewIds, envelope.evidenceAdmissionReviewIds)) {
    issues.push("evidenceAdmissionReviewIds changed");
  }
  if (!sameStateRefSet(core.statusCheckRefs, envelope.statusCheckRefs)) {
    issues.push("statusCheckRefs changed");
  }
  if (!sameStringSet(core.blockingCauseCodes, envelope.blockingCauses.map((cause) => cause.code))) {
    issues.push("blockingCauseCodes changed");
  }
  if (!sameStateRefSet(core.evidenceRefs, envelope.evidenceRefs)) {
    issues.push("evidenceRefs changed");
  }
  if (!sameStateRefSet(core.substrateRefs, envelope.substrateRefs)) {
    issues.push("substrateRefs changed");
  }
  if (core.outcomeHash !== envelope.outcomeHash) issues.push("outcomeHash changed");
  if (
    envelope.terminalOutcome === "blocked" &&
    projection.visibleBlockingCauses.length === 0
  ) {
    issues.push("blocked projection hides blocking causes");
  }

  return { valid: issues.length === 0, issues };
}

export function buildReadSetFromCurrentStateView(
  view: CurrentStateView,
  authority: string,
): readonly ReadSetEntry[] {
  return view.sourceRefs.map((ref) => {
    const entry: ReadSetEntry = {
      ref,
      observedAt: view.observedAt,
      authority,
      ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
      ...(view.projectionVersion !== undefined
        ? { projectionVersion: view.projectionVersion }
        : {}),
    };
    return entry;
  });
}

export function compareObservedReadSetToDeclared(
  declaredReadSet: readonly ReadSetEntry[],
  observedReadSet: readonly ObservedReadSetEntry[],
  view: Pick<CurrentStateView, "authorityRule" | "projectionVersion" | "workflowPosition">,
  proposedAt: Timestamp,
): ObservedReadSetComparison {
  const issues: ObservedReadSetValidationIssue[] = [];

  for (const [index, observedEntry] of observedReadSet.entries()) {
    const declaredIndex = declaredReadSet.findIndex((entry) =>
      sameStateRef(entry.ref, observedEntry.ref),
    );
    const declaredEntry =
      declaredIndex === -1 ? undefined : declaredReadSet[declaredIndex];
    if (declaredEntry === undefined) {
      issues.push({
        code: "observed_but_undeclared",
        path: `/observedReadSet/${index}/ref`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} was not declared in the proposal read set.`,
        ref: observedEntry.ref,
        observedIndex: index,
      });
    }
  }

  for (const [index, declaredEntry] of declaredReadSet.entries()) {
    if (!observedReadSet.some((entry) => sameStateRef(entry.ref, declaredEntry.ref))) {
      issues.push({
        code: "declared_but_unobserved",
        path: `/declaredReadSet/${index}/ref`,
        message: `Declared state ref ${formatStateRef(declaredEntry.ref)} was not observed by the tool/source read set.`,
        ref: declaredEntry.ref,
        declaredIndex: index,
      });
    }
  }

  for (const [index, observedEntry] of observedReadSet.entries()) {
    const declaredIndex = declaredReadSet.findIndex((entry) =>
      sameStateRef(entry.ref, observedEntry.ref),
    );
    const declaredEntry =
      declaredIndex === -1 ? undefined : declaredReadSet[declaredIndex];

    if (
      observedEntry.validUntil !== undefined &&
      isAfter(proposedAt, observedEntry.validUntil)
    ) {
      issues.push({
        code: "stale_observed_read",
        path: `/observedReadSet/${index}/validUntil`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} expired at ${observedEntry.validUntil} before action proposal at ${proposedAt}.`,
        ref: observedEntry.ref,
        ...(declaredIndex !== -1 ? { declaredIndex } : {}),
        observedIndex: index,
      });
    }

    if (declaredEntry === undefined) continue;

    const expectedAuthority = declaredEntry.authority;
    if (observedEntry.authority !== expectedAuthority) {
      issues.push({
        code: "authority_mismatch",
        path: `/observedReadSet/${index}/authority`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used authority ${observedEntry.authority}; expected ${expectedAuthority}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }

    const expectedProjectionVersion =
      declaredEntry.projectionVersion ?? view.projectionVersion;
    if (
      observedEntry.projectionVersion !== undefined &&
      expectedProjectionVersion !== undefined &&
      observedEntry.projectionVersion !== expectedProjectionVersion
    ) {
      issues.push({
        code: "projection_version_drift",
        path: `/observedReadSet/${index}/projectionVersion`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used projection version ${observedEntry.projectionVersion}; expected ${expectedProjectionVersion}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }

    if (
      observedEntry.workflowPosition !== undefined &&
      view.workflowPosition !== undefined &&
      observedEntry.workflowPosition !== view.workflowPosition
    ) {
      issues.push({
        code: "workflow_position_drift",
        path: `/observedReadSet/${index}/workflowPosition`,
        message: `Observed state ref ${formatStateRef(observedEntry.ref)} used workflow position ${observedEntry.workflowPosition}; current position is ${view.workflowPosition}.`,
        ref: observedEntry.ref,
        declaredIndex,
        observedIndex: index,
      });
    }
  }

  return {
    valid: issues.length === 0,
    mode: "warn",
    declaredReadSet,
    observedReadSet,
    issues,
  };
}

export function buildObservationContractFromCurrentStateView(
  view: CurrentStateView,
  issuedAt: Timestamp = view.observedAt,
): ObservationContract {
  return {
    tenantId: view.tenantId,
    contractId: `${view.viewId}:observation_contract`,
    subject: view.subject,
    issuedAt,
    observedAt: view.observedAt,
    ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
    authorityRule: view.authorityRule,
    ...(view.projectionVersion !== undefined
      ? { projectionVersion: view.projectionVersion }
      : {}),
    ...(view.workflowPosition !== undefined
      ? { workflowPosition: view.workflowPosition }
      : {}),
    requiredSourceRefs: view.sourceRefs,
    declaredMissingSources: view.missingSources,
    declaredConflictCount: view.conflicts.length,
  };
}

export function evaluateObservationContract(
  contract: ObservationContract,
  view: CurrentStateView,
  evaluatedAt: Timestamp,
): ObservationContractEvaluation {
  const missingRefs = contract.requiredSourceRefs.filter(
    (ref) => !view.sourceRefs.some((candidate) => sameStateRef(candidate, ref)),
  );
  const missingSourcesChanged = !sameStringSet(
    contract.declaredMissingSources,
    view.missingSources,
  );
  const conflictCountMatches =
    contract.declaredConflictCount === view.conflicts.length;
  const assertions: StateAssertion[] = [
    assertion({
      code: "required_source_refs_present",
      passed: missingRefs.length === 0 && view.missingSources.length === 0,
      severity: "fail",
      refs: missingRefs,
      message:
        missingRefs.length === 0 && view.missingSources.length === 0
          ? "All required observation source refs are present."
          : `Observation is missing ${missingRefs.length} required refs and ${view.missingSources.length} source declarations.`,
    }),
    assertion({
      code: "authority_rule_matches",
      passed: contract.authorityRule === view.authorityRule,
      severity: "fail",
      refs: [view.subject],
      message:
        contract.authorityRule === view.authorityRule
          ? "Observation authority still matches the current state view."
          : `Observation authority ${contract.authorityRule} differs from current authority ${view.authorityRule}.`,
    }),
    assertion({
      code: "freshness_window_current",
      passed:
        contract.validUntil === undefined || !isAfter(evaluatedAt, contract.validUntil),
      severity: "warn",
      refs: contract.requiredSourceRefs,
      message:
        contract.validUntil === undefined || !isAfter(evaluatedAt, contract.validUntil)
          ? "Observation freshness window is still current."
          : `Observation freshness expired at ${contract.validUntil}.`,
    }),
    assertion({
      code: "projection_version_matches",
      passed:
        contract.projectionVersion === undefined ||
        view.projectionVersion === undefined ||
        contract.projectionVersion === view.projectionVersion,
      severity: "warn",
      refs: [view.subject],
      message:
        contract.projectionVersion === undefined ||
        view.projectionVersion === undefined ||
        contract.projectionVersion === view.projectionVersion
          ? "Projection version still matches the observation contract."
          : `Observation projection version ${contract.projectionVersion} differs from current version ${view.projectionVersion}.`,
    }),
    assertion({
      code: "workflow_position_matches",
      passed:
        contract.workflowPosition === undefined ||
        view.workflowPosition === undefined ||
        contract.workflowPosition === view.workflowPosition,
      severity: "warn",
      refs: [view.subject],
      message:
        contract.workflowPosition === undefined ||
        view.workflowPosition === undefined ||
        contract.workflowPosition === view.workflowPosition
          ? "Workflow position still matches the observation contract."
          : `Observation workflow position ${contract.workflowPosition} differs from current position ${view.workflowPosition}.`,
    }),
    assertion({
      code: "conflicts_declared",
      passed: conflictCountMatches,
      severity: "warn",
      refs: view.conflicts.flatMap((conflict) => conflict.refs),
      message: conflictCountMatches
        ? "Current conflicts match the observation contract declaration."
        : `Observation declared ${contract.declaredConflictCount} conflicts; current view has ${view.conflicts.length}.`,
    }),
    assertion({
      code: "missing_sources_declared",
      passed: !missingSourcesChanged,
      severity: "warn",
      refs: [],
      message: !missingSourcesChanged
        ? "Missing-source declarations still match the observation contract."
        : "Current missing-source declarations differ from the observation contract.",
    }),
  ];

  return {
    valid: assertions.every((item) => item.passed),
    contractId: contract.contractId,
    currentStateViewId: view.viewId,
    evaluatedAt,
    assertions,
  };
}

export function reviewProposedActionAgainstCurrentState(
  action: ProposedAction,
  view: CurrentStateView,
  optionsOrEvaluatedAt: ActionProposalReviewOptions | Timestamp = {},
): ActionProposalReview {
  const options =
    typeof optionsOrEvaluatedAt === "string"
      ? { evaluatedAt: optionsOrEvaluatedAt }
      : optionsOrEvaluatedAt;
  const evaluatedAt = options.evaluatedAt ?? action.proposedAt;
  const enforcementMode = options.enforcementMode ?? "advisory";
  const observationContract =
    options.observationContract ??
    action.observationContract ??
    buildObservationContractFromCurrentStateView(view);
  const observationEvaluation = evaluateObservationContract(
    observationContract,
    view,
    evaluatedAt,
  );
  const readSetValidation = validateProposedActionReadSet(action, view);
  const contractBindingWarnings = validateObservationContractBinding(
    observationContract,
    action,
  );
  const replayEvaluation =
    options.requireReplayCertificate === true
      ? evaluateProjectionReplayCertificate(view, {
          ...(options.expectedReplayAuthorityScope !== undefined
            ? { expectedAuthorityScope: options.expectedReplayAuthorityScope }
            : {}),
          ...(options.minimumReplayPosition !== undefined
            ? { minimumReplayPosition: options.minimumReplayPosition }
            : {}),
          ...(options.requireReplayTransitionContentHash !== undefined
            ? {
                requireTransitionContentHash:
                  options.requireReplayTransitionContentHash,
              }
            : {}),
        })
      : undefined;
  const replayWarnings =
    replayEvaluation?.issues.map((issue): ActionProposalWarning => ({
      source: "projection_replay",
      code: issue.code,
      severity: "fail",
      message: issue.message,
      refs: issue.ref ? [issue.ref] : [view.subject],
    })) ?? [];
  const recoveryCutEvaluation =
    options.requireRecoveryCut === true
      ? evaluateOperationalStateRecoveryCut(view, {
          ...(options.expectedRecoveryAuthorityScope !== undefined
            ? { expectedAuthorityScope: options.expectedRecoveryAuthorityScope }
            : {}),
        })
      : undefined;
  const recoveryWarnings =
    recoveryCutEvaluation?.issues.map((issue): ActionProposalWarning => ({
      source: "operational_recovery",
      code: issue.code,
      severity: "fail",
      message: issue.message,
      refs: [view.subject],
    })) ?? [];
  const recoveryCutAdmissionEvaluation =
    options.requireRecoveryCutAdmission === true
      ? evaluateOperationalStateRecoveryCutAdmission({
          view,
          ...(options.recoveryCutAdmissionReplay !== undefined
            ? { admissionReplay: options.recoveryCutAdmissionReplay }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessQuorum !== undefined
            ? {
                requireAdmissionWitnessQuorum:
                  options.requireRecoveryCutAdmissionWitnessQuorum,
              }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessAuthorityTopology !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTopology:
                  options.requireRecoveryCutAdmissionWitnessAuthorityTopology,
              }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmission !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmission:
                  options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmission,
              }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitness !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitness:
                  options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitness,
              }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology:
                  options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology,
              }
            : {}),
          ...(options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission:
                  options.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission,
              }
            : {}),
          ...(options.recoveryCutAdmissionWitnessReplay !== undefined
            ? {
                admissionWitnessReplay:
                  options.recoveryCutAdmissionWitnessReplay,
              }
            : {}),
        })
      : undefined;
  const recoveryCutAdmissionWarnings =
    recoveryCutAdmissionEvaluation?.issues.map(
      (issue): ActionProposalWarning => ({
        source: "operational_recovery_admission",
        code: issue.code,
        severity: "fail",
        message: issue.message,
        refs: [view.subject],
      }),
    ) ?? [];
  const recoveryTransparencyEvaluation =
    options.requireRecoveryTransparency === true
      ? evaluateOperationalStateRecoveryCutTransparency({
          ...(view.recoveryCut !== undefined ? { cut: view.recoveryCut } : {}),
          ...(options.recoveryTransparencyReplay !== undefined
            ? { transparencyReplay: options.recoveryTransparencyReplay }
            : {}),
          ...(options.requireRecoveryTransparencyObserverSignatures !== undefined
            ? {
                requireObserverSignatures:
                  options.requireRecoveryTransparencyObserverSignatures,
              }
            : {}),
          ...(options.requireRecoveryTransparencyRootSettlement !== undefined
            ? {
                requireRootSettlement:
                  options.requireRecoveryTransparencyRootSettlement,
              }
            : {}),
          ...(options
            .requireRecoveryTransparencyRootSettlementAuthorityTopology !==
          undefined
            ? {
                requireRootSettlementAuthorityTopology:
                  options
                    .requireRecoveryTransparencyRootSettlementAuthorityTopology,
              }
            : {}),
          ...(options
            .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmission !==
          undefined
            ? {
                requireRootSettlementAuthorityTransitionAdmission:
                  options
                    .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmission,
              }
            : {}),
          ...(options
            .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitness !==
          undefined
            ? {
                requireRootSettlementAuthorityTransitionAdmissionWitness:
                  options
                    .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitness,
              }
            : {}),
          ...(options
            .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology !==
          undefined
            ? {
                requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology:
                  options
                    .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology,
              }
            : {}),
          ...(options
            .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission !==
          undefined
            ? {
                requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission:
                  options
                    .requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission,
              }
            : {}),
          ...(options.recoveryTransparencyRootSettlementReplay !== undefined
            ? {
                rootSettlementReplay:
                  options.recoveryTransparencyRootSettlementReplay,
              }
            : {}),
        })
      : undefined;
  const recoveryTransparencyWarnings =
    recoveryTransparencyEvaluation?.issues.map(
      (issue): ActionProposalWarning => ({
        source: "operational_transparency",
        code: issue.code,
        severity: "fail",
        message: issue.message,
        refs: [view.subject],
      }),
    ) ?? [];
  const pruningPolicyEvaluation =
    options.requirePruningPolicyCompliance === true
      ? evaluateOperationalStateRecoveryCutAgainstPruningPolicy({
          ...(view.recoveryCut !== undefined ? { cut: view.recoveryCut } : {}),
          ...(options.pruningPolicyCompilation !== undefined
            ? { compilation: options.pruningPolicyCompilation }
            : {}),
          ...(recoveryTransparencyEvaluation !== undefined
            ? { transparencyEvaluation: recoveryTransparencyEvaluation }
            : {}),
        })
      : undefined;
  const pruningPolicyWarnings =
    pruningPolicyEvaluation?.issues.map((issue): ActionProposalWarning => ({
      source: "pruning_policy",
      code: issue.code,
      severity: "fail",
      message: issue.message,
      refs: [view.subject],
    })) ?? [];
  const pruningPolicyAdmissionEvaluation =
    options.requirePruningPolicyAdmission === true ||
    options.requirePruningPolicyPrivacyPreservingPolicyProof === true ||
    options.pruningPolicyPrivacyPreservingPolicyProof !== undefined ||
    options.requirePruningPolicyAdmissionWitnessQuorum === true ||
    options.requirePruningPolicyAdmissionWitnessAuthorityTopology === true ||
    options.requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmission ===
      true ||
    options
      .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitness ===
      true ||
    options
      .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology ===
      true ||
    options
      .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission ===
      true
      ? evaluateOperationalStatePruningPolicyAdmission({
          ...(options.pruningPolicyCompilation !== undefined
            ? { compilation: options.pruningPolicyCompilation }
            : {}),
          ...(options.pruningPolicyAdmissionReplay !== undefined
            ? { admissionReplay: options.pruningPolicyAdmissionReplay }
            : {}),
          ...(options.pruningPolicyPrivacyPreservingPolicyProof !== undefined
            ? {
                privacyPreservingPolicyProof:
                  options.pruningPolicyPrivacyPreservingPolicyProof,
              }
            : {}),
          ...(options.requirePruningPolicyPrivacyPreservingPolicyProof !==
          undefined
            ? {
                requirePrivacyPreservingPolicyProof:
                  options.requirePruningPolicyPrivacyPreservingPolicyProof,
              }
            : {}),
          ...(options
            .allowedPruningPolicyPrivacyPreservingPolicyProofVerifierIds !==
          undefined
            ? {
                allowedPrivacyPreservingPolicyProofVerifierIds:
                  options
                    .allowedPruningPolicyPrivacyPreservingPolicyProofVerifierIds,
              }
            : {}),
          ...(options.requirePruningPolicyAdmissionWitnessQuorum !== undefined
            ? {
                requireAdmissionWitnessQuorum:
                  options.requirePruningPolicyAdmissionWitnessQuorum,
              }
            : {}),
          ...(options.requirePruningPolicyAdmissionWitnessAuthorityTopology !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTopology:
                  options.requirePruningPolicyAdmissionWitnessAuthorityTopology,
              }
            : {}),
          ...(options
            .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmission !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmission:
                  options
                    .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmission,
              }
            : {}),
          ...(options
            .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitness !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitness:
                  options
                    .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitness,
              }
            : {}),
          ...(options
            .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology:
                  options
                    .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology,
              }
            : {}),
          ...(options
            .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission !==
          undefined
            ? {
                requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission:
                  options
                    .requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission,
              }
            : {}),
          ...(options.pruningPolicyAdmissionWitnessReplay !== undefined
            ? {
                admissionWitnessReplay:
                  options.pruningPolicyAdmissionWitnessReplay,
              }
            : {}),
        })
      : undefined;
  const pruningPolicyAdmissionWarnings =
    pruningPolicyAdmissionEvaluation?.issues.map(
      (issue): ActionProposalWarning => ({
        source: "pruning_policy_admission",
        code: issue.code,
        severity: "fail",
        message: issue.message,
        refs: [view.subject],
      }),
    ) ?? [];
  const warnings = [
    ...readSetValidation.issues.map((issue): ActionProposalWarning => ({
      source: "read_set",
      code: issue.code,
      severity: "warn",
      message: issue.message,
      refs: issue.ref ? [issue.ref] : [],
    })),
    ...observationEvaluation.assertions
      .filter((assertion) => !assertion.passed)
      .map((assertion): ActionProposalWarning => ({
        source: "observation_contract",
        code: assertion.code,
        severity: assertion.severity,
        message: assertion.message,
        refs: assertion.refs,
    })),
    ...contractBindingWarnings,
    ...replayWarnings,
    ...recoveryWarnings,
    ...recoveryCutAdmissionWarnings,
    ...recoveryTransparencyWarnings,
    ...pruningPolicyWarnings,
    ...pruningPolicyAdmissionWarnings,
  ] as const;
  const blocking =
    enforcementMode === "blocking" &&
    (!readSetValidation.valid ||
      !observationEvaluation.valid ||
      contractBindingWarnings.length > 0 ||
      replayWarnings.length > 0 ||
      recoveryWarnings.length > 0 ||
      recoveryCutAdmissionWarnings.length > 0 ||
      recoveryTransparencyWarnings.length > 0 ||
      pruningPolicyWarnings.length > 0 ||
      pruningPolicyAdmissionWarnings.length > 0);

  return {
    tenantId: action.tenantId,
    reviewId: `${view.viewId}:${action.actionType}:proposal_review`,
    mode: "warn",
    valid:
      readSetValidation.valid &&
      observationEvaluation.valid &&
      contractBindingWarnings.length === 0 &&
      replayWarnings.length === 0 &&
      recoveryWarnings.length === 0 &&
      recoveryCutAdmissionWarnings.length === 0 &&
      recoveryTransparencyWarnings.length === 0 &&
      pruningPolicyWarnings.length === 0 &&
      pruningPolicyAdmissionWarnings.length === 0,
    proposedAction: action,
    currentStateView: view,
    observationContract,
    observationEvaluation,
    readSetValidation,
    warnings,
    execution: {
      allowed: enforcementMode === "advisory" || !blocking,
      blocking,
      enforcementMode,
      reason:
        enforcementMode === "advisory"
          ? "advisory_warn_first_v1"
          : blocking
            ? "blocking_policy_failed"
            : "blocking_policy_passed",
      warningCount: warnings.length,
    },
  };
}

/**
 * Compute the canonical integrity hash for an observation contract (v2
 * field). The hash covers every contract field except `integrityHash` itself.
 */
export function computeObservationContractIntegrityHash(
  contract: ObservationContract,
): string {
  const { integrityHash: _ignored, ...payload } = contract;
  return fingerprint64(canonicalStringify(payload));
}

export interface ObservationContractIntegrityValidation {
  readonly valid: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export function verifyObservationContractIntegrity(
  contract: ObservationContract,
): ObservationContractIntegrityValidation | undefined {
  if (contract.integrityHash === undefined) return undefined;
  const expectedHash = computeObservationContractIntegrityHash(contract);
  return {
    valid: contract.integrityHash === expectedHash,
    expectedHash,
    actualHash: contract.integrityHash,
  };
}

/**
 * Validate v2 observation-contract bindings against the proposed action:
 * holder binding (DPoP-style), allowed use, and integrity hash (Arrowsmith
 * v04). Contracts without v2 fields produce no warnings.
 */
export function validateObservationContractBinding(
  contract: ObservationContract,
  action: ProposedAction,
): readonly ActionProposalWarning[] {
  const warnings: ActionProposalWarning[] = [];

  if (
    contract.holderBinding !== undefined &&
    contract.holderBinding !== action.proposedBy
  ) {
    warnings.push({
      source: "contract_binding",
      code: "holder_binding_mismatch",
      severity: "warn",
      message: `Observation contract is bound to holder ${contract.holderBinding}; action was proposed by ${action.proposedBy}.`,
      refs: [contract.subject],
    });
  }

  if (
    contract.allowedUse !== undefined &&
    !contract.allowedUse.includes(action.actionType)
  ) {
    warnings.push({
      source: "contract_binding",
      code: "allowed_use_mismatch",
      severity: "warn",
      message: `Observation contract allows use for [${contract.allowedUse.join(", ")}]; action type ${action.actionType} is outside the allowed use.`,
      refs: [contract.subject],
    });
  }

  const integrity = verifyObservationContractIntegrity(contract);
  if (integrity !== undefined && !integrity.valid) {
    warnings.push({
      source: "contract_binding",
      code: "integrity_hash_mismatch",
      severity: "warn",
      message: `Observation contract integrity hash ${integrity.actualHash} does not match recomputed hash ${integrity.expectedHash}; the contract content changed after issuance.`,
      refs: [contract.subject],
    });
  }

  return warnings;
}

export function buildStateReviewArtifact(
  review: ActionProposalReview,
  options: StateReviewArtifactOptions = {},
): StateReviewArtifact {
  const artifactId = options.artifactId ?? `${review.reviewId}:artifact`;
  const generatedAt = options.generatedAt ?? review.observationEvaluation.evaluatedAt;
  const source = options.source ?? "pm-substrate/agent-state";
  const eventType = options.eventType ?? STATE_REVIEW_EVENT_TYPE;
  const provenanceLinks: StateReviewProvenanceLink[] = [
    {
      relation: "wasGeneratedBy",
      id: review.reviewId,
      role: "action_proposal_review",
    },
    {
      relation: "wasAssociatedWith",
      id: review.proposedAction.proposedBy,
      role: "proposed_by",
    },
  ];
  if (options.planId !== undefined) {
    provenanceLinks.push({
      relation: "hadPlan",
      id: options.planId,
      role: "review_plan",
    });
  }
  if (options.actedOnBehalfOf !== undefined) {
    provenanceLinks.push({
      relation: "actedOnBehalfOf",
      id: options.actedOnBehalfOf,
      role: "delegated_authority",
    });
  }
  provenanceLinks.push(...(options.provenanceLinks ?? []));

  const payload: StateReviewArtifactHashPayload = {
    schemaVersion: STATE_REVIEW_ARTIFACT_SCHEMA_VERSION,
    artifactId,
    generatedAt,
    eventEnvelope: {
      id: artifactId,
      source,
      type: eventType,
      specversion: STATE_REVIEW_EVENT_SPEC_VERSION,
      time: generatedAt,
      subject: formatStateRef(review.currentStateView.subject),
    },
    ...(options.traceContext !== undefined
      ? { traceContext: options.traceContext }
      : {}),
    relatedObjects: dedupeRelatedObjects([
      { role: "primary_subject", ref: review.currentStateView.subject },
      { role: "action_subject", ref: review.proposedAction.subject },
      ...review.currentStateView.sourceRefs.map((ref) => ({
        role: "source_ref",
        ref,
      })),
      ...review.proposedAction.readSet.map((entry) => ({
        role: "read_set_ref",
        ref: entry.ref,
      })),
      ...review.warnings.flatMap((warning) =>
        warning.refs.map((ref) => ({
          role: `warning:${warning.code}`,
          ref,
        })),
      ),
      ...(options.relatedObjects ?? []),
    ]),
    provenance: {
      generatedBy: review.reviewId,
      used: uniqueStateRefs([
        review.currentStateView.subject,
        review.proposedAction.subject,
        ...review.currentStateView.sourceRefs,
        ...review.proposedAction.readSet.map((entry) => entry.ref),
      ]),
      derivedFrom: uniqueStateRefs([
        ...review.observationContract.requiredSourceRefs,
      ]),
      associatedAgent: review.proposedAction.proposedBy,
      ...(options.actedOnBehalfOf !== undefined
        ? { actedOnBehalfOf: options.actedOnBehalfOf }
        : {}),
      ...(options.planId !== undefined ? { planId: options.planId } : {}),
      links: provenanceLinks,
    },
    metadata: buildStateReviewArtifactMetadata(review, options.metadata),
    review,
  };

  return {
    ...payload,
    artifactHash: computeStateReviewArtifactHash(payload),
  };
}

export function serializeStateReviewArtifact(
  artifact: StateReviewArtifact,
): string {
  return canonicalStringify(artifact);
}

export function serializeStateReviewArtifactsJsonl(
  artifacts: readonly StateReviewArtifact[],
): string {
  if (artifacts.length === 0) return "";
  return `${artifacts.map(serializeStateReviewArtifact).join("\n")}\n`;
}

export function importStateReviewArtifact(
  input: string | unknown,
): StateReviewArtifactImportResult {
  let parsed: unknown;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      return {
        valid: false,
        issues: [
          {
            path: "",
            message: `invalid state-review artifact JSON: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  } else {
    parsed = input;
  }

  const issues: StateReviewArtifactImportIssue[] = [];
  validateStateReviewArtifactShape(parsed, issues);
  const artifact = isRecord(parsed) ? (parsed as unknown as StateReviewArtifact) : undefined;
  const hashValidation =
    artifact !== undefined && typeof artifact.artifactHash === "string"
      ? verifyStateReviewArtifactHash(artifact)
      : undefined;

  if (hashValidation !== undefined && !hashValidation.valid) {
    issues.push({
      path: "/artifactHash",
      message: "artifact hash mismatch during replay verification",
    });
  }

  return {
    valid: issues.length === 0,
    ...(artifact !== undefined ? { artifact } : {}),
    ...(hashValidation !== undefined ? { hashValidation } : {}),
    issues,
  };
}

export function importStateReviewArtifactsJsonl(
  input: string,
): readonly StateReviewArtifactImportResult[] {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => importStateReviewArtifact(line));
}

export function computeStateReviewArtifactHash(
  artifact: StateReviewArtifactHashPayload,
): string {
  return fingerprint64(canonicalStringify(artifact));
}

export function verifyStateReviewArtifactHash(
  artifact: StateReviewArtifact,
): StateReviewArtifactHashValidation {
  const { artifactHash, ...payload } = artifact;
  const expectedHash = computeStateReviewArtifactHash(payload);

  return {
    valid: artifactHash === expectedHash,
    expectedHash,
    actualHash: artifactHash,
  };
}

export function buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact(
  artifact: StateReviewArtifact,
  options: StateReviewArtifactContinuityPayloadOptions = {},
): StateReviewArtifactContinuityPayload {
  const view = artifact.review.currentStateView;
  const payload: StateReviewArtifactContinuityPayload = {
    sourceRefs: view.sourceRefs,
    ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
    supersedes: options.supersedes ?? [],
    contradictedBy: options.contradictedBy ?? [],
    authorityRule: view.authorityRule,
    currentStateViewId: view.viewId,
    stateReviewArtifactId: artifact.artifactId,
    stateReviewArtifactHash: artifact.artifactHash,
    reviewId: artifact.review.reviewId,
    observationContractId: artifact.review.observationContract.contractId,
    valid: artifact.review.valid,
    warningCodes: uniqueStrings(artifact.review.warnings.map((warning) => warning.code)),
  };
  return payload;
}

export function validateProposedActionReadSet(
  action: ProposedAction,
  view: CurrentStateView,
): ReadSetValidationDecision {
  const issues: ReadSetValidationIssue[] = [];
  const allowedAction = view.allowedActions.find(
    (candidate) => candidate.actionType === action.actionType,
  );

  if (action.tenantId !== view.tenantId) {
    issues.push({
      code: "tenant_mismatch",
      path: "/tenantId",
      message: `Proposed action tenant ${action.tenantId} does not match current state view tenant ${view.tenantId}.`,
    });
  }

  if (!sameStateRef(action.subject, view.subject)) {
    issues.push({
      code: "subject_mismatch",
      path: "/subject",
      message: `Proposed action subject ${formatStateRef(action.subject)} does not match current state view subject ${formatStateRef(view.subject)}.`,
      ref: action.subject,
    });
  }

  if (!allowedAction) {
    issues.push({
      code: "action_not_allowed",
      path: "/actionType",
      message: `Action type ${action.actionType} is not listed in the current state view allowed actions.`,
    });
  }

  for (const [index, conflict] of view.conflicts.entries()) {
    issues.push({
      code: "current_view_conflict",
      path: `/conflicts/${index}`,
      message: conflict.message,
      ...(conflict.refs[0] ? { ref: conflict.refs[0] } : {}),
    });
  }

  if (allowedAction) {
    for (const ref of allowedAction.requiredRefs) {
      if (!action.readSet.some((entry) => sameStateRef(entry.ref, ref))) {
        issues.push({
          code: "missing_read_ref",
          path: "/readSet",
          message: `Proposed action did not cite required state ref ${formatStateRef(ref)}.`,
          ref,
        });
      }
    }

    for (const required of allowedAction.requiredRelatedRoles ?? []) {
      const bound = (action.relatedSubjects ?? []).find(
        (subject) => subject.role === required.role,
      );
      if (bound === undefined) {
        issues.push({
          code: "missing_related_object_role",
          path: "/relatedSubjects",
          message: `Action ${action.actionType} requires a related object bound to role ${required.role}; none was provided.`,
        });
        continue;
      }
      if (required.refKind !== undefined && bound.ref.kind !== required.refKind) {
        issues.push({
          code: "related_object_role_mismatch",
          path: "/relatedSubjects",
          message: `Related object for role ${required.role} must be of kind ${required.refKind}; got ${bound.ref.kind} (${formatStateRef(bound.ref)}).`,
          ref: bound.ref,
        });
      }
    }
  }

  for (const [index, missingSource] of view.missingSources.entries()) {
    issues.push({
      code: "missing_read_ref",
      path: `/missingSources/${index}`,
      message: `Current state view is missing required source ${missingSource}.`,
    });
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.validUntil !== undefined && isAfter(action.proposedAt, entry.validUntil)) {
      issues.push({
        code: "stale_read_ref",
        path: `/readSet/${index}/validUntil`,
        message: `Read-set ref ${formatStateRef(entry.ref)} expired at ${entry.validUntil} before action proposal at ${action.proposedAt}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.authority !== view.authorityRule) {
      issues.push({
        code: "authority_mismatch",
        path: `/readSet/${index}/authority`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used authority ${entry.authority}; current view requires ${view.authorityRule}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (
      entry.projectionVersion !== undefined &&
      view.projectionVersion !== undefined &&
      entry.projectionVersion !== view.projectionVersion
    ) {
      issues.push({
        code: "projection_version_mismatch",
        path: `/readSet/${index}/projectionVersion`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used projection version ${entry.projectionVersion}; current view is ${view.projectionVersion}.`,
        ref: entry.ref,
      });
    }
  }

  if (
    allowedAction?.requiredWorkflowPosition !== undefined &&
    view.workflowPosition !== undefined &&
    allowedAction.requiredWorkflowPosition !== view.workflowPosition
  ) {
    issues.push({
      code: "workflow_position_mismatch",
      path: "/workflowPosition",
      message: `Action ${action.actionType} requires workflow position ${allowedAction.requiredWorkflowPosition}; current position is ${view.workflowPosition}.`,
    });
  }

  return { valid: issues.length === 0, mode: "warn", issues };
}

function sameStateRef(left: StateRef, right: StateRef): boolean {
  return left.kind === right.kind && left.id === right.id;
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function uniqueStateRefs(refs: readonly StateRef[]): readonly StateRef[] {
  const seen = new Set<string>();
  const out: StateRef[] = [];

  for (const ref of refs) {
    const key = formatStateRef(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }

  return out;
}

function dedupeRelatedObjects(
  objects: readonly StateReviewRelatedObject[],
): readonly StateReviewRelatedObject[] {
  const seen = new Set<string>();
  const out: StateReviewRelatedObject[] = [];

  for (const object of objects) {
    const key = `${object.role}:${formatStateRef(object.ref)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(object);
  }

  return out;
}

function blockingCausesFromProposalReview(
  review: ActionProposalReview | undefined,
): readonly ActionOutcomeBlockingCause[] {
  if (review === undefined || !review.execution.blocking) return [];
  return [
    {
      source: "proposal_review",
      code: "proposal_review_blocking_policy",
      message: `Action proposal review ${review.reviewId} was evaluated in blocking mode and did not pass.`,
      refs: uniqueStateRefs([
        review.currentStateView.subject,
        ...review.warnings.flatMap((warning) => warning.refs),
      ]),
      invariantClasses: inferStateReviewInvariantClasses(review),
    },
  ];
}

function blockingCausesFromEvidenceAdmissions(
  reviews: readonly EvidenceAdmissionReview[],
  consequence: StateReviewActionConsequence,
): readonly ActionOutcomeBlockingCause[] {
  const causes: ActionOutcomeBlockingCause[] = [];
  for (const review of reviews) {
    if (review.decision === "rejected") {
      causes.push({
        source: "evidence_admission",
        code: "evidence_admission_rejected",
        message: `Evidence admission review ${review.reviewId} rejected evidence ${review.evidence.evidenceId}.`,
        refs: uniqueStateRefs([
          ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
          ...review.evidence.refs,
        ]),
        invariantClasses: review.invariantClasses,
      });
      continue;
    }

    const policy = evaluateStateReviewInvariantPolicy(
      review.invariantClasses,
      consequence,
    );
    if (!policy.wouldBlock) continue;

    const blockingClasses = new Set(policy.wouldBlockInvariantClasses);
    for (const issue of review.issues) {
      const issueClasses = review.invariantClasses.filter((item) =>
        blockingClasses.has(item),
      );
      causes.push({
        source: "evidence_admission",
        code: issue.code,
        message: issue.message,
        refs: uniqueStateRefs([
          ...(issue.ref !== undefined ? [issue.ref] : []),
          ...(review.evidence.subject !== undefined ? [review.evidence.subject] : []),
          ...review.evidence.refs,
        ]),
        invariantClasses: issueClasses,
      });
    }
  }
  return causes;
}

function workflowBlockingCauses(
  workflowEnvelope: WorkflowInvocationActionOutcomeEnvelopeSource,
): readonly ActionOutcomeBlockingCause[] {
  if (workflowEnvelope.evidenceDecision.valid) return [];
  const reason =
    workflowEnvelope.evidenceDecision.reason ?? "workflow_evidence_gate_blocked";
  return [
    {
      source: "policy",
      code: reason,
      message: `Workflow evidence-binding gate produced blocked terminal outcome ${workflowEnvelope.envelopeId} for ${workflowEnvelope.capability}.`,
      refs: uniqueStateRefs([
        stateRef(
          "action_outcome_envelope",
          workflowEnvelope.envelopeId,
          "Workflow action outcome envelope",
        ),
        stateRef(
          "workflow_run",
          workflowEnvelope.workflowId,
          workflowEnvelope.workflowName,
        ),
        stateRef(
          "capability_invocation",
          `${workflowEnvelope.workflowId}:${workflowEnvelope.workflowVersion}:${workflowEnvelope.nodeId}:${workflowEnvelope.triggerEventId}`,
          workflowEnvelope.capability,
        ),
      ]),
    },
  ];
}

function dedupeBlockingCauses(
  causes: readonly ActionOutcomeBlockingCause[],
): readonly ActionOutcomeBlockingCause[] {
  const seen = new Set<string>();
  const out: ActionOutcomeBlockingCause[] = [];
  for (const cause of causes) {
    const key = `${cause.source}:${cause.code}:${cause.message}:${cause.refs.map(formatStateRef).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...cause,
      refs: uniqueStateRefs(cause.refs),
      ...(cause.invariantClasses !== undefined
        ? { invariantClasses: uniqueStrings(cause.invariantClasses) }
        : {}),
    });
  }
  return out;
}

function buildStateReviewArtifactMetadata(
  review: ActionProposalReview,
  input: StateReviewArtifactMetadataInput | undefined,
): StateReviewArtifactMetadata {
  const observedReadSetComparison =
    input?.observedReadSet !== undefined
      ? compareObservedReadSetToDeclared(
          review.proposedAction.readSet,
          input.observedReadSet,
          review.currentStateView,
          review.proposedAction.proposedAt,
        )
      : input?.observedReadSetComparison;

  return {
    temporalMisalignmentPhase:
      input?.temporalMisalignmentPhase ??
      inferTemporalMisalignmentPhase(review),
    invariantClasses:
      input?.invariantClasses ?? inferStateReviewInvariantClasses(review),
    ...(input?.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    ...(input?.fixtureId !== undefined ? { fixtureId: input.fixtureId } : {}),
    ...(input?.clientSurface !== undefined
      ? { clientSurface: input.clientSurface }
      : {}),
    ...(input?.provider !== undefined ? { provider: input.provider } : {}),
    ...(input?.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input?.workflowRunId !== undefined
      ? { workflowRunId: input.workflowRunId }
      : {}),
    ...(input?.runGroupId !== undefined
      ? { runGroupId: input.runGroupId }
      : {}),
    ...(input?.evalEventIds !== undefined
      ? { evalEventIds: input.evalEventIds }
      : {}),
    ...(input?.evidenceAdmissions !== undefined
      ? { evidenceAdmissions: input.evidenceAdmissions }
      : {}),
    ...(input?.observedReadSet !== undefined
      ? { observedReadSet: input.observedReadSet }
      : {}),
    ...(observedReadSetComparison !== undefined
      ? { observedReadSetComparison }
      : {}),
  };
}

function inferTemporalMisalignmentPhase(
  review: ActionProposalReview,
): StateReviewTemporalMisalignmentPhase {
  return review.warnings.length === 0 ? "none" : "observation_to_action";
}

function inferStateReviewInvariantClasses(
  review: ActionProposalReview,
): readonly StateReviewInvariantClass[] {
  return uniqueStrings(
    review.warnings.flatMap((warning) => invariantClassesForWarningCode(warning.code)),
  ) as readonly StateReviewInvariantClass[];
}

function invariantClassesForWarningCode(
  code: string,
): readonly StateReviewInvariantClass[] {
  switch (code) {
    case "subject_mismatch":
      return ["subject_identity"];
    case "tenant_mismatch":
      return ["tenant_boundary"];
    case "missing_read_ref":
    case "required_source_refs_present":
    case "missing_sources_declared":
      return ["required_evidence"];
    case "stale_read_ref":
    case "freshness_window_current":
      return ["freshness_window"];
    case "authority_mismatch":
    case "authority_rule_matches":
      return ["source_authority"];
    case "projection_version_mismatch":
    case "projection_version_matches":
      return ["projection_version"];
    case "projection_replay_certificate_missing":
    case "projection_replay_certificate_hash_mismatch":
    case "projection_replay_tenant_mismatch":
    case "projection_replay_subject_mismatch":
    case "projection_replay_version_mismatch":
    case "projection_replay_authority_scope_mismatch":
    case "projection_replay_source_refs_mismatch":
    case "projection_replay_projection_hash_mismatch":
    case "projection_replay_transition_history_hash_mismatch":
    case "projection_replay_transition_history_empty":
    case "projection_replay_transition_kind_invalid":
    case "projection_replay_transition_hash_missing":
    case "projection_replay_position_regression":
      return ["projection_replay"];
    case "workflow_position_mismatch":
    case "workflow_position_matches":
      return ["workflow_position"];
    case "current_view_conflict":
    case "conflicts_declared":
      return ["state_conflict"];
    case "action_not_allowed":
    case "allowed_use_mismatch":
      return ["capability_contract"];
    case "missing_related_object_role":
    case "related_object_role_mismatch":
    case "holder_binding_mismatch":
      return ["subject_identity"];
    case "integrity_hash_mismatch":
      return ["required_evidence"];
    default:
      return [];
  }
}

function validateStateReviewArtifactShape(
  input: unknown,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isRecord(input)) {
    issues.push({ path: "", message: "expected state-review artifact object" });
    return;
  }

  if (input["schemaVersion"] !== STATE_REVIEW_ARTIFACT_SCHEMA_VERSION) {
    issues.push({
      path: "/schemaVersion",
      message: `expected ${STATE_REVIEW_ARTIFACT_SCHEMA_VERSION}`,
    });
  }
  if (!isNonEmptyString(input["artifactId"])) {
    issues.push({ path: "/artifactId", message: "expected non-empty string" });
  }
  if (!isNonEmptyString(input["generatedAt"])) {
    issues.push({ path: "/generatedAt", message: "expected non-empty timestamp" });
  }
  if (!isRecord(input["eventEnvelope"])) {
    issues.push({ path: "/eventEnvelope", message: "expected object" });
  } else {
    validateStateReviewEventEnvelopeShape(input["eventEnvelope"], issues);
  }
  if (!isRecord(input["provenance"])) {
    issues.push({ path: "/provenance", message: "expected object" });
  } else {
    validateStateReviewProvenanceShape(input["provenance"], issues);
  }
  if (!isRecord(input["metadata"])) {
    issues.push({ path: "/metadata", message: "expected object" });
  } else {
    validateStateReviewMetadataShape(input["metadata"], issues);
  }
  if (!isRecord(input["review"])) {
    issues.push({ path: "/review", message: "expected object" });
  } else {
    validateActionProposalReviewShape(input["review"], issues);
  }
  if (!isNonEmptyString(input["artifactHash"])) {
    issues.push({ path: "/artifactHash", message: "expected non-empty string" });
  }
}

function validateStateReviewEventEnvelopeShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "id", "/eventEnvelope/id", issues);
  validateNonEmptyStringField(input, "source", "/eventEnvelope/source", issues);
  validateNonEmptyStringField(input, "type", "/eventEnvelope/type", issues);
  validateNonEmptyStringField(input, "time", "/eventEnvelope/time", issues);
  validateNonEmptyStringField(input, "subject", "/eventEnvelope/subject", issues);
  if (input["specversion"] !== STATE_REVIEW_EVENT_SPEC_VERSION) {
    issues.push({
      path: "/eventEnvelope/specversion",
      message: `expected ${STATE_REVIEW_EVENT_SPEC_VERSION}`,
    });
  }
}

function validateStateReviewProvenanceShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "generatedBy", "/provenance/generatedBy", issues);
  validateNonEmptyStringField(
    input,
    "associatedAgent",
    "/provenance/associatedAgent",
    issues,
  );
  validateArrayField(input, "used", "/provenance/used", issues);
  validateArrayField(input, "derivedFrom", "/provenance/derivedFrom", issues);
  validateArrayField(input, "links", "/provenance/links", issues);
}

function validateStateReviewMetadataShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isStateReviewTemporalMisalignmentPhase(input["temporalMisalignmentPhase"])) {
    issues.push({
      path: "/metadata/temporalMisalignmentPhase",
      message: "expected supported temporal misalignment phase",
    });
  }

  const invariantClasses = input["invariantClasses"];
  if (!Array.isArray(invariantClasses)) {
    issues.push({
      path: "/metadata/invariantClasses",
      message: "expected array",
    });
    return;
  }

  for (const [index, invariantClass] of invariantClasses.entries()) {
    if (!isStateReviewInvariantClass(invariantClass)) {
      issues.push({
        path: `/metadata/invariantClasses/${index}`,
        message: "expected supported invariant class",
      });
    }
  }

  if (input["observedReadSet"] !== undefined) {
    if (validateArrayField(input, "observedReadSet", "/metadata/observedReadSet", issues)) {
      validateObservedReadSetArray(
        input["observedReadSet"] as readonly unknown[],
        "/metadata/observedReadSet",
        issues,
      );
    }
  }

  if (input["observedReadSetComparison"] !== undefined) {
    const comparison = validateRecordField(
      input,
      "observedReadSetComparison",
      "/metadata/observedReadSetComparison",
      issues,
    );
    if (comparison) {
      validateObservedReadSetComparisonShape(
        comparison,
        "/metadata/observedReadSetComparison",
        issues,
      );
    }
  }

  validateOptionalStringField(input, "runGroupId", "/metadata/runGroupId", issues);

  if (input["evidenceAdmissions"] !== undefined) {
    if (
      validateArrayField(
        input,
        "evidenceAdmissions",
        "/metadata/evidenceAdmissions",
        issues,
      )
    ) {
      validateEvidenceAdmissionArray(
        input["evidenceAdmissions"] as readonly unknown[],
        "/metadata/evidenceAdmissions",
        issues,
      );
    }
  }
}

function validateEvidenceAdmissionArray(
  admissions: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, admission] of admissions.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(admission)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateNonEmptyStringField(admission, "reviewId", `${itemPath}/reviewId`, issues);
    validateNonEmptyStringField(admission, "tenantId", `${itemPath}/tenantId`, issues);
    validateNonEmptyStringField(
      admission,
      "evaluatedAt",
      `${itemPath}/evaluatedAt`,
      issues,
    );
    if (
      admission["decision"] !== "admitted" &&
      admission["decision"] !== "admitted_with_warnings" &&
      admission["decision"] !== "rejected"
    ) {
      issues.push({
        path: `${itemPath}/decision`,
        message: "expected admitted|admitted_with_warnings|rejected",
      });
    }
    if (admission["authorityStatus"] !== "evidence_only") {
      issues.push({
        path: `${itemPath}/authorityStatus`,
        message: "expected evidence_only",
      });
    }
    validateRecordField(admission, "evidence", `${itemPath}/evidence`, issues);
    validateArrayField(admission, "issues", `${itemPath}/issues`, issues);
  }
}

function validateObservedReadSetComparisonShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateBooleanField(input, "valid", `${path}/valid`, issues);
  if (input["mode"] !== "warn") {
    issues.push({ path: `${path}/mode`, message: "expected warn" });
  }

  if (validateArrayField(input, "declaredReadSet", `${path}/declaredReadSet`, issues)) {
    validateDeclaredReadSetArray(
      input["declaredReadSet"] as readonly unknown[],
      `${path}/declaredReadSet`,
      issues,
    );
  }
  if (validateArrayField(input, "observedReadSet", `${path}/observedReadSet`, issues)) {
    validateObservedReadSetArray(
      input["observedReadSet"] as readonly unknown[],
      `${path}/observedReadSet`,
      issues,
    );
  }
  if (validateArrayField(input, "issues", `${path}/issues`, issues)) {
    validateObservedReadSetIssueArray(
      input["issues"] as readonly unknown[],
      `${path}/issues`,
      issues,
    );
  }
}

function validateDeclaredReadSetArray(
  readSet: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, entry] of readSet.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(entry)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateReadSetEntryShape(entry, itemPath, issues);
  }
}

function validateObservedReadSetArray(
  readSet: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, entry] of readSet.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(entry)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateReadSetEntryShape(entry, itemPath, issues);
    validateOptionalStringField(entry, "workflowPosition", `${itemPath}/workflowPosition`, issues);
    validateOptionalStringField(entry, "source", `${itemPath}/source`, issues);
    validateOptionalStringField(entry, "tool", `${itemPath}/tool`, issues);
  }
}

function validateReadSetEntryShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  const ref = validateRecordField(input, "ref", `${path}/ref`, issues);
  if (ref) {
    validateStateRefShape(ref, `${path}/ref`, issues);
  }
  validateNonEmptyStringField(input, "observedAt", `${path}/observedAt`, issues);
  validateNonEmptyStringField(input, "authority", `${path}/authority`, issues);
  validateOptionalStringField(input, "validUntil", `${path}/validUntil`, issues);
  validateOptionalNumberField(
    input,
    "projectionVersion",
    `${path}/projectionVersion`,
    issues,
  );
}

function validateStateRefShape(
  input: Record<string, unknown>,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "kind", `${path}/kind`, issues);
  validateNonEmptyStringField(input, "id", `${path}/id`, issues);
  validateOptionalStringField(input, "label", `${path}/label`, issues);
}

function validateObservedReadSetIssueArray(
  readSetIssues: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, issue] of readSetIssues.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(issue)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    if (!isObservedReadSetIssueCode(issue["code"])) {
      issues.push({
        path: `${itemPath}/code`,
        message: "expected supported observed read-set issue code",
      });
    }
    validateNonEmptyStringField(issue, "path", `${itemPath}/path`, issues);
    validateNonEmptyStringField(issue, "message", `${itemPath}/message`, issues);
    validateOptionalNonNegativeIntegerField(
      issue,
      "declaredIndex",
      `${itemPath}/declaredIndex`,
      issues,
    );
    validateOptionalNonNegativeIntegerField(
      issue,
      "observedIndex",
      `${itemPath}/observedIndex`,
      issues,
    );
    if (issue["ref"] !== undefined) {
      const ref = validateRecordField(issue, "ref", `${itemPath}/ref`, issues);
      if (ref) {
        validateStateRefShape(ref, `${itemPath}/ref`, issues);
      }
    }
  }
}

function validateActionProposalReviewShape(
  input: Record<string, unknown>,
  issues: StateReviewArtifactImportIssue[],
): void {
  validateNonEmptyStringField(input, "reviewId", "/review/reviewId", issues);
  validateNonEmptyStringField(input, "tenantId", "/review/tenantId", issues);
  if (input["mode"] !== "warn") {
    issues.push({ path: "/review/mode", message: "expected warn" });
  }
  validateBooleanField(input, "valid", "/review/valid", issues);
  validateRecordField(input, "proposedAction", "/review/proposedAction", issues);
  const currentStateView = validateRecordField(
    input,
    "currentStateView",
    "/review/currentStateView",
    issues,
  );
  if (currentStateView) {
    validateNonEmptyStringField(
      currentStateView,
      "viewId",
      "/review/currentStateView/viewId",
      issues,
    );
    validateNonEmptyStringField(
      currentStateView,
      "authorityRule",
      "/review/currentStateView/authorityRule",
      issues,
    );
    validateArrayField(
      currentStateView,
      "sourceRefs",
      "/review/currentStateView/sourceRefs",
      issues,
    );
  }

  const observationContract = validateRecordField(
    input,
    "observationContract",
    "/review/observationContract",
    issues,
  );
  if (observationContract) {
    validateNonEmptyStringField(
      observationContract,
      "contractId",
      "/review/observationContract/contractId",
      issues,
    );
  }

  const observationEvaluation = validateRecordField(
    input,
    "observationEvaluation",
    "/review/observationEvaluation",
    issues,
  );
  if (observationEvaluation) {
    if (validateArrayField(
      observationEvaluation,
      "assertions",
      "/review/observationEvaluation/assertions",
      issues,
    )) {
      validateStateAssertionArray(
        observationEvaluation["assertions"] as readonly unknown[],
        "/review/observationEvaluation/assertions",
        issues,
      );
    }
  }

  validateRecordField(input, "readSetValidation", "/review/readSetValidation", issues);
  const execution = validateRecordField(input, "execution", "/review/execution", issues);
  if (execution) {
    validateBooleanField(execution, "allowed", "/review/execution/allowed", issues);
    validateBooleanField(execution, "blocking", "/review/execution/blocking", issues);
    validateNonEmptyStringField(
      execution,
      "enforcementMode",
      "/review/execution/enforcementMode",
      issues,
    );
  }
  if (validateArrayField(input, "warnings", "/review/warnings", issues)) {
    validateActionProposalWarningArray(
      input["warnings"] as readonly unknown[],
      "/review/warnings",
      issues,
    );
  }
}

function validateStateAssertionArray(
  assertions: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, assertion] of assertions.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(assertion)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    validateNonEmptyStringField(assertion, "code", `${itemPath}/code`, issues);
    validateBooleanField(assertion, "passed", `${itemPath}/passed`, issues);
    validateNonEmptyStringField(assertion, "message", `${itemPath}/message`, issues);
    validateArrayField(assertion, "refs", `${itemPath}/refs`, issues);
    if (
      assertion["severity"] !== "info" &&
      assertion["severity"] !== "warn" &&
      assertion["severity"] !== "fail"
    ) {
      issues.push({
        path: `${itemPath}/severity`,
        message: "expected info|warn|fail",
      });
    }
  }
}

function validateActionProposalWarningArray(
  warnings: readonly unknown[],
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  for (const [index, warning] of warnings.entries()) {
    const itemPath = `${path}/${index}`;
    if (!isRecord(warning)) {
      issues.push({ path: itemPath, message: "expected object" });
      continue;
    }
    if (
      warning["source"] !== "read_set" &&
      warning["source"] !== "observation_contract" &&
      warning["source"] !== "contract_binding" &&
      warning["source"] !== "projection_replay"
    ) {
      issues.push({
        path: `${itemPath}/source`,
        message:
          "expected read_set|observation_contract|contract_binding|projection_replay",
      });
    }
    validateNonEmptyStringField(warning, "code", `${itemPath}/code`, issues);
    validateNonEmptyStringField(warning, "message", `${itemPath}/message`, issues);
    validateArrayField(warning, "refs", `${itemPath}/refs`, issues);
    if (
      warning["severity"] !== "info" &&
      warning["severity"] !== "warn" &&
      warning["severity"] !== "fail"
    ) {
      issues.push({
        path: `${itemPath}/severity`,
        message: "expected info|warn|fail",
      });
    }
  }
}

function validateNonEmptyStringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (!isNonEmptyString(input[key])) {
    issues.push({ path, message: "expected non-empty string" });
  }
}

function validateOptionalStringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (input[key] !== undefined && !isNonEmptyString(input[key])) {
    issues.push({ path, message: "expected non-empty string" });
  }
}

function validateOptionalNumberField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (input[key] !== undefined && typeof input[key] !== "number") {
    issues.push({ path, message: "expected number" });
  }
}

function validateOptionalNonNegativeIntegerField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (
    input[key] !== undefined &&
    (!Number.isInteger(input[key]) || (input[key] as number) < 0)
  ) {
    issues.push({ path, message: "expected non-negative integer" });
  }
}

function validateBooleanField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): void {
  if (typeof input[key] !== "boolean") {
    issues.push({ path, message: "expected boolean" });
  }
}

function validateArrayField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): boolean {
  if (!Array.isArray(input[key])) {
    issues.push({ path, message: "expected array" });
    return false;
  }
  return true;
}

function validateRecordField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: StateReviewArtifactImportIssue[],
): Record<string, unknown> | null {
  const value = input[key];
  if (!isRecord(value)) {
    issues.push({ path, message: "expected object" });
    return null;
  }
  return value;
}

function isStateReviewTemporalMisalignmentPhase(
  value: unknown,
): value is StateReviewTemporalMisalignmentPhase {
  return (
    value === "none" ||
    value === "observation_to_action" ||
    value === "action_to_feedback" ||
    value === "feedback_to_observation"
  );
}

function isStateReviewInvariantClass(
  value: unknown,
): value is StateReviewInvariantClass {
  return (
    value === "subject_identity" ||
    value === "tenant_boundary" ||
    value === "required_evidence" ||
    value === "freshness_window" ||
    value === "source_authority" ||
    value === "projection_version" ||
    value === "projection_replay" ||
    value === "workflow_position" ||
    value === "state_conflict" ||
    value === "capability_contract"
  );
}

function isProjectionReplayTransitionRefKind(
  value: StateRefKind,
): value is ProjectionReplayTransitionRefKind {
  return value === "event" || value === "action_outcome_envelope";
}

function isObservedReadSetIssueCode(
  value: unknown,
): value is ObservedReadSetValidationIssueCode {
  return (
    value === "observed_but_undeclared" ||
    value === "declared_but_unobserved" ||
    value === "stale_observed_read" ||
    value === "authority_mismatch" ||
    value === "projection_version_drift" ||
    value === "workflow_position_drift"
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function sameStateRefSet(left: readonly StateRef[], right: readonly StateRef[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right.map(formatStateRef));
  return left.every((item) => rightSet.has(formatStateRef(item)));
}

function assertion(input: StateAssertion): StateAssertion {
  return input;
}

function formatStateRef(ref: StateRef): string {
  return `${ref.kind}:${ref.id}`;
}

function isAfter(left: Timestamp, right: Timestamp): boolean {
  return Date.parse(left) > Date.parse(right);
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item !== undefined) {
      out[key] = canonicalize(item);
    }
  }
  return out;
}

function uniqueStrings<T extends string>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Internal helper shared with @pm/agent-state-provenance. */
export function fingerprint64(input: string): string {
  return [
    fnv1a64("state-review-artifact:v1:0", input),
    fnv1a64("state-review-artifact:v1:1", input),
    fnv1a64("state-review-artifact:v1:2", input),
    fnv1a64("state-review-artifact:v1:3", input),
  ].join("");
}

function fnv1a64(seed: string, input: string): string {
  let hash = 0xcbf29ce484222325n;
  const text = `${seed}\u0000${input}`;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
}
