"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  FileText,
  Hash,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  type AgencyAccessRequest,
  type AgencyApprovalRequest,
  type AgencyArtifact,
  type ClientEngagement,
  type IntegrationAdapterReadinessItem,
  type IntegrationClientReport,
  type IntegrationEvidenceSummary,
  type IntegrationExternalAdapter,
  type IntegrationRunEvent,
  type IntegrationSocialPost,
  type IntegrationTask,
  type MarketingRun,
  createAgencyAccessRequest,
  createAgencyApproval,
  createAgencyArtifact,
  createClientEngagement,
  createMarketingRun,
  decideAgencyAccessRequest,
  decideAgencyApproval,
  dispatchMarketingRun,
  getIntegrationRunEvidenceSnapshot,
  listIntegrationExternalAdapters,
  listAgencyAccessRequests,
  listAgencyApprovals,
  listAgencyArtifacts,
  listClientEngagements,
  listMarketingRuns,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-stevie-lavender/20 text-purple-700",
  active: "bg-stevie-green/10 text-stevie-green",
  blocked: "bg-stevie-orange/10 text-stevie-orange",
  completed: "bg-stevie-sky/15 text-sky-700",
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-stevie-green/10 text-stevie-green",
  rejected: "bg-red-50 text-red-700",
  revoked: "bg-gray-100 text-gray-600",
  requested: "bg-yellow-50 text-yellow-700",
  granted: "bg-stevie-green/10 text-stevie-green",
  ready: "bg-stevie-green/10 text-stevie-green",
  missing: "bg-yellow-50 text-yellow-700",
  incomplete: "bg-stevie-orange/10 text-stevie-orange",
  succeeded: "bg-stevie-green/10 text-stevie-green",
  failed: "bg-red-50 text-red-700",
  partial: "bg-yellow-50 text-yellow-700",
};

const CLOSED_LOOP_STAGES = [
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

const DEFAULT_RUN_OBJECTIVE = "Build a 30-day autonomous marketing strategy";

const STAGE_LABELS: Record<(typeof CLOSED_LOOP_STAGES)[number], string> = {
  intake: "Intake",
  strategy: "Strategy",
  content: "Content",
  approval: "Approval",
  scheduling: "Scheduling",
  publishing: "Publishing",
  metrics: "Metrics",
  report: "Report",
  next_action: "Next Action",
};

type StrategyAdapterGate = {
  requiredIds: string[];
  succeededIds: Set<string>;
  missingIds: string[];
  blockedIds: string[];
  itemsById: Map<string, IntegrationAdapterReadinessItem>;
};

const MONITOR_STATUS_CLASSES: Record<string, string> = {
  complete: "border-stevie-green bg-stevie-green/5 text-stevie-green",
  active: "border-stevie-sky bg-stevie-sky/10 text-sky-700",
  blocked: "border-stevie-orange bg-stevie-orange/10 text-stevie-orange",
  waiting: "border-border bg-gray-50 text-muted-foreground",
};

function compactDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function compactDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortHash(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
}

function compactEvidenceValue(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 16 ? shortHash(value) : value;
}

function countEntries(value: Record<string, number> | undefined) {
  return Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function objectArrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map(objectValue)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function artifactAdapterIdValue(artifact: AgencyArtifact) {
  const lineage = objectValue(artifact.lineage) || {};
  const payload = objectValue(artifact.payload) || {};
  return stringValue(lineage.adapter_id) || stringValue(payload.adapter_id);
}

function artifactStatusValue(artifact: AgencyArtifact) {
  const lineage = objectValue(artifact.lineage) || {};
  const payload = objectValue(artifact.payload) || {};
  return stringValue(lineage.status) || stringValue(payload.status);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseObjectJson(value: string, label: string) {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function statusClass(status: string) {
  return STATUS_COLORS[status] || "bg-gray-100 text-gray-600";
}

function monitorStatusClass(status: string) {
  return MONITOR_STATUS_CLASSES[status] || MONITOR_STATUS_CLASSES.waiting;
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-gray-50 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function CountMap({
  title,
  items,
}: {
  title: string;
  items: Array<[string, number]>;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">-</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {items.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{label}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nextActionProposalFromEvent(event: IntegrationRunEvent) {
  const payload = objectValue(event.payload);
  const proposal = objectValue(payload?.next_action_proposal);
  if (!proposal) return null;

  return {
    eventId: event.id,
    eventHash: event.event_hash,
    occurredAt: event.occurred_at,
    recommendedAction:
      stringValue(proposal.recommended_action) || "next_action_proposal",
    sourceReportId:
      stringValue(proposal.source_report_id) || stringValue(proposal.report_id),
    evidenceRefCount: numberValue(proposal.evidence_ref_count),
    pmSubstrateActionType: stringValue(proposal.pm_substrate_action_type),
    contentHashes: objectValue(proposal.content_hashes) || {},
  };
}

export default function AgencyCommandCenterPage() {
  const [engagements, setEngagements] = useState<ClientEngagement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<MarketingRun[]>([]);
  const [artifacts, setArtifacts] = useState<AgencyArtifact[]>([]);
  const [approvals, setApprovals] = useState<AgencyApprovalRequest[]>([]);
  const [accessRequests, setAccessRequests] = useState<AgencyAccessRequest[]>([]);
  const [runTasks, setRunTasks] = useState<IntegrationTask[]>([]);
  const [runEvents, setRunEvents] = useState<IntegrationRunEvent[]>([]);
  const [runSocialPosts, setRunSocialPosts] = useState<IntegrationSocialPost[]>([]);
  const [clientReports, setClientReports] = useState<IntegrationClientReport[]>([]);
  const [evidenceSummary, setEvidenceSummary] =
    useState<IntegrationEvidenceSummary | null>(null);
  const [externalAdapters, setExternalAdapters] = useState<
    IntegrationExternalAdapter[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [engagementForm, setEngagementForm] = useState({
    name: "",
    client_url: "",
    repo_url: "",
    client_name: "",
    client_email: "",
    offer: "",
    copy_inputs: "Homepage\nSales deck\nExisting campaign copy",
    source_urls: "",
    competitor_urls: "",
    analytics_provider: "umami",
    social_channels: "linkedin",
    goals: "Increase qualified leads",
    constraints: "Approval required before publishing",
    auto_start_run: true,
  });
  const [runObjective, setRunObjective] = useState(DEFAULT_RUN_OBJECTIVE);
  const [artifactForm, setArtifactForm] = useState({
    artifact_type: "research_brief",
    title: "Research brief",
    body: "",
    author_role: "research_strategist",
    payload: "{\n  \"summary\": \"\"\n}",
    evidence_url: "",
    evidence_label: "",
  });
  const [approvalForm, setApprovalForm] = useState({
    approval_type: "strategy",
    subject_type: "agency_artifact",
    subject_id: "",
    reason: "Approve before production begins",
  });
  const [accessForm, setAccessForm] = useState({
    request_type: "analytics",
    provider: "umami",
    reason: "Metrics reporting needs analytics access",
    scope: "{\n  \"website_id\": \"required\"\n}",
  });

  const selectedEngagement = useMemo(
    () => engagements.find((item) => item.id === selectedId) || null,
    [engagements, selectedId]
  );
  const activeRun = runs[0] || null;
  const kickoffSummary = useMemo(() => {
    const kickoff = objectValue(activeRun?.strategy_summary?.kickoff);
    if (!kickoff) return null;
    return {
      taskCount: numberValue(kickoff.task_count),
      accessRequestCount: numberValue(kickoff.access_request_count),
      agentRoles: stringArrayValue(kickoff.agent_roles),
      artifactId:
        typeof kickoff.artifact_id === "string" ? kickoff.artifact_id : null,
    };
  }, [activeRun]);
  const pendingApprovals = approvals.filter((item) => item.status === "pending");
  const openAccessRequests = accessRequests.filter(
    (item) => item.status === "requested" || item.status === "blocked"
  );
  const pendingApprovalCount = Math.max(
    pendingApprovals.length,
    evidenceSummary?.pending_approval_count ?? 0
  );
  const openAccessRequestCount = Math.max(
    openAccessRequests.length,
    evidenceSummary?.open_access_request_count ?? 0
  );
  const openGateCount = pendingApprovalCount + openAccessRequestCount;
  const externalAdapterRuns = useMemo(
    () => artifacts.filter((item) => item.artifact_type === "external_adapter_run"),
    [artifacts]
  );
  const strategyResearchEvidence = useMemo(() => {
    const artifact =
      artifacts.find((item) => item.artifact_type === "strategy_research_brief") ||
      null;
    const payload = objectValue(artifact?.payload);
    const researchRequirements = objectValue(payload?.research_requirements);
    const adapterRequirements = objectArrayValue(
      payload?.external_adapter_requirements
    );

    return {
      artifact,
      payload,
      researchRequirements,
      adapterRequirements,
      sourceUrls: stringArrayValue(researchRequirements?.source_urls),
      competitorUrls: stringArrayValue(researchRequirements?.competitor_urls),
      copyInputs: stringArrayValue(researchRequirements?.copy_inputs),
      researchQuestions: stringArrayValue(
        researchRequirements?.research_questions
      ),
      requiredAccessRequestIds: stringArrayValue(
        researchRequirements?.required_access_request_ids
      ),
    };
  }, [artifacts]);
  const strategyAdapterGate = useMemo<StrategyAdapterGate>(() => {
    const readiness = evidenceSummary?.adapter_readiness;
    if (readiness) {
      return {
        requiredIds: readiness.required_adapter_ids,
        succeededIds: new Set(readiness.succeeded_adapter_ids),
        missingIds: readiness.missing_adapter_ids,
        blockedIds: readiness.blocked_adapter_ids,
        itemsById: new Map(
          readiness.adapters.map((item) => [item.adapter_id, item])
        ),
      };
    }

    const requiredIds = Array.from(
      new Set(
        strategyResearchEvidence.adapterRequirements
          .map((requirement) => stringValue(requirement.adapter_id))
          .filter((item): item is string => Boolean(item))
      )
    ).sort();
    const succeededIds = new Set(
      externalAdapterRuns
        .filter((artifact) => artifactStatusValue(artifact) === "succeeded")
        .map(artifactAdapterIdValue)
        .filter((item): item is string => Boolean(item))
    );
    const missingIds = requiredIds.filter((adapterId) => !succeededIds.has(adapterId));

    return {
      requiredIds,
      succeededIds,
      missingIds,
      blockedIds: missingIds,
      itemsById: new Map<string, IntegrationAdapterReadinessItem>(),
    };
  }, [
    evidenceSummary?.adapter_readiness,
    externalAdapterRuns,
    strategyResearchEvidence.adapterRequirements,
  ]);
  const recentRunEvents = useMemo(
    () => runEvents.slice(-8).reverse(),
    [runEvents]
  );
  const nextActionProposals = useMemo(
    () =>
      runEvents
        .map(nextActionProposalFromEvent)
        .filter((proposal): proposal is NonNullable<typeof proposal> =>
          Boolean(proposal)
        )
        .reverse(),
    [runEvents]
  );
  const evidenceHashGroups = useMemo(
    () =>
      Object.entries(evidenceSummary?.evidence_hashes || {}).filter(
        ([, hashes]) => hashes.length > 0
      ),
    [evidenceSummary]
  );
  const taskTypeSet = useMemo(
    () => new Set(runTasks.map((task) => task.task_type)),
    [runTasks]
  );
  const completedTaskTypeSet = useMemo(
    () =>
      new Set(
        runTasks
          .filter((task) => task.status === "done")
          .map((task) => task.task_type)
      ),
    [runTasks]
  );
  const eventTypeSet = useMemo(
    () => new Set(runEvents.map((event) => event.event_type)),
    [runEvents]
  );
  const closedLoopMonitor = useMemo(() => {
    const socialStatusCounts = evidenceSummary?.social_post_status_counts || {};
    const hasScheduledPost =
      Number(socialStatusCounts.scheduled || 0) > 0 ||
      runSocialPosts.some((post) => post.status === "scheduled");
    const hasPublishedPost =
      Number(socialStatusCounts.published || 0) > 0 ||
      runSocialPosts.some((post) => post.status === "published");
    const reportCount = evidenceSummary?.report_count ?? clientReports.length;
    const reportEvidenceCount = reportCount || 1;
    const hasReportMetricsEvidence =
      (evidenceSummary?.evidence_hashes?.client_report_metrics_hashes || [])
        .length > 0 || reportCount > 0;
    const hasReportArtifact = artifacts.some(
      (artifact) =>
        artifact.artifact_type === "client_report" ||
        artifact.artifact_type === "report"
    );
    const hasReportEvidence = reportCount > 0 || hasReportArtifact;
    const hasNextAction =
      taskTypeSet.has("next_action_proposal") ||
      eventTypeSet.has("marketing.next_action.proposed") ||
      nextActionProposals.length > 0;
    const hasStrategyResearchArtifact = Boolean(strategyResearchEvidence.artifact);
    const hasRequiredAdapterEvidence =
      strategyAdapterGate.missingIds.length === 0;
    const strategyReady =
      hasStrategyResearchArtifact && hasRequiredAdapterEvidence;

    const details: Record<(typeof CLOSED_LOOP_STAGES)[number], string> = {
      intake: selectedEngagement
        ? "Client URL, repository, goals, and constraints captured."
        : "Waiting for client intake.",
      strategy: strategyReady
        ? `Strategy brief ${shortHash(strategyResearchEvidence.artifact?.payload_hash)} with ${strategyResearchEvidence.adapterRequirements.length} adapter requirement${strategyResearchEvidence.adapterRequirements.length === 1 ? "" : "s"}.`
        : hasStrategyResearchArtifact
          ? `Waiting for adapter evidence: ${strategyAdapterGate.missingIds.join(", ")}.`
        : activeRun
          ? "Strategy run waiting for research artifact evidence."
          : "Waiting for a strategy run.",
      content: taskTypeSet.has("content_generation")
        ? completedTaskTypeSet.has("content_generation")
          ? "Content task completed."
          : strategyReady
            ? "Content task queued."
            : "Waiting for strategy and adapter evidence gates."
        : "Waiting for content task.",
      approval:
        pendingApprovals.length > 0
          ? `${pendingApprovals.length} approval gate pending.`
          : approvals.length > 0
            ? "Approval gates resolved or recorded."
            : "Waiting for approval evidence.",
      scheduling: taskTypeSet.has("content_scheduling")
        ? completedTaskTypeSet.has("content_scheduling")
          ? "Scheduling task completed."
          : "Scheduling task queued."
        : "Waiting for scheduling task.",
      publishing: hasPublishedPost
        ? "Published post evidence recorded."
        : hasScheduledPost
          ? "Scheduled post awaiting publish evidence."
          : "Waiting for publish evidence.",
      metrics: hasReportMetricsEvidence
        ? "Report metrics evidence recorded."
        : taskTypeSet.has("analytics_reporting")
          ? completedTaskTypeSet.has("analytics_reporting")
            ? "Metrics/reporting task completed."
            : "Analytics task queued."
          : "Waiting for metrics task.",
      report: hasReportEvidence
        ? `${reportEvidenceCount} report evidence record${reportEvidenceCount === 1 ? "" : "s"} present.`
        : "Waiting for report evidence.",
      next_action: hasNextAction
        ? `${nextActionProposals.length || 1} next action proposal recorded.`
        : "Waiting for next action proposal.",
    };

    return CLOSED_LOOP_STAGES.map((stage) => {
      let status: "complete" | "active" | "blocked" | "waiting" = "waiting";

      if (stage === "intake" && selectedEngagement) status = "complete";
      if (stage === "strategy" && strategyReady) {
        status = "complete";
      } else if (stage === "strategy" && hasStrategyResearchArtifact) {
        status = "blocked";
      } else if (
        stage === "strategy" &&
        (activeRun || taskTypeSet.has("strategy_research"))
      ) {
        status = "active";
      }
      if (stage === "content" && completedTaskTypeSet.has("content_generation")) {
        status = "complete";
      } else if (
        stage === "content" &&
        taskTypeSet.has("content_generation") &&
        !strategyReady
      ) {
        status = "blocked";
      } else if (stage === "content" && taskTypeSet.has("content_generation")) {
        status = "active";
      }
      if (stage === "approval" && pendingApprovals.length > 0) {
        status = "blocked";
      } else if (stage === "approval" && approvals.length > 0) {
        status = "complete";
      }
      if (stage === "scheduling" && completedTaskTypeSet.has("content_scheduling")) {
        status = "complete";
      } else if (stage === "scheduling" && taskTypeSet.has("content_scheduling")) {
        status = "active";
      }
      if (stage === "publishing" && hasPublishedPost) {
        status = "complete";
      } else if (stage === "publishing" && hasScheduledPost) {
        status = "active";
      }
      if (stage === "metrics" && hasReportMetricsEvidence) {
        status = "complete";
      } else if (
        stage === "metrics" &&
        completedTaskTypeSet.has("analytics_reporting")
      ) {
        status = "complete";
      } else if (stage === "metrics" && taskTypeSet.has("analytics_reporting")) {
        status = "active";
      }
      if (stage === "report" && hasReportEvidence) status = "complete";
      if (stage === "next_action" && hasNextAction) status = "complete";

      return {
        stage,
        label: STAGE_LABELS[stage],
        status,
        detail: details[stage],
      };
    });
  }, [
    activeRun,
    approvals.length,
    artifacts,
    clientReports.length,
    completedTaskTypeSet,
    evidenceSummary,
    eventTypeSet,
    nextActionProposals.length,
    pendingApprovals.length,
    runSocialPosts,
    selectedEngagement,
    strategyAdapterGate,
    strategyResearchEvidence,
    taskTypeSet,
  ]);
  const governanceGates = useMemo(() => {
    const eventHashes =
      evidenceSummary?.evidence_hashes?.event_hashes || [];
    const taskHashes =
      evidenceSummary?.evidence_hashes?.task_latest_event_hashes || [];
    const socialPostHashes =
      evidenceSummary?.evidence_hashes?.social_post_content_hashes || [];
    const reportHashes =
      evidenceSummary?.evidence_hashes?.client_report_hashes || [];
    const approvalHashes =
      evidenceSummary?.evidence_hashes?.approval_payload_hashes || [];

    return [
      {
        label: "Tenant RLS",
        status: "enforced",
        detail: selectedEngagement?.org_id ? selectedEngagement.org_id.slice(0, 8) : "-",
        tone: "complete",
      },
      {
        label: "Access Gate",
        status: openAccessRequestCount > 0 ? "blocked" : "clear",
        detail:
          openAccessRequestCount > 0
            ? `${openAccessRequestCount} open`
            : `${accessRequests.length} recorded`,
        tone: openAccessRequestCount > 0 ? "blocked" : "complete",
      },
      {
        label: "Adapter Evidence",
        status:
          strategyAdapterGate.requiredIds.length === 0
            ? "not required"
            : strategyAdapterGate.missingIds.length === 0
              ? "succeeded"
              : "missing",
        detail:
          strategyAdapterGate.missingIds.length > 0
            ? strategyAdapterGate.missingIds.join(", ")
            : `${strategyAdapterGate.requiredIds.length} required`,
        tone:
          strategyAdapterGate.requiredIds.length === 0
            ? "waiting"
            : strategyAdapterGate.missingIds.length === 0
              ? "complete"
              : "blocked",
      },
      {
        label: "Approval Hash",
        status:
          approvalHashes.length > 0 || runTasks.some((task) => task.approval_payload_hash)
            ? "recorded"
            : "pending",
        detail:
          approvalHashes[0] ||
          runTasks.find((task) => task.approval_payload_hash)?.approval_payload_hash ||
          null,
        tone:
          approvalHashes.length > 0 || runTasks.some((task) => task.approval_payload_hash)
            ? "complete"
            : "waiting",
      },
      {
        label: "Task Event Hash",
        status: taskHashes.length > 0 ? "recorded" : "waiting",
        detail: taskHashes[0] || null,
        tone: taskHashes.length > 0 ? "complete" : "waiting",
      },
      {
        label: "Event Chain",
        status: eventHashes.length > 0 ? "chained" : "waiting",
        detail: eventHashes[0] || null,
        tone: eventHashes.length > 0 ? "complete" : "waiting",
      },
      {
        label: "Publish Hash",
        status: socialPostHashes.length > 0 ? "recorded" : "not reached",
        detail: socialPostHashes[0] || null,
        tone: socialPostHashes.length > 0 ? "complete" : "waiting",
      },
      {
        label: "Report Hash",
        status: reportHashes.length > 0 ? "recorded" : "not reached",
        detail: reportHashes[0] || null,
        tone: reportHashes.length > 0 ? "complete" : "waiting",
      },
    ];
  }, [
    accessRequests.length,
    evidenceSummary,
    openAccessRequestCount,
    runTasks,
    selectedEngagement,
    strategyAdapterGate,
  ]);

  const loadEngagements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClientEngagements();
      setEngagements(data.items);
      setSelectedId((current) => current || data.items[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load engagements.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExternalAdapters = useCallback(async () => {
    try {
      const data = await listIntegrationExternalAdapters();
      setExternalAdapters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load adapters.");
    }
  }, []);

  const loadEngagementDetail = useCallback(async (engagementId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [runData, artifactData, approvalData, accessData] = await Promise.all([
        listMarketingRuns(engagementId),
        listAgencyArtifacts(engagementId),
        listAgencyApprovals(engagementId),
        listAgencyAccessRequests(engagementId),
      ]);
      const latestRun = runData[0] || null;
      let eventData: IntegrationRunEvent[] = [];
      let taskData: IntegrationTask[] = [];
      let socialPostData: IntegrationSocialPost[] = [];
      let reportData: IntegrationClientReport[] = [];
      let summaryData: IntegrationEvidenceSummary | null = null;
      let artifactsForDisplay = artifactData;
      let approvalsForDisplay = approvalData;
      let accessRequestsForDisplay = accessData;
      if (latestRun) {
        const snapshot = await getIntegrationRunEvidenceSnapshot(latestRun.id);
        eventData = snapshot.events;
        taskData = snapshot.tasks;
        socialPostData = snapshot.social_posts;
        reportData = snapshot.reports;
        summaryData = snapshot.summary;
        artifactsForDisplay = snapshot.artifacts;
        approvalsForDisplay = snapshot.approvals;
        accessRequestsForDisplay = snapshot.access_requests;
      }
      setRuns(runData);
      setArtifacts(artifactsForDisplay);
      setApprovals(approvalsForDisplay);
      setAccessRequests(accessRequestsForDisplay);
      setRunTasks(taskData);
      setRunEvents(eventData);
      setRunSocialPosts(socialPostData);
      setClientReports(reportData);
      setEvidenceSummary(summaryData);
      setApprovalForm((current) => ({
        ...current,
        subject_id:
          current.subject_id ||
          artifactsForDisplay[0]?.id ||
          engagementId,
        subject_type: artifactsForDisplay[0] ? "agency_artifact" : "client_engagement",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agency state.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEngagements();
      void loadExternalAdapters();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEngagements, loadExternalAdapters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedId) {
        setRuns([]);
        setArtifacts([]);
        setApprovals([]);
        setAccessRequests([]);
        setRunTasks([]);
        setRunEvents([]);
        setRunSocialPosts([]);
        setClientReports([]);
        setEvidenceSummary(null);
        return;
      }
      void loadEngagementDetail(selectedId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadEngagementDetail]);

  async function reloadSelected() {
    await Promise.all([loadEngagements(), loadExternalAdapters()]);
    if (selectedId) await loadEngagementDetail(selectedId);
  }

  async function handleCreateEngagement() {
    if (!engagementForm.name.trim() && !engagementForm.client_url.trim()) return;
    setActionLoading("engagement");
    setError(null);
    try {
      const sourceUrls = splitLines(engagementForm.source_urls);
      const competitorUrls = splitLines(engagementForm.competitor_urls);
      const objective = runObjective.trim() || DEFAULT_RUN_OBJECTIVE;
      const engagement = await createClientEngagement({
        name: engagementForm.name.trim() || undefined,
        client_url: engagementForm.client_url.trim() || undefined,
        repo_url: engagementForm.repo_url.trim() || undefined,
        client_name: engagementForm.client_name.trim() || undefined,
        client_email: engagementForm.client_email.trim() || undefined,
        goals: splitLines(engagementForm.goals),
        constraints: splitLines(engagementForm.constraints),
        intake_payload: {
          offer: engagementForm.offer.trim() || undefined,
          copy_inputs: splitLines(engagementForm.copy_inputs),
          source_urls: sourceUrls,
          competitor_urls: competitorUrls,
          strategy_session: {
            objective: objective || undefined,
            requested_autonomous_start: engagementForm.auto_start_run,
            source_urls: sourceUrls,
            competitor_urls: competitorUrls,
          },
          source: "agency_command_center",
        },
        integration_state: {
          analytics_provider:
            engagementForm.analytics_provider.trim() || "analytics",
          preferred_social_channels:
            splitLines(engagementForm.social_channels).length > 0
              ? splitLines(engagementForm.social_channels)
              : ["linkedin"],
        },
      });
      if (engagementForm.auto_start_run) {
        await createMarketingRun(engagement.id, { objective });
      }
      setSelectedId(engagement.id);
      setEngagementForm({
        name: "",
        client_url: "",
        repo_url: "",
        client_name: "",
        client_email: "",
        offer: "",
        copy_inputs: "Homepage\nSales deck\nExisting campaign copy",
        source_urls: "",
        competitor_urls: "",
        analytics_provider: "umami",
        social_channels: "linkedin",
        goals: "Increase qualified leads",
        constraints: "Approval required before publishing",
        auto_start_run: true,
      });
      await Promise.all([loadEngagements(), loadEngagementDetail(engagement.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create engagement.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateRun() {
    if (!selectedId || !runObjective.trim()) return;
    setActionLoading("run");
    setError(null);
    try {
      await createMarketingRun(selectedId, { objective: runObjective.trim() });
      await Promise.all([loadEngagements(), loadEngagementDetail(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start strategy run.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDispatchRun() {
    if (!selectedId || !activeRun) return;
    setActionLoading(`dispatch:${activeRun.id}`);
    setError(null);
    try {
      await dispatchMarketingRun(selectedId, activeRun.id);
      await Promise.all([loadEngagements(), loadEngagementDetail(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dispatch agents.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateArtifact() {
    if (!selectedId || !artifactForm.title.trim()) return;
    setActionLoading("artifact");
    setError(null);
    try {
      const payload = parseObjectJson(artifactForm.payload, "Artifact payload");
      const evidence_refs =
        artifactForm.evidence_url.trim() && artifactForm.evidence_label.trim()
          ? [
              {
                kind: "url",
                id: artifactForm.evidence_url.trim(),
                label: artifactForm.evidence_label.trim(),
              },
            ]
          : [];
      const artifact = await createAgencyArtifact(selectedId, {
        marketing_run_id: activeRun?.id || null,
        artifact_type: artifactForm.artifact_type.trim(),
        title: artifactForm.title.trim(),
        body: artifactForm.body.trim() || null,
        payload,
        evidence_refs,
        author_role: artifactForm.author_role.trim() || "chief_of_staff",
      });
      setApprovalForm((current) => ({
        ...current,
        subject_type: "agency_artifact",
        subject_id: artifact.id,
      }));
      await loadEngagementDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create artifact.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateApproval() {
    if (!selectedId || !approvalForm.subject_id || !approvalForm.reason.trim()) return;
    setActionLoading("approval");
    setError(null);
    try {
      await createAgencyApproval(selectedId, {
        marketing_run_id: activeRun?.id || null,
        approval_type: approvalForm.approval_type.trim(),
        subject_type: approvalForm.subject_type,
        subject_id: approvalForm.subject_id,
        reason: approvalForm.reason.trim(),
        approval_payload: {
          engagement_id: selectedId,
          marketing_run_id: activeRun?.id || null,
          subject_type: approvalForm.subject_type,
          subject_id: approvalForm.subject_id,
        },
      });
      await loadEngagementDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request approval.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecision(
    approval: AgencyApprovalRequest,
    decision: "approved" | "rejected"
  ) {
    if (!selectedId) return;
    setActionLoading(`${decision}:${approval.id}`);
    setError(null);
    try {
      await decideAgencyApproval(approval.id, {
        decision,
        decision_note:
          decision === "approved"
            ? "Approved from agency command center"
            : "Rejected from agency command center",
      });
      await loadEngagementDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record decision.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateAccessRequest() {
    if (!selectedId || !accessForm.reason.trim()) return;
    setActionLoading("access");
    setError(null);
    try {
      await createAgencyAccessRequest(selectedId, {
        marketing_run_id: activeRun?.id || null,
        request_type: accessForm.request_type.trim(),
        provider: accessForm.provider.trim() || null,
        reason: accessForm.reason.trim(),
        scope: parseObjectJson(accessForm.scope, "Access scope"),
        instructions: { source: "agency_command_center" },
      });
      await loadEngagementDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create access request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAccessDecision(
    request: AgencyAccessRequest,
    decision: "granted" | "blocked" | "revoked"
  ) {
    if (!selectedId) return;
    setActionLoading(`${decision}:access:${request.id}`);
    setError(null);
    try {
      await decideAgencyAccessRequest(request.id, {
        decision,
        decision_note:
          decision === "granted"
            ? "Access granted from agency command center"
            : decision === "blocked"
              ? "Access blocked from agency command center"
              : "Access revoked from agency command center",
        resolution_payload: { source: "agency_command_center" },
      });
      await loadEngagementDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve access request.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Autonomous Agency</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Client strategy, durable evidence, approvals, and access blockers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reloadSelected()}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Engagements", value: engagements.length, icon: Sparkles },
          { label: "Strategy Runs", value: runs.length, icon: Clock3 },
          { label: "Evidence Artifacts", value: artifacts.length, icon: FileText },
          { label: "Open Gates", value: openGateCount, icon: ShieldCheck },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-white p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-stevie-green/10 text-stevie-green">
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="heading-brand mt-1 text-3xl">
              {loading || detailLoading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">New Client Engagement</h2>
              {actionLoading === "engagement" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="space-y-3">
              <input
                value={engagementForm.name}
                onChange={(event) =>
                  setEngagementForm({ ...engagementForm, name: event.target.value })
                }
                placeholder="Client or platform name"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                value={engagementForm.client_url}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    client_url: event.target.value,
                  })
                }
                placeholder="https://client-site.com"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                value={engagementForm.repo_url}
                onChange={(event) =>
                  setEngagementForm({ ...engagementForm, repo_url: event.target.value })
                }
                placeholder="Repository URL"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                value={engagementForm.client_email}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    client_email: event.target.value,
                  })
                }
                placeholder="Client email"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                value={engagementForm.client_name}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    client_name: event.target.value,
                  })
                }
                placeholder="Client contact name"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                value={engagementForm.offer}
                onChange={(event) =>
                  setEngagementForm({ ...engagementForm, offer: event.target.value })
                }
                placeholder="Primary offer"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={engagementForm.analytics_provider}
                  onChange={(event) =>
                    setEngagementForm({
                      ...engagementForm,
                      analytics_provider: event.target.value,
                    })
                  }
                  placeholder="Analytics provider"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <textarea
                  value={engagementForm.social_channels}
                  onChange={(event) =>
                    setEngagementForm({
                      ...engagementForm,
                      social_channels: event.target.value,
                    })
                  }
                  rows={2}
                  placeholder="Social channels, one per line"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={engagementForm.copy_inputs}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    copy_inputs: event.target.value,
                  })
                }
                rows={3}
                placeholder="Existing copy or source documents, one per line"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={engagementForm.source_urls}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    source_urls: event.target.value,
                  })
                }
                rows={3}
                placeholder="Marketing page URLs, one per line"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={engagementForm.competitor_urls}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    competitor_urls: event.target.value,
                  })
                }
                rows={3}
                placeholder="Competitor or market URLs, one per line"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={engagementForm.goals}
                onChange={(event) =>
                  setEngagementForm({ ...engagementForm, goals: event.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={engagementForm.constraints}
                onChange={(event) =>
                  setEngagementForm({
                    ...engagementForm,
                    constraints: event.target.value,
                  })
                }
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={engagementForm.auto_start_run}
                  onChange={(event) =>
                    setEngagementForm({
                      ...engagementForm,
                      auto_start_run: event.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                <span>Start strategy run after intake</span>
              </label>
              {engagementForm.auto_start_run && (
                <input
                  value={runObjective}
                  onChange={(event) => setRunObjective(event.target.value)}
                  placeholder="Strategy run objective"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => void handleCreateEngagement()}
                disabled={actionLoading === "engagement"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:bg-foreground/90 disabled:opacity-60"
              >
                {actionLoading === "engagement" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {engagementForm.auto_start_run
                  ? "Create + Start Strategy"
                  : "Create Engagement"}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Engagements</h2>
              <span className="text-xs text-muted-foreground">{engagements.length}</span>
            </div>
            {loading ? (
              <div className="h-16 animate-pulse rounded-lg bg-gray-50" />
            ) : engagements.length === 0 ? (
              <EmptyState>No engagements yet.</EmptyState>
            ) : (
              <div className="space-y-2">
                {engagements.map((engagement) => (
                  <button
                    key={engagement.id}
                    type="button"
                    onClick={() => setSelectedId(engagement.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      engagement.id === selectedId
                        ? "border-stevie-green bg-stevie-green/5"
                        : "border-border hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium">{engagement.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(engagement.status)}`}>
                        {engagement.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {engagement.client_url || engagement.repo_url || "No URL"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className="space-y-6">
          <section className="rounded-lg border border-border bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-semibold">
                  {selectedEngagement?.name || "No engagement selected"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedEngagement?.client_url || selectedEngagement?.repo_url || "-"}
                </p>
              </div>
              {selectedEngagement && (
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selectedEngagement.status)}`}>
                  {selectedEngagement.status}
                </span>
              )}
            </div>
            {selectedEngagement && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Goals</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedEngagement.goals.length ? (
                      selectedEngagement.goals.map((goal, index) => (
                        <span key={`${goal}-${index}`} className="rounded-full bg-stevie-chartreuse/25 px-2.5 py-1 text-xs">
                          {String(goal)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Constraints</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedEngagement.constraints.length ? (
                      selectedEngagement.constraints.map((constraint, index) => (
                        <span key={`${constraint}-${index}`} className="rounded-full bg-stevie-lavender/25 px-2.5 py-1 text-xs">
                          {String(constraint)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-semibold">Run Monitor</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeRun?.objective || "No active strategy run"}
                </p>
              </div>
              {activeRun && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDispatchRun()}
                    disabled={
                      openAccessRequestCount > 0 ||
                      actionLoading === `dispatch:${activeRun.id}`
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {actionLoading === `dispatch:${activeRun.id}` && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {openAccessRequestCount > 0
                      ? "Resolve Access"
                      : "Dispatch Agents"}
                  </button>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(activeRun.stage)}`}
                  >
                    {activeRun.stage}
                  </span>
                </div>
              )}
            </div>

            {detailLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-lg bg-gray-50"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {!activeRun && <EmptyState>No active run.</EmptyState>}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    {
                      label: "Tasks",
                      value: evidenceSummary?.task_count ?? runTasks.length,
                      icon: Activity,
                    },
                    {
                      label: "Events",
                      value: evidenceSummary?.event_count ?? runEvents.length,
                      icon: Clock3,
                    },
                    {
                      label: "Artifacts",
                      value: evidenceSummary?.artifact_count ?? artifacts.length,
                      icon: FileText,
                    },
                    {
                      label: "Reports",
                      value: evidenceSummary?.report_count ?? clientReports.length,
                      icon: FileText,
                    },
                    {
                      label: "Open Gates",
                      value: openGateCount,
                      icon: ShieldCheck,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border px-4 py-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          {item.label}
                        </p>
                        <item.icon className="h-4 w-4 text-stevie-green" />
                      </div>
                      <p className="heading-brand text-2xl">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    Closed-loop Progress
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {closedLoopMonitor.map((stage) => (
                      <div
                        key={stage.stage}
                        className={`rounded-lg border px-3 py-3 ${monitorStatusClass(stage.status)}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{stage.label}</p>
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase">
                            {stage.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {stage.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Governance Gates
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {governanceGates.map((gate) => (
                      <div
                        key={gate.label}
                        className={`rounded-lg border px-3 py-3 ${monitorStatusClass(gate.tone)}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{gate.label}</p>
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase">
                            {gate.status}
                          </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                          {compactEvidenceValue(gate.detail)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Strategy Research Evidence
                  </div>
                  {!strategyResearchEvidence.artifact ? (
                    <EmptyState>No strategy research artifact evidence.</EmptyState>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                      <div className="rounded-lg border border-border px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {strategyResearchEvidence.artifact.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {strategyResearchEvidence.artifact.author_role}
                            </p>
                          </div>
                          <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {shortHash(strategyResearchEvidence.artifact.payload_hash)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <span>
                            task{" "}
                            {shortHash(
                              strategyResearchEvidence.artifact
                                .virtual_agency_task_id
                            )}
                          </span>
                          <span>
                            evidence{" "}
                            {Array.isArray(
                              strategyResearchEvidence.artifact.evidence_refs
                            )
                              ? strategyResearchEvidence.artifact.evidence_refs.length
                              : 0}
                          </span>
                          <span>
                            access{" "}
                            {
                              strategyResearchEvidence.requiredAccessRequestIds
                                .length
                            }
                          </span>
                          <span>
                            created{" "}
                            {compactDateTime(
                              strategyResearchEvidence.artifact.created_at
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border px-3 py-3">
                        <p className="text-sm font-medium">Research Inputs</p>
                        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Sources</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {strategyResearchEvidence.sourceUrls.length === 0 ? (
                                <span>-</span>
                              ) : (
                                strategyResearchEvidence.sourceUrls
                                  .slice(0, 4)
                                  .map((url) => (
                                    <span
                                      key={url}
                                      className="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5"
                                    >
                                      {url}
                                    </span>
                                  ))
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Copy Inputs</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {strategyResearchEvidence.copyInputs.length === 0 ? (
                                <span>-</span>
                              ) : (
                                strategyResearchEvidence.copyInputs.map((item) => (
                                  <span
                                    key={item}
                                    className="rounded bg-gray-100 px-1.5 py-0.5"
                                  >
                                    {item}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          {strategyResearchEvidence.competitorUrls.length > 0 && (
                            <div>
                              <p className="font-medium text-foreground">
                                Competitors
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {strategyResearchEvidence.competitorUrls
                                  .slice(0, 3)
                                  .map((url) => (
                                    <span
                                      key={url}
                                      className="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5"
                                    >
                                      {url}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border px-3 py-3">
                        <p className="text-sm font-medium">Adapter Requirements</p>
                        {strategyResearchEvidence.adapterRequirements.length === 0 ? (
                          <p className="mt-3 text-xs text-muted-foreground">-</p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {strategyResearchEvidence.adapterRequirements.map(
                              (requirement, index) => {
                                const adapterId =
                                  stringValue(requirement.adapter_id) ||
                                  `adapter_${index + 1}`;
                                const readiness =
                                  strategyAdapterGate.itemsById.get(adapterId);
                                const evidenceFields =
                                  readiness?.required_evidence_fields.length
                                    ? readiness.required_evidence_fields
                                    : stringArrayValue(
                                        requirement.required_evidence_fields
                                      );
                                const outputArtifacts = stringArrayValue(
                                  requirement.expected_output_artifacts
                                );
                                const adapterStatus =
                                  readiness?.status === "ready"
                                    ? "succeeded"
                                    : readiness?.status ||
                                      (strategyAdapterGate.succeededIds.has(adapterId)
                                        ? "succeeded"
                                        : "missing");
                                const missingEvidenceFields =
                                  readiness?.missing_evidence_fields || [];

                                return (
                                  <div
                                    key={`${adapterId}:${index}`}
                                    className="rounded border border-border px-2 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-medium">
                                          {adapterId.replaceAll("_", " ")}
                                        </p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                          {stringValue(requirement.purpose) ||
                                            "adapter requirement"}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <span
                                          className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(adapterStatus)}`}
                                        >
                                          {adapterStatus}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                          {missingEvidenceFields.length > 0
                                            ? `${missingEvidenceFields.length} missing`
                                            : `${outputArtifacts.length} outputs`}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {evidenceFields.slice(0, 5).map((field) => (
                                        <span
                                          key={`${adapterId}:${field}`}
                                          className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                        >
                                          {field.replaceAll("_", " ")}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>

                      {strategyResearchEvidence.researchQuestions.length > 0 && (
                        <div className="rounded-lg border border-border px-3 py-3 xl:col-span-3">
                          <p className="text-sm font-medium">Research Questions</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {strategyResearchEvidence.researchQuestions.map(
                              (question) => (
                                <p
                                  key={question}
                                  className="rounded bg-gray-50 px-2 py-2 text-xs leading-5 text-muted-foreground"
                                >
                                  {question}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Scheduled & Published Posts
                    </div>
                    {runSocialPosts.length === 0 ? (
                      <EmptyState>No social post evidence.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {runSocialPosts.map((post) => (
                          <div
                            key={post.id}
                            className="rounded-lg border border-border px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {post.platform}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {post.caption || "No caption recorded."}
                                </p>
                              </div>
                              <span
                                className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(post.status)}`}
                              >
                                {post.status}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                              <span>scheduled {compactDateTime(post.scheduled_at)}</span>
                              <span>published {compactDateTime(post.published_at)}</span>
                              <span>reach {post.reach}</span>
                              <span>
                                engagement{" "}
                                {post.engagement_rate === null
                                  ? "-"
                                  : `${(post.engagement_rate * 100).toFixed(1)}%`}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>
                                current {shortHash(post.current_content_hash)}
                              </span>
                              <span>
                                scheduled {shortHash(post.scheduled_content_hash)}
                              </span>
                              <span>
                                published {shortHash(post.published_content_hash)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Client Reports
                    </div>
                    {clientReports.length === 0 ? (
                      <EmptyState>No client report evidence.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {clientReports.map((report) => (
                          <div
                            key={report.id}
                            className="rounded-lg border border-border px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{report.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {compactDate(report.period_start)} -{" "}
                                  {compactDate(report.period_end)}
                                </p>
                              </div>
                              <span
                                className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(report.status)}`}
                              >
                                {report.status}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                              {Object.entries(report.metrics_snapshot || {})
                                .slice(0, 4)
                                .map(([key, value]) => (
                                  <span key={`${report.id}:${key}`}>
                                    {key.replaceAll("_", " ")} {String(value)}
                                  </span>
                                ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>report {shortHash(report.report_hash)}</span>
                              <span>
                                metrics {shortHash(report.metrics_snapshot_hash)}
                              </span>
                              {report.pdf_url && <span>pdf recorded</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      Next Action Proposals
                    </div>
                    {nextActionProposals.length === 0 ? (
                      <EmptyState>No next action proposal.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {nextActionProposals.map((proposal) => (
                          <div
                            key={proposal.eventId}
                            className="rounded-lg border border-border px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {proposal.recommendedAction.replaceAll("_", " ")}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {proposal.pmSubstrateActionType ||
                                    "marketing.next_action.propose"}
                                </p>
                              </div>
                              <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {shortHash(proposal.eventHash)}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                              <span>evidence {proposal.evidenceRefCount}</span>
                              <span>
                                proposed {compactDateTime(proposal.occurredAt)}
                              </span>
                              <span>
                                report {shortHash(proposal.sourceReportId)}
                              </span>
                              <span>
                                hashes {Object.keys(proposal.contentHashes).length}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    External Adapter Boundary
                  </div>
                  {externalAdapters.length === 0 ? (
                    <EmptyState>No external adapters registered.</EmptyState>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {externalAdapters.map((adapter) => (
                        <div
                          key={adapter.id}
                          className="rounded-lg border border-border px-3 py-3"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-medium">{adapter.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {adapter.adapter_type.replaceAll("_", " ")}
                              </p>
                            </div>
                            <span className="w-fit rounded-full bg-stevie-green/10 px-2 py-0.5 text-[10px] font-medium uppercase text-stevie-green">
                              {adapter.boundary.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            {adapter.description}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <span>{adapter.capabilities.length} capabilities</span>
                            <span>{adapter.output_artifacts.length} artifacts</span>
                            <span>{adapter.required_gates.length} gates</span>
                            <span>{adapter.evidence_fields.length} evidence fields</span>
                            <span>{adapter.compatible_protocols.length} protocols</span>
                            <span>{adapter.runner_commands.length} commands</span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">
                              {adapter.source_url.replace("https://github.com/", "")}
                            </span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">
                              {shortHash(adapter.source_commit)}
                            </span>
                            {adapter.compatible_protocols.slice(0, 3).map((protocol) => (
                              <span
                                key={`${adapter.id}:${protocol}`}
                                className="rounded bg-gray-100 px-1.5 py-0.5"
                              >
                                {protocol}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {adapter.required_gates.slice(0, 6).map((gate) => (
                              <span
                                key={`${adapter.id}:${gate}`}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {gate.replaceAll("_", " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Adapter Run Evidence
                    </p>
                    {externalAdapterRuns.length === 0 ? (
                      <EmptyState>No adapter run evidence.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {externalAdapterRuns.map((artifact) => {
                          const lineage = objectValue(artifact.lineage) || {};
                          const payload = objectValue(artifact.payload) || {};
                          const adapterId =
                            stringValue(lineage.adapter_id) ||
                            stringValue(payload.adapter_id) ||
                            "external_adapter";
                          const status =
                            stringValue(lineage.status) ||
                            stringValue(payload.status) ||
                            "recorded";
                          const boundary =
                            stringValue(lineage.boundary) ||
                            stringValue(
                              objectValue(payload.adapter_contract)?.boundary
                            ) ||
                            "boundary recorded";

                          return (
                            <div
                              key={artifact.id}
                              className="rounded-lg border border-border px-3 py-3"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-medium">
                                    {adapterId.replaceAll("_", " ")}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {boundary.replaceAll("_", " ")}
                                  </p>
                                </div>
                                <span
                                  className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(status)}`}
                                >
                                  {status}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                <span>payload {shortHash(artifact.payload_hash)}</span>
                                <span>
                                  gates {shortHash(stringValue(lineage.gate_results_hash))}
                                </span>
                                <span>
                                  output {shortHash(stringValue(lineage.output_payload_hash))}
                                </span>
                                <span>run {compactDateTime(artifact.created_at)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {kickoffSummary && (
                  <div className="rounded-lg border border-border px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-medium">Kickoff Workbreakdown</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {kickoffSummary.taskCount} tasks,{" "}
                          {kickoffSummary.accessRequestCount} access requests
                        </p>
                      </div>
                      {kickoffSummary.artifactId && (
                        <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {kickoffSummary.artifactId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {kickoffSummary.agentRoles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-stevie-green/10 px-2.5 py-1 text-xs text-stevie-green"
                        >
                          {role.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Agent Task Queue
                      </div>
                      {runTasks.length === 0 ? (
                        <EmptyState>No agent tasks recorded.</EmptyState>
                      ) : (
                        <div className="space-y-2">
                          {runTasks.map((task) => (
                            <div
                              key={task.id}
                              className="rounded-lg border border-border px-3 py-3"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {task.agent_role.replaceAll("_", " ")} -{" "}
                                    {task.task_type.replaceAll("_", " ")}
                                  </p>
                                </div>
                                <span
                                  className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(task.status)}`}
                                >
                                  {task.status}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground md:grid-cols-4">
                                <span>v{task.task_version}</span>
                                <span>
                                  approval{" "}
                                  {task.approval_active ? "active" : "pending"}
                                </span>
                                <span>
                                  approval hash{" "}
                                  {shortHash(task.approval_payload_hash)}
                                </span>
                                <span>
                                  event hash {shortHash(task.latest_event_hash)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        Evidence Hashes
                      </div>
                      {evidenceHashGroups.length === 0 ? (
                        <EmptyState>No hashes recorded.</EmptyState>
                      ) : (
                        <div className="space-y-2">
                          {evidenceHashGroups.map(([label, hashes]) => (
                            <div
                              key={label}
                              className="rounded-lg border border-border px-3 py-2"
                            >
                              <p className="text-xs font-medium text-muted-foreground">
                                {label.replaceAll("_", " ")}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {hashes.slice(0, 6).map((hash) => (
                                  <span
                                    key={hash}
                                    className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                                  >
                                    {shortHash(hash)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CountMap
                        title="Task Status"
                        items={countEntries(evidenceSummary?.task_status_counts)}
                      />
                      <CountMap
                        title="Event Types"
                        items={countEntries(evidenceSummary?.event_type_counts)}
                      />
                      <CountMap
                        title="Report Status"
                        items={countEntries(evidenceSummary?.report_status_counts)}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Event Timeline
                    </div>
                    {recentRunEvents.length === 0 ? (
                      <EmptyState>No timeline events.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {recentRunEvents.map((event) => (
                          <div key={event.id} className="rounded-lg border border-border px-3 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-medium">{event.event_type}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {event.actor_role || "system"} - {compactDateTime(event.occurred_at)}
                                </p>
                              </div>
                              <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {shortHash(event.event_hash)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>payload {shortHash(event.payload_hash)}</span>
                              <span>previous {shortHash(event.previous_event_hash)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Strategy Run</h2>
                {actionLoading === "run" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={runObjective}
                  onChange={(event) => setRunObjective(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateRun()}
                  disabled={!selectedId || actionLoading === "run"}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Start
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {runs.length === 0 ? (
                  <EmptyState>No strategy runs.</EmptyState>
                ) : (
                  runs.map((run) => (
                    <div key={run.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{run.objective}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(run.status)}`}>
                          {run.stage}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Started {compactDate(run.started_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Evidence Artifacts</h2>
                {actionLoading === "artifact" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={artifactForm.artifact_type}
                  onChange={(event) =>
                    setArtifactForm({
                      ...artifactForm,
                      artifact_type: event.target.value,
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
                <input
                  value={artifactForm.author_role}
                  onChange={(event) =>
                    setArtifactForm({ ...artifactForm, author_role: event.target.value })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <input
                value={artifactForm.title}
                onChange={(event) =>
                  setArtifactForm({ ...artifactForm, title: event.target.value })
                }
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={artifactForm.body}
                onChange={(event) =>
                  setArtifactForm({ ...artifactForm, body: event.target.value })
                }
                rows={3}
                placeholder="Artifact body"
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={artifactForm.payload}
                onChange={(event) =>
                  setArtifactForm({ ...artifactForm, payload: event.target.value })
                }
                rows={4}
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={artifactForm.evidence_url}
                  onChange={(event) =>
                    setArtifactForm({
                      ...artifactForm,
                      evidence_url: event.target.value,
                    })
                  }
                  placeholder="Evidence URL"
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
                <input
                  value={artifactForm.evidence_label}
                  onChange={(event) =>
                    setArtifactForm({
                      ...artifactForm,
                      evidence_label: event.target.value,
                    })
                  }
                  placeholder="Evidence label"
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateArtifact()}
                disabled={!selectedId || actionLoading === "artifact"}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add Artifact
              </button>
              <div className="mt-4 space-y-3">
                {artifacts.length === 0 ? (
                  <EmptyState>No artifacts.</EmptyState>
                ) : (
                  artifacts.map((artifact) => (
                    <div key={artifact.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{artifact.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {artifact.artifact_type} by {artifact.author_role}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {artifact.payload_hash.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Approvals</h2>
                <CheckCircle2 className="h-4 w-4 text-stevie-green" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={approvalForm.approval_type}
                  onChange={(event) =>
                    setApprovalForm({
                      ...approvalForm,
                      approval_type: event.target.value,
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
                <select
                  value={`${approvalForm.subject_type}:${approvalForm.subject_id}`}
                  onChange={(event) => {
                    const [subject_type, subject_id] = event.target.value.split(":");
                    setApprovalForm({ ...approvalForm, subject_type, subject_id });
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {selectedEngagement && (
                    <option value={`client_engagement:${selectedEngagement.id}`}>
                      Client engagement
                    </option>
                  )}
                  {artifacts.map((artifact) => (
                    <option key={artifact.id} value={`agency_artifact:${artifact.id}`}>
                      {artifact.title}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={approvalForm.reason}
                onChange={(event) =>
                  setApprovalForm({ ...approvalForm, reason: event.target.value })
                }
                rows={3}
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateApproval()}
                disabled={!selectedId || actionLoading === "approval"}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Request Approval
              </button>
              <div className="mt-4 space-y-3">
                {approvals.length === 0 ? (
                  <EmptyState>No approvals.</EmptyState>
                ) : (
                  approvals.map((approval) => (
                    <div key={approval.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{approval.reason}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {approval.approval_type} - {approval.subject_type}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(approval.status)}`}>
                          {approval.status}
                        </span>
                      </div>
                      {approval.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDecision(approval, "approved")}
                            className="rounded-full bg-stevie-green px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDecision(approval, "rejected")}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Access Requests</h2>
                <KeyRound className="h-4 w-4 text-stevie-orange" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={accessForm.request_type}
                  onChange={(event) =>
                    setAccessForm({
                      ...accessForm,
                      request_type: event.target.value,
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
                <input
                  value={accessForm.provider}
                  onChange={(event) =>
                    setAccessForm({ ...accessForm, provider: event.target.value })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={accessForm.reason}
                onChange={(event) =>
                  setAccessForm({ ...accessForm, reason: event.target.value })
                }
                rows={3}
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <textarea
                value={accessForm.scope}
                onChange={(event) =>
                  setAccessForm({ ...accessForm, scope: event.target.value })
                }
                rows={4}
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => void handleCreateAccessRequest()}
                disabled={!selectedId || actionLoading === "access"}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                Add Access Request
              </button>
              <div className="mt-4 space-y-3">
                {accessRequests.length === 0 ? (
                  <EmptyState>No access requests.</EmptyState>
                ) : (
                  accessRequests.map((request) => {
                    const canGrant =
                      request.status === "requested" || request.status === "blocked";
                    const canBlock =
                      request.status === "requested" || request.status === "granted";
                    const canRevoke =
                      request.status === "granted" || request.status === "blocked";

                    return (
                      <div key={request.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{request.reason}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {request.request_type} - {request.provider || "internal"}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        {(canGrant || canBlock || canRevoke) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {canGrant && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleAccessDecision(request, "granted")
                                }
                                disabled={actionLoading === `granted:access:${request.id}`}
                                className="rounded-full bg-stevie-green px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                              >
                                Grant
                              </button>
                            )}
                            {canBlock && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleAccessDecision(request, "blocked")
                                }
                                disabled={actionLoading === `blocked:access:${request.id}`}
                                className="rounded-full border border-stevie-orange px-3 py-1.5 text-xs font-medium text-stevie-orange disabled:opacity-60"
                              >
                                Block
                              </button>
                            )}
                            {canRevoke && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleAccessDecision(request, "revoked")
                                }
                                disabled={actionLoading === `revoked:access:${request.id}`}
                                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
