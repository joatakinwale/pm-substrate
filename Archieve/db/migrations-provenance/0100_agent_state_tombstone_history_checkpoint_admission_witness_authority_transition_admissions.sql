-- 0100_agent_state_th_checkpoint_aw_authority_transition_admissions.sql
-- Durable admission records for tombstone-history checkpoint admission witness authority transitions.

CREATE TABLE IF NOT EXISTS agent_state.th_checkpoint_aw_authority_transition_admissions (
  tenant_id TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  tombstone_history_checkpoint_admission_witness_authority_topology_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  authority_sequence BIGINT NOT NULL CHECK (authority_sequence >= 1),
  authority_record_hash TEXT NOT NULL,
  previous_authority_record_hash TEXT,
  previous_authority_topology_hash TEXT,
  next_authority_topology_hash TEXT NOT NULL,
  authority_transition JSONB NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_admission_record_hash TEXT,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    transition_admission_store_id,
    admission_sequence,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_store_id,
    authority_record_hash
  ),
  CHECK (
    (admission_sequence = 1 AND previous_admission_record_hash IS NULL)
    OR (admission_sequence > 1 AND previous_admission_record_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS th_checkpoint_aw_authority_transition_scope_idx
  ON agent_state.th_checkpoint_aw_authority_transition_admissions (
    tenant_id,
    transition_admission_store_id,
    tombstone_history_checkpoint_admission_witness_authority_topology_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS th_checkpoint_aw_authority_transition_authority_idx
  ON agent_state.th_checkpoint_aw_authority_transition_admissions (
    tenant_id,
    tombstone_history_checkpoint_admission_witness_authority_topology_id,
    authority_sequence,
    authority_record_hash
  );

CREATE INDEX IF NOT EXISTS th_checkpoint_aw_authority_transition_topology_idx
  ON agent_state.th_checkpoint_aw_authority_transition_admissions (
    tenant_id,
    authority_scope,
    next_authority_topology_hash,
    admission_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_th_checkpoint_aw_authority_transition_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tombstone-history checkpoint admission witness authority transition admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_th_checkpoint_aw_authority_transition_rewrite
  ON agent_state.th_checkpoint_aw_authority_transition_admissions;

CREATE TRIGGER prevent_th_checkpoint_aw_authority_transition_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.th_checkpoint_aw_authority_transition_admissions
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_th_checkpoint_aw_authority_transition_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.th_checkpoint_aw_authority_transition_admissions FROM PUBLIC;

COMMENT ON TABLE agent_state.th_checkpoint_aw_authority_transition_admissions IS
  'Append-only admission records for tombstone-history checkpoint admission witness authority transitions. Replaying this ledger proves which checkpoint-admission witness authority topology rows were admitted instead of supplied from memory, adapters, or connector caches.';

COMMENT ON COLUMN agent_state.th_checkpoint_aw_authority_transition_admissions.authority_record_hash IS
  'Deterministic hash of the admitted tombstone-history checkpoint admission witness authority transition.';

COMMENT ON COLUMN agent_state.th_checkpoint_aw_authority_transition_admissions.previous_authority_topology_hash IS
  'Hash of the previous replayed authority topology whose active principals certified this authority transition, except for the bootstrap transition.';

COMMENT ON COLUMN agent_state.th_checkpoint_aw_authority_transition_admissions.next_authority_topology_hash IS
  'Hash of the authority topology derived after applying the admitted authority transition.';

COMMENT ON COLUMN agent_state.th_checkpoint_aw_authority_transition_admissions.admission_certificate IS
  'Quorum certificate over the exact authority transition hash and authority boundary.';
