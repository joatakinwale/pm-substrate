-- 0028_agent_state_projection_replay_settlement_head_witness.sql
-- Durable settlement-store head witness observations for projection replay roots.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_settlement_head_witness_observations (
  tenant_id                  TEXT NOT NULL,
  witness_sequence           BIGINT NOT NULL,
  observer_id                TEXT NOT NULL,
  observed_at                TIMESTAMPTZ NOT NULL,
  settlement_sequence        BIGINT NOT NULL,
  settlement_record_hash     TEXT NOT NULL,
  settlement_store_head      JSONB NOT NULL,
  consistency_proof          JSONB,
  decision                   JSONB NOT NULL,
  accepted                   BOOLEAN NOT NULL,
  status                     TEXT NOT NULL,
  previous_observation_hash  TEXT,
  observation_hash           TEXT NOT NULL,
  recorded_at                TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, witness_sequence),
  UNIQUE (tenant_id, observation_hash),
  CHECK (
    (witness_sequence = 1 AND previous_observation_hash IS NULL)
    OR (witness_sequence > 1 AND previous_observation_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_head_idx
  ON agent_state.projection_replay_settlement_head_witness_observations (
    tenant_id,
    settlement_sequence,
    settlement_record_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_observer_idx
  ON agent_state.projection_replay_settlement_head_witness_observations (
    tenant_id,
    observer_id,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_status_idx
  ON agent_state.projection_replay_settlement_head_witness_observations (
    tenant_id,
    accepted,
    status
  );

COMMENT ON TABLE agent_state.projection_replay_settlement_head_witness_observations IS
  'Append-only settlement-store head witness observations. Replaying this ledger reconstructs shared accepted settlement heads and obstructions after agent/process restart.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_observations.observation_hash IS
  'Hash of the settlement-head witness observation record body, chained by previous_observation_hash so settlement-head state is replayable rather than remembered.';
