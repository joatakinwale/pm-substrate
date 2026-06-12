import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  analyzeWriteBindingReplayRecords,
  buildArrowHedgeWriteBindingReplayCorpus,
} from "./write-binding.js";

describe("write-binding replay corpus", () => {
  it("generates an ArrowHedge corpus that covers allowed, missing, incomplete, and policy-blocked write attempts", () => {
    const corpus = buildArrowHedgeWriteBindingReplayCorpus();

    expect(corpus.records.map((record) => record.decision)).toEqual([
      "allowed",
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
      totalRecords: 5,
      allowed: 1,
      blocked: 4,
      completeBindings: 3,
      missingBindings: 1,
      incompleteBindings: 1,
      policyBlocked: 2,
      rejectedEvidenceReferences: 1,
      replayHashCoverage: 1,
      highConsequenceRecords: 5,
    });
    expect(metrics.byDecision).toEqual({
      allowed: 1,
      blocked_missing_binding: 1,
      blocked_incomplete_binding: 1,
      blocked_policy: 2,
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
});
