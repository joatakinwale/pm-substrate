-- 0018_eval_event_taxonomy.sql
-- Queryable research taxonomy and coordination-policy columns for eval events.

ALTER TABLE evals.eval_events
  ADD COLUMN IF NOT EXISTS state_bench_category TEXT,
  ADD COLUMN IF NOT EXISTS memory_benchmark_bridge TEXT,
  ADD COLUMN IF NOT EXISTS mast_category TEXT,
  ADD COLUMN IF NOT EXISTS coordination_class TEXT;

CREATE INDEX IF NOT EXISTS eval_events_taxonomy_idx
  ON evals.eval_events (
    tenant_id,
    axis,
    state_bench_category,
    memory_benchmark_bridge,
    mast_category
  );

CREATE INDEX IF NOT EXISTS eval_events_coordination_idx
  ON evals.eval_events (tenant_id, axis, coordination_class);

COMMENT ON COLUMN evals.eval_events.state_bench_category IS
  'External STATE-Bench-style category used for cross-benchmark eval comparison.';

COMMENT ON COLUMN evals.eval_events.memory_benchmark_bridge IS
  'Memory-agent benchmark bridge label, such as knowledge_update or workflow_rebase.';

COMMENT ON COLUMN evals.eval_events.mast_category IS
  'MAST-style multi-agent failure category for coordination and verification analysis.';

COMMENT ON COLUMN evals.eval_events.coordination_class IS
  'Cross-disciplinary coordination classification: observation, convergent update, authority-gated transition, or derived projection.';
