import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const CLI_PATH = fileURLToPath(new URL("./sentinel-production-raw-verifier-cli.ts", import.meta.url));
const roots: string[] = [];

interface Fixture {
  readonly root: string;
  readonly batchRoot: string;
  readonly anchorPath: string;
  readonly outputParent: string;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    chmodSync(root, 0o700);
    rmSync(root, { recursive: true, force: true });
  }
});

function anchorJson(): string {
  return JSON.stringify({
    expectedAuthorityId: "independent-fixture-authority",
    expectedAuthorityPublicKeySha256: "1".repeat(64),
    expectedPreregistrationSha256: "2".repeat(64),
  }) + "\n";
}

function fixture(): Fixture {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "pm-raw-cli-boundary-"));
  roots.push(root);
  const batchRoot = join(root, "batch");
  const anchorPath = join(root, "out-of-band", "anchor.json");
  const outputParent = join(root, "reports");
  mkdirSync(batchRoot);
  mkdirSync(dirname(anchorPath));
  mkdirSync(outputParent);
  writeFileSync(anchorPath, anchorJson(), { mode: 0o400 });
  return { root, batchRoot, anchorPath, outputParent };
}

function run(
  value: Fixture,
  overrides: {
    readonly anchorPath?: string;
    readonly batchRoot?: string;
    readonly outputPath?: string;
  } = {},
): SpawnSyncReturns<string> {
  const argv = [
    "--import",
    "tsx",
    CLI_PATH,
    "--batch-root",
    overrides.batchRoot ?? value.batchRoot,
    "--trust-anchor",
    overrides.anchorPath ?? value.anchorPath,
  ];
  if (overrides.outputPath !== undefined) argv.push("--output", overrides.outputPath);
  return spawnSync(process.execPath, argv, {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)),
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

describe("Sentinel production raw verifier CLI evidence boundaries", () => {
  it("retains exit 1 for an invalid raw batch and writes a new read-only report exclusively", () => {
    const value = fixture();
    const outputPath = join(value.outputParent, "report.json");
    const result = run(value, { outputPath });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
    expect(lstatSync(outputPath).mode & 0o777).toBe(0o400);
    const report = JSON.parse(readFileSync(outputPath, "utf8")) as Record<string, unknown>;
    expect(report.valid).toBe(false);
    expect(report.rawComplete).toBe(false);
    expect(report.evidenceEligible).toBe(false);
  });

  it("rejects the retained in-batch trust anchor before raw verification", () => {
    const value = fixture();
    const retained = join(value.batchRoot, "inputs", "trust-anchor.json");
    mkdirSync(dirname(retained), { recursive: true });
    writeFileSync(retained, anchorJson(), { mode: 0o400 });

    const result = run(value, { anchorPath: retained });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("out-of-band trust anchor is not a disjoint canonical physical file\n");
    expect(result.stdout).toBe("");
  });

  it("rejects direct and ancestor symlink traversal for the trust anchor", () => {
    const value = fixture();
    const directLink = join(value.root, "anchor-link.json");
    const parentLink = join(value.root, "anchor-parent-link");
    symlinkSync(value.anchorPath, directLink);
    symlinkSync(dirname(value.anchorPath), parentLink, "dir");

    for (const anchorPath of [directLink, join(parentLink, "anchor.json")]) {
      const result = run(value, { anchorPath });
      expect(result.status).toBe(2);
      expect(result.stderr).toBe("out-of-band trust anchor is not a disjoint canonical physical file\n");
      expect(result.stdout).toBe("");
    }
  });

  it("rejects a hard-linked retained trust anchor even when its second name is outside the batch", () => {
    const value = fixture();
    const retained = join(value.batchRoot, "inputs", "trust-anchor.json");
    mkdirSync(dirname(retained), { recursive: true });
    writeFileSync(retained, anchorJson(), { mode: 0o400 });
    rmSync(value.anchorPath);
    linkSync(retained, value.anchorPath);

    const result = run(value);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("out-of-band trust anchor is not a bounded single-link regular file\n");
    expect(result.stdout).toBe("");
  });

  it("rejects an oversized trust anchor without parsing or echoing its contents", () => {
    const value = fixture();
    chmodSync(value.anchorPath, 0o600);
    writeFileSync(value.anchorPath, "secret-marker-".repeat(6_000), { mode: 0o400 });

    const result = run(value);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("out-of-band trust anchor is not a bounded single-link regular file\n");
    expect(result.stderr).not.toContain("secret-marker");
    expect(result.stdout).toBe("");
  });

  it("rejects output within the batch evidence tree", () => {
    const value = fixture();
    const outputPath = join(value.batchRoot, "report.json");

    const result = run(value, { outputPath });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("output must be absent and physically disjoint from evidence inputs\n");
    expect(result.stdout).toBe("");
    expect(() => lstatSync(outputPath)).toThrow();
  });

  it("rejects output through a symlinked parent without mutating the symlink target", () => {
    const value = fixture();
    const realParent = join(value.root, "untrusted-target");
    const linkedParent = join(value.root, "linked-output-parent");
    mkdirSync(realParent);
    symlinkSync(realParent, linkedParent, "dir");
    const target = join(realParent, "report.json");

    const result = run(value, { outputPath: join(linkedParent, "report.json") });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("output parent is not an existing canonical physical directory\n");
    expect(result.stdout).toBe("");
    expect(() => lstatSync(target)).toThrow();
  });

  it("rejects a dangling output symlink instead of treating it as an absent exclusive target", () => {
    const value = fixture();
    const outputPath = join(value.outputParent, "report.json");
    symlinkSync(join(value.root, "missing-target"), outputPath);

    const result = run(value, { outputPath });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("output must be absent and physically disjoint from evidence inputs\n");
    expect(result.stdout).toBe("");
    expect(lstatSync(outputPath).isSymbolicLink()).toBe(true);
  });

  it("maps missing-path failures to a path- and secret-free error", () => {
    const value = fixture();
    const missing = join(value.root, "secret-marker-missing-anchor.json");

    const result = run(value, { anchorPath: missing });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe("out-of-band trust anchor could not be read safely\n");
    expect(result.stderr).not.toContain("secret-marker");
    expect(result.stderr).not.toContain(value.root);
    expect(result.stdout).toBe("");
  });
});
