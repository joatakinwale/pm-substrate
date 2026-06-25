import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import {
  buildObservationContractFromCurrentStateView,
  buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
  buildActionOutcomeEnvelope,
  buildActionOutcomeProviderAuthority,
  buildActionOutcomeTerminalIndex,
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  compareObservedReadSetToDeclared,
  computeStateReviewArtifactHash,
  admitActionOutcomeEnvelope,
  evaluateStateReviewInvariantPolicy,
  evaluateObservationContract,
  importStateReviewArtifact,
  importStateReviewArtifactsJsonl,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifact,
  serializeStateReviewArtifactsJsonl,
  stateRef,
  validateProposedActionReadSet,
  verifyActionOutcomeEnvelopeHash,
  verifyStateReviewArtifactHash,
  type ActionOutcomeEnvelopeInput,
  type CurrentStateView,
  type ProposedAction,
} from "./index.js";

const t = tenantId("tnt_agent_state");
const signalRef = stateRef("event", "evt_signal", "analyst.signal.created");
const riskRef = stateRef("event", "evt_risk", "risk.state.validated");
const decisionRef = stateRef("event", "evt_decision", "portfolio.decision.proposed");

const baseView = (overrides: Partial<CurrentStateView> = {}): CurrentStateView => ({
  tenantId: t,
  viewId: "view_aapl",
  subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
  observedAt: timestamp("2026-06-03T14:00:00.000Z"),
  validUntil: timestamp("2026-06-03T14:10:00.000Z"),
  authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
  projectionVersion: 1,
  workflowPosition: "decision_pending",
  sourceRefs: [signalRef, riskRef, decisionRef],
  missingSources: [],
  conflicts: [],
  allowedActions: [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept portfolio decision",
      requiredRefs: [signalRef, riskRef, decisionRef],
      requiredWorkflowPosition: "decision_pending",
    },
  ],
  ...overrides,
});

const actionFrom = (
  view: CurrentStateView,
  overrides: Partial<ProposedAction> = {},
): ProposedAction => ({
  tenantId: view.tenantId,
  actionType: "portfolio.decision.accept",
  subject: view.subject,
  payload: { decisionId: "dec_aapl_buy_120" },
  readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
  proposedBy: "agent:portfolio-manager",
  proposedAt: timestamp("2026-06-03T14:05:00.000Z"),
  ...overrides,
});

const actionOutcomeEnvelope = (
  overrides: Partial<ActionOutcomeEnvelopeInput> = {},
) =>
  buildActionOutcomeEnvelope({
    tenantId: t,
    actionId: "action:dec_aapl_buy_120:accept",
    subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
    proposalReviewId: "review:dec_aapl_buy_120",
    stateReviewArtifactHash: "a".repeat(64),
    evidenceAdmissionReviewIds: ["ev:price_window:admission_review"],
    requestedTerminalOutcome: "accepted",
    decidedAt: timestamp("2026-06-03T14:06:00.000Z"),
    decidedBy: "agent:portfolio-manager",
    evidenceRefs: [signalRef, riskRef],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome:dec_aapl_buy_120",
        "AAPL terminal outcome",
      ),
    ],
    ...overrides,
  });

describe("@pm/agent-state read-set validation", () => {
  it("builds provider authority metadata with a status ref bound to the certificate", () => {
    expect(
      buildActionOutcomeProviderAuthority({
        certificateId: "cert_local_lab_terminal_provider",
        certificateDigest: "sha256:local_lab_terminal_provider",
        statusEventHash: "sha256:local_lab_terminal_status_event",
        statusUpdatedAt: timestamp("2026-06-25T18:00:00.000Z"),
        checkedAt: timestamp("2026-06-25T18:01:00.000Z"),
      }),
    ).toEqual({
      providerCertificateId: "cert_local_lab_terminal_provider",
      providerCertificateDigest: "sha256:local_lab_terminal_provider",
      providerCertificateStatusRef: {
        certificateId: "cert_local_lab_terminal_provider",
        certificateDigest: "sha256:local_lab_terminal_provider",
        status: "valid",
        statusSequence: 1,
        statusEventHash: "sha256:local_lab_terminal_status_event",
        statusUpdatedAt: "2026-06-25T18:00:00.000Z",
        checkedAt: "2026-06-25T18:01:00.000Z",
      },
    });
  });

  it("builds read-set entries from every current-state source ref", () => {
    expect(buildReadSetFromCurrentStateView(baseView(), "authority:test")).toEqual([
      {
        ref: signalRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: riskRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: decisionRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
    ]);
  });

  it("accepts a current allowed action with complete refs", () => {
    expect(validateProposedActionReadSet(actionFrom(baseView()), baseView())).toEqual({
      valid: true,
      mode: "warn",
      issues: [],
    });
  });

  it("warns when a proposed action subject differs from the current-state subject", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          subject: stateRef("projection", "arrowhedge_cop:MSFT", "MSFT COP"),
        }),
        view,
      ).issues,
    ).toMatchObject([
      {
        code: "subject_mismatch",
        path: "/subject",
      },
    ]);
  });

  it("warns without blocking when read-set refs are stale", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
        }),
        view,
      ),
    ).toMatchObject({
      valid: false,
      mode: "warn",
      issues: [
        { code: "stale_read_ref", path: "/readSet/0/validUntil" },
        { code: "stale_read_ref", path: "/readSet/1/validUntil" },
        { code: "stale_read_ref", path: "/readSet/2/validUntil" },
      ],
    });
  });

  it("warns for missing required refs, authority drift, projection drift, workflow mismatch, and current conflicts", () => {
    const view = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "decision risk snapshot no longer matches current risk state",
        },
      ],
    });
    const readSet = buildReadSetFromCurrentStateView(baseView(), "other-authority")
      .filter((entry) => entry.ref.id !== riskRef.id);

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          readSet,
        }),
        view,
      ).issues.map((issue) => issue.code),
    ).toEqual([
      "current_view_conflict",
      "missing_read_ref",
      "authority_mismatch",
      "authority_mismatch",
      "projection_version_mismatch",
      "projection_version_mismatch",
      "workflow_position_mismatch",
    ]);
  });

  it("compares declared proposal read sets against observed tool reads without blocking execution", () => {
    const view = baseView();
    const declared = [
      {
        ref: signalRef,
        observedAt: timestamp("2026-06-03T14:00:00.000Z"),
        validUntil: timestamp("2026-06-03T14:10:00.000Z"),
        authority: view.authorityRule,
        projectionVersion: 1,
      },
      {
        ref: riskRef,
        observedAt: timestamp("2026-06-03T14:00:00.000Z"),
        validUntil: timestamp("2026-06-03T14:10:00.000Z"),
        authority: view.authorityRule,
        projectionVersion: 1,
      },
    ];

    const comparison = compareObservedReadSetToDeclared(
      declared,
      [
        {
          ref: signalRef,
          observedAt: timestamp("2026-06-03T13:59:00.000Z"),
          validUntil: timestamp("2026-06-03T14:01:00.000Z"),
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.quote.read",
          source: "broker_snapshot",
        },
        {
          ref: decisionRef,
          observedAt: timestamp("2026-06-03T14:03:00.000Z"),
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.decision.read",
        },
      ],
      view,
      timestamp("2026-06-03T14:05:00.000Z"),
    );

    expect(comparison).toMatchObject({
      valid: false,
      mode: "warn",
      issues: [
        { code: "observed_but_undeclared", path: "/observedReadSet/1/ref" },
        { code: "declared_but_unobserved", path: "/declaredReadSet/1/ref" },
        { code: "stale_observed_read", path: "/observedReadSet/0/validUntil" },
        { code: "authority_mismatch", path: "/observedReadSet/0/authority" },
        {
          code: "projection_version_drift",
          path: "/observedReadSet/0/projectionVersion",
        },
        {
          code: "workflow_position_drift",
          path: "/observedReadSet/0/workflowPosition",
        },
      ],
    });
    expect(comparison.observedReadSet.map((entry) => entry.tool)).toEqual([
      "arrowhedge.quote.read",
      "arrowhedge.decision.read",
    ]);
    expect(comparison.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "observed_but_undeclared",
          observedIndex: 1,
        }),
        expect.objectContaining({
          code: "authority_mismatch",
          declaredIndex: 0,
          observedIndex: 0,
        }),
      ]),
    );
    expect(
      comparison.issues.filter((issue) => issue.path.startsWith("/observedReadSet/1/")),
    ).toHaveLength(1);
    expect(comparison.issues.some((issue) => "observedEntry" in issue)).toBe(false);
    expect(comparison.issues.some((issue) => "declaredEntry" in issue)).toBe(false);
  });

  it("builds an observation contract from a current-state view", () => {
    expect(
      buildObservationContractFromCurrentStateView(
        baseView({
          missingSources: ["risk_state_refresh"],
          conflicts: [
            {
              conflictType: "stale_observation",
              refs: [riskRef],
              message: "risk state expired",
            },
          ],
        }),
      ),
    ).toEqual({
      tenantId: t,
      contractId: "view_aapl:observation_contract",
      subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
      issuedAt: "2026-06-03T14:00:00.000Z",
      observedAt: "2026-06-03T14:00:00.000Z",
      validUntil: "2026-06-03T14:10:00.000Z",
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      projectionVersion: 1,
      workflowPosition: "decision_pending",
      requiredSourceRefs: [signalRef, riskRef, decisionRef],
      declaredMissingSources: ["risk_state_refresh"],
      declaredConflictCount: 1,
    });
  });

  it("evaluates observation contracts into state assertions", () => {
    const contract = buildObservationContractFromCurrentStateView(baseView());
    const changedView = baseView({
      authorityRule: "arrowhedge:paper_quote:latest",
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    expect(
      evaluateObservationContract(
        contract,
        changedView,
        timestamp("2026-06-03T14:11:00.000Z"),
      ).assertions.map((assertion) => ({
        code: assertion.code,
        passed: assertion.passed,
      })),
    ).toEqual([
      { code: "required_source_refs_present", passed: false },
      { code: "authority_rule_matches", passed: false },
      { code: "freshness_window_current", passed: false },
      { code: "projection_version_matches", passed: false },
      { code: "workflow_position_matches", passed: false },
      { code: "conflicts_declared", passed: false },
      { code: "missing_sources_declared", passed: false },
    ]);
  });

  it("reviews a proposed action as a warn-first pre-execution artifact", () => {
    const view = baseView();

    expect(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    ).toMatchObject({
      tenantId: t,
      reviewId: "view_aapl:portfolio.decision.accept:proposal_review",
      mode: "warn",
      valid: true,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
        warningCount: 0,
      },
      readSetValidation: {
        valid: true,
        issues: [],
      },
      observationEvaluation: {
        valid: true,
        currentStateViewId: "view_aapl",
      },
      warnings: [],
    });
  });

  it("keeps stale proposed actions warn-first while surfacing read-set and observation warnings", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    expect(review).toMatchObject({
      mode: "warn",
      valid: false,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
      },
    });
    expect(review.warnings.map((warning) => warning.source)).toEqual([
      "read_set",
      "read_set",
      "read_set",
      "observation_contract",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual([
      "stale_read_ref",
      "stale_read_ref",
      "stale_read_ref",
      "freshness_window_current",
    ]);
  });

  it("can switch to blocking mode without changing the default advisory contract", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        enforcementMode: "blocking",
      },
    );

    expect(review.execution).toMatchObject({
      allowed: false,
      blocking: true,
      enforcementMode: "blocking",
      reason: "blocking_policy_failed",
    });
  });

  it("recommends would-block policy decisions for high-consequence invariant classes without changing advisory review defaults", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    const policy = evaluateStateReviewInvariantPolicy(
      ["freshness_window", "source_authority"],
      "high",
    );

    expect(review.execution).toMatchObject({
      allowed: true,
      blocking: false,
      enforcementMode: "advisory",
      reason: "advisory_warn_first_v1",
    });
    expect(policy).toEqual({
      consequence: "high",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["freshness_window", "source_authority"],
      advisoryInvariantClasses: [],
      decisions: [
        {
          invariantClass: "freshness_window",
          consequence: "high",
          decision: "blocking",
        },
        {
          invariantClass: "source_authority",
          consequence: "high",
          decision: "blocking",
        },
      ],
    });
  });

  it("keeps lower-consequence policy recommendations advisory unless the matrix says otherwise", () => {
    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "projection_version"],
        "low",
      ),
    ).toMatchObject({
      consequence: "low",
      wouldBlock: false,
      wouldBlockInvariantClasses: [],
      advisoryInvariantClasses: ["freshness_window", "projection_version"],
    });

    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "source_authority"],
        "medium",
      ),
    ).toMatchObject({
      consequence: "medium",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["source_authority"],
      advisoryInvariantClasses: ["freshness_window"],
    });

    expect(
      evaluateStateReviewInvariantPolicy(["freshness_window"], "low", {
        freshness_window: {
          low: "blocking",
        },
      }),
    ).toMatchObject({
      consequence: "low",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["freshness_window"],
      advisoryInvariantClasses: [],
    });

    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "tenant_boundary"],
        "high",
        {
          freshness_window: {
            high: "advisory",
          },
        },
      ),
    ).toMatchObject({
      consequence: "high",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["tenant_boundary"],
      advisoryInvariantClasses: ["freshness_window"],
    });
  });

  it("reviews an action against the original observation contract instead of the current view", () => {
    const originalView = baseView();
    const originalContract =
      buildObservationContractFromCurrentStateView(originalView);
    const changedView = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(originalView, {
        observationContract: originalContract,
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      changedView,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        observationContract: originalContract,
      },
    );

    expect(review.observationContract).toEqual(originalContract);
    expect(review.valid).toBe(false);
    expect(review.execution).toMatchObject({
      allowed: true,
      blocking: false,
      enforcementMode: "advisory",
      reason: "advisory_warn_first_v1",
    });
    expect(
      review.observationEvaluation.assertions
        .filter((assertion) => !assertion.passed)
        .map((assertion) => assertion.code),
    ).toEqual([
      "required_source_refs_present",
      "freshness_window_current",
      "projection_version_matches",
      "workflow_position_matches",
      "conflicts_declared",
      "missing_sources_declared",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "current_view_conflict",
        "missing_read_ref",
        "stale_read_ref",
        "projection_version_mismatch",
        "workflow_position_mismatch",
        "required_source_refs_present",
        "freshness_window_current",
      ]),
    );
  });

  it("turns proposal reviews into provenance-linked state-review artifacts", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    const artifact = buildStateReviewArtifact(review, {
      artifactId: "artifact_arrowhedge_review_001",
      source: "evals/arrowhedge",
      traceContext: {
        traceparent:
          "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        spanId: "00f067aa0ba902b7",
      },
      relatedObjects: [
        {
          role: "portfolio_decision",
          ref: stateRef("source_record", "decision:dec_aapl_buy_120"),
        },
      ],
      planId: "portfolio-decision-review-v1",
      actedOnBehalfOf: "tenant:tnt_agent_state",
    });

    expect(artifact).toMatchObject({
      schemaVersion: "state-review-artifact.v1",
      artifactId: "artifact_arrowhedge_review_001",
      eventEnvelope: {
        id: "artifact_arrowhedge_review_001",
        source: "evals/arrowhedge",
        type: "pm.agent_state.action_proposal_reviewed.v1",
        specversion: "1.0",
        subject: "projection:arrowhedge_cop:AAPL",
      },
      provenance: {
        generatedBy: "view_aapl:portfolio.decision.accept:proposal_review",
        associatedAgent: "agent:portfolio-manager",
        actedOnBehalfOf: "tenant:tnt_agent_state",
        planId: "portfolio-decision-review-v1",
      },
    });
    expect(artifact.relatedObjects.map((object) => object.role)).toEqual(
      expect.arrayContaining([
        "primary_subject",
        "action_subject",
        "source_ref",
        "read_set_ref",
        "warning:stale_read_ref",
        "warning:freshness_window_current",
        "portfolio_decision",
      ]),
    );
    expect(artifact.provenance.used).toEqual(
      expect.arrayContaining([view.subject, signalRef, riskRef, decisionRef]),
    );
    expect(artifact.artifactHash).toHaveLength(64);
    expect(verifyStateReviewArtifactHash(artifact).valid).toBe(true);
  });

  it("serializes and imports state-review artifacts with stable replay metadata", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );
    const artifact = buildStateReviewArtifact(review, {
      artifactId: "artifact_arrowhedge_json_001",
      metadata: {
        scenarioId: "arrowhedge-distribution-currentness-mismatch",
        fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "session_arrowhedge_001",
        observedReadSet: [
          {
            ref: signalRef,
            observedAt: timestamp("2026-06-03T13:59:00.000Z"),
            validUntil: timestamp("2026-06-03T14:01:00.000Z"),
            authority: "arrowhedge:paper_quote:latest",
            projectionVersion: 0,
            workflowPosition: "risk_refresh_pending",
            tool: "arrowhedge.quote.read",
            source: "broker_snapshot",
          },
        ],
        observedReadSetComparison: compareObservedReadSetToDeclared(
          [],
          [],
          view,
          review.proposedAction.proposedAt,
        ),
      },
    });

    expect(artifact.metadata).toEqual({
      temporalMisalignmentPhase: "observation_to_action",
      invariantClasses: ["freshness_window"],
      scenarioId: "arrowhedge-distribution-currentness-mismatch",
      fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale.json",
      clientSurface: "codex",
      provider: "openai",
      sessionId: "session_arrowhedge_001",
      observedReadSet: [
        {
          ref: signalRef,
          observedAt: "2026-06-03T13:59:00.000Z",
          validUntil: "2026-06-03T14:01:00.000Z",
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.quote.read",
          source: "broker_snapshot",
        },
      ],
      observedReadSetComparison: expect.objectContaining({
        valid: false,
        mode: "warn",
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "declared_but_unobserved",
            path: "/declaredReadSet/1/ref",
          }),
          expect.objectContaining({
            code: "stale_observed_read",
            path: "/observedReadSet/0/validUntil",
          }),
        ]),
      }),
    });

    const json = serializeStateReviewArtifact(artifact);
    const imported = importStateReviewArtifact(json);

    expect(json).toBe(serializeStateReviewArtifact(artifact));
    expect(imported).toMatchObject({
      valid: true,
      issues: [],
      hashValidation: {
        valid: true,
        actualHash: artifact.artifactHash,
        expectedHash: artifact.artifactHash,
      },
    });
    expect(imported.artifact).toEqual(artifact);
  });

  it("imports JSONL artifact corpora and reports tampered hashes without hiding the artifact", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
      { artifactId: "artifact_arrowhedge_jsonl_001" },
    );
    const tampered = {
      ...artifact,
      artifactId: "artifact_arrowhedge_jsonl_002",
      review: {
        ...artifact.review,
        valid: false,
      },
    };

    const imported = importStateReviewArtifactsJsonl(
      serializeStateReviewArtifactsJsonl([artifact, tampered]),
    );

    expect(imported[0]).toMatchObject({
      valid: true,
      issues: [],
      artifact: {
        artifactId: "artifact_arrowhedge_jsonl_001",
      },
    });
    expect(imported[1]).toMatchObject({
      valid: false,
      issues: [
        {
          path: "/artifactHash",
          message: "artifact hash mismatch during replay verification",
        },
      ],
      artifact: {
        artifactId: "artifact_arrowhedge_jsonl_002",
      },
    });
  });

  it("rejects malformed nested artifact shape even when the canonical hash matches", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const malformedPayload = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        invariantClasses: "freshness_window",
      },
      review: {
        ...artifact.review,
        observationEvaluation: {
          ...artifact.review.observationEvaluation,
          assertions: [{ code: "freshness_window_current", passed: false, severity: "warn" }],
        },
        warnings: [{ source: "read_set", code: "stale_read_ref", severity: "warn" }],
      },
    };
    const { artifactHash: _artifactHash, ...hashPayload } = malformedPayload;
    const malformed = {
      ...malformedPayload,
      artifactHash: computeStateReviewArtifactHash(hashPayload),
    };

    expect(importStateReviewArtifact(malformed)).toMatchObject({
      valid: false,
      hashValidation: {
        valid: true,
      },
      issues: expect.arrayContaining([
        {
          path: "/metadata/invariantClasses",
          message: "expected array",
        },
        {
          path: "/review/observationEvaluation/assertions/0/message",
          message: "expected non-empty string",
        },
        {
          path: "/review/observationEvaluation/assertions/0/refs",
          message: "expected array",
        },
        {
          path: "/review/warnings/0/message",
          message: "expected non-empty string",
        },
        {
          path: "/review/warnings/0/refs",
          message: "expected array",
        },
      ]),
    });
  });

  it("rejects malformed observed read-set issue metadata even when replay hash matches", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const malformedPayload = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        observedReadSetComparison: {
          valid: false,
          mode: "warn",
          declaredReadSet: artifact.review.proposedAction.readSet,
          observedReadSet: [],
          issues: [
            {
              code: "declared_but_unobserved",
              path: "/declaredReadSet/0/ref",
              message: "declared ref was not observed",
              declaredIndex: "0",
              observedIndex: -1,
              ref: { kind: "", id: "evt_signal" },
            },
          ],
        },
      },
    };
    const { artifactHash: _artifactHash, ...hashPayload } = malformedPayload;
    const malformed = {
      ...malformedPayload,
      artifactHash: computeStateReviewArtifactHash(hashPayload),
    };

    expect(importStateReviewArtifact(malformed)).toMatchObject({
      valid: false,
      hashValidation: {
        valid: true,
      },
      issues: expect.arrayContaining([
        {
          path: "/metadata/observedReadSetComparison/issues/0/declaredIndex",
          message: "expected non-negative integer",
        },
        {
          path: "/metadata/observedReadSetComparison/issues/0/observedIndex",
          message: "expected non-negative integer",
        },
        {
          path: "/metadata/observedReadSetComparison/issues/0/ref/kind",
          message: "expected non-empty string",
        },
      ]),
    });
  });

  it("turns a state-review artifact into an evidence-linked continuity payload", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(
        actionFrom(view, {
          proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
        }),
        view,
      ),
      { artifactId: "artifact_arrowhedge_continuity_001" },
    );

    expect(
      buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact(artifact, {
        supersedes: ["checkpoint_arrowhedge_previous"],
        contradictedBy: ["evt_risk_refresh_002"],
      }),
    ).toEqual({
      sourceRefs: [signalRef, riskRef, decisionRef],
      validUntil: "2026-06-03T14:10:00.000Z",
      supersedes: ["checkpoint_arrowhedge_previous"],
      contradictedBy: ["evt_risk_refresh_002"],
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      currentStateViewId: "view_aapl",
      stateReviewArtifactId: "artifact_arrowhedge_continuity_001",
      stateReviewArtifactHash: artifact.artifactHash,
      reviewId: "view_aapl:portfolio.decision.accept:proposal_review",
      observationContractId: "view_aapl:observation_contract",
      valid: false,
      warningCodes: ["stale_read_ref", "freshness_window_current"],
    });
  });

  it("detects tampered state-review artifacts during replay verification", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const tampered = {
      ...artifact,
      review: {
        ...artifact.review,
        valid: false,
      },
    };

    expect(verifyStateReviewArtifactHash(tampered)).toMatchObject({
      valid: false,
      actualHash: artifact.artifactHash,
    });
  });

  it("admits exactly one hash-valid terminal outcome per stable action id", () => {
    const accepted = actionOutcomeEnvelope();
    const duplicate = { ...accepted };
    const blocked = actionOutcomeEnvelope({
      requestedTerminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "status_check",
          code: "risk_snapshot_stale",
          message: "Risk snapshot changed before acceptance.",
          refs: [riskRef],
          invariantClasses: ["freshness_window"],
        },
      ],
    });

    expect(admitActionOutcomeEnvelope([], accepted)).toMatchObject({
      accepted: true,
      reason: "first_terminal_outcome",
      candidateHashValidation: { valid: true },
    });
    expect(admitActionOutcomeEnvelope([accepted], duplicate)).toMatchObject({
      accepted: true,
      reason: "idempotent_duplicate",
      candidateHashValidation: { valid: true },
      incumbentHashValidation: { valid: true },
    });
    expect(admitActionOutcomeEnvelope([accepted], blocked)).toMatchObject({
      accepted: false,
      reason: "terminal_outcome_conflict",
      candidate: { terminalOutcome: "blocked" },
      incumbent: { terminalOutcome: "accepted" },
      candidateHashValidation: { valid: true },
      incumbentHashValidation: { valid: true },
    });
  });

  it("rejects tampered terminal outcome envelopes before admission", () => {
    const envelope = actionOutcomeEnvelope();
    const tampered = {
      ...envelope,
      terminalOutcome: "blocked" as const,
    };

    expect(verifyActionOutcomeEnvelopeHash(tampered)).toMatchObject({
      valid: false,
      actualHash: envelope.outcomeHash,
    });
    expect(admitActionOutcomeEnvelope([], tampered)).toMatchObject({
      accepted: false,
      reason: "candidate_hash_invalid",
      candidateHashValidation: { valid: false },
    });
  });

  it("builds a terminal outcome index with replay counts and conflict issues", () => {
    const accepted = actionOutcomeEnvelope();
    const duplicate = { ...accepted };
    const conflict = actionOutcomeEnvelope({
      requestedTerminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "policy",
          code: "approval_revoked",
          message: "The approving authority revoked the action.",
          refs: [decisionRef],
          invariantClasses: ["workflow_position"],
        },
      ],
    });
    const invalid = {
      ...actionOutcomeEnvelope({ actionId: "action:invalid_hash" }),
      outcomeHash: "bad_hash",
    };

    const index = buildActionOutcomeTerminalIndex([
      accepted,
      duplicate,
      conflict,
      invalid,
    ]);

    expect(index.valid).toBe(false);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      key: "tnt_agent_state:action:dec_aapl_buy_120:accept",
      replayCount: 2,
      envelope: {
        terminalOutcome: "accepted",
      },
    });
    expect(index.issues.map((issue) => issue.code)).toEqual([
      "terminal_outcome_conflict",
      "candidate_hash_invalid",
    ]);
  });

  it("keeps stale blocking reviews from becoming accepted terminal outcomes", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        enforcementMode: "blocking",
      },
    );

    const envelope = actionOutcomeEnvelope({
      proposalReviewId: review.reviewId,
      proposalReview: review,
      requestedTerminalOutcome: "accepted",
    });

    expect(envelope).toMatchObject({
      terminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "proposal_review",
          code: "proposal_review_blocking_policy",
        },
      ],
    });
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });
});
