# v150 - Operational State History-Root Observer Signature Proofs

Date: 2026-06-27
Question closed: SQ97

## Research Question

What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?

## Sources

- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Chuat et al., "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs", arXiv 2015: https://arxiv.org/abs/1511.01514
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

## Mechanism Extracted

Certificate-transparency gossip and CONIKS make root views useful only when observers exchange cryptographically attributable root statements and consistency checks. CoSi adds the stronger witness-cosigning bridge: transparency statements should be witnessed by accountable principals, not merely emitted by the authority being watched. PeerReview supplies the accountability mechanism: observed behavior needs non-repudiable evidence linked to a node, while correct nodes can defend against false accusations.

The substrate adaptation is a history-root observer signature proof. A root observation can bless recovery or create a split-history obstruction only when the exact observation payload is signed by the named observer, the observer key binding is replay-current, and the verifier proof is constrained to signature validity. Invalid or unauthorized signed gossip is rejected before it can enter the accepted root set, so forged gossip cannot manufacture operational recovery state or obstruction state.

## Existing Substrate Map

- v140 added operational state history-root transparency: store roots can be observed, root advances require consistency proofs, same-sequence root splits obstruct recovery, and recovery-cut transparency checks lane roots against witnessed roots.
- v147 added constrained signature-verifier adapter proofs: external verifiers can prove signature validity only, not key currentness, topology, quorum, or admission.
- v149 added durable recovery-cut admission records, making recovery cuts replay from admitted cut history rather than view-local state.

## Missing Substrate Map

- Before v150, `OperationalStateHistoryRootObservation.observerId` was an unauthenticated string.
- A forged observation could bless a root by being the only observed root in transparency replay.
- A forged observation could create a same-sequence split-history obstruction even when no authorized observer saw that fork.
- Existing root-observation hashes checked record integrity, not observer accountability or replay-current key status.
- Existing verifier proofs were generic, but no signed payload defined what a history-root observer actually attests.
- Still missing after v150: quorum/settlement over signed observations, signed recovery-cut admission rows, automatic runtime observer-key/topology adoption, live Postgres proof loading, and observation-proof compaction.

## Primitive Proposal

Name: operational state history-root observer signature proof.

Problem it solves: prevents forged or unauthenticated transparency observations from blessing recovery roots or creating split-history obstructions.

Research source: CONIKS key transparency, certificate-transparency gossip, CoSi witness cosigning, and PeerReview accountable logs.

Mechanism borrowed: a root observation must be an attributable signed statement over an exact root payload; replay checks the signature against current observer key state before using the observation.

Why current substrate lacked it: v140 replayed observation hashes and consistency proofs, but an observer id was just data inside the observation.

Why existing primitives are insufficient: root hashes prove root identity, observation hashes prove record integrity, and verifier proofs prove cryptography when used; none defines the signed observation payload or prevents unauthorized observers from affecting transparency replay.

State guarantee it should create: strict recovery transparency can accept only root observations with valid observer signature proofs bound to the exact observation hash, root identity, observed time, replayed observer key binding, and constrained verifier proof.

Admission rule it requires: observer signature proofs must bind tenant, authority scope, observer id, store id/kind, root sequence/hash/commitment, observed-at time, observation hash, observer signature payload hash, observer key binding, verifier proof, and observer signature proof hash.

Replay rule it requires: when observer signatures are required, replay must reject missing proofs, invalid proof hashes, payload mismatch, observation mismatch, tenant/scope/observer mismatch, unauthorized observers, stale keys, verifier authority smuggling, invalid signatures, and only then admit the observation into root replay.

Authority boundary it requires: v150 proves observer accountability, not quorum sufficiency. SQ107 must define when signed observations settle or certify a root for strict recovery.

Failure modes it should prevent: forged root blessings, fake split-history gossip, stale observer keys, verifier adapters asserting observer authority, payload substitution, and unsigned observations satisfying strict recovery transparency.

Minimal implementation slice: add observer signature payload/proof types, deterministic hashes, evaluator, signed-observation-aware transparency replay, action-review requirement, append-only migration, and tests for valid signed observations, unsigned refusal, unauthorized forged split refusal, and verifier-authority smuggling refusal.

Tests that would falsify it: an allowed signed observation fails; unsigned replay passes under strict signed-observer policy; unauthorized signed fork creates a split obstruction; a verifier proof with authority/currentness claims passes; stale observer keys pass; action review accepts unsigned transparency replay when signatures are required.

Axis surfaces that could later validate it: Axis C local amnesiac recovery with forged gossip, Axis A finance recovery-cut store roots with signed monitors, and Axis B/domain adapters attempting to use connector-local root observations.

## Falsification Criteria

- A signed observation by an allowed observer with an active key binding and constrained verifier proof must replay and satisfy strict recovery transparency.
- Missing observer signature proof under `requireObserverSignatures` must produce `operational_state_transparency_observer_signature_missing` and must not add the observation to `latestRoots`.
- A transparency replay computed without signed-observer enforcement must fail recovery transparency when `requireObserverSignatures` is true.
- An unauthorized signed fork must produce `operational_state_transparency_observer_signature_invalid` and must not produce `operational_state_transparency_split_history`.
- A verifier proof that claims observer authority or key currentness must make the observer signature proof invalid.

## Active 10-Question Backlog

1. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
2. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
3. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
4. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
5. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
6. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
7. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
8. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
9. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
10. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?

## Failed Assumption Ledger

- Falsified: a hash-valid root observation from a named observer is accountable transparency evidence.
- Falsified: split-history obstruction can safely be produced from unsigned or unauthorized observations.
- Still open: v150 supplies signed observation proof and strict replay filtering, but quorum/settlement authority, runtime observer topology, signed recovery-cut admission rows, live store loading, and observer-proof compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateHistoryRootObserverSignatureProof`, payload, evaluation, and issue types.
- `computeOperationalStateHistoryRootObserverSignaturePayloadHash()`, `buildOperationalStateHistoryRootObserverSignatureProof()`, deterministic proof hashing, and `evaluateOperationalStateHistoryRootObserverSignature()`.
- `replayOperationalStateHistoryRootObservations({ requireObserverSignatures: true })` so unsigned or invalid observations are rejected before entering accepted roots.
- `evaluateOperationalStateRecoveryCutTransparency({ requireObserverSignatures: true })` and action-review enforcement through `requireRecoveryTransparencyObserverSignatures`.
- Migration `0067_agent_state_history_root_observer_signature_proofs.sql` with append-only durable observer signature proof rows.
- Tests for valid signed observer replay, unsigned strict replay refusal, unsigned replay rejection by strict recovery transparency, unauthorized signed fork not producing split obstruction, and verifier authority-smuggling refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (119 passed)
- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (523 passed, 143 skipped)

Outcome: SQ97 is closed. SQ98 is now the active next substrate question.
