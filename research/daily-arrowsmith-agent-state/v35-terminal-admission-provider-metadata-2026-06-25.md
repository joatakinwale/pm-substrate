# v35 - Terminal Admission Provider Metadata

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ36 from v34.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ36: How should graph/capability write boundaries advertise terminal-admission providers through registry or capability metadata so new profile adapters can prove write coverage without hand-edited eval transport inventories? | Capability write contracts should advertise terminal-admission providers as typed component-contract metadata: provider id, implementation package/export, action types, profile scope, and evidence/substrate ref kinds. Beugnard/Jézéquel/Plouzeau/Watkins argue component contracts need more than syntactic signatures; they must carry behavioral assumptions. de Alfaro/Henzinger show interface compatibility depends on action protocols, not only values. Zaremski/Wing's specification matching and Paolucci/Kawamura/Payne/Sycara's semantic capability matching both support discovery from declared behavior rather than hand-maintained inventories. Leucker/Schallhart then bounds the claim: metadata is discoverability evidence only; runtime verification still has to check the actual terminal proof. Therefore the primitive belongs in `@pm/types`/`@pm/registry` capability contracts, with eval coverage deriving from those declarations instead of being the source of truth. | Added `TerminalAdmissionProviderRef` and `WriteContract.terminalAdmissionProviders` to `@pm/types`; added `listTerminalAdmissionProviderBindings()` to `@pm/registry`; attached a real ArrowHedge provider ref to the finance ingest Event write contract; exposed `AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER` beside the agency publication adapter; and added `buildWriteTransportBindingCoverageSamplesFromCapabilities()` so the coverage analyzer can derive action-outcome provider coverage from capability descriptors. | RQ37: How should terminal-admission provider refs be checked for live provider availability, version compatibility, and action-type coverage so registry discovery cannot become stale operational authority? |

Active question set leaving this run: RQ12-RQ20, RQ37.

## Peer-Reviewed Sources

- Antoine Beugnard, Jean-Marc Jézéquel, Noël Plouzeau, and Damien Watkins, "Making Components Contract Aware," IEEE Computer 1999. DOI: https://doi.org/10.1109/2.774917
- Luca de Alfaro and Thomas A. Henzinger, "Interface Automata," ESEC/FSE 2001. DOI: https://doi.org/10.1145/503209.503226
- Amy Moormann Zaremski and Jeannette M. Wing, "Specification Matching of Software Components," ACM TOSEM 1997. DOI: https://doi.org/10.1145/261640.261641
- Massimo Paolucci, Takahiro Kawamura, Terry R. Payne, and Katia Sycara, "Semantic Matching of Web Services Capabilities," ISWC 2002. DOI: https://doi.org/10.1007/3-540-48005-6_26
- Martin Leucker and Christian Schallhart, "A Brief Account of Runtime Verification," Journal of Logic and Algebraic Programming 2009. DOI: https://doi.org/10.1016/j.jlap.2008.08.004

## Bridge Hypothesis

Terminal-admission discovery should be a capability-contract property, not an eval fixture property. A write-capable provider should be able to say:

1. which terminal proof kind it can produce;
2. which package/export implements that proof;
3. which action types are covered;
4. which profile(s) and evidence/substrate ref kinds are expected;
5. which write contract the provider is attached to.

That metadata is not enough to accept a write. It only makes coverage and compatibility inspectable before runtime. The actual write boundary still needs the terminal envelope, evidence refs, substrate refs, hash/status checks, and terminal conflict admission.

## Falsification Criteria

The v35 slice fails if:

1. terminal-admission provider metadata is stored only in eval fixtures;
2. capability normalization drops provider refs;
3. a provider ref on one write contract makes unrelated write contracts look covered;
4. `@pm/evals` must know finance or agency semantics to derive provider coverage;
5. an agency capability without a real provider is marked covered anyway.

## Implementation Delta

- Added `TerminalAdmissionProviderRef` to `@pm/types`.
- Extended `WriteContract` with optional `terminalAdmissionProviders`.
- Added `listTerminalAdmissionProviderBindings()` in `@pm/registry`.
- Added registry tests proving provider refs survive normalization and can be listed by write contract.
- Added `FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER` and attached it to the finance ingest Event write contract that backs the ArrowHedge proposal-review boundary.
- Added `AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER` in `@pm/profile-agency` beside the publication terminal adapter.
- Added capability-derived write-transport coverage sample generation in `@pm/evals`.
- Kept `agency.lead-scoring` uncovered in the derived coverage test because it does not yet have a terminal envelope provider for its rollup write.

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

`pnpm install` was run after adding `@pm/registry` as an `@pm/evals` dependency. The install repeated the existing workspace-cycle warning involving `entity-mapping` and `profile-agency`.

The first root `pnpm test` attempt failed before running real side-effecting assertions because Vitest discovered macOS AppleDouble `._*.test.ts` files and esbuild rejected their binary resource-fork content. Root `vitest.config.ts` now excludes `**/._*`; the rerun passed with 41 test files passed and 20 DB/integration files skipped.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved: ArrowHedge terminal admission is now discoverable from the finance capability write contract. Ten-class Axis A coverage remains incomplete. |
| Axis B marketing | Still blocked for full verification. The agency publication provider ref exists beside the profile adapter, but PluggedInSocial is not restored and no authoritative fixture run has been accepted as the Axis B source of truth. |
| Axis C local lab | Mechanism coverage exists; unchanged in this slice. |

No verified solution is claimed.
