/**
 * Entity-mapping schema. The TS types here are the canonical shape; an
 * app can equivalently write a YAML or JSON file and parse it into an
 * `EntityMapping` (the validator below checks the shape regardless of
 * how the file was parsed).
 */

import type { Tier1TypeName } from "@pm/types";

/** App-side concrete entity name. App-arbitrary; substrate just checks the shape. */
export type ConcreteTypeName = string;

/** App-side field name on the source entity (DB column, ORM attr, etc.). */
export type FieldName = string;

/** Edge cardinality the substrate enforces at write time (mirrors profile.EdgeTypeDef). */
export type EdgeCardinality =
  | "zero_or_one"
  | "one_or_more"
  | "many"
  | "exactly_one"
  | "exactly_two";

/**
 * Edge mapping. Declares how a relationship (e.g. SQLAlchemy
 * `relationship(...)` or a foreign key) projects onto a substrate edge.
 */
export interface EdgeMappingEntry {
  /**
   * Concrete-type name of the entity this edge points at. Must appear
   * as a key under `entities` in the same mapping document.
   */
  readonly target: ConcreteTypeName;

  /**
   * Substrate edge type. Convention: "<profile>/<verb>" or
   * "<profile>/<verb>_<noun>". Profiles must declare this edge type in
   * their `edgeTypes` registry so cardinality is enforced at write time.
   */
  readonly type: string;

  /** Cardinality the substrate enforces. Must match the profile declaration. */
  readonly cardinality: EdgeCardinality;

  /**
   * Optional source-side reference. For a SQLAlchemy mapping, typically
   * the relationship attribute name; for a Prisma mapping, the relation
   * field name. The substrate doesn't read this — it's metadata for
   * codegen and ingestion in phase 2. Free-form string.
   */
  readonly sourceRef?: string;

  /** Optional one-line documentation for operator dashboards. */
  readonly description?: string;
}

/**
 * Entity mapping. Declares how one app-side concrete entity projects
 * onto a Tier-1 primitive + (optionally) a profile-bound concrete type.
 */
export interface EntityMappingEntry {
  /**
   * Tier-1 type this entity maps to. The substrate's universal-primitives
   * spine. See `@pm/types` `Tier1TypeName`.
   */
  readonly tier1: Tier1TypeName;

  /**
   * Concrete type name within the chosen profile, or the same as `tier1`
   * for raw Tier-1 use. The profile's `entityTypes` registry must declare
   * this name (semantic check; phase 2).
   */
  readonly concrete: ConcreteTypeName;

  /**
   * Required identity-bag fields. The substrate validates presence at
   * write time. Subset of the source entity's columns/attrs.
   */
  readonly identityFields: readonly FieldName[];

  /**
   * Optional identity-bag fields. Documented for completeness; not
   * enforced.
   */
  readonly optionalFields?: readonly FieldName[];

  /**
   * Schema version of this entity in the mapping. Bumped on breaking
   * changes to the identity-bag shape so existing rows migrate
   * deliberately, not silently.
   */
  readonly schemaVersion: number;

  /**
   * Edges this entity participates in. Keyed by app-arbitrary name
   * (typically the source-side relationship attribute).
   */
  readonly edges?: Readonly<Record<string, EdgeMappingEntry>>;

  /**
   * Optional source-table/source-model reference. SQLAlchemy class name
   * or Prisma model name, for instance. Substrate doesn't read it;
   * metadata for codegen and observability.
   */
  readonly sourceRef?: string;

  /** Optional one-line documentation for operator dashboards. */
  readonly description?: string;
}

/**
 * Top-level mapping document. Apps ship one of these per profile they
 * register against the substrate.
 */
export interface EntityMapping {
  /**
   * Profile name this mapping targets. Matches `ProfileDefinition.name`
   * in `@pm/types`. Use `null` for a raw Tier-1 mapping (no profile).
   */
  readonly profile: string | null;

  /**
   * Mapping format version. Bumped on breaking changes to the shape of
   * this document. Phase 1 ships v1.
   */
  readonly mappingVersion: 1;

  /**
   * Entities, keyed by concrete type name. The key MUST equal each
   * entry's `concrete` field; the validator enforces this.
   */
  readonly entities: Readonly<Record<ConcreteTypeName, EntityMappingEntry>>;

  /** Optional human description of what this mapping covers. */
  readonly description?: string;
}
