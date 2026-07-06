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
import {
  entityMappingHash,
  getMappingApprovalState,
  requireApprovedEntityMapping,
} from "./mapping-approval.js";
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
  /**
   * Shadow mode: zero writes, zero events, AND the approval gate reports
   * its verdict instead of enforcing it — so a dry run previews both the
   * data effects and whether the real run would be refused.
   */
  readonly dryRun?: boolean;
}

export interface LiquidSyncResult extends EntityMappingSyncResult {
  readonly mappingHash: string;
  /** Real runs are only ever true (unapproved throws); dry runs report it. */
  readonly mappingApproved: boolean;
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
  let mappingHash: string;
  let mappingApproved: boolean;
  if (input.dryRun) {
    mappingHash = entityMappingHash(input.mapping);
    const state = await getMappingApprovalState(
      deps.events,
      input.tenantId,
      input.appName,
    );
    mappingApproved = state.approvedHash === mappingHash;
  } else {
    mappingHash = await requireApprovedEntityMapping(
      deps.events,
      input.tenantId,
      input.appName,
      input.mapping,
    );
    mappingApproved = true;
  }
  const fetched = await fetchLiquidRecords(client, input);
  const result = await runEntityMappingSync(deps, {
    tenantId: input.tenantId,
    appName: input.appName,
    mapping: input.mapping,
    records: fetched.records,
    syncedBy: input.syncedBy,
    ...(input.authority !== undefined ? { authority: input.authority } : {}),
    ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
  });
  return {
    ...result,
    mappingHash,
    mappingApproved,
    adapterId: fetched.adapterId,
    skippedMissingId: fetched.skippedMissingId,
  };
}
