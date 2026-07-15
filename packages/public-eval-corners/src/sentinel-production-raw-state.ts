import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ContinuityCheckpoint } from "@pm/continuity";
import type { EventId, TenantId, Timestamp } from "@pm/types";

import {
  PRODUCTION_STATE_CONTROL_CONTEXT,
  parseProductionStateResponse,
  readProductionStateAudit,
  verifyProductionStateBackendReplay,
  verifyProductionStateEvidence,
  type ProductionStateAuditEntry,
  type ProductionStateFinalReceipt,
  type ProductionStateReadyReceipt,
} from "./production-state-sidecar.js";
import { sentinelGeneralOperationId } from "./sentinel-general-agent.js";
import {
  sentinelProductionCanonicalJson,
  sentinelProductionSha256,
  type SentinelProductionArm,
} from "./sentinel-production-plan.js";
import type {
  SentinelProductionCellManifest,
  SentinelProductionServiceBinding,
} from "./sentinel-production-runner.js";
import {
  SENTINEL_RAW_SHA256,
  sentinelRawCanonicalTimestamp,
  sentinelRawContainedPath,
  sentinelRawExactKeys,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
} from "./sentinel-production-raw-utils.js";

const HASH_GENESIS = "0".repeat(64);

export interface SentinelRawStateDecisionBinding {
  readonly decision: number;
  readonly observedAt: string;
  readonly stateReadOperationId: string;
  readonly stateReadRequestSha256: string;
  readonly stateReadResponseSha256: string;
  readonly stateContextSha256: string;
  readonly stateWriteOperationId: string;
  readonly stateWriteRequestSha256: string;
  readonly stateWriteResponseSha256: string;
  readonly stateWriteSummarySha256: string;
  readonly providerStateContext: string;
  readonly memoryNote: string;
}

export interface SentinelRawStateVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly mode: SentinelProductionArm;
  readonly pid: number | null;
  readonly tokenSha256: string | null;
  readonly identitySha256: string | null;
  readonly tenant: string | null;
  readonly agentId: string | null;
  readonly scope: string | null;
  readonly operationIds: readonly string[];
  readonly operations: readonly SentinelRawStateOperationTiming[];
  readonly auditHeadSha256: string | null;
  readonly finalRecordCount: number | null;
  readonly finalBackendHeadSha256: string | null;
}

export interface SentinelRawStateOperationTiming {
  readonly operationId: string;
  readonly requestKind: "read" | "write";
  readonly receivedAt: string;
  readonly receivedAtMonotonicMs: number;
  readonly backendCompletedAtMonotonicMs: number;
  readonly releasedAtMonotonicMs: number;
  readonly responseDeadlineMs: number;
  readonly deadlineMissed: boolean;
}

interface ReplayExport {
  readonly schemaVersion: string;
  readonly tenant: string;
  readonly agentId: string;
  readonly scope: string;
  readonly exportedAt: string;
  readonly tenantRow: unknown;
  readonly checkpoints: readonly unknown[];
  readonly checkpointCount: number;
  readonly checkpointHeadSha256: string | null;
  readonly exportSha256: string;
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseReady(value: unknown): ProductionStateReadyReceipt {
  sentinelRawExactKeys(value, [
    "auditGenesisSha256", "endpoint", "evidenceBindingSha256", "identitySha256",
    "initialAgentChainRecordCount", "initialBackend", "initialBackendHeadSha256",
    "initialRelevantStateSha256", "initialScopeRecordCount", "mode", "pid",
    "receiptSha256", "responseDeadlineMs", "schemaVersion", "startedAt", "tokenSha256",
  ], "state ready receipt");
  return value as unknown as ProductionStateReadyReceipt;
}

function parseFinal(value: unknown): ProductionStateFinalReceipt {
  sentinelRawExactKeys(value, [
    "acceptedReads", "acceptedWrites", "auditEntryCount", "auditHeadSha256",
    "evidenceBindingSha256", "finalizedAt", "mode", "pid", "readyReceiptFileSha256",
    "receiptSha256", "rejectedRequests", "schemaVersion", "startedAt", "totalRequests",
  ], "state final receipt");
  return value as unknown as ProductionStateFinalReceipt;
}

function parseReplay(value: unknown): ReplayExport {
  sentinelRawExactKeys(value, [
    "agentId", "checkpointCount", "checkpointHeadSha256", "checkpoints", "exportSha256",
    "exportedAt", "schemaVersion", "scope", "tenant", "tenantRow",
  ], "continuity replay export");
  if (
    typeof value.schemaVersion !== "string" ||
    typeof value.tenant !== "string" ||
    typeof value.agentId !== "string" ||
    typeof value.scope !== "string" ||
    !Array.isArray(value.checkpoints) ||
    !Number.isSafeInteger(value.checkpointCount) ||
    (value.checkpointHeadSha256 !== null &&
      (typeof value.checkpointHeadSha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.checkpointHeadSha256))) ||
    typeof value.exportSha256 !== "string"
  ) throw new Error("continuity replay export envelope is invalid");
  sentinelRawCanonicalTimestamp(value.exportedAt, "continuity replay exportedAt");
  return value as unknown as ReplayExport;
}

function checkpointFromRow(value: unknown, index: number): ContinuityCheckpoint {
  sentinelRawExactKeys(value, [
    "agent_id", "content_hash", "created_at", "decision_refs", "evidence_event_ids", "id",
    "kind", "payload", "prior_checkpoint_hash", "scope", "seq", "status", "summary",
    "tenant_id", "title",
  ], `continuity checkpoint ${index + 1}`);
  const strings = ["agent_id", "content_hash", "created_at", "id", "kind", "scope", "status", "summary", "tenant_id", "title"];
  if (strings.some((key) => typeof value[key] !== "string") ||
      !Array.isArray(value.decision_refs) || !value.decision_refs.every((entry) => typeof entry === "string") ||
      !Array.isArray(value.evidence_event_ids) || !value.evidence_event_ids.every((entry) => typeof entry === "string") ||
      !sentinelRawIsRecord(value.payload) ||
      !Number.isSafeInteger(value.seq) || Number(value.seq) < 1 ||
      (value.prior_checkpoint_hash !== null && typeof value.prior_checkpoint_hash !== "string") ||
      !SENTINEL_RAW_SHA256.test(String(value.content_hash))) {
    throw new Error(`continuity checkpoint ${index + 1} fields are invalid`);
  }
  sentinelRawCanonicalTimestamp(value.created_at, `continuity checkpoint ${index + 1} created_at`);
  return {
    id: String(value.id),
    tenantId: String(value.tenant_id) as TenantId,
    agentId: String(value.agent_id),
    scope: String(value.scope),
    kind: value.kind as ContinuityCheckpoint["kind"],
    title: String(value.title),
    summary: String(value.summary),
    evidenceEventIds: value.evidence_event_ids as EventId[],
    decisionRefs: value.decision_refs as string[],
    status: value.status as ContinuityCheckpoint["status"],
    payload: value.payload,
    createdAt: value.created_at as Timestamp,
    contentHash: String(value.content_hash),
    priorCheckpointHash: value.prior_checkpoint_hash as string | null,
  };
}

function validateReplay(
  replay: ReplayExport,
  binding: SentinelProductionServiceBinding,
  arm: SentinelProductionArm,
): readonly ContinuityCheckpoint[] {
  const { exportSha256, ...body } = replay;
  if (
    replay.schemaVersion !== "pm.public-eval-corners.sentinel-production-continuity-replay.v1" ||
    replay.tenant !== binding.continuity.tenant ||
    replay.agentId !== binding.continuity.agentId ||
    replay.scope !== binding.continuity.scope ||
    replay.checkpointCount !== replay.checkpoints.length ||
    exportSha256 !== sentinelRawJsonSha256(body) ||
    exportSha256 !== binding.continuity.replayExportSha256
  ) throw new Error("continuity replay export does not bind the cell identity and hash");
  if (arm === "native" || arm === "plain-kv") {
    if (replay.tenantRow !== null || replay.checkpointCount !== 0 || replay.checkpointHeadSha256 !== null) {
      throw new Error("non-continuity arm contains a continuity database export");
    }
    return [];
  }
  sentinelRawExactKeys(replay.tenantRow, ["archived_at", "created_at", "display_name", "id"], "continuity tenant row");
  if (
    replay.tenantRow.id !== replay.tenant ||
    replay.tenantRow.archived_at !== null ||
    typeof replay.tenantRow.display_name !== "string"
  ) throw new Error("continuity tenant row is not the fresh cell tenant");
  sentinelRawCanonicalTimestamp(replay.tenantRow.created_at, "continuity tenant created_at");
  const checkpoints = replay.checkpoints.map(checkpointFromRow);
  for (let index = 1; index < replay.checkpoints.length; index += 1) {
    const previous = replay.checkpoints[index - 1] as Record<string, unknown>;
    const current = replay.checkpoints[index] as Record<string, unknown>;
    if (Number(current.seq) <= Number(previous.seq)) throw new Error("continuity replay sequence is not increasing");
  }
  if (replay.checkpointHeadSha256 !== (checkpoints.at(-1)?.contentHash ?? null)) {
    throw new Error("continuity replay head differs from the exported final checkpoint");
  }
  return checkpoints;
}

function firstReadFresh(entries: readonly ProductionStateAuditEntry[]): boolean {
  const firstRead = entries.find(({ requestKind, responseStatus }) => requestKind === "read" && responseStatus === "ok");
  return firstRead?.backendReceipt?.relevantStateSha256 === sentinelRawSha256(PRODUCTION_STATE_CONTROL_CONTEXT);
}

function verifyOperationPairs(
  evidenceRoot: string,
  entries: readonly ProductionStateAuditEntry[],
  decisions: readonly SentinelRawStateDecisionBinding[],
  attemptId: string,
  issues: string[],
): void {
  if (entries.length !== decisions.length * 2) {
    issues.push(`state audit has ${entries.length} operations, expected exactly ${decisions.length * 2}`);
  }
  for (const [index, decision] of decisions.entries()) {
    const read = entries[index * 2];
    const write = entries[index * 2 + 1];
    const expectedRead = sentinelGeneralOperationId(attemptId, decision.decision, "state-read");
    const expectedWrite = sentinelGeneralOperationId(attemptId, decision.decision, "state-write");
    if (decision.stateReadOperationId !== expectedRead || decision.stateWriteOperationId !== expectedWrite) {
      issues.push(`decision ${decision.decision}: deterministic state operation IDs changed`);
    }
    if (
      read === undefined || read.requestKind !== "read" || read.responseStatus !== "ok" ||
      read.operationId !== decision.stateReadOperationId ||
      read.requestSha256 !== decision.stateReadRequestSha256 ||
      read.responseSha256 !== decision.stateReadResponseSha256
    ) issues.push(`decision ${decision.decision}: state read is absent, reordered, rejected, or hash-mismatched`);
    if (
      write === undefined || write.requestKind !== "write" || write.responseStatus !== "ok" ||
      write.operationId !== decision.stateWriteOperationId ||
      write.requestSha256 !== decision.stateWriteRequestSha256 ||
      write.responseSha256 !== decision.stateWriteResponseSha256
    ) issues.push(`decision ${decision.decision}: state write is absent, reordered, rejected, or hash-mismatched`);
    if (read !== undefined) {
      try {
        const responseBytes = sentinelRawRegularFile(
          sentinelRawContainedPath(evidenceRoot, read.rawResponsePath, "state read raw response"),
          "state read raw response",
        );
        const response = parseProductionStateResponse(JSON.parse(responseBytes.toString("utf8")) as unknown);
        if (
          sentinelRawSha256(response.stateSummary) !== decision.stateContextSha256 ||
          response.stateSummary !== decision.providerStateContext
        ) issues.push(`decision ${decision.decision}: provider state context differs from raw state read`);
      } catch (error) { issues.push(`decision ${decision.decision}: ${issueOf(error)}`); }
    }
    if (write !== undefined) {
      try {
        const request = sentinelRawJsonFile(
          sentinelRawContainedPath(evidenceRoot, write.rawRequestPath, "state write raw request"),
          "state write raw request",
        );
        if (!sentinelRawIsRecord(request) ||
          sentinelRawSha256(String(request.stateSummary)) !== decision.stateWriteSummarySha256 ||
          !String(request.stateSummary).startsWith(decision.memoryNote)) {
          issues.push(`decision ${decision.decision}: model memory does not bind the raw state write`);
        }
      } catch (error) { issues.push(`decision ${decision.decision}: ${issueOf(error)}`); }
    }
  }
}

export function verifySentinelRawStateEvidence(input: {
  readonly cellRoot: string;
  readonly preregistrationSha256: string;
  readonly manifest: SentinelProductionCellManifest;
  readonly decisions: readonly SentinelRawStateDecisionBinding[];
}): SentinelRawStateVerification {
  const issues: string[] = [];
  const binding = input.manifest.serviceBinding;
  const result = (overrides: Partial<SentinelRawStateVerification> = {}): SentinelRawStateVerification => ({
    valid: issues.length === 0,
    issues,
    mode: input.manifest.arm,
    pid: null,
    tokenSha256: null,
    identitySha256: null,
    tenant: binding?.continuity.tenant ?? null,
    agentId: binding?.continuity.agentId ?? null,
    scope: binding?.continuity.scope ?? null,
    operationIds: [],
    operations: [],
    auditHeadSha256: null,
    finalRecordCount: null,
    finalBackendHeadSha256: null,
    ...overrides,
  });
  if (binding === null) {
    issues.push("cell lacks its state/provider/continuity service binding");
    return result();
  }
  const evidenceRoot = resolve(input.cellRoot, "state", "evidence");
  try {
    const readyPath = sentinelRawContainedPath(input.cellRoot, binding.state.readyReceiptPath, "state ready path");
    if (readyPath !== resolve(evidenceRoot, "production-state-ready.json")) throw new Error("state ready path is not attempt-bound");
    const ready = parseReady(sentinelRawJsonFile(readyPath, "state ready receipt"));
    const final = parseFinal(sentinelRawJsonFile(resolve(evidenceRoot, "production-state-final.json"), "state final receipt"));
    const entries = readProductionStateAudit(resolve(evidenceRoot, "production-state-audit.ndjson"));
    if (
      ready.mode !== input.manifest.arm ||
      final.mode !== input.manifest.arm ||
      ready.receiptSha256 !== binding.state.readyReceiptSha256 ||
      final.receiptSha256 !== input.manifest.stateFinalReceiptSha256 ||
      ready.tokenSha256 !== binding.state.tokenSha256 ||
      ready.identitySha256 !== binding.state.identitySha256 ||
      ready.responseDeadlineMs !== binding.state.responseDeadlineMs ||
      binding.state.firstStateFresh !== true
    ) issues.push("state ready/final receipt does not bind the cell manifest");
    const endpoint = new URL(ready.endpoint);
    if (
      endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1" ||
      endpoint.pathname !== "/" || Number(endpoint.port) !== input.manifest.ports.state ||
      binding.state.origin !== ready.endpoint
    ) issues.push("state endpoint is not bound to the cell loopback port");
    const identity = {
      tenant: binding.continuity.tenant,
      agentId: binding.continuity.agentId,
      scope: binding.continuity.scope,
    };
    if (ready.identitySha256 !== sentinelRawJsonSha256(identity)) issues.push("state identity hash differs from manifest identity");
    const expectedEvidenceBinding = sentinelProductionCanonicalJson({
      schemaVersion: "pm.public-eval-corners.sentinel-production-state-evidence-binding.v1",
      preregistrationSha256: input.preregistrationSha256,
      sequence: input.manifest.sequence,
      cellId: input.manifest.cellId,
      attemptId: input.manifest.attemptId,
    });
    if (ready.evidenceBindingSha256 !== sentinelProductionSha256(expectedEvidenceBinding)) {
      issues.push("state evidence binding differs from the signed cell");
    }
    if (
      ready.initialAgentChainRecordCount !== 0 || ready.initialScopeRecordCount !== 0 ||
      ready.initialBackendHeadSha256 !== HASH_GENESIS ||
      ready.initialRelevantStateSha256 !== sentinelRawSha256(PRODUCTION_STATE_CONTROL_CONTEXT) ||
      binding.state.initialBackendRecordCount !== 0 || binding.state.initialBackendHeadSha256 !== HASH_GENESIS ||
      binding.state.initialRelevantStateSha256 !== sentinelRawSha256(PRODUCTION_STATE_CONTROL_CONTEXT) ||
      !firstReadFresh(entries)
    ) issues.push("state backend was not independently fresh at the first read");
    const evidence = verifyProductionStateEvidence(evidenceRoot, ready, final, entries);
    issues.push(...evidence.issues.map((issue) => `state evidence: ${issue}`));
    verifyOperationPairs(evidenceRoot, entries, input.decisions, input.manifest.attemptId, issues);

    const replayPath = sentinelRawContainedPath(input.cellRoot, binding.continuity.replayExportPath, "continuity replay path");
    if (replayPath !== resolve(input.cellRoot, "continuity", "continuity-replay-export.json")) {
      issues.push("continuity replay path is not attempt-bound");
    }
    const replay = parseReplay(sentinelRawJsonFile(replayPath, "continuity replay export"));
    const checkpoints = validateReplay(replay, binding, input.manifest.arm);
    let plainKvStatePath: string | undefined;
    if (input.manifest.arm === "plain-kv") {
      plainKvStatePath = resolve(input.cellRoot, "state", "store", `production-state-${ready.identitySha256}.ndjson`);
      if (!existsSync(plainKvStatePath)) issues.push("plain-kv durable state export is missing");
    }
    const backend = verifyProductionStateBackendReplay({
      ready,
      entries,
      identity,
      ...(plainKvStatePath === undefined ? {} : { plainKvStatePath }),
      ...(input.manifest.arm === "sham" || input.manifest.arm === "substrate"
        ? { continuityCheckpoints: checkpoints }
        : {}),
    });
    issues.push(...backend.issues.map((issue) => `state backend replay: ${issue}`));
    if (new Set(entries.map(({ operationId }) => operationId)).size !== entries.length) {
      issues.push("state operation IDs are reused");
    }
    if (entries.some(({ requestKind }) => requestKind === "rejected")) {
      issues.push("state evidence contains a rejected request");
    }
    return result({
      valid: issues.length === 0,
      pid: ready.pid,
      tokenSha256: ready.tokenSha256,
      identitySha256: ready.identitySha256,
      operationIds: entries.map(({ operationId }) => operationId),
      operations: entries.flatMap((entry) => entry.requestKind === "rejected" ? [] : [{
        operationId: entry.operationId,
        requestKind: entry.requestKind,
        receivedAt: sentinelRawCanonicalTimestamp(entry.timing.receivedAt, `state operation ${entry.operationId} receivedAt`),
        receivedAtMonotonicMs: entry.timing.receivedAtMonotonicMs,
        backendCompletedAtMonotonicMs: entry.timing.backendCompletedAtMonotonicMs,
        releasedAtMonotonicMs: entry.timing.releasedAtMonotonicMs,
        responseDeadlineMs: entry.timing.responseDeadlineMs,
        deadlineMissed: entry.timing.deadlineMissed,
      }]),
      auditHeadSha256: evidence.auditHeadSha256,
      finalRecordCount: backend.finalRecordCount,
      finalBackendHeadSha256: backend.finalHeadSha256,
    });
  } catch (error) {
    issues.push(issueOf(error));
    return result();
  }
}
