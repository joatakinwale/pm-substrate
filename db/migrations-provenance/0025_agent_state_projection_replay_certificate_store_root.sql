-- 0025_agent_state_projection_replay_certificate_store_root.sql
-- Append-only certificate-store commitments for projection replay certificates.

ALTER TABLE agent_state.projection_replay_certificates
  ADD COLUMN IF NOT EXISTS store_sequence BIGINT,
  ADD COLUMN IF NOT EXISTS store_previous_entry_hash TEXT,
  ADD COLUMN IF NOT EXISTS store_entry_hash TEXT,
  ADD COLUMN IF NOT EXISTS store_root_hash TEXT,
  ADD COLUMN IF NOT EXISTS store_recorded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_certificate_store_entries (
  tenant_id               TEXT NOT NULL,
  sequence                BIGINT NOT NULL,
  certificate_id          TEXT NOT NULL,
  certificate_hash        TEXT NOT NULL,
  projection_name         TEXT NOT NULL,
  projection_version      INTEGER NOT NULL,
  replayed_to_position    BIGINT NOT NULL,
  transition_history_hash TEXT NOT NULL,
  projection_hash         TEXT NOT NULL,
  previous_entry_hash     TEXT,
  entry_hash              TEXT NOT NULL,
  recorded_at             TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, sequence),
  UNIQUE (tenant_id, certificate_id),
  UNIQUE (tenant_id, entry_hash),
  CHECK (
    (sequence = 1 AND previous_entry_hash IS NULL)
    OR (sequence > 1 AND previous_entry_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS projection_replay_cert_store_prev_hash_idx
  ON agent_state.projection_replay_certificate_store_entries (
    tenant_id,
    previous_entry_hash
  );

CREATE INDEX IF NOT EXISTS projection_replay_cert_store_cert_idx
  ON agent_state.projection_replay_certificate_store_entries (
    tenant_id,
    certificate_id
  );

COMMENT ON TABLE agent_state.projection_replay_certificate_store_entries IS
  'Append-only hash-chain commitments for projection replay certificate admissions. The latest entry hash is the certificate-store root.';

COMMENT ON COLUMN agent_state.projection_replay_certificate_store_entries.entry_hash IS
  'Hash of the store entry body, including the previous entry hash, used as a tamper-evident certificate-store root.';
