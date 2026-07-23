# v224 - Operational State Compositional Quorum Intersection Proof

Date: 2026-06-27
Question closed: SQ171

## Research Question

What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?

## Existing Substrate Map

`@pm/agent-state` already had replayable authority topologies, quorum-certificate proof certificates, recovery cuts, witness ledgers, authority-transition admission, and compaction/admission layers for several replay lanes. A recovery cut could prove that its required lanes were replayable and hash-closed, and individual quorum certificates could bind a subject to accepted witnesses and an authority topology hash.

That existing substrate was still local to each certificate or topology. It could show that one authority claim was locally certified, but it did not prove that two independently admitted authority histories had a shared active authority basis when a recovery cut consumed them together.

## Missing Substrate Map

The missing primitive was compositional authority evidence. The substrate needed to distinguish:

- A locally certified quorum claim.
- A topology-local accepted witness set.
- An active accepted witness set after replaying principal status.
- A pairwise or global intersection proof over multiple authority claims.
- A recovery cut that is allowed to compose independent histories only after that proof replays.

Without that distinction, private memory, a local summary, or a connector cache could provide the story that separately valid histories belonged together. The histories could then compose into operational state even when their accepted witness sets were disjoint or bridged only by a stale/suspended witness.

## Research Sources

- Malkhi and Reiter, "Byzantine Quorum Systems," Distributed Computing 1998. The useful mechanism is quorum intersection: quorum systems preserve consistency because every pair of quorums intersects, and Byzantine quorum systems require intersection containing enough correct processes. Source: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf
- Garcia-Perez and Gotsman, "How to Trust Strangers: Composition of Byzantine Quorum Systems," DISC 2021. The useful mechanism is that independently chosen trust/quorum assumptions do not automatically compose; composition must prove the needed intersection condition across systems. Source: https://drops.dagstuhl.de/storage/00lipics/lipics-vol209-disc2021/LIPIcs.DISC.2021.44/LIPIcs.DISC.2021.44.pdf
- Florian et al., "The Sum of Its Parts: Analysis of Federated Byzantine Agreement Systems," Distributed Computing 2022. The useful mechanism is open-membership quorum safety as a topological property, not as a local assertion by one participant. Source: https://link.springer.com/article/10.1007/s00446-022-00430-0
- Li, Chan, and Lesani, "Quorum Subsumption for Heterogeneous Quorum Systems," DISC 2023. The useful mechanism is the warning that quorum intersection and availability alone can be necessary but insufficient for heterogeneous composition, motivating the next backlog question on stronger subsumption. Source: https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.DISC.2023.28

## Primitive Proposal

Name: `OperationalStateCompositionalQuorumIntersectionProof`

Problem it solves: Independently certified authority histories can compose into recovered operational state only when replay can prove they share enough active authority witnesses under their embedded authority topologies.

Mechanism borrowed or adapted: Byzantine quorum intersection, federated quorum composition, and heterogeneous quorum-composition checks.

Why current substrate lacked it: Existing quorum certificates were per-subject and per-topology. Recovery cuts could require replayable lanes, but there was no proof object that replayed the intersection of accepted active witnesses across multiple independently certified authority claims.

Why existing primitives were insufficient: Authority topology replay proves the active principal set for one topology. Quorum-certificate hashes prove one local certificate. Recovery cuts prove lane closure. None of those primitives proves that separately certified lanes have a shared authority basis when combined.

State guarantee: A recovery cut cannot compose independent authority histories into operational state under strict composition mode unless a replayable proof hash-binds the embedded topology/certificate claims and recomputes sufficient pairwise or global active accepted-witness intersection.

Admission rule: Each composition claim must embed a hash-valid authority topology and a hash-valid certified quorum certificate bound to that topology hash, tenant, scope, authority boundary, and subject. Accepted witnesses must be unique, present in the topology, and active.

Replay rule: Replay recomputes the proof hash, topology hashes, certificate hashes, active accepted witness sets, pairwise intersections, and global intersection. Stored intersections must match recomputation, and the selected pairwise/global mode must satisfy `requiredIntersectionWitnesses`.

Authority boundary: The proof binds one tenant, authority scope, recovery subject kind/id/hash, and per-claim authority boundaries. Recovery-cut evaluation requires the proof subject to match `operational_state_recovery_cut` and the exact cut hash.

Failure modes prevented:

- Two locally certified but disjoint authority histories composing into recovered state.
- A suspended or revoked witness acting as the bridge between histories.
- Duplicate witness ids counting toward certificate quorum.
- Certificates over one topology hash being paired with a different embedded topology.
- Hash-valid but false intersection claims.
- Recovery-cut composition authorized only by a private continuity story.

Minimal implementation slice:

- Added `OperationalStateCompositionalQuorumIntersectionProof` and claim/intersection/evaluation types.
- Added deterministic build/hash/verify helpers.
- Added `evaluateOperationalStateCompositionalQuorumIntersectionProof()`.
- Extended recovery-cut evaluation with `requireCompositionalQuorumIntersectionProof` and `quorumIntersectionProof`.
- Added migration `0141_agent_state_compositional_quorum_intersection_proofs.sql`.
- Added focused tests for valid active intersection, missing recovery proof, disjoint certified quorums, suspended shared witness, and hash-valid false intersections.

Tests that falsify it:

- A recovery cut with composition required but no proof must fail.
- Two valid local certificates with no active shared witness must fail.
- A shared witness that is suspended in one topology must fail.
- A certificate whose accepted witness is absent from the topology must fail.
- A proof whose stored intersection does not replay from the embedded claims must fail even if its proof hash is recomputed.
- A certificate bound to the wrong topology hash must fail.

Axis surfaces that can later validate it:

- Axis A can attempt finance recovery across separately admitted ingest, projection, and authority histories with disjoint witness sets.
- Axis B can attempt domain-adapter recovery where connector and domain-authority histories are separately certified but lack intersection.
- Axis C can directly attempt local agent-state recovery with independently valid quorum certificates that do not compose.

## Implementation Frontier

Implemented in `packages/agent-state/src/index.ts`, `packages/agent-state/src/index.test.ts`, and migration `0141_agent_state_compositional_quorum_intersection_proofs.sql`.

Proof status:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "compositional quorum"`
- `pnpm vitest run packages/agent-state/src/index.test.ts`
- `pnpm typecheck`
- `pnpm test`

## Active Backlog Change

Closed SQ171.

Added SQ181: What quorum-subsumption or heterogeneous-composition primitive proves that authority topologies compose beyond pairwise intersection, so recovery cannot pass when local quorum intersection is necessary but insufficient?
