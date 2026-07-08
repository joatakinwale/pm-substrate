-- 0138_agent_state_privacy_preserving_policy_proofs.sql
-- Append-only verifier proofs for privacy-preserving policy authorization.

CREATE TABLE IF NOT EXISTS agent_state.privacy_preserving_policy_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  policy_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_sequence BIGINT NOT NULL CHECK (subject_sequence >= 1),
  subject_hash TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  policy_record_hash TEXT NOT NULL,
  proof_system TEXT NOT NULL,
  proof_system_version TEXT,
  verifier_id TEXT NOT NULL,
  verifier_version TEXT,
  verification_key_hash TEXT NOT NULL,
  public_statement_hash TEXT NOT NULL,
  predicate_commitment_hash TEXT NOT NULL,
  hidden_witness_commitment_hash TEXT NOT NULL,
  proof_transcript_hash TEXT NOT NULL,
  challenge_nonce TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('valid', 'invalid')),
  disclosed_claim_hashes TEXT[] NOT NULL DEFAULT '{}',
  adapter_claims TEXT[] NOT NULL DEFAULT '{}',
  private_input_refs TEXT[] NOT NULL DEFAULT '{}',
  proof JSONB NOT NULL,
  policy_proof_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, proof_id),
  UNIQUE (tenant_id, policy_store_id, policy_proof_hash),
  UNIQUE (tenant_id, policy_store_id, subject_hash, verifier_id, challenge_nonce),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (cardinality(private_input_refs) = 0),
  CHECK (length(proof_id) > 0),
  CHECK (length(policy_store_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(authority_boundary) > 0),
  CHECK (length(subject_hash) > 0),
  CHECK (length(policy_hash) > 0),
  CHECK (length(policy_record_hash) > 0),
  CHECK (length(verifier_id) > 0),
  CHECK (length(verification_key_hash) > 0),
  CHECK (length(public_statement_hash) > 0),
  CHECK (length(predicate_commitment_hash) > 0),
  CHECK (length(hidden_witness_commitment_hash) > 0),
  CHECK (length(proof_transcript_hash) > 0),
  CHECK (length(challenge_nonce) > 0),
  CHECK (length(policy_proof_hash) > 0)
);

CREATE INDEX IF NOT EXISTS privacy_preserving_policy_proofs_subject_idx
  ON agent_state.privacy_preserving_policy_proofs (
    tenant_id,
    policy_store_id,
    authority_scope,
    subject_kind,
    subject_id,
    subject_sequence
  );

CREATE INDEX IF NOT EXISTS privacy_preserving_policy_proofs_verifier_idx
  ON agent_state.privacy_preserving_policy_proofs (
    tenant_id,
    authority_scope,
    authority_boundary,
    verifier_id,
    verified_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_privacy_preserving_policy_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'privacy-preserving policy proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_privacy_preserving_policy_proof_rewrite
  ON agent_state.privacy_preserving_policy_proofs;

CREATE TRIGGER prevent_privacy_preserving_policy_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.privacy_preserving_policy_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_privacy_preserving_policy_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.privacy_preserving_policy_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.privacy_preserving_policy_proofs IS
  'Append-only privacy-preserving authorization proof ledger. Policy admission can require a public proof statement and hidden-witness commitment without admitting private delegation material as operational state.';

COMMENT ON COLUMN agent_state.privacy_preserving_policy_proofs.hidden_witness_commitment_hash IS
  'Commitment hash for private credential or delegation material. The material itself is excluded from operational state.';

COMMENT ON COLUMN agent_state.privacy_preserving_policy_proofs.private_input_refs IS
  'Must remain empty. Non-empty private input references would smuggle private delegation material into operational state and are rejected by this table.';

COMMENT ON COLUMN agent_state.privacy_preserving_policy_proofs.policy_proof_hash IS
  'Canonical hash of the replayable privacy-preserving policy proof envelope.';
