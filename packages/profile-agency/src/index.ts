/**
 * @pm/profile-agency — Tier-2 marketing-agency industry profile.
 *
 * Built as the G4 anti-fixation falsification test for the substrate.
 * Modeled after the real PluggedInSocial agency platform schema.
 *
 * Exports:
 *   - Concrete entity TypeScript types (ClientOrg, Lead, Contact, Project,
 *     Proposal, Booking, Campaign, Invoice, Subscription, AgencyUser,
 *     LeadScoringConfig, MediaAsset, ClientReport, EmailCampaignSend,
 *     SocialMediaPost, BlogPost) for use by capability providers binding
 *     to agency-specific shapes.
 *   - The runtime ProfileDefinition (`AGENCY_PROFILE`) for substrate
 *     registration.
 *   - The edge catalog and lifecycle defs as named exports for inspection.
 *
 * Usage:
 *
 *   import { AGENCY_PROFILE } from "@pm/profile-agency";
 *   await profileRegistry.register(tenantId, AGENCY_PROFILE);
 */

export * from "./entities.js";
export * from "./edges.js";
export * from "./lifecycles.js";
export * from "./publication-terminal.js";
export { AGENCY_PROFILE } from "./profile.js";
