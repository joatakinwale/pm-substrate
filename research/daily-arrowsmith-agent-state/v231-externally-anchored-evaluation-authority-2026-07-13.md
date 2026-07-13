# v231 Externally Anchored Evaluation Authority

Date: 2026-07-13
Status: evaluation-integrity repair; not public-benchmark efficacy
primitive_family: authority_topology
primitive_family: admission_calculus

## Research question

How can pm-substrate prevent an experiment producer from manufacturing a
passing trust policy, verification bundle, and KEEP decision after observing
the results?

## Observed gap first

Adversarial review of the first D7 evaluator found that the caller could supply
a self-hashed verifier policy and, if the locally supplied signatures and
checks were internally consistent, receive `d7KeepEligible=true`. The same
bundle did not prove that its task selection or thresholds existed before the
run, that its policy came from an owner-controlled channel, or that a separate
decision authority accepted the evidence. This was a false-KEEP path even if
every hash and signature verified.

The review also found that signer separation alone is insufficient when
organizational identities are caller-authored strings and verifier evidence is
semantically opaque. The repair therefore cannot be “add another signature.”

## Adjacent mechanisms researched

- [in-toto layouts and links](https://in-toto.io/docs/getting-started/)
  separate a project-owner-signed plan—which names authorized functionaries,
  commands, materials, and products—from signed evidence that each functionary
  later produces. The relevant mechanism is prior authority over the plan, not
  the supply-chain domain.
- [Sigstore Rekor](https://docs.sigstore.dev/logging/overview/) provides an
  append-only transparency log with inclusion verification. Sigstore's
  [timestamp guidance](https://docs.sigstore.dev/cosign/verifying/timestamps/)
  further distinguishes a log entry from a separately signed timestamp. The
  relevant mechanism is an externally witnessed before/after ordering that the
  experiment bundle cannot rewrite.
- [OSF preregistration](https://help.osf.io/article/330-welcome-to-registrations)
  freezes a time-stamped, read-only study plan before data collection or
  analysis. The relevant mechanism is an immutable pre-run commitment to task
  selection, exclusions, endpoints, and stopping rules.
- NASA's
  [Space Flight Program and Project Management Handbook](https://ntrs.nasa.gov/citations/20220009501),
  supplied for this review, separates independent Standing Review Board
  assessment from the Decision Authority's signed Decision Memorandum. NASA's
  current [NPR 7120.5F requirements](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)
  likewise preserve independent review while assigning the final phase decision
  to a named Decision Authority. The relevant mechanism is authority
  separation: evidence informs a decision but is not itself the decision.

## Falsifiable hypothesis

If the evaluator (1) binds a signed preregistration to the exact manifest
before the first attempt, (2) binds each attempt time and raw-artifact root to a
separate authority receipt, (3) verifies the evidence under an out-of-bundle
policy pin, and (4) emits only a non-authoritative evidence-eligibility report,
then a producer-controlled bundle cannot itself create an operational KEEP.

The hypothesis is false if any of these occur:

1. a post-run or mismatched preregistration is accepted;
2. an attempt without a matching signed time/raw-root receipt is accepted;
3. a policy hash taken only from inside the result bundle is treated as an
   owner trust root;
4. a verifier owned by the experiment producer satisfies independence;
5. a conditional evidence report unfreezes an application or emits KEEP; or
6. changing the report bytes does not invalidate the future owner
   authorization.

## Smallest consumed implementation

`@pm/public-eval-analysis` now binds task content and eligible-universe
membership plus the exact deterministic top-ranked selected subset, immutable
arm interventions, randomized execution order, initial environment, fixed
reliability/economic guardrails, and simultaneous lift over both native and
sham. Decision bundles require a signed preregistration, one signed
execution-time/raw-root receipt per attempt, and non-empty kind-specific
canonical evidence whose embedded raw observations are reopened and hashed.

The automated report has only two statuses:
`evidence_eligible_under_supplied_policy` and `not_eligible`. It always carries
`ownerAuthorizationRequired=true` and
`evidenceAuthority=signed_assertions_non_authoritative`; it has no KEEP field.
`pnpm pm:memo` preserves that boundary and keeps PluggedInSocial and ArrowHedge
frozen even when a hypothetical bundle passes every automated check.

No new `@pm/agent-state-core` primitive was added. This strengthens the existing
authority-topology and admission-calculus families at the public-evaluation
boundary.

## What remains deliberately unimplemented

The repository does not possess an owner credential or an externally anchored
preregistration service. A production D7 decision therefore still needs:

1. an owner/CI-configured trust root that is not selected by the experiment;
2. a public append-only inclusion/timestamp proof, or an equivalent independent
   preregistration authority, created before execution;
3. authenticated organizational principals rather than caller-authored owner
   strings;
4. machine-interpreted verifier evidence schemas, including directly
   recomputable sham-overhead and provider-usage evidence; and
5. a separate owner authorization artifact signing the exact decision-report
   hash and declaring the narrow operational consequence.

Until those exist, the correct result is at most conditional evidence
eligibility. This research and implementation close a false-KEEP path; they
provide zero evidence that pm-substrate improves a public task.

## Exact retest

The decision package's adversarial suite now rejects forged signatures,
unplanned verifiers, producer-owned verifiers, premature timestamp receipts,
task-selection/content drift, arm-intervention drift, unmatched environments,
empty/plain-text/wrong-kind/irrelevant/unresolved evidence, non-top-ranked task
selection, and any failed required check. A fully passing synthetic bundle
produces only conditional evidence eligibility and explicitly lacks
`d7KeepEligible`.

The next public repair remains blocked on an observed behavioral failure. This
v231 slice is evaluation-governance hardening, not the D6-E causal repair or a
substitute for executing ToolSandbox, STATE-Bench, or the public corner battery.
