-- 0063_agent_state_authority_topology_compaction_checkpoints.sql
-- Durable checkpoints for compacted operational-state authority topologies.

CREATE TABLE IF NOT EXISTS agent_state.authority_topology_compaction_checkpoints (
  tenant_id TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  compacted_through_authority_sequence BIGINT NOT NULL,
  compacted_topology JSONB NOT NULL,
  retained_from_authority_sequence BIGINT NOT NULL,
  checkpointed_at TIMESTAMPTZ NOT NULL,
  checkpointed_by TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    topology_id,
    compacted_through_authority_sequence,
    checkpoint_hash
  ),
  UNIQUE (tenant_id, topology_id, checkpoint_id),
  UNIQUE (tenant_id, topology_id, checkpoint_hash),
  CHECK (compacted_through_authority_sequence >= 0),
  CHECK (
    retained_from_authority_sequence =
    compacted_through_authority_sequence + 1
  )
);

CREATE INDEX IF NOT EXISTS authority_topology_compaction_checkpoints_scope_idx
  ON agent_state.authority_topology_compaction_checkpoints (
    tenant_id,
    topology_id,
    authority_scope,
    compacted_through_authority_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_topology_compaction_checkpoint_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority topology compaction checkpoints are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_topology_compaction_checkpoint_rewrite
  ON agent_state.authority_topology_compaction_checkpoints;

CREATE TRIGGER prevent_authority_topology_compaction_checkpoint_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_topology_compaction_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_topology_compaction_checkpoint_rewrite();

COMMENT ON TABLE agent_state.authority_topology_compaction_checkpoints IS
  'Append-only compacted authority-topology checkpoints. A checkpoint is only a replay seed; retained authority-transition suffix replay must still recover the required topology.';

COMMENT ON COLUMN agent_state.authority_topology_compaction_checkpoints.compacted_topology IS
  'Hash-bound authority topology at compacted_through_authority_sequence, including quorum thresholds, principal status, key status, and seal frontier.';
