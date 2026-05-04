/**
 * @pm/capability-wedding-budget — owns BudgetCategory.actualSpentMinor rollup.
 *
 * Tier-2 capability: profile-bound to the wedding profile. Subscribes to
 * `wedding.contract.payment_recorded` and infers the rollup target by walking
 * the graph topology:
 *
 *   contract → (wedding/contract_vendor) → vendor
 *            → (wedding/vendor_budget_category) → budgetCategory
 *
 * The architectural point: `budget_category_id` does NOT appear on the contract
 * payload. The rollup target is derived from the graph, not from a field that
 * can be accidentally left `None` at creation time. This directly eliminates
 * the class of silent failure in WeddingWebApp where
 * `vendor_contracts.budget_category_id` was hardcoded `None`, making the
 * rollup in `vendor_service.record_payment` unreachable.
 *
 * Idempotency: each payment is recorded in `budget.applied_payments` before
 * the rollup write. Re-delivering the same `paymentId` is a no-op.
 *
 * Atomicity: the rollup UPDATE and the outbound event emit run in a single
 * Postgres transaction. If either fails, both are rolled back. ADR-0004 +
 * ADR-0010 cover the contracts.
 */

export { WEDDING_BUDGET_CAPABILITY } from "./capability.js";
export { BudgetRollupHandler } from "./handler.js";
export type { BudgetRuntimeDeps, PaymentRecordedPayload } from "./handler.js";
