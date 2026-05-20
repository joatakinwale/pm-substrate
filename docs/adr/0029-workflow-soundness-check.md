# ADR-0029 — Workflow soundness check

Accepted — 2026-05-20.

## Context

The coordinated-reality research pass identified a useful bridge between
workflow nets and biological checkpoint systems: a process is only reliable if
local transitions preserve a global completion invariant.

The substrate already rejected cycles at workflow install time, but acyclicity
alone does not prove the useful property. A workflow can be acyclic and still
contain unreachable nodes, invalid edge references, or reachable branches that
cannot reach completion.

## Decision

Add a pure workflow soundness analyzer to `@pm/workflow`:

- `analyzeWorkflowSoundness(doc)` returns a structured report.
- `assertWorkflowSound(doc)` throws `WorkflowValidationError` with concrete
  causes.

The first soundness contract is intentionally small and testable:

1. at least one trigger exists;
2. at least one reachable terminal invoke node exists;
3. node ids are unique;
4. every edge references declared nodes;
5. every node is reachable from some trigger;
6. every reachable invoke node can reach a terminal invoke node;
7. no non-terminating cycle exists outside a completion path.

This is not a full Petri-net implementation yet. It is the substrate-native
version of the bridge: expose the completion invariant as code and tests, then
iterate toward formal workflow-net modeling if the invariant proves useful.

## Consequences

Workflow authors now have a direct analyzer for the design-level failure modes
that show up as runtime confusion: orphan nodes, dead branches, and no terminal
completion path.

The check is currently exported but not enforced during `install()`. That is
intentional for this commit: existing workflows may rely on DAG-only validation.
The next hardening step is to run the analyzer against real workflow docs and
then decide whether install-time enforcement should be default or opt-in.

## Validation

- `pnpm typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test`
- `pnpm build`

As of implementation: 37 test files passed, 294 tests passed.
