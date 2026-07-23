import { createHash } from "node:crypto";
import {
  closeSync,
  chmodSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";

const TREE_HEADER = /^([0-7]{6}) ([a-z]+) ([a-f0-9]{40})$/u;

function statFingerprint(stat: BigIntStats): string {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.nlink,
    stat.uid,
    stat.gid,
    stat.rdev,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join(":");
}

function gitBlobSha1(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function stableRegularFile(path: string): { readonly bytes: Buffer; readonly gitMode: "100644" | "100755" } {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`tracked path is not a regular file: ${path}`);
  }
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const openedBefore = fstatSync(descriptor, { bigint: true });
    if (!openedBefore.isFile() || statFingerprint(before) !== statFingerprint(openedBefore)) {
      throw new Error(`tracked file changed while it was opened: ${path}`);
    }
    const bytes = readFileSync(descriptor);
    const openedAfter = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(path, { bigint: true });
    if (
      statFingerprint(openedBefore) !== statFingerprint(openedAfter) ||
      statFingerprint(before) !== statFingerprint(after) ||
      BigInt(bytes.byteLength) !== openedAfter.size
    ) {
      throw new Error(`tracked file changed while it was read: ${path}`);
    }
    return {
      bytes,
      gitMode: (before.mode & 0o100n) === 0n ? "100644" : "100755",
    };
  } finally {
    closeSync(descriptor);
  }
}

function stableSymbolicLink(path: string): Buffer {
  const before = lstatSync(path, { bigint: true });
  if (!before.isSymbolicLink()) throw new Error(`tracked path is not a symbolic link: ${path}`);
  const first = readlinkSync(path, { encoding: "buffer" });
  const after = lstatSync(path, { bigint: true });
  const second = readlinkSync(path, { encoding: "buffer" });
  if (statFingerprint(before) !== statFingerprint(after) || !first.equals(second)) {
    throw new Error(`tracked symbolic link changed while it was read: ${path}`);
  }
  return first;
}

/** Fail before evidence collection when the checkout volume cannot represent Git's executable bit. */
export function assertSentinelGitModeFaithfulFilesystem(checkoutPath: string): void {
  const root = resolve(checkoutPath);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync(root) !== root) {
    throw new Error("tracked checkout root must be a canonical physical directory");
  }
  const probeRoot = mkdtempSync(resolve(root, ".pm-sentinel-mode-probe-"));
  const probePath = resolve(probeRoot, "mode-probe");
  try {
    writeFileSync(probePath, "mode-probe\n", { flag: "wx", mode: 0o600 });
    chmodSync(probePath, 0o600);
    const withoutExecute = lstatSync(probePath);
    chmodSync(probePath, 0o700);
    const withExecute = lstatSync(probePath);
    chmodSync(probePath, 0o600);
    const restored = lstatSync(probePath);
    if (
      !withoutExecute.isFile() || withoutExecute.isSymbolicLink() ||
      (withoutExecute.mode & 0o100) !== 0 ||
      (withExecute.mode & 0o100) === 0 ||
      (restored.mode & 0o100) !== 0
    ) {
      throw new Error(
        "checkout filesystem does not faithfully preserve Git executable modes; use APFS, ext4, or another mode-faithful volume",
      );
    }
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

function safeRelativePath(bytes: Buffer): string {
  const path = bytes.toString("utf8");
  if (
    path.length === 0 ||
    !Buffer.from(path, "utf8").equals(bytes) ||
    path.startsWith("/") ||
    /[\\\0\r\n\t]/u.test(path) ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === ".." || segment === ".git")
  ) throw new Error("Git tree contains an unsafe tracked path");
  return path;
}

interface GitTreeNode {
  readonly blobs: Map<string, { readonly mode: string; readonly sha1: string }>;
  readonly trees: Map<string, GitTreeNode>;
}

function gitTreeNode(): GitTreeNode {
  return { blobs: new Map(), trees: new Map() };
}

function gitTreeEntryOrder(
  left: { readonly name: string; readonly tree: boolean },
  right: { readonly name: string; readonly tree: boolean },
): number {
  const leftKey = Buffer.concat([
    Buffer.from(left.name, "utf8"),
    Buffer.from([left.tree ? 0x2f : 0x00]),
  ]);
  const rightKey = Buffer.concat([
    Buffer.from(right.name, "utf8"),
    Buffer.from([right.tree ? 0x2f : 0x00]),
  ]);
  return Buffer.compare(leftKey, rightKey);
}

function gitTreeSha1(node: GitTreeNode): string {
  const entries: Array<{
    readonly name: string;
    readonly tree: boolean;
    readonly mode: string;
    readonly sha1: string;
  }> = [];
  for (const [name, blob] of node.blobs) entries.push({ name, tree: false, ...blob });
  for (const [name, tree] of node.trees) {
    entries.push({ name, tree: true, mode: "40000", sha1: gitTreeSha1(tree) });
  }
  entries.sort(gitTreeEntryOrder);
  const content = Buffer.concat(entries.flatMap(({ name, mode, sha1 }) => [
    Buffer.from(`${mode} ${name}\0`, "utf8"),
    Buffer.from(sha1, "hex"),
  ]));
  return createHash("sha1")
    .update(`tree ${content.byteLength}\0`, "utf8")
    .update(content)
    .digest("hex");
}

/** Independently reconstruct the root Git tree identity from a flat ls-tree listing. */
export function sentinelTrackedTreeSha1FromListing(listing: Uint8Array | string): string {
  const bytes = typeof listing === "string" ? Buffer.from(listing, "utf8") : Buffer.from(listing);
  if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0) {
    throw new Error("Git tree listing is empty or not NUL-terminated");
  }
  const root = gitTreeNode();
  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = bytes.indexOf(0, offset);
    if (end < 0) throw new Error("Git tree listing is not NUL-terminated");
    const record = bytes.subarray(offset, end);
    offset = end + 1;
    const tab = record.indexOf(0x09);
    if (tab <= 0 || tab === record.byteLength - 1) throw new Error("Git tree entry is malformed");
    const match = TREE_HEADER.exec(record.subarray(0, tab).toString("ascii"));
    if (match === null || match[2] !== "blob" || !["100644", "100755", "120000"].includes(match[1] as string)) {
      throw new Error("Git tree entry cannot form a supported root tree");
    }
    const path = safeRelativePath(record.subarray(tab + 1));
    const segments = path.split("/");
    const leaf = segments.pop() as string;
    let node = root;
    for (const segment of segments) {
      if (node.blobs.has(segment)) throw new Error("Git tree has a blob/directory path collision");
      let child = node.trees.get(segment);
      if (child === undefined) {
        child = gitTreeNode();
        node.trees.set(segment, child);
      }
      node = child;
    }
    if (node.trees.has(leaf) || node.blobs.has(leaf)) {
      throw new Error("Git tree has a duplicate or colliding path");
    }
    node.blobs.set(leaf, { mode: match[1] as string, sha1: match[3] as string });
  }
  return gitTreeSha1(root);
}

/**
 * Compare every blob in a raw `git ls-tree -r -z --full-tree HEAD` listing
 * directly with stable working-tree bytes and Git's executable/symlink mode.
 */
export function assertSentinelTrackedWorkingTreeMatchesHead(
  checkoutPath: string,
  listing: Uint8Array | string,
  expectedSourceTreeSha1?: string,
): void {
  const root = resolve(checkoutPath);
  assertSentinelGitModeFaithfulFilesystem(root);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync(root) !== root) {
    throw new Error("tracked checkout root must be a canonical physical directory");
  }
  const bytes = typeof listing === "string" ? Buffer.from(listing, "utf8") : Buffer.from(listing);
  if (bytes.byteLength > 0 && bytes[bytes.byteLength - 1] !== 0) {
    throw new Error("Git tree listing is not NUL-terminated");
  }
  const paths = new Set<string>();
  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = bytes.indexOf(0, offset);
    if (end < 0) throw new Error("Git tree listing is not NUL-terminated");
    const record = bytes.subarray(offset, end);
    offset = end + 1;
    if (record.byteLength === 0) throw new Error("Git tree listing contains an empty record");
    const tab = record.indexOf(0x09);
    if (tab <= 0 || tab === record.byteLength - 1) throw new Error("Git tree entry is malformed");
    const headerBytes = record.subarray(0, tab);
    if (!headerBytes.every((byte) => byte < 0x80)) throw new Error("Git tree entry header is not ASCII");
    const match = TREE_HEADER.exec(headerBytes.toString("ascii"));
    if (!match) throw new Error("Git tree entry header is malformed");
    const mode = match[1] as string;
    const type = match[2] as string;
    const expectedSha1 = match[3] as string;
    const relativePath = safeRelativePath(record.subarray(tab + 1));
    if (paths.has(relativePath)) throw new Error(`Git tree contains a duplicate tracked path: ${relativePath}`);
    paths.add(relativePath);
    if (mode === "160000" || type === "commit") {
      throw new Error(`Git submodules are not accepted in the tracked checkout: ${relativePath}`);
    }
    if (type !== "blob" || !["100644", "100755", "120000"].includes(mode)) {
      throw new Error(`Git tree contains an unsupported tracked entry: ${relativePath}`);
    }
    const path = resolve(root, relativePath);
    const parent = dirname(path);
    const parentReal = realpathSync(parent);
    if (parentReal !== parent || (parentReal !== root && !parentReal.startsWith(`${root}${sep}`))) {
      throw new Error(`tracked path traverses a non-physical directory: ${relativePath}`);
    }
    let actualBytes: Buffer;
    if (mode === "120000") {
      actualBytes = stableSymbolicLink(path);
    } else {
      const regular = stableRegularFile(path);
      actualBytes = regular.bytes;
      if (regular.gitMode !== mode) {
        throw new Error(`tracked file mode differs from HEAD: ${relativePath}`);
      }
    }
    if (gitBlobSha1(actualBytes) !== expectedSha1) {
      throw new Error(`tracked file bytes differ from HEAD: ${relativePath}`);
    }
  }
  if (paths.size === 0) throw new Error("Git tree listing contains no tracked files");
  if (
    expectedSourceTreeSha1 !== undefined &&
    sentinelTrackedTreeSha1FromListing(bytes) !== expectedSourceTreeSha1
  ) throw new Error("tracked-tree listing does not reconstruct the declared HEAD tree");
}
