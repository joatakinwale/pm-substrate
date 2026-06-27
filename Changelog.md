# Changelog

## 2026-06-26 - Pruning tombstone history-store head quorum-certificate record

- Added `research/daily-arrowsmith-agent-state/v117-pruning-tombstone-history-store-head-quorum-certificate-record-2026-06-26.md`, closing SQ64 with durable QC proof records for certified pruning tombstone history-store heads and replacing it with SQ65.
- Added `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertificateRecord` and witness-evidence types in `@pm/agent-state`.
- Added deterministic history-store head QC record hashing, witness-evidence extraction, and record-chain replay.
- Added replay checks for certified-only admission, certificate hash, record hash, accepted witness evidence membership, strict witness signatures, replayed key currentness, and authority epoch seal binding.
- Added in-memory and Postgres-backed history-store head QC record stores that reject append unless the full proof-record history replays.
- Added migration `0049_agent_state_projection_replay_pruning_tombstone_history_store_head_witness_quorum_certificates.sql`.
- Extended focused agent-state tests to prove valid durable record replay, tampered witness-evidence rejection, forged seal rejection, and unsigned-evidence append rejection.
- Claim boundary: v117 makes certified history-store heads recoverable from durable proof records, but proof-preserving compaction/pruning, runtime/Axis adoption, live restart proof, and production crypto remain open.

## 2026-06-26 - Pruning tombstone history-store head witness authority epoch seal

- Added `research/daily-arrowsmith-agent-state/v116-pruning-tombstone-history-store-head-witness-authority-epoch-seal-2026-06-26.md`, closing SQ63 with non-retroactive authority epoch seals for v115 history-store head witness topology/key-status history and replacing it with SQ64.
- Added `seal_authority_epoch` to `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionKind`.
- Added seal fields for sealed pruning tombstone sequence, sealed authority topology hash, and sealed quorum-certificate hash across transition inputs, hashing, replay, and store surfaces.
- Added `effectiveAuthorityHash`, `sealedThroughPruningTombstoneSequence`, and `authorityEpochSeals` to replayed history-store head witness topology.
- Extended migration `0048` and the Postgres authority-transition store insert/select path with seal columns.
- Added replay and store append rejection for non-seal topology/key-status transitions effective at or before a sealed frontier.
- Changed history-store head witness quorum certification to report the effective topology hash after a seal, not the seal transition hash.
- Extended focused agent-state tests to prove valid seal replay, forged-seal rejection, retroactive replay rejection, store append retroactive rejection, and store-backed certification preserving the sealed effective topology hash.
- Claim boundary: v116 prevents later topology/key-status transitions from rewriting sealed certified currentness, but durable quorum-certificate records, proof-preserving compaction/pruning, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Pruning tombstone history-store head witness key status

- Added `research/daily-arrowsmith-agent-state/v115-pruning-tombstone-history-store-head-witness-key-status-2026-06-26.md`, closing SQ62 with key-status replay for v114 history-store head witness keys and replacing it with SQ63.
- Added `rotate_signature_key` and `revoke_signature_key` to `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionKind`.
- Added replay validation so malformed history-store head witness key-status transitions cannot enter the v114 authority store.
- Added `signatureKeyStatus` and key-change metadata to replayed history-store head witness principals.
- Extended strict witness ledger and quorum signature replay so old rotated keys and revoked keys cannot authorize store-backed certified currentness.
- Extended focused agent-state tests to prove old-key obstruction after rotation, rotated-key certification, revoked-key obstruction, and invalid key-transition rejection.
- Claim boundary: v115 prevents stale or revoked witness keys from certifying currentness, but authority epoch seals, durable quorum-certificate records, proof-preserving compaction/pruning, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Durable pruning tombstone history-store head witness authority store

- Added `research/daily-arrowsmith-agent-state/v114-pruning-tombstone-history-store-head-witness-authority-store-2026-06-26.md`, closing SQ61 with durable authority-transition stores for v113 topology and replacing it with SQ62.
- Added `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionStore` plus append input in `@pm/agent-state`.
- Added in-memory and Postgres-backed pruning tombstone history-store head witness authority-transition stores.
- Added append-time replay validation so malformed quorum topology cannot enter the store as durable authority.
- Added `StoreBackedProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertifier`, deriving topology from stored authority history and witness rows before certification.
- Added migration `0048_agent_state_projection_replay_pruning_tombstone_history_store_head_witness_authority.sql`.
- Extended focused agent-state tests to prove store-backed two-witness certification, incomplete-store obstruction, and invalid stored quorum-transition rejection.
- Claim boundary: v114 prevents adapter-supplied topology arrays from certifying history-store head currentness, but key-status replay, authority epoch seals, durable quorum-certificate records, proof-preserving compaction/pruning, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Pruning tombstone history-store head witness quorum authority

- Added `research/daily-arrowsmith-agent-state/v113-pruning-tombstone-history-store-head-witness-quorum-authority-2026-06-26.md`, closing SQ60 with signed quorum authority for v112 required-head currentness and replacing it with SQ61.
- Added v113 pruning tombstone history-store head witness authority transition, topology, quorum policy, quorum certificate, and certificate hash types in `@pm/agent-state`.
- Added signature payload hashing for v112 history-store head observations and strict replay checks against the v113 topology.
- Extended v112 witness observations and records to preserve optional signatures through in-memory replay and Postgres persistence.
- Extended migration `0047_agent_state_projection_replay_pruning_tombstone_history_store_head_witness.sql` with a `signature` column.
- Extended focused agent-state tests to prove signed two-witness certification, unsigned strict-replay rejection, one-witness non-certification, wrong-key rejection, and unauthorized-observer rejection.
- Claim boundary: v113 prevents one observer, unsigned rows, wrong keys, or forged observer ids from certifying history-store head currentness, but durable authority-transition stores, store-backed certification, key-status replay, epoch seals, durable quorum-certificate records, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Pruning tombstone history-store head witness ledger

- Added `research/daily-arrowsmith-agent-state/v112-pruning-tombstone-history-store-head-witness-ledger-2026-06-26.md`, closing SQ59 with durable witness-ledger recovery for required v111 heads and replacing it with SQ60.
- Added v112 pruning tombstone history-store head witness proof, observation, decision, record, replay, and ledger types in `@pm/agent-state`.
- Added consistency-proof validation over v110 pruning tombstone records and replay recomputation of witness decisions from prior accepted heads.
- Added in-memory and Postgres-backed witness ledgers plus `LedgerBackedProjectionReplayPruningTombstoneHistoryStoreHeadWitness`.
- Added migration `0047_agent_state_projection_replay_pruning_tombstone_history_store_head_witness.sql`.
- Extended focused agent-state tests to prove replay-derived required-head continuity after amnesia, same-sequence fork obstruction after resume, and tampered witness-record invalidation.
- Claim boundary: durable recovery now exists for this required head, but quorum topology/signature-bound authority, runtime/Axis adoption, live Postgres restart proof, generic currentness abstraction, and recovery-kernel inventory remain open.

## 2026-06-26 - Pruning tombstone history currentness

- Added `research/daily-arrowsmith-agent-state/v111-pruning-tombstone-store-head-pruning-tombstone-history-currentness-2026-06-26.md`, closing SQ58 with v110 pruning tombstone history currentness and replacing it with SQ59.
- Added a replay-derived v110 pruning tombstone-store head type, deterministic head hashing, and record-to-head projection in `@pm/agent-state`.
- Extended v110 pruned-store continuity with `requiredPruningTombstoneStoreHead` and `pruningTombstoneStoreHead`.
- Continuity now rejects missing local tombstone history, stale local history, unwitnessed local advance, same-sequence forked history, and hash-invalid required heads before pruned row absence can authorize projection recovery.
- Extended focused agent-state tests to prove valid required-head recovery and all pruning tombstone history currentness obstruction paths.
- Claim boundary: currentness now exists for this tombstone ledger, but durable witness/quorum recovery of the required v111 head, runtime/Axis adoption, live Postgres restart proof, SQL hardening, and production crypto adapters remain open.

## 2026-06-26 - Pruning tombstone-store head pruning tombstone store API

- Added `research/daily-arrowsmith-agent-state/v110-pruning-tombstone-store-head-pruning-tombstone-store-api-2026-06-26.md`, closing SQ57 with tombstone-gated physical pruning and replacing it with SQ58.
- Added pruning tombstone-store head replay compaction pruning tombstone record, frontier, replay, continuity, and store types in `@pm/agent-state`.
- Added deterministic tombstone record hashing and replay over sequence continuity, previous hash, checkpoint/admission binding, frontier derivation, frontier regression, and record hash.
- Added in-memory and Postgres-backed pruning tombstone record stores plus migration `0046_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_pruning_tombstones.sql`.
- Added tombstone-gated prune APIs for pruning tombstone-store head witness, authority, and quorum-certificate stores.
- Added pruned-store continuity checks that replay retained suffixes after physical deletion and detect out-of-band retained-suffix truncation.
- Extended focused agent-state tests to prove admitted record append/replay, tamper rejection, guarded physical pruning, post-prune continuity, and silent truncation detection.
- Claim boundary: actual row deletion is now replayable for this layer, but currentness/witnessing for the new pruning tombstone ledger, runtime/Axis adoption, live Postgres restart proof, SQL hardening, and production crypto adapters remain open.

## 2026-06-26 - Pruning tombstone-store head compaction pruning admission

- Added `research/daily-arrowsmith-agent-state/v109-pruning-tombstone-store-head-compaction-pruning-admission-2026-06-26.md`, closing SQ56 with pruning tombstone-store head compaction pruning admission and replacing it with SQ57.
- Added pruning tombstone-store head compaction pruning-admission lane, status, issue, admission, and deterministic hash types in `@pm/agent-state`.
- Added pruning admission evaluation that requires replay-valid durable pruning tombstone-store head checkpoint-admission history before physical prefix deletion can be admitted.
- Pruning admission now validates retained pruning tombstone-store head witness-ledger, authority-topology, and quorum-certificate-record suffixes by replaying each selected lane from the admitted checkpoint frontier.
- Extended focused agent-state tests to prove admitted pruning plus missing-record, conflicting-record-history, invalid-witness-suffix, invalid-authority-suffix, and invalid-quorum-certificate-suffix obstructions.
- Claim boundary: pure pruning admission now exists for this layer, but tombstone-gated physical pruning APIs, durable pruning tombstone records, pruned-store continuity, runtime/Axis adoption, live Postgres recovery, SQL hardening, and production crypto adapters remain open.

## 2026-06-26 - Durable pruning tombstone-store head checkpoint admission store

- Added `research/daily-arrowsmith-agent-state/v108-pruning-tombstone-store-head-durable-checkpoint-admission-store-2026-06-26.md`, closing SQ55 with durable pruning tombstone-store head checkpoint-admission records and replacing it with SQ56.
- Added pruning tombstone-store head checkpoint-admission record types, deterministic record hashing, and record-chain replay in `@pm/agent-state`.
- Added replay checks for tenant, sequence, previous-record hash, checkpoint hash, admission hash, strict admission re-evaluation, record hash, checkpoint-id conflicts, and compacted-frontier conflicts.
- Added in-memory and Postgres-backed checkpoint-admission record stores plus migration `0045_agent_state_projection_replay_pruning_tombstone_store_head_checkpoint_admissions.sql`.
- Extended focused agent-state tests so compacted replay consumes the admission certificate recovered from the durable record store, while tampered admissions and conflicting checkpoint records fail.
- Claim boundary: durable compacted checkpoint authority now exists for this layer, but pruning admission, tombstone-gated physical pruning APIs, pruned-store continuity, runtime/Axis adoption, live Postgres recovery, cross-agent monitoring, and production crypto adapters remain open.

## 2026-06-26 - Pruning tombstone-store head proof-preserving compaction

- Added `research/daily-arrowsmith-agent-state/v107-pruning-tombstone-store-head-proof-preserving-compaction-2026-06-26.md`, closing SQ54 with admitted pruning tombstone-store head replay compaction checkpoints and replacing it with SQ55.
- Added pruning tombstone-store head replay compaction checkpoint and checkpoint-admission certificate types in `@pm/agent-state`.
- Added deterministic checkpoint and admission hashing for compacted witness-ledger, authority/key/seal, and quorum-certificate-record frontiers.
- Witness, authority, and QC-record replay can now resume from admitted checkpoint frontiers plus retained hash-linked suffixes.
- Replay rejects suffix-only histories, missing checkpoint admissions, and tampered checkpoint bodies before compacted state can seed operational state.
- Extended focused agent-state tests to prove suffix-only failure, missing-admission failure, admitted recovery, authority suffix recovery, latest QC-record recovery, and tampered-checkpoint rejection.
- Claim boundary: admitted checkpoint-seeded replay now exists for this layer, but durable checkpoint-admission stores, pruning admission, physical pruning APIs, runtime/Axis adoption, live Postgres recovery, and production crypto adapters remain open.

## 2026-06-26 - Durable pruning tombstone-store head quorum-certificate records

- Added `research/daily-arrowsmith-agent-state/v106-pruning-tombstone-store-head-quorum-certificate-record-2026-06-26.md`, closing SQ53 with durable pruning tombstone-store head quorum-certificate records and replacing it with SQ54.
- Added pruning tombstone-store head quorum-certificate record and witness-evidence types in `@pm/agent-state`.
- Added record-chain replay that validates certified status, certificate hash, record hash, accepted witness evidence, strict witness signatures, key currentness, and authority epoch seal binding.
- Added in-memory and Postgres-backed quorum-certificate record stores that reject append unless the full proof history replays.
- Added migration `0044_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_quorum_certificates.sql`.
- Extended focused agent-state tests to prove valid durable proof replay, malformed witness-evidence rejection, forged seal rejection, and unsigned-evidence append rejection.
- Claim boundary: durable certified required-head proof now exists for this layer, but proof-preserving compaction/pruning, runtime/Axis adoption, live Postgres restart proof, topology-transition signer authority, and production crypto adapters remain open.

## 2026-06-26 - Pruning tombstone-store head witness authority epoch seal

- Added `research/daily-arrowsmith-agent-state/v105-pruning-tombstone-store-head-witness-authority-epoch-seal-2026-06-26.md`, closing SQ52 with pruning tombstone-store head witness authority epoch seals and replacing it with SQ53.
- Added `seal_authority_epoch` authority transitions for pruning tombstone-store head witnesses in `@pm/agent-state`.
- Pruning tombstone-store head witness authority replay now validates seal sequence, effective sequence, monotonic seal advancement, effective topology hash binding, and quorum certificate hash binding.
- Replayed pruning tombstone-store head witness topology now exposes accepted authority epoch seals and the sealed pruning tombstone sequence frontier.
- Authority replay and authority-transition stores now reject later non-seal transitions that try to mutate a sealed pruning tombstone-store head witness epoch.
- Extended focused agent-state tests to prove valid seal replay, forged topology-hash seal rejection, direct retroactive replay rejection, append-time retroactive rejection, and store-backed certification preserving the effective pre-seal topology hash.
- Claim boundary: non-retroactive authority sealing now exists for this layer, but durable quorum-certificate records, proof-preserving compaction/pruning, runtime/Axis adoption, topology-transition signer authority, live Postgres recovery, and production crypto adapters remain open.

## 2026-06-26 - Pruning tombstone-store head witness key status

- Added `research/daily-arrowsmith-agent-state/v104-pruning-tombstone-store-head-witness-key-status-2026-06-26.md`, closing SQ51 with pruning tombstone-store head witness key-status replay and replacing it with SQ52.
- Added `rotate_signature_key` and `revoke_signature_key` authority transitions for pruning tombstone-store head witnesses in `@pm/agent-state`.
- Pruning tombstone-store head witness authority replay now validates key-status transitions against active admitted principals, requires rotations to provide a key id and algorithm, and requires revocations to target the current admitted key.
- Replayed pruning tombstone-store head witness principals now project active/revoked key status plus key-change authority metadata.
- Store-backed pruning tombstone-store head certification now fails closed when stored observations were signed by revoked or superseded keys.
- Extended focused agent-state tests to prove old-key obstruction after rotation, rotated-key certification, revoked-key obstruction, and malformed key-status append rejection.
- Claim boundary: key-status replay now exists for this layer, but non-retroactive authority epoch seals, durable quorum-certificate records, proof-preserving compaction/pruning, runtime/Axis adoption, and production crypto adapters remain open.

## 2026-06-26 - Signature-bound pruning tombstone-store head witness identity

- Added `research/daily-arrowsmith-agent-state/v103-signature-bound-pruning-tombstone-store-head-witness-identity-2026-06-26.md`, closing SQ50 with signature-bound pruning tombstone-store head witness identity and replacing it with SQ51.
- Added pruning tombstone-store head witness observation signature payload hashing in `@pm/agent-state`.
- Pruning tombstone-store head witness records now preserve optional principal signatures through record building, in-memory replay, Postgres persistence, and row mapping.
- Pruning tombstone-store head witness authority transitions now carry admitted key id, algorithm, and public-key fingerprint metadata into replayed principal state.
- Store-backed pruning tombstone-store head certification now replays witness signatures against store-derived authority topology before quorum evaluation.
- Added migration `0043_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_signatures.sql`.
- Extended focused agent-state tests to prove signed two-witness certification, unsigned persisted witness obstruction, wrong-key replay invalidation, and admitted key projection.
- Claim boundary: signature-bound identity now exists for this layer, but key-status rotation/revocation, authority epoch seals, durable quorum-certificate records, runtime/Axis adoption, and production crypto adapters remain open.

## 2026-06-26 - Durable pruning tombstone-store head witness authority store

- Added `research/daily-arrowsmith-agent-state/v102-durable-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md`, closing SQ49 with durable pruning tombstone-store head witness authority-transition stores and replacing it with SQ50.
- Added pruning tombstone-store head witness authority store contracts plus in-memory and Postgres-backed implementations in `@pm/agent-state`.
- Added migration `0042_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_authority.sql`.
- Added store-backed pruning tombstone-store head witness quorum certification, deriving topology from stored authority transitions plus stored witness records.
- Extended focused agent-state tests to prove stored transition chaining, malformed quorum append rejection, single-witness non-certification through the store-backed certifier, and two-witness certification through store replay.
- Claim boundary: certified required-head recovery can now derive quorum topology from admitted store history, but signature-bound identity, key status, authority epoch seals, durable certificate records, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Pruning tombstone-store head witness quorum topology

- Added `research/daily-arrowsmith-agent-state/v101-pruning-tombstone-store-head-witness-quorum-topology-2026-06-26.md`, closing SQ48 with pruning tombstone-store head witness quorum topology and replacing it with SQ49.
- Added pruning tombstone-store head witness authority-transition/topology replay, quorum policy, quorum certificate, and deterministic certificate hashing in `@pm/agent-state`.
- Tombstone-head pruned-store continuity now supports `requiredPruningTombstoneStoreHeadQuorumCertificate` and strict `requirePruningTombstoneStoreHeadQuorumCertificate` enforcement.
- Extended focused agent-state tests to prove one observer cannot certify, unauthorized observers cannot count, two admitted observers can certify, and strict continuity rejects raw or non-certified required heads.
- Claim boundary: pruning tombstone-store head currentness can now require topology-bound quorum certification, but durable topology stores, store-backed certification, signatures/key status, certificate records, runtime/Axis adoption, and live restart proof remain open.

## 2026-06-26 - Durable pruning tombstone-store head witness ledger

- Added `research/daily-arrowsmith-agent-state/v100-durable-pruning-tombstone-store-head-witness-ledger-2026-06-26.md`, closing SQ47 with durable pruning tombstone-store head witness recovery and replacing it with SQ48.
- Added pruning tombstone-store head witness observation, decision, record, replay, and ledger types in `@pm/agent-state`.
- Added in-memory and Postgres-backed pruning tombstone-store head witness ledgers plus migration `0041_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness.sql`.
- Added a ledger-backed witness that recovers the latest accepted required pruning tombstone-store head from replayed witness records before observing new heads.
- Extended focused agent-state tests to prove replay-derived required-head continuity, tampered witness-record invalidation, and forked-head obstruction without replacing the accepted head.
- Claim boundary: required pruning tombstone-store heads can now survive amnesia through durable witness replay, but quorum topology, signature/key status, runtime/Axis adoption, live Postgres restart proof, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head pruning tombstone-store head currentness

- Added `research/daily-arrowsmith-agent-state/v99-tombstone-head-pruning-tombstone-store-head-currentness-2026-06-26.md`, closing SQ46 with pruning tombstone-store head currentness and replacing it with SQ47.
- Added deterministic tombstone-head pruning tombstone-store head hashing and derivation from replayed pruning tombstone records in `@pm/agent-state`.
- Tombstone-head pruned-store continuity now accepts `requiredPruningTombstoneStoreHead`, returns the replay-derived `pruningTombstoneStoreHead`, and rejects missing, stale, unwitnessed-advance, same-sequence forked, or hash-invalid pruning tombstone histories.
- Extended focused agent-state tests to prove valid required-head recovery and all pruning tombstone-store head currentness obstruction paths.
- Claim boundary: pruning tombstone replay validity no longer suffices for pruned operational state, but durable witness/quorum recovery of `requiredPruningTombstoneStoreHead`, runtime/Axis adoption, live Postgres recovery, SQL hardening, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head pruning tombstone store API

- Added `research/daily-arrowsmith-agent-state/v98-tombstone-head-pruning-tombstone-store-api-2026-06-26.md`, closing SQ45 with tombstone-head tombstone-gated store pruning APIs and replacing it with SQ46.
- Added tombstone-head replay compaction pruning tombstone record, frontier, replay, continuity, and store types in `@pm/agent-state`.
- Added deterministic tombstone-head pruning tombstone record hashing and replay over checkpoint admission, pruning admission, frontiers, sequence continuity, previous hash, and record hash.
- Added in-memory and Postgres-backed tombstone-head pruning tombstone record stores.
- Added migration `0040_agent_state_projection_replay_pruning_tombstone_head_pruning_tombstones.sql`.
- Tombstone-head witness, authority, and quorum-certificate stores now expose tombstone-gated prune APIs that derive deletion frontiers only from replay-valid tombstone records.
- Added tombstone-head pruned-store continuity verification and focused tests proving actual pruning plus out-of-band retained-suffix truncation detection.
- Claim boundary: tombstone-head physical pruning is now replayable as a durable tombstone transition, but tombstone-head pruning tombstone-store head currentness, runtime/Axis adoption, live Postgres recovery, SQL hardening, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head compaction pruning admission

- Added `research/daily-arrowsmith-agent-state/v97-tombstone-head-compaction-pruning-admission-2026-06-26.md`, closing SQ44 with tombstone-head replay compaction pruning admission and replacing it with SQ45.
- Added pruning tombstone-head replay compaction pruning lane, status, issue, admission, and hash types in `@pm/agent-state`.
- Added pruning admission evaluation that requires replay-valid durable tombstone-head checkpoint-admission history before a checkpoint can authorize pruning.
- Pruning admission now validates retained tombstone-head witness-ledger, authority-topology, and quorum-certificate-record suffixes by replaying each selected lane from the admitted checkpoint frontier.
- Extended the focused tombstone-head compaction test to prove admitted pruning plus missing-record, invalid-witness-suffix, and invalid-authority-suffix obstruction.
- Claim boundary: pure tombstone-head pruning admission now exists, but tombstone-gated physical pruning APIs, durable pruning tombstone stores, pruned-store continuity, Postgres pruning recovery, runtime/Axis adoption, and production crypto adapters remain open.

## 2026-06-26 - Durable tombstone-head checkpoint admission store

- Added `research/daily-arrowsmith-agent-state/v96-durable-tombstone-head-checkpoint-admission-store-2026-06-26.md`, closing SQ43 with durable tombstone-head checkpoint-admission records and replacing it with SQ44.
- Added pruning tombstone-head checkpoint-admission record types, deterministic record hashing, replay result types, and issue codes in `@pm/agent-state`.
- Checkpoint-admission record replay now verifies sequence continuity, previous-record hashes, checkpoint body hashes, admission certificate hashes, strict admission re-evaluation, record hashes, and conflicting checkpoint ids/frontiers.
- Added in-memory and Postgres-backed tombstone-head checkpoint-admission record stores.
- Added migration `0039_agent_state_projection_replay_pruning_tombstone_head_checkpoint_admissions.sql`.
- Extended the tombstone-head compaction test so checkpoint-seeded replay consumes the admission certificate recovered from the durable record store, while under-quorum, conflicting, and tampered records fail before replay can consume them.
- Claim boundary: durable tombstone-head checkpoint-admission history now exists, but tombstone-head pruning admission, tombstone-gated physical pruning APIs for the tombstone-head lanes, runtime/Axis adoption, cross-agent checkpoint-admission witnessing, Postgres pruning recovery, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head proof-preserving compaction

- Added `research/daily-arrowsmith-agent-state/v95-tombstone-head-proof-preserving-compaction-2026-06-26.md`, closing SQ42 with admitted tombstone-head replay compaction checkpoints and replacing it with SQ43.
- Added pruning tombstone-head witness replay compaction checkpoint types in `@pm/agent-state`.
- Added deterministic checkpoint and checkpoint-admission hashing for tombstone-head replay compaction.
- Added tombstone-head checkpoint admission certificates signed by replay-admitted tombstone-head witness principals under strict signature policy.
- Tombstone-head witness-ledger, authority/key-history, and quorum-certificate-record replay can now resume from admitted checkpoint frontiers plus retained hash-linked suffixes.
- Replay now rejects tombstone-head suffix-only histories, missing checkpoint admissions, and tampered checkpoints before they can seed operational state.
- Added focused tests proving admitted checkpoint suffix recovery, missing-admission failure, tampered-checkpoint rejection, authority key-state recovery, and latest QC-record recovery.
- Claim boundary: pure tombstone-head checkpoint/admission replay now exists, but durable tombstone-head checkpoint-admission stores, physical pruning admission, Postgres pruning recovery, runtime/Axis adoption, cross-agent monitoring, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head witness key status

- Added `research/daily-arrowsmith-agent-state/v94-tombstone-head-witness-key-status-2026-06-26.md`, closing SQ41 with replayed tombstone-head witness key status and replacing it with SQ42.
- Added `rotate_signature_key` and `revoke_signature_key` authority transitions for pruning tombstone-head witnesses in `@pm/agent-state`.
- Tombstone-head authority replay now validates key-status transitions against active admitted principals, requires rotations to provide a new key id and algorithm, and requires revocations to target the currently admitted key.
- Tombstone-head principal replay now projects active/revoked key status plus key-change authority metadata.
- Store-backed tombstone-head certification now fails closed when accepted witness observations were signed by a revoked or superseded key.
- Durable tombstone-head quorum-certificate record replay now rejects accepted witness evidence signed by revoked or superseded keys under strict tombstone-head authority policy.
- Added focused tests proving revoked and rotated tombstone-head keys obstruct certification and certificate-record replay.
- Claim boundary: tombstone-head key-status replay now exists, but tombstone-head proof-preserving compaction, runtime/Axis adoption, live Postgres pruning recovery, cross-agent monitoring, and production crypto adapters remain open.

## 2026-06-26 - Durable tombstone-head quorum-certificate record

- Added `research/daily-arrowsmith-agent-state/v93-durable-tombstone-head-quorum-certificate-record-2026-06-26.md`, closing SQ40 with durable tombstone-head quorum-certificate proof records and replacing it with SQ41.
- Added tombstone-head quorum-certificate witness-evidence, record, replay, issue, and store interfaces in `@pm/agent-state`.
- Added deterministic tombstone-head quorum-certificate record hashing and replay.
- Tombstone-head QC record replay now rejects provisional certificates, bad record chains, certificate hash mismatches, record hash mismatches, malformed witness evidence, unsigned evidence under strict policy, current-key mismatches, verifier failures, and authority seal mismatches.
- Added in-memory and Postgres-backed tombstone-head quorum-certificate record stores.
- Added migration `0038_agent_state_projection_replay_pruning_tombstone_head_witness_quorum_certificates.sql`.
- Added focused tests proving signed tombstone-head QC proof recovery plus bad witness evidence, bad seal binding, and unsigned-evidence rejection.
- Claim boundary: durable tombstone-head QC proof records now exist, but tombstone-head key-status rotation, QC-record compaction, runtime/Axis adoption, live Postgres pruning recovery, and production crypto adapters remain open.

## 2026-06-26 - Signature-bound tombstone-head witness identity

- Added `research/daily-arrowsmith-agent-state/v92-signature-bound-tombstone-head-witness-identity-2026-06-26.md`, closing SQ39 with strict tombstone-head witness identity and replacing it with SQ40.
- Added tombstone-head witness observation signature payload hashing and tombstone-head authority-transition signature payload hashing in `@pm/agent-state`.
- Tombstone-head witness records now preserve observer signatures through record building, in-memory ledgers, Postgres persistence, and row mapping.
- Tombstone-head witness authority transitions now carry signature key metadata and optional finalizer signatures.
- Strict tombstone-head witness replay now validates signer principal, payload hash, active replayed tombstone-head authority topology, admitted key id, admitted algorithm, and verifier acceptance.
- Tombstone-head authority epoch seal replay can now require finalizer signatures from admitted tombstone-head witness principals.
- Store-backed tombstone-head certification now fails closed when strict policy sees unsigned, unauthorized, wrong-key, wrong-payload, or verifier-rejected tombstone-head evidence.
- Added migration `0037_agent_state_projection_replay_pruning_tombstone_head_witness_signatures.sql`.
- Added focused tests proving signed tombstone-head quorum/seal success, unsigned witness replay failure, store-backed unsigned obstruction, and wrong-key seal rejection.
- Claim boundary: signature-bound tombstone-head identity now exists, but durable tombstone-head quorum-certificate records, key-status rotation, runtime adoption, Axis validation, and production crypto adapters remain open.

## 2026-06-26 - Tombstone-head authority epoch seal

- Added `research/daily-arrowsmith-agent-state/v91-tombstone-head-authority-epoch-seal-2026-06-26.md`, closing SQ38 with non-retroactive tombstone-head authority epochs and replacing it with SQ39.
- Added `seal_authority_epoch` support to pruning tombstone-head witness authority transitions in `@pm/agent-state`.
- Added sealed pruning tombstone sequence, sealed authority topology hash, and sealed quorum certificate hash fields to tombstone-head authority replay and Postgres persistence.
- Tombstone-head authority replay now projects `effectiveAuthorityHash` and `authorityEpochSeals`, validates seal bindings, and rejects tampered post-seal retroactive transitions.
- In-memory and Postgres tombstone-head authority stores now reject non-seal transitions that try to modify a sealed tombstone epoch.
- Store-backed tombstone-head certification now preserves the historical effective authority hash when future topology transitions are present.
- Added migration `0036_agent_state_projection_replay_pruning_tombstone_head_authority_epoch_seal.sql`.
- Added focused tests proving seal finality, allowed future-effective topology change, stable recertification, and tampered retroactive-history obstruction.
- Claim boundary: non-retroactive tombstone-head authority finality now exists, but signature-bound tombstone-head identity, durable tombstone-head quorum-certificate records, runtime adoption, and Axis validation remain open.

## 2026-06-26 - Durable tombstone-head witness authority store

- Added `research/daily-arrowsmith-agent-state/v90-durable-tombstone-head-witness-authority-store-2026-06-26.md`, closing SQ37 with durable tombstone-head witness authority-transition stores and replacing it with SQ38.
- Added pruning tombstone-head witness authority store contracts in `@pm/agent-state`.
- Added in-memory and Postgres-backed pruning tombstone-head witness authority-transition stores.
- Added `StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier`, which derives tombstone-head topology from stored authority transitions before evaluating witness records.
- Added migration `0035_agent_state_projection_replay_pruning_tombstone_head_witness_authority.sql`.
- Added focused tests proving stored transition sequence/hash chaining, store-backed certification, and incomplete-store non-certification even when the witness ledger contains two accepted observations.
- Claim boundary: durable tombstone-head topology storage now exists, but non-retroactive authority epoch seals, signature-bound tombstone-head witness identity, durable quorum-certificate records, runtime adoption, and Axis validation remain open.

## 2026-06-26 - Tombstone-head witness quorum topology

- Added `research/daily-arrowsmith-agent-state/v89-tombstone-head-witness-quorum-topology-2026-06-26.md`, closing SQ36 with tombstone-head witness authority topology and replacing it with SQ37.
- Added pruning tombstone-head witness authority transition, topology, principal, issue, policy, and quorum certificate types in `@pm/agent-state`.
- Added topology replay for pruning tombstone-head witness authority transitions, including sequence, previous-hash, transition-hash, quorum, and witness eligibility checks.
- Added tombstone-head witness quorum certificate evaluation over replayed tombstone-head witness records and replayed authority topology.
- Added focused tests proving two eligible observers can certify a pruning tombstone head, while a topology admitting only one observer leaves the same head witnessed but uncertified.
- Claim boundary: tombstone-head quorum topology now exists as pure substrate logic, but durable tombstone-head witness authority stores, store-backed quorum certification, signature-bound identity, quorum-certificate records, runtime adoption, and Axis validation remain open.

## 2026-06-26 - Durable pruning tombstone-head witness ledger

- Added `research/daily-arrowsmith-agent-state/v88-durable-tombstone-head-witness-ledger-2026-06-26.md`, closing SQ35 with durable tombstone-head witness ledgers and replacing it with SQ36.
- Added pruning tombstone-store head observation, decision, obstruction, record, replay, and ledger types in `@pm/agent-state`.
- Added tombstone-head consistency proof verification over replay-valid pruning tombstone records.
- Added in-memory and Postgres-backed pruning tombstone-head witness ledgers plus migration `0034_agent_state_projection_replay_pruning_tombstone_head_witness.sql`.
- Added a ledger-backed tombstone-head witness that replays prior observations before admitting a new observed head.
- Pruned-store continuity can now receive `requiredTombstoneStoreHead` from replayed witness history instead of memory or adapter input.
- Added focused tests proving replay-derived required-head continuity, unproved advance obstruction, same-sequence fork obstruction, and tampered witness-record rejection.
- Claim boundary: durable tombstone-head witness recovery now exists, but tombstone-head witness quorum topology, signature-bound identity, quorum-certificate records, compact consistency proofs, runtime adoption, and Axis validation remain open.

## 2026-06-26 - Pruning tombstone-head currentness

- Added `research/daily-arrowsmith-agent-state/v87-pruning-tombstone-head-currentness-2026-06-26.md`, closing SQ34 with tombstone-store head currentness and replacing it with SQ35.
- Added settlement-head replay compaction pruning tombstone-store head identity in `@pm/agent-state`.
- Added deterministic tombstone-store head hashing and head-from-record derivation.
- Pruned-store continuity verification can now require an exact `requiredTombstoneStoreHead`.
- Continuity now rejects stale local tombstone replay, same-sequence tombstone forks, unwitnessed local advances beyond the required head, and tampered required-head hashes.
- Added focused tests proving exact required-head acceptance plus stale, forked, and hash-invalid required-head obstruction.
- Claim boundary: tombstone-head currentness is now pure substrate logic, but durable tombstone-head witness ledgers, quorum topology, consistency-proof compression, Postgres pruning/head-currentness integration, and Axis adoption remain open.

## 2026-06-26 - Settlement-head pruning tombstone store API

- Added `research/daily-arrowsmith-agent-state/v86-pruning-tombstone-store-api-2026-06-26.md`, closing SQ33 with tombstone-backed physical pruning and replacing it with SQ34.
- Added settlement-head replay compaction pruning tombstone record, lane-frontier, issue, replay, and continuity types in `@pm/agent-state`.
- Added in-memory and Postgres pruning tombstone record stores plus migration `0033_agent_state_projection_replay_pruning_tombstones.sql`.
- Witness-ledger, authority-transition, and quorum-certificate-record stores now expose tombstone-gated prune APIs instead of raw sequence deletion.
- Pruned-store continuity verification now replays retained suffixes from the latest tombstone frontier and detects silent retained-suffix truncation.
- Added tests proving tombstone append/replay, tamper rejection, tombstone-gated physical pruning, recovery after pruning, and retained-suffix truncation detection.
- Claim boundary: physical pruning is now replayable through tombstone records, but tombstone-head witnessing, direct SQL-delete hardening, Postgres pruning integration tests, and Axis A/B/C pruned-store adoption remain open.

## 2026-06-26 - Settlement-head compaction pruning admission

- Added `research/daily-arrowsmith-agent-state/v85-compaction-pruning-admission-2026-06-26.md`, closing SQ32 with pruning admission and replacing it with SQ33.
- Added settlement-head replay compaction pruning lane, issue, admission, and hash types in `@pm/agent-state`.
- Pruning admission now requires the selected checkpoint-admission record to be present in replay-valid durable checkpoint-admission history.
- Pruning admission validates retained witness-ledger, authority-history, and quorum-certificate-record suffixes by replaying them from the admitted checkpoint frontier.
- Added tests proving pruning is admitted only with durable checkpoint-admission history plus valid suffix continuity, and is obstructed when the durable record is missing or the retained suffix starts at the wrong frontier.
- Claim boundary: pruning admission now exists as pure substrate logic, but tombstone-backed store pruning APIs, direct SQL-delete hardening, store-head witnessing after pruning, and Axis A/B/C pruned-store adoption remain open.

## 2026-06-26 - Durable settlement-head checkpoint-admission store

- Added `research/daily-arrowsmith-agent-state/v84-durable-checkpoint-admission-store-2026-06-26.md`, closing SQ31 with durable checkpoint-admission storage and replacing it with SQ32.
- Added settlement-head replay compaction checkpoint-admission record types, record hashing, replay issues, and replay result types in `@pm/agent-state`.
- Checkpoint-admission record replay now verifies sequence, previous-record hash, checkpoint body hash, admission certificate hash, strict admission re-evaluation, record hash, and conflicting checkpoint ids/frontiers.
- Added in-memory and Postgres checkpoint-admission record stores.
- Added migration `0032_agent_state_projection_replay_checkpoint_admissions.sql`.
- Extended compaction tests so recovered stored checkpoint-admission records seed replay, while under-quorum and tampered admission records fail before replay can consume them.
- Claim boundary: durable checkpoint-admission history now exists, but actual pruning APIs, suffix-continuity deletion gates, checkpoint-admission store witnessing, production crypto adapters, and Axis A/B/C pruned-store adoption remain open.

## 2026-06-26 - Settlement-head compaction checkpoint admission authority

- Added `research/daily-arrowsmith-agent-state/v83-compaction-checkpoint-admission-authority-2026-06-26.md`, closing SQ30 with checkpoint-admission authority and replacing it with SQ31.
- Added settlement-head witness replay compaction checkpoint admission certificate types in `@pm/agent-state`.
- Added checkpoint-admission witness evidence, issue codes, signature payload hashing, and certificate hashing.
- Checkpoint admission now replays authority topology, active witness eligibility, current key metadata, quorum thresholds, payload hashes, and verifier results.
- Settlement-head witness-ledger, authority/key-history, and quorum-certificate-record replay now require an admitted checkpoint certificate plus strict witness signature policy before a compaction checkpoint can seed replay.
- Added tests proving hash-valid checkpoints fail without admission, under-quorum admission fails, admitted checkpoint replay succeeds, and tampered checkpoint bodies fail even when accompanied by the original admission certificate.
- Claim boundary: checkpoint admission now exists as pure replay authority, but durable checkpoint-admission stores, consistency proofs, actual pruning, production crypto adapters, and Axis A/B/C pruned-store adoption remain open.

## 2026-06-26 - Proof-preserving settlement-head replay compaction

- Added `research/daily-arrowsmith-agent-state/v82-proof-preserving-replay-compaction-2026-06-26.md`, closing SQ29 with replay compaction checkpoints and replacing it with SQ30.
- Added settlement-head witness replay compaction checkpoint types in `@pm/agent-state`.
- Added checkpoint hashing and a builder that normalizes tenant and sorted projection fields.
- Settlement-head witness ledger replay can now resume from a hash-checked compacted witness sequence/observation-hash frontier.
- Settlement-head witness authority/key-history replay can now resume from checkpointed principal state, quorum settings, epoch seals, and authority sequence/hash frontier.
- Durable quorum-certificate record replay can now resume from checkpointed certificate-record sequence/hash frontier and latest certified record.
- Added tests proving pruned suffixes fail without checkpoints, checkpoint-plus-suffix replay succeeds, rotated key state survives authority compaction, latest certified record recovery survives certificate-record compaction, and tampered checkpoints invalidate replay.
- Claim boundary: pure replay compaction now exists, but checkpoint authority admission, durable checkpoint stores, actual pruning, checkpoint-chain consistency, and runner adoption remain open.

## 2026-06-26 - Settlement-head witness signature key status

- Added `research/daily-arrowsmith-agent-state/v81-settlement-head-witness-key-status-2026-06-26.md`, closing SQ28 with replayed key-status currentness and replacing it with SQ29.
- Added `rotate_signature_key` and `revoke_signature_key` settlement-head witness authority transitions in `@pm/agent-state`.
- Replayed settlement-head witness principal state now projects `signatureKeyStatus` and key-change metadata.
- Strict settlement-head witness observation replay now rejects signatures from revoked, missing, or rotated-away admitted keys.
- Strict authority-epoch seal replay now rejects finalizer signatures whose admitted key is no longer current.
- Durable quorum-certificate record replay now checks accepted witness evidence and seal signatures against replayed current key status.
- Quorum-certificate record stores can enforce strict signature policy during append, so stale signed evidence fails before persistence.
- Added tests proving revoked witness keys obstruct certification and invalidate certificate-record replay under the current topology.
- Claim boundary: current-key replay now exists for settlement-head witnesses, but production crypto adapters, multi-authority rotation, concurrent append isolation, monitor coverage, and proof-preserving compaction remain open.

## 2026-06-26 - Durable settlement-head quorum-certificate records

- Added `research/daily-arrowsmith-agent-state/v80-durable-head-quorum-certificate-record-2026-06-26.md`, closing SQ27 with durable quorum-certificate proof records and replacing it with SQ28.
- Added settlement-head quorum-certificate witness evidence, record types, record hashing, and record-chain replay in `@pm/agent-state`.
- Added in-memory and Postgres-backed settlement-head quorum-certificate record stores.
- Added migration `0031_agent_state_projection_replay_head_witness_quorum_certificates.sql`.
- Durable certificate records now bind accepted witness ids to witness ledger sequence, observation hash, and signature evidence.
- Durable certificate records can bind an optional `seal_authority_epoch` transition and reject mismatched certificate hash, topology hash, settlement sequence, or seal transition hash.
- Fixed Postgres settlement-head witness row mapping so persisted observation signatures are restored into witness records.
- Added tests proving signed proof-record replay and tampered witness-evidence/seal obstruction.
- Claim boundary: durable quorum-certificate records now exist, but key-status/rotation currentness, production crypto adapters, concurrent append isolation, monitor coverage, and runner adoption remain open.

## 2026-06-26 - Signature-bound settlement-head witness identity

- Added `research/daily-arrowsmith-agent-state/v79-signature-bound-head-witness-identity-2026-06-26.md`, closing SQ26 with strict principal signatures and replacing it with SQ27.
- Added settlement-head witness principal signatures, signature payload hash helpers, and strict signature-policy replay in `@pm/agent-state`.
- Settlement-head observation replay can now require observer signatures bound to admitted active principals, payload hashes, admitted key ids, and verifier acceptance.
- Authority-epoch seals can now require finalizer signatures from admitted active principals.
- Added admitted key metadata to settlement-head witness authority transitions and replayed principal state.
- Added migration `0030_agent_state_projection_replay_head_witness_signatures.sql` for durable observation signatures and authority-transition signature fields.
- Store-backed settlement-head quorum certification can now fail closed when strict identity policy sees unsigned, wrong-principal, wrong-payload, unauthorized, wrong-key, or verifier-rejected rows.
- Added tests proving signed quorum/seal acceptance and unsigned/wrong-key obstruction.
- Claim boundary: signature-bound witness identity now exists under strict policy, but durable quorum-certificate records, production crypto/key-status adapters, concurrent append isolation, monitor coverage, and runner adoption remain open.

## 2026-06-26 - Projection replay settlement-head authority epoch seal

- Added `research/daily-arrowsmith-agent-state/v78-settlement-head-authority-epoch-seal-2026-06-26.md`, closing SQ25 with a non-retroactive settlement-head authority epoch seal and replacing it with SQ26.
- Added `seal_authority_epoch` as a settlement-head witness authority transition in `@pm/agent-state`.
- Added seal fields to settlement-head witness authority transitions and migration `0029_agent_state_projection_replay_settlement_head_witness_authority.sql`.
- Added replayed `effectiveAuthorityHash`, `sealedThroughSettlementSequence`, and `authorityEpochSeals` to settlement-head witness authority topology.
- Store-backed head-quorum certificates now bind to the effective authority topology hash for the target head rather than a later chain tip.
- In-memory and Postgres authority-transition stores now reject post-seal retroactive topology transitions under normal append admission.
- Added tests proving a sealed head remains stable after future-effective topology changes and that tampered post-seal retroactive history obstructs certification.
- Claim boundary: non-retroactive authority epochs now exist, but signature-bearing witness/finalizer identity, durable quorum-certificate records, concurrent append isolation, monitor coverage, and runner adoption remain open.

## 2026-06-26 - Durable projection replay settlement-head witness authority store

- Added `research/daily-arrowsmith-agent-state/v77-durable-settlement-head-witness-authority-store-2026-06-26.md`, closing SQ24 with durable head-witness authority-transition storage and replacing it with SQ25.
- Added settlement-head witness authority transition store contracts to `@pm/agent-state`.
- Added in-memory and Postgres-backed settlement-head witness authority transition stores plus migration `0029_agent_state_projection_replay_settlement_head_witness_authority.sql`.
- Added `StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier`, which derives topology from stored authority transitions and replayed head-witness records rather than resolver-supplied topology.
- Added a first-class `certified` boolean on settlement-head witness quorum certificates so strict capability hooks can consume the pure certificate directly.
- Added restart and tampered-topology tests for store-backed head-quorum certification.
- Claim boundary: durable topology storage and store-backed certification now exist, but non-retroactive authority epochs, durable quorum-certificate finality, signed witness identity, monitor coverage, and runner adoption remain open.

## 2026-06-26 - Projection replay settlement-head witness quorum topology

- Added `research/daily-arrowsmith-agent-state/v76-settlement-head-witness-quorum-topology-2026-06-26.md`, closing SQ23 with settlement-head witness quorum topology and replacing it with SQ24.
- Added settlement-sequence-scoped head-witness authority transitions and topology replay to `@pm/agent-state`.
- Added settlement-head witness quorum certificate evaluation over replayed head-witness records.
- Capability-kit workflow authority resolution can now require a certified settlement-head witness quorum before settled-root verification.
- Added falsification tests for certified quorum, non-member exclusion, equivocated witness exclusion, invalid topology obstruction, and capability-kit quorum rejection.
- Claim boundary: quorum topology exists as replayable substrate logic, but durable topology/quorum-certificate storage, cryptographic witness identities, and runner adoption remain open.

## 2026-06-26 - Durable projection replay settlement-head witness store

- Added `research/daily-arrowsmith-agent-state/v75-durable-settlement-head-witness-store-2026-06-26.md`, closing SQ22 with durable settlement-head witness storage and replacing it with SQ23.
- Added `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger` to `@pm/agent-state`.
- Added migration `0028_agent_state_projection_replay_settlement_head_witness.sql` for durable, hash-linked settlement-head witness observations.
- Added a cross-agent shared-ledger test proving a fresh agent rejects an old settlement head after another agent has witnessed a newer head.
- Claim boundary: durable shared head-witness storage exists, but decentralized gossip, head-witness quorum/topology, cryptographic signatures, and runner adoption remain open.

## 2026-06-26 - Projection replay settlement-store head witness

- Added `research/daily-arrowsmith-agent-state/v74-settlement-store-head-witness-2026-06-26.md`, closing SQ21 with settlement-store head witnessing and replacing it with SQ22.
- Added settlement-store head hashing and replay-derived heads to `@pm/agent-state`.
- Settlement currentness can now require a witnessed settlement-store head, preventing a truncated valid prefix from satisfying currentness policy.
- Added settlement-head consistency proofs, replayable head-witness records, in-memory and ledger-backed head witnesses, and tamper-replay tests.
- Capability-kit workflow authority resolution can now witness settlement-store heads and bind the accepted head into settled-root verification before returning graph authority.
- Claim boundary: settlement-head witnessing exists, but durable cross-agent head witness storage/gossip remains open.

## 2026-06-26 - Projection replay settlement currentness

- Added `research/daily-arrowsmith-agent-state/v73-settlement-currentness-2026-06-26.md`, closing SQ20 with settlement-currentness policy and replacing it with SQ21.
- Added `ProjectionReplayCertificateStoreRootWitnessSettlementCurrentnessPolicy` to `@pm/agent-state`.
- Settlement ref verification can now reject historically valid refs as stale, conflicted, below a caller-known frontier, or admitted under the wrong authority topology.
- In-memory and Postgres settlement stores accept currentness policy during ref verification.
- Capability-kit workflow authority resolution can now pass settled-root currentness policy to the settlement store before returning graph write authority.
- Claim boundary: visible settlement-history currentness is enforced, but hidden settlement-store truncation/fork detection still needs store-head transparency or witnessing.

## 2026-06-26 - Projection replay settled-root write gate

- Added `research/daily-arrowsmith-agent-state/v72-settled-root-write-gate-2026-06-26.md`, closing SQ19 with strict settled-root write admission and replacing it with SQ20.
- Added `GraphWriteProjectionReplayRootSettlementRef` and `requireProjectionReplayRootSettlementRef` to graph write-authority policy.
- Graph writes can now reject missing, malformed, non-settled, root-mismatched, or substrate-record-mismatched settled-root refs before SQL.
- Added settlement-ref creation and durable settlement-store verification helpers to `@pm/agent-state`.
- Capability-kit workflow authority resolution can now verify settled-root refs against a settlement store before returning graph write authority.
- Canonical action outcome envelopes and eval packet recovery now preserve `projectionReplayRootSettlementRef`.
- Claim boundary: strict settled-root gating now exists, but settlement-currentness/status and end-to-end Axis A/C runner adoption remain open.

## 2026-06-26 - Durable projection replay witness authority and settlement stores

- Added `research/daily-arrowsmith-agent-state/v71-durable-witness-authority-settlement-store-2026-06-26.md`, closing SQ18 with durable authority-transition and settlement-certificate stores and replacing it with SQ19.
- Added in-memory and Postgres witness-authority transition stores to `@pm/agent-state`, with store-assigned authority sequence and previous-hash chaining.
- Added settlement record hashing, settlement-record replay, and in-memory/Postgres settlement stores so settled roots can be recovered after restart and tampered settlement records cannot replay as settled.
- Added migration `0027_agent_state_projection_replay_witness_authority_settlement.sql` for durable authority transitions and settlement records.
- Added focused tests for durable topology/settlement replay after restart, tampered authority-transition rejection, and tampered settlement-record rejection.
- Claim boundary: durable stores now exist, but strict graph/capability write gates still need to require durable settled-root certificates before mutation.

## 2026-06-26 - Projection replay witness-authority topology

- Added `research/daily-arrowsmith-agent-state/v70-witness-authority-topology-2026-06-26.md`, closing SQ17 with replayed witness-principal authority topology and replacing it with SQ18.
- Added hash-linked witness-authority transitions to `@pm/agent-state` for quorum, witness admission, suspension, revocation, and equivocation.
- Added `replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions()` to derive active settlement-eligible witness principals for a certificate-store root sequence.
- Extended root-witness settlement to count only topology-eligible witness ledgers when an authority topology is supplied.
- Added tests proving topology-bound settlement, non-member refusal, equivocated-principal refusal, and invalid-topology obstruction.
- Claim boundary: topology replay is pure substrate logic; durable authority-transition storage, durable settlement certificates, cryptographic principals, and strict write-gate adoption remain open.

## 2026-06-26 - Projection replay root-witness settlement

- Added `research/daily-arrowsmith-agent-state/v69-root-witness-settlement-2026-06-26.md`, closing SQ16 with replayed root-witness settlement and replacing it with SQ17.
- Added `ProjectionReplayCertificateStoreRootWitnessSettlement` policy/result/issue types to `@pm/agent-state`.
- Added `evaluateProjectionReplayCertificateStoreRootWitnessSettlement()` to classify replay roots as `provisional`, `witnessed`, `settled`, or `obstructed` from replayed witness ledgers.
- Settlement now refuses tampered witness ledgers, duplicate witness ids, and valid same-sequence conflicting roots as quorum evidence.
- Added tests for one-witness quorum shortfall, two-witness settlement, conflicting-ledger obstruction, and invalid-ledger non-counting.
- Claim boundary: settlement now exists as a pure substrate primitive; witness-principal authority topology, durable settlement storage, and strict write-gate adoption remain open.

## 2026-06-26 - Projection replay root-witness ledger

- Added `research/daily-arrowsmith-agent-state/v68-root-witness-ledger-2026-06-26.md`, closing SQ15 with a replayable witness ledger and replacing it with SQ16.
- Added hash-linked projection replay root-witness observation records, deterministic record hashing, and ledger replay with decision recomputation to `@pm/agent-state`.
- Added `LedgerBackedProjectionReplayCertificateStoreRootWitness`, `InMemoryProjectionReplayCertificateStoreRootWitnessLedger`, and `PostgresProjectionReplayCertificateStoreRootWitnessLedger`.
- Added migration `0026_agent_state_projection_replay_root_witness.sql` for durable witness observations.
- Added tests proving a restarted witness recovers roots from the ledger, obstructs unproved advances after restart, accepts valid proof advances, and rejects tampered witness records.
- Claim boundary: witness state is replayable, but witness quorum/finality and real runtime adoption remain open.

## 2026-06-26 - Projection replay certificate-store root witness

- Added `research/daily-arrowsmith-agent-state/v67-certificate-store-root-witness-2026-06-26.md`, closing SQ14 with a root witness primitive and replacing it with SQ15.
- Added `ProjectionReplayCertificateStoreRootWitness`, pure root observation evaluation, in-memory witnessing, and replayable root obstruction artifacts to `@pm/agent-state`.
- Root advances now require a consistency proof from the latest witnessed root; same-sequence divergent roots, tenant mismatches, regressions, missing proofs, and invalid proofs obstruct.
- Added workflow authority envelope support for root consistency proofs and a capability-kit root witness gate before returning workflow-derived graph write authority.
- Claim boundary: root witnessing now blocks forked replay roots when configured; durable witness persistence/quorum and automatic cross-agent gossip remain open.

## 2026-06-26 - Projection replay certificate-store root

- Added `research/daily-arrowsmith-agent-state/v66-certificate-store-root-2026-06-26.md`, closing SQ13 with append-only replay-certificate store roots and replacing it with SQ14.
- Added `ProjectionReplayCertificateStoreEntry`, `ProjectionReplayCertificateStoreRoot`, and hash-chain consistency proof verification to `@pm/agent-state`.
- Extended replay refs with optional certificate-store sequence, entry hash, and root hash; strict store verification can now require those commitments.
- Added migration `0025_agent_state_projection_replay_certificate_store_root.sql` for append-only certificate-store entries.
- Added `requireProjectionReplayStoreCommitment` to capability-kit workflow authority resolution, and preserved store-root fields in graph replay refs.
- Claim boundary: store roots make forks detectable through root comparison/proofs; witness/root-gossip protocol remains open.

## 2026-06-26 - Projection replay certificate store

- Added `research/daily-arrowsmith-agent-state/v65-projection-replay-certificate-store-2026-06-26.md`, closing SQ12 with a durable replay-certificate store and replacing it with SQ13.
- Added `ProjectionReplayCertificateRef`, durable certificate records, `InMemoryProjectionReplayCertificateStore`, and `PostgresProjectionReplayCertificateStore` to `@pm/agent-state`.
- Added migration `0024_agent_state_projection_replay_certificates.sql` for `agent_state.projection_replay_certificates`.
- Preserved `projectionReplayRef` through `ActionOutcomeEnvelope`, workflow promotion, role projections, and eval packet recovery.
- Added certificate-store verification to capability-kit workflow authority resolution, blocking before capability `apply()` when a replay ref lacks a matching durable certificate.
- Claim boundary: replay refs now resolve to full stored certificates before write authority is returned; tamper-evident store roots and non-equivocation proofs remain open.

## 2026-06-26 - Projection replay write gate

- Added `research/daily-arrowsmith-agent-state/v64-projection-replay-write-gate-2026-06-26.md`, closing SQ11 with a replay-proof write gate and replacing it with SQ12.
- Added `GraphWriteProjectionReplayRef` and `GraphWriteAuthorityPolicy.requireProjectionReplayRef` to `@pm/graph`, with obstruction codes for missing, invalid, mismatched, stale, or substrate-record-divergent replay proof.
- Propagated `projectionReplayRef` through capability-kit workflow authority envelopes and substrate records.
- Proved strict capability-kit graph writes reject before `apply()` and before graph SQL when replay proof is absent or stale.
- Claim boundary: structural replay refs are now gated at graph/capability mutation boundaries; full `ProjectionReplayCertificate` persistence and durable certificate-hash verification remain open.

## 2026-06-26 - Projection replay frontier

- Added `research/daily-arrowsmith-agent-state/v63-projection-replay-frontier-2026-06-26.md`, closing SQ01 with a sequence-backed durable projection frontier and replacing it with SQ11.
- Added `ProjectionReplayFrontier`, `ProjectionReplayFrontierEvent`, and `ProjectionRunner.getReplayFrontier()` to `@pm/projections`.
- Changed `PostgresProjectionRunner.catchUp()` to advance by `events.events.seq` and added migration `0023_projection_replay_frontier.sql` for `projections.cursors.last_event_seq`.
- Added `buildProjectionReplayCertificateFromFrontier()` to `@pm/agent-state`, so replay certificates can be minted from projection-owned durable event refs while rejecting tenant/projection-version mismatch.
- Claim boundary: DB-backed projection tests are present but skip without `PM_DATABASE_URL`; no real write-capable runtime path requires replay-frontier certificates yet.

## 2026-06-26 - State identity kernel

- Added `research/daily-arrowsmith-agent-state/v62-state-identity-kernel-2026-06-26.md`, closing the first discovery-lane question with existing/missing substrate maps, an exact 10-question backlog, primitive proposal ledger, falsification criteria, implementation frontier, and proof status.
- Added `ProjectionReplayCertificate` to `@pm/agent-state` as a pure state identity kernel binding a `CurrentStateView` to authority scope, ordered admitted transition refs, transition-history hash, projection hash, source refs, and replay frontier.
- Added opt-in `requireReplayCertificate` action-review enforcement, `projection_replay` warning/invariant classification, certificate hashing, verification, and replay evaluation helpers.
- Added focused tests proving missing replay proof blocks, valid event-backed proof passes, tampered views fail, hash-valid projection-version omissions fail, private summary refs cannot count as transitions, and stale replay frontiers fail.
- Claim boundary: this is a substrate primitive and blocking review gate; durable event/projection-store certificate generation and runtime enforcement at real write-capable boundaries remain open.

## 2026-06-26 - Representation-loss packet gate research

- Added `research/daily-arrowsmith-agent-state/v61-representation-loss-packet-gate-2026-06-26.md`, answering RQ71 as an implementation sequence rather than another proof-harness change.
- Corrected the automation prompt's stale implementation frontier: executable observation reports, typed proposal reviews, replayable JSON/JSONL artifacts, fixture coverage, assertion metrics, and DB/fixture equivalence are already present on the current branch.
- Selected `representation_loss` as the next Axis A packet-backed family, using projection-fidelity and invariant-field preservation before continuing to `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict`.
- Updated the daily Arrowsmith index and top-level research ledger with new sources, corrected claims, downgraded summary/shared-context claims, C109, and L071.
- Claim boundary: research-only update; no code changed and Axis A remains packet-backed for six families until the representation-loss fixture/scenario pair is implemented.

## 2026-06-26 - Axis A source-authority packet family

- Added `research/daily-arrowsmith-agent-state/v60-axis-a-source-authority-packet-family-2026-06-26.md`, answering RQ61 and replacing it with RQ71.
- Changed ArrowHedge risk/signal snapshot mismatch conflicts from generic `state_disagreement` to `source_authority_conflict`.
- Added `buildArrowHedgeSourceAuthorityConflictFixtureCases()` to the finance adapter.
- Added `ARROWHEDGE_CANONICAL_AUTHORITY_PACKET_SCENARIOS` and included it in `ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS`.
- Expanded paired Axis A packet recovery from five to six source-recovered substrate refusals.
- Claim boundary: Axis A improves, but `representation_loss`, `workflow_invalidation`, `capability_contract_violation`, `parallel_write_conflict`, and Axis B remain open.

## 2026-06-26 - Axis A continuity packet families

- Added `research/daily-arrowsmith-agent-state/v59-axis-a-continuity-packet-families-2026-06-26.md`, answering RQ60 and replacing it with RQ61-RQ70.
- Added `verifyContinuityCheckpointChain()` to `@pm/continuity` and wired `PostgresContinuityLedger.verify()` through it.
- Added ArrowHedge `continuityCheck` inputs that turn conflicting continuity checkpoints, broken checkpoint chains, missing terminal history, or missing evidence history into `ActionOutcomeEnvelope` blocking causes.
- Added paired baseline/substrate Axis A packet families for `memory_drift` and `continuity_break`.
- Exported `ARROWHEDGE_CANONICAL_CONTINUITY_PACKET_SCENARIOS` and `ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS` from `@pm/evals`.
- Claim boundary: Axis A now has store-backed paired packet proof for five failure families, but the finance axis is still incomplete and Axis B remains blocked.

## 2026-06-25 - ArrowHedge packet-store source bundle

- Added `research/daily-arrowsmith-agent-state/v58-arrowhedge-packet-store-source-bundle-2026-06-25.md`, answering RQ59 and replacing it with RQ60: packet-backed Axis A scenario families for `memory_drift`, `continuity_break`, and the remaining finance gaps.
- Added `buildArrowHedgeTerminalPacketProofSourceBundle()` and `ArrowHedgeTerminalPacketProofSourceBundleInput` to `@pm/evals`.
- Updated the ArrowHedge paired temporal packet proof to persist packets through `PostgresEvalEventStore.recordActionOutcomeEnvelopes()` before strict authority recovery.
- Replaced hand-built packet lookup in the paired temporal test with the shared eval packet-store path.
- Claim boundary: Axis A now has a reusable store-backed proof path for the canonical temporal packet families, but the finance axis still lacks packet-backed coverage for all ten failure classes and Axis B remains blocked.

## 2026-06-25 - ArrowHedge paired temporal packet corpus

- Added `research/daily-arrowsmith-agent-state/v57-arrowhedge-paired-temporal-packet-corpus-2026-06-25.md`, answering RQ58 for canonical paired packet generation and replacing it with RQ59: durable packet-store persistence plus a reusable strict Axis A source bundle.
- Added `buildArrowHedgeCanonicalPairedActionOutcomeEnvelopeCorpus()` to `@pm/capability-finance-research-ingest`.
- Added packet-level `runArm` and `authorityRole` metadata so ArrowHedge terminal packets can distinguish baseline comparator observations from substrate authority packets.
- Added `providerAuthority: null` support for ArrowHedge baseline comparator packets, preventing accepted baseline observations from carrying provider certificate authority.
- Added a finance test that maps paired temporal packets into Axis A, verifies the three temporal cells, generates a substrate-only recovery suite, and assembles a strict proof packet while keeping finance incomplete for missing classes.
- Claim boundary: Axis A temporal packet coverage improved, but durable packet-store persistence, a reusable strict source bundle, remaining finance failure classes, and Axis B remain open.

## 2026-06-25 - Axis A baseline recovery obligations

- Added `research/daily-arrowsmith-agent-state/v56-axis-a-baseline-recovery-obligations-2026-06-25.md`, answering RQ57 for strict proof semantics and replacing it with RQ58: persisted baseline terminal observation packets plus substrate recovery suites for mapped finance families.
- Updated strict proof-packet authority obligations so failed baseline terminal observations do not require `accepted_authority_recovered`.
- Added a finance regression test proving a baseline failed terminal observation can remain comparator evidence while the substrate arm supplies the required recovery.
- Updated proof-packet/source-recovery expectations so paired recovery suites may audit extra baseline observations without inflating strict authority obligations.
- Claim boundary: Axis A proof semantics improved, but finance still lacks persisted baseline-side terminal observation packets, store-derived recovery suites for mapped families, and real `memory_drift` / `continuity_break` packet-backed scenarios; Axis B remains blocked.

## 2026-06-25 - ArrowHedge packet eval mapping

- Added `research/daily-arrowsmith-agent-state/v55-arrowhedge-packet-eval-mapping-2026-06-25.md`, answering RQ56 and replacing it with RQ57: baseline-side terminal failure packets and store-derived recoveries for mapped finance scenario families.
- Added opt-in `scenarioSpecs` to `buildArrowHedgeStateEvalSuite()`.
- Exported `ArrowHedgeScenarioSpec` and `ARROWHEDGE_CANONICAL_TERMINAL_PACKET_SCENARIOS` from `@pm/evals`.
- Added a finance-domain test that builds the real canonical ArrowHedge terminal packet corpus, maps the blocked temporal packets into Axis A EvalEvents, and proves mapped cells are covered but not verified without baseline terminal proof.
- Claim boundary: Axis A packet mapping improved, but finance still lacks baseline terminal packets, strict recovery suites for these mapped families, `memory_drift` / `continuity_break` packet families, and Axis B remains blocked.

## 2026-06-25 - ArrowHedge terminal packet corpus

- Added `research/daily-arrowsmith-agent-state/v54-arrowhedge-terminal-packet-corpus-2026-06-25.md`, answering RQ55 and replacing it with RQ56: mapping domain-owned ArrowHedge terminal packets into Axis A source bundles with store-derived recovery.
- Added `buildArrowHedgeActionOutcomeEnvelopeCorpus()` and `buildArrowHedgeCanonicalActionOutcomeEnvelopeCorpus()` to `@pm/capability-finance-research-ingest`.
- Added provider-status authority metadata to accepted canonical ArrowHedge terminal packets while leaving blocked packets without accepted write authority.
- Fixed default ArrowHedge action-id derivation so distinct `risk.refresh` operations with `refreshId`, `feedbackId`, or missing-observation semantics do not collapse into one terminal action id.
- Exported the manifest-advertised `buildArrowHedgeActionOutcomeEnvelope()` provider from the package index and aligned the finance provider evidence refs with `state_review_artifact`.
- Claim boundary: Axis A now has domain-owned terminal packets from canonical state-review inputs, but those packets still need EvalEvent/source-bundle mapping and store-derived recoveries; Axis B remains blocked.

## 2026-06-25 - ArrowHedge finance source bundle

- Added `research/daily-arrowsmith-agent-state/v53-arrowhedge-finance-source-bundle-2026-06-25.md`, answering RQ54 and replacing it with RQ55: terminal packets for remaining ArrowHedge finance failure classes.
- Added `buildArrowHedgeWriteBindingProofSourceBundle()` to `@pm/evals`.
- Exported the finance proof source bundle input type.
- Added a strict recovery test over the committed ArrowHedge write-binding replay packets, then fed the recovery suite into the all-axis assembler.
- Verified the packet-backed finance terminal-outcome partition cell becomes verified while the finance axis remains incomplete for missing packet-backed failure classes.
- Claim boundary: Axis A now has a real partial source bundle, but finance still needs terminal packets for the remaining failure classes and Axis B remains blocked.

## 2026-06-25 - All-axis proof-packet assembler

- Added `research/daily-arrowsmith-agent-state/v52-all-axis-proof-packet-assembler-2026-06-25.md`, answering RQ53 and replacing it with RQ54: real ArrowHedge finance source bundles with persisted packets and recoveries.
- Added `buildStrictThreeAxisProofPacketAssembly()` to `@pm/evals`.
- Added source-bundle and source-recovery provenance types so strict proof packets preserve whether each source provided recovery, missed required recovery, or required no recovery.
- Added tests for all-axis verified assembly, missing required source recovery, and Axis B blocker sources that remain blocked without synthetic recovery obligations.
- Claim boundary: all-axis assembly exists as a primitive, but Axis A still needs real persisted/recovered finance source bundles and Axis B remains blocked.

## 2026-06-25 - Strict runner proof-packet consumption

- Added `research/daily-arrowsmith-agent-state/v51-strict-runner-proof-packet-consumption-2026-06-25.md`, answering RQ52 and replacing it with RQ53: all-axis proof-packet assembly with per-source recovery provenance.
- Added `buildStrictThreeAxisProofPacket()` to `@pm/evals`.
- Added runner helpers to build and summarize strict proof packets from authority recovery suites.
- Updated deterministic and live local-lab runners to print strict proof summaries before persistence and after store-derived authority recovery.
- Verified the no-DB deterministic runner stays explicitly `unverified` with missing authority-recovery obligations instead of claiming strict proof.
- Claim boundary: strict proof-packet consumption exists for runner recovery suites, but all-axis assembly and Axis B unblock remain open.

## 2026-06-25 - Local-lab provider authority metadata

- Added `research/daily-arrowsmith-agent-state/v50-local-lab-provider-authority-metadata-2026-06-25.md`, answering RQ51 and replacing it with RQ52: feeding runner-generated authority recoveries into strict proof packets.
- Added `buildActionOutcomeProviderAuthority()` to `@pm/agent-state`.
- Added a default local-agent-lab authority provider and optional engine override so accepted dynamic Axis C packets carry provider certificate/status metadata while blocked packets expose no write authority.
- Added provider-status metadata to deterministic local-lab accepted packets.
- Added tests proving accepted local-lab packets carry status refs, blocked packets do not, and deterministic strict recovery passes with one accepted recovery plus blocked terminal refusals.
- Claim boundary: Axis C accepted packets now support strict recovery, but strict three-axis proof packets still need runner-generated recoveries as inputs; Axis B remains blocked.

## 2026-06-25 - Runner authority recovery generation

- Added `research/daily-arrowsmith-agent-state/v49-runner-authority-recovery-generation-2026-06-25.md`, answering RQ50 and replacing it with RQ51: adding provider-status-bearing authority metadata to accepted Axis A/C runner-produced packets.
- Added `auditEvalEventsGraphWriteAuthority()` and recovery summaries to `@pm/evals`.
- Added `scripts/authority-recovery.ts` to compose `PostgresEvalEventStore` with `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` under strict graph authority policy.
- Updated deterministic and live local-lab runner scripts to persist packets, generate store-derived strict authority recovery summaries, then persist EvalEvents.
- Added tests for batch recovery summaries and verified the deterministic local-lab runner still executes without `PM_DATABASE_URL`.
- Claim boundary: runner recovery generation now exists, but accepted Axis A/C runner-produced packets still need provider-status-bearing metadata before strict recoveries can pass; Axis B remains blocked.

## 2026-06-25 - Proof packet authority gate

- Added `research/daily-arrowsmith-agent-state/v48-proof-packet-authority-gate-2026-06-25.md`, answering RQ49 and replacing it with RQ50: generating authority recoveries from real Axis A/C runner store/resolver calls.
- Added `authorityRecoveries` and `requireAuthorityRecovery` to `buildThreeAxisProofPacket()`.
- Added `ThreeAxisAuthorityRecoveryGate` and recovery obligations so strict proof packets cannot remain `verified` when terminal-proof-backed events lack valid expected-status authority recoveries.
- Added tests proving missing recoveries downgrade an otherwise verified packet, valid recoveries restore verified status, and blocked terminal outcomes cannot masquerade as accepted authority.
- Claim boundary: proof packets can now require strict authority recovery inputs, but Axis A/C runner scripts still need to generate those recoveries from real packet stores and store-backed resolvers; Axis B remains blocked.

## 2026-06-25 - Strict authority recovery audit

- Added `research/daily-arrowsmith-agent-state/v47-strict-authority-recovery-audit-2026-06-25.md`, answering RQ48 and replacing it with RQ49: how strict authority recovery becomes a required Axis A/C runner/proof-packet gate.
- Added `auditEvalEventGraphWriteAuthority()` in `@pm/evals` to recover an EvalEvent's outcome packet, compose with a store-backed authority resolver, and validate strict graph authority policy.
- Added provider certificate status metadata to the accepted ArrowHedge write-binding replay packet and regenerated the golden replay JSONL.
- Exported `InvocationActionOutcomeProviderCertificateStatusRef` from `@pm/workflow` for public replay/runner use.
- Added tests proving accepted provider-status-backed recovery passes, blocked Axis C packets refuse write authority, and accepted packets missing provider status fail strict policy.
- Claim boundary: strict authority recovery is now executable as a codebase primitive, but Axis A/C runners still need to require it as a gate and Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

## 2026-06-25 - Authority metadata packet recovery

- Added `research/daily-arrowsmith-agent-state/v46-authority-metadata-packet-recovery-2026-06-25.md`, answering RQ47 and replacing it with RQ48: how Axis A/C runners should compose packet recovery with strict authority policy.
- Added optional provider certificate id, digest, and status-ref fields to canonical `ActionOutcomeEnvelope` packets and their hash payloads.
- Updated workflow outcome promotion so provider certificate status refs survive into canonical packets.
- Added provider authority metadata to action-outcome role projection invariant cores and validation.
- Added `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` plus structural recovery types so eval packet stores can recover the workflow-authority envelope shape without importing capability-kit.
- Added tests for provider-status preservation through promotion, projection tamper detection, and eval-store recovery.
- Claim boundary: packet recovery now preserves strict authority metadata, but Axis A/C runners still need to compose it with strict graph/capability policy; Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

## 2026-06-25 - Store-backed authority resolver

- Added `research/daily-arrowsmith-agent-state/v45-store-backed-authority-resolver-2026-06-25.md`, answering RQ46 and replacing it with RQ47: how canonical packet stores should preserve/recover provider-status authority metadata.
- Added `WorkflowGraphWriteAuthorityEnvelopeLookup`, `WorkflowGraphWriteAuthorityEnvelopeStore`, and `StoredWorkflowGraphWriteAuthorityResolverOptions` to `@pm/capability-kit`.
- Added `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` so capability/runtime adapters can load workflow envelopes by tenant/envelope id, verify expected action ids, and reject missing, blocked, mismatched, or wrong-action envelopes before graph mutation.
- Updated the lead-scoring strict graph-authority test to use the store-backed resolver instead of returning hand-built authority refs.
- Claim boundary: the resolver makes runner wiring possible, but strict amnesiac recovery still needs canonical packet stores to preserve or recover provider-certificate status refs; Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

## 2026-06-25 - Workflow authority injection

- Added `research/daily-arrowsmith-agent-state/v44-workflow-authority-injection-2026-06-25.md`, answering RQ45 and replacing it with RQ46: how Axis A/B/C runners should enable strict authority policies with store-sourced resolutions.
- Exported `GraphWriteAuthorityResolver` from `@pm/capability-kit`.
- Added `graphWriteAuthorityResolutionFromWorkflowEnvelope()` to convert an accepted workflow envelope into matched graph authority and substrate-record refs without adding a workflow dependency.
- Added `LeadScoringRuntimeDeps.graphWriteAuthority` and passed it into the lead-scoring capability spec.
- Added tests proving blocked/missing workflow envelopes do not become write authority, accepted envelopes build matched authority records, and lead scoring can run under strict store-backed graph authority policy when the runtime injects a resolution.
- Claim boundary: this wires a real capability adapter hook, but end-to-end three-axis verification still requires scenario runners to source authority from packet/status stores; Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

## 2026-06-25 - Store-backed write authority

- Added `research/daily-arrowsmith-agent-state/v43-store-backed-write-authority-2026-06-25.md`, answering RQ44 and replacing it with RQ45: how real workflow/runtime adapters should inject store-backed graph write-authority resolutions.
- Added `GraphWriteAuthoritySubstrateRecord` and `GraphWriteAuthorityPolicy.requireSubstrateRecord` to `@pm/graph`.
- Extended graph mutation inputs and `PostgresGraph` guards so strict policies can validate a matched substrate record before graph SQL.
- Added `GraphWriteAuthorityResolution` to `@pm/capability-kit`, allowing graph authority resolvers to return `{ authorityRef, substrateRecord }`.
- Passed `writeAuthoritySubstrateRecord` through capability apply/emit contexts.
- Added graph and capability-kit tests proving missing/mismatched substrate records are rejected before SQL/apply, while matched records pass.
- Claim boundary: strict policies can now reject forged valid-looking authority refs by requiring substrate-record matches, but real workflow/runtime adapters still need to source those records from stores.

## 2026-06-25 - Capability kit write authority

- Added `research/daily-arrowsmith-agent-state/v42-capability-kit-write-authority-2026-06-25.md`, answering RQ43 and replacing it with RQ44: how graph write-authority refs should be bound to substrate-stored envelopes/status records.
- Added `GraphWriteAuthorityContext`, optional `CapabilitySpec.graphWriteAuthority`, optional `CapabilityRuntimeDeps.graphWriteAuthorityPolicy`, and optional `writeAuthorityRef` on capability apply/emit contexts.
- Updated `defineCapability()` so strict graph authority policy is resolved and checked after target-row lock and before capability `apply` or raw `UPDATE graph.nodes`.
- Added database-free capability-kit tests proving existing behavior remains unchanged without policy, strict policy rejects before `apply`/`UPDATE`, and valid refs pass through `apply` before update.
- Claim boundary: capability-kit raw graph updates can now enforce graph write authority when policy is enabled, but refs still need substrate-store validation before forgery-resistant end-to-end claims.

## 2026-06-25 - Graph write authority refs

- Added `research/daily-arrowsmith-agent-state/v41-graph-write-authority-ref-2026-06-25.md`, answering RQ42 and replacing it with RQ43: how capability-kit raw graph writes should propagate graph write-authority refs.
- Added `GraphWriteAuthorityRef`, `GraphWriteProviderCertificateStatusRef`, `GraphWriteAuthorityPolicy`, `validateGraphWriteAuthority()`, `assertGraphWriteAuthority()`, and `GraphWriteAuthorityError` to `@pm/graph`.
- Added optional write-authority refs to graph create/update/edge mutation inputs and optional `PostgresGraph.writeAuthorityPolicy`.
- Updated `PostgresGraph` so strict graph instances reject create/update/tombstone mutations before SQL when accepted workflow authority or provider-certificate status refs are missing, revoked, or mismatched.
- Added pure/adapter tests proving authority validation and pre-SQL rejection.
- Claim boundary: graph writes can now enforce the workflow authority/status-ref boundary when policy is enabled, but capability-kit raw SQL still needs propagation before broad mutation-governance claims.

## 2026-06-25 - Workflow status ref binding

- Added `research/daily-arrowsmith-agent-state/v40-workflow-status-ref-binding-2026-06-25.md`, answering RQ41 and replacing it with RQ42: how non-workflow graph/capability writes should consume provider-certificate status refs.
- Added `InvocationActionOutcomeProviderCertificateStatusRef` and provider lookup result types to `@pm/workflow`.
- Added `providerCertificateStatusRef` to workflow action outcome envelopes, admission requests, and dispatcher invocation context.
- Updated the registry-backed workflow certificate-store adapter to derive status refs from provider-certificate status events at `checkedAt`.
- Added runtime consistency checks that reject status refs bound to a different certificate id, digest, or decision time.
- Claim boundary: workflow-routed writes can now carry exact provider-certificate status event refs, but direct graph/capability write paths still need the same boundary before broad mutation-governance claims.

## 2026-06-25 - Provider certificate status event replay

- Added `research/daily-arrowsmith-agent-state/v39-provider-certificate-status-event-replay-2026-06-25.md`, answering RQ40 and replacing it with RQ41: how workflow action-outcome evidence should bind the exact provider-certificate status event sequence/hash used at dispatch.
- Added append-only `TerminalAdmissionProviderCertificateStatusEvent` types, replay issue/decision types, deterministic status-event hashing, and `replayTerminalAdmissionProviderCertificateStatusAt()` to `@pm/registry`.
- Added migration `0022_registry_terminal_provider_certificate_status_events.sql` for tenant/certificate-partitioned status-event streams with sequence, previous hash, event hash, status time, and recorded time.
- Updated `PostgresTerminalAdmissionProviderCertificateStore` so certificate recording appends an initial status event, status updates append transition events, projection updates happen transactionally, and `checkedAt` lookup reconstructs status from replay.
- Added pure registry tests proving a certificate can replay as valid before later revocation, replay as revoked after revocation, and reject tampered status events.
- Claim boundary: status replay now improves the substrate primitive, but workflow envelopes do not yet cite the exact status-event sequence/hash, Axis A remains incomplete, and Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

## 2026-06-25 - Provider certificate status store

- Added `research/daily-arrowsmith-agent-state/v38-provider-certificate-status-store-2026-06-25.md`, answering RQ39 and replacing it with RQ40: how provider certificate status transitions should become append-only and replayable.
- Added registry status-store contracts for terminal-admission provider certificates, including immutable certificate records, mutable current status, lookup/update inputs, and status-record validation.
- Added `verifyTerminalAdmissionProviderCertificateIntegrity()` and `verifyTerminalAdmissionProviderCertificateStatusRecord()` so revocation/supersession can block digest-valid certificates without mutating certificate JSON.
- Added `PostgresTerminalAdmissionProviderCertificateStore` and migration `0021_registry_terminal_provider_certificates.sql` for tenant-partitioned certificate status persistence.
- Updated `InvocationActionOutcomeProviderCertificateProvider.getCertificate()` to receive `checkedAt`, and added `PostgresWorkflowRuntime.actionOutcomeProviderCertificateStore` so workflow dispatch can consume the registry status store directly.
- Claim boundary: the store makes certificate status restart-safe, but append-only status-transition replay remains open; Axis A remains incomplete and Axis B remains blocked until PluggedInSocial is restored or an authoritative fixture run is accepted.

## 2026-06-25 - Terminal provider certificates

- Added `research/daily-arrowsmith-agent-state/v37-terminal-provider-certificates-2026-06-25.md`, answering RQ38 and replacing it with RQ39: how provider certificates should be persisted/refreshed through a substrate-owned status store.
- Added `TerminalAdmissionProviderCertificate`, subject, status, manifest digest, and certificate digest types to `@pm/types`.
- Added provider certificate issuance, manifest digesting, certificate digesting, and dispatch-time validation helpers to `@pm/registry`.
- Extended workflow action outcome envelopes with provider certificate ids/digests, and added `InvocationActionOutcomeProviderCertificateProvider`.
- Added an opt-in `PostgresWorkflowRuntime` gate that can require a valid provider certificate before write-capable dispatch; missing or invalid certificates dead-letter with blocked terminal outcome envelopes.
- Added write-binding metric buckets for provider-certificate missing/invalid outcomes so certificate failures are not hidden as generic blocked cases.
- Claim boundary: certificates are now runtime-checkable evidence, but the certificate status store/revocation refresh path is still open, Axis A remains incomplete, and Axis B remains blocked until PluggedInSocial is restored or an authoritative fixture run is accepted.

## 2026-06-25 - Terminal provider manifest verification

- Added `research/daily-arrowsmith-agent-state/v36-terminal-provider-manifest-verification-2026-06-25.md`, answering RQ37 and replacing it with RQ38: how verified terminal-admission provider manifests should become durable install/runtime certificates.
- Added `TerminalAdmissionProviderManifest`, `TerminalAdmissionProviderAvailability`, and `contractVersion` to `@pm/types` terminal-admission provider contracts.
- Added `verifyTerminalAdmissionProviderRef()` and `verifyTerminalAdmissionProviderBindings()` to `@pm/registry`, with explicit issue codes for missing, unavailable, deprecated, version-incompatible, package/export-drifted, and narrower action/profile/ref-kind coverage.
- Added live provider manifests for the ArrowHedge finance terminal provider and agency publication terminal provider.
- Added manifest-gated capability-derived provider coverage in `@pm/evals`, so stale provider metadata can be reported as missing coverage instead of counted as proof.
- Claim boundary: provider manifests are checked in-process for this slice; durable install/runtime certificates remain open, and Axis B remains blocked until PluggedInSocial is restored or an authoritative fixture run is accepted.

## 2026-06-25 - Terminal admission provider metadata

- Added `research/daily-arrowsmith-agent-state/v35-terminal-admission-provider-metadata-2026-06-25.md`, answering RQ36 and replacing it with RQ37: how terminal-admission provider refs should be checked for live availability, version compatibility, and action-type coverage.
- Added `TerminalAdmissionProviderRef` and optional `WriteContract.terminalAdmissionProviders` to `@pm/types`.
- Added `listTerminalAdmissionProviderBindings()` to `@pm/registry` so provider coverage can be discovered from normalized capability write contracts.
- Added `FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER` and attached it to the finance ingest Event write contract that backs the ArrowHedge proposal-review boundary.
- Added `AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER` beside the agency publication terminal adapter without claiming unrelated agency write paths are covered.
- Added `buildWriteTransportBindingCoverageSamplesFromCapabilities()` so `@pm/evals` can derive action-outcome provider coverage from capability descriptors rather than hand-maintained transport inventories.
- Updated root `vitest.config.ts` to exclude macOS AppleDouble `._*` sidecar files from test discovery; the root suite was otherwise failing before reaching real tests in copied sidecar files.
- Claim boundary: provider metadata is discovery evidence only; runtime terminal admission, status checks, and three-axis verification remain required. Axis B remains blocked until PluggedInSocial is restored or an authoritative fixture run is accepted.

## 2026-06-25 - Agency publication terminal adapter

- Added `research/daily-arrowsmith-agent-state/v34-agency-publication-terminal-adapter-2026-06-25.md`, answering RQ35 and replacing it with RQ36: how registry/capability metadata should advertise terminal-admission providers without hand-edited eval transport inventories.
- Added `packages/profile-agency/src/publication-terminal.ts`, defining an authoritative agency publication snapshot contract over subject refs, approval status refs, content hashes, freshness, lifecycle state, and source refs.
- Added `buildAgencyPublicationActionOutcomeEnvelope()` so agency publication fixtures can become canonical `ActionOutcomeEnvelope`s through `@pm/agent-state`.
- Added `buildAgencyPublicationActionOutcomeTerminalIndex()` so approved/revoked same-action publish attempts are indexed through the core terminal outcome conflict primitive.
- Added pure tests proving approved matching content is accepted, revoked approval blocks publish, exact replay is idempotent, and same-action accepted/blocked publication attempts produce a terminal conflict.
- Claim boundary: this makes Axis B authoritative fixtures executable once accepted; it does not restore PluggedInSocial or make Axis B verified.

## 2026-06-25 - Workflow terminal admission port

- Added `research/daily-arrowsmith-agent-state/v33-workflow-terminal-admission-port-2026-06-25.md`, answering RQ34 and replacing it with RQ35: the minimum agency/marketing adapter contract needed to consume terminal admission without substrate-package edits.
- Added dependency-light workflow terminal admission types: `InvocationActionOutcomeAdmissionPort`, request, decision, and rejection reasons.
- Updated `PostgresWorkflowRuntime` with optional `actionOutcomeAdmission`; accepted write-capable dispatch is stopped when terminal admission rejects, blocked evidence-gate envelopes are offered to admission before dead-lettering, and adapter failure fails closed as `action_outcome_admission_rejected`.
- Added workflow integration tests for accepted admission, terminal-conflict rejection, and blocked-envelope admission before dead-lettering.
- Claim boundary: this improves the workflow runtime code boundary without adding an `@pm/agent-state` dependency; it does not unblock Axis B or verify the full three-axis matrix.

## 2026-06-25 - ArrowHedge terminal index adoption

- Added `research/daily-arrowsmith-agent-state/v32-arrowhedge-terminal-index-adoption-2026-06-25.md`, answering RQ33 and replacing it with RQ34: how workflow should consume canonical terminal admission without duplicating terminal claims.
- Added `buildArrowHedgeActionOutcomeEnvelope()` to `@pm/capability-finance-research-ingest`, converting ArrowHedge proposal-review artifacts into canonical `ActionOutcomeEnvelope`s.
- Added `buildArrowHedgeActionOutcomeTerminalIndex()` so ArrowHedge candidates are admitted through the core `@pm/agent-state` terminal index.
- Added ArrowHedge tests proving a fresh candidate is accepted, a stale same-action candidate is blocked, exact replay is idempotent, and same-action accepted/blocked candidates produce a terminal conflict.
- Claim boundary: this improves the Axis A code boundary; it does not complete all ten Axis A classes, unblock Axis B, or verify the full three-axis matrix.

## 2026-06-25 - Terminal outcome index codebase correction

- Added `research/daily-arrowsmith-agent-state/v31-terminal-index-codebase-correction-2026-06-25.md`, answering RQ32 and replacing it with RQ33: which operational write boundaries should consume the terminal index first.
- Hardened `@pm/agent-state` `admitActionOutcomeEnvelope()` so hash-invalid candidate envelopes are rejected before terminal admission.
- Added `actionOutcomeTerminalKey()` and `buildActionOutcomeTerminalIndex()` to create a replay/resume index over hash-valid terminal envelopes, with idempotent duplicate counts and conflict issues for same-action different envelopes.
- Added core tests proving idempotent replay, terminal conflict rejection, invalid-hash rejection, terminal-index issue reporting, and stale blocking reviews demoting requested accepted writes to blocked.
- Corrected the research ledger boundary: three-axis proof packets are verifier artifacts, not the implementation primitive.

## 2026-06-25 - Three-axis proof packet

- Added `research/daily-arrowsmith-agent-state/v30-three-axis-proof-packet-2026-06-25.md`, answering RQ31 and replacing it with RQ32: how proof packets should validate `action_outcome_envelope` refs against live or replay packet stores.
- Added `buildThreeAxisProofPacket()` to `@pm/evals`. It wraps the three-axis coverage report with packet status, source groups, verified axes, blocked axes, unverified axes, missing cells, blocked cells, unverified cells, and terminal-proof-backed scenario-pass cells.
- Updated ArrowHedge Axis A EvalEvents so `actionOutcomeEnvelopes` can be scoped per `baseline` / `substrate` arm and can carry `operationalTerminalOutcome`.
- Updated the Axis B marketing blocker to emit `scenarioResult: "blocked"` explicitly.
- Added tests proving the current assembled packet remains `blocked`: Axis C can be verified, Axis A remains incomplete, and Axis B remains blocked. A fully populated synthetic matrix is required for a verified packet.
- Updated eval schema docs and research ledgers with v30, claim C080, and L040. Claim boundary: this is a traceable proof packet and current blocker report, not full three-axis verification.

## 2026-06-25 - Eval verdict and terminal outcome split

- Added `research/daily-arrowsmith-agent-state/v29-eval-verdict-terminal-outcome-split-2026-06-25.md`, answering RQ30 and replacing it with RQ31: how Axis A/C should emit terminal-proof-backed scenario pass pairs while Axis B remains explicitly blocked until PluggedInSocial or authoritative fixtures exist.
- Added optional `scenarioResult` and `operationalTerminalOutcome` fields to `EvalEvent`, plus `EVAL_OPERATIONAL_TERMINAL_OUTCOMES`.
- Schema validation now requires pass/fail scenario verdict refs, requires `operationalTerminalOutcome` to cite an `action_outcome_envelope`, and requires terminal outcome metadata when a legacy `result: "blocked"` is also a scenario pass.
- Dynamic Axis C protective refusals now emit `result: "blocked"`, `scenarioResult: "pass"`, and `operationalTerminalOutcome: "blocked"`.
- Updated `analyzeThreeAxisCoverage()` to use `scenarioResult ?? result`, report `scenarioPassPairs`, and verify terminally blocked protective refusals when outcome proof refs exist.
- Updated eval/local-lab docs and research ledgers with v29, claim C079, and L039. Claim boundary: the full three-axis solution is still unverified because Axis A is incomplete and Axis B remains blocked.

## 2026-06-25 - Three-axis coverage gate

- Added `research/daily-arrowsmith-agent-state/v28-three-axis-coverage-gate-2026-06-25.md`, answering RQ29 and replacing it with RQ30: whether EvalEvent scenario verdicts need to split from operational terminal outcomes so protective substrate refusals are not confused with blocked evaluations.
- Added `analyzeThreeAxisCoverage()` to `@pm/evals`, producing the required 30-cell matrix across three axes and ten failure classes.
- The new report separates protective coverage from stricter verification: coverage requires paired baseline/substrate protection with refs; verification requires non-blocked substrate `pass` plus `action_outcome_envelope` terminal proof refs by default.
- Added tests proving complete Axis C coverage does not hide blocked/missing Axis B cells, and that non-blocked pass pairs without terminal proof refs remain unverified.
- Updated eval schema docs and research ledgers with v28, claim C078, and L038. Claim boundary: this is the matrix verifier surface, not proof that all 30 cells are satisfied.

## 2026-06-25 - Axis C ten-class live coverage

- Added `research/daily-arrowsmith-agent-state/v27-axis-c-ten-class-live-coverage-2026-06-25.md`, answering RQ28 and replacing it with RQ29: how to lift the explicit coverage gate from Axis C to the full 10 failure classes x 3 axes matrix without hiding Axis B's blocked status.
- Added `liveCoverage` reporting for dynamic local-agent-lab eval suites. Coverage is complete only when every taxonomy class has a protective packet-backed live pair (`baseline=fail`, `substrate!=fail`) with generated `action_outcome_envelope` refs on both arms.
- Added nine more dynamic `@pm/local-agent-lab` scenarios so the registry now covers all ten state-failure classes, with a registry test that fails if a class is silently dropped.
- Updated `pnpm evals:local-agent-lab:live` to print coverage completeness, rate, covered classes, and missing classes.
- Verified the all-ten Axis C live run against local Postgres/Ollama: 10 scenarios, 20 EvalEvents, 20 packets, 10 baseline failures, 0 substrate failures, and `liveCoverage.complete=true`. A SQL recovery query resolved 20/20 latest packet refs across 10 failure classes.
- Updated local-lab docs and research ledgers with v27, claim C077, and L037. Claim boundary: Axis C dynamic live coverage is complete for one protective family per class, but the full solution remains unverified until Axis A has the same gate and Axis B is non-blocked.

## 2026-06-25 - Dynamic Axis C live EvalEvents

- Added `research/daily-arrowsmith-agent-state/v26-dynamic-axis-c-evalevents-2026-06-25.md`, answering RQ27 and replacing it with RQ28: how to expand dynamic Axis C `live_run` coverage from stale-observation to all ten failure classes.
- Added `evidenceStage: "live_run"` to `@pm/evals`, including schema validation, metrics support, and documentation. Live runs now count toward the mature failure-reduction metric while scaffolded scenarios remain excluded.
- Added dynamic local-agent-lab EvalEvent conversion in `@pm/evals`: `buildDynamicLocalAgentLabEvalSuite()` maps dynamic `ScenarioRun` arms to paired EvalEvents, requires generated `ActionOutcomeEnvelope` packets, and rejects events that cite missing packet refs.
- Added `recordDynamicLocalAgentLabEvalSuite()` so DB-backed live eval persistence writes outcome packets before EvalEvents.
- Added `retainWorlds: true` support to `@pm/local-agent-lab` and `pnpm evals:local-agent-lab:live` so live Postgres/Ollama runs preserve event-log substrate refs for replay.
- Fixed `scripts/migrate.ts` to ignore macOS `._*.sql` AppleDouble sidecar files. The local live run then applied migration `0020`, persisted two live stale-observation EvalEvents plus two packets, and a SQL recovery join resolved both packet refs.
- Updated local-lab docs and research ledgers with v26, claim C076, and L036. Claim boundary: Axis C is now live for stale-observation only; full Axis C ten-class coverage and Axis B remain unverified.

## 2026-06-25 - Axis C outcome packet generation

- Added `research/daily-arrowsmith-agent-state/v25-axis-c-outcome-packet-generation-2026-06-25.md`, answering RQ26 and replacing it with RQ27: how dynamic `@pm/local-agent-lab` `ScenarioRun` records should become packet-backed EvalEvents in live Postgres/Ollama runs.
- Updated deterministic Axis C evals so `runLocalLabPairedScenario()` and `runLocalLabPairedEvals()` return hash-valid canonical `ActionOutcomeEnvelope` packets aligned with local-lab substrate EvalEvent refs.
- Updated `pnpm evals:local-lab` so DB-backed persistence writes action outcome packets before recording EvalEvents.
- Added canonical packet generation to the dynamic `@pm/local-agent-lab` engine: admitted/refused arm runs now expose `ActionOutcomeEnvelope` packets through `ArmRun`, `ScenarioRun`, and `SuiteResult`.
- Updated local-lab docs and research ledgers with v25, claim C075, and L035. Claim boundary: full dynamic run-to-EvalEvent persistence across all Axis C failure classes remains open, and Axis B remains blocked.

## 2026-06-25 - Live outcome-envelope packet store

- Added `research/daily-arrowsmith-agent-state/v24-live-outcome-envelope-store-2026-06-25.md`, answering RQ25 and replacing it with RQ26: how Axis C dynamic local-lab and workflow runtime runs should generate and persist promoted outcome-envelope packets before emitting EvalEvents.
- Added `evals.action_outcome_envelope_packets` in both root and package-local eval migrations so terminal packets can be stored by `(tenant_id, envelope_ref_id)`.
- Extended `PostgresEvalEventStore` with hash-gated `recordActionOutcomeEnvelope()`, batch packet recording, `getActionOutcomeEnvelopeByRef()`, and `resolveActionOutcomeRefs()`.
- Packet persistence now rejects hash-invalid envelopes before DB writes and rejects same-ref/different-hash conflicts instead of overwriting terminal proof.
- Updated the eval event schema docs and research ledgers with v24, claim C074, and L034. Claim boundary: this is the live persistence boundary, not Axis C runtime packet generation, non-blocked Axis B, or full three-axis verification.

## 2026-06-25 - Outcome-envelope replay index for EvalEvents

- Added `research/daily-arrowsmith-agent-state/v23-outcome-envelope-replay-index-2026-06-25.md`, answering RQ24 and replacing it with RQ25: how to move promoted outcome-envelope packets from committed JSONL replay into a live substrate-owned store for Axis C dynamic local-lab and Postgres eval recovery.
- Added `ActionOutcomeEnvelopeReplayIndex` support in `@pm/evals`, plus `buildActionOutcomeEnvelopeReplayIndex()`, `recoverActionOutcomeEnvelopeFromReplayIndex()`, and `analyzeEvalEventActionOutcomeReplay()`.
- Added replay metrics for EvalEvent action-outcome refs: resolved/unresolved refs, invalid hashes, and recovered accepted/blocked terminal outcomes.
- Updated ArrowHedge write-binding tests so the terminal-partition Axis A EvalEvent derives its `action_outcome_envelope` ref from the write-binding replay corpus and recovers a hash-valid blocked terminal envelope.
- Updated the daily Arrowsmith index and shared research ledger with v23, claim C073, and L033. Claim boundary: this is fixture-backed Axis A replay recovery, not a live store, Axis C runtime recovery, non-blocked Axis B, or full three-axis verification.

## 2026-06-25 - Workflow envelope promotion proof packets

- Added `research/daily-arrowsmith-agent-state/v22-workflow-envelope-promotion-2026-06-25.md`, answering RQ23 and replacing it with RQ24: how to persist and replay promoted runtime outcome envelopes through substrate refs, EvalEvents, and amnesiac resume.
- Added `promoteWorkflowInvocationOutcomeEnvelope()` in `@pm/agent-state` so workflow runtime envelopes can become canonical `ActionOutcomeEnvelope` proof packets without recomputing or contradicting the workflow terminal claim.
- Added `action_outcome_envelope` as a `StateRefKind` and validated promotion failure cases for invalid-evidence accepted outcomes, accepted outcomes with blockers, and blocked outcomes without causes.
- Updated ArrowHedge write-binding replay rows to include promoted action outcome envelopes, regenerated `packages/evals/fixtures/write-binding-replay.v1.jsonl`, and added replay metrics for total, accepted, and blocked action outcome envelopes.
- Updated the daily Arrowsmith index and shared research ledger with v22, claim C072, and L032. Claim boundary: this is replay/proof-packet promotion, not durable live persistence, non-blocked Axis B, or full three-axis verification.

## 2026-06-25 - Workflow runtime outcome-envelope boundary

- Added `research/daily-arrowsmith-agent-state/v21-workflow-outcome-envelope-boundary-2026-06-25.md`, answering RQ22 and replacing it with RQ23: how to promote runtime workflow envelopes into full `@pm/agent-state` envelopes and EvalEvents without duplicating terminal claims.
- Added dependency-light `InvocationActionOutcomeEnvelope` support in `@pm/workflow`, plus `buildInvocationActionOutcomeEnvelope()`.
- Updated `PostgresWorkflowRuntime` so `evidenceBindingMode: "require_for_writes"` generates blocked envelopes for failed evidence-binding validation/verification before dead-lettering and accepted envelopes before write-capable dispatch.
- Added `actionOutcomeEnvelope` to `InvocationContext` so dispatchers receive the accepted terminal outcome alongside the evidence binding.
- Updated `@pm/evals` write-transport coverage to mark workflow-routed fixture transports as outcome-envelope-covered: outcome-envelope provider coverage is now 4/4 in the fixture inventory, while evidence-binding provider/verifier coverage remains a separate metric.
- Updated the daily Arrowsmith index and shared research ledger with v21, claim C071, and L031. Claim boundary: workflow-routed write dispatch now has a runtime envelope boundary, but full agent-state proof packets, live ArrowHedge replay linkage, Axis B, and three-axis verification remain open.

## 2026-06-25 - Write-transport outcome-envelope coverage

- Added `research/daily-arrowsmith-agent-state/v20-write-transport-outcome-envelope-coverage-2026-06-25.md`, answering RQ21 and replacing it with RQ22: where to create outcome envelopes and verify evidence binding atomically before dispatch without requiring profile/capability edits.
- Extended `@pm/evals` write-transport coverage samples and metrics with outcome-envelope provider coverage: required, covered, missing, coverage rate, and missing transport ids.
- Made the current runtime gap explicit in the fixture inventory: four write-capable transports require pre-side-effect `ActionOutcomeEnvelope` providers and zero currently have one.
- Reconciled stale ArrowHedge artifact hashes in `packages/evals/fixtures/write-binding-replay.v1.jsonl` against the committed state-review artifact corpus so replay-catalog verification is consistent again.
- Updated the daily Arrowsmith index and shared research ledger with v20, claim C070, and L030. Claim boundary: this is an executable coverage metric and replay-fixture correction, not runtime envelope generation.

## 2026-06-25 - ActionOutcomeEnvelope eval wiring and Axis B blocker

- Added `research/daily-arrowsmith-agent-state/v19-action-outcome-eval-wiring-2026-06-25.md`, answering RQ11 with enforcement-boundary papers and replacing it with RQ21: which write-capable transports still lack required `ActionOutcomeEnvelope` generation before side effects.
- Added `action_outcome_envelope` as a first-class `@pm/evals` evidence/substrate ref kind and documented it in `docs/state-validation/eval-event-schema.md`.
- Wired outcome-envelope refs into Axis A ArrowHedge and Axis C local-lab substrate eval events, including an ArrowHedge terminal-outcome partition scenario that fails the substrate arm when no matching outcome envelope is supplied.
- Added `buildMarketingAxisBBlockedEval()` so the missing PluggedInSocial clone or accepted authoritative agency fixtures appear as a machine-checkable blocked Axis B event instead of an informal note.
- Updated the daily Arrowsmith index and shared research ledger with v19, claim C069, and L029. Claim boundary: this is eval evidence wiring, not runtime write governance. The full three-axis solution remains unverified while Axis B is blocked and write-capable transports are not yet required to emit outcome envelopes before mutation.

## 2026-06-25 - ActionOutcomeEnvelope pure terminal-normal-form slice

- Added `research/daily-arrowsmith-agent-state/v18-action-outcome-loop-2026-06-25.md` as the first closed-loop research ledger: ten unanswered agent-state questions, peer-reviewed-paper-backed answers, replacement questions RQ11-RQ20, bridge hypothesis, falsification criteria, and axis status.
- Added pure `ActionOutcomeEnvelope` support in `@pm/agent-state`: terminal outcome hashing, same-action terminal partition validation, high-consequence stale-evidence blocking for requested accepted writes, substrate-ref recovery, local-view obstruction artifacts, and role projection validation that preserves blocking conflicts.
- Added focused tests proving the first candidate slice: the same `actionId` cannot be both accepted and blocked, stale evidence cannot support an accepted high-consequence write, conflicting local views produce obstruction rather than summary, role projections cannot hide blockers, and an amnesiac agent can recover terminal outcome from substrate refs.
- Updated the daily Arrowsmith index and shared research ledger with v18, claims C067-C068, and L028. Claim boundary: this is pure tested code, not workflow/runtime mutation governance and not full three-axis verification. Axis B remains blocked until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted.
- Verification: `pnpm vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`; `pnpm --filter @pm/agent-state typecheck`.

## 2026-06-24 - Agent-state Arrowsmith v17 reality-quality cross-paper review

- Fetched `origin/main` and confirmed local `HEAD` and `FETCH_HEAD` at `75a8f589730118dd19a5b42c0855f72b26fd125b` before writing. Did not pull because the worktree already contained unrelated local changes.
- Added `research/daily-arrowsmith-agent-state/v17-reality-quality-arrowsmith-2026-06-24.md` with a cross-paper review of the strongest reality-quality analogues: quotienting/gauge equivalence, sheaf gluing, Petri nets/event structures, rewriting/normal forms, state-machine replication, Lamport/Paxos/Raft/PBFT ordering, transactional admission, content identity, CRDT/version conflict handling, feedback control, boundary objects, transactive memory, and provenance.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with v17, claims C061-C066, and the revised frontier: operational equivalence classes, local-view obstruction artifacts, terminal action normal forms, all-write admission kernels, evidence leases, conflict algebra, receding-horizon execution, and projection-drift checks.
- Claim boundary: this is a research-only continuation. No runtime code changed; terminal outcome partitioning, local-view obstruction fixtures, durable status stores, and all-transport mutation governance remain implementation work.

## 2026-06-19 - Agent-state Arrowsmith v16 terminal enforcement correction

- Fetched `origin/main`, ran `git pull --ff-only origin main`, and verified local `HEAD`, `origin/main`, and `FETCH_HEAD` at `bf7d021bcadf93ad536f161d440d62fb2f7ff6bc` before writing.
- Added `research/daily-arrowsmith-agent-state/v16-agent-state-arrowsmith-2026-06-19.md` with the next Arrowsmith bridge: stale-state detection, block-event emission, and actual mutation prevention are separate claims unless accepted/blocked/rejected/held outcomes partition by stable action id.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with the v16 version row, C060 claim, L027 ledger entry, source changes, corrected/downgraded claims, metrics, and the revised next code slice.
- Claim boundary: this is a research-only continuation. The June 18 ArrowHedge live-bridge/dashboard work remains local uncommitted repo evidence in this worktree, not published `main` behavior; terminal outcome partitioning and `EvidenceStatusCheck` are still next implementation work.

## 2026-06-16 - Agent-state Arrowsmith v15 status-currentness continuation

- Fetched `origin/main`, verified local `HEAD`, local `origin/main`, and remote `main` at `ae3db140668fef2bd158f0078817d368693c9ea2`, and continued from the already-present same-day `v14` instead of creating a duplicate.
- Added `research/daily-arrowsmith-agent-state/v15-agent-state-arrowsmith-2026-06-16.md` with the next Arrowsmith bridge: certificates, receipts, MCP task handles, and PM acknowledgements need decision-time status checks before they support valid action.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with the v15 version row, C059 claim, L026 ledger entry, new source changes, rejected/downgraded bridges, and the current Implementation/Test Task Tree.
- Claim boundary: this is a research-only continuation; no runtime code changed and no durable status store or final-state verifier is claimed.

## 2026-06-16 - Target-receipt evidence lane, daily AI v09, and agent-state Arrowsmith v14

- Added a first-class `target_receipt` external-evidence kind in `@pm/agent-state` so receipt evidence is no longer collapsed into generic telemetry.
- Added `TargetReceiptEvidenceFacet` with `channel`, `correlatedDispatchId`, `receiptStatus`, `receiptId`, `targetSurface`, and `finalStateObserved`.
- Added admission warnings for missing receipt metadata and for dispatch-only / acknowledgement-only pseudo-receipts, preserving the boundary that dispatch success is not delivery proof.
- Extended `@pm/evals` with dispatch-only and clean applied target-receipt fixtures plus `targetReceiptCount`, `dispatchOnlyReceiptCount`, and `targetReceiptStatuses` replay metrics.
- Regenerated `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` from the built package output so the committed corpus stays aligned with the new receipt lane.
- Added `research/daily-ai-competitive-intelligence/v09-ai-competitive-intelligence-2026-06-16.md` and `research/daily-arrowsmith-agent-state/v14-agent-state-arrowsmith-2026-06-16.md`, updated both chain indexes plus `research/index.md`, and kept the task tree honest: target receipts are now implemented as a pure/replay primitive while durable live receipt/status stores and final-state verification remain open.
- Verification: `pnpm vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`; `pnpm vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic`; `pnpm --filter @pm/agent-state build`; `pnpm --filter @pm/evals build`.

## 2026-06-15 - origin/main sync and replay-catalog count drift fix

- Fast-forwarded local `main` to the latest `origin/main`, which added the `arrowhedgelab/` test project.
- Fixed `packages/evals/src/write-binding.test.ts` so the evidence-binding catalog test derives the committed evidence-admission row count from `evidence-admission-reviews.v1.jsonl` instead of hard-coding the previous 18-row corpus after the memory-write admission lane expanded it to 21 rows.

## 2026-06-15 - Memory write admission and memory-influence replay closure

- Added `memory_write` as a first-class `ExternalStateEvidenceKind` in `@pm/agent-state`, separating memory writes from memory retrievals instead of treating both as one generic memory lane.
- Extended `MemoryEvidenceFacet` with `sourceChannel`, `intendedUse`, `influenceKind`, and `overrideStatus`, so memory evidence can now say whether it acts as fact, preference, instruction, tool-routing, policy-like rule, or summary.
- Added admission warnings for missing memory-write metadata, missing influence classification, missing override status on control-influencing memory, and control memory already overridden by current workflow/user state.
- Extended the replay corpus in `@pm/evals` with hidden-instruction memory writes, clean preference writes, and overridden tool-routing memory retrieval, then added matching coverage metrics (`memoryWriteCount`, `memoryControlInfluenceCount`, `memoryInfluenceKinds`).
- Regenerated `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` so the committed admission-review corpus stays deterministic against the new memory contract.
- Added `research/daily-arrowsmith-agent-state/v13-agent-state-arrowsmith-2026-06-15.md` and `research/daily-ai-competitive-intelligence/v08-ai-competitive-intelligence-2026-06-15.md`, then updated both chain indexes and the shared research ledger.
- Verification: `pnpm exec tsc -p packages/agent-state/tsconfig.json --noEmit --pretty false`, `pnpm --filter @pm/evals typecheck`, `vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic` (33 passed), and `vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic` (11 passed).

## 2026-06-13 - Daily agent-state Arrowsmith v12

- Added `research/daily-arrowsmith-agent-state/v12-agent-state-arrowsmith-2026-06-13.md` as the twelfth numbered daily continuation.
- Confirmed local `HEAD`, local `origin/main`, and remote `main` all resolved to `00693bb5d8efd04c3f6beb441bc72faeb186d35d` before editing; two git fetch/status-style commands hung in this desktop shell and were interrupted after SHA parity was independently verified.
- Audited v11's certificate-bound replay boundary against fresh memory-poisoning, memory-control-flow, formal workflow verification, trace-repair, multimodal-memory, W3C credential/status, MCP, OpenTelemetry, and human-AI teaming sources.
- Kept the claim boundary strict: deterministic certificate refs are replay/catalog proof, not production signing, durable status authority, target-side delivery proof, all-transport enforcement, or safe memory governance.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with new findings, source changes, corrected/downgraded claims, implementation implications, metrics, and watchlist items around durable certificate/status stores, target-side receipts, memory-write/read influence admission, policy-transition mini-specs, final-state checks, and PM protocol-burden metrics.
- Verification: required-section scan and `git diff --check` passed. No runtime code changed in this entry.

## 2026-06-12 - Certificate-bound replay verification and tenant-aligned corpora

- Added certificate-aware evidence-binding verification in `@pm/workflow`: invocation bindings can now carry an admission certificate id/digest, and catalog verification rejects digest drift, expired validity windows, revoked certificates, artifact mismatch, tenant/workflow mismatch, invalid policy/revocation metadata, and incomplete evidence-review coverage.
- Added deterministic replay admission certificates in `@pm/evals` for complete write-binding replay rows, plus certificate counts in `EvidenceBindingReferenceCatalog` metrics.
- Tightened write-binding replay proof so committed JSONL rows are re-verified against a freshly built catalog instead of trusting serialized `record.validation`.
- Fixed a hidden cross-corpus proof bug: the evidence-admission replay corpus now uses the ArrowHedge state-review tenant (`tnt_arrowhedge_state_review_corpus`) so evidence-admission, state-review, and write-binding corpora can replay under strict tenant checks.
- Regenerated `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` and `packages/evals/fixtures/write-binding-replay.v1.jsonl` to preserve deterministic golden proof after the tenant/certificate contract change.
- Added `research/daily-ai-competitive-intelligence/v07-ai-competitive-intelligence-2026-06-12.md` and `research/daily-arrowsmith-agent-state/v11-agent-state-arrowsmith-2026-06-12.md`, then updated both chain indexes and the shared research ledger. Claim boundary: this is replay/catalog certificate proof, not signed production certificates, live revocation, DB-backed stores, target-side delivery confirmation, or all-transport mutation governance.
- Verification: red workflow test first showed stale/revoked certificate inputs still verified as valid; after implementation, `pnpm vitest run packages/workflow/src/evidence-binding.test.ts packages/evals/src/evidence-admission.test.ts packages/evals/src/write-binding.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts` passed (42 tests).

## 2026-06-12 - Daily agent-state Arrowsmith v10

- Added `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md` as the tenth numbered daily continuation.
- Fetched `origin/main` and confirmed local/remote SHA parity at `76e8e2f30747822b7070b71b8df31431bd9d1c28` before writing; no merge conflict was present.
- Audited the latest replay-backed verification catalog and write-transport coverage implementation as partially closing v09's recommended code slice, while keeping durable DB/substrate-store verification and all-real-transport enforcement open.
- Added fresh bridges from certificate-bound admission, cross-channel delivery failures, memory-control-flow attacks, evidence-first diagnosis, state-based real-environment benchmarking, AgentOps, multi-agent marginal-utility evaluation, and human-AI teamwork/scaffolding field experiments.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with new corrected/downgraded claims, metrics, watchlist items, and next implementation implications around durable admission certificates, target-side delivery confirmation, memory influence review, state-based final-environment checks, role-utility metrics, and PM protocol-burden measurement.
- Verification: `git diff --check` passed. No runtime code changed in this entry.

## 2026-06-12 - Replay-backed verification catalogs and write-transport coverage

- Added replay-corpus import helpers for evidence-admission reviews and write-binding records in `@pm/evals`, so the committed JSONL corpora are reusable verification inputs instead of drift-test outputs only.
- Added `buildEvidenceBindingReferenceCatalogFromReplayCorpora()` in `packages/evals/src/write-binding.ts`, which merges the committed ArrowHedge state-review artifact corpus, evidence-admission review corpus, and write-binding replay corpus into a substrate-owned `EvidenceBindingReferenceCatalog`.
- Added a focused replay verification test in `packages/evals/src/write-binding.test.ts` that proves the committed rows still evaluate as intended when reloaded through that catalog: allowed, missing-binding, incomplete-binding, policy-blocked, and the intentional hash-mismatch case remain stable.
- Added fixture-backed write-transport coverage metrics with a non-ArrowHedge agency write path so the current boundary can distinguish `required_verified`, `advisory_only`, and `missing_provider` transports instead of overclaiming repo-wide mutation governance.
- Added `research/daily-ai-competitive-intelligence/v06-ai-competitive-intelligence-2026-06-12.md` and updated the shared research ledger to record the June 10-12 official persistence/governance deltas from GitHub, Google, AWS, and OpenAI plus the code slice that converted those deltas into verification reuse.
- Verification: `pnpm vitest run packages/evals/src/write-binding.test.ts packages/evals/src/evidence-admission.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts`, `pnpm --filter @pm/evals typecheck`, and `pnpm --filter @pm/capability-finance-research-ingest build` passed.

## 2026-06-12 - Daily agent-state Arrowsmith v09

- Added `research/daily-arrowsmith-agent-state/v09-agent-state-arrowsmith-2026-06-12.md` as the ninth numbered daily continuation.
- Fast-forwarded from local `5bf4a67` to `origin/main` `bb2c38d` and corrected the v08 frontier after the ArrowHedge state-review artifact corpus, write-binding replay corpus, opt-in workflow evidence-binding gate, catalog verification hook, and replay dashboard had landed upstream.
- Added fresh bridge evidence from EvoArena memory evolution, HyperTool executable tool wrappers, AgentBeats agentified assessment, TRACE compiled user corrections, MemRefine memory compaction, EurekAgent environment engineering, EpiBench workflow-state evaluation, runtime-enforcement foundations, shared mental-model project-team literature, POMDP task-completion updates, and agile cognitive offloading.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with the corrected closed claims, downgraded overclaims, new claim-ledger items, metrics, and next implementation implication: durable write-binding verification catalogs plus transport coverage metrics.
- Verification: `git diff --check` passed. No runtime code changed in this entry.

## 2026-06-11 - Write-binding review cleanup

- Added an opt-in workflow `EvidenceBindingVerifier` hook plus `verifyInvocationEvidenceBindingAgainstCatalog()` so a runtime can reject bindings whose artifact id/hash, evidence review ids, tenant, workflow, or rejected-evidence policy disposition cannot be verified against a substrate-owned catalog.
- Extended the ArrowHedge write-binding replay corpus with a hash-mismatch row (`blocked_unverified_binding`) so self-attested evidence bindings have an executable falsification case.
- Fixed the dashboard replay-data view so selecting a write-binding row shows the compact write-binding source object instead of an empty JSON object.
- Tightened the capability isolation test's stale-package handling: manifestless retired build-output tombstones are skipped, but any manifestless capability directory with TypeScript source now fails loudly.
- Clarified the architecture/research claim boundary: the current runtime gate validates complete evidence bindings, explicit policy blocks, and optional catalog verification on opted-in write-capable workflow paths; full mutation governance still requires durable verification stores and adoption across every external write transport.

## 2026-06-11 - Write-binding replay corpus and policy-blocked workflow gate

- Added `packages/evals/src/write-binding.ts` with a deterministic ArrowHedge write-binding replay corpus that links write attempts to existing state-review artifact ids/hashes and evidence-admission review ids.
- Committed `packages/evals/fixtures/write-binding-replay.v1.jsonl` with replay rows for allowed complete binding, missing-binding block, incomplete-binding block, stale-artifact policy block, and rejected-evidence policy block.
- Extended `@pm/workflow` evidence binding validation so an explicit `policyDisposition: { mode: "blocking", wouldBlock: true }` stops write-capable dispatch before side effects and records `evidence_policy_blocked` in the dead-letter lane.
- Updated `@pm/substrate-dashboard` to consume the committed write-binding JSONL as a third real replay stream instead of showing the write-binding boundary as pending.
- Verification: red tests first failed on the missing policy block, missing write-binding module, and pending dashboard stream; then `pnpm vitest run packages/workflow/src/evidence-binding.test.ts packages/workflow/src/postgres.test.ts`, `pnpm vitest run packages/evals/src/write-binding.test.ts`, `pnpm --filter @pm/evals typecheck`, `pnpm --filter @pm/workflow typecheck`, `pnpm --filter @pm/substrate-dashboard test`, `pnpm --filter @pm/substrate-dashboard typecheck`, and `pnpm --filter @pm/substrate-dashboard build` passed. DB workflow tests collected but skipped without `PM_DATABASE_URL`.

## 2026-06-11 - Substrate dashboard screenshot QA fixes

- Fixed screenshot-visible dashboard defects: the monitor root now fills the viewport, stale URL state is canonicalized so artifact corpus views cannot render an admission inspector, and long warning codes/messages in the inspector no longer overlap.
- Verification: reproduced the stale `corpus=artifacts&kind=admission` URL, confirmed it normalizes back to the artifact inspector, checked the memory-admission warning inspector, verified wide-viewport geometry, and confirmed the browser console stayed free of warnings/errors.
- Verification: `pnpm --filter @pm/substrate-dashboard test`, `pnpm --filter @pm/substrate-dashboard typecheck`, and `pnpm --filter @pm/substrate-dashboard build` passed.

## 2026-06-11 - Substrate dashboard operational monitor correction

- Reworked `@pm/substrate-dashboard` from the first simplified card layout into the operational monitor surface: dark module rail, compact command strip, replay corpus filters, heatmap timeline, evidence-flow board, event timeline table, and fuller artifact/evidence inspector.
- Kept the claim boundary honest by labeling the current stream as static replay/fixture-backed while preserving the visual affordances needed for a future live substrate monitor.
- Verification: `pnpm --filter @pm/substrate-dashboard test`, `pnpm --filter @pm/substrate-dashboard typecheck`, and `pnpm --filter @pm/substrate-dashboard build` passed; browser QA covered desktop reference alignment, mobile header containment, and console warnings/errors.

## 2026-06-11 - Substrate replay dashboard

- Implemented the first substrate monitoring dashboard as `@pm/substrate-dashboard`, a Vite/TypeScript app that reads the committed ArrowHedge state-review artifact JSONL and evidence-admission JSONL directly instead of inventing a separate demo data model.
- Added dashboard data shaping for replay-hash coverage, artifact warning concentration, evidence-admission decisions, invariant counts, and the current write-binding stream boundary. The binding stream is intentionally shown as pending because runtime gating exists but no replay fixture stream has been committed yet.
- Built a dense operational UI with URL-backed corpus, filter, search, and selection state; a timeline for state-review and evidence-admission rows; evidence-flow and heatmap panels; replay-row inspection; and a source-object inspector for warnings, issues, refs, and JSON context.
- Verification: `pnpm --filter @pm/substrate-dashboard test`, `pnpm --filter @pm/substrate-dashboard typecheck`, and `pnpm --filter @pm/substrate-dashboard build` passed; browser QA covered desktop and mobile layouts on the local Vite app.

## 2026-06-11 - ArrowHedge on-disk state-review replay corpus

- Implemented the next post-evidence-binding research-to-code slice for the remaining v08 frontier: a canonical ArrowHedge state-review artifact corpus that combines the clean accepted/current baseline with observation-to-action, action-to-feedback, and feedback-to-observation temporal drift artifacts.
- Added `buildArrowHedgeCanonicalStateReviewArtifactCorpus()` to `@pm/capability-finance-research-ingest` so replay consumers and future dashboards can use the same source-of-truth corpus contract instead of duplicating fixture assembly.
- Committed `packages/evals/fixtures/arrowhedge-state-review-artifacts.v1.jsonl` as the on-disk replay artifact beside the existing evidence-admission replay corpus, then added a drift test that regenerates the corpus and fails if the committed JSONL diverges.
- Verification: red test first failed on missing `buildArrowHedgeCanonicalStateReviewArtifactCorpus`, then on the missing committed JSONL fixture; after implementation, `pnpm vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts` passed (17 tests), `pnpm vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/evals/src/evidence-admission.test.ts` passed (28 tests), `pnpm --filter @pm/capability-finance-research-ingest build` exited 0, and `git diff --check` exited 0.

## 2026-06-11 - Workflow evidence-action binding gate

- Implemented the next v08 research-to-code slice in `@pm/workflow`: an opt-in `evidenceBindingMode: "require_for_writes"` gate that validates write-capable capability invocations before dispatcher execution.
- Added `InvocationEvidenceBinding` / `EvidenceBindingProvider` contracts so runtime callers can attach `stateReviewArtifactId`, `evidenceAdmissionReviewIds`, and policy disposition to capability dispatch contexts.
- Runtime behavior stays migration-safe by default (`off`) and explicitly scoped: the gate blocks missing or incomplete evidence bindings when enabled; it does not claim full production mutation enforcement or broader privacy/policy-transition closure.
- Added focused tests for the pure binding validator, malformed provider output, and DB-runtime integration coverage for missing/present bindings; the DB runtime cases collect but skip without `PM_DATABASE_URL`.
- Verification: red test first failed on missing `./evidence-binding.js`; then `pnpm vitest run packages/workflow/src/evidence-binding.test.ts` passed (3 tests), `pnpm exec tsc -p packages/workflow/tsconfig.json --noEmit --pretty false` exited 0, `./node_modules/.bin/esbuild packages/workflow/src/index.ts --bundle --platform=node --format=esm --external:pg --external:@pm/types --external:@pm/events --external:@pm/registry --outfile=/tmp/pm-workflow-evidence-binding-smoke.mjs` exited 0, and `pnpm vitest run packages/workflow/src/postgres.test.ts` collected 22 skipped DB tests because `PM_DATABASE_URL` was not set.
- Sync limitation: a fresh `git fetch origin` could not authenticate (`could not read Username for 'https://github.com'`), `gh auth status` reported an invalid token, and the GitHub app returned 404 for this private repo; this implementation is therefore based on the clean local `main`/cached `origin/main` at `5bf4a67`.

## 2026-06-11 - Evidence-admission replay corpus and agent-state Arrowsmith v08

- Added `buildEvidenceAdmissionReviewCorpus()` and `serializeEvidenceAdmissionReviewsJsonl()` in `packages/evals/src/evidence-admission.ts` so the external-evidence admission fixture set can be exported as deterministic JSONL instead of living only in memory.
- Committed the canonical replay corpus at `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`.
- Added a drift test in `packages/evals/src/evidence-admission.test.ts` that regenerates the corpus and fails if the checked-in JSONL diverges.
- Reconciled the same-day add/add research conflict and expanded `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md` into the required daily Arrowsmith structure while preserving the replay-corpus closure as canonical implementation evidence.
- Added new bridge evidence from OCELOT trajectory leakage budgets, finite-state vs LLM action-policy drift, production transaction-agent LLM-judge blind spots, SkillAxe skill-document evaluation, MCP spec/roadmap/SEP-2567 re-checks, and human-AI mental-model / ALMANAC collaboration sources.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` so the current frontier is runtime evidence-action binding, ArrowHedge on-disk artifact replay, trajectory release budgets, policy-transition conformance, state-defect recall metrics, live MCP revalidation, skill-document governance, and real-run PM handoff agreement.
- Research-closure reconciliation: remote `origin/main` had already landed the stronger June 10 external-evidence implementation (`bc716c8`), while the local root worktree still held an older uncommitted draft. This run preserved that dirty root unchanged as provenance, used a clean in-repo detached worktree for the code/test closure, and recorded the reconciliation in the June 11 research continuations instead of recommitting a duplicate implementation.
- Verification: `tsc -b packages/evals --verbose`; `vitest run packages/evals/src/evidence-admission.test.ts packages/agent-state/src/external-evidence.test.ts` (41 tests passed).

## 2026-06-10 - Wedding-era retirement: codebase realigned to the rewrite thesis

The repo now matches the canonical objective (`artifacts/pm_substrate_rewrite.md`, "State Coherence Under Partial Observation"): governed agent operational state / PM layer, with ArrowHedgeLabs agents as the validation artifact. The wedding profile and its capabilities are no longer part of the workspace.

- Deleted `packages/{profile-wedding,capability-wedding-budget,capability-wedding-calendar,capability-wedding-contracts,capability-wedding-tasks}` (25 → 20 workspace packages; history preserved in git and ADRs). Kept `profile-agency` + `capability-agency-lead-scoring` as the second-profile / capability-portability proof.
- Ported every wedding-fixture test to the finance-research (ArrowHedge) profile: `entity-mapping/semantic.test`, `graph/validator-wiring.test`, `profile-registry/postgres.test`, `capability-audit/audit.test`, `substrate-http/app.test`, `profile-agency/integration.test` (now finance + agency + raw tenants); cardinality proofs moved from `wedding/has_principal exactly:2` to `finance-research/signal_for_ticker exactly:1`.
- Rewired `substrate-http-demo` to a profile-agnostic bootstrap (no capability hardwired; `domainEventHandlers` documented as the per-deployment hook); pruned wedding deps and tsconfig references across 7 packages; regenerated `pnpm-lock.yaml` (zero wedding refs).
- Swept wedding examples out of substrate JSDoc/comments and neutral test fixture strings (`registry`, `workflow`, `types`, `profile-registry`, `capability-kit`, `substrate-http`); agency package keeps explicit "retired wedding-era" provenance notes; migrations 0002/0009/0010 and ADRs remain untouched as append-only history.
- Rewrote the front-door docs to the rewrite thesis: `README.md`, `docs/architecture.md`, `docs/roadmap.md` (done/now/next/later), `docs/validation.md` (ArrowHedge T1-T8 status table, 12 behavior metrics, falsification modes mapped to the live enforcement tests). Closes research ledger remaining-frontier item 7.
- **Fixed a real substrate bug surfaced by running the full DB suite**: events published inside one transaction share a frozen `now()` for `recorded_at`, and both the publish-time prior-hash lookup and `verifyChain()` tie-broke on random event ids - any multi-event transaction could fork the per-tenant hash chain. Added migration `0019_event_sequence.sql` (monotonic `seq` via sequence, deterministic backfill, `(tenant_id, seq)` index) and switched prior-lookup/verify ordering to `seq` in `@pm/events`.
- Verification: full suite run against a real PostgreSQL 17.5 (embedded, Linux sandbox) with migrations 0001-0019 applied - **387 passed / 0 skipped / 0 failed**, including all previously DB-gated integration suites; `tsc -b` clean across all 20 packages.

## 2026-06-10 - External evidence admission, contract v2 bindings, fixture corpus (research frontier implementation)

Implements the open research implementation frontier (ledger items 1-10, 12-20) plus the stalled v03-v07 watchlist items, as pure tested primitives.

- Added `packages/agent-state/src/external-evidence.ts`: `ExternalStateEvidence` (22 evidence kinds covering MCP handles/tasks/annotations, memory retrieval, monitoring, lineage, audit, attestation, workflow traces, world-model predictions, PM handoffs, external validation, approval records, provider policy, custom stores, subagent outputs, runtime/registry/identity/eval/filesystem/gateway lanes), kind-specific facets (approval-currentness C032, observability-safe memory retention C026, provider policy C023, validation C022/C031, workflow trace C027, PM handoff C030, identity/OBO with provenance-vs-authorization alignment), and pure `reviewExternalStateEvidence()` producing `EvidenceAdmissionReview` with `authorityStatus` always `evidence_only` (C020/C028). Rejection lanes: tenant mismatch, subject mismatch, missing source, future-dated observation. Warning lanes map to `StateReviewInvariantClass` for reuse of the invariant policy matrix.
- Added `toAdmittedStateEvidence()` and `admittedStateEvidenceToObservedReadSetEntry()` so admitted evidence enters the observed read-set comparison lane (C025), and `comparePmHandoffAgreement()` for PM distributed-state agreement metrics (dependency-structure agreement, owner convergence, handoff-condition resolution, valid-next-action overlap; C021/C030).
- Closed the stalled ObservationContract v2 watchlist item (proposed v04): optional `issuer`, `integrityHash`, `holderBinding`, `allowedUse`, `redactionPolicy`, `revocationRef` fields with `computeObservationContractIntegrityHash()`, `verifyObservationContractIntegrity()`, and `validateObservationContractBinding()` wired into `reviewProposedActionAgainstCurrentState()` as `contract_binding` warnings.
- Closed the stalled multi-object precondition watchlist item (proposed v03): `AllowedAction.requiredRelatedRoles` + `ProposedAction.relatedSubjects` with `missing_related_object_role` / `related_object_role_mismatch` read-set issues mapped to `subject_identity`.
- Extended `StateReviewArtifact` metadata backward-compatibly with `runGroupId` (trajectory-level run groups) and `evidenceAdmissions`, including import-shape validation.
- Added `packages/evals/src/evidence-admission.ts`: 18-fixture deterministic admission corpus (clean baseline, MCP handle revalidation, annotation authority claim, memory deletion residue, monitoring wait-condition with premature-action/reaction-time metrics, approval-currentness drift, provider-policy drift, security-review validation, custom-store/subagent evidence, OBO provenance mismatch, workflow stage omission, PM handoff, ServiceNow comparator, Slack/CRM and coding-session comparators, cross-tenant and future-dated rejections), `runEvidenceAdmissionFixtures()`, `analyzeEvidenceAdmissionFixtureResults()` metrics, `groupStateReviewArtifactsByRunGroup()` with propagated-warning detection, and `projectStateReviewArtifactForRole()` role projections (risk_officer / project_manager / auditor) over a stable artifact invariant core.
- Added `buildArrowHedgeCleanCurrentFixtureCase()` to `@pm/capability-finance-research-ingest`: clean accepted/current artifact fixture as the positive metrics baseline (frontier item 4), using the position-free `risk.refresh` action so the review is valid with zero warnings and temporal phase `none`.
- OpenLineage/FHIR/in-toto vocabulary decision (frontier item 7): generic evidence kinds + source URIs (e.g. `openlineage://`, `intoto://`), not adapter-specific mappings.
- Out of scope, unchanged claims: external mutation blocking remains unclaimed; admission is advisory evidence gating only.
- Verification: 38 new tests (28 agent-state external-evidence + PM agreement, 10 evals admission corpus/run-groups/projections, 1 ArrowHedge clean fixture replacing none); full repo suite 279 passed / 143 skipped (pre-existing DB-gated), `pnpm -r typecheck` clean across all packages on Linux (node 22, pnpm 10).

## 2026-06-10 - Daily AI competitive-intelligence v04

- Added `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md` as the fourth numbered daily competitive-intelligence continuation.
- Built on the fetched `main` state at `7cc0a33`, including the upstream `@pm/agent-state` artifact lifecycle closure and the concurrently present Arrowsmith v07 external-evidence frontier.
- Focused the fresh scan on official and primary-source deltas for GitHub Copilot CLI `/security-review`, OpenAI Agent Builder/Evals wind-down, Google Cloud ADK long-running approvals, Workspace Drive alignment approvals and DLP policy APIs, AWS AgentCore registry/OBO/memory/trace/eval runtime lanes, Cursor custom stores/tools/subagents, Asana Agentic Work Management, and Atlassian Teamwork Graph/Rovo.
- Kept the claim boundary strict: external validation, approval state, runtime traces, custom stores, work graphs, and policy APIs are evidence lanes, not replacements for current-state/read-set/source-authority/action-review artifacts.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v04 source changes, claim deltas, threat updates, implementation implications, and a next action around approval-currentness drift.
- Sync note: initial `git fetch origin main` and fast-forward succeeded with repeated `non-monotonic index .git/objects/pack/._pack-...idx` warnings from AppleDouble pack-index files.

## 2026-06-10 - Daily agent-state Arrowsmith v07

- Added `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md` as the seventh numbered daily continuation.
- Confirmed against current code that `ActionProposalReview`, durable `StateReviewArtifact` JSON/JSONL export/import, hash replay, ArrowHedge temporal fixture corpora, artifact-derived metrics, observed read-set comparison, DB/fixture equivalence, continuity payload linkage, and invariant-class `wouldBlock` policy are implemented pure primitives.
- Added fresh June 8-10 bridge evidence from DeLM shared verified context, Workflow-GYM, T1-Bench, ActiveMem, observability-safe memory retention, deployment-time memorization, spatial-memory occlusion, H2HMem, SKILL.nb, ALEM, Emergence World, Consistency Illusion, and official MCP state-handle/tool-annotation sources.
- Added project-management and high-reliability bridges from Faraj/Xiao fast-response coordination, Bigley/Roberts incident command, Endsley situation awareness, Lewis transactive-memory measurement, Hsu et al. IS development TMS, and AHRQ handoff safety.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` so the current implementation frontier is pure external evidence admission: MCP/task/tool handles, memory retrieval/deletion residue, monitoring, lineage, audit, attestation, GUI/professional workflow traces, world-model predictions, and PM handoff artifacts must be admitted before action review can use them.
- Sync note: `git fetch --no-tags origin main` completed and `HEAD`, `origin/main`, and `FETCH_HEAD` all matched `7cc0a33dce5732b556cb323b6cf6dc3d4f80b487`, but Git emitted repeated `non-monotonic index .git/objects/pack/._pack-...idx` warnings from AppleDouble pack-index files.

## 2026-06-09 - Daily AI competitive-intelligence v03 and closure automation

- Added `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md` as the missing third numbered competitive-intelligence continuation.
- Focused the fresh scan on official 2026-06-08 to 2026-06-09 releases: GitHub third-party coding-agent security validation, Claude Fable 5 in GitHub Copilot, Anthropic Fable/Mythos availability, OpenAI Codex enterprise adoption evidence, Google Gemini Apple/Xcode integration, and AWS AgentCore runtime/eval carry-forward docs.
- Kept the claim boundary strict: third-party agent validation, provider/model policy, client surfaces, and runtime traces are evidence lanes, not replacements for pm-substrate current-state/read-set/source-authority/action-review artifacts.
- Added a dated implementation/test task tree for external validation evidence admission, model/provider policy evidence, client-surface origin tracking, runtime trace comparison, and daily publish closure.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v03 source changes, claim deltas, implementation implications, and the current task tree.
- Installed the local Codex automation `pm-substrate-daily-research-publish-closure`, scheduled daily at 8:45 AM local time, to verify/fetch main, inspect uncommitted work, reconcile daily research, create the task tree, validate, commit, push, and re-check remote SHA.
- Repo transport note: a stale `git push --porcelain origin` process in this repo was blocking remote operations; after terminating it, `git ls-remote --heads origin main` verified remote `main` at `81d67a1cbfc7a00dcfd42c56c9249ca044f40278`, but full `git fetch --prune origin main` still hung and was terminated.

## 2026-06-09 - Daily agent-state Arrowsmith v06

- Added `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md` as the sixth numbered daily continuation, building directly from v05 and the same-day implementation commits on `main`.
- Audited the v05 watchlist against current code and corrected stale claims: durable `StateReviewArtifact` JSON/JSONL export/import, eval refs, observed read-set comparison, temporal misalignment fixtures, DB/fixture equivalence helpers, and invariant-class policy now exist as pure primitives.
- Shifted the active research frontier to external evidence admission: MCP/tool/task state, memory search, world-model predictions, monitoring events, lineage records, audit events, attestations, and PM handoff artifacts should be admitted as evidence before they influence valid action.
- Added new bridge evidence from text world models, SentinelBench, memory-search security, Agent libOS, AuthGraph, evidence tracing/provenance, AgentAtlas, VerifyMAS, MCP official docs, OpenLineage, FHIR Provenance/AuditEvent, in-toto/SLSA, human-AI situation awareness, shared mental-model measurement, boundary objects, and coordination theory.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with v06 source changes, corrected/downgraded claims, implementation implications, metrics, and the next watchlist.
- Sync note: `git fetch origin main` and `git fetch --no-tags origin main` both failed with `fatal: mmap failed: Operation timed out`, but `git ls-remote origin refs/heads/main`, local `HEAD`, and local `origin/main` all matched `81d67a1cbfc7a00dcfd42c56c9249ca044f40278`, so no upstream merge delta or conflict was present before this research write.

## 2026-06-08 - Invariant-class policy matrix

- Added a pure `StateReviewInvariantClass` policy matrix in `@pm/agent-state` with explicit low/medium/high action consequences and advisory-vs-blocking recommendations.
- Kept `reviewProposedActionAgainstCurrentState()` default behavior advisory-only; policy evaluation is separate and reports `wouldBlock` recommendations without enforcing external mutations.
- Added eval artifact metrics for `policyWouldBlockArtifacts` and `wouldBlockByInvariantClass`, defaulting analysis to high-consequence policy while supporting explicit consequence and matrix inputs.
- Verification: TDD red pass failed on the missing policy evaluator and metric fields; green pass completed with focused agent-state/evals vitest coverage and both package typechecks.

## 2026-06-08 - ArrowHedge temporal fixture expansion

- Added deterministic ArrowHedge state-review artifact fixture cases for `observation_to_action`, `action_to_feedback`, and `feedback_to_observation`, each with distinct scenario ids, fixture metadata, eval ids, warning shapes, and invariant classes.
- Expanded ArrowHedge corpus and equivalence coverage so replayable JSONL, import validity, continuity payloads, warning codes, temporal phases, and invariant classes are checked across all three temporal misalignment phases.
- Added eval artifact phase coverage metrics with required, covered, missing, and coverage-rate fields while preserving the existing `artifactsByTemporalMisalignmentPhase` bucket counts.
- Verification: TDD red pass failed on the missing ArrowHedge fixture builder and missing metric coverage field; green pass completed with focused ArrowHedge/eval vitest coverage and both package typechecks.

## 2026-06-08 - Observed read-set capture

- Added pure observed-read-set comparison in `@pm/agent-state` so declared proposal read sets can be checked against tool/source reads without DB or runtime mutation enforcement.
- Warn-mode comparison now reports observed-but-undeclared refs, declared-but-unobserved refs, stale observed reads, authority mismatch, projection-version drift, and workflow-position drift.
- Threaded optional observed read-set samples and comparison output into `StateReviewArtifact` metadata while keeping v1 artifact imports backward-compatible when those fields are absent.
- Verification: red/green focused TDD pass on `packages/agent-state/src/index.test.ts`, plus `@pm/agent-state` typecheck.

## 2026-06-08 - ArrowHedge DB/fixture artifact equivalence

- Added an executable ArrowHedge `StateReviewArtifact` equivalence helper that compares canonical JSONL, import/replay hash validity, continuity ids/hashes, warning codes, temporal phase, and invariant classes across fixture and projected COP state.
- Added fixture-only coverage that runs without DB credentials, plus DB-gated integration coverage that compares the DB projection state against an in-memory fold when `PM_DATABASE_URL` is available.

## 2026-06-08 - StateReviewArtifact import hardening

- Hardened `StateReviewArtifact` import validation so malformed nested metadata, assertion, and warning shapes are rejected even when the canonical artifact hash is recomputed and replay hash validation passes.
- Scoped ArrowHedge `state_review_artifact` eval refs to their matching scenario instead of attaching artifact evidence to every substrate event in the suite.
- Review gates: fresh spec-compliance and code-quality subagents approved the Task A diff after focused verification.
- Verification: `pnpm vitest run packages/agent-state/src/index.test.ts packages/evals/src/arrowhedge.test.ts`, `pnpm -r --filter @pm/agent-state --filter @pm/evals run typecheck`, and `git diff --check`.

## 2026-06-08 - Superpowers plan stash repair

- Investigated `stash@{0}` and confirmed it contained only a deletion of the newer `docs/superpowers/plans/2026-05-27-three-axis-state-validation.md` plan, so applying it directly would lose the better copy.
- Canonicalized the plan as `docs/superpowers/plans/2026-05-27-three-axis-state-validation-pm-substrate.md`, removed the stale root-level duplicate, and added `docs/superpowers/plans/index.md`.

## 2026-06-08 - Durable StateReviewArtifact lifecycle

- Added canonical `StateReviewArtifact` metadata for temporal-misalignment phase, invariant class, scenario/fixture id, client surface, provider, session, workflow, and eval-event linkage.
- Added pure artifact persistence helpers in `@pm/agent-state`: deterministic JSON serialization, JSONL corpus export/import, replay hash verification, tamper reporting, and evidence-linked continuity payload generation from artifact id/hash.
- Added ArrowHedge state-review artifact corpus generation that emits replayable JSONL and continuity payloads from real proposal-review cases.
- Added `state_review_artifact` as a first-class eval reference kind, ArrowHedge eval substrate refs for artifact ids, and artifact-derived eval metrics for assertions, proposal reviews, hashes, temporal phases, and invariant classes.
- Verification: focused lifecycle suite passed across `@pm/agent-state`, ArrowHedge, and `@pm/evals`: 5 files / 47 tests.

## 2026-06-08 - Daily AI competitive-intelligence v02 reconciliation

- Resolved a same-day merge conflict after `origin/main` added `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` while a local competitive-intelligence run was active.
- Preserved upstream v01 unchanged and added the local broader vendor scan as `research/daily-ai-competitive-intelligence/v02-ai-competitive-intelligence-2026-06-08.md`.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with the reconciliation, expanded watchlist, implementation implications, and next sequential continuation point.

## 2026-06-08 - Daily AI competitive-intelligence v01

- Added `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` as the first numbered competitive-intelligence continuation for `pm-substrate`.
- Reconciled the new upstream daily Arrowsmith v05 research before writing, preserving the current frontier: pure state-review primitives exist, while persisted/exported artifacts, artifact-to-eval linkage, observed read sets, temporal-phase fixtures, and targeted policy remain open.
- Compared fresh official-source changes from OpenAI, Anthropic, Microsoft/GitHub, Google, AWS, and ServiceNow against the operational-state thesis.
- Marked OpenAI/GitHub/Microsoft/Google/AWS as active Medium to Medium-high control-plane and context/runtime threats, while keeping ServiceNow as the highest direct overlap baseline because its Action Fabric/Context Engine/AI Control Tower positioning most closely matches governed enterprise action.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v01 deltas, downgraded claims, implementation implications, and next-day watchlist items.

## 2026-06-08 - Daily agent-state Arrowsmith v05

- Added `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md` as the fifth numbered daily continuation, building on v04 rather than restarting the agent-state thesis.
- Audited the current repo and kept the active code frontier unchanged: pure `StateReviewArtifact`, ArrowHedge artifact construction, hash replay, and artifact metrics exist, while persisted/exported JSON artifacts, artifact-to-eval-event linkage, observed read sets, DB/fixture equivalence, and invariant-class policy remain open.
- Added recent bridge evidence from AdaPlanBench, TIDE temporal state misalignment, LOCOMO-CONV, H-CSC, TRACE, DuMate-DeepResearch, Tree-of-Experience, OPENPATH, and encrypted multi-agent control.
- Added foundational mechanisms from Chandy-Lamport snapshots, optimistic concurrency control, sagas, transactive memory, expertise coordination, organizational coordination, and common operational picture/common situational understanding research.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` so the next code slice is deterministic ArrowHedge JSON state-review artifacts with temporal-misalignment fixture metadata before any mutation-blocking claim.

## 2026-06-07 — Research ledger and automation sync protocol

- Fetched and fast-forwarded from `origin/main` before continuing local research updates, bringing in the latest state-review artifact implementation and canonical 2026-06-06 v03 research.
- Reconciled the local daily Arrowsmith v04 research with the fetched `main` state: `StateReviewArtifact` is now treated as an implemented pure primitive, while generated JSON/JSONL artifacts, replay, DB/fixture equivalence, and policy integration remain the next proof boundary.
- Added `research/index.md` as the top-level research ledger across daily research streams, including run protocol, claim ledger, current implementation frontier, and ledger entries.
- Resolved the daily Arrowsmith index conflict by preserving the remote canonical v03 and v04, preserving the unsynced local v03 as a superseded local branch artifact, and moving synchronization requirements into the indexes and top-level ledger.
- Updated the daily research direction so automations must fetch/pull `main`, inspect new research/code, update the chain-specific index and top-level ledger, then commit and push back to `main`.

## 2026-06-05 — Daily agent-state Arrowsmith v03

- Added `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-05.md` as the third numbered daily continuation, building on v02 rather than restarting the agent-state thesis.
- Added new 24-72 hour bridges from CollabSim, ALMANAC, MAGE, MemGate, PACT, WebMCP tool-surface poisoning, HarnessFix, ToolMaze, TRIAD, and the self-correction role-label paper.
- Strengthened the implementation direction around replayable JSON state-review artifacts: `currentStateView`, original `observationContract`, assertion evaluation, read-set validation, `ActionProposalReview`, warning policy, source refs, fixture id, and eval maturity.
- Downgraded semantic-similarity memory, protocolized agent communication, tool metadata, and guardrail feedback as authority unless bound to substrate refs, freshness, source authority, lifecycle, and deterministic validation.
- Updated `research/daily-arrowsmith-agent-state/index.md` with the v03 version row, source changes, corrected claims, downgraded claims, metrics queue, and next-day implementation watchlist.

## 2026-06-02 — Codebase review and workspace/agent-state research kickoff

- Reviewed the pm-substrate architecture, validation framework, three-axis state-validation plan, state-failure taxonomy, agent-continuity ADRs, continuity/eval packages, workflow gates, event provenance, graph staleness helpers, and the existing external landscape research draft.
- Verified the codebase is a real substrate implementation rather than only thesis material: graph/events/registry/workflow/projections/profile/capability/continuity/eval packages compile and run against local Postgres.
- Installed dependencies, built the monorepo, started local Postgres, applied 16 migrations, seeded `tenant_dev`, and ran the full DB-backed suite: 43 test files and 320 tests passed.
- Noted review findings for the next work slice: clean-clone `pnpm test` fails until `pnpm build` creates package entry outputs; local tests skip most integration proof without `PM_DATABASE_URL`; continuity contradiction detection is intentionally simple and must evolve before it can prove robust authority-aware agent memory; the next decisive research step is paired baseline/substrate evals against stateful external benchmarks such as STATE-Bench.
- Started independent external verification of the workspace and agent-state problem space. Current source direction supports the substrate thesis: multi-agent failures are increasingly framed as coordination/state failures, memory benchmarks emphasize behavior under changing state, blackboard-style shared state is reappearing in LLM MAS research, and Palantir Ontology validates the enterprise shared-world-model pattern while leaving room for a lighter open/profile-driven substrate.

## 2026-06-02 — Local-lab paired evals and Arrowsmith bridge

- Added deterministic local-lab paired evals in `@pm/evals`: stale memory after source update, wrong source authority conflict, and invalid workflow step after plan mutation.
- Mapped the local-lab scenarios to STATE-Bench-style categories: `stateful`, `user_experience`, and `procedural_execution`, with separate memory-benchmark bridge labels for `knowledge_update`, `abstention`, and workflow rebase behavior.
- Added `db/migrations/0017_eval_events.sql` so `evals.eval_events` is created by the root migration runner instead of only package-local SQL.
- Added `pnpm evals:local-lab`, which emits paired baseline/substrate eval events and persists them when `PM_DATABASE_URL` is set.
- Ran the local-lab eval suite against Postgres after applying migration `0017`: 3 scenarios, 6 events, baseline failures 3, substrate failures 0, failure reduction 3, and 6 persisted `local_lab` eval rows.
- Added `research/local-lab-state-bench-arrowsmith_2026-06-02.md`, connecting the first local-lab eval categories to current peer-reviewed/venue-accepted memory-agent and MAS evaluation work.

## 2026-06-03 — First-principles agent-state and interoperability research

- Added `research/first-principles-agent-state-interoperability_2026-06-03.md`.
- Connected pm-substrate to first-principles state literature: partial observability/POMDPs, belief-state discipline, memory-agent benchmark competencies, multi-agent failure attribution, semantic interoperability, object-centric event logs, shared mental models, transactive memory, and project-success communication research.
- Clarified the strongest thesis wording: pm-substrate is an agentic operational-state substrate under partial observability, not merely an AI memory layer.
- Identified the next proof gaps: structured taxonomy fields on eval events, complete tool-onboarding adapter proof, shared-state dashboard scenario, attribution benchmark, and explicit MCP/A2A protocol positioning.

## 2026-06-03 — Cross-disciplinary state and interoperability research

- Added `research/cross-disciplinary-state-interoperability-arrowsmith_2026-06-03.md`.
- Compared pm-substrate's state/interoperability problem against control theory, robotics/SLAM, data assimilation, power systems, distributed consensus, CRDTs, Internet routing, software observability, healthcare, industrial automation, supply chain, cybersecurity, emergency response, aviation, systems engineering, biology, social insects, and swarm behavior.
- Extracted the shared solution pattern across mature disciplines: observations, current state or estimate, semantic contracts, authority policy, and feedback/reconciliation loops.
- Ranked the most transferable mechanisms for pm-substrate: estimator-style projection metadata, profile-driven adapters, CRDT-vs-gate event classification, trace-context capability attribution, common-operating-picture project surfaces, quorum gates, and substrate-as-environment coordination.

## 2026-06-03 — Eval taxonomy and coordination-class implementation

- Promoted local-lab benchmark labels from prose notes into structured `EvalEvent` fields: `stateBenchCategory`, `memoryBenchmarkBridge`, `mastCategory`, and `coordinationClass`.
- Added the first executable cross-disciplinary implementation hook from the research: coordination classes for append-only observations, convergent updates, authority-gated transitions, and derived projections.
- Persisted the new eval taxonomy fields as queryable columns via `db/migrations/0018_eval_event_taxonomy.sql` and the package-local eval migration.
- Updated local-lab paired evals and docs so future adapter, trace-attribution, CRDT-vs-gate, and common-operating-picture experiments can measure against structured metadata rather than notes parsing.
- Added `analyzeEvalEvents()` in `@pm/evals` to compute paired failure reduction, incomplete paired groups, taxonomy coverage, coordination-class outcomes, authority-gate pass rate, and convergent-update auto-resolution rate from emitted eval events.
- Wired `runLocalLabPairedEvals()` and `pnpm evals:local-lab` through the analyzer so the local-lab harness now reports executable coordination metrics, not just scenario counts.

## 2026-06-03 — Adapter state-proof implementation checkpoint

- Began the Real Tool Onboarding + Operational State Proof phase as code: `source rows → mapping validation → deterministic graph node inputs → typed adapter events`.
- Added `planEntityIngestion()` in `@pm/entity-mapping`, keeping the package dependency-light by structurally mirroring event-publish input instead of importing the event store.
- Made ingestion plans atomic: invalid profile mappings, unknown source entities, or missing deterministic entity IDs return validation issues and zero planned writes.
- Added focused TDD coverage for graph-ready node planning, typed `adapter.entity_mapped` event payloads, `idForRecord` deterministic ID generation, and missing-ID rejection.
- Review checkpoint: the planner preserves the existing hot-path rule that `applyMapping()` itself does not revalidate per row, while giving onboarding harnesses a single validated plan boundary before writes.
- Added a DB-backed adapter state-proof test for the agency profile: a validated mapping plan creates graph nodes and publishes `adapter.entity_mapped` events inside one Postgres transaction, verifies the event hash chain, and catches up a projection into shared adapter state.
- Research/review checkpoint: the executable proof now matches the cross-disciplinary pattern from the Arrowsmith pass — semantic contract, deterministic observation, append-only provenance, and derived projection — but still needs eval-event measurement so representation-loss claims are quantified.
- Added failure-class buckets to `analyzeEvalEvents()` so paired evals now report reductions for classes like `representation_loss`, not only global failure reduction or coordination-class metrics.
- Added `buildAdapterStateProofEvalPair()` in `@pm/evals` to emit a marketing-axis paired baseline/substrate eval for source-to-projection onboarding.
- Wired the DB-backed adapter state-proof test through the eval helper: the same graph nodes, adapter events, and projection name become substrate refs, and the analyzer verifies a `representation_loss` failure reduction of 1 for the adapter proof.

## 2026-06-03 — ArrowHedge adapter and Common Operating Picture phase

- Corrected the prior scope gap: the agency adapter proof was only the first spine, not the full ArrowHedge/high-consequence phase.
- Added the ArrowHedge finance adapter surface in `@pm/capability-finance-research-ingest`: strict source snapshot parsing, deterministic source-record IDs, finance-research entity mapping, semantic profile validation, graph edge planning, typed finance events, and an executor port that can create or update graph nodes, create edges, and publish events in one caller-managed transaction.
- Added the first ArrowHedge Common Operating Picture projection: typed finance events fold into per-ticker signal, risk, decision, authority-gate, stale-block, and state-disagreement state.
- Added ArrowHedge paired eval scenarios for `representation_loss`, `source_authority_conflict`, `stale_observation`, `workflow_invalidation`, and `capability_contract_violation`. The contract-violation substrate arm intentionally remains a measured failure until runtime payload JSON-schema validation is implemented at this boundary.
- Added adapter operational metrics in `@pm/evals`: `adapterTimeToFirstValidEventMs`, `mappingRejectionRate`, `stateDisagreementRate`, and authority-gated pass/fail counts/rate derived from eval events.
- Review checkpoint: the first implementation attempted a direct production import of `@pm/profile-finance-research` from the capability package. The registry isolation guard correctly rejected it, so the adapter now injects `ProfileDefinition` through the plan context and keeps the concrete profile import in tests only.
- Fixed the entity-mapping structural validator to accept lowercase hyphenated profile prefixes in edge types, matching the existing `finance-research` profile while preserving snake_case local edge names.
- Verification: focused ArrowHedge/entity-mapping/eval tests pass, root build passes, and non-DB `pnpm test` passes with 27 files / 196 tests and 143 Postgres-dependent tests skipped. DB-backed ArrowHedge COP proof exists but live execution is blocked in this shell because Docker/Postgres is not running (`Cannot connect to the Docker daemon`).

## 2026-06-03 — ArrowHedge runtime contract closure

- Closed the measured `capability_contract_violation` debt with executable payload-schema validation inside `@pm/capability-finance-research-ingest`, loading the package's existing `schemas/*.json` files as the runtime contract source.
- Filled ArrowHedge typed finance events with the canonical capability IDs their schemas require: `researchRunId`, `tickerId`, `decisionId`, `riskStateId`, `blockedEntityId`, and evidence document IDs where applicable, while preserving projection-facing adapter fields.
- Added a defensive executor gate so malformed typed finance payloads are rejected before graph/event writes are attempted, even if a caller mutates a valid plan.
- Updated the ArrowHedge eval suite so the contract-violation substrate arm now passes because runtime validation rejects malformed payloads before publication.
- Verification: focused ArrowHedge/eval tests pass, registry-isolation/metrics/ArrowHedge slice passes, root build passes, compiled package import passes, and non-DB `pnpm test` passes with 27 files / 198 tests and 143 Postgres-dependent tests skipped. DB-backed ArrowHedge COP proof remains blocked in this shell because `pnpm db:up` cannot connect to the local Docker daemon.

## 2026-06-04 — Agent-from-numbers first-principles research

- Added `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`, decomposing an LLM agent from numbers, random variables, statistical learning, model weights, transformer inference, context, memory, tools, and agent loops up to multi-actor operational state.
- Identified the main state-origin finding: model weights are parametric state, prompts are transient inference state, memories are retrieval state, and the agent-state problem begins when any of those are treated as current, sufficient, authoritative operational state for action.
- Extended the Arrowsmith bridge set with statistical learning, POMDPs, Kalman/state estimation, RAG, ReAct, generative-agent memory, QuBE belief-state construction, memory-agent benchmarks, stale-memory benchmarks, and multi-agent failure taxonomies.
- Proposed falsifiable follow-up hypotheses around distribution-currentness mismatch, prompt-context-vs-belief-state tests, evidence-linked continuity, read-set validation, and Common Operating Picture reconciliation.
- Verification: `git diff --check` passed; document review confirmed the new research file is present and the worktree contains only the research note plus this changelog entry.

## 2026-06-05 — Daily agent-state Arrowsmith v01

- Added `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` as the first numbered daily continuation from the June 4 first-principles note.
- Added `research/daily-arrowsmith-agent-state/index.md` so future daily runs can continue from a single version index instead of restarting from unnumbered research files.
- Strengthened the substrate thesis with new 2026 bridges: STALE implicit memory invalidation, useful-memory consolidation regression, ContractBench observation contracts, STATE-Bench/Claw-Eval-Live stateful workflow grading, and PM shared-cognition/transactive-memory implications.
- Downgraded RAG-only, bigger-context, continuous-memory-rewrite, protocol-only, and chat-as-COP claims where sources do not support operational authority.
- Proposed the next measurable implementation spine: `current_state_view`, `observation_contract`, read-set validation, raw-episode preservation, and state/assertion-based eval metrics.

## 2026-06-05 — Agent-state current view and read-set implementation

- Added the pure `@pm/agent-state` package with reusable `CurrentStateView`, `StateRef`, `ProposedAction`, `ReadSetEntry`, warn-first `ReadSetValidationDecision`, and evidence-linked continuity payload contracts.
- Implemented deterministic read-set construction and warn-first validation for stale reads, missing required refs, authority drift, projection-version drift, workflow-position mismatch, tenant mismatch, action mismatch, and current-view conflicts.
- Extended ArrowHedge COP state so ticker projections retain source event IDs, graph entity IDs, evidence document refs, authorities, observation timestamps, risk freshness, and decision snapshot provenance.
- Added ArrowHedge `current_state_view` builders for ticker COP state, including source refs, risk freshness `validUntil`, authority rule, workflow position, conflict list, and action contracts for `portfolio.decision.accept`, `workflow.block`, and `risk.refresh`.
- Added the distribution-currentness mismatch eval path under `stale_observation`; the substrate arm now passes only when warn-first read-set validation emits the required warning before action, with no v1 mutation-blocking claim.
- Added the evidence-linked continuity payload convention test showing checkpoints can cite `sourceRefs`, `validUntil`, `supersedes`, `contradictedBy`, `authorityRule`, and `currentStateViewId` without changing continuity storage.
- Verification: focused tests pass for `@pm/agent-state`, ArrowHedge COP/current-state views, ArrowHedge evals, and continuity payload convention: 4 files / 15 tests.

## 2026-06-05 — Observation contracts and state assertion metrics

- Extended `@pm/agent-state` with `ObservationContract`, `StateAssertion`, and pure helpers to derive an observation contract from a `CurrentStateView` and evaluate it later against current state.
- Added assertion outcomes for required source refs, authority rule, freshness window, projection version, workflow position, declared conflicts, and declared missing sources.
- Added ArrowHedge observation reports: COP ticker state can now produce `currentStateView`, `observationContract`, and assertion `evaluation` in one typed report.
- Added `analyzeStateAssertions()` in `@pm/evals` so assertion output becomes measurable by total/pass/fail count, pass rate, and failed buckets by assertion code and severity.
- Verification: focused continuation tests pass for agent-state observation contracts, ArrowHedge observation reports, and eval assertion metrics: 3 files / 19 tests.

## 2026-06-05 — Action proposal review artifact

- Added `ActionProposalReview` in `@pm/agent-state`, combining the proposed action, current-state view, observation contract evaluation, read-set validation, normalized warnings, and explicit warn-first execution disposition.
- Added `reviewProposedActionAgainstCurrentState()` so action proposals can be reviewed through one pure pre-execution boundary while preserving the v1 rule that warnings do not block execution.
- Added `buildArrowHedgeProposalReview()` so ArrowHedge COP ticker state can produce a proposal-review artifact directly from a portfolio action proposal.
- Added `analyzeActionProposalReviews()` in `@pm/evals` to measure review validity, allowed/blocking disposition, warning count, and warnings by source, code, and severity.
- Verification: focused tests pass for action proposal reviews, ArrowHedge proposal-review generation, and proposal-review metrics: 3 files / 23 tests.

## 2026-06-05 — Proposal review hardening and proof maturity labels

- Added `subject_mismatch` read-set validation so an action cannot cite one current-state read-set while targeting another subject.
- Made proposal review explicitly advisory by default with `enforcementMode: "advisory"` and support for a future `"blocking"` mode, preserving warn-first v1 without implying mutation enforcement.
- Fixed the observation-contract tautology in the proposal-review path: callers can now pass the agent's original observation contract/read-set, and review compares that prior observation against the current state view.
- Added ArrowHedge `evaluatedAt`/as-of current-state evaluation so risk freshness, conflicts, and workflow position are computed at proposal time rather than only at latest event time.
- Added eval evidence maturity stages (`scaffolded_scenario`, `detected_warning`, `blocked_mutation`, `paired_behavioral_improvement`) and evidence-adjusted failure-reduction metrics so scaffolded/pass-by-spec scenarios remain visible without being counted as behavioral proof.
- Verification: focused agent-state, ArrowHedge, and eval tests pass after rebuilding package outputs; sequential package build and `git diff --check` pass. DB-backed integration execution remains an environment boundary when local Postgres is unavailable.

## 2026-06-06 — Daily agent-state Arrowsmith v03

- Added `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` as the third numbered daily continuation.
- Audited v02 against the current repo and downgraded several v02 TODOs from open implementation gaps to closed pure primitives: `subject_mismatch`, original-observation proposal review, `evaluatedAt`, explicit advisory/blocking mode, and evidence maturity stages.
- Shifted the next research frontier to durable state-review artifacts: provenance/event envelopes, trace correlation, object-centric refs, artifact replay, benchmark audit, and invariant-class policy gating.
- Added project-management bridges from socio-technical congruence, transactive memory, ISO 21502, Team Situation Awareness, and human-AI mental-model work, with explicit limits on what each source proves.
- Updated `research/daily-arrowsmith-agent-state/index.md` with v03, corrected stale claims, new source changes, implementation implications, metrics, and the next-day watchlist.
- Verification: required-section scan and `git diff --check` pass. No code tests were run because this slice only changes research/changelog Markdown.

## 2026-06-06 — Research-to-runtime state-review artifacts

- Reviewed the full `research/` corpus for findings that required code, not documentation, and identified the active runtime gap: proposal reviews existed only as in-memory objects, while the newest Arrowsmith findings require durable, replayable, provenance-linked state-review artifacts.
- Added `StateReviewArtifact` logic in `@pm/agent-state`: deterministic artifact envelopes, trace context, related object roles, PROV-style links, canonical artifact fingerprinting, and replay hash verification around existing `ActionProposalReview` output.
- Added ArrowHedge `buildArrowHedgeStateReviewArtifact()` so finance COP proposal reviews can emit the artifact directly with ticker provenance and source-specific event metadata.
- Added eval metrics for state-review artifacts: hash verification rate, trace-link coverage, object-role coverage, warning buckets, advisory/blocking counts, and artifact source/type counts.
- Added focused tests for artifact construction, tamper detection, ArrowHedge artifact generation, and artifact metric summaries.
- Verification: `git diff --check` passes. TypeScript/Vitest runners in this shell hang even on unchanged packages and version/module-load checks, so compile/test execution is recorded as environment-blocked rather than passed.

## 2026-06-07 - Daily agent-state Arrowsmith v04

- Added `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` as the fourth numbered daily continuation.
- Audited v03 against the current runtime code and downgraded artifact-shape TODOs from open research work to closed pure primitives: `StateReviewArtifact`, ArrowHedge artifact generation, canonical hash replay verification, related object roles, trace context, PROV-style links, and artifact metrics now exist.
- Shifted the active research frontier to artifact lifecycle and policy use: persisted/exported JSON artifacts, schema validation, artifact-derived eval events, continuity lineage, observed read-set capture, observation-contract integrity/binding fields, and targeted invariant-class blocking.
- Added new bridge evidence from S-Bus source/formals/benchmark artifacts, Claw-Eval-Live released task/fixture/grader/trace architecture, Silo-Bench coordination-reasoning metrics, the June 2026 agent provenance survey, HTTP/OAuth standards, coordination-requirement scalability, and team situation-awareness measurement.
- Updated `research/daily-arrowsmith-agent-state/index.md` with v04, source changes, corrected stale claims, new metrics, current implementation implications, next-day watchlist, and the fetch/reconcile/push collaboration protocol for future daily runs.

## 2026-06-07 - Daily AI competitive-intelligence automation

- Installed the local Codex automation config for `daily-ai-competitive-intelligence`, scheduled daily at 7:30 AM America/Chicago against `/Users/emmanuelakinwale/Desktop/pm-substrate`.
- Reconciled the newly fetched research-ledger commit from `origin/main`, which already created `research/daily-ai-competitive-intelligence/index.md` and `research/index.md`, rather than starting a duplicate research stream.
- Updated the competitive-intelligence index and top-level research ledger to record that the stream has a local automation config installed and that the first versioned run remains pending.
