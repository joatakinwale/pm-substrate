import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSignedSentinelLivePreregistration,
  type SentinelLiveRuntimePaths,
  type SentinelLiveRuntimeSnapshot,
} from "./sentinel-live-runner.js";
import * as verificationModule from "./sentinel-live-verification.js";

const {
  classifySentinelLiveArtifactRole,
  verifySentinelBatchIdentityUniqueness,
  verifySentinelLiveBatchEvidence,
  verifySentinelMonitoringCoverage,
  verifySentinelNoContactTerminalEvidence,
  verifySentinelPollObservationBindings,
  verifySentinelRuntimeIdentityBindings,
  verifySentinelScreenshotBytes,
  verifySentinelSupervisorProcessRecords,
} = verificationModule;

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(label: string): string {
  const root = mkdtempSync(join(realpathSync.native(tmpdir()), `pm-sentinel-verify-${label}-`));
  roots.push(root);
  return root;
}

function sha(character: string): string {
  return character.repeat(64);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function atSeconds(seconds: number): string {
  return new Date(Date.parse("2026-07-14T00:00:00.000Z") + seconds * 1_000).toISOString();
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.byteLength);
  output.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(pngCrc32(output.subarray(4, 8 + data.byteLength)), 8 + data.byteLength);
  return output;
}

function completeScreenshotPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1_280, 0);
  header.writeUInt32BE(720, 4);
  header[8] = 8;
  header[9] = 6;
  const rowBytes = 1_280 * 4;
  const pixels = Buffer.alloc(720 * (rowBytes + 1));
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function signedPlan() {
  const runtimePaths: SentinelLiveRuntimePaths = {
    repositoryRoot: "/repo",
    packageLockPath: "/runtime/pnpm-lock.yaml",
    runnerScriptPath: "/runtime/runner.js",
    supervisorScriptPath: "/runtime/supervisor.js",
    verifierScriptPath: "/runtime/verifier.js",
    agentScriptPath: "/runtime/agent.js",
    sidecarScriptPath: "/runtime/sidecar.js",
    providerProxyScriptPath: "/runtime/provider.js",
    playwrightPackageJsonPath: "/runtime/playwright.json",
    nodeExecutablePath: "/runtime/node",
    pythonExecutablePath: "/runtime/python3",
    frontendExecutablePath: "/runtime/pnpm",
  };
  const runtime: SentinelLiveRuntimeSnapshot = {
    substrateRevision: "1".repeat(40),
    sourceTreeHash: "2".repeat(40),
    workingTreeClean: true,
    runtimeClosureSha256: sha("3"),
    packageLockSha256: sha("4"),
    runnerScriptSha256: sha("5"),
    supervisorScriptSha256: sha("6"),
    verifierScriptSha256: sha("7"),
    agentScriptSha256: sha("8"),
    sidecarScriptSha256: sha("9"),
    providerProxyScriptSha256: sha("a"),
    nodeVersion: "v26.0.0",
    pythonVersion: "Python 3.12.13",
    playwrightVersion: "1.56.1",
    artifacts: [],
    pythonExecutable: { path: runtimePaths.pythonExecutablePath, sha256: sha("b") },
    frontendExecutable: { path: runtimePaths.frontendExecutablePath, sha256: sha("c") },
  };
  return createSignedSentinelLivePreregistration({
    registrationId: "sentinel-verification-test",
    registeredAt: "2026-07-14T20:00:00.000Z",
    randomizationSeed: "sentinel-verification-seed",
    pricingAccessedAt: "2026-07-14T19:00:00.000Z",
    checkoutPath: "/public-sentinel",
    runtimePaths,
  }, {
    inspectRuntime: () => runtime,
    verifySource: () => ({
      valid: true,
      manifestSha256: "9da3305715740840299a1acc8b47bacf9a706eb293ad0cde3aee5d7e3adf1989",
      revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
      checkoutClean: true,
      issues: [],
    }),
    now: () => "2026-07-14T20:00:00.000Z",
  });
}

function processRecord(role: "server" | "frontend" | "harness", pid: number) {
  const cleanExit = { exitCode: 0, signal: null, spawnError: null };
  const serviceExit = { exitCode: null, signal: "SIGTERM", spawnError: null };
  const exit = role === "harness" ? cleanExit : serviceExit;
  return {
    role,
    pid,
    commandIdentitySha256: sha(role === "server" ? "a" : role === "frontend" ? "b" : "c"),
    timedOut: false,
    exit,
    treeTermination: {
      signalsSent: role === "harness" ? [] : [`SIGTERM:pid:${pid}`],
      observedPids: role === "harness" ? [pid, 9_001] : [pid],
      remainingPids: [],
      reaped: true,
      exit,
    },
    stdout: { path: `logs/${role}.stdout.log`, byteLength: 0, sha256: sha("d") },
    stderr: { path: `logs/${role}.stderr.log`, byteLength: 0, sha256: sha("e") },
  };
}

function runtimeIdentityFixture() {
  const stateOrigin = "http://127.0.0.1:4101";
  const providerOrigin = "http://127.0.0.1:4102";
  const serverOrigin = "http://127.0.0.1:4103";
  const frontendOrigin = "http://127.0.0.1:4104";
  const stateTokenHash = sha("a");
  const providerTokenHash = sha("b");
  return {
    supervisorPlan: {
      stateOrigin,
      serverUrl: serverOrigin,
      frontendUrl: frontendOrigin,
      environmentBindings: {
        harness: [
          { name: "PM_SENTINEL_STATE_ORIGIN", valueSha256: digest(stateOrigin) },
          { name: "PM_SENTINEL_STATE_TOKEN", valueSha256: stateTokenHash },
          { name: "PM_SENTINEL_PROVIDER_ORIGIN", valueSha256: digest(providerOrigin) },
          { name: "PM_SENTINEL_PROVIDER_TOKEN", valueSha256: providerTokenHash },
        ],
      },
    },
    supervisorProcesses: [
      processRecord("server", 8_001),
      processRecord("frontend", 8_002),
      processRecord("harness", 8_003),
    ],
    agentStart: {
      pid: 9_001,
      ppid: 8_003,
      stateOriginSha256: digest(stateOrigin),
      providerOriginSha256: digest(providerOrigin),
    },
    stateReady: { endpoint: `${stateOrigin}/v1/state`, tokenSha256: stateTokenHash },
    providerReady: { origin: providerOrigin, authorizationTokenSha256: providerTokenHash },
    declaredPorts: [4_101, 4_102, 4_103, 4_104],
  };
}

function batchIdentities() {
  return Array.from({ length: 27 }, (_, index) => ({
    cellId: `cell-${index + 1}`,
    ports: [20_000 + index * 4, 20_001 + index * 4, 20_002 + index * 4, 20_003 + index * 4],
    clientAttemptIds: [`client-${index + 1}`],
    providerRequestIds: [`req-${index + 1}`],
    providerMessageIds: [`msg-${index + 1}`],
  }));
}

describe("Sentinel raw-evidence and matrix verification", () => {
  it("requires exact one-to-one browser response, model-write, and state-observation linkage", () => {
    const events = [
      { poll: 1, captureId: "poll-0001", responseSha256: sha("a"), value: "1847" },
      { poll: 2, captureId: "poll-0002", responseSha256: sha("b"), value: "2047" },
    ];
    const responses = [
      { captureId: null, bodySha256: sha("a"), stars: 1_847 },
      { captureId: "poll-0001", bodySha256: sha("a"), stars: 1_847 },
      { captureId: "poll-0002", bodySha256: sha("b"), stars: 2_047 },
    ];
    expect(verifySentinelPollObservationBindings(events, responses)).toEqual({
      valid: true,
      issues: [],
      boundStars: [1_847, 2_047],
    });
    expect(verifySentinelPollObservationBindings(
      [{ ...events[0]!, value: "1848" }, events[1]!],
      responses,
    ).valid).toBe(false);
    expect(verifySentinelPollObservationBindings(events, [
      ...responses,
      { captureId: "poll-0001", bodySha256: sha("a"), stars: 1_847 },
    ]).valid).toBe(false);
    const injected = verifySentinelPollObservationBindings(events, [
      ...responses,
      { captureId: "poll-9999", bodySha256: sha("c"), stars: 99_999 },
    ]);
    expect(injected.valid).toBe(false);
    expect(injected.issues).toContain("capture-tagged repository response 4 is not consumed by exactly one poll");
  });

  it("rejects a truncated screenshot even when its PNG header declares the right viewport", () => {
    const complete = completeScreenshotPng();
    expect(verifySentinelScreenshotBytes(complete)).toBe(true);
    expect(verifySentinelScreenshotBytes(complete.subarray(0, 33))).toBe(false);
    expect(verifySentinelScreenshotBytes(complete.subarray(0, -1))).toBe(false);
    const corruptCrc = Buffer.from(complete);
    corruptCrc[corruptCrc.byteLength - 1] ^= 1;
    expect(verifySentinelScreenshotBytes(corruptCrc)).toBe(false);
  });

  it("rejects early no-contact exits and requires bound clean harness-timeout evidence", () => {
    const harnessStdout = `Prompt:\n...\n${"Agent subprocess timed out, killing process group..."}\n`;
    const fullHorizon = verifySentinelNoContactTerminalEvidence({
      evaluationTime: 630,
      harnessTimedOut: false,
      harnessExitCode: 0,
      harnessSignal: null,
      harnessSpawnError: null,
      harnessStdout,
    });
    expect(fullHorizon).toEqual({
      valid: true,
      issues: [],
      harnessScenarioHorizonDivergenceObserved: false,
    });
    expect(verifySentinelNoContactTerminalEvidence({
      evaluationTime: 42,
      harnessTimedOut: false,
      harnessExitCode: 0,
      harnessSignal: null,
      harnessSpawnError: null,
      harnessStdout: "agent exited normally\n",
    }).valid).toBe(false);
    expect(verifySentinelNoContactTerminalEvidence({
      evaluationTime: 700,
      harnessTimedOut: false,
      harnessExitCode: 0,
      harnessSignal: null,
      harnessSpawnError: null,
      harnessStdout,
    })).toMatchObject({ valid: true, harnessScenarioHorizonDivergenceObserved: true });
  });

  it("rejects two early polls followed by sleep instead of full-horizon monitoring", () => {
    const complete = verifySentinelMonitoringCoverage({
      agentStartedAt: atSeconds(0),
      eventObservedAts: Array.from({ length: 21 }, (_, index) => atSeconds(index * 30)),
      pollIntervalMs: 30_000,
    });
    expect(complete).toEqual({ valid: true, issues: [] });
    const slept = verifySentinelMonitoringCoverage({
      agentStartedAt: atSeconds(0),
      eventObservedAts: [atSeconds(0), atSeconds(30), atSeconds(600)],
      pollIntervalMs: 30_000,
    });
    expect(slept.valid).toBe(false);
    expect(slept.issues.join("\n")).toMatch(/cadence|at least/u);
  });

  it("rejects swapped service origins, bearer hashes, and semantic port order", () => {
    const fixture = runtimeIdentityFixture();
    expect(verifySentinelRuntimeIdentityBindings(fixture)).toEqual({ valid: true, issues: [] });
    const swapped = {
      ...fixture,
      agentStart: {
        ...fixture.agentStart,
        stateOriginSha256: fixture.agentStart.providerOriginSha256,
        providerOriginSha256: fixture.agentStart.stateOriginSha256,
      },
      supervisorPlan: {
        ...fixture.supervisorPlan,
        environmentBindings: {
          harness: fixture.supervisorPlan.environmentBindings.harness.map((binding) =>
            binding.name === "PM_SENTINEL_STATE_TOKEN"
              ? { ...binding, valueSha256: sha("f") }
              : binding),
        },
      },
      declaredPorts: [4_102, 4_101, 4_103, 4_104],
    };
    const result = verifySentinelRuntimeIdentityBindings(swapped);
    expect(result.valid).toBe(false);
    expect(result.issues.join("\n")).toMatch(/origin hashes|STATE_TOKEN|semantic order/u);
  });

  it("rejects skeletal supervisor process evidence and command identity substitution", () => {
    const processes = [
      processRecord("server", 8_001),
      processRecord("frontend", 8_002),
      processRecord("harness", 8_003),
    ];
    const commands = [
      { role: "server", identitySha256: sha("a") },
      { role: "frontend", identitySha256: sha("b") },
      { role: "harness", identitySha256: sha("c") },
    ];
    expect(verifySentinelSupervisorProcessRecords({ processes, commands })).toEqual({
      valid: true,
      issues: [],
    });
    const skeletal = processes.map((process) => process.role === "harness"
      ? { role: "harness", pid: process.pid }
      : process);
    expect(verifySentinelSupervisorProcessRecords({ processes: skeletal, commands }).valid).toBe(false);
    const substituted = processes.map((process) => process.role === "server"
      ? { ...process, commandIdentitySha256: sha("f") }
      : process);
    expect(verifySentinelSupervisorProcessRecords({
      processes: substituted,
      commands,
    }).issues.join("\n")).toMatch(/command identity/u);
  });

  it("rejects any reused provider identity or service port across the 27-cell batch", () => {
    const identities = batchIdentities();
    expect(verifySentinelBatchIdentityUniqueness(identities)).toEqual({ valid: true, issues: [] });
    const duplicated = identities.map((cell, index) => index === 26
      ? {
        ...cell,
        ports: [identities[0]!.ports[0]!, ...cell.ports.slice(1)],
        providerMessageIds: identities[0]!.providerMessageIds,
      }
      : cell);
    const result = verifySentinelBatchIdentityUniqueness(duplicated);
    expect(result.valid).toBe(false);
    expect(result.issues.join("\n")).toMatch(/108 globally unique|provider message/u);
  });

  it("classifies only exact raw artifact paths into evidence-bearing roles", () => {
    expect(classifySentinelLiveArtifactRole("input/scenario-definition.json")).toBe("scenario-definition");
    expect(classifySentinelLiveArtifactRole("upstream/runtime/agent/poll-0001.png")).toBe("agent-screenshot");
    expect(classifySentinelLiveArtifactRole(`provider/audit/00000001-${sha("a")}.json`)).toBe("provider-audit");
    expect(classifySentinelLiveArtifactRole("provider/audit/not-an-audit.json")).toBe("supporting");
    expect(() => classifySentinelLiveArtifactRole("../escape.json")).toThrow(/portable/u);
  });

  it("keeps caller-fabricable matrix summaries internal while preserving raw batch verification", () => {
    expect("analyzeSentinelLiveMatrix" in verificationModule).toBe(false);
    expect(typeof verifySentinelLiveBatchEvidence).toBe("function");
  });

  it("returns an ineligible retained failure rather than promoting an incomplete batch", () => {
    const signed = signedPlan();
    const root = temporaryRoot("incomplete");
    const result = verifySentinelLiveBatchEvidence({
      batchRoot: root,
      executionManifestPath: resolve(root, `execution-${sha("d")}.json`),
      executionManifestSha256: sha("d"),
      preregistration: signed.preregistration,
      signature: signed.signature,
      expectedPreregistrationSha256: signed.expectedPreregistrationSha256,
      cellManifestPaths: [],
    });
    expect(result).toMatchObject({
      valid: false,
      complete: false,
      materialBenefit: false,
      verifiedCellCount: 0,
      eligibleForIndependentAnalysis: false,
      publicEfficacyEligible: false,
      qualificationOnly: true,
    });
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
