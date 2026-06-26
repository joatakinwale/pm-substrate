-- 0022_registry_terminal_provider_certificate_status_events.sql
-- Append-only terminal-admission provider certificate status history.
--
-- The current certificate table is a projection. This stream is the replay
-- authority for decision-time status reconstruction after restart or later
-- revocation/supersession.

CREATE TABLE IF NOT EXISTS registry.terminal_admission_provider_certificate_status_events (
  tenant_id                    TEXT NOT NULL,
  certificate_id               TEXT NOT NULL,
  status_sequence              BIGINT NOT NULL,
  from_status                  TEXT,
  to_status                    TEXT NOT NULL,
  status_reason                TEXT,
  superseded_by_certificate_id TEXT,
  status_updated_at            TIMESTAMPTZ NOT NULL,
  recorded_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_event_hash          TEXT,
  event_hash                   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, certificate_id, status_sequence),
  CONSTRAINT terminal_provider_cert_status_event_cert_fk FOREIGN KEY (
    tenant_id,
    certificate_id
  )
    REFERENCES registry.terminal_admission_provider_certificates (
      tenant_id,
      certificate_id
    )
    ON DELETE RESTRICT,
  CONSTRAINT terminal_provider_cert_status_event_from_chk CHECK (
    from_status IS NULL OR from_status IN ('valid', 'revoked', 'superseded')
  ),
  CONSTRAINT terminal_provider_cert_status_event_to_chk CHECK (
    to_status IN ('valid', 'revoked', 'superseded')
  ),
  CONSTRAINT terminal_provider_cert_status_event_sequence_chk CHECK (
    status_sequence > 0
  ),
  CONSTRAINT terminal_provider_cert_status_event_first_prev_chk CHECK (
    (status_sequence = 1 AND previous_event_hash IS NULL)
    OR (status_sequence > 1 AND previous_event_hash IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS terminal_provider_cert_status_event_hash_idx
  ON registry.terminal_admission_provider_certificate_status_events (
    tenant_id,
    event_hash
  );

CREATE INDEX IF NOT EXISTS terminal_provider_cert_status_event_time_idx
  ON registry.terminal_admission_provider_certificate_status_events (
    tenant_id,
    certificate_id,
    status_updated_at DESC,
    status_sequence DESC
  );
