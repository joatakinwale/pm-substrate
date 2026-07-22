#!/usr/bin/env tsx
/**
 * scripts/witness-anchor.ts — external witnessing in an afternoon, not a
 * milestone (external review 2026-07-15, recommendation 3; the research basis
 * in docs/objective-falsification.md already names Sigstore Rekor and OSF).
 *
 * Anchors artifact bytes to third-party witnesses that this repository's
 * owner does NOT control: a public transparency log (Sigstore Rekor) and/or
 * a public git tag. Use it BEFORE a run on the preregistration bytes, and
 * AFTER a run on the raw-root manifest bytes.
 *
 * This is deliberately NOT a verifier: it computes digests and prints the
 * exact external commands. It publishes nothing unless --publish is passed.
 *
 *   pnpm witness:anchor -- --label prereg path/to/preregistration.json
 *   pnpm witness:anchor -- --publish --label prereg path/to/preregistration.json
 */

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { argv, exit } from "node:process";

const args = argv.slice(2);
const publish = args.includes("--publish");
const labelIndex = args.indexOf("--label");
const label =
  labelIndex >= 0 && args[labelIndex + 1] ? args[labelIndex + 1]! : "artifact";
const paths = args.filter(
  (a, i) => !a.startsWith("--") && (labelIndex < 0 || i !== labelIndex + 1),
);

if (paths.length === 0) {
  console.error(
    "usage: pnpm witness:anchor -- [--publish] [--label <name>] <file> [...]",
  );
  exit(2);
}

const gitHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const entries = paths.map((p) => {
  const absolute = resolve(p);
  const sha256 = createHash("sha256")
    .update(readFileSync(absolute))
    .digest("hex");
  return { path: absolute, sha256 };
});

console.log(`witness-anchor: label=${label} gitHead=${gitHead}`);
for (const { path, sha256 } of entries) {
  console.log(`  sha256:${sha256}  ${path}`);
}

const tagName = `witness/${label}/${entries[0]!.sha256.slice(0, 16)}`;

console.log(`
External anchors (third parties this repo's owner does not control):

1. Sigstore Rekor via keyless cosign (public append-only transparency log;
   free; signing identity is your OIDC account, recorded in the log):`);
for (const { path, sha256 } of entries) {
  console.log(
    `     cosign sign-blob "${path}" --bundle "${path}.rekor.bundle"\n` +
      `     # verify later: rekor-cli search --sha ${sha256}`,
  );
}
console.log(`
2. Public git tag (timestamped by the hosting provider on push):
     git tag -a "${tagName}" -m "witness ${label}: ${entries
       .map((e) => `sha256:${e.sha256} ${basename(e.path)}`)
       .join("; ")}" ${gitHead}
     git push origin "${tagName}"

3. OSF registration (https://help.osf.io/article/330-welcome-to-registrations):
     paste the sha256 lines above into a frozen, timestamped registration
     BEFORE the run they preregister.
`);

if (!publish) {
  console.log(
    "dry run: nothing published. Re-run with --publish to create the local " +
      "git tag (pushing, and Rekor upload, remain manual and deliberate).",
  );
  exit(0);
}

// --publish creates only the LOCAL tag; pushing it and the Rekor upload are
// left as explicit human actions so nothing leaves the machine implicitly.
const tag = spawnSync(
  "git",
  [
    "tag",
    "-a",
    tagName,
    "-m",
    `witness ${label}: ${entries
      .map((e) => `sha256:${e.sha256} ${basename(e.path)}`)
      .join("; ")}`,
    gitHead,
  ],
  { stdio: "inherit" },
);
if (tag.status !== 0) exit(tag.status ?? 1);
console.log(
  `created local tag ${tagName} at ${gitHead}. Push it (git push origin ` +
    `"${tagName}") and run the rekor-cli upload above to complete witnessing.`,
);
