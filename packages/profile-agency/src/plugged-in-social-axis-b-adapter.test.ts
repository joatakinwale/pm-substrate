import { describe, expect, it } from "vitest";
import { verifyActionOutcomeEnvelopeHash } from "@pm/agent-state";
import { tenantId, timestamp } from "@pm/types";

import {
  buildPluggedInSocialAxisBNextActionAdapterResult,
  buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult,
  fetchPluggedInSocialLiveRunEvidenceSnapshot,
  type PluggedInSocialIntegrationFetch,
  type PluggedInSocialIntegrationFetchResponse,
  type PluggedInSocialLiveRunEvidenceSnapshot,
  type PluggedInSocialClientReportSnapshot,
} from "./plugged-in-social-axis-b-adapter.js";
import { readPluggedInSocialSourceManifest } from "./plugged-in-social-manifest.js";

const report: PluggedInSocialClientReportSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  project_id: "33333333-3333-4333-8333-333333333333",
  title: "Summer pipeline report",
  status: "generated",
  period_start: "2026-06-24",
  period_end: "2026-07-01",
  pdf_generated_at: "2026-07-01T17:45:00.000Z",
  metrics_snapshot: {
    total_reach: 400,
    avg_engagement_rate: 7.3,
    qualified_leads_generated: 18,
    total_ad_spend_cents: 12_500,
  },
};

const liveRunId = "44444444-4444-4444-8444-444444444444";
const liveOrgId = "22222222-2222-4222-8222-222222222222";
const liveTaskId = "55555555-5555-4555-8555-555555555555";
const liveEventHashA = "a".repeat(64);
const liveEventHashB = "b".repeat(64);
const liveArtifactHash = "c".repeat(64);
const liveAccessRequestHash = "d".repeat(64);
const liveSocialPostHash = "e".repeat(64);
const liveReportHash = "f".repeat(64);
const liveReportMetricsHash = "a1".repeat(32);

function liveSnapshotFixture(): PluggedInSocialLiveRunEvidenceSnapshot {
  return {
    capabilities: {
      version: "v1",
      service: "plugged_in_social",
      closed_loop_stages: [
        "intake",
        "strategy",
        "content",
        "approval",
        "scheduling",
        "publishing",
        "metrics",
        "report",
        "next_action",
      ],
      capabilities: [
        "platform_manifest.read",
        "marketing_run.read",
        "marketing_run.dispatch",
        "task.read",
        "artifact.read",
        "event_timeline.read",
        "evidence_summary.read",
        "run_evidence_snapshot.read",
        "access_request.read",
        "social_post.read",
        "report.read",
        "approval.decide",
        "access_request.decide",
        "event.ingest",
      ].map((id) => ({
        id,
        methods: ["GET"],
        resources: ["marketing_run"],
      })),
    },
    platformManifest: {
      resource_type: "plugged_in_social_platform_manifest",
      version: "v1",
      service: "plugged_in_social",
      closed_loop_stages: [
        "intake",
        "strategy",
        "content",
        "approval",
        "scheduling",
        "publishing",
        "metrics",
        "report",
        "next_action",
      ],
      governance_gates: [
        "tenant_rls",
        "internal_system_rls",
        "handoff_scope_guard",
        "approval_payload_hash",
        "content_hash_gate",
        "publish_content_hash_gate",
        "capability_gate",
        "durable_event_hash",
      ],
      agents: [
        {
          role: "chief_of_staff",
          name: "Chief of Staff",
          description: "Plans campaigns and dispatches department work.",
          writes: ["project.create", "virtual_agency_task.create"],
          emits: ["task_created", "handoff_dispatched"],
          queue: "stevie-virtual-agency",
          task_types: ["campaign_planning", "strategy_research"],
        },
        {
          role: "content_creative",
          name: "Content Creative",
          description: "Creates campaign content drafts.",
          writes: ["social_post.create"],
          emits: ["social_post.draft_created"],
          queue: "stevie-virtual-agency",
          task_types: ["content_generation"],
        },
        {
          role: "scheduling_distribution",
          name: "Scheduling Distribution",
          description: "Schedules approved content.",
          writes: ["social_post.schedule"],
          emits: ["social_post.scheduled"],
          queue: "stevie-virtual-agency",
          task_types: ["content_scheduling"],
        },
        {
          role: "community_engagement",
          name: "Community Engagement",
          description: "Handles engagement follow-up.",
          writes: [],
          emits: ["community_engagement.completed"],
          queue: "stevie-virtual-agency",
          task_types: ["community_engagement"],
        },
        {
          role: "analytics_reporting",
          name: "Analytics Reporting",
          description: "Builds reports and next actions.",
          writes: ["client_report.create"],
          emits: [
            "client_report.draft_created",
            "marketing.next_action.proposed",
          ],
          queue: "stevie-virtual-agency",
          task_types: ["analytics_reporting", "next_action_proposal"],
        },
      ],
      queues: [
        {
          queue: "stevie-virtual-agency",
          worker: "virtual-agency",
          dead_letter_queue: "stevie-virtual-agency-dlq",
          producer_binding: "QUEUE_VIRTUAL_AGENCY",
        },
      ],
      api_endpoints: [
        {
          method: "GET",
          path: "/api/integration/v1/platform-manifest",
          boundary: "public_rls",
          capability_ids: ["platform_manifest.read"],
        },
        {
          method: "POST",
          path: "/api/integration/v1/marketing-runs/{run_id}/dispatch",
          boundary: "public_rls",
          capability_ids: ["marketing_run.dispatch"],
        },
        {
          method: "POST",
          path: "/api/internal/virtual-agency/task",
          boundary: "internal_system_rls",
          capability_ids: ["task.execute"],
        },
        {
          method: "GET",
          path: "/api/integration/v1/marketing-runs/{run_id}/evidence-snapshot",
          boundary: "public_rls",
          capability_ids: ["run_evidence_snapshot.read"],
        },
        {
          method: "GET",
          path: "/api/integration/v1/marketing-runs/{run_id}/access-requests",
          boundary: "public_rls",
          capability_ids: ["access_request.read"],
        },
        {
          method: "GET",
          path: "/api/integration/v1/marketing-runs/{run_id}/social-posts",
          boundary: "public_rls",
          capability_ids: ["social_post.read"],
        },
        {
          method: "GET",
          path: "/api/integration/v1/marketing-runs/{run_id}/reports",
          boundary: "public_rls",
          capability_ids: ["report.read"],
        },
        {
          method: "GET",
          path: "/api/integration/v1/reports/{report_id}",
          boundary: "public_rls",
          capability_ids: ["report.read"],
        },
        {
          method: "POST",
          path: "/api/integration/v1/access-requests/{access_request_id}/decision",
          boundary: "public_rls",
          capability_ids: ["access_request.decide"],
        },
      ],
      data_resources: [
        {
          id: "client_engagement",
          table: "client_engagements",
          resource_type: "client_engagement",
          org_scoped: true,
          durable_evidence_fields: ["intake_payload"],
          read_capability_ids: ["engagement.read"],
          write_capability_ids: [],
        },
        {
          id: "marketing_run",
          table: "marketing_runs",
          resource_type: "marketing_run",
          org_scoped: true,
          durable_evidence_fields: ["strategy_summary"],
          read_capability_ids: ["marketing_run.read"],
          write_capability_ids: ["marketing_run.dispatch"],
        },
        {
          id: "virtual_agency_task",
          table: "virtual_agency_tasks",
          resource_type: "virtual_agency_task",
          org_scoped: true,
          durable_evidence_fields: ["latest_event_hash"],
          read_capability_ids: ["task.read"],
          write_capability_ids: ["task.execute"],
        },
        {
          id: "virtual_agency_event",
          table: "virtual_agency_events",
          resource_type: "virtual_agency_event",
          org_scoped: true,
          durable_evidence_fields: ["event_hash", "payload_hash"],
          read_capability_ids: ["event_timeline.read"],
          write_capability_ids: [],
        },
        {
          id: "agency_artifact",
          table: "agency_artifacts",
          resource_type: "agency_artifact",
          org_scoped: true,
          durable_evidence_fields: ["payload_hash"],
          read_capability_ids: ["artifact.read"],
          write_capability_ids: ["event.ingest"],
        },
        {
          id: "agency_approval_request",
          table: "agency_approval_requests",
          resource_type: "agency_approval_request",
          org_scoped: true,
          durable_evidence_fields: ["approval_payload_hash"],
          read_capability_ids: ["approval.read"],
          write_capability_ids: ["approval.decide"],
        },
        {
          id: "agency_access_request",
          table: "agency_access_requests",
          resource_type: "agency_access_request",
          org_scoped: true,
          durable_evidence_fields: ["scope", "instructions", "resolved_at"],
          read_capability_ids: ["access_request.read"],
          write_capability_ids: ["access_request.decide"],
        },
        {
          id: "social_post",
          table: "social_posts",
          resource_type: "social_post",
          org_scoped: true,
          durable_evidence_fields: [
            "current_content_hash",
            "scheduled_content_hash",
            "lineage",
          ],
          read_capability_ids: ["social_post.read"],
          write_capability_ids: ["social_post.publish"],
        },
        {
          id: "client_report",
          table: "client_reports",
          resource_type: "client_report",
          org_scoped: true,
          durable_evidence_fields: ["metrics_snapshot"],
          read_capability_ids: ["report.read"],
          write_capability_ids: [],
        },
      ],
      configuration_requirements: [
        {
          key: "WEBHOOK_SECRET",
          kind: "secret",
          required_for: ["internal webhooks"],
        },
        {
          key: "BACKEND_BASE_URL",
          kind: "secret",
          required_for: ["virtual-agency worker"],
        },
        {
          key: "QUEUE_PRODUCER_URL",
          kind: "environment",
          required_for: ["FastAPI queue publisher"],
        },
        {
          key: "QUEUE_VIRTUAL_AGENCY",
          kind: "queue_binding",
          required_for: ["queue-producer"],
        },
      ],
    },
    run: {
      resource_type: "marketing_run",
      id: liveRunId,
      org_id: liveOrgId,
      engagement_id: "66666666-6666-4666-8666-666666666666",
      project_id: "33333333-3333-4333-8333-333333333333",
      status: "completed",
      stage: "next_action",
      objective: "Autonomously improve launch conversion",
      strategy_summary: { offer: "launch audit" },
      current_blocker: null,
      started_at: "2026-07-01T16:00:00.000Z",
      completed_at: "2026-07-01T18:00:00.000Z",
      created_at: "2026-07-01T16:00:00.000Z",
      updated_at: "2026-07-01T18:00:00.000Z",
    },
    summary: {
      resource_type: "marketing_run_evidence_summary",
      run_id: liveRunId,
      org_id: liveOrgId,
      status: "completed",
      stage: "next_action",
      artifact_count: 1,
      artifact_type_counts: { strategy_plan: 1 },
      task_count: 1,
      task_status_counts: { done: 1 },
      event_count: 2,
      event_type_counts: { task_created: 1, execution_completed: 1 },
      approval_count: 0,
      pending_approval_count: 0,
      access_request_count: 1,
      open_access_request_count: 0,
      social_post_count: 1,
      social_post_status_counts: { scheduled: 1 },
      report_count: 1,
      report_status_counts: { generated: 1 },
      evidence_hashes: {
        artifact_payload_hashes: [liveArtifactHash],
        access_request_hashes: [liveAccessRequestHash],
        event_hashes: [liveEventHashA, liveEventHashB],
        task_latest_event_hashes: [liveEventHashB],
        social_post_content_hashes: [liveSocialPostHash],
        client_report_hashes: [liveReportHash],
        client_report_metrics_hashes: [liveReportMetricsHash],
      },
    },
    events: [
      {
        resource_type: "virtual_agency_event",
        id: "77777777-7777-4777-8777-777777777777",
        org_id: liveOrgId,
        marketing_run_id: liveRunId,
        task_id: liveTaskId,
        project_id: "33333333-3333-4333-8333-333333333333",
        event_type: "task_created",
        actor_role: "chief_of_staff",
        actor_id: null,
        idempotency_key: "task-created",
        task_version: 1,
        approval_version: null,
        previous_event_hash: null,
        payload_hash: "d".repeat(64),
        event_hash: liveEventHashA,
        payload: { title: "Plan launch" },
        lineage: { marketing_run_id: liveRunId },
        occurred_at: "2026-07-01T16:05:00.000Z",
      },
      {
        resource_type: "virtual_agency_event",
        id: "88888888-8888-4888-8888-888888888888",
        org_id: liveOrgId,
        marketing_run_id: liveRunId,
        task_id: liveTaskId,
        project_id: "33333333-3333-4333-8333-333333333333",
        event_type: "execution_completed",
        actor_role: "analytics_reporting",
        actor_id: null,
        idempotency_key: "task-completed",
        task_version: 1,
        approval_version: 1,
        previous_event_hash: liveEventHashA,
        payload_hash: "e".repeat(64),
        event_hash: liveEventHashB,
        payload: { artifacts_created: 1 },
        lineage: { marketing_run_id: liveRunId },
        occurred_at: "2026-07-01T17:45:00.000Z",
      },
    ],
    tasks: [
      {
        resource_type: "virtual_agency_task",
        id: liveTaskId,
        org_id: liveOrgId,
        project_id: "33333333-3333-4333-8333-333333333333",
        source_task_id: null,
        parent_task_id: null,
        title: "Propose next marketing action",
        agent_role: "analytics_reporting",
        task_type: "next_action_proposal",
        status: "done",
        task_version: 1,
        approved_version: 1,
        approval_active: true,
        approval_payload_hash: "f".repeat(64),
        latest_event_hash: liveEventHashB,
        context: { required_gates: ["pm_substrate_next_action_adapter"] },
        lineage: { marketing_run_id: liveRunId },
      },
    ],
    artifacts: [
      {
        resource_type: "agency_artifact",
        id: "99999999-9999-4999-8999-999999999999",
        org_id: liveOrgId,
        engagement_id: "66666666-6666-4666-8666-666666666666",
        marketing_run_id: liveRunId,
        virtual_agency_task_id: liveTaskId,
        artifact_type: "strategy_plan",
        title: "Launch conversion plan",
        payload_hash: liveArtifactHash,
        version: 1,
        evidence_refs: [],
        lineage: { marketing_run_id: liveRunId },
        author_role: "analytics_reporting",
      },
    ],
    approvals: [],
    accessRequests: [
      {
        resource_type: "agency_access_request",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        org_id: liveOrgId,
        engagement_id: "66666666-6666-4666-8666-666666666666",
        marketing_run_id: liveRunId,
        request_type: "analytics",
        provider: "umami",
        status: "granted",
        scope: { website_id: "acme" },
        reason: "Metrics reporting needs analytics access",
        instructions: {
          action: "connect_analytics",
          resolution: { decision: "granted" },
        },
        resolved_at: "2026-07-01T16:30:00.000Z",
        resolved_by_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    ],
    socialPosts: [
      {
        resource_type: "social_post",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        org_id: liveOrgId,
        project_id: "33333333-3333-4333-8333-333333333333",
        social_account_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        platform: "linkedin",
        status: "scheduled",
        caption: "Approved launch campaign draft",
        hashtags: ["launch"],
        media_urls: [],
        media_type: null,
        scheduled_at: "2026-07-02T16:00:00.000Z",
        published_at: null,
        platform_post_id: null,
        platform_url: null,
        compound_phase: "create",
        created_by_agent: "content_creative",
        version: 2,
        current_content_hash: liveSocialPostHash,
        scheduled_content_hash: liveSocialPostHash,
        published_content_hash: null,
        likes: 0,
        comments: 0,
        shares: 0,
        impressions: 0,
        reach: 0,
        engagement_rate: null,
        lineage: { marketing_run_id: liveRunId },
      },
    ],
    reports: [
      {
        resource_type: "client_report",
        id: report.id,
        org_id: liveOrgId,
        project_id: report.project_id ?? null,
        lead_id: null,
        title: report.title,
        status: report.status,
        cadence: "weekly",
        compound_phase: "amplify",
        created_by_agent: "analytics_reporting",
        client_name: "Acme",
        client_email: "client@example.com",
        period_start: report.period_start,
        period_end: report.period_end,
        sections: [],
        metrics_snapshot: report.metrics_snapshot,
        metrics_snapshot_hash: liveReportMetricsHash,
        report_hash: liveReportHash,
        pdf_url: "r2://reports/summer-pipeline.pdf",
        pdf_generated_at: report.pdf_generated_at ?? null,
        sent_at: null,
        created_at: "2026-07-01T17:45:00.000Z",
        updated_at: "2026-07-01T17:45:00.000Z",
      },
    ],
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
): PluggedInSocialIntegrationFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("PluggedInSocial Axis B next-action adapter", () => {
  it("maps a generated ClientReport row into an accepted substrate next-action proposal", () => {
    const result = buildPluggedInSocialAxisBNextActionAdapterResult({
      tenantId: tenantId("tnt_plugged_in_social_axis_b"),
      workspaceRoot: process.cwd(),
      report,
      decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
      stateReviewArtifactHash: "c".repeat(64),
    });

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.sourcePath).toBe("./plugged_in_social");
    expect(result.proposal).toMatchObject({
      recommendedAction: "launch_followup_campaign",
      confidence: 1,
    });
    expect(result.proposal.envelope).toMatchObject({
      terminalOutcome: "accepted",
      blockingCauses: [],
    });
    expect(result.evidenceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111:metrics_snapshot",
        }),
      ]),
    );
    expect(result.substrateRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "action_outcome_envelope" }),
        expect.objectContaining({
          kind: "document",
          id: "pm_substrate:profile-agency:next-action-proposal",
        }),
      ]),
    );
    expect(verifyActionOutcomeEnvelopeHash(result.proposal.envelope).valid).toBe(
      true,
    );
  });

  it("blocks Axis B readiness when required manifest gates are missing", () => {
    const manifest = readPluggedInSocialSourceManifest({
      workspaceRoot: process.cwd(),
    });
    const result = buildPluggedInSocialAxisBNextActionAdapterResult({
      tenantId: tenantId("tnt_plugged_in_social_axis_b_blocked"),
      manifest: {
        ...manifest,
        governance: {
          ...manifest.governance,
          sharedPayloadContract: false,
        },
      },
      report,
      decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
      stateReviewArtifactHash: "d".repeat(64),
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toContain(
      "missing governance gate: sharedPayloadContract",
    );
  });

  it("fetches live run evidence through the neutral integration API and admits durable evidence", async () => {
    const snapshot = liveSnapshotFixture();
    const responses = new Map<string, unknown>([
      ["https://api.example/api/integration/v1/capabilities", snapshot.capabilities],
      [
        "https://api.example/api/integration/v1/platform-manifest",
        snapshot.platformManifest,
      ],
      [
        `https://api.example/api/integration/v1/marketing-runs/${liveRunId}/evidence-snapshot`,
        {
          resource_type: "marketing_run_evidence_snapshot",
          run: snapshot.run,
          summary: snapshot.summary,
          events: snapshot.events,
          tasks: snapshot.tasks,
          artifacts: snapshot.artifacts,
          approvals: snapshot.approvals,
          access_requests: snapshot.accessRequests,
          social_posts: snapshot.socialPosts,
          reports: snapshot.reports,
        },
      ],
    ]);
    const calls: Array<{ url: string; authorization: string | undefined }> = [];
    const fetchFn: PluggedInSocialIntegrationFetch = async (url, init) => {
      calls.push({ url, authorization: init?.headers?.authorization });
      if (!responses.has(url)) {
        return jsonResponse({ error: "not found" }, 404);
      }
      return jsonResponse(responses.get(url));
    };

    const fetched = await fetchPluggedInSocialLiveRunEvidenceSnapshot({
      integrationBaseUrl: "https://api.example",
      runId: liveRunId,
      bearerToken: "jwt-token",
      fetchFn,
    });
    const result = buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult({
      workspaceRoot: process.cwd(),
      snapshot: fetched,
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example/api/integration/v1/capabilities",
      "https://api.example/api/integration/v1/platform-manifest",
      `https://api.example/api/integration/v1/marketing-runs/${liveRunId}/evidence-snapshot`,
    ]);
    expect(new Set(calls.map((call) => call.authorization))).toEqual(
      new Set(["Bearer jwt-token"]),
    );
    expect(result.ready).toBe(true);
    expect(result.terminalOutcome).toBe("accepted");
    expect(result.issues).toEqual([]);
    expect(result.evidenceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "workflow_run",
          id: `plugged_in_social:marketing_runs:${liveRunId}`,
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:integration_api:platform_manifest",
        }),
        expect.objectContaining({
          kind: "event",
          id: "plugged_in_social:virtual_agency_events:88888888-8888-4888-8888-888888888888",
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:agency_access_requests:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:social_posts:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
        }),
      ]),
    );
    expect(result.substrateRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "action_outcome_envelope",
          id: `plugged_in_social:marketing_runs:${liveRunId}:live-axis-b-evidence-outcome`,
        }),
        expect.objectContaining({
          kind: "state_review_artifact",
          id: `plugged_in_social:marketing_runs:${liveRunId}:live-axis-b-review`,
        }),
      ]),
    );
  });

  it("blocks live run evidence when the remote platform manifest omits required wiring", () => {
    const snapshot = liveSnapshotFixture();
    const result = buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult({
      snapshot: {
        ...snapshot,
        platformManifest: {
          ...snapshot.platformManifest,
          agents: snapshot.platformManifest.agents
            .filter((agent) => agent.role !== "analytics_reporting")
            .map((agent) =>
              agent.role === "chief_of_staff"
                ? { ...agent, queue: null, task_types: ["campaign_planning"] }
                : agent,
            ),
          queues: [],
          governance_gates: snapshot.platformManifest.governance_gates.filter(
            (gate) => gate !== "content_hash_gate",
          ),
        },
      },
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "missing platform agent role: analytics_reporting",
        "chief_of_staff lacks strategy_research task type",
        "chief_of_staff is not bound to stevie-virtual-agency",
        "platform manifest missing stevie-virtual-agency queue",
        "missing platform governance gate: content_hash_gate",
      ]),
    );
  });

  it("blocks live run evidence when durable hashes are missing", () => {
    const snapshot = liveSnapshotFixture();
    const result = buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult({
      workspaceRoot: process.cwd(),
      snapshot: {
        ...snapshot,
        summary: {
          ...snapshot.summary,
          evidence_hashes: {
            artifact_payload_hashes: [],
            access_request_hashes: [],
            event_hashes: [],
            task_latest_event_hashes: [],
            social_post_content_hashes: [],
            client_report_hashes: [],
            client_report_metrics_hashes: [],
          },
        },
      },
    });

    expect(result.ready).toBe(false);
    expect(result.terminalOutcome).toBe("blocked");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "missing evidence hashes: artifact_payload_hashes",
        "missing evidence hashes: access_request_hashes",
        "missing evidence hashes: event_hashes",
        "missing evidence hashes: client_report_hashes",
        "missing evidence hashes: client_report_metrics_hashes",
        "missing evidence hashes: social_post_content_hashes",
        "missing evidence hashes: task_latest_event_hashes",
      ]),
    );
  });

  it("blocks live run evidence when social posts are not attributed to the marketing run", () => {
    const snapshot = liveSnapshotFixture();
    const result = buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult({
      snapshot: {
        ...snapshot,
        socialPosts: snapshot.socialPosts.map((post) => ({
          ...post,
          lineage: {},
        })),
      },
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toContain(
      "social post is missing marketing-run lineage: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });

  it("blocks live run evidence when scheduled social content hash is stale", () => {
    const snapshot = liveSnapshotFixture();
    const result = buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult({
      snapshot: {
        ...snapshot,
        socialPosts: snapshot.socialPosts.map((post) => ({
          ...post,
          current_content_hash: "f".repeat(64),
        })),
      },
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toContain(
      "social post scheduled content hash is stale: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });
});
