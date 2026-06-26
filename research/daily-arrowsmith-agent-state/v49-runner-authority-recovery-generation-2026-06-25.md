# v49 Runner Authority Recovery Generation

Date: 2026-06-25
Status: implemented runner wiring, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ50: How should Axis A and Axis C live/scenario runner scripts generate `authorityRecoveries` from real `PostgresEvalEventStore` packet recovery plus `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` calls during persistence, so proof packets consume store-derived recoveries rather than synthetic test recoveries? | End-to-end arguments say correctness functions that depend on application semantics must be checked at the endpoint that has the relevant context. Proof-carrying code says the consumer should validate a supplied proof against its own policy, not trust the producer. Runtime verification says monitor results should be derived from the actual execution trace. ARIES says the recovery input must come from durable records. Therefore runner scripts should persist outcome packets first, then generate authority recoveries by reading those packets back through `PostgresEvalEventStore`, composing with the same store-backed resolver used by capability paths, and validating strict graph policy. The runner should report recovery summaries even when they fail, because failed recoveries are evidence about the next implementation gap, not cases to hide as blocked. | Added `auditEvalEventsGraphWriteAuthority()` to `@pm/evals` for batch store/resolver authority audits. Added `scripts/authority-recovery.ts` to compose `PostgresEvalEventStore` with `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` under strict graph policy. Updated `scripts/run-local-lab-evals.ts` and `scripts/run-local-agent-lab-live-evals.ts` to persist packets, generate authority recoveries from the store, then persist EvalEvents and print the authority-recovery summary. Added batch-audit tests and verified the deterministic runner still executes without `PM_DATABASE_URL`. | RQ51: How should Axis A and Axis C accepted outcome packets acquire real provider-status-bearing authority metadata in runner-produced packets, so store-derived `authorityRecoveries` can pass the strict proof-packet gate instead of only reporting missing-provider-status gaps? |

## Bridge Hypothesis

Runner authority recovery should be generated from the same substrate refs the proof packet consumes:

```text
recordActionOutcomeEnvelopes()
  -> getWorkflowActionOutcomeEnvelope()
  -> graphWriteAuthorityResolverFromWorkflowEnvelopeStore()
  -> auditEvalEventsGraphWriteAuthority()
  -> authorityRecovery summary / proof-packet input
  -> recordMany(EvalEvents)
```

The runner does not become authority. It becomes the place where durable packet state is recovered and checked before a proof packet can claim strict authority coverage.

## Falsification Criteria

1. Batch audit must skip events with no `action_outcome_envelope` ref.
2. Batch audit must report valid and invalid recoveries separately.
3. Runner scripts must use the store-backed resolver rather than hand-built authority refs.
4. Runner scripts must not fail or hide recovery failures by default; they should print the summary so the next frontier is visible.

## Implementation

- Added `auditEvalEventsGraphWriteAuthority()` and recovery summaries in `packages/evals/src/authority-recovery.ts`.
- Exported batch recovery types from `@pm/evals`.
- Added `scripts/authority-recovery.ts` with strict policy and resolver composition.
- Updated deterministic and live local-lab runner scripts to generate authority recoveries after packet persistence.
- Added a batch-audit test covering one valid accepted recovery, one invalid accepted recovery, and one event skipped because it lacks an outcome ref.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Runner generation path exists structurally, and ArrowHedge accepted replay packets can carry provider status. The finance runner still needs a full Axis A scenario path that emits store-derived recoveries into proof packets for all required classes. |
| Axis B marketing | Blocked. This work does not create PluggedInSocial or authoritative fixtures. |
| Axis C local lab | Improved. Local-lab scripts now generate store-derived authority recovery summaries when `PM_DATABASE_URL` is present. Accepted local-lab packets still lack provider-status authority metadata, so strict recovery will expose invalid accepted recoveries until RQ51 is handled. |

## Sources

- Saltzer, J. H., Reed, D. P., & Clark, D. D. (1984). "End-to-End Arguments in System Design." ACM Transactions on Computer Systems. https://doi.org/10.1145/357401.357402
- Necula, G. C. (1997). "Proof-Carrying Code." POPL 1997. https://doi.org/10.1145/263699.263712
- Schneider, F. B. (2000). "Enforceable Security Policies." ACM Transactions on Information and System Security. https://doi.org/10.1145/353323.353382
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
