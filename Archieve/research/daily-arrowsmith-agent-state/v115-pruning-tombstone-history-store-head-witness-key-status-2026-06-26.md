# v115 Pruning Tombstone History Store-Head Witness Key Status

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v114-pruning-tombstone-history-store-head-witness-authority-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ62 - What key-status replay and rotation semantics prevent revoked or superseded v114 pruning tombstone history-store head witness keys from authorizing certified currentness?

Answer: v114 made history-store head witness topology recoverable from durable authority-transition history, but the witness key binding inside that topology was static. The missing substrate primitive is replayed key status for this authority namespace. A witness signature can count toward certified currentness only when the replayed pruning tombstone history-store head witness authority topology currently binds the witness to the signing key as active for the required pruning tombstone sequence. `rotate_signature_key` supersedes prior keys; `revoke_signature_key` marks the current key revoked; both are admitted authority transitions, not caller configuration.

Implemented slice:

- Added `rotate_signature_key` and `revoke_signature_key` to pruning tombstone history-store head witness authority transitions.
- Added replay validation for malformed key-status transitions.
- Projected `signatureKeyStatus` and key-change metadata into replayed principals.
- Extended witness ledger signature replay to reject revoked keys and old rotated keys.
- Extended quorum signature replay with an explicit key-not-current issue.
- Added focused tests for old-key obstruction after rotation, rotated-key certification, revoked-key obstruction, and malformed key-transition rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Name-to-key bindings are auditable directory state, and clients check consistency of those bindings rather than relying on remembered local keys. | History-store head witness key bindings are replayed from authority history; remembered key ids cannot authorize certification. |
| Kim et al. 2013, "Accountable Key Infrastructure (AKI): A Proposal for a Public-Key Validation Infrastructure" ([ACM](https://dl.acm.org/doi/10.1145/2488388.2488448), [PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Issuance, update, revocation, and recovery are accountable operations over visible key infrastructure. | Witness key rotation and revocation are authority transitions that replay before stored witness rows can count. |
| Basin et al. 2014, "ARPKI: Attack Resilient Public-Key Infrastructure" ([ETH Zurich](https://netsec.ethz.ch/research/arpki/), [PDF](https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf)) | Certificate issuance, update, revocation, and validation are transparent and accountable protocol events. | Cryptographic signature verification is necessary but insufficient; replayed key status decides whether the key is current authority. |
| Ryan 2014, "Enhanced Certificate Transparency and End-to-End Encrypted Mail" ([NDSS](https://www.ndss-symposium.org/ndss2014/ndss-2014-programme/enhanced-certificate-transparency-and-end-end-encrypted-mail/), [PDF](https://eprint.iacr.org/2013/595.pdf)) | Currentness requires positive inclusion plus non-revocation evidence, not just historical certificate presence. | A witness row signed by a revoked or superseded key is historical evidence, but cannot constitute current operational state. |

## 3. Existing Substrate Map Delta

Already present before v115:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority for those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. Signature payload hashing and strict signer/key checks against replayed topology.
5. Earlier same-pattern key-status primitives for settlement-head, tombstone-head, and pruning tombstone-store head witness layers.

Newly added by v115:

1. Pruning tombstone history-store head witness key-status transition kinds.
2. Append-time replay rejection for malformed rotate/revoke transitions through the v114 stores.
3. Replayed principal key-status projection for active and revoked keys.
4. Current-key enforcement for old rotated witness rows.
5. Current-key enforcement for revoked witness rows.
6. Positive certification proof for rows signed by the replayed rotated key.

## 4. Missing Substrate Map Delta

Still missing:

1. Non-retroactive authority epoch seals for v115 topology and key-status history.
2. Durable quorum-certificate proof records for certified pruning tombstone history-store heads.
3. Proof-preserving compaction checkpoints over v112 witness rows, v114 authority/key history, and future certificate records.
4. Pruning admission and tombstone-gated deletion for v115 histories.
5. Runtime and Axis adoption of v115 store-backed key-status-aware certification.
6. Live Postgres restart proof for rotated/revoked key histories.
7. Generic nested currentness/witness abstraction to reduce repetition across head layers.
8. Recovery-kernel inventory for every compacted required head and supporting authority store.
9. Production cryptographic verifier adapters instead of test signatures.
10. Transition-authority signatures for the history-store head witness authority transitions themselves.

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
10. SQ63: What non-retroactive authority epoch seal prevents later v115 pruning tombstone history-store head witness topology or key-status transitions from rewriting historical certified currentness?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Witness Key Status.

Problem it solves: v114 store-backed certification could still count a row signed by an old or revoked key if the cryptographic verifier accepted the signature and the principal id remained eligible.

Research source: CONIKS key transparency, AKI accountable key update/revocation, ARPKI transparent revocation, and Enhanced Certificate Transparency currentness/non-revocation proofs.

Mechanism borrowed or adapted: key currentness is a replayed authority projection over key-transition history. A signature row never carries its own current authority.

Why current substrate lacked it: v114 stored topology transitions and admitted initial key metadata, but its transition kind could not express key rotation or revocation.

Why existing primitives are insufficient: earlier key-status implementations govern different authority namespaces. Reusing them would let pruning tombstone-store head or tombstone-head authority leak into pruning tombstone history-store head certification.

State guarantee it should create: revoked or superseded pruning tombstone history-store head witness keys cannot authorize certified currentness, regardless of memory, connector cache, adapter state, or cryptographic verifier acceptance.

Admission rule it requires: a key-status transition may append only if replay proves it targets an active admitted witness principal at the transition's effective pruning tombstone sequence. Rotation must provide a new key id and algorithm. Revocation must name the currently admitted key.

Replay rule it requires: authority replay applies key-status transitions before witness replay. Witness replay and quorum evaluation accept a signature only when the signer is active and the signature key id, algorithm, and key status match the replayed topology.

Authority boundary it requires: key status is scoped to the pruning tombstone history-store head witness authority store only; adapters cannot pass key currentness as policy data.

Failure modes it should prevent:

- old-key witness rows certifying after a key rotation;
- revoked-key witness rows certifying after a key revocation;
- rotations for non-admitted witnesses entering authority history;
- revocations targeting a non-current key entering authority history;
- store-backed certification accepting cached witness rows without current key-status replay;
- cryptographic verification being mistaken for operational authority.

Minimal implementation slice:

- Extend the transition kind with `rotate_signature_key` and `revoke_signature_key`.
- Validate key-status transitions during authority replay and store append.
- Project key status and key-change metadata into principals.
- Enforce current key status in ledger and quorum signature checks.
- Add focused old-key, rotated-key, revoked-key, and malformed-transition tests.

Tests that would falsify it:

- A witness row signed by the old key certifies after a replayed rotation.
- A witness row signed by a revoked key certifies.
- A rotation for a non-admitted principal appends successfully.
- A rotated current-key row cannot certify.
- Replay has no way to distinguish key mismatch from key not current.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac agent and require it to reject cached old-key witness rows after replaying authority history.
- Axis A can attempt finance recovery using stale witness rows signed before key rotation and expect obstruction.
- Axis B can prove domain adapters cannot provide key-status policy outside the substrate-owned authority store.

## 7. Falsification Criteria Applied Before Implementation

1. Store-backed certification with old-key witness rows after replayed rotation returns `obstructed`.
2. Direct witness replay with old-key rows after rotation includes `ledger_signature_key_mismatch`.
3. Store-backed certification with revoked-key witness rows returns `obstructed`.
4. Direct witness replay with revoked-key rows includes `ledger_signature_key_not_current`.
5. Store-backed certification with rows signed by the rotated current key returns `certified`.
6. A rotation targeting a non-admitted witness is rejected before entering the authority store.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Admitted initial key metadata is enough once witness rows are signed. | Rejected. | v115 proves old-key rows fail after replayed rotation. |
| Revoked witness keys can remain historical authority for current certification. | Rejected for currentness. | v115 makes revoked-key rows obstruct store-backed certification. |
| Key status can be carried by signature verifier behavior. | Rejected. | v115 projects key status from authority transitions before verifier acceptance can matter. |

## 9. Implementation Frontier

Implemented now:

- `rotate_signature_key` and `revoke_signature_key` in `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionKind`.
- `signatureKeyStatus` and key-change metadata on pruning tombstone history-store head witness principals.
- Replay validation for malformed key-status transitions.
- Ledger and quorum signature current-key checks.
- Focused tests for old-key obstruction, rotated-key certification, revoked-key obstruction, and malformed key-transition rejection.

Remaining frontier:

1. SQ63 non-retroactive authority epoch seals.
2. Durable quorum-certificate proof records.
3. Proof-preserving compaction and pruning over v115 histories.
4. Runtime/Axis adoption and live Postgres restart proof.
5. Generic recovery kernel and nested currentness abstraction.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed via the targeted command: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root package typecheck passed across 22 of 23 workspace projects.
- `git diff --check` passed.
