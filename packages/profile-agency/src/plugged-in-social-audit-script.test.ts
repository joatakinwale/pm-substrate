import { existsSync } from "node:fs";

/** Live-tree tests skip when the (now external) PluggedInSocial checkout is absent. */
const PLUGGED_IN_SOCIAL_AVAILABLE = existsSync(
  process.env["PM_PLUGGED_IN_SOCIAL_DIR"] ?? "./plugged_in_social",
);

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FAILURE_CLASSES } from "@pm/evals";

import {
  auditPluggedInSocialIntegrationFile,
  type PluggedInSocialAuditFileResult,
} from "../../../scripts/audit-plugged-in-social-integration.js";
import type { PluggedInSocialClientReportSnapshot } from "./index.js";

const tempDirs: string[] = [];

const report: PluggedInSocialClientReportSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  project_id: "33333333-3333-4333-8333-333333333333",
  title: "Summer pipeline report",
  status: "generated",
  period_start: "2026-06-24",
  period_end: "2026-07-01",
  pdf_generated_at: "2026-07-01T17:45:00.000Z",
  metrics_observed_at: "2026-07-01T17:30:00.000Z",
  metrics_snapshot: {
    total_reach: 400,
    avg_engagement_rate: 7.3,
    qualified_leads_generated: 18,
    total_ad_spend_cents: 12_500,
  },
};

describe("PluggedInSocial audit script", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!PLUGGED_IN_SOCIAL_AVAILABLE)("writes a durable JSON audit artifact from a ClientReport snapshot", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pis-audit-"));
    tempDirs.push(tempDir);
    const reportPath = join(tempDir, "client-report.json");
    const outPath = join(tempDir, "artifacts", "audit.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const result = await auditPluggedInSocialIntegrationFile({
      reportPath,
      outPath,
      tenantId: "tnt_plugged_in_social_script",
      observedAt: "2026-07-01T19:15:00.000Z",
      stateReviewArtifactHash: "b".repeat(64),
      workspaceRoot: process.cwd(),
    });
    const artifact = JSON.parse(
      readFileSync(outPath, "utf8"),
    ) as PluggedInSocialAuditFileResult;

    expect(result.ready).toBe(true);
    expect(result.outPath).toBe(outPath);
    expect(artifact.ready).toBe(true);
    expect(artifact.audit.sourceId).toBe("plugged_in_social");
    expect(artifact.audit.withoutSubstrate.governed).toBe(false);
    expect(artifact.audit.withSubstrate.governed).toBe(true);
    expect(artifact.audit.withSubstrate.verifiedFailureClasses).toEqual(
      FAILURE_CLASSES,
    );
    expect(artifact.summary).toEqual({
      ready: true,
      blockers: [],
      verifiedAxes: ["marketing"],
      unverifiedAxes: ["finance", "local_lab"],
      marketingVerifiedFailureClasses: FAILURE_CLASSES,
    });
  });

  it("rejects audit artifacts without a hash-shaped state review artifact id", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pis-audit-"));
    tempDirs.push(tempDir);
    const reportPath = join(tempDir, "client-report.json");
    const outPath = join(tempDir, "artifacts", "audit.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    await expect(
      auditPluggedInSocialIntegrationFile({
        reportPath,
        outPath,
        tenantId: "tnt_plugged_in_social_script",
        observedAt: "2026-07-01T19:15:00.000Z",
        stateReviewArtifactHash: "not-a-sha256",
        workspaceRoot: process.cwd(),
      }),
    ).rejects.toThrow("--state-review-artifact-hash must be a 64-character sha256");
    expect(existsSync(outPath)).toBe(false);
  });
});
