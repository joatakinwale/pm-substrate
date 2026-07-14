import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  planBehavioralBatch as planBehavioralBatchRuntime,
  runBehavioralBatch as runBehavioralBatchRuntime,
  verifyBehavioralBatch as verifyBehavioralBatchRuntime,
  type BehavioralBatchInput,
  type BehavioralBatchPlan,
  type BehavioralBatchReceipt,
  type BehavioralBatchVerification,
  type BehavioralCommandInput,
  type BehavioralConfigInput,
  type BehavioralEvidenceClass,
  type BehavioralFileIdentity,
  type BehavioralModelIdentity,
  type BehavioralOracleInvocationVerification,
  type BehavioralPlanResult,
  type BehavioralTreatmentDelta,
  type BehavioralTrialInput,
} from "./behavioral.js";
import {
  buildQualificationPlan,
  executeQualification,
  type QualificationPlan,
  type QualificationReceipt,
  type QualificationRequest,
} from "./qualification.js";

export type {
  QualificationPlan,
  QualificationReceipt,
  QualificationRequest,
} from "./qualification.js";

export type {
  BehavioralBatchInput,
  BehavioralBatchPlan,
  BehavioralBatchReceipt,
  BehavioralBatchVerification,
  BehavioralCommandInput,
  BehavioralConfigInput,
  BehavioralEvidenceClass,
  BehavioralFileIdentity,
  BehavioralModelIdentity,
  BehavioralOracleInvocationVerification,
  BehavioralPlanResult,
  BehavioralTreatmentDelta,
  BehavioralTrialInput,
} from "./behavioral.js";

export type PublicEvalCornerId =
  | "memoryagentbench-factconsolidation-6k"
  | "tau2-airline-32"
  | "appworld-22cc237_2"
  | "sentinel-microhub-stars";

export type ArtifactOriginLabel =
  | "upstream-original"
  | "pm-synthetic-conformance"
  | "pm-derived-diagnostic";

export type ClaimScope =
  | "source-integrity"
  | "adapter-conformance"
  | "oracle-diagnostic"
  | "behavioral-efficacy";

export interface PinnedSourceFile {
  readonly sourceId: string;
  readonly location: "checkout" | "external";
  readonly path: string;
  readonly sha256: string;
  readonly redistribution: "upstream-reference-only" | "mit" | "apache-2.0";
}

export interface PublicEvalCornerManifest {
  readonly schemaVersion: "pm.public-eval-corner-manifest.v1";
  readonly cornerId: PublicEvalCornerId;
  readonly benchmarkName: string;
  readonly adapterStatus: "source-and-conformance-only";
  readonly claimBoundary: string;
  readonly upstream: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly version: string;
    readonly license: {
      readonly spdx: "MIT" | "Apache-2.0";
      readonly additionalTerms: string | null;
      readonly vendoringPolicy: string;
    };
    readonly additionalPins: readonly {
      readonly source: string;
      readonly revision: string;
      readonly license: string;
    }[];
  };
  readonly tasks: readonly {
    readonly taskId: string;
    readonly role: string;
  }[];
  readonly sourceCoverage: string;
  readonly sources: readonly PinnedSourceFile[];
  readonly oracle: {
    readonly owner: "upstream";
    readonly primaryKind: string;
    readonly deterministic: boolean;
    readonly primaryFields: readonly string[];
    readonly limitations: readonly string[];
  };
  readonly execution: {
    readonly locallyCheckableNow: readonly string[];
    readonly credentialGates: readonly string[];
    readonly environmentCost: string;
  };
  readonly artifactPolicy: {
    readonly allowedLabels: readonly ArtifactOriginLabel[];
    readonly prohibitedPackageContent: readonly string[];
    readonly generatedArtifactsAreNonGating: true;
  };
}

export interface ManifestEnvelope {
  readonly manifest: PublicEvalCornerManifest;
  readonly manifestSha256: string;
}

export interface FileExpectation {
  readonly sourceId: string;
  readonly relativePath: string;
  readonly sha256: string;
}

export interface FileSetVerificationRequest {
  readonly rootPath: string;
  readonly expectedFiles: readonly FileExpectation[];
}

export interface FileVerification {
  readonly sourceId: string;
  readonly path: string;
  readonly expectedSha256: string;
  readonly actualSha256: string | null;
  readonly valid: boolean;
  readonly issue: string | null;
}

export interface FileSetVerificationResult {
  readonly schemaVersion: "pm.public-eval-file-verification.v1";
  readonly valid: boolean;
  readonly files: readonly FileVerification[];
  readonly issues: readonly string[];
}

export interface PinnedSourceVerificationRequest {
  readonly cornerId: PublicEvalCornerId;
  readonly checkoutPath: string;
  readonly externalFiles?: Readonly<Record<string, string>>;
}

export interface PinnedSourceVerificationResult {
  readonly schemaVersion: "pm.public-eval-source-verification.v1";
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly valid: boolean;
  readonly repository: {
    readonly expectedUrl: string;
    readonly actualUrl: string | null;
    readonly expectedRevision: string;
    readonly actualRevision: string | null;
    readonly valid: boolean;
  };
  readonly files: readonly FileVerification[];
  readonly sourceCoverage: string;
  readonly issues: readonly string[];
}

export interface ArtifactLabelEnvelope {
  readonly schemaVersion: "pm.public-eval-artifact-label.v1";
  readonly artifactId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly label: ArtifactOriginLabel;
  readonly claimScope: ClaimScope;
  readonly distribution:
    | "external-reference"
    | "package-synthetic"
    | "local-derived";
  readonly containsUpstreamTaskData: boolean;
  readonly containsProtectedContent: boolean;
  readonly nonGating: boolean;
  readonly derivation?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface SyntheticFixtureResult {
  readonly schemaVersion: "pm.public-eval-synthetic-conformance-result.v1";
  readonly fixtureId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly passed: boolean;
  readonly claimScope: "adapter-conformance";
  readonly efficacyClaimed: false;
  readonly caseResults: readonly {
    readonly caseId: string;
    readonly passed: boolean;
    readonly details: Readonly<Record<string, unknown>>;
  }[];
  readonly caveats: readonly string[];
}

export interface AppWorldProjectionDiagnosticInput {
  readonly expectedByReceiver: Readonly<Record<string, number>>;
  readonly addedRequests: readonly {
    readonly receiverId: string;
    readonly amount: number;
  }[];
  readonly amountTolerance: number;
}

export interface AppWorldProjectionDiagnostic {
  readonly schemaVersion: "pm.public-eval.appworld-duplicate-diagnostic.v1";
  readonly mappingProjectionMatches: boolean;
  readonly recordMultiplicityMatches: boolean;
  readonly duplicateReceiverIds: readonly string[];
  readonly projectionMayHideDuplicate: boolean;
  readonly upstreamOracleRemainsAuthoritative: true;
  readonly nonGating: true;
}

type JsonRecord = Record<string, unknown>;

const SHA256 = /^[a-f0-9]{64}$/u;
const PORTABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const ASCII_PUNCTUATION = new Set(
  [...`!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`],
);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(canonicalJson(value));
}

function normalizedRemote(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "").replace(/\.git$/u, "");
  const ssh = /^git@([^:]+):(.+)$/u.exec(trimmed);
  return (ssh ? `https://${ssh[1]}/${ssh[2]}` : trimmed).toLowerCase();
}

function checkoutValue(checkoutPath: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", checkoutPath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function requiredRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

function requiredFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function requiredArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function requiredCornerId(value: unknown, path: string): PublicEvalCornerId {
  const parsed = requiredString(value, path);
  if (!MANIFEST_BY_ID.has(parsed as PublicEvalCornerId)) {
    throw new Error(`${path} is not a supported corner id`);
  }
  return parsed as PublicEvalCornerId;
}

const MANIFESTS = deepFreeze([
  {
    schemaVersion: "pm.public-eval-corner-manifest.v1",
    cornerId: "memoryagentbench-factconsolidation-6k",
    benchmarkName: "MemoryAgentBench FactConsolidation",
    adapterStatus: "source-and-conformance-only",
    claimBoundary:
      "Source integrity and synthetic scorer conformance only; this manifest does not establish memory-agent efficacy.",
    upstream: {
      repositoryUrl: "https://github.com/HUST-AI-HYZ/MemoryAgentBench",
      revision: "455306dcabc3842526eb83cd4e225e5d486c5c5d",
      version: "repository-snapshot",
      license: {
        spdx: "MIT",
        additionalTerms: null,
        vendoringPolicy: "Reference pinned upstream sources; package only PM-authored synthetic fixtures.",
      },
      additionalPins: [
        {
          source: "https://huggingface.co/datasets/ai-hyz/MemoryAgentBench",
          revision: "7ea066982b140a19337e17e60d45d4076e042faf",
          license: "MIT",
        },
      ],
    },
    tasks: [
      { taskId: "factconsolidation_sh_6k", role: "single-hop supersession" },
      { taskId: "factconsolidation_mh_6k", role: "multi-hop supersession" },
    ],
    sourceCoverage: "Pinned runner configuration, compatible scorer, and Conflict Resolution parquet.",
    sources: [
      {
        sourceId: "mab-sh-6k-config",
        location: "checkout",
        path: "configs/data_conf/Conflict_Resolution/Factconsolidation_sh_6k.yaml",
        sha256: "814bf2eca1d07018262a860819db8fc7ddcb7d1a866839caec53ef2993c625e6",
        redistribution: "mit",
      },
      {
        sourceId: "mab-mh-6k-config",
        location: "checkout",
        path: "configs/data_conf/Conflict_Resolution/Factconsolidation_mh_6k.yaml",
        sha256: "63312c1dd54a06490f3747e97632d39284ec8eeba2128ee5c599dae72defa6fc",
        redistribution: "mit",
      },
      {
        sourceId: "mab-compatible-scorer",
        location: "checkout",
        path: "utils/eval_other_utils.py",
        sha256: "d77976be409298970614d477a9d8003850caddb0510e56a7e821a037d98493a2",
        redistribution: "mit",
      },
      {
        sourceId: "mab-conflict-parquet",
        location: "external",
        path: "data/Conflict_Resolution-00000-of-00001.parquet",
        sha256: "24d5c3f09ce0ce15625cb9f8a98f44f0d864ca6c94d7b4ad04eb697ca3a5ff45",
        redistribution: "upstream-reference-only",
      },
    ],
    oracle: {
      owner: "upstream",
      primaryKind: "normalized ground-truth substring match",
      deterministic: true,
      primaryFields: ["substring_exact_match"],
      limitations: [
        "A verbose prediction containing the answer can pass; exact match must remain a non-gating diagnostic.",
        "The external compatible slice is not an official leaderboard run until runner parity is demonstrated.",
      ],
    },
    execution: {
      locallyCheckableNow: ["source hashes", "parquet schema", "synthetic scorer semantics"],
      credentialGates: ["behavioral answer generation requires a local or provider model"],
      environmentCost: "The full upstream runner is GPU/CUDA-biased and intentionally excluded from this package.",
    },
    artifactPolicy: {
      allowedLabels: ["upstream-original", "pm-synthetic-conformance", "pm-derived-diagnostic"],
      prohibitedPackageContent: ["upstream questions", "upstream answers", "upstream contexts"],
      generatedArtifactsAreNonGating: true,
    },
  },
  {
    schemaVersion: "pm.public-eval-corner-manifest.v1",
    cornerId: "tau2-airline-32",
    benchmarkName: "tau2 airline",
    adapterStatus: "source-and-conformance-only",
    claimBoundary:
      "Source integrity and synthetic exact-state conformance only; no live user/agent result is included.",
    upstream: {
      repositoryUrl: "https://github.com/sierra-research/tau2-bench",
      revision: "1901a301961cbbe3fd11f3e84a2a376530c759e3",
      version: "1.0.0",
      license: {
        spdx: "MIT",
        additionalTerms: null,
        vendoringPolicy: "Reference the pinned task in an external checkout; do not copy its task JSON.",
      },
      additionalPins: [],
    },
    tasks: [{ taskId: "airline:32", role: "two separately committed reservation transitions" }],
    sourceCoverage: "Pinned task corpus, DB evaluator, agent interface, and low-level simulation entry point.",
    sources: [
      {
        sourceId: "tau2-airline-tasks",
        location: "checkout",
        path: "data/tau2/domains/airline/tasks.json",
        sha256: "ccd8ba737b4cc371415af70151187788f728d6108d0916e73bb4317b40542052",
        redistribution: "mit",
      },
      {
        sourceId: "tau2-db-evaluator",
        location: "checkout",
        path: "src/tau2/evaluator/evaluator_env.py",
        sha256: "e932ea5f675d7a172557350f30b73d66474659d9b4d976ecd763ca2929017633",
        redistribution: "mit",
      },
      {
        sourceId: "tau2-half-duplex-agent",
        location: "checkout",
        path: "src/tau2/agent/base_agent.py",
        sha256: "97f1033723d03da99f3338ff7a12ed60114a55ed293928ff4ca0bdace6851b4d",
        redistribution: "mit",
      },
      {
        sourceId: "tau2-run-simulation",
        location: "checkout",
        path: "src/tau2/runner/simulation.py",
        sha256: "1b98532199a05d87dcc14aead9d59c320d20f11d3d8e4c8458663ed5964eafef",
        redistribution: "mit",
      },
    ],
    oracle: {
      owner: "upstream",
      primaryKind: "exact agent and user database hash equality",
      deterministic: true,
      primaryFields: ["reward_info.reward", "reward_info.db_check.db_match"],
      limitations: ["Live user simulation and agent behavior remain model-dependent even though the DB oracle is deterministic."],
    },
    execution: {
      locallyCheckableNow: ["source hashes", "reference replay", "synthetic exact-state semantics"],
      credentialGates: ["natural user simulation and the tested agent each need a model endpoint"],
      environmentCost: "Moderate isolated Python 3.12 environment; voice extras are not required.",
    },
    artifactPolicy: {
      allowedLabels: ["upstream-original", "pm-synthetic-conformance", "pm-derived-diagnostic"],
      prohibitedPackageContent: ["upstream task JSON", "airline database snapshots"],
      generatedArtifactsAreNonGating: true,
    },
  },
  {
    schemaVersion: "pm.public-eval-corner-manifest.v1",
    cornerId: "appworld-22cc237_2",
    benchmarkName: "AppWorld",
    adapterStatus: "source-and-conformance-only",
    claimBoundary:
      "Public-code source integrity and a synthetic oracle-weakness diagnostic only; no protected bundle content is present.",
    upstream: {
      repositoryUrl: "https://github.com/StonyBrookNLP/appworld",
      revision: "a072b7a86e7c1d5b1d7175659d750ebb9b79f10a",
      version: "code 0.2.0.dev0 / data 0.2.0",
      license: {
        spdx: "Apache-2.0",
        additionalTerms:
          "Protected task/app/API/evaluator/data material may be publicly redistributed only in encrypted form.",
        vendoringPolicy: "Never package decrypted or derived protected content; use the official downloader locally.",
      },
      additionalPins: [],
    },
    tasks: [{ taskId: "22cc237_2", role: "multi-recipient payment-request state transition" }],
    sourceCoverage:
      "Pinned public code and declared data version only; protected task data is intentionally external and unvendored.",
    sources: [
      {
        sourceId: "appworld-project-metadata",
        location: "checkout",
        path: "pyproject.toml",
        sha256: "c33df6a6dbc23fb6ca3b8daf5e16d5e5e48f8ec1b11a19c13bf568bfa0b12a29",
        redistribution: "apache-2.0",
      },
      {
        sourceId: "appworld-data-version",
        location: "checkout",
        path: "src/appworld/common/constants.py",
        sha256: "776a1c2a97e8f3d7cbda00523be3fdf38ed6165d61ac729a82290a843524138d",
        redistribution: "apache-2.0",
      },
      {
        sourceId: "appworld-public-evaluator-shell",
        location: "checkout",
        path: "src/appworld/evaluator.py",
        sha256: "bde9deb3b1e6ac0fa9819013729c0e817a97c90f579108fa032a90bba0ca51cb",
        redistribution: "apache-2.0",
      },
    ],
    oracle: {
      owner: "upstream",
      primaryKind: "task-specific deterministic database assertions",
      deterministic: true,
      primaryFields: ["TestTracker.success", "TestTracker.passes", "TestTracker.failures"],
      limitations: [
        "For this task, projection by receiver can collapse duplicate same-receiver records.",
        "The PM duplicate-write check is diagnostic and must not redefine upstream task success.",
      ],
    },
    execution: {
      locallyCheckableNow: ["public code hashes", "data-version pin", "synthetic duplicate projection diagnostic"],
      credentialGates: ["live LLM behavior needs a local or provider model"],
      environmentCost: "Isolated Python 3.11+ environment plus official encrypted bundle installation.",
    },
    artifactPolicy: {
      allowedLabels: ["upstream-original", "pm-synthetic-conformance", "pm-derived-diagnostic"],
      prohibitedPackageContent: [
        "decrypted bundles",
        "task ground truth",
        "task database rows",
        "task-specific evaluator code",
      ],
      generatedArtifactsAreNonGating: true,
    },
  },
  {
    schemaVersion: "pm.public-eval-corner-manifest.v1",
    cornerId: "sentinel-microhub-stars",
    benchmarkName: "SentinelBench",
    adapterStatus: "source-and-conformance-only",
    claimBoundary:
      "Source integrity and synthetic contact-timing semantics only; no browser-agent performance is reported.",
    upstream: {
      repositoryUrl: "https://github.com/microsoft/sentinel_environments",
      revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
      version: "1.0.0",
      license: {
        spdx: "MIT",
        additionalTerms: null,
        vendoringPolicy: "Reference the pinned text-only environment; keep scenario data outside this package.",
      },
      additionalPins: [],
    },
    tasks: [
      { taskId: "microhub-stars-relative-passive", role: "relative baseline monitoring" },
      { taskId: "microhub-stars-noop", role: "no-op false-contact guardrail" },
      { taskId: "microhub-stars-absolute-passive", role: "absolute expected-allow control" },
    ],
    sourceCoverage:
      "Pinned relative/no-op/absolute scenarios, evaluation harness, server, and frontend lockfile.",
    sources: [
      {
        sourceId: "sentinel-stars-relative",
        location: "checkout",
        path: "scenarios/microhub/stars-relative-passive.json",
        sha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
        redistribution: "mit",
      },
      {
        sourceId: "sentinel-stars-noop",
        location: "checkout",
        path: "scenarios/microhub/stars-noop.json",
        sha256: "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
        redistribution: "mit",
      },
      {
        sourceId: "sentinel-stars-absolute",
        location: "checkout",
        path: "scenarios/microhub/stars-absolute-passive.json",
        sha256: "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
        redistribution: "mit",
      },
      {
        sourceId: "sentinel-eval-harness",
        location: "checkout",
        path: "server/eval_harness.py",
        sha256: "c05a1a8512512d323c4ae039e5f847e87f9d9cf4cad617deb7ed3741b1f575a7",
        redistribution: "mit",
      },
      {
        sourceId: "sentinel-server",
        location: "checkout",
        path: "server/server.py",
        sha256: "30fc6fd2afcab651fb58eb54862c7e6f7b2e82a503e911a6a14df2c3024ed165",
        redistribution: "mit",
      },
      {
        sourceId: "sentinel-frontend-lock",
        location: "checkout",
        path: "frontend/package-lock.json",
        sha256: "469f2c2c8d09d2a54b228fc5c1579e261132acc73c98166bd3459ead2181dd3d",
        redistribution: "mit",
      },
    ],
    oracle: {
      owner: "upstream",
      primaryKind: "SQLite condition plus contact timing / absence",
      deterministic: true,
      primaryFields: ["success", "condition_at", "contact_get_time"],
      limitations: ["Live browser operation remains model- and UI-dependent even though scenario evaluation is deterministic."],
    },
    execution: {
      locallyCheckableNow: [
        "source hashes",
        "upstream manual-clock relative late-contact",
        "upstream manual-clock no-op contact absence and false-contact rejection",
        "upstream manual-clock absolute late-contact and premature-contact rejection",
        "synthetic relative threshold",
        "synthetic no-op contact absence",
      ],
      credentialGates: ["a live browser agent needs a local or provider model"],
      environmentCost: "Python 3.11+, Node 18+, frontend, API server, and browser; no benchmark API key.",
    },
    artifactPolicy: {
      allowedLabels: ["upstream-original", "pm-synthetic-conformance", "pm-derived-diagnostic"],
      prohibitedPackageContent: ["upstream scenario payloads", "catalog rows", "browser recordings"],
      generatedArtifactsAreNonGating: true,
    },
  },
] satisfies readonly PublicEvalCornerManifest[]);

const MANIFEST_ENVELOPES = deepFreeze(
  MANIFESTS.map((manifest) => ({ manifest, manifestSha256: sha256Json(manifest) })),
);
const MANIFEST_BY_ID = new Map(
  MANIFEST_ENVELOPES.map((envelope) => [envelope.manifest.cornerId, envelope] as const),
);

function listManifests(): readonly ManifestEnvelope[] {
  return MANIFEST_ENVELOPES;
}

function getManifest(cornerId: PublicEvalCornerId): ManifestEnvelope {
  const envelope = MANIFEST_BY_ID.get(cornerId);
  if (!envelope) throw new Error(`unsupported public eval corner ${cornerId}`);
  return envelope;
}

function getQualificationPlan(cornerId: PublicEvalCornerId): QualificationPlan {
  getManifest(cornerId);
  return buildQualificationPlan(cornerId);
}

function runQualification(request: QualificationRequest): QualificationReceipt {
  const envelope = getManifest(request.cornerId);
  const sourceVerification = verifyPinnedSource({
    cornerId: request.cornerId,
    checkoutPath: request.checkoutPath,
    ...(request.externalFiles !== undefined ? { externalFiles: request.externalFiles } : {}),
  });
  return executeQualification(request, envelope.manifestSha256, sourceVerification);
}

const behavioralServices = {
  getManifest,
  verifyPinnedSource,
  verifyFileSet,
};

function planBehavioralBatch(input: BehavioralBatchInput): BehavioralPlanResult {
  return planBehavioralBatchRuntime(input, behavioralServices);
}

function runBehavioralBatch(input: BehavioralBatchInput): BehavioralBatchReceipt {
  return runBehavioralBatchRuntime(input, behavioralServices);
}

function verifyBehavioralBatch(value: unknown): BehavioralBatchVerification {
  return verifyBehavioralBatchRuntime(value, behavioralServices);
}

function verifyFileSet(request: FileSetVerificationRequest): FileSetVerificationResult {
  const root = resolve(request.rootPath);
  const files: FileVerification[] = [];
  const issues: string[] = [];
  for (const expected of request.expectedFiles) {
    if (!PORTABLE_ID.test(expected.sourceId)) {
      const issue = `${expected.sourceId}: sourceId is not portable`;
      issues.push(issue);
      files.push({
        sourceId: expected.sourceId,
        path: expected.relativePath,
        expectedSha256: expected.sha256,
        actualSha256: null,
        valid: false,
        issue,
      });
      continue;
    }
    if (!SHA256.test(expected.sha256)) {
      const issue = `${expected.sourceId}: expected hash is not lowercase SHA-256`;
      issues.push(issue);
      files.push({
        sourceId: expected.sourceId,
        path: expected.relativePath,
        expectedSha256: expected.sha256,
        actualSha256: null,
        valid: false,
        issue,
      });
      continue;
    }
    const target = resolve(root, expected.relativePath);
    const relativeTarget = relative(root, target);
    if (
      isAbsolute(expected.relativePath) ||
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ) {
      const issue = `${expected.sourceId}: path escapes verification root`;
      issues.push(issue);
      files.push({
        sourceId: expected.sourceId,
        path: target,
        expectedSha256: expected.sha256,
        actualSha256: null,
        valid: false,
        issue,
      });
      continue;
    }
    try {
      if (!statSync(target).isFile()) throw new Error("not a file");
      const actualSha256 = sha256Bytes(readFileSync(target));
      const valid = actualSha256 === expected.sha256;
      const issue = valid ? null : `${expected.sourceId}: SHA-256 mismatch`;
      if (issue) issues.push(issue);
      files.push({
        sourceId: expected.sourceId,
        path: target,
        expectedSha256: expected.sha256,
        actualSha256,
        valid,
        issue,
      });
    } catch {
      const issue = `${expected.sourceId}: source file is missing or unreadable`;
      issues.push(issue);
      files.push({
        sourceId: expected.sourceId,
        path: target,
        expectedSha256: expected.sha256,
        actualSha256: null,
        valid: false,
        issue,
      });
    }
  }
  return deepFreeze({
    schemaVersion: "pm.public-eval-file-verification.v1",
    valid: issues.length === 0,
    files,
    issues,
  });
}

function verifyPinnedSource(
  request: PinnedSourceVerificationRequest,
): PinnedSourceVerificationResult {
  const envelope = getManifest(request.cornerId);
  const { manifest } = envelope;
  const checkoutPath = resolve(request.checkoutPath);
  const actualRevision = checkoutValue(checkoutPath, ["rev-parse", "HEAD"]);
  const actualUrl = checkoutValue(checkoutPath, ["config", "--get", "remote.origin.url"]);
  const repositoryValid =
    actualRevision === manifest.upstream.revision &&
    actualUrl !== null &&
    normalizedRemote(actualUrl) === normalizedRemote(manifest.upstream.repositoryUrl);
  const issues: string[] = [];
  if (actualRevision !== manifest.upstream.revision) issues.push("Git revision does not match manifest");
  if (actualUrl === null) issues.push("Git remote.origin.url is missing");
  else if (normalizedRemote(actualUrl) !== normalizedRemote(manifest.upstream.repositoryUrl)) {
    issues.push("Git remote.origin.url does not match manifest");
  }

  const checkoutFiles = manifest.sources.filter((source) => source.location === "checkout");
  const checkoutResult = verifyFileSet({
    rootPath: checkoutPath,
    expectedFiles: checkoutFiles.map((source) => ({
      sourceId: source.sourceId,
      relativePath: source.path,
      sha256: source.sha256,
    })),
  });
  issues.push(...checkoutResult.issues);
  const files: FileVerification[] = [...checkoutResult.files];

  for (const source of manifest.sources.filter((entry) => entry.location === "external")) {
    const externalPath = request.externalFiles?.[source.sourceId];
    if (!externalPath) {
      const issue = `${source.sourceId}: required external source was not provided`;
      issues.push(issue);
      files.push({
        sourceId: source.sourceId,
        path: source.path,
        expectedSha256: source.sha256,
        actualSha256: null,
        valid: false,
        issue,
      });
      continue;
    }
    const externalResult = verifyFileSet({
      rootPath: resolve(externalPath, ".."),
      expectedFiles: [
        {
          sourceId: source.sourceId,
          relativePath: resolve(externalPath).split(/[\\/]/u).at(-1) ?? "",
          sha256: source.sha256,
        },
      ],
    });
    issues.push(...externalResult.issues);
    files.push(...externalResult.files);
  }

  return deepFreeze({
    schemaVersion: "pm.public-eval-source-verification.v1",
    cornerId: request.cornerId,
    manifestSha256: envelope.manifestSha256,
    valid: repositoryValid && issues.length === 0,
    repository: {
      expectedUrl: manifest.upstream.repositoryUrl,
      actualUrl,
      expectedRevision: manifest.upstream.revision,
      actualRevision,
      valid: repositoryValid,
    },
    files,
    sourceCoverage: manifest.sourceCoverage,
    issues,
  });
}

function validateArtifactLabel(value: unknown): ValidationResult {
  const issues: string[] = [];
  if (!isRecord(value)) return { valid: false, issues: ["artifact label envelope must be an object"] };
  if (value.schemaVersion !== "pm.public-eval-artifact-label.v1") issues.push("unsupported schemaVersion");
  if (typeof value.artifactId !== "string" || !PORTABLE_ID.test(value.artifactId)) {
    issues.push("artifactId must be a portable non-empty identifier");
  }
  let cornerId: PublicEvalCornerId | null = null;
  try {
    cornerId = requiredCornerId(value.cornerId, "cornerId");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  const label = value.label;
  if (
    label !== "upstream-original" &&
    label !== "pm-synthetic-conformance" &&
    label !== "pm-derived-diagnostic"
  ) {
    issues.push("label is not supported");
  }
  if (value.claimScope === "behavioral-efficacy") {
    issues.push("this package cannot label or promote behavioral-efficacy artifacts");
  }
  if (typeof value.containsUpstreamTaskData !== "boolean") {
    issues.push("containsUpstreamTaskData must be boolean");
  }
  if (typeof value.containsProtectedContent !== "boolean") {
    issues.push("containsProtectedContent must be boolean");
  }
  if (typeof value.nonGating !== "boolean") issues.push("nonGating must be boolean");

  if (label === "upstream-original") {
    if (value.claimScope !== "source-integrity") issues.push("upstream-original claimScope must be source-integrity");
    if (value.distribution !== "external-reference") {
      issues.push("upstream-original artifacts must remain external-reference entries");
    }
    if (value.nonGating !== true) issues.push("source references must be non-gating in this conformance package");
  }
  if (label === "pm-synthetic-conformance") {
    if (value.claimScope !== "adapter-conformance") {
      issues.push("pm-synthetic-conformance claimScope must be adapter-conformance");
    }
    if (value.distribution !== "package-synthetic") {
      issues.push("pm-synthetic-conformance distribution must be package-synthetic");
    }
    if (value.containsUpstreamTaskData !== false || value.containsProtectedContent !== false) {
      issues.push("synthetic conformance artifacts cannot contain upstream task/protected content");
    }
    if (value.nonGating !== true) issues.push("synthetic conformance artifacts must be non-gating");
  }
  if (label === "pm-derived-diagnostic") {
    if (value.claimScope !== "oracle-diagnostic") {
      issues.push("pm-derived-diagnostic claimScope must be oracle-diagnostic");
    }
    if (value.distribution !== "local-derived") {
      issues.push("pm-derived-diagnostic distribution must be local-derived");
    }
    if (value.containsUpstreamTaskData !== false || value.containsProtectedContent !== false) {
      issues.push("packaged diagnostics cannot contain upstream task/protected content");
    }
    if (value.nonGating !== true) issues.push("derived diagnostics must be non-gating");
    if (typeof value.derivation !== "string" || value.derivation.trim() === "") {
      issues.push("derived diagnostics must state their derivation");
    }
  }
  if (cornerId === "appworld-22cc237_2" && value.containsProtectedContent === true) {
    issues.push("protected AppWorld content cannot be represented by a packaged artifact");
  }
  return deepFreeze({ valid: issues.length === 0, issues });
}

function normalizeAnswer(value: string): string {
  const withoutPunctuation = [...value.toLowerCase()]
    .filter((character) => !ASCII_PUNCTUATION.has(character))
    .join("");
  return withoutPunctuation.replace(/\b(?:a|an|the)\b/gu, " ").replace(/\s+/gu, " ").trim();
}

function numberMap(value: unknown, path: string): Readonly<Record<string, number>> {
  const record = requiredRecord(value, path);
  const result: Record<string, number> = {};
  for (const [key, child] of Object.entries(record)) {
    if (key.trim() === "") throw new Error(`${path} keys must be non-empty`);
    result[key] = requiredFiniteNumber(child, `${path}.${key}`);
  }
  return result;
}

function mappingWithinTolerance(
  expected: Readonly<Record<string, number>>,
  actual: Readonly<Record<string, number>>,
  tolerance: number,
): boolean {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (canonicalJson(expectedKeys) !== canonicalJson(actualKeys)) return false;
  return expectedKeys.every((key) => Math.abs((expected[key] ?? Number.NaN) - (actual[key] ?? Number.NaN)) <= tolerance);
}

function diagnoseAppWorldDuplicateProjection(
  input: AppWorldProjectionDiagnosticInput,
): AppWorldProjectionDiagnostic {
  if (!Number.isFinite(input.amountTolerance) || input.amountTolerance < 0) {
    throw new Error("amountTolerance must be a non-negative finite number");
  }
  const projected: Record<string, number> = {};
  const counts = new Map<string, number>();
  for (const [index, request] of input.addedRequests.entries()) {
    if (request.receiverId.trim() === "") throw new Error(`addedRequests[${index}].receiverId must be non-empty`);
    if (!Number.isFinite(request.amount)) throw new Error(`addedRequests[${index}].amount must be finite`);
    projected[request.receiverId] = request.amount;
    counts.set(request.receiverId, (counts.get(request.receiverId) ?? 0) + 1);
  }
  const duplicateReceiverIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([receiverId]) => receiverId)
    .sort();
  const mappingProjectionMatches = mappingWithinTolerance(
    input.expectedByReceiver,
    projected,
    input.amountTolerance,
  );
  const recordMultiplicityMatches =
    input.addedRequests.length === Object.keys(input.expectedByReceiver).length &&
    duplicateReceiverIds.length === 0;
  return deepFreeze({
    schemaVersion: "pm.public-eval.appworld-duplicate-diagnostic.v1",
    mappingProjectionMatches,
    recordMultiplicityMatches,
    duplicateReceiverIds,
    projectionMayHideDuplicate: mappingProjectionMatches && !recordMultiplicityMatches,
    upstreamOracleRemainsAuthoritative: true,
    nonGating: true,
  });
}

function evaluateMab(content: JsonRecord): SyntheticFixtureResult["caseResults"] {
  const scenarios = requiredArray(content.scenarios, "content.scenarios");
  return scenarios.flatMap((rawScenario, scenarioIndex) => {
    const scenario = requiredRecord(rawScenario, `content.scenarios[${scenarioIndex}]`);
    const scenarioId = requiredString(scenario.scenarioId, `content.scenarios[${scenarioIndex}].scenarioId`);
    const timeline = requiredArray(scenario.timeline, `${scenarioId}.timeline`);
    let priorSerial = -1;
    for (const [index, rawEvent] of timeline.entries()) {
      const event = requiredRecord(rawEvent, `${scenarioId}.timeline[${index}]`);
      const serial = requiredFiniteNumber(event.serial, `${scenarioId}.timeline[${index}].serial`);
      requiredString(event.fact, `${scenarioId}.timeline[${index}].fact`);
      if (!Number.isInteger(serial) || serial <= priorSerial) {
        throw new Error(`${scenarioId}.timeline serials must be strictly increasing integers`);
      }
      priorSerial = serial;
    }
    if (timeline.length < 2) throw new Error(`${scenarioId}.timeline must exercise supersession`);
    requiredString(scenario.question, `${scenarioId}.question`);
    const expectedAnswers = requiredArray(scenario.expectedAnswers, `${scenarioId}.expectedAnswers`).map(
      (answer, index) => requiredString(answer, `${scenarioId}.expectedAnswers[${index}]`),
    );
    const candidates = requiredArray(scenario.candidates, `${scenarioId}.candidates`);
    return candidates.map((rawCandidate, candidateIndex) => {
      const candidate = requiredRecord(rawCandidate, `${scenarioId}.candidates[${candidateIndex}]`);
      const candidateId = requiredString(candidate.candidateId, `${scenarioId}.candidateId`);
      const output = requiredString(candidate.output, `${scenarioId}.${candidateId}.output`);
      const expectedSubstring = requiredBoolean(
        candidate.expectCompatibleSubstringMatch,
        `${scenarioId}.${candidateId}.expectCompatibleSubstringMatch`,
      );
      const expectedExact = requiredBoolean(
        candidate.expectExactMatchDiagnostic,
        `${scenarioId}.${candidateId}.expectExactMatchDiagnostic`,
      );
      const normalizedOutput = normalizeAnswer(output);
      const compatibleSubstringMatch = expectedAnswers.some((answer) =>
        normalizedOutput.includes(normalizeAnswer(answer)),
      );
      const exactMatchDiagnostic = expectedAnswers.some(
        (answer) => normalizedOutput === normalizeAnswer(answer),
      );
      return {
        caseId: `${scenarioId}:${candidateId}`,
        passed:
          compatibleSubstringMatch === expectedSubstring && exactMatchDiagnostic === expectedExact,
        details: {
          compatibleSubstringMatch,
          exactMatchDiagnostic,
          exactMatchIsNonGating: true,
        },
      };
    });
  });
}

function evaluateTau2(content: JsonRecord): SyntheticFixtureResult["caseResults"] {
  return requiredArray(content.cases, "content.cases").map((rawCase, index) => {
    const case_ = requiredRecord(rawCase, `content.cases[${index}]`);
    const caseId = requiredString(case_.caseId, `content.cases[${index}].caseId`);
    const expected = requiredRecord(case_.expected, `${caseId}.expected`);
    const observed = requiredRecord(case_.observed, `${caseId}.observed`);
    const expectedDbMatch = requiredBoolean(case_.expectDbMatch, `${caseId}.expectDbMatch`);
    const expectedAgentHash = sha256Json(expected.agentDb);
    const expectedUserHash = sha256Json(expected.userDb);
    const observedAgentHash = sha256Json(observed.agentDb);
    const observedUserHash = sha256Json(observed.userDb);
    const dbMatch =
      expectedAgentHash === observedAgentHash && expectedUserHash === observedUserHash;
    return {
      caseId,
      passed: dbMatch === expectedDbMatch,
      details: {
        dbMatch,
        expectedAgentHash,
        observedAgentHash,
        expectedUserHash,
        observedUserHash,
        comparisonIsSyntheticOracleConformance: true,
      },
    };
  });
}

function evaluateAppWorld(content: JsonRecord): SyntheticFixtureResult["caseResults"] {
  return requiredArray(content.cases, "content.cases").map((rawCase, index) => {
    const case_ = requiredRecord(rawCase, `content.cases[${index}]`);
    const caseId = requiredString(case_.caseId, `content.cases[${index}].caseId`);
    const addedRequests = requiredArray(case_.addedRequests, `${caseId}.addedRequests`).map(
      (rawRequest, requestIndex) => {
        const request = requiredRecord(rawRequest, `${caseId}.addedRequests[${requestIndex}]`);
        return {
          receiverId: requiredString(request.receiverId, `${caseId}.receiverId`),
          amount: requiredFiniteNumber(request.amount, `${caseId}.amount`),
        };
      },
    );
    const diagnostic = diagnoseAppWorldDuplicateProjection({
      expectedByReceiver: numberMap(case_.expectedByReceiver, `${caseId}.expectedByReceiver`),
      addedRequests,
      amountTolerance: requiredFiniteNumber(case_.amountTolerance, `${caseId}.amountTolerance`),
    });
    const expectProjectionMatch = requiredBoolean(
      case_.expectProjectionMatch,
      `${caseId}.expectProjectionMatch`,
    );
    const expectMultiplicityMatch = requiredBoolean(
      case_.expectMultiplicityMatch,
      `${caseId}.expectMultiplicityMatch`,
    );
    const expectWeakness = requiredBoolean(case_.expectWeakness, `${caseId}.expectWeakness`);
    return {
      caseId,
      passed:
        diagnostic.mappingProjectionMatches === expectProjectionMatch &&
        diagnostic.recordMultiplicityMatches === expectMultiplicityMatch &&
        diagnostic.projectionMayHideDuplicate === expectWeakness,
      details: { ...diagnostic },
    };
  });
}

function evaluateSentinel(content: JsonRecord): SyntheticFixtureResult["caseResults"] {
  return requiredArray(content.cases, "content.cases").map((rawCase, index) => {
    const case_ = requiredRecord(rawCase, `content.cases[${index}]`);
    const caseId = requiredString(case_.caseId, `content.cases[${index}].caseId`);
    const mode = requiredString(case_.mode, `${caseId}.mode`);
    const expectedSuccess = requiredBoolean(case_.expectSuccess, `${caseId}.expectSuccess`);
    let success: boolean;
    let conditionSatisfied: boolean;
    let contactTimingSatisfied: boolean;
    if (mode === "relative") {
      const baseline = requiredFiniteNumber(case_.baseline, `${caseId}.baseline`);
      const delta = requiredFiniteNumber(case_.delta, `${caseId}.delta`);
      const current = requiredFiniteNumber(case_.current, `${caseId}.current`);
      const conditionAt = requiredFiniteNumber(case_.conditionAt, `${caseId}.conditionAt`);
      const contactAt = case_.contactAt === null ? null : requiredFiniteNumber(case_.contactAt, `${caseId}.contactAt`);
      conditionSatisfied = current >= baseline + delta;
      contactTimingSatisfied = contactAt !== null && contactAt >= conditionAt;
      success = conditionSatisfied && contactTimingSatisfied;
    } else if (mode === "noop") {
      if (case_.contactAt !== null) requiredFiniteNumber(case_.contactAt, `${caseId}.contactAt`);
      conditionSatisfied = true;
      contactTimingSatisfied = case_.contactAt === null;
      success = contactTimingSatisfied;
    } else {
      throw new Error(`${caseId}.mode must be relative or noop`);
    }
    return {
      caseId,
      passed: success === expectedSuccess,
      details: { mode, success, conditionSatisfied, contactTimingSatisfied },
    };
  });
}

function evaluateSyntheticFixture(value: unknown): SyntheticFixtureResult {
  const fixture = requiredRecord(value, "fixture");
  if (fixture.schemaVersion !== "pm.public-eval-corner-synthetic-fixture.v1") {
    throw new Error("unsupported synthetic fixture schemaVersion");
  }
  const fixtureId = requiredString(fixture.fixtureId, "fixture.fixtureId");
  const cornerId = requiredCornerId(fixture.cornerId, "fixture.cornerId");
  if (fixture.syntheticNotice !== "PM-authored synthetic values; no upstream task data.") {
    throw new Error("fixture.syntheticNotice must make the no-upstream-data boundary explicit");
  }
  const labelResult = validateArtifactLabel({
    schemaVersion: "pm.public-eval-artifact-label.v1",
    artifactId: fixtureId,
    cornerId,
    label: fixture.label,
    claimScope: fixture.claimScope,
    distribution: fixture.distribution,
    containsUpstreamTaskData: fixture.containsUpstreamTaskData,
    containsProtectedContent: fixture.containsProtectedContent,
    nonGating: fixture.nonGating,
  });
  if (!labelResult.valid) throw new Error(labelResult.issues.join("; "));
  const content = requiredRecord(fixture.content, "fixture.content");
  let caseResults: SyntheticFixtureResult["caseResults"];
  let caveats: readonly string[];
  switch (cornerId) {
    case "memoryagentbench-factconsolidation-6k":
      caseResults = evaluateMab(content);
      caveats = ["Compatible substring semantics are permissive; exact match is diagnostic only."];
      break;
    case "tau2-airline-32":
      caseResults = evaluateTau2(content);
      caveats = ["Synthetic canonical objects test adapter semantics, not the upstream airline database or agent behavior."];
      break;
    case "appworld-22cc237_2":
      caseResults = evaluateAppWorld(content);
      caveats = ["Duplicate projection is a non-gating diagnostic; upstream TestTracker remains authoritative."];
      break;
    case "sentinel-microhub-stars":
      caseResults = evaluateSentinel(content);
      caveats = ["Synthetic timing checks do not measure browser navigation, waiting policy, or model performance."];
      break;
  }
  return deepFreeze({
    schemaVersion: "pm.public-eval-synthetic-conformance-result.v1",
    fixtureId,
    cornerId,
    passed: caseResults.length > 0 && caseResults.every((case_) => case_.passed),
    claimScope: "adapter-conformance",
    efficacyClaimed: false,
    caseResults,
    caveats,
  });
}

/**
 * The package intentionally exposes one runtime value. Its methods are all
 * reachable from src/cli.ts, preventing a new unconsumed formalism surface.
 */
export const publicEvalCorners = deepFreeze({
  listManifests,
  getManifest,
  getQualificationPlan,
  verifyFileSet,
  verifyPinnedSource,
  validateArtifactLabel,
  evaluateSyntheticFixture,
  diagnoseAppWorldDuplicateProjection,
  runQualification,
  planBehavioralBatch,
  runBehavioralBatch,
  verifyBehavioralBatch,
});
