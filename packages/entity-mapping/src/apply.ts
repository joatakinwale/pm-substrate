/**
 * Ingestion adapter (G11 phase 3).
 *
 * Takes a parsed `EntityMapping` + a source-app row + tenant context,
 * and produces inputs the substrate's `Graph` accepts directly:
 *
 *   - `applyMapping(mapping, sourceName, row, ctx)` →  `MappingNodeInput`
 *   - `applyEdgeMapping(mapping, sourceName, edgeKey, ids, ctx)` →  `MappingEdgeInput`
 *
 * The returned shapes are structurally assignable to `@pm/graph`'s
 * `CreateNodeInput` / `CreateEdgeInput`, so callers can write:
 *
 *   await graph.createNode(applyMapping(mapping, "Lead", row, ctx));
 *
 * No DB. No profile lookups (that's `validateEntityMappingAgainstProfile`).
 * No `@pm/graph` dep — that would force every `@pm/entity-mapping`
 * consumer to drag in `pg` and the profile registry just for the
 * type-level shape of `CreateNodeInput`. Mirror the shape locally; let
 * structural typing do the bridge work.
 *
 * The adapter intentionally does NOT validate the mapping itself —
 * callers should run `validateEntityMappingAgainstProfile` once at app
 * startup or in CI, then call `applyMapping` on every ingested row.
 * Re-validating per row would burn CPU on a hot path for no benefit.
 */

import type { Tier1TypeName, TenantId } from "@pm/types";
import type { EntityMapping } from "./schema.js";

/**
 * Structural mirror of `@pm/graph` `CreateNodeInput`. Kept local so
 * this package doesn't pull `pg` transitively. Callers pass the result
 * straight to `graph.createNode(input)` — TypeScript's structural typing
 * does the bridge.
 */
export interface MappingNodeInput {
  readonly tenantId: TenantId;
  readonly id?: string;
  readonly profile: {
    readonly tier1: Tier1TypeName;
    readonly profile: string | null;
    readonly concrete: string;
  };
  readonly identity: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
}

/**
 * Structural mirror of `@pm/graph` `CreateEdgeInput`.
 */
export interface MappingEdgeInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly fromId: string;
  readonly toId: string;
  readonly attrs: Readonly<Record<string, unknown>>;
}

/**
 * Error class for ingestion-time programmer errors. The caller asked
 * for a `sourceName` that isn't in the mapping, or an edge key that
 * isn't declared on the entity. Different from validation issues
 * (those are document-shape problems and surface as a `ValidationResult`).
 */
export class EntityMappingApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityMappingApplyError";
  }
}

/**
 * Resolve a source-app row into a graph-ready node input.
 *
 * Identity-bag construction:
 *   - `identityFields[]` entries are read by source-app field name and
 *     stored under that same name on the identity bag. The mapping
 *     entry uses these when the source app's column name already
 *     matches the profile field name.
 *   - `fieldMap` entries map profile field → source field. The value
 *     is read from the source row by the source field name and stored
 *     under the profile field name.
 *
 * Missing fields (undefined in the source row) are left out of the
 * identity bag — the substrate's profile validator will reject the
 * write if a profile-required field is missing. That's by design: the
 * mapping adapter is shape-translation, not validation.
 *
 * Null values, however, ARE passed through. Many real-app schemas use
 * nullable columns that the profile maps to `string | null` identity
 * fields; coercing those to omitted would silently violate the contract.
 */
export function applyMapping(
  mapping: EntityMapping,
  sourceName: string,
  row: Readonly<Record<string, unknown>>,
  ctx: { readonly tenantId: TenantId; readonly id?: string },
): MappingNodeInput {
  const entry = mapping.entities[sourceName];
  if (!entry) {
    throw new EntityMappingApplyError(
      `entity "${sourceName}" is not declared in mapping`,
    );
  }

  const identity: Record<string, unknown> = {};

  for (const f of entry.identityFields) {
    if (f in row) {
      identity[f] = row[f];
    }
  }

  for (const [profileField, sourceField] of Object.entries(entry.fieldMap ?? {})) {
    if (sourceField in row) {
      identity[profileField] = row[sourceField];
    }
  }

  return {
    tenantId: ctx.tenantId,
    profile: {
      tier1: entry.tier1,
      profile: mapping.profile,
      concrete: entry.concrete,
    },
    identity,
    schemaVersion: entry.schemaVersion,
    ...(ctx.id ? { id: ctx.id } : {}),
  };
}

/**
 * Translate a declared edge into a graph-ready edge input. Edges are
 * declared on the source entity; the caller supplies the resolved
 * `fromId` (the graph node id of the source entity) and `toId` (the
 * graph node id of the target entity).
 *
 * The mapping's edge `type` string is used verbatim — it's already the
 * profile-prefixed substrate edge type per the validator's contract.
 *
 * Callers that need to attach context to an edge can pass `attrs`
 * explicitly via `ctx.attrs`. Otherwise `attrs` defaults to `{}`.
 */
export function applyEdgeMapping(
  mapping: EntityMapping,
  sourceName: string,
  edgeKey: string,
  ids: { readonly fromId: string; readonly toId: string },
  ctx: {
    readonly tenantId: TenantId;
    readonly attrs?: Readonly<Record<string, unknown>>;
  },
): MappingEdgeInput {
  const entry = mapping.entities[sourceName];
  if (!entry) {
    throw new EntityMappingApplyError(
      `entity "${sourceName}" is not declared in mapping`,
    );
  }

  const edge = entry.edges?.[edgeKey];
  if (!edge) {
    throw new EntityMappingApplyError(
      `edge "${edgeKey}" is not declared on entity "${sourceName}"`,
    );
  }

  return {
    tenantId: ctx.tenantId,
    type: edge.type,
    fromId: ids.fromId,
    toId: ids.toId,
    attrs: ctx.attrs ?? {},
  };
}
