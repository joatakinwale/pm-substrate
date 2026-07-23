# v92 Signature-Bound Tombstone-Head Witness Identity

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v91-tombstone-head-authority-epoch-seal-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ39 - What signature-bound tombstone-head witness identity makes observations, authority epoch seals, and future certificate records attributable to admitted principals?

Answer: pruning tombstone-head observations and authority epoch seals need the same replay-admitted principal/key boundary as settlement-head witnesses. A tombstone-head witness row can no longer be treated as operational authority under strict policy unless the row carries a principal signature over the exact observation payload, the signer matches the observer id, the signer is active in replayed tombstone-head authority topology, the key and algorithm match admitted key metadata, and the verifier accepts the signature. Tombstone-head authority epoch seals now likewise require a finalizer signature from an active admitted tombstone-head witness principal when strict policy is enabled.

Implemented slice:

- Added tombstone-head witness observation signature payload hashing.
- Preserved tombstone-head witness observation signatures in record building, in-memory ledgers, Postgres persistence, and row mapping.
- Added tombstone-head authority-transition signature payload hashing.
- Added signature key metadata and signatures to tombstone-head witness authority transitions.
- Replayed tombstone-head principal key metadata from authority history.
- Validated tombstone-head witness-record signatures against replayed tombstone-head authority topology under strict policy.
- Validated tombstone-head authority epoch-seal signatures against replayed tombstone-head principal/key state.
- Added migration `0037_agent_state_projection_replay_pruning_tombstone_head_witness_signatures.sql`.
- Added focused tests proving signed tombstone-head quorum/seal acceptance, unsigned witness replay obstruction, store-backed certification obstruction, and wrong-key seal replay rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Torres-Arias et al. 2019, "in-toto: Providing farm-to-table guarantees for bits and bytes" ([USENIX](https://www.usenix.org/conference/usenixsecurity19/presentation/torres-arias), [PDF](https://www.usenix.org/system/files/sec19-torres-arias.pdf)) | Supply-chain steps are represented as signed functionary statements and verified against expected step/party layout. | Tombstone-head observations and seals must be signed statements by replay-admitted witness principals, not trusted durable row fields. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Fault-tolerant protocol messages require cryptographic authentication so recovery and view-change evidence is attributable to replicas. | Tombstone-head quorum and epoch-seal evidence only counts when signer identity is bound to active replayed authority topology. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf)) | Hash-linked log structure detects tampering, but entry authorship is a separate accountability boundary. | v88-v91 hash-linked tombstone-head history needed signer attribution before durable rows could become authority. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Public-key bindings and directory views need auditable signed currentness rather than private lookup trust. | Tombstone-head witness keys become replayed authority state; observations and seals fail if their key is absent or mismatched. |

## 3. Existing Substrate Map Delta

Already present before v92:

1. v88 made tombstone-head observations durable and replayable.
2. v89 added tombstone-head witness topology and quorum certificate evaluation.
3. v90 made tombstone-head witness topology recoverable from durable authority-transition stores.
4. v91 sealed tombstone-head authority epochs against retroactive topology edits.
5. v79 already proved signature-bound identity for settlement-head observations and seals.

Newly strengthened by v92:

1. Tombstone-head witness records can carry observer signatures.
2. Tombstone-head witness replay validates signature principal, payload hash, admitted principal status, key id, algorithm, and verifier result.
3. Store-backed tombstone-head certification injects the replayed tombstone-head topology into witness replay so unauthorized durable rows fail before quorum counting.
4. Tombstone-head authority transitions carry admitted signature key metadata.
5. Tombstone-head authority epoch seals can require finalizer signatures under strict policy.
6. In-memory and Postgres tombstone-head stores preserve signature material for replay after amnesia.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable tombstone-head quorum-certificate proof records that bind accepted witness signatures and epoch seals into recoverable certificate history.
2. Tombstone-head witness key-status rotation and revocation semantics.
3. Tombstone-head certificate-record replay that validates witness evidence after key status changes.
4. Runtime and Axis adoption of signed, store-backed tombstone-head quorum certification.
5. Tombstone-head consistency proof compression that avoids replaying full tombstone history.
6. Cross-agent gossip/monitoring beyond shared durable storage.
7. Postgres integration tests for signed tombstone-head recovery after actual pruning.
8. Direct SQL-delete hardening across tombstone and tombstone-head ledgers.
9. Store pruning and checkpointing for tombstone-head authority-transition history.
10. Production crypto/key-management adapters for signature policies.

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
10. SQ40: What durable tombstone-head quorum-certificate record store binds accepted witness signatures and authority epoch seals into recoverable proof objects?

## 6. Primitive Proposal Ledger

Name: Signature-Bound Pruning Tombstone-Head Witness Identity.

Problem it solves: v88-v91 made tombstone-head observations, topology, stores, and sealed authority epochs replayable, but unsigned durable rows could still impersonate observers or finalizers under strict certification unless tombstone-head identity was admitted through replayed authority.

Research source: in-toto signed functionary metadata, PBFT authenticated protocol messages, tamper-evident logging authorship limits, and CONIKS key-transparency bindings.

Mechanism borrowed or adapted: treat tombstone-head observations and epoch seals as signed statements whose signer, key, algorithm, and payload hash must replay against the current admitted tombstone-head authority topology.

Why current substrate lacked it: settlement-head identity had strict signatures, but pruning tombstone-head identity still depended on observer ids and hash-linked rows. Hashes proved row integrity, not row authorship.

Why existing primitives were insufficient: tombstone-head authority stores and epoch seals prove the topology and finality boundary, but they do not prove that a durable observation or seal was made by an admitted principal with an admitted key.

State guarantee it should create: a tombstone-head observation or epoch seal cannot become operational authority from storage, memory, adapter output, or local snapshot unless replay validates admitted signer identity and exact payload binding.

Admission rule it requires: strict tombstone-head certification must require signatures for witness records and epoch seals, and must reject missing, unauthorized, wrong-principal, wrong-payload, wrong-key, wrong-algorithm, or verifier-rejected signatures.

Replay rule it requires: replay must reconstruct tombstone-head authority principal/key state before validating observation and seal signatures; invalid signatures make witness replay or authority replay invalid, which obstructs certification.

Authority boundary it requires: tombstone-head witness identity is scoped to replayed tombstone-head authority topology, not settlement-head topology, adapter-supplied observer lists, local process identity, connector cache, or chat memory.

Failure modes it should prevent:

- unsigned tombstone-head observations certifying pruning currentness;
- a durable row with observer id `A` signed by principal `B`;
- a row signed over a different tombstone-head payload;
- a witness using a key that was never admitted in tombstone-head authority history;
- an authority epoch seal signed by a wrong key or unauthorized finalizer;
- store-backed certifier counting unauthorized durable witness rows as merely non-members instead of treating replay as obstructed.

Minimal implementation slice:

- Add tombstone-head observation and authority-transition signature payload hash helpers.
- Add signatures to tombstone-head witness records and authority transitions.
- Replay admitted key metadata into tombstone-head principal state.
- Validate witness-record and epoch-seal signatures under strict policy.
- Persist signatures and key metadata through migration `0037`.
- Add focused strict-policy tests for signed success and unsigned/wrong-key obstruction.

Tests that would falsify it:

- A strict replay accepts an unsigned tombstone-head witness record.
- Store-backed tombstone-head certification remains certified over an unsigned witness ledger.
- A strict replay accepts a tombstone-head authority epoch seal signed with a key not admitted for the finalizer.
- A signature over a different observation payload remains valid.
- A durable row signed by a principal outside replayed tombstone-head topology is counted toward quorum instead of obstructing replay.

Axis surfaces that could later validate it:

- Axis C can prove a restarted agent cannot reauthorize pruned-store state from unsigned tombstone-head rows.
- Axis A can prove finance pruned projections remain blocked when tombstone currentness evidence has wrong-key signatures.
- Axis B can prove a domain adapter cannot smuggle unsigned tombstone-head observations into pruning currentness.

## 7. Falsification Criteria Applied Before Verification

1. Signed tombstone-head witness records replay as valid under strict policy when signer, key, and payload match replayed tombstone-head authority topology.
2. Removing a stored witness signature makes strict replay invalid.
3. Store-backed tombstone-head certification over an unsigned witness row becomes obstructed.
4. A wrong-key authority epoch seal replays invalid under strict policy.
5. A valid signed seal still allows sealed historical certification and stable recertification.
6. Unauthorized durable witness rows under incomplete topology invalidate replay rather than becoming private belief that can still influence certification.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Hash-linked tombstone-head witness rows prove observer identity. | Rejected. | v92 discovered the record builder and row mapper could preserve row hashes while dropping signature material; strict replay now needs explicit signer attribution. |
| Tombstone-head quorum can treat unauthorized signed rows as merely uncounted. | Rejected. | Under strict identity, a durable row from an unauthorized principal is invalid replay, not a harmless quorum miss. |
| Settlement-head signature policy can stand in for tombstone-head identity. | Rejected. | v92 adds a `pruningTombstoneHeadAuthorityTopology` signature-policy surface so key attribution is scoped to the tombstone-head authority lane. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head witness observation signature payload hashes.
- Tombstone-head authority transition signature payload hashes.
- Signature-bearing tombstone-head witness records.
- Signature key metadata and signatures on tombstone-head witness authority transitions.
- Strict tombstone-head witness-record signature replay.
- Strict tombstone-head authority epoch-seal signature replay.
- Store-backed tombstone-head certification that validates witness signatures against replayed tombstone-head authority topology.
- Migration `0037_agent_state_projection_replay_pruning_tombstone_head_witness_signatures.sql`.
- Focused tests for signed quorum/seal success, unsigned witness replay failure, store-backed unsigned obstruction, and wrong-key seal failure.

Remaining frontier:

1. Durable tombstone-head quorum-certificate records.
2. Tombstone-head witness key status and rotation.
3. Tombstone-head certificate-record replay under key-currentness rules.
4. Runtime and Axis adoption of signed store-backed tombstone-head quorum certification.
5. General production crypto/key-management adapters for strict signature policies.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 71 tests.
- Full workspace typecheck passed.
- Broad substrate/frontier Vitest sweep passed: 31 files passed, 8 skipped; 391 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves the pure tombstone-head signature-bound identity behavior in focused agent-state tests. It does not yet prove durable tombstone-head quorum-certificate records, tombstone-head key-status currentness, runtime adoption, Axis A/B/C adoption, or production crypto/key management.
