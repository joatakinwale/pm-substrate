# pm-substrate: Focused Agent-State Path vs. Current Direction

**Strategic research memo — 2026-07-01**
**Question:** What could a focused "solve the agent-state problem well, and nothing more" path achieve, versus the current direction of the codebase — evaluated against the stated objective: *"solve the agent-state problem AND implement project-management methodologies into multi-agents as governance"*?

---

## 0. Executive summary

The repo contains **two projects wearing one name**. The first is a disciplined, small, well-factored substrate for governed agent state — roughly 35,000 lines across `@pm/types`, `@pm/graph`, `@pm/events`, `@pm/registry`, `@pm/workflow`, `@pm/projections`, `@pm/continuity`, `@pm/capability-kit`, and the first ~15,000 lines of `@pm/agent-state`. It already contains every primitive both halves of the objective need. The second is a Byzantine-provenance tower that consumed June: **85,134 lines in a single file** (`packages/agent-state/src/index.ts` — 70.6% of all non-test, non-dist package source), **1,363 of its 1,610 exports** (85%) named some combination of admission/witness/authority/quorum/seal/proof/settlement/epoch, and **123 of 147 DB migrations** building witness-of-witness ladders whose table names had to be hand-abbreviated (`finalizer_proof_adm_wit_auth_trans_adm_wit_auth_trans_adms`) to fit Postgres's 63-character identifier limit. The tower is consumed by almost nothing: outside `agent-state` and its own 53,444-line test file, the quorum/seal/witness vocabulary appears **six times** in the entire codebase. Meanwhile the last ~24 commits pivoted to shipping a full second product (`plugged_in_social/`, 417 source files, Python/FastAPI + frontend) inside the monorepo.

Against the objective, the second half — **PM methodologies as multi-agent governance — has zero representation in the repo**: no mention of RACI, methodology, scrum, kanban, standup, or critical path anywhere in `docs/`. Yet the lean core maps onto PM governance almost one-to-one, and the repo's own architecture (Tier-2 profiles) is the correct delivery vehicle for it.

**Recommendation: refocus on Path A.** Extract the lean agent-state core, freeze (do not delete) the authority tower behind a package boundary and a migration gate, move PluggedInSocial to its own repo as a consumer, and spend the recovered capacity building PM-methodology governance as Tier-2 profiles over primitives that already exist. Details and a keep/freeze/cut list in §5.

---

## 1. The agent-state problem, and what "solving it well" minimally requires

### 1.1 The problem, crisply

AI agents (and the humans and tools around them) are **bounded actors operating on partial, stale views of one changing reality, with no durable institutional memory**. Concretely, an agent fails in five recurring ways:

1. **Stale read → wrong write.** It acts on state that changed since it looked.
2. **Unknown authority.** It cannot tell which of several conflicting claims the workspace actually accepts as actionable.
3. **Invisible read-set.** Nobody can tell *what the agent believed* when it acted, so failures can't be diagnosed or governed.
4. **Context loss.** After compaction, restart, or handoff, the agent resumes from chat-history vibes instead of governed state.
5. **Evidence/authority confusion.** External inputs (web results, another agent's memory, a tool trace) get treated as truth instead of as evidence to be admitted.

The repo's own thesis states this precisely (`artifacts/pm_substrate_rewrite.md`, "State Coherence Under Partial Observation," 2026-05-26): *"pm-substrate does not solve reality. It solves governed operational state: what the workspace accepts as actionable, where that claim came from, how fresh it is, which actor may change it, which workflow it belongs to, and how agents resume from it after context loss."* That sentence is the correct scope. Everything needed to honor it already exists in the code.

### 1.2 The minimally sufficient primitives — all already built

| Primitive | What it must do | Where it already exists |
|---|---|---|
| **Governed current-state view** | One reviewable answer to "what is actionable now, from which sources, how fresh, with which conflicts" | `CurrentStateView` (`agent-state/src/index.ts:6540`): `subject`, `observedAt`, `validUntil`, `authorityRule`, `sourceRefs`, `missingSources`, `conflicts`, `allowedActions` |
| **Freshness/staleness gating** | Refuse or warn on reads past their validity window | `@pm/graph/src/staleness.ts`: `ReadStaleness`, `freshnessGate`, `requireFresh`, `FreshnessDecision` |
| **Declared read-set on every action** | The agent states what it believed before acting; the substrate compares declared vs. observed | `ProposedAction.readSet` (`index.ts:6576`), `ReadSetValidationDecision` (warn-first, `mode: "warn"`), `ObservedReadSetComparison` (`index.ts:6632`) |
| **Pre-action review (warn-first)** | Check tenant, subject, staleness, authority, projection version, workflow position — warn, don't block, until trust is earned | `ActionProposalReview` + `ActionProposalReviewEnforcementMode` (`index.ts:6722–6767`); issue codes like `stale_read_ref`, `authority_mismatch`, `workflow_position_mismatch` |
| **Durable, replayable review artifact** | A hash-verifiable record of the state the agent reviewed, replayable later | `StateReviewArtifact` + `StateReviewArtifactHashValidation` (`index.ts:11969–12024`) |
| **Tamper-evident history** | Append-only, hash-chained event log with a verifier | `@pm/events` (`EventChainVerifier`, migration `0015_event_provenance_chain.sql`) |
| **Amnesiac resume** | Checkpoints an agent can resume from with zero chat history | `@pm/continuity` (830 lines total): `ContinuityCheckpoint` with kinds `work / decision / lesson / research / handoff / claim`, hash-verified ledger; validation test T4 in `docs/validation.md` |
| **Evidence ≠ authority** | Admit external inputs (MCP handles, memories, approvals, traces) as evidence with provenance, never as truth | `agent-state/src/external-evidence.ts` (895 lines) — the correctly-sized module in the package |
| **Ownership & permission contracts** | Who may read/write what, enforced at dispatch | `@pm/registry` `Capability` (`interfaces.ts:40`): `readsInterfaces`/`writesInterfaces` (V2 field-level with `ownership`), `requiredPermissions`, `inputSchema` |
| **Process context** | Which workflow/step an action belongs to; evidence required for writes | `@pm/workflow` (6,029 lines): `WorkflowDoc` DAG, `evidenceBindingMode: "require_for_writes"`, retry + dead-letter |
| **Measurement** | Prove agents behave better with the substrate than without | `@pm/evals` (`ActionProposalReviewMetrics`, `StateReviewArtifactMetrics`) + `@pm/local-agent-lab` paired no-substrate/substrate arms against real Ollama agents; T1–T8 and 12 behavior metrics in `docs/validation.md` |

This is the whole problem. A `CurrentStateView` an agent must review, a warn-first proposal gate, a hash-chained log, checkpoints, evidence admission, and an eval harness that measures whether it helps. **"Solving it well" is the disciplined operation and validation of the table above — not the addition of more provenance layers beneath it.** External context agrees: durable checkpointing and resume are rapidly commoditizing in agent frameworks (LangGraph-style thread checkpoints, managed runtime memory), while *governed write paths and approval gates* are the still-open layer (see sources in the appendix). The lean core sits exactly on the defensible layer.

---

## 2. Path A — the focused agent-state substrate

### 2.1 What a lean version delivers

**Shape.** `@pm/agent-state` shrinks from 85k lines to roughly 4–6k (the interfaces and functions cited above plus `external-evidence.ts`); the `agent_state` schema shrinks from 123 migrations to the ~10–15 first-order tables (state-review artifacts, observation contracts, action-outcome envelopes, replay certificates, recovery cuts, continuity checkpoints). Total substrate: ~35–40k lines, ~25–35 tables, every package under 10k lines. A competent engineer — or an agent with a 200k-token context window — can hold the whole thing.

**Agent behaviors enabled (today, not someday):**
- *Review-before-act*: agent fetches `CurrentStateView`, submits `ProposedAction` with declared read-set, receives warnings on staleness/authority/position drift.
- *Amnesiac resume*: session 2 starts from tenant + agent + scope only, resumes open checkpoints, avoids contradicted claims (validation test T4 — already specified).
- *Governed evidence*: web results and peer-agent memories enter as admitted evidence with provenance, never as authority.
- *Post-hoc audit*: replay the `StateReviewArtifact` hash to prove what the agent saw.

**Time-to-value.** Weeks. Nothing new must be invented; the work is extraction, an MCP/HTTP surface (`@pm/substrate-http` already exists and maps 1:1 onto package methods), and running the already-defined T1–T8 evals to publish paired-arm numbers. The `local-agent-lab` is purpose-built for exactly this demonstration.

**Testability.** The lean core's claims are falsifiable with the existing harness ("architecture without falsification criteria is theology" — `docs/validation.md`). Contrast: the tower's claims (quorum intersection among co-located Postgres tables) are not falsifiable by any experiment the repo can run, because there is no second trust domain to disagree.

**Adoption.** A reviewer can audit ~30 tables in an afternoon. A 6-table mental model ("view, contract, proposal, artifact, checkpoint, event") fits in a README. An 85k-line single-file API with `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness...QuorumCertificateWitnessEvidence` in its export list does not get adopted by anyone, including future-you. There is a sharp irony here: **the codebase currently violates its own thesis** — an agent cannot load `agent-state/src/index.ts` into context, so the project about resuming from governed state is itself unresumable from its source.

### 2.2 PM-methodologies-as-governance on the lean core

This is the neglected half of the objective, and it is the cheapest half — because PM methodology concepts map almost one-to-one onto substrate primitives that already exist. Crucially, the repo's own architecture says how to ship it: **methodologies are Tier-2 profiles** (like `profile-agency` and `profile-finance-research`), installed per tenant, with zero substrate edits — which would itself validate the plug-in claim a third time.

| PM concept | Substrate primitive (existing) | What a "methodology profile" adds |
|---|---|---|
| Project plan / process (WBS, phases) | `WorkflowDoc` DAG: `TriggerNode`/`InvokeNode`, conditional edges (`when`) | Plan templates as workflow docs; phase gates as edges |
| Roles & RACI / ownership | `Capability` contract: `writesInterfaces.ownership` = Responsible/Accountable; `readsInterfaces`/`subscribesTo` = Consulted/Informed; `requiredPermissions` = authority matrix, enforced at dispatch (`permission_denied` dead-letter) | A RACI validator: every written interface has exactly one Accountable capability per tenant |
| Approvals / stage gates | `ActionProposalReview` with `ActionProposalReviewEnforcementMode` escalated from warn→require on gated actions; `evidenceBindingMode: "require_for_writes"` in the workflow runtime; human approval as an `InvokeNode` capability | Gate policies per methodology (e.g., "content publishes only after approval capability emits `approved`") |
| Status reports / standups | `ContinuityCheckpoint` kinds `work/decision/handoff` + `@pm/projections` read models + `substrate-dashboard` | A "standup projection": open checkpoints per agent per day |
| Risk register / issue log | `CurrentStateView.conflicts` + `missingSources`; dead-letter table for blocked steps | Risk projection over conflicts and dead letters |
| Baseline & schedule tracking | Hash-chained event log timeline; `workflowPosition` on every observation | Variance projection: planned DAG position vs. observed |
| Definition of done / acceptance | `@pm/evals` metrics + `StateReviewArtifact` replay | Acceptance criteria as eval assertions per deliverable |
| Escalation policy | Warn-first review → `RetryPolicy` → dead-letter with typed reason | Methodology-specific escalation routes |

That table is the objective. Scrum-for-agents, kanban-for-agents, stage-gate-for-agents are each a profile package of maybe 1–2k lines: entity specializations (Sprint, Ticket, Gate as `Engagement`/`Event` specializations), an edge catalog, lifecycle state machines, workflow templates, and gate policies — exactly the structure `@pm/profile-agency` already demonstrates. **None of it needs a single new provenance table.** Note also what the current codebase lacks for this: nothing. The blocker is purely attention.

---

## 3. Path B — the current direction

Two threads: the authority/witness/consensus tower (June), and the PluggedInSocial autonomous agency (the last ~24 commits, all 2026-07-01).

### 3.1 What the tower actually is

Verified by sampling: every first-order artifact (recovery cut, pruning policy, history-root settlement, storage-mutation guard, tombstone checkpoint, witness-ledger checkpoint...) spawns an admission record, then an admission *witness*, then an authority transition for the witness, then an admission *of that transition*, then a witness *of that admission* — four to five reflexive layers deep (migrations `0024`–`0135` are literally this ladder, e.g. `0119_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transitions.sql`), capped by quorum-certificate proofs, compositional quorum-intersection proofs (`0141`), signature-verifier role settlements (`0144`), separation-of-duty proofs (`0139`), privacy-preserving policy proofs (`0138`), and authority-epoch-seal "accountable finality evidence" (`0145`). The SQL is carefully written — append-only with `prevent_*_rewrite()` triggers, thorough CHECK constraints — and the 53,444-line test file exercises it. This is not slop. It is **disciplined over-engineering**: distributed-consensus/BFT provenance semantics implemented inside a single Postgres instance.

**Where such machinery is legitimately needed:** (a) multi-party federations where tenants/operators distrust each other and verification must survive a hostile operator; (b) regulated audit (SOX/FINRA/HIPAA-adjacent) demanding third-party-verifiable non-repudiation; (c) adversarial agent marketplaces where a counterparty's agent may forge history; (d) offline verification by external auditors. These are real markets.

**Why it doesn't buy that here:** all witnesses, quorums, and seals live in the *same database, written by the same process, under the same superuser*. There is one trust domain. A quorum of tables cannot dissent from the DBA; `prevent_rewrite` triggers stop application bugs (worthwhile — and the plain hash-chained event log of `0015` already did) but not a privileged adversary. Genuine Byzantine guarantees would require external anchoring — keys in a KMS, signatures by independent parties, replicas under separate control — none of which exists. So the tower delivers the *vocabulary* of multi-party trust without its *substance*, at the cost of: one 85k-line file (70.6% of package source); identifiers so long they broke Postgres limits and had to be hand-abbreviated into grep-hostile forms (`adm_wit_auth_trans`); 123 migrations that every fresh environment must replay; and an API surface (1,611 exports) no consumer uses — **six references outside the package and its tests**, all in `capability-kit/src/workflow-authority.ts`. Even `ActionProposalReview`, the flagship, is consumed by exactly two packages (`capability-finance-research-ingest`, `evals`).

The repo *diagnosed itself*: the Arrowsmith research chain — 231 files of daily automated research — records at v229 a **"recursion stop rule: future substrate work must strengthen, replace, or falsify [eight primitive families] ... before adding another proof layer"** (`research/index.md`). That rule is an admission that an automated daily loop (research → new proof layer → commit) was minting witness ladders as its default output. The stop rule is correct; this memo's recommendation is to apply it retroactively, not just prospectively.

### 3.2 What the agency pivot buys, and costs

`plugged_in_social/` is a full product: FastAPI backend, frontend, agents, its own Changelog and docker-compose — 417 source files, referencing the substrate in ~8 backend modules (`virtual_agency_orchestration.py`, `integration.py`, `report_next_actions.py`). Per `docs/validation.md` it is "Axis B": a real agency loop (intake → strategy → content → approval → publishing → metrics) that the substrate must govern without prompt-memory shortcuts.

**Legitimate upside:** it is a genuine validation surface with revenue potential, and it forces the substrate to be *usable*, not just correct. `profile-agency` explicitly exists as the anti-fixation falsification test (G4), and the axis-B audit (`pnpm audit:plugged-in-social`) produces paired with/without-substrate proof packets — that is exactly the right epistemic instrument.

**Cost:** it is a *second product* being built simultaneously with a consensus-grade substrate by (per git history: 175 commits, 2026-05-01→2026-07-01) what appears to be one person plus automation. The June evidence is that the tower ate the month ("Add operational state proof authority primitives," "Add durable pruning tombstone head replay," "build projection replay authority chain"); the July 1 batch shows the agency now eating the next one ("autonomous agency domain models/schemas/services/API/approval decisions/command center"). Two moving frontiers, zero motion on the PM-governance half of the objective — whose vocabulary appears nowhere in `docs/`. PluggedInSocial's "approval decisions" are app features in Python, not reusable governance primitives in the substrate; they advance the demo, not the objective.

---

## 4. Head-to-head

| Dimension | Path A (focused core) | Path B (current direction) |
|---|---|---|
| **Fit to objective, half 1 (agent-state)** | Direct: operate + validate the existing primitives; publish T1–T8 paired-arm results | Was solved by ~mid-June at first-order depth; subsequent work added provenance-of-provenance, not new agent behaviors |
| **Fit to objective, half 2 (PM-as-governance)** | Natural next milestone: methodology profiles on existing primitives (§2.2), weeks of work | Absent; indefinitely deferred behind tower + agency product |
| **Comprehension / bus factor** | Whole substrate fits one head or one agent context | 70.6% of source in one 85k-line file; recursive names; abbreviated tables; effectively write-only |
| **Maintainability** | ~30 tables, ~25 migrations | 147 migrations replayed per environment; schema names at PG limits; any change to a low layer ripples through 4–5 witness layers *and* a 53k-line test file |
| **Trust guarantees** | Tamper-*evidence* (hash chains, append-only, replay) — honest about the single trust domain | Byzantine *vocabulary* without a second trust domain; no external keys/parties, so no additional real guarantee |
| **Adoption / explainability** | "Six concepts" pitch; MCP-ready HTTP surface | Unpitchable API (1,611 exports); nobody external can review it |
| **Opportunity cost** | Frees ~a month of run-rate for governance profiles + evals | June: tower. July: second product. Objective half 2: zero |
| **Risk** | Sunk-cost pain; if true multi-party federation becomes the business, some tower concepts return (re-derived with real external parties) | Complexity compounds; the daily automation's default output is another proof layer; agency product drags substrate priorities toward app features |
| **Where PM-governance lands** | Tier-2 methodology profiles — third validation of the plug-in claim | Nowhere in substrate; partially simulated as app code inside PluggedInSocial |

---

## 5. Recommendation

**Refocus on Path A.** The agent-state problem is solved at the primitive level in this codebase; the objective's differentiating half (PM methodologies as multi-agent governance) is unbuilt, cheap, and sits exactly on the layer the market has left open. The tower adds no real trust within one Postgres, and its carrying cost is the whole project's legibility.

**Keep (the substrate):** `@pm/types`, `@pm/graph` (incl. `staleness.ts`), `@pm/events` (incl. `0015` provenance chain), `@pm/registry`, `@pm/capability-kit`, `@pm/workflow` (incl. evidence-binding), `@pm/projections`, `@pm/continuity`, `@pm/tenants`, `@pm/profile-registry`, `@pm/entity-mapping`, `@pm/evals`, `@pm/local-agent-lab`, `@pm/substrate-http`, `substrate-dashboard`, both existing profiles. From `@pm/agent-state`: `CurrentStateView`, `ObservationContract` (+v2 fields), `ProposedAction`/read-set validation, `ObservedReadSetComparison`, `ActionProposalReview` (+enforcement modes), `StateReviewArtifact` + hash replay, action-outcome envelopes, recovery cuts (first-order only), `external-evidence.ts`. Split the survivor into real modules; no file over ~3k lines.

**Freeze (quarantine, don't delete):** everything in `agent-state` matching the admission-witness / authority-transition / quorum / seal / settlement / epoch families → move to a `@pm/agent-state-attest` package (or an archive branch) that nothing imports; gate migrations ~`0025`–`0146` behind an opt-in flag so fresh environments run ~25 migrations, not 147. The work is preserved as research capital — the v229 eight-primitive-family map is genuinely good output — and as a seed if a regulated/multi-party tier ever becomes a funded requirement. If non-repudiation is needed before then, sign `StateReviewArtifact` hashes with one external KMS key: one table, not 123.

**Cut / relocate:** move `plugged_in_social/` to its own repository consuming the substrate over `@pm/substrate-http` (it's a consumer, and its 417 files don't belong in the substrate's blast radius); retire the daily automation's license to add proof layers (enforce the v229 recursion stop rule in CI — e.g., fail any PR adding a table matching `_admission_witness_`); archive the 387KB `Changelog.md`.

**Then build the objective:** `@pm/profile-pm-core` (RACI validator over capability ownership, approval-gate policies, standup/risk projections) and one concrete methodology profile (scrum-for-agents), validated the same way everything else here is validated — paired arms in `local-agent-lab`, T1–T8, metrics in `@pm/evals`. That sequence delivers both halves of the stated objective with code that already exists, in weeks, and makes PluggedInSocial the first *tenant* of PM-governed agents rather than a competing product.

---

### Appendix: key evidence

| Claim | Evidence |
|---|---|
| 85,134-line single file; 1,610 exports | `wc -l packages/agent-state/src/index.ts`; grep `^export` |
| 70.6% of non-test package source | 85,134 / 120,505 lines (packages, excl. `dist`, tests, `._*`) |
| 85% of exports are tower vocabulary | 1,363/1,610 match `admission|witness|authority|quorum|seal|proof|settlement|epoch|attestation|certificate` |
| 123/147 migrations in `agent_state` | `ls db/migrations \| grep -c agent_state` |
| Hand-abbreviated identifiers | `0135_...sql` creates `agent_state.finalizer_proof_adm_wit_auth_trans_adm_wit_auth_trans_adms` |
| Tower nearly unconsumed | `QuorumCertificate\|AuthorityEpochSeal\|AdmissionWitness`: 3,699 hits in `index.ts`, 3,399 in `index.test.ts`, 6 in the rest of the codebase (`capability-kit/src/workflow-authority.ts`) |
| Lean core intact and clean | `CurrentStateView` at `index.ts:6540`; `ObservationContract` at 6640; `ActionProposalReview` at 6767; `StateReviewArtifact` at 11993; `external-evidence.ts` 895 lines; `@pm/continuity` 830 lines; `@pm/workflow` 6,029 lines |
| Self-diagnosed recursion | `research/index.md` (Arrowsmith v229 "recursion stop rule"); 231 files in `research/daily-arrowsmith-agent-state/` |
| Pivot to agency product | last ~24 commits (2026-07-01) all PluggedInSocial; `plugged_in_social/` = 417 source files |
| PM-methodology vocabulary absent | zero matches for `RACI\|methodolog\|scrum\|kanban\|standup\|PRINCE2\|critical path` in `docs/` |

**External sources (light framing):**
- Indium — 7 State Persistence Strategies for Long-Running AI Agents in 2026: https://www.indium.tech/blog/7-state-persistence-strategies-ai-agents-2026/
- TrueFoundry — Best Multi-agent Orchestration Frameworks in 2026: https://www.truefoundry.com/blog/multi-agent-orchestration-frameworks
- Governed Shared Memory for Multi-Agent LLM Systems (arXiv): https://arxiv.org/html/2606.24535v1
- mem0 — State of AI Agent Memory 2026: https://mem0.ai/blog/state-of-ai-agent-memory-2026
