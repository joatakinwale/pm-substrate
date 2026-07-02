-- 0066_agent_state_recovery_cut_admission_records.sql
-- Durable admission records for replayable operational-state recovery cuts.

CREATE TABLE IF NOT EXISTS agent_state.recovery_cut_admission_records (
  tenant_id TEXT NOT NULL,
  recovery_cut_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  recovery_cut_hash TEXT NOT NULL,
  current_state_view_identity_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  recovery_cut JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, recovery_cut_store_id, admission_sequence),
  UNIQUE (tenant_id, recovery_cut_store_id, recovery_cut_hash),
  UNIQUE (tenant_id, recovery_cut_store_id, admission_record_hash)
);

CREATE INDEX IF NOT EXISTS recovery_cut_admission_records_scope_idx
  ON agent_state.recovery_cut_admission_records (
    tenant_id,
    authority_scope,
    recovery_cut_store_id,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS recovery_cut_admission_records_view_hash_idx
  ON agent_state.recovery_cut_admission_records (
    tenant_id,
    current_state_view_identity_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_recovery_cut_admission_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'recovery cut admission records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_recovery_cut_admission_record_rewrite
  ON agent_state.recovery_cut_admission_records;

CREATE TRIGGER prevent_recovery_cut_admission_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.recovery_cut_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_recovery_cut_admission_record_rewrite();

COMMENT ON TABLE agent_state.recovery_cut_admission_records IS
  'Append-only recovery-cut admission records. A recovery cut is not operational recovered state merely because it appears inside a CurrentStateView; it must be replayed from this authority-scoped, hash-linked admission history and bound to the current-state view identity hash.';

COMMENT ON COLUMN agent_state.recovery_cut_admission_records.current_state_view_identity_hash IS
  'Hash of the admissible CurrentStateView identity that the admitted recovery cut authorizes. Replay must reject a cut whose latest admission record is bound to a stale or different view identity.';

COMMENT ON COLUMN agent_state.recovery_cut_admission_records.previous_admission_record_hash IS
  'Hash link to the previous recovery-cut admission record in the same tenant, recovery cut store, and authority scope. Sequence forks or missing links are replay obstructions.';
