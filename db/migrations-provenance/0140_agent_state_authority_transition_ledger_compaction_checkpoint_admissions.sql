-- 0140_agent_state_authority_transition_ledger_compaction_checkpoint_admissions.sql
-- Durable admissions for authority-transition ledger compaction checkpoints.

CREATE TABLE IF NOT EXISTS agent_state.authority_transition_ledger_compaction_checkpoint_admission_records (
  tenant_id TEXT NOT NULL,
  checkpoint_admission_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  checkpoint_id TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  compacted_through_admission_sequence BIGINT NOT NULL CHECK (compacted_through_admission_sequence >= 1),
  compacted_through_authority_sequence BIGINT NOT NULL CHECK (compacted_through_authority_sequence >= 1),
  compacted_through_admission_record_hash TEXT NOT NULL,
  compacted_through_authority_record_hash TEXT NOT NULL,
  compacted_through_authority_topology_hash TEXT NOT NULL,
  retained_from_admission_sequence BIGINT NOT NULL CHECK (retained_from_admission_sequence >= 2),
  retained_from_authority_sequence BIGINT NOT NULL CHECK (retained_from_authority_sequence >= 2),
  source_replay_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  checkpoint JSONB NOT NULL,
  quorum_certificate JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    checkpoint_admission_store_id,
    admission_sequence,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_store_id,
    checkpoint_hash
  ),
  UNIQUE (
    tenant_id,
    checkpoint_admission_store_id,
    admission_record_hash
  ),
  CHECK (retained_from_admission_sequence = compacted_through_admission_sequence + 1),
  CHECK (retained_from_authority_sequence = compacted_through_authority_sequence + 1),
  CHECK (jsonb_typeof(checkpoint) = 'object'),
  CHECK (jsonb_typeof(quorum_certificate) = 'object'),
  CHECK (length(authority_scope) > 0),
  CHECK (length(authority_boundary) > 0),
  CHECK (length(transition_admission_store_id) > 0),
  CHECK (length(topology_id) > 0),
  CHECK (length(checkpoint_id) > 0),
  CHECK (length(checkpoint_hash) > 0),
  CHECK (length(compacted_through_admission_record_hash) > 0),
  CHECK (length(compacted_through_authority_record_hash) > 0),
  CHECK (length(compacted_through_authority_topology_hash) > 0),
  CHECK (length(source_replay_hash) > 0),
  CHECK (length(admitted_by) > 0),
  CHECK (length(admission_record_hash) > 0)
);

CREATE INDEX IF NOT EXISTS authority_transition_ledger_compaction_checkpoint_admission_scope_idx
  ON agent_state.authority_transition_ledger_compaction_checkpoint_admission_records (
    tenant_id,
    checkpoint_admission_store_id,
    authority_scope,
    authority_boundary,
    transition_admission_store_id,
    topology_id,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS authority_transition_ledger_compaction_checkpoint_admission_frontier_idx
  ON agent_state.authority_transition_ledger_compaction_checkpoint_admission_records (
    tenant_id,
    transition_admission_store_id,
    topology_id,
    compacted_through_admission_sequence,
    checkpoint_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_transition_ledger_compaction_checkpoint_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority-transition ledger compaction checkpoint admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_transition_ledger_compaction_checkpoint_admission_rewrite
  ON agent_state.authority_transition_ledger_compaction_checkpoint_admission_records;

CREATE TRIGGER prevent_authority_transition_ledger_compaction_checkpoint_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_transition_ledger_compaction_checkpoint_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_transition_ledger_compaction_checkpoint_admission_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_transition_ledger_compaction_checkpoint_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_transition_ledger_compaction_checkpoint_admission_records IS
  'Append-only admissions for authority-transition ledger compaction checkpoints. An authority-transition or transition-admission ledger prefix can be pruned only when the latest replayed admission record binds the exact checkpoint, compacted frontiers, source replay hash, and retained suffix start.';

COMMENT ON COLUMN agent_state.authority_transition_ledger_compaction_checkpoint_admission_records.checkpoint IS
  'Hash-bound embedded authority-transition ledger compaction checkpoint. This is not operational state unless admitted by replaying this admission record history.';

COMMENT ON COLUMN agent_state.authority_transition_ledger_compaction_checkpoint_admission_records.quorum_certificate IS
  'Certified quorum certificate over the exact authority-transition ledger compaction checkpoint hash and compacted admission frontier.';

COMMENT ON COLUMN agent_state.authority_transition_ledger_compaction_checkpoint_admission_records.source_replay_hash IS
  'Hash of the source authority-transition/admission replay that produced the compacted checkpoint, preventing private summaries from replacing replay-derived state.';

COMMENT ON COLUMN agent_state.authority_transition_ledger_compaction_checkpoint_admission_records.admission_record_hash IS
  'Deterministic hash of the full authority-transition ledger compaction checkpoint admission record, including checkpoint and quorum certificate.';
