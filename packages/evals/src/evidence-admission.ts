import { tenantId, timestamp, type TenantId, type Timestamp } from "@pm/types";
import {
  evaluateStateReviewInvariantPolicy,
  reviewExternalStateEvidence,
  stateRef,
  type EvidenceAdmissionContext,
  type EvidenceAdmissionDecision,
  type EvidenceAdmissionIssueCode,
  type EvidenceAdmissionReview,
  type ExternalStateEvidence,
  type ExternalStateEvidenceKind,
  type StateReviewArtifact,
  type StateReviewInvariantClass,
} from "@pm/agent-state";

/**
 * Deterministic external-evidence admission fixture corpus (research frontier
 * items 1-5, 12-20). Each fixture pairs one piece of external evidence with an
 * admission context and the expected decision/issue codes, so the admission
 * contract is exercised without any live MCP server, vendor API, store, or
 * database (pure, replayable, ArrowHedge-flavored).
 */

export interface EvidenceAdmissionFixture {
  readonly fixtureId: string;
  /** Which research frontier / ledger claim the fixture proves. */
  readonly frontierRef: string;
  readonly evidence: ExternalStateEvidence;
  readonly context: EvidenceAdmissionContext;
  readonly expectedDecision: EvidenceAdmissionDecision;
  readonly expectedIssueCodes: readonly EvidenceAdmissionIssueCode[];
  /** Monitoring fixtures: when the awaited condition became true and when the agent acted (frontier item 5). */
  readonly monitoring?: {
    readonly conditionMetAt: Timestamp;
    readonly actionProposedAt: Timestamp;
  };
  readonly notes: string;
}

export interface EvidenceAdmissionFixtureResult {
  readonly fixtureId: string;
  readonly frontierRef: string;
  readonly review: EvidenceAdmissionReview;
  readonly expectedDecision: EvidenceAdmissionDecision;
  readonly decisionMatches: boolean;
  readonly missingExpectedIssueCodes: readonly EvidenceAdmissionIssueCode[];
  readonly unexpectedIssueCodes: readonly EvidenceAdmissionIssueCode[];
  readonly passed: boolean;
}

export interface EvidenceAdmissionFixtureCorpusInput {
  readonly tenantId?: TenantId;
  readonly evaluatedAt?: Timestamp;
}

export interface EvidenceAdmissionReviewCorpus {
  readonly fixtures: readonly EvidenceAdmissionFixture[];
  readonly results: readonly EvidenceAdmissionFixtureResult[];
  readonly reviews: readonly EvidenceAdmissionReview[];
  readonly jsonl: string;
}

const DEFAULT_TENANT = tenantId("tnt_arrowhedge_fixtures");
const DEFAULT_EVALUATED_AT = timestamp("2026-06-10T16:00:00.000Z");

export function buildEvidenceAdmissionFixtureCorpus(
  input: EvidenceAdmissionFixtureCorpusInput = {},
): readonly EvidenceAdmissionFixture[] {
  const t = input.tenantId ?? DEFAULT_TENANT;
  const evaluatedAt = input.evaluatedAt ?? DEFAULT_EVALUATED_AT;
  const subject = stateRef("projection", "arrowhedge_cop:NVDA", "NVDA COP");
  const fresh = timestamp("2026-06-10T15:55:00.000Z");
  const freshUntil = timestamp("2026-06-10T16:30:00.000Z");
  const expired = timestamp("2026-06-10T15:59:00.000Z");

  const base = (
    fixtureId: string,
    kind: ExternalStateEvidenceKind,
    source: string,
    overrides: Partial<ExternalStateEvidence> = {},
  ): ExternalStateEvidence => ({
    tenantId: t,
    evidenceId: `ev_${fixtureId}`,
    kind,
    source,
    subject,
    refs: [stateRef("event", `evt_${fixtureId}`)],
    observedAt: fresh,
    validUntil: freshUntil,
    collectedBy: "agent:dexter",
    collectedAt: fresh,
    payload: { fixtureId },
    payloadHash: `ph_${fixtureId}`,
    ...overrides,
  });

  const context = (
    overrides: Partial<EvidenceAdmissionContext> = {},
  ): EvidenceAdmissionContext => ({
    tenantId: t,
    evaluatedAt,
    expectedSubject: subject,
    ...overrides,
  });

  const omitPayloadHash = ({
    payloadHash: _omitted,
    ...rest
  }: ExternalStateEvidence): ExternalStateEvidence => rest;

  const omitValidUntil = ({
    validUntil: _omitted,
    ...rest
  }: ExternalStateEvidence): ExternalStateEvidence => rest;

  return [
    {
      fixtureId: "arrowhedge-clean-current-evidence",
      frontierRef: "frontier#4 clean accepted/current baseline",
      evidence: base("clean", "mcp_tool_handle", "mcp://arrowhedge-tools/cop_state"),
      context: context(),
      expectedDecision: "admitted",
      expectedIssueCodes: [],
      notes:
        "Positive metrics baseline: fresh, tenant- and subject-aligned, hashed evidence admits cleanly.",
    },
    {
      fixtureId: "mcp-handle-revalidation",
      frontierRef: "frontier#2 / C028 MCP explicit state handles",
      evidence: base("mcp_handle", "mcp_tool_handle", "mcp://arrowhedge-tools/task_handle", {
        validUntil: expired,
      }),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["stale_evidence"],
      notes:
        "Explicit state handles are addressability, not authority; expired handles must be revalidated before use.",
    },
    {
      fixtureId: "mcp-annotation-authority-claim",
      frontierRef: "frontier#2 / C028 tool annotations are untrusted hints",
      evidence: base("annotation", "tool_annotation", "mcp://arrowhedge-tools/annotations", {
        claimsAuthority: true,
        claimedAuthority: "mcp://arrowhedge-tools",
      }),
      context: context({ trustedAuthorities: ["arrowhedge:backtest"] }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["authority_claim_downgraded", "untrusted_authority"],
      notes: "Annotation asserting authority is downgraded to evidence-only on admission.",
    },
    {
      fixtureId: "memory-deletion-residue",
      frontierRef: "frontier#3 / C026 observability-safe memory retention",
      evidence: omitPayloadHash(
        base("memory", "memory_retrieval", "agentcore://memory/long_term", {
          memory: {
            sourceModality: "chat_history",
            deletionResidueRisk: "high",
            staleInformationRisk: "high",
          },
        }),
      ),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: [
        "memory_retention_metadata_missing",
        "memory_deletion_residue_risk",
        "memory_stale_information_risk",
        "unverifiable_payload_integrity",
      ],
      notes:
        "Memory evidence without retention policy, with deletion residue and stale-information risk, is admitted only with explicit warnings.",
    },
    {
      fixtureId: "monitoring-wait-condition",
      frontierRef: "frontier#5 monitoring/no-op wait condition",
      evidence: base("monitor", "monitoring_event", "arrowhedge://monitor/price_threshold", {
        payload: { condition: "NVDA price > 1300", conditionMet: true },
      }),
      context: context(),
      expectedDecision: "admitted",
      expectedIssueCodes: [],
      monitoring: {
        conditionMetAt: timestamp("2026-06-10T15:50:00.000Z"),
        actionProposedAt: timestamp("2026-06-10T15:49:00.000Z"),
      },
      notes:
        "Premature action: the agent proposed before the awaited condition was met; reaction metrics capture it.",
    },
    {
      fixtureId: "approval-currentness-drift",
      frontierRef: "frontier#17 / C032 approval bound to current revision/hash/scope",
      evidence: base("approval", "approval_record", "gdrive://approvals/decision_memo", {
        approval: {
          approvedRevision: "rev_12",
          approvedContentHash: "hash_a1",
          approvedScope: "portfolio.decision.accept",
          approvedBy: "user:emmanuel",
        },
      }),
      context: context({
        currentApproval: {
          revision: "rev_14",
          contentHash: "hash_b9",
          scope: "portfolio.decision.accept",
        },
      }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: [
        "approval_revision_mismatch",
        "approval_content_hash_mismatch",
      ],
      notes:
        "Approval state drifted from current content; the action must re-review before relying on the stale approval.",
    },
    {
      fixtureId: "provider-policy-drift",
      frontierRef: "frontier#15/#18 / C023 provider policy + policy-version drift",
      evidence: base("policy", "provider_policy", "provider://model_policy/fable-5", {
        providerPolicy: {
          policyVersion: "retention_v2",
          zeroDataRetention: false,
          adminEnabled: true,
          providerSurface: "github-copilot",
          allowedDataClasses: ["public"],
        },
      }),
      context: context({
        currentPolicyVersion: "retention_v3",
        sensitiveDataClasses: ["regulated_financial"],
      }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["policy_version_drift", "sensitive_data_class_blocked"],
      notes:
        "Model/provider policy evidence is action-review context; drifted versions and blocked data classes warn before action.",
    },
    {
      fixtureId: "external-validation-security-review",
      frontierRef: "frontier#14 / C022, C031 validation evidence cannot override review",
      evidence: base("validation", "external_validation", "github://copilot-cli/security-review", {
        validation: {
          validationType: "security_review",
          outcome: "passed",
          findingCount: 0,
        },
        clientSurface: "copilot-cli",
      }),
      context: context(),
      expectedDecision: "admitted",
      expectedIssueCodes: [],
      notes:
        "Third-party validation results are admitted as supporting evidence; they never replace current-state/read-set/authority review.",
    },
    {
      fixtureId: "custom-store-unhashed",
      frontierRef: "frontier#19 / C035 custom stores are evidence producers",
      evidence: omitPayloadHash(
        base("store", "custom_store_record", "cursor://custom_store/session_notes", {
          clientSurface: "cursor",
        }),
      ),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["unverifiable_payload_integrity"],
      notes:
        "Coding-agent custom-store output without integrity hash cannot be re-verified on replay.",
    },
    {
      fixtureId: "subagent-output-stale",
      frontierRef: "frontier#19 / C035 nested subagent outputs",
      evidence: base("subagent", "subagent_output", "cursor://subagent/researcher", {
        validUntil: expired,
        clientSurface: "cursor",
      }),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["stale_evidence"],
      notes: "Nested subagent output must be fresh before it can inform action review.",
    },
    {
      fixtureId: "runtime-obo-provenance-mismatch",
      frontierRef: "frontier#6/#20 provenance-vs-authorization alignment",
      evidence: base("obo", "identity_on_behalf_of", "agentcore://identity/obo", {
        identity: {
          actorId: "agent:dexter",
          onBehalfOf: "user:emmanuel",
          authorizedIntent: "graph/portfolio",
          actualSourcePath: "registry/capabilities",
        },
      }),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["provenance_authorization_mismatch"],
      notes:
        "Actual access path diverges from authorized intent; provenance and authorization graphs disagree.",
    },
    {
      fixtureId: "workflow-stage-omission",
      frontierRef: "frontier#8 / C027 long-horizon stage omission",
      evidence: base("trace", "workflow_trace", "arrowhedge://workflow/research_run", {
        workflowTrace: {
          workflowRunId: "run_nvda_007",
          stages: ["signal", "decision"],
          gateOutcomes: { risk_gate: "failed" },
        },
      }),
      context: context({ expectedWorkflowStages: ["signal", "risk", "decision"] }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["workflow_stage_omitted", "workflow_gate_failed"],
      notes:
        "Workflow trace omits the risk stage and reports a failed gate; final output alone cannot prove run validity.",
    },
    {
      fixtureId: "pm-handoff-incomplete",
      frontierRef: "frontier#10 / C030 typed handoff owners",
      evidence: base("handoff", "pm_handoff", "arrowhedge://handoffs/analyst_to_pm", {
        pmHandoff: {
          expertiseOwner: "analyst:alice",
          unresolvedRisks: ["position sizing unreviewed"],
          validNextActions: ["portfolio.decision.review"],
        },
      }),
      context: context(),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["pm_handoff_incomplete"],
      notes:
        "Handoffs need expertise owner, source steward, and escalation owner before the next actor can act safely.",
    },
    {
      fixtureId: "servicenow-governed-action-comparator",
      frontierRef: "frontier#12 ServiceNow governed-action comparator",
      evidence: base("snow", "gateway_request", "servicenow://change/deploy_request", {
        claimsAuthority: true,
        approval: {
          approvedRevision: "chg_900",
          approvedScope: "deploy.production",
        },
      }),
      context: context({
        currentApproval: { revision: "chg_900", scope: "deploy.production" },
      }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["authority_claim_downgraded"],
      notes:
        "Vendor governed-action records are admitted as evidence with approval currentness checked, but never as substrate authority.",
    },
    {
      fixtureId: "competitor-slack-crm-write",
      frontierRef: "frontier#13 competitor-inspired Slack/CRM write",
      evidence: base("slack", "audit_event", "slack://salesforce/crm_write", {
        claimedAuthority: "slack:workspace",
        clientSurface: "slack",
      }),
      context: context({ trustedAuthorities: ["arrowhedge:backtest"] }),
      expectedDecision: "admitted_with_warnings",
      expectedIssueCodes: ["untrusted_authority"],
      notes:
        "Workspace-originated CRM writes carry workspace authority that is not the tenant's source-of-truth authority.",
    },
    {
      fixtureId: "competitor-coding-session-resume",
      frontierRef: "frontier#13/#16 coding-session resume with client surface",
      evidence: base("session", "runtime_trace", "github://copilot/session_resume", {
        clientSurface: "copilot-app",
        provider: "github",
      }),
      context: context(),
      expectedDecision: "admitted",
      expectedIssueCodes: [],
      notes:
        "Resumed coding-agent session traces admit cleanly when fresh and tenant-aligned; client surface is recorded separately from authority (C024).",
    },
    {
      fixtureId: "cross-tenant-rejection",
      frontierRef: "admission contract negative lane (tenant boundary)",
      evidence: base("xtenant", "lineage_record", "openlineage://runs/ingest", {
        tenantId: tenantId("tnt_other_org"),
      }),
      context: context(),
      expectedDecision: "rejected",
      expectedIssueCodes: ["tenant_mismatch"],
      notes: "Cross-tenant evidence is rejected outright; tenancy is not advisory.",
    },
    {
      fixtureId: "future-dated-evidence-rejection",
      frontierRef: "admission contract negative lane (freshness)",
      evidence: omitValidUntil(
        base("future", "attestation", "intoto://attestations/build", {
          observedAt: timestamp("2026-07-28T00:00:00.000Z"),
        }),
      ),
      context: context(),
      expectedDecision: "rejected",
      expectedIssueCodes: ["future_observed_at"],
      notes:
        "Evidence claiming observation in the future cannot be admitted; citation-style future-dating is an integrity failure.",
    },
  ];
}

export function runEvidenceAdmissionFixtures(
  fixtures: readonly EvidenceAdmissionFixture[] = buildEvidenceAdmissionFixtureCorpus(),
): readonly EvidenceAdmissionFixtureResult[] {
  return fixtures.map((fixture) => {
    const review = reviewExternalStateEvidence(fixture.evidence, fixture.context);
    const actualCodes = new Set(review.issues.map((issue) => issue.code));
    const expectedCodes = new Set(fixture.expectedIssueCodes);
    const missingExpectedIssueCodes = fixture.expectedIssueCodes.filter(
      (code) => !actualCodes.has(code),
    );
    const unexpectedIssueCodes = [...actualCodes].filter(
      (code) => !expectedCodes.has(code),
    );
    const decisionMatches = review.decision === fixture.expectedDecision;
    return {
      fixtureId: fixture.fixtureId,
      frontierRef: fixture.frontierRef,
      review,
      expectedDecision: fixture.expectedDecision,
      decisionMatches,
      missingExpectedIssueCodes,
      unexpectedIssueCodes,
      passed:
        decisionMatches &&
        missingExpectedIssueCodes.length === 0 &&
        unexpectedIssueCodes.length === 0,
    };
  });
}

export function serializeEvidenceAdmissionReviewsJsonl(
  reviews: readonly EvidenceAdmissionReview[],
): string {
  return `${reviews.map((review) => JSON.stringify(review)).join("\n")}\n`;
}

export function buildEvidenceAdmissionReviewCorpus(
  input: EvidenceAdmissionFixtureCorpusInput = {},
): EvidenceAdmissionReviewCorpus {
  const fixtures = buildEvidenceAdmissionFixtureCorpus(input);
  const results = runEvidenceAdmissionFixtures(fixtures);
  const reviews = results.map((result) => result.review);

  return {
    fixtures,
    results,
    reviews,
    jsonl: serializeEvidenceAdmissionReviewsJsonl(reviews),
  };
}

export interface EvidenceAdmissionMetrics {
  readonly totalFixtures: number;
  readonly passedFixtures: number;
  readonly fixturePassRate: number;
  readonly decisions: Readonly<Record<EvidenceAdmissionDecision, number>>;
  readonly byKind: Readonly<Record<string, number>>;
  readonly issueCodeCounts: Readonly<Record<string, number>>;
  readonly invariantClassCounts: Readonly<Record<string, number>>;
  readonly wouldBlockAtHighConsequence: number;
  readonly allEvidenceOnly: boolean;
  /** PM distributed-state lane (frontier item 10). */
  readonly pmHandoffCount: number;
  readonly pmHandoffIncompleteCount: number;
  /** Monitoring lane (frontier item 5). */
  readonly prematureActionCount: number;
  readonly meanReactionTimeMs?: number;
}

export function analyzeEvidenceAdmissionFixtureResults(
  results: readonly EvidenceAdmissionFixtureResult[],
  fixtures: readonly EvidenceAdmissionFixture[] = buildEvidenceAdmissionFixtureCorpus(),
): EvidenceAdmissionMetrics {
  const decisions: Record<EvidenceAdmissionDecision, number> = {
    admitted: 0,
    admitted_with_warnings: 0,
    rejected: 0,
  };
  const byKind: Record<string, number> = {};
  const issueCodeCounts: Record<string, number> = {};
  const invariantClassCounts: Record<string, number> = {};
  let wouldBlockAtHighConsequence = 0;
  let allEvidenceOnly = true;
  let pmHandoffCount = 0;
  let pmHandoffIncompleteCount = 0;
  let prematureActionCount = 0;
  const reactionTimes: number[] = [];
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.fixtureId, fixture]));

  for (const result of results) {
    const review = result.review;
    decisions[review.decision] += 1;
    byKind[review.evidence.kind] = (byKind[review.evidence.kind] ?? 0) + 1;
    for (const issue of review.issues) {
      issueCodeCounts[issue.code] = (issueCodeCounts[issue.code] ?? 0) + 1;
    }
    for (const invariantClass of review.invariantClasses) {
      invariantClassCounts[invariantClass] =
        (invariantClassCounts[invariantClass] ?? 0) + 1;
    }
    if (
      review.invariantClasses.length > 0 &&
      evaluateStateReviewInvariantPolicy(review.invariantClasses, "high").wouldBlock
    ) {
      wouldBlockAtHighConsequence += 1;
    }
    if (review.authorityStatus !== "evidence_only") {
      allEvidenceOnly = false;
    }
    if (review.evidence.kind === "pm_handoff") {
      pmHandoffCount += 1;
      if (review.issues.some((issue) => issue.code === "pm_handoff_incomplete")) {
        pmHandoffIncompleteCount += 1;
      }
    }
    const monitoring = fixtureById.get(result.fixtureId)?.monitoring;
    if (monitoring !== undefined) {
      const delta =
        Date.parse(monitoring.actionProposedAt) -
        Date.parse(monitoring.conditionMetAt);
      if (delta < 0) {
        prematureActionCount += 1;
      } else {
        reactionTimes.push(delta);
      }
    }
  }

  const passedFixtures = results.filter((result) => result.passed).length;
  return {
    totalFixtures: results.length,
    passedFixtures,
    fixturePassRate: results.length === 0 ? 1 : passedFixtures / results.length,
    decisions,
    byKind,
    issueCodeCounts,
    invariantClassCounts,
    wouldBlockAtHighConsequence,
    allEvidenceOnly,
    pmHandoffCount,
    pmHandoffIncompleteCount,
    prematureActionCount,
    ...(reactionTimes.length > 0
      ? {
          meanReactionTimeMs:
            reactionTimes.reduce((sum, value) => sum + value, 0) /
            reactionTimes.length,
        }
      : {}),
  };
}

/**
 * Trajectory-level artifact run groups (research frontier item 8): group
 * state-review artifacts by `metadata.runGroupId` and surface failure
 * hypotheses that only appear across artifacts - repeated warning codes
 * (error propagation), invalid-step counts (objective drift proxies), and
 * temporal-phase coverage per run.
 */
export interface StateReviewArtifactRunGroup {
  readonly runGroupId: string;
  readonly artifactIds: readonly string[];
  readonly artifactCount: number;
  readonly agents: readonly string[];
  readonly invalidArtifactCount: number;
  readonly warningCodeCounts: Readonly<Record<string, number>>;
  /** Warning codes appearing in more than one artifact of the group (error-propagation signal). */
  readonly propagatedWarningCodes: readonly string[];
  readonly temporalPhases: readonly string[];
  readonly invariantClasses: readonly StateReviewInvariantClass[];
}

export function groupStateReviewArtifactsByRunGroup(
  artifacts: readonly StateReviewArtifact[],
): readonly StateReviewArtifactRunGroup[] {
  const groups = new Map<string, StateReviewArtifact[]>();
  for (const artifact of artifacts) {
    const runGroupId = artifact.metadata.runGroupId;
    if (runGroupId === undefined) continue;
    const bucket = groups.get(runGroupId) ?? [];
    bucket.push(artifact);
    groups.set(runGroupId, bucket);
  }

  return [...groups.entries()].map(([runGroupId, groupArtifacts]) => {
    const warningCodeCounts: Record<string, number> = {};
    const warningCodeArtifacts: Record<string, Set<string>> = {};
    const agents = new Set<string>();
    const temporalPhases = new Set<string>();
    const invariantClasses = new Set<StateReviewInvariantClass>();
    let invalidArtifactCount = 0;

    for (const artifact of groupArtifacts) {
      agents.add(artifact.provenance.associatedAgent);
      temporalPhases.add(artifact.metadata.temporalMisalignmentPhase);
      for (const invariantClass of artifact.metadata.invariantClasses) {
        invariantClasses.add(invariantClass);
      }
      if (!artifact.review.valid) invalidArtifactCount += 1;
      for (const warning of artifact.review.warnings) {
        warningCodeCounts[warning.code] = (warningCodeCounts[warning.code] ?? 0) + 1;
        const artifactSet = warningCodeArtifacts[warning.code] ?? new Set<string>();
        artifactSet.add(artifact.artifactId);
        warningCodeArtifacts[warning.code] = artifactSet;
      }
    }

    return {
      runGroupId,
      artifactIds: groupArtifacts.map((artifact) => artifact.artifactId),
      artifactCount: groupArtifacts.length,
      agents: [...agents],
      invalidArtifactCount,
      warningCodeCounts,
      propagatedWarningCodes: Object.entries(warningCodeArtifacts)
        .filter(([, artifactSet]) => artifactSet.size > 1)
        .map(([code]) => code),
      temporalPhases: [...temporalPhases],
      invariantClasses: [...invariantClasses],
    };
  });
}

/**
 * Role-specific projections over a stable artifact invariant core (research
 * frontier item 9). Every role sees the same invariant core; the lens differs.
 */
export type StateReviewArtifactRole = "risk_officer" | "project_manager" | "auditor";

export interface StateReviewArtifactInvariantCore {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly schemaVersion: string;
  readonly generatedAt: Timestamp;
  readonly reviewId: string;
  readonly tenantId: TenantId;
  readonly valid: boolean;
  readonly warningCount: number;
}

export interface StateReviewArtifactRoleProjection {
  readonly role: StateReviewArtifactRole;
  readonly core: StateReviewArtifactInvariantCore;
  readonly view: Readonly<Record<string, unknown>>;
}

export function projectStateReviewArtifactForRole(
  artifact: StateReviewArtifact,
  role: StateReviewArtifactRole,
): StateReviewArtifactRoleProjection {
  const core: StateReviewArtifactInvariantCore = {
    artifactId: artifact.artifactId,
    artifactHash: artifact.artifactHash,
    schemaVersion: artifact.schemaVersion,
    generatedAt: artifact.generatedAt,
    reviewId: artifact.review.reviewId,
    tenantId: artifact.review.tenantId,
    valid: artifact.review.valid,
    warningCount: artifact.review.warnings.length,
  };

  switch (role) {
    case "risk_officer":
      return {
        role,
        core,
        view: {
          invariantClasses: artifact.metadata.invariantClasses,
          warningCodes: artifact.review.warnings.map((warning) => warning.code),
          policyAtHighConsequence: evaluateStateReviewInvariantPolicy(
            artifact.metadata.invariantClasses,
            "high",
          ),
          executionDisposition: artifact.review.execution,
        },
      };
    case "project_manager":
      return {
        role,
        core,
        view: {
          actionType: artifact.review.proposedAction.actionType,
          proposedBy: artifact.review.proposedAction.proposedBy,
          workflowPosition: artifact.review.currentStateView.workflowPosition,
          workflowRunId: artifact.metadata.workflowRunId,
          runGroupId: artifact.metadata.runGroupId,
          sessionId: artifact.metadata.sessionId,
          temporalMisalignmentPhase: artifact.metadata.temporalMisalignmentPhase,
        },
      };
    case "auditor":
      return {
        role,
        core,
        view: {
          eventEnvelope: artifact.eventEnvelope,
          provenance: artifact.provenance,
          relatedObjects: artifact.relatedObjects,
          evidenceAdmissions: artifact.metadata.evidenceAdmissions ?? [],
        },
      };
  }
}
