import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const SENTINEL_RAW_SHA256 = /^[a-f0-9]{64}$/u;
export const SENTINEL_RAW_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

export type SentinelRawJson =
  | null
  | boolean
  | number
  | string
  | readonly SentinelRawJson[]
  | { readonly [key: string]: SentinelRawJson };

export interface SentinelRawArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export function sentinelRawCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sentinelRawIsRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sentinelRawExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!sentinelRawIsRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort(sentinelRawCompare);
  const wanted = [...expected].sort(sentinelRawCompare);
  if (actual.join("\0") !== wanted.join("\0")) throw new Error(`${label} keys are not exact`);
}

export function sentinelRawCanonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(sentinelRawCanonical).join(",")}]`;
  if (sentinelRawIsRecord(value)) {
    return `{${Object.keys(value).sort(sentinelRawCompare).map((key) =>
      `${JSON.stringify(key)}:${sentinelRawCanonical(value[key])}`).join(",")}}`;
  }
  throw new Error(`canonical JSON rejects ${typeof value}`);
}

export function sentinelRawSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sentinelRawJsonSha256(value: unknown): string {
  return sentinelRawSha256(sentinelRawCanonical(value));
}

export function sentinelRawCanonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is not a canonical timestamp`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} is not a canonical timestamp`);
  }
  return value;
}

export function sentinelRawContainedPath(rootInput: string, child: unknown, label: string): string {
  const root = resolve(rootInput);
  if (typeof child !== "string" || child.length === 0 || isAbsolute(child) || child.includes("\0")) {
    throw new Error(`${label} is not a safe relative path`);
  }
  const path = resolve(root, child);
  if (path === root || !path.startsWith(`${root}${sep}`)) throw new Error(`${label} escapes its root`);
  return path;
}

export function sentinelRawRegularFile(path: string, label: string): Buffer {
  const normalized = resolve(path);
  if (!existsSync(normalized)) throw new Error(`${label} is missing`);
  const stat = lstatSync(normalized);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is not a regular file`);
  return readFileSync(normalized);
}

export function sentinelRawJsonFile(path: string, label: string): unknown {
  const bytes = sentinelRawRegularFile(path, label);
  if (bytes.byteLength === 0 || bytes.byteLength > 64 * 1024 * 1024) {
    throw new Error(`${label} byte length is invalid`);
  }
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

export function sentinelRawNdjsonFile(path: string, label: string): readonly unknown[] {
  const bytes = sentinelRawRegularFile(path, label);
  const text = bytes.toString("utf8");
  if (text.length === 0) return [];
  if (!text.endsWith("\n")) throw new Error(`${label} is not newline terminated`);
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new Error(`${label} line ${index + 1} is not valid JSON`);
    }
  });
}

export function sentinelRawInventory(rootInput: string): readonly SentinelRawArtifactIdentity[] {
  const root = realpathSync(resolve(rootInput));
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("artifact root is not a canonical real directory");
  }
  const output: SentinelRawArtifactIdentity[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort(sentinelRawCompare)) {
      if (name === "." || name === ".." || /[\/\\\0\r\n\t]/u.test(name)) {
        throw new Error("artifact tree contains an unsafe name");
      }
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("artifact tree contains a symbolic link");
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) {
        const bytes = readFileSync(path);
        output.push({ path: relative(root, path), byteLength: bytes.byteLength, sha256: sentinelRawSha256(bytes) });
      } else throw new Error("artifact tree contains a special file");
      if (output.length > 100_000) throw new Error("artifact inventory exceeds its file ceiling");
    }
  };
  visit(root);
  return output.sort((left, right) => sentinelRawCompare(left.path, right.path));
}

export function sentinelRawVerifyInventory(
  root: string,
  declared: readonly SentinelRawArtifactIdentity[],
): readonly string[] {
  const issues: string[] = [];
  let actual: readonly SentinelRawArtifactIdentity[] = [];
  try {
    actual = sentinelRawInventory(root);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (new Set(declared.map(({ path }) => path)).size !== declared.length) {
    issues.push("declared artifact inventory reuses a path");
  }
  if (sentinelRawCanonical(actual) !== sentinelRawCanonical(declared)) {
    const actualPaths = new Set(actual.map(({ path }) => path));
    const declaredPaths = new Set(declared.map(({ path }) => path));
    const extra = actual.filter(({ path }) => !declaredPaths.has(path)).map(({ path }) => path);
    const missing = declared.filter(({ path }) => !actualPaths.has(path)).map(({ path }) => path);
    if (extra.length > 0) issues.push(`artifact inventory has extras: ${extra.slice(0, 8).join(", ")}`);
    if (missing.length > 0) issues.push(`artifact inventory has missing paths: ${missing.slice(0, 8).join(", ")}`);
    if (extra.length === 0 && missing.length === 0) issues.push("artifact byte lengths or hashes differ from inventory");
  }
  return issues;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

export function sentinelRawStructurallyValidPng(bytes: Buffer): boolean {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.byteLength < 33 || !bytes.subarray(0, 8).equals(signature)) return false;
  let offset = 8;
  let chunks = 0;
  let idatSeen = false;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 12) return false;
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.byteLength) return false;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(type) || bytes.readUInt32BE(dataEnd) !== crc32(bytes.subarray(typeStart, dataEnd))) return false;
    if (chunks === 0) {
      if (type !== "IHDR" || length !== 13 || bytes.readUInt32BE(dataStart) === 0 || bytes.readUInt32BE(dataStart + 4) === 0) return false;
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || ![0, 1].includes(bytes[dataStart + 12] as number)) return false;
    } else if (type === "IHDR") return false;
    if (type === "IDAT") idatSeen = true;
    if (type === "IEND") return length === 0 && idatSeen && end === bytes.byteLength;
    chunks += 1;
    offset = end;
  }
  return false;
}

export function sentinelRawReceiptHash(value: unknown, field: string): string {
  if (!sentinelRawIsRecord(value) || typeof value[field] !== "string") {
    throw new Error(`receipt lacks ${field}`);
  }
  const stored = value[field];
  const body = { ...value };
  delete body[field];
  if (!SENTINEL_RAW_SHA256.test(stored) || sentinelRawJsonSha256(body) !== stored) {
    throw new Error(`receipt ${field} is not content-addressed`);
  }
  return stored;
}
