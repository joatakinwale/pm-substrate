-- 0026_agent_state_projection_replay_root_witness.sql
-- Replayable witness observations for projection replay certificate-store roots.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_certificate_root_witness_observations (
  tenant_id                 TEXT NOT NULL,
  witness_sequence          BIGINT NOT NULL,
  observer_id               TEXT NOT NULL,
  observed_at               TIMESTAMPTZ NOT NULL,
  root_sequence             BIGINT NOT NULL,
  root_hash                 TEXT NOT NULL,
  root                      JSONB NOT NULL,
  consistency_proof         JSONB,
  decision                  JSONB NOT NULL,
  accepted                  BOOLEAN NOT NULL,
  status                    TEXT NOT NULL,
  previous_observation_hash TEXT,
  observation_hash          TEXT NOT NULL,
  recorded_at               TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, witness_sequence),
  UNIQUE (tenant_id, observation_hash),
  CHECK (
    (witness_sequence = 1 AND previous_observation_hash IS NULL)
    OR (witness_sequence > 1 AND previous_observation_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_root_idx
  ON agent_state.projection_replay_certificate_root_witness_observations (
    tenant_id,
    root_sequence,
    root_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_status_idx
  ON agent_state.projection_replay_certificate_root_witness_observations (
    tenant_id,
    accepted,
    status
  );

COMMENT ON TABLE agent_state.projection_replay_certificate_root_witness_observations IS
  'Append-only root-witness observations for projection replay certificate-store roots. Replaying this ledger reconstructs accepted witnessed roots and root obstructions after agent/process restart.';

COMMENT ON COLUMN agent_state.projection_replay_certificate_root_witness_observations.observation_hash IS
  'Hash of the witness observation record body, chained by previous_observation_hash so root-witness state is replayable rather than remembered.';
