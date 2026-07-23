# v38 - Provider Certificate Status Store

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ39.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ39: How should provider certificates be persisted and refreshed through a substrate-owned status store so revocation, supersession, and process restart cannot fall back to stale in-memory certificate providers? | Provider certificates should be immutable proof objects, while current status is a separate, queryable, substrate-owned record. Naor/Nissim show certificate revocation needs efficient authenticated status/update data structures rather than relying on the certificate alone. Liu et al. show that revocation fails in practice when clients do not reliably fetch and respect status. Smith/Dickinson/Seamons show scalable revocation works by indexing status separately from the certificate body. CONIKS shows long-lived binding systems need auditable consistency checks, not private local memory. Therefore pm-substrate should store provider certificate status beside immutable certificate JSON, update status through a registry-owned store, and let workflow dispatch query that store at decision time. | Added `TerminalAdmissionProviderCertificateStatusStore` and status-record types to `@pm/registry`; added pure certificate integrity validation separate from status-record validation; added `PostgresTerminalAdmissionProviderCertificateStore` backed by `registry.terminal_admission_provider_certificates`; added migration `0021_registry_terminal_provider_certificates.sql`; and wired `PostgresWorkflowRuntime` to consume a registry certificate status store directly via `actionOutcomeProviderCertificateStore`, passing the dispatch timestamp into certificate lookup. | RQ40: How should provider certificate status transitions become append-only, replayable status events so amnesiac replay can explain whether a write used the status current at decision time rather than only the latest stored status? |

Active question set leaving this run: RQ12-RQ20, RQ40.

## Peer-Reviewed Sources

- Moni Naor and Kobbi Nissim, "Certificate Revocation and Certificate Update," IEEE Journal on Selected Areas in Communications, 2000. DOI: https://doi.org/10.1109/49.839932
- Yabing Liu et al., "An End-to-End Measurement of Certificate Revocation in the Web's PKI," ACM IMC 2015. DOI: https://doi.org/10.1145/2815675.2815685
- Trevor Smith, Luke Dickinson, and Kent Seamons, "Let's Revoke: Scalable Global Certificate Revocation," NDSS 2020. DOI: https://doi.org/10.14722/ndss.2020.24084
- Marcela S. Melara, Aaron Blankstein, Joseph Bonneau, Edward W. Felten, and Michael J. Freedman, "CONIKS: Bringing Key Transparency to End Users," USENIX Security 2015. DOI: https://doi.org/10.5555/2831143.2831168

## Bridge Hypothesis

A provider certificate should be immutable, digest-checked evidence. The mutable part is status:

```text
certificate body: issuer, subject, manifest, validity window, digest
status store: tenant, certificateId, currentStatus, statusUpdatedAt, reason, supersededBy
workflow gate: lookup current store record -> validate immutable certificate + status record -> dispatch or block
```

This prevents revocation from corrupting certificate hashes and prevents process restart from falling back to private in-memory provider state.

## Falsification Criteria

The v38 slice fails if:

1. revoking a provider certificate requires mutating the certificate JSON and invalidating its digest;
2. a runtime can require provider certificates but only accepts an in-memory provider path;
3. a restarted process cannot recover the certificate/status pair from substrate-owned storage;
4. a revoked status-store record can still be selected as the current certificate for dispatch;
5. missing or invalid status-store records are collapsed into eval-only blockers rather than runtime dispatch inputs.

## Implementation Delta

- Added registry status-store interfaces:
  - `TerminalAdmissionProviderCertificateStatusRecord`
  - `TerminalAdmissionProviderCertificateStatusStore`
  - record, lookup, update, and current-certificate input types
- Added `verifyTerminalAdmissionProviderCertificateIntegrity()` so immutable certificate digest/manifest validation can run without validity/status policy.
- Added `verifyTerminalAdmissionProviderCertificateStatusRecord()` so current status can revoke/supersede a digest-valid certificate without mutating the certificate body.
- Added `PostgresTerminalAdmissionProviderCertificateStore` with:
  - idempotent certificate recording;
  - same-id/different-digest rejection;
  - current status update;
  - current valid certificate lookup by tenant/capability/provider;
  - optional checked-at validation during lookup.
- Added migration `db/migrations/0021_registry_terminal_provider_certificates.sql`.
- Updated `InvocationActionOutcomeProviderCertificateProvider.getCertificate()` to receive `checkedAt`.
- Added `PostgresWorkflowRuntime.actionOutcomeProviderCertificateStore`, which adapts the registry store into the existing certificate provider boundary.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/registry typecheck
pnpm --filter @pm/workflow typecheck
pnpm test packages/registry/src/terminal-admission.test.ts packages/registry/src/postgres.test.ts packages/workflow/src/evidence-binding.test.ts
pnpm typecheck
```

The new Postgres registry integration test is present but skipped in this environment because `PM_DATABASE_URL` is not set. It verifies that a separately instantiated store can recover the same certificate/status row and that revocation removes the certificate from current valid lookup.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved: write-capable workflow runtime can now draw provider certificates from a restart-safe registry store. Ten-class Axis A verification remains incomplete. |
| Axis B marketing | Still blocked for full verification. The agency provider path can use the store, but PluggedInSocial is not restored and no authoritative fixture run has been accepted as Axis B source of truth. |
| Axis C local lab | Mechanism improved for restart-safe certificate lookup; existing Axis C live coverage remains unchanged in this slice. |

No verified solution is claimed.
