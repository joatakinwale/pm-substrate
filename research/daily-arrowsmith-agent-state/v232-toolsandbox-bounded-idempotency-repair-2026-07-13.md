# v232 ToolSandbox Bounded Idempotency Repair

Date: 2026-07-13
Status: observed public-derivative repair; qualification/mechanism evidence, not confirmatory efficacy
primitive_family: admission_calculus
primitive_family: replay_semantics

## Research question

When a public ToolSandbox attempt loses a successful state-changing response
and restarts the provider process before retry, how should the substrate client
identify the operation without exceeding the boundary's safety limit or
allowing the retry to create a second side effect?

## Observed public failure first

The first fresh deterministic ToolSandbox derivative run was preserved at
`/private/tmp/pm-toolsandbox-v3-proof-20260713-1845`, with matched-batch hash
`d9cf73c3fea1acc2c351d55b9a68ac913a8cc9d429ecdcfaf8e6c964be3a685a`.
Native and sham both received an official strict score of `1.0`, but substrate
scored `0.25`: its first state-changing outcome received HTTP `400` before the
sidecar admitted the operation.

The failure was substrate-specific. The substrate outcome key was built by
concatenating public identifiers and was 136 characters, exceeding the
sidecar's deliberate 128-character limit. The sham key happened to be 126
characters and passed. This exposed a real protocol-composition defect: valid
public identifiers could make the stricter arm unusable even though the safety
boundary itself was behaving as specified.

## Adjacent mechanisms researched

- The IETF HTTPAPI working-group
  [Idempotency-Key draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header)
  treats the key as a client-generated unique operation identifier, prohibits
  reuse with a different payload, permits a request digest or signature as an
  idempotency fingerprint, and specifies distinct handling for a missing key,
  mismatched reuse, and an in-flight duplicate. The relevant mechanism is a
  stable bounded operation identity plus payload binding; the draft remains
  work in progress rather than a final RFC.
- [Stripe's idempotent-request documentation](https://docs.stripe.com/api/idempotent_requests)
  uses client-generated keys to return the first request's saved result on a
  retry and compares replayed parameters with the original request. Stripe's
  255-character ceiling is service-specific; the transferable lesson is that
  client key generation must respect the resource's published format and
  length while preserving identity across an ambiguous network outcome.

Neither source says to remove the local 128-character boundary. Both support
fixing the client representation while preserving the server-side payload and
replay checks.

## Falsifiable hypothesis

If the matched runner derives each admission and outcome key as a
domain-separated SHA-256 digest over the canonical attempt, session, call, and
operation components, then every public identifier length will map to a bounded
key, an exact post-restart retry will retain the same operation identity, and a
different operation or payload will not be conflated with it.

The hypothesis is false if any of these occur:

1. a valid public attempt still exceeds the sidecar's 128-character limit;
2. the same logical retry derives a different key after provider restart;
3. admission and outcome keys can collide because their domains are omitted;
4. the same key is accepted with different canonical request bytes;
5. the substrate performs two target sends after the lost response; or
6. the repair improves only a detached summary while the retained trajectory,
   provider restart, sidecar exchange, and state delta disagree.

## Smallest consumed implementation

The peripheral ToolSandbox matched runner now computes
`pm-ts-<domain>-<sha256>` from a canonical object containing a versioned domain
and the exact operation components. The existing sidecar keeps its
128-character limit and request-byte conflict checks. A regression test
preserves the observed boundary: the exact 136-character raw key rejects before
mutation, while the digest key succeeds and is durably recorded.

No new `@pm/agent-state-core` export or primitive was added. The change is a
runtime-consumed repair at the public adapter boundary, classified against the
existing `admission_calculus` and `replay_semantics` families.

## Ablation and pre-final retest

| Observation | Raw concatenated key | Bounded domain-separated digest |
| --- | --- | --- |
| Fresh derivative batch | `d9cf73c3…` | `90a8e03a…` |
| Official native score | `1.0` | `1.0` |
| Official sham score | `1.0` | `1.0` |
| Official substrate score | `0.25`; HTTP `400` on first outcome | `1.0` |
| Substrate target sends after exact retry | attempt failed before a valid comparison | 1 unique send; retry blocked |
| Native/sham target sends after exact retry | not the causal comparison for the key bug | 2 unique sends each |

The exact repaired retest is preserved at
`/private/tmp/pm-toolsandbox-v3-proof-20260713-1848`, with matched-batch hash
`90a8e03a353135ea2edfad97b2a6b8cbaab86140c8bc7563c3ffdc179ebf19f5`.
All three arms received official strict score `1.0` and applied a real provider
process kill/reap/restart. The substrate admitted three operations and blocked
the exact post-restart duplicate send, leaving one unique target message;
native and sham each executed the retry, leaving two unique target messages.

This retest also found an evaluator blind spot: the official score did not
penalize the duplicate side effect in native or sham. The official oracle must
therefore remain paired with a replayed state-effect metric; it cannot by itself
prove that the agent-state failure was prevented.

The `90a8e03a…` batch remains useful repair history, but it is not the final
verification artifact. The verifier changed after that run while closing
trajectory/provider/sidecar cross-binding gaps, which correctly invalidated its
old runtime-closure comparison. It was not relabeled or upgraded after the fact.

## Final raw cross-verified qualification

Fresh artifacts were generated after the verifier and runtime closure were
stable. Both use manifest
`bd3285e471ed35d0440ab3b57105d43703456cc51d5e676b8a4bde3287ccbb2b`,
runtime-closure hash
`a71ae2d14d807449b5864f28985a195b27fb9bb62aa41fe55e10068a24d3f869`,
and pinned normalized starting-context hash
`62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04`.
The context normalization permits only the 11 exact timestamp values declared
by `pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1`.

| Track | Root | Batch hash | Raw verification hash | Eligibility hash |
| --- | --- | --- | --- | --- |
| Official headline | `/private/tmp/pm-toolsandbox-v4-final-headline-20260714T003640Z` | `7ad2c0e89604433a7eafa50169e04c942cc555d0e5296bcb5cbea9a86004354f` | `363189579ae1019167644159add569f8e16e7b28d96ff353cc4abb5a399964be` | `9a631ee3675404ab8f4c8545ff84252fe7df95eafd929a9e281ea5fad1eed13e` |
| Lost-response derivative | `/private/tmp/pm-toolsandbox-v4-final-derivative-20260714T003640Z` | `0043af2771efe7bf585c8d539111ccd0c3d60078fd98eb2f70a583a5c005f602` | `673963f016e8685b654407c47a89514e6e9bd9c5d5c6d8f73f64cbb5e24627ac` | `c7624df3a7f89ed9b1c8ea1f909869d0a521e8612512043fd4bd491a54793c35` |

The headline produced strict score `1.0` in native, sham, and substrate, with
no restart and no duplicate target side effect. The derivative also produced
strict score `1.0` in every arm and bound an actual provider-process-group
`SIGKILL`, reap, and fresh-process retry in every arm. Native and sham executed
the retry successfully and each produced
`duplicateTargetSideEffectCount=1`; substrate blocked the retry and produced
`duplicateTargetSideEffectCount=0`.

The verifier replays the pinned Apple oracle, raw provider frames, authenticated
sidecar lifecycle and exchanges, retained trajectory, durable state changes,
restart-successor identity, starting context, and runtime-module closure. Its
cross-boundary logic is outcome-neutral: it retains duplicate substrate sends,
unexpected control blocks, or failed retries if those are what the raw bytes
show. A focused counterevidence regression also verified the actual block
encoding (`review.valid=false`, `allowed=false`, `blocking=true`) rather than
requiring a favorable decision. Seventy-five focused tests passed during this
hardening, followed by a green 30-test final regression subset.

This final run confirms the evaluator blind spot rather than removing it.
Apple's strict score was `1.0` even when native and sham each produced a second
target send. Upstream task success and replayed state-effect safety must
therefore remain separate reported outcomes.

## Claim boundary and remaining gaps

The agent was `PmScriptedStateProbe`, so this is a deterministic qualification
and mechanism result. It demonstrates that the repaired substrate boundary can
survive one known lost-response/process-restart scenario and suppress one exact
duplicate. It does not establish stochastic agent efficacy, generalize across
ToolSandbox tasks, qualify STATE-Bench or the corner battery, or satisfy the
confirmatory and replication gates.

Both eligibility assessments remain
`publicEvalAttemptArtifactEligible=false`. The same-package verifier now
content-resolves the raw provider frames and request IDs, exact task/oracle
bytes, oracle recomputation, real sidecar protocol, OS restart, trajectory
cross-binding, starting context, and runtime closure. It does not supply
provider usage/cost/latency, a trusted oracle runtime and environment, a
non-scripted public-agent execution, or an independent verifier signature and
external trust anchor. Final raw cross-verified qualification: **complete**;
public agent-efficacy proof: **not established**.
