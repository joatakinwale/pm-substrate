import { execFileSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign as signBytes,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { publicEvalCorners } from "./index.js";
import {
  SENTINEL_MATERIAL_LIFT_RULE,
  sentinelJsonSha256,
  sentinelLiveOwnerObjective,
  sentinelLiveRequiredTasks,
  sentinelSha256,
  verifySentinelPreregistration,
  type SentinelLiveArm,
  type SentinelLiveCell,
  type SentinelLivePreregistration,
  type SentinelPreregistrationSignature,
} from "./sentinel-live-plan.js";
import {
  superviseSentinelAttempt,
  type SentinelAttemptSupervisorInput,
  type SentinelAttemptTerminalReceipt,
  type SentinelExecutableIdentity,
} from "./sentinel-attempt-supervisor.js";
import {
  startSentinelStateSidecar,
  type RunningSentinelStateSidecar,
  type SentinelStateFinalReceipt,
  type StartSentinelStateSidecarInput,
} from "./sentinel-state-sidecar.js";
import {
  startSentinelAnthropicProviderProxy,
  type SentinelAnthropicProviderProxy as RunningSentinelAnthropicProviderProxy,
  type SentinelAnthropicProviderProxyFinalReceipt as SentinelAnthropicProviderFinalReceipt,
  type StartSentinelAnthropicProviderProxyInput,
} from "./sentinel-anthropic-provider-proxy.js";

const SENTINEL_MANIFEST_SHA256 =
  "9da3305715740840299a1acc8b47bacf9a706eb293ad0cde3aee5d7e3adf1989";
const EXPECTED_SENTINEL_REVISION = "0faca33cc58ea62e97a928b67cd3beec7176b408";
const LOOPBACK_HOST = "127.0.0.1";
const SIDE_CAR_MINIMUM_LATENCY_MS = 25;
const MAX_ARTIFACTS_PER_CELL = 100_000;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface SentinelLiveRuntimePaths {
  readonly repositoryRoot: string;
  readonly packageLockPath: string;
  readonly runnerScriptPath: string;
  readonly supervisorScriptPath: string;
  readonly verifierScriptPath: string;
  readonly agentScriptPath: string;
  readonly sidecarScriptPath: string;
  readonly providerProxyScriptPath: string;
  readonly playwrightPackageJsonPath: string;
  readonly nodeExecutablePath: string;
  readonly pythonExecutablePath: string;
  readonly frontendExecutablePath: string;
}

export type SentinelRuntimeArtifactRole =
  | "package-lock"
  | "runner-script"
  | "supervisor-script"
  | "verifier-script"
  | "agent-script"
  | "state-sidecar-script"
  | "provider-proxy-script"
  | "playwright-package"
  | "node-executable"
  | "python-executable"
  | "frontend-executable";

export interface SentinelLiveRuntimeArtifact extends SentinelExecutableIdentity {
  readonly role: SentinelRuntimeArtifactRole;
  readonly byteLength: number;
}

export interface SentinelLiveRuntimeSnapshot {
  readonly substrateRevision: string;
  readonly sourceTreeHash: string;
  readonly workingTreeClean: boolean;
  readonly runtimeClosureSha256: string;
  readonly packageLockSha256: string;
  readonly runnerScriptSha256: string;
  readonly supervisorScriptSha256: string;
  readonly verifierScriptSha256: string;
  readonly agentScriptSha256: string;
  readonly sidecarScriptSha256: string;
  readonly providerProxyScriptSha256: string;
  readonly nodeVersion: string;
  readonly pythonVersion: string;
  readonly playwrightVersion: string;
  readonly artifacts: readonly SentinelLiveRuntimeArtifact[];
  readonly pythonExecutable: SentinelExecutableIdentity;
  readonly frontendExecutable: SentinelExecutableIdentity;
}

export interface SentinelLiveSourceVerification {
  readonly valid: boolean;
  readonly manifestSha256: string;
  readonly revision: string | null;
  readonly checkoutClean: boolean;
  readonly issues: readonly string[];
}

export interface SentinelLivePreregistrationInput {
  readonly registrationId: string;
  readonly registeredAt?: string;
  readonly randomizationSeed: string;
  readonly pricingAccessedAt: string;
  readonly checkoutPath: string;
  readonly runtimePaths: SentinelLiveRuntimePaths;
  readonly pollIntervalMs?: number;
  readonly maxCompletionTokens?: number;
}

export interface SignedSentinelLivePreregistration {
  readonly preregistration: SentinelLivePreregistration;
  readonly signature: SentinelPreregistrationSignature;
  /** This is the value that must be anchored outside the produced artifact tree. */
  readonly expectedPreregistrationSha256: string;
}

export interface SentinelLivePostRunVerificationInput {
  readonly batchRoot: string;
  readonly executionManifestPath: string;
  readonly executionManifestSha256: string;
  readonly preregistration: SentinelLivePreregistration;
  readonly signature: SentinelPreregistrationSignature;
  readonly expectedPreregistrationSha256: string;
  readonly cellManifestPaths: readonly string[];
}

export interface SentinelLivePostRunVerificationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly [key: string]: JsonValue;
}

export interface SentinelLiveRunInput extends SignedSentinelLivePreregistration {
  readonly checkoutPath: string;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly runtimePaths: SentinelLiveRuntimePaths;
  /** This credential is passed only to the in-process Anthropic proxy factory. */
  readonly anthropicApiKey: string;
  readonly startupTimeoutMs?: number;
  readonly attemptTimeoutMs?: number;
  readonly shutdownGraceMs?: number;
  readonly postRunVerify?: (
    input: SentinelLivePostRunVerificationInput,
  ) => Promise<SentinelLivePostRunVerificationResult>;
}

export interface SentinelLiveCellArtifact {
  readonly sequence: number;
  readonly cellId: string;
  readonly taskId: SentinelLiveCell["taskId"];
  readonly arm: SentinelLiveArm;
  readonly repeatId: string;
  readonly attemptId: string;
  readonly cellRoot: string;
  readonly cellManifestPath: string;
  readonly cellManifestSha256: string;
}

export interface SentinelLiveBatchResult {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-live-batch-result.v1";
  readonly evidenceEligible: false;
  readonly publicEfficacyEligible: false;
  readonly qualificationOnly: true;
  readonly batchRoot: string;
  readonly preregistrationSha256: string;
  readonly executionManifestPath: string;
  readonly executionManifestSha256: string;
  readonly finalManifestPath: string;
  readonly finalManifestSha256: string;
  readonly cells: readonly SentinelLiveCellArtifact[];
}

export interface SentinelLiveRunnerDependencies {
  readonly inspectRuntime: (paths: SentinelLiveRuntimePaths) => SentinelLiveRuntimeSnapshot;
  readonly verifySource: (checkoutPath: string) => SentinelLiveSourceVerification;
  readonly allocatePorts: (
    count: number,
    excluded: ReadonlySet<number>,
  ) => Promise<readonly number[]>;
  readonly opaqueAttemptId: () => string;
  readonly opaqueToken: () => string;
  readonly now: () => string;
  readonly retainScenarioDefinition: (
    checkoutPath: string,
    inputRoot: string,
    taskId: SentinelLiveCell["taskId"],
  ) => void;
  readonly startStateSidecar: (
    input: StartSentinelStateSidecarInput,
  ) => Promise<RunningSentinelStateSidecar>;
  readonly startProviderProxy: (
    input: StartSentinelAnthropicProviderProxyInput,
  ) => Promise<RunningSentinelAnthropicProviderProxy>;
  readonly superviseAttempt: (
    input: SentinelAttemptSupervisorInput,
  ) => Promise<SentinelAttemptTerminalReceipt>;
}

interface ArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(",")}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key] as JsonValue)}`)
    .join(",")}}`;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactRegularFile(path: string, role: SentinelRuntimeArtifactRole): SentinelLiveRuntimeArtifact {
  const requestedPath = resolve(path);
  const actualPath = realpathSync(requestedPath);
  const stat = statSync(actualPath);
  if (!stat.isFile()) throw new Error(`${role} must resolve to a regular file`);
  const bytes = readFileSync(actualPath);
  // Preserve executable symlink paths (notably a Python virtual environment's
  // bin/python). Invoking the realpath can bypass the virtual environment even
  // though the retained bytes are identical. The target bytes still define the
  // content identity recorded in the runtime closure.
  return { role, path: requestedPath, byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

function command(repositoryRoot: string, executable: string, args: readonly string[]): string {
  return execFileSync(executable, [...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}

function relativeRuntimePath(repositoryRoot: string, artifactPath: string): string {
  const candidate = relative(repositoryRoot, artifactPath);
  return candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate)
    ? candidate
    : artifactPath;
}

export function inspectSentinelLiveRuntime(
  input: SentinelLiveRuntimePaths,
): SentinelLiveRuntimeSnapshot {
  const repositoryRoot = realpathSync(resolve(input.repositoryRoot));
  if (!statSync(repositoryRoot).isDirectory()) throw new Error("repositoryRoot must be a directory");
  const roles: readonly [SentinelRuntimeArtifactRole, string][] = [
    ["package-lock", input.packageLockPath],
    ["runner-script", input.runnerScriptPath],
    ["supervisor-script", input.supervisorScriptPath],
    ["verifier-script", input.verifierScriptPath],
    ["agent-script", input.agentScriptPath],
    ["state-sidecar-script", input.sidecarScriptPath],
    ["provider-proxy-script", input.providerProxyScriptPath],
    ["playwright-package", input.playwrightPackageJsonPath],
    ["node-executable", input.nodeExecutablePath],
    ["python-executable", input.pythonExecutablePath],
    ["frontend-executable", input.frontendExecutablePath],
  ];
  const artifacts = roles.map(([role, path]) => exactRegularFile(path, role));
  const byRole = new Map(artifacts.map((artifact) => [artifact.role, artifact] as const));
  const required = (role: SentinelRuntimeArtifactRole): SentinelLiveRuntimeArtifact => {
    const artifact = byRole.get(role);
    if (!artifact) throw new Error(`runtime closure lacks ${role}`);
    return artifact;
  };
  const playwrightPackage = JSON.parse(
    readFileSync(required("playwright-package").path, "utf8"),
  ) as { readonly version?: unknown };
  if (typeof playwrightPackage.version !== "string") {
    throw new Error("Playwright package metadata lacks a version");
  }
  const substrateRevision = command(repositoryRoot, "git", ["rev-parse", "HEAD"]);
  const sourceTreeHash = command(repositoryRoot, "git", ["rev-parse", "HEAD^{tree}"]);
  const workingTreeClean =
    command(repositoryRoot, "git", ["status", "--porcelain=v1", "--untracked-files=all"]) === "";
  const nodeVersion = command(repositoryRoot, required("node-executable").path, ["--version"]);
  let pythonVersion: string;
  try {
    pythonVersion = command(repositoryRoot, required("python-executable").path, ["--version"]);
  } catch {
    pythonVersion = execFileSync(required("python-executable").path, ["--version"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }
  const closure = artifacts
    .map(({ role, path, byteLength, sha256: hash }) => ({
      role,
      path: relativeRuntimePath(repositoryRoot, path),
      byteLength,
      sha256: hash,
    }))
    .sort((left, right) => compareCodeUnits(left.role, right.role));
  return {
    substrateRevision,
    sourceTreeHash,
    workingTreeClean,
    runtimeClosureSha256: sentinelJsonSha256(closure),
    packageLockSha256: required("package-lock").sha256,
    runnerScriptSha256: required("runner-script").sha256,
    supervisorScriptSha256: required("supervisor-script").sha256,
    verifierScriptSha256: required("verifier-script").sha256,
    agentScriptSha256: required("agent-script").sha256,
    sidecarScriptSha256: required("state-sidecar-script").sha256,
    providerProxyScriptSha256: required("provider-proxy-script").sha256,
    nodeVersion,
    pythonVersion,
    playwrightVersion: playwrightPackage.version,
    artifacts,
    pythonExecutable: {
      path: required("python-executable").path,
      sha256: required("python-executable").sha256,
    },
    frontendExecutable: {
      path: required("frontend-executable").path,
      sha256: required("frontend-executable").sha256,
    },
  };
}

export function verifySentinelLiveSource(checkoutPath: string): SentinelLiveSourceVerification {
  const resolvedCheckout = realpathSync(resolve(checkoutPath));
  const source = publicEvalCorners.verifyPinnedSource({
    cornerId: "sentinel-microhub-stars",
    checkoutPath: resolvedCheckout,
  });
  let checkoutClean = false;
  let statusIssue: string | null = null;
  try {
    checkoutClean =
      command(resolvedCheckout, "git", ["status", "--porcelain=v1", "--untracked-files=all"]) === "";
  } catch (error) {
    statusIssue = error instanceof Error ? error.message : String(error);
  }
  const issues = [
    ...source.issues,
    ...(source.manifestSha256 === SENTINEL_MANIFEST_SHA256
      ? []
      : ["public source manifest hash changed"]),
    ...(checkoutClean ? [] : [statusIssue ?? "public benchmark checkout is not clean"]),
  ];
  return {
    valid: source.valid && source.manifestSha256 === SENTINEL_MANIFEST_SHA256 && checkoutClean,
    manifestSha256: source.manifestSha256,
    revision: source.repository.actualRevision,
    checkoutClean,
    issues,
  };
}

function runtimeIssues(
  preregistration: SentinelLivePreregistration,
  runtime: SentinelLiveRuntimeSnapshot,
): readonly string[] {
  const comparisons: readonly [string, unknown, unknown][] = [
    ["substrate revision", runtime.substrateRevision, preregistration.implementation.substrateRevision],
    ["source tree", runtime.sourceTreeHash, preregistration.implementation.sourceTreeHash],
    ["clean working tree", runtime.workingTreeClean, true],
    ["runtime closure", runtime.runtimeClosureSha256, preregistration.implementation.runtimeClosureSha256],
    ["runner script", runtime.runnerScriptSha256, preregistration.implementation.runnerScriptSha256],
    ["supervisor script", runtime.supervisorScriptSha256, preregistration.implementation.supervisorScriptSha256],
    ["verifier script", runtime.verifierScriptSha256, preregistration.implementation.verifierScriptSha256],
    ["package lock", runtime.packageLockSha256, preregistration.implementation.packageLockSha256],
    ["Node version", runtime.nodeVersion, preregistration.implementation.nodeVersion],
    ["Python version", runtime.pythonVersion, preregistration.implementation.pythonVersion],
    ["Playwright version", runtime.playwrightVersion, preregistration.implementation.playwrightVersion],
    ["agent script", runtime.agentScriptSha256, preregistration.agent.scriptSha256],
    ["state sidecar script", runtime.sidecarScriptSha256, preregistration.treatment.sidecarScriptSha256],
    ["provider proxy script", runtime.providerProxyScriptSha256, preregistration.evidence.providerProxyScriptSha256],
  ];
  return comparisons.flatMap(([label, actual, expected]) =>
    actual === expected ? [] : [`${label} does not match the signed preregistration`],
  );
}

export function verifySentinelLiveRunInputs(
  input: Pick<
    SentinelLiveRunInput,
    "preregistration" | "signature" | "expectedPreregistrationSha256" | "checkoutPath" | "runtimePaths"
  >,
  dependencies: Pick<SentinelLiveRunnerDependencies, "inspectRuntime" | "verifySource"> = {
    inspectRuntime: inspectSentinelLiveRuntime,
    verifySource: verifySentinelLiveSource,
  },
): {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly cells: readonly SentinelLiveCell[];
  readonly preregistrationSha256: string;
  readonly runtime: SentinelLiveRuntimeSnapshot;
  readonly source: SentinelLiveSourceVerification;
} {
  const plan = verifySentinelPreregistration(
    input.preregistration,
    input.signature,
    input.expectedPreregistrationSha256,
  );
  const runtime = dependencies.inspectRuntime(input.runtimePaths);
  const source = dependencies.verifySource(input.checkoutPath);
  const issues = [
    ...plan.issues,
    ...runtimeIssues(input.preregistration, runtime),
    ...(source.valid ? [] : source.issues),
    ...(source.manifestSha256 === input.preregistration.benchmark.manifestSha256
      ? []
      : ["verified source manifest does not match preregistration"]),
    ...(source.revision === input.preregistration.benchmark.revision
      ? []
      : ["verified source revision does not match preregistration"]),
  ];
  return {
    valid: issues.length === 0,
    issues,
    cells: plan.cells,
    preregistrationSha256: plan.preregistrationSha256,
    runtime,
    source,
  };
}

export function signSentinelLivePreregistration(
  preregistration: SentinelLivePreregistration,
): SentinelPreregistrationSignature {
  const preregistrationSha256 = sentinelJsonSha256(preregistration);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const signatureBase64 = signBytes(
    null,
    Buffer.from(preregistrationSha256, "hex"),
    privateKey,
  ).toString("base64");
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-preregistration-signature.v1",
    preregistrationSha256,
    algorithm: "Ed25519",
    publicKeyPem,
    publicKeySha256: sentinelSha256(publicKeyPem),
    signatureBase64,
  };
}

export function createSignedSentinelLivePreregistration(
  input: SentinelLivePreregistrationInput,
  dependencies: Pick<SentinelLiveRunnerDependencies, "inspectRuntime" | "verifySource" | "now"> = {
    inspectRuntime: inspectSentinelLiveRuntime,
    verifySource: verifySentinelLiveSource,
    now: () => new Date().toISOString(),
  },
): SignedSentinelLivePreregistration {
  const runtime = dependencies.inspectRuntime(input.runtimePaths);
  if (!runtime.workingTreeClean) throw new Error("cannot preregister a dirty substrate working tree");
  if (runtime.playwrightVersion !== "1.56.1") throw new Error("Playwright runtime is not the pinned 1.56.1");
  const source = dependencies.verifySource(input.checkoutPath);
  if (!source.valid || source.manifestSha256 !== SENTINEL_MANIFEST_SHA256) {
    throw new Error(`cannot preregister an invalid public source: ${source.issues.join("; ")}`);
  }
  if (source.revision !== EXPECTED_SENTINEL_REVISION) {
    throw new Error("cannot preregister a non-pinned Sentinel revision");
  }
  const taskOrder = [
    "microhub-stars-relative-passive",
    "microhub-stars-noop",
    "microhub-stars-absolute-passive",
  ] as const;
  const preregistration: SentinelLivePreregistration = {
    schemaVersion: "pm.public-eval-corners.sentinel-preregistration.v1",
    registrationId: input.registrationId,
    registeredAt: input.registeredAt ?? dependencies.now(),
    objective: sentinelLiveOwnerObjective,
    implementation: {
      substrateRevision: runtime.substrateRevision,
      sourceTreeHash: runtime.sourceTreeHash,
      workingTreeClean: true,
      runtimeClosureSha256: runtime.runtimeClosureSha256,
      runnerScriptSha256: runtime.runnerScriptSha256,
      supervisorScriptSha256: runtime.supervisorScriptSha256,
      verifierScriptSha256: runtime.verifierScriptSha256,
      packageLockSha256: runtime.packageLockSha256,
      nodeVersion: runtime.nodeVersion,
      pythonVersion: runtime.pythonVersion,
      playwrightVersion: "1.56.1",
    },
    benchmark: {
      repositoryUrl: "https://github.com/microsoft/sentinel_environments",
      revision: EXPECTED_SENTINEL_REVISION,
      manifestSha256: SENTINEL_MANIFEST_SHA256,
      speedFactor: 1,
      publishedDefaultSpeedFactor: 1,
      qualificationOnly: true,
    },
    tasks: taskOrder.map((taskId) => ({ taskId, ...sentinelLiveRequiredTasks[taskId] })),
    arms: ["native", "sham", "substrate"],
    repeatIds: ["replicate-01", "replicate-02", "replicate-03"],
    randomizationSeed: input.randomizationSeed,
    model: {
      provider: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
      maxCompletionTokens: input.maxCompletionTokens ?? 256,
      automaticRetries: 0,
      pricing: {
        sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
        accessedAt: input.pricingAccessedAt,
        baseInputUsdPerMillionTokens: 3,
        outputUsdPerMillionTokens: 15,
        promptCachingEnabled: false,
      },
    },
    agent: {
      statelessAcrossPolls: true,
      pollIntervalMs: input.pollIntervalMs ?? 30_000,
      viewport: { width: 1280, height: 720 },
      screenshotMediaType: "image/png",
      scriptSha256: runtime.agentScriptSha256,
    },
    treatment: {
      agentReceivesArmIdentity: false,
      interfaceShapeIdentical: true,
      fixedWidthStateContext: true,
      nativePersistence: "discard",
      shamPersistence: "persist-write-return-irrelevant",
      substratePersistence: "admit-first-browser-observation",
      sidecarScriptSha256: runtime.sidecarScriptSha256,
    },
    evidence: {
      providerProxyScriptSha256: runtime.providerProxyScriptSha256,
      exactUpstreamTaskInvocation: true,
      retainEveryProviderExchange: true,
      retainEveryTerminalFailure: true,
      noReruns: true,
      executeEveryDeclaredCell: true,
      rawOutcomesRemainUninterpretedDuringExecution: true,
    },
    analysis: {
      primaryOutcome: "unchanged-upstream-success",
      headlineContrast: "substrate-vs-native-and-sham-on-relative",
      requiredCleanControls: ["microhub-stars-noop", "microhub-stars-absolute-passive"],
      noTaskOrRepeatShopping: true,
      reportAllCellsIncludingFailures: true,
      minimumMaterialLift: SENTINEL_MATERIAL_LIFT_RULE,
    },
    stoppingRule: {
      retriesPerCell: 0,
      stopAfterDeclaredUniverse: true,
      infrastructureFailureDisposition: "retain-and-mark-incomplete",
      behavioralFailureDisposition: "retain-and-include",
    },
    eligibility: {
      independentAuthorityRequired: true,
      localProducerMayNotSelfPromote: true,
      publicEfficacyEligibleBeforeExternalVerification: false,
    },
  };
  const signature = signSentinelLivePreregistration(preregistration);
  const expectedPreregistrationSha256 = sentinelJsonSha256(preregistration);
  const verified = verifySentinelPreregistration(
    preregistration,
    signature,
    expectedPreregistrationSha256,
  );
  if (!verified.valid) throw new Error(`constructed preregistration is invalid: ${verified.issues.join("; ")}`);
  return { preregistration, signature, expectedPreregistrationSha256 };
}

function assertFreshDisjointRoots(checkoutPath: string, batchRoot: string, registryRoot: string): void {
  const checkout = realpathSync(resolve(checkoutPath));
  const batch = resolve(batchRoot);
  const registry = resolve(registryRoot);
  const within = (parent: string, candidate: string): boolean => {
    const path = relative(parent, candidate);
    return path === "" || (!path.startsWith("..") && !isAbsolute(path));
  };
  if ([batch, registry].some((root) => within(checkout, root) || within(root, checkout))) {
    throw new Error("checkout and evidence roots must be disjoint");
  }
  if (within(batch, registry) || within(registry, batch)) {
    throw new Error("batch and attempt registry roots must be disjoint");
  }
  if (existsSync(batch)) throw new Error("batchRoot must be fresh");
  if (existsSync(registry)) throw new Error("attemptRegistryRoot must be fresh");
  mkdirSync(batch, { recursive: false, mode: 0o700 });
  mkdirSync(registry, { recursive: false, mode: 0o700 });
  mkdirSync(resolve(batch, "cells"), { mode: 0o700 });
  mkdirSync(resolve(batch, "manifests"), { mode: 0o700 });
  mkdirSync(resolve(batch, "manifests", "cells"), { mode: 0o700 });
}

function writeContentAddressedJson(
  directory: string,
  prefix: string,
  value: { readonly [key: string]: JsonValue },
): { readonly path: string; readonly sha256: string } {
  const hash = sentinelJsonSha256(value);
  const path = resolve(directory, `${prefix}-${hash}.json`);
  writeFileSync(path, `${JSON.stringify({ ...value, manifestSha256: hash }, null, 2)}\n`, {
    flag: "wx",
    mode: 0o400,
  });
  chmodSync(path, 0o400);
  return { path, sha256: hash };
}

function writeExclusiveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
}

function inventory(root: string, current = root): readonly ArtifactIdentity[] {
  if (!existsSync(current)) return [];
  const artifacts: ArtifactIdentity[] = [];
  for (const name of readdirSync(current).sort(compareCodeUnits)) {
    const path = resolve(current, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("live evidence tree may not contain symbolic links");
    if (stat.isDirectory()) artifacts.push(...inventory(root, path));
    else if (stat.isFile()) {
      const bytes = readFileSync(path);
      artifacts.push({ path: relative(root, path), byteLength: bytes.byteLength, sha256: sha256(bytes) });
    } else throw new Error("live evidence tree contains a non-file artifact");
    if (artifacts.length > MAX_ARTIFACTS_PER_CELL) throw new Error("cell artifact ceiling exceeded");
  }
  return artifacts.sort((left, right) => compareCodeUnits(left.path, right.path));
}

function sealTree(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("cannot seal a symbolic link");
    if (stat.isDirectory()) sealTree(path);
    else if (stat.isFile()) chmodSync(path, 0o400);
    else throw new Error("cannot seal a non-file artifact");
  }
  chmodSync(root, 0o500);
}

function safeMessage(error: unknown, secrets: readonly string[]): string {
  let value = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret.length > 0) value = value.split(secret).join("[REDACTED]");
  }
  return value.slice(0, 4_096);
}

function portFromOrigin(origin: string): number {
  const url = new URL(origin);
  if (url.protocol !== "http:" || url.hostname !== LOOPBACK_HOST || url.port === "") {
    throw new Error("service did not bind an explicit loopback port");
  }
  return Number(url.port);
}

async function defaultAllocatePorts(
  count: number,
  excluded: ReadonlySet<number>,
): Promise<readonly number[]> {
  const servers: ReturnType<typeof createServer>[] = [];
  const ports: number[] = [];
  try {
    while (ports.length < count) {
      const server = createServer();
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(0, LOOPBACK_HOST, () => resolvePromise());
      });
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        throw new Error("failed to reserve a loopback port");
      }
      if (excluded.has(address.port) || ports.includes(address.port)) {
        await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
        continue;
      }
      servers.push(server);
      ports.push(address.port);
    }
  } finally {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))),
    );
  }
  return ports;
}

function createAgentConfig(
  path: string,
  runtime: SentinelLiveRuntimeSnapshot,
  preregistration: SentinelLivePreregistration,
  serverPort: number,
  frontendPort: number,
): SentinelExecutableIdentity {
  const agent = runtime.artifacts.find(({ role }) => role === "agent-script");
  const node = runtime.artifacts.find(({ role }) => role === "node-executable");
  if (!agent || !node) throw new Error("runtime closure lacks the compiled agent or Node executable");
  const value = {
    agent_subprocess: [
      node.path,
      agent.path,
      "--url",
      "__TASK_URL__",
      "--prompt",
      "__TASK_PROMPT__",
    ],
    server_url: `http://${LOOPBACK_HOST}:${serverPort}`,
    frontend_url: `http://${LOOPBACK_HOST}:${frontendPort}`,
    speed_factor: preregistration.benchmark.speedFactor,
  };
  writeExclusiveJson(path, value);
  return { path, sha256: sha256(readFileSync(path)) };
}

function retainPinnedScenarioDefinition(
  checkoutPath: string,
  inputRoot: string,
  taskId: SentinelLiveCell["taskId"],
): void {
  const sourcePath = resolve(checkoutPath, "scenarios", "microhub", `${taskId.replace(/^microhub-/u, "")}.json`);
  const sourceStat = lstatSync(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error("pinned Sentinel scenario must be a regular non-symlink file");
  }
  const bytes = readFileSync(sourcePath);
  const expected = sentinelLiveRequiredTasks[taskId].scenarioSha256;
  if (sha256(bytes) !== expected) throw new Error("pinned Sentinel scenario bytes changed");
  const targetPath = resolve(inputRoot, "scenario-definition.json");
  writeFileSync(targetPath, bytes, { flag: "wx", mode: 0o400 });
  chmodSync(targetPath, 0o400);
}

export function createSentinelLiveRunnerDependencies(): SentinelLiveRunnerDependencies {
  return {
    inspectRuntime: inspectSentinelLiveRuntime,
    verifySource: verifySentinelLiveSource,
    allocatePorts: defaultAllocatePorts,
    opaqueAttemptId: () => `slc-${randomBytes(20).toString("hex")}`,
    opaqueToken: () => randomBytes(32).toString("base64url"),
    now: () => new Date().toISOString(),
    retainScenarioDefinition: retainPinnedScenarioDefinition,
    startStateSidecar: startSentinelStateSidecar,
    startProviderProxy: startSentinelAnthropicProviderProxy,
    superviseAttempt: superviseSentinelAttempt,
  };
}

export async function runSentinelLiveBatch(
  input: SentinelLiveRunInput,
  dependencies: SentinelLiveRunnerDependencies = createSentinelLiveRunnerDependencies(),
): Promise<SentinelLiveBatchResult> {
  const verification = verifySentinelLiveRunInputs(input, dependencies);
  if (!verification.valid) {
    throw new Error(`live Sentinel preflight failed: ${verification.issues.join("; ")}`);
  }
  if (verification.cells.length !== 27) throw new Error("signed schedule must contain exactly 27 cells");
  if (typeof input.anthropicApiKey !== "string" || input.anthropicApiKey.length < 8) {
    throw new Error("ANTHROPIC_API_KEY is missing or invalid");
  }
  const batchRoot = resolve(input.batchRoot);
  const registryRoot = resolve(input.attemptRegistryRoot);
  assertFreshDisjointRoots(input.checkoutPath, batchRoot, registryRoot);

  const usedAttemptIds = new Set<string>();
  const usedPorts = new Set<number>();
  const cellArtifacts: SentinelLiveCellArtifact[] = [];
  const cellManifestPaths: string[] = [];
  for (const cell of verification.cells) {
    let attemptId = dependencies.opaqueAttemptId();
    while (usedAttemptIds.has(attemptId)) attemptId = dependencies.opaqueAttemptId();
    usedAttemptIds.add(attemptId);
    if (!/^slc-[a-f0-9]{40}$/u.test(attemptId)) {
      throw new Error("opaqueAttemptId must return slc- plus exactly 40 lowercase hex digits");
    }
    const cellRoot = resolve(batchRoot, "cells", attemptId);
    mkdirSync(cellRoot, { mode: 0o700 });
    const stateRoot = resolve(cellRoot, "state");
    const providerRoot = resolve(cellRoot, "provider");
    const inputRoot = resolve(cellRoot, "input");
    const upstreamRoot = resolve(cellRoot, "upstream");
    mkdirSync(stateRoot, { mode: 0o700 });
    mkdirSync(inputRoot, { mode: 0o700 });

    const runnerFailures: { readonly stage: string; readonly message: string }[] = [];
    let state: RunningSentinelStateSidecar | undefined;
    let provider: RunningSentinelAnthropicProviderProxy | undefined;
    let stateFinal: SentinelStateFinalReceipt | undefined;
    let providerFinal: SentinelAnthropicProviderFinalReceipt | undefined;
    let attemptReceiptHash: string | null = null;
    let ports: readonly number[] = [];
    const stateToken = dependencies.opaqueToken();
    const providerToken = dependencies.opaqueToken();
    try {
      ports = await dependencies.allocatePorts(4, usedPorts);
      if (ports.length !== 4 || new Set(ports).size !== 4) {
        throw new Error("port allocator did not return four unique ports");
      }
      for (const port of ports) {
        if (!Number.isSafeInteger(port) || port < 1 || port > 65_535 || usedPorts.has(port)) {
          throw new Error("port allocator returned an invalid or reused port");
        }
        usedPorts.add(port);
      }
      const [statePort, providerPort, serverPort, frontendPort] = ports as readonly [
        number,
        number,
        number,
        number,
      ];
      state = await dependencies.startStateSidecar({
        mode: cell.arm,
        outputDirectory: stateRoot,
        bearerToken: stateToken,
        tenant: `sentinel-live-${attemptId}`,
        port: statePort,
        minimumLatencyMs: SIDE_CAR_MINIMUM_LATENCY_MS,
      });
      provider = await dependencies.startProviderProxy({
        outputRoot: providerRoot,
        anthropicApiKey: input.anthropicApiKey,
        authorizationToken: providerToken,
        port: providerPort,
      });
      if (portFromOrigin(new URL(state.endpoint).origin) !== statePort) {
        throw new Error("state sidecar did not bind its assigned port");
      }
      if (portFromOrigin(provider.origin) !== providerPort) {
        throw new Error("provider proxy did not bind its assigned port");
      }
      dependencies.retainScenarioDefinition(input.checkoutPath, inputRoot, cell.taskId);
      const configPath = resolve(inputRoot, "agent-config.json");
      const agentConfig = createAgentConfig(
        configPath,
        verification.runtime,
        input.preregistration,
        serverPort,
        frontendPort,
      );
      const receipt = await dependencies.superviseAttempt({
        schemaVersion: "pm.public-eval-corners.sentinel-attempt-input.v1",
        attemptId,
        taskId: cell.taskId,
        checkoutPath: input.checkoutPath,
        outputRoot: upstreamRoot,
        attemptRegistryRoot: registryRoot,
        agentConfig,
        pythonExecutable: verification.runtime.pythonExecutable,
        frontendExecutable: verification.runtime.frontendExecutable,
        serverPort,
        frontendPort,
        opaqueEnvironment: {
          stateOrigin: new URL(state.endpoint).origin,
          stateToken,
          providerOrigin: provider.origin,
          providerToken: provider.authorizationToken,
        },
        pollIntervalMs: input.preregistration.agent.pollIntervalMs,
        viewportWidth: input.preregistration.agent.viewport.width,
        viewportHeight: input.preregistration.agent.viewport.height,
        ...(input.startupTimeoutMs === undefined ? {} : { startupTimeoutMs: input.startupTimeoutMs }),
        ...(input.attemptTimeoutMs === undefined ? {} : { attemptTimeoutMs: input.attemptTimeoutMs }),
        ...(input.shutdownGraceMs === undefined ? {} : { shutdownGraceMs: input.shutdownGraceMs }),
      });
      attemptReceiptHash = receipt.receiptHash;
    } catch (error) {
      runnerFailures.push({
        stage: "cell-execution",
        message: safeMessage(error, [input.anthropicApiKey, stateToken, providerToken]),
      });
    } finally {
      if (state !== undefined) {
        try {
          stateFinal = await state.stop();
        } catch (error) {
          runnerFailures.push({
            stage: "state-sidecar-close",
            message: safeMessage(error, [input.anthropicApiKey, stateToken, providerToken]),
          });
        }
      }
      if (provider !== undefined) {
        try {
          providerFinal = await provider.close();
        } catch (error) {
          runnerFailures.push({
            stage: "provider-proxy-close",
            message: safeMessage(error, [input.anthropicApiKey, stateToken, providerToken]),
          });
        }
      }
    }
    if (runnerFailures.length > 0) {
      writeContentAddressedJson(cellRoot, "runner-terminal-failure", {
        schemaVersion: "pm.public-eval-corners.sentinel-runner-cell-failure.v1",
        evidenceEligible: false,
        attemptId,
        failures: runnerFailures,
      });
    }
    const artifacts = inventory(cellRoot);
    const artifactRootSha256 = sentinelJsonSha256(artifacts);
    sealTree(cellRoot);
    const cellManifestBody = {
      schemaVersion: "pm.public-eval-corners.sentinel-live-cell-manifest.v1",
      evidenceEligible: false,
      publicEfficacyEligible: false,
      qualificationOnly: true,
      sequence: cell.sequence,
      cellId: cell.cellId,
      taskId: cell.taskId,
      taskRole: cell.taskRole,
      arm: cell.arm,
      repeatId: cell.repeatId,
      attemptId,
      cellRoot,
      ports,
      retryCount: 0,
      supervisorReturnedTerminalReceipt: attemptReceiptHash !== null,
      attemptReceiptHash,
      stateFinalReceiptHash: stateFinal?.receiptSha256 ?? null,
      providerFinalReceiptHash: providerFinal?.receiptHash ?? null,
      runnerFailureCount: runnerFailures.length,
      artifactRootSha256,
      artifacts,
    } as const;
    const cellManifest = writeContentAddressedJson(
      resolve(batchRoot, "manifests", "cells"),
      `cell-${String(cell.sequence).padStart(2, "0")}`,
      cellManifestBody as unknown as { readonly [key: string]: JsonValue },
    );
    cellManifestPaths.push(cellManifest.path);
    cellArtifacts.push({
      sequence: cell.sequence,
      cellId: cell.cellId,
      taskId: cell.taskId,
      arm: cell.arm,
      repeatId: cell.repeatId,
      attemptId,
      cellRoot,
      cellManifestPath: cellManifest.path,
      cellManifestSha256: cellManifest.sha256,
    });
  }

  const executionBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-live-execution-manifest.v1",
    evidenceEligible: false,
    publicEfficacyEligible: false,
    qualificationOnly: true,
    preregistrationSha256: verification.preregistrationSha256,
    signaturePublicKeySha256: input.signature.publicKeySha256,
    declaredCellCount: verification.cells.length,
    attemptedCellCount: cellArtifacts.length,
    retryCount: 0,
    noOutcomeInspectionDuringExecution: true,
    completedAt: dependencies.now(),
    cells: cellArtifacts.map(({ cellRoot: _cellRoot, ...cell }) => cell),
  } as const;
  const executionManifest = writeContentAddressedJson(
    resolve(batchRoot, "manifests"),
    "execution",
    executionBody as unknown as { readonly [key: string]: JsonValue },
  );

  let postRunVerification: { readonly path: string; readonly sha256: string } | null = null;
  if (input.postRunVerify !== undefined) {
    try {
      const result = await input.postRunVerify({
        batchRoot,
        executionManifestPath: executionManifest.path,
        executionManifestSha256: executionManifest.sha256,
        preregistration: input.preregistration,
        signature: input.signature,
        expectedPreregistrationSha256: input.expectedPreregistrationSha256,
        cellManifestPaths,
      });
      postRunVerification = writeContentAddressedJson(
        resolve(batchRoot, "manifests"),
        "post-run-verification",
        result,
      );
    } catch (error) {
      postRunVerification = writeContentAddressedJson(
        resolve(batchRoot, "manifests"),
        "post-run-verification-failure",
        {
          schemaVersion: "pm.public-eval-corners.sentinel-post-run-verification-failure.v1",
          valid: false,
          issues: [safeMessage(error, [input.anthropicApiKey])],
        },
      );
    }
  }
  const finalBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-live-final-manifest.v1",
    evidenceEligible: false,
    publicEfficacyEligible: false,
    qualificationOnly: true,
    localProducerMayNotSelfPromote: true,
    independentAuthorityRequired: true,
    preregistrationSha256: verification.preregistrationSha256,
    executionManifestPath: relative(batchRoot, executionManifest.path),
    executionManifestSha256: executionManifest.sha256,
    postRunVerificationPath:
      postRunVerification === null ? null : relative(batchRoot, postRunVerification.path),
    postRunVerificationSha256: postRunVerification?.sha256 ?? null,
    declaredCellCount: 27,
    retainedCellCount: cellArtifacts.length,
    estimatedCostPolicy: {
      label: "estimate",
      inputUsdPerMillionTokens:
        input.preregistration.model.pricing.baseInputUsdPerMillionTokens,
      outputUsdPerMillionTokens: input.preregistration.model.pricing.outputUsdPerMillionTokens,
      promptCachingEnabled: input.preregistration.model.pricing.promptCachingEnabled,
      sourceUrl: input.preregistration.model.pricing.sourceUrl,
      accessedAt: input.preregistration.model.pricing.accessedAt,
      note: "Estimated USD must be computed post-run from retained provider usage; this execution runner does not inspect outcomes or usage.",
    },
    finalizedAt: dependencies.now(),
  } as const;
  const finalManifest = writeContentAddressedJson(
    resolve(batchRoot, "manifests"),
    "final",
    finalBody as unknown as { readonly [key: string]: JsonValue },
  );
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-live-batch-result.v1",
    evidenceEligible: false,
    publicEfficacyEligible: false,
    qualificationOnly: true,
    batchRoot,
    preregistrationSha256: verification.preregistrationSha256,
    executionManifestPath: executionManifest.path,
    executionManifestSha256: executionManifest.sha256,
    finalManifestPath: finalManifest.path,
    finalManifestSha256: finalManifest.sha256,
    cells: cellArtifacts,
  };
}

export function verifyContentAddressedSentinelManifest(path: string): {
  readonly valid: boolean;
  readonly expectedSha256: string | null;
  readonly actualSha256: string | null;
  readonly issues: readonly string[];
} {
  const resolvedPath = resolve(path);
  const issues: string[] = [];
  let expectedSha256: string | null = null;
  let actualSha256: string | null = null;
  try {
    const stat = lstatSync(resolvedPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("manifest must be a regular non-symlink file");
    const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("manifest must contain an object");
    }
    const record = parsed as Record<string, unknown>;
    expectedSha256 = typeof record.manifestSha256 === "string" ? record.manifestSha256 : null;
    const { manifestSha256: _manifestSha256, ...body } = record;
    actualSha256 = sentinelJsonSha256(body);
    const fileHash = basename(resolvedPath).match(/-([a-f0-9]{64})\.json$/u)?.[1] ?? null;
    if (expectedSha256 === null) issues.push("manifestSha256 is missing");
    if (expectedSha256 !== actualSha256) issues.push("manifest body hash does not match manifestSha256");
    if (fileHash !== actualSha256) issues.push("manifest filename is not content-addressed to its body");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return { valid: issues.length === 0, expectedSha256, actualSha256, issues };
}
