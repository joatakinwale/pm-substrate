-- 0060_agent_state_tombstone_history_compaction_checkpoints.sql
-- Durable checkpoints for compacted operational-state pruning tombstone histories.

CREATE TABLE IF NOT EXISTS agent_state.tombstone_history_compaction_checkpoints (
  tenant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  compacted_through_sequence BIGINT NOT NULL,
  compacted_head JSONB NOT NULL,
  retained_from_sequence BIGINT NOT NULL,
  checkpointed_at TIMESTAMPTZ NOT NULL,
  checkpointed_by TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, store_id, compacted_through_sequence, checkpoint_hash),
  UNIQUE (tenant_id, store_id, checkpoint_id),
  UNIQUE (tenant_id, store_id, checkpoint_hash),
  CHECK (compacted_through_sequence >= 0),
  CHECK (retained_from_sequence = compacted_through_sequence + 1)
);

CREATE INDEX IF NOT EXISTS tombstone_history_compaction_checkpoints_scope_idx
  ON agent_state.tombstone_history_compaction_checkpoints (
    tenant_id,
    store_id,
    authority_scope,
    compacted_through_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_tombstone_history_compaction_checkpoint_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tombstone history compaction checkpoints are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_tombstone_history_compaction_checkpoint_rewrite
  ON agent_state.tombstone_history_compaction_checkpoints;

CREATE TRIGGER prevent_tombstone_history_compaction_checkpoint_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.tombstone_history_compaction_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_tombstone_history_compaction_checkpoint_rewrite();

COMMENT ON TABLE agent_state.tombstone_history_compaction_checkpoints IS
  'Append-only compacted pruning tombstone-history checkpoints. A checkpoint is only a replay seed; retained suffix replay must still reach the required admissible head.';

COMMENT ON COLUMN agent_state.tombstone_history_compaction_checkpoints.compacted_head IS
  'Hash-bound tombstone-history head at compacted_through_sequence, used as the replay seed for retained suffix continuity.';
