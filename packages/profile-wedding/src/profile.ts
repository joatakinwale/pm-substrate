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
  /**
   * PlannerTask — a piece of planner work tied to a wedding (typically
   * created in response to a contract milestone, vendor change, or other
   * domain event). Specializes Engagement.
   *
   * Modeled after WeddingWebApp's PlannerTaskModel (see upstream branch
   * claude/replace-google-calendar-calcom — the Aurinko-era refactor that
   * normalized away from Google-specific fields). Provider-neutral:
   * `sourceType` carries the upstream provider tag ("aurinko", "manual",
   * etc.) but the substrate doesn't know what those values mean.
   *
   * Lifecycle states: pending → in_progress → completed (or cancelled).
   * Capability that owns task creation: capability-wedding-tasks.
   */
  PlannerTask: {
    concrete: "PlannerTask",
    tier1: "Engagement",
    requiredFields: ["title", "state", "priority", "category"],
    optionalFields: [
      "description",
      "dueAt",
      "reminderMinutes",
      "sourceType",
      "externalRef",
    ],
    schemaVersion: 1,
  },
  /**
   * CalendarEvent — a scheduled time block linked to a planner task.
   * Specializes Resource.
   *
   * Modeled after the canonical meeting/calendar event from WeddingWebApp.
   * The substrate does not own delivery semantics (ICS attachments, push
   * notifications, OAuth-scoped sync); those live in the calendar capability.
   * The substrate stores the canonical record + lifecycle.
   *
   * Capability that owns calendar event creation: capability-wedding-calendar.
   */
  CalendarEvent: {
    concrete: "CalendarEvent",
    tier1: "Resource",
    requiredFields: [
      "title",
      "kind",
      "startAt",
      "endAt",
      "timezone",
      "state",
    ],
    optionalFields: [
      "description",
      "location",
      "sourceType",
      "externalRef",
    ],
    schemaVersion: 1,
  },
};

export const WEDDING_PROFILE: ProfileDefinition = {
  name: "wedding",
  version: 3,  // v3: added PlannerTask + CalendarEvent entities and contract_task + task_calendar_event edges (G5 cross-tool E2E).
  description:
    "The wedding industry profile. Specializes Engagement→{Wedding,PlannerTask}, Counterparty→{Couple,Guest,Vendor}, Transaction→{Contract,Payment,Invoice}, Resource→{BudgetCategory,CalendarEvent}. Identity primacy = Wedding.",
  entityTypes: ENTITY_TYPES,
  edgeTypes: EDGE_CATALOG,
  lifecycles: {
    Contract: CONTRACT_LIFECYCLE,
    Payment: PAYMENT_LIFECYCLE,
    Invoice: INVOICE_LIFECYCLE,
  },
  identityPrimacy: "Wedding",
};
