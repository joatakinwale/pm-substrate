# v140 - Operational State History-Root Transparency

Date: 2026-06-27
Question closed: SQ87

## Research Question

What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, required-head, authority, and recovery-cut stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?

## Sources

- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Li, Krohn, Mazieres, and Shasha, "Secure Untrusted Data Repository (SUNDR)", OSDI 2004: https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Naylor et al., "Quantitative Verification of Certificate Transparency Gossip Protocols", 2020: https://www.prismmodelchecker.org/papers/spc20.pdf

## Mechanism Extracted

CONIKS extracts the key transparency idea into user-checkable consistency: a provider may publish a binding, but users need a way to audit whether other users saw the same committed directory state. SUNDR gives the fork-consistency warning: an untrusted server can keep two clients fooled only by keeping their views permanently forked, because cross-observation exposes the split. PeerReview adds accountable replay: observed claims should be checkable against signed logs and deterministic behavior. Certificate-transparency gossip work supplies the operational channel: roots must circulate between observers so split-world attacks become detectable.

The substrate adaptation is a generic `OperationalStateHistoryRoot` and replayable root-observation transcript. Durable stores can publish root commitments by tenant, store id, authority scope, sequence, and root hash. Agents, connectors, or worktrees gossip observations of those roots. Replay accepts same-root duplicates, rejects same-sequence different roots as split history, rejects sequence regressions, and requires a consistency proof for root advances. Recovery-cut transparency then checks every required recovery-cut lane that cites a store root against the witnessed latest root before blocking-mode action review can treat recovered state as operational.

## Existing Substrate Map

- v139 recovery cuts can inventory required projection, transition-history, checkpoint-admission, pruning-tombstone, required-head, witness-ledger, authority-history, quorum-record, and seal lanes.
- Many specialized stores already expose hash chains or root/head hashes, but the repo lacked one generic cross-store way to compare what different agents observed.
- Existing witness ledgers detect forks inside specific ladders, but they do not cover arbitrary recovery-cut lane store roots.
- Blocking action review can require recovery cuts; v140 extends it to require transparency over cited store roots.

## Missing Substrate Map

- Before v140, a recovery cut could cite a locally valid store root even if another agent had observed a conflicting same-sequence root.
- Before v140, store-root advances did not need a generic consistency proof before becoming recovery-cut support.
- Existing per-layer witness ledgers were insufficient because SQ87 is about cross-store, cross-agent, and cross-worktree split-history detection.
- Existing v139 recovery cuts were insufficient because they prove replay closure inside one supplied cut, not non-equivocation across observers.
- Still missing after v140: durable transparency-observation storage, observer signatures and quorum topology, automatic store-root emission from all durable stores, runtime/Axis adoption, production gossip transport, storage-level SQL guards, and generic pruning-policy compilation.

## Primitive Proposal

Name: operational state history-root transparency.

Problem it solves: prevents a locally replay-valid store root or recovery cut from becoming operational authority while another observer has seen a conflicting root for the same store sequence.

Research source: CONIKS, SUNDR, PeerReview, and certificate-transparency gossip verification.

Mechanism borrowed: root commitments must be observed and compared across clients; same-sequence divergent roots are fork/split-history evidence; advances require consistency proof.

Why current substrate lacked it: each nested store had local replay checks, but no generic root-gossip substrate that action review could apply to every recovery-cut lane.

Why existing primitives are insufficient: recovery cuts prove lane closure, but without cross-observer root comparison they can still be view-local proof objects.

State guarantee it should create: a recovery-cut lane citing a store root cannot authorize recovered state unless that root is witnessed, non-split, and consistent with prior witnessed roots.

Admission rule it requires: store-root observations must be hash-valid, tenant-scoped, store-id scoped, and authority-scoped; same-sequence different root hashes are obstructions.

Replay rule it requires: root advances must include a consistency proof from the prior witnessed root to the new root; missing or invalid proof invalidates the transparency replay.

Authority boundary it requires: action review can require transparency replay for recovery-cut store roots before recovered state authorizes action.

Failure modes it should prevent: split recovery-cut store histories, connector-local roots outranking gossip, stale witnessed roots, unproven store-root advances, and local worktree forks silently authorizing resume.

Minimal implementation slice: add history-root/root-observation/proof types, deterministic hashes, replay of root observations, recovery-cut transparency evaluation, review integration through `requireRecoveryTransparency`, and tests for valid witnessed roots, split history, missing consistency proof, and root mismatch/store-id absence.

Tests that would falsify it: same-sequence divergent roots replay as valid; a root advance without proof replays as valid; a recovery cut with an unwitnessed/mismatched store root authorizes action; or blocking review passes despite invalid transparency.

Axis surfaces that could later validate it: Axis C multi-agent resume with split local stores, Axis A finance recovery after connector/worktree divergence, and Axis B adapter recovery once authoritative fixtures exist.

## Falsification Criteria

- A recovery cut whose required store-root lanes are all witnessed by valid transparency roots must pass transparency evaluation and blocking review.
- Same-sequence different roots for the same tenant/store/scope must produce `operational_state_transparency_split_history`.
- A root advance without consistency proof must produce `operational_state_transparency_consistency_proof_missing`.
- A recovery-cut lane whose store root differs from the witnessed root must produce `operational_state_recovery_transparency_lane_root_mismatch`.
- A lane with a store-root hash but no store id must produce `operational_state_recovery_transparency_lane_store_id_missing`.
- Blocking action review with `requireRecoveryTransparency` must reject invalid transparency.

## Active 10-Question Backlog

1. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
2. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
3. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
4. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
5. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
6. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
7. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
8. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
9. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
10. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?

## Failed Assumption Ledger

- Falsified: a valid recovery cut is enough if all of its local lanes close. v140 shows local closure still needs non-equivocation evidence across observers.
- Falsified: specialized witness ledgers remove the need for generic transparency. They detect layer-local forks, but recovery cuts need cross-store root comparison.
- Still open: v140 transparency observations are pure replay objects and action-review inputs; they are not yet durable, signed, or quorum-certified.

## Proof Status

Implemented in `@pm/agent-state`:

- `OperationalStateHistoryRoot`, consistency proofs, root observations, deterministic root/proof/observation hashes.
- `replayOperationalStateHistoryRootObservations()` with split-history, regression, missing-proof, invalid-proof, tenant, hash, and root-commitment checks.
- `evaluateOperationalStateRecoveryCutTransparency()` for checking recovery-cut store-root lanes against witnessed roots.
- `reviewProposedActionAgainstCurrentState(..., { requireRecoveryTransparency: true })` blocking integration.
- Tests for valid witnessed roots, same-sequence split history, consistency-proof requirements, and mismatched/missing store-root transparency.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ87 is closed. SQ88 is now the active next substrate question.
