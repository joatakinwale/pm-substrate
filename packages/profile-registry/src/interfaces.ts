import type {
  CardinalityConstraint,
  ProfileBinding,
  ProfileDefinition,
  TenantId,
} from "@pm/types";

export interface ProfileRegistry {
  /**
   * Install or upgrade a profile for a tenant. Idempotent on (tenantId, name):
   * re-installing replaces the prior definition. Bumping `version` triggers
   * the same path — older versions don't coexist (a tenant runs one version
   * of a given profile at a time).
   */
  install(tenantId: TenantId, def: ProfileDefinition): Promise<void>;

  /** Uninstall a profile from a tenant. */
  uninstall(tenantId: TenantId, name: string): Promise<void>;

  /** All profiles installed for a tenant. */
  list(tenantId: TenantId): Promise<readonly ProfileDefinition[]>;

  /** Look up an installed profile by name. */
  get(
    tenantId: TenantId,
    name: string,
  ): Promise<ProfileDefinition | null>;

  /** Validator for the tenant's installed profiles. Cached per call. */
  validator(tenantId: TenantId): Promise<ProfileValidator>;
}

/**
 * Write-time validator. Built from one tenant's installed profiles + the
 * raw Tier-1 catalog. Stateless after construction; safe to share.
 */
export interface ProfileValidator {
  /**
   * Validate a node creation/update against the tenant's installed profiles.
   * Throws ProfileValidationError on a mismatch.
   *
   * Raw Tier-1 writes (profile === null) are always allowed: required-field
   * gating doesn't apply, since Tier-1 has no domain-specific shape beyond
   * the seven primitive type names.
   */
  validateNode(input: NodeWriteCheck): void;

  /**
   * Validate an edge creation. Checks: (a) edge type is declared by some
   * installed profile, (b) from/to types are in the declared sets,
   * (c) cardinality constraints aren't already exhausted (relies on
   * caller-supplied counts to keep the validator stateless).
   */
  validateEdge(input: EdgeWriteCheck): void;
}

export interface NodeWriteCheck {
  readonly tenantId: TenantId;
  readonly profile: ProfileBinding;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
}

export interface EdgeWriteCheck {
  readonly tenantId: TenantId;
  /**
   * Profile-prefixed edge type ("wedding/has_principal") OR a raw type
   * for cross-profile edges in the Tier-1 catalog. Validation only
   * applies to profile-prefixed types; substrate stores raw types as-is.
   */
  readonly type: string;
  readonly fromConcrete: string;
  readonly toConcrete: string;
  /**
   * Existing edge count from `fromId` of this type, EXCLUDING the proposed
   * write. Caller looks this up from the graph; the validator computes
   * "would the new edge cross the cardinality bound?". Pass 0 if cardinality
   * isn't a concern (validator will short-circuit on `unbounded`).
   */
  readonly existingFromCount: number;
  readonly existingToCount: number;
}

/**
 * Helper exposed for the graph layer's convenience: parse a cardinality
 * constraint string into a (op, n) pair.
 */
export interface ParsedCardinality {
  readonly op: "exactly" | "at-most" | "at-least" | "unbounded";
  readonly n: number;
}

export const parseCardinality = (
  c: CardinalityConstraint,
): ParsedCardinality => {
  if (c === "unbounded") return { op: "unbounded", n: Infinity };
  const [op, ns] = c.split(":");
  return { op: op as ParsedCardinality["op"], n: Number(ns) };
};
