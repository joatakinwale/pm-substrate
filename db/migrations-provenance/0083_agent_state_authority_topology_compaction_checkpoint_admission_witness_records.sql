-- 0083_agent_state_authority_topology_compaction_checkpoint_admission_witness_records.sql
-- Witness-certified accountability records for authority-topology compaction checkpoint admission rows.

CREATE TABLE IF NOT EXISTS agent_state.authority_topology_compaction_checkpoint_admission_witness_records (
  tenant_id TEXT NOT NULL,
  checkpoint_admission_witness_store_id TEXT NOT NULL,
  checkpoint_admission_store_id TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  checkpoint_id TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    checkpoint_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS authority_topology_compaction_checkpoint_admission_witness_scope_idx
  ON agent_state.authority_topology_compaction_checkpoint_admission_witness_records (
    tenant_id,
    checkpoint_admission_witness_store_id,
    checkpoint_admission_store_id,
    topology_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS authority_topology_compaction_checkpoint_admission_witness_checkpoint_idx
  ON agent_state.authority_topology_compaction_checkpoint_admission_witness_records (
    tenant_id,
    topology_id,
    checkpoint_id,
    checkpoint_hash,
    admission_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_topology_compaction_checkpoint_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority topology compaction checkpoint admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_topology_compaction_checkpoint_admission_witness_record_rewrite
  ON agent_state.authority_topology_compaction_checkpoint_admission_witness_records;

CREATE TRIGGER prevent_authority_topology_compaction_checkpoint_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_topology_compaction_checkpoint_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_topology_compaction_checkpoint_admission_witness_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_topology_compaction_checkpoint_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_topology_compaction_checkpoint_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_topology_compaction_checkpoint_admission_witness_records IS
  'Append-only witness accountability records for authority-topology compaction checkpoint admission rows. Strict compacted authority-topology recovery can require this ledger so a checkpoint-admission row is not sufficient unless a quorum certificate witnesses the exact admission record hash.';

COMMENT ON COLUMN agent_state.authority_topology_compaction_checkpoint_admission_witness_records.admission_record_hash IS
  'Deterministic hash of the authority-topology checkpoint admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.authority_topology_compaction_checkpoint_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact checkpoint-admission store, topology id, checkpoint id, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.authority_topology_compaction_checkpoint_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the authority-topology checkpoint admission witness record, including the witness certificate and hash link to the prior witness record.';
