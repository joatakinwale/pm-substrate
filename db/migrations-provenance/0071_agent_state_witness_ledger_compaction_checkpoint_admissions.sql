-- 0071_agent_state_witness_ledger_compaction_checkpoint_admissions.sql
-- Durable admissions for operational-state witness-ledger compaction checkpoints.

CREATE TABLE IF NOT EXISTS agent_state.witness_ledger_compaction_checkpoint_admission_records (
  tenant_id TEXT NOT NULL,
  checkpoint_admission_store_id TEXT NOT NULL,
  witness_ledger_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  checkpoint JSONB NOT NULL,
  quorum_certificate JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    checkpoint_admission_store_id,
    admission_sequence,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_store_id,
    checkpoint_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_store_id,
    admission_record_hash
  ),
  CHECK (admission_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS witness_ledger_compaction_checkpoint_admission_scope_idx
  ON agent_state.witness_ledger_compaction_checkpoint_admission_records (
    tenant_id,
    checkpoint_admission_store_id,
    witness_ledger_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS witness_ledger_compaction_checkpoint_admission_checkpoint_idx
  ON agent_state.witness_ledger_compaction_checkpoint_admission_records (
    tenant_id,
    witness_ledger_id,
    checkpoint_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_witness_ledger_compaction_checkpoint_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'witness ledger compaction checkpoint admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_witness_ledger_compaction_checkpoint_admission_rewrite
  ON agent_state.witness_ledger_compaction_checkpoint_admission_records;

CREATE TRIGGER prevent_witness_ledger_compaction_checkpoint_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.witness_ledger_compaction_checkpoint_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_witness_ledger_compaction_checkpoint_admission_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.witness_ledger_compaction_checkpoint_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.witness_ledger_compaction_checkpoint_admission_records IS
  'Append-only admissions for witness-ledger compaction checkpoints. A checkpoint can seed strict replay only when the latest admission record binds it to certified quorum authority.';

COMMENT ON TABLE agent_state.witness_ledger_compaction_checkpoints IS
  'Append-only compacted witness-ledger checkpoints. A checkpoint is only a replay seed; strict consumers require checkpoint admission and retained witness records must still chain to the required accepted head.';

COMMENT ON COLUMN agent_state.witness_ledger_compaction_checkpoint_admission_records.checkpoint IS
  'Hash-bound embedded witness-ledger compaction checkpoint admitted as a replay seed.';

COMMENT ON COLUMN agent_state.witness_ledger_compaction_checkpoint_admission_records.quorum_certificate IS
  'Certified quorum certificate over the exact witness-ledger checkpoint hash and compacted frontier.';

COMMENT ON COLUMN agent_state.witness_ledger_compaction_checkpoint_admission_records.admission_record_hash IS
  'Deterministic hash of the full witness-ledger checkpoint admission record, including checkpoint and quorum certificate.';
