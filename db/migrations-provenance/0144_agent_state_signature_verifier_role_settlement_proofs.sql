-- 0144_agent_state_signature_verifier_role_settlement_proofs.sql
-- Append-only proofs settling signature-verifier role metadata and transparency evidence.

CREATE TABLE IF NOT EXISTS agent_state.signature_verifier_role_settlement_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  verifier_version TEXT NOT NULL,
  verifier_role TEXT NOT NULL,
  role_metadata_sequence BIGINT NOT NULL CHECK (role_metadata_sequence >= 0),
  allowed_claims JSONB NOT NULL,
  valid_from_authority_sequence BIGINT NOT NULL CHECK (valid_from_authority_sequence >= 0),
  valid_through_authority_sequence BIGINT CHECK (valid_through_authority_sequence IS NULL OR valid_through_authority_sequence >= valid_from_authority_sequence),
  verifier_key_id TEXT,
  verifier_public_key_fingerprint TEXT,
  verifier_key_material_hash TEXT,
  previous_role_metadata_hash TEXT,
  role_metadata_hash TEXT NOT NULL,
  transparency_log_id TEXT NOT NULL,
  transparency_tree_head_hash TEXT NOT NULL,
  transparency_tree_size BIGINT NOT NULL CHECK (transparency_tree_size > 0),
  transparency_inclusion_proof_hash TEXT NOT NULL,
  transparency_consistency_proof_hash TEXT NOT NULL,
  settlement_authority_boundary TEXT NOT NULL,
  settlement_claim_hash TEXT NOT NULL,
  settlement_certificate JSONB NOT NULL,
  proof JSONB NOT NULL,
  proof_hash TEXT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL,
  settled_by TEXT NOT NULL,
  proof_reason TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, proof_id),
  UNIQUE (
    tenant_id,
    authority_scope,
    verifier_id,
    verifier_version,
    role_metadata_sequence,
    role_metadata_hash,
    proof_hash
  ),
  UNIQUE (
    tenant_id,
    authority_scope,
    settlement_id,
    settlement_claim_hash,
    proof_hash
  ),
  CHECK (jsonb_typeof(allowed_claims) = 'array'),
  CHECK (jsonb_typeof(settlement_certificate) = 'object'),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (length(proof_id) > 0),
  CHECK (length(settlement_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(verifier_id) > 0),
  CHECK (length(verifier_version) > 0),
  CHECK (verifier_role = 'signature_verifier'),
  CHECK (length(role_metadata_hash) > 0),
  CHECK (length(transparency_log_id) > 0),
  CHECK (length(transparency_tree_head_hash) > 0),
  CHECK (length(transparency_inclusion_proof_hash) > 0),
  CHECK (length(transparency_consistency_proof_hash) > 0),
  CHECK (length(settlement_authority_boundary) > 0),
  CHECK (length(settlement_claim_hash) > 0),
  CHECK (length(proof_hash) > 0),
  CHECK (length(settled_by) > 0),
  CHECK (verifier_public_key_fingerprint IS NOT NULL OR verifier_key_material_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS signature_verifier_role_settlement_proofs_verifier_idx
  ON agent_state.signature_verifier_role_settlement_proofs (
    tenant_id,
    authority_scope,
    verifier_id,
    verifier_version,
    role_metadata_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_role_settlement_proofs_transparency_idx
  ON agent_state.signature_verifier_role_settlement_proofs (
    tenant_id,
    transparency_log_id,
    transparency_tree_head_hash,
    transparency_tree_size
  );

CREATE INDEX IF NOT EXISTS signature_verifier_role_settlement_proofs_settlement_idx
  ON agent_state.signature_verifier_role_settlement_proofs (
    tenant_id,
    authority_scope,
    settlement_id,
    settlement_claim_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_signature_verifier_role_settlement_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature-verifier role settlement proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_signature_verifier_role_settlement_proof_rewrite
  ON agent_state.signature_verifier_role_settlement_proofs;

CREATE TRIGGER prevent_signature_verifier_role_settlement_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.signature_verifier_role_settlement_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_signature_verifier_role_settlement_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_role_settlement_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.signature_verifier_role_settlement_proofs IS
  'Append-only proofs that signature-verifier role metadata was settled through transparency evidence before verifier adapter output could become operational signature state.';

COMMENT ON COLUMN agent_state.signature_verifier_role_settlement_proofs.allowed_claims IS
  'Settled verifier role claims; strict substrate evaluation accepts signature_validity only and rejects authority/currentness overreach.';

COMMENT ON COLUMN agent_state.signature_verifier_role_settlement_proofs.role_metadata_hash IS
  'Canonical hash over verifier id, version, role, allowed claims, key material identifiers, and validity authority frontier.';

COMMENT ON COLUMN agent_state.signature_verifier_role_settlement_proofs.settlement_claim_hash IS
  'Canonical hash over settled role metadata and transparency-log inclusion/consistency evidence certified by the settlement certificate.';
