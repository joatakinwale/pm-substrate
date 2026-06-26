# v57 ArrowHedge Paired Temporal Packet Corpus

Date: 2026-06-25
Status: implemented Axis A paired temporal packet corpus, durable persistence still open

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ58: How should ArrowHedge generate persisted baseline-side terminal observation packets and substrate-side recovery suites for mapped finance scenario families, while leaving `memory_drift` and `continuity_break` visibly missing until real packet-backed pairs exist? | Linearizability and runtime-verification work separate histories/observations from the object that enforces valid terminal state. End-to-end and provenance papers make the finance adapter the right endpoint for domain packet generation, while traceability work requires the eval mapping to preserve which arm each packet supports. Therefore ArrowHedge should generate paired temporal packets in the finance package: baseline packets are advisory comparator observations with no provider authority, substrate packets are protective terminal outcomes, and strict recovery audits only the substrate arm. Durable DB persistence remains a separate proof boundary. | Added `buildArrowHedgeCanonicalPairedActionOutcomeEnvelopeCorpus()`. Corpus packets now carry `runArm` and `authorityRole`. Baseline comparator packets use advisory review, accepted terminal observations, baseline-scoped action ids, and no provider authority. Substrate packets keep blocked protective outcomes. The finance test maps both arms into Axis A, verifies the three temporal cells, generates a substrate-only recovery suite, and assembles a strict proof packet that remains finance-incomplete for missing classes. | RQ59: How should the paired ArrowHedge temporal packet corpus be persisted through the eval packet store and exposed as a reusable strict Axis A source bundle without hand-built test stores or hiding the remaining `memory_drift` / `continuity_break` gaps? |

## Bridge Hypothesis

The finance adapter should own paired temporal packet generation:

```text
temporal fixture case
  -> baseline advisory terminal observation packet
  -> substrate blocking terminal packet
  -> Axis A paired EvalEvents
  -> substrate-only authority recovery suite
```

The proof packet can verify the mapped temporal cells while the finance axis remains incomplete until all ten failure classes have packet-backed pairs.

## Falsification Criteria

1. The paired corpus must emit one baseline and one substrate packet for each canonical temporal scenario.
2. Baseline packets must not carry provider certificate authority.
3. Substrate packets must preserve blocked terminal outcomes.
4. Both arms must map into Axis A EvalEvents with `action_outcome_envelope` refs.
5. The mapped temporal finance cells can become verified.
6. Strict recovery must audit the substrate arm and pass with terminal refusal recoveries.
7. The finance axis must remain unverified while `memory_drift`, `continuity_break`, and other classes lack packet-backed pairs.

## Implementation

- Added packet-level `runArm` and `authorityRole` metadata to the ArrowHedge terminal packet corpus.
- Added `buildArrowHedgeCanonicalPairedActionOutcomeEnvelopeCorpus()`.
- Added `providerAuthority: null` support so baseline comparator packets can be accepted observations without becoming accepted substrate authority.
- Added baseline-scoped action ids and baseline-specific artifact ids.
- Added a finance test that maps paired packets into Axis A, generates substrate-only strict recovery, and assembles a strict proof source.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. The three canonical temporal scenario families now have paired terminal packets and strict substrate recovery. The axis still lacks packet-backed families for all ten failure classes and durable reusable source-bundle persistence. |
| Axis B marketing | Unchanged and blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice. |

## Verification

```text
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/write-binding.test.ts
```

## Sources

- Herlihy, M. P., & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." ACM Transactions on Programming Languages and Systems. https://doi.org/10.1145/78969.78972
- Saltzer, J. H., Reed, D. P., & Clark, D. D. (1984). "End-to-End Arguments in System Design." ACM Transactions on Computer Systems. https://doi.org/10.1145/357401.357402
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
