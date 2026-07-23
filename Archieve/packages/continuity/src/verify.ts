import type { TenantId } from "@pm/types";
import {
  CONTINUITY_CHAIN_MERGE_KEY,
  parseContinuityChainMergePayload,
  type ContinuityChainMergePayload,
} from "./chain-merge.js";
import { checkpointHash } from "./hash.js";
import type {
  ContinuityCheckpoint,
  ContinuityVerificationReport,
} from "./interfaces.js";

export interface ContinuityCheckpointChainVerificationInput {
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly checkpoints: readonly ContinuityCheckpoint[];
}

export interface ContinuityChainRepairPlan {
  readonly needed: boolean;
  readonly canonicalHeadHash: string | null;
  readonly mergedHeadHashes: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

function chronological(
  checkpoints: readonly ContinuityCheckpoint[],
): readonly ContinuityCheckpoint[] {
  return [...checkpoints].sort((a, b) => {
    const timeOrder = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    if (timeOrder !== 0) return timeOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function chainHeads(
  checkpoints: readonly ContinuityCheckpoint[],
): readonly ContinuityCheckpoint[] {
  const referenced = new Set<string>();
  for (const checkpoint of checkpoints) {
    if (checkpoint.priorCheckpointHash !== null) referenced.add(checkpoint.priorCheckpointHash);
    const merge = parseContinuityChainMergePayload(checkpoint.payload).value;
    for (const hash of merge?.mergedHeadHashes ?? []) referenced.add(hash);
  }
  return chronological(checkpoints).filter((checkpoint) => !referenced.has(checkpoint.contentHash));
}

/**
 * Builds the payload for an explicit append-only merge of concurrent chain
 * heads. The runtime `dev:repair-chain` command consumes this plan; no existing
 * checkpoint or hash is rewritten.
 */
export function buildContinuityChainRepairPlan(
  checkpoints: readonly ContinuityCheckpoint[],
  reason: string,
): ContinuityChainRepairPlan {
  if (reason.trim().length === 0) throw new Error("chain repair reason is required");
  const heads = chainHeads(checkpoints);
  const canonical = heads.at(-1);
  const merged = heads.slice(0, -1).map((checkpoint) => checkpoint.contentHash);
  return {
    needed: merged.length > 0,
    canonicalHeadHash: canonical?.contentHash ?? null,
    mergedHeadHashes: merged,
    payload:
      merged.length === 0
        ? {}
        : {
            [CONTINUITY_CHAIN_MERGE_KEY]: {
              schemaVersion: "continuity-chain-merge.v1",
              mergedHeadHashes: merged,
              reason,
            } satisfies ContinuityChainMergePayload,
          },
  };
}

/**
 * Verifies an append-only hash chain. A concurrency fork remains invalid until
 * a later checkpoint explicitly references every orphan head through a hashed
 * `continuityChainMerge` payload. This preserves the original fork evidence
 * while restoring one auditable head; it never rewrites history.
 */
export function verifyContinuityCheckpointChain(
  input: ContinuityCheckpointChainVerificationInput,
): ContinuityVerificationReport {
  const broken: string[] = [];
  const errors: string[] = [];
  const byHash = new Map<string, ContinuityCheckpoint>();

  for (const checkpoint of input.checkpoints) {
    if (checkpoint.tenantId !== input.tenantId) {
      broken.push(checkpoint.id);
      errors.push(
        `${checkpoint.id}: tenantId mismatch expected=${input.tenantId} actual=${checkpoint.tenantId}`,
      );
    }
    if (checkpoint.agentId !== input.agentId) {
      broken.push(checkpoint.id);
      errors.push(
        `${checkpoint.id}: agentId mismatch expected=${input.agentId} actual=${checkpoint.agentId}`,
      );
    }

    const { contentHash: _contentHash, ...withoutHash } = checkpoint;
    const expected = checkpointHash(withoutHash);
    if (checkpoint.contentHash !== expected) {
      broken.push(checkpoint.id);
      errors.push(`${checkpoint.id}: contentHash mismatch`);
    }
    if (byHash.has(checkpoint.contentHash)) {
      broken.push(checkpoint.id);
      errors.push(`${checkpoint.id}: duplicate contentHash`);
    }
    byHash.set(checkpoint.contentHash, checkpoint);
  }

  const roots = input.checkpoints.filter(
    (checkpoint) => checkpoint.priorCheckpointHash === null,
  );
  if (input.checkpoints.length > 0 && roots.length !== 1) {
    for (const root of roots) broken.push(root.id);
    errors.push(
      `continuity chain requires exactly one genesis checkpoint; found ${roots.length}: ` +
        roots.map((root) => root.id).join(", "),
    );
  }

  const referencingChildren = new Map<string, Set<string>>();
  const addReference = (parentHash: string, childId: string): void => {
    const children = referencingChildren.get(parentHash) ?? new Set<string>();
    children.add(childId);
    referencingChildren.set(parentHash, children);
  };
  for (const checkpoint of input.checkpoints) {
    if (checkpoint.priorCheckpointHash !== null) {
      addReference(checkpoint.priorCheckpointHash, checkpoint.id);
    }
    for (const hash of parseContinuityChainMergePayload(checkpoint.payload).value
      ?.mergedHeadHashes ?? []) {
      addReference(hash, checkpoint.id);
    }
  }

  for (const checkpoint of input.checkpoints) {
    if (
      checkpoint.priorCheckpointHash !== null &&
      !byHash.has(checkpoint.priorCheckpointHash)
    ) {
      broken.push(checkpoint.id);
      errors.push(
        `${checkpoint.id}: priorCheckpointHash mismatch; parent ${checkpoint.priorCheckpointHash} is absent`,
      );
    }
    const merge = parseContinuityChainMergePayload(checkpoint.payload);
    if (merge.issue !== undefined) {
      broken.push(checkpoint.id);
      errors.push(`${checkpoint.id}: ${merge.issue}`);
      continue;
    }
    if (merge.value !== undefined && checkpoint.priorCheckpointHash === null) {
      broken.push(checkpoint.id);
      errors.push(`${checkpoint.id}: merge checkpoint requires a primary parent`);
    }
    for (const hash of merge.value?.mergedHeadHashes ?? []) {
      const parent = byHash.get(hash);
      if (parent === undefined) {
        broken.push(checkpoint.id);
        errors.push(`${checkpoint.id}: merged head ${hash} is absent`);
      } else if (hash === checkpoint.priorCheckpointHash) {
        broken.push(checkpoint.id);
        errors.push(`${checkpoint.id}: merged head duplicates priorCheckpointHash`);
      }
    }
    if (merge.value !== undefined && checkpoint.priorCheckpointHash !== null) {
      const mergeParents = [
        checkpoint.priorCheckpointHash,
        ...merge.value.mergedHeadHashes,
      ];
      for (const parentHash of mergeParents) {
        const children = referencingChildren.get(parentHash) ?? new Set<string>();
        if (children.size !== 1 || !children.has(checkpoint.id)) {
          broken.push(checkpoint.id);
          errors.push(
            `${checkpoint.id}: merge parent ${parentHash} was not an unmerged head`,
          );
        }
      }
      if (new Set(mergeParents).size !== mergeParents.length) {
        broken.push(checkpoint.id);
        errors.push(`${checkpoint.id}: merge parents must be distinct`);
      }
    }
  }

  const heads = chainHeads(input.checkpoints);
  if (input.checkpoints.length > 0 && heads.length !== 1) {
    errors.push(
      `continuity chain has ${heads.length} unmerged heads: ${heads.map((head) => head.id).join(", ")}`,
    );
  }

  if (heads.length === 1) {
    const reachable = new Set<string>();
    const pending = [heads[0]!.contentHash];
    while (pending.length > 0) {
      const hash = pending.pop()!;
      if (reachable.has(hash)) continue;
      reachable.add(hash);
      const checkpoint = byHash.get(hash);
      if (checkpoint === undefined) continue;
      if (checkpoint.priorCheckpointHash !== null) pending.push(checkpoint.priorCheckpointHash);
      const merge = parseContinuityChainMergePayload(checkpoint.payload).value;
      pending.push(...(merge?.mergedHeadHashes ?? []));
    }
    for (const checkpoint of input.checkpoints) {
      if (!reachable.has(checkpoint.contentHash)) {
        broken.push(checkpoint.id);
        errors.push(`${checkpoint.id}: checkpoint is not reachable from the sole chain head`);
      }
    }
  }

  return {
    tenantId: input.tenantId,
    agentId: input.agentId,
    valid: errors.length === 0,
    checked: input.checkpoints.length,
    brokenCheckpointIds: [...new Set(broken)],
    errors,
  };
}
