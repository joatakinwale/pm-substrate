-- 0017_eval_events.sql
-- State-coherence evaluation event ledger.

CREATE SCHEMA IF NOT EXISTS evals;

CREATE TABLE IF NOT EXISTS evals.eval_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  axis TEXT NOT NULL,
  run_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  failure_class TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  result TEXT NOT NULL,
  run_arm TEXT,
  paired_run_group TEXT,
  event JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eval_events_tenant_axis_idx
  ON evals.eval_events (tenant_id, axis);

CREATE INDEX IF NOT EXISTS eval_events_tenant_run_idx
  ON evals.eval_events (tenant_id, run_id);

CREATE INDEX IF NOT EXISTS eval_events_tenant_scenario_idx
  ON evals.eval_events (tenant_id, scenario_id);

CREATE INDEX IF NOT EXISTS eval_events_pair_idx
  ON evals.eval_events (tenant_id, axis, scenario_id, paired_run_group, run_arm);

COMMENT ON TABLE evals.eval_events IS
  'Evidence ledger for paired baseline/substrate state-coherence evaluations.';
