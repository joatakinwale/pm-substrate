import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve, resolve as pathResolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildGeneralStateReadRequest,
  buildGeneralStateWriteRequest,
  sentinelGeneralOperationId,
} from "./sentinel-general-agent.js";
import {
  PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
  startProductionStateSidecar,
} from "./production-state-sidecar.js";
import {
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
} from "./sentinel-production-plan.js";
import { verifySentinelRawStateEvidence, type SentinelRawStateDecisionBinding } from "./sentinel-production-raw-state.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";

async function fixture() {
  const cellRoot = mkdtempSync(resolve(realpathSync(tmpdir()), "sentinel-raw-state-"));
  const evidenceDirectory = resolve(cellRoot, "state", "evidence");
  const stateDirectory = resolve(cellRoot, "state", "store");
  const continuityDirectory = resolve(cellRoot, "continuity");
  mkdirSync(evidenceDirectory, { recursive: true });
  mkdirSync(stateDirectory, { recursive: true });
  mkdirSync(continuityDirectory, { recursive: true });
  const preregistrationSha256 = "1".repeat(64);
  const cellId = "registration:qualification:r1:task:native";
  const attemptId = "spa-1234567890abcdef1234567890abcdef1234567890abcdef";
  const tenant = "tnt_spe_1234567890abcdef";
  const agentId = "agt_spe_1234567890abcdef";
  const scope = "scp_spe_1234567890abcdef";
  const evidenceBinding = sentinelProductionCanonicalJson({
    schemaVersion: "pm.public-eval-corners.sentinel-production-state-evidence-binding.v1",
    preregistrationSha256,
    sequence: 1,
    cellId,
    attemptId,
  });
  const token = "state-token-that-is-long-enough-123456789";
  const state = await startProductionStateSidecar({
    mode: "native",
    evidenceBinding,
    evidenceDirectory,
    stateDirectory,
    bearerToken: token,
    tenant,
    agentId,
    scope,
    responseDeadlineMs: PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
  });
  const request = async (route: "/read" | "/write", body: object) => {
    const requestBytes = Buffer.from(JSON.stringify(body));
    const response = await fetch(`${state.endpoint}${route}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: requestBytes,
    });
    const responseBytes = Buffer.from(await response.arrayBuffer());
    return { requestBytes, responseBytes, value: JSON.parse(responseBytes.toString("utf8")) as Record<string, unknown> };
  };
  const readOperation = sentinelGeneralOperationId(attemptId, 1, "state-read");
  const read = await request("/read", buildGeneralStateReadRequest(readOperation));
  const memoryNote = "Remember the visible value 123 for the later comparison.";
  const observedAt = new Date().toISOString();
  const writeOperation = sentinelGeneralOperationId(attemptId, 1, "state-write");
  const writeRequest = buildGeneralStateWriteRequest(writeOperation, observedAt, memoryNote);
  const write = await request("/write", writeRequest);
  const final = await state.stop();
  const replayBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1" as const,
    tenant,
    agentId,
    scope,
    exportedAt: new Date().toISOString(),
    tenantRow: null,
    checkpoints: [] as readonly unknown[],
    checkpointCount: 0,
    checkpointHeadSha256: null,
  };
  const replay = { ...replayBody, exportSha256: sentinelProductionJsonSha256(replayBody) };
  writeFileSync(resolve(continuityDirectory, "continuity-replay-export.json"), `${JSON.stringify(replay, null, 2)}\n`);
  const decision: SentinelRawStateDecisionBinding = {
    decision: 1,
    observedAt,
    stateReadOperationId: readOperation,
    stateReadRequestSha256: sentinelProductionSha256(read.requestBytes),
    stateReadResponseSha256: sentinelProductionSha256(read.responseBytes),
    stateContextSha256: sentinelProductionSha256(String(read.value.stateSummary)),
    stateWriteOperationId: writeOperation,
    stateWriteRequestSha256: sentinelProductionSha256(write.requestBytes),
    stateWriteResponseSha256: sentinelProductionSha256(write.responseBytes),
    stateWriteSummarySha256: sentinelProductionSha256(writeRequest.stateSummary),
    providerStateContext: String(read.value.stateSummary),
    memoryNote,
  };
  const manifest = {
    sequence: 1,
    cellId,
    attemptId,
    arm: "native",
    ports: { state: Number(new URL(state.endpoint).port), provider: 20001, server: 20002, frontend: 20003 },
    serviceBinding: {
      state: {
        mode: "native",
        origin: state.endpoint,
        tokenSha256: sentinelProductionSha256(token),
        evidenceBindingSha256: sentinelProductionSha256(evidenceBinding),
        identitySha256: state.readyReceipt.identitySha256,
        readyReceiptPath: relative(cellRoot, state.readyReceiptPath),
        readyReceiptSha256: state.readyReceipt.receiptSha256,
        initialBackendRecordCount: 0,
        initialBackendHeadSha256: "0".repeat(64),
        initialRelevantStateSha256: state.readyReceipt.initialRelevantStateSha256,
        responseDeadlineMs: PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
        firstStateFresh: true,
      },
      provider: {} as never,
      continuity: {
        tenant,
        agentId,
        scope,
        tenantReceiptSha256: null,
        replayExportPath: "continuity/continuity-replay-export.json",
        replayExportSha256: replay.exportSha256,
      },
    },
    stateFinalReceiptSha256: final.receiptSha256,
  } as unknown as SentinelProductionCellManifest;
  return { cellRoot, preregistrationSha256, manifest, decision, evidenceDirectory };
}

describe("Sentinel raw state verifier", () => {
  it("replays native raw exchanges and fresh discard state", async () => {
    const built = await fixture();
    const result = verifySentinelRawStateEvidence({
      cellRoot: built.cellRoot,
      preregistrationSha256: built.preregistrationSha256,
      manifest: built.manifest,
      decisions: [built.decision],
    });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.finalRecordCount).toBe(0);
    expect(result.operations.map(({ requestKind }) => requestKind)).toEqual(["read", "write"]);
    expect(result.operations.every(({ responseDeadlineMs }) =>
      responseDeadlineMs === PRODUCTION_STATE_RESPONSE_DEADLINE_MS)).toBe(true);
    expect(result.operations.every((operation) =>
      operation.backendCompletedAtMonotonicMs >= operation.receivedAtMonotonicMs &&
      operation.releasedAtMonotonicMs >= operation.backendCompletedAtMonotonicMs)).toBe(true);
  });

  it("rejects swapped arm identity and raw exchange tampering", async () => {
    const built = await fixture();
    const swapped = { ...built.manifest, arm: "substrate" as const };
    expect(verifySentinelRawStateEvidence({
      cellRoot: built.cellRoot,
      preregistrationSha256: built.preregistrationSha256,
      manifest: swapped,
      decisions: [built.decision],
    }).valid).toBe(false);

    const audit = readFileSync(resolve(built.evidenceDirectory, "production-state-audit.ndjson"), "utf8");
    const first = JSON.parse(audit.split("\n")[0]!) as { rawResponsePath: string };
    writeFileSync(pathResolve(built.evidenceDirectory, first.rawResponsePath), "{}\n");
    const tampered = verifySentinelRawStateEvidence({
      cellRoot: built.cellRoot,
      preregistrationSha256: built.preregistrationSha256,
      manifest: built.manifest,
      decisions: [built.decision],
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.issues.join(" ")).toMatch(/hash|schema|response/iu);
  });
});
