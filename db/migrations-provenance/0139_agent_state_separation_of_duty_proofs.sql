-- 0139_agent_state_separation_of_duty_proofs.sql
-- Append-only separation-of-duty proofs for protected storage mutation.

CREATE TABLE IF NOT EXISTS agent_state.separation_of_duty_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_sequence BIGINT NOT NULL CHECK (subject_sequence >= 1),
  subject_hash TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  protected_schema TEXT NOT NULL,
  protected_table TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('DELETE', 'UPDATE')),
  target_sequence BIGINT NOT NULL CHECK (target_sequence >= 1),
  authorization_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  admission_role TEXT NOT NULL,
  execution_role TEXT NOT NULL,
  admission_authority_ids TEXT[] NOT NULL,
  execution_authority_ids TEXT[] NOT NULL,
  conflict_authority_ids TEXT[] NOT NULL DEFAULT '{}',
  disjoint BOOLEAN NOT NULL,
  proof_rule TEXT NOT NULL,
  proof_reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  evaluated_by TEXT NOT NULL,
  verifier_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('valid', 'invalid')),
  adapter_claims TEXT[] NOT NULL DEFAULT '{}',
  proof JSONB NOT NULL,
  separation_of_duty_proof_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, proof_id),
  UNIQUE (tenant_id, guard_id, protected_schema, protected_table, operation, target_sequence, separation_of_duty_proof_hash),
  UNIQUE (tenant_id, subject_hash, target_sequence, separation_of_duty_proof_hash),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (result = 'valid'),
  CHECK (disjoint),
  CHECK (cardinality(admission_authority_ids) > 0),
  CHECK (cardinality(execution_authority_ids) > 0),
  CHECK (cardinality(conflict_authority_ids) = 0),
  CHECK (length(proof_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(authority_boundary) > 0),
  CHECK (length(subject_hash) > 0),
  CHECK (length(guard_id) > 0),
  CHECK (length(protected_schema) > 0),
  CHECK (length(protected_table) > 0),
  CHECK (length(authorization_hash) > 0),
  CHECK (length(admission_record_hash) > 0),
  CHECK (length(admission_role) > 0),
  CHECK (length(execution_role) > 0),
  CHECK (length(proof_rule) > 0),
  CHECK (length(evaluated_by) > 0),
  CHECK (length(separation_of_duty_proof_hash) > 0)
);

CREATE INDEX IF NOT EXISTS separation_of_duty_proofs_subject_idx
  ON agent_state.separation_of_duty_proofs (
    tenant_id,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash
  );

CREATE INDEX IF NOT EXISTS separation_of_duty_proofs_guard_idx
  ON agent_state.separation_of_duty_proofs (
    tenant_id,
    guard_id,
    protected_schema,
    protected_table,
    operation,
    target_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_separation_of_duty_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'separation-of-duty proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_separation_of_duty_proof_rewrite
  ON agent_state.separation_of_duty_proofs;

CREATE TRIGGER prevent_separation_of_duty_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.separation_of_duty_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_separation_of_duty_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.separation_of_duty_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.separation_of_duty_proofs IS
  'Append-only separation-of-duty proofs for protected mutation. Strict storage mutation guard evaluation can require admission and execution authority paths to be replayably disjoint before an admitted authorization can execute.';

COMMENT ON COLUMN agent_state.separation_of_duty_proofs.admission_authority_ids IS
  'Replay-bound authority ids that admitted or witnessed the protected mutation authorization.';

COMMENT ON COLUMN agent_state.separation_of_duty_proofs.execution_authority_ids IS
  'Replay-bound authority ids executing the protected mutation. These must remain disjoint from admission_authority_ids.';

COMMENT ON COLUMN agent_state.separation_of_duty_proofs.conflict_authority_ids IS
  'Must remain empty. Non-empty conflicts mean the same authority path both admitted and executed the protected mutation.';
