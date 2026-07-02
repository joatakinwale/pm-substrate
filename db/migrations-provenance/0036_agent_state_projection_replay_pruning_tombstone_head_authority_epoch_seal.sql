-- 0036_agent_state_projection_replay_pruning_tombstone_head_authority_epoch_seal.sql
-- Non-retroactive authority epoch seals for pruning tombstone-store head witness topology.

ALTER TABLE agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions
  ADD COLUMN IF NOT EXISTS sealed_through_pruning_tombstone_sequence BIGINT,
  ADD COLUMN IF NOT EXISTS sealed_authority_topology_hash TEXT,
  ADD COLUMN IF NOT EXISTS sealed_quorum_certificate_hash TEXT;

CREATE INDEX IF NOT EXISTS projection_replay_pruning_tombstone_head_witness_auth_seal_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions (
    tenant_id,
    sealed_through_pruning_tombstone_sequence,
    authority_sequence
  )
  WHERE sealed_through_pruning_tombstone_sequence IS NOT NULL;

COMMENT ON COLUMN agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions.sealed_through_pruning_tombstone_sequence IS
  'Highest pruning tombstone sequence whose tombstone-head witness authority basis has been finalized by a seal_authority_epoch transition.';

COMMENT ON COLUMN agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions.sealed_authority_topology_hash IS
  'Effective authority topology hash sealed for historical tombstone-head certification.';

COMMENT ON COLUMN agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions.sealed_quorum_certificate_hash IS
  'Quorum certificate hash finalized by the tombstone-head authority epoch seal.';
