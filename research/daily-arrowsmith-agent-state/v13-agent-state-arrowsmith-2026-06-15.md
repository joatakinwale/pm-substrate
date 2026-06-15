# v13 Agent-State Arrowsmith - 2026-06-15

Date: 2026-06-15 UTC
Local run clock: 2026-06-15 America/Chicago
Status: thirteenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v12-agent-state-arrowsmith-2026-06-13.md`

Repository sync note:

- Local `HEAD`, local `origin/main`, and remote `main` all resolved to `e9ff479a9b460841a8dc506911fb1990f9e6dd49` before editing.
- `git ls-remote origin refs/heads/main` returned the same SHA immediately.
- `git fetch origin main --prune` stalled in this shell and was interrupted after SHA parity was independently confirmed.
- The working tree was clean before this run.

## 1. Version Header

v13 continues v12 instead of restarting the thesis. v12 said the next executable frontier was durable certificate/status verification, target-side receipt evidence, or memory-write and memory-read influence admission. This run chooses the memory frontier and closes the pure-contract portion: `@pm/agent-state` now distinguishes memory writes from memory retrievals, classifies recalled memory as fact, preference, instruction, tool-routing, policy-like rule, or summary, and warns when control-influencing memory lacks override-status metadata or is already overridden by current workflow/user state. `@pm/evals` now carries replay fixtures and metrics for hidden-instruction writes, clean preference writes, and overridden tool-routing memory.

## 2. One-Paragraph Delta From Previous Version

v12 was correct that memory writes and memory reads were still being conflated. After reviewing the current repo and the latest official 2026-06-11 to 2026-06-12 vendor/runtime sources again, the strongest research-to-code move was not another certificate note. It was to make memory evidence typed before it can quietly steer action. The implemented closure is still intentionally scoped: this is pure admission and replay proof, not runtime blocking of every memory-backed write, not durable memory status stores, and not final target-state confirmation. But it does close the previously open taxonomy gap that v12 explicitly called out.

## 3. Research Question

What is the smallest honest code slice that turns v12's memory-security findings into executable substrate behavior without overclaiming broad mutation governance?

## 4. Source Map

| Source | Date | Type | Finding strength | What it supports | Limit |
| --- | --- | --- | --- | --- | --- |
| Local repo audit at `e9ff479a9b460841a8dc506911fb1990f9e6dd49` plus new `@pm/agent-state` / `@pm/evals` diffs | 2026-06-15 | Primary local repo evidence | High | The chosen executable invariant is memory-write/read classification plus replay fixtures, not another note-only continuation. | Local proof only until committed/pushed. |
| [From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329) | 2026-06-03 | Primary preprint | High for risk taxonomy | Memory writes are admission surfaces, not benign personalization. | Preprint; not a substrate implementation by itself. |
| [From Storage to Steering: Memory Control Flow Attacks on LLM Agents](https://arxiv.org/abs/2603.15125) | 2026-03-16, surfaced in June 2026 scans | Primary preprint | High for control-flow bridge | Memory retrieval can alter tool choice and workflow order, so recalled memory needs explicit influence classification. | Does not define the exact pm-substrate contract. |
| [Copilot code review: New configurations and controls](https://github.blog/changelog/2026-06-12-copilot-code-review-new-configurations-and-controls/) | 2026-06-12 | Official vendor changelog | Medium | Vendor control planes are still adding governance knobs and content controls, which increases pressure on pm-substrate to keep evidence typed and reviewable. | Configurability is not operational-state authority. |
| [GitHub availability report: May 2026](https://github.blog/news-insights/company-news/github-availability-report-may-2026/) | published 2026-06-11 | Official availability report | Medium | Persistent cloud-agent/session infrastructure remains fallible; session/runtime persistence is not final-state proof. | Reliability reports do not define write-validity policy. |
| [OpenAI to acquire Ona](https://openai.com/index/openai-to-acquire-ona/) | 2026-06-11 | Official company post | Medium | Persistent, customer-controlled agent environments are becoming a mainstream direction, strengthening the need for typed admitted evidence instead of raw persistence. | Persistence does not solve currentness or authority. |
| [Amazon Bedrock AgentCore release notes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html) | observed 2026-06-15 | Official docs | Medium | Runtime, Memory, Browser, and Code Interpreter surfaces remain separate evidence lanes; memory is a first-class external system, not trusted substrate state. | Release notes are platform capability evidence, not direct artifact-review proof. |

## 5. Prior-Version Claim Audit

| v12 claim or open item | v13 status | Correction or continuation |
| --- | --- | --- |
| Memory writes are external evidence admissions. | Partly closed in code | `memory_write` is now a first-class evidence kind with required write-admission metadata. |
| Memory reads can be control-flow influence. | Partly closed in code | `memory_retrieval` now classifies influence as fact, preference, instruction, tool-routing, policy-like rule, or summary. |
| Memory influence should bind high-consequence writes. | Narrowed | The admission/replay layer now emits the required warnings and metrics; broad runtime enforcement remains open. |
| Durable certificate/status verification is open. | Still open | v13 does not change that frontier. |
| Target-side receipt evidence is open. | Still open | v13 does not change that frontier. |

## 6. Implemented Slice

This run converted the strongest open v12 finding into code:

1. Added `memory_write` as a distinct `ExternalStateEvidenceKind`.
2. Extended `MemoryEvidenceFacet` with:
   - `sourceChannel`
   - `intendedUse`
   - `influenceKind`
   - `overrideStatus`
3. Added admission warnings for:
   - missing memory-write metadata
   - missing influence classification
   - missing override status for control-influencing memory
   - recalled control memory that is already overridden
4. Extended the replay corpus with:
   - hidden-instruction memory write
   - clean preference memory write
   - overridden tool-routing memory retrieval
5. Extended replay metrics so the corpus now counts memory-write fixtures, control-influence fixtures, and influence-kind coverage.

## 7. Implementation/Test Task Tree

```text
Implementation/Test Task Tree (2026-06-15)
|
+-- memory write admission metadata ........ IMPLEMENTED (pure) 2026-06-15
|   |-- proof: `memory_write` now requires sourceChannel + intendedUse metadata
|   `-- proof: hidden-instruction write fixture warns when intended use and override status are incomplete
|
+-- memory read influence taxonomy ......... IMPLEMENTED (pure) 2026-06-15
|   |-- proof: recalled memory now classifies fact/preference/instruction/tool-routing/policy-like-rule/summary
|   `-- proof: overridden tool-routing memory produces an explicit admission warning
|
+-- memory replay corpus + metrics ......... IMPLEMENTED (pure) 2026-06-15
|   |-- proof: committed evidence-admission JSONL now includes memory-write and memory-control fixtures
|   `-- proof: metrics report memoryWriteCount, memoryControlInfluenceCount, and influence-kind coverage
|
+-- durable memory status / revocation ..... OPEN
|   `-- next proof: substrate-owned memory status/store semantics beyond replay fixtures
|
+-- write-binding consumption of memory influence .... OPEN
|   `-- next proof: high-consequence write paths verify memory influence review before external mutation
|
`-- target-side receipt evidence ........... OPEN
    `-- next proof: dispatch and admitted receipt stay separate for memory/subagent/handoff writes
```

## 8. Verification

- `pnpm exec tsc -p packages/agent-state/tsconfig.json --noEmit --pretty false`
- `pnpm --filter @pm/evals typecheck`
- `vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`
  - 33 tests passed
- `vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic`
  - 11 tests passed
- Regenerated `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` from source after the memory contract change.

## 9. Remaining Honest Boundary

v13 closes the memory taxonomy gap as a pure/replayable primitive. It does **not** claim:

- live memory-store currentness or deletion verification
- durable memory certificate/status authority
- transport-wide runtime blocking for memory-backed writes
- final target-state confirmation after memory-influenced actions
- PM protocol-burden closure

## 10. Next-Day Watchlist

1. Decide whether memory influence review belongs directly in `InvocationEvidenceBinding` or only in admitted evidence consumed by that binding.
2. Add poisoned-memory denial cases, not only warn-first control-surface cases.
3. Extend memory evolution/compaction lineage beyond write/read classification.
4. Add target-side receipt evidence before memory write success can become admitted shared state.
