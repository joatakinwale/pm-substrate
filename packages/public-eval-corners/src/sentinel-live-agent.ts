#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium, type Page, type Response as PlaywrightResponse } from "playwright";

import {
  SENTINEL_STATE_READ_SCHEMA_VERSION,
  SENTINEL_STATE_WRITE_SCHEMA_VERSION,
  parseSentinelStateResponse,
  type SentinelStateReadRequest,
  type SentinelStateResponse,
  type SentinelStateWriteRequest,
} from "./sentinel-state-sidecar.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const ATTEMPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const OPERATION_ID = /^[a-f0-9]{32}$/u;
const SAFE_STAR_COUNT = /^(?:0|[1-9][0-9]{0,8})$/u;
const ARM_IDENTITY = /\b(?:native|sham|substrate|treatment|control[ -]?arm)\b/iu;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_NETWORK_BODY_BYTES = 8 * 1024 * 1024;

export const SENTINEL_MEMORY_KEY = "microhub.star-count" as const;

type JsonRecord = Record<string, unknown>;

export interface SentinelAgentDecision {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-agent-decision.v1";
  readonly operationId: string;
  readonly action: "wait" | "contact";
  readonly stateWrite: string;
  readonly reason: string;
  readonly providerExchangeHash: string;
}

interface AgentRuntimeConfig {
  readonly attemptId: string;
  readonly taskUrl: string;
  readonly taskPrompt: string;
  readonly outputRoot: string;
  readonly providerOrigin: string;
  readonly providerToken: string;
  readonly stateOrigin: string;
  readonly stateToken: string;
  readonly pollIntervalMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
}

export interface SentinelBrowserStarObservation {
  readonly value: string;
  readonly responseSha256: string;
}

export type SentinelOperationKind = "state-read" | "provider-decision" | "state-write";

export interface PendingWriteBarrier {
  track(work: Promise<void>): void;
  flush(): Promise<void>;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${path} keys are not exact`);
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function boundedInteger(name: string, minimum: number, maximum: number): number {
  const value = Number(requiredEnvironment(name));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer in [${minimum}, ${maximum}]`);
  }
  return value;
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function normalizedHttpOrigin(value: string, path: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/") {
    throw new Error(`${path} must be an http://127.0.0.1:<port> origin`);
  }
  return url.origin;
}

function runtimeConfig(): AgentRuntimeConfig {
  const attemptId = requiredEnvironment("PM_SENTINEL_ATTEMPT_ID");
  if (!ATTEMPT_ID.test(attemptId)) throw new Error("PM_SENTINEL_ATTEMPT_ID is invalid");
  const outputRoot = resolve(requiredEnvironment("PM_SENTINEL_AGENT_OUTPUT_ROOT"));
  return {
    attemptId,
    taskUrl: option("--url"),
    taskPrompt: option("--prompt"),
    outputRoot,
    providerOrigin: normalizedHttpOrigin(
      requiredEnvironment("PM_SENTINEL_PROVIDER_ORIGIN"),
      "PM_SENTINEL_PROVIDER_ORIGIN",
    ),
    providerToken: requiredEnvironment("PM_SENTINEL_PROVIDER_TOKEN"),
    stateOrigin: normalizedHttpOrigin(
      requiredEnvironment("PM_SENTINEL_STATE_ORIGIN"),
      "PM_SENTINEL_STATE_ORIGIN",
    ),
    stateToken: requiredEnvironment("PM_SENTINEL_STATE_TOKEN"),
    pollIntervalMs: boundedInteger("PM_SENTINEL_POLL_INTERVAL_MS", 1_000, 120_000),
    viewport: {
      width: boundedInteger("PM_SENTINEL_VIEWPORT_WIDTH", 800, 2_560),
      height: boundedInteger("PM_SENTINEL_VIEWPORT_HEIGHT", 600, 1_440),
    },
  };
}

function exclusiveJson(path: string, value: unknown): void {
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function appendJsonl(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

async function boundedResponseBytes(response: globalThis.Response): Promise<Buffer> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_RESPONSE_BYTES)
  ) {
    throw new Error("response size is invalid");
  }
  if (response.body === null) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      byteLength += chunk.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("response size is invalid");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, byteLength);
}

export async function strictJsonPost(
  origin: string,
  token: string,
  route: string,
  body: JsonRecord,
): Promise<JsonRecord> {
  const response = await fetch(`${origin}${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  const bytes = await boundedResponseBytes(response);
  if (!response.ok) {
    throw new Error(`${route} failed with HTTP ${response.status}`);
  }
  if (bytes.byteLength === 0) {
    throw new Error(`${route} response size is invalid`);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new Error(`${route} response content type is invalid`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${route} response is not JSON`);
  }
  if (!isRecord(parsed)) throw new Error(`${route} response must be an object`);
  return parsed;
}

export function sentinelOperationId(
  attemptId: string,
  poll: number,
  kind: SentinelOperationKind,
): string {
  if (!ATTEMPT_ID.test(attemptId)) throw new Error("attempt ID is invalid");
  if (!Number.isSafeInteger(poll) || poll < 1) throw new Error("poll is invalid");
  if (kind !== "state-read" && kind !== "provider-decision" && kind !== "state-write") {
    throw new Error("operation kind is invalid");
  }
  return sha256(`pm.sentinel.operation-id.v1\0${attemptId}\0${poll}\0${kind}`).slice(0, 32);
}

function requireOperationId(value: string, path: string): string {
  if (!OPERATION_ID.test(value)) throw new Error(`${path} is invalid`);
  return value;
}

export function parseSafeNumericBrowserObservation(value: unknown): string {
  if (typeof value !== "string" || !SAFE_STAR_COUNT.test(value)) {
    throw new Error("provider stateWrite is not a safe numeric browser observation");
  }
  return value;
}

export function parseSentinelBrowserStarResponse(
  body: string,
): SentinelBrowserStarObservation {
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("browser star observation response size is invalid");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error("browser star observation response is not JSON");
  }
  if (!isRecord(parsed) || parsed.success !== true || !isRecord(parsed.repository)) {
    throw new Error("browser star observation response is invalid");
  }
  const stars = parsed.repository.stars;
  if (!Number.isSafeInteger(stars) || Number(stars) < 0 || Number(stars) > 999_999_999) {
    throw new Error("browser star observation is not a safe numeric value");
  }
  return {
    value: String(stars),
    responseSha256: sha256(Buffer.from(body, "utf8")),
  };
}

async function observeBrowserStars(page: Page): Promise<SentinelBrowserStarObservation> {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/data/microhub-repository", {
      cache: "no-store",
      headers: { accept: "application/json" },
      method: "GET",
    });
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
      status: response.status,
      url: response.url,
    };
  });
  const url = new URL(result.url);
  if (
    url.pathname !== "/api/data/microhub-repository" ||
    result.status !== 200 ||
    result.contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    throw new Error("browser star observation did not use the expected read-only endpoint");
  }
  return parseSentinelBrowserStarResponse(result.body);
}

export function buildSentinelStateReadRequest(operationId: string): SentinelStateReadRequest {
  return {
    schemaVersion: SENTINEL_STATE_READ_SCHEMA_VERSION,
    operationId: requireOperationId(operationId, "state read operation ID"),
    memoryKey: SENTINEL_MEMORY_KEY,
  };
}

export function buildSentinelStateWriteRequest(
  operationId: string,
  observedAt: string,
  observation: unknown,
): SentinelStateWriteRequest {
  const date = new Date(observedAt);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== observedAt) {
    throw new Error("browser observation timestamp is not canonical");
  }
  return {
    schemaVersion: SENTINEL_STATE_WRITE_SCHEMA_VERSION,
    operationId: requireOperationId(operationId, "state write operation ID"),
    memoryKey: SENTINEL_MEMORY_KEY,
    observation: {
      source: "browser_observation",
      observedAt,
      value: parseSafeNumericBrowserObservation(observation),
    },
  };
}

export function parseAgentStateResponse(
  value: unknown,
  operationId: string,
): SentinelStateResponse {
  const expectedOperationId = requireOperationId(operationId, "expected state operation ID");
  const response = parseSentinelStateResponse(value);
  if (response.operationId !== expectedOperationId) {
    throw new Error("state response operation ID does not match request");
  }
  if (response.status !== "ok") throw new Error("state sidecar rejected the operation");
  if (ARM_IDENTITY.test(response.context)) {
    throw new Error("state response exposed experiment-arm identity");
  }
  return response;
}

export async function readSentinelState(
  origin: string,
  token: string,
  operationId: string,
): Promise<SentinelStateResponse> {
  return parseAgentStateResponse(
    await strictJsonPost(
      origin,
      token,
      "/v1/state/read",
      buildSentinelStateReadRequest(operationId) as unknown as JsonRecord,
    ),
    operationId,
  );
}

export async function writeSentinelState(
  origin: string,
  token: string,
  operationId: string,
  observedAt: string,
  observation: unknown,
): Promise<SentinelStateResponse> {
  return parseAgentStateResponse(
    await strictJsonPost(
      origin,
      token,
      "/v1/state/write",
      buildSentinelStateWriteRequest(operationId, observedAt, observation) as unknown as JsonRecord,
    ),
    operationId,
  );
}

export function parseAgentDecision(
  value: unknown,
  operationId: string,
): SentinelAgentDecision {
  const expectedOperationId = requireOperationId(operationId, "expected provider operation ID");
  if (!isRecord(value)) throw new Error("provider decision must be an object");
  exactKeys(
    value,
    [
      "action",
      "operationId",
      "providerExchangeHash",
      "reason",
      "schemaVersion",
      "stateWrite",
    ],
    "provider decision",
  );
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-agent-decision.v1" ||
    value.operationId !== expectedOperationId ||
    (value.action !== "wait" && value.action !== "contact") ||
    typeof value.reason !== "string" ||
    value.reason.length < 1 ||
    value.reason.length > 2_000 ||
    typeof value.providerExchangeHash !== "string" ||
    !SHA256.test(value.providerExchangeHash)
  ) {
    throw new Error("provider decision is invalid");
  }
  parseSafeNumericBrowserObservation(value.stateWrite);
  if (ARM_IDENTITY.test(value.reason)) {
    throw new Error("provider decision exposed experiment-arm identity");
  }
  return value as unknown as SentinelAgentDecision;
}

export function extractContactUrl(prompt: string): string {
  const matches = prompt.match(/https?:\/\/[^\s)]+\/contact\b/gu) ?? [];
  if (matches.length !== 1) throw new Error("task prompt must contain exactly one contact URL");
  const url = new URL(matches[0] as string);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("contact URL must remain on the loopback benchmark server");
  }
  return url.toString();
}

export function createPendingWriteBarrier(): PendingWriteBarrier {
  const pending = new Set<Promise<void>>();
  let failed = false;

  return {
    track(work: Promise<void>): void {
      const settled = work.then(
        () => undefined,
        () => {
          failed = true;
        },
      );
      pending.add(settled);
      void settled.then(() => pending.delete(settled));
    },
    async flush(): Promise<void> {
      while (true) {
        await waitForImmediate();
        const snapshot = [...pending];
        if (snapshot.length === 0) {
          await waitForImmediate();
          if (pending.size === 0) break;
          continue;
        }
        await Promise.all(snapshot);
      }
      if (failed) throw new Error("browser network capture failed");
    },
  };
}

async function captureNetworkResponse(
  response: PlaywrightResponse,
  path: string,
): Promise<void> {
  const headers = await response.allHeaders();
  const contentType = headers["content-type"] ?? "";
  const responseUrl = new URL(response.url());
  const captureContact = responseUrl.pathname === "/contact";
  if (!contentType.toLowerCase().includes("application/json") && !captureContact) return;
  const bytes = Buffer.from(await response.body());
  if (bytes.byteLength > MAX_NETWORK_BODY_BYTES) {
    throw new Error("browser network response exceeds the capture limit");
  }
  appendJsonl(path, {
    schemaVersion: "pm.public-eval-corners.sentinel-browser-response.v1",
    recordedAt: new Date().toISOString(),
    url: response.url(),
    method: response.request().method(),
    status: response.status(),
    contentType,
    byteLength: bytes.byteLength,
    bodySha256: sha256(bytes),
    bodyBase64: bytes.toString("base64"),
  });
}

function installNetworkCapture(page: Page, outputRoot: string): PendingWriteBarrier {
  const path = resolve(outputRoot, "browser-network.jsonl");
  const barrier = createPendingWriteBarrier();
  page.on("response", (response: PlaywrightResponse) => {
    barrier.track(captureNetworkResponse(response, path));
  });
  return barrier;
}

async function notifyContact(page: Page, contactUrl: string, reason: string): Promise<void> {
  await page.goto(contactUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const textarea = page.locator("textarea[name=message]");
  await textarea.fill(reason.slice(0, 1_000));
  await page.locator("button[type=submit]").click();
  await page.waitForLoadState("networkidle");
}

async function run(): Promise<void> {
  const config = runtimeConfig();
  mkdirSync(config.outputRoot, { recursive: false, mode: 0o700 });
  const eventPath = resolve(config.outputRoot, "agent-events.jsonl");
  exclusiveJson(resolve(config.outputRoot, "agent-start.json"), {
    schemaVersion: "pm.public-eval-corners.sentinel-agent-start.v1",
    attemptId: config.attemptId,
    pid: process.pid,
    ppid: process.ppid,
    taskUrlSha256: sha256(config.taskUrl),
    taskPromptSha256: sha256(config.taskPrompt),
    pollIntervalMs: config.pollIntervalMs,
    viewport: config.viewport,
    providerOriginSha256: sha256(config.providerOrigin),
    stateOriginSha256: sha256(config.stateOrigin),
    armIdentityVisible: false,
  });

  const browser = await chromium.launch({ headless: true });
  let networkCapture: PendingWriteBarrier | undefined;
  try {
    const context = await browser.newContext({ viewport: config.viewport });
    const page = await context.newPage();
    networkCapture = installNetworkCapture(page, config.outputRoot);
    await page.goto(config.taskUrl, { waitUntil: "networkidle", timeout: 60_000 });
    const contactUrl = extractContactUrl(config.taskPrompt);

    let poll = 0;
    while (true) {
      poll += 1;
      const pollId = String(poll).padStart(4, "0");
      const screenshotPath = resolve(config.outputRoot, `poll-${pollId}.png`);
      const browserObservation = await observeBrowserStars(page);
      await networkCapture.flush();
      const screenshot = await page.screenshot({
        path: screenshotPath,
        type: "png",
        fullPage: false,
      });
      const observedAt = new Date().toISOString();
      const screenshotSha256 = sha256(screenshot);
      const readOperationId = sentinelOperationId(config.attemptId, poll, "state-read");
      const stateRead = await readSentinelState(
        config.stateOrigin,
        config.stateToken,
        readOperationId,
      );
      const modelOperationId = sentinelOperationId(
        config.attemptId,
        poll,
        "provider-decision",
      );
      const decision = parseAgentDecision(
        await strictJsonPost(config.providerOrigin, config.providerToken, "/v1/decide", {
          schemaVersion: "pm.public-eval-corners.sentinel-provider-request.v1",
          operationId: modelOperationId,
          taskPrompt: config.taskPrompt,
          observation: {
            sha256: screenshotSha256,
            mimeType: "image/png",
            dataBase64: screenshot.toString("base64"),
          },
          stateContext: stateRead.context,
        }),
        modelOperationId,
      );
      const writeOperationId = sentinelOperationId(config.attemptId, poll, "state-write");
      const stateWrite = await writeSentinelState(
        config.stateOrigin,
        config.stateToken,
        writeOperationId,
        observedAt,
        decision.stateWrite,
      );
      appendJsonl(eventPath, {
        schemaVersion: "pm.public-eval-corners.sentinel-agent-poll.v1",
        poll,
        screenshotPath: `poll-${pollId}.png`,
        screenshotSha256,
        browserObservationValue: browserObservation.value,
        browserObservationResponseSha256: browserObservation.responseSha256,
        observedAt,
        stateReadOperationId: readOperationId,
        stateReadContextSha256: sha256(stateRead.context),
        providerOperationId: modelOperationId,
        providerExchangeHash: decision.providerExchangeHash,
        stateWriteOperationId: writeOperationId,
        stateWriteContextSha256: sha256(stateWrite.context),
        stateWriteValueSha256: sha256(decision.stateWrite),
        action: decision.action,
        reason: decision.reason,
      });
      if (decision.action === "contact") {
        await notifyContact(page, contactUrl, decision.reason);
        await networkCapture.flush();
        exclusiveJson(resolve(config.outputRoot, "agent-terminal.json"), {
          schemaVersion: "pm.public-eval-corners.sentinel-agent-terminal.v1",
          attemptId: config.attemptId,
          outcome: "contact-submitted",
          poll,
          providerExchangeHash: decision.providerExchangeHash,
        });
        return;
      }
      await page.waitForTimeout(config.pollIntervalMs);
      await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
    }
  } finally {
    let captureFailure: unknown;
    try {
      await networkCapture?.flush();
    } catch (error) {
      captureFailure = error;
    }
    await browser.close();
    if (captureFailure !== undefined) throw captureFailure;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    process.stderr.write(`sentinel live agent failed: ${message}\n`);
    process.exitCode = 1;
  });
}
