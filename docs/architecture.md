# Architecture

## Thesis

Workspace tools are mature. The missing layer is the one that arbitrates *interactions between tools* — a Project Manager layer, by analogy to a human PM arbitrating between specialists who each speak their own language.

This substrate is that layer.

## The four-layer model

### Layer 1 — Entity graph

**Nodes hold identity and stable attributes only.** Everything contextual rides on *typed edges*.

```
Customer →[has_invoice]→ Invoice
Customer →[has_interaction]→ Interaction
Customer →[employs]→ Person
```

Tools query the edges they care about, not the whole node. This is the difference between a document store and a graph; we want the graph.

**Why:** the "fat node" failure mode — every tool writing to the same `Customer` node grows it unbounded; reads pull data tools don't need; writes contend on the same row. Identity-only nodes + typed edges side-step this entirely.

### Layer 2 — Event log

**Append-only.** Topic-scoped streams partitioned by tenant + entity type. Tools subscribe declaratively to `(event type × tenant scope)`.

Two payoffs the naive design doesn't have:

- **Decoupling.** A new tool subscribes to existing events without coordinating with anyone.
- **Time-travel queries.** "What did this customer's record look like 90 days ago?" is free.

Built right from day one — not bolted on after the fact (which is what kills audit at most companies that try to add it later).

**Why topic-scoped:** the "everyone subscribes to everything" failure mode — global event log → every event wakes N handlers → thundering herd. Topic-scoped streams + declarative subscriptions mean the router only fans out to interested subscribers.

### Layer 3 — Capability registry

Tools register themselves as **capability providers** against the graph. Each tool declares:

- Nodes / edges it reads
- Events it produces
- Permissions it requires

A `send-invoice` tool: *reads `Customer` and `Invoice`; produces `EmailSent` and `PaymentRequest`.*
A `schedule-meeting` tool: *reads `Person` and `Calendar`; produces `MeetingScheduled`.*

A new tool isn't *integrated* with existing tools — it's plugged into the same substrate, declaring inputs and outputs, and the substrate handles routing.

**This is what makes "integration" stop existing as a concept.**

### Layer 4 — Workflow runtime

Business processes are **expressed, not coded**.

> When a customer signs a contract → create a project → assign it to the relevant team → schedule a kickoff → send a welcome email → set up billing.

A graph of capability invocations conditioned on events. Per-tenant configuration. No fixed workflow ships.

## The layered ontology (the part that resolves "pick a vertical or stay generic")

### Tier 1 — Universal primitives (this repo)

The seven types covering ~90% of B2B operations. Defined once, identical across all tenants and industries.

- `Counterparty` — customer / client / patient / guest / vendor / partner
- `Engagement` — project / case / deal / event / matter / job / ticket
- `Transaction` — invoice / payment / contract / order / claim
- `Resource` — person / asset / room / equipment
- `Communication` — email / call / message / note
- `Document` — any file produced or referenced
- `Event` — something happened at a time, immutable

### Tier 2 — Industry profiles (separate packages)

Opinionated extensions that encode industry-specific constraints, vocabulary, and relationship rules.

- **Wedding profile** specializes `Engagement → Wedding` (with `event_date`, `venue`, `couple_ids[2]`, `guest_count` constraints), `Counterparty → Couple/Guest/Vendor`.
- **Legal profile** specializes `Engagement → Matter` (with `practice_area`, `conflict_check_status`, `statute_of_limitations`), `Counterparty → Client/Opposing Party`.
- **Healthcare profile** specializes `Counterparty → Patient` with HIPAA flags.

Profiles are **libraries**, not hardcoded modules. A tenant picks one (or composes several — a law firm doing real estate gets both).

### Tier 3 — Tenant customizations

The specific business's own fields, custom entities, workflow tweaks. Salesforce calls these "custom objects."

### Why this beats both naive approaches

- **"One generic schema for everyone"** fails: industry-specific constraints leak into app logic (now your "interoperable substrate" has hidden coupling) or get ignored (now your platform is a worse Notion).
- **"One vertical at a time"** fails: you build the same primitives 5 times and your tools don't transfer.
- **Layered ontology**: the substrate stays universal; domain logic lives in profiles; tools written against Tier 1 work everywhere; tenants customize at Tier 3 without forking.

This is also how Schema.org evolved (`Thing → Place → LocalBusiness → Restaurant`) and how FHIR works in healthcare (`Resource → Patient/Observation/Encounter`).

## Where this pattern usually dies — and how we avoid each

### 1. Schema governance

If every tenant defines their own entities, tools can't bind to a concrete `Customer` type.

**Solution:** tools bind to **declared interfaces**, not concrete tenant types. *"This tool needs an entity with `email`, `name`, `created_at`."* Schema.org / linked-data style.

### 2. The migration cliff

Businesses already have data in Salesforce, QuickBooks, Notion. Import = ETL nightmare; sync = CDC + conflict-resolution + eventual-consistency hell.

**Solution (Phase 2+):** the wedding-app integration is *exactly* the migration story — we sit alongside MongoDB and project events into the substrate via CDC. Proves the pattern without forcing a single business to migrate.

### 3. The first-tool problem

A workspace with one tool is just a worse version of that tool. People compare your single tool to the best-in-class point solution and you lose.

**Solution:** the WeddingWebApp Phase 2/3 plan refactors three subsystems (planner-task, gcal-projection, vendor-milestone) into capability providers, then adds a fourth (budget-tracker or RSVP-reminder) without touching the first three. **Three composing tools on day one of the demo.**

### 4. Performance

A generic substrate is queried unpredictably (Epic gets away with hierarchical/M because read patterns are well-known: one patient, mostly reads). Five concrete failure modes:

- **Fat node** — addressed by Layer 1 design.
- **Everyone subscribes to everything** — addressed by Layer 2 topic scoping.
- **Schema-flexibility tax** — Tier 3 customizations as JSONB blob → full-table scans. **Solution: hot fields in typed columns; custom fields in JSONB with on-demand expression indexes (per-tenant + per-field partial indexes).**
- **Cross-tenant query** — naive 4-hop traversal across 1M nodes is seconds. **Solution: CQRS. Graph = source of truth; analytics = materialized views projected from the event stream.**
- **Audit-log-as-firehose** — at 1M events/day/tenant, audit infra becomes the most expensive component. **Solution: tier the storage. Hot (last 30 days) = queryable; cold = S3 + Parquet or ClickHouse; aggregated rollups for compliance.**

## Day-1 stack

- **PostgreSQL.** All five schemas. JSONB for flex fields, `ltree` / recursive CTEs for hierarchy, partial indexes for tenant custom fields.
- **`LISTEN/NOTIFY`.** Event bus. Migrate to Kafka or Redpanda when sustained throughput crosses ~10k events/sec.
- **Postgres FTS.** Search. Migrate to OpenSearch / Meilisearch when row count + query patterns demand it.
- **Single projection-worker process.** Will eventually become a fleet, but the contract is what matters now.

The cost of doing it right at day one is *discipline*, not infrastructure:

- Emit events for every mutation, even if there's no consumer yet.
- Build read models even when there's only one.
- Partition by tenant from commit one — even at one tenant.

## Day-365 migration plan

Each is a swap behind a stable interface, not a rewrite:

- Move event bus → Kafka when `LISTEN/NOTIFY` chokes.
- Move search → OpenSearch when FTS slows.
- Add ClickHouse when analytics queries hit Postgres limits.
- Add read replicas when the primary saturates on reads.

That's what the architecture buys you.
