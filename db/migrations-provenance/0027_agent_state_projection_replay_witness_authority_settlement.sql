-- 0027_agent_state_projection_replay_witness_authority_settlement.sql
-- Durable witness-authority transitions and settlement certificates for replay roots.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_root_witness_authority_transitions (
  tenant_id                    TEXT NOT NULL,
  authority_sequence           BIGINT NOT NULL,
  transition_id                TEXT NOT NULL,
  transition_kind              TEXT NOT NULL,
  recorded_at                  TIMESTAMPTZ NOT NULL,
  recorded_by                  TEXT NOT NULL,
  effective_from_root_sequence BIGINT NOT NULL,
  witness_id                   TEXT,
  required_witnesses           INTEGER,
  minimum_witnesses            INTEGER,
  reason                       TEXT,
  previous_authority_hash      TEXT,
  authority_hash               TEXT NOT NULL,
  transition                   JSONB NOT NULL,
  PRIMARY KEY (tenant_id, authority_sequence),
  UNIQUE (tenant_id, transition_id),
  UNIQUE (tenant_id, authority_hash),
  CHECK (
    (authority_sequence = 1 AND previous_authority_hash IS NULL)
    OR (authority_sequence > 1 AND previous_authority_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_authority_effective_idx
  ON agent_state.projection_replay_root_witness_authority_transitions (
    tenant_id,
    effective_from_root_sequence,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_authority_witness_idx
  ON agent_state.projection_replay_root_witness_authority_transitions (
    tenant_id,
    witness_id,
    authority_sequence
  );

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_root_witness_settlements (
  tenant_id                       TEXT NOT NULL,
  settlement_sequence             BIGINT NOT NULL,
  root_sequence                   BIGINT NOT NULL,
  root_hash                       TEXT NOT NULL,
  root                            JSONB NOT NULL,
  settlement                      JSONB NOT NULL,
  status                          TEXT NOT NULL,
  settlement_hash                 TEXT NOT NULL,
  authority_topology_hash         TEXT,
  previous_settlement_record_hash TEXT,
  settlement_record_hash          TEXT NOT NULL,
  recorded_at                     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, settlement_sequence),
  UNIQUE (tenant_id, settlement_record_hash),
  CHECK (
    (settlement_sequence = 1 AND previous_settlement_record_hash IS NULL)
    OR (settlement_sequence > 1 AND previous_settlement_record_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_settlement_root_idx
  ON agent_state.projection_replay_root_witness_settlements (
    tenant_id,
    root_sequence,
    root_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_root_witness_settlement_status_idx
  ON agent_state.projection_replay_root_witness_settlements (
    tenant_id,
    status,
    settlement_sequence
  );

COMMENT ON TABLE agent_state.projection_replay_root_witness_authority_transitions IS
  'Append-only witness-authority transitions. Replaying this ledger reconstructs eligible witness topology for a replay-root sequence.';

COMMENT ON COLUMN agent_state.projection_replay_root_witness_authority_transitions.authority_hash IS
  'Hash of the authority transition body, chained by previous_authority_hash so witness membership cannot be supplied from private memory.';

COMMENT ON TABLE agent_state.projection_replay_root_witness_settlements IS
  'Append-only settlement certificates for projection replay certificate-store roots. Replaying this ledger reconstructs which roots reached durable witness settlement.';

COMMENT ON COLUMN agent_state.projection_replay_root_witness_settlements.settlement_record_hash IS
  'Hash of the settlement record body, chained by previous_settlement_record_hash so settlement state is replayable rather than caller-supplied.';
