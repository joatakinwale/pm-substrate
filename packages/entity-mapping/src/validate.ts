/**
 * Structural validator for `EntityMapping`. No profile lookups — that's
 * the phase-2 job. Phase 1 verifies the shape of the document matches
 * what callers can write down.
 *
 * The validator returns a `ValidationResult` instead of throwing because
 * apps loading a mapping at startup typically want to surface multiple
 * issues at once (e.g., an operator dashboard or CI step), not abort
 * on the first.
 */

import type { Tier1TypeName } from "@pm/types";
import type {
  EntityMapping,
  EntityMappingEntry,
  EdgeMappingEntry,
  EdgeCardinality,
} from "./schema.js";

/** A single validation problem. `path` is dotted JSON-Pointer-ish. */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Validation outcome. `valid` is the convenience boolean; `issues` lists
 * everything that's wrong (empty when valid).
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/* ----- inlined sets keep the validator zero-import beyond @pm/types ----- */

const TIER1_TYPES: ReadonlySet<Tier1TypeName> = new Set([
  "Counterparty",
  "Engagement",
  "Transaction",
  "Resource",
  "Communication",
  "Document",
  "Event",
] as const);

const CARDINALITIES: ReadonlySet<EdgeCardinality> = new Set([
  "zero_or_one",
  "one_or_more",
  "many",
  "exactly_one",
  "exactly_two",
] as const);

/**
 * Identifier convention used by edge `type`. Substrate convention is
 * `<profile>/<verb>` or `<profile>/<verb>_<noun>` (lowercase, snake_case
 * for the right-hand side, slash separator). Conservative regex —
 * rejects double slashes, leading/trailing slashes, uppercase, dots.
 */
const EDGE_TYPE_RE = /^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/;

/* -------------------------- helpers -------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/* -------------------------- validator -------------------------- */

/**
 * Structurally validate a parsed `EntityMapping`. Returns issues for
 * every problem found; never throws on user data. Throws only on
 * programmer errors (the input isn't an object at all).
 *
 * Checks performed:
 *   - mappingVersion === 1
 *   - profile is string|null
 *   - entities is a non-empty record
 *   - each entity entry:
 *     - tier1 ∈ Tier1TypeName
 *     - concrete is a non-empty string
 *     - schemaVersion is a positive integer
 *     - identityFields is a string[] with no duplicates
 *     - fieldMap, if present, is a record of non-empty string → non-empty string
 *     - identityFields or fieldMap must contain at least one field
 *     - optionalFields, if present, is string[] disjoint from identityFields and fieldMap keys
 *     - edges, if present:
 *       - is a record
 *       - each edge entry: target is a string and matches another entity
 *         in the same map, type matches the EDGE_TYPE_RE, cardinality
 *         is a valid EdgeCardinality
 */
export function validateEntityMapping(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  if (!isObj(input)) {
    return {
      valid: false,
      issues: [{ path: "", message: "expected an object" }],
    };
  }

  // mappingVersion
  if (input["mappingVersion"] !== 1) {
    push(
      "/mappingVersion",
      `expected mappingVersion === 1; got ${JSON.stringify(input["mappingVersion"])}`,
    );
  }

  // profile
  const profile = input["profile"];
  if (profile !== null && typeof profile !== "string") {
    push("/profile", "expected string or null");
  } else if (typeof profile === "string" && profile.length === 0) {
    push("/profile", "expected non-empty string (use null for raw Tier-1)");
  }

  // description (optional)
  if (
    "description" in input &&
    input["description"] !== undefined &&
    typeof input["description"] !== "string"
  ) {
    push("/description", "expected string when present");
  }

  // entities
  const entities = input["entities"];
  if (!isObj(entities)) {
    push("/entities", "expected an object keyed by concrete type name");
    return { valid: issues.length === 0, issues };
  }
  if (Object.keys(entities).length === 0) {
    push("/entities", "expected at least one entity entry");
  }

  // Build the set of declared concrete-type keys so we can validate edge
  // `target` references later in the same pass.
  const declaredConcrete = new Set<string>(Object.keys(entities));

  for (const [key, raw] of Object.entries(entities)) {
    const at = `/entities/${key}`;
    if (!isObj(raw)) {
      push(at, "expected an object");
      continue;
    }
    validateEntity(key, raw as Record<string, unknown>, at, declaredConcrete, push);
  }

  return { valid: issues.length === 0, issues };
}

function validateEntity(
  key: string,
  e: Record<string, unknown>,
  at: string,
  declaredConcrete: ReadonlySet<string>,
  push: (path: string, message: string) => void,
): void {
  // tier1
  const tier1 = e["tier1"];
  if (typeof tier1 !== "string" || !TIER1_TYPES.has(tier1 as Tier1TypeName)) {
    push(
      `${at}/tier1`,
      `expected one of ${JSON.stringify([...TIER1_TYPES])}; got ${JSON.stringify(tier1)}`,
    );
  }

  // concrete is the profile concrete type. The map key is the source-app
  // entity/model name, which may differ (e.g. Organization → ClientOrg).
  const concrete = e["concrete"];
  if (typeof concrete !== "string" || concrete.length === 0) {
    push(`${at}/concrete`, "expected non-empty string");
  }

  // schemaVersion
  const sv = e["schemaVersion"];
  if (typeof sv !== "number" || !Number.isInteger(sv) || sv < 1) {
    push(`${at}/schemaVersion`, "expected integer >= 1");
  }

  // identityFields
  const id = e["identityFields"];
  if (!isStringArray(id)) {
    push(`${at}/identityFields`, "expected string[]");
  } else if (new Set(id).size !== id.length) {
    push(`${at}/identityFields`, "duplicate field names not allowed");
  }

  // fieldMap (optional): profile field -> source field alias.
  const fieldMap = e["fieldMap"];
  const fieldMapKeys: string[] = [];
  if (fieldMap !== undefined) {
    if (!isObj(fieldMap)) {
      push(`${at}/fieldMap`, "expected object when present");
    } else {
      for (const [profileField, sourceField] of Object.entries(fieldMap)) {
        if (profileField.length === 0) {
          push(`${at}/fieldMap`, "profile field names must be non-empty");
        }
        if (typeof sourceField !== "string" || sourceField.length === 0) {
          push(`${at}/fieldMap/${profileField}`, "expected non-empty source field string");
        }
        fieldMapKeys.push(profileField);
      }
    }
  }

  if (isStringArray(id) && id.length === 0 && fieldMapKeys.length === 0) {
    push(`${at}/identityFields`, "expected at least one identityFields entry or fieldMap alias");
  }

  // optionalFields (optional)
  const opt = e["optionalFields"];
  if (opt !== undefined) {
    if (!isStringArray(opt)) {
      push(`${at}/optionalFields`, "expected string[] when present");
    } else if (new Set(opt).size !== opt.length) {
      push(`${at}/optionalFields`, "duplicate field names not allowed");
    } else if (isStringArray(id)) {
      const requiredProfileFields = new Set([...id, ...fieldMapKeys]);
      const overlap = opt.filter((f) => requiredProfileFields.has(f));
      if (overlap.length > 0) {
        push(
          `${at}/optionalFields`,
          `must be disjoint from identityFields and fieldMap keys; overlapping: ${JSON.stringify(overlap)}`,
        );
      }
    }
  }

  // sourceRef, description (both optional, both strings if present)
  for (const optStr of ["sourceRef", "description"] as const) {
    if (optStr in e && e[optStr] !== undefined && typeof e[optStr] !== "string") {
      push(`${at}/${optStr}`, "expected string when present");
    }
  }

  // edges (optional)
  const edges = e["edges"];
  if (edges !== undefined) {
    if (!isObj(edges)) {
      push(`${at}/edges`, "expected an object when present");
    } else {
      for (const [edgeKey, edgeRaw] of Object.entries(edges)) {
        const edgeAt = `${at}/edges/${edgeKey}`;
        if (!isObj(edgeRaw)) {
          push(edgeAt, "expected an object");
          continue;
        }
        validateEdge(
          edgeRaw as Record<string, unknown>,
          edgeAt,
          declaredConcrete,
          push,
        );
      }
    }
  }
}

function validateEdge(
  edge: Record<string, unknown>,
  at: string,
  declaredConcrete: ReadonlySet<string>,
  push: (path: string, message: string) => void,
): void {
  const target = edge["target"];
  if (typeof target !== "string" || target.length === 0) {
    push(`${at}/target`, "expected non-empty string");
  } else if (!declaredConcrete.has(target)) {
    push(
      `${at}/target`,
      `target "${target}" is not declared in entities; cross-mapping edges are not supported`,
    );
  }

  const type = edge["type"];
  if (typeof type !== "string" || !EDGE_TYPE_RE.test(type)) {
    push(
      `${at}/type`,
      `expected /<profile>\\/<snake_case>/, e.g. "agency/lead_assigned_to_user"; got ${JSON.stringify(type)}`,
    );
  }

  const cardinality = edge["cardinality"];
  if (
    typeof cardinality !== "string" ||
    !CARDINALITIES.has(cardinality as EdgeCardinality)
  ) {
    push(
      `${at}/cardinality`,
      `expected one of ${JSON.stringify([...CARDINALITIES])}; got ${JSON.stringify(cardinality)}`,
    );
  }

  for (const optStr of ["sourceRef", "description"] as const) {
    if (
      optStr in edge &&
      edge[optStr] !== undefined &&
      typeof edge[optStr] !== "string"
    ) {
      push(`${at}/${optStr}`, "expected string when present");
    }
  }
}

/**
 * Type-narrowing helper. Useful when you've validated a mapping and
 * want to consume it in code without re-checking. Returns the input
 * cast to `EntityMapping` after a no-throw assertion.
 *
 * NOTE: only call after `validateEntityMapping(input).valid === true`.
 */
export function asEntityMapping(input: unknown): EntityMapping {
  return input as EntityMapping;
}
