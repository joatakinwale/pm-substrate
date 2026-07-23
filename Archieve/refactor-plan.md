# pm-substrate — Refactor Plan: lean agent-state core + PM-methodology governance

> **Forward plan: [`ROADMAP.md`](./ROADMAP.md).** This document is the executed refactor charter, kept for history.
>
> **STATUS 2026-07-02 — EXECUTED.** Phases 0–2 complete and verified (852/859 tests
> green on both core-only and tower-enabled databases; all four CI gates green;
> amnesia headline: baseline 0% vs substrate 100%, chain valid). Phase 3
> mechanism verified; the live PluggedInSocial tree drifted post-eviction and
> currently fails its own readiness anchors — tracked in Changelog 2026-07-02.
> Residuals: live-Ollama lab runs, standalone app repos, 12 live behavior
> metrics, shrinking (not just freezing) the quarantined tower.

*Purpose: refocus the codebase on the stated objective — **solve the agent-state problem and implement project-management methodologies into multi-agents as governance** — by extracting a lean core, quarantining the runaway provenance tower, evicting the app sandboxes, and building governance as a Tier-2 profile. Grounded in directly verified facts (below), not the research prose.*

---

## 0. Verified facts (what's actually true)

I confirmed the load-bearing claims directly against the code and git. Three of the Fable agents' specifics needed correction — flagged below.

| Claim | Verdict | Evidence |
|---|---|---|
| `agent-state/src/index.ts` is ~85k lines / 1,611 exports | **Confirmed** | `wc -l` = 85,134; `grep -c "^export"` = 1,611 |
| agent_state dominates migrations | **Confirmed** | 123 of 147 migrations are `agent_state` |
| The tower is barely consumed | **Confirmed, sharpened** | Only **47 of 1,611 exports (2.9%)** are imported anywhere downstream; the **substrate runtime core** (`graph`, `events`, `registry`, `workflow`, `projections`, `substrate-http`, `types`, `profile-registry`, `tenants`, `continuity`, `capability-kit`) imports `@pm/agent-state` **zero times**. All 13 consuming source files are eval/testbed/app code (`evals` ×6, `profile-agency` ×4, `capability-finance-research-ingest` ×2, `local-agent-lab` ×1). |
| "referenced 6 times" (Agent 1) | **Corrected** | Real number: 13 source files, 25 import statements, 47 distinct symbols. Understated — but the point stands and is stronger framed as "0 runtime-core consumers." |
| Research-file explosion late June | **Confirmed, bigger than claimed** | Files added/day: **42 (Jun 25), 60 (Jun 26), 103 (Jun 27)**, 8 (Jun 28). 257 research files total. (Agents estimated 41/71/99.) |
| v229 "recursion stop rule" | **Confirmed** | `research/daily-arrowsmith-agent-state/v229-substrate-primitive-backmap-2026-07-01.md`; stop rule referenced in `research/index.md` |
| PluggedInSocial ≈ 417 files | **Corrected (larger)** | 512 tracked files in `plugged_in_social/`. `arrowhedgelab/` is on disk but only 1 file is git-tracked (effectively untracked). |
| "T4 amnesiac resume never ran" (Agent 2) | **Not substantiated** | Amnesia eval exists and is tested: `packages/continuity/src/amnesia-eval.test.ts`, `packages/continuity/src/context.ts`, `docs/adr/0032-amnesiac-agent-eval.md`. Weaker true statement: it isn't wired into a headline measured result — but "never ran" is wrong. |
| "PM-as-governance appears nowhere" (Agent 2) | **Partly corrected** | `governance`/`RACI`/`methodology` appear in 9 docs, mostly recent app specs (`docs/superpowers/specs/2026-07-01-pluggedinsocial-autonomous-agency-design.md`, arrowhedge integration plans). It is not a first-class *substrate* concept, but the vocabulary is present. |

**The empirical basis for the whole plan:** the substrate's own runtime does not depend on the 85k-line tower, and only 47 symbols are used outside it. That makes the split low-risk and mechanical rather than speculative.

---

## 1. Target architecture

```
Lean substrate (unchanged, keep as-is)
  @pm/types  @pm/graph  @pm/events  @pm/registry  @pm/workflow
  @pm/projections  @pm/profile-registry  @pm/tenants
  @pm/continuity  @pm/capability-kit  @pm/entity-mapping
  @pm/substrate-http (+ demo)  @pm/capability-audit

Agent-state, split in two
  @pm/agent-state-core         ← the ~47 used symbols + transitive deps (small)
  @pm/agent-state-provenance   ← the witness/authority/quorum/seal tower (quarantined, opt-in)

The objective (new)
  @pm/profile-pm-governance    ← Tier-2 profile: PM methodology as governance

Out of this repo (become external substrate consumers)
  plugged_in_social/   → own repo, onboards via profile + capabilities only
  arrowhedgelab/       → own repo (already effectively untracked)
```

---

## 2. Phase 0 — Structural hygiene (days, no behavior change)

Goal: shrink and clarify boundaries with zero functional change. Every step ends with `pnpm build && pnpm typecheck && pnpm test` green.

**2.1 Split `@pm/agent-state` → `-core` + `-provenance`.**
- The `-core` surface is defined empirically by the 47 imported symbols, which cluster into the exact primitives the README names:
  - `StateRef` / `stateRef`
  - **CurrentStateView / ObservationContract**: `CurrentStateView`, `ObservationContract`, `buildObservationContractFromCurrentStateView`, `evaluateObservationContract`, `buildReadSetFromCurrentStateView`, `ReadSetEntry`
  - **ActionProposalReview** (warn-first): `reviewProposedActionAgainstCurrentState`, `ActionProposalReview`, `ActionProposalReviewEnforcementMode`, `AllowedAction`, `StateConflict`
  - **StateReviewArtifact** (+ hash replay): `buildStateReviewArtifact`, `verifyStateReviewArtifactHash`, `evaluateStateReviewInvariantPolicy`, `StateReviewInvariantClass`, `StateReviewInvariantPolicyMatrix`, JSONL import/serialize, continuity-payload builders
  - **ActionOutcomeEnvelope** (terminal outcomes): `buildActionOutcomeEnvelope`, `verifyActionOutcomeEnvelopeHash`, `ActionTerminalOutcome`, `ActionOutcomeBlockingCause`, `buildActionOutcomeTerminalIndex`, provider-authority builders, `promoteWorkflowInvocationOutcomeEnvelope`
  - **External-evidence admission** (already its own file `external-evidence.ts`, 895 lines): `reviewExternalStateEvidence`, `EvidenceAdmissionReview/Context/Decision/IssueCode`, `ExternalStateEvidence/Kind`
  - Thin refs only: `ProjectionReplayCertificateRef`, `ActionOutcomeProviderCertificateStatusRef` (keep the *types*, not the replay tower)
- Mechanical method: create `packages/agent-state-core`; move `external-evidence.ts` + the symbols above and their transitive type deps out of the 85k file; re-point the 13 consumers to `@pm/agent-state-core`. Everything left → `packages/agent-state-provenance`.
- **Acceptance:** the 25 import sites resolve from `-core`; `-provenance` has no importers in the workspace; typecheck/tests green.
- Interim shim (optional): keep `@pm/agent-state` re-exporting both so the diff can land incrementally.

**2.2 Gate the provenance migrations.**
- Keep migrations `0001–0023` (core: graph/events/registry/workflow/projections/profiles/continuity/evals/budget/lead_scoring + provenance-chain + agent-continuity + eval taxonomy + `action_outcome_envelope_packets` 0020 + `projection_replay_frontier` 0023) as the **default required set**.
- Audit `0024–0026` for the handful of tables the retained `-core` store actually needs (e.g. projection-replay-certificate storage) and keep those.
- Move the rest (~`0027–0147`, the `agent_state` witness/authority/quorum/seal/pruning tower) to an **opt-in** set: separate dir `db/migrations-provenance/` applied only when `PM_ENABLE_AGENT_STATE_PROVENANCE=1`. Update `scripts/migrate.ts` to apply core by default, provenance behind the flag.
- **Acceptance:** a fresh `pnpm db:reset` with no flag boots the full substrate + evals + the two profiles + `-core`; the flag adds the tower.

**2.3 Evict the app sandboxes.**
- Move `plugged_in_social/` (512 files) and `arrowhedgelab/` to their own repos. They consume the substrate as an npm dependency / HTTP client of `@pm/substrate-http`.
- This makes the "G4 anti-fixation / zero-substrate-edit onboarding" claim *real*: the app lives outside and must onboard purely via a profile + capabilities.
- **Acceptance:** substrate repo builds/tests with the apps removed; `profile-agency` (the reusable Tier-2 profile) stays; app-specific glue (`plugged-in-social-*` adapters) moves with the app or is demoted to the app repo.

**2.4 Guardrails so the drift cannot recur.** (see §5)

---

## 3. Phase 1 — Pay the thesis debts (1–2 weeks)

The project's credibility rests on claims it never fully measured. Close them on the lean core.

- **Amnesiac resume (T4):** promote `packages/continuity/src/amnesia-eval.test.ts` from a unit test to a headline measured eval in `@pm/evals` (baseline vs substrate arms), producing a number, not just a passing assertion.
- **"Act on current state" actually enforced:** wire `graph`'s `freshnessGate` / `requireFresh` into at least one real read path used by a capability, so staleness gating is exercised end-to-end, not just exported.
- **Plug-in "zero-edit" metric:** add a CI check that asserts a profile (agency / pm-governance) installs and runs with no diff to `types/graph/events/registry/workflow/projections/substrate-http` — turning the anti-fixation rule into an automated gate.

---

## 4. Phase 2 — Build the objective: `@pm/profile-pm-governance` (2–4 weeks)

PM methodology expressed as a Tier-2 profile + a few governance capabilities on the lean core. Depends only on `@pm/types` (+ `@pm/agent-state-core` for review/approval).

**4.1 Entity types** (specializations of the seven primitives)

| Concrete | Tier-1 | Required identity |
|---|---|---|
| Initiative | Engagement | title, scopeStart, scopeEnd, state |
| WorkItem | Engagement | title, state, priority |
| Milestone (Gate) | Event | kind, occurredAt, gateState |
| Deliverable | Document | sha256, mimeType, filename |
| AgentRole | Resource | name, kind(=agent\|human), capabilities |
| Stakeholder | Counterparty | name |
| ApprovalRequest | Event | kind, occurredAt, decisionState |

`identityPrimacy: "Initiative"`.

**4.2 Edge catalog — RACI + dependencies as typed edges with enforced cardinality**

```ts
accountable_to: WorkItem → AgentRole   fromCardinality "exactly:1"   // one A per item (RACI)
responsible_for: AgentRole → WorkItem  unbounded
consulted_on:   AgentRole → WorkItem   unbounded
informed_of:    AgentRole → WorkItem   unbounded
part_of:        WorkItem  → Initiative fromCardinality "exactly:1"
depends_on:     WorkItem  → WorkItem   unbounded            // + workflow cycle-check
gated_by:       Milestone → WorkItem   unbounded
requests:       ApprovalRequest → WorkItem  fromCardinality "exactly:1"
```

The single-accountability RACI rule is enforced *for free* by the substrate's existing edge cardinality validator (`exactly:1`) — this is the clean, load-bearing use of the substrate the objective needs, and it needs none of the quarantined tower.

**4.3 Lifecycles (stage gates)** — `WorkItem`: todo→in_progress→in_review→(blocked)→done→accepted (terminal: accepted, cancelled). `Milestone`: pending→passed/failed. `ApprovalRequest`: requested→approved/rejected/withdrawn. Enforced by the substrate's lifecycle validator (legal transitions only; the substrate checks, the profile decides).

**4.4 Governance mechanics — map methodology → existing primitives**

| PM / governance concept | Substrate primitive |
|---|---|
| Single accountable owner (RACI "A") | `accountable_to` edge `exactly:1` **and** capability `WriteContract` `ownership:"owner"` uniqueness (workflow installer already refuses two owners per field) |
| Approval gate before an agent acts | `ActionProposalReview` (warn-first, `-core`) requiring an `approved` `ApprovalRequest` as bound evidence via workflow `ActionOutcomeEnvelope` |
| "Review current state before acting" | `CurrentStateView` + `ObservationContract` + `freshnessGate` |
| Stage-gate advancement | workflow DAG node + lifecycle transition guarded by a `gated_by` Milestone in `passed` |
| Standup / status | `continuity.checkpoints` (kind = `standup`/`status`), hash-chained |
| Reporting / dashboards / burndown / RAID | `@pm/projections` read-models over the event log |
| Audit trail | the event log's existing hash chain (core) — **not** the 85k tower |

**4.5 Governance capabilities** (authored with `capability-kit`): a stage-gate advancer (subscribes to gate/approval events, advances `WorkItem` lifecycle), an approval-required write gate, and a status-rollup projection. Two or three capabilities, each ~a few hundred lines like the existing `capability-agency-lead-scoring`.

---

## 5. Guardrails (land in Phase 0, enforce forever)

Targeting the exact mechanism that produced the drift (a self-spawning research loop with no depth/budget/consumer limit):

- **File/package budgets in CI:** fail if any `src` file exceeds ~2,000 lines, or a package exceeds a LOC budget. (The tower was one 85k-line file.)
- **Name-depth lint:** ban type/table identifiers longer than Postgres's 63-char limit or beyond N compounding segments — the tower literally hand-abbreviated names to fit. Encodes v229's "recursion stop rule" as a check.
- **No-orphan-primitive rule:** every new exported `build*/verify*/admit*` symbol must have a runtime (non-test, non-eval) consumer within K commits or it is reverted. This is the single highest-leverage rule — the tower was ~1,560 exports with no runtime consumer.
- **Amend the research run protocol:** cap depth and budget; require each "required primitive" to ship with an executable consumer; remove the automatic "eliminated question → replacement question" spawn (make new scope a human gate). Keep the ledger; remove the perpetual-motion.

---

## 6. Phased roadmap & acceptance criteria

| Phase | Outcome | Done when |
|---|---|---|
| **0** Hygiene | `-core`/`-provenance` split; provenance migrations gated; apps evicted; CI budgets live | build/typecheck/test green; runtime core has 0 provenance imports; fresh `db:reset` boots without the flag |
| **1** Pay debts | T4 amnesia eval measured; freshnessGate wired; zero-edit plug-in CI gate | three numbers/gates exist in CI output |
| **2** Objective | `@pm/profile-pm-governance` + governance capabilities | a multi-agent scenario runs under RACI + stage-gate + approval governance in `local-agent-lab`, single-accountability enforced by the substrate |
| **3** Prove it | External app onboarded via the profile | PluggedInSocial (now external) runs on the profile with **zero substrate edits**; the 12 behavior metrics captured baseline vs substrate |

---

## 7. Risks & open questions

- **Split effort in one 85k file:** moving symbols + transitive types is tedious; mitigate with the re-export shim (2.1) so it lands incrementally behind green tests.
- **Is any quarantined primitive load-bearing for the objective?** Evidence says no (0 runtime-core consumers), but confirm the retained projection-replay-certificate *store* the `-core` needs before gating its migrations.
- **Don't discard genuine value:** terminal-outcome envelopes, evidence-≠-authority admission, and hash-replay artifacts are real and used — they belong in `-core`, not the quarantine.
- **When would `-provenance` be justified?** Only under genuine multi-party Byzantine trust (independent operators, adversarial actors, regulated multi-writer audit). Single-tenant, single-Postgres deployments get audit from the event hash-chain already; keep the tower opt-in until a real multi-party requirement appears.
- **PM methodology scope:** start with one methodology (e.g., stage-gate/RACI); resist re-creating the "one profile per framework" sprawl. Methodology packs should be *data* in the profile, not new packages.
