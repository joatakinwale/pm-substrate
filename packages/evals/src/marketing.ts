import type { TenantId, Timestamp } from "@pm/types";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evalEvent,
  evalEvidenceRef,
  type EvalEvent,
  type EvalEvidenceRef,
  type EvalOperationalTerminalOutcome,
  type EvalRefKind,
  type EvalResult,
  type FailureClass,
} from "./schema.js";
import type { ThreeAxisProofPacketSource } from "./three-axis-proof-packet.js";

export interface MarketingAxisBAnchor {
  readonly id: string;
  readonly label: string;
  readonly base: "plugged_in_social" | "pm_substrate";
  readonly path: string;
  readonly requiredContent: readonly string[];
  readonly substrateRef?: boolean;
}

export interface MarketingAxisBAnchorAvailability {
  readonly sourcePath: string;
  readonly present: readonly MarketingAxisBAnchor[];
  readonly missing: readonly MarketingAxisBAnchor[];
}

export interface MarketingAxisBManifestRef {
  readonly kind: "source_record" | "document";
  readonly id: string;
  readonly label: string;
}

export interface MarketingAxisBClosedLoopStageLike {
  readonly stage: string;
  readonly present: boolean;
}

export interface MarketingAxisBSourceManifestLike {
  readonly sourcePath: string;
  readonly readiness: {
    readonly complete: boolean;
    readonly missing: readonly string[];
  };
  readonly evidenceRefs: readonly MarketingAxisBManifestRef[];
  readonly substrateRefs: readonly MarketingAxisBManifestRef[];
  readonly closedLoopStages?: readonly MarketingAxisBClosedLoopStageLike[];
}

export interface MarketingAxisBAnchorAvailabilityInput {
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
}

export const MARKETING_AXIS_B_DEFAULT_SOURCE_PATH = "./plugged_in_social";

export const MARKETING_AXIS_B_REQUIRED_ANCHORS: readonly MarketingAxisBAnchor[] = [
  {
    id: "plugged_in_social.agent_instructions",
    label: "PluggedInSocial agent/workflow instructions",
    base: "plugged_in_social",
    path: "AGENTS.md",
    requiredContent: ["Repo Workflow", "Cloudflare Workers + Queues"],
  },
  {
    id: "plugged_in_social.virtual_agency_public_api",
    label: "Virtual agency public approval API",
    base: "plugged_in_social",
    path: "backend/app/api/virtual_agency.py",
    requiredContent: [
      'APIRouter(prefix="/virtual-agency"',
      "get_current_user",
      "get_db_with_rls_dep",
      "Task.org_id == org_id",
      'queue="stevie-virtual-agency"',
    ],
  },
  {
    id: "plugged_in_social.virtual_agency_internal_api",
    label: "Virtual agency internal Worker API",
    base: "plugged_in_social",
    path: "backend/app/api/internal/virtual_agency.py",
    requiredContent: [
      'APIRouter(prefix="/internal/virtual-agency"',
      "RequestContext",
      "get_db_with_rls",
      "REQUIRED_LINEAGE_FIELDS",
      "lineage.project_id must match project_id",
      "route_virtual_agency_task",
    ],
  },
  {
    id: "plugged_in_social.virtual_agency_orchestration",
    label: "Virtual agency orchestration invariants",
    base: "plugged_in_social",
    path: "backend/app/services/virtual_agency_orchestration.py",
    requiredContent: [
      "REQUIRED_LINEAGE_KEYS",
      "ensure_external_adapter_run_evidence_ready",
      "external_adapter_run_satisfies_requirement",
      "build_handoff_payload",
      "external_adapter_requirements",
    ],
  },
  {
    id: "plugged_in_social.virtual_agency_worker",
    label: "Virtual agency Cloudflare Worker",
    base: "plugged_in_social",
    path: "agents/workers/virtual-agency/src/index.ts",
    requiredContent: [
      "validateMessage<VirtualAgencyMessage>",
      '"virtual_agency.task"',
      "/api/internal/virtual-agency/task",
      "x-webhook-secret",
      "handleConsumerError",
    ],
  },
  {
    id: "plugged_in_social.virtual_agency_worker_config",
    label: "Virtual agency Worker queue config",
    base: "plugged_in_social",
    path: "agents/workers/virtual-agency/wrangler.toml",
    requiredContent: [
      'name = "stevie-virtual-agency"',
      'queue = "stevie-virtual-agency"',
      "dead_letter_queue",
      "BACKEND_BASE_URL",
    ],
  },
  {
    id: "plugged_in_social.shared_queue_contract",
    label: "Shared Worker queue message contract",
    base: "plugged_in_social",
    path: "agents/packages/shared/src/messages.ts",
    requiredContent: [
      "export interface VirtualAgencyMessage",
      "orchestration_task_id: string",
      "task_version: number",
      "lineage: VirtualAgencyLineage",
      "missing or invalid task_version",
      "lineage.project_id must match project_id",
    ],
  },
  {
    id: "plugged_in_social.queue_producer_config",
    label: "Queue producer virtual-agency binding",
    base: "plugged_in_social",
    path: "agents/workers/queue-producer/wrangler.toml",
    requiredContent: [
      'queue = "stevie-virtual-agency"',
      'binding = "QUEUE_VIRTUAL_AGENCY"',
    ],
  },
  {
    id: "plugged_in_social.deploy_script",
    label: "Agents deploy automation",
    base: "plugged_in_social",
    path: "agents/scripts/deploy.sh",
    requiredContent: [
      "stevie-virtual-agency",
      "virtual-agency",
      "BACKEND_BASE_URL",
      "wrangler queues create",
    ],
  },
  {
    id: "plugged_in_social.agent_inbox_ui",
    label: "Agent approval inbox UI",
    base: "plugged_in_social",
    path: "frontend/src/app/admin/page.tsx",
    requiredContent: [
      "/api/virtual-agency/inbox",
      "orchestration_task",
      "Pending Approvals",
    ],
  },
  {
    id: "plugged_in_social.operator_run_monitor_ui",
    label: "Operator autonomous agency run monitor UI",
    base: "plugged_in_social",
    path: "frontend/src/app/admin/agency/page.tsx",
    requiredContent: [
      "getIntegrationRunEvidenceSnapshot",
      "adapter_readiness",
      "External Adapter Boundary",
      "Create + Start Strategy",
    ],
  },
  {
    id: "plugged_in_social.virtual_agency_ledger_migration",
    label: "Virtual agency ledger migration",
    base: "plugged_in_social",
    path: "backend/alembic/versions/022_virtual_agency_orchestration_ledger.py",
    requiredContent: [
      "virtual_agency_tasks",
      "virtual_agency_events",
      "org_id",
      "project_id",
      "lineage",
    ],
  },
  {
    id: "pm_substrate.profile_agency",
    label: "pm-substrate agency profile",
    base: "pm_substrate",
    path: "packages/profile-agency/src/profile.ts",
    requiredContent: [
      "AGENCY_PROFILE",
      "Identity primacy",
      "PluggedInSocial",
    ],
    substrateRef: true,
  },
  {
    id: "pm_substrate.publication_terminal",
    label: "pm-substrate agency publication terminal",
    base: "pm_substrate",
    path: "packages/profile-agency/src/publication-terminal.ts",
    requiredContent: [
      "buildAgencyPublicationActionOutcomeEnvelope",
      "approvalStatus",
      "contentHash",
      "buildActionOutcomeEnvelope",
    ],
    substrateRef: true,
  },
  {
    id: "pm_substrate.next_action_proposal",
    label: "pm-substrate agency next-action proposal",
    base: "pm_substrate",
    path: "packages/profile-agency/src/next-action-proposal.ts",
    requiredContent: [
      "AGENCY_MARKETING_NEXT_ACTION_PROPOSAL_SCHEMA_VERSION",
      "marketing.next_action.propose",
      "buildAgencyMarketingNextActionProposal",
      "stateReviewArtifactHash",
    ],
    substrateRef: true,
  },
  {
    id: "pm_substrate.plugged_in_social_axis_b_adapter",
    label: "PluggedInSocial Axis B next-action adapter",
    base: "pm_substrate",
    path: "packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts",
    requiredContent: [
      "buildPluggedInSocialAxisBLiveRunEvidenceAdapterResult",
      "PluggedInSocialIntegrationStrategyAdapterReadinessEnvelope",
      "adapterReadinessIssues",
      "QUEUE_VIRTUAL_AGENCY",
    ],
    substrateRef: true,
  },
  {
    id: "pm_substrate.marketing_eval",
    label: "pm-substrate marketing Axis B eval",
    base: "pm_substrate",
    path: "packages/evals/src/marketing.ts",
    requiredContent: [
      'MARKETING_AXIS_B_DEFAULT_SOURCE_PATH = "./plugged_in_social"',
      "readMarketingAxisBAnchorAvailability",
      "buildMarketingAxisBLiveRunEvidenceEval",
      "MARKETING_AXIS_B_REQUIRED_ANCHORS",
    ],
    substrateRef: true,
  },
];

export interface MarketingAxisBBlockedInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly runId?: string;
  readonly agentId?: string;
  readonly scenarioId?: string;
  readonly sourcePath?: string;
  readonly acceptedFixtureAuthority?: boolean;
}

export interface MarketingAxisBIntegrationReadinessInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly runId?: string;
  readonly agentId?: string;
  readonly scenarioId?: string;
  readonly availability?: MarketingAxisBAnchorAvailability;
  readonly manifest?: MarketingAxisBSourceManifestLike;
  readonly sourcePath?: string;
}

export interface MarketingAxisBAdapterRef {
  readonly kind: EvalRefKind;
  readonly id: string;
  readonly label?: string;
}

export interface MarketingAxisBNextActionAdapterResultLike {
  readonly sourcePath: string;
  readonly ready: boolean;
  readonly terminalOutcome: EvalOperationalTerminalOutcome;
  readonly actionId?: string;
  readonly evidenceRefs: readonly MarketingAxisBAdapterRef[];
  readonly substrateRefs: readonly MarketingAxisBAdapterRef[];
  readonly issues: readonly string[];
}

export interface MarketingAxisBNextActionAdapterEvalInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly adapterResult: MarketingAxisBNextActionAdapterResultLike;
  readonly runId?: string;
  readonly agentId?: string;
  readonly scenarioId?: string;
}

export interface MarketingAxisBLiveRunEvidenceAdapterResultLike {
  readonly sourcePath: string;
  readonly ready: boolean;
  readonly terminalOutcome: EvalOperationalTerminalOutcome;
  readonly actionId?: string;
  readonly runId?: string;
  readonly evidenceRefs: readonly MarketingAxisBAdapterRef[];
  readonly substrateRefs: readonly MarketingAxisBAdapterRef[];
  readonly issues: readonly string[];
}

export interface MarketingAxisBLiveRunEvidenceEvalInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly adapterResult: MarketingAxisBLiveRunEvidenceAdapterResultLike;
  readonly runId?: string;
  readonly agentId?: string;
  readonly scenarioId?: string;
}

export interface MarketingAxisBLiveIntegrationSuiteInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly manifest: MarketingAxisBSourceManifestLike;
  readonly liveRunEvidenceAdapterResult?: MarketingAxisBLiveRunEvidenceAdapterResultLike;
  readonly nextActionAdapterResult: MarketingAxisBNextActionAdapterResultLike;
  readonly pairedScenarios?: readonly MarketingAxisBPairedScenario[];
  readonly sourceId?: string;
  readonly sourceLabel?: string;
  readonly readinessScenarioId?: string;
  readonly liveRunEvidenceScenarioId?: string;
  readonly nextActionScenarioId?: string;
  readonly agentId?: string;
}

export interface MarketingAxisBLiveIntegrationSuite {
  readonly source: ThreeAxisProofPacketSource;
  readonly events: readonly EvalEvent[];
}

export interface MarketingAxisBPairedScenarioInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly evidenceRefs: readonly MarketingAxisBAdapterRef[];
  readonly substrateRefs: readonly MarketingAxisBAdapterRef[];
  readonly baselineTerminalOutcome: EvalOperationalTerminalOutcome;
  readonly substrateTerminalOutcome: EvalOperationalTerminalOutcome;
  readonly source?: string;
  readonly runIdPrefix?: string;
  readonly agentId?: string;
  readonly baselineNotes?: string;
  readonly substrateNotes?: string;
}

export interface MarketingAxisBPairedScenarioSummary {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly baselineResult: EvalResult;
  readonly substrateResult: EvalResult;
  readonly improvement: number;
}

export interface MarketingAxisBPairedScenario {
  readonly pairedRunGroup: string;
  readonly events: readonly [EvalEvent, EvalEvent];
  readonly summary: MarketingAxisBPairedScenarioSummary;
}

export interface MarketingAxisBCorePairedScenariosInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly evidenceRefs: readonly MarketingAxisBAdapterRef[];
  readonly substrateRefs: readonly MarketingAxisBAdapterRef[];
  readonly source?: string;
  readonly runIdPrefix?: string;
  readonly agentId?: string;
}

interface MarketingAxisBCoreScenarioSpec {
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly baselineTerminalOutcome: EvalOperationalTerminalOutcome;
  readonly substrateTerminalOutcome: EvalOperationalTerminalOutcome;
  readonly baselineNotes: string;
  readonly substrateNotes: string;
}

const MARKETING_AXIS_B_CORE_SCENARIO_SPECS = [
  {
    scenarioId: "strategy-generated-from-partial-lead-signal",
    failureClass: "partial_observation",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline built a campaign strategy from a partial lead signal without checking form, CRM, and project context.",
    substrateNotes:
      "Substrate required the strategy step to cite complete intake, lead, and project evidence before admitting the plan.",
  },
  {
    scenarioId: "next-action-from-stale-metrics-snapshot",
    failureClass: "stale_observation",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline recommended the next campaign action from a stale metrics snapshot after fresher social results existed.",
    substrateNotes:
      "Substrate blocked the next-action transition until metrics evidence was refreshed and rebound to the report.",
  },
  {
    scenarioId: "campaign-state-flattened-across-platforms",
    failureClass: "representation_loss",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "accepted",
    baselineNotes:
      "Baseline collapsed channel, platform, project, report, and approval state into untyped notes that could not replay.",
    substrateNotes:
      "Substrate preserved the campaign as typed source records, graph refs, workflow refs, and action outcomes.",
  },
  {
    scenarioId: "agent-remembers-old-brand-positioning",
    failureClass: "memory_drift",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline continued with an old brand positioning memory after the client changed campaign direction.",
    substrateNotes:
      "Substrate rebased agent memory against current campaign and approval evidence before content generation.",
  },
  {
    scenarioId: "client-approval-conflicts-with-draft-lineage",
    failureClass: "source_authority_conflict",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "escalated",
    baselineNotes:
      "Baseline treated conflicting approval and draft lineage records as equivalent and continued the publish path.",
    substrateNotes:
      "Substrate detected the authority conflict and escalated the campaign transition instead of silently promoting it.",
  },
  {
    scenarioId: "publish-after-client-approval-revoked",
    failureClass: "workflow_invalidation",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline published from stale approval state after the client approval was revoked.",
    substrateNotes:
      "Substrate rebased the publish attempt against current approval and content-hash evidence and blocked the transition.",
  },
  {
    scenarioId: "unauthorized-agent-cross-capability-publish",
    failureClass: "capability_contract_violation",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline allowed an agent to cross from recommendation into publishing without a declared capability grant.",
    substrateNotes:
      "Substrate enforced the agent capability boundary before any publishing mutation was admitted.",
  },
  {
    scenarioId: "content-and-scheduling-agents-race-publish-time",
    failureClass: "parallel_write_conflict",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "blocked",
    baselineNotes:
      "Baseline let concurrent content and scheduling agents write conflicting publish times for the same post.",
    substrateNotes:
      "Substrate serialized the competing writes through task lineage, idempotency, and terminal outcome evidence.",
  },
  {
    scenarioId: "report-generated-without-next-action-loop",
    failureClass: "feedback_disconnection",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "accepted",
    baselineNotes:
      "Baseline generated the report but lost the feedback loop into a durable next marketing action.",
    substrateNotes:
      "Substrate converted the generated report and metrics evidence into a governed next-action proposal.",
  },
  {
    scenarioId: "amnesiac-agent-resumes-without-campaign-ledger",
    failureClass: "continuity_break",
    baselineTerminalOutcome: "accepted",
    substrateTerminalOutcome: "accepted",
    baselineNotes:
      "Baseline resumed the campaign from prompt memory and lost the latest approval, metrics, and report context.",
    substrateNotes:
      "Substrate restored campaign context from durable events, report evidence, and next-action state before continuing.",
  },
] as const satisfies readonly MarketingAxisBCoreScenarioSpec[];

function anchorAbsolutePath(
  anchor: MarketingAxisBAnchor,
  options: {
    readonly workspaceRoot: string;
    readonly sourcePath: string;
  },
): string {
  const { workspaceRoot, sourcePath } = options;
  const base =
    anchor.base === "plugged_in_social"
      ? resolve(workspaceRoot, sourcePath)
      : workspaceRoot;
  return resolve(base, anchor.path);
}

export function readMarketingAxisBAnchorAvailability(
  input: MarketingAxisBAnchorAvailabilityInput = {},
): MarketingAxisBAnchorAvailability {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const sourcePath = input.sourcePath ?? MARKETING_AXIS_B_DEFAULT_SOURCE_PATH;
  const present: MarketingAxisBAnchor[] = [];
  const missing: MarketingAxisBAnchor[] = [];

  for (const anchor of MARKETING_AXIS_B_REQUIRED_ANCHORS) {
    const absolutePath = anchorAbsolutePath(anchor, {
      workspaceRoot,
      sourcePath,
    });
    const source = existsSync(absolutePath)
      ? readFileSync(absolutePath, "utf8")
      : undefined;
    if (
      source !== undefined &&
      anchor.requiredContent.every((snippet) => source.includes(snippet))
    ) {
      present.push(anchor);
    } else {
      missing.push(anchor);
    }
  }

  return { sourcePath, present, missing };
}

function evidenceRefForAnchor(anchor: MarketingAxisBAnchor): EvalEvidenceRef {
  return evalEvidenceRef(
    anchor.substrateRef ? "document" : "source_record",
    anchor.id,
    anchor.label,
  );
}

function evidenceRefForManifestRef(ref: MarketingAxisBManifestRef): EvalEvidenceRef {
  return evalEvidenceRef(ref.kind, ref.id, ref.label);
}

function evidenceRefForAdapterRef(ref: MarketingAxisBAdapterRef): EvalEvidenceRef {
  return evalEvidenceRef(ref.kind, ref.id, ref.label);
}

export function buildMarketingAxisBBlockedEval(
  input: MarketingAxisBBlockedInput,
): EvalEvent {
  const sourcePath = input.sourcePath ?? MARKETING_AXIS_B_DEFAULT_SOURCE_PATH;
  const scenarioId =
    input.scenarioId ?? "publish-after-client-approval-revoked";
  const fixtureNote =
    input.acceptedFixtureAuthority === true
      ? "Authoritative agency fixtures are accepted, but no fixture run was supplied for this scenario."
      : "No authoritative agency fixtures have been accepted for this scenario.";

  return evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: input.runId ?? `run_axis_b_blocked_${scenarioId}`,
    agentId: input.agentId ?? "marketing_axis_b_agent",
    scenarioId,
    failureClass: "workflow_invalidation",
    observedAt: input.observedAt,
    source: "pluggedinsocial/source-availability",
    evidenceRefs: [],
    substrateRefs: [],
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: "scaffolded_scenario",
    scenarioResult: "blocked",
    result: "blocked",
    notes: `Blocked: expected PluggedInSocial clone is unavailable at ${sourcePath}. ${fixtureNote}`,
  });
}

export function buildMarketingAxisBIntegrationReadinessEval(
  input: MarketingAxisBIntegrationReadinessInput,
): EvalEvent {
  if (input.manifest !== undefined) {
    const scenarioId = input.scenarioId ?? "axis-b-live-integration-readiness";
    const result = input.manifest.readiness.complete ? "pass" : "blocked";
    const incompleteClosedLoopStages = (input.manifest.closedLoopStages ?? [])
      .filter((stage) => !stage.present)
      .map((stage) => stage.stage);
    const closedLoopNote =
      incompleteClosedLoopStages.length > 0
        ? ` closed-loop stages incomplete: ${incompleteClosedLoopStages.join(", ")}.`
        : " closed-loop stages complete.";

    return evalEvent({
      tenantId: input.tenantId,
      axis: "marketing",
      runId: input.runId ?? `run_axis_b_live_${scenarioId}`,
      agentId: input.agentId ?? "marketing_axis_b_agent",
      scenarioId,
      failureClass: "workflow_invalidation",
      observedAt: input.observedAt,
      source: "plugged_in_social/source-manifest",
      evidenceRefs: input.manifest.evidenceRefs.map(evidenceRefForManifestRef),
      substrateRefs: input.manifest.substrateRefs.map(evidenceRefForManifestRef),
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge: "workflow_rebase",
      mastCategory: "task_verification",
      coordinationClass: "authority_gated_transition",
      evidenceStage: result === "pass" ? "live_run" : "detected_warning",
      scenarioResult: result,
      result,
      notes:
        result === "pass"
          ? `Axis B source manifest ready at ${input.manifest.sourcePath}.${closedLoopNote}`
          : `Blocked: source manifest missing required integration evidence at ${input.manifest.sourcePath}: ${input.manifest.readiness.missing.join(", ")}.${closedLoopNote}`,
    });
  }

  const availability =
    input.availability ??
    readMarketingAxisBAnchorAvailability(
      input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath },
    );
  const scenarioId = input.scenarioId ?? "axis-b-live-integration-readiness";
  const missingIds = availability.missing.map((anchor) => anchor.id);
  const result = missingIds.length === 0 ? "pass" : "blocked";
  const evidenceRefs = availability.present
    .filter((anchor) => !anchor.substrateRef)
    .map(evidenceRefForAnchor);
  const substrateRefs = availability.present
    .filter((anchor) => anchor.substrateRef)
    .map(evidenceRefForAnchor);

  return evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: input.runId ?? `run_axis_b_live_${scenarioId}`,
    agentId: input.agentId ?? "marketing_axis_b_agent",
    scenarioId,
    failureClass: "workflow_invalidation",
    observedAt: input.observedAt,
    source: "plugged_in_social/live-axis-b-integration",
    evidenceRefs,
    substrateRefs,
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: result === "pass" ? "live_run" : "detected_warning",
    scenarioResult: result,
    result,
    notes:
      result === "pass"
        ? `Axis B live integration anchors present at ${availability.sourcePath}.`
      : `Blocked: missing Axis B integration anchors at ${availability.sourcePath}: ${missingIds.join(", ")}.`,
  });
}

export function buildMarketingAxisBNextActionAdapterEval(
  input: MarketingAxisBNextActionAdapterEvalInput,
): EvalEvent {
  const scenarioId = input.scenarioId ?? "axis-b-next-action-adapter";
  const adapterResult = input.adapterResult;
  const result =
    adapterResult.ready && adapterResult.terminalOutcome === "accepted"
      ? "pass"
      : "blocked";
  const issueNote =
    adapterResult.issues.length > 0
      ? ` issues: ${adapterResult.issues.join(", ")}.`
      : "";
  const actionNote =
    adapterResult.actionId === undefined
      ? ""
      : ` actionId=${adapterResult.actionId}.`;

  return evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: input.runId ?? `run_axis_b_live_${scenarioId}`,
    agentId: input.agentId ?? "marketing_axis_b_agent",
    scenarioId,
    failureClass: "feedback_disconnection",
    observedAt: input.observedAt,
    source: "plugged_in_social/axis-b-next-action-adapter",
    evidenceRefs: adapterResult.evidenceRefs.map(evidenceRefForAdapterRef),
    substrateRefs: adapterResult.substrateRefs.map(evidenceRefForAdapterRef),
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: result === "pass" ? "live_run" : "detected_warning",
    scenarioResult: result,
    operationalTerminalOutcome: adapterResult.terminalOutcome,
    result,
    notes:
      result === "pass"
        ? `Axis B next-action adapter accepted a governed proposal from ${adapterResult.sourcePath}.${actionNote}`
        : `Blocked: Axis B next-action adapter did not admit a governed proposal from ${adapterResult.sourcePath}; terminalOutcome=${adapterResult.terminalOutcome}.${actionNote}${issueNote}`,
  });
}

export function buildMarketingAxisBLiveRunEvidenceEval(
  input: MarketingAxisBLiveRunEvidenceEvalInput,
): EvalEvent {
  const scenarioId = input.scenarioId ?? "axis-b-live-run-evidence";
  const adapterResult = input.adapterResult;
  const result =
    adapterResult.ready && adapterResult.terminalOutcome === "accepted"
      ? "pass"
      : "blocked";
  const issueNote =
    adapterResult.issues.length > 0
      ? ` issues: ${adapterResult.issues.join(", ")}.`
      : "";
  const actionNote =
    adapterResult.actionId === undefined
      ? ""
      : ` actionId=${adapterResult.actionId}.`;
  const observedRunId =
    adapterResult.runId === undefined ? "" : ` observedRun=${adapterResult.runId}.`;
  const substrateRefs = adapterResult.substrateRefs.map(evidenceRefForAdapterRef);
  const terminalOutcomeRef = evalEvidenceRef(
    "action_outcome_envelope",
    adapterResult.actionId ??
      `plugged_in_social:axis_b:${scenarioId}:live_run_evidence_outcome`,
    "PluggedInSocial live run evidence adapter outcome",
  );

  return evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: input.runId ?? `run_axis_b_live_${scenarioId}`,
    agentId: input.agentId ?? "marketing_axis_b_agent",
    scenarioId,
    failureClass: "continuity_break",
    observedAt: input.observedAt,
    source: "plugged_in_social/axis-b-live-run-evidence-adapter",
    evidenceRefs: adapterResult.evidenceRefs.map(evidenceRefForAdapterRef),
    substrateRefs: substrateRefs.some((ref) => ref.kind === "action_outcome_envelope")
      ? substrateRefs
      : [...substrateRefs, terminalOutcomeRef],
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "append_only_observation",
    evidenceStage: result === "pass" ? "live_run" : "detected_warning",
    scenarioResult: result,
    operationalTerminalOutcome: adapterResult.terminalOutcome,
    result,
    notes:
      result === "pass"
        ? `Axis B live run evidence adapter accepted durable run evidence from ${adapterResult.sourcePath}.${observedRunId}${actionNote}`
        : `Blocked: Axis B live run evidence adapter did not admit durable run evidence from ${adapterResult.sourcePath}; terminalOutcome=${adapterResult.terminalOutcome}.${observedRunId}${actionNote}${issueNote}`,
  });
}

export function buildMarketingAxisBLiveIntegrationSuite(
  input: MarketingAxisBLiveIntegrationSuiteInput,
): MarketingAxisBLiveIntegrationSuite {
  const events = [
    buildMarketingAxisBIntegrationReadinessEval({
      tenantId: input.tenantId,
      observedAt: input.observedAt,
      manifest: input.manifest,
      ...(input.readinessScenarioId !== undefined
        ? { scenarioId: input.readinessScenarioId }
        : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    }),
    ...(input.liveRunEvidenceAdapterResult === undefined
      ? []
      : [
          buildMarketingAxisBLiveRunEvidenceEval({
            tenantId: input.tenantId,
            observedAt: input.observedAt,
            adapterResult: input.liveRunEvidenceAdapterResult,
            ...(input.liveRunEvidenceScenarioId !== undefined
              ? { scenarioId: input.liveRunEvidenceScenarioId }
              : {}),
            ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
          }),
        ]),
    buildMarketingAxisBNextActionAdapterEval({
      tenantId: input.tenantId,
      observedAt: input.observedAt,
      adapterResult: input.nextActionAdapterResult,
      ...(input.nextActionScenarioId !== undefined
        ? { scenarioId: input.nextActionScenarioId }
        : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    }),
    ...(input.pairedScenarios ?? []).flatMap((scenario) => scenario.events),
  ];

  return {
    source: {
      sourceId: input.sourceId ?? "axis-b-plugged-in-social-live",
      axis: "marketing",
      label: input.sourceLabel ?? "PluggedInSocial live Axis B integration",
      eventCount: events.length,
    },
    events,
  };
}

export function buildMarketingAxisBPairedScenario(
  input: MarketingAxisBPairedScenarioInput,
): MarketingAxisBPairedScenario {
  const pairedRunGroup = `pair_axis_b_${input.scenarioId}`;
  const runIdPrefix = input.runIdPrefix ?? "run_axis_b_pair";
  const agentId = input.agentId ?? "marketing_axis_b_agent";
  const source = input.source ?? "plugged_in_social/axis-b-paired-scenario";
  const evidenceRefs = input.evidenceRefs.map(evidenceRefForAdapterRef);
  const baselineOutcomeRef = evalEvidenceRef(
    "action_outcome_envelope",
    `plugged_in_social:axis_b:${input.scenarioId}:baseline:action_outcome`,
    "Baseline marketing action outcome",
  );
  const substrateOutcomeRef = evalEvidenceRef(
    "action_outcome_envelope",
    `plugged_in_social:axis_b:${input.scenarioId}:substrate:action_outcome`,
    "Substrate-governed marketing action outcome",
  );

  const baseline = evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: `${runIdPrefix}_${input.scenarioId}_baseline`,
    agentId,
    scenarioId: input.scenarioId,
    failureClass: input.failureClass,
    observedAt: input.observedAt,
    source,
    evidenceRefs,
    substrateRefs: [
      evalEvidenceRef(
        "document",
        `plugged_in_social:axis_b:${input.scenarioId}:baseline:no_governed_rebase`,
        "Baseline source-only marketing operation",
      ),
      baselineOutcomeRef,
    ],
    runArm: "baseline",
    pairedRunGroup,
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: "paired_behavioral_improvement",
    scenarioResult: "fail",
    operationalTerminalOutcome: input.baselineTerminalOutcome,
    result: "fail",
    notes:
      input.baselineNotes ??
      "Baseline marketing operation proceeded without rebasing approval, content hash, and workflow authority state.",
  });
  const substrate = evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: `${runIdPrefix}_${input.scenarioId}_substrate`,
    agentId,
    scenarioId: input.scenarioId,
    failureClass: input.failureClass,
    observedAt: input.observedAt,
    source,
    evidenceRefs,
    substrateRefs: [
      ...input.substrateRefs.map(evidenceRefForAdapterRef),
      evalEvidenceRef(
        "workflow_run",
        `plugged_in_social:axis_b:${input.scenarioId}:governed_rebase`,
        "Substrate-governed marketing workflow rebase",
      ),
      substrateOutcomeRef,
    ],
    runArm: "substrate",
    pairedRunGroup,
    stateBenchCategory: "stateful",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: "paired_behavioral_improvement",
    scenarioResult: "pass",
    operationalTerminalOutcome: input.substrateTerminalOutcome,
    result: "pass",
    notes:
      input.substrateNotes ??
      "Substrate-governed marketing operation rebased against tenant, approval, capability, and content-hash evidence before allowing the transition.",
  });

  return {
    pairedRunGroup,
    events: [baseline, substrate],
    summary: {
      scenarioId: input.scenarioId,
      failureClass: input.failureClass,
      baselineResult: baseline.result,
      substrateResult: substrate.result,
      improvement: scoreMarketingResult(baseline.result) -
        scoreMarketingResult(substrate.result),
    },
  };
}

function scoreMarketingResult(result: EvalResult): number {
  return result === "fail" ? 1 : result === "blocked" ? 0.5 : 0;
}

export function buildMarketingAxisBCorePairedScenarios(
  input: MarketingAxisBCorePairedScenariosInput,
): readonly MarketingAxisBPairedScenario[] {
  return MARKETING_AXIS_B_CORE_SCENARIO_SPECS.map((spec) =>
    buildMarketingAxisBPairedScenario({
      tenantId: input.tenantId,
      observedAt: input.observedAt,
      scenarioId: spec.scenarioId,
      failureClass: spec.failureClass,
      evidenceRefs: input.evidenceRefs,
      substrateRefs: input.substrateRefs,
      baselineTerminalOutcome: spec.baselineTerminalOutcome,
      substrateTerminalOutcome: spec.substrateTerminalOutcome,
      baselineNotes: spec.baselineNotes,
      substrateNotes: spec.substrateNotes,
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.runIdPrefix !== undefined ? { runIdPrefix: input.runIdPrefix } : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    }),
  );
}
