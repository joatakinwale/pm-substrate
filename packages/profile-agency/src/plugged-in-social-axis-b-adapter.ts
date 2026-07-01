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

export interface PluggedInSocialIntegrationFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText?: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type PluggedInSocialIntegrationFetch = (
  url: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<PluggedInSocialIntegrationFetchResponse>;

export interface PluggedInSocialIntegrationClientInput {
  readonly integrationBaseUrl: string;
  readonly bearerToken?: string;
  readonly headers?: Record<string, string>;
  readonly fetchFn?: PluggedInSocialIntegrationFetch;
}

export interface PluggedInSocialIntegrationCapability {
  readonly id: string;
  readonly methods: readonly string[];
  readonly resources: readonly string[];
  readonly requires_approval?: boolean;
}

export interface PluggedInSocialIntegrationCapabilityResponse {
  readonly version: "v1";
  readonly service: "plugged_in_social";
  readonly capabilities: readonly PluggedInSocialIntegrationCapability[];
  readonly closed_loop_stages: readonly string[];
}

export interface PluggedInSocialIntegrationMarketingRunEnvelope {
  readonly resource_type: "marketing_run";
  readonly id: string;
  readonly org_id: string;
  readonly engagement_id: string;
  readonly project_id: string | null;
  readonly status: string;
  readonly stage: string;
  readonly objective: string;
  readonly strategy_summary: Record<string, unknown>;
  readonly current_blocker: Record<string, unknown> | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PluggedInSocialIntegrationRunEventEnvelope {
  readonly resource_type: "virtual_agency_event";
  readonly id: string;
  readonly org_id: string;
  readonly marketing_run_id: string;
  readonly task_id: string;
  readonly project_id: string | null;
  readonly event_type: string;
  readonly actor_role: string | null;
  readonly actor_id: string | null;
  readonly idempotency_key: string;
  readonly task_version: number | null;
  readonly approval_version: number | null;
  readonly previous_event_hash: string | null;
  readonly payload_hash: string;
  readonly event_hash: string;
  readonly payload: Record<string, unknown>;
  readonly lineage: Record<string, unknown>;
  readonly occurred_at: string;
}

export interface PluggedInSocialIntegrationTaskEnvelope {
  readonly resource_type: "virtual_agency_task";
  readonly id: string;
  readonly org_id: string;
  readonly project_id: string;
  readonly source_task_id: string | null;
  readonly parent_task_id: string | null;
  readonly title: string;
  readonly agent_role: string;
  readonly task_type: string;
  readonly status: string;
  readonly task_version: number;
  readonly approved_version: number | null;
  readonly approval_active: boolean;
  readonly approval_payload_hash: string | null;
  readonly latest_event_hash: string | null;
  readonly context: Record<string, unknown>;
  readonly lineage: Record<string, unknown>;
}

export interface PluggedInSocialIntegrationArtifactEnvelope {
  readonly resource_type: "agency_artifact";
  readonly id: string;
  readonly org_id: string;
  readonly engagement_id: string;
  readonly marketing_run_id: string | null;
  readonly virtual_agency_task_id: string | null;
  readonly artifact_type: string;
  readonly title: string;
  readonly payload_hash: string;
  readonly version: number;
  readonly evidence_refs: readonly unknown[];
  readonly lineage: Record<string, unknown>;
  readonly author_role: string;
}

export interface PluggedInSocialIntegrationApprovalEnvelope {
  readonly resource_type: "agency_approval_request";
  readonly id: string;
  readonly org_id: string;
  readonly engagement_id: string;
  readonly marketing_run_id: string | null;
  readonly approval_type: string;
  readonly status: string;
  readonly subject_type: string;
  readonly subject_id: string;
  readonly approval_version: number;
  readonly approval_payload_hash: string;
}

export interface PluggedInSocialIntegrationEvidenceSummaryEnvelope {
  readonly resource_type: "marketing_run_evidence_summary";
  readonly run_id: string;
  readonly org_id: string;
  readonly status: string;
  readonly stage: string;
  readonly artifact_count: number;
  readonly artifact_type_counts: Record<string, number>;
  readonly task_count: number;
  readonly task_status_counts: Record<string, number>;
  readonly event_count: number;
  readonly event_type_counts: Record<string, number>;
  readonly approval_count: number;
  readonly pending_approval_count: number;
  readonly evidence_hashes: Record<string, readonly string[]>;
}

export interface PluggedInSocialLiveRunEvidenceSnapshot {
  readonly capabilities: PluggedInSocialIntegrationCapabilityResponse;
  readonly run: PluggedInSocialIntegrationMarketingRunEnvelope;
  readonly summary: PluggedInSocialIntegrationEvidenceSummaryEnvelope;
  readonly events: readonly PluggedInSocialIntegrationRunEventEnvelope[];
  readonly tasks: readonly PluggedInSocialIntegrationTaskEnvelope[];
  readonly artifacts: readonly PluggedInSocialIntegrationArtifactEnvelope[];
  readonly approvals: readonly PluggedInSocialIntegrationApprovalEnvelope[];
}

export interface PluggedInSocialLiveRunEvidenceFetchInput
  extends PluggedInSocialIntegrationClientInput {
  readonly runId: string;
}

export interface PluggedInSocialAxisBLiveRunEvidenceAdapterInput {
  readonly snapshot: PluggedInSocialLiveRunEvidenceSnapshot;
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
  readonly manifest?: PluggedInSocialSourceManifest;
}

export interface PluggedInSocialAxisBLiveRunEvidenceAdapterResult {
  readonly sourcePath: string;
  readonly ready: boolean;
  readonly terminalOutcome: AgencyMarketingNextActionProposal["envelope"]["terminalOutcome"];
  readonly actionId: string;
  readonly runId: string;
  readonly issues: readonly string[];
  readonly manifest: PluggedInSocialSourceManifest;
  readonly snapshot: PluggedInSocialLiveRunEvidenceSnapshot;
  readonly evidenceRefs: readonly StateRef[];
  readonly substrateRefs: readonly StateRef[];
}

export class PluggedInSocialIntegrationFetchError extends Error {
  readonly url: string;
  readonly status: number;
  readonly body: string;

  constructor(url: string, status: number, body: string) {
    super(`PluggedInSocial integration request failed: ${status} ${url}`);
    this.name = "PluggedInSocialIntegrationFetchError";
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

const GENERATED_REPORT_STATUSES = new Set(["generated", "sent"]);

const REQUIRED_LIVE_CLOSED_LOOP_STAGES = [
  "intake",
  "strategy",
  "content",
  "approval",
  "scheduling",
  "publishing",
  "metrics",
  "report",
  "next_action",
] as const;

const REQUIRED_LIVE_CAPABILITIES = [
  "marketing_run.read",
  "task.read",
  "artifact.read",
  "event_timeline.read",
  "evidence_summary.read",
  "approval.decide",
  "event.ingest",
] as const;

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

export async function fetchPluggedInSocialLiveRunEvidenceSnapshot(
  input: PluggedInSocialLiveRunEvidenceFetchInput,
): Promise<PluggedInSocialLiveRunEvidenceSnapshot> {
  const client = buildIntegrationClient(input);
  const runPath = `/marketing-runs/${encodeURIComponent(input.runId)}`;
  const [
    capabilities,
    run,
    summary,
    events,
    tasks,
    artifacts,
    approvals,
  ] = await Promise.all([
    fetchIntegrationJson<PluggedInSocialIntegrationCapabilityResponse>(
      client,
      "/capabilities",
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationMarketingRunEnvelope>(
      client,
      runPath,
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationEvidenceSummaryEnvelope>(
      client,
      `${runPath}/evidence-summary`,
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationRunEventEnvelope[]>(
      client,
      `${runPath}/events?limit=1000`,
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationTaskEnvelope[]>(
      client,
      `${runPath}/tasks`,
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationArtifactEnvelope[]>(
      client,
      `${runPath}/artifacts`,
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationApprovalEnvelope[]>(
      client,
      `${runPath}/approvals`,
    ),
  ]);

  return {
    capabilities,
    run,
    summary,
    events,
    tasks,
    artifacts,
    approvals,
  };
}

export function buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult(
  input: PluggedInSocialAxisBLiveRunEvidenceAdapterInput,
): PluggedInSocialAxisBLiveRunEvidenceAdapterResult {
  const manifest =
    input.manifest ??
    readPluggedInSocialSourceManifest({
      ...(input.workspaceRoot !== undefined
        ? { workspaceRoot: input.workspaceRoot }
        : {}),
      ...(input.sourcePath !== undefined ? { sourcePath: input.sourcePath } : {}),
    });
  const issues = liveRunEvidenceIssues(manifest, input.snapshot);
  const evidenceRefs = liveRunEvidenceRefs(input.snapshot, manifest);
  const substrateRefs = uniqueStateRefs([
    ...manifest.substrateRefs.map(manifestRefToStateRef),
    stateRef(
      "action_outcome_envelope",
      `plugged_in_social:marketing_runs:${input.snapshot.run.id}:live-axis-b-evidence-outcome`,
      "PluggedInSocial live Axis B run evidence outcome",
    ),
    stateRef(
      "state_review_artifact",
      `plugged_in_social:marketing_runs:${input.snapshot.run.id}:live-axis-b-review`,
      "PluggedInSocial live Axis B run evidence review",
    ),
  ]);

  return {
    sourcePath: manifest.sourcePath,
    ready: issues.length === 0,
    terminalOutcome: issues.length === 0 ? "accepted" : "blocked",
    actionId: `plugged_in_social:${input.snapshot.run.id}:live-axis-b-evidence`,
    runId: input.snapshot.run.id,
    issues,
    manifest,
    snapshot: input.snapshot,
    evidenceRefs,
    substrateRefs,
  };
}

function adapterIssues(
  manifest: PluggedInSocialSourceManifest,
  report: PluggedInSocialClientReportSnapshot,
  proposal: AgencyMarketingNextActionProposal,
): readonly string[] {
  const issues = new Set<string>(manifestReadinessIssues(manifest));
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

function manifestReadinessIssues(
  manifest: PluggedInSocialSourceManifest,
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

  return [...issues].sort();
}

function liveRunEvidenceIssues(
  manifest: PluggedInSocialSourceManifest,
  snapshot: PluggedInSocialLiveRunEvidenceSnapshot,
): readonly string[] {
  const issues = new Set<string>(manifestReadinessIssues(manifest));
  const { capabilities, run, summary, events, tasks, artifacts, approvals } =
    snapshot;

  if (summary.run_id !== run.id) {
    issues.add("evidence summary run_id does not match marketing run");
  }
  if (summary.org_id !== run.org_id) {
    issues.add("evidence summary org_id does not match marketing run");
  }
  for (const item of [...events, ...tasks, ...artifacts, ...approvals]) {
    if (item.org_id !== run.org_id) {
      issues.add(`cross-org integration envelope detected: ${item.resource_type}`);
    }
  }

  const capabilityIds = new Set(capabilities.capabilities.map((item) => item.id));
  for (const capability of REQUIRED_LIVE_CAPABILITIES) {
    if (!capabilityIds.has(capability)) {
      issues.add(`missing integration capability: ${capability}`);
    }
  }
  for (const stage of REQUIRED_LIVE_CLOSED_LOOP_STAGES) {
    if (!capabilities.closed_loop_stages.includes(stage)) {
      issues.add(`missing integration closed-loop stage: ${stage}`);
    }
  }

  if (summary.task_count <= 0 || tasks.length <= 0) {
    issues.add("marketing run has no virtual-agency tasks");
  }
  if (summary.event_count <= 0 || events.length <= 0) {
    issues.add("marketing run has no virtual-agency events");
  }
  if (summary.artifact_count <= 0 || artifacts.length <= 0) {
    issues.add("marketing run has no durable agency artifacts");
  }
  if (summary.pending_approval_count > 0) {
    issues.add(`marketing run has pending approvals: ${summary.pending_approval_count}`);
  }
  if (events.length < Math.min(summary.event_count, 1000)) {
    issues.add("event timeline response is shorter than evidence summary count");
  }
  if (tasks.length !== summary.task_count) {
    issues.add("task response count does not match evidence summary count");
  }
  if (artifacts.length !== summary.artifact_count) {
    issues.add("artifact response count does not match evidence summary count");
  }
  if (approvals.length !== summary.approval_count) {
    issues.add("approval response count does not match evidence summary count");
  }

  for (const [group, hashes] of Object.entries(summary.evidence_hashes)) {
    if (!Array.isArray(hashes)) {
      issues.add(`evidence hash group is not an array: ${group}`);
    }
  }
  for (const group of [
    "artifact_payload_hashes",
    "event_hashes",
    "task_latest_event_hashes",
  ]) {
    if ((summary.evidence_hashes[group] ?? []).length === 0) {
      issues.add(`missing evidence hashes: ${group}`);
    }
  }

  const seenEventHashes = new Set<string>();
  for (const event of [...events].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  )) {
    if (event.payload_hash.length === 0 || event.event_hash.length === 0) {
      issues.add(`event missing durable hash: ${event.id}`);
    }
    if (
      event.previous_event_hash !== null &&
      !seenEventHashes.has(event.previous_event_hash)
    ) {
      issues.add(`event references unseen previous hash: ${event.id}`);
    }
    seenEventHashes.add(event.event_hash);
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

function normalizeIntegrationBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api/integration/v1")
    ? trimmed
    : `${trimmed}/api/integration/v1`;
}

function buildIntegrationClient(
  input: PluggedInSocialIntegrationClientInput,
): {
  readonly baseUrl: string;
  readonly fetchFn: PluggedInSocialIntegrationFetch;
  readonly headers: Record<string, string>;
} {
  const fetchFn =
    input.fetchFn ??
    (globalThis as unknown as { fetch?: PluggedInSocialIntegrationFetch }).fetch;
  if (fetchFn === undefined) {
    throw new Error(
      "No fetch implementation available for PluggedInSocial integration client",
    );
  }

  return {
    baseUrl: normalizeIntegrationBaseUrl(input.integrationBaseUrl),
    fetchFn,
    headers: {
      accept: "application/json",
      ...(input.bearerToken === undefined
        ? {}
        : { authorization: `Bearer ${input.bearerToken}` }),
      ...(input.headers ?? {}),
    },
  };
}

async function fetchIntegrationJson<T>(
  client: {
    readonly baseUrl: string;
    readonly fetchFn: PluggedInSocialIntegrationFetch;
    readonly headers: Record<string, string>;
  },
  path: string,
): Promise<T> {
  const url = `${client.baseUrl}${path}`;
  const response = await client.fetchFn(url, { headers: client.headers });
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = response.statusText ?? "";
    }
    throw new PluggedInSocialIntegrationFetchError(url, response.status, body);
  }
  return (await response.json()) as T;
}

function liveRunEvidenceRefs(
  snapshot: PluggedInSocialLiveRunEvidenceSnapshot,
  manifest: PluggedInSocialSourceManifest,
): readonly StateRef[] {
  const run = snapshot.run;
  return uniqueStateRefs([
    stateRef(
      "workflow_run",
      `plugged_in_social:marketing_runs:${run.id}`,
      "PluggedInSocial marketing run",
    ),
    stateRef(
      "source_record",
      `plugged_in_social:marketing_runs:${run.id}:evidence_summary`,
      "PluggedInSocial marketing run evidence summary",
    ),
    stateRef(
      "source_record",
      "plugged_in_social:integration_api:capabilities",
      "PluggedInSocial integration API capabilities",
    ),
    ...snapshot.tasks.map((task) =>
      stateRef(
        "source_record",
        `plugged_in_social:virtual_agency_tasks:${task.id}`,
        `PluggedInSocial virtual-agency task: ${task.agent_role}`,
      ),
    ),
    ...snapshot.events.map((event) =>
      stateRef(
        "event",
        `plugged_in_social:virtual_agency_events:${event.id}`,
        `PluggedInSocial virtual-agency event: ${event.event_type}`,
      ),
    ),
    ...snapshot.artifacts.map((artifact) =>
      stateRef(
        "document",
        `plugged_in_social:agency_artifacts:${artifact.id}`,
        artifact.title,
      ),
    ),
    ...snapshot.approvals.map((approval) =>
      stateRef(
        "source_record",
        `plugged_in_social:agency_approval_requests:${approval.id}`,
        `PluggedInSocial approval gate: ${approval.approval_type}`,
      ),
    ),
    ...manifest.evidenceRefs.map(manifestRefToStateRef),
  ]);
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
