-- 0021_registry_terminal_provider_certificates.sql
-- Durable terminal-admission provider certificate status.
--
-- Certificates are immutable proof objects. Revocation/supersession/current
-- status lives beside the certificate so status changes do not mutate the
-- certificate body or invalidate its digest.

CREATE TABLE IF NOT EXISTS registry.terminal_admission_provider_certificates (
  tenant_id                  TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  certificate_id             TEXT NOT NULL,
  certificate_digest         TEXT NOT NULL,
  subject_capability_name    TEXT NOT NULL,
  subject_provider_id        TEXT NOT NULL,
  certificate                JSONB NOT NULL,
  current_status             TEXT NOT NULL,
  status_reason              TEXT,
  superseded_by_certificate_id TEXT,
  status_updated_at          TIMESTAMPTZ NOT NULL,
  recorded_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, certificate_id),
  CONSTRAINT terminal_provider_cert_status_chk CHECK (
    current_status IN ('valid', 'revoked', 'superseded')
  )
);

CREATE INDEX IF NOT EXISTS terminal_provider_cert_subject_idx
  ON registry.terminal_admission_provider_certificates (
    tenant_id,
    subject_capability_name,
    subject_provider_id,
    current_status
  );

CREATE INDEX IF NOT EXISTS terminal_provider_cert_digest_idx
  ON registry.terminal_admission_provider_certificates (
    tenant_id,
    certificate_digest
  );
