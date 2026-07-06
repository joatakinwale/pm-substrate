/**
 * Entity-mapping sync-runner (ROADMAP D5b) — the zero-rewrite data plane.
 *
 * An app keeps its existing storage and endpoints; the kit pulls records
 * (any transport — the runner takes plain rows, `pm:sync` reads a JSON
 * export) and projects them onto Tier-1 primitives through the app's
 * declarative `EntityMapping` (@pm/entity-mapping). Nothing app-specific
 * lives here.
 *
 * Identity is deterministic: a node's id is UUIDv5 of
 * `tenant/app/sourceName/externalId`, so re-syncing NEVER duplicates —
 * the same source record always lands on the same node. Change detection
 * is content-addressed (house canonical hash of the mapped identity bag):
 *
 *   - unknown id            → createNode            → `created`
 *   - known id, same hash   → no write, no event    → `unchanged`
 *   - known id, new hash    → updateNode (optimistic) → `updated`
 *   - row that won't map    → `pm.sync.rejected` event, sync continues
 *
 * Every write is announced on the admitted log (`pm.sync.upserted`) with
 * full source provenance (app, sourceName, externalId, identityHash), so
 * the control plane can answer "where did this node come from?" without
 * trusting anything but the log. Edge sync is the declared follow-up —
 * `result.nodeIds` already exposes the id map an edge pass needs.
 */

import { createHash } from "node:crypto";

import { canonicalStringify, fingerprint64 } from "@pm/agent-state-core";
import {
  applyEdgeMapping,
  applyMapping,
  validateEntityMapping,
  type EntityMapping,
} from "@pm/entity-mapping";
import type { EventPublisher } from "@pm/events";
import type { CreateNodeResult, GraphReader, GraphWriter } from "@pm/graph";
import type { EntityId, TenantId } from "@pm/types";

export const SYNC_UPSERTED_EVENT_TYPE = "pm.sync.upserted";
export const SYNC_REJECTED_EVENT_TYPE = "pm.sync.rejected";

/** Fixed namespace for substrate sync identity (RFC 4122 v5). Never change. */
export const SYNC_ID_NAMESPACE = "3c1a2f60-9e4b-5d78-8a2c-f0b1d4e6c9a7";

/** A relationship the source record participates in, by external ids. */
export interface SourceEdge {
  /** Edge key as declared under the entity's `edges` in the mapping. */
  readonly edgeKey: string;
  readonly targetSourceName: string;
  readonly targetExternalId: string;
}

/** One record from the app's existing read surface. */
export interface SourceRecord {
  /** Entity name as declared under `mapping.entities`. */
  readonly sourceName: string;
  /** The app's own stable id for this record (PK, slug, …). */
  readonly externalId: string;
  readonly row: Readonly<Record<string, unknown>>;
  /** Relationships (FKs) as the app already expresses them. */
  readonly edges?: readonly SourceEdge[];
}

export interface EntityMappingSyncInput {
  readonly tenantId: TenantId;
  /** Stable app namespace, e.g. "orbit_crm". Part of node identity. */
  readonly appName: string;
  readonly mapping: EntityMapping;
  readonly records: readonly SourceRecord[];
  readonly syncedBy: string;
  /** Chain-of-custody grant; defaults to syncedBy. */
  readonly authority?: string;
  /**
   * Shadow mode (hard req 5): compute the full verdict — created/updated/
   * unchanged/edges/rejections — with ZERO writes and ZERO events. Reads
   * still hit the graph so the counts are what a real run would do.
   */
  readonly dryRun?: boolean;
}

export interface SyncRejection {
  readonly sourceName: string;
  readonly externalId: string;
  readonly reason: string;
}

export interface EntityMappingSyncResult {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly edgesCreated: number;
  readonly edgesUnchanged: number;
  readonly rejected: readonly SyncRejection[];
  /** `${sourceName}:${externalId}` → node id. */
  readonly nodeIds: Readonly<Record<string, string>>;
  /** true = shadow verdict: nothing was written, no events were emitted. */
  readonly dryRun: boolean;
}

const uuidBytes = (uuid: string): Buffer =>
  Buffer.from(uuid.replaceAll("-", ""), "hex");

/** RFC 4122 UUIDv5 (SHA-1, name-based) — deterministic node identity. */
export function uuidV5(name: string, namespace: string): string {
  const hash = createHash("sha1")
    .update(uuidBytes(namespace))
    .update(name, "utf8")
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic node id for a source record — same record, same node, always. */
export function syncNodeId(
  tenantId: TenantId,
  appName: string,
  sourceName: string,
  externalId: string,
): string {
  return uuidV5(
    `${tenantId}/${appName}/${sourceName}/${externalId}`,
    SYNC_ID_NAMESPACE,
  );
}

export type SyncGraph = Pick<GraphReader, "getNode" | "outgoingEdges"> &
  Pick<GraphWriter, "createNode" | "updateNode" | "createEdge">;

export interface EntityMappingSyncDeps {
  readonly graph: SyncGraph;
  readonly events: EventPublisher;
}

const identityHashOf = (identity: Readonly<Record<string, unknown>>): string =>
  fingerprint64(canonicalStringify(identity));

/**
 * Run one sync pass. Validates the mapping document up front (throws on a
 * malformed document — that is a programmer/config error, not a data error);
 * per-record failures reject that record and continue.
 */
export async function runEntityMappingSync(
  deps: EntityMappingSyncDeps,
  input: EntityMappingSyncInput,
): Promise<EntityMappingSyncResult> {
  const validation = validateEntityMapping(input.mapping);
  if (!validation.valid) {
    throw new Error(
      `entity mapping invalid: ${validation.issues
        .map((i) => i.message)
        .join("; ")}`,
    );
  }

  const authority = input.authority ?? input.syncedBy;
  const dryRun = input.dryRun ?? false;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const rejected: SyncRejection[] = [];
  const nodeIds: Record<string, string> = {};
  /** Keys whose node already existed before this run (edge dry-run needs it). */
  const existedBefore = new Set<string>();

  for (const record of input.records) {
    const nodeId = syncNodeId(
      input.tenantId,
      input.appName,
      record.sourceName,
      record.externalId,
    );
    let op: "created" | "updated";
    let identityHash: string;
    try {
      const nodeInput = applyMapping(
        input.mapping,
        record.sourceName,
        record.row,
        { tenantId: input.tenantId, id: nodeId },
      );
      identityHash = identityHashOf(nodeInput.identity);
      const existing = await deps.graph.getNode(
        input.tenantId,
        nodeId as unknown as EntityId,
      );
      if (existing !== null) {
        existedBefore.add(`${record.sourceName}:${record.externalId}`);
      }
      if (existing === null) {
        if (dryRun) {
          created += 1;
          nodeIds[`${record.sourceName}:${record.externalId}`] = nodeId;
          continue;
        }
        const result: CreateNodeResult = await deps.graph.createNode(nodeInput);
        if (!result.created) {
          // Deterministic id already present from a previous partial run.
          unchanged += 1;
          nodeIds[`${record.sourceName}:${record.externalId}`] = nodeId;
          continue;
        }
        created += 1;
        op = "created";
      } else if (identityHashOf(existing.identity) === identityHash) {
        unchanged += 1;
        nodeIds[`${record.sourceName}:${record.externalId}`] = nodeId;
        continue;
      } else {
        if (dryRun) {
          updated += 1;
          nodeIds[`${record.sourceName}:${record.externalId}`] = nodeId;
          continue;
        }
        await deps.graph.updateNode({
          tenantId: input.tenantId,
          id: nodeId as unknown as EntityId,
          identity: nodeInput.identity,
          expectedRevision: existing.revision,
          expectedSchemaVersion: existing.schemaVersion,
        });
        updated += 1;
        op = "updated";
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      rejected.push({
        sourceName: record.sourceName,
        externalId: record.externalId,
        reason,
      });
      if (!dryRun) {
        await deps.events.publish({
          tenantId: input.tenantId,
          type: SYNC_REJECTED_EVENT_TYPE,
          entityId: `sync_reject:${record.sourceName}:${record.externalId}` as unknown as EntityId,
          emittedBy: input.syncedBy,
          authority,
          payloadSchema: `${SYNC_REJECTED_EVENT_TYPE}.v1`,
          payload: {
            appName: input.appName,
            sourceName: record.sourceName,
            externalId: record.externalId,
            reason,
          },
        });
      }
      continue;
    }
    nodeIds[`${record.sourceName}:${record.externalId}`] = nodeId;
    await deps.events.publish({
      tenantId: input.tenantId,
      type: SYNC_UPSERTED_EVENT_TYPE,
      entityId: nodeId as unknown as EntityId,
      emittedBy: input.syncedBy,
      authority,
      payloadSchema: `${SYNC_UPSERTED_EVENT_TYPE}.v1`,
      payload: {
        appName: input.appName,
        sourceName: record.sourceName,
        externalId: record.externalId,
        nodeId,
        op,
        identityHash,
      },
    });
  }

  // Edge pass — after the node pass, so both endpoints of an intra-batch
  // edge already exist. Targets from PREVIOUS syncs also resolve, because
  // identity is deterministic: syncNodeId recomputes the target's node id
  // from its external coordinates without needing it in this batch.
  let edgesCreated = 0;
  let edgesUnchanged = 0;
  for (const record of input.records) {
    if (!record.edges || record.edges.length === 0) continue;
    const fromKey = `${record.sourceName}:${record.externalId}`;
    const fromId = nodeIds[fromKey];
    if (fromId === undefined) continue; // the node itself was rejected
    for (const edge of record.edges) {
      const toId = syncNodeId(
        input.tenantId,
        input.appName,
        edge.targetSourceName,
        edge.targetExternalId,
      );
      try {
        const edgeInput = applyEdgeMapping(
          input.mapping,
          record.sourceName,
          edge.edgeKey,
          { fromId, toId },
          { tenantId: input.tenantId },
        );
        const fromKey = `${record.sourceName}:${record.externalId}`;
        if (dryRun && !existedBefore.has(fromKey)) {
          // Node itself is only simulated — its edges would all be new.
          edgesCreated += 1;
          continue;
        }
        const existing = await deps.graph.outgoingEdges(
          input.tenantId,
          fromId as unknown as EntityId,
          edgeInput.type,
        );
        if (existing.some((e) => (e.toId as string) === toId)) {
          edgesUnchanged += 1;
          continue;
        }
        if (dryRun) {
          edgesCreated += 1;
          continue;
        }
        await deps.graph.createEdge({
          tenantId: input.tenantId,
          type: edgeInput.type,
          fromId: fromId as unknown as EntityId,
          toId: toId as unknown as EntityId,
          attrs: edgeInput.attrs,
        });
        edgesCreated += 1;
        await deps.events.publish({
          tenantId: input.tenantId,
          type: SYNC_UPSERTED_EVENT_TYPE,
          entityId: fromId as unknown as EntityId,
          emittedBy: input.syncedBy,
          authority,
          payloadSchema: `${SYNC_UPSERTED_EVENT_TYPE}.v1`,
          payload: {
            appName: input.appName,
            sourceName: record.sourceName,
            externalId: record.externalId,
            nodeId: fromId,
            op: "edge_created",
            edgeKey: edge.edgeKey,
            edgeType: edgeInput.type,
            toId,
          },
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        rejected.push({
          sourceName: record.sourceName,
          externalId: record.externalId,
          reason: `edge "${edge.edgeKey}": ${reason}`,
        });
        if (!dryRun) {
          await deps.events.publish({
            tenantId: input.tenantId,
            type: SYNC_REJECTED_EVENT_TYPE,
            entityId:
              `sync_reject:${record.sourceName}:${record.externalId}:${edge.edgeKey}` as unknown as EntityId,
            emittedBy: input.syncedBy,
            authority,
            payloadSchema: `${SYNC_REJECTED_EVENT_TYPE}.v1`,
            payload: {
              appName: input.appName,
              sourceName: record.sourceName,
              externalId: record.externalId,
              edgeKey: edge.edgeKey,
              reason,
            },
          });
        }
      }
    }
  }

  return {
    created,
    updated,
    unchanged,
    edgesCreated,
    edgesUnchanged,
    rejected,
    nodeIds,
    dryRun,
  };
}
