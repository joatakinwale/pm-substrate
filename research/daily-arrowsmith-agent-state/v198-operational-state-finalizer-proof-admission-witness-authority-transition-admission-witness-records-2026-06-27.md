# v198 Operational State Finalizer-Proof Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ145
Research lane: substrate discovery, authority epoch seal finality, finalizer-proof admission witness authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v148 adds authority epoch seal finalizer proofs so seal finality is attributable to replay-current finalizer principals.
- v158 adds finalizer-proof admission records so strict seal finality requires the finalizer proof itself to replay as admitted.
- v168 adds finalizer-proof admission witness records so the latest finalizer-proof admission row must be separately quorum-certified by a witness ledger.
- v178 adds finalizer-proof admission witness authority topology so admission-witness certificates bind to replayed active principals and quorum thresholds.
- v188 adds finalizer-proof admission witness authority-transition admission records so admission-witness topology can replay from admitted authority-transition history.
- Migration `0105` persists admitted finalizer-proof admission witness authority-transition rows.

## Missing Substrate Map

Strict seal finality can require finalizer proof admission, proof-admission witnesses, witness authority topology, and admitted witness-authority transition history. But v188 left the witness-authority transition-admission row as the next local authority object: it carried a certificate, but no separate replayed ledger over the exact transition-admission record hash.

That is insufficient for amnesiac recovery. Seal finality is the place where the substrate says a historical authority basis is fixed. It cannot depend on certificate-shaped rows supplied by a local snapshot, connector cache, worktree, or resume summary. The missing substrate primitive is a separate append-only witness ledger over exact authority epoch seal finalizer-proof admission witness authority-transition admission record hashes.

## Arrowsmith Bridge

A literature: agent-state continuity breaks become operational-state failures when a resumed agent treats cached finality or topology-admission rows as fixed authority.

B bridge: accountable BFT and threshold-signature systems make quorum/finality claims auditable by tying the exact operation to a witnessed certificate or log entry. PeerReview adds the accountability principle: if a node claims authority, the evidence trail must make incorrect or missing history detectable by replay.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999), https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin et al., "HotStuff: BFT Consensus with Linearity and Responsiveness" (PODC 2019), https://dl.acm.org/doi/pdf/10.1145/3293611.3331591
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Kokoris-Kogias et al., "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing" (USENIX Security 2016), https://bford.info/pub/dec/byzcoin.pdf
- Chalkias et al., "Accountable Threshold Signatures" (IACR ePrint 2022), https://eprint.iacr.org/2022/1636

Mechanism extracted: finality cannot rely on a local certificate-bearing admission row. The exact transition-admission row that changes the finalizer-proof admission witness authority basis must itself become the subject of a separately replayed witnessed log, so replay can detect missing witnesses, wrong subject hashes, store confusion, forks, and invalid certificates before seal finality is accepted.

## Primitive Proposal

Name: operational state finalizer-proof admission witness authority-transition admission witness records.

Problem it solves: authority epoch seal finalizer-proof admission witness authority-transition admission rows could authorize seal finality from local certificate-bearing rows.

Research source: PBFT/HotStuff finality, ByzCoin collective signing, PeerReview accountable logs, and accountable threshold signatures.

Mechanism borrowed or adapted: quorum-finalized operations remain accountable only when the exact operation is committed as an auditable subject. The substrate adaptation is a hash-linked witness ledger over finalizer-proof admission witness authority-transition admission record hashes.

Why current substrate lacks it: v188 admitted finalizer-proof admission witness authority transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: finalizer proofs, finalizer-proof admission, proof-admission witnesses, witness authority topology, and witness-authority transition admission each narrow the seal-finality boundary, but none independently witnesses the exact transition-admission record hash.

State guarantee it should create: strict seal finality cannot consume a finalizer-proof admission witness authority-transition admission row unless that exact row hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission row to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A connector cache supplies finalizer-proof admission witness authority transition-admission rows without a separate witnessed record hash.
- A forged parent replay claims `valid: true` while omitting the nested transition-admission witness layer.
- A witness certificate signs a different transition-admission record hash.
- Strict seal finality accepts authority from certificate-local finalizer-proof admission witness authority transition-admission rows.

Minimal implementation slice:

- Add `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend finalizer-proof admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend finalizer-proof admission witness replay and finalizer evaluation with transition-admission witness strictness.
- Add migration `0115_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_records.sql`.
- Add focused falsification tests for valid witnessed rows, missing witness replay, forged parent replay, wrong certificate subject hash, and invalid nested witness replay.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A finalizer-proof admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A finalizer-proof admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A finalizer evaluation with `requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` finalizer-proof admission witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. Strict seal finality that passes when finalizer-proof admission witness authority transition-admission rows are not separately witnessed.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on finalizer-proof admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on finalizer-proof admission witness replay
- `requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitness` on authority epoch seal finalizer evaluation
- Migration `0115_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed finalizer-proof admission witness authority-transition admission before finance-domain finality can count as operational state.
- Axis B can require the same strict finalizer path for future marketing/domain-adapter settlement or publication finality.
- Axis C can simulate an amnesiac local agent attempting to resume from cached finalizer-proof admission witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a finalizer-proof admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize strict seal finality. It cannot; the row must be separately witnessed.
- Failed assumption: seal finality makes admission accountability less urgent. It makes admission accountability more urgent because a stale or forged witness-authority transition admission would fix the wrong authority basis as operational state.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admissions to be witnessed"`: 1 passed, 215 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 620 passed, 143 skipped
