-- 0072_agent_state_quorum_certificate_proof_record_admissions.sql
-- Durable admissions for operational-state quorum-certificate proof records.

CREATE TABLE IF NOT EXISTS agent_state.quorum_certificate_proof_record_admission_records (
  tenant_id TEXT NOT NULL,
  proof_admission_store_id TEXT NOT NULL,
  proof_ledger_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL,
  proof_sequence BIGINT NOT NULL,
  proof_record_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  proof_record JSONB NOT NULL,
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
    proof_record_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_store_id,
    admission_record_hash
  ),
  CHECK (admission_sequence >= 1),
  CHECK (proof_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS quorum_certificate_proof_record_admission_scope_idx
  ON agent_state.quorum_certificate_proof_record_admission_records (
    tenant_id,
    proof_admission_store_id,
    proof_ledger_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS quorum_certificate_proof_record_admission_proof_idx
  ON agent_state.quorum_certificate_proof_record_admission_records (
    tenant_id,
    proof_ledger_id,
    proof_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_quorum_certificate_proof_record_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'quorum certificate proof-record admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_quorum_certificate_proof_record_admission_rewrite
  ON agent_state.quorum_certificate_proof_record_admission_records;

CREATE TRIGGER prevent_quorum_certificate_proof_record_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.quorum_certificate_proof_record_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_quorum_certificate_proof_record_admission_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.quorum_certificate_proof_record_admission_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.quorum_certificate_proof_records FROM PUBLIC;

COMMENT ON TABLE agent_state.quorum_certificate_proof_record_admission_records IS
  'Append-only admissions for quorum-certificate proof records. A proof record can establish strict recovered currentness only when the latest admission record binds the exact proof-record hash to certified admission authority.';

COMMENT ON TABLE agent_state.quorum_certificate_proof_records IS
  'Append-only authority-scoped quorum-certificate proof records. Recovery consumes these records instead of transient recertification or private memory; strict consumers require proof-record admission history.';

COMMENT ON COLUMN agent_state.quorum_certificate_proof_record_admission_records.proof_record IS
  'Hash-bound embedded quorum-certificate proof record admitted as recovered certified currentness.';

COMMENT ON COLUMN agent_state.quorum_certificate_proof_record_admission_records.admission_certificate IS
  'Certified admission certificate over the exact proof ledger, proof sequence, and proof-record hash.';

COMMENT ON COLUMN agent_state.quorum_certificate_proof_record_admission_records.admission_record_hash IS
  'Deterministic hash of the full quorum-certificate proof-record admission record, including embedded proof record and admission certificate.';
