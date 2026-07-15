import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildGeneralStateReadRequest,
  buildGeneralStateWriteRequest,
  nextGeneralWaitDeadline,
  parseGeneralStateResponse,
  parseSentinelGeneralDecision,
  assertSentinelGeneralNavigationAllowed,
  sentinelGeneralNavigationPolicy,
  sentinelGeneralOperationId,
  sentinelGeneralNavigationOrigins,
  signGeneralWaitCadence,
  terminalArtifactForDecision,
  verifyGeneralWaitCadence,
  type SentinelGeneralAgentDecision,
} from "./sentinel-general-agent.js";

const HASH = "a".repeat(64);
const OPERATION_ID = "1".repeat(32);
const TEMPORARY_DIRECTORIES: string[] = [];

function envelope(action: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
    operationId: OPERATION_ID,
    providerExchangeHash: HASH,
    memoryNote: "Keep the first visible value and the submitted status",
    reason: "The next browser operation is supported by the visible page.",
    ...action,
  };
}

function parsed(action: Record<string, unknown>): SentinelGeneralAgentDecision {
  return parseSentinelGeneralDecision(envelope(action), OPERATION_ID);
}

afterEach(() => {
  for (const directory of TEMPORARY_DIRECTORIES.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("task-agnostic Sentinel browser agent", () => {
  it("parses every exact action shape and rejects mixed or unsafe actions", () => {
    expect(parsed({ action: "wait" }).action).toBe("wait");
    expect(parsed({ action: "terminate" }).action).toBe("terminate");
    expect(parsed({ action: "navigate", url: "http://127.0.0.1:8765/form" })).toMatchObject({
      action: "navigate",
      url: "http://127.0.0.1:8765/form",
    });
    expect(parsed({ action: "click", x: 25, y: 40, button: "left" })).toMatchObject({
      action: "click",
      x: 25,
      y: 40,
      button: "left",
    });
    expect(parsed({ action: "type", x: 25, y: 40, text: "visible input" })).toMatchObject({
      action: "type",
      text: "visible input",
    });
    expect(parsed({ action: "press", key: "Enter" })).toMatchObject({
      action: "press",
      key: "Enter",
    });
    expect(parsed({ action: "scroll", deltaX: 0, deltaY: 450 })).toMatchObject({
      action: "scroll",
      deltaY: 450,
    });

    expect(() => parsed({ action: "wait", x: 1 })).toThrow(/keys are not exact/);
    expect(() => parsed({ action: "press", key: "Meta+A" })).toThrow(/press key/);
    expect(() => parsed({ action: "scroll", deltaX: 0, deltaY: 0 })).toThrow(/must move/);
    expect(() => parseSentinelGeneralDecision({
      ...envelope({ action: "wait" }),
      operationId: "not-hex",
    }, OPERATION_ID)).toThrow(/envelope/);
    expect(() => parseSentinelGeneralDecision({
      ...envelope({ action: "wait" }),
      memoryNote: "execution uses substrate",
    }, OPERATION_ID)).toThrow(/memoryNote/);
  });

  it("uses the production state API with 32-hex identifiers and exact 512-byte padding", () => {
    const readId = sentinelGeneralOperationId("attempt-one", 1, "state-read");
    const providerId = sentinelGeneralOperationId("attempt-one", 1, "provider-decision");
    const writeId = sentinelGeneralOperationId("attempt-one", 1, "state-write");
    expect(readId).toMatch(/^[a-f0-9]{32}$/u);
    expect(new Set([readId, providerId, writeId]).size).toBe(3);
    expect(buildGeneralStateReadRequest(readId)).toEqual({
      schemaVersion: "pm.public-eval-corners.production-state-read.v1",
      operationId: readId,
    });
    const write = buildGeneralStateWriteRequest(
      writeId,
      "2026-07-14T12:00:00.000Z",
      "Remember the first visible amount",
    );
    expect(write.schemaVersion).toBe("pm.public-eval-corners.production-state-write.v1");
    expect(write.stateSummary).toHaveLength(512);
    expect(write.stateSummary.trimEnd()).toBe("Remember the first visible amount");
    expect(() => buildGeneralStateWriteRequest(
      writeId,
      "2026-07-14T12:00:00.000Z",
      "unsafe backslash \\ note",
    )).toThrow(/memoryNote/);

    const response = parseGeneralStateResponse({
      schemaVersion: "pm.public-eval-corners.production-state-response.v1",
      operationId: readId,
      status: "ok",
      stateEncoding: "fixed-printable-ascii-space-padded-v1",
      stateSummary: " ".repeat(512),
      padding: ".".repeat(128),
    }, readId);
    expect(response.stateSummary).toHaveLength(512);
    expect(() => parseGeneralStateResponse({ ...response, operationId: writeId }, readId)).toThrow(
      /does not match/,
    );
  });

  it("advances missed waits monotonically and signs a tamper-evident cadence chain", () => {
    expect(nextGeneralWaitDeadline(100, 101, 10)).toBe(110);
    expect(nextGeneralWaitDeadline(100, 145, 10)).toBe(150);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const first = signGeneralWaitCadence({
      schemaVersion: "pm.public-eval-corners.sentinel-general-wait-cadence.v1",
      decision: 1,
      completedAtMonotonicMs: 145,
      previousDeadlineMonotonicMs: 100,
      deadlineMonotonicMs: 150,
      intervalMs: 10,
      providerExchangeHash: HASH,
      previousCadenceReceiptSha256: null,
    }, privateKey);
    expect(verifyGeneralWaitCadence(first, publicDer)).toBe(true);
    expect(verifyGeneralWaitCadence({ ...first, deadlineMonotonicMs: 151 }, publicDer)).toBe(false);
    const second = signGeneralWaitCadence({
      schemaVersion: "pm.public-eval-corners.sentinel-general-wait-cadence.v1",
      decision: 2,
      completedAtMonotonicMs: 151,
      previousDeadlineMonotonicMs: first.deadlineMonotonicMs,
      deadlineMonotonicMs: 160,
      intervalMs: 10,
      providerExchangeHash: "b".repeat(64),
      previousCadenceReceiptSha256: first.cadenceReceiptSha256,
    }, privateKey);
    expect(second.previousCadenceReceiptSha256).toBe(first.cadenceReceiptSha256);
    expect(verifyGeneralWaitCadence(second, publicDer)).toBe(true);
  });

  it("creates terminal evidence only for declared behavioral exits, so crashes cannot masquerade", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-general-agent-terminal-"));
    TEMPORARY_DIRECTORIES.push(root);
    const terminalPath = join(root, "agent-terminal.json");
    const wait = parsed({ action: "wait" });
    expect(terminalArtifactForDecision(
      "attempt-one",
      1,
      wait,
      "2026-07-14T12:00:00.000Z",
    )).toBeNull();
    expect(existsSync(terminalPath)).toBe(false);

    const earlyExit = terminalArtifactForDecision(
      "attempt-one",
      2,
      parsed({ action: "terminate" }),
      "2026-07-14T12:00:01.000Z",
    );
    expect(earlyExit).toMatchObject({ outcome: "behavioral-early-exit", decision: 2 });
    expect(terminalArtifactForDecision(
      "attempt-one",
      3,
      parsed({ action: "navigate", url: "http://127.0.0.1:8765/form" }),
      "2026-07-14T12:00:02.000Z",
    )).toBeNull();

    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "sentinel-general-agent.ts"),
      "utf8",
    );
    const cliFailure = source.slice(source.lastIndexOf("runSentinelGeneralAgent().catch"));
    expect(cliFailure).not.toContain("agent-terminal.json");
  });

  it("contains no benchmark answer path or task-specific environment reader", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const sources = [
      readFileSync(join(root, "sentinel-general-agent.ts"), "utf8"),
      readFileSync(join(root, "sentinel-general-provider-proxy.ts"), "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/\bmicrohub\b|\brepository\b|\bstars?\b|\bscenario\b|\btimeline\b|\beval(?:uation)?\s+sql\b|\/api\/data/iu);
    expect(sources).not.toMatch(/taskId|task_id|scenarioJson|conditionJson/iu);
    expect(sources).not.toContain("textarea[name=message]");
    expect(sources).not.toContain("button[type=submit]");
  });

  it("allows direct navigation only to exact prompt-declared URLs", () => {
    const startUrl = "http://127.0.0.1:8765/redirect?frontend_url=http%3A%2F%2F127.0.0.1%3A5173";
    const taskPrompt = "When appropriate, visit http://127.0.0.1:8765/form and use the visible form.";
    const policy = sentinelGeneralNavigationPolicy(startUrl, taskPrompt);
    const origins = sentinelGeneralNavigationOrigins(startUrl, taskPrompt);
    expect([...origins].sort()).toEqual([
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8765",
    ]);
    expect(assertSentinelGeneralNavigationAllowed(
      "http://127.0.0.1:8765/form",
      policy.directUrls,
    )).toBe("http://127.0.0.1:8765/form");
    expect(() => assertSentinelGeneralNavigationAllowed(
      "http://127.0.0.1:9999/form",
      policy.directUrls,
    )).toThrow(/not an exact/);
    expect(() => assertSentinelGeneralNavigationAllowed(
      "http://127.0.0.1:8765/status",
      policy.directUrls,
    )).toThrow(/not an exact/);
    expect(() => assertSentinelGeneralNavigationAllowed(
      "http://127.0.0.1:8765/data/config",
      policy.directUrls,
    )).toThrow(/not an exact/);
    expect(() => assertSentinelGeneralNavigationAllowed(
      "http://127.0.0.1:8765/scenarios",
      policy.directUrls,
    )).toThrow(/not an exact/);
    expect(() => assertSentinelGeneralNavigationAllowed("https://example.com/form", policy.directUrls)).toThrow(
      /not an exact/,
    );
    expect(() => assertSentinelGeneralNavigationAllowed("file:///tmp/form", policy.directUrls)).toThrow(
      /safe HTTP URL/,
    );
    expect(() => assertSentinelGeneralNavigationAllowed("data:text/html,form", policy.directUrls)).toThrow(
      /safe HTTP URL/,
    );

    const sequence = [
      parsed({ action: "navigate", url: "http://127.0.0.1:8765/form" }),
      parsed({ action: "type", x: 300, y: 250, text: "visible form text" }),
      parsed({ action: "click", x: 300, y: 400, button: "left" }),
    ];
    expect(sequence.map((action) => action.action)).toEqual(["navigate", "type", "click"]);
    expect(sequence.every((action) => terminalArtifactForDecision(
      "attempt-one",
      4,
      action,
      "2026-07-14T12:00:03.000Z",
    ) === null)).toBe(true);
  });
});
