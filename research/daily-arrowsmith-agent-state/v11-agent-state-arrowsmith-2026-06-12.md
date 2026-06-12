# v11 Agent-State Arrowsmith - 2026-06-12

Date: 2026-06-12 UTC
Local run clock: 2026-06-12 America/Chicago
Status: eleventh numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md`

Repository sync note: this run started from `main`, fetched `origin/main`, and confirmed local `HEAD`, local `origin/main`, and remote `main` all matched `a68f0a0ec182311f30ebb306610d0bc1c479450f` before edits. No merge conflict or dirty worktree was present.

## 1. Delta From Prior Version

v10 shifted the frontier from fixture-backed verification catalogs toward certificate/revocation semantics, target-side delivery confirmation, memory-control-flow review, final-state checks, role-utility metrics, and PM protocol-burden measurement. v11 converts the certificate part of that frontier into code:

- `@pm/workflow` now models certificate-backed evidence binding refs.
- `verifyInvocationEvidenceBindingAgainstCatalog()` rejects certificate digest mismatch, tenant/workflow mismatch, artifact-hash mismatch, evidence-review coverage mismatch, invalid policy/revocation metadata, expired validity windows, and revoked certificates.
- `@pm/evals` now builds deterministic admission certificates for complete write-binding replay rows and exposes certificate counts in catalog metrics.
- The write-binding replay test now recomputes validation from committed rows and a freshly built catalog instead of trusting stored `record.validation`.
- The stricter replay test found and closed a real cross-corpus mismatch: evidence-admission JSONL used `tnt_arrowhedge_fixtures`, while ArrowHedge state-review and write-binding corpora used `tnt_arrowhedge_state_review_corpus`.

## 2. Research Question

What is the smallest executable step from certificate-bound admission research toward governed operational state, without pretending a fixture certificate is a production signing, revocation, or all-transport enforcement system?

## 3. Prior-Version Claim Audit

| v10 claim | v11 audit status | Correction |
| --- | --- | --- |
| Durable certificate/store verification is the next proof boundary. | Partially closed | The replay/catalog lane now has certificate refs, deterministic digests, validity windows, revocation epochs, policy version, and execution identity. Durable DB/substrate-store authority remains open. |
| Fixture-backed catalog verification is replay proof, not durable authority. | Still true | v11 improves replay proof but does not claim signed production certificates or live revocation. |
| Tenant/workflow binding matters before evidence can authorize a write. | Strengthened | Strict replay exposed a hidden tenant mismatch across committed corpora, now fixed by aligning the evidence-admission corpus tenant. |
| Stored validation fields are enough for committed replay proof. | Rejected | Validation must be recomputed against a fresh catalog; stored validation fields are receipts, not proof. |
| Target-side delivery confirmation is open. | Still open | No target-channel receipt or delivery-confirmation fixture was implemented today. |
| Memory-control-flow and PM burden metrics are open. | Still open | No memory-influence or PM protocol-burden code changed in this run. |

## 4. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture catalog can replay a binding while missing certificate freshness | Admission certificate validity window | Certificate-bound admission / runtime authorization | Medium-high | A binding is not verified if its certificate is expired relative to policy evaluation time. | Add certificate validity checks to workflow verification. | `certificate_validity_failure_count` | Expired certificate verifies as valid. |
| Replayed evidence ids can line up while tenants differ | Tenant-bound replay | Multi-tenant substrate / source authority | High | Cross-corpus replay must reject tenant mismatch before write. | Align committed ArrowHedge evidence-admission tenant and replay through catalog. | `cross_corpus_tenant_mismatch_count` | Different corpus tenants verify as valid. |
| A digest field can be copied without binding to content | Certificate digest | Replay integrity / supply-chain attestation | Medium-high | Certificate digest should be recomputed from policy version, artifact hash, review ids, identity, revocation epoch, and validity window. | Generate deterministic certificate digests in `@pm/evals`. | `certificate_digest_drift_count` | Edited certificate payload keeps passing with stale digest. |
| Stored validation fields can go stale | Recomputed replay decision | Test oracle discipline | High | Tests should recompute decisions from committed data, not trust serialized verdicts. | Rebuild decisions in `write-binding.test.ts` using `verifyInvocationEvidenceBindingAgainstCatalog()`. | `stored_verdict_only_tests` | A corrupted catalog still passes because tests only read stored verdicts. |
| Rejected evidence can be certified accidentally | Policy-bound certificate | Invariant policy / rejected evidence admission | Medium | Rejected evidence remains blocked by policy even when a certificate ref exists. | Keep policy-blocked decisions structural before catalog success. | `rejected_evidence_certificate_escape_count` | Rejected review plus advisory disposition verifies as valid. |

## 5. Implemented Item

Implemented in this run:

- `packages/workflow/src/evidence-binding.ts`
  - Added optional `admissionCertificateId` and `admissionCertificateDigest` to `InvocationEvidenceBinding`.
  - Added `EvidenceBindingAdmissionCertificateRef`.
  - Added certificate verification inside `verifyInvocationEvidenceBindingAgainstCatalog()`.
- `packages/workflow/src/evidence-binding.test.ts`
  - Added tests for valid certificate-backed verification, digest mismatch, expired validity, and revoked certificates.
- `packages/evals/src/write-binding.ts`
  - Added deterministic certificate construction for complete replay bindings.
  - Added catalog certificate metrics.
  - Added digest drift detection when importing committed replay rows.
- `packages/evals/src/write-binding.test.ts`
  - Replays committed rows through the freshly built catalog instead of trusting stored `validation`.
- `packages/evals/src/evidence-admission.ts`
  - Aligned the default ArrowHedge evidence-admission tenant with the ArrowHedge state-review/write-binding corpus tenant.
- `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`
  - Regenerated after tenant alignment.
- `packages/evals/fixtures/write-binding-replay.v1.jsonl`
  - Regenerated with certificate id/digest fields for complete candidate bindings.

## 6. Implementation/Test Task Tree

```text
agent-state frontier after v11
|
+-- certificate-bound replay verification
|   |-- status: IMPLEMENTED (replay/catalog) 2026-06-12
|   |-- proof: verifier rejects digest mismatch, expired certificate, and revoked certificate
|   |-- proof: complete write-binding replay rows carry deterministic certificate id/digest
|   `-- next proof: signed or DB-backed certificate store with live revocation checks
|
+-- cross-corpus tenant alignment
|   |-- status: IMPLEMENTED 2026-06-12
|   |-- proof: strict committed-row replay exposed previous tenant mismatch
|   `-- proof: evidence-admission, state-review, and write-binding corpora now share the ArrowHedge tenant
|
+-- durable store verification
|   |-- status: OPEN
|   `-- next proof: load certificate/catalog refs from DB or substrate store, not only JSONL fixtures
|
+-- target-side delivery confirmation
|   |-- status: OPEN
|   `-- next proof: scheduled/subagent/memory/handoff writes require target-channel receipt
|
+-- memory-control-flow review
|   |-- status: OPEN
|   `-- next proof: distinguish memory-as-fact from memory-as-instruction/tool-routing influence
|
`-- PM protocol-burden and role-utility metrics
    |-- status: OPEN
    `-- next proof: run metrics on real automation or ArrowHedge multi-agent traces
```

## 7. Verification

- Red test first: `pnpm vitest run packages/workflow/src/evidence-binding.test.ts` failed because stale/revoked certificate inputs still verified as valid.
- Green focused proof: `pnpm vitest run packages/workflow/src/evidence-binding.test.ts packages/evals/src/evidence-admission.test.ts packages/evals/src/write-binding.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
- Result: 42 focused tests passed.

## 8. Current Claim Boundary

The honest claim after v11:

> pm-substrate now has certificate-bound replay/catalog verification for committed write-binding fixtures, including tenant alignment and recomputed replay decisions.

The honest non-claims:

- No production signing key exists.
- No DB-backed certificate store exists.
- No live revocation service exists.
- No target-side delivery confirmation exists.
- No all-transport runtime adoption exists.
- No memory-control-flow or PM protocol-burden code changed today.

## 9. Next-Day Watchlist

1. Promote certificate refs into a durable substrate store or DB-backed catalog.
2. Add a deliberately revoked/stale certificate row to a committed fixture corpus once the store shape exists.
3. Add target-side delivery confirmation for scheduled/subagent/memory/handoff writes.
4. Add memory-control-flow fixtures that distinguish recalled facts from recalled instructions.
5. Inventory real write transports and require certificate-backed verification where writes leave the substrate.
6. Add final-state DB/projection verification for at least one write-bound ArrowHedge path.
7. Run PM role-utility/protocol-burden metrics on a real automation trace.
