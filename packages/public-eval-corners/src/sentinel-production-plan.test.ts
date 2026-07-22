import {
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SENTINEL_HELDOUT_MANIFEST_SHA256,
  SENTINEL_HELDOUT_TASKS,
  SENTINEL_PRODUCTION_OWNER_OBJECTIVE,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE,
  SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256,
  SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
  SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
  SENTINEL_QUALIFICATION_MANIFEST_SHA256,
  SENTINEL_QUALIFICATION_TASKS,
  buildSentinelRuntimeSanitizedEnvironment,
  buildSentinelProductionSchedule,
  createSentinelProductionPreregistration,
  sentinelProductionPlanningDisposition,
  sentinelProductionJsonSha256,
  sentinelProductionFullTaskCatalogSha256,
  sentinelProductionRuntimeClosureSha256,
  sentinelProductionSha256,
  sentinelProductionTaskManifestSha256,
  verifySentinelProductionPreregistration,
  type SentinelExternalTrustAnchor,
  type SentinelProductionPhase,
  type SentinelProductionPreregistration,
  type SentinelProductionSignature,
  type SentinelPoweredConfirmatoryUniverse,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";

function hash(character: string): string {
  return character.repeat(64);
}

function runtime(): SentinelRuntimeClosure {
  const sanitizedEnvironment = buildSentinelRuntimeSanitizedEnvironment(
    "/runtime/node/bin/node",
  );
  const closure: SentinelRuntimeClosure = {
    closureSha256: hash("0"),
    closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v3",
    closureDerivation: "canonical-runtime-transitive-trees-and-git-listings-v3",
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
    agentScriptSha256: hash("7"),
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
      checkoutPath: "/workspace/pm-substrate",
      ignoredPathListingSha256: hash("a"),
      rootPackageJsonSha256: hash("b"),
      pnpmWorkspaceManifestSha256: hash("c"),
      rootTsconfigSha256: hash("d"),
      tsconfigBaseSha256: hash("e"),
      publicEvalPackageManifestSha256: hash("f"),
      publicEvalTsconfigSha256: hash("0"),
      packagesRootPath: "/workspace/pm-substrate/packages",
      packagesTreeSha256: hash("1"),
      packagesTreeEntryCount: 10,
      installedDependenciesRootPath: "/workspace/pm-substrate/node_modules",
      installedDependenciesTreeSha256: hash("2"),
      installedDependenciesTreeEntryCount: 20,
      compiledOutputRootPath: "/workspace/pm-substrate/packages/public-eval-corners/dist",
      compiledOutputTreeSha256: hash("3"),
      compiledOutputTreeEntryCount: 30,
    },
    node: {
      version: "v26.0.0",
      requestedPath: "/runtime/node/bin/node",
      requestedEntrySha256: hash("a"),
      resolvedPath: "/runtime/node/bin/node-real",
      resolvedExecutableSha256: hash("b"),
    },
    npm: {
      version: "11.0.0",
      requestedCliPath: "/runtime/npm/bin/npm-cli.js",
      requestedCliEntrySha256: hash("c"),
      resolvedCliPath: "/runtime/npm/lib/npm-cli.js",
      resolvedCliSha256: hash("d"),
    },
    python: {
      version: "Python 3.12.13",
      requestedVenvPath: "/runtime/python-venv/bin/python",
      venvEntrySha256: hash("e"),
      resolvedExecutablePath: "/runtime/python/bin/python3.12",
      realExecutableSha256: hash("f"),
      pyvenvConfigSha256: hash("0"),
      pipFreezeSha256: hash("1"),
      installedDistributionsManifestSha256: hash("2"),
      installedDistributionsManifestSchema: "canonical-name-version-files-record-sha256-v1",
      environmentRootPath: "/runtime/python-venv",
      environmentTreeSha256: hash("3"),
      environmentTreeEntryCount: 40,
      runtimeRootPath: "/runtime/python",
      runtimeTreeSha256: hash("4"),
      runtimeTreeEntryCount: 50,
      stdlibRootPath: "/runtime/python/lib/python3.12",
      stdlibTreeSha256: hash("5"),
      stdlibTreeEntryCount: 60,
    },
    browser: {
      playwrightVersion: "1.56.1",
      packageMetadataSha256: hash("3"),
      bundleRootPath: "/runtime/playwright/chromium",
      bundleTreeSha256: hash("4"),
      executablePath: "/runtime/playwright/chromium/chrome",
      executableSha256: hash("5"),
      libraryRootPath: "/runtime/node_modules/playwright",
      libraryTreeSha256: hash("6"),
      libraryTreeEntryCount: 70,
      coreLibraryRootPath: "/runtime/node_modules/playwright-core",
      coreLibraryTreeSha256: hash("7"),
      coreLibraryTreeEntryCount: 80,
      corePackageMetadataSha256: hash("8"),
    },
    upstream: {
      revision: SENTINEL_PRODUCTION_REVISION,
      sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
      ignoredPathListingSha256: hash("5"),
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
  return {
    ...closure,
    closureSha256: sentinelProductionRuntimeClosureSha256(closure),
  };
}

function plan(
  selectedPhase: SentinelProductionPhase = "procedural-holdout",
): SentinelProductionPreregistration {
  return createSentinelProductionPreregistration({
    registrationId: `sentinel-${selectedPhase}-20260714`,
    registeredAt: "2026-07-14T22:00:00.000Z",
    producerId: "joat-labs-producer",
    selectedPhase,
    repeatIds: ["repeat-01", "repeat-02", "repeat-03"],
    randomizationSeed: `sentinel-${selectedPhase}-seed`,
    systemPromptSha256: hash("5"),
    actionSchemaSha256: hash("6"),
    runtime: runtime(),
    bootstrapSeed: `sentinel-${selectedPhase}-bootstrap-seed`,
    rawBatchVerifierId: "sentinel-raw-batch-verifier-v1",
    rawBatchVerifierRevision: "7".repeat(40),
    rawBatchVerifierSha256: runtime().verifierScriptSha256,
  });
}

function signed(
  preregistration: SentinelProductionPreregistration,
  ownerId = "independent-verification-owner",
): {
  readonly signature: SentinelProductionSignature;
  readonly trustAnchor: SentinelExternalTrustAnchor;
} {
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

describe("Sentinel production public task catalogs", () => {
  it("pins the unchanged source, owner objective, speed-one-compatible timing, and exact manifests", () => {
    expect(SENTINEL_PRODUCTION_REVISION).toBe(
      "0faca33cc58ea62e97a928b67cd3beec7176b408",
    );
    expect(SENTINEL_PRODUCTION_SOURCE_TREE).toBe(
      "3ca2dc7160e505dc15b607ada4dd9ffe1f6a7c50",
    );
    expect(SENTINEL_PRODUCTION_OWNER_OBJECTIVE).toContain(
      "Stress-test pm-substrate hard against real, publicly documented agent-state failure scenarios",
    );
    expect(sentinelProductionTaskManifestSha256(SENTINEL_QUALIFICATION_TASKS)).toBe(
      SENTINEL_QUALIFICATION_MANIFEST_SHA256,
    );
    expect(sentinelProductionTaskManifestSha256(SENTINEL_HELDOUT_TASKS)).toBe(
      SENTINEL_HELDOUT_MANIFEST_SHA256,
    );
    expect(SENTINEL_HELDOUT_MANIFEST_SHA256).toBe(
      "f24feec519f0eb90bebaefd8d2c4c72cab9b208e6e6f2ec6629f49adeb9b2576",
    );
    expect(SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256).toBe(
      "48e1695b0728000c8f8e738f9d72273861bf6216e4c609935650a09067d87bc6",
    );
    expect(SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256).toBe(
      "c834011c79c134ed14c17ecbca312934de22054c77dd5fbb000ad5ae0560c132",
    );
    expect([...SENTINEL_QUALIFICATION_TASKS, ...SENTINEL_HELDOUT_TASKS].every(
      ({ eventTimelineEndSeconds, killAtSeconds }) =>
        eventTimelineEndSeconds === 720 && killAtSeconds === 630,
    )).toBe(true);
  });

  it("binds role, timing, and taxonomy separately from task/file identity", () => {
    const originalManifest = sentinelProductionTaskManifestSha256(SENTINEL_HELDOUT_TASKS);
    const originalCatalog = sentinelProductionFullTaskCatalogSha256(SENTINEL_HELDOUT_TASKS);
    const first = SENTINEL_HELDOUT_TASKS[0];
    if (first === undefined) throw new Error("expected public task catalog");
    const relabeled = [
      { ...first, conditionAtSeconds: first.conditionAtSeconds === null ? 1 : first.conditionAtSeconds + 1 },
      ...SENTINEL_HELDOUT_TASKS.slice(1),
    ];
    expect(sentinelProductionTaskManifestSha256(relabeled)).toBe(originalManifest);
    expect(sentinelProductionFullTaskCatalogSha256(relabeled)).not.toBe(originalCatalog);
  });

  it("keeps MicroHub qualification separate from the exact 12-task procedural holdout", () => {
    expect(SENTINEL_QUALIFICATION_TASKS.map(({ environment }) => environment)).toEqual([
      "microhub",
      "microhub",
      "microhub",
    ]);
    expect(SENTINEL_HELDOUT_TASKS).toHaveLength(12);
    expect(new Set(SENTINEL_HELDOUT_TASKS.map(({ environment }) => environment))).toEqual(
      new Set(["microhood", "micromail", "microscholar", "microtube"]),
    );
    expect(SENTINEL_HELDOUT_TASKS.filter(
      ({ role }) => role === "state-retention-relative",
    )).toHaveLength(4);
    expect(SENTINEL_HELDOUT_TASKS.filter(
      ({ role }) => role === "expected-allow-absolute",
    )).toHaveLength(4);
    expect(SENTINEL_HELDOUT_TASKS.filter(
      ({ role }) => role === "anti-degenerate-noop",
    )).toHaveLength(4);
    expect(SENTINEL_HELDOUT_TASKS.map(({ taskId, scenarioSha256, conditionAtSeconds }) => ({
      taskId,
      scenarioSha256,
      conditionAtSeconds,
    }))).toEqual([
      { taskId: "microhood-buy-dip-relative-active", scenarioSha256: "9c337fc95d2b63a0439fb4f13de20da29c41ca881569ceaf9339a6d7c79b8308", conditionAtSeconds: 265.95 },
      { taskId: "microhood-orders-absolute-active", scenarioSha256: "7a6aed951266f06ee20f872d0cfef136e4e3df3f0c993ba35b47a31d70291243", conditionAtSeconds: 100.52 },
      { taskId: "microhood-orders-noop", scenarioSha256: "784299d53c06b69aedafa53bc4410dc9b91b19b45eb5d03fecb68d081d05ab81", conditionAtSeconds: null },
      { taskId: "micromail-junk-relative-passive", scenarioSha256: "c178a310bd8a68dc575956e2f53b2ac9da2dc01281cbb82360890cbc82240fa4", conditionAtSeconds: 297.75 },
      { taskId: "micromail-unread-absolute-passive", scenarioSha256: "22fbd6f43a99f877557b43b5a3e1d13c9ce1582838e8283b0f49b4a4dacd9f6b", conditionAtSeconds: 585.56 },
      { taskId: "micromail-sender-absolute-noop", scenarioSha256: "9339debfd55a22b347a8622232da16deb6c1701b28bdc3250554cddda205fb23", conditionAtSeconds: null },
      { taskId: "microscholar-papercount-relative-passive", scenarioSha256: "c78eb6d3b0d0c6b4cb4e129dde99d9cebf50807f559dff5cd434fdab92c6ff2d", conditionAtSeconds: 199.94 },
      { taskId: "microscholar-search-absolute-passive", scenarioSha256: "acddb160065dde5a6d08c13d2a4cda3e06ceab6aa2d84fd84dec499040366e8a", conditionAtSeconds: 154.6 },
      { taskId: "microscholar-search-noop", scenarioSha256: "eb12e66e6ec971ffbe485cde8903568cfad61f7107f4aff259f3dba60a5a4d2c", conditionAtSeconds: null },
      { taskId: "microtube-views-relative-active", scenarioSha256: "77e6f181d668df4b9648708a8c301d1c8226096230765166787065dae2d9536a", conditionAtSeconds: 242 },
      { taskId: "microtube-video-absolute-active", scenarioSha256: "07dca2cbb0b25c63115cdcb84f72e6f431131e157dacf330eebced817c16a2a1", conditionAtSeconds: 350.12 },
      { taskId: "microtube-notifications-noop", scenarioSha256: "3e66a470e24a1003a010e8b72e7cff059b1884f3d1bfc40d09d726cb036b4126", conditionAtSeconds: null },
    ]);
    expect(Object.keys(SENTINEL_HELDOUT_TASKS[0] ?? {}).sort()).toEqual([
      "conditionAtSeconds",
      "environment",
      "eventTimelineEndSeconds",
      "killAtSeconds",
      "role",
      "scenarioSha256",
      "taskId",
      "taxonomy",
    ]);
  });
});

describe("Sentinel production preregistration", () => {
  it("accepts an externally signed exact procedural plan without promoting it", () => {
    const preregistration = plan();
    const { signature, trustAnchor } = signed(preregistration);
    const verification = verifySentinelProductionPreregistration(
      preregistration,
      signature,
      trustAnchor,
    );
    expect(verification.valid).toBe(true);
    expect(verification.signatureValid).toBe(true);
    expect(verification.externallyAnchored).toBe(true);
    expect(verification.cells).toHaveLength(12 * 3 * 4);
    expect(new Set(verification.cells.map(({ cellId }) => cellId))).toHaveLength(144);
    expect(preregistration.benchmark.speedFactor).toBe(1);
    expect(preregistration.benchmark.universes.proceduralHoldout.efficacyEligible).toBe(false);
    expect(preregistration.benchmark.universes.poweredConfirmatory.status).toBe("not-frozen");
    expect(preregistration.benchmark.universes.poweredConfirmatory).toMatchObject({
      manifestSha256: SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
      fullCatalogSha256: SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
      fullCatalogHashSchema: "canonical-json-array-sorted-by-task-id-all-registration-fields-v1",
      expectedTaskCount: 50,
      expectedEnvironmentCounts: {
        microchat: 10,
        microdin: 10,
        microfy: 10,
        microgram: 10,
        microlendar: 10,
      },
      expectedRoleCounts: {
        stateRetentionRelative: 19,
        expectedAllowAbsolute: 21,
        antiDegenerateNoop: 10,
      },
      powerAnalysis: {
        analysisProcedureSha256: SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256,
      },
    });
  });

  it("block-randomizes complete arms contiguously by task and repeat", () => {
    const preregistration = plan();
    const schedule = buildSentinelProductionSchedule(preregistration);
    expect(schedule).toEqual(buildSentinelProductionSchedule(preregistration));
    for (let index = 0; index < schedule.length; index += 4) {
      const block = schedule.slice(index, index + 4);
      expect(new Set(block.map(({ taskId }) => taskId))).toHaveLength(1);
      expect(new Set(block.map(({ repeatId }) => repeatId))).toHaveLength(1);
      expect(new Set(block.map(({ arm }) => arm))).toEqual(
        new Set(["native", "sham", "plain-kv", "substrate"]),
      );
    }
    const changed = {
      ...preregistration,
      execution: { ...preregistration.execution, randomizationSeed: "different-seed" },
    };
    expect(buildSentinelProductionSchedule(changed).map(({ cellId }) => cellId)).not.toEqual(
      schedule.map(({ cellId }) => cellId),
    );
  });

  it("keeps the 12-task phase procedural and refuses an unfrozen powered run", () => {
    const powered = plan("powered-confirmatory");
    const { signature, trustAnchor } = signed(powered);
    const verification = verifySentinelProductionPreregistration(powered, signature, trustAnchor);
    expect(verification.valid).toBe(false);
    expect(verification.issues).toContain(
      "powered-confirmatory cannot run before its universe and power analysis are frozen",
    );

    const attemptedPromotion = createSentinelProductionPreregistration({
      registrationId: "attempted-procedural-promotion",
      registeredAt: "2026-07-14T22:00:00.000Z",
      producerId: "joat-labs-producer",
      selectedPhase: "procedural-holdout",
      repeatIds: ["repeat-01", "repeat-02", "repeat-03"],
      randomizationSeed: "promotion-must-fail",
      systemPromptSha256: hash("5"),
      actionSchemaSha256: hash("6"),
      runtime: runtime(),
      bootstrapSeed: "attempted-promotion-bootstrap-seed",
      rawBatchVerifierId: "sentinel-raw-batch-verifier-v1",
      rawBatchVerifierRevision: "7".repeat(40),
      rawBatchVerifierSha256: runtime().verifierScriptSha256,
      poweredConfirmatoryUniverse: {
        purpose: "future-powered-confirmatory-outcome",
        status: "frozen",
        efficacyEligibleAfterExternalVerification: true,
        manifestSha256: SENTINEL_HELDOUT_MANIFEST_SHA256,
        fullCatalogSha256: SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
        fullCatalogHashSchema: "canonical-json-array-sorted-by-task-id-all-registration-fields-v1",
        expectedTaskCount: 50,
        expectedEnvironmentCounts: {
          microchat: 10,
          microdin: 10,
          microfy: 10,
          microgram: 10,
          microlendar: 10,
        },
        expectedRoleCounts: {
          stateRetentionRelative: 19,
          expectedAllowAbsolute: 21,
          antiDegenerateNoop: 10,
        },
        tasks: SENTINEL_HELDOUT_TASKS,
        selectionProtocolSha256: hash("7"),
        powerAnalysis: {
          justificationSha256: hash("8"),
          calculationArtifactSha256: hash("a"),
          calculationProcedureSha256: hash("b"),
          calculationVerifierSha256: hash("c"),
          assumptionSetSha256: hash("d"),
          targetPower: 0.8,
          declaredPower: 0.8,
          minimumDetectablePointLift: 0.1,
          independentTaskCount: 19,
          repeatsPerTask: 3,
          familywiseAlpha: 0.05,
          externalPowerCalculationVerificationRequired: true,
          externalPowerCalculationVerified: true,
          analysisProcedureSha256: hash("9"),
          minimumIndependentStateFailureTasks: 19,
          analysisUnit: "task-clustered",
          taskClusteredConfidenceIntervals: true,
          confidenceIntervalMustExcludeZero: true,
        },
      } as unknown as SentinelPoweredConfirmatoryUniverse,
    });
    const attemptedSignature = signed(attemptedPromotion);
    expect(verifySentinelProductionPreregistration(
      attemptedPromotion,
      attemptedSignature.signature,
      attemptedSignature.trustAnchor,
    ).valid).toBe(false);
  });

  it("rejects schema additions, speed/retry/replacement changes, and post-signature tampering", () => {
    const preregistration = plan();
    const signedPlan = signed(preregistration);
    const extra = { ...preregistration, resultPreview: "success" };
    const signedExtra = signed(extra as SentinelProductionPreregistration);
    expect(verifySentinelProductionPreregistration(
      extra,
      signedExtra.signature,
      signedExtra.trustAnchor,
    ).issues).toContain("preregistration keys are not exact");

    const weakened = {
      ...preregistration,
      benchmark: { ...preregistration.benchmark, speedFactor: 4 },
      execution: {
        ...preregistration.execution,
        noAutomaticRetries: false,
        noTaskReplacements: false,
      },
    } as unknown as SentinelProductionPreregistration;
    const weakenedSigned = signed(weakened);
    expect(verifySentinelProductionPreregistration(
      weakened,
      weakenedSigned.signature,
      weakenedSigned.trustAnchor,
    ).valid).toBe(false);
    expect(verifySentinelProductionPreregistration(
      preregistration,
      signedPlan.signature,
      { ...signedPlan.trustAnchor, expectedPreregistrationSha256: hash("f") },
    ).valid).toBe(false);
    const anchorWithPrivateMaterial = {
      ...signedPlan.trustAnchor,
      privateKey: "must-not-cross",
      outcomes: { success: true },
    };
    const anchorVerification = verifySentinelProductionPreregistration(
      preregistration,
      signedPlan.signature,
      anchorWithPrivateMaterial,
    );
    expect(anchorVerification.valid).toBe(false);
    expect(anchorVerification.issues).toContain("out-of-band trust anchor keys are not exact");
  });

  it("requires an out-of-band expected key and a different authority owner", () => {
    const preregistration = plan();
    const external = signed(preregistration);
    expect(verifySentinelProductionPreregistration(
      preregistration,
      external.signature,
      { ...external.trustAnchor, expectedAuthorityPublicKeySha256: hash("a") },
    ).valid).toBe(false);

    const selfSigned = signed(preregistration, preregistration.registration.producerId);
    const verification = verifySentinelProductionPreregistration(
      preregistration,
      selfSigned.signature,
      selfSigned.trustAnchor,
    );
    expect(verification.valid).toBe(false);
    expect(verification.externallyAnchored).toBe(false);
  });

  it("rejects a freshly signed runtime whose requested/resolved closure was not reconstructed", () => {
    const preregistration = plan();
    const staleClosure = {
      ...preregistration,
      runtime: {
        ...preregistration.runtime,
        node: {
          ...preregistration.runtime.node,
          resolvedPath: "/runtime/node/bin/different-node",
        },
      },
    } as SentinelProductionPreregistration;
    const staleSignature = signed(staleClosure);
    const verification = verifySentinelProductionPreregistration(
      staleClosure,
      staleSignature.signature,
      staleSignature.trustAnchor,
    );
    expect(verification.valid).toBe(false);
    expect(verification.issues).toContain("runtime closure is incomplete or invalid");
  });

  it("rejects runtime-tree shape additions and a rehashed non-sanitized environment", () => {
    const preregistration = plan();
    const extraShape = {
      ...preregistration,
      runtime: {
        ...preregistration.runtime,
        workspace: { ...preregistration.runtime.workspace, unboundTree: hash("a") },
      },
    } as unknown as SentinelProductionPreregistration;
    const extraSigned = signed(extraShape);
    expect(verifySentinelProductionPreregistration(
      extraShape,
      extraSigned.signature,
      extraSigned.trustAnchor,
    ).issues).toContain("runtime.workspace keys are not exact");

    const changedRuntime = {
      ...preregistration.runtime,
      executionEnvironment: {
        ...preregistration.runtime.executionEnvironment,
        values: {
          ...buildSentinelRuntimeSanitizedEnvironment(preregistration.runtime.node.requestedPath),
          TZ: "Etc/UTC",
        },
      },
    } as SentinelRuntimeClosure;
    const internallyRehashed = {
      ...changedRuntime,
      closureSha256: sentinelProductionRuntimeClosureSha256(changedRuntime),
    };
    const changedPlan = { ...preregistration, runtime: internallyRehashed };
    const changedSigned = signed(changedPlan);
    expect(verifySentinelProductionPreregistration(
      changedPlan,
      changedSigned.signature,
      changedSigned.trustAnchor,
    ).issues).toContain("runtime closure is incomplete or invalid");
  });
});

describe("Sentinel production outcome-blind analysis plan", () => {
  it("freezes the powered task-cluster procedure without accepting outcomes", () => {
    const preregistration = plan("procedural-holdout");
    expect(preregistration.analysis.procedure).toEqual(
      SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE,
    );
    expect(preregistration.analysis.procedureSha256).toBe(
      SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256,
    );
    expect(preregistration.analysis.procedure).toMatchObject({
      poweredNativeShamClaimRule:
        "all-of-both-point-lifts-bootstrap-lower-bound-both-holm-rejections-and-fail-closed-guardrails",
      primaryStratum: {
        independentTaskCount: 19,
        repeatsPerTask: 3,
        repeatAggregation: "task-level-pass-rate-per-arm",
        repeatsIncreaseIndependentSampleSize: false,
      },
      primaryEffect: {
        minimumPointLiftOverNative: 0.1,
        minimumPointLiftOverSham: 0.1,
        bootstrapContrast: "substrate-minus-max-of-native-and-sham",
      },
      clusterBootstrap: {
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
      },
      exactRandomizationTests: {
        method: "paired-task-level-sign-flip",
        taskDifferenceNumerator: "substrate-success-count-minus-control-success-count",
        commonTaskDenominator: 3,
        statistic: "sum-of-19-task-difference-numerators",
        enumeration: "all-sign-assignments-of-nonzero-task-differences",
        zeroDifferenceHandling: "retain-as-zero-and-do-not-add-sign-bit",
        alternative: "substrate-greater-than-control",
        exactPValue: "fraction-of-enumerated-statistics-greater-than-or-equal-to-observed",
        contrasts: ["substrate-vs-native", "substrate-vs-sham"],
        multiplicityCorrection: "Holm",
        holmDecisionRule: "sort-p-ascending-test-at-alpha-over-2-then-alpha-stop-at-first-nonrejection",
        familywiseAlpha: 0.05,
      },
      failClosedGuardrails: {
        expectedAllowAbsolute: true,
        antiDegenerateNoop: true,
        everyCellRawComplete: true,
        infrastructureIncompletePreventsAnalysis: true,
        economicsAndLatencyApplyToEveryArmAndCell: true,
      },
      plainKvBoundary: {
        reportAsActiveDurableStorageComparator: true,
        includedInPrimaryNativeShamClaim: false,
        substrateSpecificLiftRequiresSeparatePreregisteredRawDerivedContrast: true,
        thisProcedureAuthorizesSubstrateSpecificLift: false,
      },
      planningBoundary: {
        acceptsOutcomeBooleans: false,
        computesMaterialBenefit: false,
        rawBatchVerifierDerivesAllOutcomes: true,
      },
    });
  });

  it("returns a hard-false planning disposition for every phase", () => {
    for (const phase of ["qualification", "procedural-holdout", "powered-confirmatory"] as const) {
      const disposition = sentinelProductionPlanningDisposition(plan(phase));
      expect(disposition).toMatchObject({
        acceptsOutcomes: false,
        materialBenefit: false,
        nextAuthority: "raw-batch-verifier",
        analysisProcedureSha256: SENTINEL_PRODUCTION_ANALYSIS_PROCEDURE_SHA256,
        rawBatchVerifierId: "sentinel-raw-batch-verifier-v1",
        rawBatchVerifierRevision: "7".repeat(40),
        rawBatchVerifierSha256: runtime().verifierScriptSha256,
      });
    }
  });

  it("rejects procedure drift even when the modified plan is freshly signed", () => {
    const preregistration = plan();
    const drifted = {
      ...preregistration,
      analysis: {
        ...preregistration.analysis,
        procedure: {
          ...preregistration.analysis.procedure,
          clusterBootstrap: {
            ...preregistration.analysis.procedure.clusterBootstrap,
            draws: 100,
          },
        },
      },
    } as unknown as SentinelProductionPreregistration;
    const driftedSignature = signed(drifted);
    const verification = verifySentinelProductionPreregistration(
      drifted,
      driftedSignature.signature,
      driftedSignature.trustAnchor,
    );
    expect(verification.valid).toBe(false);
    expect(verification.issues).toContain(
      "predeclared raw-derived analysis procedure or verifier identity changed",
    );
  });
});
