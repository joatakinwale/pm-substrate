-- 0067_agent_state_history_root_observer_signature_proofs.sql
-- Durable observer signature proofs for operational state history-root transparency.

CREATE TABLE IF NOT EXISTS agent_state.history_root_observer_signature_proofs (
  tenant_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  observer_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  store_kind TEXT NOT NULL,
  root_sequence BIGINT NOT NULL CHECK (root_sequence >= 1),
  root_hash TEXT NOT NULL,
  root_commitment_hash TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  observation_hash TEXT NOT NULL,
  observer_signature_payload_hash TEXT NOT NULL,
  observer_key_binding JSONB NOT NULL,
  verifier_proof JSONB NOT NULL,
  observer_signature_proof_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    authority_scope,
    observer_id,
    store_id,
    root_sequence,
    observation_hash
  ),
  UNIQUE (tenant_id, authority_scope, observer_signature_proof_hash)
);

CREATE INDEX IF NOT EXISTS history_root_observer_signature_proofs_root_idx
  ON agent_state.history_root_observer_signature_proofs (
    tenant_id,
    authority_scope,
    store_id,
    root_sequence,
    root_hash
  );

CREATE INDEX IF NOT EXISTS history_root_observer_signature_proofs_observer_idx
  ON agent_state.history_root_observer_signature_proofs (
    tenant_id,
    authority_scope,
    observer_id,
    observed_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_history_root_observer_signature_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'history root observer signature proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_history_root_observer_signature_proof_rewrite
  ON agent_state.history_root_observer_signature_proofs;

CREATE TRIGGER prevent_history_root_observer_signature_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.history_root_observer_signature_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_history_root_observer_signature_proof_rewrite();

COMMENT ON TABLE agent_state.history_root_observer_signature_proofs IS
  'Append-only observer signature proofs for operational-state history-root transparency. A root observation can bless or obstruct recovery only when the exact observation payload is signed by a replay-current observer key and verified through a constrained signature-verifier adapter proof.';

COMMENT ON COLUMN agent_state.history_root_observer_signature_proofs.observer_signature_payload_hash IS
  'Hash of the canonical signed root-observation payload: tenant, scope, observer, store, root sequence/hash, observed-at time, and observation hash.';

COMMENT ON COLUMN agent_state.history_root_observer_signature_proofs.verifier_proof IS
  'Constrained verifier adapter proof for the observer signature over observer_signature_payload_hash. The verifier may prove signature validity only, not observer authority, key currentness, topology currentness, quorum, or admission.';
