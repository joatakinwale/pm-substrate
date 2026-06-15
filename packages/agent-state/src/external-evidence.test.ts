import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import {
  admittedStateEvidenceToObservedReadSetEntry,
  buildObservationContractFromCurrentStateView,
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  compareObservedReadSetToDeclared,
  computeObservationContractIntegrityHash,
  evaluateStateReviewInvariantPolicy,
  importStateReviewArtifact,
  reviewExternalStateEvidence,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifact,
  stateRef,
  toAdmittedStateEvidence,
  validateObservationContractBinding,
  validateProposedActionReadSet,
  verifyObservationContractIntegrity,
  type CurrentStateView,
  type EvidenceAdmissionContext,
  type ExternalStateEvidence,
  type ProposedAction,
} from "./index.js";

const t = tenantId("tnt_evidence");
const otherTenant = tenantId("tnt_other");
const subjectRef = stateRef("projection", "arrowhedge_cop:MSFT", "MSFT COP");
const signalRef = stateRef("event", "evt_signal_msft", "analyst.signal.created");
const riskRef = stateRef("event", "evt_risk_msft", "risk.state.validated");

const evaluatedAt = timestamp("2026-06-10T15:00:00.000Z");

const baseEvidence = (
  overrides: Partial<ExternalStateEvidence> = {},
): ExternalStateEvidence => ({
  tenantId: t,
  evidenceId: "ev_001",
  kind: "mcp_tool_handle",
  source: "mcp://arrowhedge-tools/portfolio_state",
  subject: subjectRef,
  refs: [signalRef],
  observedAt: timestamp("2026-06-10T14:55:00.000Z"),
  validUntil: timestamp("2026-06-10T15:30:00.000Z"),
  collectedBy: "agent:dexter",
  collectedAt: timestamp("2026-06-10T14:56:00.000Z"),
  payload: { handle: "h_abc" },
  payloadHash: "ph_123",
  ...overrides,
});

const baseContext = (
  overrides: Partial<EvidenceAdmissionContext> = {},
): EvidenceAdmissionContext => ({
  tenantId: t,
  evaluatedAt,
  expectedSubject: subjectRef,
  ...overrides,
});

describe("reviewExternalStateEvidence", () => {
  it("admits clean, fresh, tenant- and subject-aligned evidence with no issues", () => {
    const review = reviewExternalStateEvidence(baseEvidence(), baseContext());

    expect(review.decision).toBe("admitted");
    expect(review.issues).toHaveLength(0);
    expect(review.authorityStatus).toBe("evidence_only");
    expect(review.invariantClasses).toHaveLength(0);
    expect(review.reviewId).toBe("ev_001:admission_review");
  });

  it("rejects cross-tenant evidence", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ tenantId: otherTenant }),
      baseContext(),
    );

    expect(review.decision).toBe("rejected");
    expect(review.issues.map((issue) => issue.code)).toContain("tenant_mismatch");
    expect(review.invariantClasses).toContain("tenant_boundary");
    expect(toAdmittedStateEvidence(review)).toBeUndefined();
  });

  it("rejects subject-mismatched evidence", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ subject: stateRef("projection", "arrowhedge_cop:AAPL") }),
      baseContext(),
    );

    expect(review.decision).toBe("rejected");
    expect(review.issues.map((issue) => issue.code)).toContain("subject_mismatch");
    expect(review.invariantClasses).toContain("subject_identity");
  });

  it("rejects future-dated evidence", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ observedAt: timestamp("2026-07-28T00:00:00.000Z") }),
      baseContext(),
    );

    expect(review.decision).toBe("rejected");
    expect(review.issues.map((issue) => issue.code)).toContain("future_observed_at");
    expect(review.invariantClasses).toContain("freshness_window");
  });

  it("rejects unsourced evidence", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ source: "  " }),
      baseContext(),
    );

    expect(review.decision).toBe("rejected");
    expect(review.issues.map((issue) => issue.code)).toContain("source_missing");
  });

  it("admits stale evidence with a freshness warning that would block at high consequence", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ validUntil: timestamp("2026-06-10T14:59:00.000Z") }),
      baseContext(),
    );

    expect(review.decision).toBe("admitted_with_warnings");
    expect(review.issues.map((issue) => issue.code)).toContain("stale_evidence");
    expect(review.invariantClasses).toContain("freshness_window");

    const policy = evaluateStateReviewInvariantPolicy(review.invariantClasses, "high");
    expect(policy.wouldBlock).toBe(true);
    expect(policy.wouldBlockInvariantClasses).toContain("freshness_window");
  });

  it("warns when evidence age exceeds the tolerated maximum", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence(),
      baseContext({ maxEvidenceAgeMs: 60_000 }),
    );

    expect(review.decision).toBe("admitted_with_warnings");
    expect(review.issues.map((issue) => issue.code)).toContain(
      "evidence_age_exceeded",
    );
  });

  it("downgrades MCP-style authority claims to evidence (C028)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ kind: "tool_annotation", claimsAuthority: true }),
      baseContext(),
    );

    expect(review.decision).toBe("admitted_with_warnings");
    expect(review.issues.map((issue) => issue.code)).toContain(
      "authority_claim_downgraded",
    );
    expect(review.authorityStatus).toBe("evidence_only");
    expect(review.invariantClasses).toContain("source_authority");
  });

  it("warns on authorities outside the tenant trusted set", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({ claimedAuthority: "mcp://rogue-server" }),
      baseContext({ trustedAuthorities: ["arrowhedge:backtest"] }),
    );

    expect(review.issues.map((issue) => issue.code)).toContain("untrusted_authority");
  });

  it("warns on approval-currentness drift across revision, hash, and scope (C032)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "approval_record",
        approval: {
          approvedRevision: "rev_7",
          approvedContentHash: "hash_old",
          approvedScope: "portfolio.decision.accept",
        },
      }),
      baseContext({
        currentApproval: {
          revision: "rev_9",
          contentHash: "hash_new",
          scope: "portfolio.decision.execute",
        },
      }),
    );

    const codes = review.issues.map((issue) => issue.code);
    expect(codes).toContain("approval_revision_mismatch");
    expect(codes).toContain("approval_content_hash_mismatch");
    expect(codes).toContain("approval_scope_mismatch");
    expect(review.decision).toBe("admitted_with_warnings");
    expect(review.invariantClasses).toEqual(
      expect.arrayContaining(["state_conflict", "capability_contract"]),
    );
  });

  it("passes approval evidence whose revision, hash, and scope match current state", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "approval_record",
        approval: {
          approvedRevision: "rev_9",
          approvedContentHash: "hash_new",
          approvedScope: "portfolio.decision.accept",
        },
      }),
      baseContext({
        currentApproval: {
          revision: "rev_9",
          contentHash: "hash_new",
          scope: "portfolio.decision.accept",
        },
      }),
    );

    expect(review.decision).toBe("admitted");
  });

  it("warns on provider policy version drift and blocked data classes (C023)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "provider_policy",
        providerPolicy: {
          policyVersion: "dlp_v3",
          zeroDataRetention: false,
          allowedDataClasses: ["public", "internal"],
        },
      }),
      baseContext({
        currentPolicyVersion: "dlp_v4",
        sensitiveDataClasses: ["internal", "regulated_financial"],
      }),
    );

    const codes = review.issues.map((issue) => issue.code);
    expect(codes).toContain("policy_version_drift");
    expect(codes).toContain("sensitive_data_class_blocked");
    expect(
      review.issues.find((issue) => issue.code === "sensitive_data_class_blocked")
        ?.message,
    ).toContain("regulated_financial");
  });

  it("requires observability-safe retention metadata on memory evidence (C026)", () => {
    const { payloadHash: _omitted, ...memoryEvidence } = baseEvidence({
      kind: "memory_retrieval",
      memory: {
        sourceModality: "text",
        influenceKind: "fact",
        deletionResidueRisk: "high",
        staleInformationRisk: "medium",
      },
    });
    const review = reviewExternalStateEvidence(memoryEvidence, baseContext());

    const codes = review.issues.map((issue) => issue.code);
    expect(codes).toContain("memory_retention_metadata_missing");
    expect(codes).toContain("memory_deletion_residue_risk");
    expect(codes).toContain("memory_stale_information_risk");
    expect(codes).toContain("unverifiable_payload_integrity");
    expect(review.decision).toBe("admitted_with_warnings");
  });

  it("requires source-channel and intended-use metadata on memory writes", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "memory_write",
        memory: {
          sourceModality: "text",
          retentionPolicy: "workspace_long_term",
          influenceKind: "instruction",
        },
      }),
      baseContext(),
    );

    const codes = review.issues.map((issue) => issue.code);
    expect(codes).toContain("memory_write_metadata_missing");
    expect(codes).toContain("memory_control_override_status_missing");
    expect(review.invariantClasses).toEqual(
      expect.arrayContaining(["required_evidence"]),
    );
  });

  it("requires influence classification on recalled memory before admission", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "memory_retrieval",
        memory: {
          sourceModality: "text",
          retentionPolicy: "workspace_long_term",
          deletionResidueRisk: "low",
          staleInformationRisk: "low",
        },
      }),
      baseContext(),
    );

    expect(review.issues.map((issue) => issue.code)).toContain(
      "memory_influence_kind_missing",
    );
  });

  it("warns when tool-routing memory has already been overridden", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "memory_retrieval",
        memory: {
          sourceModality: "text",
          retentionPolicy: "workspace_long_term",
          influenceKind: "tool_routing",
          overrideStatus: "workflow_overridden",
          deletionResidueRisk: "low",
          staleInformationRisk: "low",
        },
      }),
      baseContext(),
    );

    expect(review.issues.map((issue) => issue.code)).toContain(
      "memory_control_overridden",
    );
    expect(review.invariantClasses).toContain("state_conflict");
  });

  it("flags omitted workflow stages and failed gates from traces (C027)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "workflow_trace",
        workflowTrace: {
          workflowRunId: "run_42",
          stages: ["signal", "risk"],
          gateOutcomes: { risk_gate: "passed", compliance_gate: "failed" },
        },
      }),
      baseContext({
        expectedWorkflowStages: ["signal", "risk", "decision"],
      }),
    );

    const codes = review.issues.map((issue) => issue.code);
    expect(codes).toContain("workflow_stage_omitted");
    expect(codes).toContain("workflow_gate_failed");
    expect(review.invariantClasses).toContain("workflow_position");
  });

  it("detects provenance-vs-authorization misalignment (frontier item 6)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "identity_on_behalf_of",
        identity: {
          actorId: "agent:dexter",
          onBehalfOf: "user:emmanuel",
          authorizedIntent: "graph/portfolio",
          actualSourcePath: "graph/portfolio/positions",
          actualParameterPath: "registry/capabilities",
        },
      }),
      baseContext(),
    );

    const mismatches = review.issues.filter(
      (issue) => issue.code === "provenance_authorization_mismatch",
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.message).toContain("registry/capabilities");
    expect(review.invariantClasses).toContain("source_authority");
  });

  it("requires typed owners on PM handoff evidence (C030)", () => {
    const review = reviewExternalStateEvidence(
      baseEvidence({
        kind: "pm_handoff",
        pmHandoff: {
          expertiseOwner: "analyst:alice",
          unresolvedRisks: ["risk limits stale"],
        },
      }),
      baseContext(),
    );

    const issue = review.issues.find((item) => item.code === "pm_handoff_incomplete");
    expect(issue?.message).toContain("sourceSteward");
    expect(issue?.message).toContain("escalationOwner");
    expect(review.invariantClasses).toContain("required_evidence");
  });
});

describe("admitted evidence bridges", () => {
  it("converts admitted evidence into an observed read-set entry that participates in comparison", () => {
    const review = reviewExternalStateEvidence(baseEvidence(), baseContext());
    const admitted = toAdmittedStateEvidence(review);
    expect(admitted).toBeDefined();

    const entry = admittedStateEvidenceToObservedReadSetEntry(
      admitted!,
      "arrowhedge:backtest:bt_msft",
    );
    expect(entry).toBeDefined();
    expect(entry!.ref).toEqual(subjectRef);
    expect(entry!.source).toBe("mcp://arrowhedge-tools/portfolio_state");
    expect(entry!.tool).toBe("mcp_tool_handle");

    const comparison = compareObservedReadSetToDeclared(
      [
        {
          ref: subjectRef,
          observedAt: timestamp("2026-06-10T14:55:00.000Z"),
          authority: "arrowhedge:backtest:bt_msft",
        },
      ],
      [entry!],
      { authorityRule: "arrowhedge:backtest:bt_msft" },
      evaluatedAt,
    );
    expect(comparison.valid).toBe(true);
  });

  it("returns undefined read-set entry when evidence carries no refs", () => {
    const { subject: _subject, ...subjectless } = baseEvidence({ refs: [] });
    const { expectedSubject: _expected, ...contextWithoutSubject } = baseContext();
    const review = reviewExternalStateEvidence(subjectless, contextWithoutSubject);
    const admitted = toAdmittedStateEvidence(review);
    expect(admitted).toBeDefined();
    expect(
      admittedStateEvidenceToObservedReadSetEntry(admitted!, "authority"),
    ).toBeUndefined();
  });
});

const baseView = (overrides: Partial<CurrentStateView> = {}): CurrentStateView => ({
  tenantId: t,
  viewId: "view_msft",
  subject: subjectRef,
  observedAt: timestamp("2026-06-10T14:50:00.000Z"),
  validUntil: timestamp("2026-06-10T15:20:00.000Z"),
  authorityRule: "arrowhedge:backtest:bt_msft",
  projectionVersion: 3,
  workflowPosition: "decision_pending",
  sourceRefs: [signalRef, riskRef],
  missingSources: [],
  conflicts: [],
  allowedActions: [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept portfolio decision",
      requiredRefs: [signalRef, riskRef],
      requiredWorkflowPosition: "decision_pending",
      requiredRelatedRoles: [
        { role: "risk_state", refKind: "event" },
        { role: "counter_position", refKind: "projection" },
      ],
    },
  ],
  ...overrides,
});

const baseAction = (overrides: Partial<ProposedAction> = {}): ProposedAction => {
  const view = baseView();
  return {
    tenantId: t,
    actionType: "portfolio.decision.accept",
    subject: subjectRef,
    relatedSubjects: [
      { role: "risk_state", ref: riskRef },
      { role: "counter_position", ref: stateRef("projection", "arrowhedge_cop:QQQ") },
    ],
    payload: { quantity: 10 },
    readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
    proposedBy: "agent:dexter",
    proposedAt: timestamp("2026-06-10T14:58:00.000Z"),
    ...overrides,
  };
};

describe("PM handoff agreement (distributed-state eval)", () => {
  it("measures dependency, owner, risk, and next-action agreement between handoffs", async () => {
    const { comparePmHandoffAgreement } = await import("./index.js");
    const depA = stateRef("event", "evt_dep_risk");
    const depB = stateRef("event", "evt_dep_signal");
    const depC = stateRef("event", "evt_dep_budget");

    const agreement = comparePmHandoffAgreement(
      {
        expertiseOwner: "analyst:alice",
        sourceSteward: "data:steward_1",
        escalationOwner: "pm:bob",
        unresolvedRisks: ["position sizing unreviewed", "stale risk limits"],
        dependencyRefs: [depA, depB],
        validNextActions: ["portfolio.decision.review", "risk.refresh"],
      },
      {
        expertiseOwner: "analyst:alice",
        sourceSteward: "data:steward_2",
        escalationOwner: "pm:bob",
        unresolvedRisks: ["stale risk limits"],
        dependencyRefs: [depA, depC],
        validNextActions: ["risk.refresh"],
      },
    );

    expect(agreement.dependencyAgreementRate).toBeCloseTo(1 / 3);
    expect(agreement.ownerConvergence.expertiseOwner).toBe(true);
    expect(agreement.ownerConvergence.sourceSteward).toBe(false);
    expect(agreement.ownerConvergence.escalationOwner).toBe(true);
    expect(agreement.ownerConvergenceRate).toBeCloseTo(2 / 3);
    expect(agreement.sharedUnresolvedRisks).toEqual(["stale risk limits"]);
    expect(agreement.unresolvedRiskCount).toBe(2);
    expect(agreement.handoffConditionResolved).toBe(false);
    expect(agreement.agreedNextActions).toEqual(["risk.refresh"]);
    expect(agreement.nextActionAgreementRate).toBeCloseTo(1 / 2);
  });

  it("treats fully resolved, fully aligned handoffs as condition-resolved", async () => {
    const { comparePmHandoffAgreement } = await import("./index.js");
    const handoff = {
      expertiseOwner: "analyst:alice",
      sourceSteward: "data:steward_1",
      escalationOwner: "pm:bob",
      validNextActions: ["portfolio.decision.review"],
    };
    const agreement = comparePmHandoffAgreement(handoff, handoff);

    expect(agreement.dependencyAgreementRate).toBe(1);
    expect(agreement.ownerConvergenceRate).toBe(1);
    expect(agreement.handoffConditionResolved).toBe(true);
    expect(agreement.nextActionAgreementRate).toBe(1);
  });
});

describe("multi-object related roles", () => {
  it("passes when all required roles are bound with matching kinds", () => {
    const decision = validateProposedActionReadSet(baseAction(), baseView());
    expect(decision.valid).toBe(true);
  });

  it("flags missing related-object roles", () => {
    const decision = validateProposedActionReadSet(
      baseAction({ relatedSubjects: [{ role: "risk_state", ref: riskRef }] }),
      baseView(),
    );
    const codes = decision.issues.map((issue) => issue.code);
    expect(codes).toContain("missing_related_object_role");
  });

  it("flags role bindings with the wrong ref kind", () => {
    const decision = validateProposedActionReadSet(
      baseAction({
        relatedSubjects: [
          { role: "risk_state", ref: stateRef("document", "doc_risk") },
          {
            role: "counter_position",
            ref: stateRef("projection", "arrowhedge_cop:QQQ"),
          },
        ],
      }),
      baseView(),
    );
    const issue = decision.issues.find(
      (item) => item.code === "related_object_role_mismatch",
    );
    expect(issue?.message).toContain("risk_state");
    expect(issue?.ref).toEqual(stateRef("document", "doc_risk"));
  });

  it("maps related-role warnings to the subject_identity invariant class", () => {
    const review = reviewProposedActionAgainstCurrentState(
      baseAction({ relatedSubjects: [] }),
      baseView(),
    );
    const artifact = buildStateReviewArtifact(review);
    expect(artifact.metadata.invariantClasses).toContain("subject_identity");
  });
});

describe("observation contract v2 bindings", () => {
  it("computes and verifies a stable integrity hash", () => {
    const contract = buildObservationContractFromCurrentStateView(baseView());
    const integrityHash = computeObservationContractIntegrityHash(contract);
    const signed = { ...contract, integrityHash };

    expect(verifyObservationContractIntegrity(signed)?.valid).toBe(true);
    expect(verifyObservationContractIntegrity(contract)).toBeUndefined();

    const tampered = { ...signed, authorityRule: "attacker:override" };
    expect(verifyObservationContractIntegrity(tampered)?.valid).toBe(false);
  });

  it("warns on holder-binding, allowed-use, and integrity mismatches", () => {
    const view = baseView();
    const contract = {
      ...buildObservationContractFromCurrentStateView(view),
      issuer: "pm-substrate/current-state",
      holderBinding: "agent:analyst_bot",
      allowedUse: ["portfolio.decision.propose"] as const,
      integrityHash: "tampered_hash",
    };
    const warnings = validateObservationContractBinding(contract, baseAction());
    const codes = warnings.map((warning) => warning.code);

    expect(codes).toContain("holder_binding_mismatch");
    expect(codes).toContain("allowed_use_mismatch");
    expect(codes).toContain("integrity_hash_mismatch");
    expect(warnings.every((warning) => warning.source === "contract_binding")).toBe(
      true,
    );
  });

  it("feeds contract-binding warnings into review validity and invariant classes", () => {
    const view = baseView();
    const contract = {
      ...buildObservationContractFromCurrentStateView(view),
      holderBinding: "agent:analyst_bot",
    };
    const review = reviewProposedActionAgainstCurrentState(baseAction(), view, {
      observationContract: contract,
    });

    expect(review.valid).toBe(false);
    expect(review.warnings.map((warning) => warning.code)).toContain(
      "holder_binding_mismatch",
    );

    const artifact = buildStateReviewArtifact(review);
    expect(artifact.metadata.invariantClasses).toContain("subject_identity");
  });

  it("produces no binding warnings for v1 contracts", () => {
    const view = baseView();
    const contract = buildObservationContractFromCurrentStateView(view);
    expect(validateObservationContractBinding(contract, baseAction())).toHaveLength(0);
  });
});

describe("artifact round-trip with evidence admissions", () => {
  it("persists admissions and run-group metadata through serialize/import with a valid hash", () => {
    const view = baseView();
    const action = baseAction();
    const admission = reviewExternalStateEvidence(
      baseEvidence({ validUntil: timestamp("2026-06-10T14:59:00.000Z") }),
      baseContext(),
    );
    const review = reviewProposedActionAgainstCurrentState(action, view, {
      evaluatedAt,
    });
    const artifact = buildStateReviewArtifact(review, {
      metadata: {
        scenarioId: "arrowhedge:evidence_admission",
        fixtureId: "fixture_admission_v1",
        runGroupId: "run_group_msft_001",
        evidenceAdmissions: [admission],
      },
    });

    expect(artifact.metadata.runGroupId).toBe("run_group_msft_001");
    expect(artifact.metadata.evidenceAdmissions).toHaveLength(1);

    const imported = importStateReviewArtifact(serializeStateReviewArtifact(artifact));
    expect(imported.valid).toBe(true);
    expect(imported.hashValidation?.valid).toBe(true);
    expect(imported.artifact?.metadata.evidenceAdmissions?.[0]?.decision).toBe(
      "admitted_with_warnings",
    );
  });

  it("rejects malformed evidence admissions on import", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(baseAction(), view);
    const artifact = buildStateReviewArtifact(review, {
      metadata: {
        evidenceAdmissions: [
          {
            // missing reviewId / evidence / issues; wrong authority status
            tenantId: t,
            evaluatedAt,
            decision: "admitted",
            authorityStatus: "source_of_truth",
          } as never,
        ],
      },
    });

    const imported = importStateReviewArtifact(serializeStateReviewArtifact(artifact));
    expect(imported.valid).toBe(false);
    expect(
      imported.issues.some((issue) =>
        issue.path.startsWith("/metadata/evidenceAdmissions/0"),
      ),
    ).toBe(true);
  });
});
