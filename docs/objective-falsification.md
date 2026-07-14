# Public agent-state objective and falsification gate

*Proof order superseded 2026-07-13. The continuity-ledger decision is
authoritative. The public-benchmark gate below is immediate; the existing
business-operability gate consumed by `pnpm pm:memo` is preserved as a deferred
transfer gate and cannot currently produce a full keep decision.*

## Why the current evidence is insufficient

The objective is to prove—or falsify—pm-substrate on real, publicly documented
agent-state failures. PluggedInSocial and ArrowHedge are frozen future transfer
targets; making those labs worth operating is not the current objective. The
earlier validation path often mixed four different evidence layers:

1. the substrate is technically sound;
2. its state mechanism changes agent behavior;
3. that behavior causes more correct end-to-end outcomes;
4. the two businesses themselves have market value.

The current suite strongly exercises the first claim and locally demonstrates
parts of the second. It has not independently established the third. Most local
scenarios own both the failure injection and the expected gate verdict, so they
can reward a mechanism that merely recognizes its own fixture. A green hash
chain, a blocked unsafe action, or an idempotent sync is useful mechanism
evidence, but none proves that an independent task finished. Small paired runs,
repeated attempts on the same fixture, or an oracle derived from the gate can
also create false confidence. The fourth claim requires later business evidence
and cannot be inferred from any benchmark.

The governing falsifiable claim is causal:

> On pinned public tasks that expose stale, contradictory, lost, or changing
> operational state, an agent using pm-substrate completes more tasks according
> to the benchmark's unchanged independent oracle than the same agent using
> either its native state path or an equal-overhead sham sidecar, while staying
> within declared collateral-state, false-block, cost, and latency guardrails.

This does not claim that a benchmark represents every workplace, that the
substrate improves model intelligence, or that the two labs are commercially
valuable. PluggedInSocial and ArrowHedge are frozen until this public claim is
kept. ArrowHedge remains historical research/simulation; no result is a trading
performance or financial-advice claim.

## How a technically green project could still fail

| Failure | How it can hide | Required counter-evidence |
|---|---|---|
| Activity substitutes for outcomes | Events, blocks, receipts, or warnings rise while no task finishes | The unchanged benchmark-owned strict task oracle is primary |
| Gate and oracle share logic | The same predicate decides whether to block and whether the run passed | Oracle code cannot import or call the admission predicate; verify this structurally and with mutants |
| Safety destroys utility | Blocking everything appears perfectly protective | Expected-allow/no-op tasks plus a `block-all` mutant must be red |
| Guardrails are absent | Allowing everything maximizes completion while ignoring stale state | Expected-block tasks plus an `allow-all` mutant must be red |
| A demo is overfit | One known fixture or tuned public task passes | Locked held-out split, separate qualification artifacts, and second-benchmark/model replication |
| Fault injection changes the claim | A modified task is reported as the original benchmark result | Untouched headline score and labeled derivative fault-injection score are separate |
| Repeats masquerade as sample size | Five runs of one task are treated as five independent tasks | Task-level paired analysis; repeats/seeds clustered within task |
| Identity collisions hide failures | Fixed run/pair IDs overwrite or merge attempts | Unique attempt ID plus exact benchmark, split, model, config, seed, and revision binding |
| State benefit is really extra context | A larger prompt or extra tool call creates the lift | Equal-overhead sham sidecar with irrelevant but structurally equivalent state |
| Infrastructure changes move the score | Model, simulator, prompt, or tool changes are mistaken for substrate lift | Content-addressed run manifests and matched arms; mismatches are refused, not adjusted away |
| Correct work is uneconomic | Extra retries/tokens buy a small completion gain | Cost and latency per strict success, with a declared premium ceiling |
| Receipt is self-asserted | The producer writes both result and proof, or selects the verifier policy after seeing results | Pre-run registration under an externally pinned authority; independent verifier recomputes raw evidence; separate owner authorizes the exact report hash |
| Arms differ outside the treatment | Substrate gets a better command, model, prompt, environment, context budget, or order | Immutable typed arm interventions, one shared runner/config/model, environment hashes, deterministic randomized order, and directly checked overhead equivalence |
| Score-shaped JSON substitutes for execution | A locally authored file matches an official metric schema | Raw runner/provider/simulator/judge request and response receipts, IDs, usage, cost, latency, exact bytes, and an adapter that fails closed when any are absent |
| Verification becomes the decision | Six signatures are translated directly into KEEP | Automation emits only conditional evidence eligibility; a distinct authenticated owner signs the report hash and consequence |

## Immediate public-proof scorecard

### Outcome hierarchy

The primary endpoint is the public benchmark's strict task completion, paired
by task between arms. A second primary reliability endpoint is the share of
tasks that succeed across every predeclared restart/mutation repeat; a lucky
single pass is not reliable success. Diagnostic drivers include stale-state
detection, duplicate prevention, recovery time, and retrieval quality. The
guardrails are false blocks on expected-allow/no-op tasks, collateral state
changes, cost per strict success, and latency per strict success. Substrate
event counts, blocks, warnings, and receipt counts never appear above the
diagnostic layer.

Every comparison has at least three matched arms:

1. `native` — the benchmark's default state path;
2. `sham` — the same sidecar/tool/token/latency shape but irrelevant state and
   no useful substrate decision;
3. `substrate` — the real read/observe/review path.

An enforced-admission arm may be added for tool-use tasks, but is reported
separately because preventing a tool call changes task affordances. A block is
correct only when the independent upstream oracle says the resulting task is
correct. Qualification also runs `block-all` and `allow-all` mutants; neither
may satisfy the combined outcome and guardrail gate.

### Evidence layers

- **Conformance:** deterministic fixtures prove adapters, hashes, controls, and
  boundary wiring. They make no efficacy claim.
- **Qualification:** visible public tasks debug the harness, estimate variance,
  and set the predeclared confirmatory sample size. They cannot be reused as
  confirmatory evidence.
- **Confirmatory:** locked held-out tasks use the official simulator/judge and
  a frozen manifest. Exclusions and stopping rules are declared before results.
- **Replication:** a clean checkout independently verifies receipts, then a
  second benchmark or model tests whether the direction survives.

The frozen decision threshold is a task-level paired lift of at least ten
percentage points over both native and sham, using simultaneous inference
against the maximum control inside each bootstrap draw, with the confirmatory
confidence interval excluding no lift. Qualification may revise a future
protocol only before its held-out manifest is externally preregistered.
Reliable success must be at least 0.5 and improve separately over both controls;
false blocks and unexpected collateral changes are zero for the deterministic
state tasks; cost per strict success is capped at both $10 absolute and 1.25
times each control; latency per strict success is capped at both 300,000 ms and
1.25 times each control. An unavailable comparison fails closed. A five-run
pilot is never enough by itself: even zero failures in five leaves large
failure-rate uncertainty.

### Manifest and receipt contract

Each attempt binds the upstream HTTPS repository URL, immutable content
revision, SPDX license, task ID and content hash, original/derivative label,
eligible-universe inventory root/index/proof, deterministic selection digest,
split and corpus hash, resolved simulator/judge/model identities, individual
prompt/tool/decoding/runner hashes, a provider sampling seed when the upstream
runtime exposes one (otherwise a stochastic repeat identity plus an explicit
no-seed declaration), substrate revision/configuration,
immutable arm intervention and execution binding, initial environment snapshot,
randomized arm position, pair ID, unique attempt ID, start/end timestamps, raw
artifact hashes, token/tool counts, and strict oracle result. Aggregate
configuration hashes are recomputed from those components rather than accepted
as opaque labels.

Before the first attempt, a signed preregistration receipt binds the exact
manifest and trust policy. One independently signed execution receipt per
attempt binds its start/end time and raw-artifact root. The D7 bundle contains
the evidence bytes (or content-resolved inventories) for every declared
verifier check. Receipts bind the exact manifest, attempt root, and evidence
root and are Ed25519-signed. The verifier owner must differ from the experiment
producer; its public key/source revision comes from a separate trust policy
whose expected hash is supplied by the owner or CI outside the bundle.
Verification rejects changed bytes, premature or missing time receipts,
unreferenced evidence, duplicate task content, cross-arm mismatches, split
leakage, model/config aliases, intervention/environment drift, and an
oracle/gate dependency. Plain hashes, timestamps, signatures under a
caller-selected key, or an `independent=true` assertion are not authentication.

The current evaluator requires non-empty kind-specific canonical JSON for all
six verifier classes and all 31 required checks. Every check binds exactly one
embedded semantic observation to an evaluator-recomputed subject hash. The
gate reopens its base64, length, media type, and SHA-256; enforces its exact
kind/check/subject, versioned procedure, and strict fact keys; and recomputes
an internal predicate from those facts. Opaque, missing, structurally irrelevant,
unsupported, unresolved, unreferenced, or claim/result-mismatched observations
fail. That does not yet prove the facts came from the subject: the current
generic procedures do not derive them from the bound manifest, attempts,
analysis, and content-addressed provider/oracle records. Report v4 therefore
labels them `signed_structured_assertions_diagnostic_only`, records
`adapter_specific_raw_derivation_not_implemented`, and always emits
`not_eligible`. A future adapter-specific raw-derivation path may emit
conditional eligibility, but it remains non-authoritative and requires a
separate owner authorization over the exact report hash. No automated output
can be KEEP or unfreeze an app.

The first slice is ToolSandbox's public multi-turn cellular/message scenario.
Its original milestone/minefield result is the headline. A separately labeled
derivative must lose a tool response and restart the OS process; the substrate
must recover without sending the message twice or changing unrelated state.
The current deterministic qualification now uses an authenticated sidecar and
real killed/reaped/fresh provider process. Native and sham duplicated the
target side effect in the derivative while substrate suppressed it, but the
unchanged upstream score stayed `1.0` in every arm. This qualifies the bounded
mechanism and exposes an oracle blind spot; the scripted probe, missing provider
economics, and absent external trust keep it ineligible for efficacy. The
headline held-out program is STATE-Bench Agent Learning Track. Its phase-safe
plan uses stochastic repeat identities because the pinned upstream exposes no
sampling seed. Independent
corners add public fact-supersession, restart/idempotency/collateral, and
dynamic-state tasks. Exact pinned revisions and licenses are recorded by the
adapter manifests rather than copied into this prose.

### Failure-driven repair (Arrowsmith)

No new primitive is justified by a plausible story. A repair must preserve this
chain: public failing trace → classification against existing primitives →
documented adjacent solution → falsifiable hypothesis → smallest general
runtime-consumed change → ablation → exact task retest → clean regression and
control run. If removing the change does not remove the measured benefit, or if
the change does not beat sham, it is not the cause and must be reverted or the
claim narrowed.

## Deferred business-operability scorecard

`@pm/evals` already evaluates six dimensions for **both**
`plugged_in_social` and `arrowhedge`. This remains executable so historical
evidence can be audited, but collection is paused until D7 keeps the public
claim. Its small pilot thresholds are not a claim of statistical generality:

| Dimension | Threshold |
|---|---|
| Technical baseline | Valid chain; live MCP action; generic sync; executor dispatch; live paired scenario |
| Adoption | 0 substrate-package edits; no app rewrite; first value within 8 hours; mapping coverage >= 90%; admitted read attachment |
| Operational outcomes | At least 5 matched attempts per arm and 5 paired runs; substrate correct-outcome rate >= 80% and not below baseline; at least 1 held-out/dynamic run |
| Governance quality | 100% of in-scope write paths governed; false-positive blocks = 0; false-negative allows = 0; a governed action dispatched |
| Economic value | Cost per correct outcome <= 1.25x baseline; owner/operator minutes per correct outcome <= 1.0x baseline |
| External validity | At least 1 production-like shadow run and explicit owner acceptance |

These thresholds live in
`DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS`; changing them is a product decision,
not a test workaround, and requires a superseding continuity checkpoint.

## Measurement protocol

Before each pilot batch, save a run manifest that fixes the workflow, input,
model/tool versions, environment, starting state, outcome oracle, expected gate
verdicts, and maximum operator intervention. A “correct outcome” is not “the
agent responded”:

- PluggedInSocial: the selected workflow reaches its predeclared external
  terminal state, the resulting artifact satisfies the run's constraints, and
  the external receipt/read-back matches the intended action.
- ArrowHedge: the historical research/backtest workflow reaches its declared
  terminal state with replayable sources and correct deterministic allow/block
  behavior. Market/PnL deltas stay separate from governance deltas.

Run baseline and substrate arms against matched inputs. Record every attempt,
including failures and owner interventions. Keep the holdout input or dynamic
state out of the implementation loop. Source refs must point to durable
artifacts or admitted event IDs; placeholder refs are rejected. Every record
also binds the run-manifest reference, boundary-conformance artifact, app
revision/source hash, and substrate revision. Sync and executor events must
carry the same four coordinates, so a successful rehearsal cannot silently
stand in for a later app revision whose integration boundary has changed.

Generate the boundary receipt by running the app's existing conformance suite
through `pnpm pm:boundary`. Git worktrees are pinned to the commit plus a dirty
tree hash. Gitless snapshots use an explicit, sorted `--fingerprint-path`
scope and a SHA-256 source-tree revision. Failed checks still write a durable
red receipt, but `pm:objective record` recomputes the receipt and refuses it
unless it is green and exactly matches the measurement's lab and revisions.
Raw command output is not copied into the receipt; byte counts and hashes are.

Use:

```bash
pnpm pm:objective -- template plugged_in_social --out /tmp/pis-objective.json
pnpm pm:objective -- record /tmp/pis-objective.json
pnpm pm:objective -- list
pnpm pm:memo
```

The measurement event is evidence, never authority. `pm:memo` independently
derives admitted read attachments and governed action dispatches from the event
log, then applies the verdict ceiling:

- `kill_or_repair`: the technical baseline or evidence integrity is broken;
- `keep_with_scope_cut`: the substrate is technically viable but the business-
  operability claim is incomplete or failed;
- `keep`: both labs meet every dimension. This still does not prove demand,
  revenue, marketing lift, or investment alpha.

## Current result — 2026-07-13

The implementation baseline was green before this reset (build and typecheck;
967 passing tests with 7 external-app skips; strict contract, budget, zero-edit,
and primitive back-map gates). Live MCP traffic, generic sync, executor
rehearsal, and local paired scenarios show that mechanisms can execute. The new
public packages harden matching, provenance, transition replay, and decision
authority, but deliberately refuse to manufacture eligible attempts from the
available ToolSandbox and STATE-Bench artifacts. The corner harness has no real
matched-agent result. There is no externally preregistered held-out run,
provider-complete public score, replicated evidence bundle, or owner
authorization. The current public-efficacy verdict is therefore **unproven**,
not `keep`.

Historical lab-boundary and objective artifacts remain auditable at their exact
revisions, but no PluggedInSocial or ArrowHedge repair or measurement is part of
the current program. `pnpm pm:memo` must keep reporting its business verdict as
a separate deferred claim; it cannot promote local conformance or a future
public result into business operability.

## Research basis

- [in-toto layouts and links](https://in-toto.io/docs/getting-started/)
  separate an owner-authorized plan from functionary-signed execution evidence.
- [Sigstore Rekor](https://docs.sigstore.dev/logging/overview/) and its
  [timestamp model](https://docs.sigstore.dev/cosign/verifying/timestamps/)
  show why artifact signatures need an append-only witness and trustworthy time
  source rather than a bundle-local clock.
- [OSF preregistration](https://help.osf.io/article/330-welcome-to-registrations)
  freezes a time-stamped, read-only analysis plan before collection.
- NASA's [Space Flight Program and Project Management Handbook](https://ntrs.nasa.gov/citations/20220009501)
  and [NPR 7120.5F](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)
  separate independent review from the Decision Authority's signed decision.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for deployment-context testing, production monitoring, and ongoing
  measurement with human/domain input.
- [AI Agents That Matter](https://arxiv.org/abs/2407.01502) argues that agent
  evaluation must jointly consider accuracy and cost, use holdouts, and remain
  reproducible and downstream-specific.
- [OSWorld 2.0](https://arxiv.org/abs/2606.29537) shows a large gap between
  partial progress and strict completion on long-horizon, dynamic workflows.
- [METR's time-horizon methodology](https://metr.org/time-horizons/) warns that
  success on clean tasks does not establish economically valuable performance
  on messier work.
- [Anthropic's agent-evaluation guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  combines automated evals with production monitoring, user feedback, and
  human review.
- [Anthropic's infrastructure-noise study](https://www.anthropic.com/engineering/infrastructure-noise)
  demonstrates that infrastructure changes can materially move evaluation
  results, hence the matched and pinned run manifest.
