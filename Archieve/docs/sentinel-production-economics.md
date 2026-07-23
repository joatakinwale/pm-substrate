# Sentinel production economics boundary

The production Sentinel result cannot claim material benefit merely because
token and latency fields exist. The retained provider usage must be priced from
raw records, every cell must satisfy an absolute cost and duration ceiling, and
the substrate arm must satisfy both matched-control cost comparisons.

## Frozen price schedule

The direct provider is the first-party Anthropic Messages API with model
`claude-sonnet-4-5-20250929`, standard synchronous billing, no batch API, and no
prompt caching. Anthropic's official [Claude Platform pricing
documentation](https://platform.claude.com/docs/en/about-claude/pricing),
observed 2026-07-14, lists Claude Sonnet 4.5 at **$3 per million base input
tokens** and **$15 per million output tokens**. The source locator, rates, and
observation date are part of the content-hashed schedule in
`sentinel-production-economics.ts`.

The calculation uses integer micro-USD:

```text
input cost  = input_tokens  * 3 micro-USD
output cost = output_tokens * 15 micro-USD
cell cost   = input cost + output cost
```

This is exact: one USD and one million tokens contain the same number of base
units, so `$3 / MTok` is exactly `3 micro-USD / token`. The implementation
rejects unsafe integer totals rather than rounding them.

The schedule is source-attributed, but the module does not pretend that a URL
inside a producer-owned bundle is an independent trust anchor. Before live
eligibility, the externally committed experiment inputs must bind the exact
schedule hash. If the official list price changes, a new pre-outcome schedule
and external commitment are required; a run must not silently reprice itself.

## Hard guardrails

Every raw-complete cell must prove all of the following:

- at least one successful direct provider operation with positive input and
  output usage;
- the exact pinned model and first-party standard Messages surface;
- no batch request, no prompt-caching request, zero cache-write tokens, zero
  cache-read tokens, and zero separately priced server-tool requests;
- at least one raw-derived state operation with the matched 250 ms response
  boundary and no deadline miss;
- provider cost no greater than `10,000,000` micro-USD ($10);
- end-to-end supervisor attempt duration no greater than `720,000` ms; and
- exactly one `native`, `sham`, `plain-kv`, and `substrate` cell for each signed
  cell prefix.

Across the complete matched batch, both controls must have strictly positive
cost. The exact relative tests are:

```text
substrate_cost * 4 <= native_cost * 5
substrate_cost * 4 <= sham_cost   * 5
```

This avoids floating-point ratio rounding. Missing, zero-cost, mismatched, or
partial controls fail closed.

## Raw-verifier integration contract

`auditSentinelProductionEconomics` accepts the exact v1 input schema and emits
an immutable, content-hashed v1 report. The raw verifier must construct that
input only after every declared cell is raw complete. For each cell it derives:

- provider operations from the exact retained request, response usage, and
  attempt-terminal record;
- `input_tokens`, `output_tokens`, absent cache fields normalized to zero only
  after proving the request contains no cache control, all nonzero server-tool
  counters, and the exact operation latency;
- state operations from each verified state audit timing receipt; and
- the attempt duration from the verified supervisor start/finish boundary.

The report's `inputSha256` binds the complete derived input. Its own
`economicsReportSha256` covers the schedule, thresholds, all cell/arm totals,
guardrails, limitations, and issues. `verifySentinelProductionEconomicsReport`
checks the strict root shape, frozen schedule, non-eligibility fields, and
report hash. The benchmark raw verifier remains responsible for binding the
input hash back to the retained raw records.

The economics report always has `evidenceEligible=false` and
`materialBenefit=false`. It cannot promote itself. Qualification and procedural
phases may report it diagnostically; powered analysis may proceed only when its
raw verifier obtains `guardrails.allGuardrailsPassed=true` and every other
outcome/clean-control gate passes.

## Latency boundaries and preserved gap

The report deliberately keeps four boundaries separate:

- provider latency: direct Messages API client round trips recorded by the
  provider proxy;
- state backend work: sidecar receive to backend completion on the sidecar's
  monotonic clock;
- controlled state API window: sidecar receive to response release on that
  clock; and
- attempt duration: supervisor start to finish, the end-to-end 720-second cap.

The current evidence does **not** capture state API client round-trip latency.
Component durations may not be subtracted from the supervisor duration as if
they shared an attribution clock. No relative provider-latency or state-overhead
threshold was preregistered, so the report sets the corresponding claim support
to false rather than manufacturing a favorable latency result. The end-to-end
attempt cap remains the enforceable latency guardrail.

## Runtime use

The CLI is the non-test runtime consumer:

```bash
pnpm exec tsx packages/public-eval-corners/src/sentinel-production-economics-cli.ts \
  audit raw-derived-economics-input.json --output economics-report.json

pnpm exec tsx packages/public-eval-corners/src/sentinel-production-economics-cli.ts \
  verify economics-report.json
```

Both modes exit nonzero when their guardrail or verification result fails, while
still emitting the failure artifact.
