/**
 * External adapter registry — the substrate's front door for OUTSIDE tools
 * (ROADMAP D5a, decision chk_565b7eb9: generic-first, never app-specific).
 *
 * An adapter is a tool that runs OUTSIDE the substrate — an agent harness
 * (pi), a browser-QA harness (canary), a mapping proposer (Liquid, once
 * located) — and is governed at the boundary, never imported. Its contract
 * DECLARES:
 *
 *   - what it does (`capabilities`),
 *   - what it consumes and produces (`inputContracts` / `outputArtifacts`),
 *   - which gates must hold whenever it runs (`requiredGates`),
 *   - what evidence every run must emit (`evidenceFields`),
 *   - the exact pinned source it was reviewed at (`source.url` + commit).
 *
 * Registration is an admitted event (`pm.adapter.registered`), content-
 * addressed with the house canonical hash: re-registering identical content
 * is a structural no-op, and any change is a NEW version event — the
 * registry never mutates in place. Current state is a fold over the log;
 * there is no second table to drift.
 */

import { canonicalStringify, fingerprint64 } from "@pm/agent-state-core";
import type { EventPublisher, EventReader } from "@pm/events";
import type { EntityId, PMEvent, TenantId, Timestamp } from "@pm/types";
import { z } from "zod";

export const ADAPTER_REGISTERED_EVENT_TYPE = "pm.adapter.registered";

export const EXTERNAL_ADAPTER_TYPES = [
  "agent_harness",
  "browser_qa_harness",
  "mapping_proposer",
  "action_executor",
  "sync_source",
] as const;
export type ExternalAdapterType = (typeof EXTERNAL_ADAPTER_TYPES)[number];

export const EXTERNAL_ADAPTER_BOUNDARIES = [
  "sandboxed_process",
  "containerized_process",
  "remote_service",
] as const;
export type ExternalAdapterBoundary =
  (typeof EXTERNAL_ADAPTER_BOUNDARIES)[number];

/** Exact source the contract was reviewed against — commit, not branch. */
export interface ExternalAdapterSource {
  readonly url: string;
  readonly commit: string;
}

export interface ExternalAdapterContract {
  /** Stable snake_case identity, e.g. "pi_harness". */
  readonly id: string;
  readonly name: string;
  readonly adapterType: ExternalAdapterType;
  readonly boundary: ExternalAdapterBoundary;
  readonly purpose: string;
  readonly capabilities: readonly string[];
  readonly inputContracts: readonly string[];
  readonly outputArtifacts: readonly string[];
  /** Gates that must hold on every run — enforced by the admission path. */
  readonly requiredGates: readonly string[];
  /** Fields every run's evidence payload must carry to be admissible. */
  readonly evidenceFields: readonly string[];
  readonly source: ExternalAdapterSource;
  readonly notes?: Readonly<Record<string, string>>;
}

const nonEmpty = z.string().min(1);

export const externalAdapterContractSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z][a-z0-9_]*$/, "snake_case, lowercase, starts with letter"),
    name: nonEmpty,
    adapterType: z.enum(EXTERNAL_ADAPTER_TYPES),
    boundary: z.enum(EXTERNAL_ADAPTER_BOUNDARIES),
    purpose: nonEmpty,
    capabilities: z.array(nonEmpty).min(1),
    inputContracts: z.array(nonEmpty).min(1),
    outputArtifacts: z.array(nonEmpty).min(1),
    requiredGates: z.array(nonEmpty).min(1),
    evidenceFields: z.array(nonEmpty).min(1),
    source: z
      .object({
        url: z.string().url(),
        commit: z.string().regex(/^[0-9a-f]{7,64}$/, "commit sha (pin, not branch)"),
      })
      .strict(),
    notes: z.record(z.string()).optional(),
  })
  .strict();

/** Validate untrusted input (CLI files, HTTP bodies) into a contract. */
export function parseExternalAdapterContract(
  input: unknown,
): ExternalAdapterContract {
  return externalAdapterContractSchema.parse(input) as ExternalAdapterContract;
}

/** House canonical content hash — key-order independent. */
export function externalAdapterContentHash(
  contract: ExternalAdapterContract,
): string {
  return fingerprint64(canonicalStringify(contract));
}

const registeredPayloadSchema = z
  .object({
    adapterId: nonEmpty,
    contentHash: nonEmpty,
    version: z.number().int().min(1),
    registeredBy: nonEmpty,
    contract: externalAdapterContractSchema,
  })
  .strict();

export interface RegisteredExternalAdapter {
  readonly contract: ExternalAdapterContract;
  readonly contentHash: string;
  readonly version: number;
  readonly registeredBy: string;
  readonly registeredAt: Timestamp;
}

export interface RegisterExternalAdapterInput {
  readonly tenantId: TenantId;
  readonly registeredBy: string;
  readonly contract: ExternalAdapterContract;
  /** Chain-of-custody grant; defaults to registeredBy. */
  readonly authority?: string;
}

export interface RegisterExternalAdapterResult {
  readonly adapterId: string;
  readonly contentHash: string;
  readonly version: number;
  /** false = identical content already registered (idempotent no-op). */
  readonly registered: boolean;
}

const adapterEntityId = (adapterId: string): EntityId =>
  `external_adapter:${adapterId}` as unknown as EntityId;

function foldAdapterEvents(
  rows: readonly PMEvent[],
): Map<string, RegisteredExternalAdapter> {
  const latest = new Map<string, RegisteredExternalAdapter>();
  for (const event of rows) {
    const payload = registeredPayloadSchema.parse(event.payload);
    const prior = latest.get(payload.adapterId);
    if (prior && prior.version >= payload.version) continue;
    latest.set(payload.adapterId, {
      contract: payload.contract as ExternalAdapterContract,
      contentHash: payload.contentHash,
      version: payload.version,
      registeredBy: payload.registeredBy,
      registeredAt: event.recordedAt,
    });
  }
  return latest;
}

/**
 * Register (or version-bump) an adapter contract through the admitted log.
 * Identical content is a no-op; changed content appends the next version.
 */
export async function registerExternalAdapter(
  events: EventPublisher & EventReader,
  input: RegisterExternalAdapterInput,
): Promise<RegisterExternalAdapterResult> {
  const contract = parseExternalAdapterContract(input.contract);
  const contentHash = externalAdapterContentHash(contract);
  const existing = await events.read({
    tenantId: input.tenantId,
    typePattern: ADAPTER_REGISTERED_EVENT_TYPE,
    entityId: adapterEntityId(contract.id),
  });
  const current = foldAdapterEvents(existing).get(contract.id);
  if (current && current.contentHash === contentHash) {
    return {
      adapterId: contract.id,
      contentHash,
      version: current.version,
      registered: false,
    };
  }
  const version = (current?.version ?? 0) + 1;
  await events.publish({
    tenantId: input.tenantId,
    type: ADAPTER_REGISTERED_EVENT_TYPE,
    entityId: adapterEntityId(contract.id),
    emittedBy: input.registeredBy,
    authority: input.authority ?? input.registeredBy,
    payloadSchema: `${ADAPTER_REGISTERED_EVENT_TYPE}.v1`,
    payload: {
      adapterId: contract.id,
      contentHash,
      version,
      registeredBy: input.registeredBy,
      contract,
    },
  });
  return { adapterId: contract.id, contentHash, version, registered: true };
}

/** Current registry state: latest version per adapter, folded from the log. */
export async function listExternalAdapters(
  events: EventReader,
  tenantId: TenantId,
): Promise<readonly RegisteredExternalAdapter[]> {
  const rows = await events.read({
    tenantId,
    typePattern: ADAPTER_REGISTERED_EVENT_TYPE,
  });
  return [...foldAdapterEvents(rows).values()].sort((a, b) =>
    a.contract.id.localeCompare(b.contract.id),
  );
}
