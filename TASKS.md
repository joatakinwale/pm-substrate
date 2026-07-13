# TASKS

This is the human-readable task index for pm-substrate. It is not the source of truth.

Authority order:

1. Continuity ledger: `pnpm dev:resume` and `pnpm dev:status`.
2. `ROADMAP.md`: forward plan and phase ordering.
3. This file: implementation index for humans and agents.

Rules:

- Every open task must reference a roadmap phase or ledger checkpoint.
- If this file disagrees with the ledger or roadmap, record a superseding `decision` checkpoint, then fix this file.
- Do not add orphan tasks here.

## Open

| Status | Roadmap | Task | Plan / Spec | Exit criteria |
|---|---|---|---|---|
| queued (external app anchors) | `D6` | Re-establish per-revision lab boundary conformance | [`ROADMAP.md`](./ROADMAP.md#up-next--d6d7-execution-sequence) | PluggedInSocial restores `browser_qa_harness` + `operatorRunMonitorSurface`; ArrowHedge restores the neutral `/integration/v1` contract; each conformance run is pinned to an app revision |

## Closed

Closed tasks live in the continuity ledger and changelog. Add rows here only when a currently open task is closed and the corresponding ledger work item is closed.

| Closed | Roadmap | Task | Plan / Spec | Evidence |
|---|---|---|---|---|
| 2026-07-13 | `D1 / hard requirement 2` | Repair the core/provenance migration split | [`scripts/migrate.ts`](./scripts/migrate.ts) | Removed 122 merge-regressed duplicates from core; migration-tier regression test; existing core/provenance DBs idempotent; fresh core = 26, fresh provenance = 149; 957 tests/7 skips pass on both |
| 2026-07-13 | `D6 / D7` | Business-operability objective gate and exact-provenance receipts | [`docs/objective-falsification.md`](./docs/objective-falsification.md) | `pm.objective.lab-measured.v2`; six-dimension evaluator; run-manifest/boundary/app/substrate revision binding; sync and executor receipts; historical-event reuse regression; `pm:objective` CLI; admitted-log memo fold and verdict ceiling; build/typecheck, 962 tests/7 external skips, and strict validators green |
| 2026-07-08 | `D5-D` | Dashboard integration workbench | [`docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md`](./docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md) | Shell mounts `#lab`/`#control-plane`/`#integrations` (a `#live` ArrowHedge metrics view shipped and was removed the same day by owner decision — no lab-app content in the substrate dashboard); workbench API + UI ship mapping validate/propose/approve/reject, dry-run-only sync preview, and Liquid-assisted pending proposals (origin `liquid_discovery`); dashboard tests green; ledger work item closed. |
