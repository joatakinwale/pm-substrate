import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";

import {
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
} from "./sentinel-production-plan.js";
import type { SentinelProductionArtifactIdentity } from "./sentinel-production-runner-manifests.js";

const MAX_ARTIFACTS_PER_CELL = 100_000;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface SentinelContentAddressedManifest {
  readonly path: string;
  readonly sha256: string;
}

export function writeSentinelExclusiveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
}

export function writeSentinelContentAddressedJson<T extends object>(
  directory: string,
  prefix: string,
  body: T,
): SentinelContentAddressedManifest {
  const hash = sentinelProductionJsonSha256(body);
  const path = resolve(directory, `${prefix}-${hash}.json`);
  writeSentinelExclusiveJson(path, { ...body, manifestSha256: hash });
  return { path, sha256: hash };
}

function artifactIdentity(path: string, root: string): SentinelProductionArtifactIdentity {
  const bytes = readFileSync(path);
  return {
    path: relative(root, path),
    byteLength: bytes.byteLength,
    sha256: sentinelProductionSha256(bytes),
  };
}

export function inventorySentinelTree(
  root: string,
  current = root,
): readonly SentinelProductionArtifactIdentity[] {
  if (!existsSync(current)) return [];
  const output: SentinelProductionArtifactIdentity[] = [];
  for (const name of readdirSync(current).sort(compare)) {
    const path = resolve(current, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("cell evidence contains a symbolic link");
    if (stat.isDirectory()) output.push(...inventorySentinelTree(root, path));
    else if (stat.isFile()) output.push(artifactIdentity(path, root));
    else throw new Error("cell evidence contains a special file");
    if (output.length > MAX_ARTIFACTS_PER_CELL) throw new Error("cell artifact ceiling exceeded");
  }
  return output.sort((left, right) => compare(left.path, right.path));
}

export function sealSentinelTree(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("cannot seal symbolic-link evidence");
    if (stat.isDirectory()) sealSentinelTree(path);
    else if (stat.isFile()) chmodSync(path, 0o400);
    else throw new Error("cannot seal special-file evidence");
  }
  chmodSync(root, 0o500);
}
