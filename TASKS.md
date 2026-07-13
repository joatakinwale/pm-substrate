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
| 2026-07-13 | `D7` | Business-operability objective gate | [`docs/objective-falsification.md`](./docs/objective-falsification.md) | `pm.objective.lab-measured.v1`; six-dimension evaluator with 11 tests; revision/run-manifest binding; `pm:objective` CLI; admitted-log memo fold and verdict ceiling; build/typecheck, 955 tests, and all strict gates green |
| 2026-07-08 | `D5-D` | Dashboard integration workbench | [`docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md`](./docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md) | Shell mounts `#lab`/`#control-plane`/`#integrations` (a `#live` ArrowHedge metrics view shipped and was removed the same day by owner decision — no lab-app content in the substrate dashboard); workbench API + UI ship mapping validate/propose/approve/reject, dry-run-only sync preview, and Liquid-assisted pending proposals (origin `liquid_discovery`); dashboard tests green; ledger work item closed. |
