# Business-operability objective and falsification gate

*Decided 2026-07-13. The continuity-ledger decision is authoritative; this
document explains the executable gate consumed by `pnpm pm:memo`.*

## The criticism

The original north star — “make two agent-run businesses worth operating” —
mixes three different claims:

1. the substrate is technically sound;
2. the substrate improves the labs' operating loops;
3. the businesses themselves have market value.

The repository can directly test the first two. It cannot prove demand,
marketing ROI, or investment alpha merely by proving state coherence. A green
hash chain, a blocked unsafe action, or an idempotent sync is necessary product
evidence, but none says that a correct useful outcome occurred at an acceptable
cost. Treating technical activity as the business outcome would let a safe but
unused system pass.

The falsifiable claim is therefore narrower and causal:

> Relative to the same lab workflows without pm-substrate, the sidecar makes
> correct end-to-end operation at least as reliable and no more costly in owner
> effort, while adding enforceable governance, requiring no substrate edits or
> app rewrite, and staying within a bounded cash-cost premium.

Commercial viability remains a lab-level claim. ArrowHedge remains historical
research/simulation; this gate makes no trading-performance or financial-advice
claim.

## How a technically green project could still fail

| Failure | How it can hide | Required counter-evidence |
|---|---|---|
| Activity substitutes for outcomes | Counts of events, blocks, sessions, or closed work rise while no useful task finishes | Predeclared outcome oracle and correct-outcome rate for paired lab runs |
| A demo is overfit | One known fixture or seeded failure passes | At least one held-out or dynamic-state run per lab |
| Safety destroys utility | The gate blocks everything, producing zero false negatives by refusing valid work | Expected-allow and expected-block cases; measure both false positives and false negatives |
| The app routes around governance | One showcased write is governed while another write path remains direct | Inventory all write paths and require 100% coverage for the pilot action scope |
| Integration is cheap only in theory | Adapters work after hidden substrate edits, app rewrites, or days of setup | Git-derived edit count, rewrite declaration, time-to-first-value, and mapping coverage |
| Correct work is uneconomic | Reliability improves but model/tool spend or owner babysitting overwhelms the benefit | Cost and operator minutes per correct outcome versus the paired baseline |
| Benchmark success does not transfer | Clean local fixtures pass; changing state, external dependencies, or environment drift fail | Production-like shadow run with source refs and owner acceptance |
| Measurement is self-asserted | A scorecard says that attachment/action happened without log evidence | Derive read attachment and governed dispatch independently from admitted events |
| Infrastructure changes move the score | Runtime/model/tool changes are mistaken for product improvement | Pin run manifests and compare only matched arms; report environment changes |

## Executable scorecard

`@pm/evals` evaluates six dimensions for **both** `plugged_in_social` and
`arrowhedge`. Initial D6 pilot thresholds are intentionally small, not a claim
of statistical generality:

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

The technical baseline is green, including live MCP traffic, generic sync,
executor rehearsal, an ArrowHedge read attach, and local paired failure cases.
There are no admitted per-lab objective measurements, no PluggedInSocial read
attach, and no per-lab governed dispatch. Cost per correct outcome, owner effort,
held-out runs, production-like acceptance, and end-to-end correct outcomes are
unmeasured. The evidence therefore caps the verdict at
`keep_with_scope_cut`. Revision revalidation also found that PluggedInSocial is
missing `browser_qa_harness` plus `operatorRunMonitorSurface`, while current
ArrowHedge `main@6713139` no longer mounts the `/integration/v1` contract used
by the historical 2026-07-07 rehearsal. The default substrate suite is green
(962 passed, 7 external-app tests skipped); opting the current
PluggedInSocial checkout into conformance produces 6 failures, all downstream
of those missing anchors. The roadmap therefore treats app-boundary repair as
a prerequisite, not as evidence that can be waived by the green core suite.

## Research basis

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
