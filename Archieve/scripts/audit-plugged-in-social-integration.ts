#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildPluggedInSocialIntegrationAudit,
  type PluggedInSocialClientReportSnapshot,
  type PluggedInSocialIntegrationAudit,
  type PluggedInSocialIntegrationAuditInput,
} from "../packages/profile-agency/src/index.js";

export interface PluggedInSocialAuditFileInput {
  readonly reportPath: string;
  readonly outPath: string;
  readonly tenantId: string;
  readonly observedAt: string;
  readonly stateReviewArtifactHash: string;
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
  readonly maxEvidenceAgeMs?: number;
}

export interface PluggedInSocialAuditFileSummary {
  readonly ready: boolean;
  readonly blockers: readonly string[];
  readonly verifiedAxes: readonly string[];
  readonly unverifiedAxes: readonly string[];
  readonly marketingVerifiedFailureClasses: readonly string[];
}

export interface PluggedInSocialAuditFileResult {
  readonly generatedAt: string;
  readonly ready: boolean;
  readonly outPath: string;
  readonly summary: PluggedInSocialAuditFileSummary;
  readonly audit: PluggedInSocialIntegrationAudit;
}

export async function auditPluggedInSocialIntegrationFile(
  input: PluggedInSocialAuditFileInput,
): Promise<PluggedInSocialAuditFileResult> {
  assertSha256(input.stateReviewArtifactHash);
  const report = JSON.parse(
    readFileSync(input.reportPath, "utf8"),
  ) as PluggedInSocialClientReportSnapshot;
  const audit = buildPluggedInSocialIntegrationAudit({
    tenantId: input.tenantId as PluggedInSocialIntegrationAuditInput["tenantId"],
    observedAt:
      input.observedAt as PluggedInSocialIntegrationAuditInput["observedAt"],
    report,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    ...(input.workspaceRoot === undefined
      ? {}
      : { workspaceRoot: input.workspaceRoot }),
    ...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
    ...(input.maxEvidenceAgeMs === undefined
      ? {}
      : { maxEvidenceAgeMs: input.maxEvidenceAgeMs }),
  });
  const result: PluggedInSocialAuditFileResult = {
    generatedAt: input.observedAt,
    ready: audit.ready,
    outPath: input.outPath,
    summary: {
      ready: audit.ready,
      blockers: audit.blockers,
      verifiedAxes: audit.axisB.proofPacket.verifiedAxes,
      unverifiedAxes: audit.axisB.proofPacket.unverifiedAxes,
      marketingVerifiedFailureClasses:
        audit.axisB.proofPacket.report.byAxis.marketing.verifiedFailureClasses,
    },
    audit,
  };

  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function assertSha256(hash: string): void {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("--state-review-artifact-hash must be a 64-character sha256");
  }
}

function parseArgs(argv: readonly string[]): PluggedInSocialAuditFileInput {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(usage());
    }
    args.set(key, value);
  }

  const reportPath = args.get("--report");
  const outPath = args.get("--out");
  const tenantId = args.get("--tenant");
  const observedAt = args.get("--observed-at");
  const stateReviewArtifactHash = args.get("--state-review-artifact-hash");
  if (
    !reportPath ||
    !outPath ||
    !tenantId ||
    !observedAt ||
    !stateReviewArtifactHash
  ) {
    throw new Error(usage());
  }

  const maxEvidenceAgeMs = args.get("--max-evidence-age-ms");

  return {
    reportPath: resolve(reportPath),
    outPath: resolve(outPath),
    tenantId,
    observedAt,
    stateReviewArtifactHash,
    ...(args.has("--workspace-root")
      ? { workspaceRoot: resolve(args.get("--workspace-root")!) }
      : {}),
    ...(args.has("--source-path") ? { sourcePath: args.get("--source-path")! } : {}),
    ...(maxEvidenceAgeMs === undefined
      ? {}
      : { maxEvidenceAgeMs: Number(maxEvidenceAgeMs) }),
  };
}

function usage(): string {
  return [
    "usage: tsx scripts/audit-plugged-in-social-integration.ts",
    "--report <client-report-json>",
    "--out <audit-json>",
    "--tenant <tenant-id>",
    "--observed-at <iso>",
    "--state-review-artifact-hash <sha256>",
    "[--workspace-root <path>]",
    "[--source-path <path>]",
    "[--max-evidence-age-ms <number>]",
  ].join(" ");
}

async function main(): Promise<void> {
  const result = await auditPluggedInSocialIntegrationFile(
    parseArgs(process.argv.slice(2)),
  );
  console.log(JSON.stringify(result.summary));
  if (!result.ready) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
