-- 0042_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_authority.sql
-- Durable authority transitions for the pruning tombstone-head pruning
-- tombstone-store head witness topology.

CREATE TABLE IF NOT EXISTS agent_state.pruning_tombstone_head_pruning_store_head_witness_authority (
  tenant_id                                 TEXT NOT NULL,
  authority_sequence                        BIGINT NOT NULL,
  transition_id                             TEXT NOT NULL,
  transition_kind                           TEXT NOT NULL,
  recorded_at                               TIMESTAMPTZ NOT NULL,
  recorded_by                               TEXT NOT NULL,
  effective_from_pruning_tombstone_sequence BIGINT NOT NULL,
  witness_id                                TEXT,
  required_witnesses                        INTEGER,
  minimum_witnesses                         INTEGER,
  reason                                    TEXT,
  previous_authority_hash                   TEXT,
  authority_hash                            TEXT NOT NULL,
  transition                                JSONB NOT NULL,
  PRIMARY KEY (tenant_id, authority_sequence),
  UNIQUE (tenant_id, transition_id),
  UNIQUE (tenant_id, authority_hash),
  CHECK (
    (authority_sequence = 1 AND previous_authority_hash IS NULL)
    OR (authority_sequence > 1 AND previous_authority_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS pth_psh_witness_authority_effective_idx
  ON agent_state.pruning_tombstone_head_pruning_store_head_witness_authority (
    tenant_id,
    effective_from_pruning_tombstone_sequence,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS pth_psh_witness_authority_witness_idx
  ON agent_state.pruning_tombstone_head_pruning_store_head_witness_authority (
    tenant_id,
    witness_id,
    authority_sequence
  );

COMMENT ON TABLE agent_state.pruning_tombstone_head_pruning_store_head_witness_authority IS
  'Append-only pruning tombstone-head pruning tombstone-store head witness authority transitions. Replaying this ledger reconstructs eligible witness topology for pruning tombstone-store head certificates.';

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_authority.authority_hash IS
  'Hash of the authority transition body, chained by previous_authority_hash so pruning tombstone-store head witness topology cannot be supplied from private memory.';
