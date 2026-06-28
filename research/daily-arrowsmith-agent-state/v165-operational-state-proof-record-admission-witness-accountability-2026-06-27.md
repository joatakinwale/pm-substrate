# v165 - Operational State Proof-Record Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ112

## Research Question

What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Schneider, Walsh, and Sirer, "Nexus Authorization Logic (NAL): Design Rationale and Applications", 2011: https://www.cs.cornell.edu/fbs/publications/NexusNalRationale.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Li, Krohn, Mazieres, and Shasha, "Secure Untrusted Data Repository (SUNDR)", OSDI 2004: https://www.usenix.org/legacy/event/osdi04/tech/full_papers/li_j/li_j.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness-abs/
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://eprint.iacr.org/2018/721

## Mechanism Extracted

Proof-carrying authentication makes the proof object explicit: because the authorization logic has no complete decision procedure, a requester must submit a machine-checkable proof with the request, and the server checks it. NAL adds that authorization is a guard decision over unforged credentials plus a derivation under policy, while also warning that local guard state limits distributed authorization. PeerReview supplies the accountability form: actions become inspectable through secure logs that can be replayed against a reference implementation and linked to the party that deviated. SUNDR supplies the fork-detection discipline for untrusted storage: a server cannot make conflicting state authoritative unless clients remain permanently forked. CoSi and transparency logs add the acceptance boundary: authoritative statements and log entries should be witnessed and append-only, so a compromised authority key or log server cannot privately rewrite what clients accept.

The substrate adaptation is a proof-record admission witness ledger. v155 already required quorum-certificate proof records to replay from latest proof-record admission rows before strict recovered currentness could consume them. SQ112 closes the next accountability gap: the proof-record admission row itself can support strict certified currentness only when a separate hash-linked witness history quorum-certifies the exact proof-record admission record hash under the expected authority boundary.

## Existing Substrate Map

- v145 added generic quorum-certificate proof records that recover certified currentness from hash-linked proof records, embedded certificates, accepted witness evidence, and optional seal linkage.
- v155 added `OperationalStateQuorumCertificateProofRecordAdmissionRecord` so strict proof replay consumes only latest admitted proof-record rows with a quorum certificate over the proof record hash.
- v159, v161, v162, v163, and v164 established the replay pattern that admission rows can still be self-authored authority objects unless a separate witness ledger certifies the exact admission row hash.
- Existing proof replay already rejects stale proof records, broken proof hashes, wrong certificate subjects, and invalid proof-record admission replay.

## Missing Substrate Map

- Before v165, a proof-record admission row could be hash-valid, latest, and certificate-bearing while still being the last self-authored authority object for recovered certified currentness.
- Existing proof-record admission replay proved currentness of the proof record, not independent accountability of the admission transition that allowed the proof record to enter operational state.
- The admission certificate inside the row certified the proof-record hash, but no separate ledger certified the admission row that claimed to carry that certificate.
- Existing policy/guard/checkpoint admission witness records did not cover generic quorum-certificate proof-record currentness because proof records are the reusable certificate layer below several domain and recovery surfaces.
- Still missing after v165: proof-record admission witness authority topology, witness signatures/key status, runtime proof-store adoption, proof-record admission witness compaction, and live Postgres recovery/privilege tests.

## Primitive Proposal

Name: operational state quorum-certificate proof-record admission witness record.

Problem it solves: prevents self-authored proof-record admission rows from authorizing recovered certified currentness.

Research source: proof-carrying authentication, NAL guards and credentials, PeerReview secure replay logs, SUNDR fork consistency, CoSi witness cosigning, and transparency-log append-only accountability.

Mechanism borrowed: a proof becomes acceptable only with an independently checkable proof object under a guard policy, and the admission of that proof becomes accountable only when a separate witness set has seen and certified the exact admission statement in an append-only history.

Why current substrate lacked it: v155 made proof records replay-current through proof-record admission rows, but left the admission record itself as the final certificate-bearing authority object.

Why existing primitives are insufficient: proof-record admission certifies the proof-record hash, but the admission row can still be self-authored unless a separate witness ledger certifies the exact admission record hash.

State guarantee it should create: strict quorum-certificate proof replay can authorize recovered certified currentness only when the latest proof-record admission replays and a separate witness ledger certifies the exact proof-record admission hash, proof ledger, proof sequence, admission sequence, and proof-record hash.

Admission rule it requires: witness records bind tenant, proof-admission witness store, proof-admission store, proof ledger id, authority scope, witness sequence, admission sequence, proof sequence, proof-record hash, admission-record hash, quorum certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid proof-record admission replay, tenant/store/ledger/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the quorum certificate subject must be `operational_state_quorum_certificate_proof_record_admission_record`, with subject id equal to `proofAdmissionStoreId:proofLedgerId:proofSequence`, subject sequence equal to the admission sequence, and subject hash equal to the proof-record admission record hash.

Failure modes it should prevent: self-authored certificate-bearing proof-record admission rows, stale admission rows, wrong-boundary connector-cache witnesses, under-quorum proof-admission witnesses, certificate subject substitution, witness-history forks, and recovered certified currentness from unwitnessed proof-record admission history.

Minimal implementation slice: add proof-record admission witness record types, deterministic witness hashing, witness replay, strict proof replay through `requireProofRecordAdmissionWitnessQuorum`, durable SQL witness table, and tests for accepted, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest proof-record admission fails; strict proof replay passes with proof-record admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over a different admission record hash passes; a wrong authority boundary passes; the stricter witness flag does not imply the base proof-record admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state proof replay after amnesia, Axis A finance recovery paths consuming generic proof records, and Axis B/domain adapters attempting to resume from local certificate summaries.

## Falsification Criteria

- A latest proof-record admission record with certified witness replay over the exact admission record hash must satisfy strict quorum-certificate proof replay.
- Strict proof-admission witness replay must block when proof-record admission replay exists but witness replay is missing.
- A certificate over the wrong proof-record admission record hash must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base proof-record admission gate even if the caller does not set `requireProofRecordAdmission`.

## Active 10-Question Backlog

1. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?
2. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
3. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
4. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
6. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current proof-record admission rows are enough to make recovered certified currentness accountable.
- Falsified: a quorum certificate embedded inside a proof-record admission row is sufficient authority for the row that carries it.
- Still open: witness records carry quorum certificates, but proof-record admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessRecord`, replay, proof replay result fields, and issue types.
- `buildOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecord()`, `computeOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecordHash()`, `operationalStateQuorumCertificateProofRecordAdmissionSubjectId()`, and `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords()`.
- Strict quorum-certificate proof replay through `requireProofRecordAdmissionWitnessQuorum`; the stricter flag implies the base proof-record admission replay gate.
- Migration `0082_agent_state_quorum_certificate_proof_record_admission_witness_records.sql` with append-only witness rows and public DML revocation for proof-record admission and witness records.
- Tests for valid witness-certified proof-record admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (160 passed)
- `pnpm typecheck` (workspace packages passed)
- `pnpm test` (564 passed, 143 skipped)
- `git diff --check`

Outcome: SQ112 is closed. SQ113 is now the active next substrate question, with SQ122 added as new proof-record admission witness authority pressure.
