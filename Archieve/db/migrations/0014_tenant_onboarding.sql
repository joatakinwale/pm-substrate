-- 0014_tenant_onboarding.sql
-- G9 — real-tenant onboarding.
--
-- Before G9, tests and seed scripts inserted rows directly into
-- substrate.tenants. This migration gives tenant records enough lifecycle
-- shape for an HTTP/API onboarding path: metadata for external CRM/customer
-- identifiers and updated_at for lifecycle transitions.

ALTER TABLE substrate.tenants
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tenants_active_created_idx
  ON substrate.tenants (created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN substrate.tenants.metadata IS
  'G9: tenant onboarding metadata. External customer id, source, plan label, and operator notes live here; substrate core treats it as opaque.';

COMMENT ON COLUMN substrate.tenants.updated_at IS
  'G9: last tenant-directory lifecycle update timestamp.';
