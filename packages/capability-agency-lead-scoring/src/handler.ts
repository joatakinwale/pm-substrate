/**
 * LeadScoringHandler — agency.lead-scoring capability handler.
 *
 * G10 phase 2: refactored onto `@pm/capability-kit`. Pre-G10 this was 223
 * lines of hand-rolled transactional code; now it's ~85 lines of
 * declarative spec. Behavior is identical; lead-scoring tests pass
 * unchanged.
 *
 * Topology (unchanged from pre-G10):
 *   leadId
 *     → outgoingEdges("agency/lead_scored_by") → configId               (preferred)
 *     ↘ outgoingEdges("agency/lead_assigned_to_user") → userId
 *           → outgoingEdges("agency/user_default_scoring") → configId   (fallback)
 *
 * If neither path resolves, the kit commits the idempotency row and
 * returns — same "seen and intentionally skipped" semantics as before.
 */

import {
  defineCapability,
  type CapabilityHandler,
  type CapabilityRuntimeDeps,
} from "@pm/capability-kit";
import type { EntityId, TenantId } from "@pm/types";

export interface LeadScoringEventPayload {
  /** EntityId of the Lead whose progression triggered the scoring update. */
  readonly leadId: EntityId;
  /**
   * Score delta to apply, in arbitrary scoring units (positive or negative).
   * The rollup field counts leads scored, not the cumulative score total.
   * The delta is recorded in the emitted event for consumers that project
   * per-lead score state.
   */
  readonly scoreDelta: number;
  /** ISO-8601 timestamp of when the scoring event happened. */
  readonly recordedAt: string;
  /**
   * Stable, caller-assigned scoring-event identifier.
   * Used as the idempotency key — re-delivering the same scoringEventId
   * a second time is a no-op: the rollup runs exactly once per id per tenant.
   */
  readonly scoringEventId: string;
  /** Optional human-readable reason for the score change. */
  readonly reason?: string;
}

export interface LeadScoringRuntimeDeps extends CapabilityRuntimeDeps {
  /**
   * Optional `emittedBy` override — defaults to `"agency.lead-scoring"`.
   * Pre-G10 callers passed this through; preserved for back-compat.
   */
  readonly emittedBy?: string;
}

interface LeadScoringApplyResult {
  readonly newTotalLeadsScored: number;
}

export class LeadScoringHandler {
  readonly #compiled: CapabilityHandler<LeadScoringEventPayload>;

  constructor(deps: LeadScoringRuntimeDeps) {
    const emittedBy = deps.emittedBy ?? "agency.lead-scoring";

    this.#compiled = defineCapability<
      LeadScoringEventPayload,
      LeadScoringApplyResult
    >(
      {
        name: emittedBy,
        idempotency: {
          table: "lead_scoring.applied_scoring_events",
          keyColumn: "scoring_event_id",
        },
        extractIdempotencyKey: (p) => p.scoringEventId,

        // Walk: prefer lead-bound override; fall back via assigned user's
        // default scoring config.
        walk: async ({ tenantId, payload, graph }) => {
          const direct = await graph.outgoingEdges(
            tenantId,
            payload.leadId,
            "agency/lead_scored_by",
          );
          if (direct.length > 0) {
            return direct[0]!.toId as EntityId;
          }

          const assigned = await graph.outgoingEdges(
            tenantId,
            payload.leadId,
            "agency/lead_assigned_to_user",
          );
          if (assigned.length > 0) {
            const userId = assigned[0]!.toId;
            const fallback = await graph.outgoingEdges(
              tenantId,
              userId as EntityId,
              "agency/user_default_scoring",
            );
            if (fallback.length > 0) {
              return fallback[0]!.toId as EntityId;
            }
          }

          console.warn(
            `[agency.lead-scoring] lead ${payload.leadId} has no scoring config ` +
              `(tenant=${tenantId}). Skipping rollup — raw Tier-1 tenant, lead unassigned, ` +
              `or user has no default scoring config.`,
          );
          return null;
        },

        // Apply: bump currentTotalLeadsScored by 1.
        apply: async ({ currentIdentity }) => {
          const current =
            (currentIdentity["currentTotalLeadsScored"] as number | undefined) ?? 0;
          const newCount = current + 1;
          return {
            nextIdentity: {
              ...currentIdentity,
              currentTotalLeadsScored: newCount,
            },
            applyResult: { newTotalLeadsScored: newCount },
          };
        },

        // Emit: agency.lead.scored
        emit: ({ tenantId, payload, targetId, applyResult }) => ({
          tenantId,
          type: "agency.lead.scored",
          entityId: targetId,
          emittedBy,
          payloadSchema: "agency.lead.scored/v1",
          payload: {
            leadScoringConfigId: targetId,
            leadId: payload.leadId,
            scoreDelta: payload.scoreDelta,
            newTotalLeadsScored: applyResult.newTotalLeadsScored,
            sourceScoringEventId: payload.scoringEventId,
            ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          },
        }),
      },
      deps,
    );
  }

  async handle(
    tenantId: TenantId,
    payload: LeadScoringEventPayload,
  ): Promise<void> {
    return this.#compiled.handle(tenantId, payload);
  }
}
