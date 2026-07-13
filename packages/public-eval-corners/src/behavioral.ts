import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  FileExpectation,
  FileSetVerificationRequest,
  FileSetVerificationResult,
  ManifestEnvelope,
  PinnedSourceVerificationRequest,
  PinnedSourceVerificationResult,
  PublicEvalCornerId,
} from "./index.js";

export type BehavioralArm = "native" | "sham" | "substrate";
export type BehavioralEvidenceClass =
  | "behavioral-efficacy-candidate"
  | "protocol-conformance";

export interface BehavioralFileIdentity {
  readonly path: string;
  readonly sha256: string;
}

export interface BehavioralCommandInput {
  readonly executable: BehavioralFileIdentity;
  readonly arguments: readonly string[];
  readonly supportingFiles: readonly BehavioralFileIdentity[];
  /** Environment variable names are recorded; their secret values never enter receipts. */
  readonly environmentKeys: readonly string[];
}

export interface BehavioralConfigInput extends BehavioralFileIdentity {
  readonly configId: string;
}

export interface BehavioralModelIdentity {
  readonly provider: string;
  readonly modelId: string;
  readonly revision: string;
  /** Immutable provider/deployment descriptor hash, not a claim about model weights. */
  readonly digest: string;
}

export interface BehavioralTreatmentDelta {
  readonly schemaVersion: "pm.public-eval-corners.treatment-delta.v1";
  readonly arm: BehavioralArm;
  readonly agentStateTreatment: "native" | "sham" | "substrate";
  readonly boundaryProvider:
    | "runner-native"
    | "pm-sham-noop"
    | "@pm/agent-state-core";
}

export interface BehavioralTrialInput {
  readonly trialId: string;
  readonly taskId: string;
  readonly seed: string;
  /** One runner, non-treatment config, and model are shared by every arm. */
  readonly runner: BehavioralCommandInput;
  readonly config: BehavioralConfigInput;
  readonly model: BehavioralModelIdentity;
  readonly treatments: Readonly<Record<BehavioralArm, BehavioralTreatmentDelta>>;
}

export interface PinnedBehavioralSourceInput {
  readonly mode: "pinned-upstream";
  readonly checkoutPath: string;
  readonly externalFiles?: Readonly<Record<string, string>>;
  /** Required only for AppWorld; grants local use, never redistribution. */
  readonly allowProtectedLocal?: boolean;
  /** AppWorld protected bundles must live outside both checkout and workspace. */
  readonly protectedDataRoot?: string;
}

export interface ConformanceBehavioralSourceInput {
  readonly mode: "protocol-conformance";
  readonly rootPath: string;
  readonly expectedFiles: readonly FileExpectation[];
  readonly syntheticNotice: "PM-authored protocol fixture; no upstream task data or efficacy claim.";
}

export interface UpstreamBehavioralOracleInput {
  readonly owner: "upstream";
  /** Must identify one source in the selected pinned corner manifest. */
  readonly sourceId: string;
  readonly command: BehavioralCommandInput;
  readonly outcomeRelativePath: "oracle-outcome.json";
  readonly outcomeMediaType: "application/json";
}

export interface ConformanceBehavioralOracleInput {
  readonly owner: "pm-conformance-fixture";
  /** Must identify one file in source.expectedFiles. */
  readonly sourceId: string;
  readonly command: BehavioralCommandInput;
  readonly outcomeRelativePath: "oracle-outcome.json";
  readonly outcomeMediaType: "application/json";
}

export interface BehavioralBatchInput {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-batch-input.v1";
  readonly evidenceClass: BehavioralEvidenceClass;
  readonly batchId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly randomizationSeed: string;
  readonly outputRoot: string;
  readonly timeoutMs?: number;
  readonly source: PinnedBehavioralSourceInput | ConformanceBehavioralSourceInput;
  readonly oracle: UpstreamBehavioralOracleInput | ConformanceBehavioralOracleInput;
  readonly trials: readonly BehavioralTrialInput[];
}

interface PlannedCommand {
  readonly executable: BehavioralFileIdentity;
  readonly arguments: readonly string[];
  readonly supportingFiles: readonly BehavioralFileIdentity[];
  readonly environmentKeys: readonly string[];
  readonly identitySha256: string;
}

interface PlannedConfig extends BehavioralConfigInput {
  readonly identitySha256: string;
}

interface PlannedModel extends BehavioralModelIdentity {
  readonly identitySha256: string;
}

interface PlannedTreatment extends BehavioralTreatmentDelta {
  readonly identitySha256: string;
}

interface PlannedArm {
  readonly arm: BehavioralArm;
  readonly treatment: PlannedTreatment;
}

interface PlannedTrial {
  readonly trialId: string;
  readonly taskId: string;
  readonly seed: string;
  readonly armOrder: readonly BehavioralArm[];
  readonly runner: PlannedCommand;
  readonly config: PlannedConfig;
  readonly model: PlannedModel;
  readonly arms: readonly PlannedArm[];
}

export interface BehavioralOracleInvocationVerification {
  readonly schemaVersion: "pm.public-eval-corners.oracle-invocation-verification.v1";
  readonly status: "not-independently-verified";
  readonly commandIdentitySha256: string;
  readonly sourceId: string;
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly invocationProofReceipt: null;
  readonly requiredForIndependentAnalysis: true;
  readonly eligibilityEffect: "blocks-independent-analysis";
}

export interface BehavioralBatchPlan {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-plan.v1";
  readonly evidenceClass: BehavioralEvidenceClass;
  readonly efficacyClaimed: false;
  readonly eligibleForIndependentAnalysis: false;
  readonly batchId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly randomizationSeed: string;
  readonly outputRoot: string;
  readonly timeoutMs: number;
  readonly source: PinnedBehavioralSourceInput | ConformanceBehavioralSourceInput;
  readonly oracle: {
    readonly owner: "upstream" | "pm-conformance-fixture";
    readonly sourceId: string;
    readonly command: PlannedCommand;
    readonly outcomeRelativePath: string;
    readonly outcomeMediaType: "application/json";
    /**
     * A content binding is not proof that a caller-supplied wrapper invoked the
     * bound source. Local runs remain ineligible until an independent verifier
     * can populate a separately specified proof receipt.
     */
    readonly invocationVerification: BehavioralOracleInvocationVerification;
  };
  readonly trials: readonly PlannedTrial[];
  readonly planHash: string;
}

export interface BehavioralPlanResult {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-plan-result.v1";
  readonly valid: boolean;
  readonly plan: BehavioralBatchPlan | null;
  readonly sourceVerification: unknown;
  readonly issues: readonly string[];
}

export interface BehavioralArtifactInventoryEntry {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

interface BehavioralExecutionRecord {
  readonly commandIdentitySha256: string;
  readonly exitCode: 0;
  readonly stdoutPath: string;
  readonly stdoutSha256: string;
  readonly stderrPath: string;
  readonly stderrSha256: string;
}

interface BehavioralAttemptRecord {
  readonly order: number;
  readonly arm: BehavioralArm;
  readonly outputRelativePath: string;
  readonly sharedConfigIdentitySha256: string;
  readonly sharedModelIdentitySha256: string;
  readonly treatment: {
    readonly identitySha256: string;
    readonly path: string;
    readonly fileSha256: string;
  };
  readonly command: BehavioralExecutionRecord;
  readonly oracle: BehavioralExecutionRecord & {
    readonly owner: "upstream" | "pm-conformance-fixture";
    readonly sourceId: string;
    readonly outcomePath: string;
    readonly outcomeMediaType: "application/json";
    readonly outcomeByteLength: number;
    readonly outcomeSha256: string;
    readonly scoringInputPath: string;
    readonly scoringInputSha256: string;
    readonly neutralView: "ephemeral-arm-blind";
    readonly outcomeImportedWithoutInterpretation: true;
  };
  readonly rawArtifacts: readonly BehavioralArtifactInventoryEntry[];
}

interface BehavioralTrialReceipt {
  readonly trialId: string;
  readonly taskId: string;
  readonly seed: string;
  readonly armOrder: readonly BehavioralArm[];
  readonly attempts: readonly BehavioralAttemptRecord[];
  readonly matchingProof: {
    readonly sharedRunnerIdentitySha256: string;
    readonly sharedConfigIdentitySha256: string;
    readonly sharedModelIdentitySha256: string;
    readonly treatmentIdentitySha256: Readonly<Record<BehavioralArm, string>>;
    readonly proofHash: string;
  };
}

export interface BehavioralBatchReceipt {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-batch-receipt.v1";
  readonly evidenceClass: BehavioralEvidenceClass;
  readonly efficacyClaimed: false;
  /** The receipt is evidence for later independent analysis, never a decision by itself. */
  readonly decisionGating: false;
  readonly eligibleForIndependentAnalysis: false;
  readonly upstreamOutcomesInterpreted: false;
  readonly batchId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly outputRoot: string;
  readonly planPath: "predeclared-plan.json";
  readonly planHash: string;
  readonly planFileSha256: string;
  readonly plan: BehavioralBatchPlan;
  readonly oracleInvocationVerification: BehavioralOracleInvocationVerification;
  readonly sourceVerification: {
    readonly before: unknown;
    readonly after: unknown;
    readonly cleanBefore: boolean | null;
    readonly cleanAfter: boolean | null;
  };
  readonly trials: readonly BehavioralTrialReceipt[];
  readonly protectedArtifactPolicy: {
    readonly appWorldProtectedContentMayExistOnlyUnderExternalRoots: boolean;
    readonly receiptEmbedsRawOutcomeContent: false;
    readonly redistributionAuthorized: false;
  };
  readonly receiptHash: string;
}

export interface BehavioralBatchVerification {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-batch-verification.v1";
  readonly valid: boolean;
  readonly evidenceClass: BehavioralEvidenceClass | null;
  readonly eligibleForIndependentAnalysis: false;
  readonly receiptHash: string | null;
  readonly reopenedArtifactCount: number;
  readonly issues: readonly string[];
}

export interface BehavioralServices {
  readonly getManifest: (cornerId: PublicEvalCornerId) => ManifestEnvelope;
  readonly verifyPinnedSource: (
    request: PinnedSourceVerificationRequest,
  ) => PinnedSourceVerificationResult;
  readonly verifyFileSet: (
    request: FileSetVerificationRequest,
  ) => FileSetVerificationResult;
}

const ARMS: readonly BehavioralArm[] = ["native", "sham", "substrate"];
const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/u;
const RESERVED_ENV_PREFIX = "PM_PUBLIC_EVAL_";
const ORACLE_CONTEXT_NAME = /(?:^|_)(?:ARM|TREATMENT|CONFIG|PLAN|OUTPUT_ROOT)(?:_|$)/u;
const MAX_CAPTURE_BYTES = 128 * 1024 * 1024;
const MAX_INVENTORY_FILES = 50_000;

const TREATMENT_BY_ARM: Readonly<Record<BehavioralArm, BehavioralTreatmentDelta>> = {
  native: {
    schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
    arm: "native",
    agentStateTreatment: "native",
    boundaryProvider: "runner-native",
  },
  sham: {
    schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
    arm: "sham",
    agentStateTreatment: "sham",
    boundaryProvider: "pm-sham-noop",
  },
  substrate: {
    schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
    arm: "substrate",
    agentStateTreatment: "substrate",
    boundaryProvider: "@pm/agent-state-core",
  },
};

type JsonRecord = Record<string, unknown>;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  if (
    Object.keys(value).sort(compareCodeUnits).join(",") !==
    [...expected].sort(compareCodeUnits).join(",")
  ) {
    throw new Error(`${path} contains undeclared fields`);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonical(value));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requiredId(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!ID.test(parsed)) throw new Error(`${path} must be a portable identifier`);
  return parsed;
}

function requiredSha(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function isWithin(root: string, target: string): boolean {
  const child = relative(resolve(root), resolve(target));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function workspaceRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return resolve(".");
  }
}

function absoluteRegularFile(identity: BehavioralFileIdentity, path: string): BehavioralFileIdentity {
  const filePath = requiredString(identity?.path, `${path}.path`);
  if (!isAbsolute(filePath)) throw new Error(`${path}.path must be absolute`);
  const normalized = resolve(filePath);
  const expected = requiredSha(identity.sha256, `${path}.sha256`);
  let bytes: Buffer;
  try {
    const stat = lstatSync(normalized);
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error("not a regular file");
    bytes = readFileSync(normalized);
  } catch {
    throw new Error(`${path}.path is missing or unreadable`);
  }
  if (sha256(bytes) !== expected) throw new Error(`${path}.sha256 does not match raw file bytes`);
  return { path: normalized, sha256: expected };
}

function normalizeCommand(input: BehavioralCommandInput, path: string): PlannedCommand {
  if (!isRecord(input)) throw new Error(`${path} must be an object`);
  const commandKeys = Object.hasOwn(input, "identitySha256")
    ? ["arguments", "environmentKeys", "executable", "identitySha256", "supportingFiles"]
    : ["arguments", "environmentKeys", "executable", "supportingFiles"];
  assertExactKeys(input, commandKeys, path);
  const executable = absoluteRegularFile(input.executable, `${path}.executable`);
  if (!Array.isArray(input.arguments)) throw new Error(`${path}.arguments must be an array`);
  const arguments_ = input.arguments.map((argument, index) => {
    if (typeof argument !== "string" || argument.includes("\0")) {
      throw new Error(`${path}.arguments[${index}] must be a string without NUL bytes`);
    }
    return argument;
  });
  if (!Array.isArray(input.supportingFiles)) {
    throw new Error(`${path}.supportingFiles must be an array`);
  }
  const supportingFiles = input.supportingFiles
    .map((file, index) => absoluteRegularFile(file, `${path}.supportingFiles[${index}]`))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  if (new Set(supportingFiles.map(({ path: filePath }) => filePath)).size !== supportingFiles.length) {
    throw new Error(`${path}.supportingFiles contains duplicate paths`);
  }
  for (const argument of arguments_) {
    if (isAbsolute(argument) && existsSync(argument) && statSync(argument).isFile()) {
      const normalized = resolve(argument);
      if (
        normalized !== executable.path &&
        !supportingFiles.some(({ path: supportingPath }) => supportingPath === normalized)
      ) {
        throw new Error(`${path} must bind absolute file argument ${normalized} in supportingFiles`);
      }
    }
  }
  if (!Array.isArray(input.environmentKeys)) {
    throw new Error(`${path}.environmentKeys must be an array`);
  }
  const environmentKeys = [...input.environmentKeys]
    .map((key, index) => {
      if (typeof key !== "string" || !ENV_NAME.test(key)) {
        throw new Error(`${path}.environmentKeys[${index}] is not a portable environment name`);
      }
      if (key.startsWith(RESERVED_ENV_PREFIX)) {
        throw new Error(`${path}.environmentKeys cannot override ${RESERVED_ENV_PREFIX}*`);
      }
      if (process.env[key] === undefined) {
        throw new Error(`${path}.environmentKeys requires missing environment variable ${key}`);
      }
      return key;
    })
    .sort();
  if (new Set(environmentKeys).size !== environmentKeys.length) {
    throw new Error(`${path}.environmentKeys contains duplicates`);
  }
  const body = {
    executable,
    arguments: arguments_,
    supportingFiles,
    environmentKeys,
  } as const;
  return { ...body, identitySha256: sha256Json(body) };
}

function normalizeConfig(input: BehavioralConfigInput, path: string): PlannedConfig {
  if (!isRecord(input)) throw new Error(`${path} must be an object`);
  assertExactKeys(
    input,
    Object.hasOwn(input, "identitySha256")
      ? ["configId", "identitySha256", "path", "sha256"]
      : ["configId", "path", "sha256"],
    path,
  );
  const configId = requiredId(input?.configId, `${path}.configId`);
  const file = absoluteRegularFile(input, path);
  const body = { configId, ...file } as const;
  return { ...body, identitySha256: sha256Json(body) };
}

function normalizeModel(input: BehavioralModelIdentity, path: string): PlannedModel {
  if (!isRecord(input)) throw new Error(`${path} must be an object`);
  assertExactKeys(
    input,
    Object.hasOwn(input, "identitySha256")
      ? ["digest", "identitySha256", "modelId", "provider", "revision"]
      : ["digest", "modelId", "provider", "revision"],
    path,
  );
  const body = {
    provider: requiredId(input.provider, `${path}.provider`),
    modelId: requiredId(input.modelId, `${path}.modelId`),
    revision: requiredId(input.revision, `${path}.revision`),
    digest: requiredSha(input.digest, `${path}.digest`),
  } as const;
  return { ...body, identitySha256: sha256Json(body) };
}

function normalizeTreatment(
  input: BehavioralTreatmentDelta,
  arm: BehavioralArm,
  path: string,
): PlannedTreatment {
  if (!isRecord(input)) throw new Error(`${path} must be an object`);
  const expected = TREATMENT_BY_ARM[arm];
  if (canonical(input) !== canonical(expected)) {
    throw new Error(`${path} must contain only the registered ${arm} treatment delta`);
  }
  return { ...expected, identitySha256: sha256Json(expected) };
}

function cleanCheckout(checkoutPath: string): boolean {
  try {
    const status = execFileSync(
      "git",
      ["-C", checkoutPath, "status", "--porcelain=v1", "--untracked-files=all"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return status.trim() === "";
  } catch {
    return false;
  }
}

function sourceRoot(plan: Pick<BehavioralBatchPlan, "source">): string {
  return resolve(
    plan.source.mode === "pinned-upstream"
      ? plan.source.checkoutPath
      : plan.source.rootPath,
  );
}

function sourceVerification(
  cornerId: PublicEvalCornerId,
  source: PinnedBehavioralSourceInput | ConformanceBehavioralSourceInput,
  services: BehavioralServices,
): { readonly verification: unknown; readonly clean: boolean | null } {
  if (source.mode === "pinned-upstream") {
    const verification = services.verifyPinnedSource({
      cornerId,
      checkoutPath: source.checkoutPath,
      ...(source.externalFiles === undefined ? {} : { externalFiles: source.externalFiles }),
    });
    return { verification, clean: cleanCheckout(resolve(source.checkoutPath)) };
  }
  const verification = services.verifyFileSet({
    rootPath: source.rootPath,
    expectedFiles: source.expectedFiles,
  });
  return { verification, clean: null };
}

function verificationValid(value: unknown): boolean {
  return isRecord(value) && value.valid === true;
}

function normalizeSource(
  cornerId: PublicEvalCornerId,
  evidenceClass: BehavioralEvidenceClass,
  raw: BehavioralBatchInput["source"],
): BehavioralBatchPlan["source"] {
  if (!isRecord(raw)) throw new Error("source must be an object");
  if (evidenceClass === "behavioral-efficacy-candidate") {
    if (raw.mode !== "pinned-upstream") {
      throw new Error("behavioral-efficacy-candidate requires source.mode=pinned-upstream");
    }
    const checkoutPath = resolve(requiredString(raw.checkoutPath, "source.checkoutPath"));
    if (
      raw.allowProtectedLocal !== undefined &&
      typeof raw.allowProtectedLocal !== "boolean"
    ) {
      throw new Error("source.allowProtectedLocal must be boolean when provided");
    }
    const externalFiles = Object.fromEntries(
      Object.entries(raw.externalFiles ?? {})
        .map(([sourceId, path]) => [requiredId(sourceId, "source.externalFiles key"), resolve(path)] as const)
        .sort(([left], [right]) => compareCodeUnits(left, right)),
    );
    const source: PinnedBehavioralSourceInput = {
      mode: "pinned-upstream",
      checkoutPath,
      ...(Object.keys(externalFiles).length === 0 ? {} : { externalFiles }),
      ...(raw.allowProtectedLocal === undefined
        ? {}
        : { allowProtectedLocal: raw.allowProtectedLocal }),
      ...(raw.protectedDataRoot === undefined
        ? {}
        : { protectedDataRoot: resolve(raw.protectedDataRoot) }),
    };
    if (cornerId === "appworld-22cc237_2") {
      if (source.allowProtectedLocal !== true || source.protectedDataRoot === undefined) {
        throw new Error(
          "AppWorld behavioral execution requires allowProtectedLocal=true and protectedDataRoot",
        );
      }
      if (
        isWithin(workspaceRoot(), source.protectedDataRoot) ||
        isWithin(checkoutPath, source.protectedDataRoot)
      ) {
        throw new Error("AppWorld protectedDataRoot must be outside workspace and checkout");
      }
    } else if (
      source.allowProtectedLocal !== undefined ||
      source.protectedDataRoot !== undefined
    ) {
      throw new Error("protected local source options are reserved for AppWorld");
    }
    return source;
  }

  if (raw.mode !== "protocol-conformance") {
    throw new Error("protocol-conformance requires source.mode=protocol-conformance");
  }
  if (
    raw.syntheticNotice !==
    "PM-authored protocol fixture; no upstream task data or efficacy claim."
  ) {
    throw new Error("protocol conformance source must carry the exact synthetic notice");
  }
  if (!Array.isArray(raw.expectedFiles) || raw.expectedFiles.length === 0) {
    throw new Error("source.expectedFiles must be a non-empty array");
  }
  return {
    mode: "protocol-conformance",
    rootPath: resolve(requiredString(raw.rootPath, "source.rootPath")),
    expectedFiles: raw.expectedFiles.map((file, index) => ({
      sourceId: requiredId(file.sourceId, `source.expectedFiles[${index}].sourceId`),
      relativePath: requiredString(
        file.relativePath,
        `source.expectedFiles[${index}].relativePath`,
      ),
      sha256: requiredSha(file.sha256, `source.expectedFiles[${index}].sha256`),
    })),
    syntheticNotice:
      "PM-authored protocol fixture; no upstream task data or efficacy claim.",
  };
}

function expectedOracleSourcePath(
  planSource: BehavioralBatchPlan["source"],
  envelope: ManifestEnvelope,
  sourceId: string,
): string {
  if (planSource.mode === "protocol-conformance") {
    const file = planSource.expectedFiles.find((entry) => entry.sourceId === sourceId);
    if (!file) throw new Error("conformance oracle.sourceId is not in source.expectedFiles");
    return resolve(planSource.rootPath, file.relativePath);
  }
  const source = envelope.manifest.sources.find((entry) => entry.sourceId === sourceId);
  if (!source) throw new Error("oracle.sourceId is not in the selected corner manifest");
  if (source.location === "checkout") {
    return resolve(planSource.checkoutPath, source.path);
  }
  const external = planSource.externalFiles?.[source.sourceId];
  if (!external) throw new Error(`oracle source ${source.sourceId} has no external binding`);
  return resolve(external);
}

function oracleInvocationVerification(
  command: PlannedCommand,
  sourceId: string,
  sourcePath: string,
): BehavioralOracleInvocationVerification {
  const normalizedSourcePath = resolve(sourcePath);
  const source = command.supportingFiles.find(
    ({ path }) => path === normalizedSourcePath,
  );
  if (!source) {
    throw new Error("oracle command does not bind the declared oracle source bytes");
  }
  return {
    schemaVersion: "pm.public-eval-corners.oracle-invocation-verification.v1",
    status: "not-independently-verified",
    commandIdentitySha256: command.identitySha256,
    sourceId,
    sourcePath: normalizedSourcePath,
    sourceSha256: source.sha256,
    invocationProofReceipt: null,
    requiredForIndependentAnalysis: true,
    eligibilityEffect: "blocks-independent-analysis",
  };
}

function validateOutcomeRelativePath(value: unknown): string {
  const path = requiredString(value, "oracle.outcomeRelativePath");
  if (path !== "oracle-outcome.json") {
    throw new Error("oracle.outcomeRelativePath must be the arm-blind name oracle-outcome.json");
  }
  return path;
}

function assertOracleCommandIsArmBlind(
  oracle: PlannedCommand,
  trials: readonly PlannedTrial[],
  outputRoot: string,
): void {
  for (const key of oracle.environmentKeys) {
    if (ORACLE_CONTEXT_NAME.test(key)) {
      throw new Error(`oracle environment key ${key} can disclose treatment context`);
    }
  }
  const forbiddenPaths = new Set([
    resolve(outputRoot),
    ...trials.map(({ config }) => resolve(config.path)),
  ]);
  for (const argument of oracle.arguments) {
    const lowered = argument.toLowerCase();
    if (
      /(?:^|[-_=])(?:arm|treatment|config|plan|output[-_]root|substrate|sham|native)(?:$|[-_=])/u.test(lowered) ||
      [...forbiddenPaths].some((path) => argument === path || argument.startsWith(`${path}/`))
    ) {
      throw new Error("oracle arguments may not disclose arm, treatment, plan, output, or runner config");
    }
  }
  for (const trial of trials) {
    if (
      oracle.executable.path === trial.config.path ||
      oracle.supportingFiles.some(({ path }) => path === trial.config.path)
    ) {
      throw new Error("oracle command may not read the shared runner config");
    }
  }
}

function armBlindScoringInput(bytes: Buffer, path: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${path} must be valid JSON`);
  }
  if (!isRecord(parsed)) throw new Error(`${path} must be an object`);
  const keys = Object.keys(parsed).sort(compareCodeUnits);
  if (
    keys.join(",") !== "schemaVersion,taskOutput" ||
    parsed.schemaVersion !== "pm.public-eval-corners.scoring-input.v1"
  ) {
    throw new Error(
      `${path} must contain only schemaVersion and arm-blind taskOutput`,
    );
  }
  const forbiddenControlKeys = new Set([
    "agentStateTreatment",
    "arm",
    "boundaryProvider",
    "configPath",
    "outputRoot",
    "planPath",
    "treatment",
    "treatmentPath",
  ]);
  const visit = (value: unknown, location: string): void => {
    if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
    else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (forbiddenControlKeys.has(key)) {
          throw new Error(`${path} exposes treatment control key ${location}.${key}`);
        }
        visit(child, `${location}.${key}`);
      }
    }
  };
  visit(parsed.taskOutput, "taskOutput");
}

function armOrder(randomizationSeed: string, trial: Pick<PlannedTrial, "trialId" | "taskId" | "seed">): readonly BehavioralArm[] {
  return ARMS.map((arm) => ({
    arm,
    key: sha256Json({
      schemaVersion: "pm.public-eval-corners.arm-order.v1",
      randomizationSeed,
      trialId: trial.trialId,
      taskId: trial.taskId,
      seed: trial.seed,
      arm,
    }),
  }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.key, right.key) || compareCodeUnits(left.arm, right.arm),
    )
    .map(({ arm }) => arm);
}

function planWithoutHash(plan: BehavioralBatchPlan): Omit<BehavioralBatchPlan, "planHash"> {
  const { planHash: _planHash, ...body } = plan;
  return body;
}

function assertPlanFileIdentities(plan: BehavioralBatchPlan): void {
  assertExactKeys(plan as unknown as JsonRecord, [
    "batchId",
    "cornerId",
    "efficacyClaimed",
    "eligibleForIndependentAnalysis",
    "evidenceClass",
    "manifestSha256",
    "oracle",
    "outputRoot",
    "planHash",
    "randomizationSeed",
    "schemaVersion",
    "source",
    "timeoutMs",
    "trials",
  ], "plan");
  if (plan.efficacyClaimed !== false || plan.eligibleForIndependentAnalysis !== false) {
    throw new Error(
      "local behavioral plans must remain ineligible without independent oracle invocation proof",
    );
  }
  assertExactKeys(plan.oracle as unknown as JsonRecord, [
    "command",
    "invocationVerification",
    "outcomeMediaType",
    "outcomeRelativePath",
    "owner",
    "sourceId",
  ], "plan.oracle");
  assertExactKeys(plan.oracle.invocationVerification as unknown as JsonRecord, [
    "commandIdentitySha256",
    "eligibilityEffect",
    "invocationProofReceipt",
    "requiredForIndependentAnalysis",
    "schemaVersion",
    "sourceId",
    "sourcePath",
    "sourceSha256",
    "status",
  ], "plan.oracle.invocationVerification");
  const commands: PlannedCommand[] = [
    plan.oracle.command,
    ...plan.trials.map((trial) => trial.runner),
  ];
  for (const [index, command] of commands.entries()) {
    const normalized = normalizeCommand(command, `plan.commands[${index}]`);
    if (normalized.identitySha256 !== command.identitySha256) {
      throw new Error(`plan.commands[${index}] identity changed`);
    }
  }
  const expectedInvocationVerification = oracleInvocationVerification(
    plan.oracle.command,
    plan.oracle.sourceId,
    plan.oracle.invocationVerification.sourcePath,
  );
  if (!sameJson(expectedInvocationVerification, plan.oracle.invocationVerification)) {
    throw new Error("oracle invocation verification boundary changed");
  }
  for (const trial of plan.trials) {
    assertExactKeys(trial as unknown as JsonRecord, [
      "armOrder",
      "arms",
      "config",
      "model",
      "runner",
      "seed",
      "taskId",
      "trialId",
    ], `${trial.trialId}`);
    const config = normalizeConfig(trial.config, `${trial.trialId}.config`);
    const model = normalizeModel(trial.model, `${trial.trialId}.model`);
    const runner = normalizeCommand(trial.runner, `${trial.trialId}.runner`);
    if (config.identitySha256 !== trial.config.identitySha256) {
      throw new Error(`${trial.trialId} shared config identity changed`);
    }
    if (model.identitySha256 !== trial.model.identitySha256) {
      throw new Error(`${trial.trialId} shared model identity changed`);
    }
    if (runner.identitySha256 !== trial.runner.identitySha256) {
      throw new Error(`${trial.trialId} shared runner identity changed`);
    }
    for (const plannedArm of trial.arms) {
      assertExactKeys(
        plannedArm as unknown as JsonRecord,
        ["arm", "treatment"],
        `${trial.trialId}.${plannedArm.arm}`,
      );
      assertExactKeys(
        plannedArm.treatment as unknown as JsonRecord,
        [
          "agentStateTreatment",
          "arm",
          "boundaryProvider",
          "identitySha256",
          "schemaVersion",
        ],
        `${trial.trialId}.${plannedArm.arm}.treatment`,
      );
      const { identitySha256: _identitySha256, ...rawTreatment } =
        plannedArm.treatment;
      const treatment = normalizeTreatment(
        rawTreatment,
        plannedArm.arm,
        `${trial.trialId}.${plannedArm.arm}.treatment`,
      );
      if (treatment.identitySha256 !== plannedArm.treatment.identitySha256) {
        throw new Error(`${trial.trialId}.${plannedArm.arm} treatment identity changed`);
      }
    }
  }
  assertOracleCommandIsArmBlind(plan.oracle.command, plan.trials, plan.outputRoot);
}

export function planBehavioralBatch(
  input: BehavioralBatchInput,
  services: BehavioralServices,
): BehavioralPlanResult {
  try {
    if (input.schemaVersion !== "pm.public-eval-corners.behavioral-batch-input.v1") {
      throw new Error("unsupported behavioral batch input schemaVersion");
    }
    if (
      input.evidenceClass !== "behavioral-efficacy-candidate" &&
      input.evidenceClass !== "protocol-conformance"
    ) {
      throw new Error("unsupported evidenceClass");
    }
    const envelope = services.getManifest(input.cornerId);
    const batchId = requiredId(input.batchId, "batchId");
    const randomizationSeed = requiredString(input.randomizationSeed, "randomizationSeed");
    const outputRoot = resolve(requiredString(input.outputRoot, "outputRoot"));
    if (isWithin(workspaceRoot(), outputRoot)) {
      throw new Error("behavioral outputRoot must be outside the Git workspace");
    }
    const timeoutMs = input.timeoutMs ?? 900_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive safe integer");
    }
    const source = normalizeSource(input.cornerId, input.evidenceClass, input.source);
    const normalizedSourceRoot = resolve(
      source.mode === "pinned-upstream" ? source.checkoutPath : source.rootPath,
    );
    if (
      isWithin(normalizedSourceRoot, outputRoot) ||
      isWithin(outputRoot, normalizedSourceRoot)
    ) {
      throw new Error("behavioral outputRoot and source root must be disjoint");
    }
    if (!isRecord(input.oracle)) throw new Error("oracle must be an object");
    const expectedOwner =
      input.evidenceClass === "behavioral-efficacy-candidate"
        ? "upstream"
        : "pm-conformance-fixture";
    if (input.oracle.owner !== expectedOwner) {
      throw new Error(`evidenceClass requires oracle.owner=${expectedOwner}`);
    }
    if (input.oracle.outcomeMediaType !== "application/json") {
      throw new Error("oracle.outcomeMediaType must be application/json");
    }
    const oracleSourceId = requiredId(input.oracle.sourceId, "oracle.sourceId");
    const oracleCommand = normalizeCommand(input.oracle.command, "oracle.command");
    const oracleSourcePath = expectedOracleSourcePath(source, envelope, oracleSourceId);
    const invocationVerification = oracleInvocationVerification(
      oracleCommand,
      oracleSourceId,
      oracleSourcePath,
    );
    const outcomeRelativePath = validateOutcomeRelativePath(input.oracle.outcomeRelativePath);
    if (!Array.isArray(input.trials) || input.trials.length === 0) {
      throw new Error("trials must be a non-empty array");
    }
    const manifestTaskIds = new Set(envelope.manifest.tasks.map(({ taskId }) => taskId));
    const seenTrialIds = new Set<string>();
    const seenTaskSeeds = new Set<string>();
    const trials = input.trials.map((rawTrial, trialIndex): PlannedTrial => {
      if (!isRecord(rawTrial)) throw new Error(`trials[${trialIndex}] must be an object`);
      if (
        Object.keys(rawTrial).sort(compareCodeUnits).join(",") !==
        "config,model,runner,seed,taskId,treatments,trialId"
      ) {
        throw new Error(
          `trials[${trialIndex}] must contain one shared runner/config/model and treatment deltas only`,
        );
      }
      const trialId = requiredId(rawTrial.trialId, `trials[${trialIndex}].trialId`);
      const taskId = requiredString(rawTrial.taskId, `trials[${trialIndex}].taskId`);
      const seed = requiredId(rawTrial.seed, `trials[${trialIndex}].seed`);
      if (!manifestTaskIds.has(taskId)) {
        throw new Error(`trials[${trialIndex}].taskId is not pinned by the corner manifest`);
      }
      if (seenTrialIds.has(trialId)) throw new Error(`duplicate trialId ${trialId}`);
      seenTrialIds.add(trialId);
      const taskSeed = `${taskId}\0${seed}`;
      if (seenTaskSeeds.has(taskSeed)) throw new Error(`duplicate taskId/seed pair ${taskId}/${seed}`);
      seenTaskSeeds.add(taskSeed);
      const runner = normalizeCommand(
        rawTrial.runner as BehavioralCommandInput,
        `${trialId}.runner`,
      );
      const config = normalizeConfig(
        rawTrial.config as BehavioralConfigInput,
        `${trialId}.config`,
      );
      const model = normalizeModel(
        rawTrial.model as BehavioralModelIdentity,
        `${trialId}.model`,
      );
      if (!isRecord(rawTrial.treatments)) {
        throw new Error(`${trialId}.treatments must be an object`);
      }
      const rawTreatments = rawTrial.treatments;
      if (
        Object.keys(rawTreatments).sort(compareCodeUnits).join(",") !==
        [...ARMS].sort(compareCodeUnits).join(",")
      ) {
        throw new Error(`${trialId}.treatments must contain exactly native, sham, and substrate`);
      }
      const arms = ARMS.map((arm): PlannedArm => {
        return {
          arm,
          treatment: normalizeTreatment(
            rawTreatments[arm] as BehavioralTreatmentDelta,
            arm,
            `${trialId}.treatments.${arm}`,
          ),
        };
      });
      const trialBase = { trialId, taskId, seed };
      return {
        ...trialBase,
        armOrder: armOrder(randomizationSeed, trialBase),
        runner,
        config,
        model,
        arms,
      };
    });
    assertOracleCommandIsArmBlind(oracleCommand, trials, outputRoot);
    const planBody = {
      schemaVersion: "pm.public-eval-corners.behavioral-plan.v1" as const,
      evidenceClass: input.evidenceClass,
      efficacyClaimed: false as const,
      eligibleForIndependentAnalysis: false as const,
      batchId,
      cornerId: input.cornerId,
      manifestSha256: envelope.manifestSha256,
      randomizationSeed,
      outputRoot,
      timeoutMs,
      source,
      oracle: {
        owner: input.oracle.owner,
        sourceId: oracleSourceId,
        command: oracleCommand,
        outcomeRelativePath,
        outcomeMediaType: "application/json" as const,
        invocationVerification,
      },
      trials,
    };
    const plan = deepFreeze({ ...planBody, planHash: sha256Json(planBody) });
    const checkedSource = sourceVerification(input.cornerId, source, services);
    const issues: string[] = [];
    if (!verificationValid(checkedSource.verification)) issues.push("source verification failed");
    if (source.mode === "pinned-upstream" && checkedSource.clean !== true) {
      issues.push("pinned upstream checkout is not clean");
    }
    return deepFreeze({
      schemaVersion: "pm.public-eval-corners.behavioral-plan-result.v1",
      valid: issues.length === 0,
      plan,
      sourceVerification: checkedSource.verification,
      issues,
    });
  } catch (error) {
    return deepFreeze({
      schemaVersion: "pm.public-eval-corners.behavioral-plan-result.v1",
      valid: false,
      plan: null,
      sourceVerification: null,
      issues: [error instanceof Error ? error.message : String(error)],
    });
  }
}

function prepareOutputRoot(path: string): void {
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("outputRoot must be a new directory or an empty real directory");
    }
    if (readdirSync(path).length !== 0) throw new Error("outputRoot must be empty");
    return;
  }
  mkdirSync(path, { recursive: true });
}

function selectedEnvironment(
  command: PlannedCommand,
  fixed: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of command.environmentKeys) environment[key] = process.env[key];
  for (const [key, value] of Object.entries(fixed)) environment[key] = value;
  return environment;
}

function writeExclusive(path: string, value: string | Uint8Array): void {
  writeFileSync(path, value, { flag: "wx" });
}

function execute(
  command: PlannedCommand,
  cwd: string,
  environment: NodeJS.ProcessEnv,
  timeoutMs: number,
): { readonly status: number | null; readonly stdout: Buffer; readonly stderr: Buffer; readonly error: string | null } {
  const result = spawnSync(command.executable.path, command.arguments, {
    cwd,
    env: environment,
    encoding: "buffer",
    shell: false,
    timeout: timeoutMs,
    maxBuffer: MAX_CAPTURE_BYTES,
  });
  return {
    status: result.status,
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? ""),
    stderr: Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? ""),
    error: result.error?.message ?? null,
  };
}

function inventory(root: string, outputRoot: string): readonly BehavioralArtifactInventoryEntry[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`raw artifact cannot be a symlink: ${path}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(path);
      else throw new Error(`raw artifact must be a regular file or directory: ${path}`);
      if (files.length > MAX_INVENTORY_FILES) throw new Error("raw artifact file-count limit exceeded");
    }
  };
  visit(root);
  return files.sort().map((path) => {
    const bytes = readFileSync(path);
    return {
      path: relative(outputRoot, path),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
    };
  });
}

function commandRecord(
  command: PlannedCommand,
  outputRoot: string,
  stdoutPath: string,
  stderrPath: string,
  stdout: Buffer,
  stderr: Buffer,
): BehavioralExecutionRecord {
  return {
    commandIdentitySha256: command.identitySha256,
    exitCode: 0,
    stdoutPath: relative(outputRoot, stdoutPath),
    stdoutSha256: sha256(stdout),
    stderrPath: relative(outputRoot, stderrPath),
    stderrSha256: sha256(stderr),
  };
}

function failedExecutionMessage(
  kind: "runner" | "oracle",
  trialId: string,
  arm: BehavioralArm,
  result: ReturnType<typeof execute>,
): string {
  return `${kind} command failed for ${trialId}/${arm} (status=${String(result.status)}, error=${result.error ?? "none"}, stdoutSha256=${sha256(result.stdout)}, stderrSha256=${sha256(result.stderr)})`;
}

function matchingProof(
  trial: PlannedTrial,
  attempts: readonly BehavioralAttemptRecord[],
): BehavioralTrialReceipt["matchingProof"] {
  if (attempts.length !== ARMS.length) {
    throw new Error(`${trial.trialId} does not contain an exact three-arm attempt set`);
  }
  const attemptByArm = new Map(attempts.map((attempt) => [attempt.arm, attempt] as const));
  const treatmentByArm = new Map(trial.arms.map((entry) => [entry.arm, entry.treatment] as const));
  if (
    attemptByArm.size !== ARMS.length ||
    treatmentByArm.size !== ARMS.length ||
    ARMS.some((arm) => !attemptByArm.has(arm) || !treatmentByArm.has(arm))
  ) {
    throw new Error(`${trial.trialId} is missing a registered arm or treatment`);
  }
  const treatmentIdentitySha256 = Object.fromEntries(
    ARMS.map((arm) => {
      const attempt = attemptByArm.get(arm);
      const treatment = treatmentByArm.get(arm);
      if (!attempt || !treatment) throw new Error(`${trial.trialId}/${arm} is missing`);
      if (
        attempt.command.commandIdentitySha256 !== trial.runner.identitySha256 ||
        attempt.sharedConfigIdentitySha256 !== trial.config.identitySha256 ||
        attempt.sharedModelIdentitySha256 !== trial.model.identitySha256 ||
        attempt.treatment.identitySha256 !== treatment.identitySha256
      ) {
        throw new Error(`${trial.trialId}/${arm} differs outside the registered treatment delta`);
      }
      return [arm, treatment.identitySha256] as const;
    }),
  ) as Readonly<Record<BehavioralArm, string>>;
  const body = {
    sharedRunnerIdentitySha256: trial.runner.identitySha256,
    sharedConfigIdentitySha256: trial.config.identitySha256,
    sharedModelIdentitySha256: trial.model.identitySha256,
    treatmentIdentitySha256,
  };
  return { ...body, proofHash: sha256Json(body) };
}

export function runBehavioralBatch(
  input: BehavioralBatchInput,
  services: BehavioralServices,
): BehavioralBatchReceipt {
  const planned = planBehavioralBatch(input, services);
  if (!planned.valid || planned.plan === null) {
    throw new Error(`behavioral batch plan refused: ${planned.issues.join("; ")}`);
  }
  const plan = planned.plan;
  prepareOutputRoot(plan.outputRoot);
  const planPath = resolve(plan.outputRoot, "predeclared-plan.json");
  const planBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`);
  writeExclusive(planPath, planBytes);
  const checkedBefore = sourceVerification(plan.cornerId, plan.source, services);
  if (
    !verificationValid(checkedBefore.verification) ||
    (plan.source.mode === "pinned-upstream" && checkedBefore.clean !== true)
  ) {
    throw new Error("source changed between planning and pre-execution verification");
  }
  assertPlanFileIdentities(plan);
  const trialReceipts: BehavioralTrialReceipt[] = [];

  for (const trial of plan.trials) {
    const plannedArms = new Map(trial.arms.map((arm) => [arm.arm, arm] as const));
    const attempts: BehavioralAttemptRecord[] = [];
    for (const [index, arm] of trial.armOrder.entries()) {
      assertPlanFileIdentities(plan);
      const plannedArm = plannedArms.get(arm);
      if (!plannedArm) throw new Error(`plan omitted arm ${arm}`);
      const outputRelativePath = `${trial.trialId}/${String(index + 1).padStart(2, "0")}-${arm}`;
      const armRoot = resolve(plan.outputRoot, outputRelativePath);
      mkdirSync(armRoot, { recursive: true });
      const { identitySha256: _treatmentIdentity, ...treatmentDelta } =
        plannedArm.treatment;
      const treatmentPath = resolve(armRoot, "treatment.json");
      const treatmentBytes = Buffer.from(`${JSON.stringify(treatmentDelta, null, 2)}\n`);
      writeExclusive(treatmentPath, treatmentBytes);
      const scoringInputPath = resolve(armRoot, "scoring-input.json");
      const fixedEnvironment = {
        PM_PUBLIC_EVAL_PHASE: "agent",
        PM_PUBLIC_EVAL_EVIDENCE_CLASS: plan.evidenceClass,
        PM_PUBLIC_EVAL_ARM_OUTPUT_ROOT: armRoot,
        PM_PUBLIC_EVAL_SOURCE_ROOT: sourceRoot(plan),
        PM_PUBLIC_EVAL_CORNER_ID: plan.cornerId,
        PM_PUBLIC_EVAL_BATCH_ID: plan.batchId,
        PM_PUBLIC_EVAL_TRIAL_ID: trial.trialId,
        PM_PUBLIC_EVAL_TASK_ID: trial.taskId,
        PM_PUBLIC_EVAL_ARM: arm,
        PM_PUBLIC_EVAL_SEED: trial.seed,
        PM_PUBLIC_EVAL_CONFIG_PATH: trial.config.path,
        PM_PUBLIC_EVAL_TREATMENT_PATH: treatmentPath,
        PM_PUBLIC_EVAL_SCORING_INPUT_PATH: scoringInputPath,
      } as const;
      const agentRun = execute(
        trial.runner,
        armRoot,
        selectedEnvironment(trial.runner, fixedEnvironment),
        plan.timeoutMs,
      );
      const agentStdoutPath = resolve(armRoot, "agent.stdout.log");
      const agentStderrPath = resolve(armRoot, "agent.stderr.log");
      writeExclusive(agentStdoutPath, agentRun.stdout);
      writeExclusive(agentStderrPath, agentRun.stderr);
      if (agentRun.status !== 0 || agentRun.error !== null) {
        throw new Error(failedExecutionMessage("runner", trial.trialId, arm, agentRun));
      }
      assertPlanFileIdentities(plan);
      if (!existsSync(scoringInputPath) || !lstatSync(scoringInputPath).isFile()) {
        throw new Error(`runner did not create scoring-input.json for ${trial.trialId}/${arm}`);
      }
      const scoringInputBytes = readFileSync(scoringInputPath);
      armBlindScoringInput(scoringInputBytes, `${trial.trialId}/${arm}/scoring-input.json`);

      const neutralRoot = mkdtempSync(resolve(tmpdir(), "pm-corners-oracle-view-"));
      const neutralInputPath = resolve(neutralRoot, "task-output.json");
      const neutralOutcomePath = resolve(neutralRoot, "oracle-outcome.json");
      writeExclusive(neutralInputPath, scoringInputBytes);
      let oracleRun: ReturnType<typeof execute> | null = null;
      let outcomeBytes: Buffer | null = null;
      try {
        if (readdirSync(neutralRoot).join(",") !== "task-output.json") {
          throw new Error("arm-blind oracle view was not initially isolated");
        }
        oracleRun = execute(
          plan.oracle.command,
          neutralRoot,
          selectedEnvironment(plan.oracle.command, {
            PM_PUBLIC_EVAL_PHASE: "oracle",
            PM_PUBLIC_EVAL_ORACLE_INPUT_PATH: neutralInputPath,
            PM_PUBLIC_EVAL_ORACLE_OUTCOME_PATH: neutralOutcomePath,
          }),
          plan.timeoutMs,
        );
        if (oracleRun.status !== 0 || oracleRun.error !== null) {
          throw new Error(failedExecutionMessage("oracle", trial.trialId, arm, oracleRun));
        }
        if (sha256(readFileSync(neutralInputPath)) !== sha256(scoringInputBytes)) {
          throw new Error(`oracle mutated its scoring input for ${trial.trialId}/${arm}`);
        }
        if (!existsSync(neutralOutcomePath) || !lstatSync(neutralOutcomePath).isFile()) {
          throw new Error(`oracle did not create a regular outcome for ${trial.trialId}/${arm}`);
        }
        const neutralEntries = readdirSync(neutralRoot).sort(compareCodeUnits);
        if (neutralEntries.join(",") !== "oracle-outcome.json,task-output.json") {
          throw new Error(`oracle created undeclared files for ${trial.trialId}/${arm}`);
        }
        outcomeBytes = readFileSync(neutralOutcomePath);
      } finally {
        rmSync(neutralRoot, { recursive: true, force: true });
      }
      if (oracleRun === null || outcomeBytes === null) {
        throw new Error(`oracle did not complete for ${trial.trialId}/${arm}`);
      }
      const oracleStdoutPath = resolve(armRoot, "oracle.stdout.log");
      const oracleStderrPath = resolve(armRoot, "oracle.stderr.log");
      const oracleInputPath = resolve(armRoot, "oracle-input.json");
      const outcomePath = resolve(armRoot, "oracle-outcome.json");
      writeExclusive(oracleInputPath, scoringInputBytes);
      writeExclusive(oracleStdoutPath, oracleRun.stdout);
      writeExclusive(oracleStderrPath, oracleRun.stderr);
      writeExclusive(outcomePath, outcomeBytes);
      if (outcomeBytes.byteLength === 0 || outcomeBytes.byteLength > MAX_CAPTURE_BYTES) {
        throw new Error(`oracle outcome size is invalid for ${trial.trialId}/${arm}`);
      }
      try {
        JSON.parse(outcomeBytes.toString("utf8")) as unknown;
      } catch {
        throw new Error(`oracle outcome is not valid JSON for ${trial.trialId}/${arm}`);
      }
      const rawArtifacts = inventory(armRoot, plan.outputRoot);
      attempts.push({
        order: index + 1,
        arm,
        outputRelativePath,
        sharedConfigIdentitySha256: trial.config.identitySha256,
        sharedModelIdentitySha256: trial.model.identitySha256,
        treatment: {
          identitySha256: plannedArm.treatment.identitySha256,
          path: relative(plan.outputRoot, treatmentPath),
          fileSha256: sha256(treatmentBytes),
        },
        command: commandRecord(
          trial.runner,
          plan.outputRoot,
          agentStdoutPath,
          agentStderrPath,
          agentRun.stdout,
          agentRun.stderr,
        ),
        oracle: {
          ...commandRecord(
            plan.oracle.command,
            plan.outputRoot,
            oracleStdoutPath,
            oracleStderrPath,
            oracleRun.stdout,
            oracleRun.stderr,
          ),
          owner: plan.oracle.owner,
          sourceId: plan.oracle.sourceId,
          outcomePath: relative(plan.outputRoot, outcomePath),
          outcomeMediaType: "application/json",
          outcomeByteLength: outcomeBytes.byteLength,
          outcomeSha256: sha256(outcomeBytes),
          scoringInputPath: relative(plan.outputRoot, oracleInputPath),
          scoringInputSha256: sha256(scoringInputBytes),
          neutralView: "ephemeral-arm-blind",
          outcomeImportedWithoutInterpretation: true,
        },
        rawArtifacts,
      });
    }
    const proof = matchingProof(trial, attempts);
    trialReceipts.push({
      trialId: trial.trialId,
      taskId: trial.taskId,
      seed: trial.seed,
      armOrder: trial.armOrder,
      attempts,
      matchingProof: proof,
    });
  }

  assertPlanFileIdentities(plan);
  const checkedAfter = sourceVerification(plan.cornerId, plan.source, services);
  if (
    !verificationValid(checkedAfter.verification) ||
    (plan.source.mode === "pinned-upstream" && checkedAfter.clean !== true)
  ) {
    throw new Error("source or checkout cleanliness changed during behavioral execution");
  }
  if (!sameJson(checkedBefore.verification, checkedAfter.verification)) {
    throw new Error("source verification changed during behavioral execution");
  }
  if (sha256(readFileSync(planPath)) !== sha256(planBytes)) {
    throw new Error("predeclared plan bytes changed during behavioral execution");
  }
  const preReceiptIssues: string[] = [];
  for (const trial of trialReceipts) {
    for (const attempt of trial.attempts) {
      reopenInventory(attempt, plan.outputRoot, preReceiptIssues);
    }
  }
  const expectedTopBeforeReceipt = new Set([
    "predeclared-plan.json",
    ...plan.trials.map(({ trialId }) => trialId),
  ]);
  for (const entry of readdirSync(plan.outputRoot)) {
    if (!expectedTopBeforeReceipt.has(entry)) {
      preReceiptIssues.push(`unexpected top-level output artifact ${entry}`);
    }
  }
  if (preReceiptIssues.length > 0) {
    throw new Error(`raw evidence changed before receipt sealing: ${preReceiptIssues.join("; ")}`);
  }
  const body = {
    schemaVersion: "pm.public-eval-corners.behavioral-batch-receipt.v1" as const,
    evidenceClass: plan.evidenceClass,
    efficacyClaimed: false as const,
    decisionGating: false as const,
    eligibleForIndependentAnalysis: plan.eligibleForIndependentAnalysis,
    upstreamOutcomesInterpreted: false as const,
    batchId: plan.batchId,
    cornerId: plan.cornerId,
    manifestSha256: plan.manifestSha256,
    outputRoot: plan.outputRoot,
    planPath: "predeclared-plan.json" as const,
    planHash: plan.planHash,
    planFileSha256: sha256(planBytes),
    plan,
    oracleInvocationVerification: plan.oracle.invocationVerification,
    sourceVerification: {
      before: checkedBefore.verification,
      after: checkedAfter.verification,
      cleanBefore: checkedBefore.clean,
      cleanAfter: checkedAfter.clean,
    },
    trials: trialReceipts,
    protectedArtifactPolicy: {
      appWorldProtectedContentMayExistOnlyUnderExternalRoots:
        plan.cornerId === "appworld-22cc237_2",
      receiptEmbedsRawOutcomeContent: false as const,
      redistributionAuthorized: false as const,
    },
  };
  const receipt = deepFreeze({ ...body, receiptHash: sha256Json(body) });
  writeExclusive(
    resolve(plan.outputRoot, `pm-behavioral-batch-${receipt.receiptHash}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  const selfVerification = verifyBehavioralBatch(receipt, services);
  if (!selfVerification.valid) {
    throw new Error(`sealed behavioral receipt failed self-verification: ${selfVerification.issues.join("; ")}`);
  }
  return receipt;
}

function receiptWithoutHash(receipt: BehavioralBatchReceipt): Omit<BehavioralBatchReceipt, "receiptHash"> {
  const { receiptHash: _receiptHash, ...body } = receipt;
  return body;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function reopenInventory(
  attempt: BehavioralAttemptRecord,
  outputRoot: string,
  issues: string[],
): number {
  const armRoot = resolve(outputRoot, attempt.outputRelativePath);
  if (!isWithin(outputRoot, armRoot)) {
    issues.push(`${attempt.outputRelativePath}: arm root escapes outputRoot`);
    return 0;
  }
  try {
    const stat = lstatSync(armRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      issues.push(`${attempt.outputRelativePath}: arm root must be a real directory`);
      return 0;
    }
  } catch {
    issues.push(`${attempt.outputRelativePath}: arm root is missing or unreadable`);
    return 0;
  }
  let actual: readonly BehavioralArtifactInventoryEntry[];
  try {
    actual = inventory(armRoot, outputRoot);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    return 0;
  }
  if (!sameJson(actual, attempt.rawArtifacts)) {
    issues.push(`${attempt.outputRelativePath}: raw artifact inventory or bytes changed`);
  }
  const expectedPaths = [
    attempt.treatment.path,
    `${attempt.outputRelativePath}/scoring-input.json`,
    attempt.command.stdoutPath,
    attempt.command.stderrPath,
    attempt.oracle.stdoutPath,
    attempt.oracle.stderrPath,
    attempt.oracle.scoringInputPath,
    attempt.oracle.outcomePath,
  ];
  for (const path of expectedPaths) {
    if (!attempt.rawArtifacts.some((entry) => entry.path === path)) {
      issues.push(`${attempt.outputRelativePath}: required raw artifact ${path} is absent`);
    }
  }
  const reopen = (path: string, expectedHash: string, expectedLength?: number): void => {
    const target = resolve(outputRoot, path);
    if (!isWithin(armRoot, target)) {
      issues.push(`${attempt.outputRelativePath}: raw path ${path} escapes its arm root`);
      return;
    }
    try {
      const bytes = readFileSync(target);
      if (sha256(bytes) !== expectedHash) issues.push(`${path}: raw byte hash mismatch`);
      if (expectedLength !== undefined && bytes.byteLength !== expectedLength) {
        issues.push(`${path}: raw byte length mismatch`);
      }
    } catch {
      issues.push(`${path}: raw bytes are missing or unreadable`);
    }
  };
  reopen(attempt.treatment.path, attempt.treatment.fileSha256);
  reopen(
    `${attempt.outputRelativePath}/scoring-input.json`,
    attempt.oracle.scoringInputSha256,
  );
  reopen(attempt.command.stdoutPath, attempt.command.stdoutSha256);
  reopen(attempt.command.stderrPath, attempt.command.stderrSha256);
  reopen(attempt.oracle.stdoutPath, attempt.oracle.stdoutSha256);
  reopen(attempt.oracle.stderrPath, attempt.oracle.stderrSha256);
  reopen(attempt.oracle.scoringInputPath, attempt.oracle.scoringInputSha256);
  reopen(
    attempt.oracle.outcomePath,
    attempt.oracle.outcomeSha256,
    attempt.oracle.outcomeByteLength,
  );
  return actual.length;
}

export function verifyBehavioralBatch(
  value: unknown,
  services: BehavioralServices,
): BehavioralBatchVerification {
  const issues: string[] = [];
  let reopenedArtifactCount = 0;
  let evidenceClass: BehavioralEvidenceClass | null = null;
  let receiptHash: string | null = null;
  try {
    if (!isRecord(value)) throw new Error("behavioral receipt must be an object");
    if (value.schemaVersion !== "pm.public-eval-corners.behavioral-batch-receipt.v1") {
      throw new Error("unsupported behavioral receipt schemaVersion");
    }
    const receipt = value as unknown as BehavioralBatchReceipt;
    if (
      receipt.evidenceClass !== "behavioral-efficacy-candidate" &&
      receipt.evidenceClass !== "protocol-conformance"
    ) {
      throw new Error("unsupported receipt evidenceClass");
    }
    evidenceClass = receipt.evidenceClass;
    receiptHash = requiredSha(receipt.receiptHash, "receiptHash");
    if (sha256Json(receiptWithoutHash(receipt)) !== receiptHash) {
      issues.push("receiptHash does not match canonical receipt body");
    }
    if (
      receipt.efficacyClaimed !== false ||
      receipt.decisionGating !== false ||
      receipt.upstreamOutcomesInterpreted !== false
    ) {
      issues.push("behavioral harness may not interpret outcomes or claim efficacy");
    }
    if (receipt.eligibleForIndependentAnalysis !== false) {
      issues.push(
        "local behavioral receipts must remain ineligible without independent oracle invocation proof",
      );
    }
    const envelope = services.getManifest(receipt.cornerId);
    if (envelope.manifestSha256 !== receipt.manifestSha256) {
      issues.push("corner manifest hash changed or does not match receipt");
    }
    if (
      (receipt.evidenceClass === "behavioral-efficacy-candidate" &&
        (receipt.plan.source.mode !== "pinned-upstream" ||
          receipt.plan.oracle.owner !== "upstream")) ||
      (receipt.evidenceClass === "protocol-conformance" &&
        (receipt.plan.source.mode !== "protocol-conformance" ||
          receipt.plan.oracle.owner !== "pm-conformance-fixture"))
    ) {
      issues.push("evidence class, source mode, and oracle ownership are inconsistent");
    }
    const receiptSourceRoot = sourceRoot(receipt.plan);
    if (
      isWithin(receiptSourceRoot, receipt.outputRoot) ||
      isWithin(receipt.outputRoot, receiptSourceRoot)
    ) {
      issues.push("behavioral outputRoot and source root are not disjoint");
    }
    if (receipt.evidenceClass === "behavioral-efficacy-candidate") {
      if (
        receipt.cornerId === "appworld-22cc237_2" &&
        (receipt.plan.source.mode !== "pinned-upstream" ||
          receipt.plan.source.allowProtectedLocal !== true ||
          receipt.plan.source.protectedDataRoot === undefined)
      ) {
        issues.push("AppWorld receipt lacks protected-local controls");
      }
      if (
        receipt.cornerId !== "appworld-22cc237_2" &&
        receipt.plan.source.mode === "pinned-upstream" &&
        (receipt.plan.source.allowProtectedLocal !== undefined ||
          receipt.plan.source.protectedDataRoot !== undefined)
      ) {
        issues.push("non-AppWorld receipt contains protected-local source options");
      }
    }
    try {
      const expectedOraclePath = expectedOracleSourcePath(
        receipt.plan.source,
        envelope,
        receipt.plan.oracle.sourceId,
      );
      if (
        !receipt.plan.oracle.command.supportingFiles.some(
          ({ path }) => path === resolve(expectedOraclePath),
        )
      ) {
        issues.push("oracle command does not bind the declared oracle source bytes");
      }
      const expectedInvocationVerification = oracleInvocationVerification(
        receipt.plan.oracle.command,
        receipt.plan.oracle.sourceId,
        expectedOraclePath,
      );
      if (
        !sameJson(
          receipt.plan.oracle.invocationVerification,
          expectedInvocationVerification,
        ) ||
        !sameJson(
          receipt.oracleInvocationVerification,
          expectedInvocationVerification,
        )
      ) {
        issues.push(
          "oracle invocation verification boundary does not match the content-resolved source binding",
        );
      }
      if (receipt.plan.oracle.outcomeMediaType !== "application/json") {
        issues.push("oracle outcome media type is not application/json");
      }
      if (
        validateOutcomeRelativePath(receipt.plan.oracle.outcomeRelativePath) !==
        receipt.plan.oracle.outcomeRelativePath
      ) {
        issues.push("oracle outcome path is not canonical");
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
    if (receipt.planHash !== sha256Json(planWithoutHash(receipt.plan))) {
      issues.push("planHash does not match canonical predeclared plan");
    }
    if (
      receipt.plan.planHash !== receipt.planHash ||
      receipt.plan.outputRoot !== receipt.outputRoot ||
      receipt.plan.batchId !== receipt.batchId ||
      receipt.plan.cornerId !== receipt.cornerId ||
      receipt.plan.evidenceClass !== receipt.evidenceClass
    ) {
      issues.push("receipt identity does not exactly match its embedded plan");
    }
    if (receipt.planPath !== "predeclared-plan.json") {
      issues.push("receipt planPath must be predeclared-plan.json");
    }
    const planPath = resolve(receipt.outputRoot, receipt.planPath);
    if (!isWithin(receipt.outputRoot, planPath)) issues.push("planPath escapes outputRoot");
    try {
      const bytes = readFileSync(planPath);
      if (sha256(bytes) !== receipt.planFileSha256) issues.push("predeclared plan raw bytes changed");
      const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
      if (!sameJson(parsed, receipt.plan)) issues.push("predeclared plan file does not match receipt plan");
    } catch {
      issues.push("predeclared plan file is missing, unreadable, or invalid JSON");
    }
    try {
      assertPlanFileIdentities(receipt.plan);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
    const currentSource = sourceVerification(receipt.cornerId, receipt.plan.source, services);
    if (!verificationValid(currentSource.verification)) issues.push("current source verification failed");
    if (
      receipt.plan.source.mode === "pinned-upstream" &&
      currentSource.clean !== true
    ) {
      issues.push("current pinned upstream checkout is not clean");
    }
    if (!sameJson(currentSource.verification, receipt.sourceVerification.after)) {
      issues.push("current source verification differs from post-run verification");
    }
    if (
      !verificationValid(receipt.sourceVerification.before) ||
      !verificationValid(receipt.sourceVerification.after)
    ) {
      issues.push("receipt source verification was not valid before and after execution");
    }
    if (!sameJson(receipt.sourceVerification.before, receipt.sourceVerification.after)) {
      issues.push("source verification changed between pre-run and post-run checks");
    }
    if (
      receipt.plan.source.mode === "pinned-upstream" &&
      (receipt.sourceVerification.cleanBefore !== true ||
        receipt.sourceVerification.cleanAfter !== true)
    ) {
      issues.push("receipt did not prove a clean pinned checkout before and after execution");
    }
    const receiptTrials = new Map(receipt.trials.map((trial) => [trial.trialId, trial] as const));
    if (receiptTrials.size !== receipt.plan.trials.length || receipt.trials.length !== receipt.plan.trials.length) {
      issues.push("receipt trials do not exactly match the predeclared plan");
    }
    for (const plannedTrial of receipt.plan.trials) {
      const actualTrial = receiptTrials.get(plannedTrial.trialId);
      if (!actualTrial) {
        issues.push(`missing receipt trial ${plannedTrial.trialId}`);
        continue;
      }
      assertExactKeys(actualTrial as unknown as JsonRecord, [
        "armOrder",
        "attempts",
        "matchingProof",
        "seed",
        "taskId",
        "trialId",
      ], `${plannedTrial.trialId}.receipt`);
      assertExactKeys(actualTrial.matchingProof as unknown as JsonRecord, [
        "proofHash",
        "sharedConfigIdentitySha256",
        "sharedModelIdentitySha256",
        "sharedRunnerIdentitySha256",
        "treatmentIdentitySha256",
      ], `${plannedTrial.trialId}.matchingProof`);
      const expectedOrder = armOrder(receipt.plan.randomizationSeed, plannedTrial);
      if (!envelope.manifest.tasks.some(({ taskId }) => taskId === plannedTrial.taskId)) {
        issues.push(`${plannedTrial.trialId}: taskId is not pinned by the corner manifest`);
      }
      if (!sameJson(expectedOrder, plannedTrial.armOrder) || !sameJson(expectedOrder, actualTrial.armOrder)) {
        issues.push(`${plannedTrial.trialId}: deterministic arm order mismatch`);
      }
      if (
        actualTrial.taskId !== plannedTrial.taskId ||
        actualTrial.seed !== plannedTrial.seed
      ) {
        issues.push(`${plannedTrial.trialId}: task/seed identity mismatch`);
      }
      if (actualTrial.attempts.length !== ARMS.length) {
        issues.push(`${plannedTrial.trialId}: receipt must contain exactly three attempts`);
      }
      const plannedArms = new Map(plannedTrial.arms.map((arm) => [arm.arm, arm] as const));
      if (
        plannedTrial.arms.length !== ARMS.length ||
        plannedArms.size !== ARMS.length ||
        ARMS.some((arm) => !plannedArms.has(arm))
      ) {
        issues.push(`${plannedTrial.trialId}: plan must contain exactly the three named arms`);
      }
      const seenAttemptArms = new Set<BehavioralArm>();
      for (const [index, attempt] of actualTrial.attempts.entries()) {
        assertExactKeys(attempt as unknown as JsonRecord, [
          "arm",
          "command",
          "oracle",
          "order",
          "outputRelativePath",
          "rawArtifacts",
          "sharedConfigIdentitySha256",
          "sharedModelIdentitySha256",
          "treatment",
        ], `${plannedTrial.trialId}.attempts[${index}]`);
        assertExactKeys(attempt.treatment as unknown as JsonRecord, [
          "fileSha256",
          "identitySha256",
          "path",
        ], `${plannedTrial.trialId}.attempts[${index}].treatment`);
        const expectedArm = expectedOrder[index];
        const plannedArm = plannedArms.get(attempt.arm);
        seenAttemptArms.add(attempt.arm);
        const expectedOutputRelativePath = `${plannedTrial.trialId}/${String(index + 1).padStart(2, "0")}-${attempt.arm}`;
        const expectedOutcomePath = `${expectedOutputRelativePath}/${receipt.plan.oracle.outcomeRelativePath}`;
        const expectedTreatmentPath = `${expectedOutputRelativePath}/treatment.json`;
        const expectedScoringInputPath = `${expectedOutputRelativePath}/oracle-input.json`;
        if (
          expectedArm !== attempt.arm ||
          attempt.order !== index + 1 ||
          !plannedArm ||
          attempt.command.commandIdentitySha256 !== plannedTrial.runner.identitySha256 ||
          attempt.sharedConfigIdentitySha256 !== plannedTrial.config.identitySha256 ||
          attempt.sharedModelIdentitySha256 !== plannedTrial.model.identitySha256 ||
          attempt.treatment.identitySha256 !== plannedArm.treatment.identitySha256 ||
          attempt.treatment.path !== expectedTreatmentPath ||
          attempt.oracle.commandIdentitySha256 !== receipt.plan.oracle.command.identitySha256 ||
          attempt.oracle.owner !== receipt.plan.oracle.owner ||
          attempt.oracle.sourceId !== receipt.plan.oracle.sourceId ||
          attempt.oracle.outcomeImportedWithoutInterpretation !== true ||
          attempt.outputRelativePath !== expectedOutputRelativePath ||
          attempt.command.stdoutPath !== `${expectedOutputRelativePath}/agent.stdout.log` ||
          attempt.command.stderrPath !== `${expectedOutputRelativePath}/agent.stderr.log` ||
          attempt.oracle.stdoutPath !== `${expectedOutputRelativePath}/oracle.stdout.log` ||
          attempt.oracle.stderrPath !== `${expectedOutputRelativePath}/oracle.stderr.log` ||
          attempt.oracle.scoringInputPath !== expectedScoringInputPath ||
          attempt.oracle.neutralView !== "ephemeral-arm-blind" ||
          attempt.oracle.outcomePath !== expectedOutcomePath ||
          attempt.oracle.outcomeMediaType !== "application/json" ||
          attempt.command.exitCode !== 0 ||
          attempt.oracle.exitCode !== 0
        ) {
          issues.push(`${plannedTrial.trialId}: attempt ${index + 1} does not match its plan`);
        }
        if (plannedArm) {
          try {
            const rawTreatment = JSON.parse(
              readFileSync(resolve(receipt.outputRoot, attempt.treatment.path), "utf8"),
            ) as unknown;
            const { identitySha256: _identity, ...expectedTreatment } = plannedArm.treatment;
            if (!sameJson(rawTreatment, expectedTreatment)) {
              issues.push(`${plannedTrial.trialId}/${attempt.arm}: treatment file differs from plan`);
            }
          } catch {
            issues.push(`${plannedTrial.trialId}/${attempt.arm}: treatment file is unreadable`);
          }
        }
        reopenedArtifactCount += reopenInventory(attempt, receipt.outputRoot, issues);
      }
      if (seenAttemptArms.size !== ARMS.length || ARMS.some((arm) => !seenAttemptArms.has(arm))) {
        issues.push(`${plannedTrial.trialId}: receipt attempts are not an exact arm triplet`);
      }
      try {
        const recomputedProof = matchingProof(plannedTrial, actualTrial.attempts);
        if (!sameJson(recomputedProof, actualTrial.matchingProof)) {
          issues.push(`${plannedTrial.trialId}: matching proof does not recompute`);
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
    const receiptPath = resolve(receipt.outputRoot, `pm-behavioral-batch-${receiptHash}.json`);
    try {
      const persisted = JSON.parse(readFileSync(receiptPath, "utf8")) as unknown;
      if (!sameJson(persisted, receipt)) issues.push("persisted receipt bytes describe a different receipt");
    } catch {
      issues.push("persisted content-addressed receipt is missing or invalid");
    }
    const allowedTop = new Set([
      "predeclared-plan.json",
      `pm-behavioral-batch-${receiptHash}.json`,
      ...receipt.plan.trials.map(({ trialId }) => trialId),
    ]);
    try {
      for (const entry of readdirSync(receipt.outputRoot)) {
        if (!allowedTop.has(entry)) issues.push(`unexpected top-level output artifact ${entry}`);
      }
    } catch {
      issues.push("outputRoot is missing or unreadable");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return deepFreeze({
    schemaVersion: "pm.public-eval-corners.behavioral-batch-verification.v1",
    valid: issues.length === 0,
    evidenceClass,
    eligibleForIndependentAnalysis: false,
    receiptHash,
    reopenedArtifactCount,
    issues,
  });
}
