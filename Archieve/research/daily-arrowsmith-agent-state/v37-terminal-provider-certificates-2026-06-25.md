# v37 - Terminal Provider Certificates

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ38.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ38: How should verified terminal-admission provider manifests become durable install/runtime provider certificates so workflow dispatch cannot rely on stale in-process manifest checks? | Verified manifests should be promoted into explicit, status-bearing certificates that bind issuer, subject, implementation identity, manifest digest, validity window, and revocation/supersession status. Lampson/Abadi/Burrows/Wobber show that distributed authorization depends on explicit principals, statements, and delegation boundaries rather than ambient trust. Blaze/Feigenbaum/Lacy show trust management should evaluate policy against credentials at decision time. Gray/Cheriton leases show bounded validity windows are a practical consistency mechanism for cached authority. Certificate-status work shows that the credential itself is insufficient without current revocation/status verification. Therefore a terminal-admission provider manifest is evidence until a durable certificate is issued and checked at dispatch time. | Added `TerminalAdmissionProviderCertificate` types with subject, manifest digest, certificate digest, validity window, and status; added registry certificate issuance, digesting, and validation helpers; wired `@pm/workflow` to optionally require a terminal-admission provider certificate before write-capable dispatch; runtime-generated action outcome envelopes now carry provider certificate ids/digests; certificate failures dead-letter as blocked terminal outcomes; `@pm/evals` now tracks provider-certificate missing/invalid buckets separately. | RQ39: How should provider certificates be persisted and refreshed through a substrate-owned status store so revocation, supersession, and process restart cannot fall back to stale in-memory certificate providers? |

Active question set leaving this run: RQ12-RQ20, RQ39.

## Peer-Reviewed Sources

- Butler W. Lampson, Martin Abadi, Michael Burrows, and Edward Wobber, "Authentication in Distributed Systems: Theory and Practice," ACM Transactions on Computer Systems, 1992. DOI: https://doi.org/10.1145/138873.138874
- Matt Blaze, Joan Feigenbaum, and Jack Lacy, "Decentralized Trust Management," IEEE Symposium on Security and Privacy, 1996. DOI: https://doi.org/10.1109/SECPRI.1996.502679
- Cary G. Gray and David R. Cheriton, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency," SOSP 1989. DOI: https://doi.org/10.1145/74851.74870
- Zhen Liu et al., "A Blockchain-Based Certificate Revocation Management and Status Verification System," Computers & Security, 2021. DOI: https://doi.org/10.1016/j.cose.2021.102209

## Bridge Hypothesis

Terminal-admission provider manifests should not be read directly by dispatch code as operational authority. The registry should issue a durable provider certificate only after manifest verification succeeds. The workflow runtime should then check the certificate digest, manifest digest, subject/capability binding, validity window, and status before dispatching a write-capable capability.

This makes the bridge explicit:

```text
provider ref -> verified manifest -> issued certificate -> dispatch-time certificate check -> admitted/blocked terminal outcome
```

The certificate is still evidence. It becomes operationally useful only when checked at the write boundary and admitted through the terminal outcome path.

## Falsification Criteria

The v37 slice fails if:

1. a workflow can require provider certificates but still dispatch a write when no certificate provider is installed;
2. an expired, revoked, superseded, tampered, or capability-mismatched certificate supports an accepted dispatch;
3. a provider certificate changes without changing the action outcome envelope identity/evidence surface;
4. certificate failures are collapsed into generic blocked cases without distinct metrics;
5. the implementation relies on eval-only fixtures instead of runtime/substrate package code.

## Implementation Delta

- Added `TerminalAdmissionProviderCertificateStatus`, `TerminalAdmissionProviderCertificateSubject`, and `TerminalAdmissionProviderCertificate` to `@pm/types`.
- Added `terminalAdmissionProviderManifestDigest()`, `terminalAdmissionProviderCertificateDigest()`, `issueTerminalAdmissionProviderCertificates()`, and `verifyTerminalAdmissionProviderCertificate()` to `@pm/registry`.
- Extended `InvocationActionOutcomeEnvelope` with `providerCertificateId` and `providerCertificateDigest`.
- Added `InvocationActionOutcomeProviderCertificateProvider` and optional `actionOutcomeProviderCertificate` runtime context plumbing in `@pm/workflow`.
- Added `requireActionOutcomeProviderCertificate` to `PostgresWorkflowRuntime`; when enabled, missing or invalid provider certificates block before dispatch and dead-letter with a blocked terminal envelope.
- Passed valid provider certificates through workflow admission requests and dispatcher contexts so adapters can promote them into canonical terminal admission.
- Extended write-binding eval decisions/metrics with `blocked_provider_certificate_missing` and `blocked_provider_certificate_invalid` rather than hiding them as generic unverified bindings.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/types typecheck
pnpm --filter @pm/registry typecheck
pnpm --filter @pm/workflow typecheck
pnpm --filter @pm/evals typecheck
pnpm test packages/registry/src/terminal-admission.test.ts
pnpm test packages/workflow/src/evidence-binding.test.ts
pnpm test packages/evals/src/write-binding.test.ts
pnpm typecheck
pnpm test
```

Postgres workflow integration tests compile but were skipped in this environment because `PM_DATABASE_URL` was not set.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved: ArrowHedge-capable write dispatch can now require a status-bearing provider certificate before accepted dispatch. Ten-class Axis A verification remains incomplete. |
| Axis B marketing | Still blocked for full verification. The agency provider path can use the certificate primitive, but PluggedInSocial is not restored and no authoritative fixture run has been accepted as Axis B source of truth. |
| Axis C local lab | Mechanism improved for certificate-missing and certificate-invalid failure isolation; existing Axis C live coverage remains unchanged in this slice. |

No verified solution is claimed.
