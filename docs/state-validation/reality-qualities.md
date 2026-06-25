# The Ten Reality Qualities — pm-substrate foundational criteria

> Source: Emmanuel, 2026-06-24 (Telegram). This is the theory the substrate is
> built to satisfy. Everything else — taxonomy, metrics, the local-agent
> testbed — is downstream of this. Read this FIRST.

## Core reframe

Reality has no state problem. Agents do. The difference is not intelligence —
it is that **reality has no representation layer**. The current state IS the
thing itself; reality does not maintain a model of itself that can drift.

Agents act from representations (memory, embeddings, summaries, chat history,
tool traces, partial observations). Representations can be stale, lossy,
incomplete, or contradictory. Every agent state failure is a representation
being treated as authority.

**The substrate's job is not to remember project reality. It is to CONSTITUTE
project reality within a governed operational boundary — by eliminating
representation as authority.**

## The ten qualities (and their substrate implications)

1. **No Representation Layer** — reality is not a model of itself. → Memory,
   chat, agent output, department belief, tool response are NOT state. They are
   representations. State must be constituted elsewhere.

2. **State Identity** — what reality is == its actual configuration; reality
   does not "think it is" anything. → Substrate state is not "a record about the
   work"; it is the admitted decision/event/projection structure itself.

3. **No Private State (the big rule)** — reality has no hidden competing
   authoritative copy. → Private local state MAY exist, but has NO AUTHORITY
   until admitted. Worktrees/drafts are proposal spaces, not truth.

4. **Continuous Transition** — reality never jumps snapshot→snapshot; it
   continuously transitions. The state problem appears at pause/summarize/
   resume/compress/handoff. → Resume = replay/rebase, NOT "remember where we
   were." Every mutation has a predecessor, authority, admissibility check,
   consequence.

5. **Causal Closure** — `next admitted state = prior admitted state + admitted
   transition`. Not "a narrator deciding what probably happened." → Anything not
   traceable through this relation is not operational state.

6. **No Unadmitted Mutation (probably the most important)** — reality cannot
   have a real event that did not affect reality. → The substrate must PREVENT
   operational action from bypassing admission. If a department, agent, MCP
   tool, or workflow can mutate the world without producing an admitted
   transition, the substrate has a hole in reality.

7. **No Stale Self** — reality is always exactly current; only observers/
   reports/dashboards/memories are stale. → Projections may be stale;
   authoritative state cannot. A projection carries version, valid window,
   source refs, admissibility status. **If stale, it cannot authorize action.**

8. **No Conflicting Terminal Outcomes** — reality cannot have two incompatible
   actual outcomes for the same event in the same frame. → Terminal partition
   problem: for a stable action id, admit EXACTLY ONE terminal operational
   outcome. Accepted and blocked cannot both be operationally true. (This is the
   exact defect found + retired 2026-06-18/19.)

9. **Embodied Consequence** — only actual transitions change reality; a plan,
   a proposal, a hallucinated result do not. → proposal / evidence / approval /
   execution / receipt / consequence are DISTINCT. Agent saying "I did X" is not
   X. Tool receipt or admitted target mutation is closer to X.

10. **Boundary Honesty** — reality is total; an engineered system is not. → The
    substrate cannot become reality. Inside boundary: `state = admitted
    transition history + valid projection`. Outside boundary: `unknown reality =
    missing evidence`. The substrate does not need omniscience; it needs
    REFUSAL. It refuses to let unknowns become state.

## The five separable things a purposeful agent has (drift source)

desired state · actual external state · observed state · remembered/interpreted
state · authorized action state.

**Drift = acting as if those five are the same.** Reality only has *actual
state*; that is the core difference. An objective does not create the state
problem — it makes state error CONSEQUENTIAL ("off course" only exists relative
to a destination). Homeostats/thermostats/DBs/workflows avoid drift by refusing
to let an old private representation directly control reality: sense, compare,
act, sense again — never trust the memory of the value.

## What "solving it" means

Not one borrowed mechanism. A COMPOSITION of reality-like qualities:
**identity · admission · transition · replay · authority · consequence ·
projection · refusal.**

The substrate is intellectually strong iff it can say: *it does not remember
project reality; it constitutes project reality within a governed operational
boundary.*

## Arrowsmith search map (representation-is-not-authority systems)

- Physics/formal: general relativity, gauge theory, causal sets, Petri nets,
  term rewriting, bisimulation, sheaf theory → state identity.
- Computing: event sourcing, Raft (ordered replicated command application),
  PostgreSQL WAL (durability via log-before-durable), serializable txns,
  Spanner, Git (content identity), Bitcoin, CRDTs (convergence w/o central
  memory, but NOT authority) → transition history + transactional admission.
- Institutional: accounting ledgers (admitted entries), title registries +
  courts/dockets (authority-scoped reality), chain of custody, UCC filings,
  corporate minutes, FDA batch release → institutional reality by admission.
- Biological/control: homeostasis, immune tolerance, chemotaxis, quorum
  sensing, autopoiesis, thermostats, Ashby's homeostat → continuous
  self-maintenance (setpoint w/o trusting memory of the value).
- Collaboration: Google Docs / M365 coauthoring (server revision history +
  pending/acknowledged local edits), GitHub PRs, Jira workflows, Incident
  Command System, NASA project gates, Figma branching, boundary objects,
  transactive memory → the human version: many belief states fighting to become
  operational state.

Eight common mechanisms: (1) quotient away surplus representation; (2) admit
transitions not beliefs; (3) preserve ordered history; (4) require current
feedback before action; (5) make local copies proposals; (6) define authority
boundaries; (7) force conflicts into explicit resolution; (8) make terminal
outcomes mutually exclusive.

## Raft as the computing-system donor (Ongaro & Ousterhout 2014)

Raft manages a replicated log so many nodes converge WITHOUT trusting any
node's private memory — the multi-agent state problem exactly. The mapping:

| Raft | pm-substrate | Reality quality |
|------|--------------|-----------------|
| log index | `events.seq` | #5 causal closure (position on the chain) |
| committed entry (majority-replicated) | admitted transition | #6 No Unadmitted Mutation |
| `apply log[lastApplied]` strictly AFTER `commitIndex` | operational state mutates ONLY from admitted transitions | #6 + #9 embodied consequence |
| log-matching (index+term must match prevLog) | hash-chain `prior_event_hash` | #8 no conflicting history |
| leader-completeness (stale leader can't win/commit) | stale projection cannot authorize action | #7 No Stale Self |
| strong leader: entries flow leader→followers only | single Postgres authority; reads = projections | #3 No Private State (as authority) |
| state machines are deterministic, replay identical log | replay/rebase, not "remember where we were" | #4 continuous transition |

**The rule to steal (the bar):** in Raft there is NO code path that applies an
uncommitted entry — `apply` is strictly downstream of `commit`. The substrate
analog: NO code path may make an action operational without an admitted
transition. The stale-state advisory-gate defect (2026-06-18) was exactly a
violation of this — an un-admitted (blocked) action still became operational
(accepted). Raft proves the gate must be STRUCTURAL, not advisory.

**What the substrate does NOT need from Raft:** leader election, majority
quorum, membership changes — those solve fault-tolerant replication across
UNRELIABLE nodes. The substrate has ONE authoritative Postgres, so it inherits
Raft's *discipline* (commit-before-apply, ordered log, log-matching) without
the distributed-consensus machinery. CRDTs are the opposite trade: convergence
without a leader, but NO authority — a partial donor only.

## Direct implications for the local-agent testbed (Axis C)

- **Staleness = #7 + #5.** A representation is stale iff admitted transitions
  exist with seq > the seq it was built from. Measured against the admitted
  transition log (causal chain position), NOT wall-clock age. TTL is a source
  pre-declaring its own invalidation window — convenience, not ground truth.
- **Measure at the admission boundary (#9), not the model's text.** `stale_action`
  = an admitted transition built from a superseded read. Agent SAYING "buy" is
  not the action; the admitted transition is.
- **Arm B win condition = REFUSAL (#10 + #6).** Substrate refuses to admit the
  stale-based action → no conflicting terminal outcome exists. The metric falls
  out of what got admitted, never hardcoded.
- **No Unadmitted Mutation (#6) is the integrity guard for the harness itself:**
  if the agent can change the world without going through admission, the test is
  void — we'd be measuring a hole, not the substrate.
