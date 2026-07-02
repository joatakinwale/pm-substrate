-- 0084_agent_state_signature_verifier_adapter_proof_admission_witness_records.sql
-- Witness-certified accountability records for signature-verifier adapter proof admission rows.

CREATE TABLE IF NOT EXISTS agent_state.signature_verifier_adapter_proof_admission_witness_records (
  tenant_id TEXT NOT NULL,
  proof_admission_witness_store_id TEXT NOT NULL,
  proof_admission_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  verification_id TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    proof_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_witness_scope_idx
  ON agent_state.signature_verifier_adapter_proof_admission_witness_records (
    tenant_id,
    proof_admission_witness_store_id,
    proof_admission_store_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_witness_verification_idx
  ON agent_state.signature_verifier_adapter_proof_admission_witness_records (
    tenant_id,
    authority_scope,
    verification_id,
    admission_sequence,
    admission_record_hash
  );

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_witness_proof_idx
  ON agent_state.signature_verifier_adapter_proof_admission_witness_records (
    tenant_id,
    authority_scope,
    proof_hash,
    admission_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature verifier adapter proof admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_signature_verifier_adapter_proof_admission_witness_record_rewrite
  ON agent_state.signature_verifier_adapter_proof_admission_witness_records;

CREATE TRIGGER prevent_signature_verifier_adapter_proof_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.signature_verifier_adapter_proof_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_admission_witness_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_adapter_proof_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_adapter_proof_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.signature_verifier_adapter_proof_admission_witness_records IS
  'Append-only witness accountability records for signature-verifier adapter proof admission rows. Strict signature verification state can require this ledger so a verifier-proof admission row is not sufficient unless a quorum certificate witnesses the exact admission record hash.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_witness_records.admission_record_hash IS
  'Deterministic hash of the signature-verifier proof admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact proof-admission store, verification id, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the signature-verifier proof admission witness record, including the witness certificate and hash link to the prior witness record.';
