import type { EntityTypeDef, ProfileDefinition } from "@pm/types";

import { EDGE_CATALOG } from "./edges.js";
import {
  CONTRACT_LIFECYCLE,
  INVOICE_LIFECYCLE,
  PAYMENT_LIFECYCLE,
} from "./lifecycles.js";

/**
 * The wedding profile definition.
 *
 * Tenants on this profile use these specializations of the seven Tier-1
 * primitives. Capability providers binding to Tier-1 interfaces work here
 * automatically; capabilities binding to wedding-specific concrete types
 * are profile-bound (and won't run on, e.g., a legal-services tenant).
 *
 * Identity primacy: Wedding. Every record in a wedding tenant's graph
 * eventually reaches the Wedding entity through edges.
 */

const ENTITY_TYPES: Readonly<Record<string, EntityTypeDef>> = {
  Wedding: {
    concrete: "Wedding",
    tier1: "Engagement",
    requiredFields: ["title", "eventDate", "venue", "operationalState"],
    optionalFields: ["scopeStart", "scopeEnd"],
    schemaVersion: 1,
  },
  Couple: {
    concrete: "Couple",
    tier1: "Counterparty",
    requiredFields: ["name"],
    optionalFields: ["email", "phone", "externalRef", "side"],
    schemaVersion: 1,
  },
  Guest: {
    concrete: "Guest",
    tier1: "Counterparty",
    requiredFields: ["name", "rsvpState"],
    optionalFields: ["email", "phone", "externalRef"],
    schemaVersion: 1,
  },
  Vendor: {
    concrete: "Vendor",
    tier1: "Counterparty",
    requiredFields: ["name", "category"],
    optionalFields: ["email", "phone", "externalRef"],
    schemaVersion: 1,
  },
  Contract: {
    concrete: "Contract",
    tier1: "Transaction",
    requiredFields: ["state", "amountMinor", "currency", "effectiveDate"],
    optionalFields: [],
    schemaVersion: 1,
  },
  Payment: {
    concrete: "Payment",
    tier1: "Transaction",
    requiredFields: ["state", "amountMinor", "currency"],
    optionalFields: ["paidAt"],
    schemaVersion: 1,
  },
  Invoice: {
    concrete: "Invoice",
    tier1: "Transaction",
    requiredFields: ["state", "amountMinor", "currency", "issuedAt"],
    optionalFields: ["dueAt"],
    schemaVersion: 1,
  },
  /**
   * BudgetCategory — a spending envelope for a category of vendors.
   * Specializes Resource.
   *
   * `actualSpentMinor` starts at 0 and is maintained exclusively by the
   * wedding.budget capability via graph-inferred rollup. The `vendor_budget_category`
   * edge connects vendors to their category; the budget capability walks that
   * edge to find the rollup target without needing budget_category_id on
   * the contract payload (the field that was hardcoded None in the WeddingWebApp
   * production bug). See docs/adr/0010-budget-applied-payments-idempotency.md.
   */
  BudgetCategory: {
    concrete: "BudgetCategory",
    tier1: "Resource",
    requiredFields: ["name", "kind", "allocatedMinor", "currency", "actualSpentMinor"],
    optionalFields: [],
    schemaVersion: 1,
  },
};

export const WEDDING_PROFILE: ProfileDefinition = {
  name: "wedding",
  version: 2,  // v2: added BudgetCategory entity + vendor_budget_category edge (P2.1b)
  description:
    "The wedding industry profile. Specializes Engagement→Wedding (with exactly-2-principals constraint), Counterparty→{Couple,Guest,Vendor}, Transaction→{Contract,Payment,Invoice}. Identity primacy = Wedding.",
  entityTypes: ENTITY_TYPES,
  edgeTypes: EDGE_CATALOG,
  lifecycles: {
    Contract: CONTRACT_LIFECYCLE,
    Payment: PAYMENT_LIFECYCLE,
    Invoice: INVOICE_LIFECYCLE,
  },
  identityPrimacy: "Wedding",
};
