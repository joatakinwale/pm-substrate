import { resolve } from "node:path";

import {
  SENTINEL_RAW_SHA256,
  sentinelRawCanonicalTimestamp,
  sentinelRawExactKeys,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawNdjsonFile,
  sentinelRawRegularFile,
  sentinelRawSha256,
} from "./sentinel-production-raw-utils.js";

export interface SentinelRawBrowserRequest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-browser-request.v1";
  readonly sequence: number;
  readonly kind: "request";
  readonly recordedAt: string;
  readonly recordedAtMonotonicMs: number;
  readonly previousRecordSha256: string | null;
  readonly requestId: string;
  readonly redirectedFromRequestId: string | null;
  readonly url: string;
  readonly method: string;
  readonly resourceType: string;
  readonly isNavigationRequest: boolean;
  readonly headers: readonly { readonly name: string; readonly value: string }[];
  readonly bodyByteLength: number | null;
  readonly bodySha256: string | null;
  readonly bodyBase64: string | null;
  readonly recordSha256: string;
}

export interface SentinelRawBrowserResponse {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v2";
  readonly sequence: number;
  readonly kind: "response";
  readonly recordedAt: string;
  readonly recordedAtMonotonicMs: number;
  readonly previousRecordSha256: string | null;
  readonly requestId: string;
  readonly requestRecordSha256: string;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly fromServiceWorker: boolean;
  readonly headers: readonly { readonly name: string; readonly value: string }[];
  readonly timing: Readonly<Record<string, number>>;
  readonly bodyByteLength: number | null;
  readonly bodySha256: string | null;
  readonly bodyBase64: string | null;
  readonly bodyFailureSha256: string | null;
  readonly recordSha256: string;
}

export interface SentinelRawBrowserVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly records: readonly (SentinelRawBrowserRequest | SentinelRawBrowserResponse)[];
  readonly requests: readonly SentinelRawBrowserRequest[];
  readonly responses: readonly SentinelRawBrowserResponse[];
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
  readonly headRecordSha256: string | null;
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validHeaders(value: unknown): value is readonly { readonly name: string; readonly value: string }[] {
  return Array.isArray(value) && value.every((header) => {
    try {
      sentinelRawExactKeys(header, ["name", "value"], "browser header");
      return typeof header.name === "string" && header.name.length > 0 && typeof header.value === "string";
    } catch { return false; }
  });
}

function bodyBytes(value: Record<string, unknown>, label: string): Buffer | null {
  const { bodyByteLength, bodySha256, bodyBase64 } = value;
  if (bodyByteLength === null && bodySha256 === null && bodyBase64 === null) return null;
  if (
    !Number.isSafeInteger(bodyByteLength) || Number(bodyByteLength) < 0 ||
    typeof bodySha256 !== "string" || !SENTINEL_RAW_SHA256.test(bodySha256) ||
    typeof bodyBase64 !== "string" || bodyBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(bodyBase64)
  ) throw new Error(`${label} body receipt is malformed`);
  const bytes = Buffer.from(bodyBase64, "base64");
  if (
    bytes.toString("base64") !== bodyBase64 ||
    bytes.byteLength !== bodyByteLength ||
    sentinelRawSha256(bytes) !== bodySha256
  ) throw new Error(`${label} body bytes do not match their receipt`);
  return bytes;
}

function common(record: Record<string, unknown>, index: number, previous: string | null): void {
  if (
    record.sequence !== index + 1 ||
    record.previousRecordSha256 !== previous ||
    typeof record.recordedAtMonotonicMs !== "number" ||
    !Number.isFinite(record.recordedAtMonotonicMs) ||
    record.recordedAtMonotonicMs < 0 ||
    typeof record.recordSha256 !== "string" ||
    !SENTINEL_RAW_SHA256.test(record.recordSha256)
  ) throw new Error(`browser record ${index + 1} sequence, time, or chain predecessor is invalid`);
  sentinelRawCanonicalTimestamp(record.recordedAt, `browser record ${index + 1} recordedAt`);
  const body = { ...record };
  delete body.recordSha256;
  if (sentinelRawJsonSha256(body) !== record.recordSha256) {
    throw new Error(`browser record ${index + 1} hash mismatch`);
  }
}

function safeHttpUrl(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} URL is invalid`);
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.hash !== "" || url.toString() !== value) {
    throw new Error(`${label} URL is invalid`);
  }
  return value;
}

function parseRequest(record: Record<string, unknown>, index: number): SentinelRawBrowserRequest {
  sentinelRawExactKeys(record, [
    "bodyBase64", "bodyByteLength", "bodySha256", "headers", "isNavigationRequest", "kind",
    "method", "previousRecordSha256", "recordSha256", "recordedAt", "recordedAtMonotonicMs",
    "redirectedFromRequestId", "requestId", "resourceType", "schemaVersion", "sequence", "url",
  ], `browser request ${index + 1}`);
  if (
    record.schemaVersion !== "pm.public-eval-corners.sentinel-general-browser-request.v1" ||
    record.kind !== "request" ||
    !/^request-[0-9]{6}$/u.test(String(record.requestId)) ||
    (record.redirectedFromRequestId !== null && !/^request-[0-9]{6}$/u.test(String(record.redirectedFromRequestId))) ||
    typeof record.method !== "string" || !/^[A-Z]+$/u.test(record.method) ||
    typeof record.resourceType !== "string" || record.resourceType.length === 0 ||
    typeof record.isNavigationRequest !== "boolean" || !validHeaders(record.headers)
  ) throw new Error(`browser request ${index + 1} envelope is invalid`);
  safeHttpUrl(record.url, `browser request ${index + 1}`);
  bodyBytes(record, `browser request ${index + 1}`);
  return record as unknown as SentinelRawBrowserRequest;
}

function parseResponse(record: Record<string, unknown>, index: number): SentinelRawBrowserResponse {
  sentinelRawExactKeys(record, [
    "bodyBase64", "bodyByteLength", "bodyFailureSha256", "bodySha256", "fromServiceWorker", "headers",
    "kind", "previousRecordSha256", "recordSha256", "recordedAt", "recordedAtMonotonicMs", "requestId",
    "requestRecordSha256", "schemaVersion", "sequence", "status", "statusText", "timing", "url",
  ], `browser response ${index + 1}`);
  if (
    record.schemaVersion !== "pm.public-eval-corners.sentinel-general-browser-response.v2" ||
    record.kind !== "response" || !/^request-[0-9]{6}$/u.test(String(record.requestId)) ||
    typeof record.requestRecordSha256 !== "string" || !SENTINEL_RAW_SHA256.test(record.requestRecordSha256) ||
    !Number.isSafeInteger(record.status) || Number(record.status) < 100 || Number(record.status) > 599 ||
    typeof record.statusText !== "string" || typeof record.fromServiceWorker !== "boolean" ||
    !validHeaders(record.headers) || !sentinelRawIsRecord(record.timing) ||
    Object.values(record.timing).some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    (record.bodyFailureSha256 !== null &&
      (typeof record.bodyFailureSha256 !== "string" || !SENTINEL_RAW_SHA256.test(record.bodyFailureSha256)))
  ) throw new Error(`browser response ${index + 1} envelope is invalid`);
  safeHttpUrl(record.url, `browser response ${index + 1}`);
  const bytes = bodyBytes(record, `browser response ${index + 1}`);
  if ((bytes === null) === (record.bodyFailureSha256 === null)) {
    throw new Error(`browser response ${index + 1} must contain either bytes or a failure receipt`);
  }
  return record as unknown as SentinelRawBrowserResponse;
}

export function verifySentinelRawBrowserEvidence(agentRoot: string): SentinelRawBrowserVerification {
  const issues: string[] = [];
  const records: (SentinelRawBrowserRequest | SentinelRawBrowserResponse)[] = [];
  const requests: SentinelRawBrowserRequest[] = [];
  const responses: SentinelRawBrowserResponse[] = [];
  let previous: string | null = null;
  try {
    const raw = sentinelRawNdjsonFile(resolve(agentRoot, "browser-network.jsonl"), "browser network chain");
    const byRequest = new Map<string, SentinelRawBrowserRequest>();
    let previousWall = Number.NEGATIVE_INFINITY;
    let previousMonotonic = Number.NEGATIVE_INFINITY;
    let nextRequest = 1;
    for (const [index, value] of raw.entries()) {
      if (!sentinelRawIsRecord(value)) throw new Error(`browser record ${index + 1} is not an object`);
      common(value, index, previous);
      const wall = Date.parse(String(value.recordedAt));
      const monotonic = Number(value.recordedAtMonotonicMs);
      if (wall < previousWall || monotonic < previousMonotonic) {
        throw new Error(`browser record ${index + 1} time regressed`);
      }
      previousWall = wall;
      previousMonotonic = monotonic;
      if (value.kind === "request") {
        const request = parseRequest(value, index);
        if (request.requestId !== `request-${String(nextRequest).padStart(6, "0")}` || byRequest.has(request.requestId)) {
          throw new Error(`browser request ${index + 1} ID is duplicated or out of sequence`);
        }
        nextRequest += 1;
        if (request.redirectedFromRequestId !== null && !byRequest.has(request.redirectedFromRequestId)) {
          throw new Error(`browser request ${index + 1} redirect predecessor is absent`);
        }
        byRequest.set(request.requestId, request);
        requests.push(request);
        records.push(request);
      } else if (value.kind === "response") {
        const response = parseResponse(value, index);
        const request = byRequest.get(response.requestId);
        if (
          request === undefined || response.requestRecordSha256 !== request.recordSha256 ||
          response.url !== request.url ||
          responses.some(({ requestId }) => requestId === response.requestId)
        ) throw new Error(`browser response ${index + 1} is absent, duplicated, or not bound to its request`);
        responses.push(response);
        records.push(response);
      } else throw new Error(`browser record ${index + 1} uses a legacy or unknown schema`);
      previous = String(value.recordSha256);
    }
    if (records.length === 0 || requests.length === 0) throw new Error("browser network chain is empty");
    const terminal = sentinelRawJsonFile(resolve(agentRoot, "browser-network-terminal.json"), "browser network terminal");
    sentinelRawExactKeys(terminal, [
      "headRecordSha256", "networkJsonlByteLength", "networkJsonlSha256", "receiptSha256",
      "recordCount", "schemaVersion", "sealedAt", "sealedBy", "sealerPid",
    ], "browser network terminal");
    const networkBytes = sentinelRawRegularFile(resolve(agentRoot, "browser-network.jsonl"), "browser network chain");
    const { receiptSha256, ...body } = terminal;
    if (
      terminal.schemaVersion !== "pm.public-eval-corners.sentinel-browser-network-terminal.v1" ||
      terminal.sealedBy !== "supervisor-after-process-reap" ||
      !Number.isSafeInteger(terminal.sealerPid) || Number(terminal.sealerPid) <= 1 ||
      terminal.recordCount !== records.length || terminal.headRecordSha256 !== previous ||
      terminal.networkJsonlByteLength !== networkBytes.byteLength ||
      terminal.networkJsonlSha256 !== sentinelRawSha256(networkBytes) ||
      receiptSha256 !== sentinelRawJsonSha256(body)
    ) throw new Error("browser network terminal does not seal the exact chain");
    sentinelRawCanonicalTimestamp(terminal.sealedAt, "browser network sealedAt");
  } catch (error) { issues.push(issueOf(error)); }
  return {
    valid: issues.length === 0,
    issues,
    records,
    requests,
    responses,
    firstRecordedAt: records[0]?.recordedAt ?? null,
    lastRecordedAt: records.at(-1)?.recordedAt ?? null,
    headRecordSha256: previous,
  };
}

export function sentinelRawBrowserRequestBody(request: SentinelRawBrowserRequest): Buffer | null {
  if (request.bodyBase64 === null) return null;
  return Buffer.from(request.bodyBase64, "base64");
}
