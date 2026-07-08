-- 0094_agent_state_signature_verifier_proof_admission_witness_authority_transitions.sql
-- Durable authority transitions for signature-verifier proof admission witness topology.

CREATE TABLE IF NOT EXISTS agent_state.signature_verifier_proof_admission_witness_authority_transitions (
  tenant_id TEXT NOT NULL,
  proof_admission_witness_authority_topology_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_sequence BIGINT NOT NULL CHECK (authority_sequence >= 1),
  previous_authority_record_hash TEXT,
  transition_kind TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  effective_from_admission_sequence BIGINT NOT NULL CHECK (effective_from_admission_sequence >= 1),
  required_witnesses INTEGER CHECK (required_witnesses IS NULL OR required_witnesses >= 1),
  minimum_witnesses INTEGER CHECK (minimum_witnesses IS NULL OR minimum_witnesses >= 1),
  principal_id TEXT,
  signature_key_id TEXT,
  sealed_through_admission_sequence BIGINT CHECK (sealed_through_admission_sequence IS NULL OR sealed_through_admission_sequence >= 1),
  sealed_quorum_certificate_hash TEXT,
  reason TEXT,
  authority_record_hash TEXT NOT NULL,
  transition JSONB NOT NULL,
  PRIMARY KEY (
    tenant_id,
    proof_admission_witness_authority_topology_id,
    authority_sequence,
    authority_record_hash
  ),
  UNIQUE (
    tenant_id,
    proof_admission_witness_authority_topology_id,
    authority_record_hash
  ),
  CHECK (
    (authority_sequence = 1 AND previous_authority_record_hash IS NULL)
    OR (authority_sequence > 1 AND previous_authority_record_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS signature_verifier_proof_admission_witness_authority_scope_idx
  ON agent_state.signature_verifier_proof_admission_witness_authority_transitions (
    tenant_id,
    proof_admission_witness_authority_topology_id,
    authority_scope,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_proof_admission_witness_authority_effective_idx
  ON agent_state.signature_verifier_proof_admission_witness_authority_transitions (
    tenant_id,
    authority_scope,
    effective_from_admission_sequence,
    authority_sequence
  );

CREATE INDEX IF NOT EXISTS signature_verifier_proof_admission_witness_authority_principal_idx
  ON agent_state.signature_verifier_proof_admission_witness_authority_transitions (
    tenant_id,
    authority_scope,
    principal_id,
    authority_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_signature_verifier_proof_admission_witness_authority_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature verifier proof admission witness authority transitions are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_signature_verifier_proof_admission_witness_authority_rewrite
  ON agent_state.signature_verifier_proof_admission_witness_authority_transitions;

CREATE TRIGGER prevent_signature_verifier_proof_admission_witness_authority_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.signature_verifier_proof_admission_witness_authority_transitions
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_signature_verifier_proof_admission_witness_authority_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.signature_verifier_proof_admission_witness_authority_transitions FROM PUBLIC;

COMMENT ON TABLE agent_state.signature_verifier_proof_admission_witness_authority_transitions IS
  'Append-only authority transitions for signature-verifier proof admission witness topology. Replaying this ledger reconstructs which principals may witness verifier proof admission rows and what quorum threshold they must satisfy.';

COMMENT ON COLUMN agent_state.signature_verifier_proof_admission_witness_authority_transitions.authority_record_hash IS
  'Deterministic hash of the authority transition, chained by previous_authority_record_hash so verifier proof-admission witness eligibility cannot be supplied from agent memory or connector cache.';

COMMENT ON COLUMN agent_state.signature_verifier_proof_admission_witness_authority_transitions.effective_from_admission_sequence IS
  'First signature-verifier proof admission sequence for which this authority transition may authorize witness certificates.';

COMMENT ON COLUMN agent_state.signature_verifier_proof_admission_witness_authority_transitions.transition IS
  'Hash-bound transition payload used to replay the signature-verifier proof admission witness authority topology.';
