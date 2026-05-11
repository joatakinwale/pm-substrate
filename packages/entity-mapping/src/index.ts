/**
 * @pm/entity-mapping — declarative entity-mapping format.
 *
 * Phase 1 surface: types + structural validator. An app ships a JSON
 * (or YAML, parsed by the caller) document describing how its existing
 * entities map onto Tier-1 primitives + a profile. The substrate
 * structurally validates the mapping with `validateEntityMapping`.
 *
 * Phase 2 surface:
 *   - Profile-aware semantic validation (entity concrete types + edge
 *     types resolve against a `ProfileDefinition`).
 *
 * Phase 3 surface:
 *   - Ingestion adapter — `applyMapping(mapping, sourceName, row, ctx)`
 *     produces a node input directly assignable to `Graph.createNode`.
 *   - Edge adapter — `applyEdgeMapping(mapping, sourceName, edgeKey,
 *     ids, ctx)` produces an edge input directly assignable to
 *     `Graph.createEdge`.
 *
 * Still deferred:
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

export {
  validateEntityMappingAgainstProfile,
  toEdgeCardinality,
} from "./semantic.js";

export {
  applyMapping,
  applyEdgeMapping,
  EntityMappingApplyError,
  type MappingNodeInput,
  type MappingEdgeInput,
} from "./apply.js";
