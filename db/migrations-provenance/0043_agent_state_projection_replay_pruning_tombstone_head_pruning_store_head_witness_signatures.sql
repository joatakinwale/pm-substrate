-- 0043_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_signatures.sql
-- Signature-bound identity for pruning tombstone-head pruning tombstone-store
-- head witnesses.

ALTER TABLE agent_state.pruning_tombstone_head_pruning_store_head_witness_observations
  ADD COLUMN IF NOT EXISTS signature JSONB;

ALTER TABLE agent_state.pruning_tombstone_head_pruning_store_head_witness_authority
  ADD COLUMN IF NOT EXISTS signature_key_id TEXT,
  ADD COLUMN IF NOT EXISTS signature_algorithm TEXT,
  ADD COLUMN IF NOT EXISTS signature_public_key_fingerprint TEXT;

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_observations.signature IS
  'Optional witness-principal signature over the pruning tombstone-store head observation payload. Store-backed certification requires this signature to match the replay-admitted witness key.';

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_authority.signature_key_id IS
  'Replay-admitted key id for a pruning tombstone-store head witness principal.';

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_authority.signature_algorithm IS
  'Replay-admitted signature algorithm for a pruning tombstone-store head witness principal.';

COMMENT ON COLUMN agent_state.pruning_tombstone_head_pruning_store_head_witness_authority.signature_public_key_fingerprint IS
  'Replay-admitted public key fingerprint for a pruning tombstone-store head witness principal.';
