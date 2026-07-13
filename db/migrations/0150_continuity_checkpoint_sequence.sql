-- 0150_continuity_checkpoint_sequence.sql
-- A database-assigned append order is required for deterministic tail choice.
-- Wall clocks can regress or collide, and checkpoint ids are random.

ALTER TABLE continuity.checkpoints
  ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX IF NOT EXISTS checkpoints_seq_uidx
  ON continuity.checkpoints(seq);

CREATE INDEX IF NOT EXISTS checkpoints_tenant_agent_seq_idx
  ON continuity.checkpoints(tenant_id, agent_id, seq DESC);

COMMENT ON COLUMN continuity.checkpoints.seq IS
  'Database-assigned monotonic append order; selects the logical chain tail independently of clock/id ordering.';
