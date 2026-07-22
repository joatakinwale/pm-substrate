import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { basename, dirname, isAbsolute, normalize } from "node:path";

export const SENTINEL_PRODUCTION_OWNER_OBJECTIVE =
  "Stress-test pm-substrate hard against real, publicly documented agent-state failure scenarios; demonstrate the failures under matched native and sham controls; test whether pm-substrate materially improves the benchmark’s real outcome; identify observed gaps; use Arrowsmith to research the smallest general repair; then rerun the exact failure and clean controls while aggressively excluding false positives." as const;

export const SENTINEL_PRODUCTION_REPOSITORY =
  "https://github.com/microsoft/sentinel_environments" as const;
export const SENTINEL_PRODUCTION_REVISION =
  "0faca33cc58ea62e97a928b67cd3beec7176b408" as const;
export const SENTINEL_PRODUCTION_SOURCE_TREE =
  "3ca2dc7160e505dc15b607ada4dd9ffe1f6a7c50" as const;
export const SENTINEL_HELDOUT_MANIFEST_SHA256 =
  "f24feec519f0eb90bebaefd8d2c4c72cab9b208e6e6f2ec6629f49adeb9b2576" as const;
export const SENTINEL_PROCEDURAL_HOLDOUT_MANIFEST_SHA256 =
  SENTINEL_HELDOUT_MANIFEST_SHA256;
export const SENTINEL_QUALIFICATION_MANIFEST_SHA256 =
  "05b1ef06dbb4c8eec72f8f99d16082b6a3e6f8f9be645eb8d8d29a2f2979b489" as const;
export const SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256 =
  "48e1695b0728000c8f8e738f9d72273861bf6216e4c609935650a09067d87bc6" as const;
export const SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256 =
  "c834011c79c134ed14c17ecbca312934de22054c77dd5fbb000ad5ae0560c132" as const;

/**
 * The closure probes run with this complete environment, never a filtered copy
 * of the caller's environment. The same values are signed so a reconstruction
 * cannot silently inherit a user site, git config, locale, timezone, or secret.
 */
export const SENTINEL_RUNTIME_SANITIZED_ENVIRONMENT_BASE = Object.freeze({
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
  HOME: "/dev/null",
  LANG: "C",
  LC_ALL: "C",
  PYTHONDONTWRITEBYTECODE: "1",
  PYTHONHASHSEED: "0",
  PYTHONNOUSERSITE: "1",
  PYTHONUTF8: "1",
  TZ: "UTC",
} as const);

export type SentinelRuntimeSanitizedEnvironment = Readonly<
  typeof SENTINEL_RUNTIME_SANITIZED_ENVIRONMENT_BASE & { readonly PATH: string }
>;

function canonicalNodeExecutablePath(nodeExecutablePath: string): string {
  if (
    !isAbsolute(nodeExecutablePath) ||
    normalize(nodeExecutablePath) !== nodeExecutablePath ||
    /[:\0\r\n\t]/u.test(nodeExecutablePath) ||
    basename(nodeExecutablePath) !== "node"
  ) throw new Error("pinned Node executable path must be canonical absolute and PATH-safe");
  return nodeExecutablePath;
}

/** Build the only accepted no-inheritance environment from the pinned Node entry. */
export function buildSentinelRuntimeSanitizedEnvironment(
  nodeExecutablePath: string,
): SentinelRuntimeSanitizedEnvironment {
  const nodeDirectory = dirname(canonicalNodeExecutablePath(nodeExecutablePath));
  const searchPath = [...new Set([nodeDirectory, "/usr/bin", "/bin"])].join(":");
  return Object.freeze({
    ...SENTINEL_RUNTIME_SANITIZED_ENVIRONMENT_BASE,
    PATH: searchPath,
  });
}

/** Exact validator shared by preregistration, reconstruction, and execution. */
export function isSentinelRuntimeSanitizedEnvironment(
  value: unknown,
  nodeExecutablePath: string,
): value is SentinelRuntimeSanitizedEnvironment {
  try {
    return sentinelProductionCanonicalJson(value) === sentinelProductionCanonicalJson(
      buildSentinelRuntimeSanitizedEnvironment(nodeExecutablePath),
    );
  } catch {
    return false;
  }
}

export type SentinelProductionPhase =
  | "qualification"
  | "procedural-holdout"
  | "powered-confirmatory";
export type SentinelProductionArm = "native" | "sham" | "plain-kv" | "substrate";
export type SentinelProductionTaskRole =
  | "state-retention-relative"
  | "expected-allow-absolute"
  | "anti-degenerate-noop";
export type SentinelProductionEnvironment =
  | "microhub"
  | "microhood"
  | "micromail"
  | "microscholar"
  | "microtube"
  | "microchat"
  | "microdin"
  | "microfy"
  | "microgram"
  | "microlendar";

export interface SentinelProductionTask {
  readonly taskId: string;
  readonly environment: SentinelProductionEnvironment;
  readonly role: SentinelProductionTaskRole;
  readonly scenarioSha256: string;
  readonly conditionAtSeconds: number | null;
  readonly eventTimelineEndSeconds: 720;
  readonly killAtSeconds: 630;
  readonly taxonomy: {
    readonly criteria: "objective";
    readonly milestoneType: "relative" | "absolute";
    readonly eventPersistence: "persistent";
    readonly monitoringApproach: "active" | "passive";
    readonly difficulty: "easy" | "medium" | "hard";
    readonly distractionLevel: "low" | "medium" | "high";
  };
}

function task(
  taskId: string,
  environment: SentinelProductionEnvironment,
  role: SentinelProductionTaskRole,
  scenarioSha256: string,
  conditionAtSeconds: number | null,
  milestoneType: "relative" | "absolute",
  monitoringApproach: "active" | "passive",
  difficulty: "easy" | "medium",
  distractionLevel: "low" | "medium",
): SentinelProductionTask {
  return Object.freeze({
    taskId,
    environment,
    role,
    scenarioSha256,
    conditionAtSeconds,
    eventTimelineEndSeconds: 720,
    killAtSeconds: 630,
    taxonomy: Object.freeze({
      criteria: "objective",
      milestoneType,
      eventPersistence: "persistent",
      monitoringApproach,
      difficulty,
      distractionLevel,
    }),
  });
}

/** Public catalog only. It intentionally contains no prompt, action, SQL, or solution value. */
export const SENTINEL_QUALIFICATION_TASKS: readonly SentinelProductionTask[] = Object.freeze([
  task(
    "microhub-stars-relative-passive",
    "microhub",
    "state-retention-relative",
    "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
    565.42,
    "relative",
    "passive",
    "easy",
    "low",
  ),
  task(
    "microhub-stars-noop",
    "microhub",
    "anti-degenerate-noop",
    "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
    null,
    "absolute",
    "passive",
    "easy",
    "low",
  ),
  task(
    "microhub-stars-absolute-passive",
    "microhub",
    "expected-allow-absolute",
    "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
    587.31,
    "absolute",
    "passive",
    "easy",
    "low",
  ),
] as const);

/**
 * Frozen procedural holdout selected outside MicroHub. Four independent
 * relative tasks are not statistically powered for an efficacy conclusion.
 */
export const SENTINEL_HELDOUT_TASKS: readonly SentinelProductionTask[] = Object.freeze([
  task(
    "microhood-buy-dip-relative-active",
    "microhood",
    "state-retention-relative",
    "9c337fc95d2b63a0439fb4f13de20da29c41ca881569ceaf9339a6d7c79b8308",
    265.95,
    "relative",
    "active",
    "medium",
    "low",
  ),
  task(
    "microhood-orders-absolute-active",
    "microhood",
    "expected-allow-absolute",
    "7a6aed951266f06ee20f872d0cfef136e4e3df3f0c993ba35b47a31d70291243",
    100.52,
    "absolute",
    "active",
    "medium",
    "low",
  ),
  task(
    "microhood-orders-noop",
    "microhood",
    "anti-degenerate-noop",
    "784299d53c06b69aedafa53bc4410dc9b91b19b45eb5d03fecb68d081d05ab81",
    null,
    "absolute",
    "active",
    "medium",
    "low",
  ),
  task(
    "micromail-junk-relative-passive",
    "micromail",
    "state-retention-relative",
    "c178a310bd8a68dc575956e2f53b2ac9da2dc01281cbb82360890cbc82240fa4",
    297.75,
    "relative",
    "passive",
    "easy",
    "medium",
  ),
  task(
    "micromail-unread-absolute-passive",
    "micromail",
    "expected-allow-absolute",
    "22fbd6f43a99f877557b43b5a3e1d13c9ce1582838e8283b0f49b4a4dacd9f6b",
    585.56,
    "absolute",
    "passive",
    "easy",
    "medium",
  ),
  task(
    "micromail-sender-absolute-noop",
    "micromail",
    "anti-degenerate-noop",
    "9339debfd55a22b347a8622232da16deb6c1701b28bdc3250554cddda205fb23",
    null,
    "absolute",
    "passive",
    "easy",
    "medium",
  ),
  task(
    "microscholar-papercount-relative-passive",
    "microscholar",
    "state-retention-relative",
    "c78eb6d3b0d0c6b4cb4e129dde99d9cebf50807f559dff5cd434fdab92c6ff2d",
    199.94,
    "relative",
    "passive",
    "easy",
    "low",
  ),
  task(
    "microscholar-search-absolute-passive",
    "microscholar",
    "expected-allow-absolute",
    "acddb160065dde5a6d08c13d2a4cda3e06ceab6aa2d84fd84dec499040366e8a",
    154.6,
    "absolute",
    "passive",
    "easy",
    "low",
  ),
  task(
    "microscholar-search-noop",
    "microscholar",
    "anti-degenerate-noop",
    "eb12e66e6ec971ffbe485cde8903568cfad61f7107f4aff259f3dba60a5a4d2c",
    null,
    "absolute",
    "passive",
    "easy",
    "low",
  ),
  task(
    "microtube-views-relative-active",
    "microtube",
    "state-retention-relative",
    "77e6f181d668df4b9648708a8c301d1c8226096230765166787065dae2d9536a",
    242,
    "relative",
    "active",
    "medium",
    "low",
  ),
  task(
    "microtube-video-absolute-active",
    "microtube",
    "expected-allow-absolute",
    "07dca2cbb0b25c63115cdcb84f72e6f431131e157dacf330eebced817c16a2a1",
    350.12,
    "absolute",
    "active",
    "medium",
    "low",
  ),
  task(
    "microtube-notifications-noop",
    "microtube",
    "anti-degenerate-noop",
    "3e66a470e24a1003a010e8b72e7cff059b1884f3d1bfc40d09d726cb036b4126",
    null,
    "absolute",
    "active",
    "medium",
    "low",
  ),
] as const);

export const SENTINEL_PROCEDURAL_HOLDOUT_TASKS = SENTINEL_HELDOUT_TASKS;

export interface SentinelProductionAnalysisProcedure {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-analysis-procedure.v1";
  readonly poweredNativeShamClaimRule: "all-of-both-point-lifts-bootstrap-lower-bound-both-holm-rejections-and-fail-closed-guardrails";
  readonly primaryStratum: {
    readonly taskRole: "state-retention-relative";
    readonly independentTaskCount: 19;
    readonly repeatsPerTask: 3;
    readonly repeatAggregation: "task-level-pass-rate-per-arm";
    readonly repeatsIncreaseIndependentSampleSize: false;
  };
  readonly primaryEffect: {
    readonly minimumPointLiftOverNative: 0.1;
    readonly minimumPointLiftOverSham: 0.1;
    readonly bootstrapContrast: "substrate-minus-max-of-native-and-sham";
  };
  readonly clusterBootstrap: {
    readonly draws: 10_000;
    readonly resamplingUnit: "task-cluster";
    readonly seedSource: "signed-preregistration";
    readonly confidenceLevel: 0.95;
    readonly interval: "percentile";
    readonly prng: "sha256-seed-null-u64be-counter-rejection-v1";
    readonly counterStart: 0;
    readonly candidateUint64: "first-8-bytes-big-endian-of-sha256(utf8-seed-null-u64be-counter)";
    readonly indexMapping: "reject-at-or-above-floor-2^64-over-19-times-19-then-mod-19";
    readonly counterIncrement: "after-every-candidate";
    readonly tasksPerDraw: 19;
    readonly contrastPerDraw: "mean-substrate-pass-rate-minus-max-mean-native-or-sham-pass-rate";
    readonly lowerQuantile: "sorted-zero-based-index-499-of-10000";
    readonly lowerBoundMustBeStrictlyAboveZero: true;
  };
  readonly exactRandomizationTests: {
    readonly method: "paired-task-level-sign-flip";
    readonly taskDifferenceNumerator: "substrate-success-count-minus-control-success-count";
    readonly commonTaskDenominator: 3;
    readonly statistic: "sum-of-19-task-difference-numerators";
    readonly enumeration: "all-sign-assignments-of-nonzero-task-differences";
    readonly zeroDifferenceHandling: "retain-as-zero-and-do-not-add-sign-bit";
    readonly alternative: "substrate-greater-than-control";
    readonly exactPValue: "fraction-of-enumerated-statistics-greater-than-or-equal-to-observed";
    readonly contrasts: readonly ["substrate-vs-native", "substrate-vs-sham"];
    readonly multiplicityCorrection: "Holm";
    readonly holmDecisionRule: "sort-p-ascending-test-at-alpha-over-2-then-alpha-stop-at-first-nonrejection";
    readonly familywiseAlpha: 0.05;
  };
  readonly failClosedGuardrails: {
    readonly expectedAllowAbsolute: true;
    readonly antiDegenerateNoop: true;
    readonly everyCellRawComplete: true;
    readonly infrastructureIncompletePreventsAnalysis: true;
    readonly economicsAndLatencyApplyToEveryArmAndCell: true;
  };
  readonly plainKvBoundary: {
    readonly reportAsActiveDurableStorageComparator: true;
    readonly includedInPrimaryNativeShamClaim: false;
    readonly substrateSpecificLiftRequiresSeparatePreregisteredRawDerivedContrast: true;
    readonly thisProcedureAuthorizesSubstrateSpecificLift: false;
  };
  readonly planningBoundary: {
    readonly acceptsOutcomeBooleans: false;
    readonly computesMaterialBenefit: false;
    readonly rawBatchVerifierDerivesAllOutcomes: true;
  };
}

export const SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE: SentinelProductionAnalysisProcedure =
  Object.freeze({
    schemaVersion: "pm.public-eval-corners.sentinel-production-analysis-procedure.v1",
    poweredNativeShamClaimRule:
      "all-of-both-point-lifts-bootstrap-lower-bound-both-holm-rejections-and-fail-closed-guardrails",
    primaryStratum: Object.freeze({
      taskRole: "state-retention-relative",
      independentTaskCount: 19,
      repeatsPerTask: 3,
      repeatAggregation: "task-level-pass-rate-per-arm",
      repeatsIncreaseIndependentSampleSize: false,
    }),
    primaryEffect: Object.freeze({
      minimumPointLiftOverNative: 0.1,
      minimumPointLiftOverSham: 0.1,
      bootstrapContrast: "substrate-minus-max-of-native-and-sham",
    }),
    clusterBootstrap: Object.freeze({
      draws: 10_000,
      resamplingUnit: "task-cluster",
      seedSource: "signed-preregistration",
      confidenceLevel: 0.95,
      interval: "percentile",
      prng: "sha256-seed-null-u64be-counter-rejection-v1",
      counterStart: 0,
      candidateUint64: "first-8-bytes-big-endian-of-sha256(utf8-seed-null-u64be-counter)",
      indexMapping: "reject-at-or-above-floor-2^64-over-19-times-19-then-mod-19",
      counterIncrement: "after-every-candidate",
      tasksPerDraw: 19,
      contrastPerDraw: "mean-substrate-pass-rate-minus-max-mean-native-or-sham-pass-rate",
      lowerQuantile: "sorted-zero-based-index-499-of-10000",
      lowerBoundMustBeStrictlyAboveZero: true,
    }),
    exactRandomizationTests: Object.freeze({
      method: "paired-task-level-sign-flip",
      taskDifferenceNumerator: "substrate-success-count-minus-control-success-count",
      commonTaskDenominator: 3,
      statistic: "sum-of-19-task-difference-numerators",
      enumeration: "all-sign-assignments-of-nonzero-task-differences",
      zeroDifferenceHandling: "retain-as-zero-and-do-not-add-sign-bit",
      alternative: "substrate-greater-than-control",
      exactPValue: "fraction-of-enumerated-statistics-greater-than-or-equal-to-observed",
      contrasts: Object.freeze(["substrate-vs-native", "substrate-vs-sham"] as const),
      multiplicityCorrection: "Holm",
      holmDecisionRule: "sort-p-ascending-test-at-alpha-over-2-then-alpha-stop-at-first-nonrejection",
      familywiseAlpha: 0.05,
    }),
    failClosedGuardrails: Object.freeze({
      expectedAllowAbsolute: true,
      antiDegenerateNoop: true,
      everyCellRawComplete: true,
      infrastructureIncompletePreventsAnalysis: true,
      economicsAndLatencyApplyToEveryArmAndCell: true,
    }),
    plainKvBoundary: Object.freeze({
      reportAsActiveDurableStorageComparator: true,
      includedInPrimaryNativeShamClaim: false,
      substrateSpecificLiftRequiresSeparatePreregisteredRawDerivedContrast: true,
      thisProcedureAuthorizesSubstrateSpecificLift: false,
    }),
    planningBoundary: Object.freeze({
      acceptsOutcomeBooleans: false,
      computesMaterialBenefit: false,
      rawBatchVerifierDerivesAllOutcomes: true,
    }),
  });

export interface SentinelPoweredConfirmatoryUniverse {
  readonly purpose: "future-powered-confirmatory-outcome";
  readonly status: "not-frozen" | "frozen";
  readonly efficacyEligibleAfterExternalVerification: boolean;
  readonly manifestSha256: typeof SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256;
  readonly fullCatalogSha256: typeof SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256;
  readonly fullCatalogHashSchema: "canonical-json-array-sorted-by-task-id-all-registration-fields-v1";
  readonly expectedTaskCount: 50;
  readonly expectedEnvironmentCounts: {
    readonly microchat: 10;
    readonly microdin: 10;
    readonly microfy: 10;
    readonly microgram: 10;
    readonly microlendar: 10;
  };
  readonly expectedRoleCounts: {
    readonly stateRetentionRelative: 19;
    readonly expectedAllowAbsolute: 21;
    readonly antiDegenerateNoop: 10;
  };
  readonly tasks: readonly SentinelProductionTask[];
  readonly selectionProtocolSha256: string | null;
  readonly powerAnalysis: {
    readonly justificationSha256: string | null;
    readonly calculationArtifactSha256: string | null;
    readonly calculationProcedureSha256: string | null;
    readonly calculationVerifierSha256: string | null;
    readonly assumptionSetSha256: string | null;
    readonly targetPower: number | null;
    readonly declaredPower: number | null;
    readonly minimumDetectablePointLift: 0.1;
    readonly independentTaskCount: 19;
    readonly repeatsPerTask: 3;
    readonly familywiseAlpha: number | null;
    readonly externalPowerCalculationVerificationRequired: true;
    readonly externalPowerCalculationVerified: boolean;
    readonly analysisProcedureSha256: string;
    readonly minimumIndependentStateFailureTasks: number | null;
    readonly analysisUnit: "task-clustered";
    readonly taskClusteredConfidenceIntervals: true;
    readonly confidenceIntervalMustExcludeZero: true;
  };
}

export const SENTINEL_UNFROZEN_POWERED_CONFIRMATORY_UNIVERSE:
SentinelPoweredConfirmatoryUniverse = Object.freeze({
  purpose: "future-powered-confirmatory-outcome",
  status: "not-frozen",
  efficacyEligibleAfterExternalVerification: false,
  manifestSha256: SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
  fullCatalogSha256: SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
  fullCatalogHashSchema: "canonical-json-array-sorted-by-task-id-all-registration-fields-v1",
  expectedTaskCount: 50,
  expectedEnvironmentCounts: Object.freeze({
    microchat: 10,
    microdin: 10,
    microfy: 10,
    microgram: 10,
    microlendar: 10,
  }),
  expectedRoleCounts: Object.freeze({
    stateRetentionRelative: 19,
    expectedAllowAbsolute: 21,
    antiDegenerateNoop: 10,
  }),
  tasks: [],
  selectionProtocolSha256: null,
  powerAnalysis: Object.freeze({
    justificationSha256: null,
    calculationArtifactSha256: null,
    calculationProcedureSha256: null,
    calculationVerifierSha256: null,
    assumptionSetSha256: null,
    targetPower: null,
    declaredPower: null,
    minimumDetectablePointLift: 0.1,
    independentTaskCount: 19,
    repeatsPerTask: 3,
    familywiseAlpha: null,
    externalPowerCalculationVerificationRequired: true,
    externalPowerCalculationVerified: false,
    analysisProcedureSha256: sentinelProductionJsonSha256(
      SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE,
    ),
    minimumIndependentStateFailureTasks: null,
    analysisUnit: "task-clustered",
    taskClusteredConfidenceIntervals: true,
    confidenceIntervalMustExcludeZero: true,
  }),
});

export interface SentinelRuntimeClosure {
  readonly closureSha256: string;
  readonly closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v3";
  readonly closureDerivation: "canonical-runtime-git-helper-and-transitive-tree-fields-v3";
  readonly requestedEntryHashSemantics: "sha256-of-symlink-target-utf8-or-regular-file-bytes-v1";
  readonly treeHashSemantics: "sha256-canonical-relative-path-mode-type-contenthash-v1";
  readonly runnerReconstructsAndVerifiesClosure: true;
  readonly substrateRevision: string;
  readonly sourceTreeHash: string;
  readonly workingTreeClean: true;
  readonly pnpmWorkspaceLockSha256: string;
  readonly runnerScriptSha256: string;
  readonly supervisorScriptSha256: string;
  readonly verifierScriptSha256: string;
  readonly agentScriptSha256: string;
  readonly providerProxyScriptSha256: string;
  readonly stateSidecarScriptSha256: string;
  readonly executionEnvironment: {
    readonly schemaVersion: "pm.public-eval-corners.sentinel-sanitized-environment.v2";
    readonly values: SentinelRuntimeSanitizedEnvironment;
    readonly environmentSha256: string;
    readonly inheritsHostEnvironment: false;
  };
  readonly git: {
    readonly platform: NodeJS.Platform;
    readonly resolutionStrategy: "macos-xcrun-find" | "direct-realpath";
    readonly launcherPath: string;
    readonly launcherSha256: string;
    readonly resolverExecutablePath: string | null;
    readonly resolverExecutableSha256: string | null;
    readonly version: string;
    readonly executablePath: string;
    readonly executableSha256: string;
    readonly execPathRootPath: string;
    readonly execPathTreeSha256: string;
    readonly execPathTreeEntryCount: number;
    readonly externalHelperTargetsManifestSha256: string;
    readonly externalHelperTargetCount: number;
    readonly invocationEnvironmentSha256: string;
  };
  readonly workspace: {
    readonly checkoutPath: string;
    readonly rootPackageJsonSha256: string;
    readonly pnpmWorkspaceManifestSha256: string;
    readonly rootTsconfigSha256: string;
    readonly tsconfigBaseSha256: string;
    readonly publicEvalPackageManifestSha256: string;
    readonly publicEvalTsconfigSha256: string;
    readonly packagesRootPath: string;
    readonly packagesTreeSha256: string;
    readonly packagesTreeEntryCount: number;
    readonly installedDependenciesRootPath: string;
    readonly installedDependenciesTreeSha256: string;
    readonly installedDependenciesTreeEntryCount: number;
    readonly compiledOutputRootPath: string;
    readonly compiledOutputTreeSha256: string;
    readonly compiledOutputTreeEntryCount: number;
  };
  readonly node: {
    readonly version: string;
    readonly requestedPath: string;
    readonly requestedEntrySha256: string;
    readonly resolvedPath: string;
    readonly resolvedExecutableSha256: string;
  };
  readonly npm: {
    readonly version: string;
    readonly requestedCliPath: string;
    readonly requestedCliEntrySha256: string;
    readonly resolvedCliPath: string;
    readonly resolvedCliSha256: string;
  };
  readonly python: {
    readonly version: string;
    readonly requestedVenvPath: string;
    readonly venvEntrySha256: string;
    readonly resolvedExecutablePath: string;
    readonly realExecutableSha256: string;
    readonly pyvenvConfigSha256: string;
    readonly pipFreezeSha256: string;
    readonly installedDistributionsManifestSha256: string;
    readonly installedDistributionsManifestSchema: "canonical-name-version-files-record-sha256-v1";
    readonly environmentRootPath: string;
    readonly environmentTreeSha256: string;
    readonly environmentTreeEntryCount: number;
    readonly runtimeRootPath: string;
    readonly runtimeTreeSha256: string;
    readonly runtimeTreeEntryCount: number;
    readonly stdlibRootPath: string;
    readonly stdlibTreeSha256: string;
    readonly stdlibTreeEntryCount: number;
  };
  readonly browser: {
    readonly playwrightVersion: "1.56.1";
    readonly packageMetadataSha256: string;
    readonly bundleRootPath: string;
    readonly bundleTreeSha256: string;
    readonly executablePath: string;
    readonly executableSha256: string;
    readonly libraryRootPath: string;
    readonly libraryTreeSha256: string;
    readonly libraryTreeEntryCount: number;
    readonly coreLibraryRootPath: string;
    readonly coreLibraryTreeSha256: string;
    readonly coreLibraryTreeEntryCount: number;
    readonly corePackageMetadataSha256: string;
  };
  readonly upstream: {
    readonly frontendPackageLockSha256: string;
    readonly frontendInstalledTreeSha256: string;
    readonly serverRequirementsSha256: string;
  };
  readonly executionLease: {
    readonly schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1";
    readonly boundPathsManifestSha256: string;
    readonly exactBoundPathsRequired: true;
    readonly preAndPostBlockReconstructionRequired: true;
    readonly mutationInvalidatesBlock: true;
    readonly immutableSnapshot: false;
    readonly osBoundaryLimitation:
      "kernel-dynamic-loader-system-libraries-and-in-process-races-outside-user-space-hash-closure";
  };
}

export interface SentinelProductionPreregistration {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-preregistration.v1";
  readonly registration: {
    readonly registrationId: string;
    readonly registeredAt: string;
    readonly producerId: string;
    readonly selectedPhase: SentinelProductionPhase;
  };
  readonly objective: typeof SENTINEL_PRODUCTION_OWNER_OBJECTIVE;
  readonly benchmark: {
    readonly repositoryUrl: typeof SENTINEL_PRODUCTION_REPOSITORY;
    readonly revision: typeof SENTINEL_PRODUCTION_REVISION;
    readonly sourceTreeHash: typeof SENTINEL_PRODUCTION_SOURCE_TREE;
    readonly speedFactor: 1;
    readonly publishedDefaultSpeedFactor: 1;
    readonly attemptTimeoutMs: 720_000;
    readonly universes: {
      readonly qualification: {
        readonly purpose: "harness-and-mechanism-qualification-only";
        readonly efficacyEligible: false;
        readonly manifestSha256: typeof SENTINEL_QUALIFICATION_MANIFEST_SHA256;
        readonly tasks: readonly SentinelProductionTask[];
      };
      readonly proceduralHoldout: {
        readonly purpose: "frozen-procedural-engineering-validation-only";
        readonly efficacyEligible: false;
        readonly manifestSha256: typeof SENTINEL_HELDOUT_MANIFEST_SHA256;
        readonly tasks: readonly SentinelProductionTask[];
      };
      readonly poweredConfirmatory: SentinelPoweredConfirmatoryUniverse;
    };
  };
  readonly execution: {
    readonly arms: readonly ["native", "sham", "plain-kv", "substrate"];
    readonly repeatIds: readonly string[];
    readonly randomizationSeed: string;
    readonly blockUnit: "task-by-repeat";
    readonly armsContiguousWithinBlock: true;
    readonly noAutomaticRetries: true;
    readonly noCellReruns: true;
    readonly noTaskReplacements: true;
    readonly executeEveryDeclaredCell: true;
    readonly rawOutcomesUninterpretedDuringExecution: true;
    readonly behavioralFailuresRetained: true;
    readonly infrastructureFailuresRetainedAndBatchIncomplete: true;
  };
  readonly controls: {
    readonly agentReceivesArmIdentity: false;
    readonly taskAgnosticAgent: true;
    readonly identicalModelPromptToolsAndPollSchedule: true;
    readonly identicalFixedWidthStateInterface: true;
    readonly identicalNeutralFirstReadContext: true;
    readonly native: "discard-state";
    readonly sham: "equivalent-work-return-irrelevant-state";
    readonly plainKv: "durable-relevant-state-without-substrate-semantics";
    readonly substrate: "production-continuity-ledger-with-chain-verification";
  };
  readonly phaseSeparation: {
    readonly qualificationMayDebugHarnessOnly: true;
    readonly qualificationMayNotSupportEfficacy: true;
    readonly qualificationTasksExcludedFromConfirmatory: true;
    readonly proceduralHoldoutMayNotSupportEfficacy: true;
    readonly proceduralHoldoutMayNotBePromotedToConfirmatory: true;
    readonly poweredConfirmatoryMustBeSeparatelyFrozen: true;
    readonly crossPhaseOutcomePooling: false;
  };
  readonly model: {
    readonly provider: "anthropic";
    readonly endpoint: "https://api.anthropic.com/v1/messages";
    readonly apiVersion: "2023-06-01";
    readonly model: "claude-sonnet-4-5-20250929";
    readonly temperature: 0;
    readonly maxCompletionTokens: 256;
    readonly automaticRetries: 0;
    readonly providerSeed: "unsupported";
    readonly systemPromptSha256: string;
    readonly actionSchemaSha256: string;
  };
  readonly runtime: SentinelRuntimeClosure;
  readonly evidence: {
    readonly exactUpstreamTaskInvocation: true;
    readonly retainRawProviderRequestsAndResponses: true;
    readonly retainRawBrowserCapturesAndActions: true;
    readonly retainRawStateRequestsAndResponses: true;
    readonly retainProcessIdentityAndExit: true;
    readonly retainProviderUsageCostAndLatency: true;
    readonly verifyRawBeforeAnalysis: true;
    readonly resultPathsAttemptBound: true;
  };
  readonly analysis: {
    readonly primaryOutcome: "unchanged-upstream-strict-task-success";
    readonly procedure: SentinelProductionAnalysisProcedure;
    readonly procedureSha256: string;
    readonly bootstrapSeed: string;
    readonly rawBatchVerifier: {
      readonly verifierId: string;
      readonly verifierRevision: string;
      readonly verifierScriptSha256: string;
      readonly derivesOutcomesFromRaw: true;
      readonly acceptsCallerOutcomeBooleans: false;
    };
    readonly qualificationMaterialBenefit: false;
    readonly proceduralHoldoutMaterialBenefit: false;
    readonly planningMaterialBenefit: false;
    readonly reportAllCellsWithoutTaskOrRepeatShopping: true;
  };
  readonly eligibility: {
    readonly externalPreregistrationAuthorityRequired: true;
    readonly authorityOwnerMustDifferFromProducer: true;
    readonly expectedHashAndKeyMustBeOutOfBand: true;
    readonly localProducerMayNotSelfPromote: true;
    readonly ownerDecisionStillRequiredAfterVerification: true;
  };
}

export interface SentinelProductionSignature {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-signature.v1";
  readonly preregistrationSha256: string;
  readonly algorithm: "Ed25519";
  readonly authority: {
    readonly authorityId: string;
    readonly ownerId: string;
    readonly independent: true;
    readonly signedAt: string;
  };
  readonly publicKeyPem: string;
  readonly publicKeySha256: string;
  readonly signatureBase64: string;
}

export interface SentinelExternalTrustAnchor {
  readonly expectedPreregistrationSha256: string;
  readonly expectedAuthorityId: string;
  readonly expectedAuthorityPublicKeySha256: string;
}

export interface CreateSentinelProductionPreregistrationInput {
  readonly registrationId: string;
  readonly registeredAt: string;
  readonly producerId: string;
  readonly selectedPhase: SentinelProductionPhase;
  readonly repeatIds: readonly string[];
  readonly randomizationSeed: string;
  readonly systemPromptSha256: string;
  readonly actionSchemaSha256: string;
  readonly runtime: SentinelRuntimeClosure;
  readonly poweredConfirmatoryUniverse?: SentinelPoweredConfirmatoryUniverse;
  readonly bootstrapSeed: string;
  readonly rawBatchVerifierId: string;
  readonly rawBatchVerifierRevision: string;
  readonly rawBatchVerifierSha256: string;
}

const PRODUCTION_ARMS = ["native", "sham", "plain-kv", "substrate"] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA1 = /^[a-f0-9]{40}$/u;
const GIT_VERSION = /^git version [^\0\r\n]{1,160}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const NODE_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
const PYTHON_VERSION = /^Python [0-9]+\.[0-9]+\.[0-9]+$/u;
const NPM_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u;
const BASE64_ED25519_SIGNATURE = /^[A-Za-z0-9+/]{86}==$/u;
const ABSOLUTE_PATH = /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]+$/u;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function canonical(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key] as JsonValue)}`)
    .join(",")}}`;
}

function asJson(value: unknown, path = "value"): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => asJson(entry, `${path}[${index}]`));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, asJson(entry, `${path}.${key}`)]),
    );
  }
  throw new Error(`${path} is not canonical JSON`);
}

export function sentinelProductionCanonicalJson(value: unknown): string {
  return canonical(asJson(value));
}

export function sentinelProductionSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sentinelProductionJsonSha256(value: unknown): string {
  return sentinelProductionSha256(sentinelProductionCanonicalJson(value));
}

export const SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256 =
  sentinelProductionJsonSha256(SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE);

export function sentinelProductionTaskManifestSha256(
  tasks: readonly Pick<SentinelProductionTask, "taskId" | "scenarioSha256">[],
): string {
  const manifest = [...tasks]
    .sort((left, right) => compareCodeUnits(left.taskId, right.taskId))
    .map(({ taskId, scenarioSha256 }) => `${taskId}\t${scenarioSha256}\n`)
    .join("");
  return sentinelProductionSha256(manifest);
}

/** Binds every caller-supplied role, timing, and taxonomy field, not only file identity. */
export function sentinelProductionFullTaskCatalogSha256(
  tasks: readonly SentinelProductionTask[],
): string {
  return sentinelProductionJsonSha256(
    [...tasks].sort((left, right) => compareCodeUnits(left.taskId, right.taskId)),
  );
}

export function sentinelProductionRuntimeClosureSha256(
  runtime: SentinelRuntimeClosure,
): string {
  const { closureSha256: _declaredClosureSha256, ...boundRuntime } = runtime;
  return sentinelProductionJsonSha256(boundRuntime);
}

export function createSentinelProductionPreregistration(
  input: CreateSentinelProductionPreregistrationInput,
): SentinelProductionPreregistration {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-preregistration.v1",
    registration: {
      registrationId: input.registrationId,
      registeredAt: input.registeredAt,
      producerId: input.producerId,
      selectedPhase: input.selectedPhase,
    },
    objective: SENTINEL_PRODUCTION_OWNER_OBJECTIVE,
    benchmark: {
      repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
      revision: SENTINEL_PRODUCTION_REVISION,
      sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
      speedFactor: 1,
      publishedDefaultSpeedFactor: 1,
      attemptTimeoutMs: 720_000,
      universes: {
        qualification: {
          purpose: "harness-and-mechanism-qualification-only",
          efficacyEligible: false,
          manifestSha256: SENTINEL_QUALIFICATION_MANIFEST_SHA256,
          tasks: SENTINEL_QUALIFICATION_TASKS,
        },
        proceduralHoldout: {
          purpose: "frozen-procedural-engineering-validation-only",
          efficacyEligible: false,
          manifestSha256: SENTINEL_HELDOUT_MANIFEST_SHA256,
          tasks: SENTINEL_HELDOUT_TASKS,
        },
        poweredConfirmatory:
          input.poweredConfirmatoryUniverse ??
          SENTINEL_UNFROZEN_POWERED_CONFIRMATORY_UNIVERSE,
      },
    },
    execution: {
      arms: PRODUCTION_ARMS,
      repeatIds: [...input.repeatIds],
      randomizationSeed: input.randomizationSeed,
      blockUnit: "task-by-repeat",
      armsContiguousWithinBlock: true,
      noAutomaticRetries: true,
      noCellReruns: true,
      noTaskReplacements: true,
      executeEveryDeclaredCell: true,
      rawOutcomesUninterpretedDuringExecution: true,
      behavioralFailuresRetained: true,
      infrastructureFailuresRetainedAndBatchIncomplete: true,
    },
    controls: {
      agentReceivesArmIdentity: false,
      taskAgnosticAgent: true,
      identicalModelPromptToolsAndPollSchedule: true,
      identicalFixedWidthStateInterface: true,
      identicalNeutralFirstReadContext: true,
      native: "discard-state",
      sham: "equivalent-work-return-irrelevant-state",
      plainKv: "durable-relevant-state-without-substrate-semantics",
      substrate: "production-continuity-ledger-with-chain-verification",
    },
    phaseSeparation: {
      qualificationMayDebugHarnessOnly: true,
      qualificationMayNotSupportEfficacy: true,
      qualificationTasksExcludedFromConfirmatory: true,
      proceduralHoldoutMayNotSupportEfficacy: true,
      proceduralHoldoutMayNotBePromotedToConfirmatory: true,
      poweredConfirmatoryMustBeSeparatelyFrozen: true,
      crossPhaseOutcomePooling: false,
    },
    model: {
      provider: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
      maxCompletionTokens: 256,
      automaticRetries: 0,
      providerSeed: "unsupported",
      systemPromptSha256: input.systemPromptSha256,
      actionSchemaSha256: input.actionSchemaSha256,
    },
    runtime: input.runtime,
    evidence: {
      exactUpstreamTaskInvocation: true,
      retainRawProviderRequestsAndResponses: true,
      retainRawBrowserCapturesAndActions: true,
      retainRawStateRequestsAndResponses: true,
      retainProcessIdentityAndExit: true,
      retainProviderUsageCostAndLatency: true,
      verifyRawBeforeAnalysis: true,
      resultPathsAttemptBound: true,
    },
    analysis: {
      primaryOutcome: "unchanged-upstream-strict-task-success",
      procedure: SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE,
      procedureSha256: SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256,
      bootstrapSeed: input.bootstrapSeed,
      rawBatchVerifier: {
        verifierId: input.rawBatchVerifierId,
        verifierRevision: input.rawBatchVerifierRevision,
        verifierScriptSha256: input.rawBatchVerifierSha256,
        derivesOutcomesFromRaw: true,
        acceptsCallerOutcomeBooleans: false,
      },
      qualificationMaterialBenefit: false,
      proceduralHoldoutMaterialBenefit: false,
      planningMaterialBenefit: false,
      reportAllCellsWithoutTaskOrRepeatShopping: true,
    },
    eligibility: {
      externalPreregistrationAuthorityRequired: true,
      authorityOwnerMustDifferFromProducer: true,
      expectedHashAndKeyMustBeOutOfBand: true,
      localProducerMayNotSelfPromote: true,
      ownerDecisionStillRequiredAfterVerification: true,
    },
  };
}

export interface SentinelProductionCell {
  readonly sequence: number;
  readonly cellId: string;
  readonly phase: SentinelProductionPhase;
  readonly taskId: string;
  readonly taskRole: SentinelProductionTaskRole;
  readonly arm: SentinelProductionArm;
  readonly repeatId: string;
}

function selectedTasks(plan: SentinelProductionPreregistration): readonly SentinelProductionTask[] {
  switch (plan.registration.selectedPhase) {
    case "qualification":
      return plan.benchmark.universes.qualification.tasks;
    case "procedural-holdout":
      return plan.benchmark.universes.proceduralHoldout.tasks;
    case "powered-confirmatory":
      return plan.benchmark.universes.poweredConfirmatory.tasks;
  }
}

export function buildSentinelProductionSchedule(
  plan: SentinelProductionPreregistration,
): readonly SentinelProductionCell[] {
  const phase = plan.registration.selectedPhase;
  const blocks = plan.execution.repeatIds.flatMap((repeatId) =>
    selectedTasks(plan).map((registeredTask) => ({
      blockId: `${phase}:${repeatId}:${registeredTask.taskId}`,
      task: registeredTask,
      repeatId,
    })),
  );
  const orderedBlocks = blocks
    .map((block) => ({
      ...block,
      order: sentinelProductionSha256(
        `${plan.execution.randomizationSeed}\0block\0${block.blockId}`,
      ),
    }))
    .sort((left, right) =>
      compareCodeUnits(left.order, right.order) || compareCodeUnits(left.blockId, right.blockId),
    );
  const cells = orderedBlocks.flatMap(({ blockId, task: registeredTask, repeatId }) =>
    plan.execution.arms
      .map((arm) => ({
        arm,
        order: sentinelProductionSha256(
          `${plan.execution.randomizationSeed}\0arm\0${blockId}\0${arm}`,
        ),
      }))
      .sort((left, right) =>
        compareCodeUnits(left.order, right.order) || compareCodeUnits(left.arm, right.arm),
      )
      .map(({ arm }) => ({
        cellId: `${plan.registration.registrationId}:${phase}:${repeatId}:${registeredTask.taskId}:${arm}`,
        phase,
        taskId: registeredTask.taskId,
        taskRole: registeredTask.role,
        arm,
        repeatId,
      })),
  );
  return cells.map((cell, index) => ({ sequence: index + 1, ...cell }));
}

export interface SentinelProductionPlanVerification {
  readonly valid: boolean;
  readonly preregistrationSha256: string;
  readonly signatureValid: boolean;
  readonly externallyAnchored: boolean;
  readonly cells: readonly SentinelProductionCell[];
  readonly issues: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).sort(compareCodeUnits).join("\0") ===
      [...keys].sort(compareCodeUnits).join("\0")
  );
}

function canonicalIso(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateExactShape(plan: unknown, signature: unknown): readonly string[] {
  const issues: string[] = [];
  const check = (value: unknown, keys: readonly string[], path: string): void => {
    if (!exactKeys(value, keys)) issues.push(`${path} keys are not exact`);
  };
  check(plan, [
    "analysis", "benchmark", "controls", "eligibility", "evidence", "execution", "model",
    "objective", "phaseSeparation", "registration", "runtime", "schemaVersion",
  ], "preregistration");
  if (!isRecord(plan)) return issues;
  check(plan.registration, ["producerId", "registeredAt", "registrationId", "selectedPhase"], "registration");
  check(plan.benchmark, [
    "attemptTimeoutMs", "publishedDefaultSpeedFactor", "repositoryUrl", "revision", "sourceTreeHash", "speedFactor", "universes",
  ], "benchmark");
  const benchmark = plan.benchmark;
  if (isRecord(benchmark)) {
    check(benchmark.universes, ["poweredConfirmatory", "proceduralHoldout", "qualification"], "benchmark.universes");
    const universes = benchmark.universes;
    if (isRecord(universes)) {
      check(universes.qualification, ["efficacyEligible", "manifestSha256", "purpose", "tasks"], "qualification universe");
      check(universes.proceduralHoldout, ["efficacyEligible", "manifestSha256", "purpose", "tasks"], "procedural holdout universe");
      check(universes.poweredConfirmatory, [
        "efficacyEligibleAfterExternalVerification", "expectedEnvironmentCounts", "expectedRoleCounts", "expectedTaskCount",
        "fullCatalogHashSchema", "fullCatalogSha256", "manifestSha256", "powerAnalysis", "purpose",
        "selectionProtocolSha256", "status", "tasks",
      ], "powered confirmatory universe");
      if (isRecord(universes.poweredConfirmatory)) {
        check(universes.poweredConfirmatory.expectedEnvironmentCounts, [
          "microchat", "microdin", "microfy", "microgram", "microlendar",
        ], "powered confirmatory environment counts");
        check(universes.poweredConfirmatory.expectedRoleCounts, [
          "antiDegenerateNoop", "expectedAllowAbsolute", "stateRetentionRelative",
        ], "powered confirmatory role counts");
        check(universes.poweredConfirmatory.powerAnalysis, [
          "analysisProcedureSha256", "analysisUnit", "assumptionSetSha256", "calculationArtifactSha256",
          "calculationProcedureSha256", "calculationVerifierSha256", "confidenceIntervalMustExcludeZero", "declaredPower",
          "externalPowerCalculationVerificationRequired", "externalPowerCalculationVerified", "familywiseAlpha",
          "independentTaskCount", "justificationSha256", "minimumDetectablePointLift",
          "minimumIndependentStateFailureTasks", "repeatsPerTask", "targetPower", "taskClusteredConfidenceIntervals",
        ], "powered confirmatory power analysis");
      }
      for (const [name, universe] of Object.entries(universes)) {
        if (!isRecord(universe)) continue;
        if (!Array.isArray(universe.tasks)) {
          issues.push(`${name}.tasks must be an array`);
          continue;
        }
        universe.tasks.forEach((registeredTask, index) => {
          check(registeredTask, [
            "conditionAtSeconds", "environment", "eventTimelineEndSeconds", "killAtSeconds", "role",
            "scenarioSha256", "taskId", "taxonomy",
          ], `${name}.tasks[${index}]`);
          if (isRecord(registeredTask)) {
            check(registeredTask.taxonomy, [
              "criteria", "difficulty", "distractionLevel", "eventPersistence", "milestoneType", "monitoringApproach",
            ], `${name}.tasks[${index}].taxonomy`);
          }
        });
      }
    }
  }
  check(plan.execution, [
    "arms", "armsContiguousWithinBlock", "behavioralFailuresRetained", "blockUnit", "executeEveryDeclaredCell",
    "infrastructureFailuresRetainedAndBatchIncomplete", "noAutomaticRetries", "noCellReruns", "noTaskReplacements",
    "randomizationSeed", "rawOutcomesUninterpretedDuringExecution", "repeatIds",
  ], "execution");
  if (isRecord(plan.execution)) {
    if (!Array.isArray(plan.execution.arms)) issues.push("execution.arms must be an array");
    if (!Array.isArray(plan.execution.repeatIds)) issues.push("execution.repeatIds must be an array");
  }
  check(plan.controls, [
    "agentReceivesArmIdentity", "identicalFixedWidthStateInterface", "identicalModelPromptToolsAndPollSchedule",
    "identicalNeutralFirstReadContext", "native", "plainKv", "sham", "substrate", "taskAgnosticAgent",
  ], "controls");
  check(plan.phaseSeparation, [
    "crossPhaseOutcomePooling", "poweredConfirmatoryMustBeSeparatelyFrozen", "proceduralHoldoutMayNotBePromotedToConfirmatory",
    "proceduralHoldoutMayNotSupportEfficacy", "qualificationMayDebugHarnessOnly", "qualificationMayNotSupportEfficacy",
    "qualificationTasksExcludedFromConfirmatory",
  ], "phaseSeparation");
  check(plan.model, [
    "actionSchemaSha256", "apiVersion", "automaticRetries", "endpoint", "maxCompletionTokens", "model",
    "provider", "providerSeed", "systemPromptSha256", "temperature",
  ], "model");
  check(plan.runtime, [
    "agentScriptSha256", "browser", "closureDerivation", "closureSchemaVersion", "closureSha256", "executionEnvironment",
    "executionLease", "git", "node", "npm", "pnpmWorkspaceLockSha256", "providerProxyScriptSha256", "python", "runnerReconstructsAndVerifiesClosure",
    "requestedEntryHashSemantics", "runnerScriptSha256", "sourceTreeHash", "stateSidecarScriptSha256",
    "substrateRevision", "supervisorScriptSha256", "treeHashSemantics", "upstream", "verifierScriptSha256",
    "workingTreeClean", "workspace",
  ], "runtime");
  const runtime = plan.runtime;
  if (isRecord(runtime)) {
    check(runtime.executionEnvironment, [
      "environmentSha256", "inheritsHostEnvironment", "schemaVersion", "values",
    ], "runtime.executionEnvironment");
    if (isRecord(runtime.executionEnvironment)) {
      check(runtime.executionEnvironment.values, [
        ...Object.keys(SENTINEL_RUNTIME_SANITIZED_ENVIRONMENT_BASE), "PATH",
      ],
        "runtime.executionEnvironment.values");
    }
    check(runtime.git, [
      "execPathRootPath", "execPathTreeEntryCount", "execPathTreeSha256", "executablePath",
      "executableSha256", "externalHelperTargetCount", "externalHelperTargetsManifestSha256",
      "invocationEnvironmentSha256", "launcherPath", "launcherSha256", "platform",
      "resolutionStrategy", "resolverExecutablePath", "resolverExecutableSha256", "version",
    ], "runtime.git");
    check(runtime.workspace, [
      "checkoutPath", "compiledOutputRootPath", "compiledOutputTreeEntryCount", "compiledOutputTreeSha256",
      "installedDependenciesRootPath", "installedDependenciesTreeEntryCount", "installedDependenciesTreeSha256",
      "packagesRootPath", "packagesTreeEntryCount", "packagesTreeSha256", "pnpmWorkspaceManifestSha256",
      "publicEvalPackageManifestSha256", "publicEvalTsconfigSha256", "rootPackageJsonSha256",
      "rootTsconfigSha256", "tsconfigBaseSha256",
    ], "runtime.workspace");
    check(runtime.node, [
      "requestedEntrySha256", "requestedPath", "resolvedExecutableSha256", "resolvedPath", "version",
    ], "runtime.node");
    check(runtime.npm, [
      "requestedCliEntrySha256", "requestedCliPath", "resolvedCliPath", "resolvedCliSha256", "version",
    ], "runtime.npm");
    check(runtime.python, [
      "environmentRootPath", "environmentTreeEntryCount", "environmentTreeSha256",
      "installedDistributionsManifestSchema", "installedDistributionsManifestSha256", "pipFreezeSha256",
      "pyvenvConfigSha256", "realExecutableSha256", "requestedVenvPath", "resolvedExecutablePath",
      "runtimeRootPath", "runtimeTreeEntryCount", "runtimeTreeSha256", "stdlibRootPath",
      "stdlibTreeEntryCount", "stdlibTreeSha256", "venvEntrySha256", "version",
    ], "runtime.python");
    check(runtime.browser, [
      "bundleRootPath", "bundleTreeSha256", "executablePath", "executableSha256", "packageMetadataSha256",
      "playwrightVersion", "libraryRootPath", "libraryTreeSha256", "libraryTreeEntryCount",
      "coreLibraryRootPath", "coreLibraryTreeSha256", "coreLibraryTreeEntryCount", "corePackageMetadataSha256",
    ], "runtime.browser");
    check(runtime.upstream, [
      "frontendInstalledTreeSha256", "frontendPackageLockSha256", "serverRequirementsSha256",
    ], "runtime.upstream");
    check(runtime.executionLease, [
      "boundPathsManifestSha256", "exactBoundPathsRequired", "immutableSnapshot", "mutationInvalidatesBlock",
      "osBoundaryLimitation", "preAndPostBlockReconstructionRequired", "schemaVersion",
    ], "runtime.executionLease");
  }
  check(plan.evidence, [
    "exactUpstreamTaskInvocation", "resultPathsAttemptBound", "retainProcessIdentityAndExit",
    "retainRawBrowserCapturesAndActions", "retainRawProviderRequestsAndResponses", "retainRawStateRequestsAndResponses",
    "retainProviderUsageCostAndLatency", "verifyRawBeforeAnalysis",
  ], "evidence");
  check(plan.analysis, [
    "bootstrapSeed", "planningMaterialBenefit", "primaryOutcome", "proceduralHoldoutMaterialBenefit", "procedure",
    "procedureSha256", "qualificationMaterialBenefit", "rawBatchVerifier", "reportAllCellsWithoutTaskOrRepeatShopping",
  ], "analysis");
  if (isRecord(plan.analysis)) {
    check(plan.analysis.rawBatchVerifier, [
      "acceptsCallerOutcomeBooleans", "derivesOutcomesFromRaw", "verifierId", "verifierRevision", "verifierScriptSha256",
    ], "analysis.rawBatchVerifier");
    check(plan.analysis.procedure, [
      "clusterBootstrap", "exactRandomizationTests", "failClosedGuardrails", "plainKvBoundary", "planningBoundary",
      "poweredNativeShamClaimRule", "primaryEffect", "primaryStratum", "schemaVersion",
    ], "analysis.procedure");
    const procedure = plan.analysis.procedure;
    if (isRecord(procedure)) {
      check(procedure.primaryStratum, [
        "independentTaskCount", "repeatAggregation", "repeatsIncreaseIndependentSampleSize", "repeatsPerTask", "taskRole",
      ], "analysis.procedure.primaryStratum");
      check(procedure.primaryEffect, [
        "bootstrapContrast", "minimumPointLiftOverNative", "minimumPointLiftOverSham",
      ], "analysis.procedure.primaryEffect");
      check(procedure.clusterBootstrap, [
        "candidateUint64", "confidenceLevel", "contrastPerDraw", "counterIncrement", "counterStart", "draws", "indexMapping",
        "interval", "lowerBoundMustBeStrictlyAboveZero", "lowerQuantile", "prng", "resamplingUnit", "seedSource",
        "tasksPerDraw",
      ], "analysis.procedure.clusterBootstrap");
      check(procedure.exactRandomizationTests, [
        "alternative", "commonTaskDenominator", "contrasts", "enumeration", "exactPValue", "familywiseAlpha",
        "holmDecisionRule", "method", "multiplicityCorrection", "statistic", "taskDifferenceNumerator", "zeroDifferenceHandling",
      ], "analysis.procedure.exactRandomizationTests");
      if (isRecord(procedure.exactRandomizationTests) && !Array.isArray(procedure.exactRandomizationTests.contrasts)) {
        issues.push("analysis.procedure.exactRandomizationTests.contrasts must be an array");
      }
      check(procedure.failClosedGuardrails, [
        "antiDegenerateNoop", "economicsAndLatencyApplyToEveryArmAndCell", "everyCellRawComplete",
        "expectedAllowAbsolute", "infrastructureIncompletePreventsAnalysis",
      ], "analysis.procedure.failClosedGuardrails");
      check(procedure.plainKvBoundary, [
        "includedInPrimaryNativeShamClaim", "reportAsActiveDurableStorageComparator",
        "substrateSpecificLiftRequiresSeparatePreregisteredRawDerivedContrast", "thisProcedureAuthorizesSubstrateSpecificLift",
      ], "analysis.procedure.plainKvBoundary");
      check(procedure.planningBoundary, [
        "acceptsOutcomeBooleans", "computesMaterialBenefit", "rawBatchVerifierDerivesAllOutcomes",
      ], "analysis.procedure.planningBoundary");
    }
  }
  check(plan.eligibility, [
    "authorityOwnerMustDifferFromProducer", "expectedHashAndKeyMustBeOutOfBand", "externalPreregistrationAuthorityRequired",
    "localProducerMayNotSelfPromote", "ownerDecisionStillRequiredAfterVerification",
  ], "eligibility");
  check(signature, [
    "algorithm", "authority", "preregistrationSha256", "publicKeyPem", "publicKeySha256", "schemaVersion", "signatureBase64",
  ], "signature");
  if (isRecord(signature)) {
    check(signature.authority, ["authorityId", "independent", "ownerId", "signedAt"], "signature.authority");
  }
  return issues;
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return sentinelProductionCanonicalJson(left) === sentinelProductionCanonicalJson(right);
  } catch {
    return false;
  }
}

function validRuntime(runtime: SentinelRuntimeClosure): boolean {
  const hashes = [
    runtime.closureSha256,
    runtime.pnpmWorkspaceLockSha256,
    runtime.runnerScriptSha256,
    runtime.supervisorScriptSha256,
    runtime.verifierScriptSha256,
    runtime.agentScriptSha256,
    runtime.providerProxyScriptSha256,
    runtime.stateSidecarScriptSha256,
    runtime.executionEnvironment.environmentSha256,
    runtime.git.launcherSha256,
    runtime.git.executableSha256,
    runtime.git.execPathTreeSha256,
    runtime.git.externalHelperTargetsManifestSha256,
    runtime.git.invocationEnvironmentSha256,
    runtime.workspace.rootPackageJsonSha256,
    runtime.workspace.pnpmWorkspaceManifestSha256,
    runtime.workspace.rootTsconfigSha256,
    runtime.workspace.tsconfigBaseSha256,
    runtime.workspace.publicEvalPackageManifestSha256,
    runtime.workspace.publicEvalTsconfigSha256,
    runtime.workspace.packagesTreeSha256,
    runtime.workspace.installedDependenciesTreeSha256,
    runtime.workspace.compiledOutputTreeSha256,
    runtime.node.requestedEntrySha256,
    runtime.node.resolvedExecutableSha256,
    runtime.npm.requestedCliEntrySha256,
    runtime.npm.resolvedCliSha256,
    runtime.python.venvEntrySha256,
    runtime.python.realExecutableSha256,
    runtime.python.pyvenvConfigSha256,
    runtime.python.pipFreezeSha256,
    runtime.python.installedDistributionsManifestSha256,
    runtime.python.environmentTreeSha256,
    runtime.python.runtimeTreeSha256,
    runtime.python.stdlibTreeSha256,
    runtime.browser.packageMetadataSha256,
    runtime.browser.bundleTreeSha256,
    runtime.browser.executableSha256,
    runtime.browser.libraryTreeSha256,
    runtime.browser.coreLibraryTreeSha256,
    runtime.browser.corePackageMetadataSha256,
    runtime.upstream.frontendPackageLockSha256,
    runtime.upstream.frontendInstalledTreeSha256,
    runtime.upstream.serverRequirementsSha256,
    runtime.executionLease.boundPathsManifestSha256,
  ];
  return (
    hashes.every((hash) => SHA256.test(hash)) &&
    GIT_SHA1.test(runtime.substrateRevision) &&
    GIT_SHA1.test(runtime.sourceTreeHash) &&
    runtime.workingTreeClean === true &&
    runtime.closureSchemaVersion === "pm.public-eval-corners.sentinel-runtime-closure.v3" &&
    runtime.closureDerivation ===
      "canonical-runtime-git-helper-and-transitive-tree-fields-v3" &&
    runtime.requestedEntryHashSemantics ===
      "sha256-of-symlink-target-utf8-or-regular-file-bytes-v1" &&
    runtime.treeHashSemantics ===
      "sha256-canonical-relative-path-mode-type-contenthash-v1" &&
    runtime.runnerReconstructsAndVerifiesClosure === true &&
    runtime.executionEnvironment.schemaVersion ===
      "pm.public-eval-corners.sentinel-sanitized-environment.v2" &&
    runtime.executionEnvironment.inheritsHostEnvironment === false &&
    isSentinelRuntimeSanitizedEnvironment(
      runtime.executionEnvironment.values,
      runtime.node.requestedPath,
    ) &&
    runtime.executionEnvironment.environmentSha256 ===
      sentinelProductionJsonSha256(runtime.executionEnvironment.values) &&
    GIT_VERSION.test(runtime.git.version) &&
    (runtime.git.platform === "darwin"
      ? runtime.git.resolutionStrategy === "macos-xcrun-find" &&
        runtime.git.launcherPath === "/usr/bin/git" &&
        runtime.git.resolverExecutablePath === "/usr/bin/xcrun" &&
        typeof runtime.git.resolverExecutableSha256 === "string" &&
        SHA256.test(runtime.git.resolverExecutableSha256)
      : runtime.git.resolutionStrategy === "direct-realpath" &&
        runtime.git.resolverExecutablePath === null &&
        runtime.git.resolverExecutableSha256 === null) &&
    runtime.git.invocationEnvironmentSha256 ===
      runtime.executionEnvironment.environmentSha256 &&
    NODE_VERSION.test(runtime.node.version) &&
    NPM_VERSION.test(runtime.npm.version) &&
    PYTHON_VERSION.test(runtime.python.version) &&
    runtime.python.installedDistributionsManifestSchema ===
      "canonical-name-version-files-record-sha256-v1" &&
    runtime.browser.playwrightVersion === "1.56.1" &&
    [
      runtime.workspace.packagesTreeEntryCount,
      runtime.workspace.installedDependenciesTreeEntryCount,
      runtime.workspace.compiledOutputTreeEntryCount,
      runtime.python.environmentTreeEntryCount,
      runtime.python.runtimeTreeEntryCount,
      runtime.python.stdlibTreeEntryCount,
      runtime.browser.libraryTreeEntryCount,
      runtime.browser.coreLibraryTreeEntryCount,
      runtime.git.execPathTreeEntryCount,
    ].every((count) => Number.isSafeInteger(count) && count > 0) &&
    Number.isSafeInteger(runtime.git.externalHelperTargetCount) &&
    runtime.git.externalHelperTargetCount >= 0 &&
    runtime.executionLease.schemaVersion ===
      "pm.public-eval-corners.sentinel-runtime-execution-lease.v1" &&
    runtime.executionLease.exactBoundPathsRequired === true &&
    runtime.executionLease.preAndPostBlockReconstructionRequired === true &&
    runtime.executionLease.mutationInvalidatesBlock === true &&
    runtime.executionLease.immutableSnapshot === false &&
    runtime.executionLease.osBoundaryLimitation ===
      "kernel-dynamic-loader-system-libraries-and-in-process-races-outside-user-space-hash-closure" &&
    [
      runtime.git.executablePath,
      runtime.git.launcherPath,
      runtime.git.execPathRootPath,
      runtime.workspace.checkoutPath,
      runtime.workspace.packagesRootPath,
      runtime.workspace.installedDependenciesRootPath,
      runtime.workspace.compiledOutputRootPath,
      runtime.node.requestedPath,
      runtime.node.resolvedPath,
      runtime.npm.requestedCliPath,
      runtime.npm.resolvedCliPath,
      runtime.python.requestedVenvPath,
      runtime.python.resolvedExecutablePath,
      runtime.python.environmentRootPath,
      runtime.python.runtimeRootPath,
      runtime.python.stdlibRootPath,
      runtime.browser.bundleRootPath,
      runtime.browser.executablePath,
      runtime.browser.libraryRootPath,
      runtime.browser.coreLibraryRootPath,
    ].every((path) => ABSOLUTE_PATH.test(path))
    && runtime.closureSha256 === sentinelProductionRuntimeClosureSha256(runtime)
  );
}

function validPoweredConfirmatoryUniverse(
  universe: SentinelPoweredConfirmatoryUniverse,
  excludedTaskIds: ReadonlySet<string>,
): boolean {
  if (universe.status === "not-frozen") {
    return sameJson(universe, SENTINEL_UNFROZEN_POWERED_CONFIRMATORY_UNIVERSE);
  }
  const power = universe.powerAnalysis;
  const taskIds = universe.tasks.map(({ taskId }) => taskId);
  const stateFailureTaskCount = universe.tasks.filter(
    ({ role }) => role === "state-retention-relative",
  ).length;
  const expectedAllowTaskCount = universe.tasks.filter(
    ({ role }) => role === "expected-allow-absolute",
  ).length;
  const noopTaskCount = universe.tasks.filter(
    ({ role }) => role === "anti-degenerate-noop",
  ).length;
  const poweredEnvironments = [
    "microchat",
    "microdin",
    "microfy",
    "microgram",
    "microlendar",
  ] as const;
  const environmentCountsValid = poweredEnvironments.every(
    (environment) =>
      universe.tasks.filter((registeredTask) => registeredTask.environment === environment).length ===
      10,
  );
  return (
    universe.status === "frozen" &&
    universe.purpose === "future-powered-confirmatory-outcome" &&
    universe.efficacyEligibleAfterExternalVerification === true &&
    universe.manifestSha256 === SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256 &&
    sentinelProductionTaskManifestSha256(universe.tasks) === universe.manifestSha256 &&
    universe.fullCatalogSha256 === SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256 &&
    universe.fullCatalogHashSchema ===
      "canonical-json-array-sorted-by-task-id-all-registration-fields-v1" &&
    sentinelProductionFullTaskCatalogSha256(universe.tasks) === universe.fullCatalogSha256 &&
    universe.expectedTaskCount === 50 &&
    sameJson(universe.expectedEnvironmentCounts, {
      microchat: 10,
      microdin: 10,
      microfy: 10,
      microgram: 10,
      microlendar: 10,
    }) &&
    sameJson(universe.expectedRoleCounts, {
      stateRetentionRelative: 19,
      expectedAllowAbsolute: 21,
      antiDegenerateNoop: 10,
    }) &&
    universe.selectionProtocolSha256 !== null &&
    SHA256.test(universe.selectionProtocolSha256) &&
    universe.tasks.length === 50 &&
    environmentCountsValid &&
    stateFailureTaskCount === 19 &&
    expectedAllowTaskCount === 21 &&
    noopTaskCount === 10 &&
    new Set(taskIds).size === taskIds.length &&
    taskIds.every((taskId) => ID.test(taskId) && !excludedTaskIds.has(taskId)) &&
    universe.tasks.every(
      (registeredTask) =>
        registeredTask.taskId.startsWith(`${registeredTask.environment}-`) &&
        SHA256.test(registeredTask.scenarioSha256) &&
        registeredTask.eventTimelineEndSeconds === 720 &&
        registeredTask.killAtSeconds === 630 &&
        registeredTask.taxonomy.criteria === "objective" &&
        registeredTask.taxonomy.eventPersistence === "persistent" &&
        ["active", "passive"].includes(registeredTask.taxonomy.monitoringApproach) &&
        ["easy", "medium", "hard"].includes(registeredTask.taxonomy.difficulty) &&
        ["low", "medium", "high"].includes(registeredTask.taxonomy.distractionLevel) &&
        (registeredTask.conditionAtSeconds === null ||
          (Number.isFinite(registeredTask.conditionAtSeconds) && registeredTask.conditionAtSeconds >= 0)) &&
        ((registeredTask.role === "state-retention-relative" &&
          registeredTask.taxonomy.milestoneType === "relative" &&
          registeredTask.conditionAtSeconds !== null) ||
          (registeredTask.role === "expected-allow-absolute" &&
            registeredTask.taxonomy.milestoneType === "absolute" &&
            registeredTask.conditionAtSeconds !== null) ||
          (registeredTask.role === "anti-degenerate-noop" &&
            registeredTask.conditionAtSeconds === null)),
    ) &&
    power.justificationSha256 !== null &&
    SHA256.test(power.justificationSha256) &&
    power.calculationArtifactSha256 !== null &&
    SHA256.test(power.calculationArtifactSha256) &&
    power.calculationProcedureSha256 !== null &&
    SHA256.test(power.calculationProcedureSha256) &&
    power.calculationVerifierSha256 !== null &&
    SHA256.test(power.calculationVerifierSha256) &&
    power.assumptionSetSha256 !== null &&
    SHA256.test(power.assumptionSetSha256) &&
    power.analysisProcedureSha256 === SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256 &&
    power.targetPower !== null &&
    power.targetPower >= 0.8 &&
    power.targetPower < 1 &&
    power.declaredPower !== null &&
    power.declaredPower >= power.targetPower &&
    power.declaredPower <= 1 &&
    power.minimumDetectablePointLift === 0.1 &&
    power.independentTaskCount === 19 &&
    power.repeatsPerTask === 3 &&
    power.familywiseAlpha === 0.05 &&
    power.externalPowerCalculationVerificationRequired === true &&
    power.externalPowerCalculationVerified === true &&
    power.minimumIndependentStateFailureTasks !== null &&
    Number.isInteger(power.minimumIndependentStateFailureTasks) &&
    power.minimumIndependentStateFailureTasks === 19 &&
    stateFailureTaskCount >= power.minimumIndependentStateFailureTasks &&
    power.analysisUnit === "task-clustered" &&
    power.taskClusteredConfidenceIntervals === true &&
    power.confidenceIntervalMustExcludeZero === true
  );
}

export function verifySentinelProductionPreregistration(
  preregistration: unknown,
  signature: unknown,
  trustAnchor: SentinelExternalTrustAnchor,
): SentinelProductionPlanVerification {
  const shapeIssues = validateExactShape(preregistration, signature);
  const issues = [...shapeIssues];
  let preregistrationSha256 = "";
  try {
    preregistrationSha256 = sentinelProductionJsonSha256(preregistration);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  if (!SHA256.test(trustAnchor.expectedPreregistrationSha256)) {
    issues.push("out-of-band preregistration hash is invalid");
  } else if (preregistrationSha256 !== trustAnchor.expectedPreregistrationSha256) {
    issues.push("preregistration does not match the out-of-band expected hash");
  }
  if (!ID.test(trustAnchor.expectedAuthorityId)) issues.push("expected external authority ID is invalid");
  if (!SHA256.test(trustAnchor.expectedAuthorityPublicKeySha256)) {
    issues.push("expected external authority key hash is invalid");
  }

  let cells: readonly SentinelProductionCell[] = [];
  if (shapeIssues.length > 0) {
    return {
      valid: false,
      preregistrationSha256,
      signatureValid: false,
      externallyAnchored: false,
      cells,
      issues,
    };
  }

  const plan = preregistration as SentinelProductionPreregistration;
  const signed = signature as SentinelProductionSignature;
  if (plan.schemaVersion !== "pm.public-eval-corners.sentinel-production-preregistration.v1") {
    issues.push("unsupported preregistration schemaVersion");
  }
  if (
    !ID.test(plan.registration.registrationId) ||
    !ID.test(plan.registration.producerId) ||
    !canonicalIso(plan.registration.registeredAt) ||
    !["qualification", "procedural-holdout", "powered-confirmatory"].includes(
      plan.registration.selectedPhase,
    )
  ) {
    issues.push("registration identity, time, or selected phase is invalid");
  }
  if (plan.objective !== SENTINEL_PRODUCTION_OWNER_OBJECTIVE) issues.push("owner objective changed");
  if (
    plan.benchmark.repositoryUrl !== SENTINEL_PRODUCTION_REPOSITORY ||
    plan.benchmark.revision !== SENTINEL_PRODUCTION_REVISION ||
    plan.benchmark.sourceTreeHash !== SENTINEL_PRODUCTION_SOURCE_TREE ||
    plan.benchmark.speedFactor !== 1 ||
    plan.benchmark.publishedDefaultSpeedFactor !== 1 ||
    plan.benchmark.attemptTimeoutMs !== 720_000
  ) {
    issues.push("benchmark source, speed, or duration pin changed");
  }
  const qualification = plan.benchmark.universes.qualification;
  const proceduralHoldout = plan.benchmark.universes.proceduralHoldout;
  const poweredConfirmatory = plan.benchmark.universes.poweredConfirmatory;
  if (
    qualification.purpose !== "harness-and-mechanism-qualification-only" ||
    qualification.efficacyEligible !== false ||
    qualification.manifestSha256 !== SENTINEL_QUALIFICATION_MANIFEST_SHA256 ||
    sentinelProductionTaskManifestSha256(qualification.tasks) !== SENTINEL_QUALIFICATION_MANIFEST_SHA256 ||
    !sameJson(qualification.tasks, SENTINEL_QUALIFICATION_TASKS)
  ) {
    issues.push("qualification-only MicroHub universe changed");
  }
  if (
    proceduralHoldout.purpose !== "frozen-procedural-engineering-validation-only" ||
    proceduralHoldout.efficacyEligible !== false ||
    proceduralHoldout.manifestSha256 !== SENTINEL_HELDOUT_MANIFEST_SHA256 ||
    sentinelProductionTaskManifestSha256(proceduralHoldout.tasks) !== SENTINEL_HELDOUT_MANIFEST_SHA256 ||
    !sameJson(proceduralHoldout.tasks, SENTINEL_HELDOUT_TASKS)
  ) {
    issues.push("frozen 12-task procedural holdout changed or was promoted to efficacy");
  }
  const qualificationIds = new Set(qualification.tasks.map(({ taskId }) => taskId));
  if (proceduralHoldout.tasks.some(({ taskId }) => qualificationIds.has(taskId))) {
    issues.push("qualification and procedural holdout task universes overlap");
  }
  const excludedPoweredIds = new Set([
    ...qualificationIds,
    ...proceduralHoldout.tasks.map(({ taskId }) => taskId),
  ]);
  if (!validPoweredConfirmatoryUniverse(poweredConfirmatory, excludedPoweredIds)) {
    issues.push("powered confirmatory universe lacks a separate frozen catalog and power plan");
  }
  if (
    plan.registration.selectedPhase === "powered-confirmatory" &&
    poweredConfirmatory.status !== "frozen"
  ) {
    issues.push("powered-confirmatory cannot run before its universe and power analysis are frozen");
  }
  if (
    !sameJson(plan.execution.arms, PRODUCTION_ARMS) ||
    plan.execution.repeatIds.length !== 3 ||
    new Set(plan.execution.repeatIds).size !== 3 ||
    plan.execution.repeatIds.some((repeatId) => !ID.test(repeatId)) ||
    !ID.test(plan.execution.randomizationSeed) ||
    plan.execution.blockUnit !== "task-by-repeat" ||
    plan.execution.armsContiguousWithinBlock !== true ||
    plan.execution.noAutomaticRetries !== true ||
    plan.execution.noCellReruns !== true ||
    plan.execution.noTaskReplacements !== true ||
    plan.execution.executeEveryDeclaredCell !== true ||
    plan.execution.rawOutcomesUninterpretedDuringExecution !== true ||
    plan.execution.behavioralFailuresRetained !== true ||
    plan.execution.infrastructureFailuresRetainedAndBatchIncomplete !== true
  ) {
    issues.push("execution universe, zero-retry rule, or outcome-blind stopping rule changed");
  }
  if (!sameJson(plan.controls, createSentinelProductionPreregistration({
    registrationId: "shape",
    registeredAt: "2026-01-01T00:00:00.000Z",
    producerId: "shape",
    selectedPhase: "qualification",
    repeatIds: ["a", "b", "c"],
    randomizationSeed: "shape",
    systemPromptSha256: "0".repeat(64),
    actionSchemaSha256: "1".repeat(64),
    runtime: plan.runtime,
    bootstrapSeed: "shape-bootstrap-seed",
    rawBatchVerifierId: "shape-verifier",
    rawBatchVerifierRevision: "0".repeat(40),
    rawBatchVerifierSha256: plan.runtime.verifierScriptSha256,
  }).controls)) {
    issues.push("matched controls or plain-KV comparator changed");
  }
  const fixed = createSentinelProductionPreregistration({
    registrationId: "shape",
    registeredAt: "2026-01-01T00:00:00.000Z",
    producerId: "shape",
    selectedPhase: "qualification",
    repeatIds: ["a", "b", "c"],
    randomizationSeed: "shape",
    systemPromptSha256: "0".repeat(64),
    actionSchemaSha256: "1".repeat(64),
    runtime: plan.runtime,
    bootstrapSeed: "shape-bootstrap-seed",
    rawBatchVerifierId: "shape-verifier",
    rawBatchVerifierRevision: "0".repeat(40),
    rawBatchVerifierSha256: plan.runtime.verifierScriptSha256,
  });
  if (!sameJson(plan.phaseSeparation, fixed.phaseSeparation)) issues.push("phase separation changed");
  if (
    plan.model.provider !== "anthropic" ||
    plan.model.endpoint !== "https://api.anthropic.com/v1/messages" ||
    plan.model.apiVersion !== "2023-06-01" ||
    plan.model.model !== "claude-sonnet-4-5-20250929" ||
    plan.model.temperature !== 0 ||
    plan.model.maxCompletionTokens !== 256 ||
    plan.model.automaticRetries !== 0 ||
    plan.model.providerSeed !== "unsupported" ||
    !SHA256.test(plan.model.systemPromptSha256) ||
    !SHA256.test(plan.model.actionSchemaSha256)
  ) {
    issues.push("model, prompt, schema, or retry pin changed");
  }
  try {
    if (!validRuntime(plan.runtime)) issues.push("runtime closure is incomplete or invalid");
  } catch {
    issues.push("runtime closure is incomplete or invalid");
  }
  if (!sameJson(plan.evidence, fixed.evidence)) issues.push("raw evidence requirements changed");
  if (
    plan.analysis.primaryOutcome !== "unchanged-upstream-strict-task-success" ||
    !sameJson(plan.analysis.procedure, SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE) ||
    plan.analysis.procedureSha256 !== SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256 ||
    !ID.test(plan.analysis.bootstrapSeed) ||
    !ID.test(plan.analysis.rawBatchVerifier.verifierId) ||
    !GIT_SHA1.test(plan.analysis.rawBatchVerifier.verifierRevision) ||
    !SHA256.test(plan.analysis.rawBatchVerifier.verifierScriptSha256) ||
    plan.analysis.rawBatchVerifier.verifierScriptSha256 !== plan.runtime.verifierScriptSha256 ||
    plan.analysis.rawBatchVerifier.derivesOutcomesFromRaw !== true ||
    plan.analysis.rawBatchVerifier.acceptsCallerOutcomeBooleans !== false ||
    plan.analysis.qualificationMaterialBenefit !== false ||
    plan.analysis.proceduralHoldoutMaterialBenefit !== false ||
    plan.analysis.planningMaterialBenefit !== false ||
    plan.analysis.reportAllCellsWithoutTaskOrRepeatShopping !== true
  ) {
    issues.push("predeclared raw-derived analysis procedure or verifier identity changed");
  }
  if (!sameJson(plan.eligibility, fixed.eligibility)) issues.push("external eligibility boundary changed");

  let signatureValid = false;
  let externallyAnchored = false;
  try {
    const key = createPublicKey(signed.publicKeyPem);
    const signatureBytes = Buffer.from(signed.signatureBase64, "base64");
    externallyAnchored =
      signed.authority.authorityId === trustAnchor.expectedAuthorityId &&
      signed.publicKeySha256 === trustAnchor.expectedAuthorityPublicKeySha256 &&
      signed.publicKeySha256 === sentinelProductionSha256(signed.publicKeyPem) &&
      signed.authority.ownerId !== plan.registration.producerId &&
      signed.authority.independent === true;
    signatureValid =
      signed.schemaVersion === "pm.public-eval-corners.sentinel-production-signature.v1" &&
      signed.preregistrationSha256 === preregistrationSha256 &&
      signed.algorithm === "Ed25519" &&
      ID.test(signed.authority.authorityId) &&
      ID.test(signed.authority.ownerId) &&
      canonicalIso(signed.authority.signedAt) &&
      Date.parse(signed.authority.signedAt) >= Date.parse(plan.registration.registeredAt) &&
      key.asymmetricKeyType === "ed25519" &&
      BASE64_ED25519_SIGNATURE.test(signed.signatureBase64) &&
      signatureBytes.length === 64 &&
      externallyAnchored &&
      verifySignature(
        null,
        Buffer.from(preregistrationSha256, "hex"),
        key,
        signatureBytes,
      );
  } catch {
    signatureValid = false;
  }
  if (!externallyAnchored) issues.push("signature is not bound to the out-of-band external authority");
  if (!signatureValid) issues.push("external Ed25519 preregistration signature is invalid");

  try {
    cells = buildSentinelProductionSchedule(plan);
    const expectedCellCount = selectedTasks(plan).length * plan.execution.repeatIds.length * 4;
    if (
      cells.length !== expectedCellCount ||
      new Set(cells.map(({ cellId }) => cellId)).size !== cells.length
    ) {
      issues.push("schedule does not cover the unique exact selected-phase cell universe");
    }
    for (let index = 0; index < cells.length; index += 4) {
      const block = cells.slice(index, index + 4);
      if (
        new Set(block.map(({ taskId }) => taskId)).size !== 1 ||
        new Set(block.map(({ repeatId }) => repeatId)).size !== 1 ||
        !sameJson(block.map(({ arm }) => arm).sort(compareCodeUnits), [...PRODUCTION_ARMS].sort(compareCodeUnits))
      ) {
        issues.push("schedule does not keep randomized arms contiguous inside task-by-repeat blocks");
        break;
      }
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return {
    valid: issues.length === 0,
    preregistrationSha256,
    signatureValid,
    externallyAnchored,
    cells,
    issues,
  };
}

export interface SentinelProductionPlanningDisposition {
  readonly acceptsOutcomes: false;
  readonly materialBenefit: false;
  readonly nextAuthority: "raw-batch-verifier";
  readonly analysisProcedureSha256: string;
  readonly rawBatchVerifierId: string;
  readonly rawBatchVerifierRevision: string;
  readonly rawBatchVerifierSha256: string;
}

/**
 * Planning is deliberately outcome-blind. Only the separately pinned raw-batch
 * verifier may derive task outcomes and apply the frozen clustered procedure.
 */
export function sentinelProductionPlanningDisposition(
  plan: SentinelProductionPreregistration,
): SentinelProductionPlanningDisposition {
  return {
    acceptsOutcomes: false,
    materialBenefit: false,
    nextAuthority: "raw-batch-verifier",
    analysisProcedureSha256: plan.analysis.procedureSha256,
    rawBatchVerifierId: plan.analysis.rawBatchVerifier.verifierId,
    rawBatchVerifierRevision: plan.analysis.rawBatchVerifier.verifierRevision,
    rawBatchVerifierSha256: plan.analysis.rawBatchVerifier.verifierScriptSha256,
  };
}
