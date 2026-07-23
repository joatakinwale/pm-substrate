# v139 - Operational State Recovery Cut Kernel

Date: 2026-06-27
Question closed: SQ86

## Research Question

What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?

## Sources

- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Chandy and Lamport, "Distributed Snapshots: Determining Global States of Distributed Systems", ACM TOCS 1985: https://lamport.azurewebsites.net/pubs/chandy.pdf
- Elnozahy, Alvisi, Wang, and Johnson, "A Survey of Rollback-Recovery Protocols in Message-Passing Systems", ACM Computing Surveys 2002: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/survey.pdf
- Candea and Fox, "Crash-Only Software", HotOS IX 2003: https://dl.acm.org/doi/10.5555/1251054.1251066

## Mechanism Extracted

ARIES turns restart into a replay problem: stable log records, sequence positions, checkpoints, and repeated history determine what can be reconstructed after memory loss. Chandy-Lamport adds the distributed version: a global state is meaningful only when the collected local states and channel states form a consistent cut. Rollback-recovery literature makes the stable-storage boundary explicit: process memory is allowed to vanish because checkpoints and logs are the recovery substrate. Crash-only design pushes the same operational discipline: startup is recovery, not a trust exercise over pre-crash process state.

The substrate adaptation is an `OperationalStateRecoveryCut`: a hash-addressed recovery proof object whose lanes inventory every replay or required-head layer that can influence a recovered projection. A lane is admissible only when its source is an admitted replay source such as transition history, checkpoint admission, pruning tombstone history, required head, witness ledger, authority history, quorum-certificate record history, or current admissible projection. Private sources such as agent memory, connector cache, conversation summary, local snapshot, tool output, or worktree snapshot can be named only as non-authority context; if a required lane uses them as operational state, recovery fails.

## Existing Substrate Map

- `ProjectionReplayCertificate` proves that a current view has a hash-valid transition history, source refs, projection hash, and replay frontier.
- Certificate stores, store roots, root witnesses, settlement heads, witness ledgers, quorum certificates, checkpoint admissions, pruning admissions, tombstones, required heads, authority stores, key-status replay, and epoch seals now exist in specialized nested forms.
- `reviewProposedActionAgainstCurrentState` can already require a replay certificate before allowing blocking-mode action review.
- Specialized recovery ladders can recover target required heads after amnesia, but callers still had to know which ladder pieces mattered for a recovered projection.

## Missing Substrate Map

- Before v139, there was no generic object that inventoried all required recovery lanes for a projection across nested store layers.
- Before v139, a current-state view could require a projection replay certificate but still omit the deeper required-head, tombstone, witness, authority, and quorum-record dependencies that made the projection recoverable.
- Existing specialized replay functions were insufficient because they proved local layers in isolation; they did not produce a single recovery cut that action review could require.
- Existing replay certificates were insufficient because transition refs could prove a projection frontier while leaving nested compacted-store currentness implicit.
- Still missing after v139: durable recovery-cut admission storage, recovery-cut witnessing or transparency, automatic recovery-cut compilation from store schemas, live runtime adoption, Postgres restart proof, split-history gossip, storage-level SQL guards, generic pruning-policy compilation, durable target QC proof records, and finalizer signatures on epoch seals.

## Primitive Proposal

Name: operational state recovery cut kernel.

Problem it solves: prevents an amnesiac agent from treating private memory, summaries, connector cache, local snapshots, tool output, or worktree state as recovered operational authority.

Research source: ARIES, distributed snapshots, rollback-recovery protocols, and crash-only software.

Mechanism borrowed: recovery is a stable cut over durable logs/checkpoints plus replay rules; startup/resume is valid only when every state component is recoverable from stable, replayable records.

Why current substrate lacked it: the repo had many specialized replay ladders, but no generic manifest binding a recovered projection to all required lanes and dependencies.

Why existing primitives are insufficient: replay certificates prove a projection history, and individual witness/tombstone/authority stores prove local layers, but neither forces a recovered view to declare all nested dependencies before action.

State guarantee it should create: recovered operational state is constituted by a replay-closed cut of admitted lanes plus a current admissible projection; private representations cannot be required lanes.

Admission rule it requires: a recovery cut must be hash-valid, tenant/subject/scope-aligned with the view, include a current admissible projection lane, include every required dependency lane, and refuse required lanes whose source is private or not replayable.

Replay rule it requires: every lane dependency must resolve to a present lane whose sequence and required hash match the dependency contract; missing, stale, or mismatched dependencies become recovery obstructions.

Authority boundary it requires: action review can require a valid recovery cut before recovered current state authorizes action.

Failure modes it should prevent: amnesiac resume from chat summaries, connector caches outranking admitted history, omitted nested required-head dependencies, projection-only replay proofs masking compacted-store gaps, tampered recovery manifests, and stale lane substitution.

Minimal implementation slice: add `OperationalStateRecoveryCut` types, deterministic cut hashing, hash verification, recovery-cut evaluation, optional `CurrentStateView.recoveryCut`, blocking review integration through `requireRecoveryCut`, and tests for valid nested target-layer-style recovery, private-memory rejection, missing dependencies, and tampered hashes.

Tests that would falsify it: a required conversation summary lane passes as operational authority; a projection lane with no closure dependencies passes; a missing required-head dependency passes; a tampered cut hash passes; or blocking action review allows action when `requireRecoveryCut` is enabled and the cut is invalid.

Axis surfaces that could later validate it: Axis C amnesiac resume, Axis A finance recovery under compacted history, and Axis B domain-adapter recovery once authoritative fixtures exist.

## Falsification Criteria

- A valid recovery cut with projection, transition-history, checkpoint-admission, pruning-tombstone, required-head, witness-ledger, authority-history, quorum-record, and epoch-seal lanes must evaluate as valid.
- The cut hash must recompute from the self-hash-excluded payload.
- Blocking action review with `requireRecoveryCut` must pass for a valid recovery cut.
- A required `conversation_summary` lane must produce `operational_state_recovery_lane_private_authority` and block action review.
- A missing dependency lane must produce `operational_state_recovery_dependency_missing`.
- Mutating a lane while preserving the old `cutHash` must produce `operational_state_recovery_cut_hash_mismatch`.

## Active 10-Question Backlog

1. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, required-head, authority, and recovery-cut stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
2. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
3. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
4. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
5. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
6. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
7. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
8. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
9. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
10. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?

## Failed Assumption Ledger

- Falsified: a projection replay certificate alone is enough to prove recovered operational state. v139 shows that nested compacted required-head, tombstone, witness, authority, quorum-record, and seal lanes must be inventoried as a recovery cut.
- Falsified: specialized replay ladders imply generic amnesiac resume. They can prove local layers, but without a generic cut a caller can omit a dependency and still carry a plausible current view.
- Still open: v139 recovery cuts are enforceable in action review but not yet stored, witnessed, or automatically compiled from durable store schemas.

## Proof Status

Implemented in `@pm/agent-state`:

- `OperationalStateRecoveryCut` schema, lane sources, lane kinds, dependencies, issue codes, and evaluation.
- Deterministic recovery-cut hashing and hash verification.
- `CurrentStateView.recoveryCut`.
- `reviewProposedActionAgainstCurrentState(..., { requireRecoveryCut: true })` blocking integration.
- Tests for valid nested target-layer-style recovery, private-memory rejection, missing dependency rejection, and tampered hash rejection.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ86 is closed. SQ87 is now the active next substrate question.
