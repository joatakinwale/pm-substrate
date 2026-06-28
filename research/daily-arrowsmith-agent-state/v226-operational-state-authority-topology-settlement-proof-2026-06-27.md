# v226 - Operational State Authority-Topology Settlement Proof

Date: 2026-06-27
Question closed: SQ173
Status: Implemented in `@pm/agent-state`, migration added, focused falsification passed.

## Research Question

What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?

## Existing Substrate Map

- Authority-transition history already projects into hash-bound `OperationalStateAuthorityTopology` values.
- Authority-topology compaction can already recover from checkpoints plus retained transition suffixes.
- Checkpoint admission, nested witness authority, compositional quorum-intersection, and replay-semantics proofs already prevent many single-branch replay and self-authored witness failures.
- Strict authority-topology compaction can now require that retained authority-transition history replays under an admitted semantics manifest before current code produces recovered authority.

## Missing Substrate Map

- Before v226, two independently valid authority-topology branches could both be hash-valid and replay-valid, leaving the chosen branch to local memory, ordering, adapter preference, or conversation continuity.
- There was no replayable candidate set naming the competing authority-topology branches considered at recovery time.
- There was no settlement claim hash binding a recovery subject to the selected branch, settled topology hash, and authority frontier.
- There was no certificate boundary for the actor or quorum allowed to settle a topology branch.
- Authority-topology compaction had no strict mode that refused branch recovery without replayable settlement evidence.
- The next missing concept is settlement-authority admission/currentness: topology settlement proofs must themselves be authorized by a non-self-authored configuration-master or settlement authority.

## Arrowsmith Bridge

A literature:

- Agent memory drift and continuity breaks become operational when an agent can resume from whichever local branch it remembers or sees first.

B mechanism:

- Reconfiguration systems separate normal replicated state from the authority that chooses the configuration or branch to continue.
- Joint consensus, view changes, and matchmaker/configuration-master designs all make configuration choice an explicit protocol object rather than a replica's private preference.

C literature:

- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication." Mechanism: an auxiliary configuration master manages configuration state separately from ordinary replicated execution.
- Lamport, Malkhi, and Zhou, "Reconfiguring a State Machine." Mechanism: a reconfigurable system separates the reconfiguration interface from the mechanism that decides which configuration to install.
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm." Mechanism: membership changes use joint consensus so old and new configurations overlap before one configuration becomes authoritative.
- Liskov and Cowling, "Viewstamped Replication Revisited." Mechanism: views and reconfiguration protocols make membership and primary changes explicit in the replicated state machine.
- Whittaker, Howard, and Mortier, "Matchmaker Paxos." Mechanism: matchmakers maintain configuration histories so reconfiguration is not inferred from local acceptor memory.

Sources:

- https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- https://lamport.azurewebsites.net/pubs/reconfiguration-tutorial.pdf
- https://raft.github.io/raft.pdf
- https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- https://mwhittaker.github.io/publications/matchmaker_paxos.pdf

## Primitive Proposal

Name: Operational State Authority-Topology Settlement Proof.

Problem it solves: independently admitted, replay-valid authority-topology branches can both look operational after recovery, allowing private memory or adapter ordering to choose the branch.

Research source: Vertical Paxos configuration masters, reconfigurable state-machine interfaces, Raft joint consensus, Viewstamped Replication views, and Matchmaker Paxos configuration histories.

Mechanism borrowed or adapted: create a replayable candidate set over competing topology branches, then require a settlement claim and quorum certificate from a settlement authority boundary before strict recovery can consume one branch.

Why current substrate lacked it: previous compaction checks validated one branch's checkpoint, retained suffix, replay semantics, and witness authority, but did not prove why that branch wins over a conflicting valid branch.

Why existing primitives were insufficient: replay semantics prove how a branch is interpreted; quorum intersection proves independent histories can compose; checkpoint admission proves a compacted frontier was admitted. None of them select between mutually competing topology branches for the same recovery subject.

State guarantee it should create: strict authority-topology compaction may recover a topology branch only when a settlement proof binds the exact recovery subject to a selected candidate from a hash-bound candidate set under a settlement authority certificate.

Admission rule it requires: `evaluateOperationalStateAuthorityTopologyCompaction({ requireTopologySettlementProof: true })` rejects missing settlement proof, invalid proof hashes, wrong settlement authority boundary, wrong candidate set, wrong selected candidate, subject mismatch, selected-topology mismatch, or settlement certificate mismatch.

Replay rule it requires: replay recomputes candidate hashes, candidate-set hash, selected candidate lookup, settlement claim hash, proof hash, certificate hash, quorum sufficiency, and recovered topology equality.

Authority boundary it requires: tenant, authority scope, topology id, recovery subject kind/id/sequence/hash, settlement authority boundary, settled authority sequence, and settlement certificate subject binding.

Failure modes it should prevent:

- An amnesiac agent resumes from a locally remembered branch rather than settled history.
- A tool or adapter supplies a rival topology branch and lets ordering choose the result.
- A settlement certificate signs an unrelated subject but is reused for recovery.
- A hash-valid candidate set omits the selected branch or duplicates branch identity.
- A proof claims one branch won while strict compaction consumes another branch.
- A settlement boundary outside the required authority path chooses operational authority.

Minimal implementation slice:

- Add `OperationalStateAuthorityTopologySettlementCandidate`.
- Add `OperationalStateAuthorityTopologySettlementProof`.
- Add hash/build/verify/evaluate helpers for candidates, candidate sets, settlement claims, and proofs.
- Extend authority-topology compaction with `requireTopologySettlementProof`, `topologySettlementProof`, and `requiredTopologySettlementAuthorityBoundary`.
- Persist append-only settlement proof envelopes in migration `0143`.

Tests that would falsify it:

- Strict compaction without a topology-settlement proof must fail.
- A valid proof over the selected branch must allow strict compaction.
- A proof over a rival selected topology must fail even when its hashes are internally valid.
- A certificate over the wrong settlement subject must fail.
- Candidate hash, candidate-set hash, settlement-claim hash, and proof-hash tampering must fail.

Axis surfaces that could later validate it:

- Axis A finance pressure: competing portfolio authority topologies cannot be selected by tool-output order.
- Axis B domain-adapter pressure: domain adapters cannot smuggle branch preference into recovered state without a settlement proof.
- Axis C local agent-state pressure: amnesiac resume must rebuild current authority from settled branch history, not from conversation memory or connector cache.

## Implementation Frontier

Implemented:

- `OperationalStateAuthorityTopologySettlementCandidate` and deterministic candidate hashing.
- `OperationalStateAuthorityTopologySettlementProof`, candidate-set hash, settlement-claim hash, proof hash, and evaluator.
- Strict authority-topology compaction gate through `requireTopologySettlementProof`, `topologySettlementProof`, and `requiredTopologySettlementAuthorityBoundary`.
- Migration `0143_agent_state_authority_topology_settlement_proofs.sql`.
- Focused test for valid topology settlement plus missing proof, rival selected branch, and wrong certificate subject rejection.

Not implemented:

- Durable settlement-authority admission ledger separate from proof storage.
- Currentness/non-equivocation for settlement authorities across split configuration masters.
- Runtime adoption in every branch-producing authority recovery path.
- Axis A/B/C scenarios that exercise real adapters against topology-branch conflicts.

## Failed Assumption Ledger

- Falsified assumption: if each authority-topology branch is independently replay-valid, local recovery can choose one. It cannot, because branch choice is itself operational authority.
- Current model insufficiency: the substrate still needs settlement-authority admission/currentness so settlement proofs do not become self-authored configuration-master memory.

## Active 10-Question Substrate Backlog

1. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?
2. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?
3. SQ176: What bootstrap-settlement transparency or head-gossip primitive prevents split bootstrap settlement histories from authorizing competing genesis histories for the same authority topology?
4. SQ177: What signer, witness, quorum, or admission authority makes bootstrap settlement records themselves non-self-authored without reintroducing private root memory?
5. SQ178: What verifier-authority admission primitive makes privacy-preserving policy-proof verifiers replayable and non-self-authored without disclosing the private witness material they validate?
6. SQ179: What verifier-authority admission primitive makes separation-of-duty proof verifiers replayable and non-self-authored so role-separation checks cannot become private authority?
7. SQ180: What compaction-checkpoint witness/currentness primitive makes authority-transition ledger compaction checkpoint-admission histories non-equivocating across agents, restarts, and split compaction stores?
8. SQ181: What quorum-subsumption or heterogeneous-composition primitive proves that authority topologies compose beyond pairwise intersection, so recovery cannot pass when local quorum intersection is necessary but insufficient?
9. SQ182: What semantics-migration proof or state-transformer admission primitive lets an admitted transition history intentionally move from one replay algebra to another without silent reinterpretation?
10. SQ183: What settlement-authority admission or configuration-master currentness primitive prevents topology-settlement proofs themselves from being self-authored or split across settlement masters?

## Proof Status

- `pnpm --filter @pm/agent-state typecheck`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "topology settlement"`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed.
- `git diff --check`: passed.
