# ADR-0022 — Entity-mapping ingestion adapter

## Status

Accepted — 2026-05-11. Closes G11 phase 3.

## Context

G11 phase 1 shipped `@pm/entity-mapping`'s declarative format + structural
validator. Phase 2a added profile-aware semantic validation. Phase 2b
added `fieldMap` aliases so real-app columns can resolve to profile
identity fields whose names differ.

What was still missing: the *bridge*. An app holding a `Lead` row from
its SQLAlchemy model still had to hand-translate that row into a
`CreateNodeInput` to write it through `@pm/graph`. The mapping document
described the translation; nothing executed it.

Phase 3 closes the gap: a single function that takes the parsed
`EntityMapping`, the source-row, and tenant context, and returns an
input the substrate accepts directly.

## Decision

Add a pure-function adapter inside `@pm/entity-mapping`:

```ts
applyMapping(mapping, sourceName, row, ctx)        → MappingNodeInput
applyEdgeMapping(mapping, sourceName, edgeKey, ids, ctx) → MappingEdgeInput
```

Key design choices:

1. **Structural typing across package boundaries, not a hard dep.**
   `@pm/entity-mapping` does not depend on `@pm/graph`. The adapter
   returns `MappingNodeInput` / `MappingEdgeInput` shapes that mirror
   `@pm/graph`'s `CreateNodeInput` / `CreateEdgeInput` field-for-field.
   Callers write `graph.createNode(applyMapping(...))` and TypeScript's
   structural typing closes the bridge. Rationale: avoids dragging `pg`
   and `@pm/profile-registry` into every consumer of `@pm/entity-mapping`
   just for type definitions. Adding a hard dep would also create an
   unnecessary circular pressure (graph → entity-mapping → graph).

2. **No re-validation per row.** The adapter does no profile-shape
   checks. Callers run `validateEntityMappingAgainstProfile` once at
   app startup or in CI; per-row validation is the substrate's job at
   write time. Anything else would burn CPU on the hot path.

3. **Identity-bag merge semantics.** `identityFields[]` entries are
   pulled from the source row under their declared (= source-app) names.
   `fieldMap` entries are pulled from the source-row column named by
   the *value* and stored under the *key* (the profile field name). The
   two sets must be disjoint per the validator; the merge is therefore
   unambiguous. **Missing source fields are dropped** (profile validator
   will reject if required). **Null source values pass through** —
   nullable identity fields are real in profile types and silent
   omission would be a contract violation.

4. **Caller-supplied ids forwarded verbatim.** `ctx.id` (if present) is
   placed on the resulting `MappingNodeInput.id`. Idempotency
   semantics belong to the graph package; the mapping adapter is shape
   translation, not deduplication.

5. **Edges carry `attrs: {}` by default.** Substrate profile edges
   typically have no attrs (cardinality and edge `type` already carry
   the semantics). Callers needing edge metadata pass `ctx.attrs`
   explicitly. Default `{}` matches the substrate's existing
   `CreateEdgeInput` contract.

6. **Programmer-error vs validation-error split.** Asking for a
   `sourceName` not in the mapping, or an `edgeKey` not declared on the
   entity, throws `EntityMappingApplyError`. These are call-site bugs,
   not data problems. Validation-style problems (shape errors in the
   mapping document) still surface through `validateEntityMapping*`.

## Verification

- `pnpm typecheck` — 19 packages, all green.
- `PM_DATABASE_URL=... pnpm test -- --run` — 33 files, 254 tests (was
  239). 11 new pure-function adapter tests + 4 DB-backed integration
  tests (profile-agency).
- Anti-fixation diff `main...feat/g11-phase3-apply-mapping --
  packages/{types,graph,events,registry,workflow,projections,
  profile-registry,capability-audit,substrate-http,substrate-http-demo}
  db/migrations/0001*..0012*.sql` — no substrate package edits.

## Consequences

- Apps can now do `await graph.createNode(applyMapping(mapping, "Lead", row, ctx))`
  with zero hand-rolled translation. That's the smallest piece of work
  needed to start substrate-ingesting a real app (e.g. Stevie /
  PluggedInSocial) once Emmanuel decides to.

- TS codegen (per-entity strongly-typed row→input wrappers) is still
  deferred to phase 4 — `applyMapping` is enough to ship without it,
  and the codegen API benefits from being shaped by real ingestion
  usage rather than designed up front.

- The adapter is the natural extension point for upcoming features
  like upsert semantics or attrs-bearing edges; both can be added
  without breaking the v1 signature.
