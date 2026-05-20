import type { EventId, TenantId, Timestamp } from "@pm/types";

export type CheckpointKind = "work" | "decision" | "lesson" | "research" | "handoff" | "claim";
export type CheckpointStatus = "open" | "superseded" | "closed";

export interface ContinuityCheckpoint {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly kind: CheckpointKind;
  readonly title: string;
  readonly summary: string;
  readonly evidenceEventIds: readonly EventId[];
  readonly decisionRefs: readonly string[];
  readonly status: CheckpointStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
  readonly contentHash: string;
  readonly priorCheckpointHash: string | null;
}

export interface RecordCheckpointInput {
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly kind: CheckpointKind;
  readonly title: string;
  readonly summary: string;
  readonly evidenceEventIds?: readonly EventId[];
  readonly decisionRefs?: readonly string[];
  readonly status?: CheckpointStatus;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface CheckpointQuery {
  readonly tenantId: TenantId;
  readonly agentId?: string;
  readonly scope?: string;
  readonly kind?: CheckpointKind;
  readonly status?: CheckpointStatus;
  readonly limit?: number;
}

export interface ContinuityVerificationReport {
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly valid: boolean;
  readonly checked: number;
  readonly brokenCheckpointIds: readonly string[];
  readonly errors: readonly string[];
}

export interface ContinuityLedger {
  record(input: RecordCheckpointInput): Promise<ContinuityCheckpoint>;
  get(tenantId: TenantId, id: string): Promise<ContinuityCheckpoint | null>;
  list(query: CheckpointQuery): Promise<readonly ContinuityCheckpoint[]>;
  verify(tenantId: TenantId, agentId: string): Promise<ContinuityVerificationReport>;
}
