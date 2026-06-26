import { createHash } from "node:crypto";
import {
  buildActionOutcomeEnvelope,
  buildActionOutcomeTerminalIndex,
  stateRef,
  type ActionOutcomeBlockingCause,
  type ActionOutcomeEnvelope,
  type ActionOutcomeTerminalIndex,
  type ActionTerminalOutcome,
  type StateRef,
} from "@pm/agent-state";
import type {
  TenantId,
  TerminalAdmissionProviderManifest,
  TerminalAdmissionProviderRef,
  Timestamp,
} from "@pm/types";

export type AgencyPublicationSubjectKind =
  | "blog_post"
  | "social_media_post"
  | "email_campaign_send";

export type AgencyPublicationActionType =
  | "blog_post.publish"
  | "blog_post.archive"
  | "social_media_post.publish"
  | "social_media_post.revoke"
  | "email_campaign_send.send";

export type AgencyPublicationApprovalStatus =
  | "approved"
  | "revoked"
  | "missing"
  | "expired";

export const AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER = {
  providerId: "agency.publication.action-outcome-envelope.v1",
  kind: "action_outcome_envelope",
  contractVersion: { major: 1, minor: 0, patch: 0 },
  packageName: "@pm/profile-agency",
  exportName: "buildAgencyPublicationActionOutcomeEnvelope",
  profiles: ["agency"],
  actionTypes: [
    "blog_post.publish",
    "blog_post.archive",
    "social_media_post.publish",
    "social_media_post.revoke",
    "email_campaign_send.send",
  ],
  evidenceRefKinds: ["source_record"],
  substrateRefKinds: [
    "action_outcome_envelope",
    "state_review_artifact",
    "source_record",
  ],
} as const satisfies TerminalAdmissionProviderRef;

export const AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER_MANIFEST = {
  ...AGENCY_PUBLICATION_TERMINAL_ADMISSION_PROVIDER,
  availability: "available",
} as const satisfies TerminalAdmissionProviderManifest;

export interface AgencyPublicationAuthoritySnapshot {
  readonly subject: StateRef;
  readonly subjectKind: AgencyPublicationSubjectKind;
  readonly contentHash: string;
  readonly approvedContentHash?: string;
  readonly approvalStatus: AgencyPublicationApprovalStatus;
  readonly approvalRef?: StateRef;
  readonly approvalCheckedAt: Timestamp;
  readonly approvalValidUntil?: Timestamp;
  readonly currentLifecycleState?: string;
  readonly requiredLifecycleState?: string;
  readonly sourceRefs?: readonly StateRef[];
}

export interface AgencyPublicationActionOutcomeEnvelopeInput {
  readonly tenantId: TenantId;
  readonly actionType: AgencyPublicationActionType;
  readonly sourceAdapter: string;
  readonly snapshot: AgencyPublicationAuthoritySnapshot;
  readonly stateReviewArtifactHash: string;
  readonly actionId?: string;
  readonly publicationId?: string;
  readonly proposalReviewId?: string;
  readonly requestedTerminalOutcome?: ActionTerminalOutcome;
  readonly decidedAt: Timestamp;
  readonly decidedBy?: string;
  readonly evidenceAdmissionReviewIds?: readonly string[];
  readonly statusCheckRefs?: readonly StateRef[];
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
}

export function buildAgencyPublicationActionOutcomeEnvelope(
  input: AgencyPublicationActionOutcomeEnvelopeInput,
): ActionOutcomeEnvelope {
  const actionId = input.actionId ?? agencyPublicationActionId(input);
  const outcomeRef = stateRef(
    "action_outcome_envelope",
    agencyPublicationOutcomeRefId(actionId),
    "Agency publication ActionOutcomeEnvelope",
  );
  const proposalReviewId =
    input.proposalReviewId ?? `${actionId}:proposal_review`;
  const sourceRefs = input.snapshot.sourceRefs ?? [];

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId,
    actionId,
    subject: input.snapshot.subject,
    proposalReviewId,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    evidenceAdmissionReviewIds: input.evidenceAdmissionReviewIds ?? [],
    ...(input.statusCheckRefs !== undefined
      ? { statusCheckRefs: input.statusCheckRefs }
      : {}),
    requestedTerminalOutcome: input.requestedTerminalOutcome ?? "accepted",
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy ?? `agency-publication:${input.sourceAdapter}`,
    evidenceRefs: uniqueStateRefs([
      ...(input.evidenceRefs ?? []),
      ...(input.snapshot.approvalRef === undefined
        ? []
        : [input.snapshot.approvalRef]),
      ...sourceRefs,
    ]),
    substrateRefs: uniqueStateRefs([
      outcomeRef,
      stateRef("state_review_artifact", input.stateReviewArtifactHash),
      input.snapshot.subject,
      ...(input.substrateRefs ?? []),
    ]),
    blockingCauses: agencyPublicationBlockingCauses(input),
  });
}

export function buildAgencyPublicationActionOutcomeTerminalIndex(
  inputs: readonly AgencyPublicationActionOutcomeEnvelopeInput[],
): ActionOutcomeTerminalIndex {
  return buildActionOutcomeTerminalIndex(
    inputs.map((input) => buildAgencyPublicationActionOutcomeEnvelope(input)),
  );
}

function agencyPublicationBlockingCauses(
  input: AgencyPublicationActionOutcomeEnvelopeInput,
): readonly ActionOutcomeBlockingCause[] {
  const snapshot = input.snapshot;
  const refs = uniqueStateRefs([
    snapshot.subject,
    ...(snapshot.approvalRef === undefined ? [] : [snapshot.approvalRef]),
    ...(snapshot.sourceRefs ?? []),
  ]);
  const causes: ActionOutcomeBlockingCause[] = [];

  if (actionRequiresActiveApproval(input.actionType)) {
    if (snapshot.approvalStatus !== "approved") {
      causes.push({
        source: "status_check",
        code: `approval_${snapshot.approvalStatus}`,
        message: `Agency publication action ${input.actionType} requires an active client approval; current approval status is ${snapshot.approvalStatus}.`,
        refs,
        invariantClasses: ["workflow_position"],
      });
    }
    if (
      snapshot.approvalValidUntil !== undefined &&
      Date.parse(snapshot.approvalValidUntil) < Date.parse(input.decidedAt)
    ) {
      causes.push({
        source: "status_check",
        code: "approval_stale",
        message: `Agency publication approval expired at ${snapshot.approvalValidUntil} before decision time ${input.decidedAt}.`,
        refs,
        invariantClasses: ["freshness_window"],
      });
    }
    if (
      snapshot.approvalStatus === "approved" &&
      (snapshot.approvedContentHash === undefined ||
        snapshot.approvedContentHash.trim() === "")
    ) {
      causes.push({
        source: "policy",
        code: "approved_content_hash_missing",
        message:
          "Agency publication approval must bind to an approved content hash before publishing.",
        refs,
        invariantClasses: ["state_conflict"],
      });
    } else if (
      snapshot.approvedContentHash !== undefined &&
      snapshot.approvedContentHash !== snapshot.contentHash
    ) {
      causes.push({
        source: "policy",
        code: "approved_content_hash_mismatch",
        message:
          "Current publication content hash does not match the approved content hash.",
        refs,
        invariantClasses: ["state_conflict"],
      });
    }
  }

  if (
    snapshot.requiredLifecycleState !== undefined &&
    snapshot.currentLifecycleState !== snapshot.requiredLifecycleState
  ) {
    causes.push({
      source: "proposal_review",
      code: "publication_lifecycle_mismatch",
      message: `Agency publication action ${input.actionType} requires lifecycle state ${snapshot.requiredLifecycleState}; current state is ${snapshot.currentLifecycleState ?? "unknown"}.`,
      refs,
      invariantClasses: ["workflow_position"],
    });
  }

  return causes;
}

function actionRequiresActiveApproval(
  actionType: AgencyPublicationActionType,
): boolean {
  return (
    actionType === "blog_post.publish" ||
    actionType === "social_media_post.publish" ||
    actionType === "email_campaign_send.send"
  );
}

function agencyPublicationActionId(
  input: AgencyPublicationActionOutcomeEnvelopeInput,
): string {
  return [
    input.tenantId,
    "agency",
    input.sourceAdapter,
    input.snapshot.subjectKind,
    input.snapshot.subject.id,
    input.actionType,
    input.publicationId ?? input.snapshot.contentHash,
  ].join(":");
}

function agencyPublicationOutcomeRefId(actionId: string): string {
  return `agency_publication_outcome_${createHash("sha256")
    .update(actionId)
    .digest("hex")
    .slice(0, 32)}`;
}

function uniqueStateRefs(refs: readonly StateRef[]): readonly StateRef[] {
  const seen = new Set<string>();
  const out: StateRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
