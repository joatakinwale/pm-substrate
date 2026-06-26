# Research Portfolio Evaluation — Against the Substrate Objective

Date: 2026-06-10 (rev 2 — re-anchored to the May 26, 2026 rewrite thesis)
Scope: all 21 documents under `research/`, evaluated against the current substrate objective, with code spot-checks against `packages/agent-state` and `packages/evals` at HEAD `f9d95fe`.
Method: full read of every research file by three parallel review passes (foundations, Arrowsmith daily chain, competitive-intelligence daily chain), then direct verification of high-stakes claims via grep/code inspection.
Note: written as a one-off evaluation deliverable, not a protocol research run — `index.md` and `Changelog.md` deliberately untouched.

---

## 1. The objective being evaluated against

The governing objective is the rewrite thesis (**"State Coherence Under Partial Observation"**, May 26, 2026 — `artifacts/pm_substrate_rewrite.md`): pm-substrate is a tenant-scoped **governed operational state plane** that coordinates humans, tools, workflows, and AI agents. AI is semantic I/O, never authority; deterministic validators, profiles, write gates, and provenance decide admissibility. The thesis carries **two coupled claims** and its own validation instruments:

1. **Plug-in claim** — a platform onboards via new mapping/profile/capability files with **zero substrate-package edits and zero changes to existing providers** (the acceptance criterion), measured by time-to-plugin, substrate edit count, mapping coverage, validator rejection rate.
2. **Agent-state claim** — agents behave better resuming from substrate state than from chat history: currentness, source authority, evidence-backed action, replay, amnesiac continuity.

Validation surface: the **ArrowHedgeLabs sandbox test plan T1–T8** (source mapping, event provenance, deterministic risk gate, amnesiac resume, staleness failure, plug-in file formats, replay audit, conflict handling) plus the thesis's **12 behavior metrics**. The thesis is explicit that the agent-state work "is not a pivot — it is a harder validation surface" for the same PM-layer claim.

**Headline finding (verified by grep):** the portfolio researches the agent-state claim deeply — 16 of 21 files build on ArrowHedge fixtures, and the claim ledger (C001–C035) is entirely agent-state — but the **plug-in claim has almost no research representation**: exactly one file touches the rewrite's plug-in vocabulary (time-to-plugin, mapping coverage, amnesiac resume), and no research stream tracks T1–T8 pass status or the 12 metrics as claims, even though the implementing packages (`entity-mapping`, `capability-finance-research-ingest`, `continuity`) exist. Half the thesis is being validated; the other half is shipping code without a research/falsification loop.

A second structural issue follows from the same grep: the repo's front-door docs (`README.md`, `docs/roadmap.md`, `docs/validation.md`) still describe the superseded pre-rewrite framing and validation plan. The current objective lives in `artifacts/`. Any new contributor, reviewer, or automation that anchors on the front door will evaluate against the wrong objective — this evaluation's first revision did exactly that. Updating those three docs to the rewrite thesis (or stamping them superseded with a pointer) is cheap and prevents every future recurrence.

---

## 2. Per-document evaluation

### 2a. Foundational / standalone docs

| Doc | What it is | Alignment with the thesis | Evidence quality | Verdict & top improvement |
|---|---|---|---|---|
| `coordinated-reality-under-change_2026-05-20` | Cross-disciplinary motif survey (Lamport, Ostrom, Holling, Petri nets) mapped to substrate design | Strong: motifs (auditability, permissioned state change, recovery from drift) are the thesis's mechanism set; Bridge A (workflow-as-Petri-net soundness) anticipates T5/T8 workflow-validity tests | Best in class: explicit [V]/[K]/[U] verification key; no unverifiable load-bearing claims | Keep as methodological anchor. **Improve:** link Bridge A explicitly to the T5 staleness-block and T8 conflict tests; verify the load-bearing Bayou [K] citation (cheap, and it underpins the stale-observation eval design). |
| `workspace-and-agent-state-landscape_2026-06-02` | Market/benchmark pressure-test (MAST, Palantir, Mem0, MuleSoft) | The only foundation doc engaging the **plug-in claim** (Palantir-ontology positioning, mapping-based onboarding) — currently the portfolio's sole bridge to that half of the thesis | Strong; self-flags its own citation bugs (MuleSoft mis-dating; "MemAE LCFM 2025" still [U]) | **Improve:** promote its positioning section into a dedicated plug-in research stream (see §4.1); resolve or delete the [U] MemAE row before external use. |
| `local-lab-state-bench-arrowsmith_2026-06-02` | First executable paired-eval design (baseline vs substrate arms, 3 scenarios) | Direct: scenarios map to T5 (staleness), T8 (conflict/authority), workflow invalidation | Best-tiered sourcing (peer-reviewed vs lower-weight, OpenReview IDs throughout) | Most implementation-concrete foundation. **Improve:** add a falsifier for the eval design itself (if baseline ≈ substrate across scenarios, the scenarios test nothing); bind metric names to actual `packages/evals` schema fields. |
| `first-principles-agent-state-interoperability_2026-06-03` | POMDP / OCEL / coordination-literature first-principles pass | Direct: observation/belief/operational state separation is the thesis's seven-state decomposition; tool-onboarding row anticipates the plug-in acceptance criterion without citing it | Real sources, but **drops the [V]/[K]/[U] key** — hygiene regression starts here | **Improve:** restore verification tags (the coordination-literature rows feed design recommendations untagged); tie the tool-onboarding row to the zero-substrate-edit criterion and the time-to-plugin metric. |
| `cross-disciplinary-state-interoperability-arrowsmith_2026-06-03` | 19-discipline mechanism survey; five-layer state stack; FHIR/OPC-UA profile pattern | Strong on both claims: five-layer stack = the thesis's state separation; the FHIR "profiles + validators + local extensions" pattern is the plug-in mechanism in standards form | Real, mostly registry-verifiable; no verification key | **Improve:** connect the FHIR/OPC-UA pattern explicitly to the mapping/profile/write-gate pipeline (steps 1–8 of the thesis) — it is the strongest external precedent for the plug-in claim; cross-reference the CRDT-vs-gate experiment duplicated across two other docs. |
| `agent-from-numbers-to-state-arrowsmith_2026-06-04` | Ground-up decomposition: parameter / inference / memory / operational state | The canonical agent-state-claim statement; its `current_state_view` contract spec is the thesis's "governed operational state" made concrete | Well-verified arXiv chain; no verification key | **Improve:** promote the four-state-type table into the thesis/front-door docs — clearest one-page articulation of the problem, currently buried; map Layer-7 mutation gates onto the thesis's write-gate step (step 6). |
| `index.md` (ledger) | 35 claims, 16 entries, 20-item frontier, task tree | Agent-state claim only. No claim tracks T1–T8 status, the 12 metrics, or the zero-substrate-edit criterion | Claim discipline (Confirmed/Downgraded/Contradicted) is genuinely good | **Improve (highest priority):** add the thesis's validation instruments as first-class claims — T1–T8 pass status and the 12 metrics with measured values; add a protocol-adherence claim (the ledger records its own violations, e.g. L006, but doesn't track adherence). |

### 2b. Daily Arrowsmith agent-state chain (v01–v07 + index)

The chain's strengths are real: v02 caught a genuine tautology in the review path *by reading code*; v03(06-06)→v06 correctly confirmed closed primitives; downgrades (socio-technical congruence after Mauerer 2021's negative result; H-CSC semantic consensus ≠ authority) follow evidence, not momentum. Code spot-check confirms every primitive the chain claims as "implemented pure primitive" actually exists (`ActionProposalReview`, `StateReviewArtifact` + hash replay, temporal phases, invariant policy matrix, observed read-set comparison, ArrowHedge suite). This chain is the thesis's agent-state claim being validated properly.

Per-file deltas and issues:

| File | Delta | Key issue |
|---|---|---|
| v01 (06-05) | Establishes thesis + 6 eval scenarios | Falsifiers mostly trivial restatements ("baseline performs as well") — no fixture/threshold specificity |
| v02 (06-05) | Code-audit correction: tautological review path, `subject_mismatch`, advisory-vs-blocking honesty | Best file in the chain. Its S-Bus DeliveryLog question is never answered in any later version |
| v03 (06-05, local) | Parallel-branch artifact, superseded | **Versioning collision** — protocol's fetch-before-write step skipped; duplicates v02's implementation plan after code had already closed it |
| v03 (06-06, canonical) | Confirms closed primitives; pivots to durable artifacts | Multi-object/OCEL fixture proposed here — **still absent from code at v07** (verified) |
| v04 (06-07) | S-Bus/Claw-Eval repo inspections; RFC 9110/9449 bridges | ObservationContract v2 fields (integrityHash, holderBinding, allowedUse) proposed — **still absent from code** (verified) |
| v05 (06-08) | TIDE temporal phases; Sagas; fixture matrix | Wrote "durable artifact writer not found" the same day the Changelog shows it being added — claim ledger written before a post-implementation check |
| v06 (06-09) | Confirms closures; pivots to external evidence admission | `git fetch` mmap failure recorded as prose, not escalated as a protocol defect |
| v07 (06-10) | DeLM, MCP state handles, high-reliability coordination bridges | Cites Workflow-GYM/T1-Bench (submitted 06-09 — one day old) as bridge evidence, and a **future-dated URL** (`blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/`, cited 7 weeks before its own date — verified at v07 line 50). Correctly labeled "future/draft," but the citation itself cannot currently be verified to exist |

Chain-level: from v04 onward the daily pattern is read code → confirm yesterday's slice shipped → propose next slice. Useful as sprint planning; weaker as research — the chain is one step behind the code rather than ahead of it, and it never maps its slices onto the T1–T8 plan, so there is no way to read off how much of the thesis's validation surface is covered.

### 2c. Daily AI competitive-intelligence chain (v01–v04 + index)

| File | Delta | Key issue |
|---|---|---|
| v01 (06-08) | Six-vendor baseline (OpenAI, GitHub, Google, AWS, ServiceNow, Anthropic) | Threat rubric not yet formalized; metric names lack pass/fail thresholds |
| v02 (06-08) | Parallel same-day run: +Atlassian, Asana, Cursor, Slack/Salesforce, Cognition | ~800 lines across v01+v02 for ~200 lines net-new; threat levels jump Medium→High **with no documented criteria change** — clearest "vibes escalation" in the series |
| v03 (06-09) | Five-evidence-lane decomposition; T1–T5 task tree | Sharpest analytical contribution of the series; task tree has no success criteria and is recreated rather than updated in place |
| v04 (06-10) | Approval-currentness drift fixture; AgentCore lane split | Tightest file; 10-scenario eval table lacks acceptance criteria (WARN vs WOULD_BLOCK unspecified); open questions accumulate v01→v04 with no closure tracking |

The comparator set (frontier-lab agent control planes plus ServiceNow/Atlassian/Asana) is the right one for the agent-state claim. Two structural problems remain:

1. **The recurring conclusion is unfalsifiable as researched.** "No vendor has portable governed operational-state artifacts" is reached by reading press releases and product pages — surfaces that deliberately omit implementation internals. ServiceNow and Atlassian have been "highest direct threat, unproven at artifact level" for three consecutive runs without anyone opening their developer/SDK/partner docs, where a counterexample would actually live. Every finding lands as "evidence lane, not authority" — a conclusion the method guarantees.
2. **The plug-in claim has no competitive coverage.** Nobody scans the platforms that compete with mapping-based zero-edit onboarding — embedded iPaaS and integration vendors (Zapier, Workato, Merge.dev, Tray), schema-mapping tooling, or the import/onboarding mechanics of the agent platforms themselves. If a vendor ships AI-proposed, deterministically validated, versioned mappings before pm-substrate proves T1/T6, that is a direct hit on the thesis — and the current scan would not see it coming.

---

## 3. Cross-cutting findings (verified)

1. **Half the thesis has no research loop.** Agent-state claim: richly validated (ArrowHedge fixtures in 16 files, ledger claims, eval metrics in code). Plug-in claim: one file touches its vocabulary; T1–T8 and the 12 metrics are tracked nowhere as research objects; no competitive coverage. The thesis explicitly frames both claims as one validation surface — the portfolio only walks one of them.
2. **Front-door documentation debt.** `README.md`, `docs/roadmap.md`, `docs/validation.md` still carry the superseded pre-rewrite objective and validation plan while the real thesis sits in `artifacts/`. This actively mis-anchors new readers, agents, and automations (demonstrated by this evaluation's own first revision).
3. **Boilerplate crowds out signal.** 35–45% of each Arrowsmith file and 55–60% of each competitive file is restated framing/carry-forward. Carried sources are re-inventoried daily instead of living in the chain indexes.
4. **Watchlist items don't close.** Multi-object fixture (proposed v03, absent at v07 — verified), ObservationContract v2 fields (proposed v04, absent — verified), ContractBench/STALE source-availability gap (carried 7 versions), competitive open questions (accumulating, never marked answered), metrics queue grown to 100+ with no retirements. Proposals accumulate; nothing is retired or marked stalled.
5. **Evidence-hygiene regression.** The [V]/[K]/[U] verification key from the May 20 doc was dropped in every doc after June 2. Same-day/next-day preprints used as bridge evidence; one future-dated citation (MCP 2026-07-28) in v07. No fabricated sources were found anywhere — the corpus is honest — but evidence *grading* degraded as velocity increased.
6. **The run protocol is aspirational, not enforced.** Two v03 files, a same-day stale claim in v05, an unescalated fetch failure in v06, recurring AppleDouble `._*` noise in `.git` from the exFAT drive. The ledger itself frames the protocol as an agent-state test; by its own framing the test is currently failing — which is useful evidence for the thesis and should be tracked as such, not left as prose.

---

## 4. Improvements, ranked by leverage

**1. Stand up a plug-in-claim research stream and wire the ledger to the thesis's instruments.** Add T1–T8 as tracked claims with pass status, and the 12 metrics (time-to-plugin, substrate edit count, mapping coverage, validator rejection rate, evidence coverage, stale action rate, agent resume success, replay fidelity, …) as measured values in `research/index.md`; give `entity-mapping` / `capability-finance-research-ingest` / `continuity` the same daily code-audit treatment the agent-state packages get. **Why:** the zero-substrate-edit acceptance criterion is the thesis's sharpest falsifiable claim, and right now nothing in the research program would notice it failing — or prove it passing.

**2. Update the front-door docs to the rewrite thesis.** Replace or supersede README/roadmap/validation content with the state-coherence framing, the ArrowHedge T1–T8 plan, and the 12 metrics; point to `artifacts/pm_substrate_rewrite.md` as canonical. **Why:** every future contributor, reviewer, and automation anchors on the front door first; today it points them at a dead objective.

**3. Enforce closure mechanics in both chains.** Each daily file gets two mandatory fields: *Sync verification* (fetch result, SHA match) at top and *Slice disposition* (prior run's recommended slice: shipped w/ commit ref | deferred w/ reason | dropped) at bottom; task trees update in place; stalled items (multi-object fixture, ObservationContract v2, ContractBench/STALE availability) get an explicit implement-or-drop decision; trim the metrics queue to what `analyzeStateReviewArtifacts()` / `analyzeStateAssertions()` can currently measure. **Why:** silent accumulation of unmet commitments is the exact failure mode the substrate exists to prevent; the research corpus should obey its own thesis.

**4. Add required falsification attempts to the competitive chain — on both claims.** Each run executes one active falsification attempt against technical sources (ServiceNow dev portal, Atlassian Forge/Rovo SDK, Asana developer docs, AWS AgentCore schemas), recording search terms on failure; add a periodic plug-in-comparator scan (embedded iPaaS, schema-mapping vendors, agent-platform onboarding mechanics) judged against the zero-edit criterion. **Why:** converts the standing "no vendor has this" conclusion from confirmation bias into a dated, falsifiable claim, and closes the blind spot on the half of the thesis competitors are most likely to hit first.

**5. Cut per-run volume ~40–50% via a fixed delta-only template.** Daily files contain only: code-grounded delta, net-new evidence, one recommended slice with file:function specificity and the T-test it advances. Carried-forward sources, standing vendor summaries, and framing move to the chain indexes as versioned standing sections. **Why:** at current repetition rates chain cost grows linearly while marginal signal shrinks; the indexes already exist to hold the invariant content.

**6. Restore evidence grading; add a freshness rule; formalize threat-level mechanics.** Reinstate [V]/[K]/[U] tags; preprints <7 days old admitted as "direction signal only"; future-dated or pre-publication URLs explicitly flagged; resolve standing [U] items (MemAE LCFM 2025) or delete them. Threat levels may change only when a new primary source within 30 days demonstrates ≥2 of the five substrate dimensions (currentness, authority, provenance, workflow validity, pre-action review), citing the triggering source; merge future parallel runs into one file with a reconciliation note. **Why:** the thesis's own admission contract demands source, freshness, and authority metadata before evidence is used — the research corpus should meet the bar it sets for agents, and a rubric-governed threat matrix becomes a decision instrument instead of a vibe.

---

## 5. What's working (keep)

The claim-ledger discipline (Confirmed/Downgraded/Contradicted with sources) is rare and real. Code-audit-driven corrections (v02's tautology catch, v06's stale-frontier correction) are the best pattern in the portfolio and should become the required first section of every run. Source honesty is high: across ~120 cited sources, the reviews found no fabrications, and self-flagged uncertainty (MuleSoft dating, MemAE, ServiceNow marketing-only sourcing) shows the right instincts. ArrowHedge as the validation sandbox is fully adopted by the research program — the fixture corpus, temporal phases, and artifact metrics all run through it, exactly as the thesis intended. The treatment of protocol failures as substrate-thesis evidence (L006, mmap failures) is conceptually correct — it just needs to graduate from prose observation to tracked claim.
