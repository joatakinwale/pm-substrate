-- 0146_agent_state_short_identifier_repair_indexes.sql
-- Repair indexes whose original names exceeded Postgres' 63-byte identifier
-- limit and collided by truncation in already-applied migrations. Keep this
-- as a forward migration so existing databases do not hit checksum changes.

CREATE INDEX IF NOT EXISTS prshw_checkpoint_admissions_checkpoint_idx
  ON agent_state.projection_replay_settlement_head_witness_checkpoint_admissions (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS prshw_pruning_tombstones_checkpoint_idx
  ON agent_state.projection_replay_settlement_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS prshw_pruning_tombstones_admission_record_idx
  ON agent_state.projection_replay_settlement_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_admission_record_hash
  );

CREATE INDEX IF NOT EXISTS prpthw_checkpoint_admissions_checkpoint_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_checkpoint_admissions (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS prpthw_pruning_tombstones_checkpoint_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

CREATE INDEX IF NOT EXISTS prpthw_pruning_tombstones_admission_record_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_pruning_tombstones (
    tenant_id,
    checkpoint_admission_record_hash
  );
