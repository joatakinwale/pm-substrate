import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { Page, Request, Response } from "playwright";

const MAX_BODY_BYTES = 16 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

export interface SentinelBrowserNetworkCaptureReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-browser-network-terminal.v1";
  readonly sealedBy: "agent-after-browser-close" | "supervisor-after-process-reap";
  readonly sealerPid: number;
  readonly recordCount: number;
  readonly headRecordSha256: string | null;
  readonly networkJsonlByteLength: number;
  readonly networkJsonlSha256: string;
  readonly sealedAt: string;
  readonly receiptSha256: string;
}

export interface SentinelBrowserNetworkCapture {
  flush(): Promise<void>;
  seal(): Promise<SentinelBrowserNetworkCaptureReceipt>;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("network record contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error("network record is not canonical JSON");
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function appendDurably(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeExclusive(path: string, value: unknown): void {
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function bodyFields(bytes: Buffer | null): JsonRecord {
  return {
    bodyByteLength: bytes?.byteLength ?? null,
    bodySha256: bytes === null ? null : sha256(bytes),
    bodyBase64: bytes?.toString("base64") ?? null,
  };
}

function assertBodyFields(value: JsonRecord, label: string): void {
  const length = value["bodyByteLength"];
  const hash = value["bodySha256"];
  const base64 = value["bodyBase64"];
  if (length === null && hash === null && base64 === null) return;
  if (
    !Number.isSafeInteger(length) || Number(length) < 0 ||
    typeof hash !== "string" || !/^[a-f0-9]{64}$/u.test(hash) ||
    typeof base64 !== "string"
  ) throw new Error(`${label} body identity is invalid`);
  const bytes = Buffer.from(base64, "base64");
  if (
    bytes.toString("base64") !== base64 ||
    bytes.byteLength !== length ||
    sha256(bytes) !== hash
  ) throw new Error(`${label} body bytes do not match their identity`);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Replays and seals an already-closed browser network file. The supervisor
 * uses this after the harness process tree is reaped, which is essential for
 * correct no-op attempts where the upstream horizon kills the agent before
 * its `finally` block can execute.
 */
export function sealSentinelBrowserNetworkArtifact(
  outputRoot: string,
  sealedBy: SentinelBrowserNetworkCaptureReceipt["sealedBy"],
): SentinelBrowserNetworkCaptureReceipt {
  const networkPath = resolve(outputRoot, "browser-network.jsonl");
  const terminalPath = resolve(outputRoot, "browser-network-terminal.json");
  const bytes = readFileSync(networkPath);
  const text = bytes.toString("utf8");
  if (bytes.byteLength === 0 || !text.endsWith("\n")) {
    throw new Error("browser network JSONL is empty or has a partial terminal record");
  }
  const lines = text.slice(0, -1).split("\n");
  const requestHashes = new Map<string, string>();
  let previousRecordSha256: string | null = null;
  for (const [index, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`browser network record ${index + 1} is not JSON`);
    }
    if (!isRecord(parsed)) throw new Error(`browser network record ${index + 1} is not an object`);
    const recordSha256 = parsed["recordSha256"];
    if (typeof recordSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(recordSha256)) {
      throw new Error(`browser network record ${index + 1} has no valid hash`);
    }
    const { recordSha256: _recordHash, ...body } = parsed;
    if (
      body["sequence"] !== index + 1 ||
      body["previousRecordSha256"] !== previousRecordSha256 ||
      sha256(canonical(body)) !== recordSha256
    ) throw new Error(`browser network record ${index + 1} breaks the hash chain`);
    assertBodyFields(body, `browser network record ${index + 1}`);
    const requestId = body["requestId"];
    if (typeof requestId !== "string" || !/^request-\d{6}$/u.test(requestId)) {
      throw new Error(`browser network record ${index + 1} has an invalid request ID`);
    }
    if (body["kind"] === "request") {
      if (
        body["schemaVersion"] !== "pm.public-eval-corners.sentinel-general-browser-request.v1" ||
        requestHashes.has(requestId)
      ) throw new Error(`browser network request ${requestId} is invalid or repeated`);
      requestHashes.set(requestId, recordSha256);
    } else if (body["kind"] === "response") {
      if (
        body["schemaVersion"] !== "pm.public-eval-corners.sentinel-general-browser-response.v2" ||
        requestHashes.get(requestId) !== body["requestRecordSha256"]
      ) throw new Error(`browser network response ${requestId} is not bound to its request`);
    } else {
      throw new Error(`browser network record ${index + 1} has an invalid kind`);
    }
    previousRecordSha256 = recordSha256;
  }
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-browser-network-terminal.v1" as const,
    sealedBy,
    sealerPid: process.pid,
    recordCount: lines.length,
    headRecordSha256: previousRecordSha256,
    networkJsonlByteLength: bytes.byteLength,
    networkJsonlSha256: sha256(bytes),
    sealedAt: new Date().toISOString(),
  };
  const receipt = { ...body, receiptSha256: sha256(canonical(body)) };
  writeExclusive(terminalPath, receipt);
  return receipt;
}

function boundedRequestBody(request: Request): Buffer | null {
  const bytes = request.postDataBuffer();
  if (bytes !== null && bytes.byteLength > MAX_BODY_BYTES) {
    throw new Error("browser request body exceeds capture limit");
  }
  return bytes;
}

/**
 * Captures the browser's exact request and response bytes in one durable hash
 * chain. The production browser agent consumes this directly; a response can
 * never be emitted without a prior captured request receipt.
 */
export function installSentinelBrowserNetworkCapture(
  page: Page,
  outputRoot: string,
): SentinelBrowserNetworkCapture {
  const networkPath = resolve(outputRoot, "browser-network.jsonl");
  const requests = new WeakMap<Request, {
    readonly requestId: string;
    readonly receipt: Promise<string>;
  }>();
  let sequence = 0;
  let requestSequence = 0;
  let previousRecordSha256: string | null = null;
  let serial: Promise<void> = Promise.resolve();
  let failure: unknown;
  let sealed = false;

  function enqueue(build: (
    currentSequence: number,
    previousHash: string | null,
  ) => Promise<JsonRecord>): Promise<string> {
    if (sealed) {
      const error = new Error("browser network event arrived after the capture was sealed");
      failure ??= error;
      return Promise.reject(error);
    }
    const currentSequence = sequence + 1;
    sequence = currentSequence;
    const operation = serial.then(async () => {
      const recordBody = await build(currentSequence, previousRecordSha256);
      const recordSha256 = sha256(canonical(recordBody));
      appendDurably(networkPath, { ...recordBody, recordSha256 });
      previousRecordSha256 = recordSha256;
      return recordSha256;
    });
    serial = operation.then(
      () => undefined,
      (error: unknown) => {
        failure ??= error;
      },
    );
    return operation;
  }

  page.on("request", (request: Request) => {
    const requestId = `request-${String(requestSequence + 1).padStart(6, "0")}`;
    requestSequence += 1;
    const recordedAt = new Date().toISOString();
    const recordedAtMonotonicMs = performance.now();
    const postData = boundedRequestBody(request);
    const redirectedFrom = request.redirectedFrom();
    const redirectedFromRequestId = redirectedFrom === null
      ? null
      : requests.get(redirectedFrom)?.requestId ?? null;
    if (redirectedFrom !== null && redirectedFromRequestId === null) {
      failure ??= new Error("redirect source request was not captured");
    }
    const receipt = enqueue(async (currentSequence, previousHash) => ({
      schemaVersion: "pm.public-eval-corners.sentinel-general-browser-request.v1",
      sequence: currentSequence,
      kind: "request",
      recordedAt,
      recordedAtMonotonicMs,
      previousRecordSha256: previousHash,
      requestId,
      redirectedFromRequestId,
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      headers: await request.headersArray(),
      ...bodyFields(postData),
    }));
    requests.set(request, { requestId, receipt });
  });

  page.on("response", (response: Response) => {
    const recordedAt = new Date().toISOString();
    const recordedAtMonotonicMs = performance.now();
    const request = response.request();
    const requestEntry = requests.get(request);
    void enqueue(async (currentSequence, previousHash) => {
      if (requestEntry === undefined) {
        throw new Error("browser response has no captured request");
      }
      const requestRecordSha256 = await requestEntry.receipt;
      let responseBody: Buffer | null = null;
      let bodyFailureSha256: string | null = null;
      try {
        responseBody = Buffer.from(await response.body());
        if (responseBody.byteLength > MAX_BODY_BYTES) {
          throw new Error("browser response body exceeds capture limit");
        }
      } catch (error) {
        responseBody = null;
        const message = error instanceof Error ? error.message : "unknown browser response failure";
        bodyFailureSha256 = sha256(message);
      }
      return {
        schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v2",
        sequence: currentSequence,
        kind: "response",
        recordedAt,
        recordedAtMonotonicMs,
        previousRecordSha256: previousHash,
        requestId: requestEntry.requestId,
        requestRecordSha256,
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        fromServiceWorker: response.fromServiceWorker(),
        headers: await response.headersArray(),
        timing: request.timing(),
        ...bodyFields(responseBody),
        bodyFailureSha256,
      };
    });
  });

  return {
    async flush(): Promise<void> {
      await serial;
      if (failure !== undefined) throw failure;
    },
    async seal(): Promise<SentinelBrowserNetworkCaptureReceipt> {
      await serial;
      if (failure !== undefined) throw failure;
      sealed = true;
      return sealSentinelBrowserNetworkArtifact(outputRoot, "agent-after-browser-close");
    },
  };
}
