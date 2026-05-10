/**
 * @pm/entity-mapping — declarative entity-mapping format.
 *
 * Phase 1 surface: types + structural validator. An app ships a JSON
 * (or YAML, parsed by the caller) document describing how its existing
 * entities map onto Tier-1 primitives + a profile. The substrate
 * structurally validates the mapping with `validateEntityMapping`.
 *
 * Phase 2 (deferred):
 *   - Profile-aware semantic validation (entity concrete types + edge
 *     types resolve against an installed `ProfileDefinition`).
 *   - Ingestion adapter — `applyMapping(mapping, row)` produces a
 *     `CreateNodeInput` directly callable on `Graph.createNode`.
 *   - TS codegen — emit per-entity types so the app gets compile-time
 *     safety on its mapped fields.
 *
 * Why ship phase 1 alone:
 *   The hardest part of a declarative format is the format itself. Get
 *   the shape right, get callers writing it, then add the heavy lifting
 *   (semantic check + ingestion) once a real app is using the format
 *   so the affordances are pulled, not pushed.
 */

export type {
  EntityMapping,
  EntityMappingEntry,
  EdgeMappingEntry,
  EdgeCardinality,
  FieldName,
  ConcreteTypeName,
} from "./schema.js";

export {
  validateEntityMapping,
  asEntityMapping,
  type ValidationResult,
  type ValidationIssue,
} from "./validate.js";
