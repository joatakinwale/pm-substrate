-- 0064_agent_state_signature_verifier_adapter_proofs.sql
-- Durable proofs for constrained production signature-verifier adapters.

CREATE TABLE IF NOT EXISTS agent_state.signature_verifier_adapter_proofs (
  tenant_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  verification_id TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  verifier_version TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  key_binding JSONB NOT NULL,
  proof JSONB NOT NULL,
  proof_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, authority_scope, verification_id),
  UNIQUE (tenant_id, authority_scope, proof_hash)
);

CREATE INDEX IF NOT EXISTS signature_verifier_adapter_proofs_verifier_idx
  ON agent_state.signature_verifier_adapter_proofs (
    tenant_id,
    authority_scope,
    verifier_id,
    verified_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature verifier adapter proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_signature_verifier_adapter_proof_rewrite
  ON agent_state.signature_verifier_adapter_proofs;

CREATE TRIGGER prevent_signature_verifier_adapter_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.signature_verifier_adapter_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_signature_verifier_adapter_proof_rewrite();

COMMENT ON TABLE agent_state.signature_verifier_adapter_proofs IS
  'Append-only constrained signature-verifier adapter proofs. These rows prove cryptographic signature verification against replayed key material only; key currentness, authority, topology, quorum, and transition admission must come from substrate replay.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proofs.key_binding IS
  'Hash-bound replayed key binding containing tenant, authority scope, principal, key id, algorithm, key status, authority frontier, and external key-material fingerprint or hash.';

COMMENT ON COLUMN agent_state.signature_verifier_adapter_proofs.proof IS
  'Hash-bound verifier adapter proof over payload hash, signature hash, replayed key-binding hash, verifier id/version, and cryptographic result.';
