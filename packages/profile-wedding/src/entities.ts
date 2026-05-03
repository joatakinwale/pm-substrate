import type { ProfileEntity } from "@pm/types";

/**
 * Wedding-profile concrete entity types.
 *
 * Each one extends ProfileEntity with a strongly-typed identity bag.
 * The Tier-1 interface this concrete type satisfies is asserted in
 * ./profile.ts via the EntityTypeDef catalog AND in ./entities.test.ts
 * with structural type-compat checks.
 *
 * Identity primacy: Wedding. Every other record reaches Wedding via edges.
 */

/**
 * Wedding — the spine of the wedding profile. Specializes Engagement.
 *
 * Constraint: a Wedding must reference *exactly two* principals (the couple).
 * Enforced via the "wedding/has_principal" edge cardinality "exactly:2" in
 * the profile's edge catalog. Substrate enforces at write time.
 */
export interface Wedding
  extends ProfileEntity<{
    title: string;
    /** ISO-8601 date. The actual wedding day. */
    eventDate: string;
    venue: string;
    /** Engagement scope start = couple-engagement date or planning-start. */
    scopeStart: string | null;
    /** Engagement scope end = day after eventDate by convention. */
    scopeEnd: string | null;
    /** Operational status: "planning" | "imminent" | "completed" | "cancelled". */
    operationalState: string;
  }> {}

/**
 * Couple — the two principals of a Wedding. Specializes Counterparty.
 *
 * The cardinality constraint "exactly two principals per Wedding" is on the
 * edge type, not on the Couple type itself. A Couple node is a single person;
 * two of them are connected to a Wedding.
 */
export interface Couple
  extends ProfileEntity<{
    name: string;
    email: string | null;
    phone: string | null;
    externalRef: string | null;
    /** Profile-specific: which side. Useful for seating, vendors, etc. */
    side: "partner_a" | "partner_b" | null;
  }> {}

/**
 * Guest — invited attendee. Specializes Counterparty.
 *
 * Multiplicity is unbounded (a Wedding has 0..N Guests via "wedding/has_guest").
 */
export interface Guest
  extends ProfileEntity<{
    name: string;
    email: string | null;
    phone: string | null;
    externalRef: string | null;
    /** RSVP state belongs in Guest because it's a per-guest attribute, not a transaction. */
    rsvpState: "pending" | "accepted" | "declined" | "no_response";
  }> {}

/**
 * Vendor — third-party service provider. Specializes Counterparty.
 *
 * Has Contracts. Vendors are reusable across Weddings (one Vendor → N Weddings).
 */
export interface Vendor
  extends ProfileEntity<{
    name: string;
    email: string | null;
    phone: string | null;
    externalRef: string | null;
    /** Service category. Profile-declared free-form for now. */
    category: string;
  }> {}

/**
 * Contract — agreement between the Wedding (or Couple) and a Vendor.
 * Specializes Transaction. Lifecycle declared in ./lifecycles.ts.
 */
export interface Contract
  extends ProfileEntity<{
    state: ContractState;
    amountMinor: number;
    currency: string;
    /** ISO-8601 contract effective date. */
    effectiveDate: string;
  }> {}

export type ContractState =
  | "draft"
  | "sent"
  | "signed"
  | "in_progress"
  | "completed"
  | "cancelled";

/**
 * Payment — actual money movement against a Contract or directly to a Vendor.
 * Specializes Transaction.
 */
export interface Payment
  extends ProfileEntity<{
    state: PaymentState;
    amountMinor: number;
    currency: string;
    paidAt: string | null;
  }> {}

export type PaymentState =
  | "scheduled"
  | "sent"
  | "settled"
  | "failed"
  | "refunded";

/**
 * Invoice — billable line item, often issued by a Vendor and paid by a Payment.
 * Specializes Transaction.
 */
export interface Invoice
  extends ProfileEntity<{
    state: InvoiceState;
    amountMinor: number;
    currency: string;
    issuedAt: string;
    dueAt: string | null;
  }> {}

export type InvoiceState =
  | "draft"
  | "sent"
  | "paid"
  | "void"
  | "uncollectible";
