# v08 AI Competitive Intelligence - 2026-06-15

Date: 2026-06-15 UTC
Local run target: 2026-06-15 America/Chicago
Status: eighth numbered competitive-intelligence continuation
Prior version: `research/daily-ai-competitive-intelligence/v07-ai-competitive-intelligence-2026-06-12.md`
Paired agent-state baseline: `research/daily-arrowsmith-agent-state/v13-agent-state-arrowsmith-2026-06-15.md`

Repository sync note:

- Local `HEAD`, local `origin/main`, and remote `main` all resolved to `e9ff479a9b460841a8dc506911fb1990f9e6dd49` before editing.
- `git fetch origin main --prune` stalled in this shell and was interrupted after `git ls-remote origin refs/heads/main` and local refs matched.
- The working tree was clean before edits.

Official-source review window:

- Re-checked official or primary-source material published or still active in the 2026-06-12 to 2026-06-15 window, with carry-forward comparison against the 2026-06-11 persistence/governance wave.
- Reviewed:
  - GitHub Changelog: [Copilot code review: New configurations and controls](https://github.blog/changelog/2026-06-12-copilot-code-review-new-configurations-and-controls/)
  - GitHub official reliability reporting: [GitHub availability report: May 2026](https://github.blog/news-insights/company-news/github-availability-report-may-2026/)
  - OpenAI official news context: [OpenAI News](https://openai.com/news/) plus [OpenAI to acquire Ona](https://openai.com/index/openai-to-acquire-ona/)
  - AWS official docs: [Amazon Bedrock AgentCore release notes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html)

## 1. Delta From v07

The fresh official window did not produce a stronger public contradiction to pm-substrate than the June 11-12 persistence/governance pattern already captured in v06-v07. The highest-signal official delta inside the 72-hour window was GitHub's June 12 Copilot code-review controls: more organization runner controls, content exclusion support, and larger custom-instruction surfaces. That is still governance over agent work, not portable original-observation/read-set/action-review proof. GitHub's newly published May 2026 availability report also matters competitively: cloud-agent and code-review sessions can delay or fail, which reinforces the substrate claim that persistent session/runtime state is not final action truth. OpenAI's June 11 Ona direction and AWS AgentCore's current runtime/memory/browser/code-interpreter release notes continue the same pattern: long-running agent work is becoming normal, but persisted runtimes and memory systems still need substrate-owned evidence admission.

## 2. Competitive Conclusion

The official 2026-06-12 to 2026-06-15 window strengthened one narrow point and did not overturn the broader thesis:

1. **Strengthened point:** vendor governance is getting more configurable at the control-plane layer.
2. **Unchanged gap:** no reviewed official source exposed portable original observations, source authority, read-set validation, observed-read-set comparison, workflow transition validity, and durable action-review artifacts as one inspectable governed layer.
3. **Correct implementation answer:** keep turning persistence/governance pressure into typed replayable evidence, not into another vendor taxonomy.

## 3. Implemented Item

Today's competitive-intelligence-to-code closure converted the memory-governance pressure into code rather than another memo:

- `@pm/agent-state` now distinguishes `memory_write` from `memory_retrieval`.
- Memory evidence now declares whether it acts as `fact`, `preference`, `instruction`, `tool_routing`, `policy_like_rule`, or `summary`.
- Control-influencing memory now warns when override status is missing or when current workflow/user state has already overridden the remembered control signal.
- `@pm/evals` now carries replay fixtures and metrics for hidden-instruction memory writes, clean preference memory writes, and overridden tool-routing memory retrieval.

This is still a pure/replayable substrate answer, not a claim that all live memory-backed writes are now runtime-governed.

## 4. Implementation/Test Task Tree

```text
competitive-intelligence frontier after v08
|
+-- T1 committed replay -> verification catalog
|   |-- status: IMPLEMENTED 2026-06-12
|   `-- proof: committed state-review/evidence-admission/write-binding JSONL replay through a fresh catalog
|
+-- T2 admission certificate verification
|   |-- status: IMPLEMENTED (catalog/replay) 2026-06-12
|   `-- proof: workflow verifier rejects digest mismatch, expired validity, and revoked certificates
|
+-- T3 memory-write admission + influence taxonomy
|   |-- status: IMPLEMENTED (pure/replay) 2026-06-15
|   |-- proof: memory writes now require source-channel/intended-use metadata
|   `-- proof: memory retrieval now distinguishes fact/preference vs instruction/tool-routing control influence
|
+-- T4 durable certificate/status stores
|   |-- source: GitHub/OpenAI/AWS persistence/governance pressure
|   `-- next proof: DB-backed or substrate-store-backed certificate verification with live revocation/status checks
|
+-- T5 target-side receipt evidence
|   |-- source: availability/reliability reports and delegated-runtime persistence
|   `-- next proof: dispatch-only success stays separate from admitted receipt/final-state proof
|
`-- T6 transport-wide adoption
    |-- source: persistent sessions, cloud runtimes, and governed agent workflows
    `-- next proof: real write transports consume replay-verified evidence bindings, not only fixture samples
```

## 5. Verification

- `vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`
  - 33 tests passed
- `vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic`
  - 11 tests passed
- `pnpm --filter @pm/evals typecheck`
- Regenerated `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`

## 6. Source Inventory

- GitHub Changelog, "Copilot code review: New configurations and controls," 2026-06-12: https://github.blog/changelog/2026-06-12-copilot-code-review-new-configurations-and-controls/
- GitHub official reliability report, "GitHub availability report: May 2026," published 2026-06-11: https://github.blog/news-insights/company-news/github-availability-report-may-2026/
- OpenAI News index, observed 2026-06-15: https://openai.com/news/
- OpenAI, "OpenAI to acquire Ona," 2026-06-11: https://openai.com/index/openai-to-acquire-ona/
- Amazon Bedrock AgentCore release notes, observed 2026-06-15: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html

## 7. What Changed Competitively

- **GitHub:** stronger org-level review controls and evidence that cloud-agent/session reliability remains a real operating constraint.
- **OpenAI:** persistent Codex environments remain the official direction, but no new public artifact-review primitive appeared in this window.
- **AWS:** AgentCore keeps broadening runtime and memory surfaces, which increases evidence-lane breadth rather than collapsing those lanes into authority.

## 8. Honest Boundary

v08 does **not** claim that vendors solved pm-substrate's full governed operational-state problem. The reviewed official window still shows configurable, persistent, organization-governed agent infrastructure, not inspectable pre-action authority/currentness/read-set/workflow artifacts.
