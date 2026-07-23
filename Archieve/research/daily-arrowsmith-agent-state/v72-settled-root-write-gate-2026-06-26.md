# v72 Settled Root Write Gate

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v71-durable-witness-authority-settlement-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ19 - What strict write-gate admission rule requires durable settled-root certificates before graph/capability mutation, so replayed topology and settlement stores cannot remain advisory?

Answer: strict graph/capability write authority must be proof-carrying authority over the projection replay root. A write cannot be admitted merely because it carries an accepted workflow envelope, provider status, replay certificate, store-root commitment, or root-witness observation. Under strict settlement policy, the accepted workflow authority must also carry a settled-root certificate ref, and capability-kit must verify that ref against the durable settlement store for the same certificate-store root before returning graph write authority.

Implemented slice:

- Added `GraphWriteProjectionReplayRootSettlementRef` and `requireProjectionReplayRootSettlementRef` to graph write-authority policy.
- Graph write authority now rejects missing, malformed, non-settled, or root-mismatched settled-root refs before SQL.
- Graph write authority requires substrate records to preserve the settled-root ref when `requireSubstrateRecord` is enabled.
- Added `ProjectionReplayCertificateStoreRootWitnessSettlementRef`, ref creation from settlement records, settlement-ref verification, and store-backed verification methods to `@pm/agent-state`.
- Added capability-kit resolver support for `projectionReplayRootSettlementStore`, so workflow-derived graph authority is returned only after the durable settlement store verifies the ref.
- Canonical `ActionOutcomeEnvelope` and eval packet recovery now preserve `projectionReplayRootSettlementRef`.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Appel and Felten 1999, "Proof-Carrying Authentication" ([PDF](https://www.cs.princeton.edu/~appel/papers/says.pdf)) | Requesters carry proofs; servers check those proofs mechanically before granting access. | Graph write authority becomes proof-carrying: the settled-root certificate ref must be present and checked before mutation. |
| Chaudhuri and Garg 2009, "PCAL: Language Support for Proof-Carrying Authorization Systems" ([Springer](https://link.springer.com/chapter/10.1007/978-3-642-04444-1_12)) | Proof-carrying authorization shifts proof obligations to the caller while preserving automated policy enforcement. | Workflow/capability authority resolution carries the settled-root proof object and refuses authority if store verification fails. |
| Ligatti, Bauer, and Walker 2005, "Edit Automata: Enforcement Mechanisms for Run-time Security Policies" ([PDF](https://users.ece.cmu.edu/~lbauer/papers/2005/ijis2005-editauto.pdf)) | Runtime monitors can suppress or halt actions before a policy-violating action enters the stream. | Graph/capability strict policy suppresses SQL/apply before mutation when the settled-root proof is absent or invalid. |
| Clark and Wilson 1987, "A Comparison of Commercial and Military Computer Security Policies" ([IEEE metadata](https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db)) | Integrity is preserved through constrained well-formed transactions, not arbitrary direct writes. | Capability and graph writes remain constrained transformations that require admitted terminal, replay, and settlement proof. |
| Schneider 2000, "Enforceable Security Policies" ([ACM](https://dl.acm.org/doi/10.1145/353323.353382)) | Safety properties can be enforced by monitors that observe history and prevent bad action prefixes. | The settled-root write gate is a safety property: no graph mutation may occur without a valid durable settlement ref for the replay root. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Strict graph authority can now require a settled-root certificate ref in addition to replay proof.
2. Settled-root refs are checked against replay certificate-store root sequence/hash, so a settlement for another root cannot authorize this write.
3. Capability-kit can verify settled-root refs against a durable settlement store before constructing graph write authority.
4. Canonical action-outcome packets preserve settled-root refs for later store-backed recovery.
5. Role projections must preserve the settled-root ref as invariant action authority metadata.
6. Postgres graph write authority policies can reject missing settled-root proof before SQL executes.

## 4. Missing Substrate Map Delta

Still missing:

1. Settlement-currentness: a valid historical settlement ref may become stale after a later obstruction, topology policy change, or root-store fork.
2. Store-head witnessing for authority and settlement ledgers.
3. Transactional settlement append isolation under concurrent Postgres writers.
4. Domain authority compiler adoption: domains cannot yet declare per-capability settlement policy requirements.
5. End-to-end run proof: no monitor yet shows every mutation used the strict settled-root gate.
6. Cryptographic signatures and principal material for settlement refs.
7. External target-side finality: graph settlement does not prove downstream side effects applied.
8. Recovery kernel composition across terminal outcomes, replay roots, witness ledgers, settlement refs, and graph writes.
9. Policy supersession: no replayed rule says which settlement policy version is current for a given mutation class.
10. Settlement-ref revocation/suspension status: unlike provider certificates, settlement refs do not yet have current status checks.

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
10. SQ20: What settlement-currentness model prevents an old durable settled-root certificate from authorizing writes after later obstruction, topology change, policy supersession, or settlement-store fork?

## 6. Primitive Proposal Ledger

Name: Projection Replay Settled-Root Write Gate.

Problem it solves: v71 made settlement records durable, but graph/capability write gates did not require them; durable settlement could remain advisory.

Research source: proof-carrying authentication/authorization, runtime enforcement/edit automata, Clark-Wilson integrity, and Schneider enforceable policies.

Mechanism borrowed or adapted: write requests carry a proof object; the trusted mutation boundary checks that proof against admitted history before executing a state transition.

Why current substrate lacked it: graph write authority stopped at replay refs, certificate-store commitments, and optional root-witness acceptance. It did not require durable settlement of the replay root.

Why existing primitives were insufficient: a replay certificate proves current projection identity, a store root proves append-only certificate admission, and a root witness proves observation. None proves the replay root reached durable quorum settlement.

State guarantee it should create: under strict policy, a graph/capability mutation cannot execute unless the accepted workflow authority includes a durable settled-root certificate ref for the same replay certificate-store root.

Admission rule it requires: graph write authority must require an accepted workflow envelope, projection replay ref, and settled-root ref. Capability-kit must verify the settled-root ref against the durable settlement store before returning authority.

Replay rule it requires: settlement store verification replays the settlement ledger, resolves the ref to an admitted record, verifies settled status, and checks root/settlement/hash match.

Authority boundary it requires: graph and capability-kit own the mutation gate. Agents, workflows, domains, tools, and connectors cannot bypass it by handing in raw topology, raw settlement, or private memory.

Failure modes it should prevent:

- graph SQL executing with only a witnessed root;
- capability `apply()` running with no durable settlement proof;
- settlement for another root authorizing the current replay root;
- role/eval recovery dropping settled-root proof;
- a fake settled-root ref passing by shape without durable-store verification.

Minimal implementation slice:

- Added graph settled-root ref and policy validation.
- Added agent-state settlement ref and store verification.
- Added capability-kit settlement-store verification before authority construction.
- Preserved settled-root refs in action envelopes and eval packet recovery.
- Added falsification tests across agent-state, graph, capability-kit, and eval persistence.

Tests that would falsify it:

- Strict graph policy allows mutation without settled-root proof.
- Strict graph policy accepts a settled-root ref for a different certificate-store root.
- Capability-kit returns graph authority when settlement-store verification fails.
- The substrate record drops or changes the settled-root ref without rejection.
- Eval packet recovery loses the settled-root ref.

Axis surfaces that could later validate it:

- Axis C can require amnesiac local-agent writes to recover settled-root refs from packet/settlement stores.
- Axis A can require ArrowHedge graph writes to use durable settled-root refs.
- Axis B can apply the same gate to publication/profile writes once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Graph strict policy rejects missing settled-root proof before SQL.
2. Graph strict policy rejects root mismatch between replay ref and settlement ref.
3. Graph strict policy rejects substrate-record settled-root mismatch.
4. Capability-kit rejects when settlement-store verification returns invalid.
5. Agent-state settlement-store verification rejects ref/root mismatch.
6. Eval packet recovery preserves the settled-root ref.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable settlement records are enough without write-gate adoption. | Falsified. | v72 adds graph/capability settled-root policy because v71 stores were otherwise advisory. |
| A witnessed root can satisfy strict mutation authority. | Rejected. | Strict graph policy now requires settled-root proof, not only replay/root witness proof. |
| A settled-root ref can be trusted by shape. | Rejected. | Capability-kit verifies the ref with the settlement store before constructing authority. |
| Action-outcome packet recovery can omit settlement refs. | Rejected. | `ActionOutcomeEnvelope` and eval recovery now preserve `projectionReplayRootSettlementRef`. |

## 9. Implementation Frontier

Implemented now:

- Graph settled-root authority ref and policy gate.
- Capability-kit settlement-store verification before graph authority resolution.
- Agent-state settlement-ref creation and verification.
- Action-outcome and eval packet preservation of settled-root refs.
- Tests covering strict graph, store-backed capability, settlement-store verification, and packet recovery.

Remaining frontier:

1. Add settlement-currentness/status checks (SQ20).
2. Add domain compiler policy so capabilities declare settled-root requirements.
3. Add store-head witnessing/gossip for authority and settlement ledgers.
4. Prove end-to-end Axis A/C writes use the strict gate from durable stores.
5. Add cryptographic principal material/signatures.
6. Add transaction isolation for concurrent Postgres settlement appends.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/graph typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/evals/src/persistence/persistence.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
git diff --check
```

Result:

- Touched package typechecks passed.
- Focused Vitest passed: 4 files passed, 100 tests passed.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 453 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves a strict settled-root mutation gate exists in graph/capability-kit and that it can be backed by durable settlement-store verification. It does not yet prove settlement-currentness, domain-wide policy compiler adoption, store-head witnessing, cryptographic settlement authority, or end-to-end Axis A/B/C runner enforcement.
