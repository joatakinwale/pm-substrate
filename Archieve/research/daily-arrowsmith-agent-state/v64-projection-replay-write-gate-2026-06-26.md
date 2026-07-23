# v64 Projection Replay Write Gate

Date: 2026-06-26
Status: substrate primitive strengthened; focused tests/typechecks passed
Parent: `research/daily-arrowsmith-agent-state/v63-projection-replay-frontier-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ11 - What first real write-capable runtime boundary should require a projection replay certificate, and what obstruction should it emit when the frontier is absent or stale?

Answer: the first boundary should be graph write authority, because graph writes are shared operational-state mutations and `@pm/capability-kit` already calls the graph authority guard before capability `apply()` or `UPDATE graph.nodes`. The obstruction should be a policy-visible graph write authority issue, not an axis-only failure:

- `graph_write_projection_replay_ref_missing`;
- `graph_write_projection_replay_ref_invalid`;
- `graph_write_projection_replay_ref_mismatch`;
- `graph_write_projection_replay_ref_stale`;
- `graph_write_authority_substrate_record_mismatch` when a store-backed substrate record fails to preserve the replay ref.

Implemented slice:

- `@pm/graph` now defines `GraphWriteProjectionReplayRef`.
- `GraphWriteAuthorityPolicy` can require projection replay proof and set expected projection name, projection version, authority scope, and minimum replay position.
- `validateGraphWriteAuthority()` blocks missing, malformed, mismatched, stale, or substrate-record-mismatched replay refs.
- `PostgresGraph` inherits the guard before SQL through its existing authority policy.
- `@pm/capability-kit` inherits the guard before `apply()` and raw graph update.
- `graphWriteAuthorityResolutionFromWorkflowEnvelope()` preserves `projectionReplayRef` in both the authority ref and substrate record.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ligatti, Bauer, Walker 2005, "Edit automata: enforcement mechanisms for run-time security policies" ([PDF](https://users.ece.cmu.edu/~lbauer/papers/2005/ijis2005-editauto.pdf), [metadata](https://bibbase.org/network/publication/ligatti-bauer-walker-editautomataenforcementmechanismsforruntimesecuritypolicies-2005)) | Runtime monitors can truncate/suppress actions before a policy-violating action enters the action stream. | Graph/capability writes should be suppressed before SQL when replay proof is absent, stale, or mismatched. |
| Reference monitor concept, summarized in Jaeger 2008 course note ([PDF](https://www.cs.ucr.edu/~trentj/cse544-s18/docs/refmon.pdf)) | Complete mediation requires each security-sensitive operation be authorized by a reference validation mechanism; tamperproof and verifiable mechanisms must be small enough to reason about. | Graph write authority is the small mediation point for shared operational-state mutation. |
| Clark and Wilson 1987, "A Comparison of Commercial and Military Computer Security Policies" ([IEEE PDF](https://ieeexplore.ieee.org/iel5/6234872/6234873/06234890.pdf), [Semantic Scholar](https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db)) | Commercial integrity depends on well-formed transactions, not direct arbitrary data manipulation. | Capabilities can mutate graph state only through a certified authority relation that now includes replay-certified projection state. |
| Capobianco, Zhou, Basu, Jaeger, Zhang 2024, "TALISMAN: Tamper Analysis for Reference Monitors" ([NDSS](https://www.ndss-symposium.org/ndss-paper/talisman-tamper-analysis-for-reference-monitors/), [PDF](https://users.cs.duke.edu/~dz132/pub/ndss24.pdf)) | Authorization queries can be tampered when built from low-integrity request input rather than trusted monitor data. | Projection replay refs must be preserved in store-backed substrate records, not only supplied by request/adapters. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Graph write authority is now a replay-proof admission boundary.
2. Capability-kit graph mutations inherit replay-proof enforcement before capability code executes mutation logic.
3. Workflow-to-graph authority conversion preserves replay refs through both authority ref and substrate record.
4. Replay-frontier certificates now have a write-gate surface, not only review-time validation.

## 4. Missing Substrate Map Delta

Still missing:

1. Store-backed replay certificate persistence: graph validates replay refs structurally and by substrate-record preservation, but the full certificate is not yet persisted/recovered from a certificate store.
2. Certificate verification at graph boundary: graph intentionally avoids importing `@pm/agent-state`, so it does not recompute certificate hashes.
3. Runtime adapter adoption: one generic boundary can enforce replay proof, but no production/domain adapter has been wired to require it by default.
4. Obstruction algebra: replay-ref issues are structured obstructions inside graph authority, but not yet unified with local-view obstruction artifacts.
5. Run-wide monitor: no proof object yet shows every write in a run used a replay-proof policy.

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
10. SQ12: What certificate store should persist full projection replay certificates so graph/capability write gates can verify certificate hashes from durable substrate records instead of structural refs alone?

## 6. Primitive Proposal Ledger

Name: Projection Replay Write Gate.

Problem it solves: v63 made replay proof generatable, but a write-capable boundary could still ignore it. A stale/private projection could still drive a graph write unless the mutation gate required replay proof.

Research source: edit automata, reference monitors, Clark-Wilson integrity, TALISMAN tamper analysis.

Mechanism borrowed or adapted: a small complete-mediation gate suppresses unsafe actions before they become operational mutations.

Why current substrate lacked it: graph write authority could require accepted terminal envelopes, provider certificate status refs, and substrate records, but not replay-certified projection state.

Why existing primitives were insufficient: `ProjectionReplayCertificate` and `ProjectionReplayFrontier` proved replay identity, but they were advisory until a mutation boundary refused writes without them.

State guarantee it should create: A graph mutation under strict replay policy cannot proceed from private or stale projection belief; it needs an accepted authority envelope carrying replay proof that satisfies expected projection, version, scope, and frontier position.

Admission rule it requires: `GraphWriteAuthorityPolicy.requireProjectionReplayRef` blocks graph writes unless the accepted authority ref carries a valid `projectionReplayRef`.

Replay rule it requires: Replay proof refs must cite the certificate id/hash, transition-history hash, projection hash, authority scope, projection version, and replay frontier position produced by the projection replay certificate path.

Authority boundary it requires: The ref must be attached to the accepted workflow action outcome authority and, when `requireSubstrateRecord` is enabled, preserved by the store-backed substrate record.

Failure modes it should prevent:

- graph write proceeds with no replay proof;
- graph write proceeds with a stale replay position;
- graph write proceeds with a certificate for the wrong projection, version, or authority scope;
- request-supplied replay ref diverges from the store-backed substrate record;
- capability `apply()` sees control before replay proof policy is satisfied.

Minimal implementation slice:

- Added `GraphWriteProjectionReplayRef`.
- Extended `GraphWriteAuthorityPolicy`.
- Added replay obstruction codes to graph write authority validation.
- Propagated replay refs through workflow authority conversion.
- Added graph and capability-kit tests proving replay policy blocks before SQL/apply.

Tests that would falsify it:

- `PostgresGraph` with `requireProjectionReplayRef` reaches SQL when replay proof is missing.
- `defineCapability()` with `requireProjectionReplayRef` calls `apply()` when replay proof is missing.
- A stale replay position satisfies a minimum frontier policy.
- A wrong projection name/version/scope satisfies policy.
- A substrate record with a different replay ref satisfies strict store-backed policy.

Axis surfaces that could later validate it:

- Axis A finance adapters can require projection replay proof before ArrowHedge graph updates.
- Axis B publication adapters can require lifecycle projection replay proof before publish/update graph writes.
- Axis C local-agent-lab can compare direct memory-driven graph write attempts against replay-gated attempts.

## 7. Falsification Criteria Applied Before Verification

1. Missing replay proof must produce `graph_write_projection_replay_ref_missing`.
2. Stale replay proof must produce `graph_write_projection_replay_ref_stale`.
3. Projection name/version/scope mismatch must produce `graph_write_projection_replay_ref_mismatch`.
4. Capability-kit must not call `apply()` when strict replay policy rejects authority.
5. Store-backed policy must reject substrate-record replay-ref mismatch.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replay certificates are useful once generated, even if no mutation boundary requires them. | Falsified. | Without a write gate, private/stale projections can still drive graph writes. |
| Terminal outcome authority alone proves current projection identity. | Downgraded. | Accepted terminal authority must now be paired with replay proof when policy requires current projection identity. |
| A request-supplied replay ref is enough at the graph boundary. | Downgraded. | Strict policy can require substrate-record preservation; full certificate persistence remains open. |

## 9. Implementation Frontier

Implemented now:

- Graph write replay-proof policy and obstruction codes.
- Capability-kit runtime enforcement before `apply()` and graph SQL.
- Workflow authority adapter propagation of replay proof refs.

Remaining frontier:

1. Persist full `ProjectionReplayCertificate`s in a substrate-owned store.
2. Store/recover replay proof through action-outcome/eval packet stores.
3. Wire one production/domain adapter to require the replay gate under strict policy.
4. Unify graph authority replay issues with a general obstruction algebra.
5. Build run-wide proof that all graph writes used replay-gated authority.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/graph typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/graph/src/write-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts
```

Result:

- `@pm/graph`, `@pm/capability-kit`, and `@pm/evals` typechecks passed.
- Graph/capability authority tests passed: 32 tests.

Proof boundary:

This proves a real graph/capability write boundary can block missing/stale/mismatched replay proof before mutation logic. It does not yet prove full certificate-store verification or all-adapter adoption.
