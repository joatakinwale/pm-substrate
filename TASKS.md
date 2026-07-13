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
| direct-core adapter/verifier complete; provider and real-sidecar run blocked | `D6-B` | Execute pinned ToolSandbox public vertical slice | [`public-benchmark-status-2026-07-13.md`](./docs/public-benchmark-status-2026-07-13.md) | Native/sham/substrate preserve the upstream scenario/oracle; provider raw bytes, request IDs, usage/cost/latency, exact task/oracle bytes, real HTTP/MCP sidecar receipt, and actual OS-process restart verify independently. Current v1 attempt stopped on `429`; current v2 converter emits no eligible attempt |
| conformance adapter complete; official raw-evidence conversion blocked | `D6-C` | Run STATE-Bench held-out headline evaluation | [`public-benchmark-status-2026-07-13.md`](./docs/public-benchmark-status-2026-07-13.md) | Official Agent Learning Track split, simulator, judge, and score remain locked; 2,250 trajectories carry independently verifiable raw runner/provider/simulator/judge bytes plus request IDs, usage, cost, and latency. Hand-authored score-shaped output remains ineligible |
| shared-runner/blind-oracle harness complete; behavioral runs queued | `D6-D` | Execute independent public corner battery | [`public-benchmark-status-2026-07-13.md`](./docs/public-benchmark-status-2026-07-13.md) | Publicly owned contradiction/supersession, restart/idempotency/collateral, and dynamic-state scenarios run matched agents through one runner/config/model with typed arm deltas; independent receipts and real process isolation establish execution without altering headline tasks |
| blocked on observed public failure | `D6-E` | Research and implement a public Arrowsmith repair | [`v230 continuity repair`](./research/daily-arrowsmith-agent-state/v230-continuity-concurrent-head-repair-2026-07-13.md) | An observed public trace identifies a general primitive gap; smallest runtime-consumed change improves the exact retest under ablation and leaves regression gates green. The continuity repair validates the method but is not public efficacy evidence |
| signed-assertion diagnostics implemented; raw-derived evidence eligibility blocked | `D7` | Replicate and issue the keep/repair/kill decision | [`public-eval-analysis`](./packages/public-eval-analysis/README.md) | Adapter-specific procedures derive all 31 check facts from the bound manifest, attempts, analysis, and content-addressed raw records; externally anchored preregistration, clean verification, confirmatory lift over both controls, guardrails, economics, six signed receipts, and distinct-model replication may then produce conditional eligibility. Current v4 output is always `not_eligible`; an authenticated owner would still separately sign the exact report hash and consequence |
| deferred by decision | `D8` | Re-open lab-app transfer validation | [`ROADMAP.md`](./ROADMAP.md) | Only a D7 keep decision can resume PluggedInSocial or ArrowHedge work |

## Closed

Closed tasks live in the continuity ledger and changelog. Add rows here only when a currently open task is closed and the corresponding ledger work item is closed.

| Closed | Roadmap | Task | Plan / Spec | Evidence |
|---|---|---|---|---|
| 2026-07-13 | `D6-A` | Reset evidence integrity | [`objective-falsification.md`](./docs/objective-falsification.md) | Local evidence is explicitly mechanism-conformance-only; live 22-scenario/22-exact-pair Ollama suite passes expected-allow/block controls and rejects both mutants; public analysis binds deterministic top-ranked task selection, arms, order, environment, preregistration, attempt times, and versioned structured assertions. Current report v4 keeps those assertions diagnostic-only, always `not_eligible`, and never KEEP |
| 2026-07-13 | `D6 / D7` | Executable boundary-conformance receipts | [`docs/evidence/README.md`](./docs/evidence/README.md) | Generic `pm:boundary`; content-addressed pass/fail receipts; Git and Gitless revision pinning; measurement/list/memo independently reopen exact bindings; 5 artifact tests; durable current PluggedInSocial red receipt; 967 tests/7 external skips and strict gates green |
| 2026-07-13 | `D1 / hard requirement 2` | Repair the core/provenance migration split | [`scripts/migrate.ts`](./scripts/migrate.ts) | Removed 122 merge-regressed duplicates from core; migration-tier regression test; existing core/provenance DBs idempotent; fresh core = 26, fresh provenance = 149; 957 tests/7 skips pass on both |
| 2026-07-13 | `D6 / D7` | Business-operability objective gate and exact-provenance receipts | [`docs/objective-falsification.md`](./docs/objective-falsification.md) | `pm.objective.lab-measured.v2`; six-dimension evaluator; run-manifest/boundary/app/substrate revision binding; sync and executor receipts; historical-event reuse regression; `pm:objective` CLI; admitted-log memo fold and verdict ceiling; build/typecheck, 962 tests/7 external skips, and strict validators green |
| 2026-07-08 | `D5-D` | Dashboard integration workbench | [`docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md`](./docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md) | Shell mounts `#lab`/`#control-plane`/`#integrations` (a `#live` ArrowHedge metrics view shipped and was removed the same day by owner decision — no lab-app content in the substrate dashboard); workbench API + UI ship mapping validate/propose/approve/reject, dry-run-only sync preview, and Liquid-assisted pending proposals (origin `liquid_discovery`); dashboard tests green; ledger work item closed. |
