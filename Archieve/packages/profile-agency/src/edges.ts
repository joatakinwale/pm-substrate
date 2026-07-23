import type { EdgeTypeDef } from "@pm/types";

/**
 * Marketing-agency profile edge catalog.
 *
 * Architecture rule (architecture.md, Layer 1):
 *   The substrate does not know what edge types exist; the profile declares
 *   them up front. Cardinality is enforced at write time.
 *
 * Naming convention: edges are profile-prefixed at write time
 * (e.g., "agency/has_project"). The local name lives here without prefix.
 *
 * Identity primacy = Project. Most edges either originate at Project or
 * eventually reach a Project through a short walk.
 */

/**
 * ClientOrg → Project. The agency's relationship spine: every Project
 * belongs to exactly one ClientOrg.
 */
export const CLIENT_HAS_PROJECT: EdgeTypeDef = {
  name: "client_has_project",
  fromTypes: ["ClientOrg"],
  toTypes: ["Project"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * ClientOrg → Contact. A ClientOrg has one or more individual Contacts.
 */
export const CLIENT_HAS_CONTACT: EdgeTypeDef = {
  name: "client_has_contact",
  fromTypes: ["ClientOrg"],
  toTypes: ["Contact"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Lead → ClientOrg. Set when a Lead is converted; preserves attribution.
 * Optional (a Lead can be unconverted forever).
 */
export const LEAD_CONVERTED_TO_CLIENT: EdgeTypeDef = {
  name: "lead_converted_to_client",
  fromTypes: ["Lead"],
  toTypes: ["ClientOrg"],
  fromCardinality: "at-most:1",
  toCardinality: "unbounded",
};

/**
 * Lead → AgencyUser. Lead ownership / assignment.
 */
export const LEAD_ASSIGNED_TO_USER: EdgeTypeDef = {
  name: "lead_assigned_to_user",
  fromTypes: ["Lead"],
  toTypes: ["AgencyUser"],
  fromCardinality: "at-most:1",
  toCardinality: "unbounded",
};

/**
 * Project → AgencyUser. Multiple staff can be assigned to a Project.
 */
export const PROJECT_ASSIGNED_TO_USER: EdgeTypeDef = {
  name: "project_assigned_to_user",
  fromTypes: ["Project"],
  toTypes: ["AgencyUser"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/**
 * Project → Proposal. A Project may have multiple Proposals over time
 * (revisions, alternates).
 */
export const PROJECT_HAS_PROPOSAL: EdgeTypeDef = {
  name: "project_has_proposal",
  fromTypes: ["Project"],
  toTypes: ["Proposal"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Project → Booking. Bookings (calls, shoots, meetings) anchor to Projects.
 */
export const PROJECT_HAS_BOOKING: EdgeTypeDef = {
  name: "project_has_booking",
  fromTypes: ["Project"],
  toTypes: ["Booking"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Project → Campaign. Campaigns sit inside a Project.
 */
export const PROJECT_HAS_CAMPAIGN: EdgeTypeDef = {
  name: "project_has_campaign",
  fromTypes: ["Project"],
  toTypes: ["Campaign"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Proposal → Invoice. When a Proposal is accepted, an Invoice may be issued.
 */
export const PROPOSAL_HAS_INVOICE: EdgeTypeDef = {
  name: "proposal_has_invoice",
  fromTypes: ["Proposal"],
  toTypes: ["Invoice"],
  fromCardinality: "unbounded",
  toCardinality: "at-most:1",
};

/**
 * Project → Invoice. Direct project-level invoicing (recurring retainer,
 * milestone billing) bypasses Proposal.
 */
export const PROJECT_HAS_INVOICE: EdgeTypeDef = {
  name: "project_has_invoice",
  fromTypes: ["Project"],
  toTypes: ["Invoice"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * ClientOrg → Subscription. Recurring billing arrangements live at the
 * ClientOrg level (one client, many subscriptions over time).
 */
export const CLIENT_HAS_SUBSCRIPTION: EdgeTypeDef = {
  name: "client_has_subscription",
  fromTypes: ["ClientOrg"],
  toTypes: ["Subscription"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Subscription → Invoice. Each billing period emits one Invoice.
 */
export const SUBSCRIPTION_HAS_INVOICE: EdgeTypeDef = {
  name: "subscription_has_invoice",
  fromTypes: ["Subscription"],
  toTypes: ["Invoice"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Campaign → SocialMediaPost. Posts are the fan-out of a campaign.
 */
export const CAMPAIGN_HAS_POST: EdgeTypeDef = {
  name: "campaign_has_post",
  fromTypes: ["Campaign"],
  toTypes: ["SocialMediaPost"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Campaign → EmailCampaignSend. Email blasts that are part of a campaign.
 */
export const CAMPAIGN_HAS_EMAIL_SEND: EdgeTypeDef = {
  name: "campaign_has_email_send",
  fromTypes: ["Campaign"],
  toTypes: ["EmailCampaignSend"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Campaign → BlogPost. Blog posts pegged to a campaign theme.
 */
export const CAMPAIGN_HAS_BLOG_POST: EdgeTypeDef = {
  name: "campaign_has_blog_post",
  fromTypes: ["Campaign"],
  toTypes: ["BlogPost"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * MediaAsset used in SocialMediaPost. One asset can be reused across posts;
 * one post can include multiple assets.
 */
export const MEDIA_USED_IN_POST: EdgeTypeDef = {
  name: "media_used_in_post",
  fromTypes: ["MediaAsset"],
  toTypes: ["SocialMediaPost"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/**
 * Project → MediaAsset. Direct asset attachment to a project (deliverables,
 * source files).
 */
export const PROJECT_HAS_MEDIA: EdgeTypeDef = {
  name: "project_has_media",
  fromTypes: ["Project"],
  toTypes: ["MediaAsset"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/**
 * ClientOrg → ClientReport. Reports are delivered to a specific client.
 */
export const CLIENT_HAS_REPORT: EdgeTypeDef = {
  name: "client_has_report",
  fromTypes: ["ClientOrg"],
  toTypes: ["ClientReport"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

/**
 * Lead → LeadScoringConfig. Used by the agency-lead-scoring capability to
 * resolve which scoring rules apply to a lead. Defaults to the
 * AgencyUser-assigned config; falls back to the tenant default.
 *
 * Architecture note: this edge is the reason `scoring_config_id` does NOT
 * appear on Lead payloads. The scoring capability walks the graph to find
 * the rollup target — same rollup-walk pattern the retired wedding-era budget capability proved
 * → budget category.
 */
export const LEAD_SCORED_BY: EdgeTypeDef = {
  name: "lead_scored_by",
  fromTypes: ["Lead"],
  toTypes: ["LeadScoringConfig"],
  fromCardinality: "at-most:1",
  toCardinality: "unbounded",
};

/**
 * AgencyUser → LeadScoringConfig. A user has a default scoring config
 * applied to leads they own. The capability falls back to this when a
 * lead doesn't have its own scored_by edge.
 */
export const USER_DEFAULT_SCORING: EdgeTypeDef = {
  name: "user_default_scoring",
  fromTypes: ["AgencyUser"],
  toTypes: ["LeadScoringConfig"],
  fromCardinality: "at-most:1",
  toCardinality: "unbounded",
};

/**
 * The full edge catalog. Indexed by local name (no profile prefix).
 */
export const EDGE_CATALOG: Readonly<Record<string, EdgeTypeDef>> = {
  client_has_project: CLIENT_HAS_PROJECT,
  client_has_contact: CLIENT_HAS_CONTACT,
  lead_converted_to_client: LEAD_CONVERTED_TO_CLIENT,
  lead_assigned_to_user: LEAD_ASSIGNED_TO_USER,
  project_assigned_to_user: PROJECT_ASSIGNED_TO_USER,
  project_has_proposal: PROJECT_HAS_PROPOSAL,
  project_has_booking: PROJECT_HAS_BOOKING,
  project_has_campaign: PROJECT_HAS_CAMPAIGN,
  proposal_has_invoice: PROPOSAL_HAS_INVOICE,
  project_has_invoice: PROJECT_HAS_INVOICE,
  client_has_subscription: CLIENT_HAS_SUBSCRIPTION,
  subscription_has_invoice: SUBSCRIPTION_HAS_INVOICE,
  campaign_has_post: CAMPAIGN_HAS_POST,
  campaign_has_email_send: CAMPAIGN_HAS_EMAIL_SEND,
  campaign_has_blog_post: CAMPAIGN_HAS_BLOG_POST,
  media_used_in_post: MEDIA_USED_IN_POST,
  project_has_media: PROJECT_HAS_MEDIA,
  client_has_report: CLIENT_HAS_REPORT,
  lead_scored_by: LEAD_SCORED_BY,
  user_default_scoring: USER_DEFAULT_SCORING,
};
