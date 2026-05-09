# ADR-0016: Workflow version immutability + run-level version pinning

**Status:** Accepted
**Date:** 2026-05-09
**Tracks:** G8 — Workflow runtime hardening (phase 2 of 3)

## Context

`workflow.workflows` is keyed by `(tenant_id, name, version)`. Day-1
`install()` used `ON CONFLICT (tenant_id, name, version) DO UPDATE
SET doc = EXCLUDED.doc, enabled = true`. That's a two-fer of latent
correctness bugs:

1. **Re-installing the same version with a different doc silently
   rewrote history.** `workflow.runs.workflow_id` FKs the row by `id`,
   not by `(tenant, name, version)`. So an in-place doc overwrite
   meant prior runs that referenced that workflow were now joined
   against a doc they never actually ran. Audit replays, debugging,
   and any "show me what this run executed" query returned wrong
   answers.
2. **No version field on the run row.** Even with an immutable doc,
   joining `runs → workflows` to discover the version is awkward and
   requires a live workflow row to still exist. Hard to write the
   audit query "runs of v3 of workflow X" without a denormalized
   field.

G7 closed the authorization gap. G6 closed the contract gap. G8.1
closed the cycle gap. G8.2 closes the version-history gap.

## Decision

Two changes that together pin every run to a frozen, self-contained
version:

### 1. Workflow versions are immutable.

Re-installing an existing `(tenant_id, name, version)` with a
**different** doc throws `WorkflowValidationError` with message
including the word `immutable` and a reminder that bumping the
version is the legal upgrade path.

Re-installing with the **same** doc is allowed (idempotent) and
re-enables the row if it was disabled.

Same-content re-install is detected via canonical-JSON comparison
of the stored vs incoming doc (sorted-key `JSON.stringify` —
docs are simple enough for that to be a reliable equality check).

### 2. Runs snapshot version + full doc on creation.

`workflow.runs` gains two columns:

- `workflow_version INTEGER` — cheap, indexable identity check that
  matches the `(tenant, name, version)` key.
- `workflow_doc JSONB` — full doc snapshot for forensic / replay
  purposes. Useful when you want to see exactly which capabilities,
  inputs, edges, and `when` guards a past run used without trusting
  the (now-immutable but still reachable-only-by-id) workflows row.

Migration `0011_workflow_run_version_pinning.sql` adds both columns
(NULLable; legacy rows pre-dating G8.2 stay NULL by design — they
predate the version-pinning regime). Index on
`(workflow_id, workflow_version)`.

Runtime now populates both fields on every new run insertion.

## Consequences

### Positive

- Run history is reproducible. "What did run X execute?" is a single
  SELECT against `workflow.runs`, no join required, no risk of doc
  drift.
- Authoring becomes saner: the contract is "versions are stable; bump
  to change anything." That's the same model Kafka uses for schemas
  and FHIR uses for resources. Familiar and right.
- Catches a real bug class. Anyone editing a doc and re-installing at
  the same version now gets a loud error instead of silent corruption.

### Negative

- Storage: ~2 KB per run for the doc snapshot. Workflow runs are not
  high-volume relative to events; cost is negligible.
- One extra SELECT on the install path (to check existing doc). Sub-ms
  with the existing PK index. Acceptable.

### Neutral / future

- Legacy run rows (NULL `workflow_version`) stay as historical artifacts.
  They were always broken; the migration doesn't fix them retroactively
  (would need to backfill from `workflows.doc`, but that doc may also
  have been overwritten pre-G8.2). Treat them as best-effort historical.
- Phase 3 (G8.3) builds on this: retry policy + dead-letter handling
  must reference the same pinned doc, not the live workflow row.

## Alternatives considered

- **Snapshot only the version, not the full doc.** Rejected: future
  audit / replay needs the doc and joining to a live row that may have
  been re-disabled or re-enabled is fragile. Extra storage is cheap.
- **Make `workflow_id` itself version-bearing** (e.g. compound key on
  the runs FK). Rejected: requires schema surgery on a hot table and
  forces every API in `interfaces.ts` to deal with the compound. The
  denormalized snapshot is simpler.
- **Hash the doc and store only the hash.** Rejected: hashes don't
  let you read the doc back without joining to *something*; the whole
  point is that the run row should be self-contained.
- **Allow same-version mutation but version-stamp every overwrite.**
  Rejected: this is just versioning with extra steps and a worse mental
  model. "Versions are immutable, bump to change" is the cleanest
  contract.

## Verification

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test -- --run` — 25 files / **192 tests** (was 189). Three new tests cover: same-doc re-install is idempotent; different-doc re-install throws `/immutable/`; runs carry `workflow_version=7` and a full-doc `workflow_doc` snapshot at creation.
- `pnpm validate-contracts --strict` ✅
- Migration `0011` applied to dev DB; `\d workflow.runs` confirms `workflow_version`, `workflow_doc`, and `workflow_runs_workflow_version_idx`.
