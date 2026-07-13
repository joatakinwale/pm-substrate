import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  PinnedSourceVerificationResult,
  PublicEvalCornerId,
} from "./index.js";

export interface QualificationPlan {
  readonly schemaVersion: "pm.public-eval-qualification-plan.v1";
  readonly cornerId: PublicEvalCornerId;
  readonly qualificationScope: "adapter-and-oracle-plumbing-only";
  readonly upstreamOracleInvoked: true;
  readonly efficacyClaimed: false;
  readonly commandTemplate: readonly string[];
  readonly requiredExternalSourceIds: readonly string[];
  readonly requiredRunnerOptions: readonly string[];
  readonly protectedLocalAccess: "not-needed" | "explicit-opt-in";
  readonly rawOutputPolicy: string;
}

export interface QualificationRequest {
  readonly cornerId: PublicEvalCornerId;
  readonly checkoutPath: string;
  readonly outputDirectory: string;
  readonly externalFiles?: Readonly<Record<string, string>>;
  readonly runnerOptions?: Readonly<Record<string, string>>;
  readonly allowProtectedLocal?: boolean;
}

export interface QualificationReceipt {
  readonly schemaVersion: "pm.public-eval-qualification-receipt.v1";
  readonly artifactLabel: {
    readonly schemaVersion: "pm.public-eval-artifact-label.v1";
    readonly artifactId: string;
    readonly cornerId: PublicEvalCornerId;
    readonly label: "pm-derived-diagnostic";
    readonly claimScope: "oracle-diagnostic";
    readonly distribution: "local-derived";
    readonly containsUpstreamTaskData: false;
    readonly containsProtectedContent: false;
    readonly nonGating: true;
    readonly derivation: string;
  };
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly qualificationScope: "adapter-and-oracle-plumbing-only";
  readonly efficacyClaimed: false;
  readonly status: "qualified" | "blocked" | "failed";
  readonly sourceVerification: {
    readonly valid: boolean;
    readonly sha256: string;
  };
  readonly runner: {
    readonly command: string;
    readonly arguments: readonly string[];
    readonly exitCode: number | null;
    readonly stdoutPath: string;
    readonly stdoutSha256: string;
    readonly stderrPath: string;
    readonly stderrSha256: string;
  };
  readonly safeSummary: Readonly<Record<string, unknown>> | null;
  readonly blockers: readonly string[];
  readonly receiptHash: string;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER_ROOT = resolve(PACKAGE_ROOT, "runners");

const PLANS: Readonly<Record<PublicEvalCornerId, QualificationPlan>> = {
  "memoryagentbench-factconsolidation-6k": {
    schemaVersion: "pm.public-eval-qualification-plan.v1",
    cornerId: "memoryagentbench-factconsolidation-6k",
    qualificationScope: "adapter-and-oracle-plumbing-only",
    upstreamOracleInvoked: true,
    efficacyClaimed: false,
    commandTemplate: [
      "uv", "run", "--python", "3.10", "--with", "pyarrow", "--with", "numpy",
      "--with", "nltk", "--with", "tiktoken", "--with", "rouge-score", "--with",
      "editdistance", "python", "<package>/runners/mab_qualify.py", "--checkout",
      "<checkout>", "--parquet", "<mab-conflict-parquet>",
    ],
    requiredExternalSourceIds: ["mab-conflict-parquet"],
    requiredRunnerOptions: [],
    protectedLocalAccess: "not-needed",
    rawOutputPolicy: "stdout/stderr and their hashes are written outside Git; receipt embeds aggregate counts only.",
  },
  "tau2-airline-32": {
    schemaVersion: "pm.public-eval-qualification-plan.v1",
    cornerId: "tau2-airline-32",
    qualificationScope: "adapter-and-oracle-plumbing-only",
    upstreamOracleInvoked: true,
    efficacyClaimed: false,
    commandTemplate: [
      "uv", "run", "--project", "<checkout>", "--python", "3.12", "python",
      "<package>/runners/tau2_qualify.py", "--checkout", "<checkout>",
    ],
    requiredExternalSourceIds: [],
    requiredRunnerOptions: [],
    protectedLocalAccess: "not-needed",
    rawOutputPolicy: "stdout/stderr and hashes stay outside Git; no reservation arguments or response bodies enter receipts.",
  },
  "appworld-22cc237_2": {
    schemaVersion: "pm.public-eval-qualification-plan.v1",
    cornerId: "appworld-22cc237_2",
    qualificationScope: "adapter-and-oracle-plumbing-only",
    upstreamOracleInvoked: true,
    efficacyClaimed: false,
    commandTemplate: [
      "uv", "run", "--project", "<checkout>", "--python", "3.11", "python",
      "<package>/runners/appworld_qualify.py", "--checkout", "<checkout>",
      "--data-root", "<appworldDataRoot>", "--allow-local-unpack",
    ],
    requiredExternalSourceIds: [],
    requiredRunnerOptions: ["appworldDataRoot"],
    protectedLocalAccess: "explicit-opt-in",
    rawOutputPolicy: "all decrypted data, experiment DBs, logs, and raw output remain outside Git; receipt contains only counts/hashes.",
  },
  "sentinel-microhub-stars": {
    schemaVersion: "pm.public-eval-qualification-plan.v1",
    cornerId: "sentinel-microhub-stars",
    qualificationScope: "adapter-and-oracle-plumbing-only",
    upstreamOracleInvoked: true,
    efficacyClaimed: false,
    commandTemplate: [
      "uv", "run", "--python", "3.11", "--with-requirements",
      "<checkout>/server/requirements.txt", "--with", "httpx", "python",
      "<package>/runners/sentinel_qualify.py", "--checkout", "<checkout>",
    ],
    requiredExternalSourceIds: [],
    requiredRunnerOptions: [],
    protectedLocalAccess: "not-needed",
    rawOutputPolicy: "stdout/stderr and hashes stay outside Git; scenario prompts and event payloads are never copied into receipts.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite value in qualification receipt");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported qualification receipt value ${typeof value}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function workspaceRoot(): string {
  try {
    return execFileSync("git", ["-C", PACKAGE_ROOT, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return PACKAGE_ROOT;
  }
}

function isWithin(root: string, target: string): boolean {
  const path = relative(resolve(root), resolve(target));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function assertExternalOutputDirectory(outputDirectory: string): string {
  const output = resolve(outputDirectory);
  if (isWithin(workspaceRoot(), output)) {
    throw new Error("qualification outputDirectory must be outside the Git workspace (use /tmp or another external path)");
  }
  mkdirSync(output, { recursive: true });
  return output;
}

function safeSummary(value: unknown, cornerId: PublicEvalCornerId): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new Error("qualification runner stdout must be one JSON object");
  if (value.qualificationStatus !== "qualified" || value.cornerId !== cornerId) {
    throw new Error("qualification runner returned an unexpected status or cornerId");
  }
  const forbiddenKey = /(?:question|answer|prompt|context|private|argument|response|database|taskdata)/iu;
  const visit = (child: unknown, path: string): void => {
    if (typeof child === "string" && child.length > 512) throw new Error(`${path} is too large for a license-safe receipt`);
    if (Array.isArray(child)) child.forEach((entry, index) => visit(entry, `${path}[${index}]`));
    else if (isRecord(child)) {
      for (const [key, entry] of Object.entries(child)) {
        if (forbiddenKey.test(key)) throw new Error(`${path}.${key} is forbidden in a license-safe receipt`);
        visit(entry, `${path}.${key}`);
      }
    }
  };
  visit(value, "safeSummary");
  if (canonical(value).length > 16_384) throw new Error("qualification summary exceeds the receipt size limit");
  return value;
}

function executionCommand(request: QualificationRequest): { command: string; arguments: string[]; blockers: string[] } {
  const checkout = resolve(request.checkoutPath);
  const blockers: string[] = [];
  const runner = (name: string): string => resolve(RUNNER_ROOT, name);
  switch (request.cornerId) {
    case "memoryagentbench-factconsolidation-6k": {
      const parquet = request.externalFiles?.["mab-conflict-parquet"];
      if (!parquet) blockers.push("missing required external source mab-conflict-parquet");
      return {
        command: "uv",
        arguments: [
          "run", "--python", "3.10", "--with", "pyarrow", "--with", "numpy",
          "--with", "nltk", "--with", "tiktoken", "--with", "rouge-score", "--with",
          "editdistance", "python", runner("mab_qualify.py"), "--checkout", checkout,
          "--parquet", resolve(parquet ?? "missing"),
        ],
        blockers,
      };
    }
    case "tau2-airline-32":
      return {
        command: "uv",
        arguments: [
          "run", "--project", checkout, "--python", "3.12", "python",
          runner("tau2_qualify.py"), "--checkout", checkout,
        ],
        blockers,
      };
    case "sentinel-microhub-stars":
      return {
        command: "uv",
        arguments: [
          "run", "--python", "3.11", "--with-requirements",
          resolve(checkout, "server/requirements.txt"), "--with", "httpx", "python",
          runner("sentinel_qualify.py"), "--checkout", checkout,
        ],
        blockers,
      };
    case "appworld-22cc237_2": {
      const dataRoot = request.runnerOptions?.appworldDataRoot;
      if (!dataRoot) blockers.push("missing required runner option appworldDataRoot");
      if (request.allowProtectedLocal !== true) {
        blockers.push("AppWorld qualification requires explicit --allow-protected-local opt-in");
      }
      return {
        command: "uv",
        arguments: [
          "run", "--project", checkout, "--python", "3.11", "python",
          runner("appworld_qualify.py"), "--checkout", checkout, "--data-root",
          resolve(dataRoot ?? "missing"), "--allow-local-unpack",
        ],
        blockers,
      };
    }
  }
}

export function buildQualificationPlan(cornerId: PublicEvalCornerId): QualificationPlan {
  return PLANS[cornerId];
}

export function executeQualification(
  request: QualificationRequest,
  manifestSha256: string,
  sourceVerification: PinnedSourceVerificationResult,
): QualificationReceipt {
  const output = assertExternalOutputDirectory(request.outputDirectory);
  const plan = buildQualificationPlan(request.cornerId);
  const invocation = executionCommand(request);
  const blockers = [...invocation.blockers];
  if (!sourceVerification.valid) blockers.push("pinned source verification failed");

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let parsedSummary: Readonly<Record<string, unknown>> | null = null;
  if (blockers.length === 0) {
    const result = spawnSync(invocation.command, invocation.arguments, {
      cwd: resolve(request.checkoutPath),
      encoding: "utf8",
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      maxBuffer: 64 * 1024 * 1024,
    });
    stdout = result.stdout ?? "";
    stderr = `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
    exitCode = result.status;
    if (result.error) blockers.push("qualification runner could not be started; inspect stderr hash/path");
    else if (result.status === 2) blockers.push("qualification runner reported a dependency/data/license blocker");
    else if (result.status !== 0) blockers.push("qualification runner failed; inspect stderr hash/path");
    else {
      try {
        parsedSummary = safeSummary(JSON.parse(stdout.trim()) as unknown, request.cornerId);
      } catch (error) {
        blockers.push(error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    stderr = blockers.join("\n");
  }

  const stdoutPath = resolve(output, `${request.cornerId}.stdout.txt`);
  const stderrPath = resolve(output, `${request.cornerId}.stderr.txt`);
  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, stderr);
  const status: QualificationReceipt["status"] =
    parsedSummary !== null && blockers.length === 0
      ? "qualified"
      : exitCode === 2 || exitCode === null
        ? "blocked"
        : "failed";
  const artifactId = `${request.cornerId}-qualification-${sha256(`${manifestSha256}:${sha256(stdout)}:${sha256(stderr)}`).slice(0, 16)}`;
  const unsigned = {
    schemaVersion: "pm.public-eval-qualification-receipt.v1" as const,
    artifactLabel: {
      schemaVersion: "pm.public-eval-artifact-label.v1" as const,
      artifactId,
      cornerId: request.cornerId,
      label: "pm-derived-diagnostic" as const,
      claimScope: "oracle-diagnostic" as const,
      distribution: "local-derived" as const,
      containsUpstreamTaskData: false as const,
      containsProtectedContent: false as const,
      nonGating: true as const,
      derivation: "Local upstream-oracle plumbing qualification; raw data remains external and content-addressed.",
    },
    cornerId: request.cornerId,
    manifestSha256,
    qualificationScope: plan.qualificationScope,
    efficacyClaimed: false as const,
    status,
    sourceVerification: {
      valid: sourceVerification.valid,
      sha256: sha256(canonical(sourceVerification)),
    },
    runner: {
      command: invocation.command,
      arguments: invocation.arguments,
      exitCode,
      stdoutPath,
      stdoutSha256: sha256(stdout),
      stderrPath,
      stderrSha256: sha256(stderr),
    },
    safeSummary: parsedSummary,
    blockers,
  };
  const receipt: QualificationReceipt = {
    ...unsigned,
    receiptHash: sha256(canonical(unsigned)),
  };
  writeFileSync(
    resolve(output, `${request.cornerId}.qualification-receipt.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  return receipt;
}
