# v155 - Operational State Quorum-Certificate Proof-Record Admissions

Date: 2026-06-27
Question closed: SQ102

## Research Question

What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?

## Sources

- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness", PODC 2019: https://dl.acm.org/doi/10.1145/3293611.3331591
- Nikitin et al., "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds", USENIX Security 2017: https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara

## Mechanism Extracted

HotStuff treats a quorum certificate as a carried proof object, not a remembered consensus result. CHAINIAC adds the stronger admission lesson: collectively verified decisions are stored in a tamper-evident, collectively signed timeline so later clients can validate release authority without trusting a mirror or rebuilding history. PeerReview makes accountability explicit by recording participant actions in secure logs that can later assign blame or prove compliance. CONIKS adds consistency-monitoring pressure: transparency works only when clients can check that the log view they consume is the current, consistent one for the authority namespace.

The substrate adaptation is a quorum-certificate proof-record admission record. A `OperationalStateQuorumCertificateProofRecord` can prove that its embedded certificate and witness evidence are internally consistent, but that does not prove the proof record was allowed to enter the operational proof ledger. Strict recovered currentness now requires a second replay lane: the exact proof-record hash must be the latest record admitted by a certified, authority-scoped proof-record admission history.

## Existing Substrate Map

- v145 added generic quorum-certificate proof certificates, witness evidence, optional authority epoch seals, proof records, proof-record hashing, and proof-record replay.
- v145 proof replay rejects tenant/scope mismatch, sequence gaps, previous-hash breaks, uncertified certificates, certificate hash drift, proof-record hash drift, duplicate/mismatched witness evidence, quorum shortfall, forged seals, missing required certificates, and stale required certificates.
- v153 and v154 added checkpoint-admission patterns for tombstone-history and witness-ledger compaction replay seeds.
- Migration `0062` already persisted append-only generic quorum-certificate proof records.

## Missing Substrate Map

- Before v155, a hash-valid proof record could still be supplied directly by a caller or adapter as a self-authored certificate summary.
- Proof-record replay could prove internal consistency of certificate material, but not durable authority admission of that proof record into the proof ledger.
- Recovery cuts could cite quorum-record lanes, but strict recovery had no way to require that the cited proof record was the latest admitted record for its proof ledger.
- Existing checkpoint admissions did not cover quorum proof records because they admit compacted replay seeds, not proof-record currentness objects.
- Still missing after v155: signer/key validation for proof-record admission certificates, runtime proof-store adoption, proof-record/admission compaction, live Postgres restart tests, and generic admission-certificate accountability.

## Primitive Proposal

Name: operational state quorum-certificate proof-record admission record.

Problem it solves: prevents self-authored quorum-certificate proof records from becoming recovered certified currentness merely because their embedded certificate summary is hash-valid.

Research source: HotStuff quorum-certificate proof objects, CHAINIAC collectively signed transparency timelines, PeerReview secure accountability logs, and CONIKS consistency-monitored transparency directories.

Mechanism borrowed: a proof object becomes operational only when an append-only authority timeline admits the exact proof hash and later replay confirms that admission as the latest consistent record.

Why current substrate lacked it: v145 defined durable proof records but did not define a separate admission timeline proving which proof records were allowed into the ledger.

Why existing primitives are insufficient: proof records validate the certificate body; checkpoint admissions validate replay seeds; neither proves that the proof record itself was admitted by proof-ledger authority.

State guarantee it should create: strict quorum-certificate proof replay can establish recovered certified currentness only when the latest certified proof record also replays as the latest admitted proof record for the tenant, proof ledger, proof-admission store, and authority scope.

Admission rule it requires: admission records bind tenant, proof-admission store, proof ledger, authority scope, admission sequence, proof sequence, proof-record hash, embedded proof record, certified admission certificate, previous admission hash, admitted-at/by metadata, and admission record hash.

Replay rule it requires: replay rejects tenant/scope/store/ledger mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded proof records, tampered admission certificates, non-certified admission certificates, insufficient admission quorum, wrong admission subject, wrong authority boundary, and stale proof records after later admission.

Authority boundary it requires: v155 requires a certified admission certificate over the proof ledger, proof sequence, and proof-record hash under an expected authority boundary, but signer/key accountability for that admission certificate remains SQ112.

Failure modes it should prevent: private certificate summaries, adapter-supplied proof records, stale proof records after supersession, same-sequence admission forks, wrong-ledger proof reuse, wrong-boundary admissions, insufficient admission quorums, and proof-record state outranking admitted history.

Minimal implementation slice: add proof-record admission record/replay types, deterministic admission hashing, strict `requireProofRecordAdmission` support in quorum-certificate proof replay, migration `0072`, and focused falsification tests.

Tests that would falsify it: a valid latest admitted proof record fails strict replay; strict replay accepts a proof record without admission replay; strict admission accepts a stale proof record after a later admission; wrong authority-boundary admission passes; tampered admission/proof-record hash passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery from proof-record history, Axis A finance proof-ledger recovery after pruned witness/topology histories, and Axis B/domain adapters attempting to supply certificate summaries without admitted proof-record history.

## Falsification Criteria

- A certified proof record with a valid latest proof-record admission replay must pass strict quorum-certificate proof replay.
- A certified proof record without admission replay must fail when `requireProofRecordAdmission` is true.
- A proof record that is not the latest admitted proof record must fail admission replay.
- An admission certificate for the wrong authority boundary must fail admission replay.
- A tampered admission record, embedded proof record, or admission certificate must fail replay.
- The SQL surface must persist append-only proof-record admission records separate from raw proof-record rows and revoke public DML on both surfaces.

## Active 10-Question Backlog

1. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
2. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
3. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
4. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
5. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
6. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
7. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
8. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
9. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
10. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a hash-valid quorum-certificate proof record is admissible recovered currentness.
- Falsified: certificate body consistency is enough to prove proof-ledger authority.
- Still open: v155 supplies replay-current proof-record admission with certified admission certificates, but signer/key validation for this generic certificate boundary, runtime adoption, live database tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateQuorumCertificateProofRecordAdmissionRecord`, replay, and issue types.
- `buildOperationalStateQuorumCertificateProofRecordAdmissionRecord()`, `computeOperationalStateQuorumCertificateProofRecordAdmissionRecordHash()`, and `replayOperationalStateQuorumCertificateProofRecordAdmissionRecords()`.
- `replayOperationalStateQuorumCertificateProofRecords({ requireProofRecordAdmission: true })` so certified proof records fail strict replay unless latest admitted.
- Migration `0072_agent_state_quorum_certificate_proof_record_admissions.sql` with append-only proof-record admission records and public DML revocation.
- Tests for valid admitted proof-record replay, missing admission replay refusal, stale proof-record refusal, wrong-boundary admission refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (135 passed)

Full workspace verification after ledger publication:

- `pnpm typecheck`
- `pnpm test` (539 passed, 143 skipped)
- `git diff --check`

Outcome: SQ102 is closed. SQ103 is now the active next substrate question, with SQ112 added as new proof-record admission authority pressure.
