# v148 - Operational State Authority Epoch Seal Finalizer Proof

Date: 2026-06-27
Question closed: SQ95

## Research Question

What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain", PODC 2019 / arXiv: https://arxiv.org/pdf/1803.05069
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://arxiv.org/pdf/1503.08768
- Nikitin et al., "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds", USENIX Security 2017: https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin

## Mechanism Extracted

PBFT and HotStuff make finality a protocol object: a value becomes committed only through authenticated messages or quorum certificates over the exact value and phase. CHAINIAC and CoSi supply the cross-domain authority bridge: a critical authoritative statement should be signed or cosigned over its exact payload by accountable principals, with clients verifying the signature object rather than trusting a central row, local memory, or a private verifier.

The substrate adaptation is an authority epoch seal finalizer proof. A `seal_authority_epoch` row or seal summary is not finality by itself. The finality claim becomes replayable only when a replay-current finalizer principal signs the canonical seal payload, and that signature is checked through the v147 constrained verifier-proof boundary that cannot assert currentness, topology, quorum, or admission.

## Existing Substrate Map

- v138 added target-layer authority epoch seals that bind certified required-head currentness to a subject sequence, effective authority topology hash, and quorum-certificate hash.
- v145 added generic quorum-certificate proof records that can link certified currentness to an authority-epoch seal shape.
- v146 added generic authority-topology compaction so topology history can replay after authority-transition pruning.
- v147 added constrained signature-verifier adapter proofs that bind cryptographic verification to replayed key material while rejecting adapter-side authority/currentness claims.

## Missing Substrate Map

- Before v148, the generic seal shape could name a sealed frontier and quorum-certificate hash, but no generic finalizer proof made the seal attributable to a replay-current finalizer principal.
- A `seal_authority_epoch` transition row could still look like finality even if its recorded-by field came from an unsigned store write, process memory, or adapter-supplied authority.
- Existing key-status and verifier proofs were insufficient because they checked signatures when present but did not define the canonical authority-epoch seal payload that must be signed.
- Existing quorum-certificate proof records were insufficient because their optional authority-epoch seal fields could bind a certificate hash without proving finalizer attribution.
- Still missing after v148: admission authority for finalizer-proof rows, finalizer topology/quorum policy, automatic adoption by existing seal replay paths, live KMS/HSM finalizer adapters, and finalizer-proof compaction.

## Primitive Proposal

Name: operational state authority epoch seal finalizer proof.

Problem it solves: prevents unsigned authority-store rows, local summaries, or private adapter state from constituting finality for an authority epoch seal.

Research source: PBFT authenticated state-machine replication, HotStuff quorum-certificate commit objects, CoSi witness cosigning of authoritative statements, and CHAINIAC collectively signed release timelines.

Mechanism borrowed: finality is an authenticated object over an exact payload, not a private conclusion; acceptance checks the signer's replayed role/key/currentness separately from the cryptographic verification result.

Why current substrate lacked it: v138 seals were replayed transition records, and v147 verifier proofs were generic cryptographic evidence, but no primitive tied the two by requiring a finalizer signature over the exact seal payload.

Why existing primitives are insufficient: topology replay can say which finalizer key is current, verifier proofs can say a signature verified, and quorum certificates can say a subject is certified, but only the finalizer proof joins those facts into a replayable seal-finality object.

State guarantee it should create: an authority epoch seal can support operational finality only when its canonical payload hash is signed by a replay-current finalizer principal whose key binding matches tenant, authority scope, sealed topology hash, active key status, and constrained verifier proof.

Admission rule it requires: finalizer proofs must bind tenant, authority scope, seal id, authority boundary, sealed subject kind/id/sequence, sealed authority topology hash, sealed quorum certificate hash, optional authority-transition hash, finalized-at time, finalizer principal id, finalizer key binding, verifier proof, seal-payload hash, and finalizer-proof hash.

Replay rule it requires: replay must recompute the seal-payload hash and finalizer-proof hash, compare expected replay context fields, require a positive sealed frontier, require the finalizer key binding to match tenant/scope/principal/sealed topology, and delegate signature validity to `evaluateOperationalStateSignatureVerifierAdapterProof()`.

Authority boundary it requires: finalizer proofs attest only to finalizer signature over an exact seal payload; SQ105 must decide how proof rows themselves become admitted rather than self-authored assertions.

Failure modes it should prevent: unsigned seals, finality rows written by non-finalizer actors, stale or revoked finalizer keys, verifier adapters claiming key currentness or transition admission, seal payload rewrites, transition-hash drift, topology-hash substitution, and stale signed payloads outranking replay.

Minimal implementation slice: add canonical seal payload/proof types, deterministic hashes, finalizer evaluator, append-only migration, and tests for valid proof, missing proof, stale/smuggled verifier proof, and tampered payload/transition drift.

Tests that would falsify it: a valid replay-current finalizer proof fails; an unsigned seal passes; a stale key or adapter-side currentness claim passes; a topology-mismatched key binding passes; a tampered seal payload passes; a different authority-transition hash passes.

Axis surfaces that could later validate it: Axis C direct local agent-state recovery across sealed authority epochs, Axis A finance signed certificate/finality claims, and Axis B domain adapters attempting to treat unsigned connector rows as finality.

## Falsification Criteria

- A finalizer proof whose seal payload, active finalizer key binding, constrained verifier proof, expected signature hash, and allowed verifier id match replay context must pass.
- An absent finalizer proof must produce `operational_state_authority_epoch_seal_finalizer_missing`.
- A finalizer key binding whose topology hash does not match the sealed authority topology must produce `operational_state_authority_epoch_seal_finalizer_key_binding_scope_mismatch`.
- A revoked finalizer key or verifier proof with `key_currentness` or `transition_admission` claims must make the finalizer proof invalid through nested verifier issues.
- A tampered seal payload must produce `operational_state_authority_epoch_seal_finalizer_hash_mismatch` and `operational_state_authority_epoch_seal_finalizer_seal_payload_mismatch`.
- A replay-required authority-transition hash mismatch must produce `operational_state_authority_epoch_seal_finalizer_transition_hash_mismatch`.

## Active 10-Question Backlog

1. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
2. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
3. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
4. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
5. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
6. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
7. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
8. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
9. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
10. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?

## Failed Assumption Ledger

- Falsified: a `seal_authority_epoch` transition row is enough to constitute finality for the sealed authority epoch.
- Falsified: finalizer attribution can be recovered from `recordedBy` or authority-store presence without a replayed signature proof.
- Still open: v148 supplies the proof/evaluation boundary and durable proof table, but finalizer-proof admission authority, automatic adoption by seal replay paths, live KMS/HSM adapters, finalizer topology/quorum policy, and finalizer-proof compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityEpochSealPayload`, `OperationalStateAuthorityEpochSealFinalizerProof`, evaluation, role, and issue types.
- `computeOperationalStateAuthorityEpochSealPayloadHash()`, `buildOperationalStateAuthorityEpochSealFinalizerProof()`, deterministic finalizer-proof hashing, and verification helpers.
- `evaluateOperationalStateAuthorityEpochSealFinalizer()` for missing proof, proof hash, canonical seal payload, expected replay fields, positive sealed frontier, key-binding tenant/scope/principal/topology agreement, and nested constrained verifier-proof validity.
- Migration `0065_agent_state_authority_epoch_seal_finalizer_proofs.sql` with append-only durable finalizer proof rows.
- Tests for valid replay-current finalizer proof acceptance, unsigned-seal refusal, stale/revoked key plus adapter-currentness/admission claim refusal, topology mismatch refusal, tampered payload refusal, and transition-hash drift refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (111 passed)
- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (515 passed, 143 skipped)

Outcome: SQ95 is closed. SQ96 is now the active next substrate question.
