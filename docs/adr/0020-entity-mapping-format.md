# ADR-0020 — Declarative entity-mapping format (`@pm/entity-mapping`)

**Status:** Accepted (2026-05-10)
**Closes:** G11 phase 1 (entity-mapping format definition).
**Defers:** G11 phase 2 (profile-aware semantic validation, ingestion adapter, TS codegen).

## Context

Pre-G11, an app that wanted to plug into the substrate had to:

1. Hand-write an ADR mapping each of its existing entities (SQLAlchemy / Prisma / etc.) to a Tier-1 primitive.
2. Hand-write the corresponding `ProfileBinding` and identity-bag composition in app code on every write site.
3. Hope the mapping stays consistent as the app and the profile both evolve.

For Stevie alone — 23 SQLAlchemy models — that's ~23 ADR entries plus N call sites. The mapping is structurally regular (an entity maps to one Tier-1 type, one concrete type, an identity-fields list, and zero or more edges), so the regularity should live in a declarative document, not in repeated hand-written code.

This is the next ergonomics gap after G10 (capability authoring kit). G10 made *writing capabilities* cheap; G11 makes *describing your data* cheap.

## Decision

Ship `@pm/entity-mapping` (phase 1) with two concrete things:

1. **TypeScript types** for the mapping schema (`EntityMapping`, `EntityMappingEntry`, `EdgeMappingEntry`, `EdgeCardinality`, `Tier1TypeName` re-exported via `@pm/types`). The same shape can be written as JSON or YAML and parsed into these types — the validator works on already-parsed input.

2. **A structural validator**: `validateEntityMapping(input: unknown): ValidationResult`. No profile lookups; just checks the shape.

What it validates today:
- `mappingVersion === 1`
- `profile` is `string | null` (null = raw Tier-1)
- `entities` is a non-empty record
- For each entity:
  - `tier1 ∈ Tier1TypeName`
  - `concrete` is non-empty and equals the map key
  - `schemaVersion` is a positive integer
  - `identityFields` is a non-empty `string[]` with no duplicates
  - `optionalFields`, if present, is a `string[]` disjoint from `identityFields`
  - `edges`, if present, each:
    - `target` references another concrete type *in the same mapping*
    - `type` matches `<profile>/<snake_case>` regex
    - `cardinality` is one of the five `EdgeCardinality` values

The validator collects every issue in one pass (it does not short-circuit) so a CI or operator-dashboard caller can show all problems at once.

## Why phase 1 is just the format

- **The hardest part of a declarative format is the format itself.** Get the shape right *before* the substrate starts consuming it for ingestion or codegen. A bad shape compounds across every consumer.
- **Phase 2 needs a real app to push the affordances.** Stevie or joatlabs.dev will surface "I needed X but the mapping couldn't express it" findings that would be guesswork without a real consumer.
- **Phase 1 is independently useful.** Even without the substrate consuming it, an app team can write the YAML, run it through the validator in CI, and use the structural check as the canonical truth-source for "what does this app's data shape look like?"

## What this ADR explicitly does NOT do

- **No profile resolution.** The validator does not check `concrete` against an installed `ProfileDefinition` — that's the phase-2 semantic pass. Phase 1 is shape-only; phase 2 will accept a `ProfileDefinition` parameter and add semantic checks (e.g., "the agency profile doesn't declare `concrete: Lead`"; "`agency/lead_assigned_to_user` isn't a registered edge type").
- **No ingestion adapter.** `applyMapping(mapping, row) → CreateNodeInput` is phase 2. Today the app would still call `graph.createNode` itself; the mapping is just the *spec* that says "here's what to pass."
- **No TS codegen.** Generating per-entity TypeScript types from the mapping (so the app gets compile-time safety on its identity-bag fields) is phase 2.
- **No YAML loader.** The validator takes already-parsed input. Apps using YAML use any YAML library they prefer; the substrate doesn't pin one.

## Consequences

- **New package: `packages/entity-mapping/`**, registered in root `tsconfig.json`. Workspace dep on `@pm/types` only — zero runtime coupling to graph/events/registry/workflow.
- **17 new unit tests** (no DB needed): valid golden-fixture acceptance, plus targeted rejection cases for every checked invariant. Validator never short-circuits on user data; never throws on user data; only throws on programmer error (input not even an object).
- **Test count:** 207 → 224.
- **Anti-fixation diff vs substrate-owned non-test code is non-empty by construction** — this PR adds a substrate package. Same precedent as `capability-audit` (ADR-0009) and `capability-kit` (ADR-0019): substrate-side packages that the substrate provides to apps and capability authors are substrate work, not app/capability work.

## Phase 2 plan (deferred)

Three follow-ups, in order:

1. **Semantic validator.** `validateEntityMappingAgainstProfile(mapping, profileDef): ValidationResult`. Cross-checks every concrete type and edge type against the profile's `entityTypes` and `edgeTypes` registries. Plus enforces edge cardinality consistency between the mapping and the profile.
2. **Ingestion adapter.** `applyMapping(mapping, row, opts): CreateNodeInput`. Maps an arbitrary key-value row (with `identity` extracted via the declared `identityFields`) to a `CreateNodeInput` directly callable on `Graph.createNode`. Optional `idGenerator` so the caller can pass a deterministic id derived from a source primary key.
3. **TS codegen.** From the mapping, emit a `.d.ts` (or `.ts`) describing the typed identity-bag per concrete type. Apps then `import { Lead } from "./generated"` and get compile-time safety on which fields are required vs optional.

Phase 2 work should land *after* a real app starts using the format. Until then, phase 1 stands alone.
