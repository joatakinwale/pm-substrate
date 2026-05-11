import { describe, expect, it } from "vitest";
import { AGENCY_PROFILE } from "@pm/profile-agency";
import { validateEntityMappingAgainstProfile } from "./semantic.js";

/**
 * Real-app forcing fixture: Stevie / PluggedInSocial SQLAlchemy model names
 * and fields mapped onto @pm/profile-agency. This is intentionally not a
 * pristine substrate-native shape: the app uses names like `full_name`,
 * `name`, `total_cents`, `scheduled_at`, etc. `fieldMap` is the bridge.
 */
const stevieAgencyMapping = {
  profile: "agency",
  mappingVersion: 1 as const,
  description: "Stevie / PluggedInSocial app schema mapped to @pm/profile-agency.",
  entities: {
    Organization: {
      tier1: "Counterparty",
      concrete: "ClientOrg",
      identityFields: ["name"],
      fieldMap: { externalRef: "id" },
      optionalFields: ["domain"],
      schemaVersion: 1,
      sourceRef: "backend.app.models.organization.Organization",
      edges: {
        projects: {
          target: "Project",
          type: "agency/client_has_project",
          cardinality: "many",
          sourceRef: "Project.org_id",
        },
        contacts: {
          target: "Contact",
          type: "agency/client_has_contact",
          cardinality: "many",
          sourceRef: "Contact.org_id",
        },
        subscriptions: {
          target: "Subscription",
          type: "agency/client_has_subscription",
          cardinality: "many",
          sourceRef: "Subscription.org_id",
        },
      },
    },
    Lead: {
      tier1: "Counterparty",
      concrete: "Lead",
      identityFields: ["email", "phone", "source"],
      fieldMap: {
        name: "full_name",
        qualificationStatus: "qualification_status",
        externalRef: "id",
      },
      schemaVersion: 1,
      sourceRef: "backend.app.models.lead.Lead",
      edges: {
        assignedTo: {
          target: "AgencyUser",
          type: "agency/lead_assigned_to_user",
          cardinality: "zero_or_one",
          sourceRef: "Lead.assignee_id (future/current owner field)",
        },
        scoredBy: {
          target: "LeadScoringConfig",
          type: "agency/lead_scored_by",
          cardinality: "zero_or_one",
          sourceRef: "LeadScore/ScoringConfig",
        },
        convertedToClient: {
          target: "Organization",
          type: "agency/lead_converted_to_client",
          cardinality: "zero_or_one",
          sourceRef: "Lead → Organization conversion",
        },
      },
    },
    Contact: {
      tier1: "Counterparty",
      concrete: "Contact",
      identityFields: ["email"],
      fieldMap: { name: "full_name", externalRef: "id" },
      optionalFields: ["source"],
      schemaVersion: 1,
      sourceRef: "backend.app.models.contact.Contact",
    },
    Project: {
      tier1: "Engagement",
      concrete: "Project",
      identityFields: [],
      fieldMap: {
        title: "name",
        projectType: "project_type",
        operationalState: "status",
        kickoffDate: "start_date",
        targetEndDate: "target_date",
      },
      schemaVersion: 1,
      sourceRef: "backend.app.models.project.Project",
      edges: {
        proposals: {
          target: "Proposal",
          type: "agency/project_has_proposal",
          cardinality: "many",
          sourceRef: "Proposal.generated_project_id | Project.proposal_id",
        },
        bookings: {
          target: "Booking",
          type: "agency/project_has_booking",
          cardinality: "many",
          sourceRef: "Booking.project_id (desired)",
        },
        invoices: {
          target: "Invoice",
          type: "agency/project_has_invoice",
          cardinality: "many",
          sourceRef: "Invoice.project_id (desired)",
        },
        media: {
          target: "MediaAsset",
          type: "agency/project_has_media",
          cardinality: "many",
          sourceRef: "MediaAsset.usage_context/project_id",
        },
      },
    },
    Proposal: {
      tier1: "Engagement",
      concrete: "Proposal",
      identityFields: ["title", "currency"],
      fieldMap: { state: "status", amountMinor: "total_cents", sentAt: "sent_at" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.proposal.Proposal",
      edges: {
        invoice: {
          target: "Invoice",
          type: "agency/proposal_has_invoice",
          cardinality: "many",
          sourceRef: "Proposal.generated_invoice_id",
        },
      },
    },
    Booking: {
      tier1: "Engagement",
      concrete: "Booking",
      identityFields: [],
      fieldMap: { title: "event_type", state: "status", startsAt: "scheduled_at" },
      optionalFields: ["timezone"],
      schemaVersion: 1,
      sourceRef: "backend.app.models.booking.Booking",
    },
    Campaign: {
      tier1: "Engagement",
      concrete: "Campaign",
      identityFields: [],
      fieldMap: { title: "name", state: "status" },
      optionalFields: ["objective"],
      schemaVersion: 1,
      sourceRef: "backend.app.models.email_campaign.EmailCampaign",
      edges: {
        emailSends: {
          target: "EmailCampaignSend",
          type: "agency/campaign_has_email_send",
          cardinality: "many",
          sourceRef: "EmailCampaign.id → EmailSend.campaign_id",
        },
        posts: {
          target: "SocialMediaPost",
          type: "agency/campaign_has_post",
          cardinality: "many",
          sourceRef: "SocialPost.campaign/compound_phase",
        },
        blogPosts: {
          target: "BlogPost",
          type: "agency/campaign_has_blog_post",
          cardinality: "many",
          sourceRef: "BlogPost campaign theme",
        },
      },
    },
    Invoice: {
      tier1: "Transaction",
      concrete: "Invoice",
      identityFields: ["currency"],
      fieldMap: { state: "status", amountMinor: "total_cents", issuedAt: "created_at", dueAt: "due_date" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.invoice.Invoice",
    },
    Subscription: {
      tier1: "Transaction",
      concrete: "Subscription",
      identityFields: ["currency"],
      fieldMap: {
        state: "status",
        planTier: "plan_name",
        amountMinor: "amount_cents",
        currentPeriodStart: "current_period_start",
        currentPeriodEnd: "current_period_end",
      },
      schemaVersion: 1,
      sourceRef: "backend.app.models.subscription.Subscription",
    },
    AgencyUser: {
      tier1: "Resource",
      concrete: "AgencyUser",
      identityFields: ["email", "role"],
      fieldMap: { name: "full_name", kind: "user" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.user.User",
      edges: {
        defaultScoring: {
          target: "LeadScoringConfig",
          type: "agency/user_default_scoring",
          cardinality: "zero_or_one",
          sourceRef: "ScoringConfig default per user/org",
        },
      },
    },
    LeadScoringConfig: {
      tier1: "Resource",
      concrete: "LeadScoringConfig",
      identityFields: ["name", "thresholds"],
      fieldMap: { kind: "scoring_config", currentTotalLeadsScored: "current_total_leads_scored" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.lead_score.ScoringConfig",
    },
    MediaAsset: {
      tier1: "Document",
      concrete: "MediaAsset",
      identityFields: [],
      fieldMap: { title: "filename", storageUri: "r2_url", mimeType: "mime_type", sizeBytes: "file_size" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.media_asset.MediaAsset / social_media.VideoAsset",
      edges: {
        post: {
          target: "SocialMediaPost",
          type: "agency/media_used_in_post",
          cardinality: "many",
          sourceRef: "SocialPost.media_urls",
        },
      },
    },
    ClientReport: {
      tier1: "Document",
      concrete: "ClientReport",
      identityFields: ["title", "periodStart", "periodEnd"],
      fieldMap: { storageUri: "pdf_url" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.report.ClientReport",
    },
    EmailCampaignSend: {
      tier1: "Communication",
      concrete: "EmailCampaignSend",
      identityFields: ["subject", "provider"],
      fieldMap: { sentAt: "sent_at", recipientCount: "recipient_count", externalRef: "ses_message_id" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.email_campaign.EmailCampaign/EmailSend",
    },
    SocialMediaPost: {
      tier1: "Communication",
      concrete: "SocialMediaPost",
      identityFields: ["platform"],
      fieldMap: { publishedAt: "published_at", externalRef: "platform_post_id" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.social_media.SocialPost",
    },
    BlogPost: {
      tier1: "Communication",
      concrete: "BlogPost",
      identityFields: ["title", "slug"],
      fieldMap: { state: "status", publishedAt: "published_at" },
      schemaVersion: 1,
      sourceRef: "backend.app.models.blog_post.BlogPost",
    },
  },
};

describe("Stevie / PluggedInSocial agency mapping", () => {
  it("validates the real app schema against @pm/profile-agency using source-field aliases", () => {
    const result = validateEntityMappingAgainstProfile(stevieAgencyMapping, AGENCY_PROFILE);
    if (!result.valid) console.error(JSON.stringify(result.issues, null, 2));
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
