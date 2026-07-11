-- 0076_agent_state_recovery_cut_admission_witness_records.sql
-- Witness-certified accountability records for recovery-cut admission rows.

CREATE TABLE IF NOT EXISTS agent_state.recovery_cut_admission_witness_records (
  tenant_id TEXT NOT NULL,
  recovery_cut_admission_witness_store_id TEXT NOT NULL,
  recovery_cut_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  admission_record_hash TEXT NOT NULL,
  recovery_cut_hash TEXT NOT NULL,
  current_state_view_identity_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    recovery_cut_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    recovery_cut_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    recovery_cut_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS recovery_cut_admission_witness_scope_idx
  ON agent_state.recovery_cut_admission_witness_records (
    tenant_id,
    recovery_cut_admission_witness_store_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS recovery_cut_admission_witness_admission_idx
  ON agent_state.recovery_cut_admission_witness_records (
    tenant_id,
    recovery_cut_store_id,
    admission_sequence,
    admission_record_hash
  );

CREATE INDEX IF NOT EXISTS recovery_cut_admission_witness_cut_idx
  ON agent_state.recovery_cut_admission_witness_records (
    tenant_id,
    authority_scope,
    recovery_cut_hash,
    current_state_view_identity_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_recovery_cut_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'recovery cut admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_recovery_cut_admission_witness_record_rewrite
  ON agent_state.recovery_cut_admission_witness_records;

CREATE TRIGGER prevent_recovery_cut_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.recovery_cut_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_recovery_cut_admission_witness_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.recovery_cut_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.recovery_cut_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.recovery_cut_admission_witness_records IS
  'Append-only witness accountability records for recovery-cut admission rows. Strict recovery can require this ledger so an admission row is not sufficient unless a quorum certificate witnesses the exact admission record hash.';

COMMENT ON COLUMN agent_state.recovery_cut_admission_witness_records.admission_record_hash IS
  'Deterministic hash of the recovery-cut admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.recovery_cut_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact recovery-cut admission store id, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.recovery_cut_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the recovery-cut admission witness record, including the witness certificate and hash link to the prior witness record.';
