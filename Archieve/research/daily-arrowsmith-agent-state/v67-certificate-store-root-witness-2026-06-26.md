# v67 Certificate Store Root Witness

Date: 2026-06-26
Status: new substrate primitive implemented; typecheck and root test suite passed
Parent: `research/daily-arrowsmith-agent-state/v66-certificate-store-root-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ14 - What witness or root-gossip protocol should force divergent projection replay certificate-store roots to become obstructions across agents, resumes, and write gates?

Answer: append-only roots are not enough. pm-substrate needs a witness admission boundary for projection replay certificate-store roots. The minimal useful substrate primitive is a root witness that records the latest accepted root per tenant, accepts duplicate observations, accepts advances only with a valid consistency proof from the latest witnessed root, and emits an obstruction artifact for tenant mismatch, fork, regression, missing proof, or invalid proof.

Implemented slice:

- `ProjectionReplayCertificateStoreRootWitness` and witness decision/issue/obstruction types in `@pm/agent-state`.
- `evaluateProjectionReplayCertificateStoreRootObservation()` as the pure admission decision.
- `InMemoryProjectionReplayCertificateStoreRootWitness` for tests and local adapters.
- Witness advances require `ProjectionReplayCertificateStoreConsistencyProof`; unproved advances obstruct.
- Forks at the same sequence obstruct instead of becoming competing operational state.
- `WorkflowGraphWriteAuthorityEnvelope` can carry a root consistency proof.
- `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` can require a structural root witness before returning graph/capability write authority.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Li, Krohn, Mazières, and Shasha 2004, "SUNDR" ([USENIX](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr), [PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf)) | Fork consistency: an untrusted store can equivocate, but clients detect inconsistent histories once they observe each other's operations. | Two agents observing different certificate-store roots must not privately continue; the witness converts the fork into an obstruction. |
| Chuat, Szalachowski, Perrig, Laurie, and Messeri 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([arXiv](https://arxiv.org/abs/1511.01514), [PDF](https://netsec.ethz.ch/publications/papers/gossip2015.pdf)) | Clients exchange signed tree heads and consistency proofs so a log's split view becomes detectable. | Agents and write gates witness replay-store roots and require proof that a later root extends the prior witnessed root. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Users monitor provider-maintained bindings for consistency instead of trusting the provider's current response. | Agents monitor replay-certificate root bindings; a replay ref is not operational authority until its root is witnessed. |
| Oxford, Parker, and Ryan 2020, "Quantitative Verification of Certificate Transparency Gossip Protocols" ([IEEE](https://ieeexplore.ieee.org/document/9162197/), [PDF](https://www.prismmodelchecker.org/papers/spc20.pdf)) | Gossip success is a protocol property that can be model-checked; detection is not implied by roots alone. | pm-substrate should treat root-witnessing as an explicit admission step and later verify coverage, rather than assuming comparison happens. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Certificate-store roots now have a witness admission decision, not only a proof verifier.
2. Unproved root advances produce an obstruction before write authority is returned.
3. Same-sequence divergent roots produce a fork obstruction.
4. Invalid consistency proofs are normalized into root-witness issues.
5. Workflow/capability write authority can require witness acceptance before capability `apply()`.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable witness store: the implemented witness is in-memory, so process restart can lose witnessed roots unless an adapter persists them.
2. Automatic agent gossip: roots are witnessed when the authority path calls the witness, but independent agents are not yet forced to exchange roots outside that path.
3. Witness quorum/finality: one witness acceptance is not yet a settlement or global finality rule.
4. Root-witness audit trail: obstructions are replayable artifacts, but witness observations are not yet persisted as a queryable ledger.
5. General obstruction algebra: root obstructions are typed, but not yet unified with local-view, graph-authority, and certificate-store issues.
6. Adapter adoption: no domain runner currently requires both store commitment and root witness in a production path.
7. Run-wide proof: no monitor proves every write in a run passed root-witness acceptance.
8. Scalable membership: the certificate-store root remains a linear hash chain rather than a Merkle structure.
9. Bootstrap policy: first observation after sequence 1 requires proof from genesis, but witness discovery and trust topology are not yet modeled.
10. Cross-tenant witness topology: tenant scoping exists, but there is no authority model for who may witness or challenge another tenant's roots.

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
10. SQ15: What durable witness ledger or quorum rule makes root-witness observations themselves replayable across restarts, agents, and independent monitors?

## 6. Primitive Proposal Ledger

Name: Projection Replay Certificate Store Root Witness.

Problem it solves: v66 made divergent roots detectable if compared, but nothing forced comparison before operational authority.

Research source: SUNDR fork consistency, Certificate Transparency gossip, CONIKS self-monitoring, quantitative verification of gossip protocols.

Mechanism borrowed or adapted: agents observe root commitments, require consistency proofs for advances, and turn inconsistent histories into obstruction evidence.

Why current substrate lacked it: `ProjectionReplayCertificateStoreRoot` was a commitment object, not an admission boundary. Write authority could verify a root field without asking whether another agent had already witnessed an incompatible root.

Why existing primitives were insufficient: certificate lookup verifies one certificate; store roots verify an append-only chain; consistency proofs verify extension. None records the current witnessed root set or blocks a forked observed root before mutation.

State guarantee it should create: When root witnessing is required, graph/capability write authority cannot be returned from a replay ref whose certificate-store root is a fork, regression, unproved advance, tenant mismatch, or invalidly proved advance.

Admission rule it requires: `observeProjectionReplayCertificateStoreRoot()` must accept the observed root before write authority is returned.

Replay rule it requires: Any root advance beyond the latest witnessed root must include a consistency proof from that latest root to the observed root. The proof must chain entries contiguously and end at the observed root.

Authority boundary it requires: `@pm/agent-state` owns root-witness semantics; `@pm/capability-kit` consumes a structural witness before `apply()`; graph remains dependency-free and structural.

Failure modes it should prevent:

- an agent resumes from a forked replay-store root and mutates graph state;
- a later root is accepted without proof that it extends the witnessed root;
- a root with the wrong tenant becomes a tenant's operational authority;
- an invalid consistency proof hides a rewritten certificate-store entry;
- capability write authority is minted after a root witness reports obstruction.

Minimal implementation slice:

- Added root witness types, pure evaluator, obstruction artifact, and in-memory witness.
- Added capability-kit structural root witness interfaces.
- Added optional root consistency proof to workflow authority envelopes.
- Added workflow resolver root-witness gate before authority conversion.
- Added tests for initial/duplicate/advance/fork behavior, invalid proof obstruction, accepted authority after witness acceptance, and authority rejection after witness obstruction.

Tests that would falsify it:

- The witness accepts a second-sequence root without a consistency proof.
- The witness accepts two different roots at the same tenant/sequence.
- The witness accepts an invalid consistency proof.
- Capability-kit returns write authority after witness obstruction.
- Capability-kit calls the witness when the replay ref has no store-root commitment.

Axis surfaces that could later validate it:

- Axis C can run two resumed agents that observe conflicting roots and require an obstruction.
- Axis A can require root witnessing for ArrowHedge replay-certified graph writes.
- Axis B can require root witnessing for publication lifecycle projections once fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Initial root at sequence 1 must be accepted.
2. Duplicate root observation must be accepted without mutating root identity.
3. Root advance without proof must obstruct with `projection_replay_certificate_store_root_consistency_proof_missing`.
4. Root advance with a valid proof from the latest witnessed root must be accepted.
5. Same-sequence fork must obstruct with `projection_replay_certificate_store_root_fork`.
6. Invalid proof must obstruct with `projection_replay_certificate_store_root_consistency_proof_invalid`.
7. Workflow authority resolver must reject a witness obstruction before returning graph authority.
8. Workflow authority resolver must reject witness verification when the replay ref lacks a store-root commitment.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Append-only store roots alone make replay authority non-equivocating. | Falsified. | v66 roots only detect forks when compared; v67 adds a witness decision so comparison becomes an admission boundary. |
| Root comparison can remain an eval-side audit. | Rejected. | The witness gate now sits on the workflow-to-graph authority path before capability mutation. |
| An in-memory witness is enough for amnesiac recovery. | Downgraded. | The implemented witness proves the mechanism, but SQ15 must make observations durable/replayable across restarts and independent agents. |

## 9. Implementation Frontier

Implemented now:

- Root witness admission model and obstruction artifact.
- In-memory witness over accepted roots per tenant.
- Workflow authority envelope proof-carrying field.
- Capability-kit root witness gate before graph authority conversion.
- Focused tests for root witness and authority-path obstruction.

Remaining frontier:

1. Add durable root-witness ledger or quorum mechanism (SQ15).
2. Wire strict store commitment plus root witness into one real Axis A/C runner path.
3. Normalize root witness obstruction into a substrate-wide obstruction algebra.
4. Add run-wide proof that every write used replay certificate, certificate store, store root, and root witness gates.
5. Decide when a witnessed root becomes final, settled, or superseded.

## 10. Proof Status

Commands run:

```bash
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts
```

Result:

- Workspace typecheck passed across 22 packages.
- Root Vitest run passed: 47 files passed, 20 skipped; 434 tests passed, 143 skipped.

Proof boundary:

This proves that root witnessing can block private/forked replay-store roots on the graph/capability authority path when configured. It does not yet prove every agent is forced to gossip roots or that witnessed observations survive process restart.
