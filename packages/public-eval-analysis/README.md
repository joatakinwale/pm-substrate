# Public evaluation analysis

This package is the benchmark-agnostic decision boundary for public
pm-substrate experiments. It admits only predeclared, hash-bound
native/sham/substrate triples and gives task clusters equal weight. Benchmark
events, governance blocks, and substrate receipts are diagnostics; only the
upstream benchmark's strict oracle boolean counts as task success.

The manifest freezes:

- benchmark HTTPS repository, immutable 40/64-character revision, SPDX
  license, split identity, corpus hash, content-addressed eligible-task
  inventory, and deterministic selection seed/algorithm/count;
- experiment-producer identity;
- harness and substrate revisions;
- qualification, confirmatory, and distinct replication model IDs and resolved
  digests;
- individual prompt, tools, decoding, simulator, judge, and runner hashes; the
  aggregate non-model configuration hash is recomputed from them and must be
  identical across confirmation and model replication;
- every included or pre-run-excluded benchmark-content task, original/derivative
  identity, eligible-universe membership, initial environment snapshot, and
  seed schedule;
- immutable native, irrelevant-sham, and substrate interventions, equal
  sham/substrate sidecar overhead, and deterministic arm order;
- six adapter-specific verifier identities and source revisions selected before
  outcomes exist;
- false-block and collateral-write guardrails;
- task-clustered bootstrap settings; and
- lift, reliability, cost-per-success, and latency-per-success thresholds.

Qualification is always ineligible for a keep decision. Each decision phase
requires at least 20 independent canonical tasks and three predeclared seeds
per task. Model replication reuses the exact held-out task and seed schedule
with a different model ID and digest. `pairedAnalysisCriteriaPassed` means only
that the statistical, guardrail, and economics checks passed; it is not a D7
decision. When a confirmatory or replication phase is declared, its included
benchmark-content hashes must be exactly the predeclared `selectionCount`
lowest SHA-256 ranks over the full eligible universe. Membership alone is not
enough, so a caller cannot substitute another valid but post-hoc-selected task.

The evaluator never emits operational KEEP and always reports
`ownerAuthorizationRequired=true`. The v4 report wire reserves
`evidence_eligible_under_supplied_policy` for a future adapter-derived path,
but the current implementation always returns `not_eligible`,
`semanticEvidenceAuthority=signed_structured_assertions_diagnostic_only`, and
`semanticDerivationStatus=adapter_specific_raw_derivation_not_implemented`.
Signed structured facts are diagnostics, not conditional-efficacy authority.
All six externally authenticated verification receipts are still parsed and
reported: exact attempt/raw-artifact resolution, upstream-oracle independence,
split/leakage audit, anti-degenerate controls, restart/dynamic-state coverage,
and clean-checkout reproduction.
Receipts must bind the manifest, exact attempt-set root, and a content-resolved
evidence set; every declared check references included evidence. Evidence bytes
must be canonical UTF-8 JSON under the schema specific to their verification
kind. Each of the 31 checks binds exactly one embedded semantic observation to
an evaluator-recomputed subject hash. The gate reopens the observation's byte
length and SHA-256, enforces the exact kind/check/subject plus a pinned procedure
ID and strict fact keys, then recomputes the check result. Opaque JSON,
unsupported procedures, missing/unreferenced observations, and disagreement
between a claim and the computed result reject. No observation-level `passed`
field is accepted.
Each receipt is Ed25519-signed by a verifier whose identity, source revision,
owner, and public key are in a separate trust policy. The decision caller must
supply the policy plus its owner/CI-pinned hash through a channel outside the
bundle. The gate rejects a verifier owned by the experiment producer. A signed
preregistration receipt binds the manifest before execution, and one signed
execution-timestamp receipt binds every attempt's times and raw root. The
current generic procedures do not derive their structured facts from the
actual manifest, attempt set, analysis, and content-addressed provider/oracle
records. Self-consistent signer-authored counters or hash sets therefore remain
ineligible even when every signature and schema is valid. Conditional
eligibility stays unreachable until adapter-specific procedures reopen the
bound raw records and deterministically derive each fact. A separate owner
process would still have to authorize the resulting evidence-report hash before
any operational action.

Strict lift uses simultaneous inference against the maximum native/sham control
inside every bootstrap draw. Reliable lift and economics must pass separately
against both controls; an unavailable control comparison fails closed.

After building, create and analyze artifacts with:

```bash
node dist/cli.js manifest manifest-input.json
node dist/cli.js attempt attempt-input.json
node dist/cli.js analyze analysis-input.json
node dist/cli.js trust-policy trust-policy-input.json
node dist/cli.js preregister preregistration-input.json authority-private-key.pem
node dist/cli.js execution-timestamp-receipt timestamp-input.json authority-private-key.pem
node dist/cli.js evidence-root evidence-artifacts.json
node dist/cli.js verification-receipt receipt-input.json verifier-private-key.pem
node dist/cli.js decide decision-bundle.json trust-policy.json OWNER_PINNED_SHA256
```

The D7 memo recomputes the same result rather than accepting a hand-written
verdict:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
  pnpm pm:memo -- \
    --public-decision-bundle decision-bundle.json \
    --public-trust-policy trust-policy.json \
    --public-trust-policy-hash "$OWNER_PINNED_SHA256"
```

`--public-analysis` remains available to render diagnostics. Neither it nor a
future conditionally eligible decision report can authorize KEEP; owner
authorization is a separate trust boundary outside this package.
