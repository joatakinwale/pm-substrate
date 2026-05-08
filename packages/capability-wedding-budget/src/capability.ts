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
 *
 * G6 reference migration: this is the first capability migrated from V1
 * string-array contracts to V2 typed/versioned contracts (ADR-0013). Use this
 * descriptor as the canonical template for the remaining capability migrations.
 */
export const WEDDING_BUDGET_CAPABILITY = {
  id: "cap_wedding_budget_v1" as CapabilityId,
  name: "wedding.budget",
  version: 1,
  readsInterfaces: [
    {
      interface: "Counterparty",
      fields: ["name", "category"],
      cardinality: "exactly-one",
      required: true,
    },
    {
      interface: "Transaction",
      fields: ["state", "amountMinor", "currency"],
      cardinality: "exactly-one",
      required: true,
    },
    {
      interface: "Resource",
      fields: ["name", "kind", "allocatedMinor", "currency", "actualSpentMinor"],
      cardinality: "exactly-one",
      required: true,
    },
  ],
  writesInterfaces: [
    {
      interface: "Resource",
      fields: ["actualSpentMinor"],
      ownership: "owner",
    },
  ],
  readsEdges: ["wedding/contract_vendor", "wedding/vendor_budget_category"],
  writesEdges: [],
  emits: [
    {
      schema: {
        type: "wedding.budget.actual_spent_updated",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/actual-spent-updated.v1.json",
      },
      affectsEntities: ["Resource"],
    },
  ],
  subscribesTo: [
    {
      pattern: "wedding.contract.payment_recorded",
      accepts: { minMajor: 1, maxMajor: 1 },
    },
  ],
  requiredPermissions: ["wedding.budget.write"],
  description:
    "Owns BudgetCategory.actualSpentMinor rollup for the wedding profile. " +
    "Subscribes to wedding.contract.payment_recorded and infers the rollup target " +
    "by walking the graph topology (contract→vendor→budgetCategory). " +
    "No budget_category_id on the payload — topology is the contract.",
} as const satisfies Capability;
