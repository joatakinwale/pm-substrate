import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";
import { buildMarketingAxisBIntegrationReadinessEval } from "../../evals/src/marketing.js";

import {
  PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES,
  readPluggedInSocialSourceManifest,
} from "./plugged-in-social-manifest.js";

describe("PluggedInSocial source manifest", () => {
  it("derives agents, queues, APIs, configuration, data models, and governance gates from the live source tree", () => {
    const manifest = readPluggedInSocialSourceManifest({
      workspaceRoot: process.cwd(),
    });

    expect(manifest.sourceId).toBe("plugged_in_social");
    expect(manifest.sourcePath).toBe("./plugged_in_social");
    expect(manifest.readiness.complete).toBe(true);
    expect(manifest.readiness.missing).toEqual([]);

    expect(manifest.agents.map((agent) => agent.role)).toEqual([
      "chief_of_staff",
      "content_creative",
      "scheduling_distribution",
      "community_engagement",
      "analytics_reporting",
    ]);
    expect(
      manifest.agents.find((agent) => agent.role === "content_creative"),
    ).toMatchObject({
      writes: ["social_post.create"],
      emits: ["social_post.draft_created"],
    });
    expect(
      manifest.agents.find((agent) => agent.role === "scheduling_distribution"),
    ).toMatchObject({
      writes: ["social_post.schedule"],
      emits: ["social_post.scheduled"],
    });

    expect(manifest.queues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queue: "stevie-virtual-agency",
          worker: "virtual-agency",
          deadLetterQueue: "stevie-virtual-agency-dlq",
        }),
        expect.objectContaining({
          queue: "stevie-virtual-agency",
          worker: "queue-producer",
        }),
      ]),
    );

    expect(manifest.apiEndpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/virtual-agency/inbox",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/virtual-agency/campaigns/{project_id}/approve",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/internal/virtual-agency/task",
          boundary: "internal_system_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/capabilities",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/external-adapters",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/integration/v1/engagements",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/integration/v1/engagements/{engagement_id}/marketing-runs",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/engagements/{engagement_id}/marketing-runs",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/engagements/{engagement_id}/artifacts",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/engagements/{engagement_id}/approvals",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/engagements/{engagement_id}/access-requests",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/artifacts",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/external-adapter-runs",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/integration/v1/marketing-runs/{run_id}/external-adapter-runs",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/tasks",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/events",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/evidence-summary",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/evidence-snapshot",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/marketing-runs/{run_id}/reports",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/integration/v1/reports/{report_id}",
          boundary: "public_rls",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/integration/v1/events",
          boundary: "public_rls",
        }),
      ]),
    );

    expect(manifest.dataTables).toEqual(
      expect.arrayContaining([
        "virtual_agency_tasks",
        "virtual_agency_events",
        "social_posts",
        "ai_content_requests",
        "client_reports",
        "automations",
      ]),
    );
    expect(manifest.dataModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "virtual_agency_tasks",
          model: "VirtualAgencyTask",
          modelPath: "backend/app/models/virtual_agency.py",
          migrationPaths: expect.arrayContaining([
            "backend/alembic/versions/022_virtual_agency_orchestration_ledger.py",
          ]),
          orgScoped: true,
          durableEvidenceFields: expect.arrayContaining([
            "approval_payload_hash",
            "latest_event_hash",
            "lineage",
            "task_version",
          ]),
        }),
        expect.objectContaining({
          table: "social_posts",
          modelPath: "backend/app/models/social_media.py",
          migrationPaths: expect.arrayContaining([
            "backend/alembic/versions/010_social_media_ai.py",
            "backend/alembic/versions/022_virtual_agency_orchestration_ledger.py",
            "backend/alembic/versions/023_social_post_content_hashes.py",
          ]),
          durableEvidenceFields: expect.arrayContaining([
            "platform_post_id",
            "published_at",
            "published_content_hash",
            "scheduled_content_hash",
            "version",
          ]),
        }),
        expect.objectContaining({
          table: "client_reports",
          modelPath: "backend/app/models/report.py",
          migrationPaths: expect.arrayContaining([
            "backend/alembic/versions/008_reporting_analytics.py",
          ]),
          durableEvidenceFields: expect.arrayContaining([
            "created_by_agent",
            "metrics_snapshot",
            "pdf_url",
          ]),
        }),
      ]),
    );

    expect(manifest.configurations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "backend_settings",
          name: "fastapi-settings",
          sourcePath: "backend/app/core/config.py",
          environmentKeys: expect.arrayContaining([
            "APP_ENV",
            "WEBHOOK_SECRET",
            "QUEUE_PRODUCER_URL",
          ]),
        }),
        expect.objectContaining({
          kind: "backend_test_dependencies",
          name: "backend-test-dependencies",
          sourcePath: "backend/requirements-dev.txt",
          dependencies: expect.arrayContaining(["pytest", "pytest-asyncio"]),
        }),
        expect.objectContaining({
          kind: "deploy_script",
          name: "agents-deploy",
          sourcePath: "agents/scripts/deploy.sh",
          queues: expect.arrayContaining([
            "stevie-virtual-agency",
            "stevie-social-publisher",
          ]),
          secrets: expect.arrayContaining([
            "WEBHOOK_SECRET",
            "BACKEND_BASE_URL",
            "QUEUE_PRODUCER_URL",
          ]),
          workers: expect.arrayContaining(["virtual-agency", "social-cron"]),
        }),
        expect.objectContaining({
          kind: "worker_wrangler",
          name: "stevie-virtual-agency",
          sourcePath: "agents/workers/virtual-agency/wrangler.toml",
          compatibilityDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          queues: expect.arrayContaining([
            "stevie-virtual-agency",
            "stevie-virtual-agency-dlq",
          ]),
          secrets: expect.arrayContaining(["WEBHOOK_SECRET", "BACKEND_BASE_URL"]),
        }),
        expect.objectContaining({
          kind: "worker_wrangler",
          name: "stevie-social-cron",
          sourcePath: "agents/workers/social-cron/wrangler.toml",
          compatibilityDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          schedules: expect.arrayContaining(["*/5 * * * *", "*/30 * * * *"]),
          secrets: expect.arrayContaining([
            "WEBHOOK_SECRET",
            "BACKEND_BASE_URL",
            "QUEUE_PRODUCER_URL",
          ]),
        }),
      ]),
    );
    expect(
      manifest.configurations.every(
        (config) => !config.sourcePath.includes("/._"),
      ),
    ).toBe(true);
    expect(
      manifest.configurations
        .filter((config) => config.kind === "worker_wrangler")
        .every((config) => /^\d{4}-\d{2}-\d{2}$/.test(config.compatibilityDate ?? "")),
    ).toBe(true);
    expect(manifest.externalAdapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "agent_harness",
          adapterType: "agent_harness",
          boundary: "containerized_process",
          sourcePath: "backend/app/api/integration.py",
          inputContracts: expect.arrayContaining([
            "virtual_agency_task",
            "approval_payload_hash",
            "capability_grant",
          ]),
          outputArtifacts: expect.arrayContaining([
            "agent_session_tree",
            "tool_call_log",
            "next_action_proposal",
          ]),
          requiredGates: expect.arrayContaining([
            "tenant_rls",
            "capability_gate",
            "sandbox_boundary",
            "durable_event_hash",
          ]),
          evidenceFields: expect.arrayContaining([
            "tool_call_hash",
            "output_payload_hash",
          ]),
        }),
        expect.objectContaining({
          id: "browser_qa_harness",
          adapterType: "browser_qa_harness",
          boundary: "sandboxed_process",
          sourcePath: "backend/app/api/integration.py",
          outputArtifacts: expect.arrayContaining([
            "report_html",
            "playwright_script",
            "network_har",
            "trace_zip",
          ]),
          requiredGates: expect.arrayContaining([
            "tenant_rls",
            "evidence_hash_gate",
            "no_secret_exfiltration",
          ]),
          evidenceFields: expect.arrayContaining([
            "script_hash",
            "console_error_count",
          ]),
        }),
      ]),
    );

    for (const gate of PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES) {
      expect(manifest.governance[gate]).toBe(true);
    }
    expect(manifest.governance.nextActionLedgerBinding).toBe(true);
    expect(manifest.governance.nextActionExecutionBoundary).toBe(true);
    expect(manifest.governance.nextActionApprovalSurface).toBe(true);
    expect(manifest.governance.metricsReadyAnalyticsDispatch).toBe(true);
    expect(manifest.governance.closedLoopRuntimeFixture).toBe(true);
    expect(manifest.governance.externalIntegrationBoundary).toBe(true);
    expect(manifest.governance.externalAdapterBoundary).toBe(true);
    expect(manifest.governance.sharedPayloadContract).toBe(true);
    expect(manifest.governance.operatorRunMonitorSurface).toBe(true);
    expect(PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES).toContain(
      "contentHashMutationGate",
    );
    expect(PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES).toContain(
      "sharedPayloadContract",
    );
    expect(PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES).toContain(
      "operatorRunMonitorSurface",
    );
    expect(PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES).toContain(
      "externalAdapterBoundary",
    );
    expect(PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES).toContain(
      "publishContentHashGate",
    );
    expect(
      manifest.governance[
        "contentHashMutationGate" as keyof typeof manifest.governance
      ],
    ).toBe(true);
    expect(
      manifest.governance[
        "publishContentHashGate" as keyof typeof manifest.governance
      ],
    ).toBe(true);

    expect(manifest.closedLoopStages.map((stage) => stage.stage)).toEqual([
      "intake",
      "strategy",
      "content",
      "approval",
      "scheduling",
      "publishing",
      "metrics",
      "report",
      "next_action",
    ]);
    expect(
      manifest.closedLoopStages.find((stage) => stage.stage === "next_action"),
    ).toMatchObject({
      present: true,
      evidence: expect.arrayContaining([
        "../packages/profile-agency/src/next-action-proposal.ts",
        "../packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts",
        "backend/app/services/report_next_actions.py",
        "backend/app/api/internal/reports.py",
      ]),
    });
    expect(
      manifest.closedLoopStages.find((stage) => stage.stage === "metrics"),
    ).toMatchObject({
      present: true,
      evidence: expect.arrayContaining([
        "agents/workers/social-cron/src/index.ts",
        "backend/app/services/virtual_agency.py",
        "backend/app/services/virtual_agency_orchestration.py",
      ]),
    });
    expect(manifest.evidenceRefs).toContainEqual(
      expect.objectContaining({
        id: "plugged_in_social:test:closed-loop-runtime-fixture",
        path: "backend/tests/test_virtual_agency_orchestration.py",
      }),
    );
    expect(manifest.evidenceRefs).toContainEqual(
      expect.objectContaining({
        id: "plugged_in_social:api:integration-v1",
        path: "backend/app/api/integration.py",
      }),
    );
    expect(manifest.evidenceRefs).toContainEqual(
      expect.objectContaining({
        id: "plugged_in_social:api:external-adapter-manifest",
        path: "backend/app/api/integration.py",
      }),
    );
  });

  it("feeds Axis B readiness with a substrate next-action proposal boundary", () => {
    const manifest = readPluggedInSocialSourceManifest({
      workspaceRoot: process.cwd(),
    });

    const event = buildMarketingAxisBIntegrationReadinessEval({
      tenantId: tenantId("tnt_plugged_in_social_manifest"),
      observedAt: timestamp("2026-07-01T18:00:00.000Z"),
      manifest,
    });

    expect(event.result).toBe("pass");
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social:worker:virtual-agency",
    );
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social:test:closed-loop-runtime-fixture",
    );
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social:config:virtual-agency-worker",
    );
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social:data-model:virtual-agency-tasks",
    );
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social:api:integration-v1",
    );
    expect(event.substrateRefs.map((ref) => ref.id)).toContain(
      "pm_substrate:profile-agency:publication-terminal",
    );
    expect(event.substrateRefs.map((ref) => ref.id)).toContain(
      "pm_substrate:profile-agency:next-action-proposal",
    );
    expect(event.substrateRefs.map((ref) => ref.id)).toContain(
      "pm_substrate:profile-agency:plugged-in-social-axis-b-adapter",
    );
    expect(event.notes).not.toContain("closed-loop stages incomplete: next_action");
  });
});
