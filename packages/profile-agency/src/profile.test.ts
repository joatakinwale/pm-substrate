/**
 * Marketing-agency profile contract tests.
 *
 * Two purposes:
 *   1. Type-level: prove every agency concrete entity is structurally
 *      assignable to the Tier-1 interface its profile.ts entry asserts.
 *      If this breaks, the profile is lying about which Tier-1 contract
 *      it implements.
 *   2. Runtime: validate the ProfileDefinition is internally consistent —
 *      every entityType.requiredFields ⊆ optionalFields ∪ requiredFields,
 *      every lifecycle's `transitions[].from` references declared states,
 *      etc.
 *
 * G4 anti-fixation: this test must pass with ZERO changes to the substrate.
 * If it fails because @pm/types or any other substrate package needs a tweak,
 * that's a substrate fixation finding, not a feature.
 */

import { describe, expect, it } from "vitest";

import type {
  Communication,
  Counterparty,
  Document,
  Engagement,
  ProfileEntity,
  Resource,
  Transaction,
} from "@pm/types";

import type {
  AgencyUser,
  BlogPost,
  Booking,
  Campaign,
  ClientOrg,
  ClientReport,
  Contact,
  EmailCampaignSend,
  Invoice,
  Lead,
  LeadScoringConfig,
  MediaAsset,
  Project,
  Proposal,
  SocialMediaPost,
  Subscription,
} from "./entities.js";
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
import { AGENCY_PROFILE } from "./profile.js";

// =============================================================================
// 1. Type-level contract proofs.
//    Compile-time checks. Would fail typecheck if a concrete type drifts
//    from the Tier-1 contract its profile entry asserts.
// =============================================================================

type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;

// Counterparty specializations
type _ClientOrg_isCounterparty = Assert<IsAssignable<ClientOrg, Counterparty>>;
type _Lead_isCounterparty = Assert<IsAssignable<Lead, Counterparty>>;
type _Contact_isCounterparty = Assert<IsAssignable<Contact, Counterparty>>;

// Engagement specializations
type _Project_isEngagement = Assert<IsAssignable<Project, Engagement>>;
type _Proposal_isEngagement = Assert<IsAssignable<Proposal, Engagement>>;
type _Booking_isEngagement = Assert<IsAssignable<Booking, Engagement>>;
type _Campaign_isEngagement = Assert<IsAssignable<Campaign, Engagement>>;

// Transaction specializations
type _Invoice_isTransaction = Assert<IsAssignable<Invoice, Transaction>>;
type _Subscription_isTransaction = Assert<IsAssignable<Subscription, Transaction>>;

// Resource specializations
type _AgencyUser_isResource = Assert<IsAssignable<AgencyUser, Resource>>;
type _LeadScoringConfig_isResource = Assert<
  IsAssignable<LeadScoringConfig, Resource>
>;

// Document specializations
type _MediaAsset_isDocument = Assert<IsAssignable<MediaAsset, Document>>;
type _ClientReport_isDocument = Assert<IsAssignable<ClientReport, Document>>;

// Communication specializations
type _EmailSend_isCommunication = Assert<
  IsAssignable<EmailCampaignSend, Communication>
>;
type _SocialPost_isCommunication = Assert<
  IsAssignable<SocialMediaPost, Communication>
>;
type _BlogPost_isCommunication = Assert<IsAssignable<BlogPost, Communication>>;

// Every agency entity is at minimum a ProfileEntity
type _Project_isProfileEntity = Assert<
  IsAssignable<Project, ProfileEntity<Record<string, unknown>>>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Refs =
  | _ClientOrg_isCounterparty
  | _Lead_isCounterparty
  | _Contact_isCounterparty
  | _Project_isEngagement
  | _Proposal_isEngagement
  | _Booking_isEngagement
  | _Campaign_isEngagement
  | _Invoice_isTransaction
  | _Subscription_isTransaction
  | _AgencyUser_isResource
  | _LeadScoringConfig_isResource
  | _MediaAsset_isDocument
  | _ClientReport_isDocument
  | _EmailSend_isCommunication
  | _SocialPost_isCommunication
  | _BlogPost_isCommunication
  | _Project_isProfileEntity;

// =============================================================================
// 2. Runtime profile-definition self-consistency.
// =============================================================================

describe("AGENCY_PROFILE definition self-consistency", () => {
  it("identity primacy is a declared concrete entity", () => {
    expect(AGENCY_PROFILE.entityTypes[AGENCY_PROFILE.identityPrimacy]).toBeDefined();
    expect(AGENCY_PROFILE.identityPrimacy).toBe("Project");
  });

  it("every entity-type entry's `concrete` matches its key", () => {
    for (const [key, def] of Object.entries(AGENCY_PROFILE.entityTypes)) {
      expect(def.concrete).toBe(key);
    }
  });

  it("every entity-type binds to a valid Tier-1 type name", () => {
    const validTier1 = new Set([
      "Counterparty",
      "Engagement",
      "Transaction",
      "Resource",
      "Communication",
      "Document",
      "Event",
    ]);
    for (const def of Object.values(AGENCY_PROFILE.entityTypes)) {
      expect(validTier1.has(def.tier1)).toBe(true);
    }
  });

  it("required fields and optional fields do not overlap", () => {
    for (const [name, def] of Object.entries(AGENCY_PROFILE.entityTypes)) {
      const reqd = new Set(def.requiredFields);
      for (const opt of def.optionalFields) {
        expect(
          reqd.has(opt),
          `${name}: field "${opt}" is in both required and optional`,
        ).toBe(false);
      }
    }
  });

  it("every edge's fromTypes/toTypes reference declared concrete entities", () => {
    const concrete = new Set(Object.keys(AGENCY_PROFILE.entityTypes));
    for (const [name, edge] of Object.entries(AGENCY_PROFILE.edgeTypes)) {
      for (const t of edge.fromTypes) {
        expect(
          concrete.has(t),
          `edge "${name}" references unknown fromType "${t}"`,
        ).toBe(true);
      }
      for (const t of edge.toTypes) {
        expect(
          concrete.has(t),
          `edge "${name}" references unknown toType "${t}"`,
        ).toBe(true);
      }
    }
  });

  it("every edge cardinality is a recognized constraint", () => {
    const re = /^(exactly|at-most|at-least):\d+$|^unbounded$/;
    for (const [name, edge] of Object.entries(AGENCY_PROFILE.edgeTypes)) {
      expect(re.test(edge.fromCardinality), `edge "${name}".from`).toBe(true);
      expect(re.test(edge.toCardinality), `edge "${name}".to`).toBe(true);
    }
  });

  it("every lifecycle's `initial` is a declared state", () => {
    for (const [name, lc] of Object.entries(AGENCY_PROFILE.lifecycles)) {
      expect(lc.states.includes(lc.initial), `${name}: initial not in states`).toBe(true);
    }
  });

  it("every lifecycle's `terminal` states are declared states", () => {
    for (const [name, lc] of Object.entries(AGENCY_PROFILE.lifecycles)) {
      for (const t of lc.terminal) {
        expect(lc.states.includes(t), `${name}: terminal "${t}" not in states`).toBe(true);
      }
    }
  });

  it("every transition's `from` and `to` reference declared states", () => {
    for (const [name, lc] of Object.entries(AGENCY_PROFILE.lifecycles)) {
      const states = new Set(lc.states);
      for (const tr of lc.transitions) {
        expect(states.has(tr.to), `${name}: transition.to "${tr.to}" not in states`).toBe(true);
        for (const f of tr.from) {
          expect(states.has(f), `${name}: transition.from "${f}" not in states`).toBe(true);
        }
      }
    }
  });

  it("Project lifecycle starts in kickoff", () => {
    expect(PROJECT_LIFECYCLE.initial).toBe("kickoff");
    expect(PROJECT_LIFECYCLE.terminal).toEqual(["completed", "cancelled"]);
  });

  it("Proposal lifecycle starts in draft", () => {
    expect(PROPOSAL_LIFECYCLE.initial).toBe("draft");
  });

  it("Booking lifecycle starts in scheduled", () => {
    expect(BOOKING_LIFECYCLE.initial).toBe("scheduled");
  });

  it("Campaign lifecycle starts in draft", () => {
    expect(CAMPAIGN_LIFECYCLE.initial).toBe("draft");
  });

  it("Invoice lifecycle starts in draft and includes overdue", () => {
    expect(INVOICE_LIFECYCLE.initial).toBe("draft");
    expect(INVOICE_LIFECYCLE.states).toContain("overdue");
  });

  it("Subscription lifecycle starts in trialing", () => {
    expect(SUBSCRIPTION_LIFECYCLE.initial).toBe("trialing");
  });

  it("BlogPost lifecycle starts in draft", () => {
    expect(BLOG_POST_LIFECYCLE.initial).toBe("draft");
  });
});

// =============================================================================
// 3. Agency-specific structural rules.
//    Verifies that the profile actually encodes the rules we say it does
//    (not just in our heads).
// =============================================================================

describe("Agency profile constraints", () => {
  it("client_has_project pins Project to exactly one ClientOrg", () => {
    expect(EDGE_CATALOG.client_has_project).toBeDefined();
    expect(EDGE_CATALOG.client_has_project!.fromTypes).toEqual(["ClientOrg"]);
    expect(EDGE_CATALOG.client_has_project!.toTypes).toEqual(["Project"]);
    // From a ClientOrg, unbounded number of Projects.
    expect(EDGE_CATALOG.client_has_project!.fromCardinality).toBe("unbounded");
    // A Project must reach back to exactly one ClientOrg.
    expect(EDGE_CATALOG.client_has_project!.toCardinality).toBe("exactly:1");
  });

  it("Project is the identity-primacy spine", () => {
    expect(AGENCY_PROFILE.identityPrimacy).toBe("Project");
  });

  it("lead_scored_by connects Lead to LeadScoringConfig (graph-inferred scoring)", () => {
    const edge = EDGE_CATALOG.lead_scored_by;
    expect(edge).toBeDefined();
    expect(edge!.fromTypes).toEqual(["Lead"]);
    expect(edge!.toTypes).toEqual(["LeadScoringConfig"]);
    // A lead is scored by at most one config (with fallback via user_default_scoring).
    expect(edge!.fromCardinality).toBe("at-most:1");
    // Many leads can share a config.
    expect(edge!.toCardinality).toBe("unbounded");
  });

  it("user_default_scoring lets a config be inherited from the assigned user", () => {
    const edge = EDGE_CATALOG.user_default_scoring;
    expect(edge).toBeDefined();
    expect(edge!.fromTypes).toEqual(["AgencyUser"]);
    expect(edge!.toTypes).toEqual(["LeadScoringConfig"]);
    expect(edge!.fromCardinality).toBe("at-most:1");
  });

  it("LeadScoringConfig is a Resource carrying a capability-owned rollup field", () => {
    const def = AGENCY_PROFILE.entityTypes["LeadScoringConfig"];
    expect(def).toBeDefined();
    expect(def!.tier1).toBe("Resource");
    expect(def!.requiredFields).toContain("currentTotalLeadsScored");
    expect(def!.requiredFields).toContain("thresholds");
    // Discriminator carried in the kind field for Resource.
    expect(def!.requiredFields).toContain("kind");
  });

  it("subscription_has_invoice fans out one subscription to many invoices", () => {
    const edge = EDGE_CATALOG.subscription_has_invoice;
    expect(edge).toBeDefined();
    expect(edge!.fromCardinality).toBe("unbounded");
    expect(edge!.toCardinality).toBe("exactly:1");
  });

  it("campaign_has_post / email_send / blog_post cover the three Communication channels", () => {
    expect(EDGE_CATALOG.campaign_has_post).toBeDefined();
    expect(EDGE_CATALOG.campaign_has_email_send).toBeDefined();
    expect(EDGE_CATALOG.campaign_has_blog_post).toBeDefined();
  });

  it("Lead.qualificationStatus is in the identity bag, not a substrate lifecycle", () => {
    // Intentional: we keep CRM-style progression in the identity bag rather
    // than as a substrate-enforced lifecycle, paralleling how earlier profiles
    // handles Couple/Guest/Vendor states. If you want to lift it later, that's
    // a separate decision — it's not a substrate gap.
    expect(AGENCY_PROFILE.lifecycles["Lead"]).toBeUndefined();
    const def = AGENCY_PROFILE.entityTypes["Lead"];
    expect(def!.requiredFields).toContain("qualificationStatus");
  });
});
