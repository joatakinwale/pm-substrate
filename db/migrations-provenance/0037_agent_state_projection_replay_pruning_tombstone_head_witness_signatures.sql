-- 0037_agent_state_projection_replay_pruning_tombstone_head_witness_signatures.sql
-- Signature-bound identity for pruning tombstone-store head witnesses and authority seals.

ALTER TABLE agent_state.projection_replay_pruning_tombstone_head_witness_observations
  ADD COLUMN IF NOT EXISTS signature JSONB;

ALTER TABLE agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions
  ADD COLUMN IF NOT EXISTS signature_key_id TEXT,
  ADD COLUMN IF NOT EXISTS signature_algorithm TEXT,
  ADD COLUMN IF NOT EXISTS signature_public_key_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS signature JSONB;

CREATE INDEX IF NOT EXISTS projection_replay_pruning_tombstone_head_witness_signature_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_observations (
    tenant_id,
    observer_id,
    witness_sequence
  )
  WHERE signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS projection_replay_pruning_tombstone_head_witness_auth_key_idx
  ON agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions (
    tenant_id,
    witness_id,
    signature_key_id,
    authority_sequence
  )
  WHERE signature_key_id IS NOT NULL;

COMMENT ON COLUMN agent_state.projection_replay_pruning_tombstone_head_witness_observations.signature IS
  'Principal signature over the pruning tombstone-head observation payload. Strict replay rejects unsigned or wrong-key observations before they count toward tombstone-head currentness.';

COMMENT ON COLUMN agent_state.projection_replay_pruning_tombstone_head_witness_authority_transitions.signature IS
  'Principal signature over a pruning tombstone-head authority epoch seal transition. Strict replay rejects unsigned or wrong-key seals.';
