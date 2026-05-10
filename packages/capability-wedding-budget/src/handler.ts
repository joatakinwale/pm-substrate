/**
 * BudgetRollupHandler — wedding.budget capability handler.
 *
 * G10 phase 2: this handler is now a thin shell over `@pm/capability-kit`'s
 * `defineCapability`. The kit owns the transactional shape (BEGIN,
 * idempotency INSERT, FOR UPDATE, identity UPDATE, transactional
 * publishWith, COMMIT/ROLLBACK). This file declares only the
 * wedding-specific bits: which graph edges to walk and which identity
 * field to bump.
 *
 * Compare to the pre-G10 version (git history, before df5e673 ancestor):
 * 196 lines of hand-rolled transactional code → ~70 lines of declarative
 * spec. Behavior is identical; the existing budget tests pass unchanged.
 *
 * Topology (unchanged from pre-G10):
 *   contractId
 *     → outgoingEdges("wedding/contract_vendor")        → vendorId
 *     → outgoingEdges("wedding/vendor_budget_category") → budgetCategoryId
 *
 * If either edge is missing, the kit commits the idempotency row and
 * returns — same "seen and intentionally skipped" semantics as before.
 */

import {
  defineCapability,
  type CapabilityHandler,
  type CapabilityRuntimeDeps,
} from "@pm/capability-kit";
import type { EntityId, TenantId } from "@pm/types";

export interface PaymentRecordedPayload {
  /** EntityId of the Contract that recorded the payment. */
  readonly contractId: EntityId;
  /** Payment amount in integer minor units (cents). */
  readonly amount: number;
  /** ISO-8601 timestamp of when the payment was recorded. */
  readonly recordedAt: string;
  /**
   * Stable, caller-assigned payment identifier.
   * Used as the idempotency key — re-delivering the same paymentId a second
   * time is a no-op: the rollup runs exactly once per paymentId per tenant.
   */
  readonly paymentId: string;
}

export interface BudgetRuntimeDeps extends CapabilityRuntimeDeps {
  /**
   * Optional `emittedBy` override — defaults to `"wedding.budget"`.
   * Pre-G10 callers passed this through; preserved for back-compat.
   */
  readonly emittedBy?: string;
}

interface BudgetApplyResult {
  readonly delta: number;
  readonly newTotal: number;
  readonly sourcePaymentId: string;
}

/**
 * Construct a wedding.budget capability handler. Public shape unchanged
 * from pre-G10 (`new BudgetRollupHandler(deps).handle(tenantId, payload)`)
 * so existing call sites — substrate-http, capability-independence
 * tests, drop-in-diff tests — keep working without edits.
 */
export class BudgetRollupHandler {
  readonly #compiled: CapabilityHandler<PaymentRecordedPayload>;

  constructor(deps: BudgetRuntimeDeps) {
    const emittedBy = deps.emittedBy ?? "wedding.budget";

    this.#compiled = defineCapability<PaymentRecordedPayload, BudgetApplyResult>(
      {
        name: emittedBy,
        idempotency: {
          table: "budget.applied_payments",
          keyColumn: "payment_id",
        },
        extractIdempotencyKey: (p) => p.paymentId,

        // Walk: contract → vendor → budget_category
        walk: async ({ tenantId, payload, graph }) => {
          const contractVendorEdges = await graph.outgoingEdges(
            tenantId,
            payload.contractId,
            "wedding/contract_vendor",
          );
          if (contractVendorEdges.length === 0) {
            console.warn(
              `[wedding.budget] contract ${payload.contractId} has no vendor edge ` +
                `(tenant=${tenantId}). Skipping rollup — raw Tier-1 tenant or vendor not linked.`,
            );
            return null;
          }
          const vendorId = contractVendorEdges[0]!.toId;

          const vendorBudgetEdges = await graph.outgoingEdges(
            tenantId,
            vendorId,
            "wedding/vendor_budget_category",
          );
          if (vendorBudgetEdges.length === 0) {
            console.warn(
              `[wedding.budget] vendor ${vendorId} has no budget category edge ` +
                `(tenant=${tenantId}). Skipping rollup — vendor not assigned to a budget category.`,
            );
            return null;
          }
          return vendorBudgetEdges[0]!.toId as EntityId;
        },

        // Apply: increment actualSpentMinor on the locked budget category.
        apply: async ({ payload, currentIdentity }) => {
          const currentSpent =
            (currentIdentity["actualSpentMinor"] as number | undefined) ?? 0;
          const newSpent = currentSpent + payload.amount;
          return {
            nextIdentity: { ...currentIdentity, actualSpentMinor: newSpent },
            applyResult: {
              delta: payload.amount,
              newTotal: newSpent,
              sourcePaymentId: payload.paymentId,
            },
          };
        },

        // Emit: wedding.budget.actual_spent_updated
        emit: ({ tenantId, targetId, applyResult }) => ({
          tenantId,
          type: "wedding.budget.actual_spent_updated",
          entityId: targetId,
          emittedBy,
          payloadSchema: "wedding.budget.actual_spent_updated/v1",
          payload: {
            budgetCategoryId: targetId,
            delta: applyResult.delta,
            newTotal: applyResult.newTotal,
            sourcePaymentId: applyResult.sourcePaymentId,
          },
        }),
      },
      deps,
    );
  }

  async handle(
    tenantId: TenantId,
    payload: PaymentRecordedPayload,
  ): Promise<void> {
    return this.#compiled.handle(tenantId, payload);
  }
}
