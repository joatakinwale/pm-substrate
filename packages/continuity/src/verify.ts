import type { TenantId } from "@pm/types";
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

export function verifyContinuityCheckpointChain(
  input: ContinuityCheckpointChainVerificationInput,
): ContinuityVerificationReport {
  const broken: string[] = [];
  const errors: string[] = [];
  let prior: string | null = null;
  const chronological = [...input.checkpoints].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );

  for (const checkpoint of chronological) {
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
    if (checkpoint.priorCheckpointHash !== prior) {
      broken.push(checkpoint.id);
      errors.push(
        `${checkpoint.id}: priorCheckpointHash mismatch expected=${prior ?? "null"} actual=${checkpoint.priorCheckpointHash ?? "null"}`,
      );
    }
    prior = checkpoint.contentHash;
  }

  return {
    tenantId: input.tenantId,
    agentId: input.agentId,
    valid: errors.length === 0,
    checked: chronological.length,
    brokenCheckpointIds: [...new Set(broken)],
    errors,
  };
}
