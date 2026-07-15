import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_STATE_CONTEXT_WIDTH,
  SENTINEL_STATE_READ_SCHEMA_VERSION,
  SENTINEL_STATE_WRITE_SCHEMA_VERSION,
  parseSentinelStateResponse,
  parseSentinelStateWriteRequest,
  readSentinelStateAuditFile,
  startSentinelStateSidecar,
  verifySentinelStateAuditChain,
  verifySentinelStateSidecarEvidence,
  type RunningSentinelStateSidecar,
  type SentinelStateAuditEntry,
  type SentinelStateReadRequest,
  type SentinelStateSidecarMode,
  type SentinelStateWriteRequest,
} from "./sentinel-state-sidecar.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(label: string): string {
  const directory = mkdtempSync(join(realpathSync.native(tmpdir()), `pm-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

function token(label: string): string {
  return `${label}-${"x".repeat(64)}`;
}

interface Invocation {
  readonly status: number;
  readonly text: string;
  readonly body: ReturnType<typeof parseSentinelStateResponse>;
  readonly elapsedMs: number;
}

async function invoke(
  sidecar: RunningSentinelStateSidecar,
  route: "write" | "read",
  body: unknown,
  bearerToken: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Invocation> {
  const beganAt = performance.now();
  const response = await fetch(`${sidecar.endpoint}/${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: parseSentinelStateResponse(JSON.parse(text) as unknown),
    elapsedMs: performance.now() - beganAt,
  };
}

function canonicalWrite(observedAt: string): SentinelStateWriteRequest {
  return {
    schemaVersion: SENTINEL_STATE_WRITE_SCHEMA_VERSION,
    operationId: "1".repeat(32),
    memoryKey: "microhub.star-count",
    observation: {
      source: "browser_observation",
      observedAt,
      value: "1842",
    },
  };
}

function canonicalRead(operationId = "2".repeat(32)): SentinelStateReadRequest {
  return {
    schemaVersion: SENTINEL_STATE_READ_SCHEMA_VERSION,
    operationId,
    memoryKey: "microhub.star-count",
  };
}

describe("Sentinel live state sidecar", () => {
  it("strictly rejects unknown keys and unsafe observation text", () => {
    const observedAt = new Date().toISOString();
    expect(() =>
      parseSentinelStateWriteRequest({
        ...canonicalWrite(observedAt),
        arm: "hidden-control-label",
      }),
    ).toThrow(/missing or unknown keys/);
    expect(() =>
      parseSentinelStateWriteRequest({
        ...canonicalWrite(observedAt),
        observation: {
          ...canonicalWrite(observedAt).observation,
          value: "quoted \"value\"",
        },
      }),
    ).toThrow(/safe printable ASCII/);
  });

  it("keeps controls arm-opaque while only admitted substrate state changes retrieval", async () => {
    const minimumLatencyMs = 15;
    const modes: readonly SentinelStateSidecarMode[] = [
      "native",
      "sham",
      "substrate",
    ];
    const sidecars = await Promise.all(
      modes.map(async (mode) => {
        const bearerToken = token(`matched-${mode}`);
        const sidecar = await startSentinelStateSidecar({
          mode,
          outputDirectory: temporaryDirectory(mode),
          bearerToken,
          tenant: "sentinel-public-eval",
          minimumLatencyMs,
        });
        return { mode, bearerToken, sidecar };
      }),
    );

    try {
      const write = canonicalWrite(new Date().toISOString());
      const writes = await Promise.all(
        sidecars.map(({ bearerToken, sidecar }) =>
          invoke(sidecar, "write", write, bearerToken),
        ),
      );
      expect(new Set(writes.map((result) => result.text)).size).toBe(1);
      expect(writes.every((result) => result.status === 200)).toBe(true);
      expect(writes.every((result) => result.elapsedMs >= minimumLatencyMs - 2)).toBe(true);

      const read = canonicalRead();
      const reads = await Promise.all(
        sidecars.map(({ bearerToken, sidecar }) =>
          invoke(sidecar, "read", read, bearerToken),
        ),
      );
      expect(reads[0]?.text).toBe(reads[1]?.text);
      expect(new Set(reads.map((result) => Buffer.byteLength(result.text))).size).toBe(1);
      expect(
        reads.map((result) => Object.keys(result.body).sort().join(",")),
      ).toEqual(Array(3).fill("context,contextEncoding,operationId,padding,schemaVersion,status"));
      expect(reads.every((result) => result.body.context.length === SENTINEL_STATE_CONTEXT_WIDTH)).toBe(true);
      expect(reads[0]?.body.context).not.toContain("1842");
      expect(reads[1]?.body.context).not.toContain("1842");
      expect(reads[2]?.body.context).toContain("browser_observation=1842");

      const agentVisible = [
        ...writes.map((result) => result.text),
        ...reads.map((result) => result.text),
        ...sidecars.map(({ sidecar }) => JSON.stringify(sidecar.readyReceipt)),
      ]
        .join("\n")
        .toLowerCase();
      for (const forbidden of ["native", "sham", "substrate"]) {
        expect(agentVisible).not.toContain(forbidden);
      }
    } finally {
      const finals = await Promise.all(sidecars.map(({ sidecar }) => sidecar.stop()));
      const audits = sidecars.map(({ sidecar }) => readSentinelStateAuditFile(sidecar.auditPath));
      audits.forEach((entries, index) => {
        const sidecar = sidecars[index];
        const final = finals[index];
        expect(sidecar).toBeDefined();
        expect(final).toBeDefined();
        expect(entries).toHaveLength(2);
        expect(entries[0]?.admittedEvidence?.evidence.payload.value).toBe("1842");
        expect(
          verifySentinelStateSidecarEvidence(
            sidecar!.sidecar.readyReceipt,
            final!,
            entries,
          ).valid,
        ).toBe(true);
      });
      expect(finals[0]?.stateSha256).toBe(sidecars[0]?.sidecar.readyReceipt.initialStateSha256);
      expect(finals[1]?.stateSha256).not.toBe(sidecars[1]?.sidecar.readyReceipt.initialStateSha256);
      expect(finals[2]?.stateSha256).not.toBe(sidecars[2]?.sidecar.readyReceipt.initialStateSha256);
    }
  });

  it("retains the first admitted baseline instead of replacing it with later polls", async () => {
    const bearerToken = token("first-baseline");
    const sidecar = await startSentinelStateSidecar({
      mode: "substrate",
      outputDirectory: temporaryDirectory("first-baseline"),
      bearerToken,
      tenant: "sentinel-public-eval",
      minimumLatencyMs: 5,
    });
    try {
      const first = canonicalWrite(new Date().toISOString());
      const later: SentinelStateWriteRequest = {
        ...first,
        operationId: "5".repeat(32),
        observation: { ...first.observation, value: "1999" },
      };
      expect((await invoke(sidecar, "write", first, bearerToken)).status).toBe(200);
      expect((await invoke(sidecar, "write", later, bearerToken)).status).toBe(200);
      const read = await invoke(
        sidecar,
        "read",
        canonicalRead("6".repeat(32)),
        bearerToken,
      );
      expect(read.status).toBe(200);
      expect(read.body.context).toContain("browser_observation=1842");
      expect(read.body.context).not.toContain("1999");
    } finally {
      await sidecar.stop();
    }
  });

  it("drains an in-flight request before closing the audit and sealing final counts", async () => {
    const bearerToken = token("drain-in-flight");
    const sidecar = await startSentinelStateSidecar({
      mode: "substrate",
      outputDirectory: temporaryDirectory("drain-in-flight"),
      bearerToken,
      tenant: "sentinel-public-eval",
      minimumLatencyMs: 200,
    });
    const pending = invoke(
      sidecar,
      "write",
      canonicalWrite(new Date().toISOString()),
      bearerToken,
    );
    const deadline = performance.now() + 2_000;
    while (readFileSync(sidecar.auditPath).byteLength === 0 && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(readFileSync(sidecar.auditPath).byteLength).toBeGreaterThan(0);

    const final = await sidecar.stop();
    expect((await pending).status).toBe(200);
    expect(final.requestCounts).toMatchObject({ total: 1, writes: 1, rejected: 0 });
    const entries = readSentinelStateAuditFile(sidecar.auditPath);
    expect(entries).toHaveLength(1);
    expect(verifySentinelStateSidecarEvidence(sidecar.readyReceipt, final, entries).valid).toBe(true);
  });

  it("rejects unauthenticated, duplicate, and unknown-key requests and detects tampering", async () => {
    const bearerToken = token("do-not-persist-this-secret");
    const sidecar = await startSentinelStateSidecar({
      mode: "substrate",
      outputDirectory: temporaryDirectory("adversarial"),
      bearerToken,
      tenant: "sentinel-public-eval",
      minimumLatencyMs: 5,
    });
    const read = canonicalRead("3".repeat(32));
    try {
      const unauthorized = await invoke(sidecar, "read", read, "z".repeat(64));
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.text).not.toContain(bearerToken);

      const accepted = await invoke(sidecar, "read", read, bearerToken);
      expect(accepted.status).toBe(200);
      const duplicate = await invoke(sidecar, "read", read, bearerToken);
      expect(duplicate.status).toBe(409);

      const unknownKey = await invoke(
        sidecar,
        "write",
        { ...canonicalWrite(new Date().toISOString()), scenarioTruth: 2000 },
        bearerToken,
      );
      expect(unknownKey.status).toBe(400);

      const secretSmuggling = await invoke(
        sidecar,
        "write",
        {
          ...canonicalWrite(new Date().toISOString()),
          operationId: "4".repeat(32),
          observation: {
            ...canonicalWrite(new Date().toISOString()).observation,
            value: bearerToken,
          },
        },
        bearerToken,
      );
      expect(secretSmuggling.status).toBe(400);
    } finally {
      const final = await sidecar.stop();
      const entries = readSentinelStateAuditFile(sidecar.auditPath);
      expect(entries).toHaveLength(5);
      expect(final.requestCounts).toEqual({
        total: 5,
        authenticated: 4,
        rejected: 4,
        writes: 0,
        reads: 1,
        duplicateOperationIds: 1,
      });
      expect(
        verifySentinelStateSidecarEvidence(sidecar.readyReceipt, final, entries).valid,
      ).toBe(true);

      const artifacts = [sidecar.auditPath, sidecar.readyReceiptPath, sidecar.finalReceiptPath]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
      expect(artifacts).not.toContain(bearerToken);

      const tampered = structuredClone(entries) as SentinelStateAuditEntry[];
      tampered[0] = {
        ...tampered[0]!,
        stateSha256: "f".repeat(64),
      };
      const verification = verifySentinelStateAuditChain(tampered);
      expect(verification.valid).toBe(false);
      expect(verification.issues).toContain(
        "audit entry 1 hash does not match its content",
      );
    }
  });

  it("fails closed on relative, symlinked, and pre-populated artifact paths", async () => {
    await expect(
      startSentinelStateSidecar({
        mode: "native",
        outputDirectory: "relative-output",
        bearerToken: token("relative"),
        tenant: "sentinel-public-eval",
      }),
    ).rejects.toThrow(/absolute normalized path/);

    const real = temporaryDirectory("real-output");
    const link = join(temporaryDirectory("link-parent"), "linked-output");
    symlinkSync(real, link, "dir");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    await expect(
      startSentinelStateSidecar({
        mode: "sham",
        outputDirectory: link,
        bearerToken: token("symlink"),
        tenant: "sentinel-public-eval",
      }),
    ).rejects.toThrow(/non-symlink|traverse a symlink/);

    const occupied = temporaryDirectory("occupied-output");
    writeFileSync(join(occupied, "sentinel-state-ready.json"), "occupied\n", {
      flag: "wx",
    });
    await expect(
      startSentinelStateSidecar({
        mode: "substrate",
        outputDirectory: occupied,
        bearerToken: token("occupied"),
        tenant: "sentinel-public-eval",
      }),
    ).rejects.toThrow(/already exists/);
  });
});
