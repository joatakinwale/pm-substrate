CREATE SCHEMA IF NOT EXISTS evals;

CREATE TABLE IF NOT EXISTS evals.action_outcome_envelope_packets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  envelope_ref_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  terminal_outcome TEXT NOT NULL,
  outcome_hash TEXT NOT NULL,
  envelope JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, envelope_ref_id)
);

CREATE INDEX IF NOT EXISTS action_outcome_envelope_packets_action_idx
  ON evals.action_outcome_envelope_packets (tenant_id, action_id);

CREATE INDEX IF NOT EXISTS action_outcome_envelope_packets_outcome_idx
  ON evals.action_outcome_envelope_packets (tenant_id, terminal_outcome);
