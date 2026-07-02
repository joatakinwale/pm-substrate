-- 0068_agent_state_pruning_policy_admission_records.sql
-- Durable admission records for replay-current operational-state pruning policies.

CREATE TABLE IF NOT EXISTS agent_state.pruning_policy_admission_records (
  tenant_id TEXT NOT NULL,
  policy_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  policy_sequence BIGINT NOT NULL CHECK (policy_sequence >= 1),
  policy_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  previous_policy_record_hash TEXT,
  artifact JSONB NOT NULL,
  artifact_hash TEXT NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  policy_record_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, policy_store_id, policy_sequence),
  UNIQUE (tenant_id, policy_store_id, policy_hash),
  UNIQUE (tenant_id, policy_store_id, policy_record_hash)
);

CREATE INDEX IF NOT EXISTS pruning_policy_admission_records_scope_idx
  ON agent_state.pruning_policy_admission_records (
    tenant_id,
    authority_scope,
    policy_store_id,
    policy_sequence
  );

CREATE INDEX IF NOT EXISTS pruning_policy_admission_records_policy_idx
  ON agent_state.pruning_policy_admission_records (
    tenant_id,
    policy_id,
    policy_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_pruning_policy_admission_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pruning policy admission records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_pruning_policy_admission_record_rewrite
  ON agent_state.pruning_policy_admission_records;

CREATE TRIGGER prevent_pruning_policy_admission_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.pruning_policy_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_pruning_policy_admission_record_rewrite();

COMMENT ON TABLE agent_state.pruning_policy_admission_records IS
  'Append-only pruning-policy admission records. A compiled pruning policy is not operational authority merely because a caller supplies it; it must replay from this authority-scoped, hash-linked policy-admission history, and action review can require the latest admitted artifact.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_records.artifact IS
  'Proof-carrying compiled pruning-policy artifact, including the deterministic policy hash, compiler metadata, and compiled replay-lane obligations.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_records.previous_policy_record_hash IS
  'Hash link to the previous pruning-policy admission record in the same tenant, policy store, and authority scope. Sequence forks or missing links are replay obstructions.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_records.policy_hash IS
  'Hash of the admitted compiled pruning policy. Recovery may require this hash to match the latest replayed policy admission record so stale compiler output cannot authorize operational state.';
