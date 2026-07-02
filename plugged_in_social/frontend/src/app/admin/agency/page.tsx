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
  type IntegrationEvidenceSummary,
  type IntegrationRunEvent,
  type MarketingRun,
  createAgencyAccessRequest,
  createAgencyApproval,
  createAgencyArtifact,
  createClientEngagement,
  createMarketingRun,
  decideAgencyAccessRequest,
  decideAgencyApproval,
  getIntegrationEvidenceSummary,
  listAgencyAccessRequests,
  listAgencyApprovals,
  listAgencyArtifacts,
  listClientEngagements,
  listIntegrationRunEvents,
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

function countEntries(value: Record<string, number> | undefined) {
  return Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

export default function AgencyCommandCenterPage() {
  const [engagements, setEngagements] = useState<ClientEngagement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<MarketingRun[]>([]);
  const [artifacts, setArtifacts] = useState<AgencyArtifact[]>([]);
  const [approvals, setApprovals] = useState<AgencyApprovalRequest[]>([]);
  const [accessRequests, setAccessRequests] = useState<AgencyAccessRequest[]>([]);
  const [runEvents, setRunEvents] = useState<IntegrationRunEvent[]>([]);
  const [evidenceSummary, setEvidenceSummary] =
    useState<IntegrationEvidenceSummary | null>(null);
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
    analytics_provider: "umami",
    social_channels: "linkedin",
    goals: "Increase qualified leads",
    constraints: "Approval required before publishing",
  });
  const [runObjective, setRunObjective] = useState(
    "Build a 30-day autonomous marketing strategy"
  );
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
  const recentRunEvents = useMemo(
    () => runEvents.slice(-8).reverse(),
    [runEvents]
  );
  const evidenceHashGroups = useMemo(
    () =>
      Object.entries(evidenceSummary?.evidence_hashes || {}).filter(
        ([, hashes]) => hashes.length > 0
      ),
    [evidenceSummary]
  );

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
      let summaryData: IntegrationEvidenceSummary | null = null;
      if (latestRun) {
        [eventData, summaryData] = await Promise.all([
          listIntegrationRunEvents(latestRun.id),
          getIntegrationEvidenceSummary(latestRun.id),
        ]);
      }
      setRuns(runData);
      setArtifacts(artifactData);
      setApprovals(approvalData);
      setAccessRequests(accessData);
      setRunEvents(eventData);
      setEvidenceSummary(summaryData);
      setApprovalForm((current) => ({
        ...current,
        subject_id:
          current.subject_id ||
          artifactData[0]?.id ||
          engagementId,
        subject_type: artifactData[0] ? "agency_artifact" : "client_engagement",
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
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEngagements]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedId) {
        setRuns([]);
        setArtifacts([]);
        setApprovals([]);
        setAccessRequests([]);
        setRunEvents([]);
        setEvidenceSummary(null);
        return;
      }
      void loadEngagementDetail(selectedId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadEngagementDetail]);

  async function reloadSelected() {
    await loadEngagements();
    if (selectedId) await loadEngagementDetail(selectedId);
  }

  async function handleCreateEngagement() {
    if (!engagementForm.name.trim() && !engagementForm.client_url.trim()) return;
    setActionLoading("engagement");
    setError(null);
    try {
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
      setSelectedId(engagement.id);
      setEngagementForm({
        name: "",
        client_url: "",
        repo_url: "",
        client_name: "",
        client_email: "",
        offer: "",
        copy_inputs: "Homepage\nSales deck\nExisting campaign copy",
        analytics_provider: "umami",
        social_channels: "linkedin",
        goals: "Increase qualified leads",
        constraints: "Approval required before publishing",
      });
      await loadEngagements();
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
          { label: "Open Gates", value: pendingApprovals.length + openAccessRequests.length, icon: ShieldCheck },
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
              <button
                type="button"
                onClick={() => void handleCreateEngagement()}
                disabled={actionLoading === "engagement"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:bg-foreground/90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Create Engagement
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
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(activeRun.stage)}`}
                >
                  {activeRun.stage}
                </span>
              )}
            </div>

            {!activeRun ? (
              <EmptyState>No active run.</EmptyState>
            ) : detailLoading ? (
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
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    {
                      label: "Tasks",
                      value: evidenceSummary?.task_count ?? 0,
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
                      label: "Pending",
                      value:
                        evidenceSummary?.pending_approval_count ??
                        pendingApprovals.length,
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
