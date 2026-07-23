# v159 - Operational State Recovery Cut Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ106

## Research Question

What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?

## Sources

- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Li et al., "SUNDR: Secure Untrusted Data Repository", OSDI 2004: https://www.usenix.org/legacy/events/osdi04/tech/full_papers/li_j/li_j.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf

## Mechanism Extracted

PeerReview supplies the accountability rule: a participant's behavior must be judged from verifiable, signed evidence, not from its private claim about what happened. SUNDR supplies fork-consistency pressure: untrusted storage can be useful only when a server cannot present incompatible histories without creating detectable evidence. CoSi supplies witness cosigning: a critical authority statement becomes acceptable only when enough accountable witnesses cosign the exact payload. CONIKS supplies the transparency-currentness bridge: clients should audit committed state through monitorable, consistency-checkable observations rather than trusting a provider-local state view.

The substrate adaptation is a recovery-cut admission witness record. v149 made a recovery cut replay from a durable admission row, but the row could still be authored by the recovering agent or a connector-local store. v159 adds a separate hash-linked witness ledger over the exact recovery-cut admission record hash. Strict recovered-state review can now require both: the admission chain must admit the cut, and the witness chain must quorum-certify the latest admission record under the expected authority boundary.

## Existing Substrate Map

- `OperationalStateRecoveryCut` inventories required replay lanes and refuses private/cached lanes as recovered operational state.
- `OperationalStateRecoveryCutAdmissionRecord` binds a cut hash and current-state view identity hash into a replayable admission chain.
- `OperationalStateHistoryRootObserverSignatureProof`, proof-record admissions, checkpoint admissions, verifier-proof admissions, and finalizer-proof admissions already show that critical state claims need replayed signatures or quorum certificates.
- `OperationalStateQuorumCertificateProofCertificate` already provides a reusable certificate envelope with subject kind, subject id, subject sequence, subject hash, authority boundary, quorum threshold, and accepted witnesses.

## Missing Substrate Map

- Before v159, a recovery-cut admission record could be hash-valid, latest in its local chain, and bound to the current view while still being self-authored by the agent/process/store that wanted recovered authority.
- v149 admitted the recovery cut object but did not make the admission row accountable to independent observers.
- Existing root transparency witnesses store roots, not the exact recovery-cut admission row that binds a cut to a current-state view.
- Existing quorum-certified proof admissions certify proof/checkpoint payloads, but recovery-cut admission rows had no equivalent witness ledger over their record hash.
- Still missing after v159: the authority topology that admits recovery-cut admission witnesses, durable live store adoption, recovery-cut admission witness compaction, cross-agent gossip of witness-store heads, and runtime policy that turns strict witness requirements on by default.

## Primitive Proposal

Name: operational state recovery cut admission witness accountability.

Problem it solves: prevents a self-authored recovery-cut admission row from becoming recovered operational authority merely because the row is hash-valid and latest in a local admission chain.

Research source: PeerReview accountability logs, SUNDR fork consistency, CoSi witness cosigning, and CONIKS transparency monitoring.

Mechanism borrowed: the exact admission record hash must be witnessed by an independent quorum in a separate replayable ledger before strict recovered state can authorize action.

Why current substrate lacked it: v149 added durable recovery-cut admission records, but left the admission row's authority inside the same recovery path it was supposed to authorize.

Why existing primitives are insufficient: recovery-cut hash checks prove object integrity, admission replay proves ordered local admission, and transparency roots prove store-head observations; none proves independent accountability over the admission row itself.

State guarantee it should create: strict recovered operational state can authorize action only when the latest recovery-cut admission record is both replay-current and witnessed by a certified quorum over its exact admission record hash.

Admission rule it requires: witness records must bind tenant, recovery-cut admission witness store, recovery-cut store, authority scope, witness sequence, admission sequence, admission record hash, recovery cut hash, current-state view identity hash, previous witness hash, witness metadata, and a quorum certificate whose subject is the exact admission record hash.

Replay rule it requires: replay must check witness-store sequence continuity, previous-hash links, same-sequence forks, witness record hashes, certificate hashes, certified status, quorum threshold, certificate subject kind/id/sequence/hash, required authority boundary, and required latest admission record match.

Authority boundary it requires: the witness certificate must be issued under a recovery-cut admission witness authority boundary, not a connector cache, local agent, or generic recovery store boundary.

Failure modes it should prevent: self-authored admission rows, stale admission witnesses over old cuts/views, wrong-boundary certificates, insufficient witness quorums, tampered witness records, witness forks, and agents resuming from local recovery-store authority alone.

Minimal implementation slice: add recovery-cut admission witness record types, deterministic hashes, replay/evaluation functions, strict action-review enforcement, append-only migration, and tests for valid witnessed recovery, missing witness replay, stale witness, wrong boundary, and tampered witness rows.

Tests that would falsify it: strict recovered state passes with no witness replay; a witness over a different admission record authorizes the current cut; a wrong-boundary certificate is accepted; a tampered witness row remains valid; a non-certified or under-threshold certificate admits the row; a valid witnessed latest admission is rejected.

Axis surfaces that could later validate it: Axis C amnesiac resume from durable recovery stores, Axis A finance recovery after pruned histories, and Axis B/domain adapters attempting to use connector-local recovery snapshots or admission rows as operational state.

## Falsification Criteria

- A latest recovery-cut admission record with a certified witness record over its exact admission record hash must pass strict recovery-cut admission evaluation.
- Missing witness replay under `requireRecoveryCutAdmissionWitnessQuorum` must block action review with `operational_state_recovery_cut_admission_witness_replay_missing`.
- A wrong-boundary witness certificate must produce `operational_state_recovery_cut_admission_witness_certificate_authority_boundary_mismatch`.
- A witness replay over a stale admission record must produce `operational_state_recovery_cut_admission_latest_record_not_witnessed`.
- A tampered witness record must produce `operational_state_recovery_cut_admission_witness_record_hash_mismatch`.
- A certificate whose subject hash does not match the witness record's admission record hash must produce `operational_state_recovery_cut_admission_witness_certificate_subject_mismatch`.

## Active 10-Question Backlog

1. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
2. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
3. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
4. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
5. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
6. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
7. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored certificate-bearing rows?
8. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
9. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored certificate-bearing rows?
10. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: durable recovery-cut admission rows are enough to make recovered state accountable.
- Falsified: hash-linking a recovery-cut admission chain prevents the admission store itself from becoming a private authority.
- Still open: v159 supplies a witness-accountability primitive, replay/evaluation rule, action-review gate, and durable table shape, but the witness authority topology, live witness-store adoption, witness-store head transparency, and witness-ledger compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateRecoveryCutAdmissionWitnessRecord`, deterministic witness hashing, verification helpers, and `replayOperationalStateRecoveryCutAdmissionWitnessRecords()`.
- `evaluateOperationalStateRecoveryCutAdmission({ requireAdmissionWitnessQuorum: true })` and blocking action-review option `requireRecoveryCutAdmissionWitnessQuorum`.
- Migration `0076_agent_state_recovery_cut_admission_witness_records.sql` with append-only durable witness rows and public DML revocation for recovery-cut admission witness/admission rows.
- Tests for valid witness-certified recovered state, missing witness replay refusal, wrong-boundary witness refusal, stale witness refusal, and tampered witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (147 passed)
- `pnpm typecheck`
- `pnpm test` (551 passed, 143 skipped)
- `git diff --check`

Outcome: SQ106 is closed. SQ107 is now the active next substrate question.
