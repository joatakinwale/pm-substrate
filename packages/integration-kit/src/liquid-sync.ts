/**
 * The governed Liquid sync entry (lanes L2+L3 composed): approval gate →
 * sidecar fetch → idempotent sync. This is the only sanctioned way Liquid
 * records reach the graph; the file-based `pm:sync` path stays the
 * dependency-free floor and is NOT subject to this gate.
 */

import type { EntityMapping } from "@pm/entity-mapping";
import type { EventPublisher, EventReader } from "@pm/events";
import type { TenantId } from "@pm/types";

import {
  fetchLiquidRecords,
  type LiquidFetchOptions,
  type LiquidMcpClient,
} from "./liquid-source.js";
import { requireApprovedEntityMapping } from "./mapping-approval.js";
import {
  runEntityMappingSync,
  type EntityMappingSyncResult,
  type SyncGraph,
} from "./sync-runner.js";

export interface LiquidSyncDeps {
  readonly graph: SyncGraph;
  readonly events: EventPublisher & EventReader;
}

export interface LiquidSyncInput extends LiquidFetchOptions {
  readonly tenantId: TenantId;
  readonly appName: string;
  readonly mapping: EntityMapping;
  readonly syncedBy: string;
  readonly authority?: string;
}

export interface LiquidSyncResult extends EntityMappingSyncResult {
  readonly mappingHash: string;
  readonly adapterId: string;
  readonly skippedMissingId: number;
}

/**
 * Refuses unless the mapping's hash is the approved one (L3), then fetches
 * through the sidecar (L2) and runs the same idempotent sync as every other
 * source. Zero new trust: Liquid never chooses what the graph looks like.
 */
export async function syncFromLiquid(
  deps: LiquidSyncDeps,
  client: LiquidMcpClient,
  input: LiquidSyncInput,
): Promise<LiquidSyncResult> {
  const mappingHash = await requireApprovedEntityMapping(
    deps.events,
    input.tenantId,
    input.appName,
    input.mapping,
  );
  const fetched = await fetchLiquidRecords(client, input);
  const result = await runEntityMappingSync(deps, {
    tenantId: input.tenantId,
    appName: input.appName,
    mapping: input.mapping,
    records: fetched.records,
    syncedBy: input.syncedBy,
    ...(input.authority !== undefined ? { authority: input.authority } : {}),
  });
  return {
    ...result,
    mappingHash,
    adapterId: fetched.adapterId,
    skippedMissingId: fetched.skippedMissingId,
  };
}
