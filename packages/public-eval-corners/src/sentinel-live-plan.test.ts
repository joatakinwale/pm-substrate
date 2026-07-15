import {
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SENTINEL_MATERIAL_LIFT_RULE,
  buildSentinelLiveSchedule,
  sentinelJsonSha256,
  sentinelLiveOwnerObjective,
  sentinelSha256,
  verifySentinelPreregistration,
  type SentinelLivePreregistration,
  type SentinelPreregistrationSignature,
} from "./sentinel-live-plan.js";

function preregistration(): SentinelLivePreregistration {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-preregistration.v1",
    registrationId: "sentinel-live-qualification-20260714",
    registeredAt: "2026-07-14T03:00:00.000Z",
    objective: sentinelLiveOwnerObjective,
    implementation: {
      substrateRevision: "1".repeat(40),
      sourceTreeHash: "2".repeat(40),
      workingTreeClean: true,
      runtimeClosureSha256: "3".repeat(64),
      runnerScriptSha256: "4".repeat(64),
      supervisorScriptSha256: "5".repeat(64),
      verifierScriptSha256: "6".repeat(64),
      packageLockSha256: "7".repeat(64),
      nodeVersion: "v26.0.0",
      pythonVersion: "Python 3.12.13",
      playwrightVersion: "1.56.1",
    },
    benchmark: {
      repositoryUrl: "https://github.com/microsoft/sentinel_environments",
      revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
      manifestSha256: "9da3305715740840299a1acc8b47bacf9a706eb293ad0cde3aee5d7e3adf1989",
      speedFactor: 1,
      publishedDefaultSpeedFactor: 1,
      qualificationOnly: true,
    },
    tasks: [
      {
        taskId: "microhub-stars-relative-passive",
        role: "headline-relative-state-failure",
        scenarioSha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
      },
      {
        taskId: "microhub-stars-noop",
        role: "anti-degenerate-noop",
        scenarioSha256: "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
      },
      {
        taskId: "microhub-stars-absolute-passive",
        role: "expected-allow-absolute",
        scenarioSha256: "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
      },
    ],
    arms: ["native", "sham", "substrate"],
    repeatIds: ["replicate-01", "replicate-02", "replicate-03"],
    randomizationSeed: "sentinel-live-qualification-seed-20260714",
    model: {
      provider: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
      maxCompletionTokens: 256,
      automaticRetries: 0,
      pricing: {
        sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
        accessedAt: "2026-07-14T02:54:00.000Z",
        baseInputUsdPerMillionTokens: 3,
        outputUsdPerMillionTokens: 15,
        promptCachingEnabled: false,
      },
    },
    agent: {
      statelessAcrossPolls: true,
      pollIntervalMs: 30_000,
      viewport: { width: 1280, height: 720 },
      screenshotMediaType: "image/png",
      scriptSha256: "a".repeat(64),
    },
    treatment: {
      agentReceivesArmIdentity: false,
      interfaceShapeIdentical: true,
      fixedWidthStateContext: true,
      nativePersistence: "discard",
      shamPersistence: "persist-write-return-irrelevant",
      substratePersistence: "admit-first-browser-observation",
      sidecarScriptSha256: "b".repeat(64),
    },
    evidence: {
      providerProxyScriptSha256: "c".repeat(64),
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
      requiredCleanControls: [
        "microhub-stars-noop",
        "microhub-stars-absolute-passive",
      ],
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
}

function signed(plan: SentinelLivePreregistration): SentinelPreregistrationSignature {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const preregistrationSha256 = sentinelJsonSha256(plan);
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-preregistration-signature.v1",
    preregistrationSha256,
    algorithm: "Ed25519",
    publicKeyPem,
    publicKeySha256: sentinelSha256(publicKeyPem),
    signatureBase64: signBytes(
      null,
      Buffer.from(preregistrationSha256, "hex"),
      privateKey,
    ).toString("base64"),
  };
}

describe("Sentinel live preregistration", () => {
  it("accepts the signed exact three-task, three-arm, three-repeat universe", () => {
    const plan = preregistration();
    const signature = signed(plan);
    const verification = verifySentinelPreregistration(
      plan,
      signature,
      sentinelJsonSha256(plan),
    );
    expect(verification.valid).toBe(true);
    expect(verification.signatureValid).toBe(true);
    expect(verification.cells).toHaveLength(27);
    expect(new Set(verification.cells.map(({ cellId }) => cellId))).toHaveLength(27);
    expect(verification.cells.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );
    for (let index = 0; index < verification.cells.length; index += 3) {
      const block = verification.cells.slice(index, index + 3);
      expect(new Set(block.map(({ taskId }) => taskId))).toHaveLength(1);
      expect(new Set(block.map(({ repeatId }) => repeatId))).toHaveLength(1);
      expect(new Set(block.map(({ arm }) => arm))).toEqual(
        new Set(["native", "sham", "substrate"]),
      );
    }
  });

  it("builds a deterministic but seed-sensitive complete schedule", () => {
    const plan = preregistration();
    expect(buildSentinelLiveSchedule(plan)).toEqual(buildSentinelLiveSchedule(plan));
    const changed = {
      ...plan,
      randomizationSeed: "sentinel-live-qualification-seed-changed",
    };
    expect(buildSentinelLiveSchedule(changed).map(({ cellId }) => cellId)).not.toEqual(
      buildSentinelLiveSchedule(plan).map(({ cellId }) => cellId),
    );
  });

  it("rejects post-signature task, threshold, and hash tampering", () => {
    const plan = preregistration();
    const signature = signed(plan);
    const expectedHash = sentinelJsonSha256(plan);
    const taskTamper = {
      ...plan,
      tasks: plan.tasks.slice(0, 2),
    } as SentinelLivePreregistration;
    const thresholdTamper = {
      ...plan,
      analysis: {
        ...plan.analysis,
        minimumMaterialLift: "declare anything material after seeing results",
      },
    } as unknown as SentinelLivePreregistration;
    expect(verifySentinelPreregistration(taskTamper, signature, expectedHash).valid).toBe(false);
    expect(verifySentinelPreregistration(thresholdTamper, signature, expectedHash).valid).toBe(false);
    expect(
      verifySentinelPreregistration(plan, signature, "f".repeat(64)).valid,
    ).toBe(false);
  });

  it("rejects one-repeat plans and self-promotion to efficacy eligibility", () => {
    const shortPlan = {
      ...preregistration(),
      repeatIds: ["replicate-01"],
    } as SentinelLivePreregistration;
    const promoted = {
      ...preregistration(),
      eligibility: {
        ...preregistration().eligibility,
        publicEfficacyEligibleBeforeExternalVerification: true,
      },
    } as unknown as SentinelLivePreregistration;
    const shortSignature = signed(shortPlan);
    const promotedSignature = signed(promoted);
    expect(
      verifySentinelPreregistration(
        shortPlan,
        shortSignature,
        sentinelJsonSha256(shortPlan),
      ).valid,
    ).toBe(false);
    expect(
      verifySentinelPreregistration(
        promoted,
        promotedSignature,
        sentinelJsonSha256(promoted),
      ).valid,
    ).toBe(false);
  });

  it("rejects signed unknown fields instead of treating them as harmless metadata", () => {
    const extra = {
      ...preregistration(),
      postHocExplanation: "added after looking at outcomes",
    } as unknown as SentinelLivePreregistration;
    const signature = signed(extra);
    const checked = verifySentinelPreregistration(
      extra,
      signature,
      sentinelJsonSha256(extra),
    );
    expect(checked.valid).toBe(false);
    expect(checked.issues).toContain("preregistration keys are not exact");
  });
});
