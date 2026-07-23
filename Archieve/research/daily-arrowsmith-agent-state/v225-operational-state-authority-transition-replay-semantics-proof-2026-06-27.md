# v225 - Operational State Authority-Transition Replay Semantics Proof

Date: 2026-06-27
Question closed: SQ172
Status: Implemented in `@pm/agent-state`, migration added, focused falsification passed.

## Research Question

What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?

## Existing Substrate Map

- Authority-transition history already exists as hash-bound `OperationalStateAuthorityTransitionRecord` rows that project into `OperationalStateAuthorityTopology`.
- Authority-topology compaction already resumes from `OperationalStateAuthorityTopologyCompactionCheckpoint` plus a retained transition suffix.
- Checkpoint admission and witness authority can already make compaction checkpoints replay-authorized instead of private summaries.
- Nested authority-transition admission already prevents witness topologies from being self-authored in strict checkpoint, proof-record, verifier, finalizer, policy, guard, tombstone, and witness-ledger lanes.
- Compositional quorum-intersection proofs now prevent independently valid authority histories from composing unless active accepted witnesses overlap under embedded topologies and certificates.

## Missing Substrate Map

- Before v225, authority-transition replay used the current implementation of `operationalStateAuthorityTopologyFromTransition()`. A future code change could reinterpret older transition history while hashes still verified.
- There was no replay-semantics identity object naming the transition algebra, version, valid authority frontier, rule set, or rule hashes.
- There was no proof object binding each replayed transition record hash and schema version to the admitted semantics rule used to interpret it.
- Authority-topology compaction had no strict mode that refused recovery when a retained suffix lacked an admitted replay-semantics proof.
- The next missing concept is a semantics-migration proof: replay must be able to move from one admitted algebra to another only through an explicit state transformer/admission rule, not by silent code replacement.

## Arrowsmith Bridge

A literature:

- Agent state failures and memory drift expose the same operational fault: a private representation can become action authority when replay does not reconstruct current state.

B mechanism:

- Stable state-machine replay, proof-carrying validation, dynamic update state transformers, and event-store schema evolution all separate history from the interpreter used to replay it.

C literature:

- Schneider, "Implementing fault-tolerant services using the state machine approach: A tutorial," ACM Computing Surveys 1990. Mechanism: replicas are equivalent only when they start from the same state and execute the same deterministic commands in the same order.
- Necula, "Proof-Carrying Code," POPL 1997. Mechanism: a producer supplies a proof checked against a previously defined safety policy before code is accepted.
- Hicks et al., "Dynamic Software Updating," ACM TOPLAS, and Neamtiu et al., "Practical Dynamic Software Updating for C," PLDI 2005. Mechanism: stateful code evolution needs explicit type/state transformers and verifier checks; old state cannot always be interpreted by new code.
- Overeem, Spoor, and Jansen, "The dark side of event sourcing: Managing data conversion," SANER 2017. Mechanism: event-sourced systems need explicit event-store upgrade operations, versioning, upcasting, or transformation strategies instead of ad hoc reinterpretation.

Sources:

- https://www.cs.cornell.edu/fbs/publications/SMSurvey.pdf
- https://courses.grainger.illinois.edu/cs421/fa2010/papers/necula-pcc.pdf
- https://www.cs.umd.edu/~mwh/papers/dynupd-toplas.pdf
- https://www.cl.cam.ac.uk/~pes20/group_papers/ginseng.pdf
- https://slingerjansen.nl/wp-content/uploads/2009/04/2017saner-eventsourcing.pdf

## Primitive Proposal

Name: Operational State Authority-Transition Replay Semantics Proof.

Problem it solves: authority-transition history can be hash-valid yet replayed under a newer or different transition algebra than the one that admitted the history.

Research source: state-machine replication, proof-carrying code, dynamic software updating, and event-sourcing data conversion.

Mechanism borrowed or adapted: bind replay to an admitted semantics manifest and require a proof that every transition consumed by replay is interpreted under a rule hash from that manifest.

Why current substrate lacked it: authority topology compaction validated record hashes, sequence continuity, and result topology, but not the identity of the transition semantics used to derive the result.

Why existing primitives were insufficient: compaction checkpoints preserve state frontiers, checkpoint admissions authorize pruning, and quorum intersection proves composition. None of them prevent the replay interpreter itself from changing meaning.

State guarantee it should create: operational authority topology may be recovered from retained transition history only when the retained suffix is replayed under an explicitly admitted, hash-bound transition semantics manifest.

Admission rule it requires: strict authority-topology compaction with `requireReplaySemanticsProof` refuses missing proofs, stale manifests, wrong replay subjects, transition mismatch, rule mismatch, schema mismatch, and false result topology.

Replay rule it requires: proof replay recomputes manifest hash, rule hashes, transition bindings, transition hashes, sequence/hash-chain continuity, and final topology hash.

Authority boundary it requires: tenant, authority scope, topology id, compaction checkpoint subject id, recovered authority sequence, and recovered topology hash.

Failure modes it should prevent:

- New code silently reinterprets old authority transitions.
- A stale manifest authorizes replay after a newer manifest has been admitted.
- A manifest is applied outside its admitted authority-sequence range.
- A proof embeds the right transition hashes but lies about the result topology.
- A retained suffix omits or swaps a transition while still claiming the recovered topology.
- A transition record schema version is replayed under an incompatible rule.

Minimal implementation slice:

- Add `OperationalStateAuthorityTransitionReplaySemanticsManifest`.
- Add `OperationalStateAuthorityTransitionReplaySemanticsProof`.
- Add hash/build/verify/evaluate helpers.
- Extend authority-topology compaction with `requireReplaySemanticsProof`.
- Persist append-only proof envelopes in migration `0142`.

Tests that would falsify it:

- Strict compaction without a replay-semantics proof must fail.
- A proof under a stale manifest must fail when a required manifest hash is supplied.
- A proof whose retained suffix falls outside the manifest validity frontier must fail.
- A recomputed proof hash with a false result topology must still fail replay evaluation.
- Valid retained transitions and current manifest must pass.

Axis surfaces that could later validate it:

- Axis A finance pressure: finance authority transitions cannot be replayed under changed portfolio/admission semantics without a manifest proof.
- Axis B domain-adapter pressure: adapter-local semantics names cannot substitute for manifest hashes.
- Axis C local agent-state pressure: amnesiac resume must rebuild authority topology from checkpoint plus retained suffix plus replay-semantics proof, not from conversation memory.

## Implementation Frontier

Implemented:

- `OperationalStateAuthorityTransitionReplaySemanticsManifest` and rule hashes.
- `OperationalStateAuthorityTransitionReplaySemanticsProof`, transition bindings, proof hash, and evaluator.
- Strict authority-topology compaction gate through `requireReplaySemanticsProof`, `replaySemanticsProof`, and `requiredReplaySemanticsManifestHash`.
- Migration `0142_agent_state_authority_transition_replay_semantics_proofs.sql`.
- Focused test for valid proof, missing proof, stale manifest, manifest sequence mismatch, and false replay result rejection.

Not implemented:

- Durable manifest-admission ledger separate from proof storage.
- Semantics-migration/state-transformer proof between manifest versions.
- Runtime adoption in every strict authority-transition/admission compaction path.
- Axis A/B/C scenarios that exercise real domain adapters against manifest drift.

## Failed Assumption Ledger

- Falsified assumption: hash-valid transition history plus deterministic current code is enough for replay. It is not enough because the code can change while the history remains hash-valid.
- Current model insufficiency: the substrate still needs an explicit semantics-migration proof for legitimate upgrades between replay algebras.

## Active 10-Question Substrate Backlog

1. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?
2. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?
3. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?
4. SQ176: What bootstrap-settlement transparency or head-gossip primitive prevents split bootstrap settlement histories from authorizing competing genesis histories for the same authority topology?
5. SQ177: What signer, witness, quorum, or admission authority makes bootstrap settlement records themselves non-self-authored without reintroducing private root memory?
6. SQ178: What verifier-authority admission primitive makes privacy-preserving policy-proof verifiers replayable and non-self-authored without disclosing the private witness material they validate?
7. SQ179: What verifier-authority admission primitive makes separation-of-duty proof verifiers replayable and non-self-authored so role-separation checks cannot become private authority?
8. SQ180: What compaction-checkpoint witness/currentness primitive makes authority-transition ledger compaction checkpoint-admission histories non-equivocating across agents, restarts, and split compaction stores?
9. SQ181: What quorum-subsumption or heterogeneous-composition primitive proves that authority topologies compose beyond pairwise intersection, so recovery cannot pass when local quorum intersection is necessary but insufficient?
10. SQ182: What semantics-migration proof or state-transformer admission primitive lets an admitted transition history intentionally move from one replay algebra to another without silent reinterpretation?

## Proof Status

- `pnpm --filter @pm/agent-state typecheck`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "replay semantics"`: passed.
- Broader package/root verification remains to run after ledger updates.
