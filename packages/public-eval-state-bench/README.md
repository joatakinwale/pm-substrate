# STATE-Bench public adapter

This peripheral package binds pm-substrate to the official STATE-Bench Agent
Learning Track without changing benchmark tasks, environments, tools,
simulator, judge, or scoring. It pins `microsoft/STATE-Bench` revision
`fd980728da482af21f0d33406aea0ac499645125` (MIT, package `0.8.0`), the exact
`gpt54` protocol bytes, and the exact 300-file public training corpus.

There are two deliberately separate conformance classes:

- `adapter_conformance_only` proves that the upstream loader and retrieval seam
  accept the adapter. It is not a benchmark score or efficacy evidence.
- `official_output_shape_and_procedure_conformance_only` verifies the complete
  output layout, trajectory/scoring field shapes, recomputable aggregate fields,
  and arm/config/model/run/task bindings. Those fields are caller-authored, so
  this class is explicitly ineligible for efficacy claims or conversion to a
  `PublicEvalAttemptArtifact`.

The pinned upstream does not emit independently verifiable raw runner, agent
provider, simulator provider, and judge provider response receipts with request
IDs, usage, cost, latency, and exact request/response bytes. Therefore this
adapter currently exposes no eligible official-score conversion path.

## Treatment arms

- **Native:** upstream `StateBenchAgent`, no retrieval tool, no sidecar, no
  learning artifact. Receipt collection rejects any `retrieve_learnings` call.
- **Sham:** the same adapter, sealed artifact, and real
  `@pm/agent-state-core` observation/contract path, but over three independently
  selected, disjoint, zero-query-overlap train learnings.
- **Substrate:** the same boundary over the three highest-ranked current train
  learnings.

Both sidecar paths bind query/output counts using the explicit
`utf8_byte_token.v1` unit, measured local latency, and zero local retrieval cost
in each hash-chained audit. These counts are not provider tokenizer usage;
provider usage remains a required missing input for eligible evidence.

## Pin and seal the training artifact

Keep the upstream checkout clean. The verifier permits only the exact packaged
`agents/pm_substrate_agent.py` as an untracked file; keep virtual environments
and outputs outside the checkout.

```bash
pnpm --filter @pm/public-eval-state-bench build
node packages/public-eval-state-bench/dist/cli.js verify-checkout \
  --checkout /path/to/STATE-Bench

node packages/public-eval-state-bench/dist/cli.js seal-artifact \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json > /path/to/learnings.seal.json

node packages/public-eval-state-bench/dist/cli.js verify-artifact \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json
```

Sealing reopens the pinned Git checkout, recomputes all 300 train files, checks
the three official 100/50 train/test split manifests for disjointness, parses
every train trajectory, and verifies every citation is an actual same-domain
train member. A path that merely looks like a train path does not pass.
The artifact seal proves citation membership and byte identity. Non-native
runs additionally require an extraction-provenance receipt; the artifact seal
alone is no longer sufficient.

## Predeclare and seal learning extraction

Before extracting learnings, freeze the extractor implementation, procedure,
and train-only data policy in a content-addressed manifest. A model extractor
must provide both an exact model ID and a lowercase SHA-256 model digest. If a
provider cannot expose an immutable model digest, that model cannot satisfy
this protocol. A deterministic extractor instead declares its stable extractor
ID and the exact source revision/hash.

```bash
node packages/public-eval-state-bench/dist/cli.js create-extraction-manifest \
  --manifest-id state-bench-learning-extraction-v1 \
  --declared-at 2026-07-13T00:00:00.000Z \
  --extractor-kind model \
  --extractor-source-revision <git-revision> \
  --extractor-source /path/to/extractor-source \
  --model-id <exact-model-id> \
  --model-digest <64-lowercase-hex> \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json > /path/to/extraction.pipeline.json

node packages/public-eval-state-bench/dist/cli.js verify-extraction-manifest \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json
```

For a deterministic extractor, replace `--model-id` and `--model-digest` with
`--deterministic-extractor-id`. For every artifact entry, retain the extractor's
unmodified raw output and create one immutable record. Record filenames are
strictly `NNNN-<learningId>.json` in artifact-entry order:

```bash
node packages/public-eval-state-bench/dist/cli.js record-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --learning-id <learning-id> \
  --sequence 1 \
  --recorded-at 2026-07-13T00:01:00.000Z \
  --raw-output /path/to/raw-model-or-extractor-output > \
  /path/to/raw-records/0001-<learning-id>.json

node packages/public-eval-state-bench/dist/cli.js seal-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records > /path/to/extraction.provenance.json

node packages/public-eval-state-bench/dist/cli.js verify-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json
```

Each raw record embeds the exact bytes of every cited train trajectory. Receipt
verification reopens the clean pinned checkout, all 300 train files, every
procedure input, every raw record, every embedded citation, the artifact, and
the artifact seal. Exact schemas and train-only path validation reject undeclared
benchmark inputs and held-out/oracle citation paths.

This establishes byte identity and declared-procedure provenance only. It does
not prove that free text is a semantically correct derivation, that an external
model runtime did not receive undeclared inputs, or that the extractor actually
obeyed its prompt. Those stronger properties require independent execution
isolation or semantic review and must not be inferred from this receipt.

## Bind a run

Each domain and arm has a strict, secret-free run config. Example substrate
config (use the emitted `sealHash` exactly):

```json
{
  "schemaVersion": "pm-state-bench-run-config.v2",
  "experimentId": "state-bench-proof-001",
  "arm": "substrate",
  "domain": "customer_support",
  "agentModel": { "modelId": "the-exact-agent-model-id", "reasoningLevel": "high" },
  "agentClass": "PmSubstrateAgent",
  "split": "test",
  "numRuns": 5,
  "retrieveLearningsTopK": 3,
  "artifactSealHash": "<artifact sealHash>",
  "extractionProvenanceHash": "<extraction receiptHash>"
}
```

Native must instead use `StateBenchAgent`, `retrieveLearningsTopK: null`, and
both provenance hash fields set to `null`. Get the content identity with:

```bash
node packages/public-eval-state-bench/dist/cli.js config-hash \
  --config /path/to/run-config.json
```

For each sham/substrate run index, start a fresh sidecar and immutable audit
file:

```bash
node packages/public-eval-state-bench/dist/cli.js serve \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json \
  --config /path/to/run-config.json \
  --run-index 1 \
  --audit-log /outside/checkout/audits/run1.jsonl \
  --port 4319
```

Copy the packaged Python adapter byte-for-byte to
`STATE-Bench/agents/pm_substrate_agent.py`. Set the following non-secret run
identity variables to the values printed/derived by the CLI before invoking
upstream `run_task` with `--split test --num-runs 1`, the corresponding output
run index, `--agent-class PmSubstrateAgent`, and
`--retrieve-learnings-top-k 3`:

```text
PM_STATE_BENCH_EXPERIMENT_ID
PM_STATE_BENCH_CONFIG_SHA256
PM_STATE_BENCH_RUN_ID
PM_STATE_BENCH_MODEL_ID
PM_STATE_BENCH_RETRIEVAL_URL
```

Use a separate immutable output root for every arm and domain. Native uses the
upstream default agent and none of the adapter/sidecar variables. Score with
upstream's locked judge and compute `metrics.json` only after all five runs are
complete.

## Collect and reverify output conformance

For sham/substrate, receipt collection requires the verified artifact, artifact
seal, extraction provenance inputs/receipt, and five hash-chained audit logs.
Omit every sidecar/provenance option for native.

The results root must contain exactly `run1` through `run5`, `metrics.json`, and
`failures.json`; extra files/directories and symbolic links are rejected.
`failures.json` is always required, including when its records array is empty:

```json
{"schemaVersion":"pm-state-bench-failures.v1","records":[]}
```

```bash
node packages/public-eval-state-bench/dist/cli.js collect-output \
  --checkout /path/to/STATE-Bench \
  --results /outside/checkout/results/customer_support \
  --config /path/to/run-config.json \
  --audit-root /outside/checkout/audits \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json > /path/to/output.receipt.json

node packages/public-eval-state-bench/dist/cli.js verify-output \
  --checkout /path/to/STATE-Bench \
  --results /outside/checkout/results/customer_support \
  --config /path/to/run-config.json \
  --audit-root /outside/checkout/audits \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json \
  --receipt /path/to/output.receipt.json
```

The conformance receipt requires exactly 250 trajectory files for one
arm/domain, exact held-out task IDs in each run, exact model/config identities,
matching retrieval calls and audit records, and metrics that recompute from raw
task completion fields. It never stores API keys or credential values, but it
also does not prove that provider calls or judge responses occurred.

`convert-to-public-attempt --receipt <path>` is intentionally fail-closed and
returns the missing raw-receipt requirements instead of producing an attempt.

No eligible official result exists until an instrumented official runner has
captured and independently verified the missing raw receipts for all three arms
× three domains × five runs × fifty held-out tasks (2,250 trajectories). Loader
tests, hand-authored perfect fields, mocks, local judges, and synthetically
constructed fixtures are not substitutes.
