# v145 - Operational State Quorum-Certificate Proof Records

Date: 2026-06-27
Question closed: SQ92

## Research Question

What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?

## Sources

- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness", PODC 2019: https://arxiv.org/pdf/1803.05069
- Nikitin et al., "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds", USENIX Security 2017: https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin
- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf

## Mechanism Extracted

HotStuff makes a quorum certificate a proof object: a leader does not merely remember that enough replicas voted; it carries a certificate over a specific proposal/view, with enough votes to drive later safe progress. CHAINIAC adds the transparency-log pressure: collectively signed decisions must be stored in a tamper-evident history so out-of-date clients can validate old releases, signing keys, and freshness without rebuilding or trusting a mirror. PBFT adds the recovery discipline: authenticated proof material and checkpoint/view-change records are what recovering replicas consume, not private state summaries.

The substrate adaptation is a generic operational-state quorum-certificate proof-record lane. A certified v135 currentness result is not operational state merely because it can be recomputed from live witness stores or remembered by an agent. It becomes recoverable currentness only when admitted as a hash-linked proof record containing the certified subject, certificate hash, accepted witness ids, replayable witness evidence, optional authority-epoch seal, previous proof-record hash, and record hash.

## Existing Substrate Map

- v135 evaluates quorum certificates for v133 pruning tombstone-store head currentness.
- v136-v138 add durable topology recovery, key-status replay, and non-retroactive authority epoch seals around that certification basis.
- Earlier target layers already had layer-specific quorum-certificate proof-record histories, but SQ92 remained open for the current v135/v133 frontier.
- v139-v144 add generic recovery cuts, store-root transparency, pruning-policy compilation, storage mutation guards, tombstone-history compaction, and witness-ledger compaction.

## Missing Substrate Map

- Before v145, the generic operational-state layer did not define a durable proof-record object for a certified quorum result.
- The v135 certificate could be evaluated or recertified, but the certified result itself could still be transient unless a layer-specific record lane was present.
- Existing witness-ledger compaction preserves accepted-head witness state, but not the separate fact that a quorum certificate over that head was admitted.
- Existing recovery cuts can cite quorum-record lanes, but they lacked a generic record shape saying what must be replayed before a quorum certificate is currentness.
- Still missing after v145: authority admission for proof-record rows, automatic adoption by runtime/layer-specific stores, proof-record compaction, and live Postgres restart tests for v135 proof recovery.

## Primitive Proposal

Name: operational state quorum-certificate proof records.

Problem it solves: preserves certified currentness as admitted history, so an amnesiac agent recovers the certified object from proof records instead of rerunning certification against mutable stores or trusting memory.

Research source: HotStuff quorum certificates, CHAINIAC collectively signed transparency logs, and PBFT authenticated recovery proof material.

Mechanism borrowed: record the quorum decision as a hash-linked proof object containing the certified value, accepted witness evidence, and finality linkage needed by later replay.

Why current substrate lacked it: the current frontier had generic recovery and compaction primitives, but no generic durable object for quorum-certificate currentness itself.

Why existing primitives are insufficient: witness ledgers preserve observations, authority histories preserve topology, and seals preserve finality, but none of those is the admitted certificate record that later recovery can cite directly.

State guarantee it should create: a quorum certificate can support recovered operational currentness only when replay finds a certified proof record whose hash-valid certificate, accepted witness evidence, optional seal, and previous-record chain reproduce the required certificate.

Admission rule it requires: proof records must bind tenant, proof ledger, authority scope, sequence, certified certificate, accepted witness evidence, optional authority seal, previous proof-record hash, recorder, timestamp, and proof-record hash.

Replay rule it requires: records must be tenant/scope matched, sequence-contiguous, hash-linked, certified-only, certificate-hash valid, record-hash valid, witness-evidence complete and non-duplicated, quorum-satisfying, seal-consistent, and able to reconstruct the exact required latest certificate.

Authority boundary it requires: `operational-state-quorum-certificate-proof-record.v1` records are append-only durable records; a later SQ102 admission rule must prevent arbitrary self-authored certificate summaries from entering the lane.

Failure modes it should prevent: private memory claiming a certified head, transient recertification under later mutable topology, uncertified/provisional results masquerading as currentness, stripped witness evidence, duplicate witness evidence, forged authority seals, broken proof-record chains, and stale required certificates.

Minimal implementation slice: add generic certificate/evidence/seal/record types, deterministic hashes, replay evaluator, append-only migration, and SQ92-shaped tests for v135/v133 currentness recovery.

Tests that would falsify it: uncertified records pass; tampered evidence passes; forged seals pass; broken sequence/previous-hash chain passes; stale required certificate passes; valid certified proof record cannot recover the required certificate.

Axis surfaces that could later validate it: Axis C amnesiac recovery from v135 proof-record history, Axis A finance recovery paths that cite proof records instead of adapter certificates, and Axis B adapter attempts to supply certificate summaries without admitted records.

## Falsification Criteria

- A certified v135-shaped proof record with matching witness evidence and seal must replay as the latest certified record for the required certificate.
- An uncertified/provisional certificate must produce `operational_state_quorum_certificate_proof_record_certificate_not_certified`.
- Accepted witness evidence that does not match certificate accepted witness ids must produce `operational_state_quorum_certificate_proof_record_witness_evidence_mismatch`.
- A seal whose certificate hash does not match the proof certificate must produce `operational_state_quorum_certificate_proof_record_authority_seal_mismatch`.
- A sequence gap or previous-hash mismatch must produce `operational_state_quorum_certificate_proof_record_sequence_gap` and `operational_state_quorum_certificate_proof_record_previous_hash_mismatch`.
- A stale required certificate must produce `operational_state_quorum_certificate_proof_record_required_certificate_sequence_mismatch` and `operational_state_quorum_certificate_proof_record_required_certificate_hash_mismatch`.

## Active 10-Question Backlog

1. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
2. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
3. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
4. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
5. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
6. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
7. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
8. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
9. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
10. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?

## Failed Assumption Ledger

- Falsified: recertifying from current witness/authority stores is equivalent to recovering certification history.
- Falsified: witness-ledger currentness is enough to prove quorum-certified currentness. The quorum certificate is a distinct admitted proof object.
- Still open: v145 supplies generic proof-record replay and append-only storage, but proof-record authority admission, runtime adoption, compaction, and live Postgres recovery remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateQuorumCertificateProofCertificate`, evidence, authority seal, record, replay, and issue types.
- `buildOperationalStateQuorumCertificateProofCertificate()`, `buildOperationalStateQuorumCertificateProofRecord()`, deterministic certificate/record hashing, and replay verification helpers.
- `replayOperationalStateQuorumCertificateProofRecords()` for certified-only replay, tenant/scope matching, sequence continuity, previous-hash continuity, certificate hash validity, record hash validity, witness-evidence exactness, quorum count, seal consistency, and required-certificate recovery.
- Migration `0062_agent_state_quorum_certificate_proof_records.sql` with append-only durable proof-record rows.
- Tests for valid v135-shaped proof-record recovery, uncertified certificate refusal, witness-evidence mismatch, forged-seal mismatch, broken-chain refusal, and stale required-certificate refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ92 is closed. SQ93 is now the active next substrate question.
