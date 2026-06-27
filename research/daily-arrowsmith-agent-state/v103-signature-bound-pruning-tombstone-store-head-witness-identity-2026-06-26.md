# v103 Signature-Bound Pruning Tombstone-Store Head Witness Identity

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v102-durable-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ50 - What signature-bound pruning tombstone-store head witness identity prevents unsigned, wrong-key, or equivocated stored witness/topology evidence from counting toward certified required-head recovery?

Answer: pruning tombstone-store head witness observations can no longer become certified required-head evidence merely because they are persisted and structurally replayable. Store-backed certification now injects the replayed pruning tombstone-store head witness authority topology into strict signature replay. A witness observation counts only when its principal id matches the observer id, its signature payload hash matches the exact observed head payload, the replayed topology admits that principal for the observed pruning tombstone sequence, and the signature key id / algorithm match the replay-admitted key metadata.

Implemented slice:

- Added signature payload hashing for pruning tombstone-store head witness observations.
- Added optional signatures to pruning tombstone-store head witness observation inputs and durable witness records.
- Added signature key metadata to pruning tombstone-store head witness authority transitions and replayed principal state.
- Persisted witness signatures and authority key metadata in the Postgres-backed stores.
- Made the store-backed certifier replay witness records under the store-derived topology before quorum evaluation.
- Added tests proving signed observations can certify, unsigned stored observations obstruct certification, and wrong-key stored observations replay invalid.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Torres-Arias et al. 2019, "in-toto: Providing farm-to-table guarantees for bits and bytes" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity19/presentation/torres-arias), [PDF](https://www.usenix.org/system/files/sec19-torres-arias.pdf)) | Supply-chain evidence is accepted only when signed metadata binds each step to an authorized functionary and exact material/product hashes. | A pruning tombstone-store head observation is evidence only when its signature binds the observer principal to the exact observed head payload and replay admits the principal/key. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX Security PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Key bindings are stateful, auditable objects; clients verify that identity-to-key mappings are consistent rather than trusting local key memory. | Witness key id and algorithm are projected from replayed authority transitions, not from the witness row, caller memory, or adapter configuration. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([USENIX](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance), [PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Replicated state-machine protocols authenticate messages before they can participate in quorum progress. | Quorum certification cannot count a stored witness message unless replay authenticates signer, payload, and admitted-key relation. |
| Levin et al. 2009, "TrInc: Small Trusted Hardware for Large Distributed Systems" ([USENIX NSDI](https://www.usenix.org/conference/nsdi-09/trinc-small-trusted-hardware-large-distributed-systems), [PDF](https://www.usenix.org/event/nsdi09/tech/full_papers/levin/levin.pdf)) | Anti-equivocation requires claims to be bound to identity and monotonic evidence rather than allowing actors to emit unaccountable conflicting statements. | v102 supplied monotonic stored topology; v103 adds identity/key binding for the observations that topology counts. |

## 3. Existing Substrate Map Delta

Already present before v103:

1. v100 durable pruning tombstone-store head witness observations.
2. v101 replayed witness authority topology and quorum certificates.
3. v102 durable authority-transition stores and store-backed certification.
4. Older settlement-head and tombstone-head layers had signature/key mechanisms, but the newer pruning tombstone-store head witness layer did not.

Newly added by v103:

1. `computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessObservationSignaturePayloadHash`.
2. Optional observation signatures on pruning tombstone-store head witness inputs and records.
3. Signature issue replay for the pruning tombstone-store head witness ledger.
4. `pruningTombstoneStoreHeadAuthorityTopology` in the shared signature policy so strict replay can bind signatures to the replayed topology for this layer.
5. Signature key metadata on pruning tombstone-store head witness authority transitions and replayed principals.
6. Postgres persistence for witness signatures and admitted key metadata.
7. Migration `0043_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_signatures.sql`.
8. Store-backed certification that passes the replayed topology into signature replay.

## 4. Missing Substrate Map Delta

Still missing:

1. Key-status replay and rotation for pruning tombstone-store head witness signatures.
2. Non-retroactive authority epoch seals for pruning tombstone-store head witness topology.
3. Durable quorum-certificate proof records for certified pruning tombstone-store heads.
4. Proof-preserving compaction and pruning for this witness, authority, key, and certificate history.
5. Runtime recovery integration that requires the store-backed signed certifier instead of direct topology evaluation.
6. Live Postgres restart tests for signed cross-process certified required-head recovery.
7. Production cryptographic verifier adapters for this new witness layer.
8. Monitoring that detects callers evaluating unsigned witness replay or synthetic topology in write-adjacent paths.
9. Domain adapter conformance tests proving adapters cannot smuggle topology or witness identity through configuration.
10. Topology-transition signer authority for this layer; v103 binds witness observations to admitted keys, but authority-transition authorship is still hash-chain storage rather than signed institutional authority.

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
10. SQ51: What key-status replay and rotation semantics prevent revoked or superseded pruning tombstone-store head witness keys from authorizing certified required-head recovery?

## 6. Primitive Proposal Ledger

Name: Signature-Bound Pruning Tombstone-Store Head Witness Identity.

Problem it solves: v102 could recover topology from a durable store, but a persisted witness row could still count when it only named an authorized observer id. Unsigned rows and wrong-key rows were stored representation, not admitted identity proof.

Research source: in-toto signed supply-chain metadata, CONIKS key transparency, PBFT authenticated quorum messages, and TrInc anti-equivocation identity binding.

Mechanism borrowed or adapted: signed evidence is admissible only when the signature covers the exact payload and replayed authority history binds the signer identity to the current key.

Why current substrate lacked it: the new pruning tombstone-store head witness layer was created after the older signed tombstone-head layer and initially copied only the witness/topology/quorum shape, not the signature/key boundary.

Why existing primitives are insufficient: older settlement-head and tombstone-head signatures govern different state layers. Reusing their topology would let the wrong authority namespace certify a pruning tombstone-store head witness.

State guarantee it should create: certified pruning tombstone-store head currentness cannot be constituted by private memory, unsigned persisted rows, wrong-key persisted rows, or adapter-supplied principal/key assumptions.

Admission rule it requires: a witness observation may contribute to quorum only if strict replay verifies signer principal, payload hash, active replayed topology membership, admitted key id, admitted algorithm, and verifier acceptance.

Replay rule it requires: store-backed certification must load stored authority transitions, replay them into topology, load stored witness records, replay witness signatures against that topology, and only then evaluate quorum.

Authority boundary it requires: pruning tombstone-store head witness identity is scoped to its own replayed authority topology. A signer valid for another head layer is not valid here unless admitted in this layer's history.

Failure modes it should prevent:

- unsigned persisted witness rows certifying a required head;
- rows signed by the wrong key certifying a required head;
- rows whose signature payload hash does not match the observed head certifying;
- signatures by principals not admitted for the observed sequence certifying;
- Postgres-backed replay dropping signatures and treating signed evidence as unsigned;
- adapters relying on local key configuration instead of replayed authority transition state.

Minimal implementation slice:

- Add observation signature payload hash.
- Preserve signatures in witness observation records and Postgres rows.
- Add admitted key metadata to authority transitions and replayed principal state.
- Add strict witness-record signature replay against `pruningTombstoneStoreHeadAuthorityTopology`.
- Have the store-backed certifier inject the replayed topology into signature replay.
- Add a migration for signature and key metadata columns.

Tests that would falsify it:

- A store-backed certificate over unsigned persisted witness rows returns `certified`.
- A witness row signed with a key other than the replay-admitted key replays valid.
- A signed row certifies after Postgres row mapping drops the signature.
- A signer not active in the replayed topology can count toward quorum.
- Signed observations with admitted keys fail to certify under a valid two-witness topology.

Axis surfaces that could later validate it:

- Axis C can restart with stored signed witness rows and verify required-head recovery without memory.
- Axis A can attempt finance recovery with unsigned adapter-generated witness rows and expect obstruction.
- Axis B can require domain adapters to obtain signed store-backed certification rather than carrying witness ids and keys in adapter state.

## 7. Falsification Criteria Applied Before Implementation

1. Store-backed certification with unsigned persisted witness rows under strict policy must return `obstructed`, not `certified`.
2. Witness replay with a signature key different from the replay-admitted key must be invalid.
3. Replayed topology must project admitted key id and algorithm into principal state.
4. Signed observations from the two replay-admitted keys must certify the exact required head.
5. Postgres persistence must include both witness signatures and admitted key metadata.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Persisted witness rows are enough if the observer id is topology-eligible. | Rejected. | v103 requires strict signature replay against the store-derived topology before rows can count. |
| Key identity can live in adapter configuration. | Rejected. | v103 projects key id and algorithm from authority transitions into principal state. |
| Store-backed certification can replay witnesses without passing authority topology into signature verification. | Rejected. | v103 injects the replayed topology into the signature policy during store-backed certification. |

## 9. Implementation Frontier

Implemented now:

- Signature-bearing pruning tombstone-store head witness observations.
- Replay validation for missing, mismatched-principal, mismatched-payload, unauthorized-principal, non-current-key, key-mismatch, and verifier-rejected witness signatures.
- Authority transition key metadata and principal key projection for this layer.
- In-memory and Postgres persistence of the new signature/key fields.
- Store-backed certification that fails closed on unsigned or wrong-key persisted witness evidence.
- Migration `0043_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_signatures.sql`.

Remaining frontier:

1. Key-status replay and rotation for this layer.
2. Authority epoch seals for this layer.
3. Durable quorum-certificate records.
4. Runtime and axis adoption.
5. Production cryptographic verifier adapters.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v103-signature-bound-pruning-tombstone-store-head-witness-identity-2026-06-26.md db/migrations/0043_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_signatures.sql
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, migration, changelog, and ledger files found no matches.
