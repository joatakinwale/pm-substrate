# v34 - Agency Publication Terminal Adapter

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ35 from v33.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ35: What minimum authoritative agency/marketing adapter contract should consume terminal admission at publish/revoke/write boundaries so Axis B can move from blocked to non-blocked when PluggedInSocial is absent, without requiring substrate-package edits after profile/adapter boundaries exist? | Axis B needs a profile-owned adapter contract that normalizes external agency records into a stable business artifact, then binds publish-like writes to approval status, content hash, lifecycle state, source refs, and terminal admission. Wiederhold's mediator architecture supports domain-specific mediation layers above heterogeneous sources. Rahm/Bernstein's schema-matching taxonomy says adapter correctness needs explicit schema/instance mapping, not implicit prompt interpretation. Nigam/Caswell's business-artifact model says operational processes should track identifiable artifacts plus state. Hull's semantic-heterogeneity work explains why external source meaning must be made explicit before integration. Clark-Wilson and Schneider then place mutation authority at constrained transaction/state-machine boundaries. Therefore the smallest useful code slice belongs in `@pm/profile-agency`: a publication terminal envelope builder over an authoritative fixture snapshot, not a new substrate package or an eval-only placeholder. | Added `packages/profile-agency/src/publication-terminal.ts`, exporting `AgencyPublicationAuthoritySnapshot`, `buildAgencyPublicationActionOutcomeEnvelope()`, and `buildAgencyPublicationActionOutcomeTerminalIndex()`. The helper consumes accepted fixture/source refs, approval status, approval/content hashes, freshness, and lifecycle state, then builds canonical `ActionOutcomeEnvelope`s through `@pm/agent-state`. Tests prove approved matching content is accepted, revoked approval blocks publish, exact replay is idempotent, and same-action accepted/blocked publish attempts produce a terminal conflict through the core terminal index. | RQ36: How should graph/capability write boundaries advertise terminal-admission providers through registry or capability metadata so new profile adapters can prove write coverage without hand-edited eval transport inventories? |

Active question set leaving this run: RQ12-RQ20, RQ36.

## Peer-Reviewed Sources

- Gio Wiederhold, "Mediators in the Architecture of Future Information Systems," IEEE Computer 1992. DOI: https://doi.org/10.1109/2.121508
- Erhard Rahm and Philip A. Bernstein, "A Survey of Approaches to Automatic Schema Matching," The VLDB Journal 2001. DOI: https://doi.org/10.1007/s007780100057
- Anil Nigam and Nathan S. Caswell, "Business Artifacts: An Approach to Operational Specification," IBM Systems Journal 2003. DOI: https://doi.org/10.1147/sj.423.0428
- Richard Hull, "Managing Semantic Heterogeneity in Databases: A Theoretical Perspective," PODS 1997. DOI: https://doi.org/10.1145/263661.263668
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy 1987. DOI: https://doi.org/10.1109/SP.1987.10001
- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach: A Tutorial," ACM Computing Surveys 1990. DOI: https://doi.org/10.1145/98163.98167

## Bridge Hypothesis

Axis B should move from "blocked by missing PluggedInSocial" to "fixture-capable but not yet verified" only when an agency adapter can supply:

1. the publishable subject as a profile entity or source record ref;
2. the current content hash and approved content hash;
3. an approval/status ref with checked-at and optional valid-until metadata;
4. source refs that point back to PluggedInSocial or an accepted authoritative fixture;
5. lifecycle state for publish/revoke preconditions when relevant;
6. a state-review artifact hash and proposal-review id;
7. a canonical terminal envelope admitted by `@pm/agent-state`.

The substrate does not need to know "marketing publish" semantics. The profile adapter owns them.

## Falsification Criteria

The v34 slice fails if:

1. `@pm/workflow`, `@pm/types`, `@pm/graph`, or `@pm/evals` must be edited to encode agency publish semantics.
2. A revoked client approval can still build an accepted publish terminal outcome by default.
3. A current content hash that differs from the approved content hash can support an accepted publish.
4. Exact replay of the same publish envelope is treated as a conflict.
5. A same-action accepted/blocked publish pair is not reported as a terminal conflict by the core terminal index.

## Implementation Delta

- Added `AgencyPublicationAuthoritySnapshot` and publication action types to `@pm/profile-agency`.
- Added `buildAgencyPublicationActionOutcomeEnvelope()` to convert agency publication fixture snapshots into canonical `ActionOutcomeEnvelope`s.
- Added `buildAgencyPublicationActionOutcomeTerminalIndex()` to run agency publication candidates through the core terminal index.
- Exported the new module from `@pm/profile-agency`.
- Added `@pm/agent-state` as an explicit runtime dependency of `@pm/profile-agency`.
- Added pure tests for approved publish, revoked publish block, idempotent replay, and same-action terminal conflict.

## Proof Status

Focused verification passed:

```text
pnpm vitest run packages/profile-agency/src/publication-terminal.test.ts packages/profile-agency/src/profile.test.ts --reporter=basic
pnpm --filter @pm/profile-agency typecheck
```

`pnpm install` was run to refresh workspace dependency links after adding `@pm/agent-state` to `@pm/profile-agency`. The install reported an existing workspace cycle warning involving `entity-mapping` and `profile-agency`; the focused tests and typecheck passed after the dependency graph refreshed.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved by ArrowHedge terminal-index adoption, but ten-class coverage remains incomplete. |
| Axis B marketing | Still blocked for full verification. The agency package now has a terminal-admission adapter primitive, but PluggedInSocial is not restored and no authoritative fixture run has been accepted as the Axis B source of truth. |
| Axis C local lab | Mechanism coverage exists; unchanged in this slice. |

No verified solution is claimed.
