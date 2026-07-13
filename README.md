# pm-substrate

**A governed operational-state sidecar for agent-run work: agents resume from it, observe through it, and act only through its admission gates.**

A JOATLABS.dev primitive. **The plan is [`ROADMAP.md`](./ROADMAP.md). The task index is [`TASKS.md`](./TASKS.md). The session protocol is [`CLAUDE.md`](./CLAUDE.md). The live truth is the ledger: `pnpm dev:resume`.**

---

## Start here (any session, human or agent)

1. Read [`CLAUDE.md`](./CLAUDE.md) — the session protocol. Sessions resume from the substrate, not from chat history.
2. Run `pnpm dev:resume` — last handoff, open work, standing decisions, lessons, claims under test (hash-chain verified).
3. Read [`ROADMAP.md`](./ROADMAP.md) — north star, hard requirements, current phase. If the ledger and any document disagree, the ledger wins; record a superseding decision, then fix the document.
4. Use [`TASKS.md`](./TASKS.md) only as a human-readable implementation index. Every task must point back to the roadmap or ledger; it never supersedes either.

Do not start work from this README alone — it is reference, not state.

## Why this exists

Work moves through many tools, teams, and AI agents that each hold a partial model of the same changing reality. The hard problem is **state coherence**: acting safely when every observation can be stale, every action changes state others depend on, and every session starts amnesiac. Humans never solved this — cross-functional projects fail the same way everywhere, because for humans governance is friction the medium cannot enforce. Agents are different: their only hands are their tools, so **governance can be the API**. We don't tolerate silent state loss from git; there is no reason to tolerate it from an agent workforce.

pm-substrate is that enforcement medium: what the workspace accepts as actionable, where each claim came from, how fresh it is, who may change it, which gate it passed, and how agents resume after context loss.

**The immediate objective (see ROADMAP):** make the operating loops of two agent-run businesses demonstrably worth using the substrate for — the marketing lab (PluggedInSocial) and the hedge-fund lab (ArrowHedge) — with the substrate managing its own development as the first proof. Technical correctness is necessary but cannot prove business value; the comparative outcome/cost/owner-effort gate is defined in [`docs/objective-falsification.md`](./docs/objective-falsification.md). Keep/kill gate: 2026-07-16.

## The product shape (decided 2026-07-02)

A **sidecar**, not a platform: Docker + Postgres running next to the system it governs. The adopting system is **never rewritten** — it authors a thin integration kit: `mapping.yaml` (its tables → the seven primitives), a sync adapter (webhook/poll/CDC, state flows in read-only), and an action executor (admitted actions flow back through the app's *existing* API). Agents mount five MCP tools — `resume`, `observe`, `propose`, `admit`, `checkpoint` — so any Claude/GPT/local agent integrates with a config line. Adoption is shadow-first: observe and warn, report what *would* have been blocked, then gate one action type at a time.

Kernel: TypeScript (the type system is load-bearing — cardinality, freshness, and contract rules are compile-time-unrepresentable-when-illegal). Edges: protocol (HTTP/MCP/SQL), any language; a thin Python client SDK ships when the labs need it.

## The control plane

Five questions, answered only from the admitted log — never from self-report:

| Question | Where |
|---|---|
| What is being done? | open `work` checkpoints + last `handoff` (`pnpm dev:status`) |
| What did governance do? | admitted events by type, stage-gate applications, procedure admissions, blocks |
| What did it cost? | `dev.session.cost` events (tokens per session/agent/model) |
| What are the results? | eval metrics in CI plus admitted per-lab business-operability measurements (`pnpm pm:objective -- list`; folded into `pnpm pm:memo`) |
| What got optimized? | closed work items + superseding decisions in the ledger |

v0 is the `dev:status` CLI; the D4 dashboard control-plane page is shipped. The D7 objective verdict remains a CLI/memo gate so it is generated from the same admitted-log fold used for the decision.

## Architecture (reference)

1. **Entity graph** — identity-only nodes, typed edges, profile-validated writes, optimistic concurrency, freshness gates. (`packages/graph`)
2. **Event log** — append-only, tenant-partitioned, hash-chained, `LISTEN/NOTIFY` bus. (`packages/events`)
3. **Capability registry + kit** — typed read/write/emit/subscribe contracts; isolation CI-enforced; the kit owns transactions, idempotency, walks, freshness, transactional publish. (`packages/registry`, `packages/capability-kit`)
4. **Workflow runtime** — per-tenant event-conditioned DAGs; retries, dead-letter, version pinning, evidence-binding, procedure-admission bindings. (`packages/workflow`)
5. **Agent operational state** — `CurrentStateView`, `ObservationContract`, warn-first `ActionProposalReview`, `StateReviewArtifact` with hash replay, `ActionOutcomeEnvelope`, role projections, amnesiac recovery, external-evidence admission (evidence, never authority). (`packages/agent-state-core`, 97 pinned exports; the witness/quorum tower is quarantined in `packages/agent-state-provenance`, frozen, opt-in SQL via `PM_ENABLE_AGENT_STATE_PROVENANCE=1`)
6. **Procedure admission** — scripts/harness runs become operational only after authority-scoped admission and replay. (`packages/procedure-admission`, HTTP in `substrate-http`)
7. **Continuity** — hash-chained checkpoints; conclusions become queryable state. Powers the dev-session loop. (`packages/continuity`, `scripts/dev-session.ts`)
8. **Evals + lab** — paired baseline/substrate scenarios, measured metrics, live two-arm agent lab (real local LLM, oracle reads the admitted log). (`packages/evals`, `packages/local-agent-lab`, `packages/substrate-dashboard`)

**Ontology:** Tier 1 — seven universal primitives (`Counterparty, Engagement, Transaction, Resource, Communication, Document, Event` in `packages/types`). Tier 2 — profiles installed per tenant at runtime: `profile-pmgovernance` (PM methodology as governance: RACI single-accountability via `exactly:1` edge cardinality, stage-gate lifecycles, approval-gated advancement via `capability-pmgovernance-stage-gate`), `profile-agency`, `profile-finance-research`. Tier 3 — tenant customizations. The substrate names no profile; CI-enforced.

**Day-1 stack:** Postgres-only (core schemas + capability-private schemas), `LISTEN/NOTIFY` bus, one projection worker; each piece swaps under a stable contract when scale demands (`docs/adr/0001-day-1-stack.md`). Migrations two-tier: `db/migrations/` (core, default) and `db/migrations-provenance/` (tower, flag-gated). The full suite passes against a core-only database.

## Getting started

```bash
pnpm install
pnpm db:up
export PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate
pnpm db:migrate && pnpm db:seed && pnpm dev:seed-dogfood
pnpm build && pnpm typecheck && pnpm test
pnpm dev:resume        # ← the session briefing; start every session here
pnpm pm:memo -- --stdout  # technical + business-operability verdict ceiling
```

Environment knobs: `PM_DATABASE_URL` (unset ⇒ DB-gated tests skip), `PM_DEV_TENANT_ID` (`tenant_dev`), `PM_ENABLE_AGENT_STATE_PROVENANCE`, `PM_PLUGGED_IN_SOCIAL_DIR` (external app checkout; unset ⇒ conformance tests skip).

## CI gates (all must be green)

| Gate | Command |
|---|---|
| Typed capability contracts | `pnpm validate-contracts --strict` |
| Budgets, name-depth, provenance isolation, explicit core surface | `pnpm validate:budgets` |
| Anti-fixation / zero-edit plug-in rule | `pnpm validate:zero-edit` |
| Primitive back-map (recursion stop) | `pnpm validate:arrowsmith-primitives` |
| Amnesia headline number | `pnpm evals:amnesia` |

Current verification 2026-07-13: build + typecheck clean; **957 passed / 7 env-gated skips**, identical on freshly migrated core-only (26 migrations) and provenance-enabled (149 migrations) databases; strict contracts, budgets, zero-edit, and primitive back-map gates green. The original core/tower parity baseline is preserved in [`docs/state-validation/verification-baseline-2026-07-02.md`](./docs/state-validation/verification-baseline-2026-07-02.md).

## Repository layout

```
ROADMAP.md                   the plan (forward)          TASKS.md    human task index
CLAUDE.md                    session protocol            Changelog.md research/build ledger
refactor-plan.md             executed 2026-07-02
packages/                    runtime core · agent-state-core · quarantined tower ·
                             profiles · capabilities · entity-mapping · evals · lab · dashboard
db/migrations[-provenance]/  two-tier SQL                scripts/     migrate, seeds, gates, dev-session
docs/                        ADRs, validation, state-validation, history/ (superseded docs)
research/                    claim ledger + daily chains (proposes; only consumed code counts)
```

External testbeds (separate checkouts — **no app code in this repo**): PluggedInSocial (`../plugged_in_social`) and ArrowHedgeLabs (`../arrowhedgelab`, vanilla upstream + read-only integration endpoints). See `docs/validation.md` for T1–T8 and the 12 behavior metrics.

## License

Proprietary. JOATLABS.dev.
