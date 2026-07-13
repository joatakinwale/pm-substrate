# `@pm/public-eval-toolsandbox`

Pinned receipt adapter for the first public agent-state validation slice. It
does not reimplement ToolSandbox and does not decide whether an internal block
was useful. Apple ToolSandbox's own `result_summary.json` remains the outcome
oracle.

The pin is `apple/ToolSandbox@165848b9a78cead7ca7fe7c89c688b58e6501219`,
scenario
`send_message_with_contact_content_cellular_off_multiple_user_turn`. The
scenario owns four milestones and no minefields. The manifest preserves that
zero instead of adding a local success condition. It also keeps two result
tracks disjoint: `official_headline` is the unchanged upstream scenario;
`restart_lost_response_derivative` uses the same upstream evaluator over a
locally perturbed trajectory and is never headline-eligible.

After building the package:

```bash
pnpm --filter @pm/public-eval-toolsandbox public-eval manifest
pnpm --filter @pm/public-eval-toolsandbox public-eval verify-corpus /path/to/ToolSandbox
pnpm --filter @pm/public-eval-toolsandbox public-eval qualify-headline qualification-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval run-matched-batch matched-batch-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval verify-matched-batch raw-verification-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval assess-public-eval-eligibility raw-verification.json
pnpm --filter @pm/public-eval-toolsandbox public-eval convert-public-eval-attempts raw-verification.json
pnpm --filter @pm/public-eval-toolsandbox public-eval create attempt-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval verify receipt-set.json
```

`qualify-headline` verifies the clean checkout and corpus, executes exactly the
pinned scenario through ToolSandbox's official CLI, locates the sole generated
`result_summary.json`, and embeds it in a content-addressed receipt. It writes a
`pm-qualification-<hash>.json` artifact under the requested empty output root.
Its Python executable must be an absolute path with ToolSandbox's pinned
dependencies installed. For a no-API plumbing smoke, use official agent
`Unhelpful`, user `Cli`, and scripted stdin `["end"]`; this only qualifies the
harness and oracle path and is not agent-efficacy evidence.

`run-matched-batch` generates matched candidate evidence. It is not itself a D7
efficacy-artifact path. It verifies the same clean pinned checkout,
deterministically randomizes native/sham/substrate run order from a recorded
seed, and runs every arm with the same official agent, user simulator, `DEFAULT`
tool backend, upstream harness seed `42`, and 30-message limit. Raw stdout,
stderr, official result summaries, conversations, boundary traces, and
content-addressed receipts stay under the requested output root. The batch
artifact inventories their hashes. `Unhelpful`, `Cli`, scripted, or fixture
runs only test plumbing. A provider-backed run still remains conformance-only
unless the provider request and response bytes, request IDs, token usage, cost,
and latency are retained and independently verified. New runs emit
`matched-batch.v2`: the runner bytes and raw runner metadata bind the arm,
track, model identities, backend, seed, and turn limit. Earlier
`matched-batch.v1` files lack that raw config binding and are intentionally not
accepted by the raw verifier; rerun them instead of upgrading their claims.

`verify-matched-batch` takes an input object with absolute `batchPath`,
`outputRoot`, and `checkoutPath` values. It reopens the batch and the entire
output tree, requires an exact no-extra/no-missing inventory, rejects symlinks
and path escapes, and re-hashes stdout, stderr, result summaries, trajectories,
boundary traces/state, and receipt files. It also rechecks the clean pinned git
checkout and corpus, the manifest-pinned local runner, randomized arm order,
and raw arm/config metadata. Finally it reconstructs every receipt from the raw
metadata plus Apple result summary and recomputes the official oracle fields and
batch summary. An embedded receipt cannot supply its own score or fault claim;
an applied restart fault must be supported by the raw trajectory and, for sham
or substrate, the boundary trace's target-side outcome receipt.

The verification artifact is deliberately labeled
`artifactIntegrityAndConformanceOnly`. This is independent recomputation from
raw bytes by the same producer package, not an independent signer or third-party
replication, and it does not establish agent efficacy. A fault that was not
reached remains visible as `trigger_not_reached`; it cannot be rewritten into an
applied-fault claim. The hashed verification also records that the substrate
treatment is a `direct_agent_state_core_peripheral_adapter`, invoked from the
ToolSandbox Python runner through this package's Node CLI. It does not exercise
the substrate's real authenticated HTTP/MCP sidecar protocol.

`assess-public-eval-eligibility` is the explicit bridge to the generic
`PublicEvalAttemptArtifact` gate. For current `matched-batch.v2` output it
reports `publicEvalAttemptArtifactEligible: false`, even after verifier-v2 has
replayed all three trajectories. Current artifacts do not content-resolve:

- provider request bytes, response bytes, request IDs, usage, cost, or latency;
- exact extracted benchmark task and oracle bytes (whole-file corpus pins are
  not a substitute);
- a verified receipt proving the real authenticated HTTP/MCP sidecar protocol
  was exercised; or
- an independent verifier signature anchored in an external trust policy.

`convert-public-eval-attempts` therefore always fails closed for the current
schema. Adding caller-authored usage fields or claiming that a sidecar ran does
not upgrade the evidence: the bridge accepts only the exact verifier-v2 shape,
binds the direct-adapter execution path, and rejects supplemental claims. A
future adapter revision must retain and independently verify every missing byte
and receipt before it may emit a `PublicEvalAttemptArtifact`.

The derivative uses the exact official scenario and its evaluator, but is
reported separately from headline evidence. After the first successful
`send_message_with_phone_number` side effect, the runner persists its outcome,
drops the response, tears down the provider agent role, and creates a new role
inside the same Python process. This is session/role re-instantiation, not an OS
process restart. Native receives no state service. Sham and substrate both
cross the same package-CLI/core-review adapter and persist equal-shaped state;
sham deliberately reads unrelated state, while substrate uses the durable
target receipt to block an exact retry before ToolSandbox executes it. An
internal block is telemetry only: Apple's milestone oracle still exclusively
decides task success.

`create` writes a content-addressed receipt to stdout. `verify` expects a JSON
array containing one matched native, sham, and substrate receipt. A scheduled
fault that is not reached is retained as a failed attempt; it is not silently
dropped. Raw upstream results and internal block telemetry remain separate, so
blocking cannot be promoted into task completion.
