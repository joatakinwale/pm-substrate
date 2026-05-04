import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for wedding.budget.
 *
 * Owns `BudgetCategory.actualSpentMinor` rollup. The load-bearing mechanism:
 * when `wedding.contract.payment_recorded` arrives, the handler walks the
 * graph (contract → wedding/contract_vendor → vendor →
 * wedding/vendor_budget_category → budgetCategory) to find the rollup target
 * without needing `budget_category_id` on the contract payload.
 *
 * This directly eliminates the WeddingWebApp production bug where
 * `vendor_contracts.budget_category_id` was hardcoded `None` at create,
 * making the rollup at `vendor_service.record_payment:3129` silently
 * unreachable. See docs/adr/0010-budget-applied-payments-idempotency.md.
 */
export const WEDDING_BUDGET_CAPABILITY = {
  id: "cap_wedding_budget_v1" as CapabilityId,
  name: "wedding.budget",
  version: 1,
  readsInterfaces: [
    "Counterparty[name,category]",
    "Transaction[state,amountMinor,currency]",
    "Resource[name,kind,allocatedMinor,currency,actualSpentMinor]",
  ],
  writesInterfaces: [
    "Resource[actualSpentMinor]",
  ],
  readsEdges: ["wedding/contract_vendor", "wedding/vendor_budget_category"],
  writesEdges: [],
  emits: ["wedding.budget.actual_spent_updated"],
  subscribesTo: ["wedding.contract.payment_recorded"],
  requiredPermissions: ["wedding.budget.write"],
  description:
    "Owns BudgetCategory.actualSpentMinor rollup for the wedding profile. " +
    "Subscribes to wedding.contract.payment_recorded and infers the rollup target " +
    "by walking the graph topology (contract→vendor→budgetCategory). " +
    "No budget_category_id on the payload — topology is the contract.",
} as const satisfies Capability;
