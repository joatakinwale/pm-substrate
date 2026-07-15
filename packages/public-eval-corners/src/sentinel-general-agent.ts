#!/usr/bin/env node

import {
  createHash,
  generateKeyPairSync,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";
import {
  appendFileSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { chromium, type Page, type Response as PlaywrightResponse } from "playwright";

import {
  PRODUCTION_STATE_READ_SCHEMA_VERSION,
  PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
  fixedStateSummary,
  parseProductionStateResponse,
  type ProductionStateReadRequest,
  type ProductionStateResponse,
  type ProductionStateWriteRequest,
} from "./production-state-sidecar.js";

const OPERATION_ID = /^[a-f0-9]{32}$/u;
const ATTEMPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ARM_IDENTITY = /\b(?:native|sham|plain[ -]?kv|substrate|treatment|control[ -]?arm)\b/iu;
const SAFE_MEMORY_NOTE = /^[\x20-\x21\x23-\x5b\x5d-\x7e]{1,512}$/u;
const MAX_HTTP_RESPONSE_BYTES = 12 * 1024 * 1024;
const MAX_PASSIVE_BODY_BYTES = 16 * 1024 * 1024;
const SAFE_PRESS_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Backspace",
  "Delete",
  "End",
  "Enter",
  "Escape",
  "Home",
  "PageDown",
  "PageUp",
  "Space",
  "Tab",
]);

type JsonRecord = Record<string, unknown>;

interface RuntimeConfig {
  readonly attemptId: string;
  readonly startUrl: string;
  readonly taskPrompt: string;
  readonly outputRoot: string;
  readonly providerOrigin: string;
  readonly providerToken: string;
  readonly stateOrigin: string;
  readonly stateToken: string;
  readonly waitIntervalMs: number;
  readonly activeSettleMs: number;
  readonly maxDecisions: number;
  readonly maxConsecutiveActiveActions: number;
  readonly viewport: { readonly width: number; readonly height: number };
}

interface ObservationInput {
  readonly sha256: string;
  readonly mimeType: "image/png";
  readonly dataBase64: string;
}

export interface GeneralDecisionBase {
  readonly memoryNote: string;
  readonly reason: string;
}

export type SentinelGeneralModelAction =
  | (GeneralDecisionBase & { readonly action: "wait" })
  | (GeneralDecisionBase & { readonly action: "terminate" })
  | (GeneralDecisionBase & { readonly action: "navigate"; readonly url: string })
  | (GeneralDecisionBase & {
      readonly action: "click";
      readonly x: number;
      readonly y: number;
      readonly button: "left" | "middle" | "right";
    })
  | (GeneralDecisionBase & {
      readonly action: "type";
      readonly x: number;
      readonly y: number;
      readonly text: string;
    })
  | (GeneralDecisionBase & { readonly action: "press"; readonly key: string })
  | (GeneralDecisionBase & {
      readonly action: "scroll";
      readonly deltaX: number;
      readonly deltaY: number;
    });

export type SentinelGeneralAgentDecision = SentinelGeneralModelAction & {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1";
  readonly operationId: string;
  readonly providerExchangeHash: string;
};

export interface GeneralWaitCadenceBody {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-wait-cadence.v1";
  readonly decision: number;
  readonly completedAtMonotonicMs: number;
  readonly previousDeadlineMonotonicMs: number;
  readonly deadlineMonotonicMs: number;
  readonly intervalMs: number;
  readonly providerExchangeHash: string;
  readonly previousCadenceReceiptSha256: string | null;
}

export interface SignedGeneralWaitCadence extends GeneralWaitCadenceBody {
  readonly cadenceReceiptSha256: string;
  readonly signatureBase64: string;
}

export interface GeneralTerminalArtifact {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-agent-terminal.v1";
  readonly attemptId: string;
  readonly outcome: "behavioral-early-exit" | "action-limit";
  readonly decision: number;
  readonly providerExchangeHash: string | null;
  readonly reason: string;
  readonly recordedAt: string;
}

interface StrictPostResult {
  readonly requestSha256: string;
  readonly responseSha256: string;
  readonly value: JsonRecord;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.join(",") !== wanted.join(",")) throw new Error(`${path} keys are not exact`);
}

function requireOperationId(value: unknown, path: string): string {
  if (typeof value !== "string" || !OPERATION_ID.test(value)) {
    throw new Error(`${path} must be exactly 32 lowercase hexadecimal characters`);
  }
  return value;
}

function requireReason(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 4_096) {
    throw new Error("provider reason is invalid");
  }
  if (ARM_IDENTITY.test(value)) throw new Error("provider reason exposed execution identity");
  return value;
}

function requireMemoryNote(value: unknown): string {
  if (
    typeof value !== "string" ||
    !SAFE_MEMORY_NOTE.test(value) ||
    value.trim() === "" ||
    ARM_IDENTITY.test(value)
  ) throw new Error("provider memoryNote is invalid");
  return value;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, path: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${path} is invalid`);
  }
  return Number(value);
}

function safeUrl(value: string, path: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) throw new Error(`${path} is not a safe HTTP URL`);
  return value;
}

export function sentinelGeneralOperationId(
  attemptId: string,
  decision: number,
  kind: "state-read" | "provider-decision" | "state-write",
): string {
  if (!ATTEMPT_ID.test(attemptId)) throw new Error("attempt ID is invalid");
  if (!Number.isSafeInteger(decision) || decision < 1) throw new Error("decision is invalid");
  if (kind !== "state-read" && kind !== "provider-decision" && kind !== "state-write") {
    throw new Error("operation kind is invalid");
  }
  return sha256(`pm.sentinel.general.operation.v1\0${attemptId}\0${decision}\0${kind}`).slice(0, 32);
}

export function buildGeneralStateReadRequest(operationId: string): ProductionStateReadRequest {
  return {
    schemaVersion: PRODUCTION_STATE_READ_SCHEMA_VERSION,
    operationId: requireOperationId(operationId, "state read operationId"),
  };
}

export function buildGeneralStateWriteRequest(
  operationId: string,
  observedAt: string,
  memoryNote: string,
): ProductionStateWriteRequest {
  const date = new Date(observedAt);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== observedAt) {
    throw new Error("observedAt must be a canonical UTC timestamp with milliseconds");
  }
  return {
    schemaVersion: PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
    operationId: requireOperationId(operationId, "state write operationId"),
    observedAt,
    stateSummary: fixedStateSummary(requireMemoryNote(memoryNote)),
  };
}

export function parseGeneralStateResponse(
  value: unknown,
  expectedOperationId: string,
): ProductionStateResponse {
  const expected = requireOperationId(expectedOperationId, "expected state operationId");
  const response = parseProductionStateResponse(value);
  if (response.operationId !== expected) throw new Error("state operationId does not match request");
  if (response.status !== "ok") throw new Error("state sidecar rejected the operation");
  if (ARM_IDENTITY.test(response.stateSummary)) {
    throw new Error("state response exposed execution identity");
  }
  return response;
}

export function parseSentinelGeneralDecision(
  value: unknown,
  expectedOperationId: string,
): SentinelGeneralAgentDecision {
  const expected = requireOperationId(expectedOperationId, "expected provider operationId");
  if (!isRecord(value)) throw new Error("provider decision must be an object");
  const action = value.action;
  const common = [
    "action",
    "memoryNote",
    "operationId",
    "providerExchangeHash",
    "reason",
    "schemaVersion",
  ];
  if (action === "click") exactKeys(value, [...common, "button", "x", "y"], "click decision");
  else if (action === "type") exactKeys(value, [...common, "text", "x", "y"], "type decision");
  else if (action === "press") exactKeys(value, [...common, "key"], "press decision");
  else if (action === "scroll") exactKeys(value, [...common, "deltaX", "deltaY"], "scroll decision");
  else if (action === "navigate") exactKeys(value, [...common, "url"], "navigate decision");
  else if (action === "wait" || action === "terminate") {
    exactKeys(value, common, `${action} decision`);
  } else {
    throw new Error("provider action is unsupported");
  }
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-general-agent-decision.v1" ||
    value.operationId !== expected ||
    typeof value.providerExchangeHash !== "string" ||
    !SHA256.test(value.providerExchangeHash)
  ) throw new Error("provider decision envelope is invalid");
  const memoryNote = requireMemoryNote(value.memoryNote);
  const reason = requireReason(value.reason);
  if (action === "navigate") {
    if (typeof value.url !== "string") throw new Error("navigate URL is invalid");
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: expected,
      providerExchangeHash: value.providerExchangeHash,
      action,
      url: safeUrl(value.url, "navigate URL"),
      memoryNote,
      reason,
    };
  }
  if (action === "click") {
    if (value.button !== "left" && value.button !== "middle" && value.button !== "right") {
      throw new Error("click button is invalid");
    }
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: expected,
      providerExchangeHash: value.providerExchangeHash,
      action,
      x: boundedInteger(value.x, 0, 16_384, "click x"),
      y: boundedInteger(value.y, 0, 16_384, "click y"),
      button: value.button,
      memoryNote,
      reason,
    };
  }
  if (action === "type") {
    if (typeof value.text !== "string" || value.text.length === 0 || value.text.length > 4_000) {
      throw new Error("type text is invalid");
    }
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: expected,
      providerExchangeHash: value.providerExchangeHash,
      action,
      x: boundedInteger(value.x, 0, 16_384, "type x"),
      y: boundedInteger(value.y, 0, 16_384, "type y"),
      text: value.text,
      memoryNote,
      reason,
    };
  }
  if (action === "press") {
    if (typeof value.key !== "string" || !SAFE_PRESS_KEYS.has(value.key)) {
      throw new Error("press key is invalid");
    }
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: expected,
      providerExchangeHash: value.providerExchangeHash,
      action,
      key: value.key,
      memoryNote,
      reason,
    };
  }
  if (action === "scroll") {
    const deltaX = boundedInteger(value.deltaX, -10_000, 10_000, "scroll deltaX");
    const deltaY = boundedInteger(value.deltaY, -10_000, 10_000, "scroll deltaY");
    if (deltaX === 0 && deltaY === 0) throw new Error("scroll delta must move the page");
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: expected,
      providerExchangeHash: value.providerExchangeHash,
      action,
      deltaX,
      deltaY,
      memoryNote,
      reason,
    };
  }
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
    operationId: expected,
    providerExchangeHash: value.providerExchangeHash,
    action,
    memoryNote,
    reason,
  };
}

export function nextGeneralWaitDeadline(
  previousDeadlineMs: number,
  completedAtMs: number,
  intervalMs: number,
): number {
  if (
    !Number.isFinite(previousDeadlineMs) ||
    !Number.isFinite(completedAtMs) ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0
  ) throw new Error("wait cadence inputs are invalid");
  let next = previousDeadlineMs + intervalMs;
  if (next <= completedAtMs) {
    next += (Math.floor((completedAtMs - next) / intervalMs) + 1) * intervalMs;
  }
  return next;
}

export function signGeneralWaitCadence(
  body: GeneralWaitCadenceBody,
  privateKey: KeyObject,
): SignedGeneralWaitCadence {
  if (!SHA256.test(body.providerExchangeHash)) throw new Error("provider exchange hash is invalid");
  if (
    body.previousCadenceReceiptSha256 !== null &&
    !SHA256.test(body.previousCadenceReceiptSha256)
  ) throw new Error("previous cadence receipt hash is invalid");
  if (body.deadlineMonotonicMs <= body.completedAtMonotonicMs) {
    throw new Error("wait deadline must be after completion");
  }
  const bytes = Buffer.from(canonical(body));
  return {
    ...body,
    cadenceReceiptSha256: sha256(bytes),
    signatureBase64: signBytes(null, bytes, privateKey).toString("base64"),
  };
}

export function verifyGeneralWaitCadence(
  cadence: SignedGeneralWaitCadence,
  publicKeyDerBase64: string,
): boolean {
  const { cadenceReceiptSha256, signatureBase64, ...body } = cadence;
  const bytes = Buffer.from(canonical(body));
  if (cadenceReceiptSha256 !== sha256(bytes)) return false;
  try {
    return verifyBytes(
      null,
      bytes,
      { key: Buffer.from(publicKeyDerBase64, "base64"), format: "der", type: "spki" },
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

export function terminalArtifactForDecision(
  attemptId: string,
  decision: number,
  action: SentinelGeneralAgentDecision,
  recordedAt: string,
): GeneralTerminalArtifact | null {
  if (action.action !== "terminate") return null;
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-terminal.v1",
    attemptId,
    outcome: "behavioral-early-exit",
    decision,
    providerExchangeHash: action.providerExchangeHash,
    reason: action.reason,
    recordedAt,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function integerEnvironment(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
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

function loopbackOrigin(value: string, path: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/") {
    throw new Error(`${path} must be an http://127.0.0.1:<port> origin`);
  }
  return url.origin;
}

function loopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function urlCandidates(value: string): readonly string[] {
  return value.match(/https?:\/\/[^\s<>"']+/gu) ?? [];
}

export function sentinelGeneralNavigationOrigins(
  startUrl: string,
  taskPrompt: string,
): ReadonlySet<string> {
  return sentinelGeneralNavigationPolicy(startUrl, taskPrompt).origins;
}

export interface SentinelGeneralNavigationPolicy {
  readonly origins: ReadonlySet<string>;
  /** Exact URLs the model may request through the direct `navigate` action. */
  readonly directUrls: ReadonlySet<string>;
}

export function sentinelGeneralNavigationPolicy(
  startUrl: string,
  taskPrompt: string,
): SentinelGeneralNavigationPolicy {
  const exactStart = safeUrl(startUrl, "start URL");
  let decodedStart = exactStart;
  try {
    decodedStart = decodeURIComponent(exactStart);
  } catch {
    throw new Error("start URL encoding is invalid");
  }
  const parsedStart = new URL(exactStart);
  const candidates = [
    exactStart,
    ...parsedStart.searchParams.values(),
    ...urlCandidates(decodedStart),
    ...urlCandidates(taskPrompt),
  ];
  const origins = new Set<string>();
  const directUrls = new Set<string>();
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate.replace(/[),.;]+$/u, ""));
    } catch {
      continue;
    }
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      loopbackHostname(parsed.hostname) &&
      parsed.username === "" &&
      parsed.password === ""
    ) {
      origins.add(parsed.origin);
      directUrls.add(parsed.toString());
    }
  }
  const startOrigin = new URL(exactStart).origin;
  if (
    !origins.has(startOrigin) ||
    origins.size < 1 ||
    origins.size > 2 ||
    directUrls.size < 1 ||
    directUrls.size > 8
  ) {
    throw new Error("start URL and task prompt must expose one or two loopback origins");
  }
  return Object.freeze({ origins, directUrls });
}

export function assertSentinelGeneralNavigationAllowed(
  urlValue: string,
  directUrls: ReadonlySet<string>,
): string {
  const exact = safeUrl(urlValue, "navigate URL");
  const parsed = new URL(exact);
  if (!loopbackHostname(parsed.hostname) || !directUrls.has(parsed.toString())) {
    throw new Error("navigate URL is not an exact prompt-declared URL");
  }
  return exact;
}

function runtimeConfig(): RuntimeConfig {
  const attemptId = requiredEnvironment("PM_SENTINEL_ATTEMPT_ID");
  if (!ATTEMPT_ID.test(attemptId)) throw new Error("PM_SENTINEL_ATTEMPT_ID is invalid");
  return {
    attemptId,
    startUrl: safeUrl(option("--url"), "start URL"),
    taskPrompt: option("--prompt"),
    outputRoot: resolve(requiredEnvironment("PM_SENTINEL_AGENT_OUTPUT_ROOT")),
    providerOrigin: loopbackOrigin(
      requiredEnvironment("PM_SENTINEL_PROVIDER_ORIGIN"),
      "PM_SENTINEL_PROVIDER_ORIGIN",
    ),
    providerToken: requiredEnvironment("PM_SENTINEL_PROVIDER_TOKEN"),
    stateOrigin: loopbackOrigin(
      requiredEnvironment("PM_SENTINEL_STATE_ORIGIN"),
      "PM_SENTINEL_STATE_ORIGIN",
    ),
    stateToken: requiredEnvironment("PM_SENTINEL_STATE_TOKEN"),
    waitIntervalMs: integerEnvironment("PM_SENTINEL_POLL_INTERVAL_MS", 10_000, 250, 120_000),
    activeSettleMs: integerEnvironment("PM_SENTINEL_ACTIVE_SETTLE_MS", 250, 0, 5_000),
    maxDecisions: integerEnvironment("PM_SENTINEL_MAX_DECISIONS", 1_000, 1, 10_000),
    maxConsecutiveActiveActions: integerEnvironment(
      "PM_SENTINEL_MAX_ACTIVE_ACTIONS",
      64,
      1,
      1_000,
    ),
    viewport: {
      width: integerEnvironment("PM_SENTINEL_VIEWPORT_WIDTH", 1_280, 800, 2_560),
      height: integerEnvironment("PM_SENTINEL_VIEWPORT_HEIGHT", 720, 600, 1_440),
    },
  };
}

function writeExclusiveJson(path: string, value: unknown): void {
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function appendJsonLine(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

async function boundedBody(response: globalThis.Response): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_HTTP_RESPONSE_BYTES)) {
    throw new Error("response size is invalid");
  }
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const bytes = Buffer.from(result.value);
      size += bytes.byteLength;
      if (size > MAX_HTTP_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("response size is invalid");
      }
      chunks.push(bytes);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function strictPost(
  origin: string,
  token: string,
  route: "/read" | "/write" | "/v1/decide",
  body: JsonRecord,
): Promise<StrictPostResult> {
  const requestBytes = Buffer.from(JSON.stringify(body));
  const response = await fetch(`${origin}${route}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: requestBytes,
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  const responseBytes = await boundedBody(response);
  if (!response.ok) throw new Error(`${route} failed with HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json" || responseBytes.byteLength === 0) {
    throw new Error(`${route} response is not nonempty JSON`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${route} response is invalid JSON`);
  }
  if (!isRecord(parsed)) throw new Error(`${route} response must be an object`);
  return {
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(responseBytes),
    value: parsed,
  };
}

interface PassiveNetworkCapture {
  flush(): Promise<void>;
}

function installPassiveNetworkCapture(page: Page, outputRoot: string): PassiveNetworkCapture {
  const path = resolve(outputRoot, "browser-network.jsonl");
  let sequence = 0;
  let serial: Promise<void> = Promise.resolve();
  let failure: unknown;
  page.on("response", (response: PlaywrightResponse) => {
    const current = sequence + 1;
    sequence = current;
    serial = serial.then(async () => {
      let body: Buffer | null = null;
      let bodyFailureSha256: string | null = null;
      try {
        body = Buffer.from(await response.body());
        if (body.byteLength > MAX_PASSIVE_BODY_BYTES) {
          throw new Error("passive response body exceeds capture limit");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown passive capture failure";
        bodyFailureSha256 = sha256(message);
      }
      const headers = await response.allHeaders();
      appendJsonLine(path, {
        schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v1",
        sequence: current,
        recordedAt: new Date().toISOString(),
        url: response.url(),
        method: response.request().method(),
        resourceType: response.request().resourceType(),
        status: response.status(),
        headers,
        bodyByteLength: body?.byteLength ?? null,
        bodySha256: body === null ? null : sha256(body),
        bodyBase64: body?.toString("base64") ?? null,
        bodyFailureSha256,
      });
    }).catch((error: unknown) => {
      failure ??= error;
    });
  });
  return {
    async flush(): Promise<void> {
      await serial;
      if (failure !== undefined) throw failure;
    },
  };
}

async function applyBrowserAction(
  page: Page,
  action: SentinelGeneralAgentDecision,
  viewport: RuntimeConfig["viewport"],
  directNavigationUrls: ReadonlySet<string>,
): Promise<void> {
  if (action.action === "navigate") {
    await page.goto(
      assertSentinelGeneralNavigationAllowed(action.url, directNavigationUrls),
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
  } else if (action.action === "click") {
    if (action.x >= viewport.width || action.y >= viewport.height) {
      throw new Error("click coordinates exceed the fixed viewport");
    }
    await page.mouse.click(action.x, action.y, { button: action.button });
  } else if (action.action === "type") {
    if (action.x >= viewport.width || action.y >= viewport.height) {
      throw new Error("type coordinates exceed the fixed viewport");
    }
    await page.mouse.click(action.x, action.y);
    await page.keyboard.type(action.text);
  } else if (action.action === "press") {
    await page.keyboard.press(action.key === "Space" ? " " : action.key);
  } else if (action.action === "scroll") {
    await page.mouse.wheel(action.deltaX, action.deltaY);
  }
}

function actionForArtifact(action: SentinelGeneralAgentDecision): JsonRecord {
  const { schemaVersion: _schema, operationId: _operation, providerExchangeHash: _exchange, ...model } = action;
  return model;
}

export async function runSentinelGeneralAgent(): Promise<void> {
  const config = runtimeConfig();
  const navigationPolicy = sentinelGeneralNavigationPolicy(config.startUrl, config.taskPrompt);
  mkdirSync(config.outputRoot, { recursive: false, mode: 0o700 });
  const eventPath = resolve(config.outputRoot, "agent-events.jsonl");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const startedAt = new Date().toISOString();
  writeExclusiveJson(resolve(config.outputRoot, "agent-start.json"), {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-start.v1",
    attemptId: config.attemptId,
    pid: process.pid,
    ppid: process.ppid,
    startedAt,
    startUrl: config.startUrl,
    startUrlSha256: sha256(config.startUrl),
    taskPrompt: config.taskPrompt,
    taskPromptSha256: sha256(config.taskPrompt),
    waitIntervalMs: config.waitIntervalMs,
    activeSettleMs: config.activeSettleMs,
    maxDecisions: config.maxDecisions,
    maxConsecutiveActiveActions: config.maxConsecutiveActiveActions,
    viewport: config.viewport,
    cadencePublicKeyDerBase64: publicKeyDer.toString("base64"),
    cadencePublicKeySha256: sha256(publicKeyDer),
    providerOriginSha256: sha256(config.providerOrigin),
    stateOriginSha256: sha256(config.stateOrigin),
    navigationOrigins: [...navigationPolicy.origins].sort(compareCodeUnits),
    directNavigationUrls: [...navigationPolicy.directUrls].sort(compareCodeUnits),
  });

  const browser = await chromium.launch({ headless: true });
  let passiveCapture: PassiveNetworkCapture | undefined;
  try {
    const context = await browser.newContext({ viewport: config.viewport });
    const page = await context.newPage();
    passiveCapture = installPassiveNetworkCapture(page, config.outputRoot);
    await page.goto(config.startUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await passiveCapture.flush();

    let decisionNumber = 0;
    let consecutiveActiveActions = 0;
    let previousDeadlineMs = performance.now();
    let previousCadenceReceiptSha256: string | null = null;
    while (decisionNumber < config.maxDecisions) {
      decisionNumber += 1;
      const label = String(decisionNumber).padStart(6, "0");
      const screenshotPath = resolve(config.outputRoot, `decision-${label}.png`);
      const currentUrl = safeUrl(page.url(), "current browser URL");
      const screenshot = await page.screenshot({
        path: screenshotPath,
        type: "png",
        fullPage: false,
      });
      const screenshotSha256 = sha256(screenshot);
      const observedAt = new Date().toISOString();

      const stateReadOperationId = sentinelGeneralOperationId(
        config.attemptId,
        decisionNumber,
        "state-read",
      );
      const stateReadRequest = buildGeneralStateReadRequest(stateReadOperationId);
      const stateReadExchange = await strictPost(
        config.stateOrigin,
        config.stateToken,
        "/read",
        stateReadRequest as unknown as JsonRecord,
      );
      const stateRead = parseGeneralStateResponse(
        stateReadExchange.value,
        stateReadOperationId,
      );

      const providerOperationId = sentinelGeneralOperationId(
        config.attemptId,
        decisionNumber,
        "provider-decision",
      );
      const providerRequest = {
        schemaVersion: "pm.public-eval-corners.sentinel-general-provider-request.v1",
        operationId: providerOperationId,
        taskPrompt: config.taskPrompt,
        startUrl: config.startUrl,
        currentUrl,
        observation: {
          sha256: screenshotSha256,
          mimeType: "image/png",
          dataBase64: screenshot.toString("base64"),
        } satisfies ObservationInput,
        stateContext: stateRead.stateSummary,
      };
      const providerExchange = await strictPost(
        config.providerOrigin,
        config.providerToken,
        "/v1/decide",
        providerRequest,
      );
      const decision = parseSentinelGeneralDecision(
        providerExchange.value,
        providerOperationId,
      );

      const stateWriteOperationId = sentinelGeneralOperationId(
        config.attemptId,
        decisionNumber,
        "state-write",
      );
      const stateWriteRequest = buildGeneralStateWriteRequest(
        stateWriteOperationId,
        observedAt,
        decision.memoryNote,
      );
      const stateWriteExchange = await strictPost(
        config.stateOrigin,
        config.stateToken,
        "/write",
        stateWriteRequest as unknown as JsonRecord,
      );
      parseGeneralStateResponse(stateWriteExchange.value, stateWriteOperationId);

      appendJsonLine(eventPath, {
        schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision-event.v1",
        decision: decisionNumber,
        observedAt,
        currentUrl,
        screenshotPath: `decision-${label}.png`,
        screenshotByteLength: screenshot.byteLength,
        screenshotSha256,
        stateReadOperationId,
        stateReadRequestSha256: stateReadExchange.requestSha256,
        stateReadResponseSha256: stateReadExchange.responseSha256,
        stateContextSha256: sha256(stateRead.stateSummary),
        providerOperationId,
        providerRequestSha256: providerExchange.requestSha256,
        providerResponseSha256: providerExchange.responseSha256,
        providerExchangeHash: decision.providerExchangeHash,
        stateWriteOperationId,
        stateWriteRequestSha256: stateWriteExchange.requestSha256,
        stateWriteResponseSha256: stateWriteExchange.responseSha256,
        stateWriteSummarySha256: sha256(stateWriteRequest.stateSummary),
        action: actionForArtifact(decision),
      });

      const terminal = terminalArtifactForDecision(
        config.attemptId,
        decisionNumber,
        decision,
        new Date().toISOString(),
      );
      if (terminal !== null) {
        await passiveCapture.flush();
        writeExclusiveJson(resolve(config.outputRoot, "agent-terminal.json"), terminal);
        return;
      }

      if (decision.action === "wait") {
        consecutiveActiveActions = 0;
        const completedAtMonotonicMs = performance.now();
        const deadlineMonotonicMs = nextGeneralWaitDeadline(
          previousDeadlineMs,
          completedAtMonotonicMs,
          config.waitIntervalMs,
        );
        const cadence = signGeneralWaitCadence({
          schemaVersion: "pm.public-eval-corners.sentinel-general-wait-cadence.v1",
          decision: decisionNumber,
          completedAtMonotonicMs,
          previousDeadlineMonotonicMs: previousDeadlineMs,
          deadlineMonotonicMs,
          intervalMs: config.waitIntervalMs,
          providerExchangeHash: decision.providerExchangeHash,
          previousCadenceReceiptSha256,
        }, privateKey);
        appendJsonLine(eventPath, cadence);
        previousDeadlineMs = deadlineMonotonicMs;
        previousCadenceReceiptSha256 = cadence.cadenceReceiptSha256;
        await page.waitForTimeout(Math.max(0, deadlineMonotonicMs - performance.now()));
        await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
        await passiveCapture.flush();
        continue;
      }

      consecutiveActiveActions += 1;
      if (consecutiveActiveActions > config.maxConsecutiveActiveActions) {
        await passiveCapture.flush();
        writeExclusiveJson(resolve(config.outputRoot, "agent-terminal.json"), {
          schemaVersion: "pm.public-eval-corners.sentinel-general-agent-terminal.v1",
          attemptId: config.attemptId,
          outcome: "action-limit",
          decision: decisionNumber,
          providerExchangeHash: decision.providerExchangeHash,
          reason: "The consecutive browser-action limit was exceeded.",
          recordedAt: new Date().toISOString(),
        } satisfies GeneralTerminalArtifact);
        return;
      }
      await applyBrowserAction(page, decision, config.viewport, navigationPolicy.directUrls);
      appendJsonLine(eventPath, {
        schemaVersion: "pm.public-eval-corners.sentinel-general-agent-action-completed.v1",
        decision: decisionNumber,
        completedAt: new Date().toISOString(),
        currentUrl: safeUrl(page.url(), "current browser URL after action"),
        providerOperationId,
        providerExchangeHash: decision.providerExchangeHash,
        action: actionForArtifact(decision),
      });
      if (config.activeSettleMs > 0) await page.waitForTimeout(config.activeSettleMs);
      await passiveCapture.flush();
    }

    writeExclusiveJson(resolve(config.outputRoot, "agent-terminal.json"), {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-terminal.v1",
      attemptId: config.attemptId,
      outcome: "action-limit",
      decision: config.maxDecisions,
      providerExchangeHash: null,
      reason: "The total decision limit was reached.",
      recordedAt: new Date().toISOString(),
    } satisfies GeneralTerminalArtifact);
  } finally {
    let captureFailure: unknown;
    try {
      await passiveCapture?.flush();
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
  runSentinelGeneralAgent().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    process.stderr.write(`sentinel general agent failed: ${message}\n`);
    process.exitCode = 1;
  });
}
