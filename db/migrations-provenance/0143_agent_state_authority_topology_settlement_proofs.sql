-- 0143_agent_state_authority_topology_settlement_proofs.sql
-- Append-only proofs settling competing authority-topology branches.

CREATE TABLE IF NOT EXISTS agent_state.authority_topology_settlement_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  settlement_authority_boundary TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_sequence BIGINT NOT NULL CHECK (subject_sequence >= 0),
  subject_hash TEXT NOT NULL,
  candidate_set_hash TEXT NOT NULL,
  candidate_count INTEGER NOT NULL CHECK (candidate_count >= 2),
  selected_candidate_id TEXT NOT NULL,
  settled_topology_hash TEXT NOT NULL,
  settled_authority_record_hash TEXT NOT NULL,
  settled_authority_sequence BIGINT NOT NULL CHECK (settled_authority_sequence >= 0),
  settlement_claim_hash TEXT NOT NULL,
  settlement_certificate JSONB NOT NULL,
  candidates JSONB NOT NULL,
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
    topology_id,
    settlement_id,
    settlement_claim_hash,
    proof_hash
  ),
  UNIQUE (
    tenant_id,
    authority_scope,
    topology_id,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash,
    settled_topology_hash,
    proof_hash
  ),
  CHECK (jsonb_typeof(settlement_certificate) = 'object'),
  CHECK (jsonb_typeof(candidates) = 'array'),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (length(proof_id) > 0),
  CHECK (length(settlement_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(topology_id) > 0),
  CHECK (length(settlement_authority_boundary) > 0),
  CHECK (length(subject_kind) > 0),
  CHECK (length(subject_id) > 0),
  CHECK (length(subject_hash) > 0),
  CHECK (length(candidate_set_hash) > 0),
  CHECK (length(selected_candidate_id) > 0),
  CHECK (length(settled_topology_hash) > 0),
  CHECK (length(settled_authority_record_hash) > 0),
  CHECK (length(settlement_claim_hash) > 0),
  CHECK (length(proof_hash) > 0),
  CHECK (length(settled_by) > 0)
);

CREATE INDEX IF NOT EXISTS authority_topology_settlement_proofs_subject_idx
  ON agent_state.authority_topology_settlement_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash
  );

CREATE INDEX IF NOT EXISTS authority_topology_settlement_proofs_settlement_idx
  ON agent_state.authority_topology_settlement_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    settlement_id,
    settlement_claim_hash
  );

CREATE INDEX IF NOT EXISTS authority_topology_settlement_proofs_selected_idx
  ON agent_state.authority_topology_settlement_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    settled_topology_hash,
    settled_authority_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_topology_settlement_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority-topology settlement proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_topology_settlement_proof_rewrite
  ON agent_state.authority_topology_settlement_proofs;

CREATE TRIGGER prevent_authority_topology_settlement_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_topology_settlement_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_topology_settlement_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_topology_settlement_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_topology_settlement_proofs IS
  'Append-only proofs that a settlement authority chose one authority-topology branch from a replayable candidate set before compacted authority recovery consumed that branch.';

COMMENT ON COLUMN agent_state.authority_topology_settlement_proofs.candidates IS
  'Hash-bound authority-topology branch candidates considered by the settlement proof.';

COMMENT ON COLUMN agent_state.authority_topology_settlement_proofs.settlement_claim_hash IS
  'Canonical hash over settlement id, recovery subject, candidate set hash, selected candidate, and settled topology frontier certified by the settlement certificate.';

COMMENT ON COLUMN agent_state.authority_topology_settlement_proofs.proof_hash IS
  'Deterministic hash of the full authority-topology settlement proof envelope.';
