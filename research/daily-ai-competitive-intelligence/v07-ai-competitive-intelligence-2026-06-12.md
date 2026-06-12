# v07 AI Competitive Intelligence - 2026-06-12

Date: 2026-06-12 UTC
Local run target: 2026-06-12 America/Chicago
Status: seventh numbered competitive-intelligence continuation
Prior version: `research/daily-ai-competitive-intelligence/v06-ai-competitive-intelligence-2026-06-12.md`
Paired agent-state baseline: `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md`

Repository sync and worktree note:

- Started on `main`, fetched `origin/main`, and verified local `HEAD`, local `origin/main`, and remote `main` were all `a68f0a0ec182311f30ebb306610d0bc1c479450f`.
- No stale Git lock files were present. Process inspection found no repo-local stale `git fetch` or `git push`; only a long-running `ssh-agent` and unrelated Codex Computer Use client were visible.
- The working tree was clean before edits.

Required local context read:

1. `research/index.md`
2. `research/daily-ai-competitive-intelligence/index.md`
3. `research/daily-ai-competitive-intelligence/v06-ai-competitive-intelligence-2026-06-12.md`
4. `research/daily-arrowsmith-agent-state/index.md`
5. `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md`
6. `Changelog.md`
7. `packages/workflow/src/evidence-binding.ts`
8. `packages/evals/src/write-binding.ts`
9. `packages/evals/src/evidence-admission.ts`

Official-source review window:

- Re-checked official or primary-source material dated 2026-06-10 through 2026-06-12.
- No reviewed source contradicted v06's core finding: vendors are making agent work persistent, searchable, automatable, and enterprise-governed, but the public evidence still does not show portable original-observation/read-set/action-review artifacts equivalent to pm-substrate.
- The strongest implementation pressure remained runtime/session persistence under governance: GitHub Agentic Workflows and Copilot session search, Google Vault retention/holds for Gemini app data, AWS AgentCore persistent shells and Step Functions embedding, and OpenAI's planned Ona acquisition for persistent Codex environments.

Current pm-substrate comparison baseline:

> Vendor persistence is becoming normal. pm-substrate only stays differentiated if persisted evidence cannot be reused for writes until it is tenant-aligned, certificate-bound, policy-versioned, identity-scoped, revocation-aware, and replay-verified.

## 1. Delta From v06

v06 converted persistence/governance pressure into a replay-backed verification catalog. v07 tightens that code boundary after a hostile replay review:

1. **Certificate-bound verification is now executable.**
   - The workflow verifier can reject stale, revoked, or digest-mismatched admission certificates.
   - Certificate-backed catalog entries carry policy version, revocation epoch, execution identity, validity window, artifact hash, and evidence-review ids.
2. **The replay test now actually replays committed rows through the constructed catalog.**
   - The prior test read the stored validation field from JSONL; it did not fully re-run every row against the catalog.
   - v07 fixes that so committed corpus rows must verify against the catalog built from committed corpus files.
3. **A hidden cross-corpus tenant mismatch was found and closed.**
   - Evidence-admission reviews used `tnt_arrowhedge_fixtures`, while ArrowHedge state-review artifacts and write-binding records used `tnt_arrowhedge_state_review_corpus`.
   - Strict catalog replay correctly rejected the mismatch. The evidence-admission corpus default tenant now aligns with the ArrowHedge state-review/write-binding corpus tenant.

## 2. Claim Updates

| Claim | v07 status | Correction or confirmation |
| --- | --- | --- |
| Replay-backed catalogs are enough to reuse persisted evidence safely. | Downgraded | A catalog must also verify certificate digest, revocation/validity, execution identity, tenant, workflow, artifact hash, and review coverage. |
| Stored validation fields in replay rows are sufficient proof. | Rejected | The verifier must recompute decisions from committed rows and a freshly built catalog. |
| Cross-corpus fixtures can use different tenants if the ids line up. | Rejected | Tenant mismatch is a real verification failure, not fixture trivia. |
| Vendor persistent sessions/holds/shells are equivalent to valid operational state. | Rejected again | They are useful governance surfaces, but still need substrate-owned admission and write-binding verification. |

## 3. Implemented Item

Today’s competitive-intelligence-to-code closure implemented the strongest executable invariant after v06:

- Added optional admission certificate fields to `InvocationEvidenceBinding`.
- Added `EvidenceBindingAdmissionCertificateRef` to the workflow catalog contract.
- Extended `verifyInvocationEvidenceBindingAgainstCatalog()` to reject certificate digest mismatch, tenant/workflow mismatch, artifact mismatch, review-coverage mismatch, invalid policy/revocation metadata, expired validity windows, and revoked certificates.
- Extended `@pm/evals` replay catalog construction to publish deterministic admission certificates for complete write-binding records.
- Regenerated the committed evidence-admission and write-binding JSONL corpora after aligning the ArrowHedge tenant boundary.
- Tightened `packages/evals/src/write-binding.test.ts` so committed replay rows are re-verified against the freshly built catalog instead of trusting stored `record.validation`.

This advances certificate-bound verification but still does not claim signed production certificates, DB-backed stores, live revocation checks, or all-transport runtime enforcement.

## 4. Implementation/Test Task Tree

```text
competitive-intelligence frontier after v07
|
+-- T1 committed replay -> verification catalog
|   |-- status: IMPLEMENTED 2026-06-12
|   `-- proof: committed state-review/evidence-admission/write-binding JSONL replay through a freshly built catalog
|
+-- T2 admission certificate verification
|   |-- status: IMPLEMENTED (catalog/replay) 2026-06-12
|   |-- proof: workflow verifier rejects digest mismatch, expired validity, and revoked certificates
|   `-- proof: write-binding replay rows carry deterministic certificate id/digest for complete candidate bindings
|
+-- T3 tenant-aligned cross-corpus replay
|   |-- status: IMPLEMENTED 2026-06-12
|   `-- proof: evidence-admission, state-review, and write-binding corpora now share the ArrowHedge tenant for strict verification
|
+-- T4 durable certificate stores
|   |-- source: GitHub/OpenAI/AWS persistent runtime/session pressure plus v10 SAB bridge
|   `-- next proof: DB-backed or substrate-store-backed certificate verification with live revocation epoch checks
|
`-- T5 transport-wide adoption
    |-- source: organization-governed agentic workflows and persistent environments
    `-- next proof: real write transports consume certificate-backed verification, not only fixture samples
```

## 5. Verification

- `pnpm vitest run packages/workflow/src/evidence-binding.test.ts packages/evals/src/evidence-admission.test.ts packages/evals/src/write-binding.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
- Result: 42 focused tests passed.

## 6. Source Inventory

- GitHub Changelog, "Copilot Chat now sees your agent sessions," June 10, 2026: https://github.blog/changelog/2026-06-10-copilot-chat-now-sees-your-agent-sessions/
- GitHub Changelog, "GitHub Agentic Workflows is now in public preview," June 11, 2026: https://github.blog/changelog/2026-06-11-github-agentic-workflows-is-now-in-public-preview/
- GitHub Changelog, "Agentic workflows no longer need a personal access token," June 11, 2026: https://github.blog/changelog/2026-06-11-agentic-workflows-no-longer-need-a-personal-access-token/
- Google Workspace Updates, "Google Vault now supports retention rules and litigation holds for Gemini app," June 11, 2026: https://workspaceupdates.googleblog.com/2026/06/google-vault-now-supports-retention-rules-and-litigation-holds-for-Gemini-app.html
- Amazon Bedrock AgentCore Developer Guide, "Release notes for Amazon Bedrock AgentCore," June 2026 entries observed on 2026-06-12: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html
- OpenAI, "OpenAI to acquire Ona," June 11, 2026: https://openai.com/index/openai-to-acquire-ona/
