-- 0004_registry_layer.sql
-- Layer 3: capability registry.
-- Tools register their inputs/outputs/perms; the substrate routes accordingly.

CREATE TABLE IF NOT EXISTS registry.capabilities (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  name                 TEXT NOT NULL,
  version              INTEGER NOT NULL,
  reads_interfaces     JSONB NOT NULL DEFAULT '[]'::jsonb,
  writes_interfaces    JSONB NOT NULL DEFAULT '[]'::jsonb,
  reads_edges          JSONB NOT NULL DEFAULT '[]'::jsonb,
  writes_edges         JSONB NOT NULL DEFAULT '[]'::jsonb,
  emits                JSONB NOT NULL DEFAULT '[]'::jsonb,
  subscribes_to        JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  description          TEXT NOT NULL DEFAULT '',
  registered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name, version)
);

CREATE INDEX IF NOT EXISTS capabilities_tenant_name_idx ON registry.capabilities(tenant_id, name);
