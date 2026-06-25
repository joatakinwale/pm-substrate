# Agent-State Arrowsmith v23: Outcome Envelope Replay Index

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v22-workflow-envelope-promotion-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ24 from v22.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ24: How should promoted runtime outcome envelopes be persisted and replayed as substrate refs so Axis A/C EvalEvents and amnesiac resume recover terminal outcomes from substrate state rather than JSONL duplication or chat context? | Durable recovery should be log/provenance based: the EvalEvent should carry a stable ref, while replay reads the terminal envelope from a committed proof packet and verifies the packet hash. ARIES supports restart recovery by using log records and redo/undo discipline rather than volatile process memory. Buneman/Khanna/Tan show that derived data needs provenance explaining where it came from and by which process. Chandy/Lamport show that distributed recovery needs a consistent recorded state, not each participant's private view. Garcia-Molina/Salem sagas show long-running workflows should be recoverable as ordered transactional steps with explicit compensation/finality. Therefore EvalEvents should not embed or reinterpret terminal envelopes; they should resolve `action_outcome_envelope` substrate refs against durable promoted packets and fail replay when the ref is missing or hash-invalid. | Added an `ActionOutcomeEnvelopeReplayIndex` in `@pm/evals`, recovery helpers for `action_outcome_envelope` refs, and `analyzeEvalEventActionOutcomeReplay()` metrics. Axis A ArrowHedge tests now derive the terminal-partition EvalEvent ref from the write-binding replay corpus and prove an amnesiac replay can recover the blocked terminal envelope and verify its hash. | RQ25: How should promoted outcome-envelope packets move from committed JSONL replay into a live substrate-owned store so Axis C dynamic local-lab EvalEvents and Postgres eval persistence can recover terminal outcomes without fixture-only coupling? |

Active question set leaving this run: RQ12-RQ20, RQ25.

## Sources

- C. Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging," ACM TODS, 1992: https://dl.acm.org/doi/10.1145/128765.128770
- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Why and Where: A Characterization of Data Provenance," ICDT, 2001: https://dl.acm.org/doi/10.5555/645504.656274
- K. Mani Chandy and Leslie Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems," ACM TOCS, 1985: https://dl.acm.org/doi/10.1145/214451.214456
- Hector Garcia-Molina and Kenneth Salem, "Sagas," ACM SIGMOD, 1987: https://dl.acm.org/doi/10.1145/38713.38742

## Implementation Delta

1. `@pm/evals` now exposes `buildActionOutcomeEnvelopeReplayIndex()` over write-binding replay records.
2. The replay index records each promoted envelope's `action_outcome_envelope` substrate ref, source replay record id, terminal outcome, outcome hash, and hash-validity status.
3. `recoverActionOutcomeEnvelopeFromReplayIndex()` recovers the canonical envelope from only a substrate ref and the replay index.
4. `analyzeEvalEventActionOutcomeReplay()` reports EvalEvent action-outcome refs, resolved/unresolved refs, invalid hashes, and recovered accepted/blocked terminal outcomes.
5. Axis A ArrowHedge terminal-partition tests now use the committed write-binding replay corpus as the durable proof source for the EvalEvent `action_outcome_envelope` ref.

## Falsification Criteria

This slice fails if:

1. An EvalEvent `action_outcome_envelope` ref can pass replay metrics without a matching proof packet.
2. A hash-invalid promoted envelope is counted as recovered.
3. The terminal-partition EvalEvent uses a placeholder outcome id rather than a ref from the replay corpus.
4. Recovered terminal outcomes cannot distinguish accepted from blocked.
5. Axis C local-lab is claimed as live-recovered before its outcome refs are backed by promoted packets or a live store.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Improved. The ArrowHedge terminal-partition substrate EvalEvent now resolves its `action_outcome_envelope` ref against the write-binding replay packet and recovers a blocked terminal outcome with a valid hash. |
| Axis B marketing | Still blocked. PluggedInSocial is not restored/cloned and no accepted authoritative agency fixtures have been provided, so the whole solution remains unverified. |
| Axis C local lab | Still fixture-level for outcome refs. Local-lab EvalEvents cite action-outcome refs, but those refs are not yet backed by promoted runtime packets or a live substrate-owned store. |

## Next Action Queue

1. Answer RQ25 by defining the live store boundary for promoted outcome-envelope packets.
2. Add Axis C runtime packet persistence so local-lab action-outcome refs resolve through the same replay path as ArrowHedge.
3. Wire `PostgresEvalEventStore` or an adjacent substrate table to persist terminal envelope proof packets before pass/fail EvalEvents claim recovery.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.
