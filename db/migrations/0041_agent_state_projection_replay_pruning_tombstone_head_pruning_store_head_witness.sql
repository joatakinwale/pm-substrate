-- 0041_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness.sql
-- Durable witness observations for the pruning tombstone-store head that governs
-- tombstone-head witness replay compaction pruning tombstones.

CREATE TABLE IF NOT EXISTS agent_state.pruning_tombstone_head_pruning_store_head_witness_observations (
  tenant_id                       TEXT NOT NULL,
  witness_sequence                BIGINT NOT NULL,
  observer_id                     TEXT NOT NULL,
  observed_at                     TIMESTAMPTZ NOT NULL,
  pruning_tombstone_sequence      BIGINT NOT NULL,
  pruning_tombstone_record_hash   TEXT NOT NULL,
  pruning_tombstone_store_head    JSONB NOT NULL,
  consistency_proof               JSONB,
  decision                        JSONB NOT NULL,
  accepted                        BOOLEAN NOT NULL,
  status                          TEXT NOT NULL,
  previous_observation_hash       TEXT,
  observation_hash                TEXT NOT NULL,
  recorded_at                     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, witness_sequence),
  UNIQUE (tenant_id, observation_hash),
  CHECK (
    (witness_sequence = 1 AND previous_observation_hash IS NULL)
    OR (witness_sequence > 1 AND previous_observation_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS pruning_tombstone_head_pruning_store_head_witness_head_idx
  ON agent_state.pruning_tombstone_head_pruning_store_head_witness_observations (
    tenant_id,
    pruning_tombstone_sequence,
    pruning_tombstone_record_hash
  );

CREATE INDEX IF NOT EXISTS pruning_tombstone_head_pruning_store_head_witness_observer_idx
  ON agent_state.pruning_tombstone_head_pruning_store_head_witness_observations (
    tenant_id,
    observer_id,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS pruning_tombstone_head_pruning_store_head_witness_status_idx
  ON agent_state.pruning_tombstone_head_pruning_store_head_witness_observations (
    tenant_id,
    accepted,
    status
  );

COMMENT ON TABLE agent_state.pruning_tombstone_head_pruning_store_head_witness_observations IS
  'Append-only witness observations for the pruning tombstone-store head of the tombstone-head pruning tombstone ledger. Replaying this ledger reconstructs the required pruning tombstone-store head after agent/process restart.';

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_observations.observation_hash IS
  'Hash of the pruning tombstone-head pruning tombstone-store head witness record body, chained by previous_observation_hash so required head currentness is replayable rather than remembered.';
