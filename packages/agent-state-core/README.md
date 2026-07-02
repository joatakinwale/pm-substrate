# @pm/agent-state-core

The lean agent-state surface — refactor plan **Phase 0, step 2.1** (`/refactor-plan.md`).

## What this is

The canonical import path for the agent-state primitives consumers actually use:

| Family | Exports |
|---|---|
| State refs | `stateRef`, `StateRef` |
| CurrentStateView / ObservationContract | build/evaluate contract, read-set builders |
| ActionProposalReview (warn-first) | `reviewProposedActionAgainstCurrentState`, read-set validation |
| StateReviewArtifact | build/verify hash, invariant policy, JSONL, continuity payloads |
| ActionOutcomeEnvelope | build/verify/promote, terminal index, provider authority |
| Thin certificate refs | `ProjectionReplayCertificateRef` (+ settlement ref) — *types only* |
| External-evidence admission | `reviewExternalStateEvidence` + full facet/type surface |

78 exports total (27 runtime, 51 type-only). Derived empirically: the union of every symbol imported from `@pm/agent-state` across the workspace (50 symbols, 13 files) plus the full `external-evidence` module and the plan-named core builders. The witness/authority/quorum/seal tower (the other ~1,530 exports) is **not** here and never will be — it moves to `@pm/agent-state-provenance`.

## Current status: interim shim

Every export currently re-exports from `@pm/agent-state`, so the split lands incrementally with tests green at each step:

1. **(done)** This package exists; the surface is pinned by `src/index.test.ts`.
2. Consumers re-point imports `@pm/agent-state` → `@pm/agent-state-core` (mechanical, per package).
3. Implementations move here (starting with `external-evidence.ts`, which is already a self-contained file); `@pm/agent-state` flips to re-export from this package.
4. The remaining tower moves to `@pm/agent-state-provenance`; its migrations gate behind `PM_ENABLE_AGENT_STATE_PROVENANCE` (plan §2.2).

## Rules

- New code imports `@pm/agent-state-core`, never `@pm/agent-state`.
- No `export *`. Widening the surface requires updating the pinned count in the facade test **and** shipping a runtime (non-test, non-eval) consumer in the same change.
