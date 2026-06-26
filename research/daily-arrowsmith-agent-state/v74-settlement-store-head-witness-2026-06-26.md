# v74 Settlement Store Head Witness

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v73-settlement-currentness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ21 - What settlement-store head transparency or witness primitive prevents a settlement store from hiding later currentness records or serving a truncated fork when the caller lacks a minimum frontier?

Answer: settlement currentness must be checked against a witnessed settlement-store head, not merely against whatever settlement prefix the store returns during verification. A settlement-store head commits to the latest settlement record sequence and hash. A head witness records observed heads, requires consistency proofs for advances, rejects same-sequence forks, and treats old duplicate heads as regressions once a newer head has been witnessed. Capability-kit can observe the head before settled-root verification and require that exact head in settlement currentness policy.

Implemented slice:

- Added `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHead` and deterministic head hashing to `@pm/agent-state`.
- Settlement replay now exposes `settlementStoreHead` derived from the latest replayed settlement record.
- Settlement currentness policy can require a specific witnessed settlement-store head and rejects truncated verification history with `..._store_head_mismatch`.
- Added settlement-store head consistency proofs, head-witness decisions, obstruction artifacts, hash-linked head-witness records, replay verification, in-memory witness, in-memory witness ledger, and ledger-backed witness.
- Settlement stores now expose `getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead()`.
- Capability-kit can require a settlement-store head witness, pass optional head consistency proof, and bind the witnessed head into settlement currentness verification before graph authority is returned.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Li, Krohn, Mazières, and Shasha 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf)) | Fork consistency makes a malicious server unable to show incompatible histories forever once clients observe one another. | Settlement head witnessing turns hidden settlement-store forks/truncation into obstructions when agents compare or replay witnessed heads. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Users efficiently monitor their own key bindings for consistency through transparency snapshots. | Agents can monitor settlement-store heads instead of trusting a store-returned prefix as current authority. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Logs need proofs that current views remain consistent with previously observed views. | Settlement-store head consistency proofs must bridge from the latest witnessed head to a proposed advance. |
| Wendlandt, Andersen, and Perrig 2008, "Perspectives: Improving SSH-style Host Authentication with Multi-Path Probing" ([USENIX](https://www.usenix.org/conference/2008-usenix-annual-technical-conference/perspectives-improving-ssh-style-host), [PDF](https://www.usenix.org/legacy/event/usenix08/tech/full_papers/wendlandt/wendlandt.pdf)) | Independent notaries expose inconsistent server views that a single client might not detect. | Settlement-head witnesses provide the substrate equivalent of notary comparison for operational-state ledger heads. |
| Kim et al. 2013, "Accountable Key Infrastructure" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Accountable public logs and checks-and-balances limit equivocation and stale key authority. | Settlement heads become accountable status objects instead of private store answers. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Settlement replay now produces a store-head commitment over the latest settlement record.
2. Settlement currentness can require a specific store head, so a truncated valid prefix cannot satisfy a witnessed-head policy.
3. Settlement-head witnesses accept initial heads, require consistency proofs for advances, and reject regressed heads.
4. Settlement-head witnesses reject same-sequence forked heads.
5. Head-witness records are hash-linked and replayable, so decision drift or tampering is detectable.
6. Capability-kit can observe a settlement-store head and bind it into verification before returning workflow-derived graph authority.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable Postgres settlement-head witness storage and cross-agent head gossip.
2. Quorum settlement over multiple independent head witnesses.
3. Domain compiler adoption for declaring settlement-head witness requirements per capability.
4. Policy ledger deciding which mutation classes require witnessed heads, latest-root currentness, or both.
5. Cryptographic signatures for head witness observations.
6. Concurrent settlement append isolation and head race tests.
7. End-to-end Axis A/C runner adoption of settlement-head witnessing.
8. External target-side finality after graph/capability mutation.
9. Recovery kernel composition that rebuilds latest settlement heads from durable witness history.
10. Monitor proof that every operational write used the head-witness gate when configured.

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
10. SQ22: What durable cross-agent settlement-head witness store or gossip protocol makes settlement-head observations survive process restart and independent agent comparison?

## 6. Primitive Proposal Ledger

Name: Projection Replay Settlement Store Head Witness.

Problem it solves: v73 currentness could reject visible stale settlement history, but a store could still return an old valid prefix unless the caller supplied an external frontier.

Research source: SUNDR fork consistency, CONIKS key transparency, Crosby-Wallach tamper-evident logs, Perspectives notaries, and AKI accountable logs.

Mechanism borrowed or adapted: publish and witness log heads; require consistency proofs for head advances; reject regressions and forks when a previously witnessed head exists.

Why current substrate lacked it: settlement records were hash-linked, but verification trusted the returned record set as the whole visible ledger. There was no separate head object or witness memory that could say "this prefix is behind the head already seen."

Why existing primitives were insufficient: currentness policy could require a minimum sequence, but only if a caller already knew the frontier. The settlement store itself could otherwise make an old ref appear current by omitting later records.

State guarantee it should create: when settlement-head witnessing is configured, a workflow-derived graph mutation cannot be authorized by a settlement store head older than, forked from, or unproved relative to the latest witnessed head.

Admission rule it requires: capability-kit must observe the settlement-store head, require witness acceptance, and bind the accepted head into settlement currentness policy before returning graph authority.

Replay rule it requires: head-witness records replay prior accepted heads and recompute each decision from the recorded observation and consistency proof.

Authority boundary it requires: agents, workflow envelopes, and local snapshots cannot decide settlement-store currentness; the mutation boundary consumes a head witness decision and settlement-store verification result.

Failure modes it should prevent:

- a settlement store returning an old valid prefix after a newer head was witnessed;
- a same-sequence forked settlement head being accepted as current;
- a head advance without a consistency proof authorizing mutation;
- tampered head-witness decisions replaying as valid;
- capability-kit verifying a settled-root ref without binding the witnessed head into currentness policy.

Minimal implementation slice:

- Added head types, hashing, and replay-derived settlement-store heads.
- Added currentness required-head verification.
- Added head-witness evaluation, obstruction, record hashing, replay, in-memory witness, in-memory ledger, and ledger-backed witness.
- Added capability-kit head witness support before settled-root verification.
- Added falsification tests for truncated history, missing proof, stale duplicate heads, forked heads, replay tampering, and capability propagation.

Tests that would falsify it:

- A truncated record prefix verifies against a newer required head.
- A witness accepts a head advance without a consistency proof.
- A witness accepts an old head after a newer head was accepted.
- A witness accepts a same-sequence divergent head.
- A tampered head-witness decision replays as valid.
- Capability-kit verifies a settled-root ref after head witness obstruction.

Axis surfaces that could later validate it:

- Axis C can simulate amnesiac resume with a stale settlement-store prefix.
- Axis A can require ArrowHedge writes to pass settlement-head witnessing before graph mutation.
- Axis B can apply the same head-gate to publication/profile writes once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Required settlement-store head rejects truncated replay history.
2. Head witness rejects missing consistency proof for advances.
3. Head witness rejects old duplicate heads after a newer head is witnessed.
4. Head witness rejects same-sequence forked heads.
5. Head-witness ledger replay detects decision and hash tampering.
6. Capability-kit observes settlement-store heads and passes the witnessed head into currentness policy.
7. Capability-kit rejects write authority when the head witness obstructs.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Hash-linked settlement records alone prevent hidden truncation. | Falsified. | v74 adds required store-head verification because an old prefix can still be internally valid. |
| Previously seen old heads can be harmless duplicates. | Rejected for write authority. | v74 treats old duplicate heads as regressions once a newer head has been witnessed. |
| Currentness policy can rely on the store's returned prefix. | Falsified. | v74 binds currentness to a witnessed head before capability graph authority is returned. |
| In-memory head witnessing is enough for global recovery. | Still false. | v74 adds replayable in-memory ledgers, but SQ22 remains open for durable cross-agent head witnessing/gossip. |

## 9. Implementation Frontier

Implemented now:

- Settlement-store head object and deterministic hash.
- Replay-derived settlement-store head.
- Required-head currentness verification.
- Settlement-head witness, obstruction, consistency proof, replayable records, in-memory witness, in-memory ledger, and ledger-backed witness.
- Capability-kit head-witness gate before settled-root verification.

Remaining frontier:

1. Durable Postgres settlement-head witness store and migration.
2. Cross-agent head gossip or quorum witness policy.
3. Domain compiler adoption for strict head policies.
4. End-to-end Axis A/C runner proof with stale settlement-store prefixes.
5. Cryptographic signatures and principal binding for witnessed heads.

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
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 58 tests, `packages/capability-kit/src/workflow-authority.test.ts` 20 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 461 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves settlement-store head witnessing can expose hidden truncation or forks when the witness has observed a newer head and that capability-kit can bind the witnessed head into mutation authority. It does not yet prove durable Postgres head-witness recovery, cross-agent gossip/quorum, cryptographic signatures, or end-to-end Axis A/B/C adoption.
