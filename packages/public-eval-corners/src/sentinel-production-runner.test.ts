import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
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
  type SentinelProductionCheckoutPreflight,
  type SentinelProductionExternalCommitment,
  type SentinelProductionRunInput,
  type SentinelProductionRunnerDependencies,
} from "./sentinel-production-runner.js";
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
  const root = mkdtempSync(resolve(tmpdir(), "pm-sentinel-production-runner-"));
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
  const closureWithoutHash: SentinelRuntimeClosure = {
    closureSha256: hash("0"),
    closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v1",
    closureDerivation: "canonical-runtime-fields-with-requested-and-resolved-paths-v1",
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
    },
    browser: {
      playwrightVersion: "1.56.1",
      packageMetadataSha256: hash("3"),
      bundleRootPath: root,
      bundleTreeSha256: hash("4"),
      executablePath: dummy.path,
      executableSha256: dummy.sha256,
    },
    upstream: {
      frontendPackageLockSha256: hash("6"),
      frontendInstalledTreeSha256: hash("7"),
      serverRequirementsSha256: hash("8"),
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
      pythonExecutableAllowedRootPath: root,
      pythonPyvenvConfigPath: dummy.path,
      pythonSitePackagesRootPaths: [root],
      playwrightPackageMetadataPath: dummy.path,
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
  readonly startSkewMs?: number;
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
  const dependencies: SentinelProductionRunnerDependencies = {
    now: () => {
      if (options.nowBeforeSignature) return "2026-07-14T22:00:30.000Z";
      const value = new Date(Date.parse("2026-07-14T22:03:00.000Z") + nowIndex * 1_000);
      nowIndex += 1;
      return value.toISOString();
    },
    verifyExternalCommitmentRecord: async (record) => ({
      valid: !options.externalRecordInvalid,
      locator: record.locator,
      observedAt: "2026-07-14T22:03:00.000Z",
      responseSha256: sentinelProductionJsonSha256(record),
      issues: options.externalRecordInvalid ? ["external receipt unavailable"] : [],
    }),
    inspectRuntime: () => ({
      valid: true,
      closure: runtimeFixture.closure,
      closureSha256: runtimeFixture.closure.closureSha256,
      executableIdentitySha256: hash("e"),
      issues: [],
    }),
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

  it("retains a partial block without retries and makes the batch incomplete", async () => {
    const test = fixture({ throwSupervisorCall: 1 });
    const result = await runSentinelProductionBatch(test.input, test.dependencies);
    expect(result.batchComplete).toBe(false);
    expect(result.cells).toHaveLength(36);
    expect(test.supervisorInputs).toHaveLength(36);
    const firstBlock = JSON.parse(readFileSync(resolve(result.batchRoot, result.blocks[0]!.path), "utf8")) as Record<string, unknown>;
    expect(firstBlock).toMatchObject({ completeArmSet: true, infrastructureComplete: false });
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
