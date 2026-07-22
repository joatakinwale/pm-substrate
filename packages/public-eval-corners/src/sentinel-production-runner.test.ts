import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
} from "./sentinel-general-provider-proxy.js";
import {
  buildSentinelRuntimeSanitizedEnvironment,
  buildSentinelProductionSchedule,
  createSentinelProductionPreregistration,
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionRuntimeClosureSha256,
  sentinelProductionSha256,
  type SentinelExternalTrustAnchor,
  type SentinelProductionPreregistration,
  type SentinelProductionSignature,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  runSentinelProductionBatch,
  runSentinelProductionExcludedSmoke,
  type SentinelProductionCheckoutPreflight,
  type SentinelProductionDiagnosticRunInput,
  type SentinelProductionExternalCommitment,
  type SentinelProductionRunInput,
  type SentinelProductionRuntimeInspection,
  type SentinelProductionRunnerDependencies,
} from "./sentinel-production-runner.js";
import { verifySentinelProductionRawBatch } from "./sentinel-production-verifier.js";
import { createSentinelProductionRuntimeLeaseIdentity } from "./sentinel-production-runner-evidence.js";
import type { SentinelProductionAttemptTerminalReceipt } from "./sentinel-production-supervisor.js";

const roots: string[] = [];
function makeRemovable(path: string): void {
  const stat = lstatSync(path);
  if (stat.isDirectory()) {
    chmodSync(path, 0o700);
    for (const name of readdirSync(path)) makeRemovable(resolve(path, name));
  } else chmodSync(path, 0o600);
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    makeRemovable(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function hash(character: string): string { return character.repeat(64); }
function freshRoot(): string {
  const root = mkdtempSync(resolve(realpathSync(tmpdir()), "pm-sentinel-production-runner-"));
  roots.push(root);
  return root;
}
function artifact(path: string, contents: string): { readonly path: string; readonly sha256: string } {
  writeFileSync(path, contents, { mode: 0o700 });
  return { path, sha256: sentinelProductionSha256(contents) };
}

interface FixtureRuntime {
  readonly closure: SentinelRuntimeClosure;
  readonly paths: SentinelProductionRunInput["runtime"]["paths"];
}

function runtime(root: string): FixtureRuntime {
  const node = artifact(resolve(root, "node"), "node-runtime");
  const npm = artifact(resolve(root, "npm-cli.js"), "npm-runtime");
  const python = artifact(resolve(root, "python"), "python-runtime");
  const agent = artifact(resolve(root, "sentinel-general-agent.js"), "agent-runtime");
  const dummy = artifact(resolve(root, "dummy"), "dummy");
  const sanitizedEnvironment = buildSentinelRuntimeSanitizedEnvironment(node.path);
  const closureWithoutHash: SentinelRuntimeClosure = {
    closureSha256: hash("0"),
    closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v2",
    closureDerivation: "canonical-runtime-and-transitive-tree-fields-v2",
    requestedEntryHashSemantics: "sha256-of-symlink-target-utf8-or-regular-file-bytes-v1",
    treeHashSemantics: "sha256-canonical-relative-path-mode-type-contenthash-v1",
    runnerReconstructsAndVerifiesClosure: true,
    substrateRevision: "1".repeat(40),
    sourceTreeHash: "2".repeat(40),
    workingTreeClean: true,
    pnpmWorkspaceLockSha256: hash("3"),
    runnerScriptSha256: hash("4"),
    supervisorScriptSha256: hash("5"),
    verifierScriptSha256: hash("6"),
    agentScriptSha256: agent.sha256,
    providerProxyScriptSha256: hash("8"),
    stateSidecarScriptSha256: hash("9"),
    executionEnvironment: {
      schemaVersion: "pm.public-eval-corners.sentinel-sanitized-environment.v2",
      values: sanitizedEnvironment,
      environmentSha256: sentinelProductionJsonSha256(sanitizedEnvironment),
      inheritsHostEnvironment: false,
    },
    git: {
      version: "git version 2.42.0",
      executablePath: "/usr/bin/git",
      executableSha256: hash("a"),
      invocationEnvironmentSha256: sentinelProductionJsonSha256(sanitizedEnvironment),
    },
    workspace: {
      checkoutPath: root,
      rootPackageJsonSha256: hash("b"),
      pnpmWorkspaceManifestSha256: hash("c"),
      rootTsconfigSha256: hash("d"),
      tsconfigBaseSha256: hash("e"),
      publicEvalPackageManifestSha256: hash("f"),
      publicEvalTsconfigSha256: hash("0"),
      packagesRootPath: root,
      packagesTreeSha256: hash("1"),
      packagesTreeEntryCount: 10,
      installedDependenciesRootPath: root,
      installedDependenciesTreeSha256: hash("2"),
      installedDependenciesTreeEntryCount: 20,
      compiledOutputRootPath: root,
      compiledOutputTreeSha256: hash("3"),
      compiledOutputTreeEntryCount: 30,
    },
    node: {
      version: "v26.0.0",
      requestedPath: node.path,
      requestedEntrySha256: node.sha256,
      resolvedPath: node.path,
      resolvedExecutableSha256: node.sha256,
    },
    npm: {
      version: "11.0.0",
      requestedCliPath: npm.path,
      requestedCliEntrySha256: npm.sha256,
      resolvedCliPath: npm.path,
      resolvedCliSha256: npm.sha256,
    },
    python: {
      version: "Python 3.12.13",
      requestedVenvPath: python.path,
      venvEntrySha256: python.sha256,
      resolvedExecutablePath: python.path,
      realExecutableSha256: python.sha256,
      pyvenvConfigSha256: hash("0"),
      pipFreezeSha256: hash("1"),
      installedDistributionsManifestSha256: hash("2"),
      installedDistributionsManifestSchema: "canonical-name-version-files-record-sha256-v1",
      environmentRootPath: root,
      environmentTreeSha256: hash("3"),
      environmentTreeEntryCount: 40,
      runtimeRootPath: root,
      runtimeTreeSha256: hash("4"),
      runtimeTreeEntryCount: 50,
      stdlibRootPath: root,
      stdlibTreeSha256: hash("5"),
      stdlibTreeEntryCount: 60,
    },
    browser: {
      playwrightVersion: "1.56.1",
      packageMetadataSha256: hash("3"),
      bundleRootPath: root,
      bundleTreeSha256: hash("4"),
      executablePath: dummy.path,
      executableSha256: dummy.sha256,
      libraryRootPath: root,
      libraryTreeSha256: hash("6"),
      libraryTreeEntryCount: 70,
      coreLibraryRootPath: root,
      coreLibraryTreeSha256: hash("7"),
      coreLibraryTreeEntryCount: 80,
      corePackageMetadataSha256: hash("8"),
    },
    upstream: {
      frontendPackageLockSha256: hash("6"),
      frontendInstalledTreeSha256: hash("7"),
      serverRequirementsSha256: hash("8"),
    },
    executionLease: {
      schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1",
      boundPathsManifestSha256: hash("9"),
      exactBoundPathsRequired: true,
      preAndPostBlockReconstructionRequired: true,
      mutationInvalidatesBlock: true,
      immutableSnapshot: false,
      osBoundaryLimitation:
        "kernel-dynamic-loader-system-libraries-and-in-process-races-outside-user-space-hash-closure",
    },
  };
  const closure = {
    ...closureWithoutHash,
    closureSha256: sentinelProductionRuntimeClosureSha256(closureWithoutHash),
  };
  return {
    closure,
    paths: {
      gitExecutablePath: "/usr/bin/git",
      substrateCheckoutPath: root,
      rootPackageJsonPath: dummy.path,
      pnpmWorkspaceManifestPath: dummy.path,
      rootTsconfigPath: dummy.path,
      tsconfigBasePath: dummy.path,
      publicEvalPackageJsonPath: dummy.path,
      publicEvalTsconfigPath: dummy.path,
      substratePackagesRootPath: root,
      substrateInstalledDependenciesRootPath: root,
      publicEvalCompiledOutputRootPath: root,
      pnpmWorkspaceLockPath: dummy.path,
      runnerScriptPath: dummy.path,
      supervisorScriptPath: dummy.path,
      verifierScriptPath: dummy.path,
      agentScriptPath: agent.path,
      providerProxyScriptPath: dummy.path,
      stateSidecarScriptPath: dummy.path,
      nodeRequestedPath: node.path,
      nodeAllowedRootPath: root,
      npmRequestedCliPath: npm.path,
      npmAllowedRootPath: root,
      pythonRequestedVenvPath: python.path,
      pythonEnvironmentRootPath: root,
      pythonRuntimeRootPath: root,
      pythonStdlibRootPath: root,
      pythonExecutableAllowedRootPath: root,
      pythonPyvenvConfigPath: dummy.path,
      pythonSitePackagesRootPaths: [root],
      playwrightPackageMetadataPath: dummy.path,
      playwrightCorePackageMetadataPath: dummy.path,
      playwrightLibraryRootPath: root,
      playwrightCoreLibraryRootPath: root,
      browserBundleRootPath: root,
      browserExecutablePath: dummy.path,
      upstreamCheckoutPath: root,
      upstreamFrontendPackageLockPath: dummy.path,
      upstreamFrontendInstalledRootPath: root,
      upstreamServerRequirementsPath: dummy.path,
    },
  };
}

function plan(runtimeFixture: FixtureRuntime): SentinelProductionPreregistration {
  const created = createSentinelProductionPreregistration({
    registrationId: "sentinel-qualification-runner-test",
    registeredAt: "2026-07-14T22:00:00.000Z",
    producerId: "joat-labs-producer",
    selectedPhase: "qualification",
    repeatIds: ["repeat-01", "repeat-02", "repeat-03"],
    randomizationSeed: "sentinel-qualification-runner-seed",
    systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
    actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    runtime: runtimeFixture.closure,
    bootstrapSeed: "sentinel-qualification-bootstrap-seed",
    rawBatchVerifierId: "sentinel-raw-batch-verifier-v1",
    rawBatchVerifierRevision: "7".repeat(40),
    rawBatchVerifierSha256: runtimeFixture.closure.verifierScriptSha256,
  });
  return created;
}

function signed(
  preregistration: SentinelProductionPreregistration,
  ownerId = "independent-verification-owner",
): { readonly signature: SentinelProductionSignature; readonly trustAnchor: SentinelExternalTrustAnchor } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const preregistrationSha256 = sentinelProductionJsonSha256(preregistration);
  const publicKeySha256 = sentinelProductionSha256(publicKeyPem);
  return {
    signature: {
      schemaVersion: "pm.public-eval-corners.sentinel-production-signature.v1",
      preregistrationSha256,
      algorithm: "Ed25519",
      authority: {
        authorityId: "sentinel-independent-authority",
        ownerId,
        independent: true,
        signedAt: "2026-07-14T22:01:00.000Z",
      },
      publicKeyPem,
      publicKeySha256,
      signatureBase64: signBytes(
        null,
        Buffer.from(preregistrationSha256, "hex"),
        privateKey,
      ).toString("base64"),
    },
    trustAnchor: {
      expectedPreregistrationSha256: preregistrationSha256,
      expectedAuthorityId: "sentinel-independent-authority",
      expectedAuthorityPublicKeySha256: publicKeySha256,
    },
  };
}

function commitment(
  anchor: SentinelExternalTrustAnchor,
): SentinelProductionExternalCommitment {
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment.v1" as const,
    medium: "independent-append-only-external-record" as const,
    commitmentId: "external-commitment-20260714",
    committedAt: "2026-07-14T22:02:00.000Z",
    custodianId: "external-custodian",
    custodianOwnerId: "separate-custodian-owner",
    independent: true as const,
    locator: "https://evidence.example.test/sentinel/commitment-20260714",
    expectedPreregistrationSha256: anchor.expectedPreregistrationSha256,
    expectedAuthorityId: anchor.expectedAuthorityId,
    expectedAuthorityPublicKeySha256: anchor.expectedAuthorityPublicKeySha256,
  };
  return { ...body, receiptSha256: sentinelProductionJsonSha256(body) };
}

interface HarnessOptions {
  readonly mismatchedRootArm?: "substrate";
  readonly duplicatePorts?: boolean;
  readonly throwSupervisorCall?: number;
  readonly failStateStopCall?: number;
  readonly smuggleOutcomeCall?: number;
  readonly nowBeforeSignature?: boolean;
  readonly duplicateAttemptIds?: boolean;
  readonly externalRecordInvalid?: boolean;
  readonly externalBodyMismatch?: boolean;
  readonly externalResponseUrlMismatch?: boolean;
  readonly externalMetadataMutation?: "content-type" | "future-time" | "hash" | "redirect" | "status";
  readonly invalidRuntimeInspectionCall?: number;
  readonly tamperedRuntimeArtifact?: boolean;
  readonly startSkewMs?: number;
  readonly diagnosticExecutionId?: string;
}

function fixture(options: HarnessOptions = {}): {
  readonly input: SentinelProductionRunInput;
  readonly dependencies: SentinelProductionRunnerDependencies;
  readonly supervisorInputs: unknown[];
  readonly root: string;
} {
  const root = freshRoot();
  const runtimeFixture = runtime(root);
  const preregistration = plan(runtimeFixture);
  const signedPlan = signed(preregistration);
  const checkoutPaths = {
    native: resolve(root, "checkout-native"),
    sham: resolve(root, "checkout-sham"),
    "plain-kv": resolve(root, "checkout-plain"),
    substrate: resolve(root, "checkout-substrate"),
  } as const;
  Object.values(checkoutPaths).forEach((path) => mkdirSync(path));
  const input: SentinelProductionRunInput = {
    preregistration,
    signature: signedPlan.signature,
    trustAnchor: signedPlan.trustAnchor,
    externalCommitment: commitment(signedPlan.trustAnchor),
    checkouts: checkoutPaths,
    batchRoot: resolve(root, "batch"),
    attemptRegistryRoot: resolve(root, "registry"),
    runtime: { paths: runtimeFixture.paths },
    databaseUrl: "postgres://secret-database-url",
    anthropicApiKey: "secret-anthropic-api-key",
  };
  let nowIndex = 0;
  let portBase = 20_000;
  let opaqueIndex = 0;
  let supervisorCall = 0;
  let stateStopCall = 0;
  let runtimeInspectionCall = 0;
  const supervisorInputs: unknown[] = [];
  let pendingSupervisors: {
    readonly call: number;
    readonly resolve: (value: SentinelProductionAttemptTerminalReceipt) => void;
    readonly reject: (error: Error) => void;
    readonly receipt: SentinelProductionAttemptTerminalReceipt;
  }[] = [];
  const inspectCheckout = (checkoutPath: string): SentinelProductionCheckoutPreflight => {
    const arm = Object.entries(checkoutPaths).find(([, path]) => path === checkoutPath)?.[0];
    const body = {
      schemaVersion: "pm.public-eval-corners.sentinel-production-checkout-preflight.v1" as const,
      checkoutPath,
      repositoryUrl: "https://github.com/microsoft/sentinel_environments",
      revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
      sourceTreeHash: "3ca2dc7160e505dc15b607ada4dd9ffe1f6a7c50",
      cleanTrackedAndUntracked: true,
      ignoredArtifactRootSha256: hash("a"),
      databaseRootSha256:
        options.mismatchedRootArm === arm ? hash("b") : hash("c"),
      selectedScenarioRootSha256: hash("d"),
      frontendInstalledTreeSha256: runtimeFixture.closure.upstream.frontendInstalledTreeSha256,
      frontendPackageLockSha256: runtimeFixture.closure.upstream.frontendPackageLockSha256,
      serverRequirementsSha256: runtimeFixture.closure.upstream.serverRequirementsSha256,
      valid: true,
      issues: [] as readonly string[],
    };
    return { ...body, preflightSha256: sentinelProductionJsonSha256(body) };
  };
  const artifactBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v3" as const,
    fixtureIdentity: runtimeFixture.closure.closureSha256,
  };
  const runtimeArtifacts = {
    ...artifactBody,
    derivationSha256: options.tamperedRuntimeArtifact
      ? hash("f")
      : sentinelProductionJsonSha256(artifactBody),
  } as unknown as NonNullable<SentinelProductionRuntimeInspection["artifacts"]>;
  const runtimeLeaseIdentity = createSentinelProductionRuntimeLeaseIdentity(
    runtimeFixture.paths,
    runtimeFixture.closure,
    runtimeArtifacts,
  );
  const dependencies: SentinelProductionRunnerDependencies = {
    now: () => {
      if (options.nowBeforeSignature) return "2026-07-14T22:00:30.000Z";
      const value = new Date(Date.parse("2026-07-14T22:03:00.000Z") + nowIndex * 1_000);
      nowIndex += 1;
      return value.toISOString();
    },
    verifyExternalCommitmentRecord: async (record) => {
      const retained = options.externalBodyMismatch ? { ...record, commitmentId: "substituted" } : record;
      const bytes = Buffer.from(JSON.stringify(retained));
      return {
        valid: !options.externalRecordInvalid,
        locator: record.locator,
        responseUrl: options.externalResponseUrlMismatch
          ? "https://evidence.example.test/substituted"
          : record.locator,
        redirected: options.externalMetadataMutation === "redirect",
        httpStatus: options.externalMetadataMutation === "status" ? 206 : 200,
        contentType: options.externalMetadataMutation === "content-type"
          ? "text/plain"
          : "application/json; charset=utf-8",
        observedAt: options.externalMetadataMutation === "future-time"
          ? "2026-07-14T23:03:00.000Z"
          : "2026-07-14T22:03:02.000Z",
        responseByteLength: bytes.byteLength,
        responseSha256: options.externalMetadataMutation === "hash"
          ? hash("f")
          : sentinelProductionSha256(bytes),
        responseBodyBase64: bytes.toString("base64"),
        issues: options.externalRecordInvalid ? ["external receipt unavailable"] : [],
      };
    },
    inspectRuntime: () => {
      runtimeInspectionCall += 1;
      const valid = runtimeInspectionCall !== options.invalidRuntimeInspectionCall;
      return {
        valid,
        closure: runtimeFixture.closure,
        closureSha256: runtimeFixture.closure.closureSha256,
        executableIdentitySha256: hash("e"),
        artifacts: valid ? runtimeArtifacts : null,
        executionLeaseIdentity: valid ? runtimeLeaseIdentity : null,
        issues: valid ? [] : ["synthetic runtime mutation"],
      };
    },
    inspectCheckout,
    allocatePorts: async (count) => {
      if (options.duplicatePorts) return Array.from({ length: count }, () => 21_000);
      const ports = Array.from({ length: count }, (_, index) => portBase + index);
      portBase += count;
      return ports;
    },
    deriveAttemptId: (preregistrationSha256, cellId) =>
      options.duplicateAttemptIds
        ? `spa-${"a".repeat(48)}`
        : `spa-${sentinelProductionSha256(`${preregistrationSha256}\0${cellId}`).slice(0, 48)}`,
    diagnosticExecutionId: () =>
      options.diagnosticExecutionId ?? `sde-${"d".repeat(48)}`,
    opaqueToken: () => Buffer.alloc(32, (opaqueIndex += 1) % 255).toString("base64url"),
    opaqueIdentity: (kind) => `${kind.slice(0, 3)}_spe_${String(opaqueIndex += 1).padStart(8, "0")}`,
    retainScenarioDefinition: (_checkout, task, targetPath) => {
      writeFileSync(targetPath, "retained public scenario");
      return { path: targetPath, byteLength: 24, sha256: task.scenarioSha256 };
    },
    createContinuityTenant: async ({ tenant, createdAt }) => {
      const body = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-tenant.v1" as const,
        tenant,
        createdAt,
        initialCheckpointCount: 0 as const,
        initialCheckpointHeadSha256: null,
      };
      return { ...body, receiptSha256: sentinelProductionJsonSha256(body) };
    },
    exportContinuityReplay: async ({ tenant, agentId, scope, exportedAt }) => {
      const body = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1" as const,
        tenant,
        agentId,
        scope,
        exportedAt,
        tenantRow: { id: tenant },
        checkpoints: [],
        checkpointCount: 0,
        checkpointHeadSha256: null,
      };
      return { ...body, exportSha256: sentinelProductionJsonSha256(body) };
    },
    startStateSidecar: async (stateInput) => {
      const endpoint = `http://127.0.0.1:${stateInput.port}`;
      const auditPath = resolve(stateInput.evidenceDirectory, "production-state-audit.ndjson");
      const readyReceiptPath = resolve(stateInput.evidenceDirectory, "production-state-ready.json");
      const finalReceiptPath = resolve(stateInput.evidenceDirectory, "production-state-final.json");
      const rawDirectory = resolve(stateInput.evidenceDirectory, "raw-exchanges");
      mkdirSync(rawDirectory);
      writeFileSync(auditPath, "");
      const readyBody = {
        schemaVersion: "pm.public-eval-corners.production-state-ready.v1" as const,
        mode: stateInput.mode,
        pid: 101,
        startedAt: "2026-07-14T22:03:00.000Z" as never,
        endpoint,
        evidenceBindingSha256: sentinelProductionSha256(stateInput.evidenceBinding),
        identitySha256: sentinelProductionJsonSha256({
          tenant: String(stateInput.tenant), agentId: stateInput.agentId, scope: stateInput.scope,
        }),
        tokenSha256: sentinelProductionSha256(stateInput.bearerToken),
        responseDeadlineMs: stateInput.responseDeadlineMs ?? 25,
        initialBackend: stateInput.mode === "native" ? "discard" as const
          : stateInput.mode === "plain-kv" ? "plain-kv" as const : "continuity" as const,
        initialAgentChainRecordCount: 0,
        initialScopeRecordCount: 0,
        initialBackendHeadSha256: hash("0"),
        initialRelevantStateSha256: hash("1"),
        auditGenesisSha256: hash("0"),
      };
      const readyReceipt = {
        ...readyBody,
        receiptSha256: sentinelProductionSha256(sentinelProductionCanonicalJson(readyBody)),
      };
      writeFileSync(readyReceiptPath, `${sentinelProductionCanonicalJson(readyReceipt)}\n`);
      return {
        endpoint,
        auditPath,
        readyReceiptPath,
        finalReceiptPath,
        rawDirectory,
        plainKvStatePath: resolve(stateInput.stateDirectory, "plain-kv.ndjson"),
        readyReceipt,
        async stop() {
          stateStopCall += 1;
          if (stateStopCall === options.failStateStopCall) throw new Error("synthetic state stop failure");
          const finalBody = {
            schemaVersion: "pm.public-eval-corners.production-state-final.v1" as const,
            mode: stateInput.mode,
            pid: 101,
            evidenceBindingSha256: readyReceipt.evidenceBindingSha256,
            startedAt: readyReceipt.startedAt,
            finalizedAt: "2026-07-14T22:04:00.000Z" as never,
            totalRequests: 0,
            acceptedWrites: 0,
            acceptedReads: 0,
            rejectedRequests: 0,
            auditEntryCount: 0,
            auditHeadSha256: hash("0"),
            readyReceiptFileSha256: sentinelProductionSha256(readFileSync(readyReceiptPath)),
          };
          const final = {
            ...finalBody,
            receiptSha256: sentinelProductionSha256(sentinelProductionCanonicalJson(finalBody)),
          };
          writeFileSync(finalReceiptPath, `${sentinelProductionCanonicalJson(final)}\n`);
          return final;
        },
      };
    },
    startProviderProxy: async (providerInput) => {
      if (providerInput.port === undefined || providerInput.authorizationToken === undefined) {
        throw new Error("test provider requires fixed port and token");
      }
      mkdirSync(providerInput.outputRoot);
      const readyReceiptPath = resolve(providerInput.outputRoot, "anthropic-provider-ready.json");
      const finalReceiptPath = resolve(providerInput.outputRoot, "anthropic-provider-final.json");
      const origin = `http://127.0.0.1:${providerInput.port}`;
      const readyBody = {
        schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-provider-ready.v1",
        evidenceEligible: false,
        origin,
        endpointPath: "/v1/decide",
        providerEndpoint: "https://api.anthropic.com/v1/messages",
        anthropicVersion: "2023-06-01",
        pinnedModel: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
        maxCompletionTokens: 256,
        temperature: 0,
        authorizationTokenSha256: sentinelProductionSha256(providerInput.authorizationToken),
        systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
        actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
        noAutomaticRetries: true,
        statelessProviderConversation: true,
        requestCaptureExcludesSecrets: true,
        auditHeadHash: null,
        startedAt: "2026-07-14T22:03:00.000Z",
      };
      const ready = { ...readyBody, receiptHash: sentinelProductionJsonSha256(readyBody) };
      writeFileSync(readyReceiptPath, JSON.stringify(ready));
      return {
        origin,
        authorizationToken: providerInput.authorizationToken,
        readyReceiptPath,
        finalReceiptPath,
        async close() {
          const body = {
            schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-provider-final.v1" as const,
            evidenceEligible: false as const,
            readyReceiptHash: ready.receiptHash,
            acceptedOperationCount: 0,
            successfulOperationCount: 0,
            terminalFailureCount: 0,
            duplicateOperationCount: 0,
            duplicateProviderMessageIdCount: 0,
            automaticRetryCount: 0 as const,
            auditRecordCount: 0,
            finalAuditHeadHash: null,
            closedAt: "2026-07-14T22:04:00.000Z",
          };
          const final = { ...body, receiptHash: sentinelProductionJsonSha256(body) };
          writeFileSync(finalReceiptPath, JSON.stringify(final));
          return final;
        },
      };
    },
    superviseAttempt: async (supervisorInput) => {
      supervisorCall += 1;
      supervisorInputs.push(supervisorInput);
      const currentCall = supervisorCall;
      mkdirSync(supervisorInput.outputRoot);
      const receiptRoot = resolve(supervisorInput.outputRoot, "receipts");
      mkdirSync(receiptRoot);
      const startBody = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-start.v1",
        evidenceEligible: false,
        startedAt: new Date(
          Date.parse("2026-07-14T22:05:00.000Z") +
            ((currentCall - 1) % 4 === 3 ? (options.startSkewMs ?? 0) : 0),
        ).toISOString(),
        plan: { attemptId: supervisorInput.attemptId },
      };
      const startReceiptHash = sentinelProductionJsonSha256(startBody);
      writeFileSync(
        resolve(receiptRoot, `sentinel-production-attempt-start-${startReceiptHash}.json`),
        JSON.stringify({ ...startBody, receiptHash: startReceiptHash }),
      );
      const base = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-terminal.v1" as const,
        evidenceEligible: false as const,
        attemptId: supervisorInput.attemptId,
        taskId: supervisorInput.task.taskId,
        completion: "behavioral-complete" as const,
        infrastructureStage: null,
        infrastructureIssue: null,
        startReceiptHash,
        receiptHash: hash("e"),
      } as unknown as SentinelProductionAttemptTerminalReceipt;
      const receipt = supervisorCall === options.smuggleOutcomeCall
        ? ({ ...base, success: true, detail: "smuggled" } as unknown as SentinelProductionAttemptTerminalReceipt)
        : base;
      return await new Promise<SentinelProductionAttemptTerminalReceipt>((resolvePromise, rejectPromise) => {
        pendingSupervisors.push({ call: currentCall, resolve: resolvePromise, reject: rejectPromise, receipt });
        if (pendingSupervisors.length === 4) {
          const block = pendingSupervisors;
          pendingSupervisors = [];
          for (const pending of block) {
            if (pending.call === options.throwSupervisorCall) {
              pending.reject(new Error("synthetic supervisor failure"));
            } else pending.resolve(pending.receipt);
          }
        }
      });
    },
  };
  return { input, dependencies, supervisorInputs, root };
}

function diagnosticInput(test: ReturnType<typeof fixture>): {
  readonly input: SentinelProductionDiagnosticRunInput;
  readonly selection: {
    readonly blockSequence: number;
    readonly taskId: string;
    readonly repeatId: string;
    readonly cellIds: readonly [string, string, string, string];
  };
} {
  const schedule = buildSentinelProductionSchedule(test.input.preregistration);
  const blockIndex = Array.from({ length: schedule.length / 4 }, (_, index) => index)
    .find((index) => {
      const first = schedule[index * 4];
      return first?.taskId === "microhub-stars-relative-passive" &&
        first.repeatId === "repeat-01";
    });
  if (blockIndex === undefined) throw new Error("test plan lacks selected diagnostic block");
  const cells = schedule.slice(blockIndex * 4, blockIndex * 4 + 4);
  if (cells.length !== 4) throw new Error("test diagnostic block is partial");
  return {
    input: {
      preregistration: test.input.preregistration,
      expectedPreregistrationSha256: sentinelProductionJsonSha256(test.input.preregistration),
      expectedScheduleSha256: sentinelProductionJsonSha256(schedule),
      checkouts: test.input.checkouts,
      batchRoot: test.input.batchRoot,
      attemptRegistryRoot: test.input.attemptRegistryRoot,
      runtime: test.input.runtime,
      databaseUrl: test.input.databaseUrl,
      anthropicApiKey: test.input.anthropicApiKey,
    },
    selection: {
      blockSequence: blockIndex + 1,
      taskId: cells[0]!.taskId,
      repeatId: cells[0]!.repeatId,
      cellIds: cells.map(({ cellId }) => cellId) as [string, string, string, string],
    },
  };
}

describe("Sentinel production outcome-blind runner", () => {
  it("runs complete four-arm blocks concurrently and retains sealed offline mappings", async () => {
    const test = fixture();
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    const firstManifest = JSON.parse(
      readFileSync(resolve(result.batchRoot, result.cells[0]!.path), "utf8"),
    ) as { readonly cellRoot: string };
    const failurePath = resolve(result.batchRoot, firstManifest.cellRoot, "runner-failure.json");
    const diagnostic = (() => {
      try { return readFileSync(failurePath, "utf8"); } catch { return "no runner failure"; }
    })();
    expect(result.batchComplete, diagnostic).toBe(true);
    expect(result.evidenceEligible).toBe(false);
    expect(result.materialBenefit).toBe(false);
    expect(result.blocks).toHaveLength(9);
    expect(result.cells).toHaveLength(36);
    expect(test.supervisorInputs).toHaveLength(36);
    const allInputs = test.supervisorInputs as Array<{
      attemptId: string;
      outputRoot: string;
      executionEnvironment: SentinelRuntimeClosure["executionEnvironment"];
      opaqueEnvironment: {
        stateOrigin: string; stateToken: string; providerOrigin: string; providerToken: string;
      };
    }>;
    expect(new Set(allInputs.map(({ outputRoot }) => outputRoot))).toHaveLength(36);
    expect(new Set(allInputs.flatMap(({ opaqueEnvironment }) => [
      opaqueEnvironment.stateToken, opaqueEnvironment.providerToken,
    ]))).toHaveLength(72);
    expect(new Set(allInputs.flatMap(({ opaqueEnvironment }) => [
      opaqueEnvironment.stateOrigin, opaqueEnvironment.providerOrigin,
    ]))).toHaveLength(72);
    expect(allInputs.every(({ executionEnvironment }) =>
      sentinelProductionCanonicalJson(executionEnvironment) ===
      sentinelProductionCanonicalJson(test.input.preregistration.runtime.executionEnvironment)))
      .toBe(true);
    for (let index = 0; index < test.supervisorInputs.length; index += 4) {
      const block = test.supervisorInputs.slice(index, index + 4) as Array<{
        opaqueEnvironment: unknown; attemptId: string; checkoutPath: string;
      }>;
      expect(new Set(block.map(({ attemptId }) => attemptId))).toHaveLength(4);
      expect(new Set(block.map(({ checkoutPath }) => checkoutPath))).toHaveLength(4);
      expect(block.every((entry) => !("arm" in entry) && !("mode" in entry))).toBe(true);
    }
    const final = JSON.parse(readFileSync(result.executionFinalManifestPath, "utf8")) as Record<string, unknown>;
    expect(final).toMatchObject({ batchComplete: true, retryCount: 0, rerunCount: 0, replacementCount: 0 });
    const start = JSON.parse(readFileSync(result.executionStartManifestPath, "utf8")) as {
      readonly externalCommitmentObservation: {
        readonly path: string; readonly receiptSha256: string; readonly bodyPath: string; readonly bodySha256: string;
      };
      readonly initialRuntimeInspection: {
        readonly inspectionReceiptPath: string; readonly inspectionReceiptSha256: string;
      };
    };
    const externalBody = readFileSync(
      resolve(result.batchRoot, start.externalCommitmentObservation.bodyPath),
    );
    expect(externalBody.equals(Buffer.from(JSON.stringify(test.input.externalCommitment)))).toBe(true);
    expect(sentinelProductionSha256(externalBody)).toBe(start.externalCommitmentObservation.bodySha256);
    const externalReceipt = JSON.parse(readFileSync(
      resolve(result.batchRoot, start.externalCommitmentObservation.path),
      "utf8",
    )) as Record<string, unknown>;
    const { receiptSha256: externalReceiptSha256, ...externalReceiptBody } = externalReceipt;
    expect(externalReceiptSha256).toBe(start.externalCommitmentObservation.receiptSha256);
    expect(sentinelProductionJsonSha256(externalReceiptBody)).toBe(externalReceiptSha256);
    const firstBlock = JSON.parse(readFileSync(
      resolve(result.batchRoot, result.blocks[0]!.path),
      "utf8",
    )) as {
      readonly runtimeBefore: { readonly inspectionReceiptPath: string; readonly artifactPath: string };
      readonly runtimeAfter: { readonly inspectionReceiptPath: string; readonly artifactPath: string };
    };
    const runtimePaths = [
      start.initialRuntimeInspection.inspectionReceiptPath,
      firstBlock.runtimeBefore.inspectionReceiptPath,
      firstBlock.runtimeAfter.inspectionReceiptPath,
    ];
    for (const path of runtimePaths) {
      const receipt = JSON.parse(readFileSync(resolve(result.batchRoot, path), "utf8")) as Record<string, unknown>;
      const { receiptSha256, ...body } = receipt;
      expect(sentinelProductionJsonSha256(body)).toBe(receiptSha256);
      expect(body).toMatchObject({ closure: test.input.preregistration.runtime, valid: true });
    }
    const runtimeReceiptFiles = readdirSync(resolve(result.batchRoot, "manifests", "runtime"))
      .filter((name) => name.startsWith("runtime-initial-") || name.startsWith("runtime-block-"));
    expect(runtimeReceiptFiles).toHaveLength(19);
    let runtimeHead = start.initialRuntimeInspection.inspectionReceiptSha256;
    for (const blockReference of result.blocks) {
      const block = JSON.parse(readFileSync(
        resolve(result.batchRoot, blockReference.path),
        "utf8",
      )) as {
        readonly runtimeBefore: { readonly inspectionReceiptPath: string; readonly inspectionReceiptSha256: string };
        readonly runtimeAfter: { readonly inspectionReceiptPath: string; readonly inspectionReceiptSha256: string };
      };
      for (const boundary of [block.runtimeBefore, block.runtimeAfter]) {
        const receipt = JSON.parse(readFileSync(
          resolve(result.batchRoot, boundary.inspectionReceiptPath),
          "utf8",
        )) as { readonly previousInspectionReceiptSha256: string; readonly receiptSha256: string };
        expect(receipt.previousInspectionReceiptSha256).toBe(runtimeHead);
        expect(receipt.receiptSha256).toBe(boundary.inspectionReceiptSha256);
        runtimeHead = receipt.receiptSha256;
      }
    }
    expect(final.runtimeInspectionHeadSha256).toBe(runtimeHead);
    expect(readFileSync(resolve(result.batchRoot, firstBlock.runtimeBefore.artifactPath), "utf8"))
      .toContain("pm.public-eval-corners.sentinel-runtime-closure-artifacts.v3");
    const retained = JSON.parse(
      readFileSync(resolve(result.batchRoot, result.cells[0]!.path), "utf8"),
    ) as Record<string, unknown>;
    expect(retained).toMatchObject({
      evidenceEligible: false,
      materialBenefit: false,
      serviceBinding: { state: { firstStateFresh: true }, continuity: { replayExportPath: "continuity/continuity-replay-export.json" } },
    });
  });

  it("rejects duplicate arm checkouts before creating an evidence batch", async () => {
    const test = fixture();
    const duplicate = {
      ...test.input,
      checkouts: { ...test.input.checkouts, sham: test.input.checkouts.native },
    };
    await expect(runSentinelProductionBatch(duplicate, test.dependencies)).rejects.toThrow(
      "four execution arms require four disjoint checkouts",
    );
    expect(() => readFileSync(resolve(test.root, "batch"))).toThrow();
  });

  it("rejects duplicated ports and deterministic attempt-ID collisions", async () => {
    const ports = fixture({ duplicatePorts: true });
    await expect(runSentinelProductionBatch(ports.input, ports.dependencies)).rejects.toThrow(
      "exactly 16 unique ports",
    );
    const attempts = fixture({ duplicateAttemptIds: true });
    await expect(runSentinelProductionBatch(attempts.input, attempts.dependencies)).rejects.toThrow(
      "attemptId was reused",
    );
  });

  it("rejects mismatched initial database/collateral roots", async () => {
    const test = fixture({ mismatchedRootArm: "substrate" });
    await expect(runSentinelProductionBatch(test.input, test.dependencies)).rejects.toThrow(
      "databaseRootSha256 roots are not identical",
    );
  });

  it("rejects self-signing, an unanchored commitment, and stale signature order", async () => {
    const self = fixture();
    const selfSigned = signed(self.input.preregistration, self.input.preregistration.registration.producerId);
    await expect(runSentinelProductionBatch({
      ...self.input,
      signature: selfSigned.signature,
      trustAnchor: selfSigned.trustAnchor,
      externalCommitment: commitment(selfSigned.trustAnchor),
    }, self.dependencies)).rejects.toThrow("preregistration verification failed");

    const unanchored = fixture();
    const foreignAnchor = { ...unanchored.input.trustAnchor, expectedAuthorityId: "foreign-authority" };
    await expect(runSentinelProductionBatch({
      ...unanchored.input,
      externalCommitment: commitment(foreignAnchor),
    }, unanchored.dependencies)).rejects.toThrow("does not bind the out-of-band trust anchor");

    const stale = fixture({ nowBeforeSignature: true });
    await expect(runSentinelProductionBatch(stale.input, stale.dependencies)).rejects.toThrow(
      "signature must strictly precede run start",
    );
    const unavailable = fixture({ externalRecordInvalid: true });
    await expect(runSentinelProductionBatch(unavailable.input, unavailable.dependencies)).rejects.toThrow(
      "external commitment record was not independently retrieved",
    );
  });

  it("rejects substituted external bytes and a mismatched effective response URL before launch", async () => {
    const substituted = fixture({ externalBodyMismatch: true });
    await expect(runSentinelProductionBatch(substituted.input, substituted.dependencies)).rejects.toThrow(
      "observation body differs from the committed receipt",
    );
    expect(substituted.supervisorInputs).toHaveLength(0);
    const redirected = fixture({ externalResponseUrlMismatch: true });
    await expect(runSentinelProductionBatch(redirected.input, redirected.dependencies)).rejects.toThrow(
      "external commitment record was not independently retrieved",
    );
    expect(redirected.supervisorInputs).toHaveLength(0);
    for (const mutation of ["content-type", "future-time", "hash", "redirect", "status"] as const) {
      const test = fixture({ externalMetadataMutation: mutation });
      await expect(runSentinelProductionBatch(test.input, test.dependencies)).rejects.toThrow();
      expect(test.supervisorInputs).toHaveLength(0);
    }
  });

  it("retains a partial block without retries and makes the batch incomplete", async () => {
    const test = fixture({ throwSupervisorCall: 1 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result.batchComplete).toBe(false);
    expect(result.cells).toHaveLength(36);
    expect(test.supervisorInputs).toHaveLength(36);
    const firstBlock = JSON.parse(readFileSync(resolve(result.batchRoot, result.blocks[0]!.path), "utf8")) as Record<string, unknown>;
    expect(firstBlock).toMatchObject({ completeArmSet: true, infrastructureComplete: false });
  });

  it("runs one exact four-arm qualification block only as an excluded smoke", async () => {
    const test = fixture();
    const diagnostic = diagnosticInput(test);
    const result = await runSentinelProductionExcludedSmoke(
      diagnostic.input,
      diagnostic.selection,
      test.dependencies,
    );
    expect(result).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-result.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      diagnosticExecutionId: `sde-${"d".repeat(48)}`,
      selectedBlock: diagnostic.selection,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.cells).toHaveLength(4);
    expect(test.supervisorInputs).toHaveLength(4);
    const final = JSON.parse(
      readFileSync(result.executionFinalManifestPath, "utf8"),
    ) as Record<string, unknown>;
    expect(final).toMatchObject({
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-final.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      declaredBlockCount: 9,
      retainedBlockCount: 1,
      declaredCellCount: 36,
      retainedCellCount: 4,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
    });
    const start = JSON.parse(
      readFileSync(result.executionStartManifestPath, "utf8"),
    ) as Record<string, unknown>;
    expect(start).toMatchObject({
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-start.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      selectedBlock: diagnostic.selection,
    });
    expect(result.cells.map(({ cellId }) => cellId)).toEqual(diagnostic.selection.cellIds);
    expect(result.cells.every(({ sequence }) => sequence >= 1 && sequence <= 36)).toBe(true);
    expect(result.cells.map(({ attemptId, cellId }) => attemptId)).toEqual(
      result.cells.map(({ cellId }) =>
        `spa-${sentinelProductionSha256(
          `pm.sentinel.local-diagnostic.attempt.v1\0${result.preregistrationSha256}\0${result.diagnosticExecutionId}\0${cellId}`,
        ).slice(0, 48)}`),
    );
    const retainedInputs = readdirSync(resolve(result.batchRoot, "inputs"));
    expect(retainedInputs.sort()).toEqual([
      "local-diagnostic-disclosure.json",
      "preregistration.json",
    ]);
    const retainedText = [
      ...retainedInputs.map((name) => readFileSync(resolve(result.batchRoot, "inputs", name), "utf8")),
      readFileSync(result.executionStartManifestPath, "utf8"),
      readFileSync(result.executionFinalManifestPath, "utf8"),
    ].join("\n");
    expect(retainedText).not.toContain('"independent": true');

    const raw = verifySentinelProductionRawBatch({
      batchRoot: result.batchRoot,
      trustAnchor: test.input.trustAnchor,
    });
    expect(raw).toMatchObject({
      valid: false,
      rawComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      verifiedCellCount: 0,
      analysis: null,
      measurements: [],
    });
  });

  it("domain-separates physical attempt IDs across local diagnostic reruns", async () => {
    const first = fixture({ diagnosticExecutionId: `sde-${"1".repeat(48)}` });
    const second = fixture({ diagnosticExecutionId: `sde-${"2".repeat(48)}` });
    const firstDiagnostic = diagnosticInput(first);
    const secondDiagnostic = diagnosticInput(second);
    const [firstResult, secondResult] = await Promise.all([
      runSentinelProductionExcludedSmoke(
        firstDiagnostic.input,
        firstDiagnostic.selection,
        first.dependencies,
      ),
      runSentinelProductionExcludedSmoke(
        secondDiagnostic.input,
        secondDiagnostic.selection,
        second.dependencies,
      ),
    ]);
    expect(firstResult.cells.map(({ cellId }) => cellId)).toEqual(
      secondResult.cells.map(({ cellId }) => cellId),
    );
    expect(new Set([
      ...firstResult.cells.map(({ attemptId }) => attemptId),
      ...secondResult.cells.map(({ attemptId }) => attemptId),
    ])).toHaveLength(8);
  });

  it("rejects local diagnostic plan, schedule, block, and cell substitutions before launch", async () => {
    const mutations = [
      (value: ReturnType<typeof diagnosticInput>) => ({
        ...value,
        input: { ...value.input, expectedPreregistrationSha256: hash("f") },
      }),
      (value: ReturnType<typeof diagnosticInput>) => ({
        ...value,
        input: { ...value.input, expectedScheduleSha256: hash("e") },
      }),
      (value: ReturnType<typeof diagnosticInput>) => ({
        ...value,
        selection: { ...value.selection, blockSequence: value.selection.blockSequence + 1 },
      }),
      (value: ReturnType<typeof diagnosticInput>) => ({
        ...value,
        selection: {
          ...value.selection,
          cellIds: [hash("a"), ...value.selection.cellIds.slice(1)] as [string, string, string, string],
        },
      }),
      (value: ReturnType<typeof diagnosticInput>) => {
        const preregistration = {
          ...value.input.preregistration,
          objective: "substituted local objective",
        } as unknown as SentinelProductionPreregistration;
        return {
          ...value,
          input: {
            ...value.input,
            preregistration,
            expectedPreregistrationSha256: sentinelProductionJsonSha256(preregistration),
          },
        };
      },
    ];
    for (const mutate of mutations) {
      const test = fixture();
      const diagnostic = mutate(diagnosticInput(test));
      await expect(runSentinelProductionExcludedSmoke(
        diagnostic.input,
        diagnostic.selection,
        test.dependencies,
      )).rejects.toThrow();
      expect(test.supervisorInputs).toHaveLength(0);
    }
  });

  it("rejects an output root whose lexical parent is a symlink into a checkout", async () => {
    const test = fixture();
    const alias = resolve(test.root, "output-parent-alias");
    symlinkSync(test.input.checkouts.native, alias);
    await expect(runSentinelProductionBatch({
      ...test.input,
      batchRoot: resolve(alias, "batch"),
    }, test.dependencies)).rejects.toThrow(/parent.*canonical.*symlink/iu);
    expect(test.supervisorInputs).toHaveLength(0);
  });

  it("uses retained supervisor start receipts to fail excessive four-arm skew", async () => {
    const test = fixture({ startSkewMs: 2_000 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result.batchComplete).toBe(false);
    const firstBlock = JSON.parse(
      readFileSync(resolve(result.batchRoot, result.blocks[0]!.path), "utf8"),
    ) as Record<string, unknown>;
    expect(firstBlock).toMatchObject({ simultaneousLaunch: false, maximumObservedStartSkewMs: 2_000 });
  });

  it("retains service-stop failure and never promotes raw evidence", async () => {
    const test = fixture({ failStateStopCall: 1 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result).toMatchObject({ batchComplete: false, evidenceEligible: false, materialBenefit: false });
    const firstCell = JSON.parse(
      readFileSync(resolve(result.batchRoot, result.cells[0]!.path), "utf8"),
    ) as Record<string, unknown>;
    expect(firstCell).toMatchObject({ infrastructureComplete: false, evidenceEligible: false, materialBenefit: false });
  });

  it("retains a content-addressed invalid post-block runtime inspection", async () => {
    const test = fixture({ invalidRuntimeInspectionCall: 3 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result.batchComplete).toBe(false);
    const firstBlock = JSON.parse(readFileSync(
      resolve(result.batchRoot, result.blocks[0]!.path),
      "utf8",
    )) as {
      readonly runtimeStable: boolean;
      readonly runtimeAfter: { readonly inspectionReceiptPath: string; readonly inspectionReceiptSha256: string };
    };
    expect(firstBlock.runtimeStable).toBe(false);
    const retained = JSON.parse(readFileSync(
      resolve(result.batchRoot, firstBlock.runtimeAfter.inspectionReceiptPath),
      "utf8",
    )) as Record<string, unknown>;
    const { receiptSha256, ...body } = retained;
    expect(receiptSha256).toBe(firstBlock.runtimeAfter.inspectionReceiptSha256);
    expect(sentinelProductionJsonSha256(body)).toBe(receiptSha256);
    expect(body).toMatchObject({ boundary: "after", blockSequence: 1, valid: false, artifact: null });
  });

  it("rejects a valid-claimed runtime inspection with tampered derivation identity", async () => {
    const test = fixture({ tamperedRuntimeArtifact: true });
    await expect(runSentinelProductionBatch(test.input, test.dependencies)).rejects.toThrow(
      "runtime derivation artifact identity is invalid",
    );
    expect(test.supervisorInputs).toHaveLength(0);
  });

  it("rejects outcome smuggling from the supervisor without serializing upstream fields", async () => {
    const test = fixture({ smuggleOutcomeCall: 1 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result.batchComplete).toBe(false);
    for (const cell of result.cells) {
      const raw = readFileSync(resolve(result.batchRoot, cell.path), "utf8");
      expect(raw).not.toMatch(/"success"\s*:/u);
      expect(raw).not.toMatch(/"detail"\s*:/u);
    }
  });
});
