# Sentinel production power redesign (pre-outcome)

This calculation protects the owner’s objective: it asks whether the frozen
Sentinel comparison can detect a real pm-substrate improvement without turning
simulation noise, repeat pseudo-replication, or clean-control failures into an
efficacy claim. It reads no benchmark outcome and cannot authorize execution or
material benefit.

## What the calculation rejects

The original proposal used the same value for the minimum observed material
lift and the assumed true lift: 0.10. Even the necessary two-control point-lift
gate then has probability at most `0.511210781855188` across its declared
baseline grid at 19 tasks × 3 repeats. Holm correction, the task bootstrap, and
the fail-closed guardrails can only reduce that probability. That proposal
remains falsified.

## Honest conditional redesign

The replacement keeps the claim threshold at a 0.10 observed lift over *each*
of native and sham, but evaluates a distinct 0.35 true planning alternative.
For every simulated data set it runs the actual complete rule:

1. both observed point lifts are at least 0.10;
2. both paired task-level exact sign-flip tests reject under Holm FWER 0.05;
3. the exact signed 10,000-draw task bootstrap has sorted index 499 strictly
   above zero for substrate minus the larger control mean; and
4. raw completeness, infrastructure completeness, economics completeness,
   expected-allow controls, and no-op controls are all clean.

The guardrails are assumed clean with probability one for planning. This is an
optimistic upper condition, not permission to ignore them: the implementation
tests that changing any one to false makes the full result false.

The stochastic assumption suite uses equal native/sham marginal rates on a
0.00–0.65 grid in 0.05 increments. A task-arm is either independently repeated
or, with probability rho, all three repeats share one Bernoulli result. This
preserves the marginal rate and makes within-task-arm repeat ICC exactly rho.
The sensitivity suite is rho = 0, 0.10, 0.25, and 1. Arms and tasks are otherwise
independent and task rates are homogeneous inside a cell; those are explicit
limitations, not facts learned from the benchmark.

Each of the 56 cells has 2,048 deterministic trials. Power is not accepted from
the raw Monte Carlo fraction. Each cell receives a one-sided exact-binomial
Clopper–Pearson lower limit with Bonferroni allocation providing at least 99%
simultaneous confidence over the complete grid.

| Repeat dependence | Worst estimated power | Worst simultaneous lower bound | 0.80 target |
|---|---:|---:|---|
| rho = 0 | 0.9399 | 0.9190 | passes conditionally |
| listed rho = 0.10 | 0.8965 | 0.8705 | passes conditionally |
| rho = 0.25 | 0.8052 | 0.7724 | not established |
| rho = 1 | 0.3643 | 0.3267 | fails |

The result is deliberately
`conditional-power-only-redesign-not-yet-eligible`. The artifact does not prove
the repeat ICC, and its four listed ICC values do not imply coverage of every
value between them. It also does not prove that the homogeneous-rate sensitivity
bounds the heterogeneous public tasks or that every guardrail will be clean.

## Smallest honest next design decision

Retaining 19 × 3 is defensible only after independent, predeclared evidence
supports the repeat-dependence and outcome-model assumptions and the calculation
covers the accepted dependence range rather than only selected points. If that
evidence does not support them, adding repeats is not a general repair because
perfectly correlated repeats add no information. Add untouched, independent
relative state-failure tasks and rerun this calculation until the simultaneous
lower bound exceeds 0.80 under the accepted sensitivity suite. Do not relax the
0.10 claim threshold, remove either control, or reinterpret the 19 tasks as 57
independent observations.

## Replayable artifacts

- Calculation artifact:
  [`sentinel-production-power-redesign-v2.json`](../packages/public-eval-corners/fixtures/sentinel-production-power-redesign-v2.json)
  - canonical audit hash: `9c5a9bc60bd17c4e49609eaac35fbe38803dee7941362f14cc036a508e206521`
  - exact file SHA-256: `53c15428eb4a4dfe7f188f040ae9f36766960fa9d1085e543bbdecc69e82950e`
  - frozen calculation-procedure hash: `c8938b9a73cd2ea7a04f45df54692cba3266605c33486b06eb387b9f77fbc6a7`
  - TypeScript calculation/verifier source SHA-256: `92d4a674212d7becef0d2737cda25a4b2bf62c1770ae90acad603eb1548e533a`
- Independent replay:
  [`sentinel-production-power-independent-verifier.py`](../packages/public-eval-corners/scripts/sentinel-production-power-independent-verifier.py)
  - independent source SHA-256: `71ac01acfa81668e73393b492e30b8011fa9c220fb2e5d3bafa111a591d5d7ff`
  - full 56-cell replay receipt:
    [`sentinel-production-power-independent-verification-v1.json`](../packages/public-eval-corners/fixtures/sentinel-production-power-independent-verification-v1.json)
  - receipt file SHA-256: `bea82b260c0ac04b6c99ee14cb77c924c1e31c887fb62c45845b312b7cb26bfd`

Generate a new authoritative artifact without overwriting an existing file:

```bash
pnpm --filter @pm/public-eval-corners build
node packages/public-eval-corners/dist/sentinel-production-power-audit-cli.js \
  --output /tmp/sentinel-production-power-redesign-v2.json
```

Independently replay every trial and every gate (parallel workers affect only
runtime, never bytes or decisions):

```bash
python3 packages/public-eval-corners/scripts/sentinel-production-power-independent-verifier.py \
  packages/public-eval-corners/fixtures/sentinel-production-power-redesign-v2.json \
  --workers 8
```

The planning result contains no live benchmark outcomes and provides no basis
for Arrowsmith research. Arrowsmith remains gated on an independently
raw-verified behavioral pm-substrate gap.
