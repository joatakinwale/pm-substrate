# v160 - Operational State History Root Settlement Records

Date: 2026-06-27
Question closed: SQ107

## Research Question

What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin et al., "HotStuff: BFT Consensus with Linearity and Responsiveness", PODC 2019: https://dl.acm.org/doi/pdf/10.1145/3293611.3331591
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Naylor et al., "Quantitative Verification of Certificate Transparency Gossip Protocols", 2020: https://www.prismmodelchecker.org/papers/spc20.pdf

## Mechanism Extracted

PBFT and HotStuff supply the quorum-certificate/finality bridge: a value is not operationally decided because one replica or witness saw it; it is decided when a quorum certificate binds enough votes to that exact value under a known authority boundary. CONIKS and certificate-transparency gossip supply the transparency bridge: signed roots and consistency proofs let clients detect split views, but individual signed observations are still monitor evidence, not final settlement.

The substrate adaptation is a history-root settlement record. v150 made root observations accountable through observer signatures, but one signed observer could still define currentness for strict recovery. v160 adds an append-only settlement ledger whose records bind the exact root commitment hash, store id, root sequence, authority scope, and a quorum certificate. Recovery transparency can now require a lane root to be both witnessed by signed transparency replay and settled by replayed quorum history before the root can bless recovered operational state.

## Existing Substrate Map

- `OperationalStateHistoryRoot` and root observations detect split histories and unproven advances across stores.
- `OperationalStateHistoryRootObserverSignatureProof` makes each accepted observation attributable to a replay-current observer signature.
- `OperationalStateQuorumCertificateProofCertificate` already provides a reusable certificate envelope with subject identity, sequence, hash, witness threshold, and authority boundary.
- Recovery-cut transparency already checks required lane `storeRootHash` values against latest witnessed roots.

## Missing Substrate Map

- Before v160, a single signed observer could bless a store root for strict recovery if no other signed observation contradicted it.
- Signed-observer replay established accountability, not quorum finality or settlement.
- Root transparency replay accepted latest roots, but did not distinguish observed roots from settled roots.
- Existing quorum-certified admissions covered proof records, checkpoints, finalizer proofs, and recovery-cut admission witnesses, but not generic history roots.
- Still missing after v160: the signer/quorum authority topology for history-root settlement records, runtime settlement-store adoption, settlement-record compaction, cross-agent settlement gossip, and a policy for defaulting strict recovery to settlement-required mode.

## Primitive Proposal

Name: operational state history root settlement record.

Problem it solves: prevents a single signed root observer from unilaterally making a history root sufficient to authorize recovered operational state.

Research source: PBFT quorum commit, HotStuff quorum certificates, CONIKS transparency monitoring, and certificate-transparency gossip verification.

Mechanism borrowed: a root becomes settled only when a quorum certificate certifies the exact root commitment hash under a replayable settlement history.

Why current substrate lacked it: v150 proved observer authenticity but left root currentness as latest signed observation rather than a quorum-settled fact.

Why existing primitives are insufficient: signed observations prove who saw a root; consistency proofs prove append-only advancement; neither proves enough authorized witnesses agreed that this exact root is the admissible recovery root.

State guarantee it should create: strict recovery transparency can authorize a store-root lane only when the lane's latest witnessed root also appears in replay-valid root settlement history.

Admission rule it requires: settlement records must bind tenant, settlement store id, authority scope, settlement sequence, store id/kind, root sequence/hash/commitment, embedded root, quorum settlement certificate, previous settlement hash, and settlement metadata.

Replay rule it requires: replay must check settlement sequence continuity, previous-record hashes, same-sequence forks, same-store/root-sequence root-commitment forks, embedded root commitment validity, certificate validity, certified status, quorum threshold, certificate subject kind/id/sequence/hash, required authority boundary, and required root settlement.

Authority boundary it requires: settlement certificates must use a history-root settlement boundary, not connector-local caches, individual observer signatures, or generic transparency observation authority.

Failure modes it should prevent: one-observer root currentness, stale settled roots blessing newer recovery lanes, wrong-boundary settlement certificates, tampered settlement rows, conflicting settled roots for the same store sequence, and private worktree roots outranking settled history.

Minimal implementation slice: add history-root settlement record types, deterministic hashes, replay/evaluation functions, action-review enforcement, append-only migration, and tests for valid settlement, missing settlement, stale settlement, wrong-boundary certificate, and tampered settlement rows.

Tests that would falsify it: strict recovery passes with signed observations but no settlement replay; a stale settlement authorizes a newer lane root; a wrong-boundary certificate settles a root; a tampered settlement row remains valid; two different roots for the same store sequence both settle without obstruction; a valid settled root is rejected.

Axis surfaces that could later validate it: Axis C amnesiac recovery with one signed but unsettled root, Axis A finance recovery after connector/worktree divergence, and Axis B/domain adapters attempting to use one monitor's signed root as final currentness.

## Falsification Criteria

- A signed transparency replay plus replay-valid settlement record over the exact latest root commitment must pass strict recovery transparency with root settlement required.
- Missing settlement replay under `requireRecoveryTransparencyRootSettlement` must block action review with `operational_state_recovery_transparency_root_settlement_replay_missing`.
- A stale settlement replay that does not include the lane's latest root must produce `operational_state_recovery_transparency_lane_root_unsettled`.
- A wrong-boundary settlement certificate must produce `operational_state_transparency_root_settlement_certificate_authority_boundary_mismatch`.
- A tampered settlement record must produce `operational_state_transparency_root_settlement_record_hash_mismatch`.
- A settlement certificate whose subject hash differs from the root commitment must produce `operational_state_transparency_root_settlement_certificate_subject_mismatch`.

## Active 10-Question Backlog

1. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
2. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
3. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
4. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
5. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
6. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored certificate-bearing rows?
7. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
8. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored certificate-bearing rows?
9. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a signed root observation is sufficient to bless a recovery root.
- Falsified: transparency replay currentness and settlement finality are the same substrate state.
- Still open: v160 supplies the settlement-record primitive, replay/evaluation rule, action-review gate, and durable table shape, but the settlement authority topology, live settlement-store adoption, settlement-store head transparency, and settlement compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateHistoryRootSettlementRecord`, deterministic settlement hashing, verification helpers, and `replayOperationalStateHistoryRootSettlementRecords()`.
- `evaluateOperationalStateRecoveryCutTransparency({ requireRootSettlement: true })` and blocking action-review option `requireRecoveryTransparencyRootSettlement`.
- Migration `0077_agent_state_history_root_settlement_records.sql` with append-only durable settlement rows and public DML revocation for root settlement/signature-proof rows.
- Tests for valid signed-and-settled recovery roots, missing settlement replay refusal, wrong-boundary settlement refusal, stale settlement refusal, and tampered settlement refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (150 passed)
- `pnpm typecheck`
- `pnpm test` (554 passed, 143 skipped)
- `git diff --check`

Outcome: SQ107 is closed. SQ108 is now the active next substrate question.
