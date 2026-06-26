# v66 Certificate Store Root

Date: 2026-06-26
Status: new substrate primitive implemented; focused tests/typechecks passed
Parent: `research/daily-arrowsmith-agent-state/v65-projection-replay-certificate-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ13 - What tamper-evident certificate-store root should prove projection replay certificates are append-only and non-equivocating across agents, resumes, and write gates?

Answer: projection replay certificate admissions need an append-only store commitment. The minimal useful substrate primitive is a per-tenant certificate-store hash chain: each certificate admission emits a store entry containing the certificate identity fields plus the previous entry hash; the latest entry hash is the store root. Replay refs can cite the certificate-store sequence, entry hash, and root hash, and strict store verification can reject refs that omit or forge those commitments.

This is intentionally a first substrate slice, not the final transparency design. It gives pm-substrate a replayable root and consistency proof. It does not yet provide a logarithmic Merkle proof or automatic cross-agent root witnessing.

Implemented slice:

- `ProjectionReplayCertificateRef` can carry `certificateStoreSequence`, `certificateStoreEntryHash`, and `certificateStoreRootHash`.
- `ProjectionReplayCertificateStoreEntry` and `ProjectionReplayCertificateStoreRoot` model append-only store commitments.
- `verifyProjectionReplayCertificateStoreConsistencyProof()` verifies contiguous hash-chain proofs from an optional previous root to a target root.
- `ProjectionReplayCertificateStore.verifyProjectionReplayCertificateRef()` can require store commitments before accepting a replay ref.
- `InMemoryProjectionReplayCertificateStore` attaches store commitments on admission.
- `PostgresProjectionReplayCertificateStore` stores certificate commitment fields and appends store entries.
- Migration `0025_agent_state_projection_replay_certificate_store_root.sql` adds the append-only entry table.
- `@pm/graph` structurally preserves and compares store commitment fields when replay refs carry them.
- `@pm/capability-kit` can pass `requireProjectionReplayStoreCommitment` to the certificate-store verifier before `apply()`.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf), [USENIX page](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident)) | A log must prove event presence and consistency with prior views; roots are commitments to log history. | Projection certificate admissions now produce a store root, and refs can be checked against the committed history. |
| Li, Krohn, Mazières, and Shasha 2004, "SUNDR" ([USENIX PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf), [USENIX page](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr)) | Fork consistency makes inconsistent histories detectable when clients observe each other's operations. | A certificate-store root can reveal forked replay authority once agents compare roots or consistency proofs. |
| Melara et al. 2015, "CONIKS" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Users monitor provider-maintained bindings for consistency through published directory snapshots. | Agents should not trust private replay refs; they should require certificate-store commitments tied to published roots. |
| Certificate Transparency / RFC 6962 consistency proofs ([RFC](https://www.rfc-editor.org/info/rfc6962)) | A later tree head must prove it includes the earlier tree's leaves unchanged. | The v66 hash-chain proof verifies that a later certificate-store root extends an earlier root without rewriting admissions. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Projection replay certificate records now have append-only store commitments.
2. Replay refs can bind to the store root observed at certificate admission.
3. Store-backed verification can require those root fields before write authority is returned.
4. Consistency proof over store entries can detect sequence gaps, previous-hash forks, entry-body tampering, and target-root mismatch.
5. Graph authority structural equality now includes store commitment fields when present.

## 4. Missing Substrate Map Delta

Still missing:

1. Witness/gossip layer: forked roots are detectable when compared, but no substrate component forces agents/resumes/write gates to exchange roots.
2. Efficient Merkle membership proofs: v66 uses a simple hash chain, so consistency proofs are linear in the number of entries.
3. Domain adapter adoption: no production adapter requires `requireProjectionReplayStoreCommitment` yet.
4. Unified obstruction algebra: store-root verification failures are not yet normalized into the same obstruction artifact as graph authority and local-view failures.
5. Run-wide proof: no monitor yet proves every graph write in a run used store-root-verified replay authority.

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
10. SQ14: What witness or root-gossip protocol should force divergent projection replay certificate-store roots to become obstructions across agents, resumes, and write gates?

## 6. Primitive Proposal Ledger

Name: Projection Replay Certificate Store Root.

Problem it solves: v65 made replay refs resolve to stored full certificates, but the store could still present different certificate histories to different agents without a replayable root object.

Research source: tamper-evident logging, fork consistency, key transparency, Certificate Transparency consistency proofs.

Mechanism borrowed or adapted: a store-root commitment over append-only certificate admissions, with consistency proof from a previous root to a later root.

Why current substrate lacked it: `ProjectionReplayCertificateStore` persisted records but did not expose a committed store history or root.

Why existing primitives were insufficient: record lookup proves one certificate body; it does not prove the certificate history was not forked, rolled back, or rewritten.

State guarantee it should create: Under strict store-root verification, a replay ref cannot authorize mutation unless it cites the append-only certificate-store entry/root that admitted the certificate.

Admission rule it requires: `verifyProjectionReplayCertificateRef({ requireStoreCommitment: true })` rejects refs missing certificate-store sequence, entry hash, or root hash, and rejects forged roots.

Replay rule it requires: `verifyProjectionReplayCertificateStoreConsistencyProof()` must verify contiguous entry sequence, previous-entry hash linkage, entry hash correctness, and expected target root.

Authority boundary it requires: `@pm/agent-state` owns store-root proof semantics; `@pm/capability-kit` can require the proof structurally; `@pm/graph` remains dependency-free and preserves root fields in replay refs.

Failure modes it should prevent:

- replay ref omits the certificate-store root under strict policy;
- replay ref cites a forked or forged store root;
- certificate-store proof has a sequence gap;
- certificate-store proof rewrites a previous hash;
- certificate-store proof changes an entry body without changing the root;
- graph/capability authority silently drops store-root fields.

Minimal implementation slice:

- Added store entry/root/proof types and hash-chain verification helpers.
- Extended replay refs and records with store commitment fields.
- Updated in-memory and Postgres stores to attach commitments on admission.
- Added migration `0025_agent_state_projection_replay_certificate_store_root.sql`.
- Added capability-kit `requireProjectionReplayStoreCommitment`.
- Added focused tests for strict missing-root rejection, forged-root rejection, valid consistency proof, and broken-chain detection.

Tests that would falsify it:

- Strict store verification accepts a replay ref with no store-root fields.
- Strict store verification accepts a forged store root hash.
- Consistency proof accepts a broken previous-entry hash.
- Consistency proof accepts a tampered entry body.
- Graph authority substrate-record comparison ignores different store-root fields.

Axis surfaces that could later validate it:

- Axis A can require store-root refs for ArrowHedge replay-certified graph writes.
- Axis B can require store roots for publication lifecycle projections.
- Axis C can simulate two agents resuming from conflicting store roots and require an obstruction.

## 7. Falsification Criteria Applied Before Verification

1. Missing store commitment under strict verification must produce `projection_replay_certificate_store_commitment_missing`.
2. Forged store root must produce `projection_replay_certificate_store_commitment_mismatch`.
3. Valid two-entry store proof must verify from genesis and from a previous root.
4. Broken previous-entry hash must fail consistency proof.
5. Entry-body tampering must fail consistency proof.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable certificate record lookup is enough to prevent replay-authority equivocation. | Falsified. | v66 adds store roots because a record store without a committed history can still present divergent histories. |
| Store-root verification must be implemented in graph. | Rejected. | Graph remains structural; agent-state owns proof semantics and capability-kit consumes it before mutation. |
| A single root object fully solves non-equivocation across agents. | Downgraded. | Roots make forks detectable, but SQ14 needs witness/gossip so divergent roots are forced into obstruction. |

## 9. Implementation Frontier

Implemented now:

- Append-only certificate-store root model.
- Linear consistency proof verifier.
- Strict replay-ref store commitment verification.
- Store commitment propagation through graph/capability write-authority refs.

Remaining frontier:

1. Add witness/root-gossip protocol for cross-agent fork detection (SQ14).
2. Replace or complement the linear chain with Merkle membership/consistency proofs when scale demands it.
3. Wire one production/domain adapter to require `requireProjectionReplayStoreCommitment`.
4. Normalize store-root verification failures into a general obstruction algebra.
5. Build run-wide proof that all graph writes used store-root-verified replay authority.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm --filter @pm/graph typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/graph/src/write-authority.test.ts
```

Result:

- `@pm/agent-state`, `@pm/capability-kit`, and `@pm/graph` typechecks passed.
- Focused store-root tests passed: 67 tests.

Proof boundary:

This proves certificate admissions can produce tamper-evident roots and strict replay refs can require those roots before mutation authority is returned. It does not yet force independent agents to exchange roots, so cross-agent forks are detectable but not automatically surfaced.
