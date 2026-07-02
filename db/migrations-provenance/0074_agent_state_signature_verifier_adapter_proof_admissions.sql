-- 0074_agent_state_signature_verifier_adapter_proof_admissions.sql
-- Durable admissions for operational-state signature verifier adapter proofs.

CREATE TABLE IF NOT EXISTS agent_state.signature_verifier_adapter_proof_admission_records (
  tenant_id TEXT NOT NULL,
  proof_admission_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL,
  verification_id TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  proof JSONB NOT NULL,
  admission_certificate JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    proof_admission_store_id,
    admission_sequence,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_store_id,
    proof_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_store_id,
    admission_record_hash
  ),
  CHECK (admission_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_scope_idx
  ON agent_state.signature_verifier_adapter_proof_admission_records (
    tenant_id,
    proof_admission_store_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_verification_idx
  ON agent_state.signature_verifier_adapter_proof_admission_records (
    tenant_id,
    authority_scope,
    verification_id,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proof_admission_proof_idx
  ON agent_state.signature_verifier_adapter_proof_admission_records (
    tenant_id,
    authority_scope,
    proof_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature verifier adapter proof admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_signature_verifier_adapter_proof_admission_rewrite
  ON agent_state.signature_verifier_adapter_proof_admission_records;

CREATE TRIGGER prevent_signature_verifier_adapter_proof_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.signature_verifier_adapter_proof_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_admission_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_adapter_proof_admission_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_adapter_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.signature_verifier_adapter_proof_admission_records IS
  'Append-only admissions for constrained signature-verifier adapter proofs. A verifier proof can support strict operational signature state only when replayed admission history certifies the exact proof hash.';

COMMENT ON TABLE agent_state.signature_verifier_adapter_proofs IS
  'Append-only constrained signature-verifier adapter proofs. These rows prove cryptographic signature verification against replayed key material only; strict consumers require verifier-proof admission history before a proof can support operational state.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_records.proof IS
  'Hash-bound embedded signature-verifier adapter proof admitted as cryptographic verification evidence.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_records.admission_certificate IS
  'Certified admission certificate over the exact verification id, admission sequence, and signature-verifier proof hash.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proof_admission_records.admission_record_hash IS
  'Deterministic hash of the full signature-verifier proof admission record, including embedded proof and admission certificate.';
