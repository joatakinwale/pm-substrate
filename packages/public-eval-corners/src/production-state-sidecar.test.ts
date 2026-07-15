import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PostgresContinuityLedger } from "@pm/continuity";
import type { TenantId } from "@pm/types";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  PRODUCTION_STATE_CONTROL_CONTEXT,
  PRODUCTION_STATE_READ_SCHEMA_VERSION,
  PRODUCTION_STATE_SHAM_DECOY,
  PRODUCTION_STATE_SUMMARY_WIDTH,
  PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
  fixedStateSummary,
  parseProductionStateResponse,
  parseProductionStateWriteRequest,
  readProductionStateAudit,
  startProductionStateSidecar,
  verifyPlainKvStateFile,
  verifyProductionStateBackendReplay,
  verifyProductionStateEvidence,
  type ProductionStateReadRequest,
  type ProductionStateSidecarMode,
  type ProductionStateWriteRequest,
  type RunningProductionStateSidecar,
} from "./production-state-sidecar.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryDirectory(label: string): string {
  const directory = mkdtempSync(join(realpathSync.native(tmpdir()), `pm-production-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

function bearer(label: string): string {
  return `${label}-${"x".repeat(64)}`;
}

function operationId(index: number): string {
  return index.toString(16).padStart(32, "0");
}

function writeRequest(index: number, text: string): ProductionStateWriteRequest {
  return {
    schemaVersion: PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
    operationId: operationId(index),
    observedAt: new Date(Date.now() - 1_000).toISOString(),
    stateSummary: fixedStateSummary(text),
  };
}

function readRequest(index: number): ProductionStateReadRequest {
  return {
    schemaVersion: PRODUCTION_STATE_READ_SCHEMA_VERSION,
    operationId: operationId(index),
  };
}

interface Invocation {
  readonly status: number;
  readonly text: string;
  readonly body: ReturnType<typeof parseProductionStateResponse>;
}

async function invoke(
  sidecar: RunningProductionStateSidecar,
  route: "write" | "read",
  request: unknown,
  token: string,
): Promise<Invocation> {
  const response = await fetch(`${sidecar.endpoint}/${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: parseProductionStateResponse(JSON.parse(text) as unknown),
  };
}

async function startPlain(input: {
  readonly label: string;
  readonly stateDirectory: string;
  readonly tenant?: string;
  readonly agentId?: string;
  readonly scope?: string;
  readonly mode?: "native" | "plain-kv";
  readonly token?: string;
}): Promise<{ readonly sidecar: RunningProductionStateSidecar; readonly token: string; readonly evidence: string }> {
  const token = input.token ?? bearer(input.label);
  const evidence = temporaryDirectory(`${input.label}-evidence`);
  const sidecar = await startProductionStateSidecar({
    mode: input.mode ?? "plain-kv",
    evidenceBinding: `test:${input.label}`,
    evidenceDirectory: evidence,
    stateDirectory: input.stateDirectory,
    bearerToken: token,
    tenant: input.tenant ?? "tenant-one",
    agentId: input.agentId ?? "agent-one",
    scope: input.scope ?? "scope-one",
    minimumLatencyMs: 0,
  });
  return { sidecar, token, evidence };
}

describe("generic production state sidecar", () => {
  it("accepts only exact fixed-width printable model summaries", () => {
    const canonical = writeRequest(1, "generic state without benchmark-specific meaning");
    expect(parseProductionStateWriteRequest(canonical)).toEqual(canonical);
    expect(canonical.stateSummary).toHaveLength(PRODUCTION_STATE_SUMMARY_WIDTH);
    expect(() => fixedStateSummary("unsafe\nstate")).toThrow(/printable ASCII/);
    expect(() => fixedStateSummary('unsafe "quoted" state')).toThrow(/printable ASCII/);
    expect(() => fixedStateSummary("unsafe\\escaped state")).toThrow(/printable ASCII/);
    expect(() => fixedStateSummary("x".repeat(PRODUCTION_STATE_SUMMARY_WIDTH + 1))).toThrow(
      /printable ASCII/,
    );
    expect(() =>
      parseProductionStateWriteRequest({ ...canonical, hiddenArm: "substrate" }),
    ).toThrow(/missing or unknown keys/);
    expect(() =>
      parseProductionStateWriteRequest({ ...canonical, stateSummary: "short" }),
    ).toThrow(/exactly 512/);
  });

  it("requires non-overlapping evidence and state roots", async () => {
    const root = temporaryDirectory("same-root");
    await expect(
      startProductionStateSidecar({
        mode: "native",
        evidenceBinding: "test:same-root",
        evidenceDirectory: root,
        stateDirectory: root,
        bearerToken: bearer("same-root"),
        tenant: "tenant-one",
        agentId: "agent-one",
        scope: "scope-one",
      }),
    ).rejects.toThrow(/separate non-overlapping roots/);

    const parent = temporaryDirectory("parent-root");
    const child = join(parent, "child");
    mkdirSync(child);
    await expect(
      startProductionStateSidecar({
        mode: "native",
        evidenceBinding: "test:nested-root",
        evidenceDirectory: child,
        stateDirectory: parent,
        bearerToken: bearer("nested-root"),
        tenant: "tenant-one",
        agentId: "agent-one",
        scope: "scope-one",
      }),
    ).rejects.toThrow(/separate non-overlapping roots/);
  });

  it("authenticates the loopback API without persisting the bearer secret", async () => {
    const stateDirectory = temporaryDirectory("auth-state");
    const token = bearer("secret-token");
    const running = await startPlain({
      label: "auth",
      stateDirectory,
      mode: "native",
      token,
    });
    let final: Awaited<ReturnType<RunningProductionStateSidecar["stop"]>>;
    try {
      const result = await invoke(running.sidecar, "read", readRequest(2), bearer("wrong"));
      expect(result.status).toBe(401);
      expect(result.body.status).toBe("rejected");
    } finally {
      final = await running.sidecar.stop();
    }
    const entries = readProductionStateAudit(running.sidecar.auditPath);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ authenticated: false, rejectionReason: "unauthorized" });
    expect(readFileSync(running.sidecar.auditPath, "utf8")).not.toContain(token);
    expect(readFileSync(running.sidecar.readyReceiptPath, "utf8")).not.toContain(token);
    expect(
      verifyProductionStateEvidence(
        running.evidence,
        running.sidecar.readyReceipt,
        final!,
        entries,
      ).valid,
    ).toBe(true);
  });

  it("keeps plain-kv state restart-safe with latest-write semantics", async () => {
    const stateDirectory = temporaryDirectory("restart-state");
    const first = await startPlain({ label: "restart-a", stateDirectory });
    await invoke(first.sidecar, "write", writeRequest(3, "first durable summary"), first.token);
    await invoke(first.sidecar, "write", writeRequest(4, "latest durable summary"), first.token);
    await first.sidecar.stop();

    const restarted = await startPlain({ label: "restart-b", stateDirectory });
    try {
      const read = await invoke(restarted.sidecar, "read", readRequest(5), restarted.token);
      expect(read.status).toBe(200);
      expect(read.body.stateSummary).toBe(fixedStateSummary("latest durable summary"));
      const verified = verifyPlainKvStateFile(restarted.sidecar.plainKvStatePath, {
        tenant: "tenant-one",
        agentId: "agent-one",
        scope: "scope-one",
      });
      expect(verified.valid, verified.issues.join("\n")).toBe(true);
      expect(verified.records).toHaveLength(2);
    } finally {
      await restarted.sidecar.stop();
    }
  });

  it("independently replays plain-kv audit claims against the durable store", async () => {
    const stateDirectory = temporaryDirectory("independent-replay-state");
    const running = await startPlain({ label: "independent-replay", stateDirectory });
    await invoke(running.sidecar, "read", readRequest(20), running.token);
    await invoke(
      running.sidecar,
      "write",
      writeRequest(21, "state independently replayed from durable bytes"),
      running.token,
    );
    await invoke(running.sidecar, "read", readRequest(22), running.token);
    await running.sidecar.stop();
    const entries = readProductionStateAudit(running.sidecar.auditPath);
    const replay = verifyProductionStateBackendReplay({
      ready: running.sidecar.readyReceipt,
      entries,
      identity: { tenant: "tenant-one", agentId: "agent-one", scope: "scope-one" },
      plainKvStatePath: running.sidecar.plainKvStatePath,
    });
    expect(replay.valid, replay.issues.join("\n")).toBe(true);
    expect(replay).toMatchObject({ finalRecordCount: 1 });

    const forged = entries.map((entry, index) => index === 2
      ? {
          ...entry,
          backendReceipt: entry.backendReceipt === null
            ? null
            : { ...entry.backendReceipt, checkedRecords: 99 },
        }
      : entry);
    const rejected = verifyProductionStateBackendReplay({
      ready: running.sidecar.readyReceipt,
      entries: forged,
      identity: { tenant: "tenant-one", agentId: "agent-one", scope: "scope-one" },
      plainKvStatePath: running.sidecar.plainKvStatePath,
    });
    expect(rejected.valid).toBe(false);
    expect(rejected.issues).toContain("entry 3: plain-kv read does not replay");
  });

  it("isolates plain-kv state by tenant, agent, and scope", async () => {
    const stateDirectory = temporaryDirectory("isolation-state");
    const writer = await startPlain({ label: "isolation-writer", stateDirectory });
    await invoke(writer.sidecar, "write", writeRequest(6, "only identity one may recall this"), writer.token);
    await writer.sidecar.stop();

    const identities = [
      { label: "other-tenant", tenant: "tenant-two", agentId: "agent-one", scope: "scope-one" },
      { label: "other-agent", tenant: "tenant-one", agentId: "agent-two", scope: "scope-one" },
      { label: "other-scope", tenant: "tenant-one", agentId: "agent-one", scope: "scope-two" },
    ] as const;
    for (const [index, identity] of identities.entries()) {
      const running = await startPlain({ ...identity, stateDirectory });
      try {
        const read = await invoke(running.sidecar, "read", readRequest(20 + index), running.token);
        expect(read.body.stateSummary).toBe(PRODUCTION_STATE_CONTROL_CONTEXT);
      } finally {
        await running.sidecar.stop();
      }
    }
  });

  it("serializes concurrent plain-kv appends into one valid hash chain", async () => {
    const stateDirectory = temporaryDirectory("concurrent-state");
    const running = await startPlain({ label: "concurrent", stateDirectory });
    try {
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, index) =>
          invoke(
            running.sidecar,
            "write",
            writeRequest(100 + index, `concurrent generic state ${index}`),
            running.token,
          ),
        ),
      );
      expect(results.every((result) => result.status === 200)).toBe(true);
      const verified = verifyPlainKvStateFile(running.sidecar.plainKvStatePath, {
        tenant: "tenant-one",
        agentId: "agent-one",
        scope: "scope-one",
      });
      expect(verified.valid, verified.issues.join("\n")).toBe(true);
      expect(verified.records).toHaveLength(24);
      expect(new Set(verified.records.map((record) => record.previousRecordSha256)).size).toBe(24);
    } finally {
      await running.sidecar.stop();
    }
  });

  it("fails closed after plain-kv tampering and detects raw-evidence tampering", async () => {
    const stateDirectory = temporaryDirectory("tamper-state");
    const writer = await startPlain({ label: "tamper-writer", stateDirectory });
    await invoke(writer.sidecar, "write", writeRequest(200, "durable state before tampering"), writer.token);
    const writerFinal = await writer.sidecar.stop();
    const entries = readProductionStateAudit(writer.sidecar.auditPath);
    const before = verifyProductionStateEvidence(
      writer.evidence,
      writer.sidecar.readyReceipt,
      writerFinal,
      entries,
    );
    expect(before.valid, before.issues.join("\n")).toBe(true);
    const rawRequest = join(writer.evidence, entries[0]!.rawRequestPath);
    writeFileSync(rawRequest, Buffer.concat([readFileSync(rawRequest), Buffer.from("tampered")]));
    const after = verifyProductionStateEvidence(
      writer.evidence,
      writer.sidecar.readyReceipt,
      writerFinal,
      entries,
    );
    expect(after.valid).toBe(false);
    expect(after.issues).toContain("entry 1: raw request hash mismatch");

    const original = readFileSync(writer.sidecar.plainKvStatePath, "utf8");
    writeFileSync(
      writer.sidecar.plainKvStatePath,
      original.replace("durable state before tampering", "forged state after tampering"),
    );

    await expect(startPlain({ label: "tamper-reader", stateDirectory })).rejects.toThrow(
      /plain-kv state verification failed/,
    );
  });
});

describeIfDb("generic production state sidecar with Postgres continuity", () => {
  let pool: pg.Pool;
  const tenants: TenantId[] = [];

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    for (const tenant of tenants) {
      await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [tenant]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenant]);
    }
    await pool.end();
  });

  async function makeTenant(): Promise<TenantId> {
    const tenant = `tnt_prod_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)`,
      [tenant],
    );
    tenants.push(tenant);
    return tenant;
  }

  async function startDb(input: {
    readonly label: string;
    readonly mode: "sham" | "substrate";
    readonly tenant: TenantId;
    readonly agentId: string;
    readonly scope: string;
    readonly stateDirectory: string;
  }): Promise<{ readonly sidecar: RunningProductionStateSidecar; readonly token: string; readonly evidence: string }> {
    const evidence = temporaryDirectory(`${input.label}-evidence`);
    const token = bearer(input.label);
    const sidecar = await startProductionStateSidecar({
      mode: input.mode,
      evidenceBinding: `test:${input.label}`,
      evidenceDirectory: evidence,
      stateDirectory: input.stateDirectory,
      bearerToken: token,
      tenant: input.tenant,
      agentId: input.agentId,
      scope: input.scope,
      databaseUrl: DATABASE_URL!,
      minimumLatencyMs: 0,
    });
    return { sidecar, token, evidence };
  }

  it("runs all four arms through the same API while reviewing every write", async () => {
    const tenant = await makeTenant();
    const stateDirectory = temporaryDirectory("four-arm-state");
    const modes: readonly ProductionStateSidecarMode[] = [
      "native",
      "sham",
      "plain-kv",
      "substrate",
    ];
    const running = await Promise.all(
      modes.map(async (mode) => {
        const label = `four-${mode}`;
        const token = bearer(label);
        const evidence = temporaryDirectory(`${label}-evidence`);
        const sidecar = await startProductionStateSidecar({
          mode,
          evidenceBinding: `test:${label}`,
          evidenceDirectory: evidence,
          stateDirectory,
          bearerToken: token,
          tenant,
          agentId: `agent-${mode}`,
          scope: "generic-scope",
          ...(mode === "sham" || mode === "substrate"
            ? { databaseUrl: DATABASE_URL! }
            : {}),
          minimumLatencyMs: 0,
        });
        return { mode, token, evidence, sidecar };
      }),
    );
    const state = "generic model state shared across matched arms";
    try {
      const firstReads = await Promise.all(
        running.map(({ sidecar, token }) => invoke(sidecar, "read", readRequest(299), token)),
      );
      expect(new Set(firstReads.map((result) => result.text)).size).toBe(1);
      expect(
        firstReads.every(
          (result) => result.body.stateSummary === PRODUCTION_STATE_CONTROL_CONTEXT,
        ),
      ).toBe(true);

      const writes = await Promise.all(
        running.map(({ sidecar, token }) => invoke(sidecar, "write", writeRequest(300, state), token)),
      );
      expect(new Set(writes.map((result) => result.text)).size).toBe(1);
      const reads = await Promise.all(
        running.map(({ sidecar, token }) => invoke(sidecar, "read", readRequest(301), token)),
      );
      expect(new Set(reads.map((result) => Buffer.byteLength(result.text))).size).toBe(1);
      expect(reads[0]?.text).toBe(reads[1]?.text);
      expect(reads.every((result) => result.body.stateSummary.length === PRODUCTION_STATE_SUMMARY_WIDTH)).toBe(true);
      expect(reads[0]?.body.stateSummary).toBe(PRODUCTION_STATE_SHAM_DECOY);
      expect(reads[1]?.body.stateSummary).toBe(PRODUCTION_STATE_SHAM_DECOY);
      expect(reads[2]?.body.stateSummary).toBe(fixedStateSummary(state));
      expect(reads[3]?.body.stateSummary).toBe(fixedStateSummary(state));
      expect(
        reads.map((result) => Object.keys(result.body).sort()),
      ).toEqual(Array(4).fill([
        "operationId",
        "padding",
        "schemaVersion",
        "stateEncoding",
        "stateSummary",
        "status",
      ]));
    } finally {
      const finals = await Promise.all(running.map(({ sidecar }) => sidecar.stop()));
      running.forEach(({ evidence, sidecar }, index) => {
        const entries = readProductionStateAudit(sidecar.auditPath);
        expect(entries).toHaveLength(3);
        expect(entries[0]).toMatchObject({ requestKind: "read", responseStatus: "ok" });
        expect(entries[1]?.admissionReview?.decision).toBe("admitted");
        expect(entries[1]?.admittedEvidence?.evidence.payload.stateSummary).toBe(
          fixedStateSummary(state),
        );
        const verified = verifyProductionStateEvidence(
          evidence,
          sidecar.readyReceipt,
          finals[index]!,
          entries,
        );
        expect(verified.valid, verified.issues.join("\n")).toBe(true);
      });
    }
  });

  it("recalls latest substrate state after restart and makes sham do the same continuity work", async () => {
    const tenant = await makeTenant();
    const stateDirectory = temporaryDirectory("db-restart-state");
    for (const mode of ["substrate", "sham"] as const) {
      const identity = {
        tenant,
        agentId: `restart-${mode}`,
        scope: "restart-scope",
      };
      const writer = await startDb({
        label: `db-restart-${mode}-writer`,
        mode,
        ...identity,
        stateDirectory,
      });
      await invoke(writer.sidecar, "write", writeRequest(400, "first continuity state"), writer.token);
      await invoke(writer.sidecar, "write", writeRequest(401, "latest continuity state"), writer.token);
      await writer.sidecar.stop();

      const reader = await startDb({
        label: `db-restart-${mode}-reader`,
        mode,
        ...identity,
        stateDirectory,
      });
      try {
        const read = await invoke(reader.sidecar, "read", readRequest(402), reader.token);
        expect(read.body.stateSummary).toBe(
          mode === "substrate"
            ? fixedStateSummary("latest continuity state")
            : PRODUCTION_STATE_SHAM_DECOY,
        );
        const entry = readProductionStateAudit(reader.sidecar.auditPath)[0]!;
        expect(entry.backendReceipt).toMatchObject({
          backend: "continuity",
          integrityVerified: true,
          checkedRecords: 2,
        });
        expect(entry.backendReceipt?.relevantStateSha256).toBe(
          createHash("sha256")
            .update(fixedStateSummary("latest continuity state"))
            .digest("hex"),
        );
        const ledger = new PostgresContinuityLedger(pool);
        const checkpoints = (await ledger.list({
          tenantId: tenant,
          agentId: identity.agentId,
          limit: 100_000,
        })).reverse();
        const replay = verifyProductionStateBackendReplay({
          ready: reader.sidecar.readyReceipt,
          entries: [entry],
          identity,
          continuityCheckpoints: checkpoints,
        });
        expect(replay.valid, replay.issues.join("\n")).toBe(true);
        expect(replay).toMatchObject({ finalRecordCount: 2 });
      } finally {
        await reader.sidecar.stop();
      }
    }
  });

  it("isolates continuity recall by tenant, agent, and scope while verifying the full agent chain", async () => {
    const tenantOne = await makeTenant();
    const tenantTwo = await makeTenant();
    const stateDirectory = temporaryDirectory("db-isolation-state");
    const writer = await startDb({
      label: "db-isolation-writer",
      mode: "substrate",
      tenant: tenantOne,
      agentId: "agent-one",
      scope: "scope-one",
      stateDirectory,
    });
    await invoke(writer.sidecar, "write", writeRequest(500, "only exact identity can recall"), writer.token);
    await writer.sidecar.stop();

    const identities = [
      { tenant: tenantTwo, agentId: "agent-one", scope: "scope-one", checked: 0 },
      { tenant: tenantOne, agentId: "agent-two", scope: "scope-one", checked: 0 },
      { tenant: tenantOne, agentId: "agent-one", scope: "scope-two", checked: 1 },
    ] as const;
    for (const [index, identity] of identities.entries()) {
      const reader = await startDb({
        label: `db-isolation-reader-${index}`,
        mode: "substrate",
        ...identity,
        stateDirectory,
      });
      try {
        const read = await invoke(reader.sidecar, "read", readRequest(510 + index), reader.token);
        expect(read.body.stateSummary).toBe(PRODUCTION_STATE_CONTROL_CONTEXT);
        const entry = readProductionStateAudit(reader.sidecar.auditPath)[0]!;
        expect(entry.backendReceipt?.checkedRecords).toBe(identity.checked);
      } finally {
        await reader.sidecar.stop();
      }
    }
  });

  it("preserves one valid continuity chain under concurrent sidecar writers", async () => {
    const tenant = await makeTenant();
    const stateDirectory = temporaryDirectory("db-concurrent-state");
    const common = {
      mode: "substrate" as const,
      tenant,
      agentId: "concurrent-agent",
      scope: "concurrent-scope",
      stateDirectory,
    };
    const left = await startDb({ label: "db-concurrent-left", ...common });
    const right = await startDb({ label: "db-concurrent-right", ...common });
    try {
      const writes = await Promise.all(
        Array.from({ length: 24 }, (_, index) => {
          const target = index % 2 === 0 ? left : right;
          return invoke(
            target.sidecar,
            "write",
            writeRequest(600 + index, `database concurrent state ${index}`),
            target.token,
          );
        }),
      );
      expect(writes.every((write) => write.status === 200)).toBe(true);
      const ledger = new PostgresContinuityLedger(pool);
      const report = await ledger.verify(tenant, common.agentId);
      expect(report.valid, report.errors.join("\n")).toBe(true);
      expect(report.checked).toBe(24);
    } finally {
      await Promise.all([left.sidecar.stop(), right.sidecar.stop()]);
    }
  });

  it("fails closed when the full continuity chain is tampered after restart", async () => {
    const tenant = await makeTenant();
    const stateDirectory = temporaryDirectory("db-tamper-state");
    const identity = {
      tenant,
      agentId: "tamper-agent",
      scope: "tamper-scope",
    };
    const writer = await startDb({
      label: "db-tamper-writer",
      mode: "substrate",
      ...identity,
      stateDirectory,
    });
    await invoke(writer.sidecar, "write", writeRequest(700, "state before database tamper"), writer.token);
    await writer.sidecar.stop();
    await pool.query(
      `UPDATE continuity.checkpoints
          SET summary = summary || ' forged'
        WHERE tenant_id = $1 AND agent_id = $2`,
      [tenant, identity.agentId],
    );

    await expect(startDb({
      label: "db-tamper-reader",
      mode: "substrate",
      ...identity,
      stateDirectory,
    })).rejects.toThrow(/continuity chain verification failed/);
  });
});
