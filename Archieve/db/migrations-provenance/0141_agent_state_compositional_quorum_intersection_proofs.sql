-- 0141_agent_state_compositional_quorum_intersection_proofs.sql
-- Append-only proofs that independently certified authority histories compose through active quorum intersection.

CREATE TABLE IF NOT EXISTS agent_state.compositional_quorum_intersection_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_sequence BIGINT NOT NULL CHECK (subject_sequence >= 0),
  subject_hash TEXT NOT NULL,
  intersection_mode TEXT NOT NULL CHECK (
    intersection_mode IN (
      'pairwise_active_intersection',
      'global_active_intersection'
    )
  ),
  required_intersection_witnesses INTEGER NOT NULL CHECK (required_intersection_witnesses >= 1),
  claim_count INTEGER NOT NULL CHECK (claim_count >= 2),
  pairwise_intersections JSONB NOT NULL,
  global_intersection_witness_ids TEXT[] NOT NULL DEFAULT '{}',
  proof JSONB NOT NULL,
  proof_hash TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  evaluated_by TEXT NOT NULL,
  proof_reason TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, proof_id),
  UNIQUE (tenant_id, authority_scope, subject_kind, subject_id, subject_hash, proof_hash),
  CHECK (jsonb_typeof(pairwise_intersections) = 'array'),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (length(proof_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(subject_kind) > 0),
  CHECK (length(subject_id) > 0),
  CHECK (length(subject_hash) > 0),
  CHECK (length(proof_hash) > 0),
  CHECK (length(evaluated_by) > 0)
);

CREATE INDEX IF NOT EXISTS compositional_quorum_intersection_proofs_subject_idx
  ON agent_state.compositional_quorum_intersection_proofs (
    tenant_id,
    authority_scope,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash
  );

CREATE INDEX IF NOT EXISTS compositional_quorum_intersection_proofs_mode_idx
  ON agent_state.compositional_quorum_intersection_proofs (
    tenant_id,
    authority_scope,
    intersection_mode,
    required_intersection_witnesses,
    evaluated_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_compositional_quorum_intersection_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'compositional quorum-intersection proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_compositional_quorum_intersection_proof_rewrite
  ON agent_state.compositional_quorum_intersection_proofs;

CREATE TRIGGER prevent_compositional_quorum_intersection_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.compositional_quorum_intersection_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_compositional_quorum_intersection_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.compositional_quorum_intersection_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.compositional_quorum_intersection_proofs IS
  'Append-only replayable proofs that independently certified authority histories compose only when their embedded authority topologies and quorum certificates have sufficient active witness intersection.';

COMMENT ON COLUMN agent_state.compositional_quorum_intersection_proofs.pairwise_intersections IS
  'Canonical pairwise active accepted-witness intersections replayed from the embedded authority topology and quorum certificate claims.';

COMMENT ON COLUMN agent_state.compositional_quorum_intersection_proofs.global_intersection_witness_ids IS
  'Canonical active witnesses shared by every embedded authority claim when global intersection is required.';

COMMENT ON COLUMN agent_state.compositional_quorum_intersection_proofs.proof_hash IS
  'Deterministic hash of the full compositional quorum-intersection proof envelope.';
