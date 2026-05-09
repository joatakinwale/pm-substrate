# ADR-0015: Workflow cycle detection at install time

**Status:** Accepted
**Date:** 2026-05-09
**Tracks:** G8 — Workflow runtime hardening (phase 1 of 3)

## Context

Workflow docs (Layer 4, see `architecture.md`) are intended to be DAGs:
a trigger node fans out to invoke nodes through directed edges with optional
`when` guards. The day-1 install path validated three things:

1. Every referenced capability exists in the registry.
2. Node IDs are unique.
3. Every edge endpoint references a declared node.

It did not validate **acyclicity**. A doc like `a -> b -> a` would install
cleanly. At runtime, `PostgresWorkflowRuntime.#runWorkflow` walks the graph
via recursive `visit(nodeId)` — a back-edge produces unbounded recursion
through that walker until a JS stack overflow tears the run apart at an
arbitrary point. The run row would be left in `running`. Steps for the
nodes inside the cycle would alternate, with no clear failure record.

This is a substrate invariant violation: the runtime trusts that installed
docs match the grammar. Any guard that should be cheap and obvious belongs
at install, not at the dispatch hot path.

G7 added authorization gating; G6 added typed contracts. Neither catches
cycles. G8 phase 1 closes that gap.

## Decision

Reject cyclic workflow docs at `install()` time with
`WorkflowValidationError`, before persistence.

Implementation:

- New module `packages/workflow/src/cycle-detection.ts` exports a pure
  `assertAcyclic({ nodes, edges, workflowName, workflowVersion })` and a
  `assertWorkflowAcyclic(doc)` convenience wrapper.
- Algorithm: iterative depth-first 3-color walk (WHITE / GRAY / BLACK).
  A back-edge to a GRAY node = cycle. Iterative on purpose — recursive DFS
  is the wrong default for a substrate validator that must survive
  pathological docs without exploding the JS stack.
- On cycle: throws with the offending path serialized as
  `n1 -> n2 -> n3 -> n1` so authors can locate the bug.
- Edges from undeclared `from` nodes are ignored defensively; that error is
  raised earlier in `install()` and we don't want this validator to crash
  on the way to surfacing it.
- Installed before the existing G6 contract-validation block in `install()`
  so cycle errors fire before contract errors when a doc has both.

## Consequences

### Positive

- Invariant enforced at install: the runtime can keep trusting that the
  doc is a DAG without paying for runtime cycle checks on each dispatch.
- Failure mode goes from "stack overflow mid-run" to "install rejected
  with the cycle path named". Strict improvement for operators.
- Pure module is unit-testable without Postgres. Existing
  `postgres.test.ts` adds one DB-backed assertion to prove the wiring.

### Negative

- One more validation pass at install. Cost is `O(V + E)` and runs once
  per install — negligible.

### Neutral / future

- This does **not** address the runtime-level concern of an event triggering
  the same workflow twice from a NOTIFY-driven consumer; that's already
  handled by the `(workflow_id, triggered_by)` UNIQUE constraint.
- Phase 2 (G8.2) introduces workflow version pinning on runs; phase 3
  (G8.3) adds retry policy + dead-letter handling. Both are tracked
  separately and ship as their own ADRs/PRs.

## Alternatives considered

- **Detect cycles only at runtime via a visited-set guard.** Rejected: it
  catches the symptom (recursion blows up) but leaves cycles installable,
  which still corrupts run history with half-recorded steps. Install-time
  rejection is the cleaner contract.
- **Use Tarjan SCC / topological sort.** Equivalent for this purpose but
  more code than needed. The 3-color DFS gives both detection and a clean
  cycle path for the error message.
- **Defer to authoring tooling.** Rejected: the substrate is the truth.
  Authors call `runtime.install(doc)`; nothing guarantees an upstream
  authoring tool ran first.

## Verification

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test -- --run` — workflow tests cover linear DAGs, diamonds, disconnected components, self-loops, 2-node cycles, longer cycles, hidden-prefix cycles, defensive ghost-from edges, 1000-node chains, and DB-backed install rejection.
- `pnpm validate-contracts --strict` ✅
