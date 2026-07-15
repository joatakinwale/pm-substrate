import { mkdtempSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  sentinelRawInventory,
  sentinelRawJsonSha256,
  sentinelRawStructurallyValidPng,
  sentinelRawVerifyInventory,
} from "./sentinel-production-raw-utils.js";

function png(): Buffer {
  // A canonical 1x1 RGBA PNG with valid CRCs.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

describe("Sentinel raw verification utilities", () => {
  it("rejects malformed PNG chunks rather than trusting the signature", () => {
    const valid = png();
    expect(sentinelRawStructurallyValidPng(valid)).toBe(true);
    const corrupt = Buffer.from(valid);
    corrupt[corrupt.length - 5] ^= 1;
    expect(sentinelRawStructurallyValidPng(corrupt)).toBe(false);
    expect(sentinelRawStructurallyValidPng(valid.subarray(0, valid.length - 1))).toBe(false);
  });

  it("detects extra artifacts and hash substitution", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sentinel-raw-utils-"));
    mkdirSync(resolve(root, "nested"));
    writeFileSync(resolve(root, "nested", "a.txt"), "a");
    const declared = sentinelRawInventory(root);
    expect(sentinelRawVerifyInventory(root, declared)).toEqual([]);
    writeFileSync(resolve(root, "extra.txt"), "extra");
    expect(sentinelRawVerifyInventory(root, declared).join(" ")).toContain("extras");
    unlinkSync(resolve(root, "extra.txt"));
    expect(sentinelRawVerifyInventory(root, [{ ...declared[0]!, sha256: "0".repeat(64) }]).join(" ")).toContain("hashes");
  });

  it("canonicalizes nested JSON independently of insertion order", () => {
    expect(sentinelRawJsonSha256({ b: { z: 2, a: 1 }, a: 0 })).toBe(
      sentinelRawJsonSha256({ a: 0, b: { a: 1, z: 2 } }),
    );
  });
});
