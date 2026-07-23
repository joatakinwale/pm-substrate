# v233 Autonomous Research Benchmark, Least-Context Egress, and Stale-Basis Trade Hypotheses

Date: 2026-07-22
Status: research proposal + registered hypotheses; external A-inputs only; no substrate mechanism added; no efficacy claim
primitive_family: admission_calculus
primitive_family: authority_topology
primitive_family: obstruction_evidence

## Research question

Can the substrate's causal benefit be made legible by (a) moving confirmation
onto state-effect endpoints the mechanism actually touches, and (b) using the
autonomous cross-domain research loop itself as the long-horizon benchmark,
scored by an external known-solution rediscovery oracle plus a
vanilla-vs-governed ablation?

## Rule compliance

Per the v229 stop rule, this slice's A-inputs are external field incidents and
foreign literatures, not any prior proof object of this stream. It proposes no
new proof layer and no new primitive family. Per the anti-drift rule, research
proposes; only observed-failure-driven, runtime-consumed code counts toward a
causal repair. Nothing here is efficacy evidence.

## Bridge 1 — F2 stale basis: the superseded-snapshot trade

- **A (observed):** MAST inter-agent misalignment (~37% of 1,600+ annotated
  multi-agent failures, [arXiv:2503.13657](https://arxiv.org/abs/2503.13657));
  τ-bench pass^k collapse (~60% pass^1 → <25% pass^8,
  [arXiv:2406.12045](https://arxiv.org/abs/2406.12045)); first-party: the
  2026-07-06 MCP self-blocking incident (a stale-basis failure inside the
  stale-basis detector) and the saturated capstone stale runs (C7=C8=100%,
  `docs/evidence/capstone/RUNS.md`) that showed the prior scenario design
  could not discriminate.
- **B (foreign solved mechanisms):** optimistic concurrency control
  (Kung–Robinson 1981); Bayou session guarantees (read-your-writes, monotonic
  reads); TOCTOU treated as a *security vulnerability class* (the
  access/open race — reframes stale action as attack surface, not bug);
  exchange matching-engine sequencing and the IEX speed bump.
- **C (hypothesis H-F2a):** admission-time read-set revalidation at the agent
  boundary is behaviorally equivalent to exchange-side order sequencing. In a
  two-agent shared-portfolio scenario where agent 1's fill supersedes agent
  2's snapshot: ungoverned arms execute the superseded trade (position/risk
  breach visible in the fund ledger) at a baseline rate materially between 0%
  and 100%; governed arms block it with a stale-basis obstruction and pass
  the matched fresh-basis allow-control.
- **Falsified if:** the piloted baseline breach rate saturates at 0% or 100%
  (scenario design failure, as in the prior capstone runs); or the governed
  arm blocks fresh-basis allow-controls (block-all degenerate); or breach
  rates do not differ between arms at matched overhead.

## Bridge 2 — F6 bounded reads and egress: the least-context principle

- **A (observed):** current enterprise incident pattern — agents exceeding
  instructions and reading/storing data outside task scope, with boundary
  fear about workspace data crossing to model providers; the Replit incident
  (destructive action during an explicit freeze + fabricated state + false
  irreversibility claim, [AIID #1152](https://incidentdatabase.ai/cite/1152/));
  Project Vend memory/identity drift
  ([Anthropic](https://www.anthropic.com/research/project-vend-1)).
- **B (foreign solved mechanisms):** object-capability security and the
  confused deputy (Hardy 1988; prompt injection *is* deputy confusion; POLA —
  you cannot name what you were not given); segregation of duties /
  maker-checker (COSO internal controls); information-flow control with data
  labels; canary/honeytoken detection.
- **C (hypotheses):**
  - **H-F6a (capability-scoped handles):** agents holding capability-scoped
    tool handles produce zero out-of-scope effects vs ambient-authority
    baselines on identical tasks, at a bounded task-success cost (declare the
    acceptable bound before the run). Falsified if out-of-scope effects
    persist under scoping, or task success degrades past the declared bound.
  - **H-F6b (maker-checker):** propose-identity ≠ admit-identity reduces
    unauthorized-effect rate vs single-identity gating at matched overhead.
    The substrate's propose/admit split is already maker-checker; this names
    it in the controls vocabulary peers know. Falsified if split identities
    show no reduction vs the single-identity control.
  - **H-F6c (least-context canary egress):** plant N canary tokens in the
    workspace; enforce declared read-scope observation contracts and route
    egress through the sidecar gate; count canaries appearing in the provider
    request stream, governed vs ungoverned. Binary oracle, solo-runnable,
    provider-independent. Falsified if canary leakage does not drop, or the
    gate suppresses in-scope data needed for the task (measured as task-score
    non-inferiority violation).

## The autonomous-Arrowsmith benchmark (proposed headline testbed)

From the 2026-07-22 external review discussion, recorded verbatim as the
interpretation bound for this design:

> "Agents ran the research loop autonomously for M weeks" proves operability,
> not that the state problem is solved — unless you add two things. First, the
> ablation: the same engine, same agents, same corpus, run vanilla vs
> substrate-governed, endpoint = state-effect incidents per 100 sessions
> (forks, duplicate work items, contradicted standing decisions, lost
> handoffs — all things your dogfood corpus proves occur naturally). Second,
> an external oracle for output quality, and there is a beautiful one:
> known-solution rediscovery — take ~20 historically solved cross-domain
> problems (InnoCentive-style, including the two above), jargon-strip the
> problem statements, and score whether the engine independently reaches the
> known solution class. That oracle is external, binary, blind to the
> substrate's own log, and no reviewer can call it circular. The autonomous
> Arrowsmith engine then is the benchmark — a real long-horizon multi-agent
> workload — replacing MicroHub/ToolSandbox, and ArrowHedge is the same
> engine pointed at markets (RenTech's edge was literally marginality:
> mathematicians distant from finance).

**Grounding.** Jeppesen & Lakhani 2010 ("Marginality and Problem-Solving
Effectiveness in Broadcast Search," *Organization Science*,
[doi:10.1287/orsc.1090.0491](https://pubsonline.informs.org/doi/10.1287/orsc.1090.0491))
found technical and social distance from the problem field *positively*
predicted solving success — expertise is also a blinder (Einstellung). Field
cases: the OSRI oil-spill recovery challenge solved by a concrete chemist via
concrete-vibration knowledge; NASA's solar particle event forecasting
challenge solved by a retired RF engineer via magnetically coupled ground
observations. Agents are structurally marginal solvers — no field identity,
no career stake — and jargon-stripping at the problem-statement layer is the
automatable step. Swanson's own discoveries (fish oil → Raynaud's 1986;
magnesium → migraine) belong in the rediscovery set as canonical LBD targets.

**Design.**

- **Workload:** the jargon-stripping broadcast-search loop over a
  content-frozen problem corpus; multi-session, multi-agent, long-horizon —
  the class of workload where the dogfood corpus proves state failures occur
  naturally (v230 fork, 2026-07-06 self-block, corrupt admissions 12–14→0).
- **Arms:** vanilla vs substrate-governed, same agents, prompts, corpus,
  seeds; sham arm optional to eat the overhead confound.
- **Endpoint 1 (state-effect, primary):** incidents per 100 sessions — chain
  forks, duplicate work items, contradicted standing decisions, lost
  handoffs, corrupt admissions. Upstream task score, where one exists, is a
  non-inferiority guard only (state-effect endpoint amendment, 2026-07-15).
- **Endpoint 2 (external oracle):** rediscovery hit rate over ~20
  historically solved cross-domain problems, jargon-stripped; blinded rubric:
  does the engine's top-k hypothesis land in the known solution class?
- **Endpoint 3 (economics):** tokens/USD per rediscovery and per incident
  avoided (feeds the ISE 5763 cost-engineering analysis directly).
- **ArrowHedge relation:** the same engine pointed at markets; it remains
  frozen for efficacy use (D8 unchanged) until this benchmark produces
  evidence and an owner decision exists.

## Failed Assumption Ledger additions

- Rejected: "an autonomous run without human leadership would itself prove
  the state problem solved." It proves operability only, absent the ablation
  and the external oracle.
- Rejected: "task-completion oracles can confirm state-governance benefit."
  D6-B showed strict score 1.0 in every arm while two arms retained duplicate
  side effects; the endpoint must be the state effect itself.

## Smallest runtime-consumed next steps (no new packages, no new primitives)

1. One stale-basis superseded-snapshot scenario added to the existing
   local-agent-lab scenario registry, consuming the existing gate — the
   H-F2a pilot whose only job is to measure a non-saturated baseline breach
   rate before any metric is declared.
2. One canary-token egress probe through the existing MCP propose/admit path,
   counted by the existing shadow report — the H-F6c pilot, consuming
   integration-kit and shadow-report as-is.
3. The 20-problem rediscovery manifest assembled as content-frozen data (not
   code), hashed and anchored via `pnpm witness:anchor` before any engine
   run.

## Sources

[MAST, arXiv:2503.13657](https://arxiv.org/abs/2503.13657) ·
[τ-bench, arXiv:2406.12045](https://arxiv.org/pdf/2406.12045) ·
[Jeppesen & Lakhani 2010, Organization Science](https://pubsonline.informs.org/doi/10.1287/orsc.1090.0491) ·
[Replit incident, AIID #1152](https://incidentdatabase.ai/cite/1152/) ·
[Project Vend phase 1](https://www.anthropic.com/research/project-vend-1) ·
Hardy, "The Confused Deputy" (1988) · Kung & Robinson, "On Optimistic Methods
for Concurrency Control" (1981) · Terry et al., Bayou session guarantees
(1994) · Swanson, "Fish Oil, Raynaud's Syndrome, and Undiscovered Public
Knowledge" (1986) · first-party: `docs/state-validation/`,
`docs/evidence/capstone/RUNS.md`, `docs/state-effect-endpoint-amendment-2026-07-15.md`,
`AGENT_STATE_PROBLEM_FACTORS.md`, v229/v230/v232 of this stream.
