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

97 runtime exports, pinned by `src/index.test.ts`. Derived empirically: the
dependency closure of every symbol imported from the old `@pm/agent-state`
across the workspace, plus the plan-named core builders and the full
`external-evidence` module. The witness/authority/quorum/seal tower is not a
legal dependency for runtime consumers; it lives in
`@pm/agent-state-provenance`.

## Current status: physical split

This is no longer an interim shim. The old `@pm/agent-state` package has been
deleted from the active workspace, all consumers import `@pm/agent-state-core`,
and the remaining tower is quarantined:

1. `@pm/agent-state-core` contains the active substrate-facing API.
2. `@pm/agent-state-provenance` contains the frozen provenance tower and
   re-exports core for its own compatibility tests.
3. `db/migrations/` applies the 26 core migrations by default.
4. `db/migrations-provenance/` applies the 123 tower migrations only when
   `PM_ENABLE_AGENT_STATE_PROVENANCE=1`.

## Rules

- New code imports `@pm/agent-state-core`, never `@pm/agent-state`.
- No package other than `@pm/agent-state-provenance` may import
  `@pm/agent-state-provenance`.
- No `export *` except the local `external-evidence` module. Widening the
  surface requires updating the pinned count in the facade test and shipping a
  runtime, non-test, non-eval consumer in the same change.
- `scripts/validate-budgets.ts` enforces file budgets, name-depth, provenance
  isolation, and explicit core surface.
