import { createHash } from "node:crypto";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeBlockingCause,
  type ActionOutcomeEnvelope,
  type ActionTerminalOutcome,
  type StateRef,
} from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";

export const AGENCY_MARKETING_NEXT_ACTION_PROPOSAL_SCHEMA_VERSION =
  "agency-marketing-next-action-proposal.v1" as const;

export const AGENCY_MARKETING_NEXT_ACTION_TYPE =
  "marketing.next_action.propose" as const;

export type AgencyMarketingNextActionRecommendation =
  | "launch_followup_campaign"
  | "revise_content_strategy"
  | "increase_distribution"
  | "pause_and_review"
  | "escalate_to_human";

export interface AgencyMarketingReportSnapshot {
  readonly reportRef: StateRef;
  readonly reportHash: string;
  readonly generatedAt: Timestamp;
  readonly sourceRefs?: readonly StateRef[];
}

export interface AgencyMarketingMetricsSnapshot {
  readonly observedAt: Timestamp;
  readonly sampleSize: number;
  readonly qualifiedLeads?: number;
  readonly engagementRate?: number;
  readonly conversionRate?: number;
  readonly spendCents?: number;
  readonly sourceRefs?: readonly StateRef[];
}

export interface AgencyMarketingNextActionProposalInput {
  readonly tenantId: TenantId;
  readonly sourceAdapter: string;
  readonly campaign: StateRef;
  readonly report: AgencyMarketingReportSnapshot;
  readonly metrics: AgencyMarketingMetricsSnapshot;
  readonly stateReviewArtifactHash: string;
  readonly decidedAt: Timestamp;
  readonly actionId?: string;
  readonly proposalReviewId?: string;
  readonly recommendedAction?: AgencyMarketingNextActionRecommendation;
  readonly confidence?: number;
  readonly minConfidence?: number;
  readonly minSampleSize?: number;
  readonly maxEvidenceAgeMs?: number;
  readonly requestedTerminalOutcome?: ActionTerminalOutcome;
  readonly decidedBy?: string;
  readonly evidenceAdmissionReviewIds?: readonly string[];
  readonly statusCheckRefs?: readonly StateRef[];
  readonly evidenceRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
}

export interface AgencyMarketingNextActionProposal {
  readonly schemaVersion: typeof AGENCY_MARKETING_NEXT_ACTION_PROPOSAL_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly proposalId: string;
  readonly actionType: typeof AGENCY_MARKETING_NEXT_ACTION_TYPE;
  readonly recommendedAction: AgencyMarketingNextActionRecommendation;
  readonly confidence: number;
  readonly campaign: StateRef;
  readonly reportRef: StateRef;
  readonly rationale: readonly string[];
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
  readonly envelope: ActionOutcomeEnvelope;
}

const DEFAULT_MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MIN_CONFIDENCE = 0.65;
const DEFAULT_MIN_SAMPLE_SIZE = 25;

export function buildAgencyMarketingNextActionProposal(
  input: AgencyMarketingNextActionProposalInput,
): AgencyMarketingNextActionProposal {
  const recommendedAction =
    input.recommendedAction ?? recommendMarketingNextAction(input.metrics);
  const confidence = input.confidence ?? estimateRecommendationConfidence(input.metrics);
  const actionId =
    input.actionId ??
    agencyMarketingNextActionId(input, recommendedAction);
  const proposalId = `${actionId}:proposal`;
  const proposalReviewId =
    input.proposalReviewId ?? `${actionId}:proposal_review`;
  const outcomeRef = stateRef(
    "action_outcome_envelope",
    agencyMarketingNextActionOutcomeRefId(actionId),
    "Agency marketing next-action proposal outcome",
  );
  const evidenceRefs = uniqueStateRefs([
    ...(input.evidenceRefs ?? []),
    input.report.reportRef,
    ...(input.report.sourceRefs ?? []),
    ...(input.metrics.sourceRefs ?? []),
  ]);
  const substrateRefs = uniqueStateRefs([
    outcomeRef,
    stateRef("state_review_artifact", input.stateReviewArtifactHash),
    input.campaign,
    ...(input.substrateRefs ?? []),
  ]);

  const envelope = buildActionOutcomeEnvelope({
    tenantId: input.tenantId,
    actionId,
    subject: input.campaign,
    proposalReviewId,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    evidenceAdmissionReviewIds: input.evidenceAdmissionReviewIds ?? [],
    ...(input.statusCheckRefs !== undefined
      ? { statusCheckRefs: input.statusCheckRefs }
      : {}),
    requestedTerminalOutcome: input.requestedTerminalOutcome ?? "accepted",
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy ?? `agency-next-action:${input.sourceAdapter}`,
    evidenceRefs,
    substrateRefs,
    blockingCauses: agencyMarketingNextActionBlockingCauses(input, confidence),
  });

  return {
    schemaVersion: AGENCY_MARKETING_NEXT_ACTION_PROPOSAL_SCHEMA_VERSION,
    tenantId: input.tenantId,
    proposalId,
    actionType: AGENCY_MARKETING_NEXT_ACTION_TYPE,
    recommendedAction,
    confidence,
    campaign: input.campaign,
    reportRef: input.report.reportRef,
    rationale: rationaleForRecommendation(recommendedAction, input.metrics),
    evidenceRefs,
    substrateRefs,
    envelope,
  };
}

function agencyMarketingNextActionBlockingCauses(
  input: AgencyMarketingNextActionProposalInput,
  confidence: number,
): readonly ActionOutcomeBlockingCause[] {
  const causes: ActionOutcomeBlockingCause[] = [];
  const refs = uniqueStateRefs([
    input.campaign,
    input.report.reportRef,
    ...(input.report.sourceRefs ?? []),
    ...(input.metrics.sourceRefs ?? []),
  ]);
  const maxEvidenceAgeMs =
    input.maxEvidenceAgeMs ?? DEFAULT_MAX_EVIDENCE_AGE_MS;

  if (input.report.reportHash.trim() === "") {
    causes.push({
      source: "policy",
      code: "report_hash_missing",
      message:
        "Agency next-action proposals require a report hash binding the recommendation to reviewed report content.",
      refs,
      invariantClasses: ["state_conflict"],
    });
  }

  if (
    (input.report.sourceRefs ?? []).length === 0 ||
    (input.metrics.sourceRefs ?? []).length === 0
  ) {
    causes.push({
      source: "policy",
      code: "source_evidence_missing",
      message:
        "Agency next-action proposals require source refs for both the report and metrics snapshot.",
      refs,
      invariantClasses: ["state_conflict"],
    });
  }

  if (
    evidenceAgeMs(input.report.generatedAt, input.decidedAt) >
    maxEvidenceAgeMs
  ) {
    causes.push({
      source: "status_check",
      code: "report_stale",
      message: `Agency next-action report generated at ${input.report.generatedAt} is outside the evidence freshness window for decision time ${input.decidedAt}.`,
      refs,
      invariantClasses: ["freshness_window"],
    });
  }

  if (
    evidenceAgeMs(input.metrics.observedAt, input.decidedAt) >
    maxEvidenceAgeMs
  ) {
    causes.push({
      source: "status_check",
      code: "metrics_stale",
      message: `Agency next-action metrics observed at ${input.metrics.observedAt} are outside the evidence freshness window for decision time ${input.decidedAt}.`,
      refs,
      invariantClasses: ["freshness_window"],
    });
  }

  const minSampleSize = input.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
  if (input.metrics.sampleSize < minSampleSize) {
    causes.push({
      source: "status_check",
      code: "metrics_sample_too_small",
      message: `Agency next-action metrics sample size ${input.metrics.sampleSize} is below minimum sample size ${minSampleSize}.`,
      refs,
      invariantClasses: ["freshness_window"],
    });
  }

  const minConfidence = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  if (confidence < minConfidence) {
    causes.push({
      source: "proposal_review",
      code: "recommendation_confidence_too_low",
      message: `Agency next-action recommendation confidence ${confidence.toFixed(2)} is below minimum confidence ${minConfidence.toFixed(2)}.`,
      refs,
      invariantClasses: ["capability_contract"],
    });
  }

  return causes;
}

function recommendMarketingNextAction(
  metrics: AgencyMarketingMetricsSnapshot,
): AgencyMarketingNextActionRecommendation {
  const qualifiedLeads = metrics.qualifiedLeads ?? 0;
  const conversionRate = metrics.conversionRate ?? 0;
  const engagementRate = metrics.engagementRate ?? 0;

  if (qualifiedLeads >= 10 && conversionRate >= 0.03) {
    return "launch_followup_campaign";
  }
  if (engagementRate >= 0.05 && conversionRate < 0.015) {
    return "increase_distribution";
  }
  if (engagementRate < 0.02 || conversionRate < 0.01) {
    return "revise_content_strategy";
  }
  return "pause_and_review";
}

function estimateRecommendationConfidence(
  metrics: AgencyMarketingMetricsSnapshot,
): number {
  const sampleContribution = Math.min(metrics.sampleSize / 500, 0.25);
  const conversionContribution = Math.min((metrics.conversionRate ?? 0) * 3, 0.15);
  const leadContribution = Math.min((metrics.qualifiedLeads ?? 0) / 100, 0.15);
  return roundConfidence(
    0.5 + sampleContribution + conversionContribution + leadContribution,
  );
}

function rationaleForRecommendation(
  recommendation: AgencyMarketingNextActionRecommendation,
  metrics: AgencyMarketingMetricsSnapshot,
): readonly string[] {
  switch (recommendation) {
    case "launch_followup_campaign":
      return [
        "qualified leads and conversion rate support a follow-up campaign",
      ];
    case "increase_distribution":
      return [
        "engagement is strong while conversion is not yet carrying the campaign",
      ];
    case "revise_content_strategy":
      return [
        "engagement or conversion is below the threshold for scaling distribution",
      ];
    case "escalate_to_human":
      return ["the evidence points to a decision that needs human judgment"];
    case "pause_and_review":
      return [
        `sample size ${metrics.sampleSize} does not support a stronger autonomous recommendation`,
      ];
  }
}

function agencyMarketingNextActionId(
  input: AgencyMarketingNextActionProposalInput,
  recommendedAction: AgencyMarketingNextActionRecommendation,
): string {
  return [
    input.tenantId,
    "agency",
    input.sourceAdapter,
    "campaign",
    input.campaign.id,
    AGENCY_MARKETING_NEXT_ACTION_TYPE,
    recommendedAction,
    input.report.reportHash,
  ].join(":");
}

function agencyMarketingNextActionOutcomeRefId(actionId: string): string {
  return `agency_next_action_outcome_${createHash("sha256")
    .update(actionId)
    .digest("hex")
    .slice(0, 32)}`;
}

function evidenceAgeMs(observedAt: Timestamp, decidedAt: Timestamp): number {
  const observed = Date.parse(observedAt);
  const decided = Date.parse(decidedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(decided)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(decided - observed);
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
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
