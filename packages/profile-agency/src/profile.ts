import type { EntityTypeDef, ProfileDefinition } from "@pm/types";

import { EDGE_CATALOG } from "./edges.js";
import {
  BLOG_POST_LIFECYCLE,
  BOOKING_LIFECYCLE,
  CAMPAIGN_LIFECYCLE,
  INVOICE_LIFECYCLE,
  PROJECT_LIFECYCLE,
  PROPOSAL_LIFECYCLE,
  SUBSCRIPTION_LIFECYCLE,
} from "./lifecycles.js";

/**
 * The marketing-agency profile definition.
 *
 * Tenants on this profile use these specializations of the seven Tier-1
 * primitives. Capability providers binding to Tier-1 interfaces work here
 * automatically; capabilities binding to agency-specific concrete types
 * are profile-bound (and won't run on, e.g., a finance-research tenant).
 *
 * Identity primacy: Project. Every record in an agency tenant's graph
 * eventually reaches a Project entity through edges.
 *
 * Source-of-truth: this profile is modeled after the real PluggedInSocial
 * SQLAlchemy schema (LopeWale/PluggedInSocial backend/app/models). Each
 * concrete type below maps to one or more relational tables there.
 *
 * G4 anti-fixation rule: building this profile must NOT require any change
 * to packages/types, graph, events, registry, workflow, projections,
 * profile-finance-research, profile-registry, capability-audit, or substrate-http.
 * If anything outside packages/profile-agency and packages/capability-agency-*
 * has to change, that's a substrate fixation finding, not a feature.
 */

const ENTITY_TYPES: Readonly<Record<string, EntityTypeDef>> = {
  ClientOrg: {
    concrete: "ClientOrg",
    tier1: "Counterparty",
    requiredFields: ["name"],
    optionalFields: ["industry", "website", "revenueRange", "externalRef"],
    schemaVersion: 1,
  },
  Lead: {
    concrete: "Lead",
    tier1: "Counterparty",
    requiredFields: ["name", "qualificationStatus"],
    optionalFields: ["email", "phone", "source", "externalRef"],
    schemaVersion: 1,
  },
  Contact: {
    concrete: "Contact",
    tier1: "Counterparty",
    requiredFields: ["name"],
    optionalFields: ["email", "phone", "role", "externalRef"],
    schemaVersion: 1,
  },
  Project: {
    concrete: "Project",
    tier1: "Engagement",
    requiredFields: ["title", "projectType", "operationalState"],
    optionalFields: ["kickoffDate", "targetEndDate"],
    schemaVersion: 1,
  },
  Proposal: {
    concrete: "Proposal",
    tier1: "Engagement",
    requiredFields: ["title", "state", "amountMinor", "currency"],
    optionalFields: ["sentAt"],
    schemaVersion: 1,
  },
  Booking: {
    concrete: "Booking",
    tier1: "Engagement",
    requiredFields: ["title", "state", "startsAt"],
    optionalFields: ["endsAt", "location"],
    schemaVersion: 1,
  },
  Campaign: {
    concrete: "Campaign",
    tier1: "Engagement",
    requiredFields: ["title", "state"],
    optionalFields: ["launchDate", "objective"],
    schemaVersion: 1,
  },
  Invoice: {
    concrete: "Invoice",
    tier1: "Transaction",
    requiredFields: ["state", "amountMinor", "currency", "issuedAt"],
    optionalFields: ["dueAt"],
    schemaVersion: 1,
  },
  Subscription: {
    concrete: "Subscription",
    tier1: "Transaction",
    requiredFields: ["state", "planTier", "amountMinor", "currency"],
    optionalFields: ["currentPeriodStart", "currentPeriodEnd"],
    schemaVersion: 1,
  },
  AgencyUser: {
    concrete: "AgencyUser",
    tier1: "Resource",
    requiredFields: ["name", "email", "kind", "role"],
    optionalFields: [],
    schemaVersion: 1,
  },
  LeadScoringConfig: {
    concrete: "LeadScoringConfig",
    tier1: "Resource",
    requiredFields: ["name", "kind", "thresholds", "currentTotalLeadsScored"],
    optionalFields: [],
    schemaVersion: 1,
  },
  MediaAsset: {
    concrete: "MediaAsset",
    tier1: "Document",
    requiredFields: ["title", "storageUri", "mimeType", "sizeBytes"],
    optionalFields: [],
    schemaVersion: 1,
  },
  ClientReport: {
    concrete: "ClientReport",
    tier1: "Document",
    requiredFields: ["title", "periodStart", "periodEnd", "storageUri"],
    optionalFields: [],
    schemaVersion: 1,
  },
  EmailCampaignSend: {
    concrete: "EmailCampaignSend",
    tier1: "Communication",
    requiredFields: ["subject", "sentAt", "recipientCount", "provider"],
    optionalFields: ["externalRef"],
    schemaVersion: 1,
  },
  SocialMediaPost: {
    concrete: "SocialMediaPost",
    tier1: "Communication",
    requiredFields: ["platform", "publishedAt", "externalRef"],
    optionalFields: [],
    schemaVersion: 1,
  },
  BlogPost: {
    concrete: "BlogPost",
    tier1: "Communication",
    requiredFields: ["title", "slug", "state"],
    optionalFields: ["publishedAt"],
    schemaVersion: 1,
  },
};

export const AGENCY_PROFILE: ProfileDefinition = {
  name: "agency",
  version: 1,
  description:
    "The marketing-agency industry profile. Specializes Engagement→{Project,Proposal,Booking,Campaign}, Counterparty→{ClientOrg,Lead,Contact}, Transaction→{Invoice,Subscription}, Resource→{AgencyUser,LeadScoringConfig}, Document→{MediaAsset,ClientReport}, Communication→{EmailCampaignSend,SocialMediaPost,BlogPost}. Identity primacy = Project. Modeled after the real PluggedInSocial agency platform.",
  entityTypes: ENTITY_TYPES,
  edgeTypes: EDGE_CATALOG,
  lifecycles: {
    Project: PROJECT_LIFECYCLE,
    Proposal: PROPOSAL_LIFECYCLE,
    Booking: BOOKING_LIFECYCLE,
    Campaign: CAMPAIGN_LIFECYCLE,
    Invoice: INVOICE_LIFECYCLE,
    Subscription: SUBSCRIPTION_LIFECYCLE,
    BlogPost: BLOG_POST_LIFECYCLE,
  },
  identityPrimacy: "Project",
};
