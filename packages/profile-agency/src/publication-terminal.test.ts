import { describe, expect, it } from "vitest";
import {
  stateRef,
  verifyActionOutcomeEnvelopeHash,
} from "@pm/agent-state";
import { verifyTerminalAdmissionProviderRef } from "@pm/registry";
import { tenantId, timestamp } from "@pm/types";

import {
  AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER,
  AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER_MANIFEST,
  buildAgencyPublicationActionOutcomeEnvelope,
  buildAgencyPublicationActionOutcomeTerminalIndex,
  type AgencyPublicationActionOutcomeEnvelopeInput,
} from "./publication-terminal.js";

const tenant = tenantId("tnt_agency_publication_terminal");
const subject = stateRef("graph_node", "blog_post_launch_001", "Launch blog post");
const approvalRef = stateRef(
  "document",
  "client_approval_launch_001",
  "Client approval for launch blog post",
);
const sourceRef = stateRef(
  "source_record",
  "pluggedinsocial:blog_post:launch_001",
  "PluggedInSocial blog post row",
);

function input(
  overrides: Partial<AgencyPublicationActionOutcomeEnvelopeInput> = {},
): AgencyPublicationActionOutcomeEnvelopeInput {
  return {
    tenantId: tenant,
    actionType: "blog_post.publish",
    sourceAdapter: "pluggedinsocial-authoritative-fixture",
    publicationId: "launch_001",
    stateReviewArtifactHash: "a".repeat(64),
    decidedAt: timestamp("2026-06-25T14:00:00.000Z"),
    snapshot: {
      subject,
      subjectKind: "blog_post",
      contentHash: "content_hash_current_v1",
      approvedContentHash: "content_hash_current_v1",
      approvalStatus: "approved",
      approvalRef,
      approvalCheckedAt: timestamp("2026-06-25T13:55:00.000Z"),
      approvalValidUntil: timestamp("2026-06-25T15:00:00.000Z"),
      currentLifecycleState: "scheduled",
      requiredLifecycleState: "scheduled",
      sourceRefs: [sourceRef],
    },
    ...overrides,
  };
}

describe("agency publication terminal admission contract", () => {
  it("exposes a registry-advertisable terminal-admission provider ref", () => {
    expect(AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER).toMatchObject({
      providerId: "agency.publication.action-outcome-envelope.v1",
      kind: "action_outcome_envelope",
      packageName: "@pm/profile-agency",
      exportName: "buildAgencyPublicationActionOutcomeEnvelope",
      profiles: ["agency"],
    });
    expect(AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER.actionTypes).toContain(
      "blog_post.publish",
    );
  });

  it("verifies the publication provider ref against its live manifest", () => {
    const verification = verifyTerminalAdmissionProviderRef(
      AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER,
      [AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER_MANIFEST],
    );

    expect(verification.verified).toBe(true);
    expect(verification.issues).toEqual([]);
    expect(verification.manifest).toMatchObject({
      providerId: "agency.publication.action-outcome-envelope.v1",
      availability: "available",
    });
  });

  it("builds an accepted terminal envelope for an approved matching publish fixture", () => {
    const envelope = buildAgencyPublicationActionOutcomeEnvelope(input());

    expect(envelope).toMatchObject({
      tenantId: tenant,
      terminalOutcome: "accepted",
      blockingCauses: [],
      subject,
      proposalReviewId:
        "tnt_agency_publication_terminal:agency:pluggedinsocial-authoritative-fixture:blog_post:blog_post_launch_001:blog_post.publish:launch_001:proposal_review",
      evidenceRefs: [approvalRef, sourceRef],
    });
    expect(envelope.substrateRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "action_outcome_envelope" }),
        expect.objectContaining({ kind: "state_review_artifact" }),
        subject,
      ]),
    );
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });

  it("blocks publish when the authoritative client approval was revoked", () => {
    const envelope = buildAgencyPublicationActionOutcomeEnvelope(
      input({
        decidedAt: timestamp("2026-06-25T14:05:00.000Z"),
        snapshot: {
          ...input().snapshot,
          approvalStatus: "revoked",
        },
      }),
    );

    expect(envelope.terminalOutcome).toBe("blocked");
    expect(envelope.blockingCauses).toEqual([
      expect.objectContaining({
        source: "status_check",
        code: "approval_revoked",
      }),
    ]);
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });

  it("reports same-action accepted and revoked publish attempts as terminal conflicts", () => {
    const actionId =
      "tnt_agency_publication_terminal:axis_b:publish_after_approval_revoked";
    const accepted = input({ actionId });
    const duplicate = input({ actionId });
    const revoked = input({
      actionId,
      decidedAt: timestamp("2026-06-25T14:06:00.000Z"),
      snapshot: {
        ...input().snapshot,
        approvalStatus: "revoked",
      },
    });

    const index = buildAgencyPublicationActionOutcomeTerminalIndex([
      accepted,
      duplicate,
      revoked,
    ]);

    expect(index.valid).toBe(false);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      actionId,
      replayCount: 2,
      envelope: {
        terminalOutcome: "accepted",
      },
    });
    expect(index.issues).toEqual([
      expect.objectContaining({
        code: "terminal_outcome_conflict",
        actionId,
        candidate: expect.objectContaining({
          terminalOutcome: "blocked",
        }),
        incumbent: expect.objectContaining({
          terminalOutcome: "accepted",
        }),
      }),
    ]);
  });
});
