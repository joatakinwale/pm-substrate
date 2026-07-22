import { describe, expect, it } from "vitest";

import {
  computeOverallScore,
  renderReviewReportHtml,
  REVIEW_REPORT,
} from "./review-report-page.js";

describe("validation review page renderer", () => {
  it("renders every report section deterministically", () => {
    const html = renderReviewReportHtml(REVIEW_REPORT);
    for (const section of [
      "header",
      "integrity-verdict",
      "counts",
      "executive-summary",
      "verification",
      "traceability",
      "false-positives",
      "gaps",
      "fixes",
      "assessment",
      "limitations",
    ]) {
      expect(html).toContain(`data-section="${section}"`);
    }
  });

  it("reports the fabrication verdict without an efficacy claim", () => {
    const html = renderReviewReportHtml(REVIEW_REPORT);
    expect(html).toContain("NOT FAKED");
    expect(html).toContain("not_eligible");
    // The page must never assert demonstrated efficacy.
    expect(html).not.toContain("efficacy proven");
    expect(html).toContain("no eligible outcome data exists yet");
  });

  it("renders all findings with severity badges and evidence", () => {
    const html = renderReviewReportHtml(REVIEW_REPORT);
    for (const finding of [...REVIEW_REPORT.falsePositives, ...REVIEW_REPORT.gaps]) {
      expect(html).toContain(`data-finding="${finding.id}"`);
      expect(html).toContain(`rv-sev-${finding.severity}`);
    }
    expect(html).toContain("arm === &quot;substrate&quot;");
    expect(html).toContain("48e1695b");
    expect(html).toContain("0.511210781855188");
  });

  it("computes the weighted overall score from the rubric", () => {
    const overall = computeOverallScore(REVIEW_REPORT.rubric);
    expect(overall).toBeCloseTo(56.25, 5);
    const html = renderReviewReportHtml(REVIEW_REPORT);
    expect(html).toContain(`${overall.toFixed(1)}%`);
  });

  it("keeps rubric weights summing to 100", () => {
    const total = REVIEW_REPORT.rubric.reduce((sum, row) => sum + row.weightPct, 0);
    expect(total).toBe(100);
  });

  it("marks ledger-resident claims as unverified", () => {
    const html = renderReviewReportHtml(REVIEW_REPORT);
    expect(html).toContain("Unverified");
    expect(html).toContain("unreachable from the audit sandbox");
  });

  it("escapes HTML in report content", () => {
    const html = renderReviewReportHtml({
      ...REVIEW_REPORT,
      executiveSummary: [`<script>alert("x")</script>`],
    });
    expect(html).not.toContain(`<script>alert`);
    expect(html).toContain("&lt;script&gt;");
  });
});
