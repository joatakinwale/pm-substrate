-- 0056_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstones.sql
-- Durable tombstones for history-store-head pruning tombstone-store head witness replay compaction stores.

CREATE TABLE IF NOT EXISTS agent_state.pt_hsh_ptsh_pruning_tombstones (
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

CREATE INDEX IF NOT EXISTS pt_hsh_ptsh_pruning_tombstones_by_checkpoint
  ON agent_state.pt_hsh_ptsh_pruning_tombstones (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS pt_hsh_ptsh_pruning_tombstones_by_admission_record
  ON agent_state.pt_hsh_ptsh_pruning_tombstones (
    tenant_id,
    checkpoint_admission_record_hash
  );

COMMENT ON TABLE agent_state.pt_hsh_ptsh_pruning_tombstones IS
  'Append-only durable tombstones authorizing physical pruning of history-store-head pruning tombstone-store head witness, authority, and quorum-certificate stores.';

COMMENT ON COLUMN agent_state.pt_hsh_ptsh_pruning_tombstones.pruned_frontiers IS
  'Lane frontiers physically pruned from history-store-head pruning tombstone-store head witness stores, derived from admitted compaction checkpoint snapshots.';

COMMENT ON COLUMN agent_state.pt_hsh_ptsh_pruning_tombstones.pruning_admission IS
  'Replayable pruning admission proving durable checkpoint admission and retained suffix continuity before store rows may be deleted.';
