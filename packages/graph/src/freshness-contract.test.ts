import { describe, it, expect } from "vitest";
import type { Timestamp } from "@pm/types";
import {
  freshnessGate,
  requireFresh,
  StaleReadError,
  readStalenessOf,
  type ReadStaleness,
} from "./staleness.js";

const FIXED_NOW = new Date("2026-06-24T20:00:00.000Z");
const clock = () => FIXED_NOW;

function stalenessAtAge(ageMs: number): ReadStaleness {
  return {
    readAt: FIXED_NOW.toISOString() as Timestamp,
    modifiedAt: new Date(FIXED_NOW.getTime() - ageMs).toISOString() as Timestamp,
    ageMs,
  };
}

describe("freshnessGate", () => {
  it("authorizes a fresh read and carries the staleness on the ok branch", () => {
    const d = freshnessGate(stalenessAtAge(1000), 5000);
    expect(d.authorized).toBe(true);
    if (d.authorized) expect(d.staleness.ageMs).toBe(1000);
  });

  it("denies a stale read with reason stale_read", () => {
    const d = freshnessGate(stalenessAtAge(9000), 5000);
    expect(d.authorized).toBe(false);
    if (!d.authorized) {
      expect(d.reason).toBe("stale_read");
      expect(d.ageMs).toBe(9000);
      expect(d.maxAgeMs).toBe(5000);
    }
  });

  it("denies a missing read with reason missing_read (unknown reality = refuse)", () => {
    const d = freshnessGate(null, 5000);
    expect(d.authorized).toBe(false);
    if (!d.authorized) {
      expect(d.reason).toBe("missing_read");
      expect(d.ageMs).toBeNull();
    }
  });

  it("boundary: ageMs == maxAgeMs is authorized (strictly greater is stale)", () => {
    const d = freshnessGate(stalenessAtAge(5000), 5000);
    expect(d.authorized).toBe(true);
  });
});

describe("requireFresh", () => {
  it("returns the validated staleness when fresh", () => {
    const s = requireFresh(stalenessAtAge(100), 5000);
    expect(s.ageMs).toBe(100);
  });

  it("THROWS StaleReadError on a stale read (cannot be silently ignored)", () => {
    expect(() => requireFresh(stalenessAtAge(9000), 5000)).toThrow(StaleReadError);
  });

  it("THROWS on a missing read", () => {
    expect(() => requireFresh(null, 5000)).toThrow(StaleReadError);
    try {
      requireFresh(null, 5000);
    } catch (e) {
      expect((e as StaleReadError).detail.reason).toBe("missing_read");
    }
  });

  it("integrates with readStalenessOf end-to-end", () => {
    const freshNode = {
      updatedAt: new Date(FIXED_NOW.getTime() - 200).toISOString() as Timestamp,
    };
    const staleNode = {
      updatedAt: new Date(FIXED_NOW.getTime() - 60_000).toISOString() as Timestamp,
    };
    expect(requireFresh(readStalenessOf(freshNode, clock), 5000).ageMs).toBe(200);
    expect(() => requireFresh(readStalenessOf(staleNode, clock), 5000)).toThrow(
      StaleReadError,
    );
  });
});
