# v73 Settlement Currentness

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v72-settled-root-write-gate-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ20 - What settlement-currentness model prevents an old durable settled-root certificate from authorizing writes after later obstruction, topology change, policy supersession, or settlement-store fork?

Answer: a settled-root ref is not current authority by itself. It is a historical proof pointer. At decision time, the mutation boundary must verify the ref against replayed settlement history plus an explicit currentness policy. The policy can require the latest settled root, the latest settlement record for that root, no later same-sequence conflict, no later obstruction, a minimum known settlement frontier, or a required authority-topology hash. A ref can therefore remain historically valid while no longer admissible as write authority.

Implemented slice:

- Added `ProjectionReplayCertificateStoreRootWitnessSettlementCurrentnessPolicy` to `@pm/agent-state`.
- Extended settlement-ref verification with stale, conflict, currentness-frontier, and authority-topology mismatch issue codes.
- Settlement store verification now accepts currentness policy for both in-memory and Postgres-backed stores.
- Added `WorkflowGraphWriteProjectionReplayRootSettlementCurrentnessPolicy` to `@pm/capability-kit`.
- Capability-kit workflow authority resolution now passes currentness policy to the settlement store before returning graph authority.
- Added falsification tests for newer settled roots, superseded same-root settlement records, later same-sequence conflicting roots, later obstructions, and capability-kit currentness-policy propagation.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Gray and Cheriton 1989, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency" ([PDF](https://web.eecs.umich.edu/~mosharaf/Readings/Leases.pdf), [ACM](https://dl.acm.org/doi/10.1145/74851.74870)) | Cached authority is valid only within a bounded term; after expiry or conflicting writes, the holder must revalidate with the authority source. | A settled-root ref is treated as a lease-like authority pointer: it must be checked against current settlement history before it can support mutation. |
| Larisch et al. 2017, "CRLite: A Scalable System for Pushing All TLS Revocations to All Browsers" ([PDF](https://cbw.sh/static/pdf/larisch-oakland17.pdf)) | Certificate validity requires current revocation status at use time; fail-closed behavior is preferable when status data is unavailable. | Settlement currentness adds explicit status checks so a historical settlement certificate cannot authorize writes after later revocation-like settlement events. |
| Kim et al. 2013, "Accountable Key Infrastructure" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Public logs, checks and balances, revocation, and hold times prevent a valid-looking key from remaining current authority after update or compromise. | Settlement refs now admit a minimum settlement frontier and topology-hash requirement, but hidden store truncation remains a next primitive. |
| Basin et al. 2014, "ARPKI" ([PDF](https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf)) | Certificate issuance, update, revocation, and validation become transparent, accountable operations over public log servers and formal checks. | Settlement validation is no longer just a record lookup; it is a replayed status decision over the settlement ledger. |
| Corbett et al. 2012, "Spanner: Google's Globally-Distributed Database" ([USENIX](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett), [PDF](https://research.google.com/archive/spanner-osdi2012.pdf)) | External consistency ties observable transaction order to a system-defined time/order discipline, not to client memory. | Settlement authority is tied to replayed settlement order and caller-known frontier, not to an agent's remembered "latest" root. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Settlement refs are now historical proof pointers, not automatically current authority.
2. Settlement verification can require the latest settled certificate-store root.
3. Settlement verification can require the latest settlement record for the same root.
4. Settlement verification can reject refs followed by same-sequence conflicting roots.
5. Settlement verification can reject refs followed by obstructed settlement records.
6. Settlement verification can require a minimum caller-known settlement sequence to detect stale local views or visible store truncation.
7. Settlement verification can require the current witness-authority topology hash when the caller has a replayed topology frontier.
8. Capability-kit can require these currentness checks before constructing workflow-derived graph write authority.

## 4. Missing Substrate Map Delta

Still missing:

1. Store-head transparency: currentness cannot detect a settlement store that hides later records unless a caller supplies a minimum frontier or an independent head witness exists.
2. Settlement-ref status events: currentness is replayed from settlement records but there is not yet a separate revocation/suspension status event stream for settlement refs.
3. Topology frontier binding: callers can require an authority-topology hash, but there is not yet a shared current topology-head proof passed through every write gate.
4. Domain compiler adoption: domains cannot yet declare that specific capabilities require latest-root or no-later-obstruction currentness.
5. End-to-end run monitor: no proof object yet shows every graph/capability write in a run used settlement currentness policy.
6. Cryptographic signatures on settlement refs and settlement-currentness proofs.
7. Concurrent Postgres settlement append isolation and store-head race tests.
8. External target-side finality after graph/capability mutation.
9. Recovery kernel composition that rebuilds current settlement policy from terminal history, replay roots, witness ledgers, topology, and settlement stores.
10. Policy supersession ledger that states which currentness policy applies to each mutation class.

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
10. SQ21: What settlement-store head transparency or witness primitive prevents a settlement store from hiding later currentness records or serving a truncated fork when the caller lacks a minimum frontier?

## 6. Primitive Proposal Ledger

Name: Projection Replay Settlement Currentness Policy.

Problem it solves: v72 let a strict write gate require a durable settled-root ref, but that ref could remain usable after later settlement history made it stale, obstructed, superseded, or topology-incompatible.

Research source: leases, CRLite, accountable key infrastructure, ARPKI, and Spanner.

Mechanism borrowed or adapted: validation happens at use time against current status/order history, not only against a historical proof object.

Why current substrate lacked it: settlement refs proved that a root once reached settled status. They did not prove that no later admitted settlement event had superseded, obstructed, or conflicted with that proof.

Why existing primitives were insufficient: replay certificates prove projection identity, store roots prove certificate-store commitment, witnesses prove root observation, settlement proves quorum. None of these make a historical settled ref current after later settlement history is admitted.

State guarantee it should create: under a currentness policy, a graph/capability mutation cannot use an old settled-root ref as operational authority if replayed settlement history shows a newer settled root, a newer settlement record for the same root, a later obstruction, a same-sequence conflict, a required frontier beyond the ref, or a required topology hash mismatch.

Admission rule it requires: settlement-store verification must accept a currentness policy and add stale/conflict/frontier/topology issues before capability-kit returns graph authority.

Replay rule it requires: replay the settlement ledger, resolve the ref to an admitted settled record, then compare that record to replayed settled roots and later settlement records under the requested currentness policy.

Authority boundary it requires: the settlement store is the status authority for visible settlement history; capability-kit is the mutation-boundary consumer. Agents, summaries, local snapshots, or envelopes cannot decide currentness themselves.

Failure modes it should prevent:

- an old settled root authorizing writes after a newer root is settled;
- an old settlement record authorizing writes after a later same-root status record exists;
- an old ref authorizing writes after a later same-sequence conflicting root appears;
- an old ref authorizing writes after a later obstruction;
- a caller with a known settlement frontier accepting a ref below that frontier;
- a topology-superseded settlement ref satisfying strict authority.

Minimal implementation slice:

- Added currentness policy and issue codes in `@pm/agent-state`.
- Added currentness checks to settlement-ref verification.
- Passed currentness policy through in-memory/Postgres settlement stores.
- Added capability-kit structural currentness policy and resolver propagation.
- Added focused falsification tests.

Tests that would falsify it:

- A ref for root sequence 1 stays valid under `requireLatestSettledRoot` after root sequence 2 is settled.
- A first settlement record stays valid under `requireLatestSettlementForRoot` after a later same-root record exists.
- A settled ref stays valid under `disallowLaterConflictingRoot` after a later same-sequence conflicting root record exists.
- A settled ref stays valid under `disallowLaterObstruction` after a later obstructed settlement record exists.
- Capability-kit receives a currentness policy but does not pass it to settlement-store verification.

Axis surfaces that could later validate it:

- Axis C can run an amnesiac local-agent write with a stale settled-root ref and prove strict authority recovery blocks it.
- Axis A can require ArrowHedge writes to recover the latest settlement frontier before graph mutation.
- Axis B can apply the same currentness policy to profile publication writes once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Historical settlement verification without currentness policy still accepts an old valid ref.
2. The same ref fails when `requireLatestSettledRoot` sees a newer settled root.
3. The same-root older ref fails when `requireLatestSettlementForRoot` sees a later record.
4. The older ref fails when `minimumSettlementSequence` exceeds its settlement sequence.
5. The older ref fails when a later same-sequence conflicting root is recorded.
6. The older ref fails when a later obstruction is recorded.
7. Capability-kit passes currentness policy to the settlement store before returning graph authority.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A durable settled-root ref remains safe authority until its root changes. | Falsified. | v73 rejects superseded same-root settlement records and later obstructions. |
| A historical settled record is equivalent to current settlement status. | Falsified. | Currentness policy can reject an otherwise valid historical ref. |
| Latest-root checking alone is sufficient. | Falsified. | v73 adds same-root supersession, same-sequence conflict, later obstruction, topology-hash, and minimum-frontier checks. |
| Local settlement-store replay can prove absence of hidden later records. | Still false. | v73 can use a caller-known minimum frontier, but SQ21 remains open for store-head transparency or witness proof. |

## 9. Implementation Frontier

Implemented now:

- Agent-state settlement currentness policy and verification issues.
- In-memory and Postgres settlement-store currentness verification.
- Capability-kit currentness-policy propagation before graph authority construction.
- Focused tests for visible stale history and policy propagation.

Remaining frontier:

1. Add settlement-store head transparency/witnessing (SQ21) so hidden truncation cannot pass when callers lack a frontier.
2. Add a replayed policy ledger that declares which currentness policy applies to each mutation class.
3. Add domain compiler adoption so capabilities declare latest-root/latest-settlement/no-obstruction requirements.
4. Add strict Axis A/C runner adoption and proof packets for stale settlement refs.
5. Add cryptographic signatures and principal binding for currentness proofs.
6. Add concurrent Postgres settlement append tests.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
git diff --check
```

Result:

- `@pm/agent-state` and `@pm/capability-kit` focused typechecks passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 55 tests, `packages/capability-kit/src/workflow-authority.test.ts` 18 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 456 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves visible settlement-history currentness can block stale settled-root authority at the substrate store/resolver layer. It does not prove hidden settlement-store truncation, policy-ledger adoption, cryptographic settlement status, concurrent write isolation, or end-to-end Axis A/B/C enforcement.
