import type { LifecycleDef } from "@pm/types";

/**
 * Marketing-agency profile lifecycle state machines.
 *
 * Architecture rule (architecture.md, performance #2 / ADR-0003):
 *   Profiles declare states + legal transitions. The substrate enforces
 *   that a transition is legal — it does NOT decide which transition
 *   to take. That's a workflow / capability concern.
 *
 * Only entity types with a meaningful operational lifecycle declare one here.
 * Counterparty subtypes (Lead, Contact, ClientOrg) and Resources
 * (AgencyUser, LeadScoringConfig) and Documents (MediaAsset, ClientReport)
 * do not have substrate-enforced lifecycles in this profile.
 *
 * Note on Lead: although Lead has a qualificationStatus field, that progression
 * is operational (CRM-style) and lives in the identity bag, not as a
 * substrate-enforced lifecycle. We avoid lifting it into a LifecycleDef to
 * stay parallel with how profile-wedding handles Couple/Guest/Vendor.
 */

export const PROJECT_LIFECYCLE: LifecycleDef = {
  states: ["kickoff", "active", "on_hold", "completed", "cancelled"],
  initial: "kickoff",
  terminal: ["completed", "cancelled"],
  transitions: [
    { from: ["kickoff"], to: "active", trigger: "project.activated" },
    { from: ["active"], to: "on_hold", trigger: "project.paused" },
    { from: ["on_hold"], to: "active", trigger: "project.resumed" },
    { from: ["active", "on_hold"], to: "completed", trigger: "project.completed" },
    {
      from: ["kickoff", "active", "on_hold"],
      to: "cancelled",
      trigger: "project.cancelled",
    },
  ],
};

export const PROPOSAL_LIFECYCLE: LifecycleDef = {
  states: ["draft", "sent", "accepted", "rejected", "expired"],
  initial: "draft",
  terminal: ["accepted", "rejected", "expired"],
  transitions: [
    { from: ["draft"], to: "sent", trigger: "proposal.sent" },
    { from: ["sent"], to: "accepted", trigger: "proposal.accepted" },
    { from: ["sent"], to: "rejected", trigger: "proposal.rejected" },
    { from: ["sent"], to: "expired", trigger: "proposal.expired" },
  ],
};

export const BOOKING_LIFECYCLE: LifecycleDef = {
  states: ["scheduled", "confirmed", "completed", "cancelled", "no_show"],
  initial: "scheduled",
  terminal: ["completed", "cancelled", "no_show"],
  transitions: [
    { from: ["scheduled"], to: "confirmed", trigger: "booking.confirmed" },
    { from: ["confirmed"], to: "completed", trigger: "booking.completed" },
    { from: ["scheduled", "confirmed"], to: "cancelled", trigger: "booking.cancelled" },
    { from: ["scheduled", "confirmed"], to: "no_show", trigger: "booking.no_show" },
  ],
};

export const CAMPAIGN_LIFECYCLE: LifecycleDef = {
  states: ["draft", "scheduled", "live", "paused", "completed", "cancelled"],
  initial: "draft",
  terminal: ["completed", "cancelled"],
  transitions: [
    { from: ["draft"], to: "scheduled", trigger: "campaign.scheduled" },
    { from: ["scheduled"], to: "live", trigger: "campaign.launched" },
    { from: ["live"], to: "paused", trigger: "campaign.paused" },
    { from: ["paused"], to: "live", trigger: "campaign.resumed" },
    { from: ["live", "paused"], to: "completed", trigger: "campaign.completed" },
    {
      from: ["draft", "scheduled", "live", "paused"],
      to: "cancelled",
      trigger: "campaign.cancelled",
    },
  ],
};

export const INVOICE_LIFECYCLE: LifecycleDef = {
  states: ["draft", "sent", "paid", "overdue", "void", "uncollectible"],
  initial: "draft",
  terminal: ["paid", "void", "uncollectible"],
  transitions: [
    { from: ["draft"], to: "sent", trigger: "invoice.sent" },
    { from: ["sent"], to: "paid", trigger: "invoice.paid" },
    { from: ["sent"], to: "overdue", trigger: "invoice.overdue" },
    { from: ["overdue"], to: "paid", trigger: "invoice.paid" },
    { from: ["draft", "sent", "overdue"], to: "void", trigger: "invoice.voided" },
    { from: ["sent", "overdue"], to: "uncollectible", trigger: "invoice.uncollectible" },
  ],
};

export const SUBSCRIPTION_LIFECYCLE: LifecycleDef = {
  states: ["trialing", "active", "past_due", "canceled", "expired"],
  initial: "trialing",
  terminal: ["canceled", "expired"],
  transitions: [
    { from: ["trialing"], to: "active", trigger: "subscription.activated" },
    { from: ["active"], to: "past_due", trigger: "subscription.payment_failed" },
    { from: ["past_due"], to: "active", trigger: "subscription.payment_recovered" },
    { from: ["trialing", "active", "past_due"], to: "canceled", trigger: "subscription.canceled" },
    { from: ["active", "past_due"], to: "expired", trigger: "subscription.expired" },
  ],
};

export const BLOG_POST_LIFECYCLE: LifecycleDef = {
  states: ["draft", "scheduled", "published", "archived"],
  initial: "draft",
  terminal: ["archived"],
  transitions: [
    { from: ["draft"], to: "scheduled", trigger: "blog_post.scheduled" },
    { from: ["draft", "scheduled"], to: "published", trigger: "blog_post.published" },
    { from: ["published"], to: "archived", trigger: "blog_post.archived" },
  ],
};
