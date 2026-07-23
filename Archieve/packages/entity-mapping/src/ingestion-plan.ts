import type {
  EntityId,
  ProfileDefinition,
  TenantId,
  Timestamp,
} from "@pm/types";

import {
  applyMapping,
  EntityMappingApplyError,
  type MappingNodeInput,
} from "./apply.js";
import type { EntityMapping } from "./schema.js";
import {
  validateEntityMappingAgainstProfile,
} from "./semantic.js";
import type { ValidationIssue } from "./validate.js";

export const ADAPTER_ENTITY_MAPPED_EVENT_TYPE = "adapter.entity_mapped";
export const ADAPTER_ENTITY_MAPPED_PAYLOAD_SCHEMA =
  "adapter.entity_mapped.v1";

export interface SourceEntityRecord {
  readonly sourceName: string;
  readonly row: Readonly<Record<string, unknown>>;
  readonly id?: EntityId;
  readonly sourceRecordId?: string;
  readonly observedAt?: Timestamp;
}

/**
 * Structural mirror of `@pm/events` PublishInput. Kept local for the
 * same reason `MappingNodeInput` mirrors graph input locally: adapters
 * should not pull the DB/event-store package into their dependency tree.
 */
export interface MappingEventInput {
  readonly tenantId: TenantId;
  readonly type: string;
  readonly entityId: EntityId;
  readonly emittedBy: string;
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly authority?: string | null;
  readonly occurredAt?: Timestamp;
}

export interface EntityIngestionPlanItem {
  readonly sourceName: string;
  readonly sourceRecordId?: string;
  readonly node: MappingNodeInput;
  readonly event: MappingEventInput;
}

export interface EntityIngestionPlan {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly items: readonly EntityIngestionPlanItem[];
}

export interface EntityIngestionPlanContext {
  readonly tenantId: TenantId;
  readonly emittedBy: string;
  readonly authority?: string | null;
  readonly occurredAt?: Timestamp;
  readonly idForRecord?: (
    record: SourceEntityRecord,
    index: number,
  ) => EntityId | null | undefined;
}

/**
 * Validate a mapping once, then stage deterministic graph and event writes
 * for source rows. The plan is atomic: any validation or record-level issue
 * returns zero items so callers do not accidentally ingest partial state.
 */
export function planEntityIngestion(
  mapping: EntityMapping,
  profile: ProfileDefinition,
  records: readonly SourceEntityRecord[],
  ctx: EntityIngestionPlanContext,
): EntityIngestionPlan {
  const semantic = validateEntityMappingAgainstProfile(mapping, profile);
  if (!semantic.valid) {
    return { valid: false, issues: semantic.issues, items: [] };
  }

  const issues: ValidationIssue[] = [];
  const staged: EntityIngestionPlanItem[] = [];

  records.forEach((record, index) => {
    const id = record.id ?? ctx.idForRecord?.(record, index);
    if (!id) {
      issues.push({
        path: `/records/${index}/id`,
        message: "expected deterministic entity id from record.id or idForRecord",
      });
      return;
    }

    try {
      const node = applyMapping(mapping, record.sourceName, record.row, {
        tenantId: ctx.tenantId,
        id,
      });
      const event = buildMappedEvent(mapping, record, node, id, ctx);
      staged.push({
        sourceName: record.sourceName,
        ...(record.sourceRecordId ? { sourceRecordId: record.sourceRecordId } : {}),
        node,
        event,
      });
    } catch (err) {
      if (err instanceof EntityMappingApplyError) {
        issues.push({
          path: `/records/${index}/sourceName`,
          message: err.message,
        });
        return;
      }
      throw err;
    }
  });

  if (issues.length > 0) {
    return { valid: false, issues, items: [] };
  }

  return { valid: true, issues: [], items: staged };
}

function buildMappedEvent(
  mapping: EntityMapping,
  record: SourceEntityRecord,
  node: MappingNodeInput,
  id: EntityId,
  ctx: EntityIngestionPlanContext,
): MappingEventInput {
  const occurredAt = record.observedAt ?? ctx.occurredAt;
  return {
    tenantId: ctx.tenantId,
    type: ADAPTER_ENTITY_MAPPED_EVENT_TYPE,
    entityId: id,
    emittedBy: ctx.emittedBy,
    authority: ctx.authority ?? ctx.emittedBy,
    payloadSchema: ADAPTER_ENTITY_MAPPED_PAYLOAD_SCHEMA,
    ...(occurredAt ? { occurredAt } : {}),
    payload: {
      mappingProfile: mapping.profile,
      mappingVersion: mapping.mappingVersion,
      sourceName: record.sourceName,
      ...(record.sourceRecordId ? { sourceRecordId: record.sourceRecordId } : {}),
      concrete: node.profile.concrete,
      tier1: node.profile.tier1,
      schemaVersion: node.schemaVersion,
      identityKeys: Object.keys(node.identity).sort(),
      identity: node.identity,
    },
  };
}
