import { createHash } from "node:crypto";
import type { ContinuityCheckpoint } from "./interfaces.js";

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
};

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const checkpointHash = (
  checkpoint: Omit<ContinuityCheckpoint, "contentHash">,
): string =>
  sha256Hex(canonicalize({
    id: checkpoint.id,
    tenantId: checkpoint.tenantId,
    agentId: checkpoint.agentId,
    scope: checkpoint.scope,
    kind: checkpoint.kind,
    title: checkpoint.title,
    summary: checkpoint.summary,
    evidenceEventIds: checkpoint.evidenceEventIds,
    decisionRefs: checkpoint.decisionRefs,
    status: checkpoint.status,
    payload: checkpoint.payload,
    createdAt: checkpoint.createdAt,
    priorCheckpointHash: checkpoint.priorCheckpointHash,
  }));
