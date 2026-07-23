import { createHash } from "node:crypto";
import type { PMEvent } from "@pm/types";

export interface EventProvenanceEnvelope {
  readonly id: string;
  readonly tenantId: string;
  readonly type: string;
  readonly entityId: string;
  readonly emittedBy: string;
  readonly authority: string | null;
  readonly payloadSchema: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly causedBy: string | null;
  readonly schemaVersion: number;
  readonly priorEventHash: string | null;
}

export interface EventAdmissibilityReport {
  readonly eventId: string;
  readonly admissible: boolean;
  readonly missing: readonly string[];
  readonly expectedContentHash: string;
  readonly actualContentHash: string | null;
}

export interface EventChainVerificationReport {
  readonly tenantId: string;
  readonly valid: boolean;
  readonly checked: number;
  readonly brokenEventIds: readonly string[];
  readonly errors: readonly string[];
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
};

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const eventContentHash = (envelope: EventProvenanceEnvelope): string =>
  sha256Hex(canonicalize(envelope));

export const admissibilityOf = (event: PMEvent): EventAdmissibilityReport => {
  const missing: string[] = [];
  if (!event.id) missing.push("id");
  if (!event.tenantId) missing.push("tenantId");
  if (!event.type) missing.push("type");
  if (!event.entityId) missing.push("entityId");
  if (!event.emittedBy) missing.push("emittedBy");
  if (!event.authority) missing.push("authority");
  if (!event.payloadSchema) missing.push("payloadSchema");
  if (!event.occurredAt) missing.push("occurredAt");
  if (!event.recordedAt) missing.push("recordedAt");
  if (!event.schemaVersion) missing.push("schemaVersion");
  if (!event.contentHash) missing.push("contentHash");

  const expectedContentHash = eventContentHash({
    id: event.id,
    tenantId: event.tenantId,
    type: event.type,
    entityId: event.entityId,
    emittedBy: event.emittedBy,
    authority: event.authority,
    payloadSchema: event.payloadSchema,
    payload: event.payload,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    causedBy: event.causedBy,
    schemaVersion: event.schemaVersion,
    priorEventHash: event.priorEventHash,
  });
  if (event.contentHash && event.contentHash !== expectedContentHash) {
    missing.push("contentHash:valid");
  }

  return {
    eventId: event.id,
    admissible: missing.length === 0,
    missing,
    expectedContentHash,
    actualContentHash: event.contentHash,
  };
};


export const verifyEventChain = (
  tenantId: string,
  events: readonly PMEvent[],
): EventChainVerificationReport => {
  const brokenEventIds: string[] = [];
  const errors: string[] = [];
  let previousHash: string | null = null;

  for (const event of events) {
    const admissibility = admissibilityOf(event);
    if (!admissibility.admissible) {
      brokenEventIds.push(event.id);
      errors.push(`${event.id}: ${admissibility.missing.join(",")}`);
    }
    if (event.priorEventHash !== previousHash) {
      brokenEventIds.push(event.id);
      errors.push(`${event.id}: priorEventHash mismatch expected=${previousHash ?? "null"} actual=${event.priorEventHash ?? "null"}`);
    }
    previousHash = event.contentHash;
  }

  return {
    tenantId,
    valid: errors.length === 0,
    checked: events.length,
    brokenEventIds: [...new Set(brokenEventIds)],
    errors,
  };
};
