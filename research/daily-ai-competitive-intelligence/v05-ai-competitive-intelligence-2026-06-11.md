# v05 AI Competitive Intelligence - 2026-06-11

Date: 2026-06-11 UTC
Local run target: 2026-06-11 America/Chicago
Status: fifth numbered daily competitive-intelligence continuation
Prior version: `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md`
Paired agent-state baseline: `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md`

Repository sync and worktree note:

- Verified remote `main` before any research write: `git ls-remote --heads origin main` and `git fetch origin main --prune` both resolved to `bc716c85addd2209108fbcfce75ad0fcb053f7b8`.
- Local root `main` contained an uncommitted external-evidence draft that predated the upstream June 10 split implementation. Rather than recommit a second copy, this run preserved that dirty root as evidence, audited the upstream landing, and used a clean in-repo detached worktree (`.codex-worktree-run`) for the code/test closure.
- Upstream same-day reality reviewed before writing: `18e9fb5` published the June 10 research continuations, `f9d95fe` corrected the automation-memory note, and `bc716c8` landed the stronger external-evidence admission implementation plus rewrite-thesis realignment.

Required local context read:

1. `research/index.md`
2. `research/daily-ai-competitive-intelligence/index.md`
3. `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md`
4. `research/daily-arrowsmith-agent-state/index.md`
5. `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md`
6. `Changelog.md`
7. `packages/agent-state/src/external-evidence.ts`
8. `packages/evals/src/evidence-admission.ts`
9. `packages/evals/src/evidence-admission.test.ts`

Official-source review window:

- Re-checked official vendor surfaces in the 24-72 hour window ending 2026-06-11 for OpenAI, Anthropic, GitHub/Microsoft, Google, AWS, ServiceNow, Atlassian, Asana, and Cursor.
- No newly found 2026-06-11 official source changed the v04 frontier more than the already-confirmed June 10 evidence-lane shift.
- The highest-signal official source still shaping implementation remains GitHub's 2026-06-10 Copilot CLI `/security-review` release, because it turns external validation into an explicit invoked evidence lane rather than only background platform behavior.

Current pm-substrate comparison baseline:

> The differentiated problem is no longer "can pm-substrate describe evidence lanes?" The differentiated problem is whether those lanes are replayable, reviewable, and clearly non-authoritative after they are committed to disk and rechecked.

## 1. Delta From v04

v05 is intentionally a narrow correction run.

1. **No fresher official source displaced the June 10 frontier.** The strongest official 24-72 hour deltas still come from GitHub's explicit `/security-review` command, Google's approval-currentness and DLP-policy mechanics, and AWS AgentCore's split runtime lanes. This is useful negative evidence: the implementation priority should stay on replayable evidence handling rather than jumping to a new competitor taxonomy.
2. **The competitive finding from v04 was immediately actionable.** `origin/main` already converted the v04/v07 research into a stronger pure implementation on 2026-06-10. Today's honest code target was therefore not "invent another evidence kind" but "make yesterday's admission corpus durable and regression-checkable."
3. **Committed replay is now part of the competitive boundary.** Vendors increasingly expose scans, approvals, traces, runtime lanes, and policy metadata. pm-substrate only differentiates if it can preserve and replay why those lanes were treated as evidence rather than authority.

## 2. Claim Updates

| Claim | v05 status | Correction or confirmation |
| --- | --- | --- |
| The next competitive step after v04 is a new evidence taxonomy. | Downgraded | The taxonomy already landed upstream on 2026-06-10. The sharper next step was durable replay of that corpus. |
| External validation commands are enough once they exist. | Rejected again | GitHub's `/security-review` remains validation evidence only; committed replay must still preserve source-authority and current-state separation. |
| Approval-currentness and provider-policy fixtures were still only research notes. | Contradicted | Those fixtures already landed in `origin/main`; this run closes the on-disk replay proof for that corpus. |

## 3. Implemented Item

Today's competitive-intelligence-to-code closure implemented the strongest remaining durable-proof invariant from v04:

- Added `buildEvidenceAdmissionReviewCorpus()` and `serializeEvidenceAdmissionReviewsJsonl()` in `packages/evals/src/evidence-admission.ts`.
- Committed the deterministic replay corpus at `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`.
- Added a drift test in `packages/evals/src/evidence-admission.test.ts` that regenerates the corpus and fails if the committed file diverges.

This closes the "pure in-memory only" gap for the external-evidence admission corpus without pretending runtime write-path enforcement is done.

## 4. Implementation/Test Task Tree

```text
competitive-intelligence frontier after v05
|
+-- T1 committed replay for external evidence admission
|   |-- status: IMPLEMENTED 2026-06-11
|   |-- proof: packages/evals/fixtures/evidence-admission-reviews.v1.jsonl
|   `-- proof: evidence-admission drift test compares regenerated JSONL to committed corpus
|
+-- T2 runtime write-path integration
|   |-- source: v04/v07 evidence-lane split
|   `-- next proof: admission reviews consumed by capability/workflow side-effect boundaries
|
+-- T3 live protocol/runtime revalidation
|   |-- source: GitHub CLI, MCP handles, AWS AgentCore, Google approval resume
|   `-- next proof: real runtime/tool handles cannot override current-state review after replay
|
`-- T4 on-disk ArrowHedge corpus parity
    |-- source: replay/regression honesty
    `-- next proof: commit ArrowHedge artifact JSONL alongside evidence-admission JSONL
```

## 5. Verification

- `tsc -b packages/evals --verbose`
- `vitest run packages/evals/src/evidence-admission.test.ts packages/agent-state/src/external-evidence.test.ts`
- Result: 41 tests passed; the committed admission-review corpus matched the regenerated output exactly.

## 6. Source Inventory

- GitHub Changelog, "Dedicated security review command now available in Copilot CLI," 2026-06-10: https://github.blog/changelog/2026-06-10-dedicated-security-review-command-now-available-in-copilot-cli/
- Carry-forward official sources from v04 remained the strongest unchanged deltas on 2026-06-11: Google Workspace alignment approvals, Google Cloud ADK long-running approval flow, AWS AgentCore release notes, and GitHub third-party coding-agent validation.
