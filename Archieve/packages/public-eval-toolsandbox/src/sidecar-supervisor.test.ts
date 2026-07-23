import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  startToolSandboxSidecarProcess,
  type RunningToolSandboxSidecarProcess,
} from "./sidecar-supervisor.js";
import { verifyToolSandboxSidecarRuntimeClosure } from "./runtime-closure.js";

const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const COMPILED_ENTRY = resolve(SOURCE_DIRECTORY, "../dist/sidecar-entry.js");

function restoreEnvironment(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

describe("ToolSandbox sidecar process supervision", () => {
  it("strips inherited Node preload/search options and attests the complete runtime packages", () => {
    expect(existsSync(COMPILED_ENTRY)).toBe(true);
    const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-sidecar-supervisor-"));
    const statePath = resolve(root, "boundary.json");
    const auditPath = resolve(root, "audit.jsonl");
    const readyPath = resolve(root, "ready.json");
    const finalReceiptPath = resolve(root, "final.json");
    const markerPath = resolve(root, "preload-ran.txt");
    const preloadPath = resolve(root, "hostile-preload.mjs");
    writeFileSync(
      preloadPath,
      "import { writeFileSync } from 'node:fs';\n" +
        "const marker = process.env.PM_TEST_PRELOAD_MARKER;\n" +
        "if (marker) writeFileSync(marker, 'preloaded\\n', 'utf8');\n",
      "utf8",
    );

    const priorNodeOptions = process.env["NODE_OPTIONS"];
    const priorNodePath = process.env["NODE_PATH"];
    const priorMarker = process.env["PM_TEST_PRELOAD_MARKER"];
    let running: RunningToolSandboxSidecarProcess | undefined;
    try {
      process.env["NODE_OPTIONS"] = `--import=${pathToFileURL(preloadPath).href}`;
      process.env["NODE_PATH"] = resolve(root, "hostile-node-path");
      process.env["PM_TEST_PRELOAD_MARKER"] = markerPath;

      running = startToolSandboxSidecarProcess({
        nodeExecutable: process.execPath,
        entryPath: COMPILED_ENTRY,
        arm: "sham",
        evaluationTrack: "restart_lost_response_derivative",
        attemptId: "sidecar-supervisor-attempt-001",
        statePath,
        auditPath,
        readyPath,
        finalReceiptPath,
        stdoutPath: resolve(root, "stdout.log"),
        stderrPath: resolve(root, "stderr.log"),
      });

      expect(existsSync(markerPath)).toBe(false);
      const ready = running.readyReceipt;
      const config = ready["config"] as Record<string, unknown>;
      expect(config["moduleResolutionEnvironment"]).toEqual({
        nodeOptions: "absent",
        nodePath: "absent",
      });
      const executableEvidence = config["executableEvidence"] as Record<
        string,
        unknown
      >;
      const retainedClosure = verifyToolSandboxSidecarRuntimeClosure(
        executableEvidence["runtimeModuleClosure"],
      );
      expect(retainedClosure).toEqual(running.runtimeModuleClosure);
      expect(retainedClosure.packages.map((item) => item.packageName)).toEqual([
        "@pm/public-eval-toolsandbox",
        "@pm/agent-state-core",
        "@pm/types",
      ]);
      const publicModules = retainedClosure.packages[0]?.modules.map(
        (module) => module.relativePath,
      );
      const coreModules = retainedClosure.packages[1]?.modules.map(
        (module) => module.relativePath,
      );
      expect(publicModules).toEqual(
        expect.arrayContaining([
          "index.js",
          "runtime-closure.js",
          "sidecar-entry.js",
          "sidecar.js",
        ]),
      );
      expect(coreModules).toEqual(
        expect.arrayContaining(["external-evidence.js", "index.js"]),
      );
      expect(retainedClosure.moduleCount).toBeGreaterThan(6);

      const final = running.stop();
      running = undefined;
      expect(final["schemaVersion"]).toBe(
        "pm.public-eval.toolsandbox-sidecar-final.v1",
      );
      expect(readFileSync(finalReceiptPath, "utf8")).toContain(
        String(final["finalHash"]),
      );
      expect(existsSync(markerPath)).toBe(false);
    } finally {
      if (running !== undefined) {
        try {
          running.stop();
        } catch {
          try {
            process.kill(running.pid, "SIGKILL");
          } catch {
            // The process may already have exited.
          }
        }
      }
      restoreEnvironment("NODE_OPTIONS", priorNodeOptions);
      restoreEnvironment("NODE_PATH", priorNodePath);
      restoreEnvironment("PM_TEST_PRELOAD_MARKER", priorMarker);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
