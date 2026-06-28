# v149 - Operational State Recovery Cut Admission Records

Date: 2026-06-27
Question closed: SQ96

## Research Question

What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?

## Sources

- Chandy and Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems", ACM Transactions on Computer Systems 1985: https://lamport.azurewebsites.net/pubs/chandy.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM Transactions on Database Systems 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

## Mechanism Extracted

Chandy-Lamport supplies the consistent-cut mechanism: a recovered global state is meaningful only when local components and in-flight dependencies form a coherent cut, not when one process remembers a convenient snapshot. ARIES supplies the recovery discipline: restart reconstructs state by repeating durable history from write-ahead records, not by trusting volatile memory. Crosby/Wallach and PeerReview add the non-equivocation/accountability bridge: logs need hash-linked, replay-checkable records so a store or node cannot present conflicting histories without creating evidence.

The substrate adaptation is a recovery-cut admission record. A `CurrentStateView.recoveryCut` remains a candidate proof object, but it does not become operational recovered state until a durable admission chain records the exact cut hash, authority scope, recovery-cut store, sequence, previous admission hash, and the `CurrentStateView` identity hash that the cut authorizes. Action review can then require replay of the admission chain before recovered state can authorize action.

## Existing Substrate Map

- v139 added `OperationalStateRecoveryCut`, which inventories replayable recovery lanes and blocks private/cached representations from acting as required recovered state.
- v140 added `OperationalStateHistoryRoot` transparency, so recovery-cut lanes that cite store roots must match witnessed, non-split store roots.
- v141 added pruning-policy compilation, so recovery lane obligations can derive from policy rather than implementation memory.
- v142-v148 added storage guards, compaction replay, quorum-certificate proof records, authority-topology compaction, constrained signature-verifier proofs, and authority epoch seal finalizer proofs.

## Missing Substrate Map

- Before v149, a recovery cut could be structurally valid and transparency-checked while still arriving as a view-local object supplied by process memory, connector cache, worktree state, or an agent summary.
- Existing recovery-cut hash validation proved integrity of the cut object, not admission of that cut into durable operational history.
- Existing history-root transparency witnessed store roots, but did not record that a specific recovery cut was admitted for a specific current-state view identity.
- Existing action review could require `requireRecoveryCut`, `requireRecoveryTransparency`, and pruning-policy compliance, but could not require replay of recovery-cut admission itself.
- Still missing after v149: accountable observer signatures or quorum over recovery-cut admission rows, live Postgres store integration beyond the migration shape, runtime recovery-cut store adoption, admission compaction, and cross-agent gossip of admission-store roots.

## Primitive Proposal

Name: operational state recovery cut admission record.

Problem it solves: prevents a memory-supplied, connector-supplied, or worktree-supplied recovery cut from becoming recovered operational authority merely by being embedded in a current-state view.

Research source: Chandy-Lamport consistent cuts, ARIES write-ahead recovery, Crosby/Wallach tamper-evident logging, and PeerReview accountable replay logs.

Mechanism borrowed: a recovery cut must be admitted as an ordered, hash-linked, replayable log record that binds the cut to the state identity it authorizes.

Why current substrate lacked it: v139 made the cut shape and v140 made store roots witnessable, but no durable record said "this exact recovery cut was admitted for this exact current-state view identity."

Why existing primitives are insufficient: cut hashing checks object integrity, transparency checks store-root non-equivocation, and pruning policy checks lane completeness; none of those makes the cut itself an admitted transition in a replayable recovery-cut store.

State guarantee it should create: recovered operational state can authorize action only when the latest replayed recovery-cut admission record admits the exact cut hash and binds it to the current admissible view identity hash.

Admission rule it requires: admission records must bind tenant, recovery-cut store id, authority scope, admission sequence, recovery cut hash, current-state view identity hash, previous admission record hash, embedded recovery cut, admitted-at/by metadata, optional reason, and admission record hash.

Replay rule it requires: replay must check tenant/store/scope, sequence continuity, previous-record hash links, same-sequence forks, embedded recovery-cut hash validity, record hash validity, required-cut match, and required current-state view identity hash match.

Authority boundary it requires: the record admits recovery-cut identity, not witness authority by itself; SQ106 must decide which observer signatures, quorum, or transparency rule makes admission rows accountable instead of self-authored.

Failure modes it should prevent: fake view-local recovery cuts, stale cuts authorizing changed views, same-sequence recovery-cut store forks, tampered admission records, wrong-store/wrong-scope recovery admissions, and amnesiac resume from memory rather than admitted recovery history.

Minimal implementation slice: add recovery-cut admission record types, deterministic hashes, replay/evaluation functions, action-review enforcement, append-only migration, and tests for valid admission, missing replay, wrong-cut replay, forked records, tampered records, and stale view identity.

Tests that would falsify it: a valid admitted cut fails; action review passes with no admission replay; a replay for a different cut authorizes the current cut; forked same-sequence records replay as valid; tampering with the admitted view hash preserves record validity; an admission bound to an old view authorizes a changed current view.

Axis surfaces that could later validate it: Axis C direct amnesiac resume, Axis A finance recovery after pruned histories, and Axis B/domain adapters attempting to pass connector-local recovery snapshots as operational state.

## Falsification Criteria

- A hash-valid recovery cut with a hash-valid admission record bound to the current-state view identity must replay and pass blocking action review.
- Missing admission replay under `requireRecoveryCutAdmission` must block action review with `operational_state_recovery_cut_admission_replay_missing`.
- A replay whose latest record admits a different cut must block with `operational_state_recovery_cut_admission_cut_not_admitted`.
- Same-sequence different admission record hashes must produce `operational_state_recovery_cut_admission_record_fork`.
- A tampered admission record must produce `operational_state_recovery_cut_admission_record_hash_mismatch`.
- A record bound to a stale current-state view identity must produce `operational_state_recovery_cut_admission_view_hash_mismatch`.

## Active 10-Question Backlog

1. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
2. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
3. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
4. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
5. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
6. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
7. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
8. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
9. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
10. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?

## Failed Assumption Ledger

- Falsified: a hash-valid recovery cut embedded in `CurrentStateView` is enough to constitute recovered operational state.
- Falsified: store-root transparency alone admits the recovery cut object; transparency witnesses roots, not admission of a cut for a view identity.
- Still open: v149 supplies the admission-record primitive, replay/evaluation rule, action-review gate, and durable table shape, but admission-row authority, signed/quorum witnessing, live store adoption, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateRecoveryCutAdmissionRecord`, replay, evaluation, and issue types.
- `buildOperationalStateRecoveryCutAdmissionRecord()`, deterministic admission-record hashing, verification helpers, `replayOperationalStateRecoveryCutAdmissionRecords()`, and `evaluateOperationalStateRecoveryCutAdmission()`.
- `reviewProposedActionAgainstCurrentState({ requireRecoveryCutAdmission: true })` and warning source `operational_recovery_admission`.
- Migration `0066_agent_state_recovery_cut_admission_records.sql` with append-only durable recovery-cut admission rows.
- Tests for valid durable recovery-cut admission, missing admission replay refusal, different-cut replay refusal, same-sequence fork obstruction, tampered record refusal, and stale current-state view identity refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (115 passed)
- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (519 passed, 143 skipped)

Outcome: SQ96 is closed. SQ97 is now the active next substrate question.
