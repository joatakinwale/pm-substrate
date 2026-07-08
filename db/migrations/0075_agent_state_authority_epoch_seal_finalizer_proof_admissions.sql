-- 0075_agent_state_authority_epoch_seal_finalizer_proof_admissions.sql
-- Durable admissions for operational-state authority epoch seal finalizer proofs.

CREATE TABLE IF NOT EXISTS agent_state.authority_epoch_seal_finalizer_proof_admission_records (
  tenant_id TEXT NOT NULL,
  finalizer_proof_admission_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL,
  seal_id TEXT NOT NULL,
  finalizer_proof_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  finalizer_proof JSONB NOT NULL,
  admission_certificate JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    finalizer_proof_admission_store_id,
    admission_sequence,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    finalizer_proof_admission_store_id,
    finalizer_proof_hash
  ),
  UNIQUE (
    tenant_id,
    finalizer_proof_admission_store_id,
    admission_record_hash
  ),
  CHECK (admission_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_scope_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_records (
    tenant_id,
    finalizer_proof_admission_store_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_seal_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_records (
    tenant_id,
    authority_scope,
    seal_id,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_proof_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_records (
    tenant_id,
    authority_scope,
    finalizer_proof_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority epoch seal finalizer proof admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_epoch_seal_finalizer_proof_admission_rewrite
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_records;

CREATE TRIGGER prevent_authority_epoch_seal_finalizer_proof_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_epoch_seal_finalizer_proof_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_admission_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_epoch_seal_finalizer_proof_admission_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_epoch_seal_finalizer_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_epoch_seal_finalizer_proof_admission_records IS
  'Append-only admissions for authority epoch seal finalizer proofs. A finalizer proof can constitute strict seal finality only when replayed admission history certifies the exact finalizer-proof hash.';

COMMENT ON TABLE agent_state.authority_epoch_seal_finalizer_proofs IS
  'Append-only finalizer signature proofs for authority epoch seals. A seal is not final operational state unless its exact payload is signed by a replay-current finalizer principal, verified through constrained signature-verifier adapter proof replay, and admitted when strict finalizer-proof admission is required.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_records.finalizer_proof IS
  'Hash-bound embedded authority epoch seal finalizer proof admitted as seal-finality evidence.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_records.admission_certificate IS
  'Certified admission certificate over the exact seal id, admission sequence, and authority epoch seal finalizer-proof hash.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_records.admission_record_hash IS
  'Deterministic hash of the full authority epoch seal finalizer-proof admission record, including embedded finalizer proof and admission certificate.';
