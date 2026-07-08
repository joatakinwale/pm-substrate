CREATE TABLE IF NOT EXISTS agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations (
  tenant_id TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL,
  observer_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  pruning_tombstone_sequence BIGINT NOT NULL,
  pruning_tombstone_record_hash TEXT NOT NULL,
  pruning_tombstone_store_head JSONB NOT NULL,
  consistency_proof JSONB,
  signature JSONB,
  decision JSONB NOT NULL,
  accepted BOOLEAN NOT NULL,
  status TEXT NOT NULL,
  previous_observation_hash TEXT,
  observation_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, witness_sequence),
  UNIQUE (tenant_id, observation_hash),
  CHECK (
    (witness_sequence = 1 AND previous_observation_hash IS NULL)
    OR
    (witness_sequence > 1 AND previous_observation_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_head_idx
  ON agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations (
    tenant_id,
    pruning_tombstone_sequence,
    pruning_tombstone_record_hash
  );

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observer_idx
  ON agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations (
    tenant_id,
    observer_id,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_status_idx
  ON agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations (
    tenant_id,
    status,
    witness_sequence
  );

COMMENT ON TABLE agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations IS
  'Hash-linked witness observations for replay-recovering the current v133 pruning tombstone-store head after agent amnesia.';

COMMENT ON COLUMN agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations.pruning_tombstone_store_head IS
  'Observed v133 pruning tombstone-store head. It is operational only when replay admits the witness record.';

COMMENT ON COLUMN agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations.consistency_proof IS
  'Replay proof from the beginning or latest witnessed head to the observed v133 pruning tombstone-store head.';

COMMENT ON COLUMN agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations.signature IS
  'Witness signature over the observation payload; replay checks it against v135/v137 key-status authority before the observation can count toward currentness.';

COMMENT ON COLUMN agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_observations.decision IS
  'Replay-derived witness admission decision; replay must reproduce it exactly.';
