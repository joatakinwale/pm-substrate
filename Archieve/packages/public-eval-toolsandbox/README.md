# `@pm/public-eval-toolsandbox`

Pinned ToolSandbox adapter for a falsification-first public agent-state slice.
It does not reimplement ToolSandbox and does not promote an internal substrate
decision into task success. Apple's pinned evaluator remains the task-outcome
authority; replayed target-state effects are reported separately because the
upstream score does not detect every duplicate side effect.

The benchmark pin is
`apple/ToolSandbox@165848b9a78cead7ca7fe7c89c688b58e6501219`, scenario
`send_message_with_contact_content_cellular_off_multiple_user_turn`. The
manifest hash for the final qualification is
`bd3285e471ed35d0440ab3b57105d43703456cc51d5e676b8a4bde3287ccbb2b`.
The scenario owns four milestones and no minefields; this package preserves
that zero rather than adding a local success condition.

Two result tracks stay disjoint:

- `official_headline` runs the unchanged upstream scenario without a restart
  fault and is headline-track eligible.
- `restart_lost_response_derivative` loses the response after the first
  successful target send, kills and reaps the provider process group, starts a
  fresh provider process, and retries. It is never headline-track eligible.

Headline-track eligibility is not public-efficacy eligibility. The final runs
use deterministic agent `PmScriptedStateProbe`, user `Cli`, and scripted stdin
`["end"]`; they qualify the mechanism and verifier, not stochastic agent
behavior or general task lift.

## Commands

After building the package:

```bash
pnpm --filter @pm/public-eval-toolsandbox public-eval manifest
pnpm --filter @pm/public-eval-toolsandbox public-eval verify-corpus /path/to/ToolSandbox
pnpm --filter @pm/public-eval-toolsandbox public-eval qualify-headline qualification-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval run-matched-batch matched-batch-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval verify-matched-batch raw-verification-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval verify-and-assess-matched-batch raw-verification-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval convert-public-eval-attempts raw-verification.json
pnpm --filter @pm/public-eval-toolsandbox public-eval create attempt-input.json
pnpm --filter @pm/public-eval-toolsandbox public-eval verify receipt-set.json
```

`assess-public-eval-eligibility` remains available only for legacy detached
`raw-verification.v2` diagnostics. A v3 eligibility diagnosis must use
`verify-and-assess-matched-batch`, which reopens the raw inputs before it
assesses them.

## What `matched-batch.v3` retains

`run-matched-batch` verifies a clean pinned checkout, deterministically
randomizes native/sham/substrate order from the recorded seed, and holds the
agent, user simulator, `DEFAULT` tool backend, upstream seed `42`, and
30-message limit constant. It retains an exact no-extra/no-missing inventory
of:

- runner stdout/stderr, invocation metadata, result summaries, and execution
  contexts;
- raw provider request/response frames, request identities, process identities,
  and restart-successor trace;
- authenticated loopback HTTP sidecar lifecycle receipts, exchanges, durable
  operation ledger, and state for sham and substrate;
- the compiled runtime-module closure used by the sidecar; and
- content-addressed attempt receipts and batch summary.

The provider role is a real child OS process in every arm. In the derivative,
the first provider process group receives `SIGKILL`, is reaped, and a fresh
process handles the retry. Native has no state service. Sham and substrate use
the same authenticated sidecar shape and persist equal-shaped state; sham
reads unrelated state, while substrate can use the retained target outcome to
block an exact retry.

## What `raw-verification.v3` proves

`verify-matched-batch` reopens the batch and complete output tree, rejects
symlinks, path escapes, extra or missing files, and hash mismatches, and then
recomputes the evidence from raw bytes. It:

- rechecks the pinned clean checkout, exact task/oracle bytes, manifest,
  randomized order, and raw run configuration;
- runs a verifier-selected pinned Apple oracle replay over each retained
  execution context and compares the recomputed result;
- cross-replays provider frames, ToolSandbox trajectory rows, sidecar
  requests/responses, durable state deltas, and restart-successor identity;
- verifies the sidecar lifecycle and runtime-module closure; and
- binds the first provider request to the pinned starting context hash
  `62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04`
  after normalizing only the 11 exact timestamp locations declared by policy
  `pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1`.

The replay is outcome-neutral: it checks whether observed allow/block decisions
and effects are internally real, not whether they favor substrate. A regression
retains an unexpected block as counterevidence and verifies the actual block
semantics (`review.valid=false`, `allowed=false`, `blocking=true`) rather than
selecting it away. Duplicate control sends and a hypothetical substrate
duplicate therefore remain verifiable observations. Seventy-five focused
tests passed during hardening, followed by a green 30-test final regression
subset.

## Final deterministic qualification

| Track | Batch / raw verification / eligibility hash | Observed result |
| --- | --- | --- |
| Official headline | `7ad2c0e8…` / `36318957…` / `9a631ee3…` | All three arms: strict score `1.0`; no restart; no duplicate target effect |
| Lost-response derivative | `0043af27…` / `673963f0…` / `c7624df3…` | All three arms: strict score `1.0`; actual kill/reap/restart in every arm; native and sham retried successfully with one duplicate target effect each; substrate blocked the retry with zero duplicates |

The shared verified runtime-closure hash is
`a71ae2d14d807449b5864f28985a195b27fb9bb62aa41fe55e10068a24d3f869`.
The full roots and hashes are recorded in
`docs/evidence/public-proof-run-register-2026-07-13.json`.

The central finding is a measurement gap: Apple's official strict score stayed
`1.0` when native and sham each sent the target message twice. Consequently,
official task success and replayed state-effect safety must always be reported
as separate outcomes. The internal substrate block is telemetry and safety
evidence only; it is never rewritten into upstream task success.

## Claim and eligibility boundary

`verify-and-assess-matched-batch` still returns
`publicEvalAttemptArtifactEligible: false`. V3 now content-resolves provider
frames and request IDs, exact task/oracle bytes, oracle recomputation,
authenticated sidecar execution, real restart evidence, trajectory binding,
and the runtime closure. It still lacks:

- provider usage tokens, cost, and latency;
- an independent verifier signature and external trust anchor;
- a trusted oracle replay runtime and environment; and
- a non-scripted public-agent execution for these deterministic runs.

`convert-public-eval-attempts` therefore fails closed. The final triplets are
strong qualification/mechanism evidence for one known state-failure scenario;
they do not establish agent efficacy, generalize across tasks, qualify
STATE-Bench or the corner battery, satisfy confirmation/replication, or justify
unfreezing either application.

## Preserved failure history

The original provider-backed derivative stopped before its first action in
every arm on `429 insufficient_quota`; it remains a failed attempt, not a
substrate result. The first deterministic derivative then exposed a real
substrate-specific `400`: its 136-character concatenated idempotency key
exceeded the sidecar's deliberate 128-character limit. The bounded,
domain-separated SHA-256 repair is documented in Arrowsmith v232. Neither
failure was overwritten by the final green qualification.
