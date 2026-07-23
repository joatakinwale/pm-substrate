# v227 - Operational State Signature-Verifier Role Settlement Proof

Date: 2026-06-27
Question closed: SQ174
Status: Implemented in `@pm/agent-state`, migration added, focused falsification passed.

## Research Question

What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?

## Existing Substrate Map

- Signature verifier adapter proofs already prove cryptographic signature validity only, and strict evaluation rejects adapter claims over key currentness, principal authority, topology currentness, quorum authority, or transition admission.
- Signature key bindings already carry replayed principal/key material, authority sequence, authority topology hash, and key status.
- Signature verifier proof admission, proof-admission witness, witness-authority topology, nested authority-transition admission, and nested witness admission already make verifier proof admission replayable.
- v217 closed the self-authored witness-topology path by requiring signature-verifier proof-admission witness authority-transition admission witness authority topology to replay from admitted nested authority-transition history.

## Missing Substrate Map

- Before v227, `allowedVerifierIds` was still an evaluation input. A caller, adapter, connector cache, or local policy snapshot could decide which verifier ids were acceptable.
- There was no replayable verifier-role metadata object binding verifier id, verifier version, verifier role, allowed claims, verifier role key material, and validity authority frontier.
- There was no proof that verifier-role metadata appeared in a transparency log with inclusion and consistency evidence.
- There was no settlement certificate over the verifier-role metadata and transparency evidence.
- The next missing concept is transparency-head currentness/gossip: a proof can bind to one log head, but the substrate still needs a monitor/quorum protocol that prevents split transparency-tree heads from being accepted independently.

## Arrowsmith Bridge

A literature:

- Signature systems fail when cryptographic validity is confused with authorization, currentness, or role validity.
- Agent memory drift makes this worse: a cached verifier allowlist can become operational even after verifier upgrades, key rotation, or identity-provider changes.

B mechanism:

- Role metadata, delegated signing authority, key transparency, inclusion proof, consistency proof, and accountable certificate operations separate signature validity from authority to rely on a verifier.

C literature:

- Samuel, Mathewson, Cappos, and Dingledine, "Survivable Key Compromise in Software Update Systems." Mechanism: TUF uses responsibility separation, threshold signatures, delegated roles, metadata expiration, and revocation so one key or role cannot silently authorize everything.
- Kuppusamy, Torres-Arias, Diaz, and Cappos, "Diplomat: Using Delegations to Protect Community Repositories." Mechanism: role delegations define exactly which keys can speak for which package scope.
- Melara et al., "CONIKS: Bringing Key Transparency to End Users." Mechanism: key bindings are checked through a privacy-preserving transparency directory with consistency monitoring.
- Basin et al., "ARPKI: Attack Resilient Public-Key Infrastructure." Mechanism: certificate issuance, update, revocation, and validation are transparent and accountable.
- CTng, "Secure Certificate and Revocation Transparency." Mechanism: split-world attacks are addressed by consistent broadcast of log views.

Sources:

- https://freehaven.net/~arma/tuf-ccs2010.pdf
- https://www.usenix.org/system/files/conference/nsdi16/nsdi16-paper-kuppusamy.pdf
- https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf
- https://www.ndss-symposium.org/wp-content/uploads/2026-s213-paper.pdf

## Primitive Proposal

Name: Operational State Signature-Verifier Role Settlement Proof.

Problem it solves: a verifier adapter proof can be cryptographically valid while the decision that this verifier id/version is allowed remains local policy rather than admitted operational state.

Research source: TUF role metadata and revocation, Diplomat delegation maps, CONIKS key transparency, ARPKI accountable certificate operations, and CTng split-view resistance.

Mechanism borrowed or adapted: settle verifier-role metadata through a hash-bound proof that includes verifier id/version, role, allowed claims, verifier key material identifiers, validity frontier, transparency-log inclusion/consistency evidence, and a quorum certificate over the settlement claim.

Why current substrate lacked it: existing verifier proof admission made proof rows replayable, but `allowedVerifierIds` still came from evaluator input rather than admitted transition history or settled transparency evidence.

Why existing primitives were insufficient: key bindings prove principal key material; verifier proofs prove signature validity; proof admissions prove proof-row admission. None of those prove that the verifier role itself was authorized through replayable role metadata.

State guarantee it should create: strict signature-verifier evaluation can require verifier role settlement proof before accepting adapter output as operational signature state.

Admission rule it requires: `evaluateOperationalStateSignatureVerifierAdapterProof({ requireVerifierRoleSettlementProof: true })` rejects missing role settlement, wrong verifier id/version, overbroad allowed claims, stale validity frontier, missing transparency evidence, wrong transparency log, wrong settlement boundary, and wrong certificate subject.

Replay rule it requires: proof replay recomputes role metadata hash, settlement claim hash, proof hash, certificate hash, quorum sufficiency, role claim boundaries, transparency evidence presence, and validity frontier.

Authority boundary it requires: tenant, authority scope, verifier id, verifier version, role metadata sequence, verifier role settlement authority boundary, transparency log id/tree head, and key-binding authority sequence for currentness.

Failure modes it should prevent:

- A local `allowedVerifierIds` array authorizes a verifier after restart.
- A stale connector cache keeps an old verifier version operational after rotation.
- A verifier proof claims key currentness or principal authority through role metadata.
- A verifier role proof lacks transparency-log inclusion or consistency evidence.
- A certificate over unrelated local policy is reused as verifier-role settlement.
- A verifier role is valid outside its authority-sequence frontier.

Minimal implementation slice:

- Add `OperationalStateSignatureVerifierRoleSettlementProof`.
- Add role metadata hash, settlement claim hash, proof hash, builder, verifier, and evaluator.
- Extend signature-verifier proof evaluation with `requireVerifierRoleSettlementProof`.
- Persist append-only proof envelopes in migration `0144`.
- Add focused falsification tests for valid settlement, missing proof, wrong verifier, overbroad claims, and wrong certificate subject.

Tests that would falsify it:

- Strict verifier evaluation without role settlement proof must fail.
- Valid role settlement proof must allow strict verifier evaluation without `allowedVerifierIds`.
- A role settlement proof for another verifier id must fail.
- A proof that settles non-signature-validity claims must fail.
- A certificate over a private local allowlist hash must fail.

Axis surfaces that could later validate it:

- Axis A finance pressure: finance signatures cannot be admitted through local verifier allowlists.
- Axis B domain-adapter pressure: domain adapters cannot smuggle verifier policy as adapter configuration.
- Axis C local agent-state pressure: amnesiac resume must recover verifier role authority from settled metadata proof, not conversation memory.

## Implementation Frontier

Implemented:

- `OperationalStateSignatureVerifierRoleSettlementProof`.
- Deterministic role metadata, settlement claim, and proof hashing.
- `evaluateOperationalStateSignatureVerifierRoleSettlementProof()`.
- Strict verifier proof gate through `requireVerifierRoleSettlementProof`, `verifierRoleSettlementProof`, `requiredVerifierRoleSettlementAuthorityBoundary`, and `requiredVerifierTransparencyLogId`.
- Migration `0144_agent_state_signature_verifier_role_settlement_proofs.sql`.
- Focused test for valid settlement plus missing proof, wrong verifier, overbroad claims, and wrong certificate subject rejection.

Not implemented:

- Transparency-head gossip or monitor-quorum currentness for split verifier-role logs.
- Runtime adoption in every strict verifier proof call site.
- Durable verifier-role metadata transition ledger separate from settlement proof storage.
- Axis A/B/C scenarios that exercise real adapter verifier rotation and transparency-log forks.

## Failed Assumption Ledger

- Falsified assumption: replayed key binding plus admitted verifier proof row is enough. It is not enough while the set of acceptable verifier ids remains caller-supplied policy.
- Current model insufficiency: the substrate still needs transparency-head currentness/gossip so different agents cannot accept verifier-role settlements from split transparency-log heads.

## Active 10-Question Substrate Backlog

1. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?
2. SQ176: What bootstrap-settlement transparency or head-gossip primitive prevents split bootstrap settlement histories from authorizing competing genesis histories for the same authority topology?
3. SQ177: What signer, witness, quorum, or admission authority makes bootstrap settlement records themselves non-self-authored without reintroducing private root memory?
4. SQ178: What verifier-authority admission primitive makes privacy-preserving policy-proof verifiers replayable and non-self-authored without disclosing the private witness material they validate?
5. SQ179: What verifier-authority admission primitive makes separation-of-duty proof verifiers replayable and non-self-authored so role-separation checks cannot become private authority?
6. SQ180: What compaction-checkpoint witness/currentness primitive makes authority-transition ledger compaction checkpoint-admission histories non-equivocating across agents, restarts, and split compaction stores?
7. SQ181: What quorum-subsumption or heterogeneous-composition primitive proves that authority topologies compose beyond pairwise intersection, so recovery cannot pass when local quorum intersection is necessary but insufficient?
8. SQ182: What semantics-migration proof or state-transformer admission primitive lets an admitted transition history intentionally move from one replay algebra to another without silent reinterpretation?
9. SQ183: What settlement-authority admission or configuration-master currentness primitive prevents topology-settlement proofs themselves from being self-authored or split across settlement masters?
10. SQ184: What transparency-head gossip or monitor-quorum currentness primitive prevents verifier-role settlement proofs from accepting split key-transparency log heads?

## Proof Status

- `pnpm --filter @pm/agent-state typecheck`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "verifier role settlement"`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed.
- `git diff --check`: passed.
