# v167 - Operational State Signature-Verifier Proof Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ114

## Research Question

What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Torres-Arias et al., "in-toto: Providing farm-to-table guarantees for bits and bytes", USENIX Security 2019: https://www.usenix.org/system/files/sec19-torres-arias.pdf
- Samuel et al., "Survivable Key Compromise in Software Update Systems", ACM CCS 2010: https://freehaven.net/~arma/tuf-ccs2010.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness-abs/
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://eprint.iacr.org/2018/721

## Mechanism Extracted

Proof-carrying authentication makes a requester submit a proof object because proof search can be undecidable while proof checking remains small enough to trust. in-toto turns individual tool or step outputs into signed metadata that can be checked against a declared layout; a forged "check happened" claim is a supply-chain attack, not proof. TUF separates roles, thresholds, revocation, and automated keys because one signing/verifying key should not be enough to define update authority. PeerReview turns participant behavior into a signed, replayable log so faults can be attributed rather than believed or summarized. CoSi and transparency logs add the final boundary: an authoritative statement should be witnessed and append-only before clients accept it.

The substrate adaptation is a proof-admission witness ledger for signature-verifier adapter proofs. v157 already prevented verifier adapters from smuggling currentness by making verifier proofs constrained evidence. v157 also made strict signature state require latest proof-admission history. SQ114 closes the next accountability gap: the admission row that says "this verifier proof is operational state" must itself be witnessed by a separate quorum over the exact admission record hash.

## Existing Substrate Map

- v147 added constrained signature-verifier adapter proofs bound to replayed key material and rejected adapter-side currentness/authority claims.
- v157 added `OperationalStateSignatureVerifierAdapterProofAdmissionRecord` so strict signature proof evaluation consumes only latest quorum-certified proof-admission history.
- v159-v166 established the replay pattern that admission rows remain self-authored authority objects unless a separate witness ledger certifies the exact admission row hash.
- Existing verifier evaluation already rejects inactive keys, key/proof hash mismatch, wrong payload/signature, disallowed verifier ids, adapter authority claims, invalid proof results, invalid proof-admission replay, stale proof admissions, and wrong admission certificate subjects.

## Missing Substrate Map

- Before v167, a signature-verifier proof admission row could be latest, hash-valid, and certificate-bearing while still being the final self-authored authority object for operational signature state.
- The admission certificate inside the row certified the verifier proof hash, not the admission row that claimed to carry that certificate.
- Existing proof-record admission witness ledgers did not cover verifier adapter proofs because verifier proofs have verification ids, verifier ids, payload/signature binding, and a proof-admission store rather than a proof ledger sequence.
- The adapter boundary remained stronger than memory but weaker than full substrate authority: a row could say a proof was admitted without independent witness accountability for that row.
- Still missing after v167: accountable authority for the new verifier proof-admission witness records themselves, witness signer/key status, runtime verifier proof-store adoption, witness compaction, and live KMS/HSM/Postgres privilege tests.

## Primitive Proposal

Name: operational state signature-verifier proof admission witness record.

Problem it solves: prevents self-authored signature-verifier proof admission rows from authorizing operational signature state.

Research source: proof-carrying authentication, in-toto supply-chain attestations, TUF threshold role separation and revocation, PeerReview signed replay logs, CoSi witness cosigning, and transparency-log append-only accountability.

Mechanism borrowed: a verification claim is acceptable only as a checkable proof under a declared authority layout, and the admission of that proof must itself be an accountable, append-only, witness-certified statement.

Why current substrate lacked it: v157 made verifier proofs replay-current through proof-admission rows, but left the admission row itself as the final certificate-bearing authority object.

Why existing primitives are insufficient: proof-record admission witnesses bind proof-ledger sequence; verifier-proof admission witnesses must bind proof-admission store, verification id, verifier id, proof hash, admission sequence, and admission record hash.

State guarantee it should create: strict signature-verifier proof evaluation can accept operational signature state only when the proof is the replay-current admitted proof and the corresponding proof-admission row is witnessed by a separate quorum under the expected boundary.

Admission rule it requires: witness records bind tenant, proof-admission witness store, proof-admission store, authority scope, witness sequence, admission sequence, verification id, verifier id, proof hash, admission record hash, witness certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid proof-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the witness certificate subject kind is `operational_state_signature_verifier_adapter_proof_admission_record`; subject id is `proofAdmissionStoreId:verificationId`; subject sequence is the admission sequence; subject hash is the proof-admission record hash.

Failure modes it should prevent: self-authored verifier-proof admission rows, stale admitted verifier proofs after supersession, wrong-boundary verifier proof witnesses, under-quorum admission witnesses, certificate subject substitution, witness-history forks, and operational signature state from unwitnessed proof-admission history.

Minimal implementation slice: add verifier proof-admission witness record types, deterministic witness hashing, witness replay, strict verifier proof evaluation through `requireProofAdmissionWitnessQuorum`, durable SQL witness table, and focused tests for valid, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest verifier proof admission fails; strict verifier proof evaluation passes with proof-admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over the wrong admission subject passes; a wrong authority boundary passes; the stricter witness flag does not imply the base proof-admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state signature recovery, Axis A finance paths consuming signed currentness, and Axis B/domain adapters attempting to treat verifier callbacks or connector signature summaries as operational authority.

## Falsification Criteria

- A latest verifier-proof admission record with certified witness replay over the exact admission record hash must satisfy strict signature-verifier proof evaluation.
- Strict proof-admission witness replay must block when proof-admission replay exists but witness replay is missing.
- A certificate over a wrong proof-admission subject must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base proof-admission gate even if the caller does not set `requireProofAdmission`.

## Active 10-Question Backlog

1. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
2. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
4. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current signature-verifier proof admission rows are enough to make operational signature state accountable.
- Falsified: a certificate over the verifier proof also accounts for the admission row that carries it.
- Still open: witness records carry quorum certificates, but verifier proof-admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecord`, replay, evaluation result fields, and issue types.
- `buildOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecord()`, `computeOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecordHash()`, `operationalStateSignatureVerifierAdapterProofAdmissionSubjectId()`, and `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords()`.
- Strict signature-verifier proof evaluation through `requireProofAdmissionWitnessQuorum`; the stricter flag implies the base proof-admission replay gate.
- Migration `0084_agent_state_signature_verifier_adapter_proof_admission_witness_records.sql` with append-only witness rows and public DML revocation for verifier proof-admission and witness records.
- Tests for valid witness-certified verifier proof admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (164 passed)

Outcome: SQ114 is closed. SQ115 is now the active next substrate question, with SQ124 added as new verifier proof-admission witness authority pressure.
