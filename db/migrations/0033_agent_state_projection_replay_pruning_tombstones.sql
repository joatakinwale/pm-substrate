-- 0033_agent_state_projection_replay_pruning_tombstones.sql
-- Durable tombstones for settlement-head replay compaction pruning.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_settlement_head_witness_pruning_tombstones (
  tenant_id TEXT NOT NULL,
  pruning_tombstone_sequence BIGINT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  checkpoint_admission_record_hash TEXT NOT NULL,
  pruning_admission_hash TEXT NOT NULL,
  checkpoint_admission_record JSONB NOT NULL,
  pruning_admission JSONB NOT NULL,
  pruned_frontiers JSONB NOT NULL,
  previous_pruning_tombstone_record_hash TEXT,
  pruning_tombstone_record_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, pruning_tombstone_sequence),
  UNIQUE (tenant_id, pruning_admission_hash),
  UNIQUE (tenant_id, pruning_tombstone_record_hash)
);

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_pruning_tombstones_by_checkpoint
  ON agent_state.projection_replay_settlement_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_pruning_tombstones_by_admission_record
  ON agent_state.projection_replay_settlement_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_admission_record_hash
  );

COMMENT ON TABLE agent_state.projection_replay_settlement_head_witness_pruning_tombstones IS
  'Append-only durable tombstones for settlement-head replay compaction pruning. Replaying this ledger distinguishes authority-admitted pruning from out-of-band truncation.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_pruning_tombstones.pruned_frontiers IS
  'Lane frontiers physically pruned by this tombstone, derived from the admitted compaction checkpoint snapshots.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_pruning_tombstones.pruning_admission IS
  'Admitted pruning decision proving durable checkpoint admission and retained suffix continuity before any store rows may be deleted.';
