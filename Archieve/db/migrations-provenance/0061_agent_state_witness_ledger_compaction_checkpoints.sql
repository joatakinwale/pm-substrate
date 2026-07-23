-- 0061_agent_state_witness_ledger_compaction_checkpoints.sql
-- Durable checkpoints for compacted operational-state witness ledgers.

CREATE TABLE IF NOT EXISTS agent_state.witness_ledger_compaction_checkpoints (
  tenant_id TEXT NOT NULL,
  ledger_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  compacted_through_sequence BIGINT NOT NULL,
  compacted_ledger_head JSONB NOT NULL,
  retained_from_sequence BIGINT NOT NULL,
  checkpointed_at TIMESTAMPTZ NOT NULL,
  checkpointed_by TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ledger_id, compacted_through_sequence, checkpoint_hash),
  UNIQUE (tenant_id, ledger_id, checkpoint_id),
  UNIQUE (tenant_id, ledger_id, checkpoint_hash),
  CHECK (compacted_through_sequence >= 0),
  CHECK (retained_from_sequence = compacted_through_sequence + 1)
);

CREATE INDEX IF NOT EXISTS witness_ledger_compaction_checkpoints_scope_idx
  ON agent_state.witness_ledger_compaction_checkpoints (
    tenant_id,
    ledger_id,
    authority_scope,
    compacted_through_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_witness_ledger_compaction_checkpoint_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'witness ledger compaction checkpoints are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_witness_ledger_compaction_checkpoint_rewrite
  ON agent_state.witness_ledger_compaction_checkpoints;

CREATE TRIGGER prevent_witness_ledger_compaction_checkpoint_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.witness_ledger_compaction_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_witness_ledger_compaction_checkpoint_rewrite();

COMMENT ON TABLE agent_state.witness_ledger_compaction_checkpoints IS
  'Append-only compacted witness-ledger checkpoints. A checkpoint seeds replay only when retained witness records chain to the required accepted head.';

COMMENT ON COLUMN agent_state.witness_ledger_compaction_checkpoints.compacted_ledger_head IS
  'Hash-bound witness-ledger head at compacted_through_sequence, including latest accepted head and obstruction summary.';
