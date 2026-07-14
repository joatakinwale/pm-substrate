import { resolve } from "node:path";

import {
  startToolSandboxBoundarySidecar,
  type ToolSandboxBoundarySidecarConfig,
} from "./sidecar.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`required sidecar environment variable is missing: ${name}`);
  }
  return value;
}

function sidecarConfigFromEnvironment(): ToolSandboxBoundarySidecarConfig {
  const arm = requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_ARM");
  const evaluationTrack = requiredEnvironment(
    "PM_TOOLSANDBOX_SIDECAR_EVALUATION_TRACK",
  );
  const rawLimit = process.env["PM_TOOLSANDBOX_SIDECAR_MAX_REQUEST_BYTES"];
  const entryArgument = process.argv[1];
  if (entryArgument === undefined) throw new Error("sidecar entry path is unavailable");
  return {
    arm: arm as ToolSandboxBoundarySidecarConfig["arm"],
    evaluationTrack:
      evaluationTrack as ToolSandboxBoundarySidecarConfig["evaluationTrack"],
    attemptId: requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_ATTEMPT_ID"),
    statePath: requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_STATE_PATH"),
    auditPath: requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_AUDIT_PATH"),
    readyPath: requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_READY_PATH"),
    finalReceiptPath: requiredEnvironment(
      "PM_TOOLSANDBOX_SIDECAR_FINAL_RECEIPT_PATH",
    ),
    entryPath: resolve(entryArgument),
    bearerToken: requiredEnvironment("PM_TOOLSANDBOX_SIDECAR_BEARER_TOKEN"),
    ...(rawLimit === undefined ? {} : { maxRequestBytes: Number(rawLimit) }),
  };
}

try {
  const sidecar = await startToolSandboxBoundarySidecar(
    sidecarConfigFromEnvironment(),
  );
  let shuttingDown = false;
  const shutDown = (signal: "SIGINT" | "SIGTERM"): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void sidecar
      .close(signal)
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`ToolSandbox sidecar shutdown failed: ${message}\n`);
        process.exitCode = 1;
      });
  };
  process.once("SIGINT", () => shutDown("SIGINT"));
  process.once("SIGTERM", () => shutDown("SIGTERM"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ToolSandbox sidecar failed to start: ${message}\n`);
  process.exitCode = 1;
}
