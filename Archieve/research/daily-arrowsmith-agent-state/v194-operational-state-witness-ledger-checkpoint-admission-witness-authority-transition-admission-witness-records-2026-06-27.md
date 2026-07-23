# v194 Operational State Witness-Ledger Checkpoint Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ141
Research lane: substrate discovery, compacted witness recovery, checkpoint authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v144 adds witness-ledger compaction checkpoints so compacted witness recovery can seed replay from a hash-bound ledger head plus retained suffix.
- v154 adds witness-ledger checkpoint admission records so strict compacted witness recovery must consume the latest admitted checkpoint seed.
- v164 adds witness-ledger checkpoint admission witness records so the latest checkpoint-admission row must be separately quorum-certified by a witness ledger.
- v174 adds checkpoint-admission witness authority topology so witness certificates bind to replayed active principals and quorum thresholds.
- v184 adds checkpoint-admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- Migration `0101` persists admitted witness-ledger checkpoint admission witness authority-transition rows.

## Missing Substrate Map

The witness-ledger lane can recover a compacted witness ledger from an admitted checkpoint and retained suffix, but v184 left the witness-authority transition-admission row as its own accountability boundary. A strict compaction replay could require checkpoint-admission witness authority topology to come from admitted transition history while still accepting transition-admission rows supplied as local certificate-bearing records.

That is insufficient for amnesiac recovery. A witness-ledger checkpoint can decide what witness observations survive pruning; therefore the authority that admits checkpoint witnesses must itself be replay-accountable. The missing substrate primitive is a separate append-only witness ledger over the exact witness-ledger checkpoint admission witness authority-transition admission record hash.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become operational failures when private logs, compacted snapshots, or local authority rows can be accepted after resume without public replay accountability.

B bridge: witness cosigning, key-transparency logs, append-only authenticated dictionaries, and accountable secure logs make private assertions operational only when independent parties can verify the exact logged subject and detect equivocation.

C literature:

- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning" (IEEE S&P 2016), https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users" (USENIX Security 2015), https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

Mechanism extracted: a local authority row is not enough when it can affect compacted recovery. The row must become the exact subject of a separate append-only witnessed log so replay can detect absence, wrong subject hashes, forks, and invalid witness certificates.

## Primitive Proposal

Name: operational state witness-ledger checkpoint admission witness authority-transition admission witness records.

Problem it solves: witness-ledger checkpoint admission witness authority-transition admission rows could be accepted from local state if their embedded certificates were structurally valid.

Research source: CoSi witness cosigning, CONIKS key transparency, append-only authenticated transparency logs, and PeerReview accountable logs.

Mechanism borrowed or adapted: independent witness accountability over exact logged subjects. The substrate adaptation is a hash-linked witness ledger over witness-ledger checkpoint admission witness authority-transition admission record hashes.

Why current substrate lacks it: v184 admitted checkpoint-admission witness authority topology transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: checkpoint admission, checkpoint admission witness records, witness topology, and transition-admission replay prove progressively stronger recovery authority, but none separately witness the exact transition-admission row hash.

State guarantee it should create: strict witness-ledger compaction cannot treat a checkpoint-admission witness authority-transition admission row as compacted witness-recovery authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_witness_ledger_compaction_checkpoint_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A local row presents certificate-shaped checkpoint-admission witness authority transitions as current compacted witness-recovery authority.
- A connector cache supplies a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different checkpoint witness-authority transition-admission hash.
- Strict witness-ledger compaction consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Compacted witness recovery proceeds when checkpoint witness authority is certificate-local rather than admitted and witnessed.

Minimal implementation slice:

- Add `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend witness-ledger checkpoint-admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend checkpoint admission witness replay and witness-ledger compaction evaluation with transition-admission witness strictness.
- Add migration `0111_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A checkpoint-admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A checkpoint admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A witness-ledger compaction evaluation with `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A compacted witness recovery evaluation that passes when strict witness-ledger checkpoint witness-authority transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on witness-ledger checkpoint-admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on checkpoint admission witness replay
- `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness` on witness-ledger compaction evaluation
- Migration `0111_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed witness-ledger checkpoint witness-authority transition admission before finance pruning accepts compacted witness-ledger recovery.
- Axis B can use the same strict compaction path for future marketing/domain-adapter witness ledgers.
- Axis C can simulate an amnesiac local agent attempting compacted witness recovery from cached checkpoint witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a witness-ledger checkpoint admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize compacted witness recovery. It cannot; the row must be separately witnessed.
- Failed assumption: witness-ledger compaction makes authority accountability less urgent because the compacted object is itself a witness ledger. It makes accountability more urgent: the authority that admits checkpoint witnesses can decide which witness observations survive pruning.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "witness-ledger checkpoint admission witness authority-transition admissions to be witnessed"`: 1 passed, 211 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 616 passed, 143 skipped
