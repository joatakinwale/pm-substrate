/**
 * Shadow report — "what WOULD have been blocked" (ROADMAP hard req 5).
 *
 * Shadow-first adoption means running warn-only with zero behavior change
 * and still being able to show, from the admitted log alone, exactly what
 * enforcement would have stopped. This fold answers that:
 *
 *   - advisory warnings — `pm.mcp.proposal` artifacts (hash-verified on
 *     import) whose review carries warnings: in blocking mode these are
 *     blocks. THE shadow number.
 *   - enforced blocks — `pm.mcp.action` with terminalOutcome=blocked plus
 *     `pm.executor.refused`: the gate doing real work.
 *   - data rejections — `pm.sync.rejected`: records the kit refused.
 *   - pending mapping obstructions — proposed-but-undecided mappings
 *     (drift waiting on the owner).
 *
 * Evidence-never-authority: every number is a fold over admitted events;
 * artifacts that fail hash verification are counted, not trusted.
 */

import { importStateReviewArtifact } from "@pm/agent-state-core";
import type { EventReader } from "@pm/events";
import type { TenantId, Timestamp } from "@pm/types";

import { getMappingApprovalState } from "./mapping-approval.js";

export interface ShadowReportWindow {
  readonly since?: Timestamp;
  readonly until?: Timestamp;
}

export interface ShadowReport {
  readonly tenantId: TenantId;
  readonly generatedAt: string;
  readonly window: ShadowReportWindow;
  readonly mcp: {
    readonly proposalsReviewed: number;
    /** Proposals whose advisory review warned — would block when enforced. */
    readonly proposalsWithWarnings: number;
    readonly warningCodes: Readonly<Record<string, number>>;
    readonly unverifiableArtifacts: number;
    readonly actionsAdmitted: number;
    readonly actionsBlocked: number;
    readonly blockingCauseCodes: Readonly<Record<string, number>>;
  };
  readonly executor: {
    readonly dispatched: number;
    readonly refused: number;
    readonly failed: number;
  };
  readonly sync: {
    readonly upserted: number;
    readonly rejected: number;
    readonly rejectionReasons: readonly string[];
  };
  readonly mappings: {
    readonly appsSeen: readonly string[];
    readonly pendingProposals: readonly {
      readonly appName: string;
      readonly mappingHash: string;
      readonly origin: string;
      readonly proposedAt: Timestamp;
    }[];
  };
  readonly totals: {
    /** The shadow verdict: warnings that enforcement would have stopped. */
    readonly advisoryWouldHaveBlocked: number;
    readonly enforcedBlocks: number;
    readonly dataRejections: number;
    readonly pendingMappingObstructions: number;
  };
}

const bump = (acc: Record<string, number>, key: string): void => {
  acc[key] = (acc[key] ?? 0) + 1;
};

/** Fold the shadow report for one tenant over an optional occurredAt window. */
export async function buildShadowReport(
  events: EventReader,
  input: { readonly tenantId: TenantId } & ShadowReportWindow,
): Promise<ShadowReport> {
  const window: ShadowReportWindow = {
    ...(input.since !== undefined ? { since: input.since } : {}),
    ...(input.until !== undefined ? { until: input.until } : {}),
  };
  const read = (typePattern: string) =>
    events.read({ tenantId: input.tenantId, typePattern, ...window });

  const [mcpEvents, executorEvents, syncEvents, mappingEvents] =
    await Promise.all([
      read("pm.mcp.*"),
      read("pm.executor.*"),
      read("pm.sync.*"),
      read("pm.mapping.*"),
    ]);

  let proposalsReviewed = 0;
  let proposalsWithWarnings = 0;
  let unverifiableArtifacts = 0;
  const warningCodes: Record<string, number> = {};
  let actionsAdmitted = 0;
  let actionsBlocked = 0;
  const blockingCauseCodes: Record<string, number> = {};
  for (const event of mcpEvents) {
    const payload = event.payload as {
      artifact?: unknown;
      terminalOutcome?: string;
      blockingCauseCodes?: readonly string[];
    };
    if (event.type === "pm.mcp.proposal") {
      proposalsReviewed += 1;
      const imported = importStateReviewArtifact(payload.artifact);
      if (!imported.valid || !imported.artifact) {
        unverifiableArtifacts += 1;
        continue;
      }
      const warnings = imported.artifact.review.warnings;
      if (warnings.length > 0) {
        proposalsWithWarnings += 1;
        for (const w of warnings) bump(warningCodes, w.code);
      }
    } else if (event.type === "pm.mcp.action") {
      if (payload.terminalOutcome === "blocked") {
        actionsBlocked += 1;
        for (const code of payload.blockingCauseCodes ?? []) {
          bump(blockingCauseCodes, code);
        }
      } else if (payload.terminalOutcome === "accepted") {
        actionsAdmitted += 1;
      }
    }
  }

  let dispatched = 0;
  let refused = 0;
  let failed = 0;
  for (const event of executorEvents) {
    if (event.type === "pm.executor.dispatched") dispatched += 1;
    else if (event.type === "pm.executor.refused") refused += 1;
    else if (event.type === "pm.executor.failed") failed += 1;
  }

  let upserted = 0;
  const rejectionReasons: string[] = [];
  for (const event of syncEvents) {
    if (event.type === "pm.sync.upserted") upserted += 1;
    else if (event.type === "pm.sync.rejected") {
      const reason = (event.payload as { reason?: string }).reason;
      rejectionReasons.push(reason ?? "(unrecorded)");
    }
  }

  const appsSeen = [
    ...new Set(
      mappingEvents
        .map((e) => (e.payload as { appName?: string }).appName)
        .filter((a): a is string => typeof a === "string"),
    ),
  ].sort();
  const pendingProposals: {
    appName: string;
    mappingHash: string;
    origin: string;
    proposedAt: Timestamp;
  }[] = [];
  for (const appName of appsSeen) {
    const state = await getMappingApprovalState(
      events,
      input.tenantId,
      appName,
    );
    for (const p of state.pending) {
      pendingProposals.push({
        appName,
        mappingHash: p.mappingHash,
        origin: p.origin,
        proposedAt: p.proposedAt,
      });
    }
  }

  return {
    tenantId: input.tenantId,
    generatedAt: new Date().toISOString(),
    window,
    mcp: {
      proposalsReviewed,
      proposalsWithWarnings,
      warningCodes,
      unverifiableArtifacts,
      actionsAdmitted,
      actionsBlocked,
      blockingCauseCodes,
    },
    executor: { dispatched, refused, failed },
    sync: {
      upserted,
      rejected: rejectionReasons.length,
      rejectionReasons: rejectionReasons.slice(0, 20),
    },
    mappings: { appsSeen, pendingProposals },
    totals: {
      advisoryWouldHaveBlocked: proposalsWithWarnings,
      enforcedBlocks: actionsBlocked + refused,
      dataRejections: rejectionReasons.length,
      pendingMappingObstructions: pendingProposals.length,
    },
  };
}
