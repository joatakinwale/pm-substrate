# v214 Operational State Witness-Ledger Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ161
Research lane: substrate discovery, compacted witness recovery authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v144 adds witness-ledger compaction checkpoints so compacted witness-ledger recovery can recover the latest accepted admissible head from a checkpoint plus retained suffix.
- v154 adds checkpoint admission records so self-authored witness-ledger checkpoint seeds cannot authorize compacted recovery.
- v164 adds checkpoint admission witness records so checkpoint admissions require witness quorum accountability.
- v174 adds checkpoint admission witness authority topology so checkpoint-admission witness certificates bind to replayed principals and thresholds.
- v184 adds checkpoint admission witness authority-transition admission so checkpoint-admission witness topology rows replay from admitted authority-transition history.
- v194 adds checkpoint admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v204 adds witness-ledger transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0121` persists witness-ledger transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict witness-ledger compaction could require checkpoint admission witness authority-transition admissions to be witnessed, and could require those transition-admission witness certificates to bind to a replayed nested witness topology. But the nested topology could still be supplied directly as a topology object. That left a self-authorship path: an amnesiac agent, connector cache, or local snapshot could present a valid-looking nested topology for the witnesses that certified checkpoint-admission witness authority-transition admissions, without proving that the topology was itself admitted transition history.

The missing substrate primitive is witness-ledger transition-admission witness authority-transition admission: the topology that authorizes witness-ledger checkpoint admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before a compacted witness-ledger checkpoint can recover operational currentness.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become compacted witness-recovery failures when agents resume from remembered witness topology, especially after witness-ledger pruning has hidden the long-form observation history behind a checkpoint.

B bridge: accountable distributed systems do not trust a node's local story; PeerReview records signed histories and replays them against a reference behavior. Witness cosigning does not let an authority's statement stand alone; clients accept it only after independent witnesses have seen and logged it. Byzantine quorum systems make the witness set and its intersection assumptions part of the state guarantee, not private configuration.

C literature:

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007, https://dl.acm.org/doi/10.1145/1323293.1294279 and https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016, https://ieeexplore.ieee.org/document/7546521/ and https://arxiv.org/pdf/1503.08768
- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing, https://dl.acm.org/doi/abs/10.1007/s004460050050 and https://www.cs.umass.edu/~arun/cs691ee/reading/BQS97.pdf
- Alpos, Cachin, and Zanolini, "How to Trust Strangers: Composition of Byzantine Quorum Systems", DISC 2021, https://drops.dagstuhl.de/storage/00lipics/lipics-vol209-disc2021/LIPIcs.DISC.2021.44/LIPIcs.DISC.2021.44.pdf

Mechanism extracted: accountability requires replayable logs of the authority basis, not only a certificate over the immediate statement. Witness-ledger recovery needs recursive witness-authority accountability: a nested witness topology cannot authorize transition-admission witness certificates unless it is itself the current projection of admitted authority-transition history.

## Primitive Proposal

Name: witness-ledger transition-admission witness authority-transition admission.

Problem it solves: witness-ledger checkpoint admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: PeerReview accountable logs, CoSi witness cosigning, Byzantine quorum systems, and quorum-system composition.

Mechanism borrowed or adapted: strict compacted witness-ledger recovery accepts a nested transition-admission witness topology only if admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v204 made nested witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: witness-ledger checkpoints, checkpoint admissions, checkpoint-admission witness records, checkpoint-admission witness authority topology, admitted checkpoint-admission witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict witness-ledger compaction cannot accept compacted witness recovery unless the nested transition-admission witness topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; witness-ledger checkpoint witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; checkpoint admission witness replay and witness-ledger compaction evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Witness-ledger compaction evaluation re-inspects nested replay data so a forged valid-looking witness replay cannot hide missing nested history.

Authority boundary it requires: nested witness-ledger transition-admission witness authority-transition admissions use `operational_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes witness-ledger checkpoint transition-admission witness certificates.
- An amnesiac agent resumes compacted witness-ledger recovery from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking checkpoint-admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash before compacted witness recovery.

Minimal implementation slice:

- Add nested authority-transition admission replay support to witness-ledger transition-admission witness replay.
- Add strict nested replay checks to witness-ledger checkpoint witness-authority transition-admission replay.
- Carry strict nested history requirements through checkpoint admission witness replay and witness-ledger compaction evaluation.
- Add missing/invalid/mismatch issue codes for witness-ledger transition-admission witness authority-transition admission.
- Add migration `0131_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, checkpoint witness replay refusal, and forged valid-looking compaction refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateWitnessLedgerCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Compacted witness-ledger recovery is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateWitnessLedgerCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched witness-ledger transition-admission witness authority-transition admission replay.
- Migration `0131_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance witness-ledger compaction to prove nested transition-admission witness authority through admitted topology-transition history before accepting recovered witness currentness.
- Axis B can require the same nested admitted topology history before domain adapters accept compacted witness-ledger recovery.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached witness-ledger checkpoint nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
6. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
7. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
8. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
9. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
10. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?

## Failed Assumption Ledger

- Failed assumption: topology-bound witness-ledger transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking witness-ledger checkpoint witness replay can be trusted once its top-level `valid` field is true. It cannot; witness-ledger compaction evaluation must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "witness-ledger checkpoint admission witness authority-transition admission witness certificates"`: 2 passed, 226 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "witness-ledger checkpoint admission witness authority-transition admission"`: 4 passed, 224 skipped
- `pnpm typecheck`
- `pnpm test`: 632 passed, 143 skipped
- `git diff --check`
