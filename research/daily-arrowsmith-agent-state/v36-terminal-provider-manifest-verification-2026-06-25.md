# v36 - Terminal Provider Manifest Verification

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ37 from v35.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ37: How should terminal-admission provider refs be checked for live provider availability, version compatibility, and action-type coverage so registry discovery cannot become stale operational authority? | A provider ref should not be treated as coverage unless it is checked against a live provider manifest with compatible contract version, matching package/export identity, available status, and action/ref-kind coverage. Lam/Dietrich/Pearce argue version labels need semantic compatibility evidence, not blind trust. Barnett/Schulte and Jin/Han show component contracts can be checked at runtime against executable/behavioral specifications. Cao/Phan-Quang/Félix/Castanet apply runtime verification to web-service behavior, which maps to provider availability and conformance checks. de Alfaro/Henzinger's interface automata support checking action protocols rather than only type signatures. Therefore registry discovery remains evidence only until a manifest check proves the implementation still satisfies the declared write-contract ref. | Added `TerminalAdmissionProviderManifest` and provider availability/version fields to `@pm/types`; added `verifyTerminalAdmissionProviderRef()` and `verifyTerminalAdmissionProviderBindings()` to `@pm/registry`; exported finance and agency provider manifests; and added manifest-gated coverage mode to `buildWriteTransportBindingCoverageSamplesFromCapabilities()`. Tests prove missing, deprecated, version-incompatible, export-drifted, and action/ref-kind-narrower manifests fail, while current finance/agency manifests verify. | RQ38: How should verified terminal-admission provider manifests become durable install/runtime provider certificates so workflow dispatch cannot rely on stale in-process manifest checks? |

Active question set leaving this run: RQ12-RQ20, RQ38.

## Peer-Reviewed Sources

- Patrick Lam, Jens Dietrich, and David J. Pearce, "Putting the Semantics into Semantic Versioning," Onward! 2020. DOI: https://doi.org/10.1145/3426428.3426922
- Mike Barnett and Wolfram Schulte, "Runtime Verification of .NET Contracts," Journal of Systems and Software 2003. DOI: https://doi.org/10.1016/S0164-1212(02)00041-9
- Yan Jin and Jun Han, "Runtime Validation of Behavioural Contracts for Component Software," QSIC 2005. DOI: https://doi.org/10.1109/QSIC.2005.54
- Tien-Dung Cao, Trung-Tien Phan-Quang, Patrick Félix, and Richard Castanet, "Automated Runtime Verification for Web Services," ICWS 2010. DOI: https://doi.org/10.1109/ICWS.2010.19
- Luca de Alfaro and Thomas A. Henzinger, "Interface Automata," ESEC/FSE 2001. DOI: https://doi.org/10.1145/503209.503226

## Bridge Hypothesis

Terminal-admission provider coverage should require two independent declarations:

1. the capability write contract advertises the provider ref it expects;
2. the provider package exports a live manifest proving current availability and supported contract/action/ref-kind surface.

The registry may list refs from capability metadata, but a verifier must fail closed when the provider manifest is missing, unavailable, deprecated, version-incompatible, package/export-drifted, or narrower than the declared action/ref-kind coverage.

## Falsification Criteria

The v36 slice fails if:

1. a provider ref with no manifest still counts as verified coverage;
2. a deprecated or unavailable provider manifest counts as verified coverage;
3. a provider manifest with a different major version counts as compatible;
4. a provider manifest that omits a declared action type counts as coverage for that action;
5. `@pm/evals` manifest-gated coverage still treats stale metadata as covered.

## Implementation Delta

- Added `TerminalAdmissionProviderAvailability` and `TerminalAdmissionProviderManifest` to `@pm/types`.
- Added `contractVersion` to `TerminalAdmissionProviderRef`.
- Added registry verification issue/result/report types.
- Added `verifyTerminalAdmissionProviderRef()` for single ref/manifest checks.
- Added `verifyTerminalAdmissionProviderBindings()` for capability write-contract checks.
- Added provider manifests in `@pm/capability-finance-research-ingest` and `@pm/profile-agency`.
- Added manifest-gated capability-derived coverage mode in `@pm/evals`.
- Added tests for missing, deprecated, incompatible, export-drifted, and narrower provider manifests.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/types typecheck
pnpm --filter @pm/registry typecheck
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm --filter @pm/profile-agency typecheck
pnpm --filter @pm/evals typecheck
pnpm vitest run packages/registry/src/terminal-admission.test.ts packages/capability-finance-research-ingest/src/capability.test.ts packages/profile-agency/src/publication-terminal.test.ts packages/evals/src/write-binding.test.ts --reporter=basic
pnpm vitest run packages/registry/src/terminal-admission.test.ts packages/capability-finance-research-ingest/src/capability.test.ts packages/profile-agency/src/publication-terminal.test.ts packages/evals/src/write-binding.test.ts packages/evals/src/marketing.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/three-axis-coverage.test.ts packages/workflow/src/evidence-binding.test.ts packages/agent-state/src/index.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts --reporter=basic
pnpm test -- --reporter=basic
pnpm typecheck
git diff --check
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved: ArrowHedge provider coverage now requires a live compatible manifest. Ten-class Axis A coverage remains incomplete. |
| Axis B marketing | Still blocked for full verification. The agency publication provider ref and manifest verify locally, but PluggedInSocial is not restored and no authoritative fixture run has been accepted as Axis B source of truth. |
| Axis C local lab | Mechanism coverage exists; unchanged in this slice. |

No verified solution is claimed.
