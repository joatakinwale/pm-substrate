# v168 - Operational State Finalizer-Proof Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ115

## Research Question

What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain", PODC 2019: https://arxiv.org/abs/1803.05069
- Buchman, "Tendermint: Consensus without Mining", 2016: https://tendermint.com/static/docs/tendermint.pdf
- Kokoris-Kogias et al., "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing", USENIX Security 2016: https://bford.info/pub/dec/byzcoin.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness-abs/
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://eprint.iacr.org/2018/721

## Mechanism Extracted

PBFT makes checkpoints stable only after enough replicas agree on the same sequence and digest. HotStuff makes a leader proposal insufficient: replicas move through certified phases over exact values, and commit depends on quorum certificates, not private leader memory. Tendermint commit votes and ByzCoin collective signing show the same finality shape from another angle: a final state needs accountable signatures over the exact value being finalized. PeerReview, CoSi, and transparency logs add the missing accountability layer: the statement that a finality proof was admitted should itself be witnessed in an append-only history.

The substrate adaptation is an authority epoch seal finalizer-proof admission witness ledger. v158 already required a finalizer proof to be admitted as the latest proof for its seal id. SQ115 closes the next gap: the admission row that says "this finalizer proof constitutes seal finality" must itself be quorum-witnessed over the exact admission-record hash.

## Existing Substrate Map

- v148 added canonical authority epoch seal payloads and finalizer proofs over exact seal payload hashes.
- v158 added `OperationalStateAuthorityEpochSealFinalizerProofAdmissionRecord` and strict `evaluateOperationalStateAuthorityEpochSealFinalizer({ requireFinalizerProofAdmission: true })`.
- v167 established the adjacent verifier-proof admission witness pattern: an admission row remains self-authored until a separate witness ledger certifies the exact admission record hash.
- Existing finalizer evaluation already rejects missing proofs, tampered finalizer-proof hashes, seal-payload mismatch, stale finalizer keys, verifier authority smuggling, invalid nested verifier proofs, stale finalizer-proof admissions, wrong-boundary admission certificates, and tampered admission rows.

## Missing Substrate Map

- Before v168, a finalizer-proof admission row could be latest, hash-valid, and certificate-bearing while still being the final self-authored authority object for authority-epoch seal finality.
- The admission certificate inside that row certified the finalizer-proof hash, not the admission row that carried the certificate and claimed operational finality.
- Existing verifier-proof admission witnesses did not cover finalizer admission rows because finalizer rows bind seal ids, finalizer proof hashes, seal payloads, and terminal authority epoch semantics.
- Existing proof-record admission witnesses did not cover authority epoch seal finality because generic proof records certify currentness artifacts, not terminal seal-finality proof admissions.
- Still missing after v168: accountable authority for the new finalizer-proof admission witness records themselves, witness signer/key status, runtime seal-store adoption, witness-ledger compaction, live KMS/HSM finalizer adapters, and live Postgres privilege/restart tests.

## Primitive Proposal

Name: operational state authority epoch seal finalizer-proof admission witness record.

Problem it solves: prevents self-authored finalizer-proof admission rows from constituting authority epoch seal finality.

Research source: PBFT stable checkpoints, HotStuff quorum-certified commit phases, Tendermint commit votes, ByzCoin collective signing, PeerReview signed accountability logs, CoSi witness cosigning, and transparency-log append-only accountability.

Mechanism borrowed: finality requires an accountable certificate over an exact value, and the admission of that certificate must itself be recoverable from an append-only witnessed history.

Why current substrate lacked it: v158 made finalizer proofs replay-current through proof-admission rows, but left the admission row itself as the final certificate-bearing authority object.

Why existing primitives are insufficient: verifier-proof admission witnesses bind verifier proof ids; finalizer-proof admission witnesses must bind finalizer-proof admission store, seal id, finalizer proof hash, admission sequence, and admission record hash.

State guarantee it should create: strict authority epoch seal finality can accept an admitted finalizer proof only when the corresponding latest finalizer-proof admission row is witnessed by a separate quorum under the expected authority boundary.

Admission rule it requires: witness records bind tenant, finalizer-proof admission witness store, finalizer-proof admission store, authority scope, witness sequence, admission sequence, seal id, finalizer proof hash, admission record hash, witness certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid proof-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the witness certificate subject kind is `operational_state_authority_epoch_seal_finalizer_proof_admission_record`; subject id is `finalizerProofAdmissionStoreId:sealId`; subject sequence is the admission sequence; subject hash is the finalizer-proof admission record hash.

Failure modes it should prevent: self-authored finalizer-proof admission rows, stale admitted finalizer proofs after supersession, wrong-boundary finalizer proof witnesses, under-quorum admission witnesses, certificate subject substitution, witness-history forks, and operational seal finality from unwitnessed proof-admission history.

Minimal implementation slice: add finalizer-proof admission witness record types, deterministic witness hashing, witness replay, strict finalizer evaluation through `requireFinalizerProofAdmissionWitnessQuorum`, durable SQL witness table, and focused tests for valid, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest finalizer-proof admission fails; strict finalizer evaluation passes with proof-admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over the wrong admission subject passes; a wrong authority boundary passes; the stricter witness flag does not imply the base finalizer-proof admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state recovery across sealed authority epochs, Axis A finance finality claims for signed certificates, and Axis B/domain adapters attempting to treat unsigned connector rows or locally admitted rows as terminal finality.

## Falsification Criteria

- A latest finalizer-proof admission record with certified witness replay over the exact admission record hash must satisfy strict finalizer evaluation.
- Strict finalizer-proof admission witness replay must block when finalizer-proof admission replay exists but witness replay is missing.
- A certificate over a wrong finalizer-proof admission subject must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base finalizer-proof admission gate even if the caller does not set `requireFinalizerProofAdmission`.

## Active 10-Question Backlog

1. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
3. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current authority epoch seal finalizer-proof admission rows are enough to make seal finality accountable.
- Falsified: a certificate over the finalizer proof also accounts for the admission row that carries it.
- Still open: witness records carry quorum certificates, but finalizer-proof admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecord`, replay, evaluation result fields, and issue types.
- `buildOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecord()`, `computeOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecordHash()`, `operationalStateAuthorityEpochSealFinalizerProofAdmissionSubjectId()`, and `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords()`.
- Strict seal-finality evaluation through `requireFinalizerProofAdmissionWitnessQuorum`; the stricter flag implies the base finalizer-proof admission replay gate.
- Migration `0085_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_records.sql` with append-only witness rows and public DML revocation for finalizer-proof admission and witness records.
- Tests for valid witness-certified finalizer-proof admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (166 passed)

Outcome: SQ115 is closed. SQ116 is now the active next substrate question, with SQ125 added as new finalizer-proof admission witness authority pressure.
