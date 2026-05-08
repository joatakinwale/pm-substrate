import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

const contractEvent = (type: string) => ({
  schema: {
    type,
    version: { major: 1, minor: 0, patch: 0 },
    schemaPath: `schemas/${type.replace(/\./g, "-")}.v1.json`,
  },
  affectsEntities: ["Transaction"],
});

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
  readsInterfaces: [
    {
      interface: "Transaction",
      fields: ["state", "amountMinor", "currency", "effectiveDate"],
      cardinality: "exactly-one",
      required: true,
    },
  ],
  writesInterfaces: [
    {
      interface: "Transaction",
      fields: ["state", "amountMinor", "currency", "effectiveDate"],
      ownership: "owner",
    },
  ],
  readsEdges: ["wedding/contract_vendor", "wedding/vendor_contract"],
  writesEdges: ["wedding/contract_vendor", "wedding/vendor_contract"],
  emits: [
    contractEvent("wedding.contract.drafted"),
    contractEvent("wedding.contract.sent"),
    contractEvent("wedding.contract.signed"),
    contractEvent("wedding.contract.work_started"),
    contractEvent("wedding.contract.completed"),
    contractEvent("wedding.contract.cancelled"),
  ],
  subscribesTo: [],
  requiredPermissions: ["wedding.contracts.write"],
  description:
    "Owns Contract entities and their lifecycle for the wedding profile. Each transition writes graph + emits event in one tx.",
} as const satisfies Capability;
