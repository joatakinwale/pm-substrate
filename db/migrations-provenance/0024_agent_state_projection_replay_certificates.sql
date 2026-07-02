-- 0024_agent_state_projection_replay_certificates.sql
-- Durable projection replay certificates for write-authority verification.

CREATE SCHEMA IF NOT EXISTS agent_state;

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_certificates (
  tenant_id               TEXT NOT NULL,
  certificate_id          TEXT NOT NULL,
  certificate_hash        TEXT NOT NULL,
  projection_name         TEXT NOT NULL,
  subject_kind            TEXT NOT NULL,
  subject_id              TEXT NOT NULL,
  subject_label           TEXT,
  authority_scope         TEXT NOT NULL,
  projection_version      INTEGER NOT NULL,
  replayed_to_position    BIGINT NOT NULL,
  transition_history_hash TEXT NOT NULL,
  projection_hash         TEXT NOT NULL,
  certificate             JSONB NOT NULL,
  recorded_at             TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, certificate_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS projection_replay_cert_hash_idx
  ON agent_state.projection_replay_certificates (
    tenant_id,
    certificate_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_cert_projection_idx
  ON agent_state.projection_replay_certificates (
    tenant_id,
    projection_name,
    projection_version,
    replayed_to_position
  );

COMMENT ON TABLE agent_state.projection_replay_certificates IS
  'Immutable projection replay certificate records used to verify replay refs before write-capable graph/capability mutations.';

COMMENT ON COLUMN agent_state.projection_replay_certificates.certificate_hash IS
  'Hash of the full projection replay certificate body; replay refs must resolve to this durable value before write authority is admitted.';
