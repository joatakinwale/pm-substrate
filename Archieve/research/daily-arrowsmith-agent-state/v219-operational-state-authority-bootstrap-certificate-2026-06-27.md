# v219 Operational State Authority Bootstrap Certificate

Date: 2026-06-27
Question closed: SQ166
Research lane: substrate discovery, root authority, authority-transition admission genesis

## Question

What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?

## Existing Substrate Map

- v179-v188 add authority-transition admission records so witness authority topologies can replay from admitted transition history after bootstrap.
- v189-v198 add witness records over authority-transition admissions so certificate-local admission rows are not enough.
- v199-v208 add nested witness authority topology so transition-admission witness certificates bind to a replayed signer set.
- v209-v218 require that nested witness topology to equal the latest projection of admitted nested authority-transition history.
- v218 still accepts genesis transition-admission certificates that name `authority-bootstrap` and a `bootstrap:*` topology hash, because the first transition has no previous topology to certify it.

## Missing Substrate Map

The transition-admission recursion now proves post-bootstrap authority, but the first admitted authority transition can still be operationalized from a string witness id and a remembered bootstrap topology hash. That is a root self-authorship path: an amnesiac agent, adapter, connector cache, or local fixture can assert `authority-bootstrap` without replaying any object that explains what root authority admitted the genesis transition.

The missing primitive is an authority bootstrap certificate. The first transition-admission record can use bootstrap authority only when a replayable certificate binds the tenant, scope, authority boundary, transition-admission store, topology id, bootstrap topology hash, root authority id, root evidence refs, signature identity, genesis admission record hash, first authority transition hash, and first derived topology hash.

## Arrowsmith Bridge

A literature: agent state fails at resume when the base case of authority is held in memory, configuration, or local fixture convention rather than replayed state.

B bridge: distributed authorization and trust-management systems do not eliminate root trust, but they make the trust base explicit, proof-carrying, and checkable. Accountable certificate systems add the further requirement that certificate state and attestations be durable enough to expose contradiction.

C literature:

- Abadi, Burrows, Lampson, and Plotkin, "A Calculus for Access Control in Distributed Systems", ACM TOPLAS 1993, https://homepages.inf.ed.ac.uk/gdp/publications/Calculus_for_Access_Control.pdf
- Blaze, Feigenbaum, and Lacy, "Decentralized Trust Management", IEEE Symposium on Security and Privacy 1996, https://www.cs.purdue.edu/homes/ninghui/readings/AccessControl/blaze_etal_oakland96.pdf
- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999, https://www.cs.princeton.edu/~appel/papers/says.pdf
- Buldas, Laud, and Lipmaa, "Accountable Certificate Management with Undeniable Attestations", ACM CCS 2000, https://eprint.iacr.org/2000/027 and https://research.aalto.fi/en/publications/accountable-certificate-management-with-undeniable-attestations/

Mechanism extracted: the bootstrap point is not a private exception to authorization. It is a named root statement with proof material. The requester should carry the proof, the guard should check it, and certificate-management state should be durable enough that contradictory roots become evidence instead of invisible disagreement.

## Primitive Proposal

Name: authority bootstrap certificate.

Problem it solves: genesis authority-transition admissions could rely on `authority-bootstrap` and a `bootstrap:*` topology hash as private belief.

Research source: access-control calculus, decentralized trust management, proof-carrying authentication, and accountable certificate management.

Mechanism borrowed or adapted: a root trust statement becomes a replayable proof object, not an ambient fact. Strict replay requires the genesis admission certificate to be accompanied by a bootstrap certificate binding the exact first admission record and first derived topology.

Why current substrate lacks it: post-bootstrap authority-transition admission is recursive, witnessed, topology-bound, and replayed, but the first transition has no prior topology and therefore used `authority-bootstrap` as an unproven base case.

Why existing primitives are insufficient: witness ledgers, nested topology replay, and admitted nested transition history prove later transitions. They do not explain why the first authority transition is legitimate.

State guarantee it should create: strict authority-transition admission replay cannot accept genesis authority from `authority-bootstrap` unless the first admission row is bound to a replayable root-authority bootstrap certificate.

Admission rule it requires: genesis admission may consume bootstrap authority only when `requireBootstrapCertificate` is true and `bootstrapCertificate` matches the exact tenant, scope, authority boundary, store, topology, bootstrap topology hash, root authority id, first admission record hash, first authority record hash, and first derived topology hash.

Replay rule it requires: replay rejects missing bootstrap certificate, tampered bootstrap certificate hash, root evidence absence, signature identity absence, root id not present in the genesis admission certificate, or certificate fields that do not match the first admitted transition.

Authority boundary it requires: the first implemented surface is finalizer-proof admission witness authority-transition admission. The bootstrap certificate type itself is generic and can be reused by other authority-transition admission ledgers.

Failure modes it should prevent:

- An amnesiac agent resumes nested finalizer transition-admission authority from a cached `authority-bootstrap` witness id.
- A connector supplies a first transition-admission record with a valid-looking certificate but no replayable root evidence.
- A local snapshot swaps the root id or bootstrap topology hash while preserving later transition replay.
- A root certificate authorizes one genesis transition while the replayed transition-admission ledger uses another.
- A root certificate is treated as mutable local configuration rather than an append-only operational artifact.

Minimal implementation slice:

- Add `OperationalStateAuthorityBootstrapCertificate`.
- Add hash/build/verify helpers for the certificate.
- Add `bootstrapCertificate` and `requireBootstrapCertificate` to finalizer-proof admission witness authority-transition admission replay.
- Reject missing, tampered, mismatched, evidence-empty, or signature-empty bootstrap certificates under strict replay.
- Return the consumed bootstrap certificate in replay output for downstream audit.
- Add append-only migration `0136_agent_state_authority_bootstrap_certificates.sql`.
- Add focused tests for valid bootstrap proof, missing certificate, missing evidence, missing signature, and mismatched root id.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A finalizer-proof admission witness authority-transition admission replay accepts genesis `authority-bootstrap` with `requireBootstrapCertificate: true` and no bootstrap certificate.
2. A bootstrap certificate with a tampered hash authorizes the first admission.
3. A bootstrap certificate with no `rootEvidenceRefs` authorizes the first admission.
4. A bootstrap certificate with empty signature identity or signature hash authorizes the first admission.
5. A bootstrap certificate whose `rootAuthorityId` was not named by the genesis admission certificate authorizes the first admission.
6. A bootstrap certificate bound to a different admission record, authority transition, topology, store, authority boundary, tenant, or scope authorizes the first admission.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OPERATIONAL_STATE_AUTHORITY_BOOTSTRAP_CERTIFICATE_SCHEMA_VERSION`
- `OperationalStateAuthorityBootstrapCertificateInput`
- `OperationalStateAuthorityBootstrapCertificate`
- `computeOperationalStateAuthorityBootstrapCertificateHash()`
- `buildOperationalStateAuthorityBootstrapCertificate()`
- `verifyOperationalStateAuthorityBootstrapCertificateHash()`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.bootstrapCertificate`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireBootstrapCertificate`
- finalizer transition-admission replay issue codes for missing, hash-mismatched, mismatched, evidence-empty, and signature-empty bootstrap certificates
- migration `0136_agent_state_authority_bootstrap_certificates.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can attempt finance seal recovery from a cached bootstrap topology and should be blocked unless the root certificate replays.
- Axis B can test a domain adapter that supplies `authority-bootstrap` without root evidence.
- Axis C can simulate amnesiac resume from a first transition-admission row whose post-bootstrap chain is valid but whose genesis proof is absent.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
2. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
3. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
4. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
5. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
6. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?
7. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?
8. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?
9. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?
10. SQ176: What bootstrap-certificate transparency or settlement primitive prevents two replayable root certificates from authorizing conflicting genesis histories for the same authority topology?

## Failed Assumption Ledger

- Failed assumption: once post-bootstrap authority-transition admission replays, genesis can remain a trusted string. It cannot; the base case must be an admitted proof object.
- Failed assumption: `authority-bootstrap` is harmless because it only appears at sequence 1. It is exactly the sequence where private belief can enter every later authority projection.
- New pressure: v219 does not yet settle conflicting root certificates. SQ176 should decide how root-certificate equivocation becomes a replayable obstruction.

## Proof Status

Verification completed for the implementation slice:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "requires authority epoch seal finalizer proof admission witness authority-transition admission genesis to bind to a root-authority bootstrap certificate"`: 1 passed, 232 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission"`: 4 passed, 229 skipped
- `pnpm typecheck`
- `pnpm test`: 637 passed, 143 skipped
- `git diff --check`
