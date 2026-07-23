# v40 - Workflow Status Ref Binding

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ41.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ41: How should workflow `ActionOutcomeEnvelope` evidence/substrate refs bind the exact provider-certificate status event sequence/hash used at dispatch so replay cannot substitute a later or different certificate-status chain? | Provenance and lineage work says an output is not explainable unless it can trace to the exact source items, transformations, and versions that produced it. Buneman/Khanna/Tan frame provenance as the source/derivation basis for validation. Cui/Widom and Zhang/Zhang/Prabhakar show lineage must trace derived outputs back through transformations, including non-relational or black-box processing. Hasan/Sion/Winslett show provenance itself must be integrity-protected against history forgery. Therefore a workflow `ActionOutcomeEnvelope` should not merely cite a provider certificate id/digest; it should carry the exact status event sequence/hash, status, statusUpdatedAt, and checkedAt used by the runtime certificate gate. | Added `InvocationActionOutcomeProviderCertificateStatusRef` to `@pm/workflow`; extended provider lookup results so registry-backed providers can return `{ certificate, statusRef }` while existing providers may still return a certificate; added `providerCertificateStatusRef` to `InvocationActionOutcomeEnvelope`, admission requests, and dispatcher context; wired the registry status-store adapter to derive the status ref from replay events at `checkedAt`; and added consistency checks that reject status refs bound to a different certificate/digest/decision time. | RQ42: How should non-workflow graph/capability write boundaries consume provider-certificate status refs so direct write paths cannot bypass the workflow `ActionOutcomeEnvelope` status binding? |

Active question set leaving this run: RQ12-RQ20, RQ42.

## Peer-Reviewed Sources

- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Data Provenance: Some Basic Issues," FSTTCS 2000. https://www.cis.upenn.edu/~sanjeev/papers/fsttcs00_data_provenance.pdf
- Yingwei Cui and Jennifer Widom, "Lineage Tracing for General Data Warehouse Transformations," VLDB 2001. https://www.vldb.org/conf/2001/P471.pdf
- Mingwu Zhang, Xiangyu Zhang, Xiang Zhang, and Sunil Prabhakar, "Tracing Lineage Beyond Relational Operators," VLDB 2007. https://www.vldb.org/conf/2007/papers/industrial/p1116-zhang.pdf
- Ragib Hasan, Radu Sion, and Marianne Winslett, "The Case of the Fake Picasso: Preventing History Forgery with Secure Provenance," FAST 2009. https://www.usenix.org/conference/fast09/technical-sessions/presentation/hasan

## Bridge Hypothesis

The runtime write envelope must bind the exact status event that justified the provider certificate:

```text
provider certificate -> immutable implementation proof
status event stream -> append-only currentness proof
workflow envelope -> certificate id/digest + status sequence/hash + checkedAt
replay -> resolve envelope refs -> replay status chain -> verify same event was current at dispatch
```

Without the status event sequence/hash in the envelope, replay can show that some certificate exists, but not which status-chain view the runtime used before dispatch.

## Falsification Criteria

The v40 slice fails if:

1. accepted workflow envelopes cite certificate id/digest but omit the status event sequence/hash used at dispatch;
2. a provider can attach a status ref for a different certificate, digest, or checkedAt time and still pass the runtime gate;
3. the status ref is visible only in test/eval artifacts and not in runtime admission or dispatcher context;
4. old custom certificate providers are broken instead of remaining compatible;
5. the registry-backed store adapter cannot derive a status ref from the substrate status-event stream.

## Implementation Delta

- Added `InvocationActionOutcomeProviderCertificateStatusRef` with certificate id, digest, status, status sequence, status event hash, statusUpdatedAt, and checkedAt.
- Added provider lookup result types that support both legacy `TerminalAdmissionProviderCertificate` returns and richer `{ certificate, statusRef }` returns.
- Added `providerCertificateStatusRef` to workflow action outcome envelopes and envelope hash seeds.
- Added the status ref to action outcome admission requests and dispatcher invocation context.
- Updated `PostgresWorkflowRuntime` to:
  - derive status refs from `TerminalAdmissionProviderCertificateStatusStore.listCertificateStatusEvents()` when using the registry-backed store adapter;
  - reject status refs whose certificate id, digest, or checkedAt do not match the verified certificate decision;
  - carry status refs through accepted and blocked action outcome envelopes when present.
- Added pure workflow tests proving the envelope carries the status ref.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/workflow typecheck
pnpm test packages/workflow/src/evidence-binding.test.ts packages/workflow/src/postgres.test.ts
```

The Postgres workflow runtime integration file remains skipped when `PM_DATABASE_URL` is absent, so the runtime propagation test is compiled but not executed in this environment.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved runtime substrate primitive: workflow envelopes can now cite exact certificate status event refs. Ten-class Axis A verification remains incomplete. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism improved at workflow boundary; local-lab live scenarios do not yet assert status-ref binding. |

No verified solution is claimed.
