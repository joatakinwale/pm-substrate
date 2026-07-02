-- 0029_agent_state_projection_replay_settlement_head_witness_authority.sql
-- Durable authority transitions for settlement-store head witness topology.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_settlement_head_witness_authority_transitions (
  tenant_id                          TEXT NOT NULL,
  authority_sequence                 BIGINT NOT NULL,
  transition_id                      TEXT NOT NULL,
  transition_kind                    TEXT NOT NULL,
  recorded_at                        TIMESTAMPTZ NOT NULL,
  recorded_by                        TEXT NOT NULL,
  effective_from_settlement_sequence BIGINT NOT NULL,
  witness_id                         TEXT,
  required_witnesses                 INTEGER,
  minimum_witnesses                  INTEGER,
  sealed_through_settlement_sequence BIGINT,
  sealed_authority_topology_hash     TEXT,
  sealed_quorum_certificate_hash     TEXT,
  reason                             TEXT,
  previous_authority_hash            TEXT,
  authority_hash                     TEXT NOT NULL,
  transition                         JSONB NOT NULL,
  PRIMARY KEY (tenant_id, authority_sequence),
  UNIQUE (tenant_id, transition_id),
  UNIQUE (tenant_id, authority_hash),
  CHECK (
    (authority_sequence = 1 AND previous_authority_hash IS NULL)
    OR (authority_sequence > 1 AND previous_authority_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_auth_effective_idx
  ON agent_state.projection_replay_settlement_head_witness_authority_transitions (
    tenant_id,
    effective_from_settlement_sequence,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_auth_witness_idx
  ON agent_state.projection_replay_settlement_head_witness_authority_transitions (
    tenant_id,
    witness_id,
    authority_sequence
  );

COMMENT ON TABLE agent_state.projection_replay_settlement_head_witness_authority_transitions IS
  'Append-only settlement-store head witness authority transitions. Replaying this ledger reconstructs eligible head-witness topology for a settlement-store head.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_authority_transitions.authority_hash IS
  'Hash of the authority transition body, chained by previous_authority_hash so settlement-head witness membership cannot be supplied from private memory.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_authority_transitions.sealed_through_settlement_sequence IS
  'Highest settlement sequence whose head-witness authority basis has been finalized by a seal_authority_epoch transition.';
