# v58 ArrowHedge Packet-Store Source Bundle

Date: 2026-06-25
Status: implemented reusable strict Axis A source-bundle path for paired temporal packets

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ59: How should the paired ArrowHedge temporal packet corpus be persisted through the eval packet store and exposed as a reusable strict Axis A source bundle without hand-built test stores or hiding the remaining `memory_drift` / `continuity_break` gaps? | ARIES-style recovery and runtime-verification work make replayable log/store recovery part of the proof boundary, not a test convenience. Linearizability separates a history of operations from the accepted object state, and traceability/provenance papers require source-bundle construction to preserve arm, source, and evidence links. Therefore the paired corpus should be recorded through the eval packet store, recovered by the shared authority audit, and assembled through a reusable Axis A source-bundle helper. Missing failure classes must remain visible in the coverage report. | Added `buildArrowHedgeTerminalPacketProofSourceBundle()` to `@pm/evals`. Updated the finance paired-packet test to persist all paired packets through `PostgresEvalEventStore.recordActionOutcomeEnvelopes()`, recover substrate terminal refusals through `auditEvalEventsGraphWriteAuthority()`, and assemble the strict source bundle through the reusable helper. | RQ60: How should ArrowHedge add packet-backed Axis A scenario families for `memory_drift` and `continuity_break` without inventing synthetic finance-only failures or weakening the substrate/package boundary? |

## Bridge Hypothesis

Axis A source proof should follow the same durable path as other terminal packets:

```text
ArrowHedge paired corpus
  -> PostgresEvalEventStore packet persistence
  -> store-derived substrate recovery suite
  -> buildArrowHedgeTerminalPacketProofSourceBundle()
  -> strict three-axis proof assembly
```

This removes hand-built packet lookup from the proof path while still leaving unimplemented failure classes as missing cells.

## Falsification Criteria

1. The paired corpus packets must record through `PostgresEvalEventStore.recordActionOutcomeEnvelopes()`.
2. The substrate arm must recover through `auditEvalEventsGraphWriteAuthority()` from the store.
3. Source-bundle construction must be reusable from `@pm/evals`.
4. The strict proof packet authority gate must pass for the mapped temporal packet obligations.
5. The finance axis must remain unverified while packet-backed `memory_drift`, `continuity_break`, and other classes are missing.

## Implementation

- Added `ArrowHedgeTerminalPacketProofSourceBundleInput`.
- Added `buildArrowHedgeTerminalPacketProofSourceBundle()`.
- Exported the new helper and input type from `@pm/evals`.
- Updated the finance paired-packet test to persist packets through the eval packet store before recovery.
- Kept `memory_drift` and `continuity_break` in the missing failure-class assertions.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. The canonical temporal paired packets now use store-backed recovery and a reusable strict source-bundle helper, but the axis still lacks all ten packet-backed failure families. |
| Axis B marketing | Unchanged and blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/evals/src/arrowhedge.test.ts packages/evals/src/persistence/persistence.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/write-binding.test.ts
```

## Sources

- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
- Herlihy, M. P., & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." ACM Transactions on Programming Languages and Systems. https://doi.org/10.1145/78969.78972
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
