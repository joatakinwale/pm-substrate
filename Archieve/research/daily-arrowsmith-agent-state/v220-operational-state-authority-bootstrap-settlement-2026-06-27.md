# v220 Operational State Authority Bootstrap Settlement

Date: 2026-06-27
Question closed: SQ167
Research lane: substrate discovery, root authority, settlement/meta-admission

## Question

What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?

## Existing Substrate Map

- v219 made `authority-bootstrap` explicit as an `OperationalStateAuthorityBootstrapCertificate` and strict finalizer transition-admission genesis replay can require that certificate.
- The v219 certificate binds tenant, authority scope, boundary, transition-admission store, topology id, bootstrap topology hash, root authority id, root evidence refs, signature identity, first admission hash, first authority-transition hash, and first derived topology hash.
- v219 still consumes one supplied certificate object. It verifies the object, but it does not prove that the object came from a settled root registry or that no competing certificate was settled for the same root key.

## Missing Substrate Map

The substrate had a replayable root proof object but not a replayable root settlement object. That left a weaker path:

- one agent can resume with bootstrap certificate A;
- another agent can resume with bootstrap certificate B;
- both certificates can be hash-valid and bind a genesis transition;
- the finalizer transition-admission replay had no substrate-native settlement history that makes same-key conflict an obstruction.

The missing primitive is a bootstrap settlement ledger: an append-only, replayed meta-admission history for root bootstrap certificates keyed by tenant, authority scope, authority boundary, transition-admission store, and topology. A certificate can authorize genesis only when strict replay sees that exact certificate in the settlement history and the settlement history contains no competing certificate for the same key.

## Arrowsmith Bridge

A literature: agent memory drift and amnesiac resume become dangerous when root authority is supplied as local configuration, summary, or remembered ceremony instead of replayed operational history.

B bridge: transparent PKI systems do not make trust disappear. They move certificate acceptance into append-only logs, verifiable inclusion/currentness proofs, consistency proofs, and checks for equivocation or split views.

C literature:

- Melara, Blankstein, Bonneau, Felten, and Freedman, "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015, https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Basin, Cremers, Kim, Perrig, Sasse, and Szalachowski, "ARPKI: Attack Resilient Public-Key Infrastructure", ACM CCS 2014, https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE S&P 2016, https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Yu, Cheval, and Ryan, "DTKI: a new formalized PKI with verifiable trusted parties", The Computer Journal 2016, https://chevalvi.gitlabpages.inria.fr/chevalvi/files/YCR-tcj16.pdf

Mechanism extracted: a root certificate is not enough. The accepted root mapping must appear in a replayable settlement history, and settlement replay must detect conflicting mappings for the same namespace/root key.

## Primitive Proposal

Name: authority bootstrap settlement.

Problem it solves: v219 root certificates were replayable proof objects, but strict replay still accepted whichever certificate the caller supplied.

Research source: CONIKS key transparency, ARPKI accountable PKI, CoSi witness cosigning, and DTKI transparent mapping/certificate logs.

Mechanism borrowed or adapted: certificate acceptance is separated from certificate existence. The certificate must be included in an append-only settlement history, and same-key conflicting certificates turn the history invalid.

Why current substrate lacks it: the substrate had post-bootstrap authority-transition replay, nested admission replay, and a root bootstrap certificate, but no meta-admission ledger for root certificates themselves.

Why existing primitives are insufficient: `OperationalStateAuthorityBootstrapCertificate` proves a single root statement is structurally well formed. It does not settle one root statement as the operational one for a tenant/scope/topology, nor does it obstruct two well-formed competing root statements.

State guarantee it should create: strict genesis authority-transition admission cannot consume a bootstrap certificate as operational root authority unless that certificate replays from the authority bootstrap settlement history and that history contains no same-key conflicting bootstrap certificate.

Admission rule it requires: a bootstrap settlement record binds the exact bootstrap certificate hash plus the tenant, authority scope, authority boundary, transition-admission store, topology, root authority, genesis admission hash, first authority-transition hash, and first derived topology hash.

Replay rule it requires: settlement records replay as a contiguous append-only sequence; each record hash and embedded bootstrap certificate hash must recompute; the settlement key must match the certificate namespace; and two different certificate hashes for the same settlement key invalidate replay.

Authority boundary it requires: the first strict consumer is finalizer-proof admission witness authority-transition admission genesis. The primitive is generic and can be reused by every authority-transition admission lane.

Failure modes it should prevent:

- An amnesiac agent supplies a hash-valid root certificate that was never settled.
- Two agents resume with different hash-valid root certificates for the same topology genesis.
- A connector cache swaps the settled root certificate while preserving the first transition-admission record.
- A local fixture treats the bootstrap certificate store as proof of settlement without replaying settlement history.
- A finalizer nested authority replay accepts a root certificate from private memory even while a different certificate is the settled one.

Minimal implementation slice:

- Add `OperationalStateAuthorityBootstrapSettlementRecord`.
- Add settlement key, hash/build/verify helpers.
- Add `replayOperationalStateAuthorityBootstrapSettlementRecords()`.
- Detect missing required certificate, tampered required certificate, sequence forks, hash-chain gaps, settlement-key mismatch, record/certificate mismatch, and same-key certificate conflicts.
- Extend finalizer transition-admission replay with `bootstrapSettlementReplay` and `requireBootstrapSettlement`.
- Reject missing, invalid, or mismatched settlement replay before genesis root authority can be consumed.
- Add append-only migration `0137_agent_state_authority_bootstrap_settlement_records.sql`.
- Add focused tests for valid settlement, missing settlement, unsettled certificate, and conflicting same-key certificates.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict settlement mode:

1. A finalizer transition-admission genesis accepts a bootstrap certificate when `requireBootstrapSettlement: true` and no settlement replay is supplied.
2. A finalizer transition-admission genesis accepts bootstrap certificate A while the settlement replay's required record settles certificate B.
3. A bootstrap settlement replay accepts two different certificate hashes for the same tenant, authority scope, authority boundary, transition-admission store, and topology.
4. A settlement record with a tampered record hash or embedded certificate hash remains valid.
5. A settlement record whose settlement key does not match its certificate namespace remains valid.
6. A strict settlement replay has no `requiredBootstrapCertificate` but still claims to prove the caller's consumed root certificate.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OPERATIONAL_STATE_AUTHORITY_BOOTSTRAP_SETTLEMENT_SCHEMA_VERSION`
- `OperationalStateAuthorityBootstrapSettlementRecordInput`
- `OperationalStateAuthorityBootstrapSettlementRecord`
- `OperationalStateAuthorityBootstrapSettlementReplayInput`
- `OperationalStateAuthorityBootstrapSettlementReplay`
- `computeOperationalStateAuthorityBootstrapSettlementKey()`
- `computeOperationalStateAuthorityBootstrapSettlementRecordHash()`
- `buildOperationalStateAuthorityBootstrapSettlementRecord()`
- `verifyOperationalStateAuthorityBootstrapSettlementRecordHash()`
- `replayOperationalStateAuthorityBootstrapSettlementRecords()`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.bootstrapSettlementReplay`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireBootstrapSettlement`
- finalizer transition-admission replay issue codes for missing settlement replay, invalid settlement replay, and unsettled bootstrap certificates
- migration `0137_agent_state_authority_bootstrap_settlement_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can try to recover finance operational state from a settled-looking but privately supplied root certificate; strict replay should demand settlement history.
- Axis B can test a domain adapter that supplies two root certificates for the same topology and should receive a settlement obstruction.
- Axis C can simulate two amnesiac agents resuming from different root bootstrap certificates and prove neither can operationalize state unless the same settlement history replays.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
2. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
3. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
4. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
5. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?
6. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?
7. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?
8. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?
9. SQ176: What bootstrap-settlement transparency or head-gossip primitive prevents split bootstrap settlement histories from authorizing competing genesis histories for the same authority topology?
10. SQ177: What signer, witness, quorum, or admission authority makes bootstrap settlement records themselves non-self-authored without reintroducing private root memory?

## Failed Assumption Ledger

- Failed assumption: a replayable root certificate is enough to terminate authority recursion. It is not; the root certificate must itself be settled by replayed operational history.
- Failed assumption: conflicting root certificates are only a transparency problem later. They must already be settlement obstructions inside local replay when both certificates appear in the same settlement history.
- New pressure: v220 settlement records are still self-authored rows unless a signer/witness/quorum authority is added. SQ177 should decide how settlement records become accountable without recreating the bootstrap recursion.

## Proof Status

Verification completed for the implementation slice:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "requires authority epoch seal finalizer proof admission witness authority-transition admission genesis bootstrap certificates to replay from settlement history"`: 1 passed, 233 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission"`: 5 passed, 229 skipped
- `pnpm typecheck`
- `pnpm test`: 638 passed, 143 skipped
