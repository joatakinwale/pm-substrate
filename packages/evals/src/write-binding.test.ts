import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingReferenceCatalog,
} from "@pm/workflow";
import { verifyActionOutcomeEnvelopeHash } from "@pm/agent-state";
import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";
import { tenantId, timestamp } from "@pm/types";

import {
  analyzeEvalEventActionOutcomeReplay,
  analyzeWriteBindingReplayRecords,
  analyzeWriteTransportBindingCoverage,
  buildActionOutcomeEnvelopeReplayIndex,
  buildArrowHedgeWriteBindingReplayCorpus,
  buildEvidenceBindingReferenceCatalogFromReplayCorpora,
  buildFixtureWriteTransportBindingCoverageSamples,
  buildWriteTransportBindingCoverageSamplesFromCapabilities,
  importWriteBindingReplayRecordsJsonl,
  recoverActionOutcomeEnvelopeFromReplayIndex,
  type WriteBindingReplayRecord,
} from "./write-binding.js";
import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";

describe("write-binding replay corpus", () => {
  it("generates an ArrowHedge corpus that covers allowed, unverified, missing, incomplete, and policy-blocked write attempts", () => {
    const corpus = buildArrowHedgeWriteBindingReplayCorpus();

    expect(corpus.records.map((record) => record.decision)).toEqual([
      "allowed",
      "blocked_unverified_binding",
      "blocked_missing_binding",
      "blocked_incomplete_binding",
      "blocked_policy",
      "blocked_policy",
    ]);
    expect(
      corpus.records.every(
        (record) =>
          record.currentStateView.viewId.length > 0 &&
          record.stateReviewArtifact.artifactHash.length === 64,
      ),
    ).toBe(true);
    expect(
      corpus.records.flatMap((record) =>
        record.evidenceAdmissionReviews.map((review) => review.reviewId),
      ),
    ).toContain("ev_clean:admission_review");
    expect(
      corpus.records.some((record) =>
        record.evidenceAdmissionReviews.some(
          (review) => review.decision === "rejected",
        ),
      ),
    ).toBe(true);
    expect(
      corpus.records.every(
        (record) => verifyActionOutcomeEnvelopeHash(record.actionOutcomeEnvelope).valid,
      ),
    ).toBe(true);
    expect(
      corpus.records.map((record) => record.actionOutcomeEnvelope.terminalOutcome),
    ).toEqual([
      "accepted",
      "blocked",
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(
      corpus.records.every((record) =>
        record.actionOutcomeEnvelope.substrateRefs.some(
          (ref) => ref.kind === "action_outcome_envelope",
        ),
      ),
    ).toBe(true);
  });

  it("derives metrics from observed replay decisions instead of scenario labels", () => {
    const metrics = analyzeWriteBindingReplayRecords(
      buildArrowHedgeWriteBindingReplayCorpus().records,
    );

    expect(metrics).toMatchObject({
      totalRecords: 6,
      allowed: 1,
      blocked: 5,
      completeBindings: 4,
      missingBindings: 1,
      incompleteBindings: 1,
      policyBlocked: 2,
      unverifiedBindings: 1,
      providerCertificateMissing: 0,
      providerCertificateInvalid: 0,
      rejectedEvidenceReferences: 1,
      actionOutcomeEnvelopeCount: 6,
      acceptedActionOutcomeEnvelopes: 1,
      blockedActionOutcomeEnvelopes: 5,
      replayHashCoverage: 1,
      highConsequenceRecords: 6,
    });
    expect(metrics.byDecision).toEqual({
      allowed: 1,
      blocked_missing_binding: 1,
      blocked_incomplete_binding: 1,
      blocked_policy: 2,
      blocked_unverified_binding: 1,
      blocked_provider_certificate_missing: 0,
      blocked_provider_certificate_invalid: 0,
    });
  });

  it("indexes promoted action outcome envelopes for amnesiac replay recovery", () => {
    const records = buildArrowHedgeWriteBindingReplayCorpus().records;
    const index = buildActionOutcomeEnvelopeReplayIndex(records);
    const staleBlockedRecord = records.find(
      (record) =>
        record.recordId === "wb_arrowhedge_stale_artifact_policy_blocked_001",
    );
    const replayRef = staleBlockedRecord?.actionOutcomeEnvelope.substrateRefs.find(
      (ref) => ref.kind === "action_outcome_envelope",
    );

    expect(replayRef).toBeDefined();
    expect(index).toMatchObject({
      envelopeCount: 6,
      indexedRefCount: 6,
      acceptedTerminalOutcomes: 1,
      blockedTerminalOutcomes: 5,
      invalidEnvelopeHashes: [],
    });

    const recovered = recoverActionOutcomeEnvelopeFromReplayIndex(index, {
      kind: "action_outcome_envelope",
      id: replayRef!.id,
    });

    expect(recovered).toBeDefined();
    expect(recovered!.terminalOutcome).toBe("blocked");
    expect(recovered!.actionId).toContain("evt_arrowhedge_accept_ready_stale_artifact");
    expect(verifyActionOutcomeEnvelopeHash(recovered!).valid).toBe(true);
  });

  it("resolves Axis A eval action-outcome refs against committed replay proof packets", () => {
    const records = buildArrowHedgeWriteBindingReplayCorpus().records;
    const terminalPartitionRef = records
      .find(
        (record) =>
          record.recordId === "wb_arrowhedge_stale_artifact_policy_blocked_001",
      )
      ?.actionOutcomeEnvelope.substrateRefs.find(
        (ref) => ref.kind === "action_outcome_envelope",
      );

    expect(terminalPartitionRef).toBeDefined();

    const suite = buildArrowHedgeStateEvalSuite({
      tenantId: tenantId("tnt_arrowhedge_state_review_corpus"),
      observedAt: timestamp("2026-06-11T16:05:00.000Z"),
      source: "packages/evals/fixtures/write-binding-replay.v1.jsonl",
      sourceRecordIds: ["ticker:AAPL"],
      substrateRefs: {
        graphNodeIds: [],
        eventIds: ["evt_signal", "evt_risk", "evt_decision"],
        projectionIds: ["arrowhedge_cop"],
      },
      readSetValidation: {
        currentStateViewId: "arrowhedge_cop_corpus:AAPL:current_state_view",
        mode: "warn",
        issueCodes: ["stale_read_ref"],
      },
      actionOutcomeEnvelopes: [
        {
          scenarioId: "arrowhedge-terminal-outcome-partition",
          envelopeId: terminalPartitionRef!.id,
        },
      ],
      operationalSamples: [],
    });
    const replay = analyzeEvalEventActionOutcomeReplay(suite.events, records);

    expect(replay).toMatchObject({
      eventCount: 14,
      eventsWithActionOutcomeRefs: 1,
      actionOutcomeRefCount: 1,
      resolvedActionOutcomeRefs: 1,
      unresolvedActionOutcomeRefs: 0,
      invalidResolvedActionOutcomeRefs: 0,
      acceptedTerminalOutcomes: 0,
      blockedTerminalOutcomes: 1,
    });
    expect(replay.recoveries[0]).toMatchObject({
      scenarioId: "arrowhedge-terminal-outcome-partition",
      resolved: true,
      terminalOutcome: "blocked",
      recordId: "wb_arrowhedge_stale_artifact_policy_blocked_001",
    });
  });

  it("matches the committed golden write-binding replay JSONL", () => {
    const corpus = buildArrowHedgeWriteBindingReplayCorpus();
    const fixturePath = new URL(
      "../fixtures/write-binding-replay.v1.jsonl",
      import.meta.url,
    );
    const committed = readFileSync(fixturePath, "utf8");

    expect(committed).toBe(corpus.jsonl);
    expect(committed.trim().split("\n")).toHaveLength(corpus.records.length);
  });

  it("builds a verification catalog from the committed replay corpora and verifies every intentional binding outcome", () => {
    const stateReviewArtifactsJsonl = readFileSync(
      new URL("../fixtures/arrowhedge-state-review-artifacts.v1.jsonl", import.meta.url),
      "utf8",
    );
    const evidenceAdmissionReviewsJsonl = readFileSync(
      new URL("../fixtures/evidence-admission-reviews.v1.jsonl", import.meta.url),
      "utf8",
    );
    const writeBindingReplayJsonl = readFileSync(
      new URL("../fixtures/write-binding-replay.v1.jsonl", import.meta.url),
      "utf8",
    );

    const { catalog, metrics } = buildEvidenceBindingReferenceCatalogFromReplayCorpora(
      {
        stateReviewArtifactsJsonl,
        evidenceAdmissionReviewsJsonl,
        writeBindingReplayJsonl,
      },
    );
    const records = importWriteBindingReplayRecordsJsonl(writeBindingReplayJsonl);
    const evidenceAdmissionReviewCount = evidenceAdmissionReviewsJsonl
      .split("\n")
      .filter((line) => line.trim().length > 0).length;

    expect(metrics).toMatchObject({
      stateReviewArtifactCount: 4,
      stateReviewArtifactsBackedByCorpus: 4,
      evidenceAdmissionReviewCount,
      rejectedEvidenceAdmissionReviews: 2,
      admissionCertificateCount: 4,
      revokedAdmissionCertificateCount: 0,
      writeBindingRecordCount: 6,
      bindingsWithCatalogCandidates: 5,
      bindingsWithAdmissionCertificates: 4,
    });
    expect(catalog.stateReviewArtifacts).toHaveLength(4);
    expect(catalog.evidenceAdmissionReviews).toHaveLength(
      evidenceAdmissionReviewCount,
    );
    expect(catalog.admissionCertificates).toHaveLength(4);

    const decisionsByRecordId = new Map(
      records.map((record) => [
        record.recordId,
        replayBindingRecord(record, catalog),
      ]),
    );

    expect(decisionsByRecordId.get("wb_arrowhedge_clean_refresh_allowed_001")).toEqual({
      valid: true,
    });
    expect(
      decisionsByRecordId.get("wb_arrowhedge_hash_mismatch_blocked_001"),
    ).toMatchObject({
      valid: false,
      reason: "evidence_binding_unverified",
    });
    expect(
      decisionsByRecordId.get("wb_arrowhedge_missing_binding_blocked_001"),
    ).toMatchObject({
      valid: false,
      reason: "evidence_binding_missing",
    });
    expect(
      decisionsByRecordId.get("wb_arrowhedge_incomplete_binding_blocked_001"),
    ).toMatchObject({
      valid: false,
      reason: "evidence_binding_incomplete",
    });
    expect(
      decisionsByRecordId.get("wb_arrowhedge_stale_artifact_policy_blocked_001"),
    ).toMatchObject({
      valid: false,
      reason: "evidence_policy_blocked",
    });
    expect(
      decisionsByRecordId.get("wb_arrowhedge_rejected_evidence_policy_blocked_001"),
    ).toMatchObject({
      valid: false,
      reason: "evidence_policy_blocked",
    });
  });

  it("reports write-transport binding coverage across required, advisory-only, and missing-provider paths", () => {
    const report = analyzeWriteTransportBindingCoverage(
      buildFixtureWriteTransportBindingCoverageSamples(),
    );

    expect(report.totalWriteCapableTransports).toBe(4);
    expect(report.verifiedRequiredTransports).toBe(2);
    expect(report.advisoryOnlyTransports).toBe(1);
    expect(report.missingProviderTransports).toBe(1);
    expect(report.coverageRate).toBe(0.5);
    expect(report.outcomeEnvelopeRequiredTransports).toBe(4);
    expect(report.outcomeEnvelopeCoveredTransports).toBe(4);
    expect(report.outcomeEnvelopeMissingTransports).toBe(0);
    expect(report.outcomeEnvelopeCoverageRate).toBe(1);
    expect(report.missingActionOutcomeEnvelopeTransportIds).toEqual([]);
    expect(report.byDisposition).toEqual({
      advisory_only: 1,
      missing_provider: 1,
      required_verified: 2,
    });
    expect(report.samples.map((sample) => sample.transportId)).toContain(
      "agency.lead.promote",
    );
  });

  it("derives action-outcome provider coverage from capability write contracts", () => {
    const coveredCapability = capabilityFixture("finance-research.ingest", [
      {
        interface: "Event",
        fields: ["kind", "occurredAt"],
        ownership: "contributor",
        terminalAdmissionProviders: [
          {
            providerId: "finance-research.arrowhedge.action-outcome-envelope.v1",
            kind: "action_outcome_envelope",
            contractVersion: { major: 1, minor: 0, patch: 0 },
            packageName: "@pm/capability-finance-research-ingest",
            exportName: "buildArrowHedgeActionOutcomeEnvelope",
            actionTypes: ["portfolio.decision.accept"],
          },
        ],
      },
      {
        interface: "Resource",
        fields: ["name", "kind"],
        ownership: "contributor",
      },
    ]);
    const uncoveredCapability = capabilityFixture("agency.lead-scoring", [
      {
        interface: "Resource",
        fields: ["currentTotalLeadsScored"],
        ownership: "owner",
      },
    ]);

    const report = analyzeWriteTransportBindingCoverage(
      buildWriteTransportBindingCoverageSamplesFromCapabilities(
        [
          {
            capability: coveredCapability,
            profile: "finance-research",
            workflowName: "arrowhedge-write-binding-replay",
            bindingMode: "require_for_writes",
            hasBindingProvider: true,
            hasBindingVerifier: true,
          },
          {
            capability: uncoveredCapability,
            profile: "agency",
            workflowName: "agency-lead-scoring",
            bindingMode: "require_for_writes",
            hasBindingProvider: true,
            hasBindingVerifier: true,
          },
        ],
        {
          requireVerifiedTerminalAdmissionProviders: true,
          terminalAdmissionProviderManifests: [
            {
              providerId:
                "finance-research.arrowhedge.action-outcome-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 1 },
              packageName: "@pm/capability-finance-research-ingest",
              exportName: "buildArrowHedgeActionOutcomeEnvelope",
              actionTypes: ["portfolio.decision.accept", "workflow.block"],
              availability: "available",
            },
          ],
        },
      ),
    );

    const byTransportId = new Map(
      report.samples.map((sample) => [sample.transportId, sample]),
    );

    expect(
      byTransportId.get("finance-research.ingest:Event:kind,occurredAt"),
    ).toMatchObject({
      hasActionOutcomeEnvelopeProvider: true,
      terminalAdmissionProviderIds: [
        "finance-research.arrowhedge.action-outcome-envelope.v1",
      ],
    });
    expect(
      byTransportId.get(
        "agency.lead-scoring:Resource:currentTotalLeadsScored",
      ),
    ).toMatchObject({
      hasActionOutcomeEnvelopeProvider: false,
      terminalAdmissionProviderIds: [],
    });
    expect(report.outcomeEnvelopeRequiredTransports).toBe(3);
    expect(report.outcomeEnvelopeCoveredTransports).toBe(1);
    expect(report.outcomeEnvelopeMissingTransports).toBe(2);
    expect(report.missingActionOutcomeEnvelopeTransportIds).toEqual([
      "finance-research.ingest:Resource:name,kind",
      "agency.lead-scoring:Resource:currentTotalLeadsScored",
    ]);

    const staleProviderReport = analyzeWriteTransportBindingCoverage(
      buildWriteTransportBindingCoverageSamplesFromCapabilities(
        [
          {
            capability: coveredCapability,
            profile: "finance-research",
            workflowName: "arrowhedge-write-binding-replay",
            bindingMode: "require_for_writes",
            hasBindingProvider: true,
            hasBindingVerifier: true,
          },
        ],
        {
          requireVerifiedTerminalAdmissionProviders: true,
          terminalAdmissionProviderManifests: [
            {
              providerId:
                "finance-research.arrowhedge.action-outcome-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 1 },
              packageName: "@pm/capability-finance-research-ingest",
              exportName: "buildArrowHedgeActionOutcomeEnvelope",
              actionTypes: ["workflow.block"],
              availability: "available",
            },
          ],
        },
      ),
    );

    expect(staleProviderReport.outcomeEnvelopeCoveredTransports).toBe(0);
    expect(staleProviderReport.missingActionOutcomeEnvelopeTransportIds).toEqual([
      "finance-research.ingest:Event:kind,occurredAt",
      "finance-research.ingest:Resource:name,kind",
    ]);
  });
});

function capabilityFixture(
  name: string,
  writesInterfaces: Capability["writesInterfaces"],
): Capability {
  return {
    id: `cap_${name.replace(/[^a-z0-9]+/gi, "_")}` as CapabilityId,
    name,
    version: 1,
    readsInterfaces: [],
    writesInterfaces,
    readsEdges: [],
    writesEdges: [],
    emits: [],
    subscribesTo: [],
    requiredPermissions: [],
    description: "test fixture",
  };
}

function replayBindingRecord(
  record: WriteBindingReplayRecord,
  catalog: EvidenceBindingReferenceCatalog,
) {
  if (record.invocationEvidenceBinding === null) {
    return validateInvocationEvidenceBinding({
      capabilityWrites: record.capabilityWrites,
      evidenceBindingRequired: record.bindingMode === "require_for_writes",
      evidenceBinding: record.invocationEvidenceBinding,
    });
  }

  return verifyInvocationEvidenceBindingAgainstCatalog({
    request: {
      tenantId: record.tenantId,
      workflowId: record.workflowId,
      workflowName: record.workflowName,
      workflowVersion: record.workflowVersion,
      nodeId: record.nodeId,
      capability: record.capability,
      inputs: {},
      capabilityWrites: record.capabilityWrites,
      triggerEventId: record.triggerEventId,
    },
    evidenceBinding: record.invocationEvidenceBinding,
    catalog,
  });
}
