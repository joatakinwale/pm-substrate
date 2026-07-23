# v229 Substrate Primitive Back-Map

Date: 2026-07-01
Status: consolidation checkpoint, not a new recursive proof layer

## Research Question

How do we stop adding new recursive proof layers and back-map v62-v228 into a smaller set of substrate primitives: state identity, admission calculus, recovery cut, policy compiler, authority topology, obstruction evidence, settlement/finality, and replay semantics?

This checkpoint does not close SQ176-SQ185. It adds a governance rule for future work: no new proof layer should be added unless it first fails to fit one of the primitive families below, and that failure is written as a falsifiable substrate gap.

## Sources Reconciled

- v62 state identity kernel: state-machine replication, ARIES, Chandy-Lamport distributed snapshots, and database provenance.
- v139 recovery cut kernel: ARIES restart discipline, distributed snapshots, rollback recovery, and crash-only software.
- v141 pruning policy compiler: NDlog, SecPAL, and Dedalus style declarative policy-to-obligation compilation.
- v219-v228 proof authority lane: certificate transparency, TUF-style verifier role settlement, PBFT, HotStuff, Casper FFG, and accountable safety evidence.
- Repo evidence: `Changelog.md`, `research/index.md`, `research/daily-arrowsmith-agent-state/index.md`, migrations `0023` through `0145`, and `@pm/agent-state` exported operational-state types.

## Mechanism Extracted

The mechanism is not another witness/proof family. It is a compression rule:

1. Treat each v62-v228 implementation as an instance of a small primitive family.
2. Keep specialized names only as adapters, migrations, or fixtures.
3. Move the operational guarantee into a generic primitive.
4. Require every future Arrowsmith question to state which primitive it strengthens, replaces, or falsifies.
5. Block recursive proof-layer creation when the proposed layer is only "the witness of the authority of the admission of the witness" for a shape already expressible by admission calculus, authority topology, replay semantics, settlement/finality, or obstruction evidence.

## Existing Substrate Map

| Primitive | Back-mapped versions | Existing mechanism |
| --- | --- | --- |
| State identity | v62-v65 | `ProjectionReplayCertificate`, projection replay frontier, graph/capability write gate, durable certificate store refs. |
| Admission calculus | v64, v72, v83-v85, v149-v158, v221-v223 | Write gates, checkpoint admissions, proof admissions, storage guard admissions, policy admissions, and bootstrap settlement checks. |
| Recovery cut | v139-v140, v149, v224 | `OperationalStateRecoveryCut`, recovery transparency, admission replay, and quorum-composition checks for recovered state. |
| Policy compiler | v141, v151 | Pruning-policy stages and compiled lane obligations that prevent hand-written recovery cuts from omitting required lanes. |
| Authority topology | v70-v81, v89-v93, v101-v108, v113-v138, v169-v218, v219-v220, v227 | Witness eligibility, quorum thresholds, key status, authority transitions, epoch seals, bootstrap authority, verifier role settlement. |
| Obstruction evidence | v67-v69, v74-v75, v87-v88, v100, v112, v140, v224, v226, v228 | Forked roots, split histories, stale heads, missing consistency proofs, branch conflicts, quorum-composition failures, finality conflict evidence. |
| Settlement/finality | v69, v72-v78, v91, v105, v116, v127, v138, v148, v219-v220, v226-v228 | Settled roots, currentness, epoch seals, finalizer proofs, bootstrap settlement, topology settlement, accountable finality evidence. |
| Replay semantics | v63, v82-v85, v95-v98, v107-v110, v118-v122, v129-v133, v143-v146, v223, v225 | Frontier positions, compaction checkpoints, retained suffix replay, pruning tombstones, tombstone heads, authority-transition replay manifests. |

## Missing Substrate Map After Back-Mapping

1. Admission calculus is still fragmented. Evidence admission, terminal outcomes, provider status, projection replay, graph authority, recovery cuts, proof admissions, and storage mutation guards exist as separate gates rather than one compositional mutation-decision object.
2. Authority topology is over-specialized. The repeated v159-v218 ladders prove real non-self-authorship properties, but the repeated type families should collapse into a generic authority-topology/admission compiler.
3. Policy compilation exists for pruning/recovery stages, but not for every authority/proof family. v141 is the compression seed, not yet the whole compiler.
4. Obstruction evidence is present in many local forms, but there is no unified obstruction algebra that normalizes split history, stale currentness, finality conflicts, branch conflicts, and connector/worktree disagreement.
5. Replay semantics proof exists for authority-transition compaction, but not as a general replay-algebra registry with migration/state-transformer admission.
6. Settlement/finality is implemented in several lanes, but currentness/gossip/custody for settlement and finality evidence remains open in SQ176, SQ180, SQ183, SQ184, and SQ185.
7. State identity is strong for projections, but not yet universal for connector state, tool state, worktree state, harness output, or domain-adapter state.
8. Pi Harness/procedure admission is not represented by v62-v228. It should become a separate primitive after this back-map: reusable procedures should be admitted, versioned, authority-scoped, and receipt-backed instead of re-reasoned from prompt memory.

## Primitive Proposal

Name: substrate primitive back-map and recursion stop rule.

Problem it solves: research-driven implementation was closing valid local authority gaps by adding specialized proof layers. Without a primitive map, the loop can keep producing proof-of-proof ladders even after v141 showed that hand repetition is private implementation memory.

Research source: state-machine replication, ARIES, distributed snapshots, declarative networking, authorization logics, event sourcing, quorum systems, and accountable finality literature already cited by v62-v228.

Mechanism borrowed or adapted: compaction. A large operational history remains valuable, but current reasoning must project it into a smaller admissible state model with explicit replay and admission rules.

Why current substrate lacked it: the repo had each local mechanism, but no canonical map saying which substrate primitive each mechanism belongs to and when a new recursive layer is disallowed.

Why existing primitives are insufficient: v141 compiles pruning-policy obligations, but it does not yet classify all authority/proof/finality/replay mechanisms into a compact ontology. The daily index preserves the chain, but preservation is not compression.

State guarantee it should create: future work cannot count as substrate progress merely by adding another specialized recursive proof layer. It must strengthen, replace, or falsify one of the primitive families, or document why a new primitive is genuinely required.

Admission rule it requires: before implementing a new Arrowsmith substrate mechanism, the proposal must include a `primitive_family` field from this set:

- `state_identity`
- `admission_calculus`
- `recovery_cut`
- `policy_compiler`
- `authority_topology`
- `obstruction_evidence`
- `settlement_finality`
- `replay_semantics`
- `new_primitive_required`

`new_primitive_required` is valid only when the proposal explains why all eight families are insufficient and gives falsification criteria before implementation.

Replay rule it requires: a recovery or audit report over v62-v228 must be able to replay the specialized artifacts into this primitive map without treating the specialized names as independent ontology.

Authority boundary it requires: the primitive family, not the local adapter or migration name, owns the authority claim. Domain adapters, tools, connectors, and harnesses may attach evidence, but they cannot invent operational authority outside the primitive map.

Failure modes it should prevent:

- new witness-authority-transition-admission families created only because the previous proof layer can itself be questioned;
- hand-expanded ladders replacing a generic compiler;
- treating line-count growth as proof of substrate progress;
- treating line-count growth as proof of junk without mapping the state guarantee first;
- closing SQs with local proof rows that are not connected to a primitive family;
- letting connector, worktree, tool, or harness state bypass primitive admission because it does not resemble an existing proof layer.

Minimal implementation slice:

- Add this v229 research file.
- Update the daily Arrowsmith index with the back-map and stop rule.
- Update the top-level research ledger so the Agent-state stream points to primitive consolidation before SQ176 implementation.
- Update `Changelog.md` with the consolidation checkpoint.
- Add a static validator that enforces primitive-family declarations for future v230+ Arrowsmith research slices.
- Do not add a new `@pm/agent-state` proof type in this slice.

Tests that would falsify it:

- A future research proposal can add a new recursive proof layer without declaring a primitive family.
- A future research proposal can declare `new_primitive_required` without proving why all eight families are insufficient.
- The v86-v138 or v159-v218 ladders cannot be mapped into the eight families without losing their state guarantee.
- A future implementation treats the back-map as documentation only and continues to count specialized proof-family growth as substrate progress.

Axis surfaces that could later validate it:

- Axis A finance pressure: finance recovery should exercise state identity, admission calculus, recovery cuts, policy compiler obligations, and obstruction evidence without adding finance-specific proof layers.
- Axis B domain-adapter pressure: domain packages should compile authority requirements into primitive families instead of smuggling local belief into core state.
- Axis C local agent-state pressure: amnesiac resume and redirect handling should recover operational state from the primitive families, then use harness/procedure admission for repeated actions.

## Back-Map of v62-v228

| Range | What happened | Primitive family projection | Consolidation decision |
| --- | --- | --- | --- |
| v62-v65 | Replay certificate, frontier, write gate, durable certificate store. | State identity, admission calculus. | Keep as the identity spine. Generalize state identity beyond projections. |
| v66-v75 | Certificate-store roots, witnesses, settlement, currentness, head witnessing. | Obstruction evidence, settlement/finality, authority topology. | Keep the guarantee; express future variants through generic root/head currentness. |
| v76-v85 | Head-witness topology, durable stores, epoch seals, signatures, key status, compaction, checkpoint admission, pruning admission. | Authority topology, replay semantics, admission calculus, settlement/finality. | Keep as the first full authority/replay ladder; use as compiler template, not copy template. |
| v86-v138 | Repeated pruning/tombstone/history-store-head ladder. | Policy compiler, recovery cut, replay semantics, authority topology, obstruction evidence. | Treat as evidence that v141 was necessary. Do not extend by hand. |
| v139-v141 | Recovery cut, history-root transparency, pruning-policy compiler. | Recovery cut, obstruction evidence, policy compiler. | Promote as the compression pivot. Future recovery lanes should compile through this path. |
| v142-v148 | Storage mutation guards, tombstone/witness/authority compaction, proof records, verifier adapter proofs, finalizer proofs. | Admission calculus, replay semantics, settlement/finality. | Keep; next work should move these into generic admission/replay interfaces. |
| v149-v158 | Recovery-cut, policy, guard, checkpoint, proof, topology, verifier, and finalizer admission records. | Admission calculus. | Collapse into a generic admitted-artifact record model. |
| v159-v178 | Witness records and witness authority topology for admission rows. | Authority topology, admission calculus. | Valid guarantee, but too specialized. Replace future expansion with a generic authority compiler. |
| v179-v198 | Authority-transition admission for witness-authority topology. | Authority topology, replay semantics, admission calculus. | Valid guarantee. Future work should parameterize it by artifact kind instead of cloning it. |
| v199-v218 | Nested transition-admission witness topology and nested authority-transition admission. | Authority topology, replay semantics. | This is the runaway danger zone. Freeze further hand expansion. |
| v219-v220 | Bootstrap certificate and bootstrap settlement. | Settlement/finality, authority topology, admission calculus. | Keep as root-of-authority primitive; next SQ176/SQ177 should map here. |
| v221-v222 | Privacy-preserving policy proof and separation-of-duty proof. | Admission calculus, authority topology. | Keep as proof-envelope instances; verifier authority must map to authority topology/admission calculus. |
| v223-v228 | Ledger compaction admission, quorum intersection, replay semantics, topology settlement, verifier-role settlement, finality evidence. | Replay semantics, settlement/finality, obstruction evidence, authority topology. | Keep as high-value generic proof families; do not turn each into another recursive witness ladder without compiler proof. |

## Recursion Stop Rule

A future implementation should not add a new recursive proof layer when all of the following are true:

1. The proposed name appends another combination of witness, authority, transition, admission, proof, record, topology, checkpoint, settlement, or finality to an existing lane.
2. The guarantee can be expressed as one of the eight primitive families.
3. The implementation would require a new nearly identical replay function, migration, and test shape for each artifact kind.
4. The only reason for the layer is that the previous proof object can itself be questioned.

When those conditions hold, the next implementation must strengthen a generic primitive instead:

- generic admitted artifact record;
- generic authority topology compiler;
- generic proof-envelope verifier authority;
- generic recovery-lane compiler;
- generic obstruction algebra;
- generic replay-semantics manifest/state-transformer admission;
- generic settlement/currentness head;
- generic harness/procedure admission.

## Active 10-Question Substrate Backlog

The active backlog remains SQ176-SQ185, now annotated by primitive family:

1. SQ176, bootstrap-settlement transparency: settlement/finality plus obstruction evidence.
2. SQ177, bootstrap-settlement record authority: authority topology plus admission calculus.
3. SQ178, privacy-proof verifier authority: authority topology plus admission calculus.
4. SQ179, separation-of-duty verifier authority: authority topology plus admission calculus.
5. SQ180, compaction-checkpoint witness/currentness: replay semantics plus obstruction evidence.
6. SQ181, heterogeneous quorum composition: authority topology plus settlement/finality.
7. SQ182, semantics migration/state transformer: replay semantics plus admission calculus.
8. SQ183, settlement-authority admission/currentness: settlement/finality plus authority topology.
9. SQ184, transparency-head gossip/currentness: obstruction evidence plus settlement/finality.
10. SQ185, finality-evidence gossip/custody/retention: obstruction evidence plus settlement/finality.

## Failed Assumption Ledger

- Falsified: a long chain of specialized proof layers is the natural final form of the substrate. v141 already showed hand repetition is private implementation memory until compiled into obligations.
- Falsified: line-count growth by itself proves the work is junk. v62-v228 contain real local guarantees; the failure is lack of compression, not absence of mechanism.
- Downgraded: every "who authorizes the authorizer" question needs a new local proof family. Many should instead compile through authority topology, admission calculus, and replay semantics.
- Open: whether the eight primitive families are sufficient for Pi Harness/procedure admission. Current judgment is no; harness admission should become the next explicit primitive after this back-map.

## Proof Status

Implemented in this slice:

- Versioned research artifact `v229-substrate-primitive-backmap-2026-07-01.md`.
- Back-map from v62-v228 to eight primitive families.
- Recursion stop rule for future Arrowsmith substrate work.
- Active SQ176-SQ185 annotations by primitive family.
- Static validator `scripts/validate-arrowsmith-primitives.ts` plus `pnpm validate:arrowsmith-primitives`.

Not implemented in this slice:

- TypeScript `@pm/agent-state` refactor.
- Deletion or rollback of any existing proof layer.
- Generic admission calculus implementation.
- Generic authority topology compiler.
- Harness admission kernel.

Validation:

- This artifact is falsifiable by future ledger/code review: any new recursive proof layer should either cite a primitive-family gap or be rejected as substrate bloat.
- `pnpm validate:arrowsmith-primitives` must pass before future v230+ research slices count as governed substrate research.
