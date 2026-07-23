# v70 Witness Authority Topology

Date: 2026-06-26
Status: new substrate primitive implemented; focused agent-state tests/typecheck passed
Parent: `research/daily-arrowsmith-agent-state/v69-root-witness-settlement-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ17 - What witness-principal authority topology decides which replayed witness ledgers are eligible to count toward settlement, and how are equivocation, revocation, and membership epochs admitted?

Answer: settlement cannot count raw witness ids. The missing substrate primitive is a replayed witness-authority topology: an ordered, hash-linked transition history that sets quorum, admits witness principals, suspends/revokes principals, and marks equivocation. Settlement may still consume replayed witness ledgers, but when a witness-authority topology is supplied it counts only principals that are active and eligible for the root sequence being settled.

Implemented slice:

- `ProjectionReplayCertificateStoreRootWitnessAuthorityTransition` and transition kinds: `set_quorum`, `admit_witness`, `suspend_witness`, `revoke_witness`, `mark_equivocated`.
- Deterministic transition hashing and previous-hash chaining.
- `replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions()` to derive current eligible witness principals and quorum for a root sequence.
- Settlement integration: `evaluateProjectionReplayCertificateStoreRootWitnessSettlement()` can now consume an authority topology, derive thresholds from it, reject policy/topology mismatch, and refuse non-eligible witness ledgers.
- Tests proving eligible topology-bound settlement, non-member refusal, equivocated-principal refusal, and invalid topology obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | Raft changes cluster membership through a logged configuration mechanism that preserves safety through overlap. | Witness-set membership is not a caller parameter; it is replayed from ordered authority transitions. |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf)) | Reconfiguration can be managed by an auxiliary configuration authority rather than hidden inside each replica's local state. | pm-substrate separates witness-set authority from witness ledger acceptance and makes topology an explicit replayed authority surface. |
| Gilbert, Lynch, and Shvartsman 2003, "RAMBO II" ([PDF](https://www.comp.nus.edu.sg/~gilbert/pubs/RamboII-DSN.pdf)) | Dynamic participation requires explicit configurations and reconfiguration protocols; quorum systems cannot be assumed static forever. | The witness set is epoch-like and root-sequence scoped, so future transitions can change eligibility without rewriting old settlement history. |
| Melara et al. 2015, "CONIKS" ([USENIX PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf), [Princeton metadata](https://collaborate.princeton.edu/en/publications/coniks-bringing-key-transparency-to-end-users-2/)) | Key bindings require consistency monitoring and non-equivocation auditing. | Witness identities become monitored principals; equivocation can be recorded as an authority transition that removes settlement eligibility. |
| Kim et al. 2013, "Accountable Key Infrastructure" ([ACM](https://dl.acm.org/doi/10.1145/2488388.2488448), [PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Key validation needs revocation and checks-and-balances rather than trust in one authority. | Witness principal eligibility can be revoked or suspended through replayed transitions before settlement counts the witness. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Witness ids can now be backed by replayed witness-principal authority transitions.
2. Quorum thresholds can come from replayed authority topology instead of ad hoc settlement policy.
3. Authority transitions are hash-linked by `previousAuthorityHash`.
4. Topology replay validates tenant, sequence, previous hash, transition hash, root-sequence applicability, and quorum shape.
5. Settlement refuses non-member, revoked, suspended, or equivocated witnesses because they are absent from the eligible witness projection.
6. Settlement obstructs when topology replay fails, rather than falling back to raw witness ids.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable authority-transition store: topology transitions are pure replay inputs but not yet persisted in a substrate-owned ledger.
2. Durable settlement certificate store: settlement objects are hashable but not yet admitted as their own transition history.
3. Write-gate adoption: graph/capability gates do not yet require settled roots under an authority topology.
4. Cryptographic witness principals: the topology records witness ids, not public keys, signatures, or aggregate quorum certificates.
5. Membership reconfiguration proof: the current transition history is linear; it does not yet enforce joint-consensus overlap or equivalent safety across topology epochs.
6. Equivocation evidence binding: `mark_equivocated` is an authority transition, but the evidence that proves equivocation is not yet structurally attached.
7. Recovery and reinstatement rules: revoked or equivocated witnesses can be re-admitted by a later transition, but no policy distinguishes legitimate rotation from unsafe reinstatement.
8. Settlement publication/gossip: topology and settlement heads are not yet published to independent monitors.
9. Domain compiler adoption: domains cannot yet declare their required witness topology or settled-root policy.
10. End-to-end proof: no run-wide monitor proves every operational write used replayed certificate, root, witness, topology, and settlement gates.

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
10. SQ18: What durable authority-transition and settlement-certificate store prevents callers from supplying synthetic witness topology or settlement objects?

## 6. Primitive Proposal Ledger

Name: Projection Replay Root Witness Authority Topology.

Problem it solves: v69 settlement could require a quorum, but the quorum was over caller-provided witness ids rather than replayed witness-principal authority.

Research source: Raft membership changes, Vertical Paxos configuration authority, RAMBO/RAMBO II dynamic configurations, CONIKS key transparency, and AKI revocation/accountability.

Mechanism borrowed or adapted: represent eligibility as replayed configuration history. The current admissible projection for settlement is the active witness-principal set derived from authority transitions at the root sequence.

Why current substrate lacked it: settlement had `witnessId` strings and thresholds, but no replayable answer for which ids were legitimate witnesses.

Why existing primitives were insufficient: witness ledgers prove what a witness observed; settlement counts witnesses; neither proves that a witness principal is eligible, not revoked, not suspended, and not known to have equivocated.

State guarantee it should create: A root cannot be settled under a topology-bound policy unless enough valid witness ledgers belong to active, replay-eligible witness principals for that root sequence.

Admission rule it requires: Authority transitions must be tenant-scoped, sequence-contiguous, hash-linked, and effective for the root sequence before they can shape settlement.

Replay rule it requires: Replaying transitions derives quorum thresholds, principal status, eligible witness ids, latest authority hash, and topology issues. Settlement must obstruct if topology replay is invalid.

Authority boundary it requires: `@pm/agent-state` owns topology replay and settlement eligibility. Domains, agents, tools, and connectors cannot promote an unregistered witness id by assertion.

Failure modes it should prevent:

- arbitrary witness ids being counted toward settlement;
- revoked or equivocated witnesses continuing to authorize roots;
- topology tampering silently weakening quorum;
- settlement policy disagreeing with replayed topology;
- caller memory choosing the active witness set.

Minimal implementation slice:

- Added authority transition, principal state, topology, and issue types.
- Added deterministic authority transition hashing.
- Added authority topology replay.
- Integrated topology into settlement evaluation.
- Added topology-bound settlement tests.

Tests that would falsify it:

- A non-member witness ledger counts toward a topology-bound quorum.
- A `mark_equivocated` witness remains eligible.
- A tampered authority transition still produces a valid topology.
- Settlement falls back to raw witness ids after topology replay fails.
- A caller-supplied policy can silently override replayed topology quorum.

Axis surfaces that could later validate it:

- Axis C can run an amnesiac resume with a revoked monitor and prove its ledger cannot settle state.
- Axis A can require ArrowHedge write roots to settle under a finance witness topology.
- Axis B can require publication lifecycle roots to use a profile-owned witness topology once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Replayed topology with quorum two and active witnesses A/B must allow A+B to settle.
2. A non-member witness with a valid root ledger must not count.
3. An equivocated witness with a valid root ledger must not count.
4. A tampered topology transition must make topology replay invalid.
5. Settlement with invalid topology must be obstructed and must not fall back to raw witness ids.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Witness ids are adequate settlement principals. | Falsified. | v70 non-member test shows a valid root ledger cannot count without replayed principal eligibility. |
| Revocation/equivocation can be handled outside settlement. | Falsified. | v70 topology replay removes equivocated witnesses before settlement counts quorum. |
| A caller policy can define quorum independently of authority topology. | Rejected. | Settlement emits policy/topology mismatch when both are supplied and disagree. |
| Topology can be trusted as a plain object. | Falsified. | v70 tampered-topology test obstructs settlement when authority transition replay fails. |

## 9. Implementation Frontier

Implemented now:

- Hash-linked witness-authority transitions.
- Topology replay at a certificate-store root sequence.
- Active witness-principal projection.
- Settlement gating through replayed eligibility.

Remaining frontier:

1. Add a durable authority-transition store and replay API (SQ18).
2. Add a durable settlement certificate store.
3. Require topology-bound settlement in capability-kit/graph write authority under strict policy.
4. Attach equivocation evidence refs to `mark_equivocated`.
5. Model safe membership reconfiguration across epochs.
6. Add cryptographic principal material and signature verification.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts
```

Result:

- `@pm/agent-state` typecheck passed.
- `packages/agent-state/src/index.test.ts`: 49 tests passed.
- Full workspace `pnpm typecheck` passed.
- Broad Vitest authority slice passed: 47 files passed, 443 tests passed, 143 skipped.

Proof boundary:

This proves topology-bound settlement eligibility in pure substrate code. It does not yet prove durable admission of authority transitions, cryptographic witness principals, settlement certificate persistence, or strict write-gate adoption.
