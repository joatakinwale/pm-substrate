import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Page, Request, Response } from "playwright";
import { afterEach, describe, expect, it } from "vitest";

import { installSentinelBrowserNetworkCapture } from "./sentinel-browser-network-capture.js";

const TEMPORARY_DIRECTORIES: string[] = [];

function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "pm-sentinel-browser-network-"));
  TEMPORARY_DIRECTORIES.push(path);
  return path;
}

function fakeRequest(body: Buffer | null): Request {
  return {
    allHeaders: async () => ({ "content-type": "application/json" }),
    headersArray: async () => [{ name: "content-type", value: "application/json" }],
    isNavigationRequest: () => false,
    method: () => "POST",
    postDataBuffer: () => body,
    redirectedFrom: () => null,
    resourceType: () => "fetch",
    timing: () => ({
      startTime: 1,
      domainLookupStart: 2,
      domainLookupEnd: 3,
      connectStart: 4,
      secureConnectionStart: -1,
      connectEnd: 5,
      requestStart: 6,
      responseStart: 7,
      responseEnd: 8,
    }),
    url: () => "http://127.0.0.1:8765/contact",
  } as unknown as Request;
}

function fakeResponse(request: Request, body: Buffer): Response {
  return {
    body: async () => body,
    fromServiceWorker: () => false,
    headersArray: async () => [{ name: "content-type", value: "application/json" }],
    request: () => request,
    status: () => 201,
    statusText: () => "Created",
    url: () => request.url(),
  } as unknown as Response;
}

afterEach(() => {
  for (const directory of TEMPORARY_DIRECTORIES.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Sentinel browser request/response evidence", () => {
  it("binds exact POST bytes and the response into one durable record chain", async () => {
    const root = temporaryDirectory();
    const emitter = new EventEmitter();
    const capture = installSentinelBrowserNetworkCapture(emitter as unknown as Page, root);
    const requestBody = Buffer.from('{"message":"first visible value"}');
    const responseBody = Buffer.from('{"accepted":true}');
    const request = fakeRequest(requestBody);

    emitter.emit("request", request);
    emitter.emit("response", fakeResponse(request, responseBody));
    const terminal = await capture.seal();

    const records = readFileSync(join(root, "browser-network.jsonl"), "utf8")
      .trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-general-browser-request.v1",
      sequence: 1,
      kind: "request",
      requestId: "request-000001",
      method: "POST",
      bodyByteLength: requestBody.byteLength,
      bodyBase64: requestBody.toString("base64"),
      previousRecordSha256: null,
    });
    expect(records[1]).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v2",
      sequence: 2,
      kind: "response",
      requestId: "request-000001",
      requestRecordSha256: records[0]?.["recordSha256"],
      previousRecordSha256: records[0]?.["recordSha256"],
      status: 201,
      bodyByteLength: responseBody.byteLength,
      bodyBase64: responseBody.toString("base64"),
      bodyFailureSha256: null,
    });
    expect(terminal).toMatchObject({
      sealedBy: "agent-after-browser-close",
      recordCount: 2,
      headRecordSha256: records[1]?.["recordSha256"],
    });
    expect(readFileSync(join(root, "browser-network-terminal.json"), "utf8"))
      .toContain(terminal.receiptSha256);
  });

  it("fails closed when a response has no previously captured request", async () => {
    const root = temporaryDirectory();
    const emitter = new EventEmitter();
    const capture = installSentinelBrowserNetworkCapture(emitter as unknown as Page, root);
    const request = fakeRequest(null);
    emitter.emit("response", fakeResponse(request, Buffer.from("{}")));
    await expect(capture.seal()).rejects.toThrow(/no captured request/u);
  });
});
