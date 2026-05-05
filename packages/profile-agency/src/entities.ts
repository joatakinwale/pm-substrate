import type { ProfileEntity } from "@pm/types";

/**
 * Marketing-agency profile concrete entity types.
 *
 * Each one extends ProfileEntity with a strongly-typed identity bag.
 * The Tier-1 interface this concrete type satisfies is asserted in
 * ./profile.ts via the EntityTypeDef catalog AND in ./profile.test.ts
 * with structural type-compat checks.
 *
 * Identity primacy: Project. Every other record reaches Project via edges.
 *
 * Modeling source: the real PluggedInSocial platform's SQLAlchemy models
 * (backend/app/models/*.py). Each entity here corresponds to a relational
 * table in that system. The mapping is intentionally lossy at the substrate
 * level — only stable identity attrs live on the node; relationships and
 * mutable contextual data ride on edges or projection state.
 *
 * G4 anti-fixation rule: building this package must not require any change
 * to packages/types, graph, events, registry, workflow, projections,
 * profile-wedding, profile-registry, capability-audit, or substrate-http.
 * If any of those need to change, the substrate has a fixation problem
 * and the change is a finding, not a feature.
 */

/**
 * ClientOrg — the agency's external client account. Specializes Counterparty.
 *
 * Maps to PluggedInSocial's Lead/Contact/Organization for the *client side*
 * (not the agency tenant itself; the agency tenant is the substrate
 * tenant_id, not a node).
 *
 * A ClientOrg is the entity an agency engages with. Multiple Projects,
 * Proposals, and Invoices reach back to a ClientOrg through edges.
 */
export interface ClientOrg
  extends ProfileEntity<{
    name: string;
    industry: string | null;
    website: string | null;
    /** Free-form revenue-range bucket (e.g. "$1-5M"). Profile-level only. */
    revenueRange: string | null;
    externalRef: string | null;
  }> {}

/**
 * Lead — a potential client not yet converted. Specializes Counterparty.
 *
 * Distinct from ClientOrg: a Lead is a *person* (or a person at a
 * pre-org account), with a qualification state. When converted, the
 * agency creates a ClientOrg + Contact and links them; the Lead node
 * stays for historical/attribution reasons.
 *
 * Lifecycle: declared in ./lifecycles.ts.
 */
export interface Lead
  extends ProfileEntity<{
    name: string;
    email: string | null;
    phone: string | null;
    qualificationStatus: LeadQualificationStatus;
    /** Source channel (e.g. "inbound_form", "referral", "outbound"). */
    source: string | null;
    externalRef: string | null;
  }> {}

export type LeadQualificationStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "disqualified";

/**
 * Contact — an individual person at a ClientOrg. Specializes Counterparty.
 *
 * Distinct from Lead: a Contact is a person already in the agency's book of
 * business, attached to a ClientOrg. Multiple Contacts per ClientOrg.
 */
export interface Contact
  extends ProfileEntity<{
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    externalRef: string | null;
  }> {}

/**
 * Project — the spine of the agency profile. Specializes Engagement.
 *
 * A Project is the unit of work. It belongs to exactly one ClientOrg,
 * has zero or more Proposals, Invoices, Campaigns, and MediaAssets
 * attached, and is assigned to AgencyUser staff members.
 *
 * Identity primacy: Project. The substrate uses this to decide indexing
 * for the agency profile.
 */
export interface Project
  extends ProfileEntity<{
    title: string;
    /** Free-form project type (e.g. "branding", "social", "ppc"). */
    projectType: string;
    operationalState: ProjectState;
    /** ISO-8601 kickoff date. */
    kickoffDate: string | null;
    /** ISO-8601 target completion date. */
    targetEndDate: string | null;
  }> {}

export type ProjectState =
  | "kickoff"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

/**
 * Proposal — a sales artifact issued to a ClientOrg for a Project.
 * Specializes Engagement (not Document — a proposal *is* a sales engagement;
 * the rendered PDF is a separate MediaAsset Document if needed).
 */
export interface Proposal
  extends ProfileEntity<{
    title: string;
    state: ProposalState;
    /** Total amount in minor units (cents). */
    amountMinor: number;
    currency: string;
    /** ISO-8601 sent date. */
    sentAt: string | null;
  }> {}

export type ProposalState =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

/**
 * Booking — a scheduled engagement with a ClientOrg, e.g. a discovery call,
 * shoot day, or workshop. Specializes Engagement.
 */
export interface Booking
  extends ProfileEntity<{
    title: string;
    state: BookingState;
    /** ISO-8601 start time. */
    startsAt: string;
    /** ISO-8601 end time. */
    endsAt: string | null;
    location: string | null;
  }> {}

export type BookingState =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

/**
 * Campaign — a multi-asset, multi-channel marketing push. Specializes Engagement.
 *
 * A Campaign coordinates SocialMediaPosts, EmailCampaignSends, and BlogPosts
 * around a unified theme/timeline. One Project may contain multiple Campaigns.
 */
export interface Campaign
  extends ProfileEntity<{
    title: string;
    state: CampaignState;
    /** ISO-8601 launch date. */
    launchDate: string | null;
    objective: string | null;
  }> {}

export type CampaignState =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "completed"
  | "cancelled";

/**
 * Invoice — billable document issued by the agency to a ClientOrg.
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
  | "overdue"
  | "void"
  | "uncollectible";

/**
 * Subscription — recurring billing arrangement with a ClientOrg.
 * Specializes Transaction.
 *
 * Distinct from Invoice in that a Subscription is the *agreement* (recurring),
 * while each billing period generates one Invoice.
 */
export interface Subscription
  extends ProfileEntity<{
    state: SubscriptionState;
    planTier: string;
    /** Per-period amount in minor units. */
    amountMinor: number;
    currency: string;
    /** ISO-8601 start of current billing period. */
    currentPeriodStart: string | null;
    /** ISO-8601 end of current billing period. */
    currentPeriodEnd: string | null;
  }> {}

export type SubscriptionState =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

/**
 * AgencyUser — a staff member at the agency tenant. Specializes Resource.
 *
 * Used for assignment edges (Project → AgencyUser, Lead → AgencyUser).
 * The agency tenant itself is the substrate tenant_id; AgencyUser nodes
 * are individual people inside that tenant.
 *
 * Why `kind`? The Resource Tier-1 interface requires a `kind` discriminator.
 * AgencyUser always sets it to the literal "agency_user".
 */
export interface AgencyUser
  extends ProfileEntity<{
    name: string;
    email: string;
    /** Resource kind discriminator. Always "agency_user" for this type. */
    kind: "agency_user";
    role: AgencyUserRole;
  }> {}

export type AgencyUserRole =
  | "owner"
  | "admin"
  | "account_manager"
  | "creative"
  | "analyst"
  | "viewer";

/**
 * LeadScoringConfig — a named ruleset for evaluating Leads. Specializes Resource.
 *
 * Mirrors the same architectural pattern as BudgetCategory in profile-wedding:
 * a Resource node that aggregates state owned exclusively by one capability.
 *
 * The agency-lead-scoring capability (Tier-2) listens to lead-related events,
 * walks the graph from Lead → AgencyUser (assigned) → LeadScoringConfig, and
 * recomputes the lead's score using the config. The capability uses
 * `FOR UPDATE` on a LeadScore projection (not on the config) to serialize
 * concurrent score updates per lead.
 *
 * `currentTotalLeadsScored` is owned exclusively by the capability and serves
 * the same role `actualSpentMinor` plays in BudgetCategory: a running rollup
 * the capability maintains by walking the graph instead of by trusting an
 * inbound payload field.
 */
export interface LeadScoringConfig
  extends ProfileEntity<{
    name: string;
    /** Resource kind discriminator. Always "lead_scoring_config" for this type. */
    kind: "lead_scoring_config";
    /**
     * Score thresholds, per qualification tier. Keyed by tier label (e.g.
     * "cold", "warm", "hot"). Values are the minimum score for that tier.
     */
    thresholds: Readonly<Record<string, number>>;
    /**
     * Running rollup of Leads ever scored under this config. Initial value: 0.
     * Updated exclusively by the agency-lead-scoring capability.
     */
    currentTotalLeadsScored: number;
  }> {}

/**
 * MediaAsset — a stored file (image, video, audio, doc). Specializes Document.
 *
 * The actual bytes live in object storage; this node carries identity
 * (URI / external ref) and stable attrs only.
 */
export interface MediaAsset
  extends ProfileEntity<{
    title: string;
    /** Storage URI (e.g. "s3://bucket/key"). */
    storageUri: string;
    mimeType: string;
    /** File size in bytes. Stable — file is immutable once stored. */
    sizeBytes: number;
  }> {}

/**
 * ClientReport — a generated report delivered to a ClientOrg. Specializes Document.
 *
 * A ClientReport is the immutable artifact (a PDF or rendered HTML); cadence,
 * delivery state, and ownership ride on edges.
 */
export interface ClientReport
  extends ProfileEntity<{
    title: string;
    /** ISO-8601 report period start. */
    periodStart: string;
    /** ISO-8601 report period end. */
    periodEnd: string;
    /** Storage URI of the rendered artifact. */
    storageUri: string;
  }> {}

/**
 * EmailCampaignSend — a single bulk-email dispatch. Specializes Communication.
 *
 * One row per *send event*, not per recipient. Per-recipient state lives in
 * the event log (delivered/opened/clicked) rather than as fat-node data.
 */
export interface EmailCampaignSend
  extends ProfileEntity<{
    subject: string;
    /** ISO-8601 dispatch time. */
    sentAt: string;
    /** Total recipients at send time. */
    recipientCount: number;
    /** Provider (e.g. "resend", "sendgrid"). */
    provider: string;
    externalRef: string | null;
  }> {}

/**
 * SocialMediaPost — a published post on a social platform. Specializes Communication.
 *
 * Counts/likes/etc. are projection state, not node identity.
 */
export interface SocialMediaPost
  extends ProfileEntity<{
    platform: SocialPlatform;
    /** ISO-8601 publish time. */
    publishedAt: string;
    /** External post ID on the platform. */
    externalRef: string;
  }> {}

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "tiktok"
  | "youtube"
  | "pinterest";

/**
 * BlogPost — a published article on a Page (the agency's site or a client site).
 * Specializes Communication.
 *
 * The rendered HTML/Markdown is content state on the node identity bag because
 * the URL is what addresses it; views/comments are projection state.
 */
export interface BlogPost
  extends ProfileEntity<{
    title: string;
    slug: string;
    /** ISO-8601 publish time. */
    publishedAt: string | null;
    state: BlogPostState;
  }> {}

export type BlogPostState =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";
