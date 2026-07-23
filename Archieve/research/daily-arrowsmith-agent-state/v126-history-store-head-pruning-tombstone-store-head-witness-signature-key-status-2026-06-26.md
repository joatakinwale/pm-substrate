# v126 History Store-Head Pruning Tombstone Store-Head Witness Signature Key Status

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v125-history-store-head-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ73 - What signature-bound observer identity and key-status replay prevents forged, unsigned, old-key, or revoked-key v125 witness evidence from certifying history-store-head pruning tombstone-store head currentness?

Answer: v125 made witness topology durable, but stored witness rows could still be treated as evidence by observer id alone. The missing primitive is signature-bound witness evidence plus replayed signature-key currentness inside the v125 authority topology. A witness row can now count only when its signature principal equals the observer, its payload hash binds the exact observed v122 head/proof body, its key id and algorithm match the replay-current admitted key for that observer, and the verifier accepts the signature.

Implemented slice:

- Added signatures to history-store-head pruning tombstone-store head witness observations, witness records, replay, and Postgres persistence.
- Added `signatureKeyId`, `signatureAlgorithm`, and optional public-key fingerprint fields to v125 witness authority transitions and Postgres persistence.
- Added `rotate_signature_key` and `revoke_signature_key` authority transitions for this layer.
- Projected active/revoked key status from replayed v125 authority history.
- Store-backed certification now injects the replayed v125 topology into strict witness replay and quorum evaluation.
- Added focused tests proving unsigned rows fail, old-key rows fail after rotation, revoked-key rows fail, and current rotated-key rows certify.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf), [USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara)) | Public keys are not just names; they are bound to identities through transparent, auditable directory state so clients can detect equivocation or stale key views. | v126 binds witness rows to observer principals and replay-current admitted keys instead of accepting observer ids as self-authenticating state. |
| Kim et al. 2013, "Accountable Key Infrastructure (AKI)" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Key validation depends on accountable issuance and revocation checks, not local memory of a prior key. | v126 projects key rotation/revocation from authority-transition replay before signatures can count for certification. |
| Basin et al. 2014, "ARPKI: Attack Resilient Public-Key Infrastructure" ([PDF](https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf)) | Certificate update, revocation, and validation are protocol states that must be checked rather than assumed from cached identity. | v126 treats witness-key status as admitted state: wrong-key, superseded-key, and revoked-key evidence obstruct certification. |

## 3. Existing Substrate Map Delta

Already present before v126:

1. V121 replayable pruning tombstone records for actual history-store-head witness/authority/QC row deletion.
2. V122 deterministic pruning tombstone-store heads and exact required-head currentness checks.
3. V123 durable witness rows that recover the required v122 head after amnesia.
4. V124 quorum topology and certificates over replayed v123 witness rows.
5. V125 durable authority-transition stores and store-backed certification for v124 topology.

Newly added by v126:

1. Signature-bearing v123 witness observations and records for this nested currentness layer.
2. A payload-hash helper for history-store-head pruning tombstone-store head witness signatures.
3. V125 authority transition key metadata for admitted witnesses.
4. V125 `rotate_signature_key` and `revoke_signature_key` transition replay.
5. Principal key-status projection for this layer.
6. Strict ledger and quorum signature issue codes for missing, mismatched, unauthorized, stale-key, wrong-key, or verifier-rejected evidence.
7. Postgres persistence for witness signatures and authority key metadata.
8. Store-backed certification that derives both topology and key-currentness from durable v125 authority history.

## 4. Missing Substrate Map Delta

Still missing after v126:

1. Non-retroactive authority epoch seals for already certified history-store-head pruning tombstone-store heads.
2. Durable quorum-certificate proof records for certified v124/v126 currentness.
3. Proof-preserving compaction/pruning for v125 authority, key-status, and future certificate histories.
4. Runtime and Axis adoption of store-backed signed v126 certification.
5. Live Postgres restart proof that witness signatures and key-status transitions recover after process amnesia.
6. SQL migration/backfill hardening for existing unsigned rows or pre-v126 authority transitions.
7. Production cryptographic verifier and key-material adapter instead of the test verifier.
8. Generic nested currentness/witness abstraction to remove layer-specific repetition.
9. Recovery-kernel inventory for every compacted/pruned required head and supporting key-status authority.
10. A historical validation rule that distinguishes decision-time key currentness from latest-topology key currentness.

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
10. SQ74: What non-retroactive authority epoch seal prevents later v126 topology or key-status transitions from rewriting the authority basis of already certified history-store-head pruning tombstone-store heads?

## 6. Primitive Proposal Ledger

Name: History Store-Head Pruning Tombstone Store-Head Witness Signature Key Status.

Problem it solves: durable v125 topology could identify eligible observers, but witness rows were not cryptographically bound to those observers or to replay-current admitted keys.

Research source: CONIKS key transparency, AKI accountable key validation, and ARPKI update/revocation validation.

Mechanism borrowed or adapted: identity is not the label on an observation. Identity is a signed payload validated against a replayed, accountable key-status state.

Why current substrate lacks it: v125 stored topology but did not require witness evidence to carry signatures or admitted key metadata.

Why existing primitives are insufficient: durable topology alone prevents synthetic membership, but not forged rows, unsigned rows, or rows signed by stale keys after rotation/revocation.

State guarantee it should create: history-store-head pruning tombstone-store head currentness cannot be certified by private belief, observer-id labels, stale keys, revoked keys, or unsigned persisted rows.

Admission rule it requires: authority transitions admitting witnesses must include a signature key id and algorithm; rotations must target active principals with new key material; revocations must target the current key.

Replay rule it requires: witness replay and quorum evaluation must recompute the observation payload hash, check signature principal and key metadata against replayed authority topology, and call the verifier before a row can count.

Authority boundary it requires: v126 signatures are scoped only to v123 witness observations over v122 pruning tombstone-store heads in the pruning tombstone history-store head lane.

Failure modes it should prevent:

- unsigned witness rows certifying currentness;
- forged witness rows where principal id differs from observer id;
- witness rows with signatures over a different head/proof payload;
- witness rows from non-admitted observers;
- old-key rows after a key rotation;
- revoked-key rows after key revocation;
- invalid signatures passing store-backed certification.

Minimal implementation slice:

- Extend v123 witness observations/records with signatures.
- Extend v125 authority transitions with key metadata plus rotation/revocation kinds.
- Persist signatures and key metadata.
- Reuse the strict signature policy verifier at witness replay and quorum time.
- Add falsifier tests for unsigned, old-key, revoked-key, and rotated-current-key paths.

Tests that would falsify it:

- A store-backed certifier accepts unsigned witness rows.
- A row signed by the observer's old key still certifies after a key rotation.
- A row signed by a revoked key still certifies.
- A row signed by the replay-current key cannot certify.
- Replay accepts a signature whose payload hash differs from the observation body.

Axis surfaces that could later validate it:

- Axis C can restart with stored witness rows and stored key transitions and require signed currentness recovery without chat memory.
- Axis A can attempt to smuggle a finance adapter's unsigned pruning summary into required-head currentness and fail strict certification.
- Axis B can require domain adapters to cite signed, store-backed required-head currentness instead of local pruning-cache labels.

## 7. Falsification Criteria Used For This Slice

1. Store-backed certification over unsigned witness rows must fail with invalid witness replay.
2. Strict replay under a rotated topology must reject old-key witness rows.
3. Strict replay under a revoked topology must reject revoked-key witness rows.
4. Store-backed certification under a rotated topology must accept only rows signed by the current rotated key.
5. Stored authority transitions must replay key metadata from durable history, not process memory.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable observer ids are enough to identify witness evidence. | Rejected. | v126 requires principal signatures on witness rows. |
| Durable authority topology is enough without admitted key currentness. | Rejected. | Old-key and revoked-key rows now obstruct certification. |
| Signature verification can be a quorum-only concern. | Rejected. | v126 validates signatures during witness replay and quorum evaluation so invalid rows cannot become ledger-derived currentness. |
| Latest topology is sufficient for all historical signature checks. | Still open. | v126 intentionally exposes SQ74: non-retroactive epoch seals are needed so later key transitions cannot rewrite historical certification authority. |

## 9. Implementation Frontier

Implemented now:

1. V126 signed witness observation/record persistence for the history-store-head pruning tombstone-store head witness ledger.
2. V126 key metadata on v125 authority transitions and Postgres rows.
3. V126 key rotation/revocation replay and principal key-status projection.
4. Store-backed certification that injects replayed topology/key-status into strict witness replay.
5. Focused tests for unsigned, stale-key, revoked-key, and current rotated-key certification behavior.

Remaining frontier:

1. SQ74 authority epoch seals for non-retroactive historical certification.
2. Durable quorum-certificate proof records.
3. Proof-preserving compaction/pruning for this signed authority/certificate history.
4. Runtime/Axis adoption and live Postgres restart proof.
5. Generic nested currentness abstraction and recovery-kernel inventory.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
rg -n "[ \t]$" db/migrations/0052_agent_state_history_store_head_pruning_tombstone_store_head_witness.sql db/migrations/0053_agent_state_history_store_head_pruning_tombstone_store_head_witness_authority.sql research/daily-arrowsmith-agent-state/v126-history-store-head-pruning-tombstone-store-head-witness-signature-key-status-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused root Vitest command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.
- Explicit trailing-whitespace check on the new untracked v126 file and migrations returned no matches.
