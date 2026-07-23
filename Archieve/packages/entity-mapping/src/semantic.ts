/**
 * Profile-aware semantic validation for EntityMapping (G11 phase 2).
 *
 * Structural validation proves the mapping document has the right shape.
 * Semantic validation proves that shape resolves against the profile it
 * claims to target: concrete entity types exist, Tier-1 bindings match,
 * required identity fields are covered, edge types exist, edge endpoint
 * types match, and declared cardinality agrees with the profile catalog.
 */

import type { CardinalityConstraint, ProfileDefinition } from "@pm/types";
import type { EntityMapping, EdgeCardinality } from "./schema.js";
import {
  asEntityMapping,
  validateEntityMapping,
  type ValidationIssue,
  type ValidationResult,
} from "./validate.js";

/**
 * Validate a mapping against a concrete `ProfileDefinition`.
 *
 * This is still pure/zero-DB. Callers that load a profile from the
 * registry can pass that installed definition here during app startup or
 * CI before any graph writes happen.
 */
export function validateEntityMappingAgainstProfile(
  input: unknown,
  profile: ProfileDefinition,
): ValidationResult {
  const structural = validateEntityMapping(input);
  const issues: ValidationIssue[] = [...structural.issues];

  // Avoid cascading nonsense after shape errors. The caller gets all
  // structural issues; semantic checks require typed access.
  if (!structural.valid) {
    return { valid: false, issues };
  }

  const mapping = asEntityMapping(input);

  if (mapping.profile === null) {
    issues.push({
      path: "/profile",
      message: `raw Tier-1 mapping cannot be validated against profile "${profile.name}"`,
    });
    return { valid: false, issues };
  }

  if (mapping.profile !== profile.name) {
    issues.push({
      path: "/profile",
      message: `mapping targets profile "${mapping.profile}" but validator profile is "${profile.name}"`,
    });
  }

  for (const [sourceName, entry] of Object.entries(mapping.entities)) {
    const at = `/entities/${sourceName}`;
    const profileConcrete = entry.concrete;
    const def = profile.entityTypes[profileConcrete];

    if (!def) {
      issues.push({
        path: `${at}/concrete`,
        message: `concrete type "${profileConcrete}" is not declared by profile "${profile.name}"`,
      });
      // Edge checks may still be meaningful for other entities, but this
      // entity cannot be checked against entity-specific def fields.
    } else {
      if (def.concrete !== entry.concrete) {
        issues.push({
          path: `${at}/concrete`,
          message: `profile entity def concrete is "${def.concrete}", mapping concrete is "${entry.concrete}"`,
        });
      }
      if (def.tier1 !== entry.tier1) {
        issues.push({
          path: `${at}/tier1`,
          message: `profile maps "${profileConcrete}" to tier1 "${def.tier1}", mapping says "${entry.tier1}"`,
        });
      }
      if (def.schemaVersion !== entry.schemaVersion) {
        issues.push({
          path: `${at}/schemaVersion`,
          message: `profile schemaVersion is ${def.schemaVersion}, mapping says ${entry.schemaVersion}`,
        });
      }

      const mappedRequired = new Set([
        ...entry.identityFields,
        ...Object.keys(entry.fieldMap ?? {}),
      ]);
      for (const required of def.requiredFields) {
        if (!mappedRequired.has(required)) {
          issues.push({
            path: `${at}/identityFields`,
            message: `missing profile-required identity field "${required}"`,
          });
        }
      }
    }

    for (const [edgeKey, edge] of Object.entries(entry.edges ?? {})) {
      const edgeAt = `${at}/edges/${edgeKey}`;
      const targetEntry = mapping.entities[edge.target];
      const targetConcrete = targetEntry?.concrete ?? edge.target;
      const localEdgeName = localName(edge.type, profile.name);
      if (!localEdgeName) {
        issues.push({
          path: `${edgeAt}/type`,
          message: `edge type "${edge.type}" must be prefixed with profile "${profile.name}/"`,
        });
        continue;
      }

      const edgeDef = profile.edgeTypes[localEdgeName];
      if (!edgeDef) {
        issues.push({
          path: `${edgeAt}/type`,
          message: `edge type "${edge.type}" is not declared by profile "${profile.name}"`,
        });
        continue;
      }

      if (!edgeDef.fromTypes.includes(profileConcrete)) {
        issues.push({
          path: edgeAt,
          message: `edge "${edge.type}" cannot start at "${profileConcrete}"; declared from-types: ${edgeDef.fromTypes.join(", ")}`,
        });
      }

      if (!edgeDef.toTypes.includes(targetConcrete)) {
        issues.push({
          path: `${edgeAt}/target`,
          message: `edge "${edge.type}" cannot target "${targetConcrete}"; declared to-types: ${edgeDef.toTypes.join(", ")}`,
        });
      }

      const profileCardinality = toEdgeCardinality(edgeDef.fromCardinality);
      if (profileCardinality !== edge.cardinality) {
        issues.push({
          path: `${edgeAt}/cardinality`,
          message: `profile fromCardinality "${edgeDef.fromCardinality}" maps to "${profileCardinality}", mapping says "${edge.cardinality}"`,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function localName(type: string, expectedProfile: string): string | null {
  const prefix = `${expectedProfile}/`;
  if (!type.startsWith(prefix)) return null;
  return type.slice(prefix.length);
}

/**
 * Convert the profile registry's cardinality language to the mapping
 * language for outgoing edges. EntityMapping edges are declared on the
 * source entity, so the relevant profile side is `fromCardinality`.
 */
export function toEdgeCardinality(c: CardinalityConstraint): EdgeCardinality {
  if (c === "unbounded") return "many";
  const [op, n] = c.split(":");
  if (op === "exactly" && n === "1") return "exactly_one";
  if (op === "exactly" && n === "2") return "exactly_two";
  if (op === "at-most" && n === "1") return "zero_or_one";
  if (op === "at-least" && n === "1") return "one_or_more";
  // Mapping v1 has the five cardinalities the substrate already uses in
  // profile examples. Unsupported numeric constraints should be explicit
  // instead of silently approximated.
  throw new Error(`unsupported profile cardinality for mapping v1: ${c}`);
}
