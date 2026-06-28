# v221 Operational State Privacy-Preserving Policy Proof

Date: 2026-06-27

Closed question: SQ168 - What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?

New question: SQ178 - What verifier-authority admission primitive makes privacy-preserving policy-proof verifiers replayable and non-self-authored without disclosing the private witness material they validate?

Outcome: add a new substrate mechanism.

## Research Sources

- Jan Camenisch and Anna Lysyanskaya, "An Efficient System for Non-transferable Anonymous Credentials with Optional Anonymity Revocation," EUROCRYPT 2001. Mechanism: credential possession can be demonstrated unlinkably without revealing the credential itself. Source: https://link.springer.com/chapter/10.1007/3-540-44987-6_7
- Jan Camenisch, Maria Dubovitskaya, Robert Enderlein, Anja Lehmann, Gregory Neven, Christian Paquin, Franz-Stefan Preiss, "Concepts and languages for privacy-preserving attribute-based authentication," Journal of Information Security and Applications, 2014. Mechanism: a verifier can consume a presentation policy and proof result while application code remains independent of concrete cryptographic protocols. Source: https://research.ibm.com/publications/concepts-and-languages-for-privacy-preserving-attribute-based-authentication
- Michael Rosenberg, Jacob White, Christina Garman, Ian Miers, "zk-creds: Flexible Anonymous Credentials from zkSNARKs and Existing Identity Infrastructure," IEEE Symposium on Security and Privacy 2023. Mechanism: a zero-knowledge proof can show that committed credentials satisfy flexible access criteria while hiding the credential, attributes, and how the criteria were satisfied. Source: https://www.cs.purdue.edu/homes/white570/media/zk-creds.pdf

## Existing Substrate Map

- `OperationalStatePruningPolicyAdmissionRecord` makes compiled pruning policies durable and replayable.
- `OperationalStatePruningPolicyAdmissionWitnessRecord` and nested witness-authority transition-admission replay can require policy-admission witness certificates to come from admitted authority topology instead of certificate-local witness rows.
- `evaluateOperationalStatePruningPolicyAdmission()` already rejects stale, missing, invalid, forked, or unwitnessed policy admission history.
- `reviewProposedActionAgainstCurrentState()` can block proposed actions when pruning-policy compliance or pruning-policy admission cannot be proven.

## Missing Substrate Map

- There was no proof object for "this private delegation or credential path satisfies policy" that keeps the private path outside operational state.
- Witness certificates disclosed accepted witness ids and could prove quorum, but they could not represent anonymous, selective-disclosure, or zero-knowledge authorization.
- Policy admission could be replay-current but still require callers to expose private delegation material or rely on local verifier memory.
- The storage layer had no append-only ledger that rejects private witness references at write time.
- The next gap is verifier authority: v221 can allowlist verifier ids, but it does not yet prove the verifier id itself was admitted by replayed verifier-authority history.

## Primitive Proposal

Name: `OperationalStatePrivacyPreservingPolicyProof`

Problem it solves: private belief, private delegation chains, or hidden credential attributes must not become operational state merely because they authorize policy access.

Mechanism borrowed or adapted: anonymous credentials and zk-style presentations separate the hidden witness from a public verifier statement. The substrate records only the public statement hash, verification-key hash, predicate commitment, hidden-witness commitment, proof transcript hash, challenge nonce, verifier id, result, and canonical proof hash.

Why current substrate lacked it: pruning-policy admission had durable records and witness certificates, but no public proof envelope for private authorization. The only strict path was "known witnesses certified this row," not "a verifier checked a private proof without exposing the private inputs."

Why existing primitives were insufficient: quorum certificates prove who witnessed a row; they do not prove a hidden credential predicate, and adding private delegation refs to witness metadata would make private representation operational state.

State guarantee: private witness or delegation material is excluded from operational state. A policy proof can authorize only when a replayable public proof envelope binds to the latest admitted policy record and an allowed verifier id.

Admission rule: strict pruning-policy admission may set `requirePrivacyPreservingPolicyProof`. Admission fails if the proof is missing, invalid, hash-tampered, tenant/scope/policy/subject-mismatched, produced by an unapproved verifier, missing verifier transcript material, discloses private inputs, or claims operational authority instead of credential predicates.

Replay rule: `policyProofHash` is computed over the canonical proof payload. The proof binds to `policyStoreId`, policy id/hash, policy-record hash, subject kind/id/sequence/hash, authority scope, authority boundary, verifier id, challenge nonce, and verifier transcript hashes.

Authority boundary: the proof authorizes only a pruning-policy admission predicate. Adapter claims are allowlisted to credential-predicate facts and cannot assert operational admission, currentness, transition authority, or finality.

Failure modes it prevents:

- A raw delegation chain is stored as proof and treated as state.
- A verifier result for one policy record is replayed against another record.
- A local verifier id outside the authority boundary authorizes action.
- An adapter smuggles "authority transition admitted" into proof claims.
- A hash-valid but private-input-bearing proof reaches storage.

Minimal implementation slice:

- Added `OperationalStatePrivacyPreservingPolicyProof` and `OperationalStatePrivacyPreservingPolicyProofInput`.
- Added `buildOperationalStatePrivacyPreservingPolicyProof()`, `computeOperationalStatePrivacyPreservingPolicyProofHash()`, and `verifyOperationalStatePrivacyPreservingPolicyProofHash()`.
- Extended `evaluateOperationalStatePruningPolicyAdmission()` with `privacyPreservingPolicyProof`, `requirePrivacyPreservingPolicyProof`, and `allowedPrivacyPreservingPolicyProofVerifierIds`.
- Extended action review with `pruningPolicyPrivacyPreservingPolicyProof`, `requirePruningPolicyPrivacyPreservingPolicyProof`, and allowed verifier ids.
- Added migration `0138_agent_state_privacy_preserving_policy_proofs.sql`, an append-only proof table that rejects non-empty `private_input_refs`.
- Added a falsification test proving valid proof admission and rejection for missing proof, private input disclosure, subject mismatch, unapproved verifier, and adapter claim overreach.

Tests that would falsify it:

- A strict pruning-policy admission succeeds with no privacy proof.
- A proof containing `privateInputRefs` succeeds.
- A proof bound to a different policy-record hash succeeds.
- A proof from a verifier outside the allowed verifier set succeeds.
- A proof adapter claim asserting operational authority succeeds.
- The append-only SQL table accepts non-empty private input refs or permits update/delete.

Axis surfaces that could later validate it:

- Axis A: finance policy admission where analyst delegation credentials are hidden but proof predicates authorize research ingestion.
- Axis B: marketing/domain adapter policy admission where customer/private campaign access attributes remain hidden.
- Axis C: direct local agent-state pressure where an amnesiac agent resumes with only admitted policy records and proof envelopes, not prompt memory or raw credentials.

## Implementation Frontier

v221 strengthens the pruning-policy admission boundary. It does not yet provide verifier-authority admission, verifier key-transparency, proof revocation/currentness, proof-ledger replay APIs, or cross-domain runtime adoption. SQ178 captures the next self-authoring risk: the verifier id must become replayable authority without exposing the hidden witness it validates.

## Proof Status

Implemented and locally verified in `@pm/agent-state` with focused typecheck and the new privacy-proof falsification test. Broader package and repo verification remain required before promotion.
