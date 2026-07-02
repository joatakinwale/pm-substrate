-- 0062_agent_state_quorum_certificate_proof_records.sql
-- Durable proof records for authority-scoped quorum certificates.

CREATE TABLE IF NOT EXISTS agent_state.quorum_certificate_proof_records (
  tenant_id TEXT NOT NULL,
  proof_ledger_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  proof_sequence BIGINT NOT NULL,
  certificate JSONB NOT NULL,
  accepted_witness_evidence JSONB NOT NULL,
  authority_epoch_seal JSONB,
  previous_proof_record_hash TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  proof_record_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, proof_ledger_id, proof_sequence),
  UNIQUE (tenant_id, proof_ledger_id, proof_record_hash),
  CHECK (proof_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS quorum_certificate_proof_records_scope_idx
  ON agent_state.quorum_certificate_proof_records (
    tenant_id,
    authority_scope,
    proof_ledger_id,
    proof_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_quorum_certificate_proof_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'quorum certificate proof records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_quorum_certificate_proof_record_rewrite
  ON agent_state.quorum_certificate_proof_records;

CREATE TRIGGER prevent_quorum_certificate_proof_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.quorum_certificate_proof_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_quorum_certificate_proof_record_rewrite();

COMMENT ON TABLE agent_state.quorum_certificate_proof_records IS
  'Append-only authority-scoped quorum-certificate proof records. Recovery consumes these records instead of transient recertification or private memory.';

COMMENT ON COLUMN agent_state.quorum_certificate_proof_records.certificate IS
  'Hash-bound certified quorum certificate summary, including subject, accepted witnesses, authority topology, and certificate hash.';

COMMENT ON COLUMN agent_state.quorum_certificate_proof_records.accepted_witness_evidence IS
  'Replayable accepted witness evidence whose witness ids must exactly match the certified quorum certificate.';
