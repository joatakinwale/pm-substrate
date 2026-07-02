-- 0112_agent_state_qc_proof_aw_authority_transition_witness_records.sql
-- Witness-certified accountability records for proof-record admission witness authority-transition admission rows.

CREATE TABLE IF NOT EXISTS agent_state.qc_proof_aw_authority_transition_witness_records (
  tenant_id TEXT NOT NULL,
  transition_admission_witness_store_id TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  proof_record_admission_witness_authority_topology_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  authority_sequence BIGINT NOT NULL CHECK (authority_sequence >= 1),
  authority_record_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  next_authority_topology_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    transition_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS qc_proof_record_adm_wit_auth_trans_adm_wit_scope_idx
  ON agent_state.qc_proof_aw_authority_transition_witness_records (
    tenant_id,
    transition_admission_witness_store_id,
    transition_admission_store_id,
    proof_record_admission_witness_authority_topology_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS qc_proof_record_adm_wit_auth_trans_adm_wit_admission_idx
  ON agent_state.qc_proof_aw_authority_transition_witness_records (
    tenant_id,
    transition_admission_store_id,
    admission_sequence,
    admission_record_hash
  );

CREATE INDEX IF NOT EXISTS qc_proof_record_adm_wit_auth_trans_adm_wit_authority_idx
  ON agent_state.qc_proof_aw_authority_transition_witness_records (
    tenant_id,
    proof_record_admission_witness_authority_topology_id,
    authority_sequence,
    authority_record_hash,
    next_authority_topology_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_qc_proof_record_adm_wit_auth_trans_adm_wit_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'quorum-certificate proof-record admission witness authority transition-admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_qc_proof_record_adm_wit_auth_trans_adm_wit_record_rewrite
  ON agent_state.qc_proof_aw_authority_transition_witness_records;

CREATE TRIGGER prevent_qc_proof_record_adm_wit_auth_trans_adm_wit_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.qc_proof_aw_authority_transition_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_qc_proof_record_adm_wit_auth_trans_adm_wit_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.qc_proof_aw_authority_transition_witness_records FROM PUBLIC;

COMMENT ON TABLE agent_state.qc_proof_aw_authority_transition_witness_records IS
  'Append-only witness accountability records for proof-record admission witness authority-transition admission rows. Strict recovered currentness can require this ledger so a transition-admission row is not sufficient unless a witness certificate accounts for the exact admission record hash.';

COMMENT ON COLUMN agent_state.qc_proof_aw_authority_transition_witness_records.admission_record_hash IS
  'Deterministic hash of the proof-record admission witness authority-transition admission record being witnessed. The witness certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.qc_proof_aw_authority_transition_witness_records.next_authority_topology_hash IS
  'Hash of the proof-record admission witness authority topology derived by the transition-admission record being witnessed.';

COMMENT ON COLUMN agent_state.qc_proof_aw_authority_transition_witness_records.admission_certificate IS
  'Quorum certificate over the exact transition-admission store, topology id, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.qc_proof_aw_authority_transition_witness_records.witness_record_hash IS
  'Deterministic hash of the transition-admission witness record, including the witness certificate and hash link to the prior witness record.';
