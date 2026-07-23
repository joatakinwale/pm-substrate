# v147 - Operational State Signature Verifier Adapter Proof

Date: 2026-06-27
Question closed: SQ94

## Research Question

What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?

## Sources

- Blaze, Feigenbaum, and Keromytis, "KeyNote: Trust Management for Public-Key Infrastructures", Security Protocols 1998: https://www.cs.yale.edu/homes/jf/BFK-SPW98.pdf
- Samuel, Mathewson, Cappos, and Dingledine, "Survivable Key Compromise in Software Update Systems", CCS 2010: https://freehaven.net/~arma/tuf-ccs2010.pdf
- Melara, Blankstein, Bonneau, Felten, and Freedman, "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara
- Basin, Cremers, Kim, Perrig, Sasse, and Szalachowski, "ARPKI: Attack Resilient Public-Key Infrastructure", CCS 2014: https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf

## Mechanism Extracted

KeyNote separates key authentication from authorization policy: a key or signature is only useful inside an action environment and local policy. TUF adds key-role separation and revocation pressure: raw signature success cannot substitute for role, threshold, and current metadata. CONIKS and ARPKI add transparency/accountability for key bindings and certificate operations, so a verifier does not become the source of currentness merely because it can check cryptography.

The substrate adaptation is a constrained signature verifier adapter proof. Replayed authority state supplies the principal, key id, algorithm, key status, authority frontier, topology hash, and external key-material fingerprint or hash. A production verifier adapter may produce only a replayable proof that a signature hash verified against that exact key material for a payload hash. The adapter proof cannot assert key currentness, principal authority, topology currentness, quorum authority, or transition admission; those claims must come from admitted substrate replay.

## Existing Substrate Map

- v137 added replayed key-status checks for v134 witness signatures.
- v138 sealed authority epochs so later key/topology changes cannot retroactively govern certified currentness.
- Existing strict signature policies pass a `verifier` callback and compare key ids/algorithms to replayed topology.
- v139-v146 add recovery cuts, transparency, policy compilation, storage guards, compaction lanes, proof records, and compacted topology replay.

## Missing Substrate Map

- Before v147, production signature verification remained a process-local callback returning a boolean.
- Replayed key ids could be compared to signatures, but there was no generic replay object binding the key id to external cryptographic material inspected by a verifier adapter.
- A verifier adapter could implicitly act as the currentness authority by accepting a signature under a key it fetched or interpreted privately.
- Existing authority topology and key-status replay could say which key should be current, but not prove which external public key material the production verifier used.
- Still missing after v147: admission authority for verifier-proof rows, automatic adoption by existing strict signature paths, verifier registry/currentness, live HSM/KMS adapter integration, and proof compaction.

## Primitive Proposal

Name: operational state signature verifier adapter proof.

Problem it solves: prevents production verifier adapters from turning private key lookup, private PKI state, or callback success into operational authority.

Research source: KeyNote trust-management separation, TUF role/key revocation, CONIKS key transparency, and ARPKI accountable certificate operations.

Mechanism borrowed: separate cryptographic verification from authorization/currentness, bind public-key material to transparent state, and treat verifier output as proof of signature validity only.

Why current substrate lacked it: strict signature policies already used replayed key ids and key status, but the actual production verifier result was not itself a replayable artifact and did not bind to key material hash/fingerprint.

Why existing primitives are insufficient: authority topology can name a key, and key-status replay can mark it active, but only a constrained verifier proof says which external cryptographic material was actually used and forbids adapter-side currentness claims.

State guarantee it should create: a signature can support operational replay only when a hash-valid verifier proof matches a replayed key binding, expected payload hash, expected signature hash, allowed verifier id, active key status, and key-material fingerprint/hash, while containing no authority/currentness claims.

Admission rule it requires: verifier proofs must bind tenant, authority scope, verifier id/version, verification id/time, principal, key id, algorithm, payload hash, signature hash, key-binding hash, key-material fingerprint/hash, result, adapter claims, and proof hash.

Replay rule it requires: replay must verify key-binding hash, proof hash, tenant/scope/principal/key/algorithm agreement, payload/signature agreement, active key status, allowed verifier id, key-material match, valid cryptographic result, and absence of adapter-side authority claims.

Authority boundary it requires: `operational-state-signature-verifier-adapter.v1` proofs are append-only cryptographic evidence only; a later SQ104 admission rule must prevent arbitrary self-authored verifier proofs from entering the lane.

Failure modes it should prevent: accepting verifier boolean results without replay, verifier private key lookup defining currentness, stale/revoked keys authorizing signatures, wrong public key material passing under the same key id, adapter claims of principal authority or topology currentness, tampered verification proofs, and stale signed payloads outranking replay.

Minimal implementation slice: add replayed key-binding and verifier-proof types, deterministic hashes, proof evaluator, append-only migration, and falsification tests.

Tests that would falsify it: matching proof fails; adapter currentness/authority claims pass; inactive keys pass; mismatched key material passes; tampered proof hash passes; stale signed payload passes.

Axis surfaces that could later validate it: Axis C strict signed witness replay with production KMS/HSM adapters, Axis A finance certificate proofs where signing keys are externally managed, and Axis B adapter attempts to smuggle key currentness through verifier metadata.

## Falsification Criteria

- A valid verifier proof matching an active replayed key binding, expected payload hash, expected signature hash, and allowed verifier id must pass.
- A proof with `key_currentness` or `principal_authority` adapter claims must produce `operational_state_signature_verifier_adapter_authority_claim`.
- A proof for a revoked replayed key must produce `operational_state_signature_verifier_key_not_current`.
- A proof whose public-key fingerprint or key-material hash differs from the replayed binding must produce material mismatch issues.
- A tampered proof must produce `operational_state_signature_verifier_proof_hash_mismatch`.
- A proof over a different payload hash must produce `operational_state_signature_verifier_payload_mismatch`.

## Active 10-Question Backlog

1. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
2. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
3. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
4. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
5. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
6. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
7. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
8. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
9. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
10. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?

## Failed Assumption Ledger

- Falsified: replayed key id plus a verifier callback is enough for production cryptographic authority.
- Falsified: a verifier adapter can safely return a boolean without a replayable proof of which key material, payload, and signature it checked.
- Still open: v147 supplies the proof/evaluation boundary and durable proof table, but proof admission authority, verifier registry/currentness, runtime strict-signature adoption, and live KMS/HSM adapters remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateSignatureKeyBinding`, `OperationalStateSignatureVerifierAdapterProof`, evaluation, result, claim, and issue types.
- `buildOperationalStateSignatureKeyBinding()`, `buildOperationalStateSignatureVerifierAdapterProof()`, deterministic key-binding/proof hashing, and verification helpers.
- `evaluateOperationalStateSignatureVerifierAdapterProof()` for replayed key binding, proof hash, active key status, expected payload/signature, key-material binding, allowed verifier id, and adapter authority-claim rejection.
- Migration `0064_agent_state_signature_verifier_adapter_proofs.sql` with append-only durable verifier proof rows.
- Tests for valid proof acceptance, adapter currentness/authority claim rejection, inactive-key refusal, key-material mismatch refusal, tampered proof refusal, and stale payload refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ94 is closed. SQ95 is now the active next substrate question.
