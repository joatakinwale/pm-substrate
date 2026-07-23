import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants as fsConstants,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const INPUT_SCHEMA = "pm.public-eval.toolsandbox-oracle-replay-input.v1";
const RECEIPT_SCHEMA = "pm.public-eval.toolsandbox-oracle-replay.v2";
const VERIFICATION_SCHEMA =
  "pm.public-eval.toolsandbox-oracle-replay-verification.v2";
const RECEIPT_PREFIX = "PM_TOOL_SANDBOX_ORACLE_REPLAY=";
const REPOSITORY_URL = "https://github.com/apple/ToolSandbox";
const REVISION = "165848b9a78cead7ca7fe7c89c688b58e6501219";
const TREE_HASH = "060c6eb2a9d4370c56586d4340401d87fa155eda";
const SCENARIO =
  "send_message_with_contact_content_cellular_off_multiple_user_turn";
const STRICT_RULE_ID = "pm.public-eval.toolsandbox-strict-task-success.v1";
const MAX_TURN_COUNT = 30;
const MILESTONE_COUNT = 4;
const MINEFIELD_COUNT = 0;
const STARTING_CONTEXT_NORMALIZATION_RULE_ID =
  "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1";
const NORMALIZED_STARTING_CONTEXT_SHA256 =
  "62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04";
const VOLATILE_TIMESTAMP_VALUE_COUNT = 11;
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_PROCESS_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 256 * 1024 * 1024;
const MAX_RESULT_SUMMARY_BYTES = 16 * 1024 * 1024;
const MAX_REPLAY_SCRIPT_BYTES = 4 * 1024 * 1024;
const MAX_PYTHON_RUNTIME_BYTES = 256 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 600_000;
const ORACLE_REPLAY_ENVIRONMENT = Object.freeze({
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin",
  PYTHONHASHSEED: "0",
  PYTHONNOUSERSITE: "1",
  PYTHONDONTWRITEBYTECODE: "1",
  PYTHONUTF8: "1",
});
const REPLAY_SCRIPT_PATH = fileURLToPath(
  new URL("../upstream/replay_oracle.py", import.meta.url),
);

export type ToolSandboxOracleMapping = Readonly<
  Record<string, readonly [number, number]>
>;

export interface ToolSandboxOracleMetrics {
  readonly milestoneSimilarity: number;
  readonly minefieldSimilarity: number;
  readonly similarity: number;
  readonly turnCount: number;
}

export interface ToolSandboxOracleStrictRuleInputs {
  readonly allMilestonesExact: boolean;
  readonly allMilestonesPresent: boolean;
  readonly expectedMilestoneCount: number;
  readonly expectedMinefieldCount: number;
  readonly milestoneSimilarity: number;
  readonly minefieldSimilarity: number;
  readonly noMinefieldMatches: boolean;
  readonly observedMilestoneCount: number;
  readonly observedMinefieldCount: number;
  readonly similarity: number;
}

export interface ToolSandboxOracleStartingContextBinding {
  readonly normalizationRuleId: "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1";
  readonly normalizedContextSha256: string;
  readonly volatileTimestampValueCount: 11;
}

export interface ToolSandboxOracleReplayReceipt {
  readonly schemaVersion: "pm.public-eval.toolsandbox-oracle-replay.v2";
  readonly benchmark: {
    readonly repositoryUrl: "https://github.com/apple/ToolSandbox";
    readonly revision: "165848b9a78cead7ca7fe7c89c688b58e6501219";
    readonly scenario: "send_message_with_contact_content_cellular_off_multiple_user_turn";
    readonly treeHash: "060c6eb2a9d4370c56586d4340401d87fa155eda";
  };
  readonly bindings: {
    readonly executionContextByteLength: number;
    readonly executionContextSha256: string;
    readonly replayScriptByteLength: number;
    readonly replayScriptSha256: string;
  };
  readonly startingContext: ToolSandboxOracleStartingContextBinding;
  readonly oracle: {
    readonly maxTurnCount: 30;
    readonly metrics: ToolSandboxOracleMetrics;
    readonly milestoneMapping: ToolSandboxOracleMapping;
    readonly minefieldMapping: ToolSandboxOracleMapping;
    readonly strictTaskSuccessRule: {
      readonly inputs: ToolSandboxOracleStrictRuleInputs;
      readonly result: boolean;
      readonly ruleId: "pm.public-eval.toolsandbox-strict-task-success.v1";
    };
  };
  readonly receiptHash: string;
}

export interface ToolSandboxReportedOracleResult {
  readonly scenario: "send_message_with_contact_content_cellular_off_multiple_user_turn";
  readonly metrics: ToolSandboxOracleMetrics;
  readonly milestoneMapping: ToolSandboxOracleMapping;
  readonly minefieldMapping: ToolSandboxOracleMapping;
  readonly traceback: string | null;
  readonly exceptionType: string | null;
  readonly strictTaskSuccess: boolean;
}

export type ToolSandboxOracleReplayMismatchReason =
  | "reported_similarity_differs_from_replay"
  | "reported_milestone_similarity_differs_from_replay"
  | "reported_minefield_similarity_differs_from_replay"
  | "reported_turn_count_differs_from_replay"
  | "reported_milestone_mapping_differs_from_replay"
  | "reported_minefield_mapping_differs_from_replay"
  | "reported_strict_task_success_differs_from_replay";

export interface ToolSandboxOracleReplayInput {
  /** Absolute executable path. PATH lookup is deliberately not accepted. */
  readonly pythonExecutable: string;
  /** Absolute path to the clean checkout verified again by replay_oracle.py. */
  readonly checkoutPath: string;
  /** Absolute path to the retained upstream execution_context.json. */
  readonly executionContextPath: string;
  /** Absolute path to the raw upstream result_summary.json. */
  readonly resultSummaryPath: string;
}

export interface ToolSandboxOracleReplayVerification {
  readonly schemaVersion: "pm.public-eval.toolsandbox-oracle-replay-verification.v2";
  readonly benchmark: ToolSandboxOracleReplayReceipt["benchmark"];
  readonly bindings: {
    readonly executionContext: {
      readonly path: string;
      readonly byteLength: number;
      readonly sha256: string;
    };
    readonly replayScript: {
      readonly path: string;
      readonly byteLength: number;
      readonly sha256: string;
    };
    readonly resultSummary: {
      readonly path: string;
      readonly byteLength: number;
      readonly sha256: string;
    };
    readonly pythonRuntime: {
      readonly launcherPath: string;
      readonly resolvedPath: string;
      readonly byteLength: number;
      readonly sha256: string;
      readonly nativeBinaryFormatVerified: true;
      readonly trustBoundary: "verifier_selected_digest_not_external_attestation";
    };
  };
  readonly invocation: {
    readonly executable: string;
    readonly executableSha256: string;
    readonly arguments: readonly [string];
    readonly cwd: string;
    readonly environment: typeof ORACLE_REPLAY_ENVIRONMENT;
    readonly exitCode: 0;
    readonly stdinByteLength: number;
    readonly stdinSha256: string;
    readonly stdoutByteLength: number;
    readonly stdoutSha256: string;
    readonly stderrByteLength: number;
    readonly stderrSha256: string;
    readonly invocationHash: string;
  };
  readonly receipt: ToolSandboxOracleReplayReceipt;
  readonly reportedResult: ToolSandboxReportedOracleResult;
  readonly verified: boolean;
  readonly mismatchReasons: readonly ToolSandboxOracleReplayMismatchReason[];
  readonly verificationHash: string;
}

/** @internal Test seam. Eligibility/runtime callers must omit this parameter. */
export interface ToolSandboxOracleReplayTestOnlyDependencies {
  readonly replayScriptPath?: string;
  readonly invoke?: (
    invocation: ToolSandboxOracleReplayProcessInvocation,
  ) => ToolSandboxOracleReplayProcessResult;
}

/** @internal Input exposed only so deterministic tests can observe the process boundary. */
export interface ToolSandboxOracleReplayProcessInvocation {
  readonly executable: string;
  readonly arguments: readonly [string];
  readonly cwd: string;
  readonly stdin: Uint8Array;
  readonly timeoutMs: number;
  readonly environment: typeof ORACLE_REPLAY_ENVIRONMENT;
}

/** @internal Result exposed only for the test-only process seam above. */
export interface ToolSandboxOracleReplayProcessResult {
  readonly status: number | null;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly error?: Error;
}

interface StableFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly byteLength: number;
  readonly sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot hash unsupported JSON value ${typeof value}`);
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(Buffer.from(canonicalStringify(value), "utf8"));
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (!jsonEqual(actual, wanted)) {
    throw new Error(`${path} has missing or unexpected fields`);
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function nonempty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function sha(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be a lowercase SHA-256`);
  return parsed;
}

function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function unitNumber(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`${path} must be a finite number in [0, 1]`);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean`);
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${path} must be null or string`);
  return value;
}

function utf8(value: Uint8Array, path: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw new Error(`${path} must be valid UTF-8`);
  }
}

function parseJsonBytes(value: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(utf8(value, path)) as unknown;
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("must be valid UTF-8")) {
      throw error;
    }
    throw new Error(`${path} must be valid JSON`);
  }
}

function absolutePath(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (!isAbsolute(parsed)) throw new Error(`${path} must be absolute`);
  return resolve(parsed);
}

function executablePath(value: unknown, path: string): string {
  const candidate = absolutePath(value, path);
  try {
    // Preserve a virtual-environment launcher path. Resolving its symlink to the
    // base interpreter can discard the venv's import path and silently replay
    // with a different runtime than the matched batch.
    if (!statSync(candidate).isFile()) throw new Error("not a file");
    accessSync(candidate, fsConstants.X_OK);
  } catch {
    throw new Error(`${path} must resolve to an executable regular file`);
  }
  return candidate;
}

function directoryPath(value: unknown, path: string): string {
  const candidate = absolutePath(value, path);
  try {
    const resolved = realpathSync(candidate);
    if (!lstatSync(resolved).isDirectory()) throw new Error("not a directory");
    return resolved;
  } catch {
    throw new Error(`${path} must resolve to a directory`);
  }
}

function regularFilePath(value: unknown, path: string): string {
  const candidate = absolutePath(value, path);
  try {
    const before = lstatSync(candidate);
    if (before.isSymbolicLink() || !before.isFile()) throw new Error("not a file");
    return realpathSync(candidate);
  } catch {
    throw new Error(`${path} must be a regular non-symlink file`);
  }
}

function readStableFile(
  path: string,
  label: string,
  maximumBytes: number,
): StableFile {
  let first: Buffer;
  let second: Buffer;
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("not a regular file");
    }
    if (stat.size <= 0 || stat.size > maximumBytes) {
      throw new Error(`outside 1..${maximumBytes} bytes`);
    }
    first = readFileSync(path);
    second = readFileSync(path);
  } catch {
    throw new Error(`${label} must be a stable regular file of 1..${maximumBytes} bytes`);
  }
  if (!first.equals(second)) throw new Error(`${label} changed while being read`);
  return {
    path,
    bytes: first,
    byteLength: first.byteLength,
    sha256: sha256Bytes(first),
  };
}

function assertNativeExecutableBytes(runtime: StableFile): void {
  const bytes = runtime.bytes;
  const magic = bytes.subarray(0, 4).toString("hex");
  // Mach-O universal (fat) binaries share the cafebabe magic with Java class
  // files; a real fat header carries a small big-endian architecture count
  // where a class file carries its format version (>= 45), so 1..8 separates
  // them strictly.
  const fatArchCount = bytes.byteLength >= 8 ? bytes.readUInt32BE(4) : 0;
  const native =
    magic === "7f454c46" ||
    magic === "feedface" ||
    magic === "feedfacf" ||
    magic === "cefaedfe" ||
    magic === "cffaedfe" ||
    (magic === "cafebabe" && fatArchCount >= 1 && fatArchCount <= 8) ||
    bytes.subarray(0, 2).toString("ascii") === "MZ";
  if (!native) {
    throw new Error(
      "python runtime must resolve to a native executable, not a script wrapper",
    );
  }
}

function unchanged(before: StableFile, after: StableFile, label: string): void {
  if (
    before.path !== after.path ||
    before.byteLength !== after.byteLength ||
    before.sha256 !== after.sha256 ||
    !before.bytes.equals(after.bytes)
  ) {
    throw new Error(`${label} changed during oracle replay`);
  }
}

function parseMapping(
  value: unknown,
  path: string,
  nodeCount: number,
): ToolSandboxOracleMapping {
  const source = record(value, path);
  const parsed: Record<string, readonly [number, number]> = {};
  for (const [key, rawPair] of Object.entries(source)) {
    const node = Number(key);
    if (
      !Number.isSafeInteger(node) ||
      node < 0 ||
      node >= nodeCount ||
      String(node) !== key
    ) {
      throw new Error(`${path}/${key} is outside the benchmark-owned node set`);
    }
    if (!Array.isArray(rawPair) || rawPair.length !== 2) {
      throw new Error(`${path}/${key} must be [snapshot, similarity]`);
    }
    parsed[key] = [
      integer(rawPair[0], `${path}/${key}/0`, -1),
      unitNumber(rawPair[1], `${path}/${key}/1`),
    ];
  }
  return Object.fromEntries(
    Object.entries(parsed).sort(([left], [right]) => Number(left) - Number(right)),
  );
}

function expectedStrictInputs(
  metrics: ToolSandboxOracleMetrics,
  milestoneMapping: ToolSandboxOracleMapping,
  minefieldMapping: ToolSandboxOracleMapping,
): ToolSandboxOracleStrictRuleInputs {
  const milestoneKeys = Object.keys(milestoneMapping);
  const allMilestonesPresent =
    milestoneKeys.length === MILESTONE_COUNT &&
    Array.from({ length: MILESTONE_COUNT }, (_, index) => String(index)).every(
      (key) => Object.hasOwn(milestoneMapping, key),
    );
  const allMilestonesExact =
    allMilestonesPresent &&
    Object.values(milestoneMapping).every((entry) => entry[1] === 1);
  const noMinefieldMatches = Object.keys(minefieldMapping).length === 0;
  return {
    allMilestonesExact,
    allMilestonesPresent,
    expectedMilestoneCount: MILESTONE_COUNT,
    expectedMinefieldCount: MINEFIELD_COUNT,
    milestoneSimilarity: metrics.milestoneSimilarity,
    minefieldSimilarity: metrics.minefieldSimilarity,
    noMinefieldMatches,
    observedMilestoneCount: milestoneKeys.length,
    observedMinefieldCount: Object.keys(minefieldMapping).length,
    similarity: metrics.similarity,
  };
}

function strictSuccess(
  inputs: ToolSandboxOracleStrictRuleInputs,
): boolean {
  return (
    inputs.similarity === 1 &&
    inputs.milestoneSimilarity === 1 &&
    inputs.minefieldSimilarity === 0 &&
    inputs.allMilestonesExact &&
    inputs.noMinefieldMatches
  );
}

function parseReceipt(value: unknown): ToolSandboxOracleReplayReceipt {
  const root = record(value, "/oracleReplayReceipt");
  exactKeys(
    root,
    [
      "schemaVersion",
      "benchmark",
      "bindings",
      "startingContext",
      "oracle",
      "receiptHash",
    ],
    "/oracleReplayReceipt",
  );
  if (root["schemaVersion"] !== RECEIPT_SCHEMA) {
    throw new Error(`/oracleReplayReceipt/schemaVersion must equal ${RECEIPT_SCHEMA}`);
  }

  const benchmark = record(root["benchmark"], "/oracleReplayReceipt/benchmark");
  exactKeys(
    benchmark,
    ["repositoryUrl", "revision", "scenario", "treeHash"],
    "/oracleReplayReceipt/benchmark",
  );
  if (
    benchmark["repositoryUrl"] !== REPOSITORY_URL ||
    benchmark["revision"] !== REVISION ||
    benchmark["scenario"] !== SCENARIO ||
    benchmark["treeHash"] !== TREE_HASH
  ) {
    throw new Error("/oracleReplayReceipt/benchmark does not match the pinned benchmark");
  }

  const bindings = record(root["bindings"], "/oracleReplayReceipt/bindings");
  exactKeys(
    bindings,
    [
      "executionContextByteLength",
      "executionContextSha256",
      "replayScriptByteLength",
      "replayScriptSha256",
    ],
    "/oracleReplayReceipt/bindings",
  );
  const parsedBindings = {
    executionContextByteLength: integer(
      bindings["executionContextByteLength"],
      "/oracleReplayReceipt/bindings/executionContextByteLength",
      1,
    ),
    executionContextSha256: sha(
      bindings["executionContextSha256"],
      "/oracleReplayReceipt/bindings/executionContextSha256",
    ),
    replayScriptByteLength: integer(
      bindings["replayScriptByteLength"],
      "/oracleReplayReceipt/bindings/replayScriptByteLength",
      1,
    ),
    replayScriptSha256: sha(
      bindings["replayScriptSha256"],
      "/oracleReplayReceipt/bindings/replayScriptSha256",
    ),
  } as const;

  const rawStartingContext = record(
    root["startingContext"],
    "/oracleReplayReceipt/startingContext",
  );
  exactKeys(
    rawStartingContext,
    [
      "normalizationRuleId",
      "normalizedContextSha256",
      "volatileTimestampValueCount",
    ],
    "/oracleReplayReceipt/startingContext",
  );
  if (
    rawStartingContext["normalizationRuleId"] !==
    STARTING_CONTEXT_NORMALIZATION_RULE_ID
  ) {
    throw new Error(
      "/oracleReplayReceipt/startingContext/normalizationRuleId is unsupported",
    );
  }
  const normalizedContextSha256 = sha(
    rawStartingContext["normalizedContextSha256"],
    "/oracleReplayReceipt/startingContext/normalizedContextSha256",
  );
  if (normalizedContextSha256 !== NORMALIZED_STARTING_CONTEXT_SHA256) {
    throw new Error(
      "/oracleReplayReceipt/startingContext/normalizedContextSha256 does not match the pinned scenario",
    );
  }
  const volatileTimestampValueCount = integer(
    rawStartingContext["volatileTimestampValueCount"],
    "/oracleReplayReceipt/startingContext/volatileTimestampValueCount",
  );
  if (volatileTimestampValueCount !== VOLATILE_TIMESTAMP_VALUE_COUNT) {
    throw new Error(
      "/oracleReplayReceipt/startingContext/volatileTimestampValueCount does not match the pinned scenario",
    );
  }
  const startingContext: ToolSandboxOracleStartingContextBinding = {
    normalizationRuleId: STARTING_CONTEXT_NORMALIZATION_RULE_ID,
    normalizedContextSha256,
    volatileTimestampValueCount: VOLATILE_TIMESTAMP_VALUE_COUNT,
  };

  const oracle = record(root["oracle"], "/oracleReplayReceipt/oracle");
  exactKeys(
    oracle,
    [
      "maxTurnCount",
      "metrics",
      "milestoneMapping",
      "minefieldMapping",
      "strictTaskSuccessRule",
    ],
    "/oracleReplayReceipt/oracle",
  );
  if (oracle["maxTurnCount"] !== MAX_TURN_COUNT) {
    throw new Error(`/oracleReplayReceipt/oracle/maxTurnCount must equal ${MAX_TURN_COUNT}`);
  }
  const rawMetrics = record(
    oracle["metrics"],
    "/oracleReplayReceipt/oracle/metrics",
  );
  exactKeys(
    rawMetrics,
    ["milestoneSimilarity", "minefieldSimilarity", "similarity", "turnCount"],
    "/oracleReplayReceipt/oracle/metrics",
  );
  const metrics: ToolSandboxOracleMetrics = {
    milestoneSimilarity: unitNumber(
      rawMetrics["milestoneSimilarity"],
      "/oracleReplayReceipt/oracle/metrics/milestoneSimilarity",
    ),
    minefieldSimilarity: unitNumber(
      rawMetrics["minefieldSimilarity"],
      "/oracleReplayReceipt/oracle/metrics/minefieldSimilarity",
    ),
    similarity: unitNumber(
      rawMetrics["similarity"],
      "/oracleReplayReceipt/oracle/metrics/similarity",
    ),
    turnCount: integer(
      rawMetrics["turnCount"],
      "/oracleReplayReceipt/oracle/metrics/turnCount",
    ),
  };
  const expectedSimilarity =
    metrics.minefieldSimilarity === 0 ? metrics.milestoneSimilarity : 0;
  if (metrics.similarity !== expectedSimilarity) {
    throw new Error("/oracleReplayReceipt/oracle combined similarity does not recompute");
  }
  const milestoneMapping = parseMapping(
    oracle["milestoneMapping"],
    "/oracleReplayReceipt/oracle/milestoneMapping",
    MILESTONE_COUNT,
  );
  const minefieldMapping = parseMapping(
    oracle["minefieldMapping"],
    "/oracleReplayReceipt/oracle/minefieldMapping",
    MINEFIELD_COUNT,
  );
  if (metrics.minefieldSimilarity !== 0 || Object.keys(minefieldMapping).length !== 0) {
    throw new Error("/oracleReplayReceipt/oracle must preserve the zero-minefield invariant");
  }

  const rawRule = record(
    oracle["strictTaskSuccessRule"],
    "/oracleReplayReceipt/oracle/strictTaskSuccessRule",
  );
  exactKeys(
    rawRule,
    ["inputs", "result", "ruleId"],
    "/oracleReplayReceipt/oracle/strictTaskSuccessRule",
  );
  if (rawRule["ruleId"] !== STRICT_RULE_ID) {
    throw new Error("/oracleReplayReceipt/oracle/strictTaskSuccessRule/ruleId is unsupported");
  }
  const rawInputs = record(
    rawRule["inputs"],
    "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs",
  );
  exactKeys(
    rawInputs,
    [
      "allMilestonesExact",
      "allMilestonesPresent",
      "expectedMilestoneCount",
      "expectedMinefieldCount",
      "milestoneSimilarity",
      "minefieldSimilarity",
      "noMinefieldMatches",
      "observedMilestoneCount",
      "observedMinefieldCount",
      "similarity",
    ],
    "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs",
  );
  const parsedInputs: ToolSandboxOracleStrictRuleInputs = {
    allMilestonesExact: boolean(
      rawInputs["allMilestonesExact"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/allMilestonesExact",
    ),
    allMilestonesPresent: boolean(
      rawInputs["allMilestonesPresent"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/allMilestonesPresent",
    ),
    expectedMilestoneCount: integer(
      rawInputs["expectedMilestoneCount"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/expectedMilestoneCount",
    ),
    expectedMinefieldCount: integer(
      rawInputs["expectedMinefieldCount"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/expectedMinefieldCount",
    ),
    milestoneSimilarity: unitNumber(
      rawInputs["milestoneSimilarity"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/milestoneSimilarity",
    ),
    minefieldSimilarity: unitNumber(
      rawInputs["minefieldSimilarity"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/minefieldSimilarity",
    ),
    noMinefieldMatches: boolean(
      rawInputs["noMinefieldMatches"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/noMinefieldMatches",
    ),
    observedMilestoneCount: integer(
      rawInputs["observedMilestoneCount"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/observedMilestoneCount",
    ),
    observedMinefieldCount: integer(
      rawInputs["observedMinefieldCount"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/observedMinefieldCount",
    ),
    similarity: unitNumber(
      rawInputs["similarity"],
      "/oracleReplayReceipt/oracle/strictTaskSuccessRule/inputs/similarity",
    ),
  };
  const recomputedInputs = expectedStrictInputs(
    metrics,
    milestoneMapping,
    minefieldMapping,
  );
  if (!jsonEqual(parsedInputs, recomputedInputs)) {
    throw new Error("/oracleReplayReceipt/oracle strict-rule inputs do not recompute");
  }
  const ruleResult = boolean(
    rawRule["result"],
    "/oracleReplayReceipt/oracle/strictTaskSuccessRule/result",
  );
  if (ruleResult !== strictSuccess(recomputedInputs)) {
    throw new Error("/oracleReplayReceipt/oracle strict-rule result does not recompute");
  }

  const body = {
    schemaVersion: RECEIPT_SCHEMA,
    benchmark: {
      repositoryUrl: REPOSITORY_URL,
      revision: REVISION,
      scenario: SCENARIO,
      treeHash: TREE_HASH,
    },
    bindings: parsedBindings,
    startingContext,
    oracle: {
      maxTurnCount: MAX_TURN_COUNT,
      metrics,
      milestoneMapping,
      minefieldMapping,
      strictTaskSuccessRule: {
        inputs: parsedInputs,
        result: ruleResult,
        ruleId: STRICT_RULE_ID,
      },
    },
  } as const;
  const receiptHash = sha(root["receiptHash"], "/oracleReplayReceipt/receiptHash");
  if (receiptHash !== sha256Json(body)) {
    throw new Error("/oracleReplayReceipt/receiptHash does not recompute");
  }
  return { ...body, receiptHash };
}

function parsePrefixedReceipt(stdout: Uint8Array): ToolSandboxOracleReplayReceipt {
  const output = utf8(stdout, "/oracleReplay/stdout");
  if (output.includes("\r")) {
    throw new Error("oracle replay stdout must contain exactly one LF-delimited receipt");
  }
  const withoutFinalLf = output.endsWith("\n") ? output.slice(0, -1) : output;
  if (withoutFinalLf === "" || withoutFinalLf.includes("\n")) {
    throw new Error("oracle replay stdout must contain exactly one prefixed receipt");
  }
  if (!withoutFinalLf.startsWith(RECEIPT_PREFIX)) {
    throw new Error(`oracle replay stdout must start with ${RECEIPT_PREFIX}`);
  }
  const payload = withoutFinalLf.slice(RECEIPT_PREFIX.length);
  let raw: unknown;
  try {
    raw = JSON.parse(payload) as unknown;
  } catch {
    throw new Error("oracle replay receipt must be valid JSON");
  }
  if (canonicalStringify(raw) !== payload) {
    throw new Error("oracle replay receipt must be one canonical JSON object");
  }
  return parseReceipt(raw);
}

function parseReportedResult(value: unknown): ToolSandboxReportedOracleResult {
  const root = record(value, "/resultSummary");
  if (root["git_sha"] !== REVISION) {
    throw new Error(`/resultSummary/git_sha must equal pinned revision ${REVISION}`);
  }
  const results = root["per_scenario_results"];
  if (!Array.isArray(results) || results.length !== 1) {
    throw new Error("/resultSummary/per_scenario_results must contain exactly one entry");
  }
  const result = record(results[0], "/resultSummary/per_scenario_results/0");
  exactKeys(
    result,
    [
      "name",
      "categories",
      "traceback",
      "exception_type",
      "milestone_similarity",
      "minefield_similarity",
      "similarity",
      "turn_count",
      "milestone_mapping",
      "minefield_mapping",
    ],
    "/resultSummary/per_scenario_results/0",
  );
  if (result["name"] !== SCENARIO) {
    throw new Error(`/resultSummary scenario must equal ${SCENARIO}`);
  }
  const categories = result["categories"];
  if (
    !Array.isArray(categories) ||
    categories.some((entry) => typeof entry !== "string") ||
    !categories.includes("STATE_DEPENDENCY")
  ) {
    throw new Error("/resultSummary scenario must include STATE_DEPENDENCY");
  }
  const metrics: ToolSandboxOracleMetrics = {
    milestoneSimilarity: unitNumber(
      result["milestone_similarity"],
      "/resultSummary/per_scenario_results/0/milestone_similarity",
    ),
    minefieldSimilarity: unitNumber(
      result["minefield_similarity"],
      "/resultSummary/per_scenario_results/0/minefield_similarity",
    ),
    similarity: unitNumber(
      result["similarity"],
      "/resultSummary/per_scenario_results/0/similarity",
    ),
    turnCount: integer(
      result["turn_count"],
      "/resultSummary/per_scenario_results/0/turn_count",
    ),
  };
  const expectedSimilarity =
    metrics.minefieldSimilarity === 0 ? metrics.milestoneSimilarity : 0;
  if (metrics.similarity !== expectedSimilarity) {
    throw new Error("/resultSummary combined similarity does not recompute");
  }
  const milestoneMapping = parseMapping(
    result["milestone_mapping"],
    "/resultSummary/per_scenario_results/0/milestone_mapping",
    MILESTONE_COUNT,
  );
  const minefieldMapping = parseMapping(
    result["minefield_mapping"],
    "/resultSummary/per_scenario_results/0/minefield_mapping",
    MINEFIELD_COUNT,
  );
  if (metrics.minefieldSimilarity !== 0 || Object.keys(minefieldMapping).length !== 0) {
    throw new Error("/resultSummary must preserve the zero-minefield invariant");
  }
  const traceback = nullableString(
    result["traceback"],
    "/resultSummary/per_scenario_results/0/traceback",
  );
  const exceptionType = nullableString(
    result["exception_type"],
    "/resultSummary/per_scenario_results/0/exception_type",
  );
  if ((traceback === null) !== (exceptionType === null)) {
    throw new Error("/resultSummary traceback and exception_type must be present together");
  }
  const strictInputs = expectedStrictInputs(metrics, milestoneMapping, minefieldMapping);
  return {
    scenario: SCENARIO,
    metrics,
    milestoneMapping,
    minefieldMapping,
    traceback,
    exceptionType,
    strictTaskSuccess: traceback === null && strictSuccess(strictInputs),
  };
}

function mismatchReasons(
  receipt: ToolSandboxOracleReplayReceipt,
  reported: ToolSandboxReportedOracleResult,
): readonly ToolSandboxOracleReplayMismatchReason[] {
  const mismatches: ToolSandboxOracleReplayMismatchReason[] = [];
  if (reported.metrics.similarity !== receipt.oracle.metrics.similarity) {
    mismatches.push("reported_similarity_differs_from_replay");
  }
  if (
    reported.metrics.milestoneSimilarity !==
    receipt.oracle.metrics.milestoneSimilarity
  ) {
    mismatches.push("reported_milestone_similarity_differs_from_replay");
  }
  if (
    reported.metrics.minefieldSimilarity !==
    receipt.oracle.metrics.minefieldSimilarity
  ) {
    mismatches.push("reported_minefield_similarity_differs_from_replay");
  }
  if (reported.metrics.turnCount !== receipt.oracle.metrics.turnCount) {
    mismatches.push("reported_turn_count_differs_from_replay");
  }
  if (!jsonEqual(reported.milestoneMapping, receipt.oracle.milestoneMapping)) {
    mismatches.push("reported_milestone_mapping_differs_from_replay");
  }
  if (!jsonEqual(reported.minefieldMapping, receipt.oracle.minefieldMapping)) {
    mismatches.push("reported_minefield_mapping_differs_from_replay");
  }
  if (
    reported.strictTaskSuccess !==
    receipt.oracle.strictTaskSuccessRule.result
  ) {
    mismatches.push("reported_strict_task_success_differs_from_replay");
  }
  return mismatches;
}

function defaultInvoke(
  invocation: ToolSandboxOracleReplayProcessInvocation,
): ToolSandboxOracleReplayProcessResult {
  const result = spawnSync(invocation.executable, [...invocation.arguments], {
    cwd: invocation.cwd,
    encoding: null,
    env: invocation.environment,
    input: Buffer.from(invocation.stdin),
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    shell: false,
    timeout: invocation.timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

/**
 * Replays the pinned ToolSandbox oracle over retained execution-context bytes,
 * verifies the replay receipt, and compares it with the raw upstream summary.
 *
 * Integrity/schema/process failures throw. A valid replay disagreement returns
 * `verified: false` plus deterministic mismatch reasons.
 */
export function runAndVerifyToolSandboxOracleReplay(
  input: ToolSandboxOracleReplayInput,
  /** @internal Tests only. Production and eligibility callers must omit. */
  dependencies: ToolSandboxOracleReplayTestOnlyDependencies = {},
): ToolSandboxOracleReplayVerification {
  const pythonExecutable = executablePath(
    input.pythonExecutable,
    "/pythonExecutable",
  );
  const pythonRuntimePath = realpathSync(pythonExecutable);
  const pythonRuntimeBefore = readStableFile(
    pythonRuntimePath,
    "python runtime",
    MAX_PYTHON_RUNTIME_BYTES,
  );
  assertNativeExecutableBytes(pythonRuntimeBefore);
  const checkoutPath = directoryPath(input.checkoutPath, "/checkoutPath");
  const executionContextPath = regularFilePath(
    input.executionContextPath,
    "/executionContextPath",
  );
  const resultSummaryPath = regularFilePath(
    input.resultSummaryPath,
    "/resultSummaryPath",
  );
  const replayScriptPath = regularFilePath(
    dependencies.replayScriptPath ?? REPLAY_SCRIPT_PATH,
    "/replayScriptPath",
  );

  const contextBefore = readStableFile(
    executionContextPath,
    "execution context",
    MAX_CONTEXT_BYTES,
  );
  const scriptBefore = readStableFile(
    replayScriptPath,
    "oracle replay script",
    MAX_REPLAY_SCRIPT_BYTES,
  );
  const summaryBefore = readStableFile(
    resultSummaryPath,
    "raw result summary",
    MAX_RESULT_SUMMARY_BYTES,
  );
  const reportedResult = parseReportedResult(
    parseJsonBytes(summaryBefore.bytes, "/resultSummary"),
  );

  const config = {
    schemaVersion: INPUT_SCHEMA,
    checkoutPath,
    executionContextPath,
  } as const;
  const stdin = Buffer.from(`${canonicalStringify(config)}\n`, "utf8");
  const processInvocation: ToolSandboxOracleReplayProcessInvocation = {
    executable: pythonExecutable,
    arguments: [replayScriptPath],
    cwd: checkoutPath,
    stdin,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    environment: ORACLE_REPLAY_ENVIRONMENT,
  };
  const processResult = (dependencies.invoke ?? defaultInvoke)(processInvocation);
  const stdout = Buffer.from(processResult.stdout);
  const stderr = Buffer.from(processResult.stderr);
  if (stdout.byteLength > MAX_PROCESS_OUTPUT_BYTES || stderr.byteLength > MAX_PROCESS_OUTPUT_BYTES) {
    throw new Error("oracle replay process output exceeds the retained-output limit");
  }
  if (processResult.error !== undefined || processResult.status !== 0) {
    throw new Error(
      `oracle replay failed (status=${String(processResult.status)}, stdoutSha256=${sha256Bytes(stdout)}, stderrSha256=${sha256Bytes(stderr)})`,
    );
  }

  const contextAfter = readStableFile(
    executionContextPath,
    "execution context",
    MAX_CONTEXT_BYTES,
  );
  const scriptAfter = readStableFile(
    replayScriptPath,
    "oracle replay script",
    MAX_REPLAY_SCRIPT_BYTES,
  );
  const summaryAfter = readStableFile(
    resultSummaryPath,
    "raw result summary",
    MAX_RESULT_SUMMARY_BYTES,
  );
  const pythonRuntimeAfter = readStableFile(
    pythonRuntimePath,
    "python runtime",
    MAX_PYTHON_RUNTIME_BYTES,
  );
  unchanged(contextBefore, contextAfter, "execution context");
  unchanged(scriptBefore, scriptAfter, "oracle replay script");
  unchanged(summaryBefore, summaryAfter, "raw result summary");
  unchanged(pythonRuntimeBefore, pythonRuntimeAfter, "python runtime");

  const receipt = parsePrefixedReceipt(stdout);
  if (
    receipt.bindings.executionContextByteLength !== contextAfter.byteLength ||
    receipt.bindings.executionContextSha256 !== contextAfter.sha256
  ) {
    throw new Error("oracle replay receipt is not bound to the supplied execution context");
  }
  if (
    receipt.bindings.replayScriptByteLength !== scriptAfter.byteLength ||
    receipt.bindings.replayScriptSha256 !== scriptAfter.sha256
  ) {
    throw new Error("oracle replay receipt is not bound to the invoked replay script");
  }

  const invocationBody = {
    executable: pythonExecutable,
    executableSha256: pythonRuntimeAfter.sha256,
    arguments: [replayScriptPath] as const,
    cwd: checkoutPath,
    environment: ORACLE_REPLAY_ENVIRONMENT,
    exitCode: 0 as const,
    stdinByteLength: stdin.byteLength,
    stdinSha256: sha256Bytes(stdin),
    stdoutByteLength: stdout.byteLength,
    stdoutSha256: sha256Bytes(stdout),
    stderrByteLength: stderr.byteLength,
    stderrSha256: sha256Bytes(stderr),
  } as const;
  const invocation = {
    ...invocationBody,
    invocationHash: sha256Json(invocationBody),
  } as const;
  const mismatches = mismatchReasons(receipt, reportedResult);
  const body = {
    schemaVersion: VERIFICATION_SCHEMA,
    benchmark: receipt.benchmark,
    bindings: {
      executionContext: {
        path: executionContextPath,
        byteLength: contextAfter.byteLength,
        sha256: contextAfter.sha256,
      },
      replayScript: {
        path: replayScriptPath,
        byteLength: scriptAfter.byteLength,
        sha256: scriptAfter.sha256,
      },
      resultSummary: {
        path: resultSummaryPath,
        byteLength: summaryAfter.byteLength,
        sha256: summaryAfter.sha256,
      },
      pythonRuntime: {
        launcherPath: pythonExecutable,
        resolvedPath: pythonRuntimePath,
        byteLength: pythonRuntimeAfter.byteLength,
        sha256: pythonRuntimeAfter.sha256,
        nativeBinaryFormatVerified: true as const,
        trustBoundary:
          "verifier_selected_digest_not_external_attestation" as const,
      },
    },
    invocation,
    receipt,
    reportedResult,
    verified: mismatches.length === 0,
    mismatchReasons: mismatches,
  } as const;
  return deepFreeze({ ...body, verificationHash: sha256Json(body) });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
