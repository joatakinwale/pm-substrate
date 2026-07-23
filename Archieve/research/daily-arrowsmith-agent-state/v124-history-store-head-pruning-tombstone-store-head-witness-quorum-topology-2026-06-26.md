# v124 History Store-Head Pruning Tombstone Store-Head Witness Quorum Topology

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v123-pruning-tombstone-history-store-head-pruning-tombstone-store-head-witness-ledger-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ71 - What witness authority topology, signature-bound identity, or quorum certificate prevents a single observer from unilaterally defining history-store-head pruning tombstone-store head currentness?

Answer: v123 made the v122 required head recoverable from witness replay, but a single observer could still be mistaken for certified currentness. The missing primitive is a v123-specific witness authority topology plus quorum certificate. Replay can recover a head, but strict pruned-store continuity may now require a certified quorum certificate proving enough replay-eligible observers accepted that exact head.

Implemented slice:

- Added v123 witness authority transition, topology, principal-state, quorum policy, and quorum certificate types.
- Added deterministic authority-transition and quorum-certificate hashing.
- Added topology replay for `set_quorum`, `admit_witness`, `suspend_witness`, and `revoke_witness`.
- Added quorum evaluation over replayed v123 witness records that counts only eligible accepted witnesses for the exact head.
- Extended history-store-head replay compaction pruned-store continuity with `requiredPruningTombstoneStoreHeadQuorumCertificate` and `requirePruningTombstoneStoreHeadQuorumCertificate`.
- Added focused tests proving one witness cannot certify, missing/non-certified certificates fail strict continuity, two admitted witnesses certify, strict continuity can derive the required head from the certificate, and unauthorized observers cannot count.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf), [ACM](https://dl.acm.org/doi/10.1145/571637.571640)) | Replicated state is accepted through authenticated quorum agreement rather than one replica statement. | A v123 recovered head is not certified currentness until enough eligible witnesses accepted the same head. |
| Malkhi and Reiter 1998, "Byzantine Quorum Systems" ([Springer](https://link.springer.com/article/10.1007/s004460050050), [PDF](https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf)) | Quorum membership and intersection rules define which participant sets can preserve consistency under arbitrary faults. | The topology names eligible v123 witnesses and thresholds; observer ids outside topology cannot count. |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE S&P listing](https://www.ieee-security.org/TC/SP2016/program-papers.html), [PDF](https://arxiv.org/pdf/1503.08768)) | Authoritative statements should be validated by a diverse witness group before clients rely on them. | The required head certificate is an authority-scoped witness predicate over replayed observations, not a local process memory claim. |
| Alvisi et al. 2000, "Dynamic Byzantine Quorum Systems" ([PDF](https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf)) | Byzantine quorum systems can adapt membership and thresholds as state changes. | v124 keeps quorum membership as replayed transition history and leaves durable transition storage as SQ72. |

## 3. Existing Substrate Map Delta

Already present before v124:

1. V121 durable history-store-head pruning tombstone records and tombstone-gated prune APIs.
2. V122 deterministic pruning tombstone-store heads and exact required-head currentness checks.
3. V123 durable witness records for v122 required-head recovery after amnesia.
4. V123 witness replay that rejects tampered records and preserves same-sequence forks as obstructions.
5. Prior layered quorum-topology patterns for older required-head namespaces.

Newly added by v124:

1. A v123-specific witness authority topology over history-store-head pruning tombstone-store head observers.
2. Quorum certificate evaluation that counts only replay-eligible observers accepting the exact head.
3. Strict pruned-store continuity can require a certified v124 quorum certificate.
4. Strict continuity can derive the required v122 head from the certified v124 certificate, so the raw head need not be supplied by memory.
5. Unauthorized observers and one-witness certificates are explicit obstructions.

## 4. Missing Substrate Map Delta

Still missing after v124:

1. Durable authority-transition stores for v124 topology, so callers cannot supply synthetic transition arrays.
2. Store-backed v124 quorum certification.
3. Signature-bound observer identity, admitted keys, rotation/revocation, and key-status replay for v124 witness rows.
4. Non-retroactive authority epoch seals for historical v124 certifications.
5. Durable quorum-certificate proof records for certified v124 heads.
6. Proof-preserving compaction and pruning for v124 authority and future certificate histories.
7. Runtime and Axis adoption of strict certified v124 recovery.
8. Live Postgres restart proof for certified head recovery.
9. Generic nested currentness/witness abstraction to reduce repeated layer-specific code.
10. Recovery-kernel inventory for every compacted/pruned required head and supporting authority store.

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
10. SQ72: What durable authority-transition store makes v124 history-store-head pruning tombstone-store head witness topology recoverable after amnesia rather than supplied as in-memory transition arrays?

## 6. Primitive Proposal Ledger

Name: History Store-Head Pruning Tombstone Store-Head Witness Quorum Topology.

Problem it solves: v123 witness replay recovers the required head, but one observer can still be mistaken for certified currentness.

Research source: PBFT quorum agreement, Byzantine quorum systems, decentralized witness cosigning, and dynamic Byzantine quorum systems.

Mechanism borrowed or adapted: replay authority transitions into eligible witness membership and quorum thresholds; evaluate witness-ledger replay against that topology; certify only when enough eligible observers accepted the exact same head.

Why current substrate lacks it: v123 stores and replays observations, but not the authority topology that decides which observations can count.

Why existing primitives are insufficient: older authority topologies govern older head namespaces. Reusing them would let authority cross a layer boundary and certify the wrong state object.

State guarantee it should create: strict history-store-head pruned-store continuity can refuse raw recovered heads and require topology-bound certified currentness.

Admission rule it requires: quorum certification must replay topology, verify witness replay, count only eligible accepted witnesses for the exact head, mark unauthorized witnesses invalid, and treat same-sequence conflicts as obstructions.

Replay rule it requires: authority transitions replay in sequence with previous-hash and transition-hash validation before witness observations can count toward quorum.

Authority boundary it requires: v124 certifies only `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_pruning_tombstone` heads recovered by the v123 witness ledger.

Failure modes it should prevent:

- one accepted observer certifying the v122 required head;
- observer ids outside topology satisfying quorum;
- strict continuity accepting a raw recovered head when a certificate is required;
- strict continuity accepting a non-certified certificate;
- a certificate for one head authorizing another head;
- a tampered certificate hash passing strict continuity.

Minimal implementation slice:

- Add v124 authority transition/topology types and hashing.
- Add v124 topology replay for quorum and witness membership.
- Add v124 quorum certificate evaluation and hashing over v123 witness replay.
- Extend strict pruned-store continuity with certified required-head inputs.
- Add focused tests for one-witness, two-witness, missing certificate, non-certified certificate, strict certified continuity, and unauthorized observer cases.

Tests that would falsify it:

- A single accepted witness produces `certified` under a two-witness topology.
- An observer not admitted by topology counts toward quorum.
- Strict continuity passes with `requirePruningTombstoneStoreHeadQuorumCertificate` and no certificate.
- Strict continuity passes with a non-certified certificate.
- Strict continuity cannot derive the required head from a certified certificate.

Axis surfaces that could later validate it:

- Axis C can restart with one v123 witness record and require a strict continuity obstruction.
- Axis A can attempt finance recovery with an adapter-supplied single-observer required head.
- Axis B can require domain adapters to cite certified v124 currentness rather than local pruning summaries.

## 7. Falsification Criteria Used For This Slice

1. One accepted observer plus topology requiring two witnesses must not certify.
2. Two admitted observers accepting the same head must certify.
3. An accepted observer outside topology must not count.
4. Strict continuity with a required quorum certificate but no certificate must fail.
5. Strict continuity with a non-certified certificate must fail.
6. Strict continuity with a certified certificate must pass and derive the required head from the certificate.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable v123 witness replay is enough to certify currentness. | Rejected. | v124 requires topology-bound quorum certification for strict continuity. |
| Any observer in a valid v123 witness ledger can count toward certification. | Rejected. | v124 counts only observers admitted by replayed topology. |
| Strict pruned-store continuity can safely accept raw recovered heads. | Rejected in strict mode. | `requirePruningTombstoneStoreHeadQuorumCertificate` fails without a certified certificate. |

## 9. Implementation Frontier

Implemented now:

1. V124 authority transition/topology/principal/quorum types.
2. V124 authority transition hashing and replay.
3. V124 quorum certificate hashing and evaluation over v123 witness replay.
4. Strict continuity certificate input and certificate-required mode.
5. Focused tests for one-witness non-certification, certified two-witness currentness, missing/non-certified strict failure, and unauthorized observer rejection.

Remaining frontier:

1. SQ72 durable v124 authority-transition store and store-backed certifier.
2. Signature-bound v124 witness identity and key-status replay.
3. Authority epoch seals and durable quorum-certificate proof records.
4. Proof-preserving compaction/pruning for v124 authority and proof histories.
5. Runtime/Axis adoption and live Postgres restart proof.
6. Generic nested currentness abstraction and recovery-kernel inventory.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run via the targeted command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.
