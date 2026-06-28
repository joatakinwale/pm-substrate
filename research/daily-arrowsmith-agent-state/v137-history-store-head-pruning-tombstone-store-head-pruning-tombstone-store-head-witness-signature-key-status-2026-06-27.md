# v137 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone-Store Head Witness Signature Key Status

Date: 2026-06-27
Question closed: SQ84

## Research Question

What key-status replay prevents stale or revoked witnesses from certifying the v133 pruning tombstone-store head?

## Sources

- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Kim et al., "Accountable Key Infrastructure (AKI): A Proposal for a Public-Key Validation Infrastructure", WWW 2013: https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf
- Cremers et al., "ARPKI: Attack Resilient Public-Key Infrastructure", CCS 2014: https://people.cispa.io/cas.cremers/downloads/papers/ccsfp200s-cremersA.pdf

## Mechanism Extracted

CONIKS makes name-to-key bindings externally checkable through a transparent directory, so a private or stale key binding cannot silently become current identity. AKI and ARPKI add the missing lifecycle pressure: issuance, update, validation, and revocation must be auditable rather than hidden in local client state. The useful substrate mechanism is not the PKI terminology; it is replayed key currentness. A signature is only evidence when the signer, key id, algorithm, payload, and key status are all recovered from admitted history at the authority boundary that is evaluating the state claim.

The substrate adaptation is v137 signature key-status replay for the v135 witness topology. v134 witness rows for the v133 pruning tombstone-store head now carry optional witness signatures. v135 authority transitions can admit, rotate, and revoke witness signing keys. Store-backed v136 certification injects the replayed v135/v137 topology into strict witness-ledger replay before quorum evaluation, so unsigned, wrong-key, rotated-old-key, revoked-key, wrong-payload, or verifier-rejected witness rows cannot become currentness evidence.

## Existing Substrate Map

- v133 derives a pruning tombstone-store head from admitted v132 tombstone history.
- v134 records v133 head observations as hash-linked witness rows and can recover the latest accepted required head after amnesia.
- v135 certifies that required head through replayed witness membership and quorum thresholds.
- v136 recovers the v135 topology from a durable authority-transition store before certification.
- Earlier v126 proved the previous-layer pattern: witness records must be signed by keys current in replayed authority history before quorum can count them.

## Missing Substrate Map

- Before v137, the target v134 witness rows had no target-layer signature payload boundary.
- Before v137, the target v135 authority topology had no replayed signature-key lifecycle for this layer.
- Before v137, store-backed certification could derive membership durably but still count a persisted observation as witness evidence without proving that the observer's key was current, unrecalled, and matched to the exact observation payload.
- Existing topology replay was insufficient because membership answers "who may witness"; it did not answer "which admitted signing key is current for this witness evidence."
- Still missing after v137: non-retroactive epoch seals/finality for later key changes, durable quorum-certificate proof records for certified v133 required heads, production cryptographic verifier adapters, live Postgres restart proof, split-history transparency, storage-level guards, generic recovery, generic pruning-policy compilation, and authority-store compaction.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head witness signature key-status replay.

Problem it solves: prevents stale, revoked, unsigned, wrong-key, or forged v134 witness observations from certifying v133 required-head currentness.

Research source: CONIKS, AKI, and ARPKI.

Mechanism borrowed: transparent replay of name/key binding plus update/revocation lifecycle before a signed claim can count as current evidence.

Why current substrate lacked it: v136 recovered topology membership from admitted history, but target-layer witness rows and target-layer authority transitions did not bind witness identity to current key status.

Why existing primitives are insufficient: durable membership and quorum can prevent one observer from certifying alone, but they cannot distinguish a current witness signature from a stale key, revoked key, wrong payload, or unsigned row.

State guarantee it should create: v133 pruning tombstone-store head currentness can be certified only by v134 witness rows whose signatures replay against the current v135/v137 authority projection.

Admission rule it requires: v135 authority history must admit witness signing keys on witness admission, rotate keys only for active admitted principals, and revoke only the currently admitted key.

Replay rule it requires: v134 witness replay must recompute the observation signature payload hash, match signer to observer, match key id and algorithm to replay-current topology, reject revoked or missing keys, and call the verifier before the row can contribute to accepted witness state.

Authority boundary it requires: key currentness belongs inside the v135 authority-transition replay consumed by the v136 store-backed certifier, not inside connector memory, witness process memory, or a domain adapter.

Failure modes it should prevent: unsigned witness certification, stale-key certification after rotation, revoked-key certification, wrong-principal signatures, payload-substitution signatures, verifier-rejected signatures, and missing topology key metadata under strict policy.

Minimal implementation slice: target-layer witness signature fields, signature payload hashing, key metadata on v135 authority transitions, rotate/revoke transition replay, principal key-status projection, store-backed signature-policy injection, Postgres column persistence, and focused falsification tests.

Tests that would falsify it: unsigned stored witness rows still certify; a witness row signed by the old key certifies after a rotation; a revoked-key witness row certifies; a rotated current key cannot certify; or durable stores fail to preserve signature/key fields needed for replay.

Axis surfaces that could later validate it: Axis C amnesiac resume from pruned target histories, Axis A finance recovery after key rotation/revocation, and Axis B adapter pressure once agency/domain fixtures have durable required-head certification.

## Falsification Criteria

- Strict store-backed certification must reject unsigned v134 witness rows when v135 topology admits witness keys.
- Rotating witness A to a new key must make witness A rows signed with the old key fail replay before quorum counting.
- A row signed with witness A's current rotated key plus witness B's current key must certify the required v133 head.
- Revoking witness B's current key must make witness B rows fail replay before quorum counting.
- Missing authority topology or missing witness authorization must surface as replay obstruction, not as private adapter discretion.
- Postgres migrations and row mappers must preserve witness signatures and key-transition fields so restart replay has the same data as in-memory replay.

## Active 10-Question Backlog

1. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?
2. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
3. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
4. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
5. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
6. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
7. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
8. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
9. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
10. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?

## Failed Assumption Ledger

- Falsified: durable witness membership is enough to make witness evidence current. v137 shows a witness row also needs replay-current key status.
- Falsified: a signed row is operational evidence by shape alone. The signature must bind to the exact replayed observation payload and current admitted key.
- Still open: v137 has replayed key currentness but no epoch finality, durable QC proof records, production verifier adapter, or split-history transparency yet.

## Proof Status

Implemented in `@pm/agent-state`:

- v134 witness observation and record signatures for the target pruning tombstone-store head layer.
- `computeProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessObservationSignaturePayloadHash`.
- v135 authority-transition key metadata plus `rotate_signature_key` and `revoke_signature_key` replay.
- v137 principal key-status projection and strict witness-record signature replay checks.
- Store-backed v136 certifier injection of replayed v135/v137 topology into signature policy.
- Postgres persistence updates in migrations `0057` and `0058`.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ84 is closed. SQ85 is now the active next substrate question.
