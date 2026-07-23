# v81 Settlement-Head Witness Signature Key Status

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v80-durable-head-quorum-certificate-record-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ28 - What key-status and rotation system makes witness signatures decision-time current so revoked or rotated keys cannot authorize new observations, seals, or quorum-certificate records?

Answer: a settlement-head witness signature is not current merely because it verifies cryptographically. It is current only if replayed authority history projects the signer to an active principal with the same active admitted key at the settlement sequence being certified or replayed. Key status is now authority history, not adapter memory or verifier policy.

Implemented slice:

- Added `rotate_signature_key` and `revoke_signature_key` settlement-head witness authority transitions.
- Added replayed principal key status and key-change metadata.
- Strengthened strict settlement-head witness record replay so revoked keys, missing admitted keys, or mismatched rotated keys cannot authorize observations.
- Strengthened authority-epoch seal replay so finalizer signatures require an active current admitted key.
- Strengthened durable quorum-certificate record replay so stored witness evidence and seals are checked against the replayed current authority topology.
- Added store append policy propagation for quorum-certificate records so persisted proof records can fail closed on stale signatures.
- Added tests proving a revoked witness key obstructs recertification and invalidates already-recorded certificate proof replay under the new current topology.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Kim et al. 2013, "Accountable Key Infrastructure" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Certificate validation must account for provider-maintained public logs, revocation history, and accountable key status, not only local certificate parsing. | Settlement-head witness keys become replayed authority state, and old signatures are checked against that status before they count as authority. |
| Basin et al. 2014 / Cremers et al., "ARPKI: Attack Resilient Public-Key Infrastructure" ([PDF](https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf)) | Public-key authority becomes safer when issuance/revocation depends on multiple logged authorities and can be checked as a protocol property. | Witness key rotation/revocation is admitted through the head-witness authority log rather than hidden inside a verifier adapter. |
| Melara et al. 2015, "CONIKS" ([USENIX page](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Key directories must make bindings auditable and consistent across clients; a lookup result is not enough without monitoring. | Replayed principal state is the substrate key directory for witness signatures; currentness is derived from the authority log. |
| Larisch et al. 2017, "CRLite: A Scalable System for Pushing All TLS Revocations to All Browsers" ([PDF](https://cbw.sh/static/pdf/larisch-oakland17.pdf)) | Revocation has to be cheap and available at decision time or old credentials continue to authenticate. | Strict replay checks key status while certifying and while replaying certificate records so stale witness signatures cannot survive as proof. |

## 3. Existing Substrate Map Delta

Already present before v81:

1. Witness observations and authority-epoch seals could carry signatures.
2. Strict signature policy could verify payload hash, principal id, key id, algorithm, and verifier acceptance.
3. Durable quorum-certificate records could store signed witness evidence.
4. Replayed head-witness topology projected active principals by settlement sequence.

Newly strengthened by v81:

1. Signature key status is now projected from admitted authority-transition history.
2. Key rotation and revocation are explicit settlement-head witness authority transitions.
3. Strict witness replay checks current active admitted key status, not just cryptographic verifier success.
4. Strict seal replay checks the finalizer's current admitted key status.
5. Durable quorum-certificate record replay checks stored signatures against the current replayed topology.
6. Quorum-certificate record stores can enforce the same signature policy during append.

## 4. Missing Substrate Map Delta

Still missing:

1. Production cryptographic verifier adapters and public-key material verification.
2. Key-status effective-time semantics finer than settlement sequence, including signed-at/status-at proof.
3. Multi-authority key rotation approval for compromised witness keys.
4. Recovery rules for rotating all witnesses after authority compromise.
5. Proof-preserving compaction over witness ledgers, key histories, and certificate records.
6. Runtime monitor proof that strict graph/capability writes consumed current-key certificate records.
7. Domain compiler support for declaring current-key quorum-certificate requirements.
8. Concurrency isolation for simultaneous key transition, witness observation, seal, and certificate-record append.
9. External publication or gossip of key-status history outside one shared store.
10. Obstruction algebra that composes revoked keys, invalid certificate records, sealed epochs, and projection conflicts into one actionable recovery path.

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
10. SQ29: What proof-preserving compaction rule lets witness ledgers and key histories be pruned without losing replay of quorum-certificate records and key-currentness decisions?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Signature Key Status.

Problem it solves: v79/v80 could verify that a signature matched an admitted key id, but did not make the key's decision-time status replayable. A revoked or rotated key could still authorize old observations or certificate records if the verifier accepted the bits.

Research source: AKI, ARPKI, CONIKS, and CRLite.

Mechanism borrowed or adapted: key bindings and revocation become logged, replayable authority state. Signature acceptance composes cryptographic verification with current-status lookup at decision time.

Why current substrate lacked it: admitted principal metadata contained a key id and algorithm, but not key status transitions or replay checks for revoked/rotated keys across witness records, seals, and certificate records.

Why existing primitives were insufficient: a signature verifier can prove possession of some key, but only replayed authority history can decide whether that key is still authorized to constitute operational state.

State guarantee it should create: under strict signature policy, no settlement-head witness signature can authorize operational state unless the replayed authority topology projects the signer to an active principal with the same active admitted key.

Admission rule it requires: `rotate_signature_key` and `revoke_signature_key` transitions must target an active admitted principal; rotations require a new key id and algorithm; revocations must target the currently admitted key.

Replay rule it requires: witness records, authority-epoch seals, and quorum-certificate records must compare signature principal/key/algorithm against replayed principal state and reject revoked, absent, or rotated-away keys.

Authority boundary it requires: key status is owned by the settlement-head witness authority-transition log, not by private memory, adapter configuration, or the verifier callback.

Failure modes it should prevent:

- revoked witness keys continuing to certify settlement-store heads;
- old observations surviving as current proof after key revocation;
- durable quorum-certificate records replaying as valid under a topology where a supporting key is revoked;
- authority-epoch seals signed by no-current-key or revoked-key finalizers;
- verifier callbacks silently re-authorizing keys that the authority log revoked.

Minimal implementation slice:

- Add rotate/revoke key transition kinds to settlement-head witness authority history.
- Project key status into principal state during replay.
- Enforce active current key status in strict witness, seal, and quorum-certificate record replay.
- Carry signature policy through quorum-certificate record store append.
- Add focused falsification tests for revoked-key obstruction.

Tests that would falsify it:

- A revoked key's signed witness record still lets store-backed certification produce `certified`.
- A durable quorum-certificate record supported by a revoked key replays as valid under the revoked topology.
- A record store append with strict current-key policy admits stale signed evidence.
- A revocation targeting a different current key replays as valid.
- A seal signed by a revoked finalizer key replays as valid under strict policy.

Axis surfaces that could later validate it:

- Axis C can rotate or revoke a local agent witness key mid-run and require new observations before write authority.
- Axis A can prove finance writes cannot cite a stale signed head-quorum certificate after witness key revocation.
- Axis B can require marketing/profile adapters to declare which key-status topology authorizes profile-specific writes.

## 7. Falsification Criteria Applied Before Verification

1. A signed witness observation under an admitted key certifies before revocation.
2. After `revoke_signature_key`, the same signed witness evidence obstructs store-backed certification under strict policy.
3. Replayed authority topology exposes the principal key status as `revoked`.
4. A durable quorum-certificate record admitted before revocation fails strict replay under the revoked topology.
5. A new record-store append with strict revoked topology rejects the stale signed evidence.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Cryptographic signature verification is enough for witness currentness. | Falsified. | v81 requires replayed active key status in addition to verifier acceptance. |
| Admitted key id metadata is static principal identity. | Rejected. | v81 models key rotation and revocation as replayed authority transitions. |
| Durable certificate records remain valid regardless of later key status. | Partly falsified. | The record body remains historical proof, but strict replay under current topology can reject it as current authority after revocation. |

## 9. Implementation Frontier

Implemented now:

- Settlement-head witness key-status transition kinds: `rotate_signature_key` and `revoke_signature_key`.
- Replayed `signatureKeyStatus` plus key-change metadata on principal state.
- Strict current-key checks in witness-record signature replay.
- Strict current-key checks in authority-epoch seal signature replay.
- Strict current-key checks in quorum-certificate record replay.
- Signature-policy enforcement during in-memory and Postgres quorum-certificate record append.
- Focused regression test for revoked witness key certification and record replay.

Remaining frontier:

1. Production crypto/key-management adapters.
2. Signed-at/status-at temporal proof for old records that should remain historically valid but no longer current.
3. Multi-party approval for key rotation/revocation.
4. Concurrent append isolation across key status, witness, seal, and certificate-record stores.
5. Monitor proof for strict write paths.
6. Proof-preserving compaction rules.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 70 tests.
- Full workspace `pnpm typecheck` passed.
- Broad substrate Vitest slice passed: 31 files passed, 390 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves a minimal replayed key-status primitive for settlement-head witness signatures across the current workspace test slice. It does not yet prove production cryptographic adapters, multi-authority rotation, concurrent append isolation under real database contention, Axis A/B/C runner adoption, monitor coverage, or compaction.
