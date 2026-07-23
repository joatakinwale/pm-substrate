-- 0005_workflow_and_projections.sql
-- Layer 4: workflow runtime + projection cursors.

CREATE TABLE IF NOT EXISTS workflow.workflows (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL,
  doc         JSONB NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name, version)
);

CREATE INDEX IF NOT EXISTS workflows_tenant_idx ON workflow.workflows(tenant_id) WHERE enabled = true;

-- Workflow runs and steps — every interpreter step is a row, recoverable
-- from event-log replay if needed. (Architecture: idempotent retry on crash.)
CREATE TABLE IF NOT EXISTS workflow.runs (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  workflow_id     TEXT NOT NULL REFERENCES workflow.workflows(id),
  triggered_by    TEXT NOT NULL,    -- event id
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','cancelled'))
);

CREATE TABLE IF NOT EXISTS workflow.run_steps (
  run_id      TEXT NOT NULL REFERENCES workflow.runs(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL,
  capability  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','skipped')),
  result      JSONB,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, node_id)
);

-- Projection cursors. Each tenant + projection has one row; the cursor records
-- where the projection has caught up to. Rebuilds reset the cursor to NULL.
CREATE TABLE IF NOT EXISTS projections.cursors (
  tenant_id        TEXT NOT NULL,
  projection_name  TEXT NOT NULL,
  projection_version INTEGER NOT NULL,
  last_event_id    TEXT,
  last_recorded_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, projection_name, projection_version)
);
