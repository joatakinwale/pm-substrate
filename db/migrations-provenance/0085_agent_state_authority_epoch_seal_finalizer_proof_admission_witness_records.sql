-- 0085_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_records.sql
-- Witness-certified accountability records for authority epoch seal finalizer-proof admission rows.

CREATE TABLE IF NOT EXISTS agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records (
  tenant_id TEXT NOT NULL,
  finalizer_proof_admission_witness_store_id TEXT NOT NULL,
  finalizer_proof_admission_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  seal_id TEXT NOT NULL,
  finalizer_proof_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    finalizer_proof_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    finalizer_proof_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    finalizer_proof_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_witness_scope_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records (
    tenant_id,
    finalizer_proof_admission_witness_store_id,
    finalizer_proof_admission_store_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_witness_seal_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records (
    tenant_id,
    authority_scope,
    seal_id,
    admission_sequence,
    admission_record_hash
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proof_admission_witness_proof_idx
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records (
    tenant_id,
    authority_scope,
    finalizer_proof_hash,
    admission_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority epoch seal finalizer proof admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_epoch_seal_finalizer_proof_admission_witness_record_rewrite
  ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records;

CREATE TRIGGER prevent_authority_epoch_seal_finalizer_proof_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_admission_witness_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_epoch_seal_finalizer_proof_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records IS
  'Append-only witness accountability records for authority epoch seal finalizer-proof admission rows. Strict seal finality can require this ledger so a finalizer-proof admission row is not sufficient unless a quorum certificate witnesses the exact admission record hash.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records.admission_record_hash IS
  'Deterministic hash of the authority epoch seal finalizer-proof admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact finalizer-proof admission store, seal id, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proof_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the authority epoch seal finalizer-proof admission witness record, including the witness certificate and hash link to the prior witness record.';
