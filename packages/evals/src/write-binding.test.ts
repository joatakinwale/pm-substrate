import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingReferenceCatalog,
} from "@pm/workflow";

import {
  analyzeWriteBindingReplayRecords,
  analyzeWriteTransportBindingCoverage,
  buildArrowHedgeWriteBindingReplayCorpus,
  buildEvidenceBindingReferenceCatalogFromReplayCorpora,
  buildFixtureWriteTransportBindingCoverageSamples,
  importWriteBindingReplayRecordsJsonl,
  type WriteBindingReplayRecord,
} from "./write-binding.js";

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
      rejectedEvidenceReferences: 1,
      replayHashCoverage: 1,
      highConsequenceRecords: 6,
    });
    expect(metrics.byDecision).toEqual({
      allowed: 1,
      blocked_missing_binding: 1,
      blocked_incomplete_binding: 1,
      blocked_policy: 2,
      blocked_unverified_binding: 1,
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
    expect(report.byDisposition).toEqual({
      advisory_only: 1,
      missing_provider: 1,
      required_verified: 2,
    });
    expect(report.samples.map((sample) => sample.transportId)).toContain(
      "agency.lead.promote",
    );
  });
});

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
