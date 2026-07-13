import { describe, expect, it } from "vitest";

import {
  BOUNDARY_CONFORMANCE_SCHEMA_VERSION,
  buildBoundaryConformanceArtifact,
  parseBoundaryConformanceArtifact,
  requireBoundaryConformanceBinding,
  type BoundaryConformanceArtifactInput,
} from "./boundary-conformance.js";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const input = (
  overrides: Partial<BoundaryConformanceArtifactInput> = {},
): BoundaryConformanceArtifactInput => ({
  appId: "orbit_crm",
  observedAt: "2026-07-13T12:00:00.000Z",
  appRevision: "orbit_crm@abc1234",
  substrateRevision: "pm-substrate@def5678",
  checks: [
    {
      name: "contract-suite",
      command: "pnpm test:integration-contract",
      exitCode: 0,
      signal: null,
      durationMs: 42,
      stdoutBytes: 0,
      stdoutSha256: EMPTY_SHA256,
      stderrBytes: 0,
      stderrSha256: EMPTY_SHA256,
    },
  ],
  ...overrides,
});

describe("boundary-conformance artifact", () => {
  it("builds a deterministic ready artifact from passing checks", () => {
    const first = buildBoundaryConformanceArtifact(input());
    const second = buildBoundaryConformanceArtifact(input());

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(BOUNDARY_CONFORMANCE_SCHEMA_VERSION);
    expect(first.ready).toBe(true);
    expect(first.blockers).toEqual([]);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves failed checks as blockers instead of producing a ready receipt", () => {
    const failed = buildBoundaryConformanceArtifact(
      input({
        checks: [
          {
            ...input().checks[0]!,
            exitCode: 1,
            stderrBytes: 7,
            stderrSha256:
              "1c8bfe8f801d79745c4631d09fff36c82c3f575880c00b8cadd85287c445a11a",
          },
        ],
      }),
    );

    expect(failed.ready).toBe(false);
    expect(failed.blockers).toEqual(["contract-suite: exit 1"]);
  });

  it("rejects placeholders, empty suites, duplicate names, and fake hashes", () => {
    expect(() =>
      buildBoundaryConformanceArtifact(
        input({ appRevision: "replace-with:app-revision" }),
      ),
    ).toThrow(/appRevision/);
    expect(() =>
      buildBoundaryConformanceArtifact(input({ checks: [] })),
    ).toThrow(/at least one/);
    expect(() =>
      buildBoundaryConformanceArtifact(
        input({ checks: [input().checks[0]!, input().checks[0]!] }),
      ),
    ).toThrow(/duplicate/);
    expect(() =>
      buildBoundaryConformanceArtifact(
        input({
          checks: [{ ...input().checks[0]!, stdoutSha256: "not-a-hash" }],
        }),
      ),
    ).toThrow(/stdoutSha256/);
  });

  it("detects tampering and requires an exact green revision binding", () => {
    const artifact = buildBoundaryConformanceArtifact(input());
    expect(parseBoundaryConformanceArtifact(artifact)).toEqual(artifact);
    expect(() =>
      parseBoundaryConformanceArtifact({ ...artifact, ready: false }),
    ).toThrow(/ready verdict/);
    expect(() =>
      parseBoundaryConformanceArtifact({
        ...artifact,
        checks: [{ ...artifact.checks[0]!, exitCode: 1 }],
      }),
    ).toThrow(/ready verdict|blockers|contentHash/);

    expect(
      requireBoundaryConformanceBinding(artifact, {
        appId: artifact.appId,
        appRevision: artifact.appRevision,
        substrateRevision: artifact.substrateRevision,
        contentHash: artifact.contentHash,
      }),
    ).toEqual(artifact);
    expect(() =>
      requireBoundaryConformanceBinding(artifact, {
        appId: artifact.appId,
        appRevision: "orbit_crm@new-head",
        substrateRevision: artifact.substrateRevision,
        contentHash: artifact.contentHash,
      }),
    ).toThrow(/appRevision mismatch/);
  });

  it("never accepts a failed artifact as a D6 binding", () => {
    const failed = buildBoundaryConformanceArtifact(
      input({ checks: [{ ...input().checks[0]!, exitCode: 1 }] }),
    );

    expect(() =>
      requireBoundaryConformanceBinding(failed, {
        appId: failed.appId,
        appRevision: failed.appRevision,
        substrateRevision: failed.substrateRevision,
        contentHash: failed.contentHash,
      }),
    ).toThrow(/not ready/);
  });
});
