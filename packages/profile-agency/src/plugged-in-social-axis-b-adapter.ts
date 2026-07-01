import { createHash } from "node:crypto";
import { stateRef, type StateRef } from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";

import {
  buildAgencyMarketingNextActionProposal,
  type AgencyMarketingNextActionProposal,
} from "./next-action-proposal.js";
import {
  PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES,
  readPluggedInSocialSourceManifest,
  type PluggedInSocialManifestRef,
  type PluggedInSocialSourceManifest,
} from "./plugged-in-social-manifest.js";

export interface PluggedInSocialClientReportSnapshot {
  readonly id: string;
  readonly org_id: string;
  readonly project_id?: string | null;
  readonly title: string;
  readonly status: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly metrics_snapshot: Record<string, unknown>;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly pdf_generated_at?: string | null;
  readonly metrics_observed_at?: string | null;
}

export interface PluggedInSocialAxisBNextActionAdapterInput {
  readonly tenantId: TenantId;
  readonly report: PluggedInSocialClientReportSnapshot;
  readonly decidedAt: Timestamp;
  readonly stateReviewArtifactHash: string;
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
  readonly manifest?: PluggedInSocialSourceManifest;
  readonly maxEvidenceAgeMs?: number;
}

export interface PluggedInSocialAxisBNextActionAdapterResult {
  readonly sourcePath: string;
  readonly ready: boolean;
  readonly terminalOutcome: AgencyMarketingNextActionProposal["envelope"]["terminalOutcome"];
  readonly actionId: string;
  readonly issues: readonly string[];
  readonly manifest: PluggedInSocialSourceManifest;
  readonly proposal: AgencyMarketingNextActionProposal;
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
}

const GENERATED_REPORT_STATUSES = new Set(["generated", "sent"]);

export function buildPluggedInSocialAxisBNextActionAdapterResult(
  input: PluggedInSocialAxisBNextActionAdapterInput,
): PluggedInSocialAxisBNextActionAdapterResult {
  const manifest =
    input.manifest ??
    readPluggedInSocialSourceManifest({
      ...(input.workspaceRoot !== undefined
        ? { workspaceRoot: input.workspaceRoot }
        : {}),
      ...(input.sourcePath !== undefined ? { sourcePath: input.sourcePath } : {}),
    });
  const reportRowRef = stateRef(
    "source_record",
    `plugged_in_social:client_reports:${input.report.id}`,
    "PluggedInSocial ClientReport row",
  );
  const reportDocumentRef = stateRef(
    "document",
    `plugged_in_social:client_report:${input.report.id}`,
    input.report.title,
  );
  const metricsSnapshotRef = stateRef(
    "source_record",
    `plugged_in_social:client_reports:${input.report.id}:metrics_snapshot`,
    "PluggedInSocial ClientReport metrics_snapshot",
  );
  const analyticsPeriodRef = stateRef(
    "source_record",
    `plugged_in_social:analytics_daily:${input.report.org_id}:${input.report.period_start}:${input.report.period_end}`,
    "PluggedInSocial analytics_daily period",
  );
  const campaignRef = stateRef(
    "graph_node",
    input.report.project_id === undefined || input.report.project_id === null
      ? `plugged_in_social:client_report:${input.report.id}:campaign`
      : `plugged_in_social:project:${input.report.project_id}`,
    "PluggedInSocial campaign/project",
  );
  const metrics = metricsFromReport(input.report);
  const reportHash = pluggedInSocialReportHash(input.report);
  const proposal = buildAgencyMarketingNextActionProposal({
    tenantId: input.tenantId,
    sourceAdapter: "plugged_in_social",
    campaign: campaignRef,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    decidedAt: input.decidedAt,
    ...(input.maxEvidenceAgeMs !== undefined
      ? { maxEvidenceAgeMs: input.maxEvidenceAgeMs }
      : {}),
    report: {
      reportRef: reportDocumentRef,
      reportHash,
      generatedAt: reportGeneratedAt(input.report),
      sourceRefs: [reportRowRef, metricsSnapshotRef],
    },
    metrics: {
      ...metrics,
      observedAt: metricsObservedAt(input.report),
      sourceRefs: [metricsSnapshotRef, analyticsPeriodRef],
    },
    evidenceRefs: [reportRowRef, metricsSnapshotRef, analyticsPeriodRef],
    substrateRefs: manifest.substrateRefs.map(manifestRefToStateRef),
  });
  const issues = adapterIssues(manifest, input.report, proposal);
  const evidenceRefs = uniqueStateRefs([
    ...proposal.evidenceRefs,
    ...manifest.evidenceRefs.map(manifestRefToStateRef),
  ]);
  const substrateRefs = uniqueStateRefs([
    ...proposal.substrateRefs,
    ...manifest.substrateRefs.map(manifestRefToStateRef),
  ]);

  return {
    sourcePath: manifest.sourcePath,
    ready: issues.length === 0,
    terminalOutcome: proposal.envelope.terminalOutcome,
    actionId: proposal.envelope.actionId,
    issues,
    manifest,
    proposal,
    evidenceRefs,
    substrateRefs,
  };
}

function adapterIssues(
  manifest: PluggedInSocialSourceManifest,
  report: PluggedInSocialClientReportSnapshot,
  proposal: AgencyMarketingNextActionProposal,
): readonly string[] {
  const issues = new Set<string>();

  for (const item of manifest.readiness.missing) {
    issues.add(item);
  }
  for (const gate of PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES) {
    if (!manifest.governance[gate]) {
      issues.add(`missing governance gate: ${gate}`);
    }
  }
  for (const stage of manifest.closedLoopStages) {
    if (!stage.present) {
      issues.add(`closed-loop stage incomplete: ${stage.stage}`);
    }
  }
  if (!GENERATED_REPORT_STATUSES.has(report.status)) {
    issues.add(`client report not generated: ${report.status}`);
  }
  if (proposal.envelope.terminalOutcome !== "accepted") {
    issues.add(
      `next-action proposal terminal outcome: ${proposal.envelope.terminalOutcome}`,
    );
    for (const cause of proposal.envelope.blockingCauses) {
      issues.add(`${cause.source}: ${cause.code}`);
    }
  }

  return [...issues].sort();
}

function metricsFromReport(
  report: PluggedInSocialClientReportSnapshot,
): {
  readonly sampleSize: number;
  readonly qualifiedLeads: number;
  readonly engagementRate: number;
  readonly conversionRate: number;
  readonly spendCents: number;
} {
  const snapshot = report.metrics_snapshot;
  const qualifiedLeads = numberFromSnapshot(snapshot, [
    "qualified_leads_generated",
    "qualified_leads",
    "leads",
  ]);
  const reach = numberFromSnapshot(snapshot, ["total_reach", "reach"]);
  const impressions = numberFromSnapshot(snapshot, [
    "total_impressions",
    "impressions",
  ]);
  const contentPieces = numberFromSnapshot(snapshot, [
    "content_pieces_published",
    "posts_published",
  ]);
  const sampleSize = Math.max(reach, impressions, contentPieces);
  const explicitConversionRate = numberFromSnapshot(snapshot, [
    "conversion_rate",
    "lead_conversion_rate",
  ]);
  const conversionRate =
    explicitConversionRate > 0
      ? normalizeRate(explicitConversionRate)
      : sampleSize > 0
        ? qualifiedLeads / sampleSize
        : 0;

  return {
    sampleSize,
    qualifiedLeads,
    engagementRate: normalizeRate(
      numberFromSnapshot(snapshot, [
        "avg_engagement_rate",
        "engagement_rate",
      ]),
    ),
    conversionRate,
    spendCents: numberFromSnapshot(snapshot, ["total_ad_spend_cents", "spend_cents"]),
  };
}

function numberFromSnapshot(
  snapshot: Record<string, unknown>,
  keys: readonly string[],
): number {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function normalizeRate(value: number): number {
  if (value > 1) {
    return value / 100;
  }
  return value;
}

function reportGeneratedAt(report: PluggedInSocialClientReportSnapshot): Timestamp {
  return timestampFromNullable(
    report.pdf_generated_at ??
      report.updated_at ??
      report.created_at ??
      `${report.period_end}T23:59:59.000Z`,
  );
}

function metricsObservedAt(report: PluggedInSocialClientReportSnapshot): Timestamp {
  return timestampFromNullable(
    report.metrics_observed_at ??
      report.updated_at ??
      report.pdf_generated_at ??
      `${report.period_end}T23:59:59.000Z`,
  );
}

function timestampFromNullable(value: string | null): Timestamp {
  const normalized =
    value === null || value.trim() === ""
      ? "1970-01-01T00:00:00.000Z"
      : value;
  return normalized.includes("T")
    ? (normalized as Timestamp)
    : (`${normalized}T00:00:00.000Z` as Timestamp);
}

function pluggedInSocialReportHash(
  report: PluggedInSocialClientReportSnapshot,
): string {
  return createHash("sha256")
    .update(stableStringify({
      id: report.id,
      org_id: report.org_id,
      project_id: report.project_id ?? null,
      period_start: report.period_start,
      period_end: report.period_end,
      metrics_snapshot: report.metrics_snapshot,
    }))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function manifestRefToStateRef(ref: PluggedInSocialManifestRef): StateRef {
  return stateRef(ref.kind, ref.id, ref.label);
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
