/**
 * Mapping approvals — drift as obstruction (Liquid lane L3).
 *
 * An EntityMapping is only usable on the Liquid path once its content hash
 * is APPROVED on the admitted log. Discovery and self-repair therefore
 * cannot change what syncs: a new or repaired mapping lands as
 * `pm.mapping.proposed` (content-addressed, deduped), the owner admits it
 * (`pm.mapping.approved` — supersedes the previous approval) or refuses it
 * (`pm.mapping.rejected`), and `requireApprovedEntityMapping` is the gate
 * the governed entry points call before records flow. State is a fold over
 * the log; there is no approvals table to drift.
 */

import { canonicalStringify, fingerprint64 } from "@pm/agent-state-core";
import {
  validateEntityMapping,
  type EntityMapping,
} from "@pm/entity-mapping";
import type { EventPublisher, EventReader } from "@pm/events";
import type { EntityId, PMEvent, TenantId, Timestamp } from "@pm/types";

export const MAPPING_PROPOSED_EVENT_TYPE = "pm.mapping.proposed";
export const MAPPING_APPROVED_EVENT_TYPE = "pm.mapping.approved";
export const MAPPING_REJECTED_EVENT_TYPE = "pm.mapping.rejected";

export type MappingProposalOrigin =
  | "manual"
  | "liquid_discovery"
  | "liquid_repair";

export function entityMappingHash(mapping: EntityMapping): string {
  return fingerprint64(canonicalStringify(mapping));
}

const mappingEntityId = (appName: string): EntityId =>
  `entity_mapping:${appName}` as unknown as EntityId;

export interface MappingProposal {
  readonly appName: string;
  readonly mappingHash: string;
  readonly origin: MappingProposalOrigin;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
  readonly reason?: string;
  readonly mapping: EntityMapping;
}

export interface MappingApprovalState {
  /** Currently approved mapping (latest approval wins), if any. */
  readonly approvedHash?: string;
  readonly approvedMapping?: EntityMapping;
  readonly approvedBy?: string;
  /** Proposals neither approved nor rejected yet, oldest first. */
  readonly pending: readonly MappingProposal[];
}

export class MappingNotApprovedError extends Error {
  constructor(
    readonly appName: string,
    readonly mappingHash: string,
    readonly approvedHash: string | undefined,
    readonly pendingHashes: readonly string[],
  ) {
    super(
      `entity mapping ${mappingHash} for "${appName}" is not approved` +
        (approvedHash ? ` (approved: ${approvedHash})` : " (no approved mapping)") +
        (pendingHashes.includes(mappingHash)
          ? " — a proposal with this hash is PENDING; approve it with pm:mappings"
          : " — propose it first with pm:mappings"),
    );
    this.name = "MappingNotApprovedError";
  }
}

async function readMappingEvents(
  events: EventReader,
  tenantId: TenantId,
  appName: string,
): Promise<readonly PMEvent[]> {
  return events.read({
    tenantId,
    typePattern: "pm.mapping.*",
    entityId: mappingEntityId(appName),
  });
}

/** Fold the log into the current approval state for one app. */
export async function getMappingApprovalState(
  events: EventReader,
  tenantId: TenantId,
  appName: string,
): Promise<MappingApprovalState> {
  const rows = await readMappingEvents(events, tenantId, appName);
  const proposals = new Map<string, MappingProposal>();
  let approved:
    | { hash: string; mapping: EntityMapping; by: string }
    | undefined;
  const resolved = new Set<string>();
  for (const event of rows) {
    const p = event.payload as {
      mappingHash?: string;
      origin?: MappingProposalOrigin;
      proposedBy?: string;
      decidedBy?: string;
      reason?: string;
      mapping?: EntityMapping;
    };
    if (event.type === MAPPING_PROPOSED_EVENT_TYPE && p.mappingHash && p.mapping) {
      proposals.set(p.mappingHash, {
        appName,
        mappingHash: p.mappingHash,
        origin: p.origin ?? "manual",
        proposedBy: p.proposedBy ?? event.emittedBy,
        proposedAt: event.recordedAt,
        ...(p.reason !== undefined ? { reason: p.reason } : {}),
        mapping: p.mapping,
      });
    } else if (event.type === MAPPING_APPROVED_EVENT_TYPE && p.mappingHash) {
      resolved.add(p.mappingHash);
      const proposal = proposals.get(p.mappingHash);
      if (proposal) {
        approved = {
          hash: p.mappingHash,
          mapping: proposal.mapping,
          by: p.decidedBy ?? event.emittedBy,
        };
      }
    } else if (event.type === MAPPING_REJECTED_EVENT_TYPE && p.mappingHash) {
      resolved.add(p.mappingHash);
    }
  }
  const pending = [...proposals.values()].filter(
    (p) => !resolved.has(p.mappingHash),
  );
  return {
    ...(approved
      ? {
          approvedHash: approved.hash,
          approvedMapping: approved.mapping,
          approvedBy: approved.by,
        }
      : {}),
    pending,
  };
}

export interface ProposeMappingInput {
  readonly tenantId: TenantId;
  readonly appName: string;
  readonly mapping: EntityMapping;
  readonly proposedBy: string;
  readonly origin: MappingProposalOrigin;
  readonly reason?: string;
  readonly authority?: string;
}

export interface ProposeMappingResult {
  readonly mappingHash: string;
  /** false = identical proposal already pending or already approved. */
  readonly proposed: boolean;
  readonly alreadyApproved: boolean;
}

/** Record a mapping proposal (validated, content-addressed, deduped). */
export async function proposeEntityMapping(
  events: EventPublisher & EventReader,
  input: ProposeMappingInput,
): Promise<ProposeMappingResult> {
  const validation = validateEntityMapping(input.mapping);
  if (!validation.valid) {
    throw new Error(
      `refusing to propose an invalid mapping: ${validation.issues
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  const mappingHash = entityMappingHash(input.mapping);
  const state = await getMappingApprovalState(
    events,
    input.tenantId,
    input.appName,
  );
  if (state.approvedHash === mappingHash) {
    return { mappingHash, proposed: false, alreadyApproved: true };
  }
  if (state.pending.some((p) => p.mappingHash === mappingHash)) {
    return { mappingHash, proposed: false, alreadyApproved: false };
  }
  await events.publish({
    tenantId: input.tenantId,
    type: MAPPING_PROPOSED_EVENT_TYPE,
    entityId: mappingEntityId(input.appName),
    emittedBy: input.proposedBy,
    authority: input.authority ?? input.proposedBy,
    payloadSchema: `${MAPPING_PROPOSED_EVENT_TYPE}.v1`,
    payload: {
      appName: input.appName,
      mappingHash,
      origin: input.origin,
      proposedBy: input.proposedBy,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      mapping: input.mapping,
    },
  });
  return { mappingHash, proposed: true, alreadyApproved: false };
}

export interface DecideMappingInput {
  readonly tenantId: TenantId;
  readonly appName: string;
  readonly mappingHash: string;
  readonly decidedBy: string;
  readonly reason?: string;
  readonly authority?: string;
}

async function decide(
  events: EventPublisher & EventReader,
  input: DecideMappingInput,
  type: string,
): Promise<void> {
  const state = await getMappingApprovalState(
    events,
    input.tenantId,
    input.appName,
  );
  if (!state.pending.some((p) => p.mappingHash === input.mappingHash)) {
    throw new Error(
      `no pending proposal ${input.mappingHash} for "${input.appName}" — pending: [${state.pending
        .map((p) => p.mappingHash)
        .join(", ")}]`,
    );
  }
  await events.publish({
    tenantId: input.tenantId,
    type,
    entityId: mappingEntityId(input.appName),
    emittedBy: input.decidedBy,
    authority: input.authority ?? input.decidedBy,
    payloadSchema: `${type}.v1`,
    payload: {
      appName: input.appName,
      mappingHash: input.mappingHash,
      decidedBy: input.decidedBy,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    },
  });
}

/** Admit a pending proposal; supersedes any previously approved mapping. */
export async function approveEntityMapping(
  events: EventPublisher & EventReader,
  input: DecideMappingInput,
): Promise<void> {
  await decide(events, input, MAPPING_APPROVED_EVENT_TYPE);
}

/** Refuse a pending proposal (it stops obstructing nothing — it just closes). */
export async function rejectEntityMapping(
  events: EventPublisher & EventReader,
  input: DecideMappingInput,
): Promise<void> {
  await decide(events, input, MAPPING_REJECTED_EVENT_TYPE);
}

/**
 * The L3 gate: throw unless THIS mapping's hash is the approved one.
 * Governed entry points (the Liquid path) call this before any record flows.
 */
export async function requireApprovedEntityMapping(
  events: EventReader,
  tenantId: TenantId,
  appName: string,
  mapping: EntityMapping,
): Promise<string> {
  const mappingHash = entityMappingHash(mapping);
  const state = await getMappingApprovalState(events, tenantId, appName);
  if (state.approvedHash !== mappingHash) {
    throw new MappingNotApprovedError(
      appName,
      mappingHash,
      state.approvedHash,
      state.pending.map((p) => p.mappingHash),
    );
  }
  return mappingHash;
}
