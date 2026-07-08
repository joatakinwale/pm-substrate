-- 0137_agent_state_authority_bootstrap_settlement_records.sql
-- Append-only settlement records for root-authority bootstrap certificates.

CREATE TABLE IF NOT EXISTS agent_state.authority_bootstrap_settlement_records (
  tenant_id TEXT NOT NULL,
  bootstrap_settlement_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  settlement_sequence BIGINT NOT NULL CHECK (settlement_sequence >= 1),
  settlement_key TEXT NOT NULL,
  bootstrap_certificate_hash TEXT NOT NULL,
  bootstrap_certificate JSONB NOT NULL,
  root_authority_id TEXT NOT NULL,
  root_authority_version TEXT,
  bootstrap_topology_hash TEXT NOT NULL,
  authorized_admission_sequence BIGINT NOT NULL CHECK (authorized_admission_sequence = 1),
  authorized_admission_record_hash TEXT NOT NULL,
  authorized_authority_sequence BIGINT NOT NULL CHECK (authorized_authority_sequence = 1),
  authorized_authority_record_hash TEXT NOT NULL,
  authorized_next_authority_topology_hash TEXT NOT NULL,
  previous_settlement_record_hash TEXT,
  settled_at TIMESTAMPTZ NOT NULL,
  settled_by TEXT NOT NULL,
  settlement_reason TEXT,
  settlement_record_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (
    tenant_id,
    bootstrap_settlement_store_id,
    settlement_sequence
  ),
  UNIQUE (
    tenant_id,
    bootstrap_settlement_store_id,
    settlement_key
  ),
  UNIQUE (
    tenant_id,
    bootstrap_settlement_store_id,
    bootstrap_certificate_hash
  ),
  UNIQUE (
    tenant_id,
    bootstrap_settlement_store_id,
    settlement_record_hash
  ),
  CHECK (jsonb_typeof(bootstrap_certificate) = 'object'),
  CHECK (length(settlement_key) > 0),
  CHECK (length(bootstrap_certificate_hash) > 0),
  CHECK (length(settled_by) > 0)
);

CREATE INDEX IF NOT EXISTS authority_bootstrap_settlement_records_scope_idx
  ON agent_state.authority_bootstrap_settlement_records (
    tenant_id,
    authority_scope,
    authority_boundary,
    transition_admission_store_id,
    topology_id
  );

CREATE INDEX IF NOT EXISTS authority_bootstrap_settlement_records_root_idx
  ON agent_state.authority_bootstrap_settlement_records (
    tenant_id,
    root_authority_id,
    root_authority_version,
    settled_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_bootstrap_settlement_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority bootstrap settlement records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_bootstrap_settlement_record_rewrite
  ON agent_state.authority_bootstrap_settlement_records;

CREATE TRIGGER prevent_authority_bootstrap_settlement_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_bootstrap_settlement_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_bootstrap_settlement_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_bootstrap_settlement_records FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_bootstrap_settlement_records IS
  'Append-only settlement records for root-authority bootstrap certificates. Strict authority replay can require a genesis bootstrap certificate to appear in this replayed settlement history before authority-bootstrap can authorize the first transition.';

COMMENT ON COLUMN agent_state.authority_bootstrap_settlement_records.settlement_key IS
  'Hash of tenant, authority scope, authority boundary, transition-admission store, and topology. Only one bootstrap certificate can settle for the same key in a settlement store.';

COMMENT ON COLUMN agent_state.authority_bootstrap_settlement_records.bootstrap_certificate_hash IS
  'Hash of the settled root-authority bootstrap certificate. Replay rejects certificates that do not match this settled hash and detects conflicting same-key certificates.';

COMMENT ON COLUMN agent_state.authority_bootstrap_settlement_records.previous_settlement_record_hash IS
  'Hash-chain pointer to the previous settlement record so an amnesiac agent can reconstruct the admitted root-settlement history from storage.';
