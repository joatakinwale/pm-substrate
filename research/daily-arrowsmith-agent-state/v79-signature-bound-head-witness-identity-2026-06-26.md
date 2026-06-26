# v79 Signature-Bound Settlement-Head Witness Identity

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v78-settlement-head-authority-epoch-seal-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ26 - What signature-bearing witness identity model binds settlement-head observations, quorum certificates, and authority-epoch seals to principals so durable rows cannot impersonate witnesses or finalizers?

Answer: settlement-head witness observations and authority-epoch seals need principal-bound signature payloads whose principal id, key id, algorithm, and payload hash replay against the admitted head-witness authority topology. Under a strict identity policy, an observation is not quorum evidence unless its signature principal is the observer, the payload hash matches the replayed observation body, the principal was active at the observed settlement sequence, the signature key metadata matches the admitted principal key, and the configured verifier accepts the signature. An authority-epoch seal is not finality evidence unless its signature is from an active admitted principal over the exact seal transition body.

Implemented slice:

- Added settlement-head witness principal signature payloads and strict signature-policy replay hooks.
- Added deterministic signature payload hashes for settlement-head observations and authority transitions.
- Added admitted key metadata to settlement-head witness authority transitions and replayed principal state.
- Added signature validation issue codes for missing, wrong-principal, wrong-payload, unauthorized-principal, wrong-key, and verifier-rejected signatures.
- Persisted settlement-head observation signatures plus authority-transition key/signature fields through migration `0030`.
- Added store-backed quorum certification support for strict signature policy.
- Added falsification tests for signed observations, signed epoch seals, unsigned observations under strict policy, and wrong-key seal tampering.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Torres-Arias et al. 2019, "in-toto: Providing farm-to-table guarantees for bits and bytes" ([USENIX Security PDF](https://www.usenix.org/system/files/sec19-torres-arias.pdf)) | Supply-chain steps are recorded as authenticated functionary statements, so later verification checks who performed which step rather than trusting the artifact alone. | Settlement-head observations and epoch seals become signed functionary statements by admitted witness principals. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://pmg.csail.mit.edu/papers/osdi99.pdf)) | Replicas use authenticated messages; safety depends on messages attributable to participants in the protocol, not anonymous records. | A head-witness durable row cannot count for quorum unless its observer signature binds it to an active admitted principal. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Tamper-evident logs expose history mutation but still need authenticated statements to determine who issued log entries. | Hash-linked witness ledgers keep append-only integrity; v79 adds principal-authenticated row admission for the statements inside the ledger. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX Security PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Public-key directory snapshots are accountable only when clients can verify signed, consistent directory views and monitor key bindings. | Authority-epoch seals now carry verifier-checked principal signatures over the exact transition payload that finalizes a settlement-head authority epoch. |

## 3. Existing Substrate Map Delta

Already present before v79:

1. Settlement-head witness observations could be persisted and replayed.
2. Head-witness authority topology could admit/suspend/revoke/equivocate principals.
3. Store-backed quorum certification could derive eligible witnesses from durable topology.
4. Authority epochs could be sealed so later topology changes cannot rewrite the historical authority basis.

Newly strengthened by v79:

1. Strict head-witness replay can require a signature on each observation.
2. Observation signatures are bound to the observer id, head payload, optional consistency proof, and admitted active principal.
3. Authority-epoch seals can require a finalizer signature from an active admitted principal.
4. Admitted key metadata is replayed as principal state and compared against signatures.
5. Store-backed quorum certification can fail closed when durable rows are unsigned, signed by the wrong principal/key, or rejected by the verifier.

## 4. Missing Substrate Map Delta

Still missing:

1. Dedicated durable quorum-certificate records carrying the accepted witness signature set and seal linkage.
2. Production cryptographic verifier adapters and key-rotation/revocation status semantics.
3. Concurrency tests for simultaneous signed observations, seals, and topology changes.
4. Monitor proof that every strict write required signed head-witness identity.
5. Domain compiler support for declaring strict signature identity requirements.
6. Gossip or replication transport for signed head observations and seals outside one shared Postgres store.
7. Recovery-kernel composition that rehydrates latest signed/sealed head authority for every open scope.
8. Axis A/C runner adoption with strict signed head-witness policy.
9. External target-side finality after graph/capability mutation.
10. Formal obstruction algebra composition between invalid signatures, sealed authority epochs, projection conflicts, and local-view conflicts.

## 5. Active 10-Question Backlog

The active unanswered substrate research backlog contains exactly 10 questions:

1. SQ02: What typed authority topology should replace raw `authorityScope` strings so delegation, override, and revocation are replayable?
2. SQ03: What admission calculus composes evidence admission, provider status, terminal outcome, graph authority, and projection replay into one mutation decision?
3. SQ04: What replay rule makes connector cache, tool output, MCP handle state, and local filesystem/worktree state expire unless recertified?
4. SQ05: What obstruction algebra should represent disagreement between replay certificates, local views, authority scopes, and inter-agent consensus?
5. SQ06: What settlement/finality object proves an external target-side side effect was applied and cannot be replaced by a dispatch log?
6. SQ07: What recovery kernel lets an amnesiac agent rebuild all open operational scopes from terminal history, replay-certified projections, and continuity checkpoints?
7. SQ08: What domain authority compiler maps profile/capability contracts into required replay transitions without core substrate edits?
8. SQ09: What substrate primitive turns local worktree diffs and draft files into proposals that cannot outrank admitted transition history?
9. SQ10: What monitor/proof object can show that every operational write in a run passed replay-certificate enforcement, not just terminal-outcome recovery?
10. SQ27: What durable quorum-certificate record store binds certified settlement-head quorum certificates, witness signatures, and epoch seals into recoverable proof objects so recertification does not depend on transient recomputation?

## 6. Primitive Proposal Ledger

Name: Signature-Bound Settlement-Head Witness Identity.

Problem it solves: a durable head-witness ledger row or authority-epoch seal can otherwise impersonate a witness/finalizer merely by carrying an observer id or `recordedBy` string.

Research source: authenticated supply-chain functionary records, authenticated BFT protocol messages, tamper-evident logs, and signed transparency log heads.

Mechanism borrowed or adapted: make the operational statement carry a payload hash and principal signature, then replay that signature against the admitted authority topology and a verifier.

Why current substrate lacked it: v78 could prove append-only history, topology replay, quorum certification, and non-retroactive seals, but durable rows were still statements about principals rather than statements by principals.

Why existing primitives were insufficient: hash chains detect mutation after the fact; topology replay determines eligibility; neither proves that the eligible witness actually made the observation or seal.

State guarantee it should create: under strict identity policy, no settlement-head observation or epoch seal can become operational authority unless it is signed by the admitted principal whose authority is being counted.

Admission rule it requires: a strict store-backed quorum certifier must reject unsigned, wrong-principal, wrong-payload, unauthorized-principal, wrong-key, or verifier-rejected observation/seal statements before they count.

Replay rule it requires: replay recomputes the signature payload hash from the observation or transition body, checks principal/key eligibility at the settlement sequence, and invokes the verifier deterministically.

Authority boundary it requires: signature keys and algorithms are admitted through the head-witness authority transition history, not by adapter memory or test fixtures.

Failure modes it should prevent:

- forged durable observation rows with another observer id;
- unsigned rows satisfying quorum under strict policy;
- signed rows whose payload hash no longer matches the observed head;
- finality seals signed by non-members, stale members, or the wrong key;
- local recomputation treating stored rows as authority without principal authentication.

Minimal implementation slice:

- Add signature and key metadata types for settlement-head witness statements.
- Add deterministic signature payload hash helpers.
- Add strict replay validation for observation records and authority-epoch seals.
- Persist signature fields in durable stores.
- Add tests for successful signed certification and failed unsigned/wrong-key certification.

Tests that would falsify it:

- A strict store-backed quorum certificate accepts an unsigned observation.
- A strict replay accepts a signature whose principal id differs from the observer id.
- A strict replay accepts a signature payload hash that does not match the observation or seal body.
- A strict replay accepts a seal signed by a key different from the admitted principal key.
- A verifier rejection still allows the row or seal to count as authority.

Axis surfaces that could later validate it:

- Axis C can restart an agent and attempt to certify a head from unsigned durable rows.
- Axis A can require signed head-witness policy before ArrowHedge strict writes.
- Axis B can adopt the same signed identity primitive once accepted marketing/domain fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A store-backed certifier under strict identity policy certifies a head with two admitted signed witnesses.
2. A strict authority replay accepts a signed epoch seal from an active admitted principal.
3. An unsigned observation under strict identity policy obstructs store-backed certification.
4. A tampered epoch-seal signature key produces an invalid authority replay.
5. Signature payload hashes are recomputed from replayable statement bodies rather than trusted from caller memory.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable rows plus observer ids are enough to identify witnesses. | Falsified. | v79 adds strict signatures because rows can otherwise impersonate observer strings. |
| Hash-linked witness ledgers authenticate principals. | Falsified. | Hash chains detect mutation, but do not prove which principal made the statement. |
| Epoch seals are finality evidence without finalizer identity. | Falsified. | v79 requires strict seal signatures to prove the finalizer was an admitted active principal under policy. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessPrincipalSignature`.
- Strict signature-policy replay for settlement-head observations and authority-epoch seals.
- Signature payload hash helpers for observations and authority transitions.
- Signature/key mismatch issue codes.
- Admitted key metadata in settlement-head authority transitions and principal projection.
- In-memory/Postgres persistence of observation signatures and authority-transition signature fields via migration `0030`.
- Store-backed head quorum certification with strict identity policy.
- Tests for signed quorum/seal acceptance and unsigned/wrong-key rejection.

Remaining frontier:

1. Durable quorum-certificate record store.
2. Production cryptographic verifier/key-management adapters.
3. Key rotation and revocation status semantics.
4. Concurrency/transaction isolation for signed append paths.
5. Runtime monitor proof.
6. Runner/axis adoption.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused `@pm/capability-kit` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 68 tests; `packages/capability-kit/src/workflow-authority.test.ts` 21 tests.
- Full workspace `pnpm typecheck` passed.
- Broad substrate Vitest slice passed: 31 files passed, 388 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves strict signature-bound settlement-head witness identity as replayable substrate logic for observations and epoch seals. It does not yet prove durable quorum-certificate records, production cryptographic verification, key rotation/revocation, concurrent append isolation, monitor coverage, or end-to-end Axis A/B/C adoption.
