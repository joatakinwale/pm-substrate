import {
  startProductionStateSidecar,
  type StartProductionStateSidecarInput,
} from "./production-state-sidecar.js";

interface CrashChildReady {
  readonly schemaVersion: "pm.public-eval-corners.production-state-crash-child-ready.v1";
  readonly endpoint: string;
  readonly pid: number;
  readonly readyReceipt: Awaited<ReturnType<typeof startProductionStateSidecar>>["readyReceipt"];
}

async function main(): Promise<void> {
  const encoded = process.argv[2];
  if (encoded === undefined || process.send === undefined) {
    throw new Error("crash child requires a base64url configuration and an IPC channel");
  }
  const input = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as StartProductionStateSidecarInput;
  const running = await startProductionStateSidecar(input);
  const ready: CrashChildReady = {
    schemaVersion: "pm.public-eval-corners.production-state-crash-child-ready.v1",
    endpoint: running.endpoint,
    pid: process.pid,
    readyReceipt: running.readyReceipt,
  };
  process.send(ready);

  // Deliberately expose no shutdown path. The durability test must terminate
  // this process with SIGKILL after the HTTP write has been acknowledged.
  await new Promise<never>(() => undefined);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
