-- 0142_agent_state_authority_transition_replay_semantics_proofs.sql
-- Append-only proofs binding authority-transition replay to admitted semantics manifests.

CREATE TABLE IF NOT EXISTS agent_state.authority_transition_replay_semantics_proofs (
  tenant_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_sequence BIGINT NOT NULL CHECK (subject_sequence >= 0),
  subject_hash TEXT NOT NULL,
  manifest_id TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  semantics_id TEXT NOT NULL,
  semantics_version TEXT NOT NULL,
  transition_count INTEGER NOT NULL CHECK (transition_count >= 0),
  starting_authority_sequence BIGINT NOT NULL CHECK (starting_authority_sequence >= 0),
  starting_topology_hash TEXT,
  result_authority_topology_hash TEXT NOT NULL,
  result_authority_record_hash TEXT NOT NULL,
  manifest JSONB NOT NULL,
  transition_bindings JSONB NOT NULL,
  proof JSONB NOT NULL,
  proof_hash TEXT NOT NULL,
  replayed_at TIMESTAMPTZ NOT NULL,
  replayed_by TEXT NOT NULL,
  proof_reason TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, proof_id),
  UNIQUE (
    tenant_id,
    authority_scope,
    topology_id,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash,
    manifest_hash,
    proof_hash
  ),
  CHECK (jsonb_typeof(manifest) = 'object'),
  CHECK (jsonb_typeof(transition_bindings) = 'array'),
  CHECK (jsonb_typeof(proof) = 'object'),
  CHECK (length(proof_id) > 0),
  CHECK (length(authority_scope) > 0),
  CHECK (length(topology_id) > 0),
  CHECK (length(subject_kind) > 0),
  CHECK (length(subject_id) > 0),
  CHECK (length(subject_hash) > 0),
  CHECK (length(manifest_id) > 0),
  CHECK (length(manifest_hash) > 0),
  CHECK (length(semantics_id) > 0),
  CHECK (length(semantics_version) > 0),
  CHECK (length(result_authority_topology_hash) > 0),
  CHECK (length(result_authority_record_hash) > 0),
  CHECK (length(proof_hash) > 0),
  CHECK (length(replayed_by) > 0)
);

CREATE INDEX IF NOT EXISTS authority_transition_replay_semantics_proofs_subject_idx
  ON agent_state.authority_transition_replay_semantics_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    subject_kind,
    subject_id,
    subject_sequence,
    subject_hash
  );

CREATE INDEX IF NOT EXISTS authority_transition_replay_semantics_proofs_manifest_idx
  ON agent_state.authority_transition_replay_semantics_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    manifest_hash,
    semantics_id,
    semantics_version
  );

CREATE INDEX IF NOT EXISTS authority_transition_replay_semantics_proofs_result_idx
  ON agent_state.authority_transition_replay_semantics_proofs (
    tenant_id,
    authority_scope,
    topology_id,
    result_authority_topology_hash,
    result_authority_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_transition_replay_semantics_proof_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority-transition replay semantics proofs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_transition_replay_semantics_proof_rewrite
  ON agent_state.authority_transition_replay_semantics_proofs;

CREATE TRIGGER prevent_authority_transition_replay_semantics_proof_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_transition_replay_semantics_proofs
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_transition_replay_semantics_proof_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_transition_replay_semantics_proofs FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_transition_replay_semantics_proofs IS
  'Append-only proofs that authority-transition history was replayed under a specific admitted replay-semantics manifest before it was allowed to recover operational authority topology.';

COMMENT ON COLUMN agent_state.authority_transition_replay_semantics_proofs.manifest IS
  'Embedded hash-bound replay-semantics manifest naming the transition algebra, version, validity frontier, and rule hashes used for replay.';

COMMENT ON COLUMN agent_state.authority_transition_replay_semantics_proofs.transition_bindings IS
  'Per-transition binding from authority record hash and schema version to the manifest rule hash used to replay that transition.';

COMMENT ON COLUMN agent_state.authority_transition_replay_semantics_proofs.proof_hash IS
  'Deterministic hash of the full authority-transition replay semantics proof envelope.';
