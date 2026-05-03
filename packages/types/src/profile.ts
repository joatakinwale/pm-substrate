import type { NodeBase } from "./node.js";
import type { Tier1TypeName } from "./common.js";

/**
 * Profile registration types.
 *
 * Architecture rule (architecture.md, Layered ontology):
 *   "Profiles are libraries you ship, not hardcoded modules."
 *
 * A profile package exports a single ProfileDefinition. Tenants opt in by
 * registering the definition with the substrate at provisioning time.
 *
 * The substrate uses these declarations to:
 *   - Validate node writes against the profile's concrete type schemas
 *   - Enforce edge cardinality constraints
 *   - Validate Transaction lifecycle transitions
 *   - Resolve the tenant's identity-primacy spine for indexing decisions
 *
 * Discipline rule: profile authors should not have to touch the substrate.
 *  All extension is declarative, not via inheritance or monkey-patching.
 */

export interface ProfileDefinition {
  /** Stable, lowercase, hyphenless name. Must be unique across all profiles. */
  readonly name: string;

  /** Profile schema version. Bumped on breaking changes. */
  readonly version: number;

  /** Human-readable description shown in operator dashboards. */
  readonly description: string;

  /**
   * Concrete entity-type specializations. Keyed by the concrete type name
   * the profile exposes (e.g., "Wedding", "Couple", "Contract").
   */
  readonly entityTypes: Readonly<Record<string, EntityTypeDef>>;

  /**
   * Edge catalog. The substrate does not invent edge types; the profile
   * declares them up front and the substrate enforces cardinality at write time.
   */
  readonly edgeTypes: Readonly<Record<string, EdgeTypeDef>>;

  /**
   * Lifecycle state machines, keyed by concrete entity-type name.
   * Only entity types that have a lifecycle declare one here (e.g., Contract,
   * Payment, Invoice). Counterparty / Resource typically don't.
   */
  readonly lifecycles: Readonly<Record<string, LifecycleDef>>;

  /**
   * Identity primacy. The single concrete entity type that serves as the
   * "spine" for this industry. Every other record in the tenant's graph
   * eventually reaches this entity through edges.
   *
   * Healthcare = "Patient". Manufacturing = "SKU". Wedding = "Wedding".
   * Legal = "Matter". Agency = "Project". SaaS = "Subscription".
   *
   * The substrate uses this to decide indexing strategy and to catch the
   * "wrong-spine" failure mode named in ADR-0003.
   */
  readonly identityPrimacy: string;
}

/**
 * Concrete entity-type specialization. Asserts which Tier-1 interface the
 * concrete type implements and what the required identity fields are.
 */
export interface EntityTypeDef {
  /** Concrete type name as exposed in the graph. */
  readonly concrete: string;

  /** Tier-1 interface this concrete type implements. */
  readonly tier1: Tier1TypeName;

  /**
   * Required identity-bag fields. The substrate validates presence; the
   * profile package's TypeScript types enforce shape at the type level.
   */
  readonly requiredFields: readonly string[];

  /**
   * Optional identity-bag fields. Documented for completeness; not enforced
   * by the substrate.
   */
  readonly optionalFields: readonly string[];

  /**
   * Schema version of this specific entity type. Allows individual entity
   * types to evolve at different rates.
   */
  readonly schemaVersion: number;
}

/**
 * Edge catalog entry. Names are profile-prefixed at write time
 * (e.g., "wedding/has_principal") to avoid collision across profiles.
 */
export interface EdgeTypeDef {
  /** Local name within the profile (no prefix). */
  readonly name: string;

  /** The concrete entity types this edge can start at. */
  readonly fromTypes: readonly string[];

  /** The concrete entity types this edge can end at. */
  readonly toTypes: readonly string[];

  /**
   * Cardinality constraint on the *from* side: how many edges of this type
   * may originate from a single source node?
   *   "exactly:N" — must be exactly N (e.g., "exactly:2" for couple_ids)
   *   "at-most:N" — 0..N
   *   "at-least:N" — N..unlimited
   *   "unbounded" — 0..unlimited
   */
  readonly fromCardinality: CardinalityConstraint;

  /** Cardinality constraint on the *to* side. */
  readonly toCardinality: CardinalityConstraint;
}

export type CardinalityConstraint =
  | `exactly:${number}`
  | `at-most:${number}`
  | `at-least:${number}`
  | "unbounded";

/**
 * Lifecycle state machine. Profile declares the states and the legal
 * transitions; substrate enforces "current state must be one of `from`
 * for transition `to` to be allowed".
 *
 * Discipline rule: the substrate does NOT decide which state to move to.
 * It only enforces that the requested move is legal.
 */
export interface LifecycleDef {
  /** All declared states. */
  readonly states: readonly string[];

  /** Initial state for newly-created entities of this type. */
  readonly initial: string;

  /** Legal transitions: each entry says "from these states, you may move to this state". */
  readonly transitions: readonly LifecycleTransition[];

  /** Terminal states. Useful for validation and for archival queries. */
  readonly terminal: readonly string[];
}

export interface LifecycleTransition {
  readonly from: readonly string[];
  readonly to: string;
  /**
   * Optional event type that triggers this transition. Useful for the workflow
   * runtime; the substrate itself does not auto-transition based on events.
   */
  readonly trigger?: string;
}

/**
 * Helper type for profile-package authors: a strongly-typed concrete entity
 * that extends NodeBase with a profile-declared identity shape.
 *
 * Usage in profile packages:
 *
 *   export interface Wedding extends ProfileEntity<{
 *     title: string;
 *     event_date: string;
 *     venue: string;
 *     scopeStart: string;
 *     scopeEnd: string;
 *   }> {}
 */
export interface ProfileEntity<TIdentity extends Record<string, unknown>>
  extends NodeBase {
  readonly identity: Readonly<TIdentity>;
}
