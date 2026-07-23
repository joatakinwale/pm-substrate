# ADR-0003: Tier-1 entity primitives — the seven types

**Status:** Accepted (2026-05-01)

## Context

The substrate must be useful across industries (wedding, legal, healthcare, agency, ...) without inheriting industry-specific assumptions. The naive paths fail:

- "One generic schema for everyone" → industry constraints leak into app code OR get ignored. Worse Notion.
- "One vertical at a time" → primitives rebuilt 5×; tools don't transfer.

Layered ontology resolves this: universal Tier-1 primitives, opinionated Tier-2 industry profiles, Tier-3 tenant customizations.

## Decision

The Tier-1 layer defines exactly **seven primitive entity interfaces**. They cover ~90% of B2B operations in any industry. Naming is industry-specific; *shape* is universal.

1. **`Counterparty`** — an external entity we have a relationship with. Specializes to: customer, client, patient, guest, vendor, partner.
2. **`Engagement`** — a unit of work scoped in time. Specializes to: project, case, deal, event, matter, job, ticket.
3. **`Transaction`** — exchange of value. Specializes to: invoice, payment, contract, order, claim.
4. **`Resource`** — something allocated to engagements. Specializes to: person, asset, room, equipment.
5. **`Communication`** — a recorded interaction. Specializes to: email, call, message, note.
6. **`Document`** — any file produced or referenced.
7. **`Event`** — something happened at a time, immutable.

These are *interfaces*, not concrete tables. Profiles specialize them; tenants customize them.

## Why exactly seven

This is the natural shape that emerges from observing CRMs, ERPs, project trackers, billing systems, support platforms, and event managers across industries. Salesforce's Customer 360 is essentially `Counterparty + Engagement + Transaction`. FHIR's clinical resources reduce to specializations of these same primitives. Schema.org's top-level types collapse onto a similar core.

Add an eighth and you're starting to encode industry assumptions. Drop one and you push business logic up into the application layer (which is exactly the problem we're trying to solve).

## Important: primitives are universal — *constraints* between them are not

This is the half of the layered-ontology insight that matters most:

- **`Engagement → Counterparty` cardinality differs.** A wedding (Engagement) needs *exactly two* principals. A law-firm matter with two clients is a conflict-of-interest crisis. A consulting project with multiple clients is procurement weirdness. Flatten to `engagement.counterparties: list` and you've lost the rules that make each domain coherent.
- **Transaction lifecycles diverge.** SaaS invoice (`draft → sent → paid → reconciled`) vs insurance claim (`filed → triaged → adjudicated → paid → reopened`) vs real estate (`offer → counter → accepted → contingencies → closing → recorded`).
- **Document semantics vary.** HIPAA constraints on healthcare docs vs marketing PDFs; contracts need versioning + redlining + signature attestation.
- **Identity primacy differs.** Healthcare = patient spine; manufacturing = SKU; agencies = project; SaaS = account/subscription. Every business has a spine; pick the wrong one and your indexes / permissions / access patterns are wrong everywhere.

Tier-1 is the *primitive*. Tier-2 profiles encode the cardinality, lifecycle, document semantics, and identity primacy for a specific industry. **The substrate doesn't decide for the profile.**

## Consequences

**Positive:**

- A capability provider written against `@pm/types` interfaces works across every profile that implements those interfaces.
- New industries cost a profile, not a rebuild.
- The substrate code never grows when we add a new industry.

**Negative — accepted:**

- Tier-1 contracts need to be *carefully* designed to allow profile extension without forcing every profile to handle every concern. We solve this with declared interfaces (`@pm/types`) and structural compatibility, not nominal subtyping.
- We will discover, over time, that certain "obvious" Tier-1 fields are actually profile-specific. We will move them. That's expected and fine.

## Alternatives considered

- **More primitives (e.g., 12+).** Rejected: each additional primitive risks encoding industry-specific assumptions. Seven is the lower bound that covers the universal shape.
- **Fewer primitives (e.g., just `Entity` + `Relation` + `Event`).** Rejected: too generic; pushes the actual modeling work into every profile.
- **Schema.org as the Tier-1 layer.** Rejected as a direct dependency: too much surface area, much of it irrelevant. We borrow the *evolutionary pattern* (Thing → Place → LocalBusiness → Restaurant) without inheriting the catalog.
