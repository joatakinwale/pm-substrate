-- 0008_profile_registry.sql
-- Profile registry. Stores ProfileDefinition documents per tenant.
--
-- Each tenant opts into one or more profiles. The substrate consults this
-- table at every node/edge write to validate the requested concrete type
-- against the profile's declared catalog (entity types, edge types,
-- cardinality, lifecycles).
--
-- Profiles are libraries (architecture rule, layered ontology): the
-- definition itself is code in a profile package. This table just records
-- which tenant has installed which profile + version + serialized doc.

CREATE SCHEMA IF NOT EXISTS profiles;

CREATE TABLE IF NOT EXISTS profiles.installations (
  tenant_id    TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  version      INTEGER NOT NULL,
  definition   JSONB NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS profile_installations_tenant_idx
  ON profiles.installations(tenant_id);
