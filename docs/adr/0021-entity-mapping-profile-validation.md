# ADR-0021 — Profile-aware entity-mapping validation

**Status:** Accepted (2026-05-10)
**Closes:** G11 phase 2a (semantic validation against a `ProfileDefinition`).
**Defers:** G11 phase 2b/2c (ingestion adapter + TS codegen).

## Context

ADR-0020 introduced `@pm/entity-mapping`: a declarative format and structural validator for app → substrate mappings.

Structural validation catches malformed documents, but it cannot answer the important adoption question:

> "Will this mapping actually resolve against the profile I intend to run?"

That question must be answered before any graph write happens. Otherwise app teams discover integration mistakes at runtime: wrong concrete name, wrong Tier-1 binding, missing profile-required identity field, typoed edge type, or cardinality drift between the mapping document and the profile catalog.

## Decision

Add `validateEntityMappingAgainstProfile(input, profile): ValidationResult` to `@pm/entity-mapping`.

The function is pure and zero-DB. A caller can load a `ProfileDefinition` from a package (or from the registry) and validate the parsed mapping at startup or CI time.

It first runs `validateEntityMapping(input)`. If structural validation fails, it returns those structural issues and does not cascade semantic noise.

If structural validation passes, it checks:

- Mapping `profile` is not `null` and equals `profile.name`.
- Every mapped concrete entity exists in `profile.entityTypes`.
- Mapping `tier1` equals the profile entity definition's `tier1`.
- Mapping `schemaVersion` equals the profile entity definition's `schemaVersion`.
- Mapping `identityFields` covers every profile-required identity field.
- Every edge `type` is prefixed with `${profile.name}/`.
- Every edge local name exists in `profile.edgeTypes`.
- Edge source concrete is allowed by `EdgeTypeDef.fromTypes`.
- Edge target concrete is allowed by `EdgeTypeDef.toTypes`.
- Mapping edge cardinality equals the profile's outgoing `fromCardinality` converted into mapping cardinality.

Cardinality conversion:

| Profile `CardinalityConstraint` | Mapping `EdgeCardinality` |
| --- | --- |
| `unbounded` | `many` |
| `exactly:1` | `exactly_one` |
| `exactly:2` | `exactly_two` |
| `at-most:1` | `zero_or_one` |
| `at-least:1` | `one_or_more` |

Unsupported numeric constraints (e.g. `at-most:3`) throw from `toEdgeCardinality`. Mapping v1 intentionally has only the five cardinalities already used by current profiles; unsupported constraints should be made explicit in a future mapping-version bump, not silently approximated.

## Consequences

- `@pm/entity-mapping` now has both structural and semantic validators.
- No DB dependency was introduced.
- No graph/registry dependency was introduced; the semantic validator depends only on `@pm/types`'s `ProfileDefinition` shape.
- 13 new tests exercise happy-path wedding mapping plus semantic failures for profile mismatch, raw Tier-1 mapping, undeclared concrete types, Tier-1 mismatch, schemaVersion mismatch, missing required identity fields, edge prefix mismatch, undeclared edge type, endpoint mismatch, cardinality mismatch, and cardinality conversion.
- Test count: 224 → 237.

## Deferred

Still deferred until a real app forces the affordances:

1. **Ingestion adapter** — `applyMapping(mapping, row, opts): CreateNodeInput`.
2. **TS codegen** — emit typed identity-bag contracts from the mapping so apps get compile-time feedback on mapped fields.

The next useful validation target is Stevie / PluggedInSocial: write its agency mapping, validate against `@pm/profile-agency`, and let that surface what the adapter/codegen need to support.
