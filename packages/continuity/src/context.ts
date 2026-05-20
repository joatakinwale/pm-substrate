import type {
  ContinuityCheckpoint,
  ContinuityLedger,
} from "./interfaces.js";
import type { TenantId } from "@pm/types";

export interface ContinuityContext {
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly decisions: readonly ContinuityCheckpoint[];
  readonly openWork: readonly ContinuityCheckpoint[];
  readonly lessons: readonly ContinuityCheckpoint[];
  readonly research: readonly ContinuityCheckpoint[];
  readonly claims: readonly ContinuityCheckpoint[];
}

export interface ContradictionFinding {
  readonly newer: ContinuityCheckpoint;
  readonly older: ContinuityCheckpoint;
  readonly reason: string;
}

const normTitle = (s: string): string => s.trim().toLowerCase();

/**
 * Reconstructs the minimum useful working context for an amnesiac agent.
 * This is the continuity primitive: prior conclusions become queryable state,
 * not chat recall.
 */
export async function buildContinuityContext(
  ledger: ContinuityLedger,
  input: {
    readonly tenantId: TenantId;
    readonly agentId: string;
    readonly scope: string;
    readonly limit?: number;
  },
): Promise<ContinuityContext> {
  const base = {
    tenantId: input.tenantId,
    agentId: input.agentId,
    scope: input.scope,
    limit: input.limit ?? 50,
  };
  const [decisions, openWork, lessons, research, claims] = await Promise.all([
    ledger.list({ ...base, kind: "decision" }),
    ledger.list({ ...base, kind: "work", status: "open" }),
    ledger.list({ ...base, kind: "lesson" }),
    ledger.list({ ...base, kind: "research" }),
    ledger.list({ ...base, kind: "claim" }),
  ]);
  return { tenantId: input.tenantId, agentId: input.agentId, scope: input.scope, decisions, openWork, lessons, research, claims };
}

/**
 * First serious coordination check: a later open decision/claim with the same
 * title but a different summary is a contradiction candidate. Superseded or
 * closed checkpoints are allowed to disagree because they are explicitly
 * historical.
 */
export function findContinuityContradictions(
  checkpoints: readonly ContinuityCheckpoint[],
): readonly ContradictionFinding[] {
  const seen = new Map<string, ContinuityCheckpoint>();
  const findings: ContradictionFinding[] = [];
  const chronological = [...checkpoints].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  for (const cp of chronological) {
    if (cp.status !== "open") continue;
    if (cp.kind !== "decision" && cp.kind !== "claim") continue;
    const key = `${cp.kind}:${normTitle(cp.title)}`;
    const older = seen.get(key);
    if (older && older.summary !== cp.summary) {
      findings.push({
        older,
        newer: cp,
        reason: `${cp.kind} "${cp.title}" has conflicting open summaries`,
      });
    }
    seen.set(key, cp);
  }
  return findings;
}
