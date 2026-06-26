# v65 Projection Replay Certificate Store

Date: 2026-06-26
Status: new substrate primitive implemented; focused tests/typechecks passed
Parent: `research/daily-arrowsmith-agent-state/v64-projection-replay-write-gate-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ12 - What certificate store should persist full projection replay certificates so graph/capability write gates can verify certificate hashes from durable substrate records instead of structural refs alone?

Answer: projection replay certificates need a substrate-owned certificate record store, and capability write-authority resolution must verify `projectionReplayRef` against that durable record before returning graph write authority. The graph package should remain a small structural reference monitor; certificate body validation belongs in `@pm/agent-state`, and capability-kit should consume it structurally through the workflow-envelope resolver.

Implemented slice:

- `@pm/agent-state` now defines `ProjectionReplayCertificateRef`, `ProjectionReplayCertificateRecord`, certificate-store verification issues, and a `ProjectionReplayCertificateStore` interface.
- `ProjectionReplayCertificate` now carries optional hash-bound `projectionName`; certificates minted from `ProjectionReplayFrontier` set it.
- Durable write-authority records require hash-valid certificates with hash-bound projection name, projection version, replay position, transition-history hash, and projection hash.
- `InMemoryProjectionReplayCertificateStore` and `PostgresProjectionReplayCertificateStore` verify replay refs against stored full certificates.
- Migration `0024_agent_state_projection_replay_certificates.sql` adds `agent_state.projection_replay_certificates`.
- `ActionOutcomeEnvelope` preserves `projectionReplayRef`, and eval packet recovery returns it through `getWorkflowActionOutcomeEnvelope()`.
- `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` can require certificate-store verification before returning authority to capability `apply()`.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | A log entry is not enough; clients/auditors need membership and consistency proofs against committed history to detect hidden mutation or rollback. | A replay ref is not enough; the ref must resolve to a durable full certificate record, and future work must make the store itself tamper-evident. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara)) | Key bindings become trustworthy through a transparency service that lets users monitor consistency of provider-maintained bindings. | Projection identity bindings become operational only when they resolve to substrate-maintained certificate records, not caller memory. |
| Tomescu et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([PDF](https://cse.hkust.edu.hk/~dipapado/docs/aad.pdf), [ACM](https://dl.acm.org/doi/10.1145/3319535.3345652)) | Transparency logs combine append-only history with lookup proofs so a key's values can be checked without trusting a server response. | The certificate store is the lookup authority for `certificateId`; the next missing primitive is append-only consistency proof for that store. |
| Kim et al. 2013, "Accountable Key Infrastructure" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf), [ACM](https://dl.acm.org/doi/10.1145/2488388.2488448)) | Public-key validation is strengthened by accountable logs that make certificate issuance and validation externally checkable. | Projection certificate issuance must be accountable before a graph mutation can treat a projection ref as authority. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Projection replay certificates now have durable substrate records, not only in-memory action-review objects.
2. Projection replay refs can be verified by resolving `certificateId` to a full stored certificate and comparing certificate hash, projection name, version, authority scope, replay position, transition-history hash, and projection hash.
3. Workflow/eval action-outcome envelope recovery can preserve replay refs for graph write authority.
4. Capability-kit can block before `apply()` when a stored accepted envelope has a replay ref that fails certificate-store verification.

## 4. Missing Substrate Map Delta

Still missing:

1. Tamper-evident certificate-store history: the new Postgres table is immutable by primary key/hash checks, but it does not yet produce append-only membership/consistency proofs or a store root.
2. Store-wide non-equivocation: there is no proof object that two agents resolving the same certificate store saw the same certificate-history root.
3. Production adapter adoption: generic resolvers can require certificate-store verification, but domain adapters still need strict wiring.
4. Unified obstruction algebra: certificate-store verification failures are structured store issues or resolver errors, not yet one substrate-wide obstruction artifact.
5. Run-wide proof: no monitor yet proves every graph write in a run used store-verified replay certificates.

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
10. SQ13: What tamper-evident certificate-store root should prove projection replay certificates are append-only and non-equivocating across agents, resumes, and write gates?

## 6. Primitive Proposal Ledger

Name: Projection Replay Certificate Store.

Problem it solves: v64 prevented writes without replay refs, but a request/store could still provide a structurally valid ref that did not resolve to any full certificate body.

Research source: tamper-evident logs, key transparency, append-only authenticated dictionaries, accountable key infrastructure.

Mechanism borrowed or adapted: membership lookup against a durable certificate authority before accepting a reference as operational authority.

Why current substrate lacked it: `GraphWriteProjectionReplayRef` was structural; graph could compare refs and substrate records but could not verify a certificate hash against a full stored certificate.

Why existing primitives were insufficient: `ProjectionReplayCertificate` proved replay identity locally, and `ProjectionReplayFrontier` generated certificates from event history, but neither made the certificate body durable and recoverable at write time.

State guarantee it should create: Under store-backed replay policy, a graph/capability mutation cannot proceed unless its replay ref resolves to a full, hash-valid, durable projection replay certificate with matching projection identity and replay frontier fields.

Admission rule it requires: Store-backed authority resolution must call `verifyProjectionReplayCertificateRef()` before returning authority for graph mutation.

Replay rule it requires: The replay ref must match the durable certificate record's certificate hash, projection name, version, authority scope, replay position, transition-history hash, and projection hash.

Authority boundary it requires: `@pm/agent-state` owns certificate body validation; capability-kit consumes a structural verifier; `@pm/graph` remains dependency-free and enforces the structural replay ref.

Failure modes it should prevent:

- accepted workflow envelope carries a replay ref whose full certificate is missing;
- replay ref certificate hash diverges from the stored certificate body;
- replay ref replay position or projection identity is forged after certificate minting;
- action-outcome packet recovery drops the replay ref before authority resolution;
- capability `apply()` executes before durable certificate lookup.

Minimal implementation slice:

- Added certificate ref/record/store interfaces and in-memory/Postgres store implementations.
- Added migration `0024_agent_state_projection_replay_certificates.sql`.
- Preserved projection replay refs in `ActionOutcomeEnvelope`, workflow promotion, role projection, and eval packet recovery.
- Added certificate-store verifier hook to capability-kit workflow authority resolver.
- Added focused falsification tests for missing durable records, mismatched refs, missing hash-bound projection identity, replay-ref recovery, and pre-`apply()` rejection.

Tests that would falsify it:

- `verifyProjectionReplayCertificateRef()` returns valid when the record is missing.
- A replay ref with a forged hash or replay position verifies against the stored certificate.
- Durable admission accepts a certificate whose projection name is not hash-bound in the certificate body.
- `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` drops `projectionReplayRef`.
- `defineCapability()` calls `apply()` when certificate-store verification fails.

Axis surfaces that could later validate it:

- Axis A can persist ArrowHedge projection replay certificates, recover accepted packets, and require certificate-store verification before graph updates.
- Axis B can require certificate-store verification for publication lifecycle projections.
- Axis C can compare memory-supplied replay refs against store-backed verification in local-agent-lab writes.

## 7. Falsification Criteria Applied Before Verification

1. Missing certificate record must produce `projection_replay_certificate_record_missing`.
2. Mismatched certificate hash or replay position must make store verification invalid.
3. Durable certificate admission must reject certificates without hash-bound `projectionName`.
4. Eval packet recovery must preserve `projectionReplayRef`.
5. Capability execution must roll back before `apply()` when certificate-store verification fails.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replay ref preserved in a substrate record is enough if graph compares it structurally. | Falsified. | v65 requires resolving the ref to a durable full certificate record before authority resolution can pass. |
| Projection name can be supplied as certificate-store metadata outside the certificate body. | Falsified. | Durable admission now requires projection name to be hash-bound inside `ProjectionReplayCertificate`; otherwise a later caller could attach a different projection identity. |
| Action-outcome packet recovery did not need replay refs. | Falsified. | Store-backed write authority needs the recovered accepted envelope to preserve `projectionReplayRef`. |

## 9. Implementation Frontier

Implemented now:

- Durable certificate record/store abstraction for projection replay certificates.
- Postgres migration for substrate-owned certificate storage.
- Store-backed replay ref verification before capability `apply()`.
- Replay-ref preservation through accepted action-outcome envelopes and eval packet recovery.

Remaining frontier:

1. Add a tamper-evident append-only certificate-store root and membership/consistency proof (SQ13).
2. Wire one production/domain adapter to require the certificate store under strict replay policy.
3. Unify certificate-store verification failures with graph authority issues and local-view obstructions.
4. Build run-wide proof that all graph writes used store-verified replay authority.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
```

Result:

- `@pm/agent-state`, `@pm/capability-kit`, and `@pm/evals` typechecks passed.
- Focused certificate-store/write-gate tests passed: 62 tests.

Proof boundary:

This proves replay refs can be verified against durable full certificates before capability mutation logic. It does not yet prove the certificate store is tamper-evident or non-equivocating across agents.
