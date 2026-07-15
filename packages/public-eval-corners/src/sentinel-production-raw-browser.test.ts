import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, resolve as pathResolve } from "node:path";

import { describe, expect, it } from "vitest";

import { verifySentinelRawBrowserEvidence } from "./sentinel-production-raw-browser.js";
import { sentinelRawJsonSha256, sentinelRawSha256 } from "./sentinel-production-raw-utils.js";

function capture() {
  const root = mkdtempSync(resolve(tmpdir(), "sentinel-raw-browser-"));
  const requestBody = Buffer.from("message=the+observed+value+is+123");
  const requestDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-browser-request.v1",
    sequence: 1,
    kind: "request",
    recordedAt: "2026-07-14T01:00:00.000Z",
    recordedAtMonotonicMs: 100,
    previousRecordSha256: null,
    requestId: "request-000001",
    redirectedFromRequestId: null,
    url: "http://127.0.0.1:8000/contact",
    method: "POST",
    resourceType: "document",
    isNavigationRequest: true,
    headers: [{ name: "content-type", value: "application/x-www-form-urlencoded" }],
    bodyByteLength: requestBody.byteLength,
    bodySha256: sentinelRawSha256(requestBody),
    bodyBase64: requestBody.toString("base64"),
  };
  const request = { ...requestDraft, recordSha256: sentinelRawJsonSha256(requestDraft) };
  const responseBody = Buffer.from("<html>ok</html>");
  const responseDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v2",
    sequence: 2,
    kind: "response",
    recordedAt: "2026-07-14T01:00:00.010Z",
    recordedAtMonotonicMs: 110,
    previousRecordSha256: request.recordSha256,
    requestId: request.requestId,
    requestRecordSha256: request.recordSha256,
    url: request.url,
    status: 200,
    statusText: "OK",
    fromServiceWorker: false,
    headers: [{ name: "content-type", value: "text/html" }],
    timing: { startTime: 1, responseEnd: 2 },
    bodyByteLength: responseBody.byteLength,
    bodySha256: sentinelRawSha256(responseBody),
    bodyBase64: responseBody.toString("base64"),
    bodyFailureSha256: null,
  };
  const response = { ...responseDraft, recordSha256: sentinelRawJsonSha256(responseDraft) };
  const chain = `${JSON.stringify(request)}\n${JSON.stringify(response)}\n`;
  writeFileSync(resolve(root, "browser-network.jsonl"), chain);
  const terminalDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-browser-network-terminal.v1",
    sealedBy: "supervisor-after-process-reap",
    sealerPid: 4242,
    recordCount: 2,
    headRecordSha256: response.recordSha256,
    networkJsonlByteLength: Buffer.byteLength(chain),
    networkJsonlSha256: sentinelRawSha256(chain),
    sealedAt: "2026-07-14T01:00:00.020Z",
  };
  writeFileSync(resolve(root, "browser-network-terminal.json"), `${JSON.stringify({
    ...terminalDraft,
    receiptSha256: sentinelRawJsonSha256(terminalDraft),
  }, null, 2)}\n`);
  return { root, request, response };
}

describe("Sentinel raw browser verifier", () => {
  it("replays a request/response byte chain and terminal seal", () => {
    const built = capture();
    const result = verifySentinelRawBrowserEvidence(built.root);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.requests[0]?.method).toBe("POST");
  });

  it("rejects a legacy response-only fixture and a swapped request hash", () => {
    const built = capture();
    writeFileSync(resolve(built.root, "browser-network.jsonl"), `${JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v1",
      sequence: 1,
    })}\n`);
    expect(verifySentinelRawBrowserEvidence(built.root).valid).toBe(false);

    const second = capture();
    const lines = readFileSync(resolve(second.root, "browser-network.jsonl"), "utf8").trim().split("\n");
    const response = JSON.parse(lines[1]!) as Record<string, unknown>;
    response.requestRecordSha256 = "0".repeat(64);
    lines[1] = JSON.stringify(response);
    writeFileSync(pathResolve(second.root, "browser-network.jsonl"), `${lines.join("\n")}\n`);
    expect(verifySentinelRawBrowserEvidence(second.root).issues.join(" ")).toMatch(/hash|bound/iu);
  });
});
