import type { EdgeTypeDef } from "@pm/types";

/**
 * Wedding-profile edge catalog.
 *
 * Architecture rule (architecture.md, Layer 1):
 *   The substrate does not know what edge types exist; the profile declares
 *   them up front. Cardinality is enforced at write time.
 *
 * Naming convention: edges are profile-prefixed at write time
 * (e.g., "wedding/has_principal"). The local name lives here without prefix.
 *
 * The "exactly:2" on `has_principal` is the rule that catches the
 * "couple_ids[2]" failure mode named in ADR-0003.
 */

export const HAS_PRINCIPAL: EdgeTypeDef = {
  name: "has_principal",
  fromTypes: ["Wedding"],
  toTypes: ["Couple"],
  fromCardinality: "exactly:2",
  toCardinality: "at-most:1",
};

export const HAS_GUEST: EdgeTypeDef = {
  name: "has_guest",
  fromTypes: ["Wedding"],
  toTypes: ["Guest"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const HAS_VENDOR: EdgeTypeDef = {
  name: "has_vendor",
  fromTypes: ["Wedding"],
  toTypes: ["Vendor"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

export const VENDOR_CONTRACT: EdgeTypeDef = {
  name: "vendor_contract",
  fromTypes: ["Wedding"],
  toTypes: ["Contract"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const CONTRACT_VENDOR: EdgeTypeDef = {
  name: "contract_vendor",
  fromTypes: ["Contract"],
  toTypes: ["Vendor"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

export const CONTRACT_INVOICE: EdgeTypeDef = {
  name: "contract_invoice",
  fromTypes: ["Contract"],
  toTypes: ["Invoice"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const INVOICE_PAYMENT: EdgeTypeDef = {
  name: "invoice_payment",
  fromTypes: ["Invoice"],
  toTypes: ["Payment"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const PLUS_ONE: EdgeTypeDef = {
  name: "plus_one",
  fromTypes: ["Guest"],
  toTypes: ["Guest"],
  fromCardinality: "at-most:1",
  toCardinality: "at-most:1",
};

/**
 * Vendor → BudgetCategory. Used by the wedding.budget capability to infer
 * which budget envelope a contract's payment rolls up into.
 *
 * A vendor belongs to at most one budget category (a florist is in "Flowers";
 * the caterer is in "Catering"). Many vendors can share a category.
 *
 * Architecture note: this edge is the reason `budget_category_id` does NOT
 * appear on Contract payloads. The budget capability walks the graph to find
 * the rollup target — eliminating the hardcoded-None production bug in
 * WeddingWebApp. See P2 plan in docs.
 */
export const VENDOR_BUDGET_CATEGORY: EdgeTypeDef = {
  name: "vendor_budget_category",
  fromTypes: ["Vendor"],
  toTypes: ["BudgetCategory"],
  fromCardinality: "at-most:1",  // A vendor rolls up to at most one budget category.
  toCardinality: "unbounded",    // Many vendors can share a budget category.
};

/**
 * The full edge catalog. Indexed by local name (no profile prefix).
 */
export const EDGE_CATALOG: Readonly<Record<string, EdgeTypeDef>> = {
  has_principal: HAS_PRINCIPAL,
  has_guest: HAS_GUEST,
  has_vendor: HAS_VENDOR,
  vendor_contract: VENDOR_CONTRACT,
  contract_vendor: CONTRACT_VENDOR,
  contract_invoice: CONTRACT_INVOICE,
  invoice_payment: INVOICE_PAYMENT,
  plus_one: PLUS_ONE,
  vendor_budget_category: VENDOR_BUDGET_CATEGORY,
};
