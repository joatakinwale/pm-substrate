# v45 - Store Backed Authority Resolver

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ46.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ46: How should Axis A/B/C scenario runners enable strict graph/capability write-authority policies and source real store-backed resolutions so EvalEvents prove end-to-end authority injection rather than helper-level conversion? | Models@run.time work says runtime decisions should consult a causally connected runtime model rather than a detached design-time assumption. Runtime-verification work says a monitor must evaluate the observed finite execution prefix and return a concrete accept/reject/inconclusive state instead of treating partial evidence as success. Rewriting/runtime-monitor papers add the implementation pattern: wrap the action stream with a monitor that reads the current state and blocks when the required event/state prefix is missing or mismatched. Therefore Axis runners should not create graph authority refs inline. They should pass a strict graph write-authority policy plus a resolver that loads the workflow action-outcome envelope from a substrate store by tenant/envelope id, verifies the expected action id, rejects missing/blocked/mismatched packets, and only then returns the graph authority bundle to the capability transaction. | Added `WorkflowGraphWriteAuthorityEnvelopeStore`, lookup/options types, and `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` in `@pm/capability-kit`. The resolver loads the envelope by tenant + envelope id, rejects missing or mismatched store results, optionally checks the expected action id, and then converts only accepted envelopes into matched `GraphWriteAuthorityResolution` bundles. Updated the lead-scoring strict-authority test to exercise the real capability adapter through this store-backed resolver instead of returning hand-built `{ authorityRef, substrateRecord }`. | RQ47: How should canonical `ActionOutcomeEnvelope` packet stores preserve or recover workflow authority metadata, especially provider certificate status refs, so strict graph write authority can be reconstructed after amnesiac resume without retaining workflow-only memory? |

Active question set leaving this run: RQ12-RQ20, RQ47.

## Peer-Reviewed Sources

- Gordon Blair, Nelly Bencomo, and Robert B. France, "Models@run.time," Computer 42(10), 2009. DOI: https://doi.org/10.1109/MC.2009.326.
- Nelly Bencomo, Robert France, Betty H. C. Cheng, and Uwe Aßmann, eds., "Models@run.time: Foundations, Applications, and Roadmaps," LNCS 8378, Springer, 2014. https://link.springer.com/book/10.1007/978-3-319-08915-7.
- Andreas Bauer, Martin Leucker, and Christian Schallhart, "Runtime Verification for LTL and TLTL," ACM Transactions on Software Engineering and Methodology, 2011. DOI: https://doi.org/10.1145/2000799.2000800.
- Klaus Havelund and Grigore Rosu, "Monitoring Programs using Rewriting," ASE 2001. DOI: https://doi.org/10.1109/ASE.2001.989799.

## Bridge Hypothesis

Strict runner wiring should be a monitor over a store lookup:

```text
scenario/run context
  -> envelope id + expected action id
  -> substrate store lookup by tenant/envelope id
  -> accepted/missing/blocked/mismatch monitor result
  -> GraphWriteAuthorityResolution only for accepted matched envelope
```

This turns helper conversion into a reusable adapter primitive. It still does not prove Axis A/B/C end-to-end until the runners supply real envelope ids from persisted packet/status stores and EvalEvents cite those records.

## Falsification Criteria

The v45 slice fails if:

1. a scenario runner still needs to hand-build graph authority refs to satisfy strict policy;
2. a missing stored envelope is treated as an accepted graph write authority;
3. a blocked stored envelope is converted into write authority;
4. a store that returns a different envelope id can satisfy the requested lookup;
5. an envelope for a different action id can authorize the current capability write when an expected action id is supplied;
6. the lead-scoring adapter test can pass strict policy without exercising a store lookup.

## Implementation Delta

- Added `WorkflowGraphWriteAuthorityEnvelopeLookup`.
- Added `WorkflowGraphWriteAuthorityEnvelopeStore`.
- Added `StoredWorkflowGraphWriteAuthorityResolverOptions<TPayload>`.
- Added `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()`.
- Exported the new resolver and store types from `@pm/capability-kit`.
- Added tests for accepted store lookup, missing envelope, wrong action id, and blocked envelope.
- Updated the lead-scoring strict graph authority test to use the store-backed resolver factory.

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
| Axis A finance | Runner adapter primitive exists, but ArrowHedge runners still need to supply persisted envelope ids/status refs under strict policy. |
| Axis B marketing | Lead-scoring proves an agency capability can consume the resolver, but full Axis B remains blocked until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Local-lab can now reuse a strict store-backed resolver shape, but dynamic runners still need to wire it to persisted packets/status refs. |

No verified solution is claimed.
