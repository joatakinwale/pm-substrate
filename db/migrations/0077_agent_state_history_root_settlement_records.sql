-- 0077_agent_state_history_root_settlement_records.sql
-- Quorum-certified settlement records for operational-state history roots.

CREATE TABLE IF NOT EXISTS agent_state.history_root_settlement_records (
  tenant_id TEXT NOT NULL,
  root_settlement_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  settlement_sequence BIGINT NOT NULL CHECK (settlement_sequence >= 1),
  store_id TEXT NOT NULL,
  store_kind TEXT NOT NULL,
  root_sequence BIGINT NOT NULL CHECK (root_sequence >= 1),
  root_hash TEXT NOT NULL,
  root_commitment_hash TEXT NOT NULL,
  root JSONB NOT NULL,
  settlement_certificate JSONB NOT NULL,
  previous_settlement_record_hash TEXT,
  settled_at TIMESTAMPTZ NOT NULL,
  settled_by TEXT NOT NULL,
  settlement_reason TEXT,
  settlement_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    root_settlement_store_id,
    settlement_sequence,
    settlement_record_hash
  ),
  UNIQUE (
    tenant_id,
    root_settlement_store_id,
    store_id,
    root_sequence,
    root_commitment_hash
  ),
  UNIQUE (
    tenant_id,
    root_settlement_store_id,
    settlement_record_hash
  )
);

CREATE INDEX IF NOT EXISTS history_root_settlement_scope_idx
  ON agent_state.history_root_settlement_records (
    tenant_id,
    root_settlement_store_id,
    authority_scope,
    settlement_sequence
  );

CREATE INDEX IF NOT EXISTS history_root_settlement_root_idx
  ON agent_state.history_root_settlement_records (
    tenant_id,
    authority_scope,
    store_id,
    root_sequence,
    root_commitment_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_history_root_settlement_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'history root settlement records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_history_root_settlement_record_rewrite
  ON agent_state.history_root_settlement_records;

CREATE TRIGGER prevent_history_root_settlement_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.history_root_settlement_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_history_root_settlement_record_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.history_root_settlement_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.history_root_observer_signature_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.history_root_settlement_records IS
  'Append-only quorum-certified settlement records for history roots. Strict recovery can require a root to be settled here so one signed observer cannot unilaterally bless a recovery root.';

COMMENT ON COLUMN agent_state.history_root_settlement_records.root_commitment_hash IS
  'Deterministic commitment hash of the exact history root being settled. The settlement certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.history_root_settlement_records.settlement_certificate IS
  'Quorum certificate over the exact store id, root sequence, and root commitment hash.';

COMMENT ON COLUMN agent_state.history_root_settlement_records.settlement_record_hash IS
  'Deterministic hash of the full history-root settlement record, including embedded root, settlement certificate, and previous settlement hash.';
