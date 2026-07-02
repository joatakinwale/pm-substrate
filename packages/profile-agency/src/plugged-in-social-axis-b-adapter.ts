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

export interface PluggedInSocialIntegrationAgentManifest {
  readonly role: string;
  readonly name: string;
  readonly description: string;
  readonly writes: readonly string[];
  readonly emits: readonly string[];
  readonly queue: string | null;
  readonly task_types: readonly string[];
}

export interface PluggedInSocialIntegrationQueueManifest {
  readonly queue: string;
  readonly worker: string;
  readonly dead_letter_queue: string | null;
  readonly producer_binding: string | null;
}

export interface PluggedInSocialIntegrationEndpointManifest {
  readonly method: string;
  readonly path: string;
  readonly boundary: "public_rls" | "internal_system_rls" | "internal_secret";
  readonly capability_ids: readonly string[];
}

export interface PluggedInSocialIntegrationDataResourceManifest {
  readonly id: string;
  readonly table: string;
  readonly resource_type: string;
  readonly org_scoped: boolean;
  readonly durable_evidence_fields: readonly string[];
  readonly read_capability_ids: readonly string[];
  readonly write_capability_ids: readonly string[];
}

export interface PluggedInSocialIntegrationConfigurationRequirement {
  readonly key: string;
  readonly kind: "environment" | "secret" | "queue_binding";
  readonly required_for: readonly string[];
}

export interface PluggedInSocialIntegrationPlatformManifestEnvelope {
  readonly resource_type: "plugged_in_social_platform_manifest";
  readonly version: "v1";
  readonly service: "plugged_in_social";
  readonly closed_loop_stages: readonly string[];
  readonly governance_gates: readonly string[];
  readonly agents: readonly PluggedInSocialIntegrationAgentManifest[];
  readonly queues: readonly PluggedInSocialIntegrationQueueManifest[];
  readonly api_endpoints: readonly PluggedInSocialIntegrationEndpointManifest[];
  readonly data_resources: readonly PluggedInSocialIntegrationDataResourceManifest[];
  readonly configuration_requirements: readonly PluggedInSocialIntegrationConfigurationRequirement[];
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

export interface PluggedInSocialIntegrationAccessRequestEnvelope {
  readonly resource_type: "agency_access_request";
  readonly id: string;
  readonly org_id: string;
  readonly engagement_id: string;
  readonly marketing_run_id: string | null;
  readonly request_type: string;
  readonly provider: string | null;
  readonly status: string;
  readonly scope: Record<string, unknown>;
  readonly reason: string;
  readonly instructions: Record<string, unknown>;
  readonly resolved_at: string | null;
  readonly resolved_by_user_id: string | null;
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
  readonly access_request_count: number;
  readonly open_access_request_count: number;
  readonly evidence_hashes: Record<string, readonly string[]>;
}

export interface PluggedInSocialLiveRunEvidenceSnapshot {
  readonly capabilities: PluggedInSocialIntegrationCapabilityResponse;
  readonly platformManifest: PluggedInSocialIntegrationPlatformManifestEnvelope;
  readonly run: PluggedInSocialIntegrationMarketingRunEnvelope;
  readonly summary: PluggedInSocialIntegrationEvidenceSummaryEnvelope;
  readonly events: readonly PluggedInSocialIntegrationRunEventEnvelope[];
  readonly tasks: readonly PluggedInSocialIntegrationTaskEnvelope[];
  readonly artifacts: readonly PluggedInSocialIntegrationArtifactEnvelope[];
  readonly approvals: readonly PluggedInSocialIntegrationApprovalEnvelope[];
  readonly accessRequests: readonly PluggedInSocialIntegrationAccessRequestEnvelope[];
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
  readonly requireLocalSourceManifest?: boolean;
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
  "platform_manifest.read",
  "marketing_run.read",
  "task.read",
  "artifact.read",
  "event_timeline.read",
  "evidence_summary.read",
  "access_request.read",
  "approval.decide",
  "access_request.decide",
  "event.ingest",
] as const;

const REQUIRED_LIVE_AGENT_ROLES = [
  "chief_of_staff",
  "content_creative",
  "scheduling_distribution",
  "community_engagement",
  "analytics_reporting",
] as const;

const REQUIRED_LIVE_GOVERNANCE_GATES = [
  "tenant_rls",
  "internal_system_rls",
  "handoff_scope_guard",
  "approval_payload_hash",
  "content_hash_gate",
  "publish_content_hash_gate",
  "capability_gate",
  "durable_event_hash",
] as const;

const REQUIRED_LIVE_DATA_TABLES = [
  "client_engagements",
  "marketing_runs",
  "virtual_agency_tasks",
  "virtual_agency_events",
  "agency_artifacts",
  "agency_approval_requests",
  "agency_access_requests",
  "social_posts",
  "client_reports",
] as const;

const REQUIRED_LIVE_CONFIG_KEYS = [
  "WEBHOOK_SECRET",
  "BACKEND_BASE_URL",
  "QUEUE_PRODUCER_URL",
  "QUEUE_VIRTUAL_AGENCY",
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
    platformManifest,
    run,
    summary,
    events,
    tasks,
    artifacts,
    approvals,
    accessRequests,
  ] = await Promise.all([
    fetchIntegrationJson<PluggedInSocialIntegrationCapabilityResponse>(
      client,
      "/capabilities",
    ),
    fetchIntegrationJson<PluggedInSocialIntegrationPlatformManifestEnvelope>(
      client,
      "/platform-manifest",
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
    fetchIntegrationJson<PluggedInSocialIntegrationAccessRequestEnvelope[]>(
      client,
      `${runPath}/access-requests`,
    ),
  ]);

  return {
    capabilities,
    platformManifest,
    run,
    summary,
    events,
    tasks,
    artifacts,
    approvals,
    accessRequests,
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
  const issues = new Set<string>(liveRunEvidenceIssues(input.snapshot));
  if (input.manifest !== undefined || input.requireLocalSourceManifest === true) {
    for (const issue of manifestReadinessIssues(manifest)) {
      issues.add(issue);
    }
  }
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
    ready: issues.size === 0,
    terminalOutcome: issues.size === 0 ? "accepted" : "blocked",
    actionId: `plugged_in_social:${input.snapshot.run.id}:live-axis-b-evidence`,
    runId: input.snapshot.run.id,
    issues: [...issues].sort(),
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
  snapshot: PluggedInSocialLiveRunEvidenceSnapshot,
): readonly string[] {
  const issues = new Set<string>();
  const {
    capabilities,
    platformManifest,
    run,
    summary,
    events,
    tasks,
    artifacts,
    approvals,
    accessRequests,
  } = snapshot;

  if (summary.run_id !== run.id) {
    issues.add("evidence summary run_id does not match marketing run");
  }
  if (summary.org_id !== run.org_id) {
    issues.add("evidence summary org_id does not match marketing run");
  }
  for (const item of [
    ...events,
    ...tasks,
    ...artifacts,
    ...approvals,
    ...accessRequests,
  ]) {
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
    if (!platformManifest.closed_loop_stages.includes(stage)) {
      issues.add(`missing platform closed-loop stage: ${stage}`);
    }
  }

  const agentRoles = new Set(platformManifest.agents.map((agent) => agent.role));
  for (const role of REQUIRED_LIVE_AGENT_ROLES) {
    if (!agentRoles.has(role)) {
      issues.add(`missing platform agent role: ${role}`);
    }
  }
  const chiefAgent = platformManifest.agents.find(
    (agent) => agent.role === "chief_of_staff",
  );
  if (chiefAgent !== undefined) {
    if (!chiefAgent.task_types.includes("strategy_research")) {
      issues.add("chief_of_staff lacks strategy_research task type");
    }
    if (chiefAgent.queue !== "stevie-virtual-agency") {
      issues.add("chief_of_staff is not bound to stevie-virtual-agency");
    }
  }
  const contentAgent = platformManifest.agents.find(
    (agent) => agent.role === "content_creative",
  );
  if (contentAgent !== undefined) {
    if (!contentAgent.writes.includes("social_post.create")) {
      issues.add("content_creative lacks social_post.create capability");
    }
    if (contentAgent.queue !== "stevie-virtual-agency") {
      issues.add("content_creative is not bound to stevie-virtual-agency");
    }
  }
  const analyticsAgent = platformManifest.agents.find(
    (agent) => agent.role === "analytics_reporting",
  );
  if (
    analyticsAgent !== undefined &&
    !analyticsAgent.emits.includes("marketing.next_action.proposed")
  ) {
    issues.add("analytics_reporting lacks marketing.next_action.proposed event");
  }

  const queueNames = new Set(platformManifest.queues.map((queue) => queue.queue));
  if (!queueNames.has("stevie-virtual-agency")) {
    issues.add("platform manifest missing stevie-virtual-agency queue");
  }
  const virtualAgencyQueue = platformManifest.queues.find(
    (queue) => queue.queue === "stevie-virtual-agency",
  );
  if (
    virtualAgencyQueue !== undefined &&
    virtualAgencyQueue.producer_binding !== "QUEUE_VIRTUAL_AGENCY"
  ) {
    issues.add("stevie-virtual-agency queue is missing QUEUE_VIRTUAL_AGENCY binding");
  }

  const endpointKey = (endpoint: PluggedInSocialIntegrationEndpointManifest) =>
    `${endpoint.method} ${endpoint.path}`;
  const endpoints = new Map(
    platformManifest.api_endpoints.map((endpoint) => [endpointKey(endpoint), endpoint]),
  );
  const internalTaskEndpoint = endpoints.get("POST /api/internal/virtual-agency/task");
  if (internalTaskEndpoint?.boundary !== "internal_system_rls") {
    issues.add("internal virtual-agency task endpoint is not system-RLS scoped");
  }
  const manifestEndpoint = endpoints.get("GET /api/integration/v1/platform-manifest");
  if (manifestEndpoint?.boundary !== "public_rls") {
    issues.add("platform manifest endpoint is not public-RLS scoped");
  }

  const dataTables = new Set(
    platformManifest.data_resources.map((resource) => resource.table),
  );
  for (const table of REQUIRED_LIVE_DATA_TABLES) {
    if (!dataTables.has(table)) {
      issues.add(`missing platform data table: ${table}`);
    }
  }
  const eventResource = platformManifest.data_resources.find(
    (resource) => resource.table === "virtual_agency_events",
  );
  if (
    eventResource !== undefined &&
    !eventResource.durable_evidence_fields.includes("event_hash")
  ) {
    issues.add("virtual_agency_events resource lacks event_hash evidence field");
  }

  const configKeys = new Set(
    platformManifest.configuration_requirements.map((config) => config.key),
  );
  for (const key of REQUIRED_LIVE_CONFIG_KEYS) {
    if (!configKeys.has(key)) {
      issues.add(`missing platform configuration key: ${key}`);
    }
  }
  for (const gate of REQUIRED_LIVE_GOVERNANCE_GATES) {
    if (!platformManifest.governance_gates.includes(gate)) {
      issues.add(`missing platform governance gate: ${gate}`);
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
  if (summary.open_access_request_count > 0) {
    issues.add(
      `marketing run has open access requests: ${summary.open_access_request_count}`,
    );
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
  if (accessRequests.length !== summary.access_request_count) {
    issues.add("access request response count does not match evidence summary count");
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
  if (
    summary.access_request_count > 0 &&
    (summary.evidence_hashes.access_request_hashes ?? []).length === 0
  ) {
    issues.add("missing evidence hashes: access_request_hashes");
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
    stateRef(
      "source_record",
      "plugged_in_social:integration_api:platform_manifest",
      "PluggedInSocial integration API platform manifest",
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
    ...snapshot.accessRequests.map((request) =>
      stateRef(
        "source_record",
        `plugged_in_social:agency_access_requests:${request.id}`,
        `PluggedInSocial access gate: ${request.request_type}`,
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
