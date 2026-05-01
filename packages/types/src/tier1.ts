import type { NodeBase } from "./node.js";

/**
 * Tier-1 entity interfaces. The seven universal primitives.
 *
 * Architecture rule (ADR-0003): primitives are universal; constraints between
 * them are not. Cardinality, lifecycle, document semantics, and identity primacy
 * live in Tier-2 profiles, NOT here.
 *
 * Each interface declares the *minimum* shape — what every implementing profile
 * must guarantee. Profiles tighten with concrete required fields.
 */

/**
 * 1. Counterparty — an external entity we have a relationship with.
 *
 * Specializes to: customer, client, patient, guest, vendor, partner.
 *
 * Minimum shape: name (human-readable label) + at least one contact channel.
 * Profile decides which channels are mandatory and how multiplicity works
 * (e.g., a Patient must have a unique medical-record-number; a Guest can have
 * email-only; a Vendor must have legal_name + tax_id).
 */
export interface Counterparty extends NodeBase {
  readonly identity: Readonly<{
    name: string;
    /** At least one of email | phone | externalRef must be set; profile enforces. */
    email?: string | null;
    phone?: string | null;
    externalRef?: string | null;
  }>;
}

/**
 * 2. Engagement — a unit of work scoped in time.
 *
 * Specializes to: project, case, deal, event, matter, job, ticket.
 *
 * Minimum shape: a title + a time scope. Profile decides whether the scope
 * is open-ended (a SaaS deal) or bounded (a wedding event_date), and whether
 * cardinality of related Counterparties is 1, 2, or N.
 */
export interface Engagement extends NodeBase {
  readonly identity: Readonly<{
    title: string;
    /** ISO-8601. Null = open-ended start (rare). */
    scopeStart: string | null;
    /** ISO-8601. Null = open-ended end (a SaaS subscription, an ongoing matter). */
    scopeEnd: string | null;
  }>;
}

/**
 * 3. Transaction — exchange of value.
 *
 * Specializes to: invoice, payment, contract, order, claim.
 *
 * Minimum shape: an amount + currency + lifecycle state. Profile declares
 * the legal lifecycle (e.g., draft→sent→paid for a SaaS invoice; filed→
 * triaged→adjudicated→paid→reopened for an insurance claim). The substrate
 * does NOT enforce the lifecycle.
 */
export interface Transaction extends NodeBase {
  readonly identity: Readonly<{
    /** Profile-declared state name (no enum here). */
    state: string;
    /** Integer minor units (cents). Currency-specific scaling at boundary. */
    amountMinor: number;
    /** ISO-4217 currency code. */
    currency: string;
  }>;
}

/**
 * 4. Resource — something allocated to engagements.
 *
 * Specializes to: person, asset, room, equipment.
 *
 * Minimum shape: a name + a kind discriminator. Profile decides whether
 * resources are unique (a specific employee), interchangeable (a fungible
 * inventory unit), or scoped (a meeting room only valid in one office).
 */
export interface Resource extends NodeBase {
  readonly identity: Readonly<{
    name: string;
    /** Profile-declared kind: "person" | "room" | "asset" | "equipment" | ... */
    kind: string;
  }>;
}

/**
 * 5. Communication — a recorded interaction.
 *
 * Specializes to: email, call, message, note.
 *
 * Minimum shape: a channel + a direction + a recordedAt. Body lives outside
 * the identity bag (it's bulk content; we put it on an edge to a Document
 * node, or in a profile-specific field).
 */
export interface Communication extends NodeBase {
  readonly identity: Readonly<{
    channel: string;
    /** "inbound" | "outbound" — profile may add internal-only directions. */
    direction: "inbound" | "outbound" | "internal";
    /** ISO-8601 of when the actual interaction occurred (may differ from recordedAt). */
    occurredAt: string;
  }>;
}

/**
 * 6. Document — any file produced or referenced.
 *
 * Specializes to: contract, deliverable, marketing PDF, medical record.
 *
 * Minimum shape: a content addressing + a MIME type. Retention rules,
 * HIPAA/SOC constraints, redlining/versioning policy are profile concerns.
 */
export interface Document extends NodeBase {
  readonly identity: Readonly<{
    /** Content-addressing: SHA-256 hex of the bytes. Substrate stores no bytes. */
    sha256: string;
    mimeType: string;
    /** Human-readable filename, profile-decorated. */
    filename: string;
  }>;
}

/**
 * 7. Event — something happened at a time, immutable.
 *
 * Distinct from PMEvent (the event-log row). This is the noun: an immutable
 * occurrence in business time. PMEvent is the verb: a notification on the
 * substrate's event stream.
 *
 * Specializes to: signed-contract, paid-invoice, completed-task, status-changed.
 *
 * Minimum shape: a kind + an occurredAt. Profiles enrich.
 */
export interface BusinessEvent extends NodeBase {
  readonly identity: Readonly<{
    kind: string;
    occurredAt: string;
  }>;
}
