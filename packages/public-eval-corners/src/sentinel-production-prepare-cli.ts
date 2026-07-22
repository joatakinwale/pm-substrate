#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
} from "./sentinel-general-provider-proxy.js";
import {
  buildSentinelProductionSchedule,
  createSentinelProductionPreregistration,
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  isSentinelProductionRuntimeClosure,
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  validateSentinelProductionUnsignedPreregistrationShape,
  type SentinelProductionArm,
  type SentinelProductionCell,
  type SentinelProductionPreregistration,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  parseSentinelProductionPrepareInvocation,
  parseSentinelRuntimeClosurePaths,
  SENTINEL_PRODUCTION_PREPARE_INVOCATION_MAX_BYTES,
  type SentinelProductionPrepareInvocation,
} from "./sentinel-production-prepare-contracts.js";
import {
  readSentinelDiagnosticJsonFile,
  redactSentinelDiagnosticError,
  sentinelDiagnosticCanonicalAbsolutePath,
  SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
} from "./sentinel-production-excluded-smoke-contracts.js";
import {
  inspectSentinelProductionCheckout,
} from "./sentinel-production-runner-infrastructure.js";
import { verifySentinelRawCheckoutPreflight } from "./sentinel-production-raw-batch.js";
import { verifySentinelRawRuntimeArtifacts } from "./sentinel-production-raw-runtime.js";
import type { SentinelProductionCheckoutPreflight } from "./sentinel-production-runner-manifests.js";
import {
  deriveSentinelRuntimeClosure,
  type SentinelRuntimeClosureDerivation,
  type SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";

const ARMS = ["native", "sham", "plain-kv", "substrate"] as const;
const PUBLISHED_FILES = [
  "checkout-preflights.json",
  "preparation-manifest.json",
  "preregistration.json",
  "runtime-derivation-artifacts.json",
  "runtime-paths.json",
  "schedule.json",
] as const;

interface SentinelProductionPrepareDependencies {
  readonly deriveRuntimeClosure: (
    paths: SentinelRuntimeClosurePaths,
  ) => SentinelRuntimeClosureDerivation;
  readonly inspectCheckout: (
    checkoutPath: string,
    selectedTasks: SentinelProductionPreregistration["benchmark"]["universes"]["qualification"]["tasks"],
    plannedRuntime: SentinelRuntimeClosure,
  ) => SentinelProductionCheckoutPreflight;
}

export interface SentinelProductionPrepareResult {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-prepare-result.v1";
  readonly preparationOnly: true;
  readonly qualification: false;
  readonly materialBenefit: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly outputRoot: string;
  readonly preregistrationSha256: string;
  readonly scheduleSha256: string;
  readonly cellCount: 36;
  readonly blockCount: 9;
  readonly preparationManifestSha256: string;
}

interface OutputFileIdentity {
  readonly name: string;
  readonly byteLength: number;
  readonly sha256: string;
}

interface OutputParentIdentity {
  readonly path: string;
  readonly device: bigint;
  readonly inode: bigint;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPreparedRuntimeDerivation(
  plan: SentinelProductionPreregistration,
  derivation: SentinelRuntimeClosureDerivation,
  runtimePaths: SentinelRuntimeClosurePaths,
): void {
  const shapeIssues = validateSentinelProductionUnsignedPreregistrationShape(plan);
  if (shapeIssues.length > 0) {
    throw new Error(`prepared preregistration shape is invalid: ${shapeIssues.join("; ")}`);
  }
  if (!isSentinelProductionRuntimeClosure(derivation.closure)) {
    throw new Error("prepared runtime closure is not the exact valid v3 closure");
  }
  const retainedArtifact = {
    ...derivation.artifacts,
    artifactSha256: sentinelProductionJsonSha256(derivation.artifacts),
  };
  const validated = verifySentinelRawRuntimeArtifacts(
    retainedArtifact,
    derivation.closure,
  );
  if (
    sentinelProductionCanonicalJson(validated.paths) !==
      sentinelProductionCanonicalJson(runtimePaths)
  ) {
    throw new Error("prepared runtime artifact paths differ from the requested runtime paths");
  }
}

function contains(parent: string, child: string): boolean {
  const candidate = relative(parent, child);
  return candidate === "" ||
    (candidate !== ".." && !candidate.startsWith("../") && !isAbsolute(candidate));
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function fileIdentity(name: string, bytes: Buffer): OutputFileIdentity {
  return { name, byteLength: bytes.byteLength, sha256: sentinelProductionSha256(bytes) };
}

function assertStableOutputContext(
  outputRoot: string,
  protectedRoots: readonly string[],
  expectedParent?: OutputParentIdentity,
  requireFresh = true,
): OutputParentIdentity {
  if (requireFresh && existsSync(outputRoot)) {
    throw new Error("prepare outputRoot must be fresh");
  }
  const parent = dirname(outputRoot);
  if (realpathSync(parent) !== parent) {
    throw new Error("prepare outputRoot parent must be canonical and non-symlinked");
  }
  const parentStat = lstatSync(parent, { bigint: true });
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("prepare outputRoot parent must be a regular directory");
  }
  const identity = {
    path: parent,
    device: parentStat.dev,
    inode: parentStat.ino,
  };
  if (
    expectedParent !== undefined &&
    (identity.path !== expectedParent.path ||
      identity.device !== expectedParent.device ||
      identity.inode !== expectedParent.inode)
  ) {
    throw new Error("prepare outputRoot parent identity changed during preparation");
  }
  for (const protectedRoot of protectedRoots) {
    const canonicalRoot = realpathSync(protectedRoot);
    const stat = lstatSync(protectedRoot);
    if (
      canonicalRoot !== protectedRoot ||
      !stat.isDirectory() ||
      stat.isSymbolicLink()
    ) throw new Error("prepare protected roots must be canonical regular directories");
    if (contains(canonicalRoot, outputRoot) || contains(outputRoot, canonicalRoot)) {
      throw new Error("prepare outputRoot overlaps a checkout or runtime source root");
    }
  }
  return identity;
}

function assertFreshPosixOutputRoot(
  outputRoot: string,
  protectedRoots: readonly string[],
): OutputParentIdentity {
  const identity = assertStableOutputContext(outputRoot, protectedRoots);
  const parent = identity.path;

  const probe = resolve(
    parent,
    `.pm-sentinel-production-prepare-posix-${randomBytes(12).toString("hex")}`,
  );
  const file = resolve(probe, "mode-probe");
  const link = resolve(probe, "hard-link-probe");
  try {
    mkdirSync(probe, { mode: 0o700 });
    chmodSync(probe, 0o700);
    writeFileSync(file, "posix\n", { flag: "wx", mode: 0o600 });
    chmodSync(file, 0o400);
    linkSync(file, link);
    const fileStat = lstatSync(file);
    if (
      (lstatSync(probe).mode & 0o777) !== 0o700 ||
      (fileStat.mode & 0o777) !== 0o400 ||
      fileStat.nlink < 2 ||
      lstatSync(link).ino !== fileStat.ino
    ) throw new Error("mode or hard-link semantics are unavailable");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`prepare outputRoot parent lacks required POSIX semantics: ${message}`);
  } finally {
    try {
      chmodSync(probe, 0o700);
      if (existsSync(file)) chmodSync(file, 0o600);
      if (existsSync(link)) chmodSync(link, 0o600);
      rmSync(probe, { recursive: true, force: true });
    } catch {
      // A failed cleanup remains visible in the caller-selected parent.
    }
  }
  return identity;
}

function assertExactPreparedBundle(
  root: string,
  expectedFiles: Readonly<Record<(typeof PUBLISHED_FILES)[number], Buffer>>,
  expectedRootMode = 0o500,
): void {
  if (realpathSync(root) !== root) {
    throw new Error("prepared bundle root is not canonical and non-symlinked");
  }
  const rootStat = lstatSync(root);
  if (
    !rootStat.isDirectory() || rootStat.isSymbolicLink() ||
    (rootStat.mode & 0o777) !== expectedRootMode
  ) {
    throw new Error("prepared bundle root identity or mode changed before publication");
  }
  const actualNames = readdirSync(root).sort(compare);
  const expectedNames = [...PUBLISHED_FILES].sort(compare);
  if (actualNames.join("\0") !== expectedNames.join("\0")) {
    throw new Error("prepared bundle on-disk inventory differs from the exact six files");
  }
  for (const name of expectedNames) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    const expected = expectedFiles[name];
    const bytes = readFileSync(path);
    if (
      !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      (stat.mode & 0o777) !== 0o400 || stat.size !== expected.byteLength ||
      !bytes.equals(expected) ||
      sentinelProductionSha256(bytes) !== sentinelProductionSha256(expected)
    ) {
      throw new Error(`prepared bundle file ${name} identity, mode, or bytes changed`);
    }
  }
}

function runtimeSourceRoots(paths: SentinelRuntimeClosurePaths): readonly string[] {
  return [
    paths.substrateCheckoutPath,
    paths.upstreamCheckoutPath,
    paths.substratePackagesRootPath,
    paths.substrateInstalledDependenciesRootPath,
    paths.publicEvalCompiledOutputRootPath,
    paths.nodeAllowedRootPath,
    paths.npmAllowedRootPath,
    paths.pythonEnvironmentRootPath,
    paths.pythonRuntimeRootPath,
    paths.pythonStdlibRootPath,
    paths.pythonExecutableAllowedRootPath,
    ...paths.pythonSitePackagesRootPaths,
    paths.playwrightLibraryRootPath,
    paths.playwrightCoreLibraryRootPath,
    paths.browserBundleRootPath,
  ];
}

function preflightBody(
  value: SentinelProductionCheckoutPreflight,
): Omit<SentinelProductionCheckoutPreflight, "preflightSha256"> {
  const { preflightSha256: _preflightSha256, ...body } = value;
  return body;
}

function inspectAndMatchCheckouts(
  invocation: SentinelProductionPrepareInvocation,
  plan: SentinelProductionPreregistration,
  dependencies: SentinelProductionPrepareDependencies,
): Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>> {
  const physicalRoots = new Set<string>();
  for (const arm of ARMS) {
    const checkoutPath = invocation.checkouts[arm];
    if (realpathSync(checkoutPath) !== checkoutPath) {
      throw new Error(`${arm} checkout root must be canonical and non-symlinked`);
    }
    const stat = lstatSync(checkoutPath, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`${arm} checkout root must be a regular directory`);
    }
    const identity = `${stat.dev}:${stat.ino}`;
    if (physicalRoots.has(identity)) {
      throw new Error("four execution arms require four physically disjoint checkout roots");
    }
    physicalRoots.add(identity);
  }
  const entries = ARMS.map((arm) => {
    const preflight = dependencies.inspectCheckout(
      invocation.checkouts[arm],
      plan.benchmark.universes.qualification.tasks,
      plan.runtime,
    );
    if (
      preflight.valid !== true ||
      preflight.issues.length !== 0 ||
      preflight.cleanTrackedAndUntracked !== true ||
      preflight.checkoutPath !== invocation.checkouts[arm] ||
      preflight.preflightSha256 !== sentinelProductionJsonSha256(preflightBody(preflight))
    ) {
      throw new Error(
        `${arm} checkout preflight failed${preflight.issues.length > 0 ? `: ${preflight.issues.join("; ")}` : ""}`,
      );
    }
    return [
      arm,
      verifySentinelRawCheckoutPreflight(preflight, plan, `${arm} checkout preflight`),
    ] as const;
  });
  const output = Object.fromEntries(entries) as unknown as Record<
    SentinelProductionArm,
    SentinelProductionCheckoutPreflight
  >;
  const matchedFields = [
    "repositoryUrl",
    "revision",
    "sourceTreeHash",
    "ignoredArtifactRootSha256",
    "ignoredPathListingBase64",
    "ignoredPathListingSha256",
    "databaseRootSha256",
    "selectedScenarioRootSha256",
    "frontendInstalledTreeSha256",
    "frontendPackageLockSha256",
    "serverRequirementsSha256",
  ] as const;
  for (const arm of ARMS.slice(1)) {
    for (const field of matchedFields) {
      if (output[arm][field] !== output.native[field]) {
        throw new Error(`four-arm checkout ${field} roots are not identical`);
      }
    }
  }
  return output;
}

function assertQualificationSchedule(
  plan: SentinelProductionPreregistration,
  schedule: readonly SentinelProductionCell[],
): asserts schedule is readonly SentinelProductionCell[] & { readonly length: 36 } {
  if (
    plan.registration.selectedPhase !== "qualification" ||
    plan.benchmark.universes.qualification.efficacyEligible !== false ||
    plan.analysis.qualificationMaterialBenefit !== false ||
    plan.execution.repeatIds.length !== 3 ||
    plan.benchmark.universes.qualification.tasks.length !== 3 ||
    schedule.length !== 36 ||
    new Set(schedule.map(({ cellId }) => cellId)).size !== 36
  ) throw new Error("prepared qualification schedule is not the exact 36-cell universe");
  for (let index = 0; index < schedule.length; index += 4) {
    const block = schedule.slice(index, index + 4);
    if (
      block.length !== 4 ||
      new Set(block.map(({ taskId }) => taskId)).size !== 1 ||
      new Set(block.map(({ repeatId }) => repeatId)).size !== 1 ||
      ARMS.some((arm) => !block.some((cell) => cell.arm === arm))
    ) throw new Error("prepared qualification schedule contains a malformed block");
  }
}

function checkoutIdentity(preflight: SentinelProductionCheckoutPreflight) {
  return {
    checkoutPath: preflight.checkoutPath,
    repositoryUrl: preflight.repositoryUrl,
    revision: preflight.revision,
    sourceTreeHash: preflight.sourceTreeHash,
    preflightSha256: preflight.preflightSha256,
  };
}

/**
 * Produces only unsigned, outcome-free preparation inputs. It does not read
 * credentials, sign a preregistration, publish an external commitment, or run a cell.
 */
export function prepareSentinelProductionQualification(
  invocation: SentinelProductionPrepareInvocation,
  runtimePaths: SentinelRuntimeClosurePaths,
  dependencies: SentinelProductionPrepareDependencies = {
    deriveRuntimeClosure: deriveSentinelRuntimeClosure,
    inspectCheckout: inspectSentinelProductionCheckout,
  },
): SentinelProductionPrepareResult {
  if (existsSync(invocation.outputRoot)) {
    throw new Error("prepare outputRoot must be fresh");
  }
  const protectedRoots = [
    ...ARMS.map((arm) => invocation.checkouts[arm]),
    ...runtimeSourceRoots(runtimePaths),
  ];
  const outputContext = assertFreshPosixOutputRoot(
    invocation.outputRoot,
    protectedRoots,
  );
  const parent = outputContext.path;
  const derivation = dependencies.deriveRuntimeClosure(runtimePaths);
  const plan = createSentinelProductionPreregistration({
    registrationId: invocation.registration.registrationId,
    registeredAt: invocation.registration.registeredAt,
    producerId: invocation.registration.producerId,
    selectedPhase: "qualification",
    repeatIds: invocation.registration.repeatIds,
    randomizationSeed: invocation.registration.randomizationSeed,
    systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
    actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    runtime: derivation.closure,
    bootstrapSeed: invocation.registration.bootstrapSeed,
    rawBatchVerifierId: invocation.registration.rawBatchVerifierId,
    rawBatchVerifierRevision: derivation.closure.substrateRevision,
    rawBatchVerifierSha256: derivation.closure.verifierScriptSha256,
  });
  assertPreparedRuntimeDerivation(plan, derivation, runtimePaths);
  const schedule = buildSentinelProductionSchedule(plan);
  assertQualificationSchedule(plan, schedule);
  const checkoutPreflights = inspectAndMatchCheckouts(invocation, plan, dependencies);

  const temporaryRoot = resolve(
    parent,
    `.pm-sentinel-production-prepare-${randomBytes(16).toString("hex")}`,
  );
  const preregistrationSha256 = sentinelProductionJsonSha256(plan);
  const scheduleSha256 = sentinelProductionJsonSha256(schedule);
  const checkoutPreflightsSha256 = sentinelProductionJsonSha256(checkoutPreflights);
  const fileBytes = {
    "checkout-preflights.json": jsonBytes(checkoutPreflights),
    "preregistration.json": jsonBytes(plan),
    "runtime-derivation-artifacts.json": jsonBytes(derivation.artifacts),
    "runtime-paths.json": jsonBytes(runtimePaths),
    "schedule.json": jsonBytes(schedule),
  } as const;
  const boundFiles = Object.entries(fileBytes)
    .map(([name, bytes]) => fileIdentity(name, bytes))
    .sort((left, right) => compare(left.name, right.name));
  const manifest = {
    schemaVersion:
      "pm.public-eval-corners.sentinel-production-preparation-manifest.v1" as const,
    preparationOnly: true as const,
    trustMode: "unsigned-preparation" as const,
    independent: false as const,
    qualification: false as const,
    materialBenefit: false as const,
    evidenceEligible: false as const,
    analysisEligible: false as const,
    selectedPhase: "qualification" as const,
    registration: {
      registrationId: plan.registration.registrationId,
      registeredAt: plan.registration.registeredAt,
      producerId: plan.registration.producerId,
    },
    benchmark: {
      repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
      revision: SENTINEL_PRODUCTION_REVISION,
      sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
    },
    runtime: {
      substrateRevision: derivation.closure.substrateRevision,
      closureSha256: derivation.closure.closureSha256,
      derivationSha256: derivation.artifacts.derivationSha256,
      verifierScriptSha256: derivation.closure.verifierScriptSha256,
      substrateIgnoredPathListingSha256:
        derivation.closure.workspace.ignoredPathListingSha256,
      upstreamIgnoredPathListingSha256:
        derivation.closure.upstream.ignoredPathListingSha256,
    },
    model: {
      systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
      actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    },
    schedule: {
      preregistrationSha256,
      scheduleSha256,
      cellCount: 36 as const,
      blockCount: 9 as const,
      taskCount: 3 as const,
      repeatCount: 3 as const,
      armCount: 4 as const,
    },
    checkoutPreflightsSha256,
    checkouts: {
      native: checkoutIdentity(checkoutPreflights.native),
      sham: checkoutIdentity(checkoutPreflights.sham),
      "plain-kv": checkoutIdentity(checkoutPreflights["plain-kv"]),
      substrate: checkoutIdentity(checkoutPreflights.substrate),
    },
    contains: {
      credentials: false as const,
      signature: false as const,
      privateKey: false as const,
      externalTrustAnchor: false as const,
      externalCommitment: false as const,
      outcomes: false as const,
    },
    signingInstruction: {
      algorithm: "Ed25519" as const,
      message: "raw-32-bytes-decoded-from-preregistrationSha256" as const,
      producerMayNotSign: true as const,
      independentAuthorityRequired: true as const,
    },
    publishedFiles: [...PUBLISHED_FILES],
    boundFiles,
  };
  const manifestBytes = jsonBytes(manifest);
  const preparationManifestSha256 = sentinelProductionJsonSha256(manifest);
  const publishedBytes: Readonly<Record<(typeof PUBLISHED_FILES)[number], Buffer>> = {
    ...fileBytes,
    "preparation-manifest.json": manifestBytes,
  };

  let published = false;
  let publishedDescriptor: number | null = null;
  let committed = false;
  try {
    assertStableOutputContext(
      invocation.outputRoot,
      protectedRoots,
      outputContext,
    );
    mkdirSync(temporaryRoot, { mode: 0o700 });
    chmodSync(temporaryRoot, 0o700);
    for (const [name, bytes] of Object.entries(fileBytes)) {
      const path = resolve(temporaryRoot, name);
      writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
      chmodSync(path, 0o400);
    }
    const manifestPath = resolve(temporaryRoot, "preparation-manifest.json");
    writeFileSync(manifestPath, manifestBytes, { flag: "wx", mode: 0o400 });
    chmodSync(manifestPath, 0o400);
    const closingDerivation = dependencies.deriveRuntimeClosure(runtimePaths);
    assertPreparedRuntimeDerivation(plan, closingDerivation, runtimePaths);
    if (
      sentinelProductionCanonicalJson(closingDerivation.closure) !==
        sentinelProductionCanonicalJson(derivation.closure) ||
      sentinelProductionCanonicalJson(closingDerivation.artifacts) !==
        sentinelProductionCanonicalJson(derivation.artifacts)
    ) throw new Error("runtime changed during qualification bundle preparation");
    const closingPreflights = inspectAndMatchCheckouts(invocation, plan, dependencies);
    for (const arm of ARMS) {
      if (closingPreflights[arm].preflightSha256 !== checkoutPreflights[arm].preflightSha256) {
        throw new Error(`${arm} checkout changed during qualification bundle preparation`);
      }
    }
    assertStableOutputContext(
      invocation.outputRoot,
      protectedRoots,
      outputContext,
    );
    chmodSync(temporaryRoot, 0o500);
    assertExactPreparedBundle(temporaryRoot, publishedBytes);
    assertStableOutputContext(
      invocation.outputRoot,
      protectedRoots,
      outputContext,
    );
    // Claim the caller-visible name with mkdir's no-replace semantics. The
    // directory remains ineligible (0700 and files temporarily have nlink=2)
    // until every exact file is linked, the private links are removed, and a
    // final chmod atomically flips the root into its eligible 0500 mode.
    mkdirSync(invocation.outputRoot, { mode: 0o700 });
    published = true;
    chmodSync(invocation.outputRoot, 0o700);
    publishedDescriptor = openSync(
      invocation.outputRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const linkOrder = PUBLISHED_FILES.filter((name) =>
      name !== "preparation-manifest.json");
    for (const name of [...linkOrder, "preparation-manifest.json" as const]) {
      linkSync(resolve(temporaryRoot, name), resolve(invocation.outputRoot, name));
    }
    chmodSync(temporaryRoot, 0o700);
    rmSync(temporaryRoot, { recursive: true, force: false });
    assertStableOutputContext(
      invocation.outputRoot,
      protectedRoots,
      outputContext,
      false,
    );
    assertExactPreparedBundle(invocation.outputRoot, publishedBytes, 0o700);
    const descriptorStat = fstatSync(publishedDescriptor, { bigint: true });
    const pathStat = lstatSync(invocation.outputRoot, { bigint: true });
    if (
      !descriptorStat.isDirectory() || !pathStat.isDirectory() ||
      pathStat.isSymbolicLink() || descriptorStat.dev !== pathStat.dev ||
      descriptorStat.ino !== pathStat.ino || (descriptorStat.mode & 0o777n) !== 0o700n
    ) {
      throw new Error("prepared output root changed before the descriptor-bound commit");
    }
    // This descriptor-bound chmod is the sole validity commit. No fallible
    // path-based operation occurs afterward; later consumers still replay all
    // content hashes and never infer eligibility from mode alone.
    fchmodSync(publishedDescriptor, 0o500);
    committed = true;
    try { closeSync(publishedDescriptor); } catch { /* descriptor closes at process exit */ }
    publishedDescriptor = null;
  } catch (error) {
    try {
      if (publishedDescriptor !== null) {
        if (!committed) fchmodSync(publishedDescriptor, 0o700);
        closeSync(publishedDescriptor);
        publishedDescriptor = null;
      }
      if (!published && existsSync(temporaryRoot)) {
        const stat = lstatSync(temporaryRoot);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          chmodSync(temporaryRoot, 0o700);
          rmSync(temporaryRoot, { recursive: true, force: true });
        }
      }
    } catch {
      // A residue makes an interrupted preparation visible and ineligible.
    }
    // Once renamed, never follow, chmod, or delete the caller-visible path: a
    // same-user swap could redirect cleanup. A failed post-publish validation
    // intentionally leaves a visible, ineligible residue for manual disposal.
    throw error;
  }
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-prepare-result.v1",
    preparationOnly: true,
    qualification: false,
    materialBenefit: false,
    evidenceEligible: false,
    analysisEligible: false,
    outputRoot: invocation.outputRoot,
    preregistrationSha256,
    scheduleSha256,
    cellCount: 36,
    blockCount: 9,
    preparationManifestSha256,
  };
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new Error(
      "usage: pm-sentinel-production-prepare /absolute/path/to/invocation.json",
    );
  }
  const invocationPath = sentinelDiagnosticCanonicalAbsolutePath(
    process.argv[2],
    "invocation path",
  );
  const invocationFile = readSentinelDiagnosticJsonFile(
    invocationPath,
    SENTINEL_PRODUCTION_PREPARE_INVOCATION_MAX_BYTES,
    "production prepare invocation",
  );
  const invocation = parseSentinelProductionPrepareInvocation(invocationFile.value);
  const runtimePathsFile = readSentinelDiagnosticJsonFile(
    invocation.runtimePathsPath,
    SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
    "runtime paths",
  );
  const runtimePaths = parseSentinelRuntimeClosurePaths(runtimePathsFile.value);
  process.stdout.write(
    `${JSON.stringify(prepareSentinelProductionQualification(invocation, runtimePaths), null, 2)}\n`,
  );
}

const direct = process.argv[1] !== undefined &&
  pathToFileURL(realpathSync(resolve(process.argv[1]))).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;
if (direct) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `sentinel production preparation failed: ${redactSentinelDiagnosticError(error, [])}\n`,
    );
    process.exitCode = 1;
  });
}
