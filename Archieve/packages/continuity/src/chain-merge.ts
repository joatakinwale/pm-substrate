export const CONTINUITY_CHAIN_MERGE_KEY = "continuityChainMerge";

export interface ContinuityChainMergePayload {
  readonly schemaVersion: "continuity-chain-merge.v1";
  readonly mergedHeadHashes: readonly string[];
  readonly reason: string;
}

export interface ContinuityChainMergeParseResult {
  readonly value?: ContinuityChainMergePayload;
  readonly issue?: string;
}

const MERGE_FIELDS = new Set([
  "schemaVersion",
  "mergedHeadHashes",
  "reason",
]);

/**
 * Parses the reserved continuity merge envelope. Absence is valid because
 * ordinary checkpoints do not merge chain heads; presence is fail-closed so
 * the write path and the offline verifier cannot disagree about its shape.
 */
export function parseContinuityChainMergePayload(
  payload: Readonly<Record<string, unknown>>,
): ContinuityChainMergeParseResult {
  if (!Object.prototype.hasOwnProperty.call(payload, CONTINUITY_CHAIN_MERGE_KEY)) {
    return {};
  }

  const raw = payload[CONTINUITY_CHAIN_MERGE_KEY];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { issue: `${CONTINUITY_CHAIN_MERGE_KEY} must be an object` };
  }

  const value = raw as Readonly<Record<string, unknown>>;
  const fields = Object.keys(value);
  if (
    fields.length !== MERGE_FIELDS.size ||
    fields.some((field) => !MERGE_FIELDS.has(field))
  ) {
    return {
      issue:
        `${CONTINUITY_CHAIN_MERGE_KEY} must contain exactly ` +
        "schemaVersion, mergedHeadHashes, and reason",
    };
  }
  if (value["schemaVersion"] !== "continuity-chain-merge.v1") {
    return { issue: `${CONTINUITY_CHAIN_MERGE_KEY}.schemaVersion is invalid` };
  }

  const hashes = value["mergedHeadHashes"];
  const materializedHashes = Array.isArray(hashes) ? [...hashes] : [];
  if (
    !Array.isArray(hashes) ||
    hashes.length === 0 ||
    materializedHashes.some(
      (hash) => typeof hash !== "string" || hash.trim().length === 0,
    ) ||
    new Set(materializedHashes).size !== materializedHashes.length
  ) {
    return {
      issue:
        `${CONTINUITY_CHAIN_MERGE_KEY}.mergedHeadHashes must be ` +
        "unique non-empty strings",
    };
  }
  if (
    typeof value["reason"] !== "string" ||
    value["reason"].trim().length === 0
  ) {
    return { issue: `${CONTINUITY_CHAIN_MERGE_KEY}.reason must be non-empty` };
  }

  return {
    value: {
      schemaVersion: "continuity-chain-merge.v1",
      mergedHeadHashes: materializedHashes as string[],
      reason: value["reason"],
    },
  };
}
