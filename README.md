# pm-substrate

**The PM-layer Tier-1 substrate.** Universal entity graph + event log + capability registry + per-tenant workflow runtime.

A JOATLABS.dev primitive. The shared base every business platform built on top of it inherits.

---

## What this is

A workspace's project-manager layer — the missing layer that arbitrates *interactions between tools* the way a human PM arbitrates between specialists. Components are mature; **interoperability is the bottleneck**. This is the substrate that makes the toolset coherent.

This is the **Tier-1 substrate**: the universal primitives, identical across tenants and industries. Tier-2 industry profiles (wedding, legal, healthcare, agency) ship as **separate packages** that consume this substrate.

## Architecture (4 layers)

1. **Entity graph** — identity + stable attrs only on nodes; everything contextual on typed edges. Per-tenant declared. (`packages/graph`)
2. **Event log** — append-only, topic-scoped (tenant + entity type), declarative subscriptions. Decoupling + time-travel queries free. (`packages/events`)
3. **Capability registry** — tools register as capability providers (reads, writes, emits, requires_perms). "Integration" stops existing as a concept. (`packages/registry`)
4. **Workflow runtime** — per-tenant graph of capability invocations conditioned on events. Processes expressed, not coded. (`packages/workflow`)

## The seven Tier-1 entity primitives (`packages/types`)

Cover ~90% of B2B operations. Defined once, identical across all tenants.

- `Counterparty` — customer / client / patient / guest / vendor / partner
- `Engagement` — project / case / deal / event / matter / job / ticket
- `Transaction` — invoice / payment / contract / order / claim
- `Resource` — person / asset / room / equipment
- `Communication` — email / call / message / note
- `Document` — any file produced or referenced
- `Event` — something happened at a time, immutable

Industry profiles (Tier 2) specialize these. Tenant customizations (Tier 3) extend the profile.

## Day-1 stack (deliberate)

- **Postgres-only.** Five schemas: `graph`, `events`, `projections`, `registry`, `workflow`.
- **`LISTEN/NOTIFY` as event bus.** No Kafka, no NATS, no Redis. Yet.
- **One projection-worker process.** Build the contract, scale it later.
- **Postgres FTS** for any search needs.

The discipline is in the *interfaces*, not the infrastructure. Each piece swaps under a stable contract when scale demands it. See [`docs/adr/0001-day-1-stack.md`](./docs/adr/0001-day-1-stack.md).

## Repo layout

```
pm-substrate/
├── packages/
│   ├── types/         # Tier-1 entity-interface contracts
│   ├── graph/         # Entity graph API + Postgres adapter
│   ├── events/        # Append-only log + LISTEN/NOTIFY publisher/subscriber
│   ├── registry/      # Capability registry
│   ├── workflow/      # Per-tenant workflow runtime
│   └── projections/   # Read-model projection workers
├── scripts/
│   ├── migrate.ts     # Apply DB migrations
│   └── seed.ts        # Seed dev tenant
├── db/
│   └── migrations/    # SQL migrations (schema-per-concern)
├── docs/
│   ├── architecture.md
│   └── adr/           # Architecture Decision Records
├── docker-compose.yml # Postgres + pgweb for local dev
└── tsconfig.base.json
```

## Getting started

```bash
# Install
pnpm install

# Bring up Postgres
pnpm db:up

# Apply migrations + seed dev tenant
pnpm db:migrate
pnpm db:seed

# Build everything
pnpm build

# Type-check
pnpm typecheck

# Test
pnpm test

# Reset everything (drops pgdata)
pnpm db:reset
```

## Status

**Phase 0 — substrate.** Active. See `docs/roadmap.md` for the full Phase 0–4 plan.

| Phase | Deliverable |
|---|---|
| 0 | This repo. Tier-1 substrate skeleton + Postgres + interface contracts. |
| 1 | Wedding Tier-2 profile package (specializations + identity primacy + lifecycles). |
| 2 | Refactor 3 WeddingWebApp subsystems as capability providers. |
| 3 | Add a 4th provider with zero coordination. **The demo moment.** |
| 4 | Second profile (legal / agency) without touching the substrate. **Architecture proven.** |

## License

Proprietary. JOATLABS.dev.
