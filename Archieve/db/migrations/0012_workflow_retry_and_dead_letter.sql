-- 0012_workflow_retry_and_dead_letter.sql
--
-- G8.3 — retry policy + dead-letter handling.
--
-- Two related changes:
--
-- 1. workflow.run_steps gains `attempts INTEGER DEFAULT 1`. Records how
--    many invocation attempts a single step underwent before reaching
--    its terminal status. Visibility / debugging field.
--
-- 2. workflow.dead_letter — append-only quarantine for steps that hit
--    their retry budget (or non-retryable errors) and could not complete.
--    Holds enough context to re-drive a failed step manually if needed:
--    full run + node identity, the capability that failed, the inputs
--    we resolved at the time, the trigger event id, and the last error.
--
-- Why dead-letter instead of just failing the run:
--   - A failed run today (pre-G8.3) leaves a step row marked 'failed'
--     and silently stops the rest of the DAG. There's no operational
--     surface for "what failed, why, can we replay it." Production
--     workflows hitting transient-but-persistent failures (rate limits,
--     downstream outages) need a queue an operator can drain.
--   - Same pattern as Kafka, SQS, RabbitMQ: explicit DLQ separated from
--     the live run history. Keeps run table clean; failures are
--     queryable as a first-class entity.
--
-- Append-only by convention; no UPDATE path. If a dead-letter entry
-- gets re-driven and succeeds, we leave the original row in place
-- with a `redriven_at` timestamp set, so the audit trail is preserved.

-- 1. attempts column on run_steps.
ALTER TABLE workflow.run_steps
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;

-- 2. dead_letter table.
CREATE TABLE IF NOT EXISTS workflow.dead_letter (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  run_id          TEXT NOT NULL REFERENCES workflow.runs(id) ON DELETE CASCADE,
  workflow_id     TEXT NOT NULL REFERENCES workflow.workflows(id),
  workflow_version INTEGER,                          -- mirrors runs.workflow_version
  node_id         TEXT NOT NULL,
  capability      TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,                     -- event id (mirrors runs.triggered_by)
  inputs          JSONB,                             -- resolved inputs at time of failure
  attempts        INTEGER NOT NULL,                  -- how many tries we made before giving up
  error           JSONB NOT NULL,                    -- last error payload from dispatcher / authz / runtime
  reason          TEXT NOT NULL,                     -- short tag: 'retry_exhausted' | 'permission_denied' | 'capability_not_found' | 'non_retryable'
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  redriven_at     TIMESTAMPTZ                        -- set when an operator re-drives this row; original stays for audit
);

CREATE INDEX IF NOT EXISTS dead_letter_tenant_failed_at_idx
  ON workflow.dead_letter (tenant_id, failed_at DESC);

CREATE INDEX IF NOT EXISTS dead_letter_run_idx
  ON workflow.dead_letter (run_id);

CREATE INDEX IF NOT EXISTS dead_letter_open_idx
  ON workflow.dead_letter (tenant_id, redriven_at)
  WHERE redriven_at IS NULL;

COMMENT ON TABLE workflow.dead_letter IS
  'G8.3 quarantine for terminal step failures. Append-only audit; redriven_at marks operator replay.';
