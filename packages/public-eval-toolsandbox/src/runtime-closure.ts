import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

const CLOSURE_SCHEMA =
  "pm.public-eval.toolsandbox-sidecar-runtime-closure.v2";
const SHA256 = /^[a-f0-9]{64}$/u;
const PACKAGE_NAMES = [
  "@pm/public-eval-toolsandbox",
  "@pm/agent-state-core",
  "@pm/types",
] as const;

type JsonRecord = Record<string, unknown>;

export type ToolSandboxSidecarRuntimePackageName =
  (typeof PACKAGE_NAMES)[number];

export interface ToolSandboxSidecarRuntimeModule {
  readonly relativePath: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface ToolSandboxSidecarRuntimePackage {
  readonly packageName: ToolSandboxSidecarRuntimePackageName;
  readonly entryRelativePath: string;
  readonly modules: readonly ToolSandboxSidecarRuntimeModule[];
}

export interface ToolSandboxSidecarRuntimeClosure {
  readonly schemaVersion: typeof CLOSURE_SCHEMA;
  readonly packages: readonly ToolSandboxSidecarRuntimePackage[];
  readonly moduleCount: number;
  readonly closureHash: string;
}

export interface ToolSandboxSidecarRuntimeRoots {
  readonly publicEvalEntryPath: string;
  readonly agentStateCoreEntryPath: string;
  readonly typesEntryPath: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: JsonRecord,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${path} has missing or unexpected fields`);
  }
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalStringify(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot hash unsupported JSON ${typeof value}`);
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedRealPath(value: string, path: string): string {
  if (!isAbsolute(value) || resolve(value) !== value || value.includes("\0")) {
    throw new Error(`${path} must be an absolute normalized path`);
  }
  let actual: string;
  try {
    actual = realpathSync(value);
  } catch {
    throw new Error(`${path} does not exist`);
  }
  if (actual !== value) throw new Error(`${path} must be a canonical real path`);
  return value;
}

function assertRegularUnsymlinkedFile(value: string, path: string): void {
  normalizedRealPath(value, path);
  const status = lstatSync(value);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${path} must be a regular unsymlinked file`);
  }
}

type RuntimeSourceKind = "javascript" | "typescript";

function sourceKind(entryPath: string): RuntimeSourceKind {
  const extension = extname(entryPath);
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    return "javascript";
  }
  if (extension === ".ts" || extension === ".mts" || extension === ".cts") {
    return "typescript";
  }
  throw new Error("runtime entry has an unsupported module extension");
}

function isRuntimeModule(name: string, kind: RuntimeSourceKind): boolean {
  if (name.startsWith("._")) return false;
  if (kind === "javascript") {
    return name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".cjs");
  }
  return (
    (name.endsWith(".ts") || name.endsWith(".mts") || name.endsWith(".cts")) &&
    !name.endsWith(".d.ts") &&
    !name.endsWith(".test.ts")
  );
}

function slashPath(value: string): string {
  return sep === "/" ? value : value.split(sep).join("/");
}

function inventoryRuntimeModules(
  runtimeRootPath: string,
  kind: RuntimeSourceKind,
): readonly ToolSandboxSidecarRuntimeModule[] {
  const relativePaths: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (entry.name.startsWith("._")) continue;
      const path = resolve(directory, entry.name);
      const status = lstatSync(path);
      if (status.isSymbolicLink()) {
        throw new Error(`runtime closure rejects symlink ${path}`);
      }
      if (status.isDirectory()) {
        visit(path);
      } else if (status.isFile() && isRuntimeModule(entry.name, kind)) {
        relativePaths.push(slashPath(relative(runtimeRootPath, path)));
      }
    }
  };
  visit(runtimeRootPath);
  relativePaths.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return relativePaths.map((relativePath) => {
    const path = resolve(runtimeRootPath, relativePath);
    const bytes = readFileSync(path);
    return {
      relativePath,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes),
    };
  });
}

function buildPackage(
  packageName: ToolSandboxSidecarRuntimePackageName,
  rawEntryPath: string,
): ToolSandboxSidecarRuntimePackage {
  const entryPath = realpathSync(resolve(rawEntryPath));
  assertRegularUnsymlinkedFile(entryPath, `${packageName}/entryPath`);
  const runtimeRootPath = dirname(entryPath);
  normalizedRealPath(runtimeRootPath, `${packageName}/runtimeRootPath`);
  const modules = inventoryRuntimeModules(runtimeRootPath, sourceKind(entryPath));
  const entryRelativePath = slashPath(relative(runtimeRootPath, entryPath));
  if (!modules.some((module) => module.relativePath === entryRelativePath)) {
    throw new Error(`${packageName} entry is absent from its runtime module inventory`);
  }
  return { packageName, entryRelativePath, modules };
}

/**
 * Builds the deterministic on-disk module inventory used by both the child and
 * its supervisor. The inventory intentionally covers each complete compiled
 * package runtime, not only the sidecar entry file, so an imported
 * implementation cannot be replaced while retaining the same attestation.
 */
export function buildToolSandboxSidecarRuntimeClosure(
  roots: ToolSandboxSidecarRuntimeRoots,
): ToolSandboxSidecarRuntimeClosure {
  const packages = [
    buildPackage("@pm/public-eval-toolsandbox", roots.publicEvalEntryPath),
    buildPackage("@pm/agent-state-core", roots.agentStateCoreEntryPath),
    buildPackage("@pm/types", roots.typesEntryPath),
  ] as const;
  const body = {
    schemaVersion: CLOSURE_SCHEMA,
    packages,
    moduleCount: packages.reduce((count, item) => count + item.modules.length, 0),
  } as const;
  return { ...body, closureHash: sha256Bytes(canonicalStringify(body)) };
}

/** Resolves the workspace dependencies from the compiled sidecar entry. */
export function computeToolSandboxSidecarRuntimeClosure(
  rawPublicEvalEntryPath: string,
): ToolSandboxSidecarRuntimeClosure {
  const publicEvalEntryPath = realpathSync(resolve(rawPublicEvalEntryPath));
  assertRegularUnsymlinkedFile(
    publicEvalEntryPath,
    "@pm/public-eval-toolsandbox/entryPath",
  );
  const resolveLocalPackageEntry = (
    packageName: "@pm/agent-state-core" | "@pm/types",
  ): string => {
    let cursor = dirname(publicEvalEntryPath);
    const nameParts = packageName.split("/");
    while (true) {
      const candidate = resolve(cursor, "node_modules", ...nameParts, "package.json");
      if (existsSync(candidate)) {
        const manifestPath = realpathSync(candidate);
        const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
        if (!isRecord(parsed) || parsed["name"] !== packageName) {
          throw new Error(`${packageName} package manifest identity is invalid`);
        }
        const exportsField = parsed["exports"];
        const dotExport = isRecord(exportsField) ? exportsField["."] : undefined;
        const importTarget = isRecord(dotExport) ? dotExport["import"] : undefined;
        const target =
          typeof importTarget === "string" ? importTarget : parsed["main"];
        if (
          typeof target !== "string" ||
          !target.startsWith("./") ||
          target.split("/").some((part) => part === "..")
        ) {
          throw new Error(`${packageName} runtime entry declaration is invalid`);
        }
        return resolve(dirname(manifestPath), target);
      }
      const parent = dirname(cursor);
      if (parent === cursor) {
        throw new Error(`${packageName} is not installed beside the sidecar runtime`);
      }
      cursor = parent;
    }
  };
  return buildToolSandboxSidecarRuntimeClosure({
    publicEvalEntryPath,
    agentStateCoreEntryPath: resolveLocalPackageEntry("@pm/agent-state-core"),
    typesEntryPath: resolveLocalPackageEntry("@pm/types"),
  });
}

/**
 * Strictly validates a retained path-independent inventory and its aggregate
 * hash. A trusted verifier separately computes the same shape from its current
 * checkout and compares the two closures; retained absolute installation paths
 * are intentionally not part of the portable byte identity.
 */
export function verifyToolSandboxSidecarRuntimeClosure(
  value: unknown,
): ToolSandboxSidecarRuntimeClosure {
  if (!isRecord(value)) throw new Error("runtime closure must be an object");
  exactKeys(
    value,
    ["schemaVersion", "packages", "moduleCount", "closureHash"],
    "/runtimeClosure",
  );
  if (value["schemaVersion"] !== CLOSURE_SCHEMA) {
    throw new Error("runtime closure schema is invalid");
  }
  if (!Array.isArray(value["packages"]) || value["packages"].length !== PACKAGE_NAMES.length) {
    throw new Error("runtime closure package inventory is incomplete");
  }
  const packages = value["packages"].map((rawPackage, packageIndex) => {
    if (!isRecord(rawPackage)) throw new Error("runtime closure package must be an object");
    const path = `/runtimeClosure/packages/${packageIndex}`;
    exactKeys(rawPackage, ["packageName", "entryRelativePath", "modules"], path);
    const packageName = PACKAGE_NAMES[packageIndex];
    if (packageName === undefined) {
      throw new Error("runtime closure has too many packages");
    }
    if (rawPackage["packageName"] !== packageName) {
      throw new Error("runtime closure package order/name is invalid");
    }
    const entryRelativePath = rawPackage["entryRelativePath"];
    if (
      typeof entryRelativePath !== "string" ||
      entryRelativePath.length === 0 ||
      entryRelativePath.startsWith("/") ||
      entryRelativePath.includes("\\") ||
      entryRelativePath.split("/").some((part) => part === "" || part === "." || part === "..")
    ) {
      throw new Error("runtime closure package entry path is unsafe");
    }
    if (!Array.isArray(rawPackage["modules"]) || rawPackage["modules"].length === 0) {
      throw new Error("runtime closure package modules are missing");
    }
    const modules = rawPackage["modules"].map((rawModule, moduleIndex) => {
      if (!isRecord(rawModule)) throw new Error("runtime closure module must be an object");
      const modulePath = `${path}/modules/${moduleIndex}`;
      exactKeys(rawModule, ["relativePath", "byteLength", "sha256"], modulePath);
      const relativePath = rawModule["relativePath"];
      const byteLength = rawModule["byteLength"];
      const sha256 = rawModule["sha256"];
      if (
        typeof relativePath !== "string" ||
        relativePath.length === 0 ||
        relativePath.startsWith("/") ||
        relativePath.includes("\\") ||
        relativePath.split("/").some((part) => part === "" || part === "." || part === "..")
      ) {
        throw new Error("runtime closure module path is unsafe");
      }
      if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) {
        throw new Error("runtime closure module byte length is invalid");
      }
      if (typeof sha256 !== "string" || !SHA256.test(sha256)) {
        throw new Error("runtime closure module hash is invalid");
      }
      return { relativePath, byteLength: byteLength as number, sha256 };
    });
    if (!modules.some((module) => module.relativePath === entryRelativePath)) {
      throw new Error("runtime closure package entry is absent from modules");
    }
    const sorted = [...modules].sort((left, right) =>
      left.relativePath < right.relativePath
        ? -1
        : left.relativePath > right.relativePath
          ? 1
          : 0,
    );
    if (
      canonicalStringify(modules) !== canonicalStringify(sorted) ||
      new Set(modules.map((module) => module.relativePath)).size !== modules.length
    ) {
      throw new Error("runtime closure modules must be uniquely sorted by path");
    }
    return { packageName, entryRelativePath, modules };
  });
  const moduleCount = value["moduleCount"];
  const actualCount = packages.reduce((count, item) => count + item.modules.length, 0);
  if (!Number.isSafeInteger(moduleCount) || moduleCount !== actualCount) {
    throw new Error("runtime closure module count is invalid");
  }
  const closureHash = value["closureHash"];
  if (typeof closureHash !== "string" || !SHA256.test(closureHash)) {
    throw new Error("runtime closure hash is invalid");
  }
  const body = {
    schemaVersion: CLOSURE_SCHEMA,
    packages,
    moduleCount: actualCount,
  } as const;
  if (sha256Bytes(canonicalStringify(body)) !== closureHash) {
    throw new Error("runtime closure hash does not recompute");
  }
  return { ...body, closureHash };
}
