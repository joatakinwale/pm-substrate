-- 0145_agent_state_authority_epoch_seal_accountable_finality_evidence.sql
-- Append-only evidence for conflicting admitted authority-epoch seal finalizer quorums.

CREATE TABLE IF NOT EXISTS agent_state.authority_epoch_seal_accountable_finality_evidence (
  tenant_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  finalizer_proof_admission_authority_boundary TEXT NOT NULL,
  sealed_subject_kind TEXT NOT NULL,
  sealed_subject_id TEXT NOT NULL,
  sealed_subject_sequence BIGINT NOT NULL CHECK (sealed_subject_sequence > 0),
  first_finalizer_proof_hash TEXT NOT NULL,
  second_finalizer_proof_hash TEXT NOT NULL,
  first_seal_payload_hash TEXT NOT NULL,
  second_seal_payload_hash TEXT NOT NULL,
  first_admission_record_hash TEXT NOT NULL,
  second_admission_record_hash TEXT NOT NULL,
  first_admission_certificate_hash TEXT NOT NULL,
  second_admission_certificate_hash TEXT NOT NULL,
  shared_accepted_witness_ids JSONB NOT NULL,
  conflict_kinds JSONB NOT NULL,
  conflict_hash TEXT NOT NULL,
  evidence JSONB NOT NULL,
  evidence_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  evidence_reason TEXT,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, evidence_id),
  UNIQUE (
    tenant_id,
    authority_scope,
    authority_boundary,
    sealed_subject_kind,
    sealed_subject_id,
    sealed_subject_sequence,
    conflict_hash,
    evidence_hash
  ),
  CHECK (jsonb_typeof(shared_accepted_witness_ids) = 'array'),
  CHECK (jsonb_array_length(shared_accepted_witness_ids) > 0),
  CHECK (jsonb_typeof(conflict_kinds) = 'array'),
  CHECK (jsonb_array_length(conflict_kinds) > 0),
  CHECK (jsonb_typeof(evidence) = 'object'),
  CHECK (length(evidence_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(authority_boundary) > 0),
  CHECK (length(finalizer_proof_admission_authority_boundary) > 0),
  CHECK (length(sealed_subject_kind) > 0),
  CHECK (length(sealed_subject_id) > 0),
  CHECK (length(first_finalizer_proof_hash) > 0),
  CHECK (length(second_finalizer_proof_hash) > 0),
  CHECK (first_finalizer_proof_hash <> second_finalizer_proof_hash),
  CHECK (length(first_seal_payload_hash) > 0),
  CHECK (length(second_seal_payload_hash) > 0),
  CHECK (length(first_admission_record_hash) > 0),
  CHECK (length(second_admission_record_hash) > 0),
  CHECK (first_admission_record_hash <> second_admission_record_hash),
  CHECK (length(first_admission_certificate_hash) > 0),
  CHECK (length(second_admission_certificate_hash) > 0),
  CHECK (length(conflict_hash) > 0),
  CHECK (length(evidence_hash) > 0),
  CHECK (length(recorded_by) > 0)
);

CREATE INDEX IF NOT EXISTS authority_epoch_seal_accountable_finality_evidence_subject_idx
  ON agent_state.authority_epoch_seal_accountable_finality_evidence (
    tenant_id,
    authority_scope,
    authority_boundary,
    sealed_subject_kind,
    sealed_subject_id,
    sealed_subject_sequence
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_accountable_finality_evidence_proof_idx
  ON agent_state.authority_epoch_seal_accountable_finality_evidence (
    tenant_id,
    authority_scope,
    first_finalizer_proof_hash,
    second_finalizer_proof_hash
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_accountable_finality_evidence_conflict_idx
  ON agent_state.authority_epoch_seal_accountable_finality_evidence (
    tenant_id,
    authority_scope,
    conflict_hash,
    evidence_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_epoch_seal_accountable_finality_evidence_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority-epoch seal accountable finality evidence is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_epoch_seal_accountable_finality_evidence_rewrite
  ON agent_state.authority_epoch_seal_accountable_finality_evidence;

CREATE TRIGGER prevent_authority_epoch_seal_accountable_finality_evidence_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_epoch_seal_accountable_finality_evidence
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_epoch_seal_accountable_finality_evidence_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_epoch_seal_accountable_finality_evidence FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_epoch_seal_accountable_finality_evidence IS
  'Append-only replay evidence that two certified authority-epoch seal finalizer-proof admissions conflict over the same operational subject frontier and share accountable accepted witnesses.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_accountable_finality_evidence.shared_accepted_witness_ids IS
  'Accepted finalizer-proof admission witnesses present in both conflicting certificates; evidence without overlap is a dispute, not accountable finality evidence.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_accountable_finality_evidence.conflict_hash IS
  'Canonical hash over the finalized subject identity, admission certificate hashes, shared accepted witnesses, and conflict kinds.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_accountable_finality_evidence.evidence_hash IS
  'Deterministic hash of the full accountable finality evidence envelope used by finalizer evaluation to obstruct operational finality.';
