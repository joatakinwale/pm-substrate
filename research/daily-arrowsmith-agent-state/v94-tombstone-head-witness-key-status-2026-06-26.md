# v94 Tombstone-Head Witness Key Status

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v93-durable-tombstone-head-quorum-certificate-record-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ41 - What tombstone-head witness key-status and rotation semantics keep durable certificate-record replay from accepting signatures after key revocation or supersession?

Answer: tombstone-head witness key currentness must be replayed authority state, not an external verifier opinion or a local key lookup. Tombstone-head authority history now admits `rotate_signature_key` and `revoke_signature_key` transitions. Replaying that history projects the current key id, algorithm, fingerprint, key status, and key-change authority sequence into each tombstone-head witness principal. Strict tombstone-head witness replay, authority-seal replay, and quorum-certificate record replay already consult that principal projection; SQ41 gives those checks a replayable transition system that can revoke or supersede keys.

Implemented slice:

- Added `rotate_signature_key` and `revoke_signature_key` to pruning tombstone-head witness authority transitions.
- Added tombstone-head authority replay validation for key-status transitions.
- Key rotation now requires a target active admitted witness, a new key id, and an algorithm.
- Key revocation now requires a target active admitted witness and must name the currently admitted key.
- Tombstone-head principal projection now records `signatureKeyStatus: "active" | "revoked"` and key-change metadata from replayed authority transitions.
- Added a focused test proving revoked and rotated/superseded tombstone-head keys obstruct store-backed certification and invalidate durable tombstone-head quorum-certificate record replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Kim et al. 2013, "Accountable Key Infrastructure (AKI)" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf), [ACM](https://dl.acm.org/doi/10.1145/2488388.2488448)) | Key validation integrates revocation and accountability through public log servers rather than trusting one local authority. | Tombstone-head witness key status is reconstructed from hash-linked authority transitions before evidence can authorize state. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Key bindings need consistency-auditable snapshots so users can detect equivocation and stale bindings. | A tombstone-head witness signature only counts against the key binding projected by replayed topology for that tombstone sequence. |
| Larisch et al. 2017, "CRLite: A Scalable System for Pushing All TLS Revocations to All Browsers" ([PDF](https://cbw.sh/static/pdf/larisch-oakland17.pdf)) | Revocation data must be made available in a way that lets clients fail closed when revocation information is unavailable or stale. | Strict tombstone-head replay fails closed when the replayed key-status projection says a key is revoked or superseded. |
| Ryan 2014, "Enhanced Certificate Transparency and End-to-End Encrypted Mail" ([PDF](https://eprint.iacr.org/2013/595.pdf)) | Current-key proofs need to show a key is issued and not revoked, not merely present in an append-only log. | Durable tombstone-head certificate records are replay-valid only under current key-status authority, not merely hash-valid historical presence. |

## 3. Existing Substrate Map Delta

Already present before v94:

1. v88 made tombstone-head witness observations durable.
2. v89 added tombstone-head authority topology and quorum certificate evaluation.
3. v90 made tombstone-head authority topology store-backed.
4. v91 added tombstone-head authority epoch seals.
5. v92 added tombstone-head signatures and principal/key metadata.
6. v93 added durable tombstone-head quorum-certificate proof records.
7. Tombstone-head strict replay already had key-status and key-id checks, but no tombstone-head authority transition could change key status.

Newly added by v94:

1. Tombstone-head authority history can rotate witness signing keys.
2. Tombstone-head authority history can revoke the currently admitted witness signing key.
3. Replayed tombstone-head topology projects active/revoked key status and key-change metadata.
4. Store-backed tombstone-head certification fails closed when supporting witness records are signed by a revoked or superseded key.
5. Durable tombstone-head QC record replay rejects accepted witness evidence whose signature no longer matches replayed key-status authority.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head quorum-certificate record compaction/checkpointing after long histories.
2. Tombstone-head key-history compaction that preserves current key status without trusting summaries.
3. Runtime and Axis adoption of durable signed tombstone-head QC records and key-status replay.
4. Postgres integration tests proving key-status recovery after actual physical pruning.
5. Direct SQL-delete hardening across tombstone-head witness, authority, and QC-record lanes.
6. Cross-agent gossip/monitoring beyond shared durable stores.
7. Tombstone-head consistency-proof compression that avoids replaying full tombstone history.
8. Store pruning and checkpointing for tombstone-head authority-transition history.
9. Production crypto/key-management adapters for tombstone-head strict signature policies.
10. Explicit historical-vs-current replay policy for archived tombstone-head proofs when current key status has changed.

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
10. SQ42: What tombstone-head proof-preserving compaction checkpoint preserves witness ledgers, key-status history, and quorum-certificate records without letting summaries become authority?

## 6. Primitive Proposal Ledger

Name: Replayed Pruning Tombstone-Head Witness Key Status.

Problem it solves: tombstone-head certificate records could verify signatures against the current key fields projected from authority topology, but tombstone-head authority history had no transition that could rotate or revoke a key. A stale key could remain operational authority until the witness itself was revoked.

Research source: AKI logged revocation/accountability, CONIKS key-transparency currentness, CRLite fail-closed revocation distribution, and enhanced certificate transparency current-key proofs.

Mechanism borrowed or adapted: represent key status as replayed authority transitions, then require decision-time signature replay to compare each signature against the currently admitted key projection.

Why current substrate lacked it: v92 introduced key metadata for tombstone-head witnesses and v93 consumed key status during certificate-record replay, but key status was only initially set on `admit_witness`. No tombstone-head transition could supersede or revoke that key while keeping the witness principal admitted.

Why existing primitives were insufficient: revoking a witness removes the principal, not just the key. A compromised key needs revocation without necessarily deleting the witness from topology. A key rotation needs to supersede old signed evidence for current certification without treating local verifier acceptance as authority.

State guarantee it should create: a tombstone-head witness signature cannot authorize current tombstone-head state unless replayed tombstone-head authority says that principal's signing key is active and matches the signature key id and algorithm.

Admission rule it requires: tombstone-head key rotation/revocation must be admitted as hash-linked authority transitions targeting active admitted principals; revocation must name the current key, and rotation must name a new key id and algorithm.

Replay rule it requires: replay projects key status before validating witness records, authority seals, and quorum-certificate record evidence; revoked or superseded signatures make replay invalid and certification obstructed.

Authority boundary it requires: key status belongs to pruning tombstone-head witness authority topology, not settlement-head topology, external key stores, local verifier configuration, connector cache, or agent memory.

Failure modes it should prevent:

- a compromised tombstone-head witness key continuing to certify current pruning tombstone heads;
- a rotated-away key authorizing fresh tombstone-head certificate records;
- durable certificate-record replay accepting old accepted witness evidence under a revoked topology;
- store-backed certification counting old signatures after replayed key revocation;
- local keyring state silently changing operational authority without an admitted transition.

Minimal implementation slice:

- Add tombstone-head `rotate_signature_key` and `revoke_signature_key` transition kinds.
- Validate tombstone-head key-status transitions during authority replay.
- Project active/revoked key status and key-change metadata into tombstone-head principals.
- Add focused tests for revoked and superseded key rejection in certification and certificate-record replay.

Tests that would falsify it:

- Store-backed tombstone-head certification remains certified after a supporting witness key is revoked.
- Durable tombstone-head QC record replay remains valid under a topology where one accepted witness key is revoked.
- Durable tombstone-head QC record replay remains valid after that witness rotates to a new key while the record carries the old key signature.
- A key revocation transition can target a key that is not currently admitted.
- A key rotation can target a non-admitted witness.

Axis surfaces that could later validate it:

- Axis C can prove a restarted agent refuses pruned-store currentness when tombstone-head evidence was signed by a revoked key.
- Axis A can prove finance pruned projections remain blocked after tombstone-head key supersession.
- Axis B can prove a domain adapter cannot smuggle stale tombstone-head signatures through a local keyring.

## 7. Falsification Criteria Applied Before Verification

1. Replaying tombstone-head authority after revocation projects the witness key as `revoked`.
2. Store-backed tombstone-head certification over witness records signed by the revoked key becomes obstructed.
3. Durable tombstone-head QC record replay rejects accepted witness evidence signed by the revoked key.
4. A new append of the same durable QC record fails under revoked topology.
5. Replaying tombstone-head authority after rotation projects the new key as active.
6. Durable tombstone-head QC record replay rejects accepted witness evidence signed by the superseded old key.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Tombstone-head key metadata admitted with the witness is enough. | Rejected. | v94 adds key-status transitions because admitted keys can later be compromised or superseded while the witness remains admitted. |
| A cryptographic verifier can decide key currentness. | Rejected. | The verifier checks signature math; currentness is replayed tombstone-head authority state. |
| Revoking the witness is an adequate substitute for revoking a key. | Rejected. | Key revocation needs to block a compromised key without necessarily removing the witness principal from future topology. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head `rotate_signature_key` and `revoke_signature_key` transition kinds.
- Tombstone-head key-status transition replay validation.
- Principal key-status projection for tombstone-head authority topology.
- Focused revoked/superseded key tests over store-backed certification and durable QC record replay.

Remaining frontier:

1. Tombstone-head proof-preserving compaction checkpoints for witness ledgers, key histories, and QC records.
2. Runtime and Axis adoption of tombstone-head key-status replay.
3. Postgres integration tests after physical pruning.
4. Cross-agent tombstone-head key-status monitoring.
5. Production crypto/key-management adapters.

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
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 72 tests.
- Full workspace typecheck passed.
- Broad substrate/frontier Vitest sweep passed: 31 files passed, 8 skipped; 392 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves pure tombstone-head key-status replay and focused revoked/superseded key falsifiers. It does not yet prove compaction, runtime adoption, Axis A/B/C adoption, live Postgres pruning recovery, cross-agent monitoring, or production crypto/key management.
