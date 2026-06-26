# v33 - Workflow Terminal Admission Port

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ34 from v32.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ34: How should `@pm/workflow` consume canonical terminal admission without violating its dependency-light boundary or duplicating terminal claims between invocation envelopes and `@pm/agent-state` envelopes? | Workflow should expose a narrow admission port over its own invocation-envelope shape, then let adapters outside `@pm/workflow` translate to canonical `@pm/agent-state` admission. Parnas's modularity criterion says the decision likely to change, here the canonical terminal store/index, should be hidden behind a module boundary. Clark-Wilson says valid writes need constrained, well-formed transactions rather than unconstrained actor memory. Schneider's state-machine approach says state changes should follow an ordered admitted request stream. Garcia-Molina/Salem sagas keep long-lived workflow steps explicit about terminal outcome and compensation instead of treating intermediate reports as final authority. Therefore workflow should fail closed when admission rejects an accepted or blocked terminal envelope, but it should not import agent-state or create a second terminal claim. | Added dependency-light terminal admission types to `@pm/workflow`: `InvocationActionOutcomeAdmissionPort`, request, decision, and rejection reason. `PostgresWorkflowRuntime` now accepts optional `actionOutcomeAdmission`; it admits blocked evidence-gate envelopes before dead-lettering and admits accepted envelopes before write-capable dispatch. Admission rejection or adapter failure creates `action_outcome_admission_rejected`, records the envelope plus admission decision, and prevents dispatch. No `@pm/agent-state` dependency was added to `@pm/workflow`. | RQ35: What minimum authoritative agency/marketing adapter contract should consume terminal admission at publish/revoke/write boundaries so Axis B can move from blocked to non-blocked when PluggedInSocial is absent, without requiring substrate-package edits after profile/adapter boundaries exist? |

Active question set leaving this run: RQ12-RQ20, RQ35.

## Peer-Reviewed Sources

- David L. Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules," Communications of the ACM 1972. DOI: https://doi.org/10.1145/361598.361623
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy 1987. DOI: https://doi.org/10.1109/SP.1987.10001
- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach: A Tutorial," ACM Computing Surveys 1990. DOI: https://doi.org/10.1145/98163.98167
- Hector Garcia-Molina and Kenneth Salem, "Sagas," SIGMOD 1987. DOI: https://doi.org/10.1145/38713.38742

## Bridge Hypothesis

Workflow owns invocation order, evidence-gate decisions, retry/dead-letter behavior, and dispatcher context. Agent-state owns canonical terminal admission. The bridge should therefore be a port, not a package dependency:

1. workflow builds one invocation terminal envelope at its evidence-binding boundary;
2. the admission adapter decides whether that envelope can become the terminal claim;
3. workflow dispatches only if accepted envelopes are admitted;
4. workflow dead-letters only after blocked envelopes are admitted or after admission rejection is recorded as its own failure;
5. adapters can promote the invocation envelope to canonical `ActionOutcomeEnvelope` and call `admitActionOutcomeEnvelope()` or `buildActionOutcomeTerminalIndex()` outside `@pm/workflow`.

## Falsification Criteria

The v33 slice fails if:

1. `@pm/workflow` imports `@pm/agent-state` or requires a canonical terminal-store dependency.
2. A write-capable dispatch can proceed after terminal admission returns `terminal_outcome_conflict`.
3. Missing, incomplete, blocked, or unverified evidence-gate envelopes are dead-lettered without first offering the blocked terminal envelope to the admission port.
4. Admission adapter failure bypasses the gate instead of failing closed.
5. The runtime creates a second terminal claim rather than carrying its existing invocation envelope through the admission boundary.

## Implementation Delta

- Added `InvocationActionOutcomeAdmissionPort`, `InvocationActionOutcomeAdmissionRequest`, `InvocationActionOutcomeAdmissionDecision`, and rejection reasons to `packages/workflow/src/evidence-binding.ts`.
- Re-exported the admission types through `packages/workflow/src/interfaces.ts` and `packages/workflow/src/index.ts`.
- Added optional `actionOutcomeAdmission` to `PostgresWorkflowRuntime` dependencies.
- Added fail-closed runtime admission before accepted write-capable dispatch and before evidence-gate dead-lettering for blocked envelopes.
- Added workflow integration tests for accepted admission, terminal-conflict rejection, and blocked-envelope admission before dead-lettering.

## Proof Status

Focused verification run during this slice:

```text
pnpm vitest run packages/workflow/src/evidence-binding.test.ts packages/workflow/src/postgres.test.ts --reporter=basic
pnpm --filter @pm/workflow typecheck
```

The first command ran 12 evidence-binding tests and collected the Postgres workflow tests, but skipped the Postgres integration suite because `PM_DATABASE_URL` was not set in this shell. The TypeScript package check passed after narrowing the admission helper to return only rejection decisions or null.

Current three-axis state is unchanged:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved by v32 ArrowHedge terminal-index adoption, but the full ten-class finance matrix remains incomplete. |
| Axis B marketing | Blocked until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted. |
| Axis C local lab | Mechanism coverage exists; workflow can now host a canonical admission adapter, but this is not full three-axis verification. |

No verified solution is claimed.
