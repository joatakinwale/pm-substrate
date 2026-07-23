# v177 - Operational State Signature-Verifier Proof Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ124

## Research Question

What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Samuel, Mathewson, Cappos, and Dingledine, "Survivable Key Compromise in Software Update Systems", ACM CCS 2010: https://freehaven.net/~arma/tuf-ccs2010.pdf
- Torres-Arias et al., "in-toto: Providing Farm-to-Table Guarantees for Bits and Bytes", USENIX Security 2019: https://www.usenix.org/system/files/sec19-torres-arias.pdf
- Newman, Meyers, and Torres-Arias, "Sigstore: Software Signing for Everybody", ACM CCS 2022: https://dl.acm.org/doi/10.1145/3548606.3560596
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

## Mechanism Extracted

Proof-carrying authentication separates proof checking from private belief: a request must carry a checkable proof. TUF adds role separation, threshold signatures, delegation, and revocation so a single key or role cannot unilaterally authorize software-update state. in-toto makes supply-chain validity depend on a signed layout declaring which steps must be done and by whom, plus signed link metadata that proves the declared parties acted as required. Sigstore connects signing events to identity and transparency, making verification depend on externally checkable signing evidence rather than local assertions. PeerReview and CoSi add tamper-evident accountability and witness cosigning.

The substrate adaptation is signature-verifier proof admission witness authority topology. v167 made verifier proof-admission rows accountable through a separate witness record over the exact proof-admission record hash. SQ124 closes the signer/topology gap in that witness layer: strict signature-verifier proof evaluation can now require proof-admission witness certificates to bind to a replayed witness authority topology hash and count only unique active topology principals toward quorum.

## Existing Substrate Map

- v147 added constrained signature-verifier adapter proofs so verifier callbacks can prove signature validity only, not authority/currentness/topology.
- v157 added signature-verifier proof admission records so strict signature state consumes only latest admitted verifier proofs.
- v167 added signature-verifier proof admission witness records over the exact verifier proof-admission record hash.
- v169-v176 established topology-bound replay for adjacent witness or settlement certificates: recovery-cut, history-root, pruning-policy, storage guard, tombstone-history checkpoint, witness-ledger checkpoint, proof-record admission, and authority-topology checkpoint admission witness lanes.
- Before v177, `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords()` checked witness-record hashes, certificate hashes, certified status, subject, boundary, and certificate-declared witness counts.

## Missing Substrate Map

- Before v177, a verifier proof-admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible proof-admission witness principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed verifier proof-admission witness topology.
- Duplicate witness ids could satisfy certificate-local count checks.
- Suspended, revoked, equivocated, or unknown verifier proof-admission witnesses could count as if they were active.
- Verifier proof admission and witness rows made operational signature state accountable to records and certificates, not to replayed signer authority.
- Still missing after v177: admission/witness/finality for the signature-verifier proof admission witness authority-transition ledger itself, witness signature/key-status verification, runtime verifier-store adoption for topology replay, authority compaction of this witness-authority lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state signature-verifier proof admission witness authority topology.

Problem it solves: prevents self-authored signature-verifier proof admission witness records from authorizing operational signature state by carrying certificates with arbitrary proof-admission witness ids.

Research source: Proof-Carrying Authentication, TUF, in-toto, Sigstore, PeerReview, and CoSi.

Mechanism borrowed: verification evidence is admissible only when the proof, role/delegation authority, witness identity, and transparency/accountability evidence are all checkable against an external policy or log; a verifier or certificate cannot define its own witness authority.

Why current substrate lacked it: v167 required witness records over verifier proof-admission rows, but did not bind witness signer ids to replayed proof-admission witness authority.

Why existing primitives are insufficient: verifier proofs constrain adapter claims, proof admission records make proofs replay-current, and witness records make proof-admission rows accountable, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but verifier proof-admission witness replay did not consume it.

State guarantee it should create: strict signature-verifier proof evaluation can accept a witnessed proof-admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy topology quorum.

Admission rule it requires: signature-verifier proof admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate proof-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a verifier proof can become operational signature state.

Authority boundary it requires: the witness certificate remains over `operational_state_signature_verifier_adapter_proof_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed proof-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale verifier proof-admission witness authority, suspended or revoked proof-admission witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and operational signature state authorized by proof-admission identities not present in replayed authority history.

Minimal implementation slice: extend signature-verifier proof admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict verifier proof evaluation flags, add durable SQL authority-transition storage for this witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness verifier proof-admission witness record fails; strict verifier proof evaluation passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct local strict-signature replay after amnesiac resume, Axis A finance recovery paths consuming verifier proofs through stale proof-admission witnesses, and Axis B/domain adapters attempting to resume from connector-owned verifier summaries.

## Falsification Criteria

- A latest signature-verifier proof admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict signature-verifier proof evaluation.
- Strict verifier proof evaluation must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
4. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified signature-verifier proof admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a verifier proof-admission witness certificate can be treated as authority without replaying proof-admission witness topology.
- Falsified: verifier proof admission rows plus witness certificates are sufficient without lane-specific replay of proof-admission witness authority.
- Still open: signature-verifier proof admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added signature-verifier proof admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateSignatureVerifierAdapterProof()` with proof-admission witness authority topology strictness.
- Added migration `0094_agent_state_signature_verifier_proof_admission_witness_authority_transitions.sql` with append-only signature-verifier proof admission witness authority-transition rows.
- Added tests for valid topology-bound verifier proof-admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (184 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (588 passed, 143 skipped)

Outcome: SQ124 is closed. SQ125 is now the active next substrate question, with SQ134 added as new signature-verifier proof admission witness authority-transition accountability pressure.
