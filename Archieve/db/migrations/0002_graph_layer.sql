-- 0002_graph_layer.sql
-- Layer 1: entity graph.
-- Nodes hold identity + stable attrs; everything contextual on typed edges.

-- Nodes table. Identity bag in JSONB; concrete profile-required fields
-- can be promoted to typed columns later via expression indexes when
-- a tenant's query pattern justifies it (Performance failure mode #3).
CREATE TABLE IF NOT EXISTS graph.nodes (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  tier1           TEXT NOT NULL,        -- "Counterparty" | "Engagement" | ...
  profile         TEXT,                  -- "wedding" | "legal" | NULL for raw Tier-1
  concrete        TEXT NOT NULL,         -- "Wedding" | "Couple" | "Counterparty" | ...
  schema_version  INTEGER NOT NULL DEFAULT 1,
  identity        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT nodes_tier1_chk CHECK (
    tier1 IN ('Counterparty','Engagement','Transaction','Resource','Communication','Document','Event')
  )
);

CREATE INDEX IF NOT EXISTS nodes_tenant_idx        ON graph.nodes(tenant_id);
CREATE INDEX IF NOT EXISTS nodes_tenant_tier1_idx  ON graph.nodes(tenant_id, tier1);
CREATE INDEX IF NOT EXISTS nodes_tenant_concrete_idx ON graph.nodes(tenant_id, concrete);

-- Typed edges table. The substrate stores the type as text; the profile
-- declares the catalog. We track edges as first-class rows (not JSONB on a
-- node) so queries by edge type are O(index hit).
CREATE TABLE IF NOT EXISTS graph.edges (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  type        TEXT NOT NULL,
  from_id     TEXT NOT NULL REFERENCES graph.nodes(id) ON DELETE RESTRICT,
  to_id       TEXT NOT NULL REFERENCES graph.nodes(id) ON DELETE RESTRICT,
  attrs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ          -- tombstoned, not hard-deleted
);

CREATE INDEX IF NOT EXISTS edges_tenant_type_from_idx ON graph.edges(tenant_id, type, from_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS edges_tenant_type_to_idx   ON graph.edges(tenant_id, type, to_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS edges_tenant_from_idx      ON graph.edges(tenant_id, from_id)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS edges_tenant_to_idx        ON graph.edges(tenant_id, to_id)          WHERE deleted_at IS NULL;
