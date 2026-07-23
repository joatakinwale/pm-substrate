/**
 * Pure-function tests for staleness helpers (ADR-0025 / G12).
 *
 * No DB. The helpers are clock-injected so we can drive deterministic
 * ageMs assertions.
 */

import { describe, expect, it } from "vitest";
import type { Edge, EdgeId, EntityId, NodeBase, TenantId, Timestamp } from "@pm/types";
import {
  isStale,
  readStalenessOf,
  withEdgeListStaleness,
  withEdgeStaleness,
  withNodeStaleness,
} from "./staleness.js";

const ts = (s: string): Timestamp => s as Timestamp;
const at = (s: string) => () => new Date(s);

const sampleNode: NodeBase = {
  id: "ent_test" as EntityId,
  tenantId: "tnt_test" as TenantId,
  profile: {
    tier1: "Counterparty",
    profile: "agency",
    concrete: "Lead",
  },
  identity: { email: "a@b.com" },
  createdAt: ts("2026-05-01T10:00:00.000Z"),
  updatedAt: ts("2026-05-10T12:00:00.000Z"),
  schemaVersion: 1,
  revision: 1,
};

const sampleEdge: Edge = {
  id: "edg_test" as EdgeId,
  tenantId: "tnt_test" as TenantId,
  type: "agency/client_has_project",
  fromId: "ent_a" as EntityId,
  toId: "ent_b" as EntityId,
  attrs: {},
  createdAt: ts("2026-05-01T10:00:00.000Z"),
  updatedAt: ts("2026-05-09T08:30:00.000Z"),
};

describe("readStalenessOf", () => {
  it("returns null for null / undefined", () => {
    expect(readStalenessOf(null)).toBeNull();
    expect(readStalenessOf(undefined)).toBeNull();
  });

  it("computes ageMs against an injected clock", () => {
    const out = readStalenessOf(sampleNode, at("2026-05-11T12:00:00.000Z"));
    expect(out).not.toBeNull();
    expect(out!.modifiedAt).toBe(sampleNode.updatedAt);
    expect(out!.readAt).toBe("2026-05-11T12:00:00.000Z");
    // 1 day exactly
    expect(out!.ageMs).toBe(24 * 60 * 60 * 1000);
  });

  it("clamps negative ageMs to zero on clock skew", () => {
    // Clock reads BEFORE the row's updatedAt. Substrate hasn't time-travelled;
    // this is process-clock drift. ageMs must be >= 0 so downstream
    // predicates don't go negative.
    const out = readStalenessOf(sampleNode, at("2026-04-01T00:00:00.000Z"));
    expect(out).not.toBeNull();
    expect(out!.ageMs).toBe(0);
  });

  it("uses Date.now by default when no clock is injected", () => {
    const out = readStalenessOf(sampleNode);
    expect(out).not.toBeNull();
    expect(out!.ageMs).toBeGreaterThanOrEqual(0);
    expect(out!.modifiedAt).toBe(sampleNode.updatedAt);
  });
});

describe("withNodeStaleness", () => {
  it("returns null for null input (so callers don't need a pre-check)", () => {
    expect(withNodeStaleness(null)).toBeNull();
  });

  it("returns the node paired with its staleness", () => {
    const out = withNodeStaleness(sampleNode, at("2026-05-11T12:00:00.000Z"));
    expect(out).not.toBeNull();
    expect(out!.node).toBe(sampleNode);
    expect(out!.staleness.ageMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("withEdgeStaleness", () => {
  it("returns null for null input", () => {
    expect(withEdgeStaleness(null)).toBeNull();
  });

  it("returns the edge paired with its staleness", () => {
    const out = withEdgeStaleness(sampleEdge, at("2026-05-10T08:30:00.000Z"));
    expect(out).not.toBeNull();
    expect(out!.edge).toBe(sampleEdge);
    // 24h exactly
    expect(out!.staleness.ageMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("withEdgeListStaleness", () => {
  it("annotates every edge in a list with the same readAt", () => {
    const e2: Edge = { ...sampleEdge, id: "edg_two" as EdgeId, updatedAt: ts("2026-05-08T08:30:00.000Z") };
    const out = withEdgeListStaleness([sampleEdge, e2], at("2026-05-10T08:30:00.000Z"));
    expect(out).toHaveLength(2);
    expect(out[0]!.staleness.readAt).toBe(out[1]!.staleness.readAt);
    expect(out[0]!.staleness.ageMs).toBe(24 * 60 * 60 * 1000);
    expect(out[1]!.staleness.ageMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("handles empty input", () => {
    expect(withEdgeListStaleness([], at("2026-05-11T12:00:00.000Z"))).toEqual([]);
  });
});

describe("isStale", () => {
  const sten = readStalenessOf(sampleNode, at("2026-05-11T12:00:00.000Z"))!;

  it("returns true when ageMs > maxAgeMs", () => {
    expect(isStale(sten, 1000)).toBe(true);
  });

  it("returns false when ageMs <= maxAgeMs", () => {
    expect(isStale(sten, 2 * 24 * 60 * 60 * 1000)).toBe(false);
    // exact boundary: ageMs is 1 day; threshold 1 day means NOT stale yet
    expect(isStale(sten, 24 * 60 * 60 * 1000)).toBe(false);
  });
});
