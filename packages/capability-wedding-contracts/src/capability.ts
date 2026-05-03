import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for wedding/contracts. Registered per-tenant.
 *
 * `subscribesTo: []` — this capability is invoked by callers / workflows,
 * not driven by the event stream. Future iterations may listen for
 * `vendor.created` to auto-draft a starter contract; explicitly NOT day-1.
 *
 * `emits` enumerates the lifecycle events the service publishes. Workflow
 * runtime + other capabilities subscribe to these; the registry is how
 * they discover what's available.
 */
export const WEDDING_CONTRACTS_CAPABILITY = {
  id: "cap_wedding_contracts_v1" as CapabilityId,
  name: "wedding/contracts",
  version: 1,
  readsInterfaces: ["Transaction[state,amountMinor,currency,effectiveDate]"],
  writesInterfaces: ["Transaction[state,amountMinor,currency,effectiveDate]"],
  readsEdges: ["wedding/contract_vendor", "wedding/vendor_contract"],
  writesEdges: ["wedding/contract_vendor", "wedding/vendor_contract"],
  emits: [
    "wedding.contract.drafted",
    "wedding.contract.sent",
    "wedding.contract.signed",
    "wedding.contract.work_started",
    "wedding.contract.completed",
    "wedding.contract.cancelled",
  ],
  subscribesTo: [],
  requiredPermissions: ["wedding.contracts.write"],
  description:
    "Owns Contract entities and their lifecycle for the wedding profile. Each transition writes graph + emits event in one tx.",
} as const satisfies Capability;
