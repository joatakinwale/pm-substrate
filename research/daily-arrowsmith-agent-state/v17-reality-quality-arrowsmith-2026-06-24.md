# Agent-State Arrowsmith v17: Reality Qualities Cross-Paper Review

Date: 2026-06-24
Status: research-only continuation
Scope: strongest cross-disciplinary analogues for "state without representation as authority"

## Protocol note

This continuation follows v16's correction: a block event is not enforcement unless terminal action outcomes partition by stable action id. I fetched `origin/main` before writing and confirmed `HEAD` and `FETCH_HEAD` both resolve to `75a8f589730118dd19a5b42c0855f72b26fd125b`. I did not pull because the worktree already contained unrelated local changes:

- `pnpm-lock.yaml`
- `docs/state-validation/local-agent-lab-scenarios.md`
- `docs/state-validation/reality-qualities.md`
- `packages/local-agent-lab/`

Those files are not interpreted as evidence for this research slice.

## Question

The previous research established that reality has no state problem because it does not consult a representation of itself. The user then asked for the stronger next step:

1. Take the strongest systems/papers from the ten "reality qualities" matrix.
2. Review those papers.
3. Use an Arrowsmith-style cross-map to find relationships, similarities, and new ideas for solving agent/workspace state.

This file treats "Arrowsmith" as a literature-bridging method:

- A-literature: systems that avoid state drift by refusing representation as authority.
- B-terms: mechanisms that recur across those systems.
- C-literature: agent/workspace/project state failures under partial observation.
- Output: candidate bridges that are not obvious from any one field alone.

## Strongest paper set

The strongest sources are not the ones that match one reality quality. They are the ones that explain multiple qualities at once.

| Cluster | Papers reviewed | Main mechanism |
| --- | --- | --- |
| Quotienting surplus representation | Earman and Norton 1987; Yang and Mills 1954; Marsden and Weinstein 1974; Abramsky and Brandenburger 2011; Rutten 2000 | Coordinates, gauges, labels, local assignments, and encodings are not state unless they survive an equivalence or compatibility test. |
| Enabled transition semantics | Murata 1989; Winskel 1987; Meseguer 1992 | A drawn/intended transition does not happen because it is described; it happens only when enabled and fired under the system rules. |
| Ordered committed history | Schneider 1990; Lamport 1978 and 1998; Ongaro and Ousterhout 2014; Castro and Liskov 1999 | Private replicas and local clocks are not authority; an ordered committed command history is. |
| Transactional admission | Mohan et al. 1992; Kung and Robinson 1981; Cahill, Rohm, and Fekete 2008; Herlihy and Wing 1990; Herlihy and Moss 1993 | Tentative reads/writes become state only after validation, logging, serialization, or linearization. |
| Content identity and tamper-evident history | Merkle 1987; Haber and Stornetta 1991; Quinlan and Dorward 2002 | Identity and history can be anchored by content and hash links rather than mutable labels. |
| Convergent replicated state | Shapiro et al. 2011; DeCandia et al. 2007 | Replicas may hold private state, but merge/version rules prevent any one replica's memory from becoming final by assertion. |
| Feedback control and living state | Kalman 1960; Garcia, Prett, and Morari 1989; Barkai and Leibler 1997; Billman 2020; Bongard, Zykov, and Lipson 2006 | Goal-directed systems stay coherent through fresh feedback, not static memory. |
| Boundary/provenance/social state | Star and Griesemer 1989; Wegner, Erber, and Raymond 1991; Buneman, Khanna, and Tan 2001 | Cross-group state requires invariant boundary objects, expertise routing, and lineage; private interpretations remain local. |

## Paper review

### 1. Quotienting surplus representation

**Earman and Norton, "What Price Space-Time Substantivalism?" (1987).** The hole argument shows that if manifold point labels are treated as physical state, general relativity appears indeterministic under diffeomorphic transformations. The useful bridge is not the metaphysics itself; it is the engineering pattern: labels can be surplus structure. A valid state system should quotient away distinctions that do not change operational consequences.

**Yang and Mills (1954) plus Marsden-Weinstein reduction (1974).** Gauge theory and symplectic reduction treat many mathematical descriptions as equivalent presentations of one physical state. The bridge is a "state quotient": do not let every syntactic representation become a distinct operational state. State identity should be defined over invariants: subject, tenant, authority scope, workflow position, version, evidence, and effect.

**Abramsky and Brandenburger, "The Sheaf-Theoretic Structure of Non-Locality and Contextuality" (2011).** Local sections may be internally coherent but still fail to glue into a global section. This is the cleanest mathematical analogue for departments, tools, and agents. Sales' view, legal's view, engineering's view, and an agent's view are local sections. A global project state exists only when overlap constraints are satisfied. If not, the output should be an obstruction certificate, not a merged story.

**Rutten, "Universal Coalgebra" (2000).** Coalgebra shifts identity from internal representation to observable transition behavior. This bridges directly to agents: two memories may differ internally, but if they produce the same admissible observations/actions under the same constraints, they can be operationally equivalent. Conversely, two identical summaries can be different states if their allowed actions differ.

**New bridge:** operational state should be an equivalence class, not a record shape. Agent memory, chat, summaries, local files, and projections are representatives. The substrate should identify which representative differences matter and which are surplus.

### 2. Enabled transitions, not described transitions

**Murata, "Petri Nets: Properties, Analysis and Applications" (1989).** A transition exists in the diagram but does not fire unless its input places hold the needed tokens. Firing consumes and produces tokens. This is a strong analogue for action proposals: "I will do X" is a transition label; it is not a state change. The proposal is effective only if its preconditions are enabled, and firing must consume/update the relevant operational tokens.

**Winskel event structures (1987).** Event structures make causality and conflict explicit. Some events depend on others; some are mutually exclusive. This sharpens v16: accepted, blocked, rejected, held, and superseded are not just labels. They are conflict sets over a stable action id.

**Meseguer rewriting logic (1992).** Rewriting logic treats computation as local state transitions modulo equations. It supplies a vocabulary for "normal form" and confluence. If a workflow admits multiple rewrite paths, they must converge to the same terminal operational state or expose non-confluence.

**New bridge:** terminal outcome partitioning is a confluence/linearization problem. For a stable action id, all proposal/review/evidence paths must reduce to exactly one terminal action normal form.

### 3. Ordered committed history

**Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach" (1990).** Replicas agree when deterministic state machines process the same requests in the same order. The bridge is not simply "use a log"; it is "make action validity a property of ordered admission." A local agent cannot decide the nth transition by memory; the system decides the nth transition by accepted order.

**Lamport, "Time, Clocks, and the Ordering of Events" (1978).** Distributed systems do not need a perfectly shared physical clock to reason about order. They need a disciplined happened-before relation. This maps to agent work: a state review, evidence admission, approval, write, receipt, and projection refresh need partial order metadata even when wall-clock timestamps are ambiguous.

**Paxos/Raft/PBFT (Lamport 1998; Ongaro and Ousterhout 2014; Castro and Liskov 1999).** Consensus systems abolish private authority by requiring quorum/term/commit rules. A replica can hold a private log, but only committed entries drive the replicated state machine.

**New bridge:** multi-agent work should not aim for all agents to share one memory. It should require all agents to write proposals into a committed action/evidence log, then derive their working views from that log.

### 4. Transactional admission

**Mohan et al., ARIES (1992).** Write-ahead logging distinguishes the mutable data page from the recovery authority. State can be reconstructed because mutations are logged before they become durable effects.

**Kung and Robinson optimistic concurrency control (1981).** Private work is allowed. It becomes real only after validation. This is the best answer to the "separate worktree" concern: private state is healthy when it is a speculative workspace with a validation/admission boundary.

**Cahill, Rohm, and Fekete serializable snapshot isolation (2008).** Snapshot reads are provisional. The database may abort a transaction if its dependencies cannot fit a serial order. This maps directly to stale agent observations: the read set must validate against the current admissible state before mutation.

**Herlihy and Wing linearizability (1990).** Concurrent operations are correct when each appears to occur at one point between invocation and response. This supplies a useful interface law for action outcomes: each write-capable action should have one linearization/admission point.

**New bridge:** the state solution needs an "admission kernel": an explicit boundary where proposed changes either become operational state or remain non-authoritative evidence. The current workflow evidence-binding gate is an early form; the proof is incomplete until all write-capable transports use it.

### 5. Content identity and history integrity

**Merkle trees (1987), Haber-Stornetta timestamping (1991), Venti content-addressed storage (2002).** These systems use content and hash links to make identity and history inspectable. Mutable names remain useful handles, but they are not identity.

**New bridge:** every state-bearing artifact should have two identities:

1. a mutable operational handle for humans/tools;
2. an immutable content/evidence digest for replay and admission.

This is already partially present in state-review artifacts and event provenance. The next bridge is to require the same content/evidence digest discipline for terminal action outcomes, certificates, receipts, and PM handoffs.

### 6. Convergent replicated state

**Shapiro et al., CRDTs (2011).** CRDTs show how replicas can converge without central locking when operations/merges have the right algebraic properties. This solves convergence for specific data types, not arbitrary organizational truth.

**Dynamo (DeCandia et al. 2007).** Version vectors expose conflicting versions rather than hiding them. This bridge matters because "eventual consistency" is safe only when conflict is surfaced as state, not silently resolved by stale private belief.

**New bridge:** pm-state should distinguish mergeable conflicts from authority conflicts. Some updates can commute. Others require terminal authority. Treating every conflict as human escalation wastes tokens and time; treating every conflict as mergeable creates silent corruption.

### 7. Feedback control and living state

**Kalman filtering (1960).** The system does not keep a fixed estimate; it recursively updates a state estimate as observations arrive.

**Model predictive control (Garcia, Prett, Morari 1989).** A controller repeatedly replans from fresh state. The plan is not authority; the next control action is chosen after updating from measured state.

**Homeostasis and chemotaxis (Billman 2020; Barkai and Leibler 1997).** Goal-like systems do not avoid state drift by perfect memory. They avoid it by coupling action to fresh feedback.

**Bongard, Zykov, and Lipson (2006).** A robot can recover from damage by updating its self-model through action-observation loops. The bridge is that self-models are useful only when re-grounded against consequence.

**New bridge:** objectives create the road, but feedback keeps the actor on it. Agent objectives should be bound to periodic current-state refresh, target-side receipts, and final-state verification. "Plan complete" is not equivalent to "world reached target state."

### 8. Boundary objects, transactive memory, and provenance

**Star and Griesemer (1989).** Boundary objects are robust enough to maintain identity across groups while flexible enough for local use. This is the strongest social-science bridge for multi-department project state.

**Wegner, Erber, and Raymond (1991).** Transactive memory is not shared total memory; it is knowing who knows what. This supports source steward, authority owner, and escalation owner as operational state fields.

**Buneman, Khanna, and Tan (2001).** Data provenance asks why and where data appears. This supplies the right distinction between a claim and its lineage.

**New bridge:** a project state artifact should not try to erase departmental perspectives. It should carry an invariant core plus role projections. Each projection may adapt language and visible detail, but must preserve the same action id, subject, authority, evidence refs, terminal outcome, and unresolved conflicts.

## Arrowsmith connection map

### Cross-field B-terms

The strongest shared mechanisms are:

1. **Quotient:** remove representational distinctions that do not affect operational behavior.
2. **Compatibility:** local views become global only if overlaps agree.
3. **Enabledness:** a proposed transition is inert until preconditions hold.
4. **Admission:** tentative work becomes state at a guarded boundary.
5. **Order:** accepted transitions need a causal/serial/linearized order.
6. **Digest:** identity and replay rely on content/evidence hashes, not mutable labels.
7. **Lease/status:** authority expires unless refreshed or status-checked.
8. **Feedback:** action must remeasure consequence.
9. **Projection:** role-specific views are derived from an invariant core.
10. **Obstruction:** conflict is first-class evidence that a global state cannot yet be formed.

### Non-obvious bridges

| Source mechanism | Target state problem | New idea |
| --- | --- | --- |
| Gauge quotient / bisimulation | Agents disagree because their memories have different surface forms | Define operational equivalence over allowed actions/evidence, not text similarity. |
| Sheaf gluing | Departments each have coherent but incompatible local truth | Add local-view sections and overlap checks; emit obstruction artifacts when no global projection exists. |
| Petri net enabledness | Agents treat plan text as action readiness | Model proposal review as enabledness; no enabled token means no firing. |
| Event structures | Blocked and accepted can coexist as events | Make terminal outcomes conflict events in one exclusivity set. |
| Linearizability | Concurrent agents need one action reality | Require one admission/linearization point for write-capable actions. |
| OCC / SSI | Agent observations go stale between read and write | Validate declared/observed read sets at admission time; abort or refresh on stale dependency. |
| ARIES/WAL | Side effects can happen outside the log | Require log/evidence binding before durable side effect; receipt after effect. |
| CRDT algebra | Some conflicts do not need human review | Classify conflicts as mergeable, authority-conflicting, invariant-violating, or evidence-missing. |
| MPC/homeostasis | Objectives create drift risk | Recede/replan from current state at each high-consequence step. |
| Boundary objects | PM artifacts must serve many roles | Use invariant artifact core plus role projections with projection-drift checks. |

## Candidate concepts for pm-substrate

### 1. Operational equivalence classes

Current artifacts preserve exact JSON and hashes. The new idea is to add an explicit equivalence layer:

```text
representatives: memory, chat, source row, projection, department report
equivalence rule: same subject + tenant + authority + workflow position + allowed actions + evidence refs
state identity: equivalence class, not representative text
```

This would reduce false conflicts caused by different wording while still catching differences that affect action validity.

### 2. Local-view sections and obstruction artifacts

Treat department/agent/tool views as local sections over shared subjects. A global projection is admissible only when overlaps agree on required fields. If not, emit an obstruction artifact:

```text
subject: engagement/x
local sections: sales, legal, engineering, agent-risk
overlap failure: contract effective date differs between legal and CRM
allowed action: request resolution, not proceed
```

This is a cleaner form of conflict handling than generic warnings.

### 3. Terminal action normal form

v16's terminal partition becomes more precise:

```text
proposal + evidence + policy + current view + receipts/status
  -> accepted | blocked | rejected | held | superseded | escalated
```

The normal form must be unique per stable action id. Any attempt to admit a second terminal outcome is a confluence failure.

### 4. Admission kernel

The write-binding gate should evolve into a central admission kernel for all write-capable transports. Required inputs:

- stable action id
- state-review artifact id/hash
- evidence-admission review ids
- evidence status checks
- policy-transition check
- authority owner
- terminal outcome normal form
- target receipt or explicit no-side-effect outcome

### 5. Evidence leases and status currentness

Leases and Spanner-like uncertainty windows suggest that evidence authority should not be only `validUntil`. It should include:

- status authority
- checkedAt
- revocation/suspension epoch
- permitted use
- stale policy
- required refresh condition

This matches v15's status-currentness frontier.

### 6. Conflict algebra

Borrow from CRDTs but keep authority boundaries:

| Conflict class | Handling |
| --- | --- |
| Commutative update | merge automatically |
| Same fact, different wording | quotient/equivalence |
| Source freshness conflict | refresh or lease check |
| Source authority conflict | route to owner |
| Workflow invariant conflict | block |
| Terminal outcome conflict | reject second terminal outcome |
| Missing evidence | hold/request evidence |

### 7. Receding-horizon agent execution

Agent execution should resemble model predictive control:

```text
observe current state -> propose next action -> admit/hold/block -> execute -> receipt -> refresh -> replan
```

Do not admit multi-step plans as if every future step is already valid.

### 8. Projection-drift checks

Boundary-object theory implies role-specific dashboards can diverge semantically. Projection drift should be measured:

- invariant action ids preserved
- terminal outcomes preserved
- unresolved conflicts preserved
- authority/evidence refs preserved
- role-specific wording does not imply different allowed actions

## Relationship to existing repo frontier

This research does not replace the existing frontier. It strengthens it.

| Existing frontier | Cross-paper support | New precision |
| --- | --- | --- |
| Terminal outcome partitioning | Event structures, rewriting confluence, linearizability | One terminal normal form per stable action id. |
| Evidence status-currentness | Leases, Spanner, OCC/SSI | Evidence validity is a lease/status check, not a static field. |
| Durable certificate/status stores | Haber-Stornetta, Merkle, ARIES | Evidence identity needs digest plus live status authority. |
| Target-side receipts | WAL, feedback control, homeostasis | Dispatch is proposal/execution attempt; receipt is consequence evidence. |
| Runtime write binding | Schneider, Raft, ARIES, SSI | All writes must pass one admission kernel before side effects. |
| PM handoff burden metrics | Boundary objects, transactive memory | PM state should preserve invariant core while allowing role projections. |
| Conflict handling | Sheaf gluing, CRDTs, version vectors | Conflicts should be classified by algebra/authority, not lumped together. |

## New falsification criteria

1. **Equivalence failure:** two records are treated as different operational states even though they have the same subject, authority, evidence refs, workflow position, and allowed actions.
2. **False quotient:** two records are merged even though their allowed actions or evidence duties differ.
3. **Local-view overclaim:** a role/department projection is treated as global state without overlap compatibility.
4. **Obstruction suppression:** incompatible local sections are summarized away instead of emitted as a blocking/held artifact.
5. **Non-confluent action lifecycle:** the same stable action id can admit two terminal outcomes.
6. **Unleased evidence:** old evidence supports action without decision-time status/currentness check.
7. **Projection drift:** a role projection hides a blocking conflict or changes implied allowed actions.

## Recommended next implementation slice

The smallest high-leverage slice is not a new dashboard. It is a pure `terminal action normal form` plus `local-view obstruction` fixture set.

1. Add a pure `ActionOutcomeEnvelope` or equivalent primitive:
   - `actionId`
   - `tenantId`
   - `subject`
   - `proposalReviewId`
   - `stateReviewArtifactHash`
   - `evidenceAdmissionReviewIds`
   - `statusCheckRefs`
   - `policyTransitionRef`
   - `terminalOutcome`
   - `outcomeHash`
2. Add an invariant that exactly one terminal outcome may exist per `actionId`.
3. Add a local-view overlap evaluator:
   - inputs: role/tool/department sections
   - outputs: global projection or obstruction artifact
4. Add fixtures:
   - accepted plus blocked same action id -> reject second terminal
   - legal/CRM effective-date mismatch -> obstruction, not summary
   - two differently worded but operationally equivalent states -> quotient
   - same summary but different allowed action -> no quotient

This moves the "reality qualities" research from metaphor into executable checks.

## Source links

- Earman and Norton, 1987, "What Price Space-Time Substantivalism?": https://sites.pitt.edu/~jdnorton/papers/BJPS1987_holearg.pdf
- Yang and Mills, 1954, "Conservation of Isotopic Spin and Isotopic Gauge Invariance": https://www.osti.gov/biblio/4406667
- Marsden and Weinstein, 1974, "Reduction of Symplectic Manifolds with Symmetry": https://inspirehep.net/literature/1685009
- Abramsky and Brandenburger, 2011, "The Sheaf-Theoretic Structure of Non-Locality and Contextuality": https://iopscience.iop.org/article/10.1088/1367-2630/13/11/113036
- Rutten, 2000, "Universal Coalgebra: A Theory of Systems": https://doi.org/10.1016/S0304-3975(00)00056-6
- Murata, 1989, "Petri Nets: Properties, Analysis and Applications": https://www.cs.unc.edu/~montek/teaching/spring-04/murata-petrinets.pdf
- Winskel, 1987, "Event Structures": https://doi.org/10.1007/3-540-17906-2_31
- Meseguer, 1992, "Conditional Rewriting Logic as a Unified Model of Concurrency": https://doi.org/10.1016/0304-3975(92)90182-F
- Schneider, 1990, "Implementing Fault-Tolerant Services Using the State Machine Approach": https://www.cs.cornell.edu/fbs/publications/SMSurvey.pdf
- Lamport, 1978, "Time, Clocks, and the Ordering of Events in a Distributed System": https://lamport.azurewebsites.net/pubs/time-clocks.pdf
- Lamport, 1998, "The Part-Time Parliament": https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf
- Ongaro and Ousterhout, 2014, "In Search of an Understandable Consensus Algorithm": https://raft.github.io/raft.pdf
- Castro and Liskov, 1999, "Practical Byzantine Fault Tolerance": https://pmg.csail.mit.edu/papers/osdi99.pdf
- Mohan et al., 1992, "ARIES": https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Kung and Robinson, 1981, "On Optimistic Methods for Concurrency Control": https://www.eecs.harvard.edu/~htk/publication/1981-tods-kung-robinson.pdf
- Cahill, Rohm, and Fekete, 2008, "Serializable Isolation for Snapshot Databases": https://people.eecs.berkeley.edu/~kubitron/courses/cs262a-F13/handouts/papers/p729-cahill.pdf
- Herlihy and Wing, 1990, "Linearizability": https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf
- Herlihy and Moss, 1993, "Transactional Memory": https://doi.org/10.1145/173682.165164
- Merkle, 1987, "A Digital Signature Based on a Conventional Encryption Function": https://link.springer.com/chapter/10.1007/3-540-48184-2_32
- Haber and Stornetta, 1991, "How to Time-Stamp a Digital Document": https://doi.org/10.1007/BF00196791
- Quinlan and Dorward, 2002, "Venti: A New Approach to Archival Data Storage": https://www.usenix.org/conference/fast-02/venti-new-approach-archival-data-storage
- Shapiro et al., 2011, "Conflict-Free Replicated Data Types": https://doi.org/10.1007/978-3-642-24550-3_29
- DeCandia et al., 2007, "Dynamo": https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store
- Kalman, 1960, "A New Approach to Linear Filtering and Prediction Problems": https://doi.org/10.1115/1.3662552
- Garcia, Prett, and Morari, 1989, "Model Predictive Control: Theory and Practice": https://doi.org/10.1016/0005-1098(89)90002-2
- Barkai and Leibler, 1997, "Robustness in Simple Biochemical Networks": https://pubmed.ncbi.nlm.nih.gov/9202124/
- Billman, 2020, "Homeostasis: The Underappreciated and Far Too Often Ignored Central Organizing Principle of Physiology": https://doi.org/10.3389/fphys.2020.00200
- Bongard, Zykov, and Lipson, 2006, "Resilient Machines Through Continuous Self-Modeling": https://doi.org/10.1126/science.1133687
- Star and Griesemer, 1989, "Institutional Ecology, Translations and Boundary Objects": https://doi.org/10.1177/030631289019003001
- Wegner, Erber, and Raymond, 1991, "Transactive Memory in Close Relationships": https://psycnet.apa.org/record/1991-22430-001
- Buneman, Khanna, and Tan, 2001, "Why and Where: A Characterization of Data Provenance": https://doi.org/10.1007/3-540-44503-X_20
