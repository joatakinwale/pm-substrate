# v59 Axis A Continuity Packet Families

Date: 2026-06-26
Status: implemented packet-backed Axis A `memory_drift` and `continuity_break` scenario families

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ60: How should ArrowHedge add packet-backed Axis A scenario families for `memory_drift` and `continuity_break` without inventing synthetic finance-only failures or weakening substrate/package boundaries? | Recovery-log, provenance, workflow-recovery, and traceability papers converge on the same mechanism: a resumed process must recover from durable, ordered, source-linked state, not from private recall or a summary. ARIES makes recovery a log/checkpoint property; provenance-based workflow recovery separates replay and checkpoint strategies from ad hoc restart; database provenance and requirements traceability require answer/decision state to retain source/decision links. Therefore ArrowHedge should model finance memory drift and continuity break as continuity-checkpoint failures that block `ActionOutcomeEnvelope` admission, while baseline comparator packets still show the invalid accepted behavior. | Added `verifyContinuityCheckpointChain()` to `@pm/continuity`, wired `PostgresContinuityLedger.verify()` through it, added ArrowHedge `continuityCheck` blocking causes, added paired baseline/substrate `memory_drift` and `continuity_break` packets, and exported Axis A packet scenario specs that map the new families through the strict source-bundle path. | RQ61: How should ArrowHedge add packet-backed Axis A families for the remaining finance gaps (`representation_loss`, `source_authority_conflict`, `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict`) using existing substrate gates rather than synthetic finance-only failures? |

## Active 10-Question Backlog

1. RQ61: How should ArrowHedge add packet-backed Axis A families for the remaining finance gaps using existing substrate gates rather than synthetic finance-only failures?
2. RQ62: What substrate primitive should make representation-preserving projection loss fail before finance state is admitted?
3. RQ63: How should source-authority conflicts bind to provider/status refs without making finance adapters import proof-packet internals?
4. RQ64: How should workflow invalidation be represented as a replayable policy-transition ref instead of scenario prose?
5. RQ65: How should capability contract violations become terminal packets through typed capability metadata rather than test fixtures?
6. RQ66: How should Axis A packet generation expose token/rework cost so terminal proof improves efficiency rather than ceremony?
7. RQ67: What adapter/profile boundary lets Axis B authoritative agency fixtures plug in without substrate package edits?
8. RQ68: How should amnesiac replay explain blocked decisions when the envelope is recovered but source projections have changed?
9. RQ69: How should red-team tests prove private memory, worktree state, or connector state cannot satisfy a continuity check?
10. RQ70: What proof-packet metric should distinguish "blocked because missing source" from "blocked because implementation cannot run"?

## Peer-Reviewed Answer

The useful mechanism is continuity as recoverable, source-linked state:

- Mohan et al.'s ARIES paper treats crash recovery as a write-ahead log plus checkpoint problem, so the recovered state must be derivable from recorded history rather than process memory.
- Kohler et al.'s provenance-based workflow recovery paper shows workflow resume can be driven by replay and checkpoints, with provenance determining the restart boundary.
- Buneman, Khanna, and Tan's provenance work makes source derivation part of answer meaning; a resumed finance decision without derivation links is not the same state.
- Gotel and Finkelstein's traceability work separates pre/post trace links and explains why decisions need persistent trace links to prior requirements/sources.
- Herlihy and Wing's linearizability gives the terminal-history analogue: completed actions need a single recoverable operation history, not conflicting private terminal claims.

## Arrowsmith Bridge Card

| Field | Bridge |
| --- | --- |
| Paper claim | Recovery and replay must reconstruct from durable logs, checkpoints, and provenance links. |
| Mechanism | Hash-verified checkpoint chain + contradiction finding + required terminal decision refs. |
| Failure class addressed | `memory_drift`, `continuity_break`. |
| Reality quality approximated | No private state, continuous transition, no stale self, no conflicting terminal outcomes, boundary honesty. |
| Substrate analogue | `ContinuityCheckpoint` refs become evidence/substrate refs on `ActionOutcomeEnvelope`; continuity failures become blocking causes. |
| Implementation hypothesis | A continuity check in the ArrowHedge terminal packet builder can block private memory drift or missing terminal history before a requested accepted finance write is admitted. |
| Falsification criteria | Valid checkpoint chains must pass; tampered/broken chains must fail; conflicting open checkpoints must block; missing terminal decision refs must block; baseline packets must still show accepted comparator behavior; substrate packets must recover from the eval packet store. |
| Axis coverage impact | Axis A gains packet-backed `memory_drift` and `continuity_break` families. Axis B remains blocked. Axis C unchanged but must keep using live substrate gates. |

## Falsification Criteria Before Coding

```text
expected failure class: memory_drift / continuity_break
expected authority boundary: continuity checkpoint refs cannot be replaced by private memory
expected admitted transition: requested accepted write is demoted to blocked when continuity check fails
expected evidence refs: continuity_checkpoint refs plus existing state-review provenance
expected substrate refs: action_outcome_envelope, state_review_artifact, projection, continuity_checkpoint refs
expected baseline behavior: accepted comparator observation without provider authority
expected substrate behavior: blocked terminal packet with continuity blocking cause
expected replay behavior: PostgresEvalEventStore recovers the substrate blocked envelopes for strict authority refusal
```

## Stage Audit

1. Scaffolding vs logic: passed. `PostgresContinuityLedger.verify()` now calls the reusable continuity verifier, and ArrowHedge's production packet builder calls the continuity blocker path.
2. Advisory vs enforced: passed for this slice. A requested `accepted` terminal outcome is demoted to `blocked` by `buildActionOutcomeEnvelope()` when continuity blocking causes exist.
3. Mock vs integration: passed for the tested path. The paired Axis A proof stores packets through `PostgresEvalEventStore` before strict recovery.
4. Failure propagation: passed. Continuity failures become terminal blocked outcomes with continuity refs.
5. Adversarial input: partially passed. Conflicting private resume memory and missing terminal refs are blocked. Broader worktree/connector-state bypass tests remain RQ69.

## Implementation

- Added `verifyContinuityCheckpointChain()` to `@pm/continuity`.
- Reused that verifier inside `PostgresContinuityLedger.verify()`.
- Added ArrowHedge `continuityCheck` inputs that produce terminal blocking causes:
  - `continuity_memory_drift_conflict`
  - `continuity_terminal_history_missing`
  - `continuity_checkpoint_chain_invalid`
  - `continuity_evidence_history_missing`
- Added two packet-backed Axis A fixture families:
  - `arrowhedge-memory-drift-conflicting-position`
  - `arrowhedge-continuity-break-missing-terminal-history`
- Added `ARROWHEDGE_CANONICAL_CONTINUITY_PACKET_SCENARIOS`.
- Added `ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS`.
- Extended the paired Axis A corpus from 3 temporal packet pairs to 5 packet pairs.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved. Store-backed paired packet proof now verifies five packet-backed families: `stale_observation`, `feedback_disconnection`, `partial_observation`, `memory_drift`, and `continuity_break`. Remaining finance classes stay visible as missing/unverified. |
| Axis B marketing | Unchanged and blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice; existing live coverage must remain backed by real substrate gates. |

## Verification

```text
pnpm --filter @pm/continuity typecheck
pnpm --filter @pm/evals typecheck
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm exec vitest run packages/continuity/src/verify.test.ts
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/evals/src/arrowhedge.test.ts packages/evals/src/persistence/persistence.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/write-binding.test.ts
```

## Sources

- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
- Kohler, S., Riddle, S., Zinn, D., McPhillips, T., & Ludascher, B. (2011). "Improving Workflow Fault Tolerance through Provenance-Based Recovery." SSDBM 2011. https://doi.org/10.1007/978-3-642-22351-8_12
- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
- Herlihy, M. P., & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." ACM Transactions on Programming Languages and Systems. https://doi.org/10.1145/78969.78972
