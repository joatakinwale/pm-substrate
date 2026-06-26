# v60 Axis A Source Authority Packet Family

Date: 2026-06-26
Status: implemented packet-backed Axis A `source_authority_conflict` family

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ61: How should ArrowHedge add packet-backed Axis A families for the remaining finance gaps using existing substrate gates rather than synthetic finance-only failures? | The remaining gaps should be sequenced by existing admission gates. Provenance and traceability papers say source identity/derivation must survive derived views; linearizability says accepted histories must be explainable as one legal operation history. Therefore the first remaining Axis A gap should not invent a new finance-only oracle; it should tighten the existing `CurrentStateView` conflict classifier so stale/wrong risk source snapshots surface as `source_authority_conflict`, then map that production blocker into paired terminal packets. | Changed ArrowHedge risk/signal snapshot mismatch conflicts from generic `state_disagreement` to `source_authority_conflict`, added `buildArrowHedgeSourceAuthorityConflictFixtureCases()`, added `ARROWHEDGE_CANONICAL_AUTHORITY_PACKET_SCENARIOS`, and expanded paired Axis A packets from five to six families. | RQ71: How should ArrowHedge add packet-backed Axis A families for `representation_loss`, `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict` without duplicating existing source-authority or temporal packets? |

## Active 10-Question Backlog

1. RQ62: What substrate primitive should make representation-preserving projection loss fail before finance state is admitted?
2. RQ63: How should source-authority conflicts bind to provider/status refs without making finance adapters import proof-packet internals?
3. RQ64: How should workflow invalidation be represented as a replayable policy-transition ref instead of scenario prose?
4. RQ65: How should capability contract violations become terminal packets through typed capability metadata rather than test fixtures?
5. RQ66: How should Axis A packet generation expose token/rework cost so terminal proof improves efficiency rather than ceremony?
6. RQ67: What adapter/profile boundary lets Axis B authoritative agency fixtures plug in without substrate package edits?
7. RQ68: How should amnesiac replay explain blocked decisions when the envelope is recovered but source projections have changed?
8. RQ69: How should red-team tests prove private memory, worktree state, or connector state cannot satisfy a continuity check?
9. RQ70: What proof-packet metric should distinguish "blocked because missing source" from "blocked because implementation cannot run"?
10. RQ71: How should ArrowHedge add packet-backed Axis A families for `representation_loss`, `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict` without duplicating existing source-authority or temporal packets?

## Peer-Reviewed Answer

- Buneman, Khanna, and Tan make provenance part of the meaning and reliability of derived data. A finance projection that hides which risk snapshot a decision used has lost operational meaning.
- Gotel and Finkelstein show traceability breaks when source/decision links cannot be followed across lifecycle stages. ArrowHedge's decision-to-risk snapshot link is exactly such a trace.
- Ramesh and Jarke's traceability reference models emphasize maintaining links across changing artifacts; a moved current risk source cannot be collapsed into a generic disagreement.
- Herlihy and Wing's linearizability gives the terminal-action analogue: a terminal decision must be explainable against one legal history. A decision accepted against an older risk source while the current source has moved is not a legal accepted history under the substrate gate.

## Arrowsmith Bridge Card

| Field | Bridge |
| --- | --- |
| Paper claim | Provenance/trace links are part of the state being reasoned about, not metadata after the fact. |
| Mechanism | Classify risk/signal snapshot mismatches as `source_authority_conflict`; make proposal review block; turn the blocked review into a terminal packet. |
| Failure class addressed | `source_authority_conflict`. |
| Reality quality approximated | State identity, boundary honesty, no stale self, no unadmitted mutation. |
| Substrate analogue | `CurrentStateView.conflicts[]` carries the conflict type; `ActionOutcomeEnvelope` demotes requested accepted writes to blocked through proposal-review blocking causes. |
| Implementation hypothesis | Reclassifying snapshot mismatches and adding a paired packet family will make Axis A verify `source_authority_conflict` through the same store-backed terminal source-bundle path. |
| Falsification criteria | CurrentStateView must expose `source_authority_conflict`; baseline packet must be accepted comparator evidence; substrate packet must be blocked; strict recovery must recover six substrate terminal refusals. |
| Axis coverage impact | Axis A gains one more packet-backed family. Axis B remains blocked. Axis C unchanged. |

## Falsification Criteria Before Coding

```text
expected failure class: source_authority_conflict
expected authority boundary: current risk-source identity must match the decision's risk-source identity
expected admitted transition: requested accepted portfolio decision becomes blocked on proposal review
expected evidence refs: source records/events plus state-review artifact
expected substrate refs: action_outcome_envelope, state_review_artifact, projection refs
expected baseline behavior: accepted comparator terminal packet
expected substrate behavior: blocked terminal packet with proposal-review blocking cause
expected replay behavior: PostgresEvalEventStore recovers six substrate blocked envelopes after adding this family
```

## Stage Audit

1. Scaffolding vs logic: passed. The production `tickerConflicts()` path now emits `source_authority_conflict`.
2. Advisory vs enforced: passed for the substrate arm. The blocking proposal review becomes a blocked terminal packet.
3. Mock vs integration: passed for the packet path. The paired proof records all packets through `PostgresEvalEventStore` before recovery.
4. Failure propagation: passed. The invalid authority source is represented as a blocked terminal outcome.
5. Adversarial input: partial. This slice prevents generic disagreement from hiding source-authority conflict, but provider/status binding remains RQ63.

## Implementation

- Changed ArrowHedge risk/signal snapshot mismatch conflict type to `source_authority_conflict`.
- Added `buildArrowHedgeSourceAuthorityConflictFixtureCases()`.
- Added `authorityConflictId` to ArrowHedge stable action-id derivation.
- Added `ARROWHEDGE_CANONICAL_AUTHORITY_PACKET_SCENARIOS`.
- Expanded `ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS` to include authority packets.
- Expanded paired Axis A proof from 5 to 6 packet-backed families.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved. Store-backed paired packet proof now verifies `stale_observation`, `feedback_disconnection`, `partial_observation`, `source_authority_conflict`, `memory_drift`, and `continuity_break`. |
| Axis B marketing | Still blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/evals/src/arrowhedge.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/write-binding.test.ts
```

## Sources

- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
- Ramesh, B., & Jarke, M. (2001). "Toward Reference Models for Requirements Traceability." IEEE Transactions on Software Engineering. https://doi.org/10.1109/32.895989
- Herlihy, M. P., & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." ACM Transactions on Programming Languages and Systems. https://doi.org/10.1145/78969.78972
