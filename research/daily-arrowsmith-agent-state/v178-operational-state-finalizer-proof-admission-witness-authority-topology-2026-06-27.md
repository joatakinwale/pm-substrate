# v178 - Operational State Finalizer-Proof Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ125

## Research Question

What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain", PODC 2019: https://arxiv.org/pdf/1803.05069
- Kokoris-Kogias et al., "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing", USENIX Security 2016: https://bford.info/pub/dec/byzcoin.pdf
- Boneh, Partap, and Rotem, "Proactive Refresh for Accountable Threshold Signatures", Financial Cryptography 2024: https://fc24.ifca.ai/preproceedings/183.pdf
- Boneh and Komlo, "Threshold Signatures with Private Accountability", CRYPTO 2022: https://eprint.iacr.org/2022/1636
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

## Mechanism Extracted

PBFT and HotStuff make finality depend on quorum-certified agreement over exact values, not on a leader's assertion that a value is final. ByzCoin adapts PBFT finality with collective signing so a block commit becomes a compact, verifiable multi-party statement. Accountable threshold-signature work adds the signer-accountability correction: a threshold signature cannot be accountable if the signer set can be lied about after the fact or merely self-declared by the certificate. PeerReview and CoSi add append-only accountability and witness cosigning for authority statements.

The substrate adaptation is authority epoch seal finalizer-proof admission witness authority topology. v168 made finalizer-proof admission rows accountable through separate witness records over exact admission-record hashes. SQ125 closes the signer/topology gap in that witness layer: strict seal-finality evaluation can now require finalizer-proof admission witness certificates to bind to a replayed witness authority topology hash and count only unique active topology principals toward quorum.

## Existing Substrate Map

- v148 added authority epoch seal finalizer proofs over canonical seal payload hashes and replay-current finalizer key bindings.
- v158 added finalizer-proof admission records so seal finality can require the latest admitted finalizer proof for a seal id.
- v168 added finalizer-proof admission witness records over the exact finalizer-proof admission record hash.
- v169-v177 established topology-bound replay for adjacent witness, settlement, proof-record, checkpoint-admission, and verifier-proof witness lanes.
- Before v178, `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords()` checked witness-record hashes, certificate hashes, certified status, subject, boundary, and certificate-declared witness counts.

## Missing Substrate Map

- Before v178, a finalizer-proof admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible finalizer-proof admission witness principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed finalizer-proof admission witness topology.
- Duplicate witness ids could satisfy certificate-local count checks.
- Suspended, revoked, equivocated, or unknown finalizer-proof admission witnesses could count as if they were active.
- Seal finality was accountable to records and certificates, not to replayed signer authority for the witness certificate that admitted finalizer-proof admission rows.
- Still missing after v178: admission/witness/finality for the finalizer-proof admission witness authority-transition ledger itself, witness signature/key-status verification, runtime seal-store adoption for topology replay, authority compaction of this witness-authority lane, live KMS/HSM finalizer adapters, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state finalizer-proof admission witness authority topology.

Problem it solves: prevents self-authored authority epoch seal finalizer-proof admission witness records from authorizing seal finality by carrying certificates with arbitrary finalizer-proof admission witness ids.

Research source: PBFT, HotStuff, ByzCoin, accountable threshold signatures, threshold signatures with private accountability, PeerReview, and CoSi.

Mechanism borrowed: finality evidence is admissible only when the finality proof, admission proof, witness identity, and signer topology are all checkable against replayed authority; a finalizer witness certificate cannot define its own witness authority.

Why current substrate lacked it: v168 required witness records over finalizer-proof admission rows, but did not bind witness signer ids to replayed finalizer-proof admission witness authority.

Why existing primitives are insufficient: finalizer proofs constrain seal signatures, finalizer-proof admission records make proofs replay-current, and witness records make proof-admission rows accountable, but the witness certificate signer set remained certificate-local. Generic authority topology existed, but finalizer-proof admission witness replay did not consume it.

State guarantee it should create: strict authority epoch seal finality can accept a witnessed finalizer-proof admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy topology quorum.

Admission rule it requires: finalizer-proof admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate finalizer-proof admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a finalizer proof can constitute seal finality.

Authority boundary it requires: the witness certificate remains over `operational_state_authority_epoch_seal_finalizer_proof_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed finalizer-proof admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale finalizer-proof admission witness authority, suspended or revoked proof-admission witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and seal finality authorized by finalizer-proof admission identities not present in replayed authority history.

Minimal implementation slice: extend finalizer-proof admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict finalizer evaluation flags, add durable SQL authority-transition storage for this witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness finalizer-proof admission witness record fails; strict seal-finality evaluation passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct local sealed-authority replay after amnesiac resume, Axis A finance recovery paths consuming sealed finality through stale finalizer-proof admission witnesses, and Axis B/domain adapters attempting to resume from connector-owned finality summaries.

## Falsification Criteria

- A latest finalizer-proof admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict seal-finality evaluation.
- Strict finalizer evaluation must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
3. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified finalizer-proof admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a finalizer-proof admission witness certificate can be treated as authority without replaying finalizer-proof admission witness topology.
- Falsified: finalizer proof admission rows plus witness certificates are sufficient without lane-specific replay of finalizer-proof admission witness authority.
- Still open: finalizer-proof admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added finalizer-proof admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateAuthorityEpochSealFinalizer()` with finalizer-proof admission witness authority topology strictness.
- Added migration `0095_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transitions.sql` with append-only finalizer-proof admission witness authority-transition rows.
- Added tests for valid topology-bound finalizer-proof admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (186 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (590 passed, 143 skipped)

Outcome: SQ125 is closed. SQ126 is now the active next substrate question, with SQ135 added as new finalizer-proof admission witness authority-transition accountability pressure.
