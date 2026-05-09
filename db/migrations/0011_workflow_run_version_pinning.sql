-- 0011_workflow_run_version_pinning.sql
--
-- G8.2 — workflow version pinning on runs.
--
-- Problem (pre-G8.2):
--   `workflow.workflows` is keyed by (tenant_id, name, version). The Day-1
--   `install()` path used ON CONFLICT (tenant_id, name, version) DO UPDATE
--   to overwrite the `doc` column when the same version was re-installed.
--   That meant historical `workflow.runs` rows referencing a workflow `id`
--   could silently end up paired with a different doc than the one they
--   actually ran under. Run history was not reproducible.
--
-- Fix:
--   1. Pin the *exact* version (and doc, defensively) on each run row at
--      creation time. Even if a workflow is re-installed, prior runs keep
--      pointing at the version + doc that was live when they ran.
--   2. (In code) `install()` now refuses to mutate an existing
--      (tenant_id, name, version). Versions are immutable; any change
--      requires a new version. See ADR-0016.
--
-- Schema change:
--   - workflow.runs gains `workflow_version INTEGER` (NULL on legacy rows
--     pre-migration; populated on every new run via runtime code).
--   - workflow.runs gains `workflow_doc JSONB` snapshot for forensic /
--     replay purposes. NULL on legacy rows.
--
-- Why both fields:
--   `workflow_version` is the cheap, indexable identity check (matches
--   the (tenant_id, name, version) key). `workflow_doc` is the full
--   snapshot — useful for audit replays where you want to see exactly
--   what walker / inputs / capabilities a past run used without joining
--   to a possibly-mutated workflows row. Storage cost is small; doc is
--   typically <2KB JSON.
--
-- Backfill:
--   Existing rows are left with NULL workflow_version / workflow_doc.
--   They predate the version-pinning regime; treat them as best-effort
--   historical. The runtime fills both columns on every new run going
--   forward.

ALTER TABLE workflow.runs
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER;

ALTER TABLE workflow.runs
  ADD COLUMN IF NOT EXISTS workflow_doc JSONB;

-- Index on (workflow_id, workflow_version) so audit / replay queries that
-- filter by "all runs of v3 of workflow X" stay cheap.
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_version_idx
  ON workflow.runs (workflow_id, workflow_version);
