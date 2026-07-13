import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  buildObservationContractFromCurrentStateView,
  evaluateObservationContract,
  type CurrentStateView,
} from "@pm/agent-state-core";
import { tenantId, timestamp } from "@pm/types";

import { createStateBenchExtractionProvenance } from "./provenance.js";
import type { StateBenchExtractionCollectionInput } from "./provenance.js";
export type {
  StateBenchExtractionCollectionInput,
  StateBenchExtractionKind,
  StateBenchExtractionPipelineInput,
  StateBenchExtractionPipelineManifest,
  StateBenchExtractionProvenanceReceipt,
  StateBenchRawExtractionRecord,
  StateBenchRawExtractionRecordInput,
} from "./provenance.js";

export type StateBenchDomain =
  | "travel"
  | "customer_support"
  | "shopping_assistant";
export type StateBenchArm = "native" | "sham" | "substrate";
export type StateBenchSidecarArm = Exclude<StateBenchArm, "native">;

export interface StateBenchLearningEntry {
  readonly learningId: string;
  readonly text: string;
  readonly domain: StateBenchDomain;
  readonly tags: readonly string[];
  readonly sourceTrajectories: readonly string[];
  readonly observedAt: string;
  readonly validUntil?: string;
  readonly status: "active" | "superseded";
  readonly supersedes?: readonly string[];
}

export interface StateBenchLearningArtifact {
  readonly schemaVersion: "pm-state-bench-learnings.v1";
  readonly benchmarkRevision: string;
  readonly track: "agent_learning";
  readonly sourceSplit: "train";
  readonly corpusSha256: string;
  readonly entries: readonly StateBenchLearningEntry[];
}

export interface StateBenchTrainArtifactSeal {
  readonly schemaVersion: "pm-state-bench-train-artifact-seal.v1";
  readonly benchmarkRevision: string;
  readonly artifactSha256: string;
  readonly corpus: {
    readonly root: string;
    readonly fileCount: number;
    readonly treeSha256: string;
  };
  readonly citedSources: readonly {
    readonly path: string;
    readonly fileSha256: string;
  }[];
  readonly sealHash: string;
}

export interface StateBenchRunConfig {
  readonly schemaVersion: "pm-state-bench-run-config.v2";
  readonly experimentId: string;
  readonly arm: StateBenchArm;
  readonly domain: StateBenchDomain;
  readonly agentModel: {
    readonly modelId: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
  };
  readonly agentClass: "StateBenchAgent" | "PmSubstrateAgent";
  readonly split: "test";
  readonly numRuns: 5;
  readonly retrieveLearningsTopK: 3 | null;
  readonly artifactSealHash: string | null;
  readonly extractionProvenanceHash: string | null;
}

export interface StateBenchRetrievalIdentity {
  readonly experimentId: string;
  readonly configSha256: string;
  readonly runId: string;
  readonly taskId: string;
  readonly domain: StateBenchDomain;
  readonly modelId: string;
}

export interface StateBenchRetrievalRequest {
  readonly query: string;
  readonly topK: 3;
  readonly arm: StateBenchSidecarArm;
  readonly requestedAt: string;
  readonly identity: StateBenchRetrievalIdentity;
}

export interface StateBenchRetrievalResponse {
  readonly learnings: readonly string[];
  readonly audit: {
    readonly arm: StateBenchSidecarArm;
    readonly mode: "irrelevant_train_state_core_observation" | "substrate_core_observation";
    readonly identitySha256: string;
    readonly artifactSha256: string;
    readonly outputCharacterBudget: number;
    readonly observationBoundaryInvoked: boolean;
    readonly currentStateViewId: string | null;
    readonly observationContractId: string | null;
    readonly observationContractValid: boolean | null;
    readonly sourceLearningIds: readonly string[];
    readonly measurement: StateBenchRetrievalMeasurement;
  };
}

export interface StateBenchRetrievalMeasurement {
  readonly tokenUnit: "utf8_byte_token.v1";
  readonly queryTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly costUsd: 0;
}

export interface StateBenchAuditSessionRecord {
  readonly schemaVersion: "pm-state-bench-sidecar-audit.v2";
  readonly recordType: "session";
  readonly sequence: 0;
  readonly startedAt: string;
  readonly identity: {
    readonly experimentId: string;
    readonly arm: StateBenchSidecarArm;
    readonly domain: StateBenchDomain;
    readonly runIndex: number;
    readonly runId: string;
    readonly configSha256: string;
    readonly modelId: string;
  };
  readonly artifactSealHash: string;
  readonly extractionProvenanceHash: string;
  readonly previousHash: null;
  readonly recordHash: string;
}

export interface StateBenchAuditRetrievalRecord {
  readonly schemaVersion: "pm-state-bench-sidecar-audit.v2";
  readonly recordType: "retrieval";
  readonly sequence: number;
  readonly recordedAt: string;
  readonly identity: StateBenchRetrievalIdentity;
  readonly querySha256: string;
  readonly topK: 3;
  readonly responseSha256: string;
  readonly mode: "irrelevant_train_state_core_observation" | "substrate_core_observation";
  readonly observationBoundaryInvoked: boolean;
  readonly observationContractValid: boolean | null;
  readonly sourceLearningIds: readonly string[];
  readonly measurement: StateBenchRetrievalMeasurement;
  readonly previousHash: string;
  readonly recordHash: string;
}

export interface StateBenchOfficialMetrics {
  readonly benchmark_version: string;
  readonly evaluation_protocol_id: string;
  readonly num_runs: number;
  readonly agent_model: unknown;
  readonly metrics: Readonly<Record<string, unknown>>;
}

export interface StateBenchOfficialCollectionInput {
  readonly checkoutPath: string;
  readonly resultsPath: string;
  readonly configPath: string;
  readonly auditRoot?: string;
  readonly artifactPath?: string;
  readonly sealPath?: string;
  readonly extractionProvenancePath?: string;
  readonly pipelineManifestPath?: string;
  readonly extractorSourcePath?: string;
  readonly promptPath?: string;
  readonly toolsPath?: string;
  readonly decodingPath?: string;
  readonly rawRecordsPath?: string;
}

export interface StateBenchOutputConformanceReceipt {
  readonly schemaVersion: "pm-state-bench-output-conformance.v1";
  readonly evidenceClass: "official_output_shape_and_procedure_conformance_only";
  readonly authorityStatus: "ineligible_for_efficacy_or_public_eval_attempt";
  readonly benchmark: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly packageVersion: string;
    readonly protocolId: string;
    readonly protocolFileSha256: string;
  };
  readonly identity: {
    readonly experimentId: string;
    readonly arm: StateBenchArm;
    readonly domain: StateBenchDomain;
    readonly configSha256: string;
    readonly modelId: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
    readonly runIds: readonly string[];
    readonly taskIds: readonly string[];
  };
  readonly treatment: {
    readonly agentClass: "StateBenchAgent" | "PmSubstrateAgent";
    readonly retrieval:
      | "none"
      | "irrelevant_train_state_core_observation"
      | "substrate_core_observation";
      readonly artifactSha256: string | null;
      readonly artifactSealHash: string | null;
      readonly extractionProvenanceHash: string | null;
      readonly adapterFileSha256: string | null;
  };
  readonly rawOutputs: {
    readonly fileCount: number;
    readonly treeSha256: string;
    readonly topLevelEntries: readonly [
      "failures.json",
      "metrics.json",
      "run1",
      "run2",
      "run3",
      "run4",
      "run5",
    ];
    readonly failures: {
      readonly path: "failures.json";
      readonly fileSha256: string;
      readonly records: readonly {
        readonly runIndex: number;
        readonly taskId: string;
        readonly attemptId: string;
        readonly occurredAt: string;
        readonly errorClass: string;
        readonly errorSha256: string;
      }[];
    };
    readonly runs: readonly {
      readonly runIndex: number;
      readonly runId: string;
      readonly treeSha256: string;
      readonly retrievalCallCount: number;
      readonly taskOutputs: readonly {
        readonly taskId: string;
        readonly path: string;
        readonly fileSha256: string;
      }[];
    }[];
  };
  readonly sidecarAudits: readonly {
    readonly runIndex: number;
    readonly runId: string;
    readonly path: string;
    readonly fileSha256: string;
    readonly retrievalRecordCount: number;
    readonly finalRecordHash: string;
  }[];
  readonly reportedScoringShape: {
    readonly callerAuthoredFields: true;
    readonly evaluatorModel: "gpt-5.4";
    readonly judgeReasoningEffort: "high";
    readonly metricsFileSha256: string;
    readonly taskCompletionPassAt1: number;
    readonly taskCompletionPassPower5: number;
    readonly totalScoredTrajectories: number;
  };
  readonly eligibility: {
    readonly publicEvalAttemptEligible: false;
    readonly missingVerifiedEvidence: readonly [
      "official_runner_receipt",
      "agent_provider_raw_response_receipts",
      "simulator_provider_raw_response_receipts",
      "judge_provider_raw_response_receipts",
      "provider_request_ids_usage_cost_latency_and_exact_bytes",
    ];
  };
  readonly receiptHash: string;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const TRAIN_PREFIX = "datasets/train_task_trajectories/";
const OFFICIAL_PROTOCOL_ID = "state_bench_v0.8.0_gpt54";
const AUDIT_SCHEMA = "pm-state-bench-sidecar-audit.v2";
const DOMAINS = [
  "travel",
  "customer_support",
  "shopping_assistant",
] as const;

const STATE_BENCH_MANIFEST = Object.freeze({
  schemaVersion: "pm-public-benchmark-manifest.v1" as const,
  upstreamUrl: "https://github.com/microsoft/STATE-Bench.git",
  upstreamRevision: "fd980728da482af21f0d33406aea0ac499645125",
  upstreamLicense: "MIT",
  packageVersion: "0.8.0",
  track: "agent_learning",
  protocolKey: "gpt54",
  officialProtocolId: OFFICIAL_PROTOCOL_ID,
  protocolFile: "state_bench/configs/eval_protocols/gpt54.json",
  protocolFileSha256:
    "e4a97cab2b2ed31ec180f671f4b5e5760c00cf30cc56d4cf717481e7a0d29a0c",
  splitVersion: "train_test",
  officialSplit: "test",
  trainCorpusRoot: "datasets/train_task_trajectories",
  trainCorpusFileCount: 300,
  trainCorpusSha256:
    "77de6f66fa84837df2a44fd5bcc61cebdd0da5117db90e99de59ab1a956f38f0",
  officialEvaluatorModel: "gpt-5.4",
  judgeReasoningEffort: "high",
  officialRuns: 5,
  retrievalTopK: 3,
  trainTrajectoriesPerDomain: 100,
  heldOutTasksPerDomain: 50,
  domains: DOMAINS,
  officialMetricKeys: [
    "task_completion_pass@1",
    "task_completion_pass^5",
  ] as const,
  evidenceClasses: {
    adapterConformance: {
      id: "adapter_conformance_only",
      officialScoring: false,
      efficacyClaim: false,
    },
    outputConformance: {
      id: "official_output_shape_and_procedure_conformance_only",
      officialScoring: false,
      efficacyClaim: false,
    },
    eligibleOfficialEvidence: {
      id: "unavailable_without_raw_runner_provider_and_judge_receipts",
      availableFromPinnedUpstream: false,
      efficacyClaim: false,
    },
  },
});

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("undefined is not canonical JSON");
  return encoded;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new Error(`${path} has unsupported fields: ${extras.sort().join(", ")}`);
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function safeId(value: unknown, path: string): string {
  const id = requiredString(value, path);
  if (!SAFE_ID.test(id)) throw new Error(`${path} is not a safe identifier`);
  return id;
}

function exactTimestamp(value: unknown, path: string): string {
  const raw = requiredString(value, path);
  if (Number.isNaN(Date.parse(raw)) || new Date(raw).toISOString() !== raw) {
    throw new Error(`${path} must be an exact UTC ISO-8601 timestamp`);
  }
  return raw;
}

function shaValue(value: unknown, path: string): string {
  const hash = requiredString(value, path);
  if (!SHA256.test(hash)) throw new Error(`${path} must be lowercase SHA-256`);
  return hash;
}

function domainValue(value: unknown, path: string): StateBenchDomain {
  if (!DOMAINS.includes(value as StateBenchDomain)) {
    throw new Error(`${path} must be an official STATE-Bench domain`);
  }
  return value as StateBenchDomain;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeRelative(path: string): string {
  return path.split(sep).join("/");
}

function regularFilesRecursively(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`symbolic links are forbidden in evidence trees: ${path}`);
    }
    if (metadata.isDirectory()) return regularFilesRecursively(path);
    if (!metadata.isFile()) {
      throw new Error(`non-regular file is forbidden in evidence trees: ${path}`);
    }
    return [path];
  });
}

function fileTreeRows(checkoutRoot: string, files: readonly string[]): string {
  return [...files]
    .sort()
    .map((path) => {
      const source = normalizeRelative(relative(checkoutRoot, path));
      return `${source}\0${sha256(readFileSync(path))}\n`;
    })
    .join("");
}

function tokenize(value: string): ReadonlySet<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9_]+/u)
      .filter((token) => token.length >= 3),
  );
}

function overlapScore(
  queryTokens: ReadonlySet<string>,
  entry: StateBenchLearningEntry,
): number {
  const candidateTokens = tokenize(`${entry.tags.join(" ")} ${entry.text}`);
  let score = 0;
  for (const token of queryTokens) if (candidateTokens.has(token)) score += 1;
  return score;
}

function sourcePath(value: string, domain: StateBenchDomain, path: string): string {
  if (
    value.includes("\0") ||
    isAbsolute(value) ||
    value.includes("://") ||
    /%2f|%5c/iu.test(value) ||
    value.includes("\\") ||
    value.startsWith("./")
  ) {
    throw new Error(`${path} is not a canonical repository-relative path`);
  }
  const parts = value.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new Error(`${path} contains an unsafe path segment`);
  }
  if (
    parts.length !== 4 ||
    parts[0] !== "datasets" ||
    parts[1] !== "train_task_trajectories" ||
    parts[2] !== domain ||
    extname(parts[3] ?? "") !== ".json"
  ) {
    throw new Error(`${path} must cite a same-domain training trajectory`);
  }
  if (!value.startsWith(TRAIN_PREFIX) || /test[_-]?task|held[_-]?out|oracle/iu.test(value)) {
    throw new Error(`${path} cites a forbidden held-out/oracle source`);
  }
  return value;
}

function stringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value as string[];
}

function parseArtifact(value: unknown): StateBenchLearningArtifact {
  if (!isObject(value)) throw new Error("learning artifact must be an object");
  exactKeys(
    value,
    [
      "schemaVersion",
      "benchmarkRevision",
      "track",
      "sourceSplit",
      "corpusSha256",
      "entries",
    ],
    "artifact",
  );
  if (value.schemaVersion !== "pm-state-bench-learnings.v1") {
    throw new Error("unsupported learning artifact schemaVersion");
  }
  if (value.benchmarkRevision !== STATE_BENCH_MANIFEST.upstreamRevision) {
    throw new Error("learning artifact benchmarkRevision does not match the pin");
  }
  if (value.track !== "agent_learning" || value.sourceSplit !== "train") {
    throw new Error("learning artifact must use Agent Learning Track train data only");
  }
  if (value.corpusSha256 !== STATE_BENCH_MANIFEST.trainCorpusSha256) {
    throw new Error("learning artifact corpusSha256 does not match the pinned corpus");
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    throw new Error("learning artifact entries must be a non-empty array");
  }

  const seen = new Set<string>();
  const entries: StateBenchLearningEntry[] = value.entries.map((raw, index) => {
    const path = `entries[${index}]`;
    if (!isObject(raw)) throw new Error(`${path} must be an object`);
    exactKeys(
      raw,
      [
        "learningId",
        "text",
        "domain",
        "tags",
        "sourceTrajectories",
        "observedAt",
        "validUntil",
        "status",
        "supersedes",
      ],
      path,
    );
    const learningId = safeId(raw.learningId, `${path}.learningId`);
    if (seen.has(learningId)) throw new Error(`${path}.learningId must be unique`);
    seen.add(learningId);
    const text = requiredString(raw.text, `${path}.text`);
    const domain = domainValue(raw.domain, `${path}.domain`);
    const tags = stringArray(raw.tags, `${path}.tags`);
    if (tags.some((tag) => tag.trim().length === 0)) {
      throw new Error(`${path}.tags cannot contain empty strings`);
    }
    const rawSources = stringArray(
      raw.sourceTrajectories,
      `${path}.sourceTrajectories`,
    );
    if (rawSources.length === 0) {
      throw new Error(`${path}.sourceTrajectories must be non-empty`);
    }
    const sourceTrajectories = rawSources.map((source, sourceIndex) =>
      sourcePath(source, domain, `${path}.sourceTrajectories[${sourceIndex}]`),
    );
    if (new Set(sourceTrajectories).size !== sourceTrajectories.length) {
      throw new Error(`${path}.sourceTrajectories must not contain duplicates`);
    }
    const observedAt = exactTimestamp(raw.observedAt, `${path}.observedAt`);
    const validUntil =
      raw.validUntil === undefined
        ? undefined
        : exactTimestamp(raw.validUntil, `${path}.validUntil`);
    if (validUntil !== undefined && Date.parse(validUntil) < Date.parse(observedAt)) {
      throw new Error(`${path}.validUntil cannot precede observedAt`);
    }
    if (raw.status !== "active" && raw.status !== "superseded") {
      throw new Error(`${path}.status must be active or superseded`);
    }
    const supersedes =
      raw.supersedes === undefined
        ? undefined
        : stringArray(raw.supersedes, `${path}.supersedes`).map((id, supersedesIndex) =>
            safeId(id, `${path}.supersedes[${supersedesIndex}]`),
          );
    if (supersedes?.includes(learningId) === true) {
      throw new Error(`${path} cannot supersede itself`);
    }
    return {
      learningId,
      text,
      domain,
      tags,
      sourceTrajectories,
      observedAt,
      ...(validUntil === undefined ? {} : { validUntil }),
      status: raw.status,
      ...(supersedes === undefined ? {} : { supersedes }),
    };
  });

  for (const entry of entries) {
    for (const id of entry.supersedes ?? []) {
      if (!seen.has(id)) throw new Error(`learning ${entry.learningId} supersedes unknown ${id}`);
    }
  }
  const supersededIds = new Set(entries.flatMap((entry) => entry.supersedes ?? []));
  for (const entry of entries) {
    if (entry.status === "active" && supersededIds.has(entry.learningId)) {
      throw new Error(`learning ${entry.learningId} is active but superseded`);
    }
  }

  return {
    schemaVersion: "pm-state-bench-learnings.v1",
    benchmarkRevision: STATE_BENCH_MANIFEST.upstreamRevision,
    track: "agent_learning",
    sourceSplit: "train",
    corpusSha256: STATE_BENCH_MANIFEST.trainCorpusSha256,
    entries,
  };
}

function loadArtifact(path: string): StateBenchLearningArtifact {
  return parseArtifact(readJson(path));
}

interface SplitManifest {
  readonly train: readonly string[];
  readonly test: readonly string[];
}

function loadSplitManifest(root: string, domain: StateBenchDomain): SplitManifest {
  const path = join(
    root,
    "state_bench",
    "domains",
    domain,
    "splits",
    `${STATE_BENCH_MANIFEST.splitVersion}.json`,
  );
  const raw = readJson(path);
  if (!isObject(raw) || !isObject(raw.splits)) {
    throw new Error(`split manifest is malformed: ${domain}`);
  }
  const train = stringArray(raw.splits.train, `${domain}.splits.train`);
  const test = stringArray(raw.splits.test, `${domain}.splits.test`);
  if (train.length !== STATE_BENCH_MANIFEST.trainTrajectoriesPerDomain) {
    throw new Error(`${domain} train split must contain exactly 100 task IDs`);
  }
  if (test.length !== STATE_BENCH_MANIFEST.heldOutTasksPerDomain) {
    throw new Error(`${domain} test split must contain exactly 50 task IDs`);
  }
  if (new Set(train).size !== train.length || new Set(test).size !== test.length) {
    throw new Error(`${domain} split task IDs must be unique`);
  }
  const trainIds = new Set(train);
  if (test.some((id) => trainIds.has(id))) {
    throw new Error(`${domain} train and test splits overlap`);
  }
  return { train: [...train].sort(), test: [...test].sort() };
}

interface CorpusFile {
  readonly path: string;
  readonly absolutePath: string;
  readonly domain: StateBenchDomain;
  readonly taskId: string;
  readonly fileSha256: string;
}

function inspectTrainCorpus(root: string): {
  readonly files: readonly CorpusFile[];
  readonly treeSha256: string;
} {
  const corpusRoot = resolve(root, STATE_BENCH_MANIFEST.trainCorpusRoot);
  const resolvedRoot = realpathSync(root);
  const resolvedCorpus = realpathSync(corpusRoot);
  if (
    normalizeRelative(relative(resolvedRoot, resolvedCorpus)) !==
    STATE_BENCH_MANIFEST.trainCorpusRoot
  ) {
    throw new Error("training corpus root escaped the pinned checkout");
  }
  const splitByDomain = new Map(
    DOMAINS.map((domain) => [domain, loadSplitManifest(root, domain)] as const),
  );
  const absoluteFiles = regularFilesRecursively(corpusRoot);
  if (absoluteFiles.length !== STATE_BENCH_MANIFEST.trainCorpusFileCount) {
    throw new Error(
      `training corpus file count mismatch: expected 300, got ${absoluteFiles.length}`,
    );
  }
  const files = absoluteFiles.map((absolutePath): CorpusFile => {
    const path = normalizeRelative(relative(root, absolutePath));
    const parts = path.split("/");
    const domain = domainValue(parts[2], `corpus path ${path}`);
    if (
      parts.length !== 4 ||
      parts[0] !== "datasets" ||
      parts[1] !== "train_task_trajectories" ||
      extname(parts[3] ?? "") !== ".json"
    ) {
      throw new Error(`training corpus has unexpected path ${path}`);
    }
    const taskId = basename(parts[3] ?? "", ".json");
    const split = splitByDomain.get(domain);
    if (split === undefined || !split.train.includes(taskId) || split.test.includes(taskId)) {
      throw new Error(`training corpus path is not a declared train task: ${path}`);
    }
    const trajectory = readJson(absolutePath);
    if (!isObject(trajectory) || !Array.isArray(trajectory.conversation)) {
      throw new Error(`training corpus file is not a trajectory: ${path}`);
    }
    return {
      path,
      absolutePath,
      domain,
      taskId,
      fileSha256: sha256(readFileSync(absolutePath)),
    };
  });
  for (const domain of DOMAINS) {
    if (files.filter((file) => file.domain === domain).length !== 100) {
      throw new Error(`${domain} training corpus must contain exactly 100 files`);
    }
  }
  return {
    files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
    treeSha256: sha256(fileTreeRows(root, absoluteFiles)),
  };
}

function verifyCheckout(checkoutPath: string): VerificationResult {
  const issues: string[] = [];
  const root = resolve(checkoutPath);
  let realRoot = root;
  try {
    realRoot = realpathSync(root);
  } catch {
    // The checks below report the unreadable checkout with actionable detail.
  }
  const git = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (git.status !== 0) issues.push("checkout is not a readable Git worktree");
  else if (git.stdout.trim() !== STATE_BENCH_MANIFEST.upstreamRevision) {
    issues.push(
      `checkout revision mismatch: expected ${STATE_BENCH_MANIFEST.upstreamRevision}, got ${git.stdout.trim()}`,
    );
  }
  const status = spawnSync(
    "git",
    ["-C", root, "status", "--porcelain=v1", "--untracked-files=all"],
    { encoding: "utf8" },
  );
  if (status.status !== 0) issues.push("checkout cleanliness could not be verified");
  else {
    const changes = status.stdout.split(/\r?\n/u).filter((line) => line.length > 0);
    const allowedAdapter = "?? agents/pm_substrate_agent.py";
    const unexpected = changes.filter((line) => line !== allowedAdapter);
    if (unexpected.length > 0) {
      issues.push(`checkout has tracked or unapproved untracked changes: ${unexpected.join(", ")}`);
    }
    if (changes.includes(allowedAdapter)) {
      const installedAdapter = join(root, "agents", "pm_substrate_agent.py");
      try {
        if (
          !lstatSync(installedAdapter).isFile() ||
          sha256(readFileSync(installedAdapter)) !== sha256(readFileSync(adapterPath()))
        ) {
          issues.push("untracked PmSubstrateAgent does not match the packaged adapter bytes");
        }
      } catch {
        issues.push("untracked PmSubstrateAgent is unreadable");
      }
    }
  }

  const protocolPath = join(root, STATE_BENCH_MANIFEST.protocolFile);
  try {
    if (!statSync(protocolPath).isFile()) issues.push("protocol path is not a file");
    else if (sha256(readFileSync(protocolPath)) !== STATE_BENCH_MANIFEST.protocolFileSha256) {
      issues.push("official protocol file hash mismatch");
    }
    if (
      normalizeRelative(relative(realRoot, realpathSync(protocolPath))) !==
      STATE_BENCH_MANIFEST.protocolFile
    ) {
      issues.push("protocol path escaped the pinned checkout");
    }
    const protocol = readJson(protocolPath);
    if (!isObject(protocol)) throw new Error("protocol is not an object");
    if (
      protocol.split !== "test" ||
      protocol.split_version !== STATE_BENCH_MANIFEST.splitVersion ||
      protocol.num_runs !== 5 ||
      protocol.official_model !== "gpt-5.4"
    ) {
      issues.push("official protocol semantic fields drifted");
    }
    for (const section of ["simulator", "judge"] as const) {
      const sectionValue = protocol[section];
      if (!isObject(sectionValue) || !isObject(sectionValue.prompt_hashes)) {
        issues.push(`${section} prompt hashes are missing from the protocol`);
        continue;
      }
      for (const [key, expected] of Object.entries(sectionValue.prompt_hashes)) {
        const [domain, ...name] = key.split("/");
        const promptPath = join(
          root,
          "state_bench",
          "domains",
          domain ?? "",
          "prompts",
          name.join("/"),
        );
        if (typeof expected !== "string" || sha256(readFileSync(promptPath)) !== expected) {
          issues.push(`${section} prompt hash mismatch: ${key}`);
        }
      }
    }
  } catch (error) {
    issues.push(
      `official protocol is missing, unreadable, or malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const corpus = inspectTrainCorpus(root);
    if (corpus.treeSha256 !== STATE_BENCH_MANIFEST.trainCorpusSha256) {
      issues.push("training corpus hash mismatch");
    }
  } catch (error) {
    issues.push(
      `training corpus is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { valid: issues.length === 0, issues };
}

function assertVerifiedCheckout(path: string): string {
  const root = resolve(path);
  const verification = verifyCheckout(root);
  if (!verification.valid) {
    throw new Error(`pinned checkout verification failed: ${verification.issues.join("; ")}`);
  }
  return root;
}

function createTrainArtifactSeal(
  checkoutPath: string,
  artifactPath: string,
): StateBenchTrainArtifactSeal {
  const root = assertVerifiedCheckout(checkoutPath);
  const artifact = loadArtifact(artifactPath);
  const corpus = inspectTrainCorpus(root);
  if (corpus.treeSha256 !== STATE_BENCH_MANIFEST.trainCorpusSha256) {
    throw new Error("training corpus hash does not match the pinned 300-file corpus");
  }
  const inventory = new Map(corpus.files.map((file) => [file.path, file] as const));
  const citedPaths = [...new Set(artifact.entries.flatMap((entry) => entry.sourceTrajectories))].sort();
  const citedSources = citedPaths.map((path) => {
    const file = inventory.get(path);
    if (file === undefined) {
      throw new Error(`cited source is not a real pinned training trajectory: ${path}`);
    }
    const entryDomains = new Set(
      artifact.entries
        .filter((entry) => entry.sourceTrajectories.includes(path))
        .map((entry) => entry.domain),
    );
    if (entryDomains.size !== 1 || !entryDomains.has(file.domain)) {
      throw new Error(`cited source domain does not match its learning entry: ${path}`);
    }
    return { path, fileSha256: file.fileSha256 };
  });
  const body = {
    schemaVersion: "pm-state-bench-train-artifact-seal.v1" as const,
    benchmarkRevision: STATE_BENCH_MANIFEST.upstreamRevision,
    artifactSha256: sha256(canonical(artifact)),
    corpus: {
      root: STATE_BENCH_MANIFEST.trainCorpusRoot,
      fileCount: corpus.files.length,
      treeSha256: corpus.treeSha256,
    },
    citedSources,
  };
  return { ...body, sealHash: sha256(canonical(body)) };
}

function verifyTrainArtifactSeal(
  checkoutPath: string,
  artifactPath: string,
  value: unknown,
): VerificationResult {
  try {
    const recomputed = createTrainArtifactSeal(checkoutPath, artifactPath);
    if (canonical(value) !== canonical(recomputed)) {
      return {
        valid: false,
        issues: ["artifact seal is incomplete, stale, or does not recompute"],
      };
    }
    return { valid: true, issues: [] };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

const extractionProvenance = createStateBenchExtractionProvenance({
  STATE_BENCH_MANIFEST, TRAIN_PREFIX, sha256, canonical, isObject, exactKeys,
  requiredString, safeId, exactTimestamp, shaValue, readJson, normalizeRelative,
  regularFilesRecursively, sourcePath, assertVerifiedCheckout, loadArtifact,
  inspectTrainCorpus, verifyTrainArtifactSeal,
});
function loadSealedArtifact(
  checkoutPath: string,
  artifactPath: string,
  sealPath: string,
): StateBenchLearningArtifact {
  const verification = verifyTrainArtifactSeal(
    checkoutPath,
    artifactPath,
    readJson(sealPath),
  );
  if (!verification.valid) {
    throw new Error(`artifact seal verification failed: ${verification.issues.join("; ")}`);
  }
  return loadArtifact(artifactPath);
}

function assertRunArtifactCoverage(
  artifact: StateBenchLearningArtifact,
  config: StateBenchRunConfig,
  at?: string,
): void {
  const parsedArtifact = parseArtifact(artifact);
  const parsedConfig = parseRunConfig(config);
  if (parsedConfig.arm === "native") {
    throw new Error("native arm cannot consume a learning artifact");
  }
  const atMs = at === undefined ? undefined : Date.parse(exactTimestamp(at, "coverageAt"));
  const active = parsedArtifact.entries.filter(
    (entry) =>
      entry.domain === parsedConfig.domain &&
      entry.status === "active" &&
      (atMs === undefined ||
        entry.validUntil === undefined ||
        atMs <= Date.parse(entry.validUntil)),
  );
  if (active.length < STATE_BENCH_MANIFEST.retrievalTopK * 2) {
    throw new Error(
      `${parsedConfig.arm} run requires at least 6 active sealed learnings for disjoint treatment/control retrieval in ${parsedConfig.domain}`,
    );
  }
}

function parseRetrievalIdentity(value: unknown): StateBenchRetrievalIdentity {
  if (!isObject(value)) throw new Error("retrieval identity must be an object");
  exactKeys(
    value,
    ["experimentId", "configSha256", "runId", "taskId", "domain", "modelId"],
    "retrieval identity",
  );
  return {
    experimentId: safeId(value.experimentId, "identity.experimentId"),
    configSha256: shaValue(value.configSha256, "identity.configSha256"),
    runId: safeId(value.runId, "identity.runId"),
    taskId: safeId(value.taskId, "identity.taskId"),
    domain: domainValue(value.domain, "identity.domain"),
    modelId: safeId(value.modelId, "identity.modelId"),
  };
}

function parseRetrievalMeasurement(value: unknown, path: string): StateBenchRetrievalMeasurement {
  if (!isObject(value)) throw new Error(`${path} must be an object`);
  exactKeys(value, ["tokenUnit", "queryTokens", "outputTokens", "latencyMs", "costUsd"], path);
  if (
    value.tokenUnit !== "utf8_byte_token.v1" ||
    !Number.isInteger(value.queryTokens) ||
    (value.queryTokens as number) < 1 ||
    !Number.isInteger(value.outputTokens) ||
    (value.outputTokens as number) < 1 ||
    typeof value.latencyMs !== "number" ||
    !Number.isFinite(value.latencyMs) ||
    value.latencyMs <= 0 ||
    value.costUsd !== 0
  ) {
    throw new Error(`${path} must bind positive UTF-8 token counts/latency and zero local cost`);
  }
  return {
    tokenUnit: "utf8_byte_token.v1",
    queryTokens: value.queryTokens as number,
    outputTokens: value.outputTokens as number,
    latencyMs: value.latencyMs,
    costUsd: 0,
  };
}

function retrieve(
  artifact: StateBenchLearningArtifact,
  request: StateBenchRetrievalRequest,
): StateBenchRetrievalResponse {
  const startedAt = performance.now();
  if (request.query.trim().length === 0) throw new Error("query must be non-empty");
  if (request.topK !== STATE_BENCH_MANIFEST.retrievalTopK) {
    throw new Error("STATE-Bench official retrieval top_k must be 3");
  }
  const requestedAt = exactTimestamp(request.requestedAt, "requestedAt");
  const identity = parseRetrievalIdentity(request.identity);
  if (identity.domain !== request.identity.domain) throw new Error("identity domain drifted");
  if (request.arm !== "sham" && request.arm !== "substrate") {
    throw new Error("native arm must not call the retrieval sidecar");
  }

  const requestedMs = Date.parse(requestedAt);
  const active = artifact.entries.filter(
    (entry) =>
      entry.status === "active" &&
      entry.domain === identity.domain &&
      (entry.validUntil === undefined || requestedMs <= Date.parse(entry.validUntil)),
  );
  const queryTokens = tokenize(request.query);
  const ranked = [...active]
    .sort((left, right) => {
      const score = overlapScore(queryTokens, right) - overlapScore(queryTokens, left);
      return score === 0 ? left.learningId.localeCompare(right.learningId) : score;
    });
  const treatmentIds = new Set(ranked.slice(0, request.topK).map((entry) => entry.learningId));
  const selected = request.arm === "substrate"
    ? ranked.slice(0, request.topK)
    : active
        .filter(
          (entry) =>
            !treatmentIds.has(entry.learningId) && overlapScore(queryTokens, entry) === 0,
        )
        .sort((left, right) =>
          sha256(canonical({ identity, query: request.query, learningId: left.learningId })).localeCompare(
            sha256(canonical({ identity, query: request.query, learningId: right.learningId })),
          ),
        )
        .slice(0, request.topK);
  if (selected.length !== request.topK) {
    throw new Error(
      `${request.arm} retrieval requires exactly 3 disjoint zero-overlap irrelevant train learnings`,
    );
  }
  const learnings = selected.map((entry) => entry.text);
  const artifactSha256 = sha256(canonical(artifact));
  const identitySha256 = sha256(canonical(identity));
  const view: CurrentStateView = {
    tenantId: tenantId("tenant_public_state_bench"),
    viewId: `state-bench:${request.arm}:${artifactSha256}:${sha256(canonical({ identity, query: request.query })).slice(0, 16)}`,
    subject: {
      kind: "document",
      id: `state-bench-learnings:${artifact.corpusSha256}`,
    },
    observedAt: timestamp(requestedAt),
    authorityRule:
      request.arm === "sham"
        ? "state_bench_disjoint_irrelevant_train_control_only"
        : "state_bench_train_trajectories_only",
    sourceRefs: selected.flatMap((entry) =>
      entry.sourceTrajectories.map((source) => ({
        kind: "source_record" as const,
        id: source,
      })),
    ),
    missingSources: [],
    conflicts: [],
    allowedActions: [],
  };
  const contract = buildObservationContractFromCurrentStateView(view);
  const evaluation = evaluateObservationContract(contract, view, timestamp(requestedAt));
  if (!evaluation.valid) throw new Error("core observation boundary rejected the retrieval view");
  const measurement: StateBenchRetrievalMeasurement = {
    tokenUnit: "utf8_byte_token.v1",
    queryTokens: Buffer.byteLength(request.query, "utf8"),
    outputTokens: Buffer.byteLength(learnings.join("\n"), "utf8"),
    latencyMs: Math.max(performance.now() - startedAt, Number.EPSILON),
    costUsd: 0,
  };
  return {
    learnings,
    audit: {
      arm: request.arm,
      mode:
        request.arm === "sham"
          ? "irrelevant_train_state_core_observation"
          : "substrate_core_observation",
      identitySha256,
      artifactSha256,
      outputCharacterBudget: learnings.reduce((sum, item) => sum + item.length, 0),
      observationBoundaryInvoked: true,
      currentStateViewId: view.viewId,
      observationContractId: contract.contractId,
      observationContractValid: true,
      sourceLearningIds: selected.map((entry) => entry.learningId),
      measurement,
    },
  };
}

function parseRunConfig(value: unknown): StateBenchRunConfig {
  if (!isObject(value)) throw new Error("run config must be an object");
  exactKeys(
    value,
    [
      "schemaVersion",
      "experimentId",
      "arm",
      "domain",
      "agentModel",
      "agentClass",
      "split",
      "numRuns",
      "retrieveLearningsTopK",
      "artifactSealHash",
      "extractionProvenanceHash",
    ],
    "run config",
  );
  if (value.schemaVersion !== "pm-state-bench-run-config.v2") {
    throw new Error("unsupported run config schemaVersion");
  }
  if (value.arm !== "native" && value.arm !== "sham" && value.arm !== "substrate") {
    throw new Error("run config arm must be native, sham, or substrate");
  }
  if (!isObject(value.agentModel)) throw new Error("agentModel must be an object");
  exactKeys(value.agentModel, ["modelId", "reasoningLevel"], "agentModel");
  const reasoningLevel = value.agentModel.reasoningLevel;
  if (
    reasoningLevel !== null &&
    reasoningLevel !== "low" &&
    reasoningLevel !== "medium" &&
    reasoningLevel !== "high"
  ) {
    throw new Error("agentModel.reasoningLevel must be low, medium, high, or null");
  }
  if (value.split !== "test" || value.numRuns !== 5) {
    throw new Error("official run config requires test split and exactly 5 runs");
  }
  const sidecar = value.arm !== "native";
  const expectedAgentClass = sidecar ? "PmSubstrateAgent" : "StateBenchAgent";
  if (value.agentClass !== expectedAgentClass) {
    throw new Error(`${value.arm} arm requires agentClass ${expectedAgentClass}`);
  }
  if (value.retrieveLearningsTopK !== (sidecar ? 3 : null)) {
    throw new Error(`${value.arm} arm has an invalid retrieval top_k treatment`);
  }
  if (sidecar) {
    shaValue(value.artifactSealHash, "artifactSealHash");
    shaValue(value.extractionProvenanceHash, "extractionProvenanceHash");
  } else if (value.artifactSealHash !== null || value.extractionProvenanceHash !== null) {
    throw new Error("native arm cannot bind learning artifact or extraction provenance seals");
  }
  return {
    schemaVersion: "pm-state-bench-run-config.v2",
    experimentId: safeId(value.experimentId, "experimentId"),
    arm: value.arm,
    domain: domainValue(value.domain, "domain"),
    agentModel: {
      modelId: safeId(value.agentModel.modelId, "agentModel.modelId"),
      reasoningLevel,
    },
    agentClass: expectedAgentClass,
    split: "test",
    numRuns: 5,
    retrieveLearningsTopK: sidecar ? 3 : null,
    artifactSealHash: sidecar
      ? shaValue(value.artifactSealHash, "artifactSealHash")
      : null,
    extractionProvenanceHash: sidecar
      ? shaValue(value.extractionProvenanceHash, "extractionProvenanceHash")
      : null,
  };
}

function loadRunConfig(path: string): StateBenchRunConfig {
  return parseRunConfig(readJson(path));
}

function officialTaskIds(
  checkoutPath: string,
  domain: StateBenchDomain,
): readonly string[] {
  const root = assertVerifiedCheckout(checkoutPath);
  return loadSplitManifest(root, domainValue(domain, "domain")).test;
}

function runConfigSha256(config: StateBenchRunConfig): string {
  return sha256(canonical(parseRunConfig(config)));
}

function officialRunId(config: StateBenchRunConfig, runIndex: number): string {
  if (!Number.isInteger(runIndex) || runIndex < 1 || runIndex > 5) {
    throw new Error("runIndex must be an integer from 1 through 5");
  }
  return `${config.experimentId}:${config.arm}:${config.domain}:run${runIndex}`;
}

function createAuditSession(
  config: StateBenchRunConfig,
  runIndex: number,
  startedAt: string,
): StateBenchAuditSessionRecord {
  const parsed = parseRunConfig(config);
  if (
    parsed.arm === "native" ||
    parsed.artifactSealHash === null ||
    parsed.extractionProvenanceHash === null
  ) {
    throw new Error("native arm cannot create a sidecar audit session");
  }
  const body = {
    schemaVersion: AUDIT_SCHEMA as "pm-state-bench-sidecar-audit.v2",
    recordType: "session" as const,
    sequence: 0 as const,
    startedAt: exactTimestamp(startedAt, "startedAt"),
    identity: {
      experimentId: parsed.experimentId,
      arm: parsed.arm,
      domain: parsed.domain,
      runIndex,
      runId: officialRunId(parsed, runIndex),
      configSha256: runConfigSha256(parsed),
      modelId: parsed.agentModel.modelId,
    },
    artifactSealHash: parsed.artifactSealHash,
    extractionProvenanceHash: parsed.extractionProvenanceHash,
    previousHash: null,
  };
  return { ...body, recordHash: sha256(canonical(body)) };
}

function createAuditRetrieval(
  previousHash: string,
  sequence: number,
  request: StateBenchRetrievalRequest,
  response: StateBenchRetrievalResponse,
  recordedAt: string,
): StateBenchAuditRetrievalRecord {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("audit sequence must be a positive integer");
  }
  const identity = parseRetrievalIdentity(request.identity);
  if (request.arm !== response.audit.arm) throw new Error("retrieval arm audit mismatch");
  if (response.audit.identitySha256 !== sha256(canonical(identity))) {
    throw new Error("retrieval response identity does not match the request");
  }
  if (
    (request.arm === "sham" &&
      response.audit.mode !== "irrelevant_train_state_core_observation") ||
    (request.arm === "substrate" &&
      response.audit.mode !== "substrate_core_observation") ||
    !response.audit.observationBoundaryInvoked ||
    response.audit.observationContractValid !== true ||
    response.audit.sourceLearningIds.length !== request.topK
  ) {
    throw new Error("retrieval response treatment evidence is inconsistent with its arm");
  }
  const measurement = parseRetrievalMeasurement(response.audit.measurement, "measurement");
  const body = {
    schemaVersion: AUDIT_SCHEMA as "pm-state-bench-sidecar-audit.v2",
    recordType: "retrieval" as const,
    sequence,
    recordedAt: exactTimestamp(recordedAt, "recordedAt"),
    identity,
    querySha256: sha256(request.query),
    topK: request.topK,
    responseSha256: sha256(canonical(response.learnings)),
    mode: response.audit.mode,
    observationBoundaryInvoked: response.audit.observationBoundaryInvoked,
    observationContractValid: response.audit.observationContractValid,
    sourceLearningIds: [...response.audit.sourceLearningIds],
    measurement,
    previousHash: shaValue(previousHash, "previousHash"),
  };
  return { ...body, recordHash: sha256(canonical(body)) };
}

function verifyOfficialMetrics(value: unknown): VerificationResult {
  const issues: string[] = [];
  if (!isObject(value)) return { valid: false, issues: ["metrics artifact must be an object"] };
  if (value.benchmark_version !== STATE_BENCH_MANIFEST.packageVersion) {
    issues.push(`benchmark_version must equal ${STATE_BENCH_MANIFEST.packageVersion}`);
  }
  if (value.evaluation_protocol_id !== OFFICIAL_PROTOCOL_ID) {
    issues.push(`evaluation_protocol_id must equal ${OFFICIAL_PROTOCOL_ID}`);
  }
  if (value.num_runs !== STATE_BENCH_MANIFEST.officialRuns) {
    issues.push("official metrics require exactly 5 runs");
  }
  if (!isObject(value.agent_model)) issues.push("agent_model identity is required");
  else if (typeof value.agent_model.model_name !== "string") {
    issues.push("agent_model.model_name is required");
  }
  if (!isObject(value.metrics)) issues.push("metrics object is required");
  else {
    for (const key of STATE_BENCH_MANIFEST.officialMetricKeys) {
      const metric = value.metrics[key];
      if (typeof metric !== "number" || metric < 0 || metric > 1) {
        issues.push(`${key} must be a number between 0 and 1`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

function protocolData(root: string): Readonly<Record<string, unknown>> {
  const value = readJson(join(root, STATE_BENCH_MANIFEST.protocolFile));
  if (!isObject(value)) throw new Error("official protocol must be an object");
  return value;
}

function promptHashes(
  protocol: Readonly<Record<string, unknown>>,
  section: "simulator" | "judge",
  domain: StateBenchDomain,
): Readonly<Record<string, string>> {
  const value = protocol[section];
  if (!isObject(value) || !isObject(value.prompt_hashes)) {
    throw new Error(`${section} prompt hashes are missing`);
  }
  return Object.fromEntries(
    Object.entries(value.prompt_hashes)
      .filter(([key]) => key.startsWith(`${domain}/`))
      .map(([key, hash]) => {
        if (typeof hash !== "string") throw new Error(`${section} prompt hash is invalid`);
        return [key.slice(domain.length + 1), hash];
      }),
  );
}

function halfEvenRound2(value: number): number {
  const scaled = value * 100;
  const floor = Math.floor(scaled + 1e-12);
  const fraction = scaled - floor;
  if (Math.abs(fraction - 0.5) < 1e-10) {
    return (floor % 2 === 0 ? floor : floor + 1) / 100;
  }
  return Math.round(scaled) / 100;
}

interface RetrievalCallEvidence {
  readonly taskId: string;
  readonly querySha256: string;
  readonly responseSha256: string;
}

function trajectoryRetrievalCalls(
  trajectory: Readonly<Record<string, unknown>>,
  taskId: string,
): readonly RetrievalCallEvidence[] {
  if (!Array.isArray(trajectory.conversation) || trajectory.conversation.length === 0) {
    throw new Error(`${taskId} trajectory conversation must be non-empty`);
  }
  const calls: RetrievalCallEvidence[] = [];
  for (const message of trajectory.conversation) {
    if (!isObject(message) || message.tool_calls === null || message.tool_calls === undefined) continue;
    if (!Array.isArray(message.tool_calls)) throw new Error(`${taskId} tool_calls must be an array`);
    for (const rawCall of message.tool_calls) {
      if (!isObject(rawCall) || rawCall.name !== "retrieve_learnings") continue;
      if (!isObject(rawCall.arguments)) throw new Error(`${taskId} retrieval arguments are malformed`);
      const query = requiredString(rawCall.arguments.query, `${taskId} retrieval query`);
      const topK = rawCall.arguments.top_k ?? 3;
      if (topK !== 3) throw new Error(`${taskId} retrieval call did not use top_k=3`);
      if (!isObject(rawCall.result) || !Array.isArray(rawCall.result.learnings)) {
        throw new Error(`${taskId} retrieval result is malformed`);
      }
      if (rawCall.result.learnings.some((item) => typeof item !== "string")) {
        throw new Error(`${taskId} retrieval result must be list[str]`);
      }
      calls.push({
        taskId,
        querySha256: sha256(query),
        responseSha256: sha256(canonical(rawCall.result.learnings)),
      });
    }
  }
  return calls;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function callKey(call: RetrievalCallEvidence): string {
  return `${call.taskId}\0${call.querySha256}\0${call.responseSha256}`;
}

function parseAuditLog(
  path: string,
  config: StateBenchRunConfig,
  runIndex: number,
): {
  readonly records: readonly StateBenchAuditRetrievalRecord[];
  readonly fileSha256: string;
  readonly finalRecordHash: string;
} {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error(`sidecar audit is empty: ${path}`);
  const rawRecords = lines.map((line) => JSON.parse(line) as unknown);
  const expectedSession = createAuditSession(
    config,
    runIndex,
    exactTimestamp(
      isObject(rawRecords[0]) ? rawRecords[0].startedAt : undefined,
      "audit session startedAt",
    ),
  );
  if (canonical(rawRecords[0]) !== canonical(expectedSession)) {
    throw new Error(`sidecar audit session identity or hash is invalid: ${path}`);
  }
  const records: StateBenchAuditRetrievalRecord[] = [];
  let previousHash = expectedSession.recordHash;
  for (let index = 1; index < rawRecords.length; index += 1) {
    const raw = rawRecords[index];
    if (!isObject(raw)) throw new Error(`audit record ${index} must be an object`);
    const identity = parseRetrievalIdentity(raw.identity);
    if (
      raw.schemaVersion !== AUDIT_SCHEMA ||
      raw.recordType !== "retrieval" ||
      raw.sequence !== index ||
      identity.experimentId !== config.experimentId ||
      identity.configSha256 !== runConfigSha256(config) ||
      identity.runId !== officialRunId(config, runIndex) ||
      identity.domain !== config.domain ||
      identity.modelId !== config.agentModel.modelId
    ) {
      throw new Error(`audit record ${index} identity is not bound to the run config`);
    }
    const mode = raw.mode;
    const expectedMode: StateBenchAuditRetrievalRecord["mode"] =
      config.arm === "sham"
        ? "irrelevant_train_state_core_observation"
        : "substrate_core_observation";
    if (mode !== expectedMode) throw new Error(`audit record ${index} treatment arm mismatch`);
    if (raw.topK !== 3) throw new Error(`audit record ${index} top_k must equal 3`);
    const sourceLearningIds = stringArray(raw.sourceLearningIds, `audit[${index}].sourceLearningIds`);
    const measurement = parseRetrievalMeasurement(raw.measurement, `audit[${index}].measurement`);
    if (
      raw.observationBoundaryInvoked !== true ||
      raw.observationContractValid !== true ||
      sourceLearningIds.length !== 3
    ) {
      throw new Error(`audit record ${index} observation boundary evidence is invalid`);
    }
    const body: Omit<StateBenchAuditRetrievalRecord, "recordHash"> = {
      schemaVersion: AUDIT_SCHEMA as "pm-state-bench-sidecar-audit.v2",
      recordType: "retrieval" as const,
      sequence: index,
      recordedAt: exactTimestamp(raw.recordedAt, `audit[${index}].recordedAt`),
      identity,
      querySha256: shaValue(raw.querySha256, `audit[${index}].querySha256`),
      topK: 3 as const,
      responseSha256: shaValue(raw.responseSha256, `audit[${index}].responseSha256`),
      mode: expectedMode,
      observationBoundaryInvoked: true,
      observationContractValid: true,
      sourceLearningIds,
      measurement,
      previousHash: shaValue(raw.previousHash, `audit[${index}].previousHash`),
    };
    if (body.previousHash !== previousHash) {
      throw new Error(`audit record ${index} hash chain is invalid`);
    }
    const record = { ...body, recordHash: sha256(canonical(body)) };
    if (canonical(raw) !== canonical(record)) {
      throw new Error(`audit record ${index} is incomplete or does not recompute`);
    }
    records.push(record);
    previousHash = record.recordHash;
  }
  return {
    records,
    fileSha256: sha256(text),
    finalRecordHash: previousHash,
  };
}

function verifyTrajectory(
  trajectory: unknown,
  taskId: string,
  config: StateBenchRunConfig,
  simulatorPromptHash: string,
  judgePromptHashes: Readonly<Record<string, string>>,
): { readonly pass: 0 | 1; readonly calls: readonly RetrievalCallEvidence[] } {
  if (!isObject(trajectory)) throw new Error(`${taskId} trajectory must be an object`);
  if (trajectory.task_id !== taskId) throw new Error(`${taskId} trajectory task_id mismatch`);
  if (trajectory.evaluation_protocol_id !== OFFICIAL_PROTOCOL_ID) {
    throw new Error(`${taskId} does not carry the official evaluation protocol`);
  }
  if (
    trajectory.simulator_model !== "gpt-5.4" ||
    trajectory.simulator_prompt_hash !== simulatorPromptHash
  ) {
    throw new Error(`${taskId} simulator identity is not pinned`);
  }
  if (trajectory.agent_name !== config.agentClass) {
    throw new Error(`${taskId} agent class does not match ${config.arm} arm`);
  }
  const expectedAgentModel = {
    model_name: config.agentModel.modelId,
    reasoning_level: config.agentModel.reasoningLevel,
  };
  if (canonical(trajectory.agent_model) !== canonical(expectedAgentModel)) {
    throw new Error(`${taskId} agent model identity does not match run config`);
  }
  if (
    trajectory.scoring_protocol_id !== OFFICIAL_PROTOCOL_ID ||
    trajectory.judge_model !== "gpt-5.4" ||
    trajectory.judge_reasoning_effort !== "high" ||
    canonical(trajectory.judge_prompt_hashes) !== canonical(judgePromptHashes)
  ) {
    throw new Error(`${taskId} official scoring identity is missing or drifted`);
  }
  for (const field of [
    "state_requirements_met",
    "task_requirements_met",
    "task_completion_pass",
  ] as const) {
    if (trajectory[field] !== 0 && trajectory[field] !== 1) {
      throw new Error(`${taskId} ${field} must be a scored binary value`);
    }
  }
  if (!isObject(trajectory.state_diff)) throw new Error(`${taskId} state_diff is required`);
  if (typeof trajectory.user_id !== "string" || typeof trajectory.task_summary !== "string") {
    throw new Error(`${taskId} trajectory identity fields are missing`);
  }
  const calls = trajectoryRetrievalCalls(trajectory, taskId);
  if (config.arm === "native" && calls.length !== 0) {
    throw new Error(`${taskId} native trajectory called retrieve_learnings`);
  }
  return { pass: trajectory.task_completion_pass as 0 | 1, calls };
}

function adapterPath(): string {
  return resolve(fileURLToPath(new URL("../adapter/pm_substrate_agent.py", import.meta.url)));
}

function parseFailureInventory(
  value: unknown,
  taskIds: ReadonlySet<string>,
): StateBenchOutputConformanceReceipt["rawOutputs"]["failures"]["records"] {
  if (!isObject(value)) throw new Error("failures.json must be an object");
  exactKeys(value, ["schemaVersion", "records"], "failures.json");
  if (value.schemaVersion !== "pm-state-bench-failures.v1" || !Array.isArray(value.records)) {
    throw new Error("failures.json schema or records are invalid");
  }
  const seen = new Set<string>();
  return value.records.map((raw, index) => {
    if (!isObject(raw)) throw new Error(`failure record ${index} must be an object`);
    exactKeys(
      raw,
      ["runIndex", "taskId", "attemptId", "occurredAt", "errorClass", "errorSha256"],
      `failure record ${index}`,
    );
    if (!Number.isInteger(raw.runIndex) || (raw.runIndex as number) < 1 || (raw.runIndex as number) > 5) {
      throw new Error(`failure record ${index} runIndex is invalid`);
    }
    const taskId = safeId(raw.taskId, `failure record ${index}.taskId`);
    if (!taskIds.has(taskId)) throw new Error(`failure record ${index} taskId is not held out`);
    const attemptId = safeId(raw.attemptId, `failure record ${index}.attemptId`);
    if (seen.has(attemptId)) throw new Error(`failure attemptId is duplicated: ${attemptId}`);
    seen.add(attemptId);
    return {
      runIndex: raw.runIndex as number,
      taskId,
      attemptId,
      occurredAt: exactTimestamp(raw.occurredAt, `failure record ${index}.occurredAt`),
      errorClass: safeId(raw.errorClass, `failure record ${index}.errorClass`),
      errorSha256: shaValue(raw.errorSha256, `failure record ${index}.errorSha256`),
    };
  });
}

function collectOutputConformanceReceipt(
  input: StateBenchOfficialCollectionInput,
): StateBenchOutputConformanceReceipt {
  const root = assertVerifiedCheckout(input.checkoutPath);
  const config = loadRunConfig(input.configPath);
  const configHash = runConfigSha256(config);
  const split = loadSplitManifest(root, config.domain);
  const taskIds = [...split.test].sort();
  const protocol = protocolData(root);
  const simulatorHashes = promptHashes(protocol, "simulator", config.domain);
  const simulatorPromptHash = simulatorHashes["user_sim_base.md"];
  if (simulatorPromptHash === undefined) throw new Error("simulator prompt hash is missing");
  const judgeHashes = promptHashes(protocol, "judge", config.domain);
  const resultsRoot = resolve(input.resultsPath);
  if (lstatSync(resultsRoot).isSymbolicLink() || !lstatSync(resultsRoot).isDirectory()) {
    throw new Error("results root must be a real directory, not a symbolic link");
  }
  const expectedTopLevel = [
    "failures.json", "metrics.json", "run1", "run2", "run3", "run4", "run5",
  ] as const;
  const topLevelEntries = readdirSync(resultsRoot, { withFileTypes: true });
  if (canonical(topLevelEntries.map((entry) => entry.name).sort()) !== canonical(expectedTopLevel)) {
    throw new Error("results root inventory must contain only failures.json, metrics.json, and run1 through run5");
  }
  for (const entry of topLevelEntries) {
    const metadata = lstatSync(join(resultsRoot, entry.name));
    const directoryExpected = /^run[1-5]$/u.test(entry.name);
    if (metadata.isSymbolicLink() || (directoryExpected ? !metadata.isDirectory() : !metadata.isFile())) {
      throw new Error(`results root entry has an invalid type or is a symbolic link: ${entry.name}`);
    }
  }
  const failuresPath = join(resultsRoot, "failures.json");
  const failureRecords = parseFailureInventory(readJson(failuresPath), new Set(taskIds));

  let artifactSha256: string | null = null;
  let artifactSealHash: string | null = null;
  let extractionProvenanceHash: string | null = null;
  let adapterFileSha256: string | null = null;
  if (config.arm === "native") {
    if (
      input.auditRoot !== undefined ||
      input.artifactPath !== undefined ||
      input.sealPath !== undefined ||
      input.extractionProvenancePath !== undefined ||
      input.pipelineManifestPath !== undefined ||
      input.extractorSourcePath !== undefined ||
      input.promptPath !== undefined ||
      input.toolsPath !== undefined ||
      input.decodingPath !== undefined ||
      input.rawRecordsPath !== undefined
    ) {
      throw new Error("native collection cannot accept sidecar, artifact, or extraction provenance inputs");
    }
  } else {
    if (
      input.auditRoot === undefined ||
      input.artifactPath === undefined ||
      input.sealPath === undefined ||
      input.extractionProvenancePath === undefined ||
      input.pipelineManifestPath === undefined ||
      input.extractorSourcePath === undefined ||
      input.promptPath === undefined ||
      input.toolsPath === undefined ||
      input.decodingPath === undefined ||
      input.rawRecordsPath === undefined
    ) {
      throw new Error(
        "sidecar collection requires audit, artifact, and complete extraction provenance inputs",
      );
    }
    const sealValue = readJson(input.sealPath);
    const sealVerification = verifyTrainArtifactSeal(root, input.artifactPath, sealValue);
    if (!sealVerification.valid || !isObject(sealValue)) {
      throw new Error(`sidecar artifact seal is invalid: ${sealVerification.issues.join("; ")}`);
    }
    artifactSealHash = shaValue(sealValue.sealHash, "seal.sealHash");
    artifactSha256 = shaValue(sealValue.artifactSha256, "seal.artifactSha256");
    if (artifactSealHash !== config.artifactSealHash) {
      throw new Error("run config artifactSealHash does not match the verified artifact");
    }
    const extractionInput: StateBenchExtractionCollectionInput = {
      checkoutPath: root,
      artifactPath: input.artifactPath,
      artifactSealPath: input.sealPath,
      pipelineManifestPath: input.pipelineManifestPath,
      extractorSourcePath: input.extractorSourcePath,
      promptPath: input.promptPath,
      toolsPath: input.toolsPath,
      decodingPath: input.decodingPath,
      rawRecordsPath: input.rawRecordsPath,
    };
    const extractionValue = readJson(input.extractionProvenancePath);
    const extractionVerification = extractionProvenance.verifyExtractionProvenanceReceipt(
      extractionInput,
      extractionValue,
    );
    if (!extractionVerification.valid || !isObject(extractionValue)) {
      throw new Error(
        `sidecar extraction provenance is invalid: ${extractionVerification.issues.join("; ")}`,
      );
    }
    extractionProvenanceHash = shaValue(
      extractionValue.receiptHash,
      "extraction provenance receiptHash",
    );
    if (extractionProvenanceHash !== config.extractionProvenanceHash) {
      throw new Error(
        "run config extractionProvenanceHash does not match the verified extraction evidence",
      );
    }
    assertRunArtifactCoverage(loadArtifact(input.artifactPath), config);
    adapterFileSha256 = sha256(readFileSync(adapterPath()));
    const installedAdapter = join(root, "agents", "pm_substrate_agent.py");
    try {
      if (
        !lstatSync(installedAdapter).isFile() ||
        sha256(readFileSync(installedAdapter)) !== adapterFileSha256
      ) {
        throw new Error("adapter mismatch");
      }
    } catch {
      throw new Error("pinned checkout PmSubstrateAgent does not match the packaged adapter");
    }
  }

  const allRows: string[] = [];
  const passByRun: number[][] = [];
  const allCalls = new Map<number, RetrievalCallEvidence[]>();
  const runs: StateBenchOutputConformanceReceipt["rawOutputs"]["runs"][number][] = [];
  for (let runIndex = 1; runIndex <= 5; runIndex += 1) {
    const runDirectory = join(resultsRoot, `run${runIndex}`);
    if (!lstatSync(runDirectory).isDirectory()) {
      throw new Error(`run${runIndex} must be a real directory, not a link`);
    }
    const files = regularFilesRecursively(runDirectory);
    if (
      files.some(
        (path) =>
          extname(path) !== ".json" ||
          normalizeRelative(relative(runDirectory, path)).includes("/"),
      )
    ) {
      throw new Error(`run${runIndex} contains non-trajectory or nested output files`);
    }
    const actualTaskIds = files.map((path) => basename(path, ".json")).sort();
    if (canonical(actualTaskIds) !== canonical(taskIds)) {
      throw new Error(`run${runIndex} must contain exactly the 50 official held-out task files`);
    }
    const calls: RetrievalCallEvidence[] = [];
    const passes: number[] = [];
    const taskOutputs = taskIds.map((taskId) => {
      const path = join(runDirectory, `${taskId}.json`);
      const verified = verifyTrajectory(
        readJson(path),
        taskId,
        config,
        simulatorPromptHash,
        judgeHashes,
      );
      passes.push(verified.pass);
      calls.push(...verified.calls);
      const relativePath = `run${runIndex}/${taskId}.json`;
      const fileSha256 = sha256(readFileSync(path));
      const row = `${relativePath}\0${fileSha256}\n`;
      allRows.push(row);
      return { taskId, path: relativePath, fileSha256 };
    });
    passByRun.push(passes);
    allCalls.set(runIndex, calls);
    runs.push({
      runIndex,
      runId: officialRunId(config, runIndex),
      treeSha256: sha256(taskOutputs.map((item) => `${item.path}\0${item.fileSha256}\n`).join("")),
      retrievalCallCount: calls.length,
      taskOutputs,
    });
  }

  const sidecarAudits: StateBenchOutputConformanceReceipt["sidecarAudits"][number][] = [];
  if (config.arm !== "native" && input.auditRoot !== undefined) {
    const auditFiles = regularFilesRecursively(resolve(input.auditRoot)).map((path) =>
      normalizeRelative(relative(resolve(input.auditRoot!), path)),
    );
    const expectedAuditFiles = [1, 2, 3, 4, 5].map((index) => `run${index}.jsonl`);
    if (canonical(auditFiles.sort()) !== canonical(expectedAuditFiles)) {
      throw new Error("audit root must contain exactly run1.jsonl through run5.jsonl");
    }
    for (let runIndex = 1; runIndex <= 5; runIndex += 1) {
      const path = join(resolve(input.auditRoot), `run${runIndex}.jsonl`);
      const audit = parseAuditLog(path, config, runIndex);
      const expectedCalls = new Map<string, number>();
      const observedCalls = new Map<string, number>();
      for (const call of allCalls.get(runIndex) ?? []) increment(expectedCalls, callKey(call));
      for (const record of audit.records) {
        increment(
          observedCalls,
          callKey({
            taskId: record.identity.taskId,
            querySha256: record.querySha256,
            responseSha256: record.responseSha256,
          }),
        );
      }
      if (canonical(Object.fromEntries(expectedCalls)) !== canonical(Object.fromEntries(observedCalls))) {
        throw new Error(`run${runIndex} trajectory retrieval calls do not match sidecar audit records`);
      }
      sidecarAudits.push({
        runIndex,
        runId: officialRunId(config, runIndex),
        path: `run${runIndex}.jsonl`,
        fileSha256: audit.fileSha256,
        retrievalRecordCount: audit.records.length,
        finalRecordHash: audit.finalRecordHash,
      });
    }
  }

  const metricsPath = join(resultsRoot, "metrics.json");
  const metrics = readJson(metricsPath);
  const metricsVerification = verifyOfficialMetrics(metrics);
  if (!metricsVerification.valid || !isObject(metrics) || !isObject(metrics.metrics)) {
    throw new Error(`official metrics are invalid: ${metricsVerification.issues.join("; ")}`);
  }
  const expectedAgentModel = {
    model_name: config.agentModel.modelId,
    reasoning_level: config.agentModel.reasoningLevel,
  };
  if (canonical(metrics.agent_model) !== canonical(expectedAgentModel)) {
    throw new Error("metrics agent_model does not match run config");
  }
  const totalPasses = passByRun.flat().reduce((sum, value) => sum + value, 0);
  const recomputedPassAt1 = halfEvenRound2(totalPasses / (50 * 5));
  const allRunPassCount = taskIds.filter((_, taskIndex) =>
    passByRun.every((run) => run[taskIndex] === 1),
  ).length;
  const recomputedPower5 = halfEvenRound2(allRunPassCount / 50);
  if (
    metrics.metrics["task_completion_pass@1"] !== recomputedPassAt1 ||
    metrics.metrics["task_completion_pass^5"] !== recomputedPower5
  ) {
    throw new Error("official metrics do not recompute from the 250 scored trajectories");
  }

  const body = {
    schemaVersion: "pm-state-bench-output-conformance.v1" as const,
    evidenceClass: "official_output_shape_and_procedure_conformance_only" as const,
    authorityStatus: "ineligible_for_efficacy_or_public_eval_attempt" as const,
    benchmark: {
      repositoryUrl: STATE_BENCH_MANIFEST.upstreamUrl,
      revision: STATE_BENCH_MANIFEST.upstreamRevision,
      packageVersion: STATE_BENCH_MANIFEST.packageVersion,
      protocolId: OFFICIAL_PROTOCOL_ID,
      protocolFileSha256: STATE_BENCH_MANIFEST.protocolFileSha256,
    },
    identity: {
      experimentId: config.experimentId,
      arm: config.arm,
      domain: config.domain,
      configSha256: configHash,
      modelId: config.agentModel.modelId,
      reasoningLevel: config.agentModel.reasoningLevel,
      runIds: runs.map((run) => run.runId),
      taskIds,
    },
    treatment: {
      agentClass: config.agentClass,
      retrieval:
        config.arm === "native"
          ? ("none" as const)
          : config.arm === "sham"
            ? ("irrelevant_train_state_core_observation" as const)
            : ("substrate_core_observation" as const),
      artifactSha256,
      artifactSealHash,
      extractionProvenanceHash,
      adapterFileSha256,
    },
    rawOutputs: {
      fileCount: allRows.length + 2,
      treeSha256: sha256(
        [
          ...allRows,
          `failures.json\0${sha256(readFileSync(failuresPath))}\n`,
          `metrics.json\0${sha256(readFileSync(metricsPath))}\n`,
        ].sort().join(""),
      ),
      topLevelEntries: [
        "failures.json", "metrics.json", "run1", "run2", "run3", "run4", "run5",
      ] as const,
      failures: {
        path: "failures.json" as const,
        fileSha256: sha256(readFileSync(failuresPath)),
        records: failureRecords,
      },
      runs,
    },
    sidecarAudits,
    reportedScoringShape: {
      callerAuthoredFields: true as const,
      evaluatorModel: "gpt-5.4" as const,
      judgeReasoningEffort: "high" as const,
      metricsFileSha256: sha256(readFileSync(metricsPath)),
      taskCompletionPassAt1: recomputedPassAt1,
      taskCompletionPassPower5: recomputedPower5,
      totalScoredTrajectories: 250,
    },
    eligibility: {
      publicEvalAttemptEligible: false as const,
      missingVerifiedEvidence: [
        "official_runner_receipt",
        "agent_provider_raw_response_receipts",
        "simulator_provider_raw_response_receipts",
        "judge_provider_raw_response_receipts",
        "provider_request_ids_usage_cost_latency_and_exact_bytes",
      ] as const,
    },
  };
  return { ...body, receiptHash: sha256(canonical(body)) };
}

function verifyOutputConformanceReceipt(
  input: StateBenchOfficialCollectionInput,
  value: unknown,
): VerificationResult {
  try {
    const recomputed = collectOutputConformanceReceipt(input);
    if (canonical(value) !== canonical(recomputed)) {
      return {
        valid: false,
        issues: ["output conformance receipt is incomplete, stale, or does not recompute"],
      };
    }
    return { valid: true, issues: [] };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function convertConformanceReceiptToPublicEvalAttemptArtifact(
  _receipt: StateBenchOutputConformanceReceipt,
): never {
  throw new Error(
    "STATE-Bench output conformance is ineligible for PublicEvalAttemptArtifact conversion: " +
      "the pinned upstream does not expose verifiable raw runner, agent-provider, simulator, " +
      "and judge response receipts with request IDs, usage, cost, latency, and exact bytes",
  );
}

/**
 * The only runtime value exported by this peripheral package. The CLI consumes
 * each method; benchmark-specific formalisms do not extend substrate core.
 */
export const stateBenchLearningAdapter = Object.freeze({
  manifest: STATE_BENCH_MANIFEST,
  loadArtifact,
  loadSealedArtifact,
  assertRunArtifactCoverage,
  createTrainArtifactSeal,
  verifyTrainArtifactSeal,
  createExtractionPipelineManifest: extractionProvenance.createExtractionPipelineManifest,
  parseExtractionPipelineManifest: extractionProvenance.parseExtractionPipelineManifest,
  verifyExtractionPipelineManifest: extractionProvenance.verifyExtractionPipelineManifest,
  createRawExtractionRecord: extractionProvenance.createRawExtractionRecord,
  createExtractionProvenanceReceipt: extractionProvenance.createExtractionProvenanceReceipt,
  verifyExtractionProvenanceReceipt: extractionProvenance.verifyExtractionProvenanceReceipt,
  loadProvenanceBoundArtifact: extractionProvenance.loadProvenanceBoundArtifact,
  retrieve,
  verifyCheckout,
  parseRunConfig,
  loadRunConfig,
  officialTaskIds,
  runConfigSha256,
  officialRunId,
  createAuditSession,
  createAuditRetrieval,
  verifyOfficialMetrics,
  collectOutputConformanceReceipt,
  verifyOutputConformanceReceipt,
  convertConformanceReceiptToPublicEvalAttemptArtifact,
});
