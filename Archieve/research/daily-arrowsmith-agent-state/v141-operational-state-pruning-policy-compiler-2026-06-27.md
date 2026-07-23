# v141 - Operational State Pruning Policy Compiler

Date: 2026-06-27
Question closed: SQ88

## Research Question

What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?

## Sources

- Loo et al., "Declarative Networking: Language, Execution and Optimization", SIGMOD 2006: https://dl.acm.org/doi/10.1145/1142473.1142485
- Loo et al., "Declarative Networking", Communications of the ACM 2009: https://cacm.acm.org/research/declarative-networking/
- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", Journal of Computer Security 2010: https://www.research.ed.ac.uk/en/publications/secpal-design-and-semantics-of-a-decentralized-authorization-lang/
- Alvaro et al., "Dedalus: Datalog in Time and Space", Datalog Reloaded 2010: https://link.springer.com/chapter/10.1007/978-3-642-24206-9_16

## Mechanism Extracted

Declarative networking separates the protocol specification from the execution plan: NDlog states distributed-state rules, then compiles them into executable dataflow with syntactic restrictions that preserve locality and semantics. SecPAL does the same for decentralized authorization: policies and credentials become logical clauses, and an access decision is a query over the current policy database rather than an imperative assumption. Dedalus adds explicit time to Datalog so mutable distributed state can be reasoned about as logical facts over time instead of hidden operational side effects.

The substrate adaptation is an operational-state pruning policy compiler. A tenant/scope policy declares the required transition-history, checkpoint, checkpoint-admission, pruning-admission, pruning-tombstone, required-head, witness-ledger, authority-history, quorum-certificate, authority-epoch-seal, and recovery-cut stages. The compiler derives replay-lane obligations, store ids, lane kinds, admissible sources, required hashes, required store roots, replay rules, and dependencies. A recovery cut can become operational only when it satisfies the compiled obligations. A hand-written cut that omits a stage is blocked even if its own hash is valid.

## Existing Substrate Map

- v139 recovery cuts can represent replayable operational-state lanes and reject private/cached required lanes.
- v140 transparency can witness store roots and obstruct split histories.
- Specialized pruning/currentness ladders exist for certificate stores, settlement heads, tombstone heads, pruning tombstone-store heads, history-store heads, and target history-store-head pruning tombstone-store heads.
- Action review can already block on recovery-cut and recovery-transparency requirements.

## Missing Substrate Map

- Before v141, nested pruning/recovery ladders were hand-repeated across specialized layers; omission risk lived in implementation memory.
- Before v141, no substrate artifact could say which lanes a generic prunable transition store must present before recovered state could authorize action.
- Existing recovery cuts were insufficient because they check a supplied cut, not whether the cut contains the policy-required ladder.
- Existing transparency was insufficient because a witnessed store root can still belong to an incomplete recovery shape.
- Still missing after v141: durable policy stores, policy-version currentness, a policy-authority compiler boundary, automatic policy generation for every durable store, storage-level SQL guards, Axis/runtime adoption, and proof-carrying compiler artifacts.

## Primitive Proposal

Name: operational state pruning policy compiler.

Problem it solves: prevents private implementation memory from deciding which pruning, currentness, witness, quorum, authority, and recovery lanes are required before a recovered view can authorize action.

Research source: NDlog/declarative networking, SecPAL, and Dedalus.

Mechanism borrowed: declarative policies compile into explicit executable obligations; authorization is a query over admitted clauses/current facts, not procedural belief.

Why current substrate lacked it: the repo had strong per-layer replay mechanisms, but no generic compiler that made the ladder itself an admitted object.

Why existing primitives are insufficient: a recovery cut can be internally valid while omitting a layer; transparency can witness a root without proving the required ladder was complete.

State guarantee it should create: a recovery cut cannot authorize operational state unless it satisfies the compiled tenant/scope pruning policy.

Admission rule it requires: pruning-policy specs must enumerate all required stages in canonical order; missing, duplicated, or reordered stages invalidate the compilation.

Replay rule it requires: compiled obligations derive replay lane ids, admissible sources, required hashes, store roots, and dependencies; evaluation replays the cut against those obligations.

Authority boundary it requires: action review may require pruning-policy compliance before accepting recovered current state.

Failure modes it should prevent: omitted tombstone lanes, skipped required-head currentness, missing witness/quorum authority, unchecked projection recovery, private lane-shape assumptions, and adapter-shaped recovery cuts.

Minimal implementation slice: add policy-stage/spec/compiled-obligation/evaluation types, a compiler with canonical stage-order checks, a recovery-cut policy evaluator, blocking action-review integration, and focused falsification tests.

Tests that would falsify it: a policy missing a required stage compiles valid; a recovery cut omitting a compiled lane passes policy evaluation; a required lane can use the wrong source/kind/store; a lane can omit required hashes or store roots; or blocking review passes despite policy violations.

Axis surfaces that could later validate it: Axis C amnesiac resume across generic durable stores, Axis A finance recovery after pruning, and Axis B adapter recovery where domain packages must not smuggle lane policy into core state.

## Falsification Criteria

- A complete canonical policy must compile to replay-lane obligations with required sources, lane kinds, store ids, hashes, store roots, and dependencies.
- A policy that omits `pruning_tombstone` must produce `operational_state_pruning_policy_stage_missing`.
- A recovery cut satisfying all compiled obligations must pass policy evaluation and blocking action review.
- A recovery cut missing a compiled lane must produce `operational_state_pruning_policy_obligation_missing`.
- A recovery cut whose remaining lanes depend on the omitted lane must produce `operational_state_pruning_policy_dependency_missing`.
- Blocking action review with `requirePruningPolicyCompliance` must reject policy-invalid recovered state.

## Active 10-Question Backlog

1. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
2. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
3. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
4. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
5. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
6. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
7. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
8. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
9. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
10. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?

## Failed Assumption Ledger

- Falsified: recovery-cut validity alone proves the required pruning ladder is complete. v141 shows the ladder itself must compile from policy.
- Falsified: per-layer implementations can safely repeat the same authority shape by convention. SQ88 shows convention is private memory until compiled into substrate obligations.
- Still open: compiled pruning policies are pure in-memory artifacts; they are not yet durable, version-current, signed, or automatically emitted for all stores.

## Proof Status

Implemented in `@pm/agent-state`:

- `OperationalStatePruningPolicyStage`, `OperationalStatePruningPolicySpec`, compiled obligation, issue, compilation, and evaluation types.
- `OPERATIONAL_STATE_PRUNING_POLICY_REQUIRED_STAGES` canonical ladder.
- `compileOperationalStatePruningPolicy()` with missing, duplicate, and out-of-order stage checks plus deterministic policy hashes.
- `evaluateOperationalStateRecoveryCutAgainstPruningPolicy()` with lane, source, store, hash, store-root, and dependency checks.
- `reviewProposedActionAgainstCurrentState(..., { requirePruningPolicyCompliance: true })` blocking integration.
- Tests for valid compiled recovery lanes, missing-stage compilation failure, and hash-valid cuts that omit compiled lanes.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ88 is closed. SQ89 is now the active next substrate question.
