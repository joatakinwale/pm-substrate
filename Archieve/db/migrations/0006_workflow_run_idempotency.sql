-- 0006_workflow_run_idempotency.sql
-- Idempotency invariant for the workflow runtime.
--
-- A workflow run is keyed by (workflow_id, triggered_by). The same trigger
-- event must never start the same workflow twice. The runtime relies on
-- INSERT ... ON CONFLICT DO NOTHING against this constraint to provide the
-- at-least-once delivery safety net for NOTIFY-driven consumers.

CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_idempotency_idx
  ON workflow.runs (workflow_id, triggered_by);
