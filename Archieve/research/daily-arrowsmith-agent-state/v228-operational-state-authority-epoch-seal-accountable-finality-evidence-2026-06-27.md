# v228 - Operational State Authority Epoch Seal Accountable Finality Evidence

Date: 2026-06-27
Question closed: SQ175
Status: Implemented in `@pm/agent-state`, migration added, focused falsification passed.

## Research Question

What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?

## Existing Substrate Map

- Authority epoch seal finalizer proofs already bind a finalized subject frontier, authority topology hash, quorum certificate hash, optional authority-transition hash, finalizer principal, finalizer key binding, verifier proof, and deterministic finalizer proof hash.
- Finalizer-proof admission records already make a finalizer proof replay-current only when a certified quorum certificate admits the exact finalizer proof hash for its seal id and admission sequence.
- Finalizer-proof admission witness records, witness-authority topology, nested authority-transition admission, bootstrap certificates, bootstrap settlement, topology settlement, replay-semantics proofs, and verifier-role settlement proofs already strengthen individual finalizer and signature paths.
- Strict finalizer evaluation can require admitted finalizer-proof history and nested witness-authority transition history before accepting seal finality.

## Missing Substrate Map

- Before v228, two independently admitted, certified finalizer-proof quorums could conflict over the same sealed subject frontier without producing a first-class replayable obstruction object.
- The substrate had finalizer proof validity and finalizer proof admission validity, but no accountable safety object tying two conflicting admissions together.
- A disagreement between finalizer quorums could remain an agent-local dispute, summary, or operational caution rather than a hash-bound evidence object that finalizer evaluation can consume.
- There was no replay rule requiring the conflicting certificates to be certified, quorum-sufficient, subject-bound to their exact finalizer proofs, and overlapping in accepted witnesses.
- The next missing concept is evidence custody/currentness: once accountable finality evidence exists, the substrate still needs a way to prove it was gossiped, retained, and not hidden before recovery.

## Arrowsmith Bridge

A literature:

- Agent state failures become dangerous when a local agent privately decides which finalizer quorum to trust after memory drift, restart, or split observations.
- Multi-agent disagreement and stale tool output require a mechanism that turns conflicting committed/finalized views into public obstruction evidence, not negotiation.

B mechanism:

- Accountable safety, conflicting-vote evidence, quorum certificates, slashing conditions, finality gadgets, and Byzantine state-machine replication convert finality disagreement into replayable evidence against the authority process.

C literature:

- Casper FFG: two conflicting finalized checkpoints imply at least one third of validators violated accountable safety conditions; the evidence is the conflicting votes/finality messages.
- Accountable Safety Implies Finality: accountable safety means safety violations produce identifiable adversarial replicas, connecting finality with evidence of misbehavior.
- HotStuff: finality is represented through quorum certificates over exact blocks/values and chained commit rules; local leader preference is not finality.
- PBFT: committed state depends on enough replica agreement over exact requests and sequence numbers, not a single replica's memory.
- Tendermint accountable safety work and evidence specs: conflicting votes are represented as evidence that can be verified and propagated.

Sources:

- https://arxiv.org/pdf/1710.09437
- https://fc24.ifca.ai/preproceedings/16.pdf
- https://arxiv.org/abs/1803.05069
- https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- https://infoscience.epfl.ch/server/api/core/bitstreams/bb494e9a-22aa-43a2-b995-69c7a2cc893e/content

## Primitive Proposal

Name: Operational State Authority Epoch Seal Accountable Finality Evidence.

Problem it solves: conflicting admitted authority epoch seal finalizer quorums must become replayable obstruction evidence rather than private dispute, agent memory, or caller policy.

Research source: Casper FFG accountable safety, Accountable Safety Implies Finality, HotStuff quorum certificates, PBFT commit evidence, and Tendermint duplicate/conflicting vote evidence.

Mechanism borrowed or adapted: represent two conflicting certified finalizer-proof admissions as one hash-bound evidence object that replay can evaluate for same subject frontier, divergent finality output, certified admission certificates, certificate subject binding, quorum sufficiency, and shared accepted witnesses.

Why current substrate lacked it: finalizer proof admission proved one finalizer proof at a time. It did not define the operational meaning of two valid admitted finalizer proofs that disagree.

Why existing primitives were insufficient: a valid finalizer proof, valid verifier proof, and valid proof-admission record each prove local replay validity. None of them converts a pair of conflicting valid admissions into an obstruction that finalizer evaluation must refuse.

State guarantee it should create: strict finalizer evaluation can reject an otherwise valid finalizer proof when replayable accountable finality evidence shows that its admitted quorum conflicts with another admitted quorum for the same sealed subject frontier.

Admission rule it requires: accountable finality evidence must embed two finalizer-proof admission records whose certificates are certified, quorum-sufficient, bound to the exact finalizer proof subject, scoped to the expected tenant/scope/boundaries, and share at least one accepted witness.

Replay rule it requires: evidence replay recomputes both finalizer proof hashes, both admission record hashes, both certificate hashes, shared accepted witnesses, conflict kinds, conflict hash, and evidence hash before it can obstruct operational finality.

Authority boundary it requires: tenant, authority scope, finalized authority boundary, finalizer-proof admission authority boundary, sealed subject kind/id/sequence, finalizer proof hashes, admission record hashes, admission certificate hashes, accepted witness ids, and conflict kind set.

Failure modes it should prevent:

- A stale agent memory selects one of two conflicting finalizer quorums after resume.
- A connector cache hides that a second certified finalizer proof exists.
- A domain adapter reports finality conflict as advisory text rather than replayable obstruction evidence.
- A certificate over the wrong admission boundary is reused as finalizer conflict authority.
- A non-overlapping dispute is treated as accountable safety evidence without identifying any shared accepted witness.
- A duplicate finality proof is mislabeled as a finality conflict without divergent authority topology, quorum certificate, or transition hash.

Minimal implementation slice:

- Add `OperationalStateAuthorityEpochSealAccountableFinalityEvidence`.
- Add deterministic conflict hash and evidence hash helpers, builder, hash verifier, and evaluator.
- Extend finalizer evaluation with `accountableFinalityEvidence` so valid conflict evidence obstructs acceptance.
- Persist append-only evidence envelopes in migration `0145`.
- Add focused tests for valid obstruction evidence, disjoint-witness rejection, no-conflict rejection, wrong certificate subject rejection, and wrong certificate boundary rejection.

Tests that would falsify it:

- Valid conflicting certified finalizer-proof admissions with a shared accepted witness must produce valid obstruction evidence.
- Finalizer evaluation with valid obstruction evidence for the current finalizer proof must reject acceptance.
- Evidence with disjoint accepted witnesses must fail as non-accountable.
- Evidence over duplicate non-conflicting finality output must fail.
- Evidence whose certificate subject or authority boundary does not certify the embedded finalizer proof must fail.

Axis surfaces that could later validate it:

- Axis A finance pressure: finance replay cannot privately choose one certified finalizer branch after competing market-data state seals.
- Axis B domain-adapter pressure: a domain adapter cannot downgrade finality conflict to narrative warning.
- Axis C local agent-state pressure: amnesiac resume must recover finality obstruction from admitted evidence history, not conversation memory.

## Implementation Frontier

Implemented:

- `OperationalStateAuthorityEpochSealAccountableFinalityEvidence`.
- Deterministic finality conflict hashing and full evidence hashing.
- `buildOperationalStateAuthorityEpochSealAccountableFinalityEvidence()`.
- `evaluateOperationalStateAuthorityEpochSealAccountableFinalityEvidence()`.
- Strict finalizer obstruction through `evaluateOperationalStateAuthorityEpochSealFinalizer({ accountableFinalityEvidence })`.
- Migration `0145_agent_state_authority_epoch_seal_accountable_finality_evidence.sql`.
- Focused test proving valid obstruction evidence plus disjoint-witness, no-conflict, wrong-certificate-subject, and wrong-boundary rejection.

Not implemented:

- Runtime adoption in every authority epoch seal finalizer call site.
- Evidence gossip, monitor-quorum currentness, or retention proof for accountable finality evidence.
- Accountable witness identity/slashing beyond shared accepted witness ids in the admission certificates.
- Axis A/B/C scenarios that exercise withheld finality evidence or live split finalizer quorums.

## Failed Assumption Ledger

- Falsified assumption: individual finalizer proof admission is enough to preserve finality safety. It is not enough when two individually admitted finalizer proofs conflict and no substrate object forces the conflict to obstruct acceptance.
- Current model insufficiency: the substrate can now represent and enforce known accountable finality evidence, but it still cannot prove that all agents have observed the latest evidence or that evidence was not withheld before recovery.

## Active 10-Question Substrate Backlog

1. SQ176: What bootstrap-settlement transparency or head-gossip primitive prevents split bootstrap settlement histories from authorizing competing genesis histories for the same authority topology?
2. SQ177: What signer, witness, quorum, or admission authority makes bootstrap settlement records themselves non-self-authored without reintroducing private root memory?
3. SQ178: What verifier-authority admission primitive makes privacy-preserving policy-proof verifiers replayable and non-self-authored without disclosing the private witness material they validate?
4. SQ179: What verifier-authority admission primitive makes separation-of-duty proof verifiers replayable and non-self-authored so role-separation checks cannot become private authority?
5. SQ180: What compaction-checkpoint witness/currentness primitive makes authority-transition ledger compaction checkpoint-admission histories non-equivocating across agents, restarts, and split compaction stores?
6. SQ181: What quorum-subsumption or heterogeneous-composition primitive proves that authority topologies compose beyond pairwise intersection, so recovery cannot pass when local quorum intersection is necessary but insufficient?
7. SQ182: What semantics-migration proof or state-transformer admission primitive lets an admitted transition history intentionally move from one replay algebra to another without silent reinterpretation?
8. SQ183: What settlement-authority admission or configuration-master currentness primitive prevents topology-settlement proofs themselves from being self-authored or split across settlement masters?
9. SQ184: What transparency-head gossip or monitor-quorum currentness primitive prevents verifier-role settlement proofs from accepting split key-transparency log heads?
10. SQ185: What finality-evidence gossip, custody, or retention primitive proves accountable finality evidence cannot be withheld, aged out, or hidden from amnesiac recovery?

## Proof Status

- `pnpm --filter @pm/agent-state typecheck`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "accountable finality"`: passed.
- `pnpm vitest run packages/agent-state/src/index.test.ts`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed.
- `git diff --check`: passed.
