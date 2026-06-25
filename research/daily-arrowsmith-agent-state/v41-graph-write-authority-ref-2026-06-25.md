# v41 - Graph Write Authority Ref

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ42.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ42: How should non-workflow graph/capability write boundaries consume provider-certificate status refs so direct write paths cannot bypass the workflow `ActionOutcomeEnvelope` status binding? | Protection-system design says authority checks must sit at every object access, not only at a preferred high-level route. Proof-carrying authentication shows the write request should carry checkable authorization evidence, not rely on ambient trust. Decentralized information-flow control shows labels/authority must propagate with data across distrust boundaries, while Laminar shows a practical enforcement region can make those checks auditable and incrementally deployable. Therefore graph writes need a substrate-level write-authority ref that cites an accepted workflow action outcome envelope and, in strict mode, the provider-certificate status event ref used at dispatch. The boundary must be policy-gated so existing raw graph uses still work until callers are migrated, but strict graph instances fail closed before SQL. | Added `GraphWriteAuthorityRef`, `GraphWriteProviderCertificateStatusRef`, `GraphWriteAuthorityPolicy`, `validateGraphWriteAuthority()`, `assertGraphWriteAuthority()`, and `GraphWriteAuthorityError` to `@pm/graph`. Extended create/update node, create edge, and delete edge inputs/boundaries to accept authority refs. Added optional `PostgresGraph.writeAuthorityPolicy`; when configured, graph mutations reject missing, non-accepted, missing-status-ref, revoked-status, or certificate-mismatched authority before any SQL runs. Added pure/adapter tests for the validator and pre-SQL guard path. | RQ43: How should capability-kit idempotency/apply/emit transactions require and propagate graph write authority refs so capability handlers cannot update `graph.nodes` with raw SQL outside graph write authority policy? |

Active question set leaving this run: RQ12-RQ20, RQ43.

## Peer-Reviewed Sources

- Jerome H. Saltzer and Michael D. Schroeder, "The Protection of Information in Computer Systems," Proceedings of the IEEE, 1975. DOI: https://doi.org/10.1109/PROC.1975.9939. Author-hosted text: https://web.mit.edu/saltzer/www/publications/protection/
- Andrew W. Appel and Edward W. Felten, "Proof-Carrying Authentication," ACM CCS 1999. DOI: https://doi.org/10.1145/319709.319718. PDF: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Andrew C. Myers and Barbara Liskov, "A Decentralized Model for Information Flow Control," ACM SOSP 1997. DOI: https://doi.org/10.1145/268998.266669. PDF: https://www.cs.utexas.edu/~witchel/380L/papers/myers97sosp-iflow.pdf
- Indrajit Roy, Donald E. Porter, Michael D. Bond, Kathryn S. McKinley, and Emmett Witchel, "Laminar: Practical Fine-Grained Decentralized Information Flow Control," ACM PLDI 2009. DOI: https://doi.org/10.1145/1542476.1542484. PDF: https://mdbond.github.io/laminar-pldi-2009.pdf

## Bridge Hypothesis

Workflow status binding is bypassable unless the graph write boundary treats authority as an input to the mutation itself:

```text
workflow dispatch gate -> accepted ActionOutcomeEnvelope
accepted envelope -> graph write authority ref
provider status event -> providerCertificateStatusRef
graph policy -> require accepted envelope + current valid status ref before SQL
```

This maps the papers as follows:

```text
complete mediation -> every graph mutation checks authority
proof-carrying auth -> caller carries checkable authority evidence
information-flow labels -> authority/status provenance propagates with data
security regions -> strict graph instance is the enforcement region
```

## Falsification Criteria

The v41 slice fails if:

1. a strict graph instance can create/update/tombstone rows without an accepted authority ref;
2. a strict graph instance accepts an authority ref without the provider-certificate status event ref used at dispatch;
3. revoked or certificate-digest-mismatched status refs can support graph mutation;
4. enforcement happens after SQL or profile validation rather than before side effects;
5. the new policy breaks existing raw graph callers when policy is not enabled;
6. direct capability-kit raw SQL writes remain unrecorded as the next open boundary.

## Implementation Delta

- Added graph write-authority contracts in `packages/graph/src/write-authority.ts`.
- Added `writeAuthorityRef` to `CreateNodeInput`, `UpdateNodeInput`, and `CreateEdgeInput`, and added an optional authority ref to `deleteEdge`.
- Added `writeAuthorityPolicy` to `PostgresGraphOptions`.
- Added a pre-SQL graph adapter guard for create node, update node, create edge, and tombstone edge.
- Exported the validator, error, policy, and ref types from `@pm/graph`.
- Added `packages/graph/src/write-authority.test.ts` with pure validator coverage and adapter pre-SQL rejection coverage.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/graph typecheck
pnpm exec vitest run packages/graph/src/write-authority.test.ts
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved substrate write boundary: strict graph instances can now require accepted workflow authority and valid provider status refs. Axis A ten-class verification remains incomplete. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism improved at graph boundary; local-lab scenarios do not yet require graph write-authority refs end-to-end. |

No verified solution is claimed.
