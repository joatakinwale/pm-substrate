# v157 - Operational State Signature Verifier Proof Admissions

Date: 2026-06-27
Question closed: SQ104

## Research Question

What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Necula, "Proof-Carrying Code", POPL 1997: https://courses.grainger.illinois.edu/cs421/fa2010/papers/necula-pcc.pdf
- Torres-Arias, Afzali, Kuppusamy, Curtmola, and Cappos, "in-toto: Providing farm-to-table guarantees for bits and bytes", USENIX Security 2019: https://www.usenix.org/system/files/sec19-torres-arias.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

## Mechanism Extracted

Proof-carrying authentication and proof-carrying code separate an untrusted producer from the policy decision: the producer may carry a proof, but the consumer runs a small checker against a declared policy before acting. in-toto adds role-scoped, cryptographically verifiable step metadata so a single tool result does not certify a whole chain. PeerReview adds accountable signed logs that can be replayed by another party rather than trusting a participant's private report.

The substrate adaptation is a signature-verifier proof admission record. A verifier adapter proof remains a constrained cryptographic-validity artifact from v147, but strict operational signature state can consume it only when replayed proof-admission history certifies the exact proof hash, verification id, admission sequence, and authority boundary. The verifier adapter still cannot claim key currentness or authority, and the admission lane now prevents the adapter's own proof row from becoming operational state by insertion alone.

## Existing Substrate Map

- v147 added replayed key bindings and constrained signature-verifier adapter proofs that bind verifier id/version, payload hash, signature hash, key-binding hash, key material, result, and proof hash.
- v147 already rejects missing/tampered key bindings, missing/tampered proofs, tenant/scope/principal/key/algorithm mismatch, payload/signature mismatch, missing or mismatched key material, inactive keys, disallowed verifier adapters, adapter authority claims, and invalid cryptographic results.
- v148, v150, and later strict lanes consume verifier proofs as nested signature evidence for finalizer proofs and observer signatures.
- v149-v156 added adjacent admission histories for recovery cuts, pruning policies, guard authorizations, compaction checkpoints, proof records, and authority-topology checkpoints.

## Missing Substrate Map

- Before v157, a hash-valid verifier adapter proof could be supplied directly to strict evaluation after local adapter execution or database insertion.
- The proof showed which key material and payload were checked, but not that the verifier-proof row itself was admitted by any replayed authority lane.
- Existing key-binding replay prevents verifier-side key-currentness smuggling, but does not stop a forged proof row with a valid local hash from entering the operational path.
- Existing proof-record admission certifies quorum-certificate proof records, not generic signature-verifier adapter proof rows used by finalizer, observer, or future signature lanes.
- Still missing after v157: signer/key validation for verifier-proof admission certificates, runtime strict-signature adoption, live KMS/HSM adapters, verifier registry/currentness, proof-admission authority topology, and admission compaction.

## Primitive Proposal

Name: operational state signature verifier proof admission record.

Problem it solves: prevents self-authored signature-verifier adapter proof rows from becoming operational signature evidence merely because a verifier callback or inserted row says cryptographic validation succeeded.

Research source: proof-carrying authentication/code consumer-side proof checking, in-toto role-scoped attestations, and PeerReview replayable accountability logs.

Mechanism borrowed: producers can emit proof artifacts, but a separate replayed admission lane certifies the exact proof digest under an authority boundary before consumers treat it as admissible state.

Why current substrate lacked it: v147 constrained what a verifier proof may claim, but did not require a verifier-proof admission history before strict consumers accepted the proof.

Why existing primitives are insufficient: key bindings establish replayed key material; verifier proofs establish signature validity; proof-record admissions cover quorum-certificate proof objects. None admits the verifier proof artifact itself.

State guarantee it should create: strict signature verification can support operational state only when the proof is valid against replayed key material and is the replay-current admitted proof for its verification id.

Admission rule it requires: admission records bind tenant, proof-admission store, authority scope, admission sequence, previous admission hash, verification id, verifier id, proof hash, embedded verifier proof, certified admission certificate, admitted-at/by metadata, and admission-record hash.

Replay rule it requires: replay rejects tenant/store/scope mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded proofs, non-certified certificates, insufficient witness quorum, certificate subject mismatch, wrong authority boundary, and stale proofs superseded by later admissions for the same verification id.

Authority boundary it requires: v157 requires a certified quorum certificate over the exact verifier-proof hash under an expected authority boundary, but signer/key accountability for these certificate-bearing admission rows remains SQ114.

Failure modes it should prevent: verifier callback booleans becoming authority, direct proof-row insertion becoming operational state, stale verifier proofs after supersession, wrong-boundary proof admissions, insufficient witness admissions, tampered proof/admission rows, and local adapter output outranking admitted history.

Minimal implementation slice: add verifier-proof admission record/replay types, deterministic admission hashing, strict `requireProofAdmission` support in verifier-proof evaluation, migration `0074`, and focused falsification tests.

Tests that would falsify it: valid quorum-admitted verifier proof fails; strict verifier evaluation accepts a proof without admission replay; stale proof accepted after a later admission for the same verification id; wrong authority-boundary certificate passes; tampered proof/admission record passes.

Axis surfaces that could later validate it: Axis C strict signed observer/finalizer replay with production KMS/HSM adapters, Axis A finance certificate signatures where external verifier output is tempting to trust directly, and Axis B adapter attempts to smuggle signature validity through connector-local proof rows.

## Falsification Criteria

- A valid verifier proof matching replayed key material and a latest quorum-certified admission record must pass strict verifier evaluation.
- A verifier proof without admission replay must fail under `requireProofAdmission`.
- A verifier proof that is no longer the latest admitted proof for its verification id must fail admission replay.
- An admission certificate for the wrong authority boundary must fail replay.
- A tampered admission record or embedded proof hash must fail replay.
- The SQL surface must persist append-only proof-admission records separate from raw verifier proof rows and revoke public DML on both surfaces.

## Active 10-Question Backlog

1. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
2. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
3. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
4. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
5. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
6. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
7. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
8. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
9. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored certificate-bearing rows?
10. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a constrained, hash-valid verifier adapter proof is enough for strict operational signature state.
- Falsified: append-only verifier proof rows alone prevent adapter-local cryptographic-validity assertions from becoming authority.
- Still open: v157 supplies replay-current proof admission with certified quorum certificates, but generic signer/key validation for this certificate boundary, verifier registry currentness, runtime strict-signature adoption, live KMS/HSM adapters, live database tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateSignatureVerifierAdapterProofAdmissionRecord`, replay, and issue types.
- `buildOperationalStateSignatureVerifierAdapterProofAdmissionRecord()`, `computeOperationalStateSignatureVerifierAdapterProofAdmissionRecordHash()`, and `replayOperationalStateSignatureVerifierAdapterProofAdmissionRecords()`.
- `evaluateOperationalStateSignatureVerifierAdapterProof({ requireProofAdmission: true })` so verifier proofs fail strict evaluation unless replay-current admitted.
- Migration `0074_agent_state_signature_verifier_adapter_proof_admissions.sql` with append-only admission records and public DML revocation.
- Tests for valid quorum-admitted verifier proof replay, missing admission replay refusal, stale proof refusal, wrong-boundary certificate refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (141 passed)

Full workspace verification after ledger publication:

- `pnpm typecheck`
- `pnpm test` (545 passed, 143 skipped)
- `git diff --check`

Outcome: SQ104 is closed. SQ105 is now the active next substrate question, with SQ114 added as new verifier-proof admission authority pressure.
