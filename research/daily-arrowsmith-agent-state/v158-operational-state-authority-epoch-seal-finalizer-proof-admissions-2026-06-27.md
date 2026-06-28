# v158 - Operational State Authority Epoch Seal Finalizer Proof Admissions

Date: 2026-06-27
Question closed: SQ105

## Research Question

What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?

## Sources

- Kokoris-Kogias, Jovanovic, Gailly, Khoffi, Gasser, and Ford, "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing", USENIX Security 2016: https://bford.info/pub/dec/byzcoin.pdf
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain", PODC 2019: https://arxiv.org/abs/1803.05069
- Buchman, "Tendermint: Consensus without Mining", 2016: https://tendermint.com/static/docs/tendermint.pdf
- Gilad, Hemo, Micali, Vlachos, and Zeldovich, "Algorand: Scaling Byzantine Agreements for Cryptocurrencies", SOSP 2017: https://people.csail.mit.edu/nickolai/papers/gilad-algorand-eprint.pdf

## Mechanism Extracted

ByzCoin converts probabilistic confirmation into an explicit collectively signed commit artifact. HotStuff makes finality depend on quorum certificates over exact values and phases rather than a leader's assertion. Tendermint treats a block as committed only when enough validator commit votes sign that block, and makes conflicting commit evidence punishable. Algorand clients recover state from blocks plus certificates, not from private participant memory.

The substrate adaptation is an authority epoch seal finalizer-proof admission record. A finalizer proof still proves that a replay-current finalizer signed the exact seal payload, but strict seal finality can consume that proof only when a separate admission history certifies the exact finalizer-proof hash under the expected authority boundary. This moves finality from proof-row presence into admitted transition history.

## Existing Substrate Map

- v148 added canonical authority epoch seal payloads and finalizer proofs over exact seal payload hashes.
- v148 already rejects missing/unsigned proofs, tampered finalizer-proof hashes, seal-payload rewrites, tenant/scope/finalizer mismatches, topology-mismatched finalizer keys, invalid nested verifier proofs, invalid sealed frontiers, and transition-hash drift.
- v157 added verifier-proof admission so strict nested signature verification can refuse self-authored verifier adapter proof rows.
- Existing proof-record and checkpoint admissions establish adjacent quorum-certified admission lanes for currentness and replay seeds.

## Missing Substrate Map

- Before v158, a hash-valid finalizer proof could be supplied directly to seal-finality evaluation after local construction or database insertion.
- The proof established signature attribution, but not that the finalizer-proof row itself was admitted by a replayed authority lane.
- Existing verifier-proof admission covered the nested signature proof, not the larger finality object that binds seal payload, finalizer key binding, and verifier proof.
- Existing quorum-certificate proof-record admissions certify currentness proof records, not finalizer proofs that make authority epoch seals terminal.
- Still missing after v158: signer/key validation for finalizer-proof admission certificates, runtime seal adoption, live KMS/HSM finalizer adapters, finalizer admission authority topology, and admission compaction.

## Primitive Proposal

Name: operational state authority epoch seal finalizer-proof admission record.

Problem it solves: prevents self-authored authority epoch seal finalizer proof rows from constituting finality merely because a local signer or inserted row produced a hash-valid proof.

Research source: ByzCoin collective commit signatures, HotStuff quorum certificates, Tendermint validator commit votes plus equivocation evidence, and Algorand certified block recovery.

Mechanism borrowed: finality is an admitted certificate over an exact value, with replayable evidence sufficient for a later client to recover the decision without trusting local memory.

Why current substrate lacked it: v148 proved finalizer attribution, but did not require a proof-admission history before strict consumers accepted the finalizer proof as seal finality.

Why existing primitives are insufficient: verifier-proof admission admits nested signature-validity evidence; finalizer proof evaluation validates the finalizer signature and seal payload; neither admits the finalizer-proof object as finality.

State guarantee it should create: strict authority epoch seal finality can consume a finalizer proof only when the proof is valid and is the replay-current admitted proof for its seal id.

Admission rule it requires: admission records bind tenant, finalizer-proof admission store, authority scope, admission sequence, previous admission hash, seal id, finalizer-proof hash, embedded finalizer proof, certified admission certificate, admitted-at/by metadata, and admission-record hash.

Replay rule it requires: replay rejects tenant/store/scope mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded finalizer proofs, non-certified certificates, insufficient witness quorum, certificate subject mismatch, wrong authority boundary, and stale finalizer proofs superseded by later admissions for the same seal id.

Authority boundary it requires: v158 requires a certified quorum certificate over the exact finalizer-proof hash under an expected authority boundary, but signer/key accountability for these certificate-bearing admission rows remains SQ115.

Failure modes it should prevent: unsigned or locally signed finality rows becoming operational by insertion, stale finalizer proofs after supersession, wrong-boundary finality admissions, insufficient witness admissions, tampered finalizer proof/admission rows, and local seal summaries outranking admitted history.

Minimal implementation slice: add finalizer-proof admission record/replay types, deterministic admission hashing, strict `requireFinalizerProofAdmission` support in seal-finality evaluation, migration `0075`, and focused falsification tests.

Tests that would falsify it: valid quorum-admitted finalizer proof fails; strict finalizer evaluation accepts a proof without admission replay; stale finalizer proof accepted after a later admission for the same seal id; wrong authority-boundary certificate passes; tampered proof/admission record passes.

Axis surfaces that could later validate it: Axis C direct local agent-state recovery across sealed authority epochs, Axis A finance finality claims for signed certificates, and Axis B adapters attempting to treat unsigned connector rows or locally signed rows as terminal finality.

## Falsification Criteria

- A valid finalizer proof matching replay context and a latest quorum-certified admission record must pass strict finalizer evaluation.
- A finalizer proof without admission replay must fail under `requireFinalizerProofAdmission`.
- A finalizer proof that is no longer the latest admitted proof for its seal id must fail admission replay.
- An admission certificate for the wrong authority boundary must fail replay.
- A tampered admission record or embedded finalizer proof hash must fail replay.
- The SQL surface must persist append-only finalizer-proof admission records separate from raw finalizer proof rows and revoke public DML on both surfaces.

## Active 10-Question Backlog

1. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
2. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
3. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
4. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
5. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
6. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
7. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
8. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored certificate-bearing rows?
9. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
10. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a hash-valid authority epoch seal finalizer proof is enough to constitute strict seal finality.
- Falsified: append-only finalizer proof rows alone prevent self-authored finality assertions from becoming operational state.
- Still open: v158 supplies replay-current finalizer-proof admission with certified quorum certificates, but generic signer/key validation for this certificate boundary, runtime seal adoption, live database tests, finalizer admission authority topology, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionRecord`, replay, and issue types.
- `buildOperationalStateAuthorityEpochSealFinalizerProofAdmissionRecord()`, `computeOperationalStateAuthorityEpochSealFinalizerProofAdmissionRecordHash()`, and `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionRecords()`.
- `evaluateOperationalStateAuthorityEpochSealFinalizer({ requireFinalizerProofAdmission: true })` so finalizer proofs fail strict seal-finality evaluation unless replay-current admitted.
- Optional nested strict verifier-proof admission pass-through via `requireVerifierProofAdmission` and `verifierProofAdmissionReplay`.
- Migration `0075_agent_state_authority_epoch_seal_finalizer_proof_admissions.sql` with append-only admission records and public DML revocation.
- Tests for valid quorum-admitted finalizer proof replay, missing admission replay refusal, stale proof refusal, wrong-boundary certificate refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (144 passed)

Full workspace verification after ledger publication:

- `pnpm typecheck`
- `pnpm test` (548 passed, 143 skipped)
- `git diff --check`

Outcome: SQ105 is closed. SQ106 is now the active next substrate question, with SQ115 added as new finalizer-proof admission authority pressure.
