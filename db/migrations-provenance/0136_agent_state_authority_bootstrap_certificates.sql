-- 0136_agent_state_authority_bootstrap_certificates.sql
-- Durable root-authority bootstrap certificates for authority-transition admission genesis.

CREATE TABLE IF NOT EXISTS agent_state.authority_bootstrap_certificates (
  tenant_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  authority_boundary TEXT NOT NULL,
  transition_admission_store_id TEXT NOT NULL,
  topology_id TEXT NOT NULL,
  bootstrap_topology_hash TEXT NOT NULL,
  root_authority_id TEXT NOT NULL,
  root_authority_version TEXT,
  root_evidence_refs JSONB NOT NULL,
  signature_key_id TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  authorized_admission_sequence BIGINT NOT NULL CHECK (authorized_admission_sequence = 1),
  authorized_admission_record_hash TEXT NOT NULL,
  authorized_authority_sequence BIGINT NOT NULL CHECK (authorized_authority_sequence = 1),
  authorized_authority_record_hash TEXT NOT NULL,
  authorized_next_authority_topology_hash TEXT NOT NULL,
  bootstrap_certificate JSONB NOT NULL,
  bootstrap_certificate_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (
    tenant_id,
    transition_admission_store_id,
    topology_id,
    bootstrap_certificate_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_store_id,
    topology_id,
    authorized_admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    transition_admission_store_id,
    topology_id,
    authorized_authority_record_hash
  ),
  CHECK (jsonb_typeof(root_evidence_refs) = 'array'),
  CHECK (jsonb_array_length(root_evidence_refs) >= 1),
  CHECK (length(signature_key_id) > 0),
  CHECK (length(signature_hash) > 0)
);

CREATE INDEX IF NOT EXISTS authority_bootstrap_certificates_scope_idx
  ON agent_state.authority_bootstrap_certificates (
    tenant_id,
    authority_scope,
    authority_boundary,
    transition_admission_store_id,
    topology_id
  );

CREATE INDEX IF NOT EXISTS authority_bootstrap_certificates_root_idx
  ON agent_state.authority_bootstrap_certificates (
    tenant_id,
    root_authority_id,
    root_authority_version,
    issued_at
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_authority_bootstrap_certificate_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authority bootstrap certificates are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_authority_bootstrap_certificate_rewrite
  ON agent_state.authority_bootstrap_certificates;

CREATE TRIGGER prevent_authority_bootstrap_certificate_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.authority_bootstrap_certificates
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_authority_bootstrap_certificate_rewrite();

REVOKE INSERT, UPDATE, DELETE ON agent_state.authority_bootstrap_certificates FROM PUBLIC;

COMMENT ON TABLE agent_state.authority_bootstrap_certificates IS
  'Append-only root-authority bootstrap certificates for genesis authority-transition admissions. A strict replay path can reject authority-bootstrap witness claims unless the first admission row is bound to a replayable root certificate with evidence references, signature identity, and the exact first derived topology hash.';

COMMENT ON COLUMN agent_state.authority_bootstrap_certificates.bootstrap_topology_hash IS
  'Bootstrap topology hash cited by the genesis admission certificate. This value is operational only when bound by the bootstrap certificate, not when remembered as private authority.';

COMMENT ON COLUMN agent_state.authority_bootstrap_certificates.root_evidence_refs IS
  'Replayable references to the root-authority evidence or ceremony that authorized the first admission transition.';

COMMENT ON COLUMN agent_state.authority_bootstrap_certificates.authorized_admission_record_hash IS
  'Hash of the genesis transition-admission record authorized by the bootstrap certificate.';

COMMENT ON COLUMN agent_state.authority_bootstrap_certificates.authorized_next_authority_topology_hash IS
  'Topology hash derived after replaying the authorized genesis authority transition.';
