-- 0078_agent_state_pruning_policy_admission_witness_records.sql
-- Witness-certified accountability records for pruning-policy admission rows.

CREATE TABLE IF NOT EXISTS agent_state.pruning_policy_admission_witness_records (
  tenant_id TEXT NOT NULL,
  policy_admission_witness_store_id TEXT NOT NULL,
  policy_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  policy_sequence BIGINT NOT NULL CHECK (policy_sequence >= 1),
  policy_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  policy_record_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    policy_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    policy_admission_witness_store_id,
    policy_record_hash
  ),
  UNIQUE (
    tenant_id,
    policy_admission_witness_store_id,
    witness_record_hash
  )
);

CREATE INDEX IF NOT EXISTS pruning_policy_admission_witness_scope_idx
  ON agent_state.pruning_policy_admission_witness_records (
    tenant_id,
    policy_admission_witness_store_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS pruning_policy_admission_witness_policy_idx
  ON agent_state.pruning_policy_admission_witness_records (
    tenant_id,
    policy_store_id,
    policy_sequence,
    policy_record_hash
  );

CREATE INDEX IF NOT EXISTS pruning_policy_admission_witness_hash_idx
  ON agent_state.pruning_policy_admission_witness_records (
    tenant_id,
    authority_scope,
    policy_id,
    policy_hash,
    artifact_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_pruning_policy_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pruning policy admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_pruning_policy_admission_witness_record_rewrite
  ON agent_state.pruning_policy_admission_witness_records;

CREATE TRIGGER prevent_pruning_policy_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.pruning_policy_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_pruning_policy_admission_witness_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.pruning_policy_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.pruning_policy_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.pruning_policy_admission_witness_records IS
  'Append-only witness accountability records for pruning-policy admission rows. Strict policy admission can require this ledger so a policy-admission row is not sufficient unless a quorum certificate witnesses the exact policy record hash.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_witness_records.policy_record_hash IS
  'Deterministic hash of the pruning-policy admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact policy store id, policy sequence, and policy record hash.';

COMMENT ON COLUMN agent_state.pruning_policy_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the pruning-policy admission witness record, including the witness certificate and hash link to the prior witness record.';
