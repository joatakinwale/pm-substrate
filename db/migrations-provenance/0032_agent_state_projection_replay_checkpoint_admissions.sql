-- 0032_agent_state_projection_replay_checkpoint_admissions.sql
-- Durable admission records for settlement-head replay compaction checkpoints.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_settlement_head_witness_checkpoint_admissions (
  tenant_id TEXT NOT NULL,
  checkpoint_admission_sequence BIGINT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  checkpoint_admission_hash TEXT NOT NULL,
  authority_topology_hash TEXT,
  checkpoint JSONB NOT NULL,
  admission JSONB NOT NULL,
  previous_checkpoint_admission_record_hash TEXT,
  checkpoint_admission_record_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, checkpoint_admission_sequence),
  UNIQUE (tenant_id, checkpoint_hash),
  UNIQUE (tenant_id, checkpoint_admission_hash),
  UNIQUE (tenant_id, checkpoint_admission_record_hash)
);

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_checkpoint_admissions_by_checkpoint
  ON agent_state.projection_replay_settlement_head_witness_checkpoint_admissions (
    tenant_id,
    checkpoint_id,
    checkpoint_hash
  );

COMMENT ON TABLE agent_state.projection_replay_settlement_head_witness_checkpoint_admissions IS
  'Append-only durable admission records for settlement-head replay compaction checkpoints.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_checkpoint_admissions.checkpoint IS
  'Hash-checked compaction checkpoint body that can seed replay only after admission certificate validation.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_checkpoint_admissions.admission IS
  'Witness-signed checkpoint admission certificate that must replay under strict signature policy before checkpoint recovery.';
