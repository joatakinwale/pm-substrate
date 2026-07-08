-- 0053_agent_state_history_store_head_pruning_tombstone_store_head_witness_authority.sql
-- Durable authority transitions for history-store-head pruning tombstone-store
-- head witness topology.

CREATE TABLE IF NOT EXISTS agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_authority (
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
  sealed_through_pruning_tombstone_sequence BIGINT,
  sealed_authority_topology_hash            TEXT,
  sealed_quorum_certificate_hash            TEXT,
  signature_key_id                          TEXT,
  signature_algorithm                       TEXT,
  signature_public_key_fingerprint          TEXT,
  reason                                    TEXT,
  previous_authority_hash                   TEXT,
  authority_hash                            TEXT NOT NULL,
  transition                                JSONB NOT NULL,
  PRIMARY KEY (tenant_id, authority_sequence),
  UNIQUE (tenant_id, transition_id),
  UNIQUE (tenant_id, authority_hash),
  CHECK (
    (authority_sequence = 1 AND previous_authority_hash IS NULL)
    OR
    (authority_sequence > 1 AND previous_authority_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_witness_authority_effective_idx
  ON agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_authority (
    tenant_id,
    effective_from_pruning_tombstone_sequence,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_witness_authority_witness_idx
  ON agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_authority (
    tenant_id,
    witness_id,
    authority_sequence
  );

COMMENT ON TABLE agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_authority IS
  'Append-only authority transitions for reconstructing history-store-head pruning tombstone-store head witness topology from durable replay.';

COMMENT ON COLUMN agent_state.pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_authority.authority_hash IS
  'Hash of the authority transition body, chained by previous_authority_hash so witness topology cannot be supplied from private memory or adapter state.';
