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

**The immediate objective (see ROADMAP):** prove—or falsify—the substrate's causal benefit on pinned public tasks that are already known to expose agent-state failure. Official benchmark task completion is the outcome; native and equal-overhead sham arms are the controls; internal events, blocks, and receipts are mechanism diagnostics only. PluggedInSocial and ArrowHedge are frozen until the public claim passes held-out evaluation, anti-degenerate controls, clean artifact verification, and replication. The executable protocol is [`docs/objective-falsification.md`](./docs/objective-falsification.md).

**Current public-proof status (2026-07-14):** causal benefit remains unproven.
An adversarial audit rejected the first Sentinel 27-cell design before any
headline execution: useful state lived in a task-specific adapter `Map`, all
arms used the same core only for evidence admission, the native arm was an
independent discard control rather than Microsoft's unpublished paper agent,
speed factor 4 made the positive MicroHub trajectories unreachable, and the
upstream no-op oracle rewards an agent that exits without monitoring. That
matrix is excluded from efficacy use. The replacement uses the published
speed-1 horizon, one task-agnostic browser agent, and identical native, sham,
plain-KV, and production-continuity interfaces. MicroHub is qualification-only;
a frozen 12-task cross-application set is procedural holdout validation, not a
powered confirmatory result. The untouched 50-task catalog is content-frozen,
but its proposed 19-relative-task × 3-repeat power declaration was also
falsified before execution: under its declared independent-binomial planning
model, the necessary two-control 10-point-lift gate reaches at most 0.5112,
before the stricter Holm, bootstrap, or clean-control gates. No replacement
benchmark cell has yet established benefit. D7 remains `not_eligible` pending
an honestly powered task-clustered confirmation, external trust, replication,
and a separate owner decision. See the
exact run results and blockers in
[`docs/public-benchmark-status-2026-07-13.md`](./docs/public-benchmark-status-2026-07-13.md).

## The product shape (decided 2026-07-02)

A **sidecar**, not a platform: Docker + Postgres running next to the system it governs. The adopting system is **never rewritten** — it authors a thin integration kit: `mapping.yaml` (its tables → the seven primitives), a sync adapter (webhook/poll/CDC, state flows in read-only), and an action executor (admitted actions flow back through the app's *existing* API). Agents mount five MCP tools — `resume`, `observe`, `propose`, `admit`, `checkpoint` — so any Claude/GPT/local agent integrates with a config line. Adoption is shadow-first: observe and warn, report what *would* have been blocked, then gate one action type at a time.

Kernel: TypeScript (the type system is load-bearing — cardinality, freshness, and contract rules are compile-time-unrepresentable-when-illegal). Edges: protocol (HTTP/MCP/SQL), any language; public benchmark adapters and any future Python client remain peripheral.

## The control plane

Five questions, answered only from the admitted log — never from self-report:

| Question | Where |
|---|---|
| What is being done? | open `work` checkpoints + last `handoff` (`pnpm dev:status`) |
| What did governance do? | admitted events by type, stage-gate applications, procedure admissions, blocks |
| What did it cost? | `dev.session.cost` events (tokens per session/agent/model) |
| What are the results? | independent public-benchmark task outcomes when available (currently none), reliability, collateral-state guardrails, and cost/latency; local evals are labeled conformance diagnostics |
| What got optimized? | closed work items + superseding decisions in the ledger |

v0 is the `dev:status` CLI; the D4 dashboard control-plane page is shipped.
Benchmark receipts are independently verifiable only when their adapter retains
the exact raw/provider/oracle bytes and external trust evidence required by the
public gate; current ToolSandbox and STATE-Bench artifacts deliberately do not
qualify. Admitting any receipt does not turn the substrate log into its own
oracle.

The D7 gate additionally requires one canonical, versioned semantic
observation per check. It reopens the bytes, enforces the exact
kind/check/subject/procedure and fact schema, and recomputes the check result;
opaque bytes and signer-supplied result shortcuts reject. The external verifier
is still accountable for deriving those facts from the real benchmark records.
Because the current generic procedures do not derive them from the bound raw
records, D7 report v4 classifies every such structured assertion as diagnostic
only and always returns `not_eligible`.

## Architecture (reference)

1. **Entity graph** — identity-only nodes, typed edges, profile-validated writes, optimistic concurrency, freshness gates. (`packages/graph`)
2. **Event log** — append-only, tenant-partitioned, hash-chained, `LISTEN/NOTIFY` bus. (`packages/events`)
3. **Capability registry + kit** — typed read/write/emit/subscribe contracts; isolation CI-enforced; the kit owns transactions, idempotency, walks, freshness, transactional publish. (`packages/registry`, `packages/capability-kit`)
4. **Workflow runtime** — per-tenant event-conditioned DAGs; retries, dead-letter, version pinning, evidence-binding, procedure-admission bindings. (`packages/workflow`)
5. **Agent operational state** — `CurrentStateView`, `ObservationContract`, warn-first `ActionProposalReview`, `StateReviewArtifact` with hash replay, `ActionOutcomeEnvelope`, role projections, amnesiac recovery, external-evidence admission (evidence, never authority). (`packages/agent-state-core`, 97 pinned exports; the witness/quorum tower is quarantined in `packages/agent-state-provenance`, frozen, opt-in SQL via `PM_ENABLE_AGENT_STATE_PROVENANCE=1`)
6. **Procedure admission** — scripts/harness runs become operational only after authority-scoped admission and replay. (`packages/procedure-admission`, HTTP in `substrate-http`)
7. **Continuity** — hash-chained checkpoints; conclusions become queryable state. Powers the dev-session loop. (`packages/continuity`, `scripts/dev-session.ts`)
8. **Evals + validation** — local paired scenarios diagnose mechanism conformance and cannot establish efficacy; peripheral public adapters preserve upstream tasks/oracles and compare native, sham, and substrate arms. (`packages/evals`, `packages/local-agent-lab`, public-eval packages, `packages/substrate-dashboard`)

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
pnpm pm:boundary -- --app <id> --app-dir <checkout> --out <artifact.json> \
  --check 'contract::your-existing-conformance-command'
pnpm public-eval:toolsandbox manifest
pnpm public-eval:state-bench manifest
pnpm public-eval:corners list
pnpm public-eval:decide path/to/decision-bundle.json \
  path/to/trust-policy.json "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256"
pnpm pm:memo -- --stdout  # never authorizes KEEP; owner authorization is separate
```

Environment knobs: `PM_DATABASE_URL` (unset ⇒ DB-gated tests skip), `PM_DEV_TENANT_ID` (`tenant_dev`), `PM_ENABLE_AGENT_STATE_PROVENANCE`, `PM_PLUGGED_IN_SOCIAL_DIR` (external app checkout; unset ⇒ conformance tests skip).

## CI gates (all must be green)

| Gate | Command |
|---|---|
| Typed capability contracts | `pnpm validate-contracts --strict` |
| Budgets, name-depth, provenance isolation, explicit core surface | `pnpm validate:budgets` |
| Anti-fixation / zero-edit plug-in rule | `pnpm validate:zero-edit` |
| Primitive back-map (recursion stop) | `pnpm validate:arrowsmith-primitives` |
| Amnesia mechanism diagnostic | `pnpm evals:amnesia` |

Baseline before the public-proof reset (2026-07-13): build + typecheck clean; **967 passed / 7 external-app skips** in the default suite; strict contracts, budgets, zero-edit, and primitive back-map gates green. This proves repository conformance, not public-task benefit. The original core/tower parity baseline is preserved in [`docs/state-validation/verification-baseline-2026-07-02.md`](./docs/state-validation/verification-baseline-2026-07-02.md); new benchmark evidence must carry its own pinned manifest and independently verifiable receipt.

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

Deferred transfer testbeds (separate checkouts; frozen during D6/D7 and **no app code in this repo**): PluggedInSocial (`../plugged_in_social`) and ArrowHedgeLabs (`../arrowhedgelab`). See [`docs/validation.md`](./docs/validation.md) for the public-proof order, local conformance status, and deferred business-transfer criteria.

## License

Proprietary. JOATLABS.dev.
