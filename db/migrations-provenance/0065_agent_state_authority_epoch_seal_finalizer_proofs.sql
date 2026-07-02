-- 0065_agent_state_authority_epoch_seal_finalizer_proofs.sql
-- Durable finalizer signature proofs for authority epoch seals.

CREATE TABLE IF NOT EXISTS agent_state.authority_epoch_seal_finalizer_proofs (
  tenant_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  seal_id TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  sealed_subject_kind TEXT NOT NULL,
  sealed_subject_id TEXT NOT NULL,
  sealed_subject_sequence BIGINT NOT NULL CHECK (sealed_subject_sequence >= 1),
  sealed_authority_topology_hash TEXT NOT NULL,
  sealed_quorum_certificate_hash TEXT NOT NULL,
  authority_transition_hash TEXT,
  finalized_at TIMESTAMPTZ NOT NULL,
  finalizer_principal_id TEXT NOT NULL,
  finalizer_key_binding JSONB NOT NULL,
  verifier_proof JSONB NOT NULL,
  seal_payload_hash TEXT NOT NULL,
  finalizer_proof_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, authority_scope, seal_id),
  UNIQUE (tenant_id, authority_scope, finalizer_proof_hash)
);

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proofs_subject_idx
  ON agent_state.authority_epoch_seal_finalizer_proofs (
    tenant_id,
    authority_scope,
    authority_boundary,
    sealed_subject_kind,
    sealed_subject_id,
    sealed_subject_sequence
  );

CREATE INDEX IF NOT EXISTS authority_epoch_seal_finalizer_proofs_finalizer_idx
  ON agent_state.authority_epoch_seal_finalizer_proofs (
    tenant_id,
    authority_scope,
    finalizer_principal_id,
    finalized_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority epoch seal finalizer proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_epoch_seal_finalizer_proof_rewrite
  ON agent_state.authority_epoch_seal_finalizer_proofs;

CREATE TRIGGER prevent_authority_epoch_seal_finalizer_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_epoch_seal_finalizer_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_epoch_seal_finalizer_proof_rewrite();

COMMENT ON TABLE agent_state.authority_epoch_seal_finalizer_proofs IS
  'Append-only finalizer signature proofs for authority epoch seals. A seal is not final operational state unless its exact payload is signed by a replay-current finalizer principal and verified through constrained signature-verifier adapter proof replay.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proofs.finalizer_key_binding IS
  'Hash-bound replayed finalizer key binding: tenant, authority scope, finalizer principal, key id, algorithm, key status, authority frontier, sealed topology hash, and external key material.';

COMMENT ON COLUMN agent_state.authority_epoch_seal_finalizer_proofs.verifier_proof IS
  'Constrained verifier adapter proof for the finalizer signature over seal_payload_hash. The verifier may prove signature validity only, not finalizer authority, key currentness, topology currentness, quorum, or admission.';
