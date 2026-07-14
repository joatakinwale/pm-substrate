#!/usr/bin/env node

import {
  startSentinelStateSidecar,
  type SentinelStateSidecarMode,
} from "./sentinel-state-sidecar.js";

interface CliArguments {
  readonly outputDirectory: string;
  readonly port: number;
  readonly minimumLatencyMs: number;
}

function parseArguments(argv: readonly string[]): CliArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      flag === undefined ||
      value === undefined ||
      !["--output-directory", "--port", "--minimum-latency-ms"].includes(flag) ||
      values.has(flag)
    ) {
      throw new Error("invalid, missing, unknown, or duplicate sidecar CLI argument");
    }
    values.set(flag, value);
  }
  const outputDirectory = values.get("--output-directory");
  if (outputDirectory === undefined) {
    throw new Error("--output-directory is required");
  }
  return {
    outputDirectory,
    port: parseInteger(values.get("--port") ?? "0", "--port"),
    minimumLatencyMs: parseInteger(
      values.get("--minimum-latency-ms") ?? "25",
      "--minimum-latency-ms",
    ),
  };
}

function parseInteger(value: string, label: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a non-negative base-10 integer`);
  }
  return Number(value);
}

function requireMode(value: string | undefined): SentinelStateSidecarMode {
  if (value !== "native" && value !== "sham" && value !== "substrate") {
    throw new Error("PM_SENTINEL_STATE_MODE must select a supported internal mode");
  }
  return value;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const sidecar = await startSentinelStateSidecar({
    mode: requireMode(process.env.PM_SENTINEL_STATE_MODE),
    outputDirectory: args.outputDirectory,
    bearerToken: process.env.PM_SENTINEL_STATE_TOKEN ?? "",
    tenant: process.env.PM_SENTINEL_STATE_TENANT ?? "sentinel-public-eval",
    port: args.port,
    minimumLatencyMs: args.minimumLatencyMs,
  });
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-state-cli-ready.v1",
      endpoint: sidecar.endpoint,
      pid: sidecar.readyReceipt.pid,
      readyReceiptPath: sidecar.readyReceiptPath,
    })}\n`,
  );

  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    void sidecar
      .stop()
      .then((receipt) => {
        process.stdout.write(
          `${JSON.stringify({
            schemaVersion: "pm.public-eval-corners.sentinel-state-cli-final.v1",
            auditHeadSha256: receipt.auditHeadSha256,
            receiptSha256: receipt.receiptSha256,
          })}\n`,
        );
        process.exitCode = 0;
      })
      .catch(() => {
        process.stderr.write("sentinel state sidecar failed closed during finalization\n");
        process.exitCode = 1;
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown failure";
  process.stderr.write(`sentinel state sidecar failed closed: ${message}\n`);
  process.exitCode = 1;
});
