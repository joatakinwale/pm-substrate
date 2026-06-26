# v54 ArrowHedge Terminal Packet Corpus

Date: 2026-06-25
Status: implemented finance-domain terminal packet corpus, Axis A still incomplete

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ55: How should ArrowHedge generate terminal `ActionOutcomeEnvelope` packets for the remaining Axis A failure classes (`partial_observation`, `memory_drift`, `feedback_disconnection`, `continuity_break`, and the currently unpacketized finance scaffold pairs) without inventing synthetic writes or coupling finance fixtures into substrate packages? | Requirements-traceability work says proof links must preserve source, purpose, actor, and lifecycle rather than infer missing traces. Runtime-verification work says a monitor verdict only applies to observed traces/properties. Proof-carrying-code work says the producer can ship proof material, but the consumer must verify it independently. Linearizability adds that action ids must identify one operation effect, not collapse adjacent operations. Therefore ArrowHedge terminal packets should be produced in the finance adapter from existing state-review inputs, passed through the core hash/terminal index, and rejected if action ids conflict or packet hashes fail. Evals can consume those packets later; substrate packages should not learn finance fixture semantics. | Added `buildArrowHedgeActionOutcomeEnvelopeCorpus()` and `buildArrowHedgeCanonicalActionOutcomeEnvelopeCorpus()` in `@pm/capability-finance-research-ingest`. Canonical finance state-review inputs now produce four hash-valid terminal packets: one accepted clean/current packet with provider certificate status metadata and three blocked temporal packets. Fixed default ArrowHedge action-id derivation so distinct `risk.refresh` operations with `refreshId`, `feedbackId`, or missing-observation semantics do not collapse into one action id. Exported the provider function from the package index and aligned the provider manifest with `state_review_artifact` evidence refs. | RQ56: How should the domain-owned ArrowHedge terminal packet corpus be mapped into Axis A EvalEvents/source bundles for the remaining failure classes, with store-derived authority recovery, without counting unmapped packets or blocked Axis B as verified coverage? |

## Open Question Set After Replacement

The loop still keeps ten open research questions active. RQ55 is eliminated and RQ56 enters the set.

1. RQ56: Map the domain-owned ArrowHedge terminal packet corpus into Axis A EvalEvents/source bundles without counting unmapped packets as verified.
2. How should `memory_drift` in finance be represented as a write-boundary packet rather than a stale-observation alias?
3. What is the minimum authoritative fixture shape for Axis B if PluggedInSocial remains unavailable?
4. How should store-derived authority recoveries be generated for non-workflow domain packets that are built from state-review artifacts?
5. Which finance scenario ids should be canonical for `partial_observation`, `feedback_disconnection`, and `continuity_break` so replay does not depend on prose notes?
6. How should accepted domain packets acquire durable provider-certificate status-event refs instead of static fixture authority?
7. What replay packet shape lets an amnesiac agent recover a blocked finance action and its current replacement action?
8. How should baseline finance failures cite terminal packets when the baseline did not have substrate admission at decision time?
9. How should `token_cost_per_valid_admitted_action` be measured for ArrowHedge without hiding rejected work as blocked cases?
10. What proof packet should mark Axis B as a concrete external blocker while still allowing Axis A/C implementation to advance?

## Bridge Hypothesis

Finance terminal packets must be produced by the finance adapter:

```text
canonical ArrowHedge state-review inputs
  -> domain ActionOutcomeEnvelope corpus
  -> core hash validation
  -> core terminal index
  -> eval/source-bundle mapping later
```

The eval layer may measure and assemble packets, but it must not invent finance writes or repair missing domain traces.

## Falsification Criteria

1. Canonical ArrowHedge state-review inputs must produce terminal packets without adding finance logic to substrate core packages.
2. Every produced packet must have a valid `ActionOutcomeEnvelope` hash.
3. The packet corpus must pass the core terminal index, catching action-id collapse or terminal conflicts.
4. Accepted packets must carry provider certificate/status metadata needed for later strict recovery.
5. Blocked packets must not carry accepted write authority.
6. The provider manifest must advertise the evidence ref kind the packet producer actually emits.

## Implementation

- Added `ArrowHedgeActionOutcomeEnvelopeCorpus` and packet metadata types.
- Added `buildArrowHedgeActionOutcomeEnvelopeCorpus()`.
- Added `buildArrowHedgeCanonicalActionOutcomeEnvelopeCorpus()`.
- Added `buildArrowHedgeActionOutcomeProviderAuthority()` for accepted domain packets.
- Exported `buildArrowHedgeActionOutcomeEnvelope()` and terminal packet helpers from the package index.
- Added `state_review_artifact` to the finance terminal-admission provider evidence ref kinds.
- Fixed default ArrowHedge action id derivation to prefer `refreshId`, `feedbackId`, then missing-observation discriminator before falling back to `decisionId`.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. The finance adapter now produces canonical terminal packets from existing state-review inputs, but those packets are not yet mapped into all missing Axis A EvalEvent/source-bundle cells. |
| Axis B marketing | Still blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice. |

## Verification

```text
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm exec vitest run packages/capability-finance-research-ingest/src/capability.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts
```

## Sources

- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
- Ramesh, B., & Jarke, M. (2001). "Toward Reference Models for Requirements Traceability." IEEE Transactions on Software Engineering. https://doi.org/10.1109/32.895989
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Necula, G. C. (1997). "Proof-Carrying Code." POPL 1997. https://doi.org/10.1145/263699.263712
- Herlihy, M. P., & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." ACM TOPLAS. https://doi.org/10.1145/78969.78972
