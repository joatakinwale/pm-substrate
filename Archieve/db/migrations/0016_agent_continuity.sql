-- 0016_agent_continuity.sql
-- Agent continuity ledger: verifiable work memory for AI operators.

CREATE SCHEMA IF NOT EXISTS continuity;

CREATE TABLE IF NOT EXISTS continuity.checkpoints (
  id                    TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  agent_id               TEXT NOT NULL,
  scope                  TEXT NOT NULL,
  kind                   TEXT NOT NULL,
  title                  TEXT NOT NULL,
  summary                TEXT NOT NULL,
  evidence_event_ids     TEXT[] NOT NULL DEFAULT '{}',
  decision_refs          TEXT[] NOT NULL DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'open',
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash           TEXT NOT NULL,
  prior_checkpoint_hash  TEXT
);

CREATE INDEX IF NOT EXISTS checkpoints_tenant_agent_created_idx
  ON continuity.checkpoints(tenant_id, agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS checkpoints_tenant_scope_created_idx
  ON continuity.checkpoints(tenant_id, scope, created_at DESC);

COMMENT ON TABLE continuity.checkpoints IS
  'Verifiable agent-work continuity ledger. Turns memory into audit: what was done, why, and what evidence supports it.';
COMMENT ON COLUMN continuity.checkpoints.content_hash IS
  'sha256 over canonical checkpoint envelope.';
COMMENT ON COLUMN continuity.checkpoints.prior_checkpoint_hash IS
  'Hash of prior checkpoint for this tenant+agent, forming an agent-local continuity chain.';
