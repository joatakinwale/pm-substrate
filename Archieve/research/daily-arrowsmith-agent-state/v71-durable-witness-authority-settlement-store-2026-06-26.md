# v71 Durable Witness Authority and Settlement Store

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v70-witness-authority-topology-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ18 - What durable authority-transition and settlement-certificate store prevents callers from supplying synthetic witness topology or settlement objects?

Answer: witness topology and settlement are not operational authority until they are replayed from substrate-owned append-only stores. v70 made authority topology and settlement hashable pure objects, but callers could still supply those objects directly. v71 adds durable store primitives so topology transitions and settlement certificates are admitted through sequence-assigned, previous-hash-linked records, then replayed before use.

Implemented slice:

- `ProjectionReplayCertificateStoreRootWitnessAuthorityTransitionStore` with in-memory and Postgres implementations.
- Store-assigned authority transition sequence and `previousAuthorityHash`.
- `ProjectionReplayCertificateStoreRootWitnessSettlementRecord`, deterministic record hashing, settlement-record replay, and in-memory/Postgres settlement stores.
- Migration `0027_agent_state_projection_replay_witness_authority_settlement.sql` for durable authority transitions and settlement certificates.
- Tests proving restart-style replay from the stores, tampered authority-transition rejection, and tampered settlement-record rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident)) | Append-only logs can make history extension and tampering externally checkable. | Authority transitions and settlement certificates become hash-linked replay logs, not process-local objects. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([ACM](https://dl.acm.org/doi/10.1145/128765.128770)) | Recovery reconstructs database state from durable log records rather than buffer/cache memory. | An amnesiac agent must recover topology and settled roots from durable records, not chat/session summaries. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | Configuration changes are logged state-machine commands, not caller-supplied runtime configuration. | Witness-authority changes are appended by a store and replayed before settlement can count principals. |
| Melara et al. 2015, "CONIKS" ([USENIX PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Transparency systems turn provider-maintained bindings into monitorable append-only state. | Witness-principal eligibility and revocation are store-backed monitorable state rather than private lookup response. |
| Tomescu et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([IACR](https://eprint.iacr.org/2018/811), [ACM](https://dl.acm.org/doi/10.1145/3319535.3354221)) | Authenticated append-only dictionaries combine lookup claims with history consistency. | Settlement certificates need durable lookup and replay consistency, not only a hash on the returned settlement object. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Witness-authority transitions now have a store that assigns sequence and previous hash at append time.
2. Authority topology after restart can be derived from `list...AuthorityTransitions()` plus topology replay.
3. Settlement objects can be admitted into a settlement-record ledger with sequence, previous record hash, and deterministic record hash.
4. Settlement-record replay recomputes both the inner settlement hash and the outer settlement-record hash.
5. Settlement-record replay reconstructs settled roots from records whose ledger chain and settlement body are valid.
6. Postgres migration support exists for authority-transition and settlement-certificate storage.

## 4. Missing Substrate Map Delta

Still missing:

1. Strict write-gate adoption: graph and capability gates do not yet require a durable settled-root certificate before mutation.
2. Store-head witnessing: authority-transition and settlement-record store heads are not yet themselves witnessed or gossiped.
3. Cryptographic signatures: store records are hash-linked but not signed by authority principals.
4. Transactional append isolation: Postgres append uses current latest-row lookup; production concurrency still needs transactional locking or serializable append semantics.
5. Equivocation evidence refs: `mark_equivocated` can be persisted, but the evidence proving equivocation is still not attached.
6. Settlement certificate status/currentness: settlement records can be replayed, but no revocation/supersession/currentness layer exists for settlement policies.
7. Domain policy compiler: domains cannot yet declare which settled-root policy and witness topology are required for their mutation classes.
8. End-to-end recovery kernel: no single recovery API yet reconstructs replay certificate store root, witness ledgers, topology, settlement, terminal outcomes, and open scopes.
9. External target-side settlement: this is settlement for replay roots, not proof that external side effects were applied.
10. Run-wide proof object: no monitor yet proves every operational write used a durable settled-root certificate.

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
10. SQ19: What strict write-gate admission rule requires durable settled-root certificates before graph/capability mutation, so replayed topology and settlement stores cannot remain advisory?

## 6. Primitive Proposal Ledger

Name: Projection Replay Root Witness Authority and Settlement Stores.

Problem it solves: v70 made witness topology replayable and settlement hashable, but both could still be handed to settlement evaluation as ordinary caller-supplied objects.

Research source: tamper-evident logging, ARIES recovery, Raft logged configuration, CONIKS transparency, and append-only authenticated dictionaries.

Mechanism borrowed or adapted: durable append-only logs assign sequence numbers and previous hashes. Current admissible topology and settled roots are projections over these logs, not private memory.

Why current substrate lacked it: the only durable replay object in this lane was the root-witness observation ledger. Authority transitions and settlement certificates were pure objects without store admission.

Why existing primitives were insufficient: a valid authority transition hash proves one object; it does not prove the object was appended into the substrate authority history. A valid settlement hash proves one settlement body; it does not prove that settlement is part of a durable settled-root history.

State guarantee it should create: after restart or agent amnesia, witness eligibility and settled roots can be reconstructed from admitted transition history alone, and tampered topology/settlement objects fail replay.

Admission rule it requires: authority and settlement stores assign sequence and previous hash, persist the full hash-bound object, and return only records that can later be replayed.

Replay rule it requires: topology replay consumes listed authority transitions; settlement-record replay verifies contiguous sequence, previous hash, settlement/root tenant, inner settlement hash, outer record hash, and settled-root reconstruction.

Authority boundary it requires: agents, domains, tools, connectors, and local worktrees cannot make topology or settlement operational by constructing objects. They must read from and replay substrate-owned stores.

Failure modes it should prevent:

- synthetic topology objects weakening quorum;
- private memory deciding the active witness set;
- synthetic settlement objects claiming a root is settled;
- tampered settlement status replaying as settled;
- restart losing the authority topology or settled-root certificate history.

Minimal implementation slice:

- Added authority transition store interfaces/classes.
- Added settlement record, settlement record replay, and settlement store interfaces/classes.
- Added Postgres migration for both durable tables.
- Added focused tests for restart replay and tamper rejection.

Tests that would falsify it:

- A tampered persisted authority transition still yields valid topology.
- A tampered settlement record still yields a settled root.
- Settlement replay accepts a sequence gap or broken previous-hash link.
- Settlement replay accepts an inner settlement hash mismatch.
- Restart requires chat memory to recover current topology or settled roots.

Axis surfaces that could later validate it:

- Axis C can require root settlement recovered from durable stores after amnesiac resume.
- Axis A can require ArrowHedge graph writes to cite durable settled-root certificates.
- Axis B can require profile publication writes to use profile-owned settlement certificates once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A durable authority-transition store must replay topology after restart and preserve sequence/previous-hash links.
2. A durable settlement store must replay settled roots after restart from settlement records.
3. Tampering a stored authority transition body without recomputing its hash must invalidate topology replay and obstruct settlement.
4. Tampering a stored settlement body without recomputing its settlement/record hashes must invalidate settlement-record replay and remove the settled root.
5. The implementation must not change Axis A/B/C fixtures to manufacture a pass.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A hashable topology object is enough authority. | Falsified. | v71 adds store-assigned sequence/previous-hash admission because object hashes alone do not prove membership in authority history. |
| A hashable settlement object is enough finality. | Falsified. | v71 settlement-record replay rejects tampered settlement bodies and reconstructs settled roots only from valid admitted records. |
| Restart can trust a caller-supplied latest topology/settlement. | Rejected. | Store replay now provides the restart path; caller-supplied synthetic objects remain outside operational authority. |
| Durable stores complete the root-settlement proof. | Still false. | Strict graph/capability write gates do not yet require durable settled-root certificates. |

## 9. Implementation Frontier

Implemented now:

- Durable witness-authority transition store interfaces and in-memory/Postgres implementations.
- Durable settlement record/store interfaces and in-memory/Postgres implementations.
- Settlement-record replay with hash, tenant, root, sequence, and previous-hash validation.
- Migration `0027_agent_state_projection_replay_witness_authority_settlement.sql`.
- Focused tests for durable replay and tamper rejection.

Remaining frontier:

1. Add a strict settled-root write gate in graph/capability-kit (SQ19).
2. Require topology/settlement stores as resolver dependencies rather than raw topology objects in strict runtime paths.
3. Add store-head witnessing/gossip for authority-transition and settlement-record ledgers.
4. Add transaction isolation or advisory locking for concurrent Postgres appends.
5. Attach equivocation evidence refs and cryptographic witness-principal material.
6. Add a recovery kernel that rehydrates operational scopes from all current replay ledgers.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts
git diff --check
```

Result:

- `@pm/agent-state` typecheck passed.
- `packages/agent-state/src/index.test.ts`: 52 tests passed.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 446 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves that topology and settlement can be recovered from durable replay stores and that tampered store records are rejected in `@pm/agent-state`. It does not yet prove strict write-gate adoption, cryptographic principals, store-head witnessing, concurrent append safety, or external target-side finality.
