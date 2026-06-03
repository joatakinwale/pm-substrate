# The Workspace & Agent-State Problem: External Landscape Pass

**Date:** 2026-06-02
**Author lens:** Independent research pass commissioned to pressure-test the pm-substrate thesis against the *outside* literature and market, not to re-derive it from inside the repo.
**Method:** Fan-out web search + primary-source verification, structured the way `coordinated-reality-under-change_2026-05-20.md` and `arrowsmith-state-substrate-research.md` already work. The goal is to find where the field independently converges on the substrate's bets, where it diverges, and where the substrate is exposed.
**Scope:** The two problems the substrate claims to solve — (1) the *workspace interoperability* problem (tools don't coordinate) and (2) the *agent-state* problem (bounded actors act from stale/partial/ungrounded local models). Treated as one problem at the system-interaction level, which is how the repo already frames it.

## Verification Key

- **[V]** — Confirmed via direct search/fetch during this pass (2026-06-02).
- **[K]** — Known / well-documented, not re-fetched this pass.
- **[U]** — Unverified or partially verified; flagged with downgraded weight.

---

## 0. Executive Summary

1. **The problem the substrate names has, in the last ~12 months, become an externally named and *measured* problem.** It is no longer a founder thesis. Multi-agent failure now has a peer-reviewed taxonomy (MAST, Berkeley, 2025 **[V]**); agent memory has a wave of benchmarks that keep returning the same verdict — *storage is solved, behavior is not* (GroupMemBench, STATE-Bench, LongMemEval, LoCoMo, G-Memory, 2024–2026 **[V]**); and "context rot" is now an empirically demonstrated failure mode of the naive "just use a bigger context window" answer (Chroma, 2025 **[V]**).

2. **The substrate's architectural bets are the ones the field is independently converging on.** Event sourcing is being marketed in 2025–26 as "the backbone of agentic AI" (Akka, Temporal, AxonIQ **[V]**); the *blackboard* architecture — a shared, governed state medium as the *exclusive* coordination substrate — is beating RAG and orchestrator/sub-agent patterns by 13–57% in 2025 papers **[V]**; and the dominant production agent framework (LangGraph) defaults to **Postgres-backed durable checkpointed state** — the substrate's exact stack choice **[V]**.

3. **The substrate sits in a real gap between two crowded categories.** Agent *memory* products (Letta, Mem0, Zep, Cognee) give one agent better recall of its own/user history; agent *interop protocols* (MCP, A2A, ACP, ANP, AGNTCY/SLIM) let agents discover each other and pass messages/capabilities. **Neither provides a shared, durable, *authoritative* operational world model with provenance and capability gates.** That is the substrate's wedge, and it is currently unoccupied in the open/mid-market.

4. **The incumbent proving the thesis at the top of the market is Palantir.** Palantir's Ontology/AIP is, almost line-for-line, the substrate's thesis ("single source of truth," "digital twin of your organization's reality," typed real-world entities + relationships + business logic, "humans and AI agents see the same world") **[V]**. This is the strongest external validation *and* the sharpest positioning question: pm-substrate is, in effect, an open, profile-driven, Postgres-grade reimplementation of the Ontology pattern for the long tail that Palantir's services-led model never reaches.

5. **The repo's load-bearing citations hold up.** Every uncertain 2026-dated benchmark I checked is real — STATE-Bench, G-Memory (NeurIPS 2025 spotlight), GroupMemBench, *Memory for Autonomous LLM Agents* **[V]**. The MuleSoft market stats are real but should be re-attributed to the **2025** Connectivity Benchmark (897 apps avg, 95%/80%/90%/50% **[V]**); the thesis's "2026 MuleSoft" figures are citation-hygiene debt, not substance debt.

6. **The biggest external caution is also the one the repo already named.** Memory benchmarks repeatedly show structured/graph memory barely beating trivial baselines at much higher cost (GroupMemBench: BM25 matched most memory systems; Mem0: graph beats vector by ~1.5 pts at 2–3× cost) **[V]**. This is the empirical form of the repo's own "second state system" risk: **a typed substrate only wins if it changes *behavior*, not just architecture.** The paired baseline/substrate eval design (ADR-0032, eval-event-schema) is the correct and necessary answer — and is now the single most important thing to actually run.

---

## 1. The Problem, Restated From Outside

The repo's first-principles statement —

> State is the minimum sufficient representation an actor needs to choose a valid next action; failures emerge when bounded actors act from divergent, stale, partial, or ungrounded local models of a changing environment.

— is correct and is now the *mainstream* framing of the field, not a contrarian one. What changed in the last year is that the two halves the founder's-thesis PDF treats separately (workspace interop for *humans/tools*, and agent state for *AI*) have visibly collapsed into one problem in the literature, because agents are now the actors stressing the same coordination substrate. Three external developments make this concrete:

- **Bigger context windows did not dissolve the problem.** The 2025 consensus is that reliability gains now come from *changing the environment around the model* — persistent external memory, tool registries, protocol definitions, constrained execution — not from scaling the context window, which degrades (see §2.3) and whose cost scales with input length **[V]**.
- **The expensive failures are coordination failures, not reasoning failures.** This is exactly the founder PDF's "missing communication between departments" claim — now measured (MAST, §2.1).
- **The hard part of memory is *knowledge update and authority*, not recall.** Benchmarks that isolate "a fact changed; does the agent act on the new one?" show catastrophic scores (§2.2). That is the substrate's `stale_observation`, `source_authority_conflict`, and `memory_drift` classes, measured by outsiders.

---

## 2. The Problem Is Now Externally Named and Measured

This is the most important update for the project: the substrate no longer has to argue the problem exists. It can cite it.

### 2.1 Multi-agent failure has a taxonomy — and it rhymes with the substrate's

**MAST — Multi-Agent System Failure Taxonomy** (Cemri, Pan, Yang et al., UC Berkeley–led, arXiv 2503.13657, 2025) **[V]**. 1,600+ annotated traces across 7 MAS frameworks; 14 failure modes in 3 categories: **(i) system/specification design, (ii) inter-agent misalignment, (iii) task verification.** Inter-annotator κ = 0.88. Headline finding: *most* multi-agent failures are design/coordination failures, not base-model failures — "performance gains can be achieved by refining system design rather than relying on better models or prompts."

This is the academic version of the founder thesis ("the components are mature; interoperability is the bottleneck"). It also gives the repo a shared vocabulary to map into. A crosswalk between the substrate's 10 state-failure classes and MAST's 3 categories:

| pm-substrate class | MAST category | Note |
|---|---|---|
| Partial observation | Inter-agent misalignment | MAST: "information withholding," "ignored input" |
| Stale observation | (under-weighted in MAST) | **Substrate is stronger here** — MAST has no first-class freshness/invalidations axis |
| Representation loss | Inter-agent misalignment | MAST: "reasoning-action mismatch," lost task spec |
| Memory drift | System design | MAST: "step repetition," "loss of conversation history" |
| Source authority conflict | (under-weighted in MAST) | **Substrate is stronger here** — MAST has no authority-ranking concept |
| Workflow invalidation | System design / verification | MAST: "premature termination," disobey spec |
| Capability contract violation | System design | MAST: "violate task/role specification" |
| Parallel write conflict | (under-weighted in MAST) | **Substrate is stronger here** — MAST is largely conversational, not transactional |
| Feedback disconnection | Task verification | MAST: "incorrect/incomplete verification" (13.5% of all failures) |
| Continuity break | System design | MAST: "loss of history" across sessions |

**Reading:** the substrate's taxonomy is *more operational/transactional* than MAST (it owns stale-state, authority, and concurrent-write classes MAST barely touches, because MAST studies chat-style MAS). MAST is *more organizational* (it names role/spec design failures the substrate folds into capability contracts). Adopting MAST's labels in `notes` on eval events would let the substrate speak the field's language while keeping its sharper state axes. **Actionable.**

### 2.2 Agent memory has benchmarks — and they all say "storage ≠ behavior"

A wave of 2024–2026 benchmarks, all **[V]**:

- **LongMemEval** (arXiv 2410.10813) — five abilities: extraction, multi-session reasoning, **temporal reasoning, knowledge update, abstention**. ~115k-token histories. The "knowledge update" and "abstention" axes are precisely the substrate's `stale_observation` / authority concerns.
- **LoCoMo** (ACL 2024) — already cited by the repo; 10 multi-session dialogues, ~2k questions, single/multi-hop/temporal/open-domain.
- **G-Memory** (arXiv 2506.07398, **NeurIPS 2025 spotlight**) — hierarchical *multi-agent* memory (insight/query/interaction graphs) grounded in organizational-memory theory. Confirms the repo's "group memory > personal memory" claim and that graph-structured collaboration memory is an active, credible research line.
- **GroupMemBench** (arXiv 2605.14498) — multi-party/workplace memory. **Strongest memory system: 46.0% average; knowledge-update: 27.1%; and a plain BM25 baseline matched or beat most agent-memory systems.** This is the single most useful external data point in this pass: it is empirical proof that (a) the workplace/group setting is where memory breaks, and (b) elaborate memory machinery frequently fails to beat trivial retrieval. The substrate must clear *that* bar.
- **STATE-Bench** (Microsoft Open Source, 2026-05-19) **[V]** — explicitly memory-agnostic, "bring your own memory," and built on the exact stance the substrate takes: *"Most memory benchmarks are just retrieval tests… That tells you the pipe works. It doesn't tell you the agent performs better… enterprise agents change system state in a database (refund records, booking status, account updates)."* STATE-Bench measures stateful *procedure* execution, not recall. **This is the substrate's thesis written by Microsoft Research.** It is also a ready-made external harness the local-lab axis (Axis C) should adopt.
- **Surveys** confirming the memory-as-managed-state framing the repo relies on: *Memory for Autonomous LLM Agents* (arXiv 2603.07670) and *Rethinking Memory in LLM-based Agents* (arXiv 2505.00675) **[V]**.

**Reading:** the field has independently concluded that memory must be evaluated as *behavior under change*, not stored rows — verbatim the ADR-0032 amnesiac-eval argument. The substrate's differentiator is not "we store memory better"; it's "our memory is **derived from an authoritative, evidence-backed operational state** with freshness and authority, so it can pass knowledge-update/abstention tests that flat memory fails." That claim is now *directly testable on public benchmarks*.

### 2.3 The naive answer ("bigger context window") is now empirically discredited

**Context rot** (Chroma technical report, 2025) **[V]**: 18 frontier models (GPT-4.1, Claude, Gemini) *all* degrade as input length grows, often dropping "off a cliff" unpredictably. Agents also accumulate exploration noise that degrades every subsequent output. Combined with the cost argument (long-context pricing scales with input length; external memory is one-time write + cheap query), this closes the most obvious objection to building a structured state layer at all. "Context engineering" is now a named discipline precisely because raw context is not a state system.

---

## 3. The Architecture Bets Are Externally Converged-Upon

The substrate's Day-1 stack reads as conservative; the external signal is that it is *correct*, and increasingly the default.

- **Event sourcing / CQRS as the agent backbone.** In 2025–26 this is being marketed directly at agents: Akka ("Event Sourcing: The Backbone of Agentic AI"), Temporal, and AxonIQ ("AI Agent Explainability: Why Your Infrastructure Needs to Remember") all argue an append-only event log + projections gives agents replayable state, crash recovery, and decision-level explainability — the substrate's `replay_fidelity`, provenance hash-chain (ADR-0030), and projections work, sold as product **[V]**. Purpose-built engines shipped (EventSourcingDB 1.0, May 2025) **[V]**.
- **The blackboard architecture is back, and winning.** Two 2025 papers (arXiv 2510.01285; arXiv 2507.01701) **[V]** revive the classic blackboard pattern as *the* multi-agent paradigm: a shared, governed state medium is "the exclusive communication and memory substrate"; agents self-select against it; **13–57% relative improvement over RAG and orchestrator/sub-agent baselines.** This is the closest academic analog to pm-substrate that exists. The substrate *is* a typed, durable, multi-tenant, permission-gated blackboard. Framing the substrate as "a governed blackboard for cross-functional work" connects it to an active, results-backed research line — a stronger frame than "PM layer" alone for a technical audience.
- **Postgres-backed durable shared state is the production default.** LangGraph — the most-deployed agent framework — uses a centralized state object persisted via **PostgresSaver**, with sub-agent updates merged through reducers and every transition committed before the next node runs **[V]**. This independently validates the substrate's "Postgres-only, LISTEN/NOTIFY, single projection worker, discipline-in-the-interfaces" choice. The difference (and the substrate's larger ambition): LangGraph state is *per-graph, per-thread, orchestration-scoped*; the substrate is *cross-tool, cross-tenant, source-of-truth-scoped* with capability contracts and provenance. The substrate is to LangGraph's checkpointer what a system-of-record is to a function's local variables.

---

## 4. Competitive & Positioning Map

The substrate sits in a gap between three things, only one of which is a true competitor.

**Camp A — Agent memory infrastructure (adjacent, not the same problem).** Letta (OS-style tiered memory the agent manages), Mem0 (user/session/agent scopes; vector+graph+KV), Zep (temporal knowledge graph, arXiv 2501.13956), Cognee (doc → knowledge graph) **[V]**. These make *one agent* remember *its* history/user better. They are **personal/episodic recall**, not a shared authoritative operational record across humans, tools, and functions. They have no concept of source authority between *systems*, no capability contracts, no per-tenant workflow soundness. Empirically they often barely beat BM25 (GroupMemBench) and graph variants cost 2–3× for thin gains (Mem0). **These are candidate baselines for Axis C, not competitors to the substrate's claim.**

**Camp B — Agent interoperability protocols (complementary, by design).** MCP (Anthropic, Nov 2024 → Linux Foundation Agentic AI Foundation, Dec 2025), A2A (Google, Apr 2025 → LF; v1.0 early 2026), ACP, ANP (survey: arXiv 2505.02279, the one the founder PDF already cites), and AGNTCY/"Internet of Agents" (Cisco Outshift → Linux Foundation; SLIM messaging + decentralized Identity + discovery + observability) **[V]**. **Critical finding:** these standardize *discovery, identity, messaging, and capability invocation* — they move bytes and authority-to-call between agents. They explicitly do **not** provide a shared, durable, authoritative *state* layer. The survey literature even names the failure: using MCP where A2A is needed yields "systems where sub-agents cannot maintain their own state… independently of the orchestrator." The protocols are the *nervous system*; the substrate is the *shared world model* they need to coordinate over. The substrate should declare itself protocol-complementary (capabilities can expose over MCP; cross-agent handoffs can ride A2A) and own the layer none of them own.

**Camp C — The real competitor / proof point: Palantir Ontology + AIP.** **[V]** Palantir markets the Ontology as "the operating system for enterprise AI agents," a "single source of truth," a "digital twin of your organization's reality" of typed real-world entities (Employee, Aircraft, Purchase Order) + relationships + business logic, where "humans and AI agents see the same world." This is the substrate's thesis, shipped, at the Fortune-500 scale, since 2023. Implications, both directions:

- *Validation:* the most sophisticated enterprise-AI company in the world bet the company on exactly this architecture. The thesis is not speculative.
- *Positioning pressure:* the substrate must answer "why not Palantir?" The honest, strong answer is **reach and shape**: Palantir is heavyweight, services-led, bespoke-ontology-per-customer, enterprise-priced. pm-substrate's distinct claims are (1) **Tier-1 universal primitives + Tier-2 industry profiles** so the ontology is *pre-built and portable* rather than bespoke-per-customer; (2) **capability contracts** so tools plug in without integration; (3) a **Postgres-grade, open, developer-first** footprint for the mid-market/long-tail Palantir doesn't serve. That is a defensible wedge — but the deck/thesis should name Palantir explicitly rather than leave the comparison implicit, because every technical evaluator will make it.

---

## 5. QA on the Repo's Own Claims

Part of an honest external pass is checking the project's own evidence. Net: **substance is sound; fix some citation hygiene.**

- **Agent-state benchmark citations — almost all real.** STATE-Bench (Microsoft, 2026-05-19), G-Memory (NeurIPS 2025 spotlight, 2506.07398), GroupMemBench (2605.14498), *Memory for Autonomous LLM Agents* (2603.07670), and *Memory Matters* (AAAI-SS 2024, ojs.aaai.org item 27688) all verified **[V]**. The arrowsmith-research map's 2026-dated rows are *not* fabricated. **One exception:** "MemAE, LCFM 2025" (OpenReview ZgQ0t3zYTQ) could **not** be independently confirmed this pass — flag as **[U]** and re-verify before it appears in any external-facing thesis; it is a minor supporting row, not load-bearing.
- **MAST is missing and should be added.** The single most citable external source for the founder thesis ("coordination, not components, is the bottleneck") — MAST (2503.13657) — is not in the repo. It belongs in `arrowsmith-state-substrate-research.md` and the thesis.
- **MuleSoft figures — real but mis-dated.** The verifiable report is the **2025** Connectivity Benchmark (Salesforce/MuleSoft, Jan 2025): **897 apps avg** (1,103 for agent-using orgs, +45%), **95%** report AI-integration challenges, **80%** cite data integration as the top obstacle, **90%** report data-silo obstacles, **50%** of AI agents operate in isolation, **96%** agree agent success depends on integration **[V]**. The thesis cites a "2026 MuleSoft Connectivity Benchmark" with adjacent figures (95% / 86% / 50% silos / 96%). Recommendation: attribute these to the **2025** report unless a 2026 edition is independently confirmed; the numbers the thesis leans on are within the 2025 report's findings, so the argument survives — only the year/label needs correcting. **[U]** on the 2026 edition's existence.
- **SaaS-sprawl figures (Zylo/BetterCloud/Productiv) are directionally well-supported** by the MuleSoft 897-app figure and are standard in the category **[K]**; no correction needed, but prefer the primary MuleSoft number when one stat must carry weight.

---

## 6. Risks, Counter-Arguments & Open Questions

1. **The "second state system" risk is the real one — and the field confirms it.** GroupMemBench (BM25 matches most memory systems) and Mem0 (graph barely beats vector at 2–3× cost) are warnings that elaborate state machinery frequently fails to earn its keep **[V]**. The substrate's defense is correct in principle (memory must be *derived* from authoritative state, not a competing authority) but must be *demonstrated* with paired baseline/substrate numbers. **Until ADR-0032-style evals run on a public stateful benchmark (STATE-Bench is the obvious target), the behavioral claim is unproven.** This is the project's #1 epistemic exposure.

2. **Counter-argument from the long-context camp.** A credible faction bets that long context + in-context retrieval + better prompting reduces the need for an external structured-state layer. Context-rot evidence weakens this **[V]**, but the substrate's rebuttal must stay on its strongest ground: enterprise state is *authoritative, multi-actor, mutable, and adversarial-to-staleness* — a coordination/governance problem, not a recall problem. Don't argue memory-size; argue authority and freshness.

3. **Coordination cost / CRDT limits.** The repo's own coordinated-reality pass already flags that semantic invariants aren't CRDT-friendly and that authority needs policy, not just convergence. The field agrees (CRDTs converge structure, not business authority). Open question the substrate hasn't resolved: which event types are CRDT-safe (zero-coordination) vs. which require a serialization/authority gate. This is a concrete, falsifiable design study worth doing (it's literally falsifiable-prediction #4 in the coordinated-reality doc).

4. **Cold-start / first-tool problem remains the hardest *go-to-market* risk** (the architecture doc names it). Palantir solves cold-start with services; the protocols solve discovery; the memory products ride on existing agent apps. The substrate's "three composing capabilities on day one of the demo" (Phase 2/3) is the right answer *technically*, but adoption is still the place the thesis is most exposed in the market, not the lab.

5. **Standards risk.** MCP and A2A and AGNTCY all landed at the Linux Foundation within ~12 months **[V]**. If a shared-state/"agent context" standard emerges there too, the substrate wants to be an *implementation* of it, not a competitor to it. Watch the Agentic AI Foundation for a state/context workstream.

---

## 7. What's Genuinely Novel vs. Table-Stakes (given the landscape)

- **Table-stakes now (others have it):** append-only event log + projections; Postgres-backed durable state; per-agent memory/continuity; capability *invocation* via MCP; multi-agent orchestration.
- **Differentiated (few have it together):** **source authority + freshness/invalidation as first-class read metadata** (ADR-0025); **capability *contracts* with deterministic pre-mutation gates** (not just invocation); **provenance hash-chain as admissible evidence** (ADR-0030); **per-tenant workflow soundness checking** (ADR-0029); **portable Tier-1/Tier-2 ontology** instead of bespoke-per-customer.
- **Genuinely under-occupied (the wedge):** a single layer that is *at once* the shared operational source-of-truth (Palantir-like), the agent continuity/memory substrate (Letta/Zep-like), and the capability/permission contract surface (MCP-adjacent) — **open, profile-driven, and mid-market-shaped.** Nobody owns this exact intersection in the open ecosystem today.

---

## 8. Recommended Next Research / Experiments

Ordered by signal-per-effort, all consistent with the existing three-axis plan:

1. **Run the amnesiac/continuity eval against STATE-Bench** (memory-agnostic, "bring your own memory"). It is the externally-credible harness for the exact claim ADR-0032 makes. Report substrate-arm vs. baseline-arm on its stateful-procedure tasks. This converts the project's central claim from internal assertion to externally-comparable result. **[V] harness exists.**
2. **Add Letta, Mem0, and Zep as baseline memory backends in Axis C.** GroupMemBench/Mem0 show these are beatable but non-trivial; "substrate beats the best open memory system on knowledge-update and abstention" is a publishable, defensible headline if true.
3. **Adopt GroupMemBench's and LongMemEval's category labels** (knowledge-update, temporal, abstention, term-ambiguity) inside the eval taxonomy. They map cleanly onto `stale_observation`, `source_authority_conflict`, and `memory_drift` and give the metrics external comparability.
4. **Annotate eval events with MAST failure modes in `notes`.** Free interoperability with the field's vocabulary; costs nothing; makes the taxonomy legible to reviewers.
5. **Do the CRDT-vs-gate classification study** for the substrate's event types (coordinated-reality prediction #4). It turns "we handle parallel writes" into a principled map of where coordination is and isn't required.
6. **Write the explicit Palantir / MCP / A2A / memory-product positioning page** (this section §4 is a start). Every technical evaluator will ask; answer it on the project's terms first.

---

## 9. Source Inventory

Problem definition & failure measurement:
- Cemri, Pan, Yang, et al. "Why Do Multi-Agent LLM Systems Fail?" (MAST). arXiv 2503.13657, 2025. **[V]** — https://arxiv.org/abs/2503.13657
- "GroupMemBench: Benchmarking LLM Agent Memory in Multi-Party Conversations." arXiv 2605.14498. **[V]**
- Microsoft Open Source. "Introducing STATE-Bench: A benchmark for AI agent memory." 2026-05-19. **[V]** — https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/
- "G-Memory: Tracing Hierarchical Memory for Multi-Agent Systems." arXiv 2506.07398; NeurIPS 2025 spotlight. **[V]**
- "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory." arXiv 2410.10813. **[V]**
- "Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers." arXiv 2603.07670. **[V]**
- Chroma. "Context Rot: How Increasing Input Tokens Impacts LLM Performance." 2025. **[V]** (via morphllm.com/context-rot summary)

Architecture convergence:
- Akka. "Event Sourcing: The Backbone of Agentic AI." 2025. **[V]**
- AxonIQ. "AI Agent Explainability: Why Your Infrastructure Needs to Remember." 2025. **[V]**
- Temporal. "What agentic AI borrowed from microservices (and made worse)." 2025. **[V]**
- "LLM-Based Multi-Agent Blackboard System for Information Discovery." arXiv 2510.01285, 2025. **[V]**
- "Exploring Advanced LLM Multi-Agent Systems Based on Blackboard Architecture." arXiv 2507.01701, 2025. **[V]**
- LangChain. "Durable execution" / LangGraph persistence (PostgresSaver). docs.langchain.com, 2025–26. **[V]**

Memory products & interop protocols:
- "Zep: A Temporal Knowledge Graph Architecture for Agent Memory." arXiv 2501.13956. **[V]**
- Mem0. "State of AI Agent Memory 2026." mem0.ai/blog. **[V]**
- Codepointer / Vectorize / Atlan comparisons of Letta, Mem0, Zep, Cognee, 2026. **[V]**
- Singh et al. "A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP." arXiv 2505.02279. **[V]** (already cited in repo)
- Cisco Outshift / AGNTCY. "Internet of Agents." outshift.cisco.com; docs.agntcy.org, 2025. **[V]**

Competitive proof point:
- Palantir. "Ontology" / "AIP" platform pages + analyses. palantir.com/platforms/ontology, 2023–2026. **[V]**

Market grounding:
- Salesforce/MuleSoft. "2025 Connectivity Benchmark Report." Jan 2025 (897 apps; 95%/80%/90%/50%/96%). **[V]** — https://www.salesforce.com/blog/mulesoft-connectivity-benchmark-2025/

---

*End of pass. Of the repo's agent-state citations spot-checked, all verified real except "MemAE, LCFM 2025" (unconfirmed, flagged [U]); 1 mis-dated citation (MuleSoft → 2025 report) flagged; 1 high-value missing citation (MAST, arXiv 2503.13657) recommended for addition; Palantir Ontology/AIP recommended as the explicit positioning anchor. The thesis is externally well-supported; the unproven step is behavioral — run the paired evals (STATE-Bench is the ready-made harness).*
