-- 0133_agent_state_auth_topo_checkpoint_aw_authority_transition_witness_authority_transition_admissions.sql
-- Durable admission records for authority-topology transition-admission witness authority transitions.

CREATE TABLE IF NOT EXISTS agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms (
  tenant_id TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  transition_admission_witness_authority_topology_id TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS auth_top_cp_adm_wit_auth_trans_scope_idx
  ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms (
    tenant_id,
    transition_admission_store_id,
    transition_admission_witness_authority_topology_id,
    authority_scope,
    admission_sequence
  );

CREATE INDEX IF NOT EXISTS auth_top_cp_adm_wit_auth_trans_authority_idx
  ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms (
    tenant_id,
    transition_admission_witness_authority_topology_id,
    authority_sequence,
    authority_record_hash
  );

CREATE INDEX IF NOT EXISTS auth_top_cp_adm_wit_auth_trans_topology_idx
  ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms (
    tenant_id,
    authority_scope,
    next_authority_topology_hash,
    admission_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_auth_top_cp_adm_wit_auth_trans_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority-topology transition-admission witness authority transition admissions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_auth_top_cp_adm_wit_auth_trans_rewrite
  ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms;

CREATE TRIGGER prevent_auth_top_cp_adm_wit_auth_trans_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_auth_top_cp_adm_wit_auth_trans_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms FROM PUBLIC;

COMMENT ON TABLE agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms IS
  'Append-only admission records for authority transitions that define the witness topology certifying authority-topology checkpoint admission witness authority-transition admission witness records. Replaying this ledger proves the nested witness authority topology was admitted instead of supplied from agent memory, adapters, connector caches, or local snapshots.';

COMMENT ON COLUMN agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms.authority_record_hash IS
  'Deterministic hash of the admitted transition-admission witness authority transition.';

COMMENT ON COLUMN agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms.previous_authority_topology_hash IS
  'Hash of the previous replayed transition-admission witness authority topology whose active principals certified this authority transition, except for the bootstrap transition.';

COMMENT ON COLUMN agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms.next_authority_topology_hash IS
  'Hash of the transition-admission witness authority topology derived after applying the admitted authority transition.';

COMMENT ON COLUMN agent_state.auth_top_cp_adm_wit_auth_trans_adm_wit_auth_trans_adms.admission_certificate IS
  'Quorum certificate over the exact transition-admission witness authority transition hash and authority boundary.';
