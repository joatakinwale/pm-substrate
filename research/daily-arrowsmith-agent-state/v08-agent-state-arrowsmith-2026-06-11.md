# v08 Agent-State Arrowsmith - 2026-06-11

Date: 2026-06-11 UTC
Local run target: 2026-06-11 America/Chicago
Status: eighth numbered daily continuation
Prior version: `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md`
Paired competitive-intelligence state: `research/daily-ai-competitive-intelligence/v05-ai-competitive-intelligence-2026-06-11.md`

Repository sync and worktree note:

- Verified remote `main` at `bc716c85addd2209108fbcfce75ad0fcb053f7b8` with `git ls-remote --heads origin main` and `git fetch origin main --prune`.
- Reviewed the same-day `origin/main` progression before writing: `18e9fb5` (published June 10 continuations), `f9d95fe` (automation-memory note correction), and `bc716c8` (external evidence admission + rewrite-thesis landing).
- Local root `main` had a dirty pre-upstream external-evidence draft. This run preserved that root unchanged as provenance and moved the actual code/test closure into a clean detached worktree so the research chain reflects remote truth instead of a second conflicting local implementation.

## 1. Delta From v07

v08 is a repo-grounded continuation, not a new literature pass.

1. **v07's implementation claim survived same-day audit.** The June 10 upstream code really did close the external-evidence admission contract as pure primitives; today's audit found no contradiction there.
2. **One frontier item remained materially open after v07/L017:** the admission corpus was deterministic and tested, but still lived only in code and in-memory test generation. That made replay claims weaker than they needed to be for a substrate that argues artifacts matter.
3. **Committed replay is now closed for the admission corpus.** Today's code adds deterministic JSONL export plus a checked-in golden corpus and a drift test. This is the smallest coherent durable-proof step that advances the thesis without overstating runtime enforcement.

## 2. Same-Day Main Audit

Artifacts reviewed against `origin/main`:

- `packages/agent-state/src/external-evidence.ts`
- `packages/agent-state/src/external-evidence.test.ts`
- `packages/evals/src/evidence-admission.ts`
- `packages/evals/src/evidence-admission.test.ts`
- `research/index.md`
- `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md`
- `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md`

Audit outcome:

- The external evidence admission contract, approval-currentness drift, provider-policy drift, custom-store/subagent evidence, PM handoff agreement, run groups, and role projections are implemented pure primitives on `origin/main`.
- The remaining honest gap was committed replay for that corpus. That gap is now closed for evidence-admission reviews, but still open for an on-disk ArrowHedge artifact corpus.

## 3. Claim Updates

| Claim | v08 status | Update |
| --- | --- | --- |
| Persisted/golden JSON artifacts remain entirely open. | Revised | No longer true for evidence-admission reviews: the canonical review corpus is now committed and replay-tested. ArrowHedge on-disk artifact corpus is still open. |
| External evidence admission is only a synthetic in-memory test surface. | Contradicted | The admission corpus now has a checked-in JSONL replay artifact and a drift test. |
| Runtime integration should be the very next step before durable replay. | Downgraded | Runtime integration is still next for side-effect boundaries, but committed replay was the stronger truthful prerequisite for CI regression and claim stability. |

## 4. Implemented Item

Implemented today:

- `buildEvidenceAdmissionReviewCorpus()` in `packages/evals/src/evidence-admission.ts`
- `serializeEvidenceAdmissionReviewsJsonl()` in `packages/evals/src/evidence-admission.ts`
- committed replay artifact: `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`
- drift test: `packages/evals/src/evidence-admission.test.ts`

Why this matters:

> pm-substrate argues that evidence handling should be artifact-backed, replayable, and inspectable. A checked-in admission corpus is the first durable proof that the external-evidence lane itself can be replayed instead of only regenerated inside one test process.

## 5. Implementation/Test Task Tree

```text
agent-state frontier after v08
|
+-- external evidence admission ............ IMPLEMENTED (pure) 2026-06-10
|   `-- next proof: consume admission reviews in capability/workflow write paths
|
+-- committed admission replay corpus ...... IMPLEMENTED 2026-06-11
|   |-- proof: packages/evals/fixtures/evidence-admission-reviews.v1.jsonl
|   `-- proof: drift test compares committed JSONL to regenerated corpus
|
+-- on-disk ArrowHedge artifact corpus ..... OPEN
|   `-- next proof: commit canonical ArrowHedge artifact JSONL alongside admission corpus
|
+-- live MCP / runtime revalidation ........ OPEN
|   `-- next proof: real protocol/runtime handles still require substrate admission after replay
|
`-- PM real-run agreement .................. OPEN
    `-- next proof: comparePmHandoffAgreement on real multi-agent ArrowHedge runs
```

## 6. Verification

- `tsc -b packages/evals --verbose`
- `vitest run packages/evals/src/evidence-admission.test.ts packages/agent-state/src/external-evidence.test.ts`
- Result: 41 tests passed; committed corpus matched regenerated output exactly.
