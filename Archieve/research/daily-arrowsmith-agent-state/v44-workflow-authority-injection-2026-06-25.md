# v44 - Workflow Authority Injection

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ45.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ45: How should workflow/runtime adapters construct and inject store-backed `GraphWriteAuthorityResolution` objects into real capability handlers across Axis A/B/C without substrate-package edits or hand-forged refs? | Parnas' information-hiding criterion says module boundaries should hide volatile design decisions; Garlan/Allen/Ockerbloom's architectural-mismatch work says reusable parts fail when implicit assumptions about control, data, or ownership leak across boundaries; Allen/Garlan connector work says interactions themselves deserve explicit typed connectors; and Parnas' software-aging argument warns that bypass-specific wiring will decay as requirements change. Therefore the substrate package should not import domain workflow packages, and domain capabilities should not forge authority refs inline. The adapter pattern should be: a workflow/runtime boundary obtains an already admitted action-outcome envelope and status ref from substrate stores, a small structural connector converts that envelope into `{ authorityRef, substrateRecord }`, and each capability exposes an injection hook for the connector. The hook must remain optional for existing callers but satisfy strict graph write-authority policy when enabled. | Exported `GraphWriteAuthorityResolver` from `@pm/capability-kit`. Added `graphWriteAuthorityResolutionFromWorkflowEnvelope()` as a structural connector that turns an accepted workflow envelope into a matched graph authority ref and substrate record without making workflow and capability-kit depend on each other. Added `LeadScoringRuntimeDeps.graphWriteAuthority` and passed it into the real `LeadScoringHandler` capability spec. Added tests proving blocked/missing envelopes are rejected, matched accepted envelopes create matched authority bundles, and the lead-scoring handler can run under strict store-backed graph authority policy when a workflow adapter injects the resolution. | RQ46: How should Axis A/B/C scenario runners enable strict graph/capability write-authority policies and source real store-backed resolutions so EvalEvents prove end-to-end authority injection rather than helper-level conversion? |

Active question set leaving this run: RQ12-RQ20, RQ46.

## Peer-Reviewed Sources

- David L. Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules," Communications of the ACM, 1972. DOI: https://doi.org/10.1145/361598.361623.
- David Garlan, Robert Allen, and John Ockerbloom, "Architectural Mismatch, or Why It's Hard to Build Systems Out of Existing Parts," ICSE 1995. DOI: https://doi.org/10.1145/225014.225031. PDF: https://www-2.cs.cmu.edu/afs/cs/project/able/ftp/archmismatch-icse17/archmismatch-icse17.pdf
- Robert Allen and David Garlan, "Formalizing Architectural Connection," ICSE 1994. ACM record: https://dl.acm.org/doi/10.5555/257734.257745.
- David L. Parnas, "Software Aging," ICSE 1994. DOI: https://doi.org/10.1109/ICSE.1994.296790.

## Bridge Hypothesis

Workflow/capability authority injection should be a connector, not a new dependency edge:

```text
admitted workflow envelope/status refs
  -> structural graph write-authority connector
  -> capability runtime dependency injection
  -> strict graph/capability policy before graph mutation
```

The connector is only valid when the caller provides an already admitted envelope from substrate state. A helper-level conversion is not proof by itself; the next loop must wire scenario runners to live or replay stores and emit EvalEvents that cite those store records.

## Falsification Criteria

The v44 slice fails if:

1. capability-kit and workflow must import each other to exchange graph write authority;
2. a blocked or missing workflow envelope can be converted into accepted graph write authority;
3. a real capability handler cannot receive an injected strict authority resolver without editing substrate packages;
4. strict graph write-authority policy can run the lead-scoring raw graph update without a matched substrate record;
5. existing capability callers break when no authority resolver is supplied;
6. helper-level conversion is claimed as end-to-end store-backed proof before scenario runners source records from live/replay stores.

## Implementation Delta

- Exported `GraphWriteAuthorityResolver<TPayload>` from `@pm/capability-kit`.
- Added `WorkflowGraphWriteAuthorityEnvelope` and `WorkflowGraphWriteAuthorityStatusRef` structural types.
- Added `graphWriteAuthorityResolutionFromWorkflowEnvelope()` and `GraphWriteAuthorityResolutionError`.
- Exported the workflow-authority connector from `@pm/capability-kit`.
- Added optional `LeadScoringRuntimeDeps.graphWriteAuthority`.
- Passed the injected resolver into the lead-scoring `defineCapability()` spec.
- Added capability-kit tests for accepted, blocked, and missing workflow envelopes.
- Added a lead-scoring handler test under strict `requireAuthorityRef`, `requireProviderCertificateStatusRef`, and `requireSubstrateRecord` policy.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/capability-kit typecheck
pnpm --filter @pm/capability-agency-lead-scoring typecheck
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/capability-agency-lead-scoring/src/write-authority.test.ts
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Store-backed authority injection is still not wired through ArrowHedge scenario runners or finance adapters. |
| Axis B marketing | Lead-scoring has a real adapter hook, but full marketing verification remains blocked until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism-level conversion/injection is tested; local-lab scenarios still need strict policy enabled against store-sourced authority resolutions. |

No verified solution is claimed.
