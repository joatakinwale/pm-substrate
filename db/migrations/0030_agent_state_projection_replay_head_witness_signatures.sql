-- 0030_agent_state_projection_replay_head_witness_signatures.sql
-- Signature-bearing identity metadata for settlement-head witness observations and authority seals.

ALTER TABLE agent_state.projection_replay_settlement_head_witness_observations
  ADD COLUMN IF NOT EXISTS signature JSONB;

ALTER TABLE agent_state.projection_replay_settlement_head_witness_authority_transitions
  ADD COLUMN IF NOT EXISTS signature_key_id TEXT,
  ADD COLUMN IF NOT EXISTS signature_algorithm TEXT,
  ADD COLUMN IF NOT EXISTS signature_public_key_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS signature JSONB;

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_observations.signature IS
  'Principal signature proof over the witnessed settlement-store head observation payload.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_authority_transitions.signature IS
  'Principal signature proof over an authority transition such as seal_authority_epoch.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_authority_transitions.signature_key_id IS
  'Admitted signing key identifier for a settlement-head witness principal transition.';
