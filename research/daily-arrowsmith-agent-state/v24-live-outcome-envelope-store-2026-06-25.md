# Agent-State Arrowsmith v24: Live Outcome Envelope Store

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v23-outcome-envelope-replay-index-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ25 from v23.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ25: How should promoted outcome-envelope packets move from committed JSONL replay into a live substrate-owned store so Axis C dynamic local-lab EvalEvents and Postgres eval persistence can recover terminal outcomes without fixture-only coupling? | The live boundary should be a small packet store adjacent to eval persistence, keyed by the same stable `action_outcome_envelope` ref that EvalEvents cite. ARIES says recovery depends on stable log records, not volatile process memory. Buneman/Khanna/Tan provenance says derived observations need traceable where/process evidence. Chandy/Lamport snapshots require a recorded state that can be replayed independently of private participant views. Sagas show long-running workflow proof should preserve step finality and compensation/finality state. Therefore the store should persist the canonical promoted packet, verify its hash before admission, allow only idempotent same-hash ref writes, and let EvalEvents resolve refs back to terminal outcomes. | Added `evals.action_outcome_envelope_packets` root and package migrations. `PostgresEvalEventStore` now records hash-valid `ActionOutcomeEnvelope` packets, rejects invalid hashes before DB writes, rejects conflicting same-ref/different-hash packets, fetches packets by EvalEvent substrate ref, and resolves action-outcome refs for replay. | RQ26: How should Axis C dynamic local-lab and workflow runtime runs generate and persist promoted outcome-envelope packets before EvalEvents are emitted, so local-lab pass claims are backed by live packets rather than synthetic fixture ids? |

Active question set leaving this run: RQ12-RQ20, RQ26.

## Sources

- C. Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging," ACM TODS, 1992: https://dl.acm.org/doi/10.1145/128765.128770
- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Why and Where: A Characterization of Data Provenance," ICDT, 2001: https://dl.acm.org/doi/10.5555/645504.656274
- K. Mani Chandy and Leslie Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems," ACM TOCS, 1985: https://dl.acm.org/doi/10.1145/214451.214456
- Hector Garcia-Molina and Kenneth Salem, "Sagas," ACM SIGMOD, 1987: https://dl.acm.org/doi/10.1145/38713.38742

## Implementation Delta

1. Added `db/migrations/0020_eval_action_outcome_envelope_packets.sql`.
2. Added `packages/evals/migrations/002_action_outcome_envelope_packets.sql`.
3. `PostgresEvalEventStore.recordActionOutcomeEnvelope()` persists one row per `action_outcome_envelope` substrate ref in a canonical packet.
4. Packet writes are hash-gated with `verifyActionOutcomeEnvelopeHash()` before touching the database.
5. Packet writes are idempotent only when the existing stored `outcome_hash` matches the incoming packet hash.
6. `getActionOutcomeEnvelopeByRef()` and `resolveActionOutcomeRefs()` recover hash-valid terminal envelopes from EvalEvent refs.
7. `docs/state-validation/eval-event-schema.md` now documents the packet table and replay boundary.

## Falsification Criteria

This slice fails if:

1. A hash-invalid `ActionOutcomeEnvelope` can be persisted.
2. A second packet with the same `(tenant_id, envelope_ref_id)` and a different outcome hash can overwrite the first terminal packet.
3. An EvalEvent `action_outcome_envelope` ref cannot be resolved back to a stored packet by tenant/ref id.
4. A missing packet is reported as recovered.
5. The existence of the table is treated as Axis C verification before local-lab runtime actually writes promoted packets.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Improved indirectly. The same promoted packets used by ArrowHedge replay can now be persisted and recovered through the eval Postgres boundary. The existing ArrowHedge proof remains fixture-backed until a DB-backed run writes packets into the table. |
| Axis B marketing | Still blocked. PluggedInSocial is not restored/cloned and no accepted authoritative agency fixtures have been provided, so the whole solution remains unverified. |
| Axis C local lab | Improved boundary only. A live packet store now exists, but local-lab runtime still emits synthetic `action_outcome_envelope` ids and does not yet persist promoted packets before EvalEvents. |

## Next Action Queue

1. Answer RQ26 by defining the Axis C packet-generation boundary.
2. Make local-lab substrate arms build or receive canonical promoted outcome packets and persist them before recording EvalEvents.
3. Add replay checks that local-lab `action_outcome_envelope` refs resolve through `PostgresEvalEventStore`.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.
