# v104 Pruning Tombstone-Store Head Witness Key Status

Date: 2026-06-26
Status: substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v103-signature-bound-pruning-tombstone-store-head-witness-identity-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ51 - What key-status replay and rotation semantics prevent revoked or superseded pruning tombstone-store head witness keys from authorizing certified required-head recovery?

Answer: pruning tombstone-store head witness key status must be replayed as authority state, not inferred from a signature that still verifies cryptographically. A witness signature can contribute to required-head certification only when the replayed pruning tombstone-store head witness authority topology currently binds that witness to the signing key as `active` for the required pruning tombstone sequence. `rotate_signature_key` makes prior-key observations fail current replay. `revoke_signature_key` makes the revoked key fail even if the signature payload remains valid.

Implemented slice:

- Added `rotate_signature_key` and `revoke_signature_key` to pruning tombstone-store head witness authority transitions.
- Added a replay issue code for invalid pruning tombstone-store head witness signature-key transitions.
- Added replay validation that key transitions target active admitted principals.
- Required rotations to carry a new key id and algorithm.
- Required revocations to name the currently admitted key.
- Projected active/revoked key status and key-change metadata into replayed principal state.
- Added tests proving stale old-key observations fail after rotation, rotated-key observations certify, revoked-key observations obstruct certification, and malformed key transitions cannot be appended.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Name-to-key bindings are directory state. Clients monitor consistency of bindings across signed directory epochs instead of trusting local key memory. | Witness key identity is replayed from authority-transition history. After rotation, prior key ids are no longer current even if their signatures still verify. |
| Kim et al. 2013, "Accountable Key Infrastructure (AKI): A Proposal for a Public-Key Validation Infrastructure" ([ACM](https://dl.acm.org/doi/10.1145/2488388.2488448), [PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Key issuance, update, revocation, and recovery are accountable operations with checks and balances; key changes are not private caller facts. | Key revocation and rotation become authority transitions that replay before witness evidence can count. |
| Basin et al. 2014, "ARPKI: Attack Resilient Public-Key Infrastructure" ([ETH Zurich](https://netsec.ethz.ch/research/arpki/), [PDF](https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf)) | Certificate issuance, update, revocation, and validation are transparent and accountable; compromising fewer than the configured trusted entities is insufficient for impersonation. | A stale or compromised witness key cannot impersonate current witness authority after replay has superseded or revoked it. |
| Kong et al. 2026, "CTng: Secure Certificate and Revocation Transparency" ([NDSS PDF](https://www.ndss-symposium.org/wp-content/uploads/2026-s213-paper.pdf)) | Relying parties validate both transparency and revocation updates from threshold-signed monitor state, and cached updates remain verifiable even from untrusted distribution channels. | Store-backed certification consumes replayed key-status projection, so the cache/source of witness rows cannot bypass current revocation state. |

## 3. Existing Substrate Map Delta

Already present before v104:

1. Durable pruning tombstone-store head witness observations.
2. Replayed pruning tombstone-store head witness quorum topology.
3. Durable authority-transition stores for that topology.
4. Signature-bound witness identity for pruning tombstone-store head observations.
5. Strict store-backed certification that injects the replayed topology into witness signature replay.

Newly added by v104:

1. Pruning tombstone-store head witness key-status authority transitions.
2. Replay validation for malformed rotate/revoke transitions.
3. Principal key-status projection for `active` and `revoked` witness keys.
4. Current-key enforcement for rotated keys through the existing strict signature replay.
5. Current-key enforcement for revoked keys through replayed `signatureKeyStatus`.
6. Store-backed certification falsifiers for old-key and revoked-key evidence.

## 4. Missing Substrate Map Delta

Still missing:

1. Non-retroactive authority epoch seals for pruning tombstone-store head witness topology and key-status history.
2. Durable quorum-certificate records for certified pruning tombstone-store heads.
3. Proof-preserving compaction and pruning for this witness, authority, key-status, and certificate history.
4. Runtime recovery integration that requires the store-backed signed certifier instead of direct topology evaluation.
5. Live Postgres restart tests for key-status-aware certified required-head recovery.
6. Production cryptographic verifier adapters for this new witness layer.
7. Monitoring that detects callers evaluating witness replay without store-derived topology/key status.
8. Domain adapter conformance tests proving adapters cannot smuggle witness key status through configuration.
9. Topology-transition signer authority for this layer; key-status transitions are hash-chain replayed but not yet signed by an institutional authority.
10. Key-validity epoch semantics that distinguish "valid for historical proof" from "current for new certification" once durable certificate records exist.

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
10. SQ52: What non-retroactive authority epoch seal prevents later pruning tombstone-store head witness topology or key-status transitions from rewriting historical required-head certification?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Witness Key Status.

Problem it solves: v103 made witness observations signed and topology-bound, but an old or compromised key could still satisfy the cryptographic verifier unless replay knew that the key had been superseded or revoked.

Research source: CONIKS key transparency, AKI accountable key update/revocation, ARPKI transparent accountable revocation, and CTng revocation transparency.

Mechanism borrowed or adapted: key status is not a property of a signature row. It is a replayed authority projection over admitted key-transition history.

Why current substrate lacked it: this layer inherited signature fields and admitted key metadata in v103, but its authority-transition kind still came from a narrower base topology that could not express key rotation or revocation.

Why existing primitives are insufficient: the older settlement-head and tombstone-head layers already have similar key-status semantics, but they govern different authority namespaces. Reusing them would let the wrong topology authorize pruning tombstone-store head required-head recovery.

State guarantee it should create: stale, superseded, or revoked pruning tombstone-store head witness keys cannot authorize certified required-head recovery, regardless of agent memory, connector cache, adapter configuration, or cryptographic verifier acceptance.

Admission rule it requires: a key-status transition may be admitted only if it targets an active admitted witness principal. Rotation must name a new key id and algorithm. Revocation must name the currently admitted key.

Replay rule it requires: authority replay applies key-status transitions before witness signature replay. Witness replay accepts a signature only when the signer principal is active and the signature key id, algorithm, and key status match the replayed topology.

Authority boundary it requires: pruning tombstone-store head witness key status is scoped to the pruning tombstone-store head witness authority topology only.

Failure modes it should prevent:

- old-key witness rows certifying after a key rotation;
- revoked-key witness rows certifying after a key revocation;
- malformed key rotations entering authority history;
- revocations targeting a key other than the current admitted key;
- store-backed certification accepting cached witness rows without current key-status replay;
- adapters treating cryptographic verification as sufficient authority.

Minimal implementation slice:

- Extend this layer's authority transition kind with key rotation and revocation.
- Validate key transitions during authority replay and append-time store checks.
- Project `signatureKeyStatus` and key-change metadata into principal state.
- Reuse strict witness signature replay to reject non-current keys.
- Add focused tests for stale old-key, rotated current-key, revoked-key, and malformed key-transition cases.

Tests that would falsify it:

- A witness row signed by the old key still certifies after a replayed rotation.
- A witness row signed by a revoked key still certifies.
- A rotation without key id or algorithm appends successfully.
- A revocation of a non-current key appends successfully.
- A newly rotated key cannot certify after the topology replay projects it as active.

Axis surfaces that could later validate it:

- Axis C can restart with stored witness rows and authority transitions, then prove old-key rows obstruct and rotated-key rows certify without agent memory.
- Axis A can attempt finance recovery using cached required-head witness rows signed before a key rotation and expect obstruction.
- Axis B can require domain adapters to consume key-status-aware store-backed certification rather than carrying witness key status in adapter state.

## 7. Falsification Criteria Applied Before Implementation

1. Store-backed certification with old-key witness rows after replayed rotation must return `obstructed`, not `certified`.
2. Witness replay with the old key after rotation must include `ledger_signature_key_mismatch`.
3. Store-backed certification with revoked-key witness rows must return `obstructed`, not `certified`.
4. Witness replay with a revoked key must include `ledger_signature_key_not_current`.
5. Rotated-key witness rows must certify under the replayed rotated topology.
6. Malformed key-status transitions must fail append-time authority replay.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A cryptographically valid witness signature is current until the verifier rejects it. | Rejected. | v104 requires replayed key-status authority to say the signing key is current. |
| Key rotation can be represented as adapter/key-store configuration. | Rejected. | v104 models rotation as an admitted authority transition. |
| Revocation only matters for future observations. | Rejected for certification. | Store-backed certification now replays current key status before deciding whether stored witness rows can authorize current required-head recovery. |

## 9. Implementation Frontier

Implemented now:

- Key-status transition kinds for pruning tombstone-store head witness authority replay.
- Rotate/revoke validation against active admitted principals.
- Principal key-status and key-change metadata projection.
- Store-backed certification obstruction for old-key and revoked-key stored evidence.
- Positive rotated-key certification proof.
- Negative append-time malformed-transition proofs.

Remaining frontier:

1. Non-retroactive authority epoch seals for this layer.
2. Durable quorum-certificate records for pruning tombstone-store head certification.
3. Proof-preserving compaction and pruning over this new key-status history.
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
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v104-pruning-tombstone-store-head-witness-key-status-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, changelog, and ledger files found no matches.
